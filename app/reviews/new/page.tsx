import type { Metadata } from 'next'
import NewReviewClient from './NewReviewClient'

/**
 * A page of its own, not a modal, so the link can be shared: put it in a
 * receipt, a thank-you email, a QR code at an event, or a WhatsApp message and
 * it opens straight onto the form.
 */
export const metadata: Metadata = {
  title: 'Write a Review',
  description:
    'Share your experience with Eduvate Kids. Leave a star rating and a few words to help other families find the right books.',
  alternates: { canonical: '/reviews/new' },
  openGraph: {
    title: 'Write a Review | Eduvate Kids',
    description: 'Share your experience and help other families find the right books.',
    url: '/reviews/new',
    type: 'website'
  }
}

export default function Page() {
  return <NewReviewClient />
}
