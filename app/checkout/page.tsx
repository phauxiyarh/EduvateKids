'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../lib/firebase'
import { useCart } from '../../lib/cart'
import { AddressAutocomplete } from '../components/AddressAutocomplete'
import logo from '../../assets/logo.png'
import type { CustomerInfo, ShippingAddress } from '../../lib/orders'

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const isTestKey = !PUBLISHABLE_KEY || PUBLISHABLE_KEY.startsWith('pk_test_')
let stripePromise: Promise<Stripe | null> | null = null
function getStripe() {
  if (!stripePromise && PUBLISHABLE_KEY) stripePromise = loadStripe(PUBLISHABLE_KEY)
  return stripePromise
}

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30'

type Step = 'address' | 'payment'

export default function CheckoutPage() {
  const { items, subtotal, count } = useCart()
  const [step, setStep] = useState<Step>('address')
  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', email: '', phone: '' })
  const [address, setAddress] = useState<ShippingAddress>({
    line1: '', line2: '', city: '', state: '', postalCode: '', country: 'United States',
  })
  const [clientSecret, setClientSecret] = useState<string>('')
  const [serverTotal, setServerTotal] = useState<number | null>(null)
  const [breakdown, setBreakdown] = useState<{ shippingFee: number; tax: number; shipWeightGrams?: number; shipZone?: number } | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const canSubmitAddress =
    customer.name && customer.email && address.line1 && address.city && address.state && address.postalCode && address.country

  const proceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!canSubmitAddress) return
    setCreating(true)
    try {
      // Verify + standardise the US address via USPS (non-blocking: if the
      // service is unavailable we proceed with what the customer typed). A
      // corrected address is applied so shipping zone/ZIP are canonical.
      let shippingAddress = address
      try {
        const validate = httpsCallable(functions, 'validateAddress')
        const vr = (await validate({ address })).data as {
          available: boolean; valid?: boolean; changed?: boolean
          corrected?: ShippingAddress | null; message?: string
        }
        if (vr.available && vr.valid === false) {
          setError(vr.message || 'We could not verify that address. Please double-check it.')
          setCreating(false)
          return
        }
        if (vr.available && vr.corrected) {
          // Apply USPS standardisation silently so the shipping zone/ZIP are
          // canonical, without showing the customer a notice.
          shippingAddress = vr.corrected
          setAddress(vr.corrected)
        }
      } catch {
        /* validation unavailable — proceed with entered address */
      }

      const call = httpsCallable(functions, 'createStripePaymentIntent')
      const res = await call({
        items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
        customer,
        shippingAddress,
      })
      const data = res.data as { clientSecret: string; subtotal: number; shippingFee: number; shipWeightGrams?: number; shipZone?: number; tax: number; total: number; currency: string }
      setClientSecret(data.clientSecret)
      setServerTotal(data.total)
      setBreakdown({ shippingFee: data.shippingFee, tax: data.tax, shipWeightGrams: data.shipWeightGrams, shipZone: data.shipZone })
      setStep('payment')
    } catch (err) {
      const msg = (err as { message?: string })?.message || 'Could not start checkout. Please try again.'
      setError(msg)
    } finally {
      setCreating(false)
    }
  }

  // Empty cart guard.
  if (count === 0 && step === 'address') {
    return (
      <Shell>
        <div className="mx-auto flex min-h-[50vh] w-11/12 max-w-2xl flex-col items-center justify-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 text-primary/40">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <h1 className="font-display text-2xl">Your cart is empty</h1>
          <Link href="/catalog" className="btn-shine rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5">Browse Products</Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mx-auto w-11/12 max-w-6xl py-8 sm:py-12">
        {isTestKey && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Test mode - no real charges. Use card 4242 4242 4242 4242.
          </div>
        )}

        <div className="mb-8 flex items-center gap-3 text-sm font-semibold">
          <StepDot active={step === 'address'} done={step === 'payment'} n={1} label="Details" />
          <span className="h-px w-8 bg-black/10" />
          <StepDot active={step === 'payment'} done={false} n={2} label="Payment" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          {/* Left: form / payment */}
          <div>
            {step === 'address' ? (
              <form onSubmit={proceedToPayment} className="rounded-3xl bg-white p-5 sm:p-7 shadow-soft border border-primary/10">
                <h2 className="font-display text-xl gradient-text">Shipping Details</h2>
                <p className="mt-1 text-sm text-muted">We ship to the address you provide once payment is confirmed.</p>
                {error && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
                    <span>{error}</span>
                  </div>
                )}
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Full Name *"><input className={inputClass} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} required /></Field>
                    <Field label="Email *"><input type="email" className={inputClass} value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} required /></Field>
                  </div>
                  <Field label="Phone"><input type="tel" className={inputClass} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></Field>
                  <Field label="Address Line 1 *">
                    <AddressAutocomplete
                      className={inputClass}
                      value={address.line1}
                      placeholder="Start typing your address…"
                      onChange={(v) => setAddress({ ...address, line1: v })}
                      onSelect={(p) => setAddress({ ...address, line1: p.line1, city: p.city, state: p.state, postalCode: p.postalCode, country: p.country })}
                    />
                  </Field>
                  <Field label="Address Line 2"><input className={inputClass} value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="City *"><input className={inputClass} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required /></Field>
                    <Field label="State / Province *"><input className={inputClass} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} required /></Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Postal Code *"><input className={inputClass} value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} required /></Field>
                    <Field label="Country *"><input className={inputClass} value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} required /></Field>
                  </div>
                  <button
                    type="submit"
                    disabled={!canSubmitAddress || creating}
                    className="btn-shine mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {creating ? (
                      <><svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Preparing payment…</>
                    ) : (
                      <>Continue to Payment<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg></>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-3xl bg-white p-5 sm:p-7 shadow-soft border border-primary/10">
                <button type="button" onClick={() => setStep('address')} className="mb-4 flex items-center gap-1 text-sm font-semibold text-muted transition hover:text-primaryDark">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Edit details
                </button>
                <h2 className="font-display text-xl gradient-text">Payment</h2>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Secure, encrypted payment powered by Stripe
                </div>
                <AcceptedMethods />
                {clientSecret && getStripe() ? (
                  <Elements
                    stripe={getStripe()}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: 'flat',
                        variables: {
                          colorPrimary: '#7c3aed',
                          colorText: '#1f1633',
                          colorTextSecondary: '#6b6480',
                          fontFamily: 'inherit',
                          borderRadius: '14px',
                          spacingUnit: '4px',
                          fontSizeBase: '15px',
                        },
                        rules: {
                          '.Tab': { border: '1px solid #e7e1f5', boxShadow: '0 1px 2px rgba(124,58,237,0.05)' },
                          '.Tab:hover': { borderColor: '#c4b5fd' },
                          '.Tab--selected': { borderColor: '#7c3aed', boxShadow: '0 0 0 1px #7c3aed' },
                          '.Input': { border: '1px solid #e7e1f5', padding: '12px' },
                          '.Input:focus': { borderColor: '#7c3aed', boxShadow: '0 0 0 3px rgba(124,58,237,0.15)' },
                          '.Label': { fontWeight: '600', color: '#6b6480' },
                        },
                      },
                    }}
                  >
                    <PaymentForm total={serverTotal} />
                  </Elements>
                ) : (
                  <p className="mt-4 text-sm text-red-600">Stripe is not configured yet. Add your publishable key and enable payments to test.</p>
                )}
              </div>
            )}
          </div>

          {/* Right: order summary */}
          <aside className="h-fit rounded-3xl bg-white p-5 sm:p-6 shadow-soft border border-primary/10 lg:sticky lg:top-24">
            <h2 className="font-display text-lg font-bold text-primaryDark">Order Summary</h2>
            <ul className="mt-4 space-y-3">
              {items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0"><span className="line-clamp-1 font-medium text-ink">{i.title}</span><span className="text-xs text-muted">Qty {i.quantity}</span></span>
                  <span className="font-semibold text-primaryDark">${(i.price * i.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1.5 border-t border-black/5 pt-4 text-sm">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted"><span>Shipping</span><span>{breakdown ? `$${breakdown.shippingFee.toFixed(2)}` : 'Calculated next'}</span></div>
              <div className="flex justify-between text-muted"><span>Tax</span><span>{breakdown ? `$${breakdown.tax.toFixed(2)}` : 'Calculated next'}</span></div>
              <div className="flex justify-between pt-1 text-base font-bold text-primaryDark"><span>Total</span><span>${(serverTotal ?? subtotal).toFixed(2)}</span></div>
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  )
}

function PaymentForm({ total }: { total: number | null }) {
  const stripe = useStripe()
  const elements = useElements()
  const { clear } = useCart()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const pay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    setError('')
    const { error: submitErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/order-confirmation` },
      redirect: 'if_required',
    })
    if (submitErr) {
      setError(submitErr.message || 'Payment failed. Please try another method.')
      setProcessing(false)
      return
    }
    // Inline (no redirect) result - only treat 'succeeded' as done.
    if (paymentIntent?.status === 'succeeded') {
      // Backstop: record the order now in case the webhook is delayed/misconfigured.
      // Idempotent server-side, so it's safe even if the webhook already ran.
      try {
        const finalize = httpsCallable(functions, 'finalizeStripeOrder')
        await finalize({ paymentIntentId: paymentIntent.id })
      } catch {
        /* webhook will still record it; don't block the user on this */
      }
      clear()
      window.location.href = '/order-confirmation?redirect_status=succeeded'
      return
    }
    if (paymentIntent?.status === 'processing') {
      clear()
      window.location.href = '/order-confirmation?redirect_status=processing'
      return
    }
    // Any other status: surface it rather than claiming success.
    setError('Payment could not be completed. Please try again.')
    setProcessing(false)
  }

  return (
    <form onSubmit={pay} className="mt-4">
      <PaymentElement options={{ layout: { type: 'tabs', defaultCollapsed: false } }} />
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
          <span>{error}</span>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="btn-shine mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {processing ? (
          <><svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Processing…</>
        ) : (
          <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Pay {total !== null ? `$${total.toFixed(2)}` : ''} securely</>
        )}
      </button>
      <p className="mt-3 text-center text-xs text-muted">Your card details are encrypted and never stored on our servers.</p>
    </form>
  )
}

/** A payment brand logo rendered inside a uniform white card chip. */
function BrandChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="flex h-9 w-14 items-center justify-center rounded-lg border border-black/10 bg-white shadow-sm"
    >
      {children}
    </span>
  )
}

/**
 * A friendly strip that shows the payment methods we accept, with real brand
 * marks. Informational only — which options actually appear in the Stripe
 * Payment Element is controlled by what is enabled in the Stripe Dashboard.
 */
function AcceptedMethods() {
  return (
    <div className="mt-4 rounded-2xl border border-primary/10 bg-gradient-to-br from-purple-50/60 to-pink-50/50 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primaryDark">
        <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path strokeLinecap="round" d="M3 10h18M7 15h4" /></svg>
        Cards &amp; wallets we accept
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {/* Visa */}
        <BrandChip label="Visa">
          <svg viewBox="0 0 48 16" className="h-3.5"><text x="0" y="13" fontFamily="Arial, sans-serif" fontSize="15" fontStyle="italic" fontWeight="700" fill="#1A1F71">VISA</text></svg>
        </BrandChip>
        {/* Mastercard */}
        <BrandChip label="Mastercard">
          <svg viewBox="0 0 40 24" className="h-5"><circle cx="15" cy="12" r="9" fill="#EB001B" /><circle cx="25" cy="12" r="9" fill="#F79E1B" /><path d="M20 5a9 9 0 000 14 9 9 0 000-14z" fill="#FF5F00" /></svg>
        </BrandChip>
        {/* American Express */}
        <BrandChip label="American Express">
          <svg viewBox="0 0 48 20" className="h-5"><rect width="48" height="20" rx="2" fill="#2E77BC" /><text x="24" y="9" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="6.5" fontWeight="700" fill="#fff">AMERICAN</text><text x="24" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="6.5" fontWeight="700" fill="#fff">EXPRESS</text></svg>
        </BrandChip>
        {/* Discover */}
        <BrandChip label="Discover">
          <svg viewBox="0 0 60 16" className="h-3"><text x="0" y="13" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#231F20">Disc</text><text x="26" y="13" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#231F20">ver</text><circle cx="24.5" cy="9" r="4.2" fill="#F58220" /></svg>
        </BrandChip>
        {/* Apple Pay */}
        <BrandChip label="Apple Pay">
          <svg viewBox="0 0 40 18" className="h-4" fill="#000"><path d="M7.6 4.2c.4-.5.7-1.2.6-1.9-.6 0-1.3.4-1.7.9-.4.4-.7 1.1-.6 1.8.7.1 1.3-.3 1.7-.8zM8.2 5.2c-.9-.05-1.7.5-2.1.5-.4 0-1.1-.5-1.8-.5-.9 0-1.8.5-2.2 1.4-1 1.7-.3 4.2.7 5.6.5.7 1 1.4 1.8 1.4.7 0 1-.5 1.9-.5.9 0 1.1.5 1.8.4.8 0 1.2-.7 1.7-1.3.5-.8.7-1.5.8-1.6 0 0-1.5-.6-1.5-2.3 0-1.4 1.2-2.1 1.2-2.1-.6-1-1.7-1-2.1-1z" /><text x="14" y="13" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="600" fill="#000">Pay</text></svg>
        </BrandChip>
        {/* Google Pay */}
        <BrandChip label="Google Pay">
          <svg viewBox="0 0 48 18" className="h-4"><text x="0" y="13" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="500"><tspan fill="#4285F4">G</tspan><tspan fill="#EA4335">o</tspan><tspan fill="#FBBC05">o</tspan><tspan fill="#4285F4">g</tspan><tspan fill="#34A853">l</tspan><tspan fill="#EA4335">e</tspan></text><text x="34" y="13" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="500" fill="#5F6368">Pay</text></svg>
        </BrandChip>
        {/* Cash App Pay */}
        <BrandChip label="Cash App Pay">
          <svg viewBox="0 0 24 24" className="h-5"><rect width="24" height="24" rx="5" fill="#00D632" /><path d="M15.5 9.3c.2.2.5.2.7 0l.7-.7c.2-.2.2-.5 0-.7-.6-.6-1.4-1-2.3-1.2l.1-.6c.05-.3-.2-.5-.5-.5h-1c-.25 0-.45.18-.5.42l-.1.5c-1.6.1-2.9 1-2.9 2.6 0 1.5 1.2 2.1 2.5 2.5 1.1.35 1.6.6 1.6 1.1 0 .5-.5.85-1.3.85-.75 0-1.5-.28-2-.75-.2-.18-.5-.18-.7.02l-.75.72c-.2.2-.2.5 0 .7.6.55 1.35.95 2.2 1.1l-.1.55c-.05.3.18.55.48.55h1c.25 0 .46-.18.5-.42l.1-.5c1.75-.12 3-1.1 3-2.7 0-1.5-1.25-2.15-2.6-2.55-1-.32-1.55-.55-1.55-1.05 0-.48.5-.8 1.2-.8.7 0 1.3.25 1.75.65z" fill="#fff" /></svg>
        </BrandChip>
        {/* Link */}
        <BrandChip label="Link by Stripe">
          <svg viewBox="0 0 44 20" className="h-4"><rect width="44" height="20" rx="4" fill="#00D66F" /><text x="22" y="14" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" fill="#011E0F">link</text></svg>
        </BrandChip>
      </div>
      <p className="mt-2.5 text-xs text-muted">Credit &amp; debit cards and wallets accepted. Choose your preferred method below — all payments are processed securely.</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink">
      {label}
      {children}
    </label>
  )
}

function StepDot({ active, done, n, label }: { active: boolean; done: boolean; n: number; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${active || done ? 'bg-gradient-to-r from-primary to-secondary text-white' : 'bg-primary/10 text-primaryDark'}`}>
        {done ? <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> : n}
      </span>
      <span className={active ? 'text-primaryDark' : 'text-muted'}>{label}</span>
    </span>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-white to-pink-50/50 text-ink">
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)]">
        <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-xl" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="font-display text-base sm:text-lg font-bold">Eduvate Kids</span>
          </Link>
          <Link href="/catalog" className="text-sm font-semibold text-muted transition hover:text-primaryDark">Continue shopping</Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
