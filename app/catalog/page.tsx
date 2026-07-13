'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCart } from '../../lib/cart'
import { EventNavDropdown } from '../components/EventNavDropdown'
import { HeaderCart } from '../components/HeaderCart'
import { OPEN_COOKIE_PREFS } from '../components/CookieConsent'
import { BookPlaceholder } from '../components/BookPlaceholder'
import { PreorderModal, type PreorderBook } from '../components/PreorderModal'
import logo from '../../assets/logo.png'

type CatalogItem = {
  id: string
  title: string
  description: string
  category: string[]
  ageCategory: string | string[]
  price: number
  publisher: string
  // Admin toggle: when false the publisher is hidden from the storefront.
  showPublisher: boolean
  images: string[]
  // Mirrored stock count from inventory (see functions/src/orders.ts). When
  // undefined the book is treated as available (no stock tracking on that item).
  stock?: number
}

/** A catalog item is out of stock only when it has a tracked stock of 0 or less. */
function isOutOfStock(item: { stock?: number }): boolean {
  return typeof item.stock === 'number' && item.stock <= 0
}

const AGE_CATEGORIES: Record<string, { range: string; title: string }> = {
  '0-5': { range: '0-5 years', title: 'Little Imaan Explorers' },
  '6-9': { range: '6-9 years', title: 'Deen Explorers' },
  '10+': { range: '10+ years', title: 'Young Scholars' },
  'Adult': { range: 'Adult', title: 'Wisdom Seekers' }
}

// Map an age category value to a simple lower-bound "N+" style label.
// Known keys map directly; a raw numeric/range value is reduced to its lower bound.
const AGE_TAG_MAP: Record<string, string> = {
  // current keys
  '0+': '0+',
  '3+': '3+',
  '6+': '6+',
  '10+': '10+',
  'Adult': 'Adult',
  // legacy range keys (older items)
  '0-5': '3+',
  '6-9': '6+'
}

function ageTagLabel(age: string): string {
  const raw = (age ?? '').trim()
  if (!raw) return ''
  if (AGE_TAG_MAP[raw]) return AGE_TAG_MAP[raw]
  if (/^adult$/i.test(raw)) return 'Adult'
  // Pull the first number from a range/numeric value and show its lower bound.
  const match = raw.match(/\d+/)
  if (match) return `${match[0]}+`
  return raw
}

// Scroll-reveal hook: adds the 'is-visible' class when the element enters the
// viewport. Guards against environments where IntersectionObserver is missing
// so the content stays visible.
function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible')
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

// Inline photo/image placeholder icon
function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={1.6} />
      <circle cx="8.5" cy="9.5" r="1.6" strokeWidth={1.6} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M21 16l-5-5-9 9" />
    </svg>
  )
}

export default function CatalogPage() {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [catalogSlider, setCatalogSlider] = useState<Record<string, number>>({})
  const [catalogFilter, setCatalogFilter] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedItem, setExpandedItem] = useState<CatalogItem | null>(null)
  const [expandedSlider, setExpandedSlider] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Book a shopper is trying to pre-order because it's out of stock.
  const [preorderBook, setPreorderBook] = useState<PreorderBook | null>(null)

  const headerReveal = useReveal<HTMLDivElement>()
  const gridReveal = useReveal<HTMLDivElement>()
  const { addItem, items: cartItems, setQuantity } = useCart()

  useEffect(() => {
    getDocs(collection(db, 'catalog')).then((snap) => {
      if (!snap.empty) {
        const items = snap.docs.map((d) => {
          const data = d.data()
          // Handle category as array (new format) or string (legacy format)
          const categoryData = data.category
          const categoryArray: string[] = Array.isArray(categoryData)
            ? categoryData
            : typeof categoryData === 'string' && categoryData
            ? [categoryData]
            : ['Books']
          // Stock mirrors inventory; `stock` is the current field, `quantity` legacy.
          const rawStock = data.stock ?? data.quantity
          return {
            id: d.id,
            title: String(data.title ?? ''),
            description: String(data.description ?? ''),
            category: categoryArray,
            ageCategory: String(data.ageCategory ?? ''),
            price: Number(data.price ?? 0),
            publisher: String(data.publisher ?? ''),
            showPublisher: data.showPublisher !== false, // default visible
            images: Array.isArray(data.images) ? data.images : [],
            stock: rawStock === undefined || rawStock === null ? undefined : Number(rawStock)
          } as CatalogItem
        })
        setCatalogItems(items)
      }
    }).catch(() => {})
  }, [])

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (expandedItem) {
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = previous
      }
    }
  }, [expandedItem])

  const allCategories = ['All', ...new Set(catalogItems.flatMap((i) => i.category))]
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredItems = catalogItems.filter((item) => {
    const matchesCategory = catalogFilter === 'All' || item.category.includes(catalogFilter)
    const matchesSearch = normalizedQuery === '' || item.title.toLowerCase().includes(normalizedQuery)
    return matchesCategory && matchesSearch
  })

  return (
    <div className="min-h-screen text-ink bg-gradient-to-br from-purple-50/50 via-white to-pink-50/50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)]">
        <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-xl" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-4 py-2">
          <Link className="group flex items-center gap-2 sm:gap-3 min-w-0" href="/">
            <Image
              src={logo}
              alt="Eduvate Kids logo"
              width={32}
              height={32}
              className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 transition-transform duration-500 group-hover:rotate-6"
              priority
            />
            <span className="font-display text-base sm:text-lg font-bold text-primary truncate">Eduvate Kids</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex flex-1 justify-center items-center gap-1">
            <Link href="/" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /></svg>
              <span>Home</span>
            </Link>
            <Link href="/catalog" aria-current="page" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <span>Our Catalog</span>
            </Link>
            <EventNavDropdown />
            <Link href="/contact-us" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /></svg>
              <span>Contact</span>
            </Link>
            <Link href="/faqs" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>FAQs</span>
            </Link>
          </nav>

          {/* Right zone: cart + mobile menu button */}
          <div className="flex items-center gap-2">
            <HeaderCart />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 rounded-lg text-muted hover:bg-primary/5 hover:text-primaryDark transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-primary/10 bg-white/95 backdrop-blur-xl py-3 animate-slideDown">
            <div className="mx-auto w-11/12 flex flex-col gap-1">
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /></svg>
                <span>Home</span>
              </Link>
              <Link href="/catalog" onClick={() => setMobileMenuOpen(false)} aria-current="page" className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-secondary px-4 py-3.5 text-sm font-bold text-white transition active:scale-[0.98]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                <span>Our Catalog</span>
              </Link>
              <p className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Event</p>
              <Link href="/summer-reads" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                <span>Summer Reads</span>
              </Link>
              <Link href="/book-event" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>Book Event</span>
              </Link>
              <Link href="/contact-us" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /></svg>
                <span>Contact</span>
              </Link>
              <Link href="/faqs" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>FAQs</span>
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="py-12 sm:py-20">
        <div className="mx-auto w-11/12 max-w-6xl">
          {/* Page Header */}
          <div ref={headerReveal} className="reveal text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
              Full Collection
            </p>
            <h1 className="mt-4 font-display text-3xl sm:text-5xl gradient-text">Our Catalog</h1>
            <p className="mt-4 text-lg text-muted max-w-2xl mx-auto">
              Browse our complete collection of Islamic books, crafts, puzzles, games, and gifts for children of all ages.
            </p>
          </div>

          {/* Search bar */}
          <div className="mx-auto mb-8 max-w-2xl">
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5 text-muted transition-colors duration-300 group-focus-within:text-primary">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by book title..."
                aria-label="Search catalog by book title"
                className="w-full rounded-full border border-primary/15 bg-white/90 py-4 pl-14 pr-12 text-base text-ink shadow-[0_8px_30px_rgba(124,58,237,0.08)] backdrop-blur-sm transition-all duration-300 placeholder:text-muted/70 hover:border-primary/30 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-5 text-muted transition-colors duration-300 hover:text-primary"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatalogFilter(cat)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 ${
                  catalogFilter === cat
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                    : 'bg-gray-100 text-muted hover:bg-gray-200 hover:-translate-y-0.5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results count */}
          <p className="text-center text-muted mb-8">
            Showing {filteredItems.length} {filteredItems.length === 1 ? 'product' : 'products'}
            {catalogFilter !== 'All' && ` in ${catalogFilter}`}
            {normalizedQuery !== '' && ` matching "${searchQuery.trim()}"`}
          </p>

          {/* Product Grid */}
          <div ref={gridReveal} className="reveal reveal-stagger grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => { setExpandedItem(item); setExpandedSlider(0) }}
                className="card-hover group flex flex-col rounded-3xl bg-white shadow-[0_2px_24px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden hover:-translate-y-1.5 hover:shadow-[0_16px_48px_rgba(124,58,237,0.16)] cursor-pointer"
              >
                {/* Image */}
                <div className="relative aspect-[3/4] bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 overflow-hidden">
                  {isOutOfStock(item) && (
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-ink/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">Out of stock</span>
                  )}
                  {item.images.length > 0 ? (
                    <>
                      <div className="relative h-full w-full">
                        {item.images.map((img, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={img}
                            alt={`${item.title} ${imgIdx + 1}`}
                            className={`absolute inset-0 h-full w-full object-contain p-3 transition-all duration-700 ease-out ${
                              imgIdx === (catalogSlider[item.id] ?? 0)
                                ? 'opacity-100 scale-100'
                                : 'opacity-0 scale-105'
                            }`}
                          />
                        ))}
                      </div>
                      {item.images.length > 1 && (
                        <>
                          <button
                            type="button"
                            aria-label="Previous image"
                            onClick={(e) => {
                              e.stopPropagation()
                              const cur = catalogSlider[item.id] ?? 0
                              setCatalogSlider((prev) => ({ ...prev, [item.id]: cur === 0 ? item.images.length - 1 : cur - 1 }))
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                          </button>
                          <button
                            type="button"
                            aria-label="Next image"
                            onClick={(e) => {
                              e.stopPropagation()
                              const cur = catalogSlider[item.id] ?? 0
                              setCatalogSlider((prev) => ({ ...prev, [item.id]: cur === item.images.length - 1 ? 0 : cur + 1 }))
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                          </button>
                          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {item.images.map((_, dotIdx) => (
                              <button
                                key={dotIdx}
                                type="button"
                                aria-label={`Go to image ${dotIdx + 1}`}
                                onClick={(e) => { e.stopPropagation(); setCatalogSlider((prev) => ({ ...prev, [item.id]: dotIdx })) }}
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  dotIdx === (catalogSlider[item.id] ?? 0)
                                    ? 'w-5 bg-white shadow-sm'
                                    : 'w-1.5 bg-white/50 hover:bg-white/80'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <BookPlaceholder title={item.title} className="h-full w-full" />
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-3 sm:p-5">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                    {item.category.map((cat) => (
                      <span key={cat} className="rounded-full bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-700">
                        {cat}
                      </span>
                    ))}
                    {(Array.isArray(item.ageCategory) ? item.ageCategory : [item.ageCategory])
                      .filter((age) => ageTagLabel(age))
                      .map((age) => (
                      <span
                        key={age}
                        className="rounded-full bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-blue-700"
                        title={AGE_CATEGORIES[age]?.range || age}
                      >
                        {ageTagLabel(age)}
                      </span>
                    ))}
                  </div>
                  <h3 className="font-display text-sm sm:text-base font-bold text-primaryDark leading-snug line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem]">{item.title}</h3>
                  <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-[13px] text-muted leading-relaxed line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem]">{item.description}</p>
                  <div className="mt-auto pt-2 sm:pt-4 flex items-center justify-between gap-1">
                    <span className="text-base sm:text-xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">${item.price.toFixed(2)}</span>
                    {item.showPublisher && item.publisher && (
                      <span className="text-[9px] sm:text-[11px] font-semibold text-purple-600 bg-purple-50 rounded-full px-1.5 sm:px-2.5 py-0.5 border border-purple-200/60 max-w-[80px] sm:max-w-[120px] truncate hidden sm:inline">
                        {item.publisher}
                      </span>
                    )}
                  </div>
                  {item.price > 0 && isOutOfStock(item) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreorderBook({ id: item.id, title: item.title, image: item.images[0] })
                      }}
                      className="mt-2 sm:mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] sm:text-xs font-semibold text-primaryDark transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/10"
                      aria-label={`${item.title} is out of stock — reserve a copy`}
                    >
                      <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      Out of stock — Reserve
                    </button>
                  )}
                  {item.price > 0 && !isOutOfStock(item) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        addItem({ id: item.id, title: item.title, price: item.price, image: item.images[0] })
                      }}
                      className="btn-shine mt-2 sm:mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-secondary px-3 py-2 text-[11px] sm:text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                      aria-label={`Add ${item.title} to cart`}
                    >
                      <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* No results */}
          {filteredItems.length === 0 && catalogItems.length > 0 && (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5">
                <svg className="h-8 w-8 text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 6.5C10.5 5.5 8 5 5 5.5v12C8 17 10.5 17.5 12 18.5m0-12c1.5-1 4-1.5 7-1v12c-3-.5-5.5 0-7 1m0-12v12" />
                </svg>
              </div>
              <p className="text-lg text-muted">No products found for your search.</p>
              <button
                type="button"
                onClick={() => { setCatalogFilter('All'); setSearchQuery('') }}
                className="mt-4 text-primary font-semibold hover:underline"
              >
                View all products
              </button>
            </div>
          )}

          {/* Loading state */}
          {catalogItems.length === 0 && (
            <div className="text-center py-16">
              <svg className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z" />
              </svg>
              <p className="text-lg text-muted">Loading products...</p>
            </div>
          )}
        </div>
      </main>

      {/* Expanded Item Modal */}
      {expandedItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setExpandedItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl animate-fadeIn"
          >
            <button
              type="button"
              aria-label="Close product details"
              onClick={() => setExpandedItem(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all duration-300 hover:scale-110 hover:bg-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="md:flex">
              {/* Image gallery */}
              <div className="relative md:w-1/2 aspect-square bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
                {expandedItem.images.length > 0 ? (
                  <>
                    {expandedItem.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`${expandedItem.title} ${idx + 1}`}
                        className={`absolute inset-0 h-full w-full object-contain p-4 transition-all duration-500 ${
                          idx === expandedSlider ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    ))}
                    {expandedItem.images.length > 1 && (
                      <>
                        <button
                          type="button"
                          aria-label="Previous image"
                          onClick={() => setExpandedSlider(expandedSlider === 0 ? expandedItem.images.length - 1 : expandedSlider - 1)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg hover:scale-110 transition-transform"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                          type="button"
                          aria-label="Next image"
                          onClick={() => setExpandedSlider(expandedSlider === expandedItem.images.length - 1 ? 0 : expandedSlider + 1)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg hover:scale-110 transition-transform"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                          {expandedItem.images.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              aria-label={`Go to image ${idx + 1}`}
                              onClick={() => setExpandedSlider(idx)}
                              className={`h-2 rounded-full transition-all duration-300 ${
                                idx === expandedSlider ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <BookPlaceholder title={expandedItem.title} className="h-full w-full" />
                )}
              </div>

              {/* Details */}
              <div className="md:w-1/2 p-6 sm:p-8">
                <div className="flex flex-wrap gap-2 mb-4">
                  {expandedItem.category.map((cat) => (
                    <span key={cat} className="rounded-full bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                      {cat}
                    </span>
                  ))}
                  {(Array.isArray(expandedItem.ageCategory) ? expandedItem.ageCategory : [expandedItem.ageCategory])
                    .filter((age) => ageTagLabel(age))
                    .map((age) => (
                    <span
                      key={age}
                      className="rounded-full bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700"
                      title={AGE_CATEGORIES[age]?.range || age}
                    >
                      {ageTagLabel(age)}
                    </span>
                  ))}
                </div>

                <h2 className="font-display text-2xl sm:text-3xl font-bold text-primaryDark">{expandedItem.title}</h2>

                <p className="mt-4 text-muted leading-relaxed">{expandedItem.description}</p>

                <div className="mt-6 flex items-center gap-4">
                  <span className="text-3xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    ${expandedItem.price.toFixed(2)}
                  </span>
                </div>

                {expandedItem.showPublisher && expandedItem.publisher && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <p className="text-sm text-muted">
                      <span className="font-semibold">Publisher:</span> {expandedItem.publisher}
                    </p>
                  </div>
                )}

                {expandedItem.price > 0 && isOutOfStock(expandedItem) && (
                  <button
                    type="button"
                    onClick={() => setPreorderBook({ id: expandedItem.id, title: expandedItem.title, image: expandedItem.images[0] })}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary/30 bg-primary/5 px-6 py-3.5 text-sm font-semibold text-primaryDark transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/10"
                    aria-label={`${expandedItem.title} is out of stock — reserve a copy`}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    Out of stock — Reserve a copy
                  </button>
                )}
                {expandedItem.price > 0 && !isOutOfStock(expandedItem) && (() => {
                  const inCart = cartItems.find((c) => c.id === expandedItem.id)
                  if (!inCart) {
                    return (
                      <button
                        type="button"
                        onClick={() => addItem({ id: expandedItem.id, title: expandedItem.title, price: expandedItem.price, image: expandedItem.images[0] })}
                        className="btn-shine mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                        aria-label={`Add ${expandedItem.title} to cart`}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        Add to Cart
                      </button>
                    )
                  }
                  return (
                    <div className="mt-6 flex items-center justify-between gap-4 rounded-full border-2 border-primary/20 bg-primary/5 p-1.5">
                      <span className="pl-4 text-sm font-semibold text-primaryDark">In your cart</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQuantity(expandedItem.id, inCart.quantity - 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primaryDark shadow-sm transition hover:bg-primary/10"
                          aria-label="Decrease quantity"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                        </button>
                        <span className="w-9 text-center text-base font-bold text-primaryDark">{inCart.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(expandedItem.id, inCart.quantity + 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary text-white shadow-sm transition hover:-translate-y-0.5"
                          aria-label="Increase quantity"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Out-of-stock pre-order / reservation modal */}
      {preorderBook && (
        <PreorderModal book={preorderBook} onClose={() => setPreorderBook(null)} />
      )}

      {/* Footer */}
      <footer className="relative overflow-hidden bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] py-10 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="relative mx-auto w-11/12 max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-3">
              <Image src={logo} alt="Eduvate Kids" width={40} height={40} className="w-10 h-10" />
              <span className="flex flex-col leading-tight">
                <span className="font-display text-xl font-bold">Eduvate Kids</span>
                <span className="font-display text-xs font-semibold italic text-emerald-300">Rooted in Faith. Growing in Knowledge.</span>
              </span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <Link href="/" className="text-white/70 transition-colors hover:text-white">Home</Link>
              <Link href="/catalog" className="text-white/70 transition-colors hover:text-white">Our Catalog</Link>
              <Link href="/book-event" className="text-white/70 transition-colors hover:text-white">Book Event</Link>
              <Link href="/contact-us" className="text-white/70 transition-colors hover:text-white">Contact</Link>
              <Link href="/faqs" className="text-white/70 transition-colors hover:text-white">FAQs</Link>
              <Link href="/policies" className="text-white/70 transition-colors hover:text-white">Policies</Link>
              <Link href="/accessibility" className="text-white/70 transition-colors hover:text-white">Accessibility</Link>
              <button type="button" onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_COOKIE_PREFS)) }} className="text-white/70 transition-colors hover:text-white">Cookie Preferences</button>
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-white/10 pt-6 text-sm text-white/50">
            <p>&copy; 2026 Eduvate Kids. All rights reserved.</p>
            <Link href="/auth/login" aria-label="Admin Login" className="group inline-flex items-center justify-center rounded-full p-1.5 text-white/30 transition-all duration-300 hover:bg-white/5 hover:text-white/80">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.418-3.03 7.79-7 9-3.97-1.21-7-4.582-7-9V7l7-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.75 1.75L15 10" />
              </svg>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
