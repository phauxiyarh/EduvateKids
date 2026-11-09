/**
 * How a POS customer pays, shared by the dashboard POS and the /pos page.
 *
 * Sales and orders keep their original `paymentType` (Cash, Card or Transfer)
 * so every report, total and export keeps working. The exact method the
 * customer used is stored beside it as `paymentMethod`.
 */

export type PosPaymentType = 'Cash' | 'Card' | 'Transfer'

export type PosPaymentMethod = 'Cash' | 'Zelle' | 'Cash App' | 'Square'

/** What an order can be set to when edited: a method, or the legacy
 *  "Transfer" for orders recorded before methods were tracked. */
export type PaymentChoice = PosPaymentMethod | 'Transfer'

export type PosPaymentOption = {
  id: PosPaymentMethod
  label: string
  hint: string
  paymentType: PosPaymentType
  /** Public path of the QR code the customer scans, for app transfers. */
  qr?: string
}

export const POS_PAYMENT_OPTIONS: PosPaymentOption[] = [
  { id: 'Cash', label: 'Cash', hint: 'Paid at the till', paymentType: 'Cash' },
  { id: 'Zelle', label: 'Zelle', hint: 'QR code', paymentType: 'Transfer', qr: '/payment/zelle-qr.png' },
  { id: 'Cash App', label: 'Cash App', hint: 'QR code', paymentType: 'Transfer', qr: '/payment/cashapp-qr.png' },
  { id: 'Square', label: 'Card', hint: 'Square, 3% fee', paymentType: 'Card' }
]

export const paymentOption = (method: PosPaymentMethod): PosPaymentOption =>
  POS_PAYMENT_OPTIONS.find((o) => o.id === method) ?? POS_PAYMENT_OPTIONS[0]

export const paymentTypeFor = (choice: PaymentChoice): PosPaymentType =>
  choice === 'Transfer' ? 'Transfer' : paymentOption(choice).paymentType

const isMethod = (value: unknown): value is PosPaymentMethod =>
  POS_PAYMENT_OPTIONS.some((o) => o.id === value)

/** The method a stored sale or order was paid by. Older records carry only a
 *  paymentType, so Card reads as the Square device and Transfer stays Transfer. */
export const paymentChoiceOf = (record: { paymentType?: string; paymentMethod?: string }): PaymentChoice => {
  if (isMethod(record.paymentMethod)) return record.paymentMethod
  if (record.paymentType === 'Card') return 'Square'
  if (record.paymentType === 'Transfer') return 'Transfer'
  return 'Cash'
}

/** Short label for lists, exports and till totals: Cash, Zelle, Cash App,
 *  Card, or Transfer for older app transfers. */
export const paymentLabel = (record: { paymentType?: string; paymentMethod?: string }): string => {
  const choice = paymentChoiceOf(record)
  return choice === 'Transfer' ? 'Transfer' : paymentOption(choice).label
}

/** Order the till totals read in. */
export const PAYMENT_LABEL_ORDER = ['Cash', 'Zelle', 'Cash App', 'Card', 'Transfer']
