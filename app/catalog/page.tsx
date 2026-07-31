import type { Metadata } from 'next'
import Link from 'next/link'
import { getCatalogProducts, SITE_URL } from '../../lib/catalogBuild'
import CatalogPage from './PageClient'

export const metadata: Metadata = {
  title: 'Shop Islamic Books, Crafts & Gifts for Kids',
  description:
    'Browse our curated catalog of Islamic children’s books, activity books, Arabic learning kits, puzzles, crafts and gifts. Shipped from Maryland — free shipping over $150.',
  alternates: { canonical: '/catalog' },
  openGraph: {
    title: 'Shop Islamic Books, Crafts & Gifts for Kids | Eduvate Kids',
    description:
      'Curated Islamic children’s books, Arabic learning kits, crafts and gifts. Free shipping over $150.',
    url: '/catalog',
    type: 'website'
  }
}

export default async function Page() {
  // The interactive grid below fetches its own data client-side. This server
  // pass exists so the page is not an empty document to crawlers and AI
  // assistants: it emits an ItemList of every product plus a real <a> to each
  // product page, which is also how those pages get discovered.
  const products = await getCatalogProducts()

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Eduvate Kids catalog',
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/book/${p.slug}`,
      name: p.title
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <CatalogPage />
      {/* Visually hidden, fully crawlable. Not aria-hidden: it is a legitimate
          navigable index of the catalog for screen readers too. */}
      <nav aria-label="All products" className="sr-only">
        <h2>All {products.length} products</h2>
        <ul>
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/book/${p.slug}`}>
                {p.title}
                {p.showPublisher && p.publisher ? ` by ${p.publisher}` : ''} — ${p.price.toFixed(2)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
