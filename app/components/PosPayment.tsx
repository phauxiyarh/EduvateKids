'use client'

import { useEffect, useRef, useState } from 'react'
import {
  POS_PAYMENT_OPTIONS,
  paymentOption,
  type PosPaymentMethod
} from '../../lib/posPayment'

const money = (n: number) =>
  `$${(Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Brand colour for each app transfer, used on its QR card. */
const BRAND: Partial<Record<PosPaymentMethod, { accent: string; soft: string; ring: string }>> = {
  Zelle: { accent: '#6d1ed4', soft: '#f4ecff', ring: 'rgba(109,30,212,0.25)' },
  'Cash App': { accent: '#00b62a', soft: '#e9fbee', ring: 'rgba(0,182,42,0.25)' }
}

function MethodIcon({ method }: { method: PosPaymentMethod }) {
  if (method === 'Cash') {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    )
  }
  if (method === 'Square') {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path strokeLinecap="round" d="M2 10h20M6 15h4" />
      </svg>
    )
  }
  // Zelle and Cash App: a QR code mark
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path strokeLinecap="round" d="M14 14h3v3M21 14v.01M14 21h3M21 18v3h-1" />
    </svg>
  )
}

type PickerProps = {
  value: PosPaymentMethod
  onChange: (method: PosPaymentMethod) => void
}

/** The four ways a POS customer can pay. */
export function PaymentMethodPicker({ value, onChange }: PickerProps) {
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2">
      {POS_PAYMENT_OPTIONS.map((option) => {
        const selected = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={`flex min-h-[56px] items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              selected
                ? 'border-transparent bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                : 'border-primary/20 bg-white text-gray-700 hover:border-primary/40'
            }`}
          >
            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-white/20' : 'bg-primary/5 text-primaryDark'}`}>
              <MethodIcon method={option.id} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-tight">{option.label}</span>
              <span className={`block text-[11px] leading-tight ${selected ? 'text-white/85' : 'text-muted'}`}>{option.hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

type QrProps = {
  method: PosPaymentMethod
  amount: number
}

/**
 * The QR code for a Zelle or Cash App payment, with a full-screen view the
 * cashier can turn toward the customer. Renders nothing for Cash or Card.
 */
export function PaymentQrPanel({ method, amount }: QrProps) {
  const option = paymentOption(method)
  const [fullScreen, setFullScreen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!fullScreen) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullScreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullScreen])

  // Switching to Cash or Card closes the customer view.
  useEffect(() => {
    if (!option.qr) setFullScreen(false)
  }, [option.qr])

  if (!option.qr) return null
  const brand = BRAND[method] ?? { accent: '#7c3aed', soft: '#f5f3ff', ring: 'rgba(124,58,237,0.25)' }

  return (
    <>
      <div
        className="mt-3 rounded-2xl border-2 p-4 text-center"
        style={{ borderColor: brand.ring, background: brand.soft }}
        data-testid="payment-qr-panel"
      >
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: brand.accent }}>
          Scan to pay with {option.label}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={option.qr}
          alt={`${option.label} payment QR code`}
          width={220}
          height={220}
          className="mx-auto mt-3 h-[200px] w-[200px] rounded-xl bg-white p-2 shadow-sm sm:h-[220px] sm:w-[220px]"
        />
        <p className="mt-3 text-sm text-gray-700">
          Amount due <span className="font-display text-lg font-bold" style={{ color: brand.accent }}>{money(amount)}</span>
        </p>
        <button
          type="button"
          onClick={() => setFullScreen(true)}
          className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-white shadow-md outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ background: brand.accent }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
          </svg>
          Show customer
        </button>
        <p className="mt-2 text-[11px] text-muted">
          Check the payment has arrived in {option.label} before you complete the sale.
        </p>
      </div>

      {fullScreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${option.label} payment QR code`}
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-white px-6 py-8 text-center"
          onClick={() => setFullScreen(false)}
        >
          <p className="font-display text-3xl font-bold sm:text-4xl" style={{ color: brand.accent }}>
            Scan to pay with {option.label}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={option.qr}
            alt={`${option.label} payment QR code`}
            className="mt-6 aspect-square w-[min(82vw,62vh)] rounded-3xl bg-white p-3 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
            style={{ boxShadow: `0 0 0 6px ${brand.ring}, 0 20px 60px rgba(0,0,0,0.12)` }}
          />
          <p className="mt-6 text-xl text-gray-700 sm:text-2xl">
            Amount <span className="font-display text-3xl font-bold sm:text-4xl" style={{ color: brand.accent }}>{money(amount)}</span>
          </p>
          <p className="mt-2 text-sm text-muted">Eduvate Kids · Tap anywhere to close</p>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setFullScreen(false)}
            className="mt-6 min-h-[48px] rounded-full border-2 border-gray-200 bg-white px-8 text-sm font-bold text-gray-700 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Done
          </button>
        </div>
      )}
    </>
  )
}
