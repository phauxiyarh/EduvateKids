import type { Metadata } from 'next'
import HomePage from './PageClient'

/**
 * Server wrapper. The page body is a client component (it uses hooks, cart
 * state and Firestore), and a 'use client' module cannot export `metadata` —
 * which is why every page previously inherited the generic root title. Keeping
 * a thin server shell here lets each route declare its own real title.
 */
export const metadata: Metadata = {
  // `absolute` because the root template would otherwise be skipped for the
  // default title — we still want the brand in the homepage headline.
  title: { absolute: "Islamic Children's Books & Learning Kits | Eduvate Kids" },
  description:
    'Eduvate Kids is a Maryland-based Islamic bookstore for families and schools. Shop curated children’s books, Arabic learning kits, crafts, and gifts. Free shipping over $150.',
  alternates: { canonical: '/' },
  openGraph: {
    title: "Islamic Children's Books & Learning Kits | Eduvate Kids",
    description:
      'Curated Islamic books, Arabic learning kits, crafts, and gifts for Muslim families and schools. Maryland-based. Free shipping over $150.',
    url: '/',
    type: 'website'
  }
}

export default function Page() {
  return <HomePage />
}
