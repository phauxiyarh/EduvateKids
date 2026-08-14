'use client'

import Link from 'next/link'
import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../../lib/firebase'
import { MAX_QUOTE, MAX_ROLE, MAX_NAME, validateReview } from '../../../lib/reviews'
import { StarPicker } from '../../components/StarRating'
import { SiteHeader } from '../../components/SiteChrome'
import { SiteFooterFull } from '../../components/SiteFooterFull'

const FIELD =
  'w-full rounded-xl border-2 border-primary/15 bg-white px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-primary/40'

/** Shown once the review is in. Deliberately clear that it is not live yet. */
function ThankYou() {
  return (
    <div className="rounded-[2rem] border border-primary/10 bg-white p-9 text-center shadow-soft sm:p-12">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-green-600">
        <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <h2 className="mt-5 font-display text-2xl font-bold text-primaryDark">
        Jazakum Allahu khayran
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        Your review has been sent. We read every one before it goes on the site, so it will appear on
        our reviews page shortly.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          href="/reviews"
          className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5"
        >
          Read other reviews
        </Link>
        <Link
          href="/shelves"
          className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark transition hover:-translate-y-0.5 hover:bg-primary/5"
        >
          Browse the shelves
        </Link>
      </div>
    </div>
  )
}

export default function NewReviewClient() {
  const [rating, setRating] = useState(0)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [quote, setQuote] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    // Same rules the Cloud Function applies, so an obvious mistake is caught
    // without a round trip.
    const message = validateReview({ name, quote, rating, email })
    if (message) {
      setError(message)
      return
    }

    setBusy(true)
    setError('')
    try {
      const callable = httpsCallable<
        { name: string; role: string; rating: number; quote: string; email: string },
        { id: string; status: string }
      >(functions, 'createReview')
      await callable({
        name: name.trim(),
        role: role.trim(),
        rating,
        quote: quote.trim(),
        email: email.trim()
      })
      setDone(true)
    } catch (err) {
      console.error('Submit review failed:', err)
      // Surface the function's own message when it sent one: it explains what
      // to fix far better than a generic failure line.
      const detail = (err as { message?: string })?.message ?? ''
      setError(
        detail && !/internal/i.test(detail)
          ? detail
          : 'Could not send your review just now. Please try again in a moment.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-white to-white text-ink">
      <SiteHeader current="/reviews" />

      <main className="mx-auto w-11/12 max-w-2xl py-10 sm:py-14">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <ol className="flex flex-wrap items-center gap-1.5 text-muted">
            <li><Link href="/" className="hover:text-primary">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/reviews" className="hover:text-primary">Reviews</Link></li>
            <li aria-hidden="true">/</li>
            <li className="font-semibold text-primaryDark" aria-current="page">Write a review</li>
          </ol>
        </nav>

        {done ? (
          <ThankYou />
        ) : (
          <>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-accentThree">
                Your experience
              </p>
              <h1 className="mt-4 font-display text-3xl font-bold leading-tight gradient-text sm:text-4xl">
                Write a review
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted">
                We love feedback because it helps us know what works and what can be improved. We
                only need your name, a rating, and what you thought.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-9 space-y-6 rounded-[2rem] border border-primary/10 bg-white p-6 shadow-soft sm:p-9"
            >
              <div>
                <span className="mb-2 block text-sm font-bold text-primaryDark">
                  How would you rate us? <span className="text-secondary">*</span>
                </span>
                <StarPicker value={rating} onChange={setRating} disabled={busy} />
              </div>

              <div>
                <label htmlFor="review-name" className="mb-2 block text-sm font-bold text-primaryDark">
                  Your name <span className="text-secondary">*</span>
                </label>
                <input
                  id="review-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_NAME}
                  required
                  disabled={busy}
                  autoComplete="name"
                  placeholder="Amina M."
                  className={FIELD}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Shown with your review. An initial for your surname is fine.
                </p>
              </div>

              <div>
                <label htmlFor="review-role" className="mb-2 block text-sm font-bold text-primaryDark">
                  You are a... <span className="font-medium text-muted">(optional)</span>
                </label>
                <input
                  id="review-role"
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  maxLength={MAX_ROLE}
                  disabled={busy}
                  placeholder="Parent of a 6-year-old"
                  className={FIELD}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Parent, teacher, librarian, young reader - whatever fits.
                </p>
              </div>

              <div>
                <label htmlFor="review-quote" className="mb-2 block text-sm font-bold text-primaryDark">
                  Your review <span className="text-secondary">*</span>
                </label>
                <textarea
                  id="review-quote"
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  maxLength={MAX_QUOTE}
                  required
                  disabled={busy}
                  rows={6}
                  placeholder="What did you and your child enjoy? What would you tell another parent?"
                  className={`${FIELD} resize-y`}
                />
                <p className="mt-1.5 text-right text-xs text-muted">
                  {quote.length}/{MAX_QUOTE}
                </p>
              </div>

              <div>
                <label htmlFor="review-email" className="mb-2 block text-sm font-bold text-primaryDark">
                  Email <span className="font-medium text-muted">(optional)</span>
                </label>
                <input
                  id="review-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={200}
                  disabled={busy}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={FIELD}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Never published. Only so we can reach you if something went wrong.
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-bold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {busy ? 'Sending...' : 'Submit review'}
              </button>

              <p className="text-center text-xs text-muted">
                We read every review before publishing it, so yours will appear on the{' '}
                <Link href="/reviews" className="font-semibold text-primaryDark underline hover:no-underline">
                  reviews page
                </Link>{' '}
                shortly.
              </p>
            </form>
          </>
        )}
      </main>

      <SiteFooterFull />
    </div>
  )
}
