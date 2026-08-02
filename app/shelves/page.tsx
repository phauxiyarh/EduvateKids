import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getCatalogProducts,
  getPublicCollection,
  SITE_URL
} from '../../lib/catalogBuild'
import { normalizeShelf, sortShelves, type ShelfWithBooks } from '../../lib/shelves'
import ShelvesPageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Browse Our Shelves',
  description:
    'Hand-picked shelves of Islamic books for children. Browse curated collections by theme, season and reading age from Eduvate Kids.',
  alternates: { canonical: '/shelves' },
  openGraph: {
    title: 'Browse Our Shelves | Eduvate Kids',
    description:
      'Hand-picked shelves of Islamic books for children, curated by theme, season and reading age.',
    url: '/shelves',
    type: 'website'
  }
}

export default async function Page() {
  const [shelfDocs, products] = await Promise.all([
    getPublicCollection('shelves'),
    getCatalogProducts()
  ])

  const shelves = shelfDocs
    .map((d) => normalizeShelf(d, d.id))
    .filter((s) => s.active && s.name)
    .sort(sortShelves)

  // Attach each shelf's books. Membership lives on the product so a book can
  // appear on several shelves; the slug is what the product stores.
  const withBooks: ShelfWithBooks[] = shelves.map((shelf) => ({
    ...shelf,
    books: products
      .filter((p) => p.shelves.includes(shelf.slug))
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        images: p.images,
        price: p.price
      }))
  }))

  // An empty shelf renders as a sad gap, so keep only populated ones.
  const populated = withBooks.filter((s) => s.books.length > 0)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Eduvate Kids shelves',
    url: `${SITE_URL}/shelves`,
    hasPart: populated.map((s) => ({
      '@type': 'ItemList',
      name: s.name,
      description: s.description || undefined,
      numberOfItems: s.books.length,
      itemListElement: s.books.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/book/${b.slug}`,
        name: b.title
      }))
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ShelvesPageClient shelves={populated} />
      {/* Crawlable index. The shelf UI above is interactive and renders its
          books client-side; this keeps every title and link in static HTML. */}
      <nav aria-label="All shelves" className="sr-only">
        {populated.map((s) => (
          <section key={s.id}>
            <h2>{s.name}</h2>
            {s.description && <p>{s.description}</p>}
            <ul>
              {s.books.map((b) => (
                <li key={b.id}>
                  <Link href={`/book/${b.slug}`}>
                    {b.title} (${b.price.toFixed(2)})
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </>
  )
}
