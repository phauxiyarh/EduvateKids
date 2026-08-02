import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'

/**
 * Placeholder. The nav already links here, so this exists to avoid a 404
 * while the real page is built. Deliberately noindex: an empty page should
 * not be indexed and then have to be re-crawled once it has content.
 */
export const metadata: Metadata = {
  title: 'Free Downloads',
  description: 'Free printables and resources for Muslim families from Eduvate Kids.',
  alternates: { canonical: '/freebies' },
  robots: { index: false, follow: true }
}

export default function Page() {
  return (
    <div className="min-h-screen text-ink">
      <SiteHeader current="/freebies" />
      <main className="mx-auto w-11/12 max-w-3xl py-20 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Freebies</p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl gradient-text">Free downloads</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base text-muted">
          We are putting together a set of free printables and activity sheets for you. Check back
          shortly.
        </p>
        <Link
          href="/catalog"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-7 py-3 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          Browse the catalog
        </Link>
      </main>
      <SiteFooter />
    </div>
  )
}
