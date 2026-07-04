/**
 * Server-authoritative order pricing and idempotent finalization.
 *
 * Rules of the road:
 *  - NEVER trust client-sent prices/totals. Recompute from Firestore.
 *  - Order writes are idempotent (a webhook and the client return may both fire).
 *  - Stock is decremented inside the same transaction that marks the order paid.
 */
import * as admin from 'firebase-admin';
import { CURRENCY, FLAT_SHIPPING_FEE, FREE_SHIPPING_THRESHOLD, TAX_RATE_PERCENT } from './config';
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
  lines: CartLineInput[]
): Promise<{ items: OrderItem[]; subtotal: number; shippingFee: number; tax: number; total: number; currency: string }> {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('Cart is empty.');
  }

  const items: OrderItem[] = [];
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

    items.push({
      id: snap.id,
      title: String(data.title ?? ''),
      quantity: qty,
      unitPrice: round2(unitPrice),
      lineTotal: round2(unitPrice * qty),
    });
  }

  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
  const freeOver = Number(FREE_SHIPPING_THRESHOLD.value() || '50');
  const flat = Number(FLAT_SHIPPING_FEE.value() || '5.99');
  const shippingFee = subtotal >= freeOver ? 0 : round2(flat);
  // Sales tax on the subtotal (flat rate; Maryland default 6%).
  const taxRate = Number(TAX_RATE_PERCENT.value() || '0') / 100;
  const tax = round2(subtotal * taxRate);
  const total = round2(subtotal + shippingFee + tax);

  return { items, subtotal, shippingFee, tax, total, currency: CURRENCY.value() || 'usd' };
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
    tax: number;
    total: number;
    currency: string;
    customer: CustomerInfo;
    shippingAddress: ShippingAddress;
    live: boolean;
  }
): Promise<{ orderId: string; created: boolean }> {
  const ordersCol = db.collection('orders');

  return db.runTransaction(async (tx) => {
    // Idempotency: one order per paymentRef.
    const existing = await tx.get(ordersCol.where('paymentRef', '==', params.paymentRef).limit(1));
    if (!existing.empty) {
      return { orderId: existing.docs[0].id, created: false };
    }

    // Decrement stock only when marking paid.
    if (params.status === 'paid') {
      for (const item of params.items) {
        const ref = db.collection('catalog').doc(item.id);
        const snap = await tx.get(ref);
        if (snap.exists) {
          const data = snap.data() as Record<string, unknown>;
          const field = data.stock !== undefined ? 'stock' : data.quantity !== undefined ? 'quantity' : null;
          if (field) {
            const current = Number(data[field] ?? 0);
            tx.update(ref, { [field]: Math.max(0, current - item.quantity) });
          }
        }
      }
    }

    const orderRef = ordersCol.doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const order: Order = {
      items: params.items,
      subtotal: params.subtotal,
      shippingFee: params.shippingFee,
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
