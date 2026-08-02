'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '../../../lib/cart'
import type { CatalogProduct } from '../../../lib/catalogBuild'
import { EventNavDropdown } from '../../components/EventNavDropdown'
import { HeaderCart } from '../../components/HeaderCart'
import { BookPlaceholder } from '../../components/BookPlaceholder'
import logo from '../../../assets/logo.png'

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

  const handleAdd = () => {
    addItem({ id: product.id, title: product.title, price: product.price, image: product.images[0] })
    setAdded(true)
    openCart()
    setTimeout(() => setAdded(false), 2000)
  }

  const navItems = [
    { label: 'Home', href: '/', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10' },
    {
      label: 'Our Catalog',
      href: '/catalog',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
    },
    {
      label: 'Shelves',
      href: '/shelves',
      icon: 'M6 5v10M10 7v8M14 4v11M18 8v7M3.5 15.5h17M5 15.5v3.5m14-3.5v3.5'
    }
  ]

  return (
    <div className="min-h-screen text-ink">
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)]">
        <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-xl" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-3 sm:gap-6 py-3">
          <Link className="group flex items-center gap-2 sm:gap-3 min-w-0" href="/">
            <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 transition-transform duration-500 group-hover:rotate-6" />
            <span className="flex flex-col min-w-0 leading-tight">
              <span className="font-display text-base sm:text-lg font-bold truncate">Eduvate Kids</span>
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-primary/70 hidden sm:block">Islamic Bookstore</span>
            </span>
          </Link>
          <nav className="hidden flex-1 justify-center items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-2 rounded-full bg-primary/5 px-4 py-2.5 text-sm font-bold text-primaryDark transition-all duration-300 hover:bg-primary/10 hover:-translate-y-0.5"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            ))}
            <EventNavDropdown />
            <Link
              href="/faqs"
              className="flex items-center gap-2 rounded-full bg-primary/5 px-4 py-2.5 text-sm font-bold text-primaryDark transition-all duration-300 hover:bg-primary/10 hover:-translate-y-0.5"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>FAQs</span>
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <HeaderCart />
          </div>
        </div>
      </header>

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
                onClick={handleAdd}
                disabled={!inStock}
                className="w-full rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-4 text-base font-bold text-white shadow-soft transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 sm:w-auto"
              >
                {added ? 'Added to cart ✓' : inStock ? 'Add to cart' : 'Out of stock'}
              </button>
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

            <p className="mt-8 rounded-2xl bg-primary/5 p-4 text-sm text-muted">
              Free shipping on orders over $150. Shipped from Maryland, USA.{' '}
              <Link href="/policies" className="font-semibold text-primaryDark underline">
                Shipping &amp; returns
              </Link>
            </p>
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
    </div>
  )
}
