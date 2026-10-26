'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCart } from '../../../lib/cart'
import type { CatalogProduct } from '../../../lib/catalogBuild'
import { BookPlaceholder } from '../../components/BookPlaceholder'
import { PreorderModal } from '../../components/PreorderModal'
import { SiteHeader } from '../../components/SiteChrome'
import { trackViewItem } from '../../../lib/analytics'

/**
 * Product detail view. The surrounding page is a server component, so the
 * title, description and price below are present in the static HTML — only
 * the cart interactions need the client.
 */
export default function ProductPageClient({
  product,
  inStock,
  ageText
}: {
  product: CatalogProduct
  inStock: boolean
  ageText: string
}) {
  const { addItem, openCart } = useCart()
  const [activeImage, setActiveImage] = useState(0)
  const [added, setAdded] = useState(false)
  const [preorderOpen, setPreorderOpen] = useState(false)

  // Feeds GA4's standard ecommerce funnel: view_item -> add_to_cart ->
  // begin_checkout -> purchase. add_to_cart is reported from the cart itself.
  useEffect(() => {
    trackViewItem({ id: product.id, title: product.title, price: product.price })
  }, [product.id, product.title, product.price])

  const handleAdd = () => {
    addItem({ id: product.id, title: product.title, price: product.price, image: product.images[0] })
    setAdded(true)
    openCart()
    setTimeout(() => setAdded(false), 2000)
  }

  // Out of stock offers the same reserve flow as the catalog instead of a
  // dead button. Shared by the inline button and the mobile buy bar.
  const handleBuy = inStock ? handleAdd : () => setPreorderOpen(true)
  const buyLabel = added ? 'Added to cart ✓' : inStock ? 'Add to cart' : 'Reserve a copy'

  return (
    // Bottom padding below lg keeps the footer clear of the fixed buy bar.
    <div className="min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-ink lg:pb-0">
      <SiteHeader current="/catalog" />

      <main className="mx-auto w-11/12 max-w-6xl py-8 sm:py-12">
        {/* Breadcrumb — also an internal link path for crawlers. */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <ol className="flex flex-wrap items-center gap-1.5 text-muted">
            <li><Link href="/" className="hover:text-primary">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/catalog" className="hover:text-primary">Catalog</Link></li>
            <li aria-hidden="true">/</li>
            <li className="font-semibold text-primaryDark" aria-current="page">{product.title}</li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Images */}
          <div>
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-primary/10 bg-white shadow-xl">
              {product.images.length ? (
                // Firebase Storage URLs; next/image optimisation is disabled
                // for the static export so a plain img is the honest choice.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.images[activeImage]}
                  alt={`${product.title}${product.showPublisher && product.publisher ? ` by ${product.publisher}` : ''} cover`}
                  className="h-full w-full object-contain p-4"
                  loading="eager"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-8">
                  <BookPlaceholder title={product.title} />
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {product.images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`View image ${i + 1} of ${product.title}`}
                    className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition ${
                      i === activeImage ? 'border-primary' : 'border-black/10 hover:border-primary/40'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-primaryDark">
              {product.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {product.showPublisher && product.publisher && (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primaryDark">
                  {product.publisher}
                </span>
              )}
              {ageText && (
                <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">
                  {ageText}
                </span>
              )}
              {product.category.map((c) => (
                <span key={c} className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-muted">
                  {c}
                </span>
              ))}
            </div>

            <p className="mt-6 text-3xl font-bold text-primaryDark">${product.price.toFixed(2)}</p>

            <p className={`mt-2 text-sm font-semibold ${inStock ? 'text-green-700' : 'text-red-600'}`}>
              {inStock ? 'In stock, ready to ship' : 'Currently out of stock'}
            </p>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleBuy}
                className="w-full rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-4 text-base font-bold text-white shadow-soft transition-all hover:shadow-lg hover:-translate-y-0.5 sm:w-auto"
              >
                {buyLabel}
              </button>
              {!inStock && (
                <p className="mt-2 text-xs text-muted">Free to reserve. We&apos;ll email you when it&apos;s back.</p>
              )}
            </div>

            {product.description && (
              <div className="mt-8">
                <h2 className="font-display text-xl font-bold text-primaryDark">About this book</h2>
                {/* Preserve the paragraph breaks the admin typed. */}
                {product.description.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className="mt-3 leading-relaxed text-ink/85 whitespace-pre-line">
                    {para.trim()}
                  </p>
                ))}
              </div>
            )}

          </div>
        </div>

        <div className="mt-14 border-t border-black/5 pt-8">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 rounded-full border-2 border-primary/30 bg-white px-6 py-3 text-sm font-bold text-primaryDark transition hover:bg-primary/5"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Browse the full catalog
          </Link>
        </div>
      </main>

      <footer className="mt-10 bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] py-10 text-white">
        <div className="mx-auto w-11/12 max-w-6xl text-sm">
          <p className="font-display text-lg font-bold">Eduvate Kids</p>
          <p className="mt-2 text-white/70">
            Curated Islamic books, Arabic learning kits, crafts and gifts for Muslim families and
            schools. Based in Maryland, USA.
          </p>
          <nav className="mt-4 flex flex-wrap gap-4 text-white/80">
            <Link href="/catalog" className="hover:text-white">Catalog</Link>
            <Link href="/faqs" className="hover:text-white">FAQs</Link>
            <Link href="/book-event" className="hover:text-white">Book an event</Link>
            <Link href="/contact-us" className="hover:text-white">Contact</Link>
            <Link href="/policies" className="hover:text-white">Policies</Link>
          </nav>
        </div>
      </footer>

      {/* Mobile buy bar: price and the same action, always within thumb reach. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">{product.title}</p>
            <p className="text-lg font-bold leading-tight text-primaryDark">${product.price.toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={handleBuy}
            className="min-h-[44px] flex-shrink-0 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-bold text-white shadow-soft transition active:scale-[0.98]"
          >
            {buyLabel}
          </button>
        </div>
      </div>

      {preorderOpen && (
        <PreorderModal
          book={{ id: product.id, title: product.title, image: product.images[0] }}
          onClose={() => setPreorderOpen(false)}
        />
      )}
    </div>
  )
}
