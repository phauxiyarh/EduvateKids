'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ShelfWithBooks } from '../../lib/shelves'
import { EventNavDropdown } from '../components/EventNavDropdown'
import { HeaderCart } from '../components/HeaderCart'
import { BookPlaceholder } from '../components/BookPlaceholder'
import logo from '../../assets/logo.png'

/**
 * One book standing on the shelf. Lifts and enlarges slightly on hover, and
 * cycles through that book's own cover images while hovered. Clicking opens
 * the product page, the same destination as a catalog card.
 */
function ShelfBook({
  book,
  covers
}: {
  book: ShelfWithBooks['books'][number]
  /** This book's images only. Never another book's. */
  covers: string[]
}) {
  const [frame, setFrame] = useState(0)
  const [hovered, setHovered] = useState(false)

  // Only animate while hovered: a page of shelves each running a timer would
  // burn cycles for motion nobody is looking at.
  useEffect(() => {
    if (!hovered || covers.length < 2) return
    const id = setInterval(() => setFrame((f) => (f + 1) % covers.length), 1100)
    return () => clearInterval(id)
  }, [hovered, covers.length])

  useEffect(() => {
    if (!hovered) setFrame(0)
  }, [hovered])

  const src = covers[frame] ?? covers[0] ?? ''

  return (
    <Link
      href={`/book/${book.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      title={book.title}
      className="group/book relative block shrink-0 origin-bottom transition-transform duration-300 ease-out hover:-translate-y-2 hover:scale-105 focus-visible:-translate-y-2 focus-visible:scale-105 focus-visible:outline-none"
    >
      <div className="relative h-[132px] w-[92px] overflow-hidden rounded-[3px] bg-white shadow-[0_6px_14px_rgba(0,0,0,0.28)] ring-1 ring-black/10 sm:h-[164px] sm:w-[114px]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`${book.title} cover`}
            className="h-full w-full object-cover transition-opacity duration-500"
            loading="lazy"
          />
        ) : (
          <BookPlaceholder title={book.title} className="h-full w-full" />
        )}
        {/* Spine shading, so a flat cover reads as a physical book. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-[7px] bg-gradient-to-r from-black/35 to-transparent"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10"
        />
        {covers.length > 1 && hovered && (
          <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-1">
            {covers.map((_, i) => (
              <span
                key={i}
                className={`h-1 w-1 rounded-full ${i === frame ? 'bg-white' : 'bg-white/45'}`}
              />
            ))}
          </span>
        )}
      </div>

      {/* Title on hover, positioned above the book so it clears the shelf. */}
      <span className="pointer-events-none absolute -top-9 left-1/2 z-20 w-36 -translate-x-1/2 rounded-lg bg-primaryDark px-2 py-1 text-center text-[10px] font-semibold leading-tight text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover/book:opacity-100">
        {book.title}
      </span>
    </Link>
  )
}

/** A single wooden shelf holding one row of books. */
function Shelf({ shelf }: { shelf: ShelfWithBooks }) {
  const railRef = useRef<HTMLDivElement | null>(null)

  const scrollBy = (dir: 1 | -1) => {
    railRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  return (
    <section className="mb-14" aria-labelledby={`shelf-${shelf.slug}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`shelf-${shelf.slug}`} className="font-display text-2xl sm:text-3xl gradient-text">
            {shelf.name}
          </h2>
          {shelf.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted">{shelf.description}</p>
          )}
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primaryDark">
          {shelf.books.length} {shelf.books.length === 1 ? 'book' : 'books'}
        </span>
      </div>

      <div className="relative">
        {shelf.books.length > 4 && (
          <>
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label={`Scroll ${shelf.name} left`}
              className="absolute -left-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primaryDark shadow-lg ring-1 ring-black/10 transition hover:scale-110 sm:flex"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label={`Scroll ${shelf.name} right`}
              className="absolute -right-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primaryDark shadow-lg ring-1 ring-black/10 transition hover:scale-110 sm:flex"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </>
        )}

        {/* Back panel. Real wood grain, darkened so book covers stay the focus,
            with an inner shadow suggesting the recess behind the books. */}
        <div className="shelf-backboard relative rounded-t-xl px-3 pt-5 sm:px-6">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-t-xl bg-gradient-to-b from-black/45 via-black/15 to-black/35" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" />
          <div
            ref={railRef}
            className="shelf-rail relative z-10 flex items-end gap-3 overflow-x-auto pb-1 sm:gap-4"
          >
            {/* Covers are each book's own images only. Borrowing neighbours'
                covers to pad the slider made the same artwork appear on several
                spines, which read as duplicate books on the shelf. */}
            {shelf.books.map((b) => (
              <ShelfBook key={b.id} book={b} covers={b.images} />
            ))}
          </div>
        </div>

        {/* The plank: same grain rotated so it reads as a cut edge, with a
            highlight along the front lip and a shadow cast underneath. */}
        <div className="shelf-plank relative h-5 rounded-b-md shadow-[0_12px_22px_-8px_rgba(0,0,0,0.6)]">
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-white/25" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-b-md bg-gradient-to-b from-transparent via-black/10 to-black/45" />
        </div>
        <div className="mx-4 h-2 rounded-b-lg bg-gradient-to-b from-black/45 to-transparent blur-[1px]" />
      </div>
    </section>
  )
}

export default function ShelvesPageClient({ shelves }: { shelves: ShelfWithBooks[] }) {
  const [active, setActive] = useState<string>('all')

  const shown = useMemo(
    () => (active === 'all' ? shelves : shelves.filter((s) => s.slug === active)),
    [active, shelves]
  )

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
            {[
              { label: 'Home', href: '/', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10' },
              { label: 'Our Catalog', href: '/catalog', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
              { label: 'Shelves', href: '/shelves', active: true, icon: 'M6 5v10M10 7v8M14 4v11M18 8v7M3.5 15.5h17M5 15.5v3.5m14-3.5v3.5' },
              { label: 'FAQs', href: '/faqs', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 ${
                  item.active
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                    : 'bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            ))}
            <EventNavDropdown />
          </nav>
          <HeaderCart />
        </div>
      </header>

      <main className="mx-auto w-11/12 max-w-6xl py-10 sm:py-14">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Our Shelves</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl gradient-text">
            Browse the shelves
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-muted">
            Hand-picked collections, grouped the way we would arrange them in a real shop.
            Hover a book to take a closer look, then click through to read more.
          </p>
        </div>

        {shelves.length > 1 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setActive('all')}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                active === 'all'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                  : 'border-2 border-primary/20 bg-white text-primaryDark hover:bg-primary/5'
              }`}
            >
              All shelves
            </button>
            {shelves.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.slug)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  active === s.slug
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                    : 'border-2 border-primary/20 bg-white text-primaryDark hover:bg-primary/5'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-12">
          {shown.length ? (
            shown.map((s) => <Shelf key={s.id} shelf={s} />)
          ) : (
            <p className="rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 p-10 text-center text-sm text-muted">
              No shelves have been set up yet. Check back soon.
            </p>
          )}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-7 py-3 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            See the full catalog
          </Link>
        </div>
      </main>

      <footer className="mt-10 bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] py-10 text-white">
        <div className="mx-auto w-11/12 max-w-6xl text-sm">
          <p className="font-display text-lg font-bold">Eduvate Kids</p>
          <nav className="mt-4 flex flex-wrap gap-4 text-white/80">
            <Link href="/catalog" className="hover:text-white">Catalog</Link>
            <Link href="/shelves" className="hover:text-white">Shelves</Link>
            <Link href="/faqs" className="hover:text-white">FAQs</Link>
            <Link href="/contact-us" className="hover:text-white">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
