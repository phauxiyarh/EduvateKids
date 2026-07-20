/**
 * Client-side order/cart types for Eduvate Kids.
 * Mirror of functions/src/types.ts, keep the two in sync.
 * (No server secrets or logic here; purely shared shapes for the checkout UI.)
 */

export type PaymentProvider = 'stripe' | 'paypal'

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'shipped' | 'cancelled'

/** What the cart sends to the payment function: quantities only; prices are computed server-side. */
export interface CartLineInput {
  id: string
  quantity: number
}

export interface OrderItem {
  id: string
  title: string
  quantity: number
  unitPrice: number
  lineTotal: number
  weightGrams?: number
}

export interface ShippingAddress {
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
  country: string
}

export interface CustomerInfo {
  name: string
  email: string
  phone?: string
}

export interface CreatePaymentInput {
  items: CartLineInput[]
  customer: CustomerInfo
  shippingAddress: ShippingAddress
}
