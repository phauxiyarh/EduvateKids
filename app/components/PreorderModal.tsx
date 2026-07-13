'use client'

/**
 * PreorderModal — shown when a shopper tries to add an out-of-stock book to the
 * cart. Explains the book is out of stock and lets them reserve copies via a
 * pre-order request (name, email, phone, quantity). On submit it calls the
 * `submitBookRequest` Cloud Function, which records the request for the admin
 * and emails a notification. Purely a reservation of intent — no payment.
 */

import { useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../lib/firebase'

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type PreorderBook = { id: string; title: string; image?: string }

export function PreorderModal({
  book,
  onClose,
}: {
  book: PreorderBook
  onClose: () => void
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', quantity: 1 })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const canSubmit = form.name.trim() && EMAIL_RE.test(form.email.trim()) && form.quantity >= 1

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!canSubmit) {
      setError('Please enter your name, a valid email, and how many copies you would like.')
      return
    }
    setSubmitting(true)
    try {
      const call = httpsCallable(functions, 'submitBookRequest')
      await call({
        bookId: book.id,
        bookTitle: book.title,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        quantity: Math.max(1, Math.floor(form.quantity)),
      })
      setDone(true)
    } catch (err) {
      setError((err as { message?: string })?.message || 'Could not submit your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Reserve ${book.title}`}
    >
      <div className="sr-preorder-backdrop absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="sr-preorder-card relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_rgba(0,0,0,0.3)]">
        {/* header band */}
        <div className="relative bg-gradient-to-br from-primary to-secondary px-6 py-5 text-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Out of stock</p>
              <h2 className="font-display text-lg font-bold leading-tight">Sorry, we&apos;re currently out of stock</h2>
            </div>
          </div>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="mt-4 font-display text-xl gradient-text">Reservation received!</h3>
            <p className="mt-2 text-sm text-muted">
              We&apos;ve reserved <span className="font-semibold text-primaryDark">{form.quantity}</span> {form.quantity === 1 ? 'copy' : 'copies'} of
              {' '}<span className="font-semibold text-primaryDark">{book.title}</span>. We&apos;ll email you at <span className="font-semibold text-primaryDark">{form.email.trim()}</span> as soon as it&apos;s back in stock.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="btn-shine mt-6 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 py-6">
            <p className="text-sm text-muted">
              <span className="font-semibold text-primaryDark">{book.title}</span> is out of stock right now. Reserve your copies with a free
              pre-order and we&apos;ll let you know the moment it&apos;s available.
            </p>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 animate-slideDown">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
                <span>{error}</span>
              </div>
            )}

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-sm font-semibold">Your Name *
                <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">Email *
                <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">Phone
                <input type="tel" className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <div className="grid gap-1.5 text-sm font-semibold">How many copies? *
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                    aria-label="Decrease quantity"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 text-primaryDark transition hover:bg-primary/5"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                    className="w-16 rounded-xl border border-black/10 bg-white px-2 py-2.5 text-center text-base font-bold text-primaryDark outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
                    aria-label="Quantity"
                  />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, quantity: f.quantity + 1 }))}
                    aria-label="Increase quantity"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 text-primaryDark transition hover:bg-primary/5"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="btn-shine mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {submitting ? (
                <><svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Reserving…</>
              ) : 'Reserve my copies'}
            </button>
            <p className="mt-2 text-center text-xs text-muted">Free to reserve — no payment now.</p>
          </form>
        )}
      </div>

      <style jsx>{`
        .sr-preorder-backdrop { animation: sr-po-fade 200ms ease-out both; }
        .sr-preorder-card { animation: sr-po-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @keyframes sr-po-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sr-po-pop { 0% { opacity: 0; transform: scale(0.9) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .sr-preorder-backdrop, .sr-preorder-card { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
