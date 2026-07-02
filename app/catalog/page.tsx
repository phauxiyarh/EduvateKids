'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import logo from '../../assets/logo.png'

type CatalogItem = {
  id: string
  title: string
  description: string
  category: string[]
  ageCategory: string | string[]
  price: number
  publisher: string
  images: string[]
}

const AGE_CATEGORIES: Record<string, { range: string; title: string }> = {
  '0-5': { range: '0-5 years', title: 'Little Imaan Explorers' },
  '6-9': { range: '6-9 years', title: 'Deen Explorers' },
  '10+': { range: '10+ years', title: 'Young Scholars' },
  'Adult': { range: 'Adult', title: 'Wisdom Seekers' }
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
  const [expandedItem, setExpandedItem] = useState<CatalogItem | null>(null)
  const [expandedSlider, setExpandedSlider] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const headerReveal = useReveal<HTMLDivElement>()
  const gridReveal = useReveal<HTMLDivElement>()

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
          return {
            id: d.id,
            title: String(data.title ?? ''),
            description: String(data.description ?? ''),
            category: categoryArray,
            ageCategory: String(data.ageCategory ?? ''),
            price: Number(data.price ?? 0),
            publisher: String(data.publisher ?? ''),
            images: Array.isArray(data.images) ? data.images : []
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
  const filteredItems = catalogItems.filter((item) => {
    return catalogFilter === 'All' || item.category.includes(catalogFilter)
  })

  return (
    <div className="min-h-screen text-ink bg-gradient-to-br from-purple-50/50 via-white to-pink-50/50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)] backdrop-blur-xl">
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
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /></svg>
              <span>Home</span>
            </Link>
            <Link href="/catalog" aria-current="page" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <span>Our Products</span>
            </Link>
            <Link href="/book-event" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span>Book Event</span>
            </Link>
            <Link href="/faqs" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>FAQs</span>
            </Link>
            <Link href="/contact-us" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /></svg>
              <span>Contact</span>
            </Link>
          </nav>

          {/* Mobile menu button */}
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
                <span>Our Products</span>
              </Link>
              <Link href="/book-event" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>Book Event</span>
              </Link>
              <Link href="/faqs" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>FAQs</span>
              </Link>
              <Link href="/contact-us" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /></svg>
                <span>Contact</span>
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
            <h1 className="mt-4 font-display text-3xl sm:text-5xl gradient-text">Our Products</h1>
            <p className="mt-4 text-lg text-muted max-w-2xl mx-auto">
              Browse our complete collection of Islamic books, crafts, puzzles, games, and gifts for children of all ages.
            </p>
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
          </p>

          {/* Product Grid */}
          <div ref={gridReveal} className="reveal reveal-stagger grid gap-5 sm:gap-8 grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => { setExpandedItem(item); setExpandedSlider(0) }}
                className="card-hover group flex flex-col rounded-3xl bg-white shadow-[0_2px_24px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden hover:-translate-y-1.5 hover:shadow-[0_16px_48px_rgba(124,58,237,0.16)] cursor-pointer"
              >
                {/* Image */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 overflow-hidden">
                  {item.images.length > 0 ? (
                    <>
                      <div className="relative h-full w-full">
                        {item.images.map((img, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={img}
                            alt={`${item.title} ${imgIdx + 1}`}
                            className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out ${
                              imgIdx === (catalogSlider[item.id] ?? 0)
                                ? 'opacity-100 scale-100'
                                : 'opacity-0 scale-110'
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
                    <div className="flex h-full items-center justify-center">
                      <PhotoIcon className="h-12 w-12 text-primary/25" />
                    </div>
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
                    {(Array.isArray(item.ageCategory) ? item.ageCategory : [item.ageCategory]).map((age) => (
                      <span
                        key={age}
                        className="rounded-full bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-blue-700"
                        title={AGE_CATEGORIES[age]?.range || age}
                      >
                        {AGE_CATEGORIES[age]?.title || `Ages ${age}`}
                      </span>
                    ))}
                  </div>
                  <h3 className="font-display text-sm sm:text-base font-bold text-primaryDark leading-snug line-clamp-2">{item.title}</h3>
                  <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-[13px] text-muted leading-relaxed line-clamp-2 hidden sm:block">{item.description}</p>
                  <div className="mt-auto pt-2 sm:pt-4 flex items-center justify-between gap-1">
                    <span className="text-base sm:text-xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">${item.price.toFixed(2)}</span>
                    <span className="text-[9px] sm:text-[11px] font-semibold text-purple-600 bg-purple-50 rounded-full px-1.5 sm:px-2.5 py-0.5 border border-purple-200/60 max-w-[80px] sm:max-w-[120px] truncate hidden sm:inline">
                      {item.publisher}
                    </span>
                  </div>
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
              <p className="text-lg text-muted">No products found in this category.</p>
              <button
                type="button"
                onClick={() => setCatalogFilter('All')}
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
                        className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${
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
                  <div className="flex h-full items-center justify-center">
                    <PhotoIcon className="h-20 w-20 text-primary/25" />
                  </div>
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
                  {(Array.isArray(expandedItem.ageCategory) ? expandedItem.ageCategory : [expandedItem.ageCategory]).map((age) => (
                    <span
                      key={age}
                      className="rounded-full bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700"
                      title={AGE_CATEGORIES[age]?.range || age}
                    >
                      {AGE_CATEGORIES[age]?.title || `Ages ${age}`}
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

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <p className="text-sm text-muted">
                    <span className="font-semibold">Publisher:</span> {expandedItem.publisher}
                  </p>
                </div>

                <p className="mt-6 text-sm text-muted">
                  For purchasing, visit us at our events or contact us directly.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative overflow-hidden bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] py-10 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="relative mx-auto w-11/12 max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src={logo} alt="Eduvate Kids" width={40} height={40} className="w-10 h-10" />
              <span className="font-display text-xl font-bold">Eduvate Kids</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link href="/" className="text-white/70 transition-colors hover:text-white">Home</Link>
              <Link href="/catalog" className="text-white/70 transition-colors hover:text-white">Our Products</Link>
              <Link href="/book-event" className="text-white/70 transition-colors hover:text-white">Book Event</Link>
              <Link href="/contact-us" className="text-white/70 transition-colors hover:text-white">Contact</Link>
              <Link href="/policies" className="text-white/70 transition-colors hover:text-white">Policies</Link>
            </div>
          </div>
          <div className="mt-8 mb-6 flex justify-center">
            <Link
              href="/auth/login"
              aria-label="Admin Login"
              className="group inline-flex items-center justify-center rounded-full border border-white/10 p-2.5 text-white/30 transition-all duration-300 hover:border-white/30 hover:bg-white/5 hover:text-white/80"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.418-3.03 7.79-7 9-3.97-1.21-7-4.582-7-9V7l7-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.75 1.75L15 10" />
              </svg>
            </Link>
          </div>
          <div className="border-t border-white/10 pt-6 text-center text-sm text-white/50">
            © {new Date().getFullYear()} Eduvate Kids. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
