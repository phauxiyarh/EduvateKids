/**
 * Shared server-side types for Eduvate Kids Cloud Functions.
 * Mirror of the client-side order/cart model. Keep in sync with
 * app/lib/orders.ts (client types).
 */

export type PaymentProvider = 'stripe' | 'paypal';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'shipped'
  | 'cancelled';

/** A single line item as submitted by the client (quantities only; prices are recomputed server-side). */
export interface CartLineInput {
  id: string; // catalog/inventory document id
  quantity: number;
}

/** A resolved, server-priced line item stored on the order. */
export interface OrderItem {
  id: string;            // catalog document id
  inventoryId?: string;  // resolved inventory document id (single stock ledger)
  sku?: string;          // shared SKU that links catalog <-> inventory
  title: string;
  quantity: number;
  unitPrice: number; // authoritative price from Firestore at purchase time
  lineTotal: number;
  weightGrams?: number; // per-unit weight used for shipping (0 if unknown)
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone?: string;
}

export interface Order {
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  shipWeightGrams?: number; // cumulative content weight used for shipping
  shipZone?: number;        // distance zone (1..8) used for shipping
  tax: number;
  total: number;
  currency: string;
  customer: CustomerInfo;
  shippingAddress: ShippingAddress;
  paymentProvider: PaymentProvider;
  paymentRef: string; // Stripe PaymentIntent id or PayPal order/capture id
  status: OrderStatus;
  _live: boolean;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  paidAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  shippedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  notes?: string;
}

/** Payload the checkout page sends to create a payment. Amounts are NEVER trusted from the client. */
export interface CreatePaymentInput {
  items: CartLineInput[];
  customer: CustomerInfo;
  shippingAddress: ShippingAddress;
}
