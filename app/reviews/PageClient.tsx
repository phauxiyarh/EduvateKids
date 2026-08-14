'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import {
  averageRating,
  normalizeReview,
  publicReviews,
  ratingBreakdown,
  reviewDateLabel,
  sortReviews,
  type Review
} from '../../lib/reviews'
import { Stars } from '../components/StarRating'
import { SiteHeader } from '../components/SiteChrome'
import { SiteFooterFull } from '../components/SiteFooterFull'

/** Star filter buttons plus the distribution bars. */
function RatingSummary({
  reviews,
  filter,
  onFilter
}: {
  reviews: Review[]
  filter: number
  onFilter: (value: number) => void
}) {
  const average = averageRating(reviews)
  const breakdown = ratingBreakdown(reviews)

  return (
    <div className="grid gap-8 rounded-[2rem] border border-primary/10 bg-white p-7 shadow-soft sm:grid-cols-[auto,1fr] sm:p-9">
      <div className="text-center sm:border-r sm:border-black/5 sm:pr-9">
        <div className="font-display text-5xl font-bold text-primaryDark">
          {average ? average.toFixed(1) : '-'}
        </div>
        <Stars value={average} size="h-5 w-5" className="mt-2" />
        <p className="mt-2 text-xs font-semibold text-muted">
          {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
        </p>
      </div>

      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = breakdown[star - 1]
          const pct = reviews.length ? (count / reviews.length) * 100 : 0
          const active = filter === star
          return (
            <button
              key={star}
              type="button"
              onClick={() => onFilter(active ? 0 : star)}
              aria-pressed={active}
              disabled={!count}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors disabled:cursor-default disabled:opacity-60 ${
                active ? 'bg-primary/10' : 'hover:bg-primary/5'
              }`}
            >
              <span className="w-12 shrink-0 text-xs font-bold text-primaryDark">{star} star</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-400"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-xs font-semibold text-muted">{count}</span>
            </button>
          )
        })}
        {filter > 0 && (
          <button
            type="button"
            onClick={() => onFilter(0)}
            className="mt-1 text-xs font-bold text-primaryDark underline hover:no-underline"
          >
            Show all ratings
          </button>
        )}
      </div>
    </div>
  )
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-primary/10 bg-white p-6 shadow-soft transition-shadow hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <Stars value={review.rating} />
        {review.featured && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primaryDark">
            Featured
          </span>
        )}
      </div>

      {/* whitespace-pre-line keeps the reviewer's paragraph breaks. */}
      <p className="mt-4 flex-1 whitespace-pre-line text-sm leading-relaxed text-muted">
        {review.quote}
      </p>

      <div className="mt-5 flex items-center gap-3 border-t border-black/5 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 font-bold text-primaryDark">
          {review.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-primaryDark">{review.name}</span>
          <span className="block truncate text-[11px] text-muted">
            {[review.role, reviewDateLabel(review.createdAt)].filter(Boolean).join(' · ')}
          </span>
        </span>
      </div>
    </article>
  )
}

export default function ReviewsClient({ reviews }: { reviews: Review[] }) {
  // Seeded from the build so the list is in the static HTML for crawlers, then
  // replaced by the live set so a newly approved review shows without a deploy.
  const [live, setLive] = useState<Review[] | null>(null)
  const [filter, setFilter] = useState(0)

  useEffect(() => {
    // Rules require the query be constrained to approved reviews; an
    // unconstrained listen is rejected outright.
    const unsub = onSnapshot(
      query(collection(db, 'reviews'), where('approved', '==', true)),
      (snap) => {
        setLive(
          publicReviews(
            snap.docs.map((d) => normalizeReview(d.data() as Record<string, unknown>, d.id))
          )
        )
      },
      // Leave the build-time list showing rather than emptying the page.
      () => {}
    )
    return () => unsub()
  }, [])

  const all = live ?? reviews
  const shown = useMemo(
    () => (filter ? all.filter((r) => r.rating === filter).sort(sortReviews) : all),
    [all, filter]
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-white to-white text-ink">
      <SiteHeader current="/reviews" />

      <section className="relative overflow-hidden border-b border-primary/10">
        <div className="pointer-events-none absolute inset-0 opacity-[0.5]">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -right-16 top-10 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
        </div>

        <div className="relative mx-auto w-11/12 max-w-4xl py-14 text-center sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-accentThree">Community Love</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight gradient-text sm:text-5xl">
            Customer reviews
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Honest words from the parents, teachers and young readers we serve. We love feedback
            because it helps us know what works and what can be improved.
          </p>
          <Link
            href="/reviews/new"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-7 py-3.5 text-sm font-bold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Write a review
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      <main className="mx-auto w-11/12 max-w-6xl py-10 sm:py-14">
        {all.length > 0 && (
          <RatingSummary reviews={all} filter={filter} onFilter={setFilter} />
        )}

        {shown.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-[2rem] border-2 border-dashed border-primary/20 bg-white/60 p-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primaryDark">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8m-8 4h5m-5-8h8M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <p className="mt-4 text-sm text-muted">
              {all.length
                ? 'No reviews with that rating yet.'
                : 'No reviews yet. Be the first to share your experience, in-sha-Allah.'}
            </p>
            {!all.length && (
              <Link
                href="/reviews/new"
                className="mt-5 inline-flex rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5"
              >
                Write the first review
              </Link>
            )}
          </div>
        )}

        <div className="mt-16 overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-secondary p-8 text-center text-white shadow-xl sm:p-12">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Shared a book you loved?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/85 sm:text-base">
            Your review helps another family find the right book for their child.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/reviews/new"
              className="rounded-full bg-white px-6 py-3 text-sm font-bold text-primaryDark shadow-lg transition hover:-translate-y-0.5"
            >
              Write a review
            </Link>
            <Link
              href="/shelves"
              className="rounded-full border-2 border-white/60 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              Browse the shelves
            </Link>
          </div>
        </div>
      </main>

      <SiteFooterFull />
    </div>
  )
}
