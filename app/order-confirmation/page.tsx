'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../lib/firebase'
import { useCart } from '../../lib/cart'
import logo from '../../assets/logo.png'

/**
 * Order confirmation / success page.
 * Reached after Stripe confirms payment (redirect or client-side). The order
 * itself is written by the Stripe webhook (source of truth), so this page is a
 * friendly confirmation - it reads the redirect status if present.
 */
export default function OrderConfirmationPage() {
  const [status, setStatus] = useState<'success' | 'processing' | 'failed'>('success')
  const { clear } = useCart()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const redirect = params.get('redirect_status')
    if (redirect === 'failed') setStatus('failed')
    else if (redirect === 'processing') setStatus('processing')
    else setStatus('success')

    // Clear the cart on any non-failed arrival (covers the 3DS redirect path,
    // where confirmPayment redirected before the checkout page could clear it).
    if (redirect !== 'failed') clear()

    // Backstop: if Stripe redirected here (3DS/bank), it appends payment_intent.
    // Record the order now - idempotent server-side (no-op if webhook already ran).
    const pi = params.get('payment_intent')
    if (pi && redirect !== 'failed') {
      httpsCallable(functions, 'finalizeStripeOrder')({ paymentIntentId: pi }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Confetti pieces for the success celebration (deterministic, no random at render).
  const confetti = Array.from({ length: 28 }, (_, i) => {
    const colors = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6']
    const left = (i * 37) % 100
    const delay = (i % 7) * 0.12
    const duration = 2.4 + ((i % 5) * 0.35)
    const rotate = (i * 47) % 360
    const size = 7 + (i % 4) * 2
    return { color: colors[i % colors.length], left, delay, duration, rotate, size, round: i % 3 === 0 }
  })

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-purple-50/50 via-white to-pink-50/50 text-ink">
      <style jsx global>{`
        @keyframes ek-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ek-ring {
          0% { transform: scale(0.6); opacity: 0.65; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes ek-check {
          from { stroke-dashoffset: 32; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes ek-rise {
          from { transform: translateY(14px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes ek-confetti {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
        .ek-pop { animation: ek-pop 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ek-ring { animation: ek-ring 1.1s ease-out 0.2s both; }
        .ek-ring-2 { animation: ek-ring 1.1s ease-out 0.45s both; }
        .ek-check { stroke-dasharray: 32; animation: ek-check 0.5s ease-out 0.45s both; }
        .ek-rise { animation: ek-rise 0.6s ease-out both; }
        .ek-rise-1 { animation-delay: 0.35s; }
        .ek-rise-2 { animation-delay: 0.5s; }
        .ek-confetti-piece { position: absolute; top: -6vh; will-change: transform, opacity; animation-name: ek-confetti; animation-timing-function: linear; animation-iteration-count: 1; }
        @media (prefers-reduced-motion: reduce) {
          .ek-pop, .ek-ring, .ek-ring-2, .ek-check, .ek-rise, .ek-confetti-piece { animation: none !important; }
          .ek-check { stroke-dashoffset: 0 !important; }
          .ek-rise { opacity: 1 !important; transform: none !important; }
          .ek-confetti-piece { display: none !important; }
        }
      `}</style>

      {status === 'success' && (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="ek-confetti-piece"
              style={{
                left: `${c.left}%`,
                width: `${c.size}px`,
                height: `${c.size}px`,
                background: c.color,
                borderRadius: c.round ? '9999px' : '2px',
                transform: `rotate(${c.rotate}deg)`,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
              }}
            />
          ))}
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)]">
        <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-xl" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="font-display text-base sm:text-lg font-bold">Eduvate Kids</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[70vh] w-11/12 max-w-2xl flex-col items-center justify-center py-12 text-center">
        {status === 'success' && (
          <div>
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
              {/* pulsing rings */}
              <span className="ek-ring absolute inset-0 rounded-full bg-emerald-400/30" />
              <span className="ek-ring-2 absolute inset-0 rounded-full bg-emerald-400/20" />
              {/* badge with drawn check */}
              <span className="ek-pop relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-[0_12px_30px_rgba(16,185,129,0.45)]">
                <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24">
                  <path className="ek-check" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </div>
            <h1 className="ek-rise ek-rise-1 mt-6 font-display text-3xl gradient-text">Thank you for your order!</h1>
            <p className="ek-rise ek-rise-2 mt-3 text-muted">
              Your payment was received. We&apos;ll prepare your books and ship them to the address you provided.
              A confirmation email is on its way.
            </p>
          </div>
        )}
        {status === 'processing' && (
          <div className="animate-fadeIn">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
              <svg className="h-9 w-9 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            </div>
            <h1 className="mt-6 font-display text-3xl">Payment processing…</h1>
            <p className="mt-3 text-muted">Your payment is being confirmed. You&apos;ll receive an email once it completes.</p>
          </div>
        )}
        {status === 'failed' && (
          <div className="animate-fadeIn">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-rose-500 text-white shadow-lg">
              <svg className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <h1 className="mt-6 font-display text-3xl">Payment didn&apos;t go through</h1>
            <p className="mt-3 text-muted">No charge was made. You can try again with a different payment method.</p>
          </div>
        )}

        <div className={`mt-8 flex flex-wrap justify-center gap-3 ${status === 'success' ? 'ek-rise' : ''}`} style={status === 'success' ? { animationDelay: '0.65s' } : undefined}>
          <Link href="/catalog" className="btn-shine rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5">
            {status === 'failed' ? 'Back to Products' : 'Continue Shopping'}
          </Link>
          <Link href="/" className="rounded-full border border-primary/25 bg-white px-6 py-3 text-sm font-semibold text-primaryDark transition hover:-translate-y-0.5 hover:border-primary/40">
            Return Home
          </Link>
        </div>
      </main>
    </div>
  )
}
