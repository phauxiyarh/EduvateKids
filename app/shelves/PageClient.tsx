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
 * cycles its cover images while hovered. Clicking opens the product page, the
 * same destination as a catalog card.
 */
function ShelfBook({
  book,
  covers
}: {
  book: ShelfWithBooks['books'][number]
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

        {/* Back panel */}
        <div className="rounded-t-xl bg-gradient-to-b from-[#c8a27a] to-[#b4885c] px-3 pt-5 shadow-inner sm:px-6">
          <div
            ref={railRef}
            className="shelf-rail flex items-end gap-3 overflow-x-auto pb-1 sm:gap-4"
          >
            {shelf.books.map((b) => (
              <ShelfBook
                key={b.id}
                book={b}
                // Cover slides come from the books on the shelf: this book's
                // own cover first, then its neighbours, so a single-image
                // product still animates with related titles.
                covers={[
                  b.image,
                  ...shelf.books.filter((o) => o.id !== b.id && o.image).slice(0, 3).map((o) => o.image)
                ].filter(Boolean)}
              />
            ))}
          </div>
        </div>

        {/* The plank, plus a thinner under-lip for depth. */}
        <div className="h-4 rounded-b-lg bg-gradient-to-b from-[#8b5e34] via-[#7a5230] to-[#5f3f24] shadow-[0_10px_18px_-6px_rgba(0,0,0,0.55)]" />
        <div className="mx-3 h-2 rounded-b-lg bg-gradient-to-b from-[#4a3218] to-[#3a2712] opacity-80" />
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
              { label: 'Home', href: '/' },
              { label: 'Our Catalog', href: '/catalog' },
              { label: 'Shelves', href: '/shelves', active: true },
              { label: 'FAQs', href: '/faqs' }
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={`rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 ${
                  item.active
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                    : 'bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5'
                }`}
              >
                {item.label}
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
