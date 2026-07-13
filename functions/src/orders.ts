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
 * Resolve the INVENTORY document that a catalog item corresponds to, so online
 * orders draw from the same single stock ledger as POS/event/general sales.
 * Match priority: shared SKU, then ISBN, then exact title. Returns null if none.
 * Inventory is the source of truth; catalog carries a mirrored display count.
 */
async function resolveInventoryRef(
  db: FirebaseFirestore.Firestore,
  catalog: { sku?: string; isbn?: string; title?: string }
): Promise<FirebaseFirestore.DocumentReference | null> {
  const inv = db.collection('inventory');
  const sku = String(catalog.sku ?? '').trim();
  if (sku) {
    const q = await inv.where('sku', '==', sku).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }
  const isbn = String(catalog.isbn ?? '').trim();
  if (isbn) {
    const q = await inv.where('isbn', '==', isbn).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }
  const title = String(catalog.title ?? '').trim();
  if (title) {
    const q = await inv.where('title', '==', title).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }
  return null;
}

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

    // Resolve the inventory ledger doc for this catalog item (single source of
    // truth for stock). Stored on the order so cancel/delete can restore it.
    const sku = String(data.sku ?? '').trim();
    const invRef = await resolveInventoryRef(db, {
      sku,
      isbn: String(data.isbn ?? '').trim(),
      title: String(data.title ?? ''),
    });

    items.push({
      id: snap.id,
      // Only include optional keys when present — Firestore rejects `undefined`
      // values, so an item with no linked inventory/SKU must omit them entirely.
      ...(invRef ? { inventoryId: invRef.id } : {}),
      ...(sku ? { sku } : {}),
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

    // Decrement stock on a `paid` order. INVENTORY is the single source of truth
    // (POS/events/general sales use it too); the catalog carries a mirrored
    // display count. Read all docs BEFORE writing (Firestore requires reads first).
    const stockOps: {
      invRef: FirebaseFirestore.DocumentReference | null;
      catRef: FirebaseFirestore.DocumentReference;
      catField: string | null;
      invCurrent: number;
      catCurrent: number;
      qty: number;
    }[] = [];
    if (params.status === 'paid') {
      for (const item of params.items) {
        const catRef = db.collection('catalog').doc(item.id);
        const catSnap = await tx.get(catRef);
        const catData = catSnap.exists ? (catSnap.data() as Record<string, unknown>) : {};
        const catField = catData.stock !== undefined ? 'stock' : catData.quantity !== undefined ? 'quantity' : 'stock';
        const invRef = item.inventoryId ? db.collection('inventory').doc(item.inventoryId) : null;
        let invCurrent = 0;
        if (invRef) {
          const invSnap = await tx.get(invRef);
          invCurrent = invSnap.exists ? Number((invSnap.data() as Record<string, unknown>).quantity ?? 0) : 0;
        }
        stockOps.push({
          invRef,
          catRef,
          catField: catSnap.exists ? catField : null,
          invCurrent,
          catCurrent: Number((catData[catField] as number) ?? 0),
          qty: item.quantity,
        });
      }
    }
    for (const s of stockOps) {
      // Authoritative decrement on inventory.
      if (s.invRef) {
        const next = Math.max(0, s.invCurrent - s.qty);
        tx.update(s.invRef, { quantity: next, _live: true });
        // Mirror the same count onto the catalog display field.
        if (s.catField) tx.update(s.catRef, { [s.catField]: next });
      } else if (s.catField) {
        // No linked inventory doc: fall back to decrementing catalog directly.
        tx.update(s.catRef, { [s.catField]: Math.max(0, s.catCurrent - s.qty) });
      }
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
