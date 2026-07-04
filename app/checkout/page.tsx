'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../lib/firebase'
import { useCart } from '../../lib/cart'
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
  const [breakdown, setBreakdown] = useState<{ shippingFee: number; tax: number } | null>(null)
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
      const call = httpsCallable(functions, 'createStripePaymentIntent')
      const res = await call({
        items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
        customer,
        shippingAddress: address,
        demo: isTestKey,
      })
      const data = res.data as { clientSecret: string; subtotal: number; shippingFee: number; tax: number; total: number; currency: string }
      setClientSecret(data.clientSecret)
      setServerTotal(data.total)
      setBreakdown({ shippingFee: data.shippingFee, tax: data.tax })
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
            Test mode — no real charges. Use card 4242 4242 4242 4242.
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
                  <Field label="Address Line 1 *"><input className={inputClass} value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} required /></Field>
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
                {clientSecret && getStripe() ? (
                  <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#7c3aed', borderRadius: '12px' } } }}>
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
    const { error: submitErr } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/order-confirmation` },
      redirect: 'if_required',
    })
    if (submitErr) {
      setError(submitErr.message || 'Payment failed. Please try another method.')
      setProcessing(false)
      return
    }
    // No redirect needed (e.g. cards) — clear cart and go to confirmation.
    clear()
    window.location.href = '/order-confirmation'
  }

  return (
    <form onSubmit={pay} className="mt-5">
      <PaymentElement />
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
          <>Pay {total !== null ? `$${total.toFixed(2)}` : ''}</>
        )}
      </button>
    </form>
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
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)] backdrop-blur-xl">
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
