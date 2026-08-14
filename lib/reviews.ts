/**
 * Customer reviews.
 *
 * A visitor leaves a star rating and a short note from /reviews/new. The
 * submission lands in the `reviews` collection with `approved: false` and is
 * invisible on the site until an admin approves it in Website > Reviews. That
 * ordering is deliberate: the reviews feed the home page testimonials carousel,
 * so anything auto-published would put unvetted text on the front page.
 *
 * We ask for as little as possible — a name, a rating and the review itself.
 * Role ("Parent of a 6-year-old") is optional and is what gives the testimonial
 * its context. Email is optional, and it is deliberately NOT part of this type:
 * an approved review doc is world-readable, so the address is stored in the
 * admin-only reviews/{id}/private/contact doc instead. See functions/src/reviews.ts.
 *
 * Public visitors write through the submitReview callable, not directly: rules
 * keep `approved` unwritable by clients, so nobody can self-approve.
 */

export type Review = {
  id: string
  /** Display name. "Amina M." style is encouraged but not enforced. */
  name: string
  /** Optional context line shown under the name, e.g. "Homeschooling parent". */
  role: string
  /** 1-5 whole stars. */
  rating: number
  /** The review body. */
  quote: string
  /** Only approved reviews render publicly. */
  approved: boolean
  /** Pin a review to the front of the carousel. */
  featured: boolean
  /** Where it came from, so the admin can tell their own entries apart. */
  source: 'customer' | 'admin'
  createdAt: string
  updatedAt: string
}

export const MAX_QUOTE = 1200
export const MAX_NAME = 80
export const MAX_ROLE = 80

/** Clamp to a whole 1-5 star rating; anything unparseable becomes 5. */
export const clampRating = (value: unknown): number => {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return 5
  return Math.min(5, Math.max(1, n))
}

/** Normalise a Firestore doc, tolerating partially written records. */
export function normalizeReview(data: Record<string, unknown>, id: string): Review {
  const source = String(data.source ?? '') === 'admin' ? 'admin' : 'customer'
  return {
    id,
    name: String(data.name ?? '').trim().slice(0, MAX_NAME),
    role: String(data.role ?? '').trim().slice(0, MAX_ROLE),
    rating: clampRating(data.rating),
    quote: String(data.quote ?? '').trim().slice(0, MAX_QUOTE),
    // Unlike blog posts, absence means NOT approved. A doc written before this
    // field existed should stay hidden rather than appear on the front page.
    approved: data.approved === true,
    featured: data.featured === true,
    source,
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? '')
  }
}

/** Featured first, then newest. */
export const sortReviews = (a: Review, b: Review) =>
  Number(b.featured) - Number(a.featured) ||
  (b.createdAt || '').localeCompare(a.createdAt || '')

/** Only these belong on a public page. */
export const publicReviews = (list: Review[]): Review[] =>
  list.filter((r) => r.approved && r.quote && r.name).sort(sortReviews)

/** Mean rating to one decimal place. 0 when there is nothing to average. */
export function averageRating(list: Review[]): number {
  if (!list.length) return 0
  const total = list.reduce((sum, r) => sum + clampRating(r.rating), 0)
  return Math.round((total / list.length) * 10) / 10
}

/** How many reviews sit at each star level, index 0 = 1 star. */
export function ratingBreakdown(list: Review[]): number[] {
  const buckets = [0, 0, 0, 0, 0]
  for (const r of list) buckets[clampRating(r.rating) - 1] += 1
  return buckets
}

/**
 * Validate a submission the same way the Cloud Function does, so the form can
 * refuse it before a round trip. Returns an error message, or '' when valid.
 */
export function validateReview(input: {
  name?: string
  quote?: string
  rating?: unknown
  email?: string
}): string {
  const name = String(input.name ?? '').trim()
  const quote = String(input.quote ?? '').trim()
  if (name.length < 2) return 'Please tell us your name.'
  if (name.length > MAX_NAME) return `Please keep your name under ${MAX_NAME} characters.`
  if (quote.length < 10) return 'Please write a little more about your experience.'
  if (quote.length > MAX_QUOTE) return `Please keep your review under ${MAX_QUOTE} characters.`
  const rating = Math.round(Number(input.rating))
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return 'Please choose a star rating.'
  const email = String(input.email ?? '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'That email address does not look right. You can also leave it blank.'
  }
  return ''
}

/** "3 weeks ago" style label, falling back to a plain date for older reviews. */
export function reviewDateLabel(iso: string): string {
  if (!iso) return ''
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return then.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}
