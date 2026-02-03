'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
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

export default function CatalogPage() {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [catalogSlider, setCatalogSlider] = useState<Record<string, number>>({})
  const [catalogFilter, setCatalogFilter] = useState<string>('All')
  const [expandedItem, setExpandedItem] = useState<CatalogItem | null>(null)
  const [expandedSlider, setExpandedSlider] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  const allCategories = ['All', ...new Set(catalogItems.flatMap((i) => i.category))]
  const filteredItems = catalogItems.filter((item) => {
    return catalogFilter === 'All' || item.category.includes(catalogFilter)
  })

  return (
    <div className="min-h-screen text-ink bg-gradient-to-br from-purple-50/50 via-white to-pink-50/50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-4 py-2">
          <Link className="flex items-center gap-2 sm:gap-3 min-w-0" href="/">
            <Image
              src={logo}
              alt="Eduvate Kids logo"
              width={32}
              height={32}
              className="w-8 h-8 sm:w-10 sm:h-10 shrink-0"
              priority
            />
            <span className="font-display text-base sm:text-lg font-bold text-primary truncate">Eduvate Kids</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-semibold text-muted">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <Link href="/catalog" className="text-primary">Our Products</Link>
            <Link href="/book-event" className="hover:text-primary transition-colors">Book Event</Link>
            <Link href="/pos" className="hover:text-primary transition-colors">POS</Link>
            <Link href="/faqs" className="hover:text-primary transition-colors">FAQs</Link>
            <Link href="/contact-us" className="hover:text-primary transition-colors">Contact</Link>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <nav className="md:hidden border-t border-gray-100 bg-white py-4">
            <div className="mx-auto w-11/12 flex flex-col gap-3 text-sm font-semibold text-muted">
              <Link href="/" className="py-2 hover:text-primary transition-colors">Home</Link>
              <Link href="/catalog" className="py-2 text-primary">Our Products</Link>
              <Link href="/book-event" className="py-2 hover:text-primary transition-colors">Book Event</Link>
              <Link href="/pos" className="py-2 hover:text-primary transition-colors">POS</Link>
              <Link href="/faqs" className="py-2 hover:text-primary transition-colors">FAQs</Link>
              <Link href="/contact-us" className="py-2 hover:text-primary transition-colors">Contact</Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="py-12 sm:py-20">
        <div className="mx-auto w-11/12 max-w-6xl">
          {/* Page Header */}
          <div className="text-center mb-12">
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
                onClick={() => setCatalogFilter(cat)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 ${
                  catalogFilter === cat
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                    : 'bg-gray-100 text-muted hover:bg-gray-200'
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
          <div className="grid gap-5 sm:gap-8 grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => { setExpandedItem(item); setExpandedSlider(0) }}
                className="group flex flex-col rounded-3xl bg-white shadow-[0_2px_24px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden hover:shadow-[0_8px_40px_rgba(124,58,237,0.12)] hover:-translate-y-1 transition-all duration-500 cursor-pointer"
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
                            onClick={(e) => {
                              e.stopPropagation()
                              const cur = catalogSlider[item.id] ?? 0
                              setCatalogSlider((prev) => ({ ...prev, [item.id]: cur === 0 ? item.images.length - 1 : cur - 1 }))
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              const cur = catalogSlider[item.id] ?? 0
                              setCatalogSlider((prev) => ({ ...prev, [item.id]: cur === item.images.length - 1 ? 0 : cur + 1 }))
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                          </button>
                          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {item.images.map((_, dotIdx) => (
                              <button
                                key={dotIdx}
                                type="button"
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
                    <div className="flex h-full items-center justify-center text-4xl opacity-30">📷</div>
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
              <p className="text-4xl mb-4">📚</p>
              <p className="text-lg text-muted">No products found in this category.</p>
              <button
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
              <p className="text-4xl mb-4 animate-bounce">📖</p>
              <p className="text-lg text-muted">Loading products...</p>
            </div>
          )}
        </div>
      </main>

      {/* Expanded Item Modal */}
      {expandedItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setExpandedItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <button
              onClick={() => setExpandedItem(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg hover:scale-110 transition-transform"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
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
                          onClick={() => setExpandedSlider(expandedSlider === 0 ? expandedItem.images.length - 1 : expandedSlider - 1)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg hover:scale-110 transition-transform"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                          onClick={() => setExpandedSlider(expandedSlider === expandedItem.images.length - 1 ? 0 : expandedSlider + 1)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg hover:scale-110 transition-transform"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                          {expandedItem.images.map((_, idx) => (
                            <button
                              key={idx}
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
                  <div className="flex h-full items-center justify-center text-6xl opacity-30">📷</div>
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
      <footer className="bg-gradient-to-br from-primaryDark via-primary to-secondary py-12 text-white">
        <div className="mx-auto w-11/12 max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src={logo} alt="Eduvate Kids" width={40} height={40} className="w-10 h-10" />
              <span className="font-display text-xl font-bold">Eduvate Kids</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link href="/" className="hover:underline">Home</Link>
              <Link href="/catalog" className="hover:underline">Our Products</Link>
              <Link href="/book-event" className="hover:underline">Book Event</Link>
              <Link href="/contact-us" className="hover:underline">Contact</Link>
              <Link href="/policies" className="hover:underline">Policies</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/20 text-center text-sm opacity-80">
            © {new Date().getFullYear()} Eduvate Kids. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
