import type { Metadata } from 'next'
import { getApprovedReviews, SITE_URL } from '../../lib/catalogBuild'
import { averageRating, normalizeReview, publicReviews } from '../../lib/reviews'
import ReviewsClient from './PageClient'

export const metadata: Metadata = {
  title: 'Customer Reviews',
  description:
    'What parents, teachers and young readers say about Eduvate Kids. Read verified customer reviews and leave your own.',
  alternates: { canonical: '/reviews' },
  openGraph: {
    title: 'Customer Reviews | Eduvate Kids',
    description: 'What parents, teachers and young readers say about Eduvate Kids.',
    url: '/reviews',
    type: 'website'
  }
}

export default async function Page() {
  const docs = await getApprovedReviews()
  const reviews = publicReviews(docs.map((d) => normalizeReview(d, d.id)))
  const average = averageRating(reviews)

  // AggregateRating is only valid with at least one review, and Google rejects
  // the whole block when the count is zero.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Eduvate Kids',
    url: SITE_URL,
    ...(reviews.length
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: average,
            reviewCount: reviews.length,
            bestRating: 5,
            worstRating: 1
          },
          review: reviews.slice(0, 20).map((r) => ({
            '@type': 'Review',
            reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            author: { '@type': 'Person', name: r.name },
            reviewBody: r.quote,
            ...(r.createdAt ? { datePublished: r.createdAt } : {})
          }))
        }
      : {})
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ReviewsClient reviews={reviews} />
    </>
  )
}
