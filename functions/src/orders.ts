/**
 * Server-authoritative order pricing and idempotent finalization.
 *
 * Rules of the road:
 *  - NEVER trust client-sent prices/totals. Recompute from Firestore.
 *  - Order writes are idempotent (a webhook and the client return may both fire).
 *  - Stock is decremented inside the same transaction that marks the order paid.
 */
import * as admin from 'firebase-admin';
import { CURRENCY, TAX_RATE_PERCENT, shippingParams } from './config';
import { computeShipping } from './shipping';
import type {
  CartLineInput,
  CustomerInfo,
  Order,
  OrderItem,
  PaymentProvider,
  ShippingAddress,
} from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve cart line inputs against the live `catalog` collection and compute an
 * authoritative price breakdown. Throws if any item is missing, not purchasable,
 * or out of stock for the requested quantity.
 */
export async function priceCart(
  db: FirebaseFirestore.Firestore,
  lines: CartLineInput[],
  destinationState = ''
): Promise<{
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  shipWeightGrams: number;
  shipZone: number;
  tax: number;
  total: number;
  currency: string;
}> {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('Cart is empty.');
  }

  const ship = shippingParams();
  const defaultItemGrams = ship.defaultItemWeightKg * 1000;

  const items: OrderItem[] = [];
  let contentGrams = 0;
  for (const line of lines) {
    const qty = Math.max(1, Math.floor(Number(line.quantity) || 0));
    const snap = await db.collection('catalog').doc(String(line.id)).get();
    if (!snap.exists) throw new Error(`Item not found: ${line.id}`);
    const data = snap.data() as Record<string, unknown>;

    const isPurchasable = data.isPurchasable !== false; // default purchasable unless explicitly false
    if (!isPurchasable) throw new Error(`Item not purchasable: ${line.id}`);

    const unitPrice = Number(data.price ?? 0);
    if (!(unitPrice > 0)) throw new Error(`Item has no price: ${line.id}`);

    const stock = data.stock ?? data.quantity;
    if (stock !== undefined && Number(stock) < qty) {
      throw new Error(`Insufficient stock for ${String(data.title ?? line.id)}`);
    }

    // Per-unit weight in grams; fall back to the configured default if unset.
    const rawWeight = Number(data.weight ?? data.weightGrams ?? 0);
    const unitGrams = rawWeight > 0 ? rawWeight : defaultItemGrams;
    contentGrams += unitGrams * qty;

    items.push({
      id: snap.id,
      title: String(data.title ?? ''),
      quantity: qty,
      unitPrice: round2(unitPrice),
      lineTotal: round2(unitPrice * qty),
      weightGrams: Math.round(unitGrams),
    });
  }

  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));

  const shipCalc = computeShipping({
    contentGrams,
    subtotal,
    state: destinationState,
    params: ship,
  });

  // Sales tax on the subtotal (flat rate; Maryland default 6%).
  const taxRate = Number(TAX_RATE_PERCENT.value() || '0') / 100;
  const tax = round2(subtotal * taxRate);
  const total = round2(subtotal + shipCalc.fee + tax);

  return {
    items,
    subtotal,
    shippingFee: shipCalc.fee,
    shipWeightGrams: Math.round(contentGrams),
    shipZone: shipCalc.zone,
    tax,
    total,
    currency: CURRENCY.value() || 'usd',
  };
}

/**
 * Idempotently create or confirm an order for a given payment reference.
 * If an order with this paymentRef already exists, it is returned unchanged
 * (prevents double-processing when both the client and the webhook call in).
 * On first write for a `paid` status, stock is decremented in the same transaction.
 */
export async function finalizeOrder(
  db: FirebaseFirestore.Firestore,
  params: {
    paymentRef: string;
    provider: PaymentProvider;
    status: Order['status'];
    items: OrderItem[];
    subtotal: number;
    shippingFee: number;
    shipWeightGrams?: number;
    shipZone?: number;
    tax: number;
    total: number;
    currency: string;
    customer: CustomerInfo;
    shippingAddress: ShippingAddress;
    live: boolean;
  }
): Promise<{ orderId: string; created: boolean }> {
  const ordersCol = db.collection('orders');
  // Deterministic doc id per payment ref → the transaction locks on THIS doc,
  // so concurrent webhook retries can't create duplicates. (Sanitize for id safety.)
  const orderId = params.paymentRef.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128) || ordersCol.doc().id;
  const orderRef = ordersCol.doc(orderId);

  return db.runTransaction(async (tx) => {
    // Idempotency: one order per paymentRef (guarded by reading the exact doc).
    const existingDoc = await tx.get(orderRef);
    if (existingDoc.exists) {
      return { orderId: orderRef.id, created: false };
    }

    // Read stock docs BEFORE any writes (Firestore requires all reads first).
    const stockReads: { ref: FirebaseFirestore.DocumentReference; field: string | null; current: number; qty: number }[] = [];
    if (params.status === 'paid') {
      for (const item of params.items) {
        const ref = db.collection('catalog').doc(item.id);
        const snap = await tx.get(ref);
        if (snap.exists) {
          const data = snap.data() as Record<string, unknown>;
          const field = data.stock !== undefined ? 'stock' : data.quantity !== undefined ? 'quantity' : null;
          stockReads.push({ ref, field, current: Number((field && data[field]) ?? 0), qty: item.quantity });
        }
      }
    }
    for (const s of stockReads) {
      if (s.field) tx.update(s.ref, { [s.field]: Math.max(0, s.current - s.qty) });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const order: Order = {
      items: params.items,
      subtotal: params.subtotal,
      shippingFee: params.shippingFee,
      ...(params.shipWeightGrams !== undefined ? { shipWeightGrams: params.shipWeightGrams } : {}),
      ...(params.shipZone !== undefined ? { shipZone: params.shipZone } : {}),
      tax: params.tax,
      total: params.total,
      currency: params.currency,
      customer: params.customer,
      shippingAddress: params.shippingAddress,
      paymentProvider: params.provider,
      paymentRef: params.paymentRef,
      status: params.status,
      _live: params.live,
      createdAt: now,
      ...(params.status === 'paid' ? { paidAt: now } : {}),
    };
    tx.set(orderRef, order);
    return { orderId: orderRef.id, created: true };
  });
}
