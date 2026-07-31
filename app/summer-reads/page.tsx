import type { Metadata } from 'next'
import SummerReadsPage from './PageClient'

export const metadata: Metadata = {
  title: 'Rooted Readers Summer Reading Challenge',
  description:
    'Join the Eduvate Kids Rooted Readers Summer Challenge — a free summer reading program for Muslim children, with book logging, milestones and prizes.',
  alternates: { canonical: '/summer-reads' },
  openGraph: {
    title: 'Rooted Readers Summer Reading Challenge | Eduvate Kids',
    description:
      'A free summer reading challenge for Muslim children — log books, hit milestones, win prizes.',
    url: '/summer-reads',
    type: 'website'
  }
}

export default function Page() {
  return <SummerReadsPage />
}
