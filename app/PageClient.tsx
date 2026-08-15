'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { EventNavDropdown } from './components/EventNavDropdown'
import { HeaderCart } from './components/HeaderCart'
import { BookPlaceholder } from './components/BookPlaceholder'
import { ReadingMattersCard } from './components/ReadingMattersCard'
import { OPEN_COOKIE_PREFS } from './components/CookieConsent'
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { normalizeReview, publicReviews, averageRating, type Review } from '../lib/reviews'
import { Stars } from './components/StarRating'
import logo from '../assets/logo.png'
import catalogQR from '../assets/catalog.png'
import learningRootsLogo from '../assets/partners/learning-roots.webp'
import kubeLogo from '../assets/partners/kube.webp'
import oakLogo from '../assets/partners/oak.png'
import aligatorLogo from '../assets/partners/AliGator.png'
import muslimchildrenbooksLogo from '../assets/partners/muslimchildrenbooks.avif'
import design1 from '../assets/design1.png'
import design2 from '../assets/design2.png'
import bg2 from '../assets/bg2.png'
import bg1 from '../assets/bg1.png'
import { SiteFooterFull } from './components/SiteFooterFull'

const partners = [
  {
    name: 'Learning Roots (LR Community Partner for Maryland USA)',
    url: 'https://www.learningroots.com/',
    logo: learningRootsLogo
  },
  {
    name: 'Kube Publishing',
    url: 'https://www.kubepublishing.com/',
    logo: kubeLogo
  },
  {
    name: 'Oak Books',
    url: 'https://oakcreativedesigns.com/',
    logo: oakLogo
  },
  {
    name: 'AliGator',
    url: 'https://aligatorbooks.co.uk/',
    logo: aligatorLogo
  },
  {
    name: 'Muslim Children Books',
    url: 'https://muslimchildrenbooks.co.uk/',
    logo: muslimchildrenbooksLogo
  }
]

/**
 * Fallback testimonials. Deliberately kept, not dead code.
 *
 * The carousel prefers approved reviews from the `reviews` collection and only
 * falls back to these when it can read none: an empty collection, a rules
 * change, a Firestore outage. Without them the home page would show an empty
 * testimonials panel in exactly the situations where it can least afford to.
 *
 * The same six are also importable into Firestore (Website > Reviews > Import
 * them) so the admin can edit and delete them. Once imported, the database
 * copy is what renders and this array simply stops being reached; the two
 * never show at the same time.
 */
const seedTestimonials = [
  {
    quote:
      'My 5-year-old keeps asking for story time now. We found books that speak to her faith in a gentle, joyful way.',
    name: 'Amina M.',
    role: 'Parent of a kindergartener'
  },
  {
    quote:
      'Our 4th graders were captivated by the biographies and activity kits. The fair felt thoughtful and well curated.',
    name: 'Mr. Hassan',
    role: 'Elementary School Librarian'
  },
  {
    quote:
      'I love the puzzles and the stories. The heroes are brave and kind. I read to my little brother too.',
    name: 'Zara, 9',
    role: 'Young Reader'
  },
  {
    quote:
      'As a teen, I wanted books that felt like real life. The selections here are thoughtful and inspiring.',
    name: 'Khalid, 14',
    role: 'Middle School Student'
  },
  {
    quote:
      'The Arabic flashcards and seerah sets made our homeschooling routine smoother and more meaningful.',
    name: 'Sana R.',
    role: 'Homeschooling Parent'
  },
  {
    quote:
      'I discovered books that helped me feel confident at the masjid and at school. It made a real difference.',
    name: 'Lina, 11',
    role: 'Young Reader'
  }
]

type CatalogItem = {
  id: string
  title: string
  description: string
  category: string[]
  ageCategory: string | string[]
  price: number
  publisher: string
  showPublisher: boolean
  images: string[]
}

const AGE_CATEGORIES: Record<string, { range: string; title: string }> = {
  '0-5': { range: '0-5 years', title: 'Little Imaan Explorers' },
  '6-9': { range: '6-9 years', title: 'Deen Explorers' },
  '10+': { range: '10+ years', title: 'Young Scholars' },
  'Adult': { range: 'Adult', title: 'Wisdom Seekers' }
}

// Short "N+" age label (matches the catalog page). Current keys are 0+/3+/6+/10+/Adult;
// legacy range keys (0-5, 6-9) map to their nearest current label.
function ageTagLabel(age: string): string {
  if (!age) return ''
  const map: Record<string, string> = { '0+': '0+', '3+': '3+', '6+': '6+', '10+': '10+', 'Adult': 'Adult', '0-5': '3+', '6-9': '6+' }
  if (map[age]) return map[age]
  const lower = String(age).match(/\d+/)
  return lower ? `${lower[0]}+` : age
}

// Shuffle array helper
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Reveal-on-scroll: toggles `.is-visible` once an element enters the viewport.
// Pass the returned ref to any element carrying the `reveal`/`reveal-stagger` class.
// `deps` lets the observer re-attach when the element mounts later (e.g. async
// content like the catalog grid) - otherwise the one-time effect would miss it
// and the element would stay at opacity:0 forever.
function useReveal<T extends HTMLElement = HTMLDivElement>(deps: unknown[] = []) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // If it's already visible in the viewport on attach, reveal immediately.
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
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

export default function HomePage({ reviews = [] }: { reviews?: Review[] }) {
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  // Build-time reviews as the starting point, replaced by the live set so a
  // newly approved review reaches the front page without a redeploy.
  const [liveReviews, setLiveReviews] = useState<Review[] | null>(null)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [catalogSlider, setCatalogSlider] = useState<Record<string, number>>({})
  const [expandedItem, setExpandedItem] = useState<CatalogItem | null>(null)
  const [expandedSlider, setExpandedSlider] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Scroll-reveal refs for each major section
  const aboutReveal = useReveal<HTMLDivElement>()
  const catalogReveal = useReveal<HTMLDivElement>([catalogItems.length])
  const catalogGridReveal = useReveal<HTMLDivElement>([catalogItems.length])
  const orderReveal = useReveal<HTMLDivElement>()
  const testimonialReveal = useReveal<HTMLDivElement>()
  const partnersReveal = useReveal<HTMLDivElement>()

  // Approved customer reviews, live. Rules require the query be constrained to
  // approved reviews, so an unconstrained listen would be rejected.
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'reviews'), where('approved', '==', true)),
      (snap) => {
        setLiveReviews(
          publicReviews(
            snap.docs.map((d) => normalizeReview(d.data() as Record<string, unknown>, d.id))
          )
        )
      },
      // Leave the build-time reviews (or the seed copy) showing on failure.
      () => {}
    )
    return () => unsub()
  }, [])

  // Reviews from Firestore always win. The seed copy below is a safety net for
  // exactly one case: nothing approved is readable, whether because the
  // collection is empty or because the read failed. Once the originals have
  // been imported (Website > Reviews > Import them) the database serves them
  // and the array goes dormant, so there is no double-up.
  const realReviews = liveReviews ?? reviews
  const testimonials = realReviews.length
    ? realReviews.map((r) => ({ quote: r.quote, name: r.name, role: r.role, rating: r.rating }))
    : seedTestimonials.map((t) => ({ ...t, rating: 5 }))
  const reviewAverage = averageRating(realReviews)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 4500)
    return () => clearInterval(interval)
  }, [testimonials.length])

  // A shrinking list must not leave the carousel pointing past the end.
  useEffect(() => {
    setActiveTestimonial((i) => (i < testimonials.length ? i : 0))
  }, [testimonials.length])

  // Condense the sticky header once the user scrolls past the hero top
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Lock body scroll while the product modal is open
  useEffect(() => {
    document.body.style.overflow = expandedItem ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [expandedItem])

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
            showPublisher: data.showPublisher !== false,
            images: Array.isArray(data.images) ? data.images : []
          } as CatalogItem
        })
        // Shuffle and take 10 random items for homepage
        const randomItems = shuffleArray(items).slice(0, 10)
        setCatalogItems(randomItems)
      }
    }).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen text-ink">
      <header
        className={`sticky top-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.08)] backdrop-blur-xl'
            : 'border-b border-transparent bg-white/60 backdrop-blur-md'
        }`}
      >
        {/* gradient hairline accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div
          className={`mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-4 transition-all duration-500 ${
            scrolled ? 'py-2' : 'py-3'
          }`}
        >
          <a className="group flex items-center gap-2 sm:gap-3 min-w-0" href="#top" aria-label="Eduvate Kids home">
            <span className="relative flex-shrink-0">
              <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-100" />
              <Image
                src={logo}
                alt="Eduvate Kids logo"
                width={36}
                height={36}
                className={`transition-all duration-500 group-hover:rotate-[6deg] ${
                  scrolled ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-8 w-8 sm:h-10 sm:w-10'
                }`}
              />
            </span>
            <span className="flex flex-col min-w-0 leading-tight">
              <span className="font-display text-base sm:text-lg font-bold truncate">Eduvate Kids</span>
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-primary/70 hidden sm:block">
                Islamic Bookstore
              </span>
            </span>
          </a>

          <nav className="hidden flex-1 items-center justify-center gap-2 md:flex">
            {[
              { label: 'Home', href: '#top', external: false, active: true, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /> },
              { label: 'Catalog', href: '/catalog', external: true, active: false, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
              // Books of differing heights standing on a plank: reads as a
              // shelf at 16px, where the earlier grid of lines did not.
              { label: 'Shelves', href: '/shelves', external: true, active: false, icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M6 5v10M10 7v8M14 4v11M18 8v7" /><path strokeLinecap="round" strokeLinejoin="round" d="M3.5 15.5h17M5 15.5v3.5m14-3.5v3.5" /></> },
              { label: 'Blog', href: '/blog', external: true, active: false, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2zM14 4v6h6M8 13h8M8 17h5" /> },
              { label: 'Freebies', href: '/freebies', external: true, active: false, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /> }
            ].map((item) => {
              const cls = `flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 ${
                item.active
                  ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                  : 'bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5'
              }`
              const inner = (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg>
                  <span>{item.label}</span>
                </>
              )
              return item.external ? (
                <Link key={item.label} href={item.href} className={cls} aria-current={item.active ? 'page' : undefined}>{inner}</Link>
              ) : (
                <a key={item.label} href={item.href} className={cls} aria-current={item.active ? 'page' : undefined}>{inner}</a>
              )
            })}
            <EventNavDropdown />
            {[
              { label: 'Contact', href: '/contact-us', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /> },
              { label: 'FAQs', href: '/faqs', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> }
            ].map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:-translate-y-0.5">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <HeaderCart />
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex md:hidden h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-white/70 text-primaryDark backdrop-blur transition hover:bg-primary/5 active:scale-95"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>
        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="animate-slideDown md:hidden border-t border-primary/10 bg-white/95 backdrop-blur-xl shadow-lg">
            <nav className="mx-auto w-11/12 max-w-6xl flex flex-col py-3 gap-1">
              <a className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-secondary px-4 py-3.5 text-sm font-bold text-white transition active:scale-[0.98]" href="#top" aria-current="page" onClick={() => setMobileMenuOpen(false)}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /></svg>
                Home
              </a>
              <Link className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]" href="/catalog" onClick={() => setMobileMenuOpen(false)}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                Catalog
              </Link>
              <p className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Event</p>
              <Link className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]" href="/summer-reads" onClick={() => setMobileMenuOpen(false)}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                Summer Reads
              </Link>
              <Link className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]" href="/book-event" onClick={() => setMobileMenuOpen(false)}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Book Event
              </Link>
              <Link className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]" href="/contact-us" onClick={() => setMobileMenuOpen(false)}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /></svg>
                Contact
              </Link>
              <Link className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]" href="/faqs" onClick={() => setMobileMenuOpen(false)}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                FAQs
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main id="top">
        <section className="relative overflow-hidden pb-10 pt-24 sm:pb-16 sm:pt-40">
          <div
            className="hero-svg-bg absolute inset-0 z-0"
            style={{
              backgroundImage: `url(${bg2.src})`,
              backgroundSize: '75% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          <div className="pattern-grid absolute inset-0 z-0 opacity-60" />
          <Image
            src={design2}
            alt=""
            width={420}
            height={420}
            className="hero-drift pointer-events-none absolute left-6 top-10 z-10 h-48 w-48 opacity-30 hidden md:block"
          />
          <Image
            src={design2}
            alt=""
            width={520}
            height={520}
            className="hero-drift delay pointer-events-none absolute left-32 top-44 z-10 h-64 w-64 opacity-25 hidden md:block"
          />
          <Image
            src={design2}
            alt=""
            width={600}
            height={600}
            className="hero-drift slow pointer-events-none absolute right-10 top-16 z-10 h-72 w-72 opacity-25 hidden lg:block"
          />
          <Image
            src={design2}
            alt=""
            width={360}
            height={360}
            className="hero-drift delay pointer-events-none absolute right-20 top-64 z-10 h-40 w-40 opacity-30 hidden lg:block"
          />
          <div className="hero-glow pointer-events-none absolute right-[-120px] top-24 z-0 h-72 w-72 rounded-full hidden sm:block" />
          <div className="hero-glow pointer-events-none absolute left-[-140px] top-52 z-0 h-80 w-80 rounded-full hidden sm:block" />
          <div className="relative z-10 mx-auto grid w-11/12 max-w-6xl items-center gap-12 md:grid-cols-2">
            <div className="reveal is-visible">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-accentThree backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accentThree/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accentThree" />
                </span>
                Maryland, USA
              </span>
              <h1 className="mt-4 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
                A leading Muslim bookstore for{' '}
                <span className="gradient-text">families, schools, and communities.</span>
              </h1>
              <p className="mt-3 font-display text-lg font-bold italic text-emerald-700 sm:text-xl">
                Rooted in Faith. Growing in Knowledge.
              </p>
              <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
                Eduvate Kids curates Islamic children&apos;s literature, crafts, and
                learning tools with a modern retail experience. We serve families,
                educators, and community events with thoughtful recommendations,
                reliable inventory, and warm service.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/catalog"
                  className="btn-shine inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(124,58,237,0.4)]"
                >
                  Explore Our Collection
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </div>
              <div className="mt-6 text-sm text-muted">
                Curated Islamic titles · Books, crafts, and puzzles · Events &amp; school fairs
              </div>
            </div>

            <ReadingMattersCard />
          </div>
        </section>

        <section id="about" className="relative py-12 sm:py-20 bg-gradient-to-br from-purple-50 via-white to-pink-50">
          <div
            className="hero-svg-bg absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url(${bg1.src})`,
              backgroundSize: '65% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          {[
            'left-10 top-12 h-24 w-24 opacity-25',
            'right-16 top-16 h-32 w-32 opacity-20',
            'left-1/4 bottom-20 h-20 w-20 opacity-30',
            'right-1/3 bottom-12 h-28 w-28 opacity-25'
          ].map((classes, index) => (
            <Image
              key={`about-design-${index}`}
              src={index % 2 === 0 ? design1 : design2}
              alt=""
              width={160}
              height={160}
              priority={index === 0}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 hidden md:block ${classes}`}
            />
          ))}
          <div ref={aboutReveal} className="reveal relative z-10 mx-auto w-11/12 max-w-6xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
                Our Story &amp; Purpose
              </p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">About Eduvate Kids</h2>
              <p className="mt-3 text-lg text-muted max-w-2xl mx-auto">
                Building the most trusted Islamic bookstore experience in North America,
                rooted in faith, learning, and community.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2 items-start">
              {/* Left Column - About & Journey */}
              <div className="space-y-6">
                <div className="rounded-2xl bg-white p-6 shadow-soft">
                  <h3 className="font-display text-2xl gradient-text">Our Journey</h3>
                  <p className="mt-3 text-muted leading-relaxed">
                    Eduvate Kids began with a passion for Islamic education and grew into
                    a beloved resource for families, educators, and communities. Today we
                    curate stories, crafts, and learning tools that help children connect
                    with faith through joyful discovery.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {[
                      'Curated, age-appropriate Islamic content',
                      'Community partnerships with schools & masajid',
                      'Reliable inventory with seasonal event readiness',
                      'Warm customer service with educational guidance'
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary">✦</span>
                        <span className="text-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 p-4 text-center">
                  <p className="text-sm font-semibold text-primaryDark">
                    Trusted by thousands of families · 400+ curated titles · 50+ events annually
                  </p>
                </div>
              </div>

              {/* Right Column - Mission & Vision (merged) */}
              <div className="animate-float rounded-3xl bg-white p-5 sm:p-7 shadow-soft border-2 border-primary/10">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accentThree">
                  Mission &amp; Vision
                </p>

                {/* Mission */}
                <div className="mt-5 flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-primaryDark">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 5a4 4 0 100 8 4 4 0 000-8zm0 3a1 1 0 100 2 1 1 0 000-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Our Mission</p>
                    <h4 className="mt-1 font-display text-lg sm:text-xl gradient-text">
                      Inspire lifelong faith through stories and learning
                    </h4>
                    <p className="mt-2 text-sm text-muted leading-relaxed">
                      We provide high-quality Islamic books, activities, and gifts that nurture
                      identity, curiosity, and love of knowledge in children and families.
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="my-5 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />

                {/* Vision */}
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 text-secondary">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Our Vision</p>
                    <h4 className="mt-1 font-display text-lg sm:text-xl gradient-text">
                      A connected community of readers, learners, and leaders
                    </h4>
                    <p className="mt-2 text-sm text-muted leading-relaxed">
                      We partner with schools, masajid, and families to make faith-centered
                      learning accessible, engaging, and joyful everywhere.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 p-4 sm:p-6 text-center">
              <p className="text-xs sm:text-sm font-semibold text-primaryDark">
                Faith-Centered · Knowledge-Driven · Community-Focused · Growth-Oriented
              </p>
            </div>
          </div>
        </section>

        {/* Why choose us — plain, factual statements of what makes the shop
            different. Written as full sentences on purpose: this is the section
            search engines and AI assistants quote when someone asks for the
            "best Islamic bookstore for families". */}
        <section id="why-eduvate-kids" className="relative py-12 sm:py-20 bg-cream/40">
          <div className="mx-auto w-11/12 max-w-6xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
                Why Eduvate Kids
              </p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">
                What makes us different
              </h2>
              <p className="mx-auto mt-4 max-w-3xl text-sm sm:text-base text-muted leading-relaxed">
                Eduvate Kids is a Maryland-based Islamic bookstore serving Muslim families,
                schools and masajid across the United States. We carry over 400 curated Islamic
                titles and run more than 50 school and community events each year. Every book is
                chosen by hand and grouped by reading age, so parents can find something suitable
                without having to vet the whole shelf themselves.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: 'Curated by reading age',
                  body:
                    'Every title is tagged by age group, from board books for toddlers through to titles for teens and adults, so you can shop straight to what fits your child.'
                },
                {
                  title: 'Arabic and English together',
                  body:
                    'We stock Qaidah and Arabic learning kits alongside English-language stories, so children can build both at once.'
                },
                {
                  title: 'School book fairs and events',
                  body:
                    'We bring pop-up shops and book fairs to schools, masajid and community events, and handle bulk and school orders directly.'
                },
                {
                  title: 'Beyond books',
                  body:
                    'Activity books, puzzles, games, cards, crafts and gifts sit alongside the reading list, for children who learn by doing.'
                },
                {
                  title: 'Maryland-based, shipping nationwide',
                  body:
                    'Orders ship from Maryland, USA. Shipping is charged by real weight and distance, and orders over $150 ship free within the United States.'
                },
                {
                  title: 'Reading beyond the sale',
                  body:
                    'Our free Rooted Readers Summer Challenge helps children build a reading habit over the summer, with book logging, milestones and prizes.'
                }
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border-2 border-primary/10 bg-white p-5 shadow-soft"
                >
                  <h3 className="font-display text-lg text-primaryDark">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Product Catalog Section */}
        {catalogItems.length > 0 && (
          <section id="catalog" className="relative py-12 sm:py-20 bg-white">
            <div className="mx-auto w-11/12 max-w-6xl">
              <div ref={catalogReveal} className="reveal text-center mb-12">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
                  Catalog
                </p>
                <h2 className="mt-4 font-display text-2xl sm:text-4xl">View Our Collection</h2>
                <p className="mt-3 text-lg text-muted max-w-2xl mx-auto">
                  Discover our handpicked selection of Islamic books, crafts, puzzles, and gifts for all ages.
                </p>
              </div>

              <div ref={catalogGridReveal} className="reveal-stagger grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {catalogItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => { setExpandedItem(item); setExpandedSlider(0) }}
                    className="group card-hover flex flex-col rounded-2xl bg-white shadow-[0_2px_24px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden hover:shadow-[0_16px_48px_rgba(124,58,237,0.16)] hover:-translate-y-1.5 cursor-pointer"
                  >
                    {/* Image (full cover, uncropped) */}
                    <div className="relative aspect-[3/4] bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 overflow-hidden">
                      {item.images.length > 0 ? (
                        <>
                          <div className="relative h-full w-full">
                            {item.images.map((img, imgIdx) => (
                              <img
                                key={imgIdx}
                                src={img}
                                alt={`${item.title} ${imgIdx + 1}`}
                                className={`absolute inset-0 h-full w-full object-contain p-2 transition-all duration-700 ease-out ${
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
                                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/90 shadow-md sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                              </button>
                              <button
                                type="button"
                                aria-label="Next image"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const cur = catalogSlider[item.id] ?? 0
                                  setCatalogSlider((prev) => ({ ...prev, [item.id]: cur === item.images.length - 1 ? 0 : cur + 1 }))
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/90 shadow-md sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                              </button>
                              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-2 py-1">
                                {item.images.map((_, dotIdx) => (
                                  <button
                                    key={dotIdx}
                                    type="button"
                                    aria-label={`Go to image ${dotIdx + 1}`}
                                    onClick={(e) => { e.stopPropagation(); setCatalogSlider((prev) => ({ ...prev, [item.id]: dotIdx })) }}
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      dotIdx === (catalogSlider[item.id] ?? 0)
                                        ? 'w-6 bg-white shadow-sm'
                                        : 'w-2 bg-white/50 hover:bg-white/80'
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
                        {(Array.isArray(item.category) ? item.category : [item.category]).map((cat) => (
                          <span key={cat} className="rounded-full bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-700">
                            {cat}
                          </span>
                        ))}
                        {(Array.isArray(item.ageCategory) ? item.ageCategory : [item.ageCategory]).filter(Boolean).map((age) => (
                          <span
                            key={age}
                            className="rounded-full bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-blue-700"
                            title={AGE_CATEGORIES[age]?.range || age}
                          >
                            {ageTagLabel(age)}
                          </span>
                        ))}
                      </div>
                      <h3 className="font-display text-sm sm:text-base font-bold text-primaryDark leading-snug line-clamp-2 min-h-[2.5rem]">{item.title}</h3>
                      <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-[13px] text-muted leading-relaxed line-clamp-2 min-h-[2rem]">{item.description}</p>
                      <div className="mt-auto pt-2 sm:pt-4 flex items-center justify-between gap-1">
                        <span className="text-base sm:text-xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">${item.price.toFixed(2)}</span>
                        {item.showPublisher && item.publisher && (
                          <span className="text-[9px] sm:text-[11px] font-semibold text-purple-600 bg-purple-50 rounded-full px-1.5 sm:px-2.5 py-0.5 border border-purple-200/60 max-w-[80px] sm:max-w-[120px] truncate hidden sm:inline">
                            {item.publisher}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* View All Products Button */}
              <div className="mt-10 text-center">
                <a
                  href="/catalog"
                  className="btn-shine group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3.5 font-display text-sm font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(124,58,237,0.4)]"
                >
                  View All Products
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </a>
              </div>
            </div>
          </section>
        )}

        <section className="relative py-12 sm:py-20 bg-gradient-to-br from-emerald-50 via-white to-blue-50">
          <div
            className="hero-svg-bg absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url(${bg1.src})`,
              backgroundSize: '65% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          {[
            'left-10 top-12 h-24 w-24 opacity-25',
            'right-16 top-16 h-32 w-32 opacity-20',
            'left-1/4 bottom-20 h-20 w-20 opacity-30',
            'right-1/3 bottom-12 h-28 w-28 opacity-25'
          ].map((classes, index) => (
            <Image
              key={`catalog-design-${index}`}
              src={design2}
              alt=""
              width={160}
              height={160}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 hidden md:block ${classes}`}
            />
          ))}
          <div ref={orderReveal} className="reveal relative z-10 mx-auto w-11/12 max-w-6xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
                Prefer to Order on WhatsApp?
              </p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">Order via WhatsApp</h2>
              <p className="mt-3 text-lg text-muted max-w-2xl mx-auto">
                Rather chat than check out online? Scan the QR code or tap below to browse our
                complete WhatsApp catalog and place your order directly with us, a simple
                alternative to ordering through the online store.
              </p>
              <p className="mt-4 text-sm text-muted">
                Prefer to order online?{' '}
                <Link href="/catalog" className="font-semibold text-primary underline-offset-2 hover:underline">
                  Shop the online catalog
                </Link>{' '}
                and check out with card.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2 items-center">
              <div className="flex justify-center">
                <div className="animate-float rounded-3xl bg-white p-5 sm:p-8 shadow-soft border-2 border-primary/10">
                  <Image
                    src={catalogQR}
                    alt="Catalog QR Code"
                    width={280}
                    height={280}
                    className="rounded-2xl w-48 h-48 sm:w-[280px] sm:h-[280px] mx-auto"
                  />
                  <p className="mt-4 text-center text-sm font-semibold text-muted">
                    Scan to View/Place your order
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl bg-white p-6 shadow-soft">
                  <h3 className="font-display text-2xl gradient-text">Explore Our Catalog</h3>
                  <p className="mt-3 text-muted">
                    Browse through hundreds of carefully curated titles, from picture books
                    to chapter series, Islamic studies to STEM learning. Find the perfect
                    resource for your family, classroom, or library.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {[
                      'Age-appropriate Islamic literature',
                      'Educational kits and activities',
                      'Arabic learning resources',
                      'Character-building stories'
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary">✦</span>
                        <span className="text-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="https://wa.me/c/16674377777"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 sm:gap-3 rounded-full bg-gradient-to-r from-green-500 to-green-600 px-5 py-3 text-sm sm:px-8 sm:py-4 sm:text-base font-semibold text-white shadow-soft transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <svg className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Place your order via our whatsapp catalog
                </a>

                <div className="rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 p-4 text-center">
                  <p className="text-sm font-semibold text-primaryDark">
                    Updated Weekly · Ready for Events · Gift Wrapping Available
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-12 sm:py-20 bg-gradient-to-br from-amber-50 via-white to-orange-50">
          <div
            className="hero-svg-bg absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url(${bg1.src})`,
              backgroundSize: '65% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          {[
            'left-10 top-12 h-24 w-24 opacity-25',
            'right-16 top-16 h-32 w-32 opacity-20',
            'left-1/4 bottom-20 h-20 w-20 opacity-30',
            'right-1/3 bottom-12 h-28 w-28 opacity-25'
          ].map((classes, index) => (
            <Image
              key={`testimonial-design-${index}`}
              src={index % 2 === 0 ? design1 : design2}
              alt=""
              width={160}
              height={160}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 hidden md:block ${classes}`}
            />
          ))}
          <div ref={testimonialReveal} className="reveal relative z-10 mx-auto w-11/12 max-w-6xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
                Community Love
              </p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">Testimonials</h2>
              <p className="mt-3 text-lg text-muted max-w-2xl mx-auto">
                Trusted by parents, educators, and young readers who see faith and learning
                come together with joy.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2 items-center">
              <div className="space-y-6">
                <div className="animate-float rounded-3xl bg-white p-5 sm:p-8 shadow-soft border-2 border-primary/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accentThree/20 to-primary/20 text-2xl">
                      ⭐
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accentThree">
                      Parent Favorite
                    </p>
                  </div>
                  <p className="text-muted leading-relaxed">
                    "It feels like a boutique with heart. The curation is thoughtful,
                    and the kids are always excited to explore new books!"
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-soft">
                  <h3 className="font-display text-xl gradient-text">Why Families Love Us</h3>
                  <ul className="mt-4 space-y-3 text-sm">
                    {[
                      'Carefully selected Islamic content',
                      'Age-appropriate recommendations',
                      'Engaging learning materials',
                      'Warm, knowledgeable service'
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary">✦</span>
                        <span className="text-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-full">
                  <div className="animate-float rounded-3xl bg-white p-5 sm:p-8 shadow-soft border-2 border-secondary/10">
                    <div className="relative min-h-[220px] sm:min-h-[240px] overflow-hidden">
                      {testimonials.map((testimonial, index) => (
                        <div
                          key={testimonial.name}
                          className={`absolute inset-0 transition-all duration-500 ${
                            index === activeTestimonial
                              ? 'translate-x-0 opacity-100'
                              : 'translate-x-6 opacity-0'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-4xl text-primary/20">"</div>
                            <Stars value={testimonial.rating} />
                          </div>
                          <p className="mt-2 whitespace-pre-line text-muted leading-relaxed italic line-clamp-6">
                            {testimonial.quote}
                          </p>
                          <div className="mt-6 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 font-semibold text-primaryDark">
                              {testimonial.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-primaryDark">{testimonial.name}</div>
                              <div className="text-xs text-muted">{testimonial.role}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 flex items-center justify-between border-t border-black/5 pt-6">
                      <div className="flex gap-2">
                        {testimonials.map((_, index) => (
                          <button
                            key={`dot-${index}`}
                            className={`h-2 w-2 rounded-full transition ${
                              index === activeTestimonial ? 'bg-primary w-6' : 'bg-primary/20'
                            }`}
                            onClick={() => setActiveTestimonial(index)}
                            type="button"
                            aria-label={`Go to testimonial ${index + 1}`}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2 text-xs font-semibold">
                        <button
                          className="rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-primaryDark transition hover:bg-primary/10"
                          onClick={() =>
                            setActiveTestimonial(
                              (activeTestimonial - 1 + testimonials.length) % testimonials.length
                            )
                          }
                          type="button"
                        >
                          Prev
                        </button>
                        <button
                          className="rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-primaryDark transition hover:bg-primary/10"
                          onClick={() =>
                            setActiveTestimonial((activeTestimonial + 1) % testimonials.length)
                          }
                          type="button"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Real aggregate, and the two doors into the review flow. */}
                  <div className="mt-6 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 p-4 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Stars value={reviewAverage || 5} />
                      <p className="text-sm font-semibold text-primaryDark">
                        {realReviews.length
                          ? `Rated ${reviewAverage.toFixed(1)} out of 5 by ${realReviews.length} ${
                              realReviews.length === 1 ? 'customer' : 'customers'
                            }`
                          : 'Rated 5 stars by our community'}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
                      <Link
                        href="/reviews/new"
                        className="rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-2 text-white shadow-soft transition hover:-translate-y-0.5"
                      >
                        Write a review
                      </Link>
                      <Link
                        href="/reviews"
                        className="rounded-full border border-primary/30 px-4 py-2 text-primaryDark transition hover:bg-primary/10"
                      >
                        Read all reviews
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="partners" className="relative bg-gradient-to-b from-white to-purple-50/40 py-16 sm:py-20">
          <div
            className="hero-svg-bg absolute inset-0 opacity-5"
            style={{ backgroundImage: `url(${bg2.src})` }}
          />
          <div className="relative z-10 mx-auto w-11/12 max-w-6xl">
            <div ref={partnersReveal} className="reveal text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
                Trusted Collaborations
              </p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">Our Publishers</h2>
              <p className="mt-3 text-lg text-muted max-w-2xl mx-auto">
                Proud to collaborate with trusted publishers and educators around the world.
              </p>
            </div>
            <div className="partner-slider mt-12 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
              <div className="partner-track">
                {[...partners, ...partners].map((partner, index) => (
                  <a
                    key={`${partner.name}-${index}`}
                    className="partner-card"
                    href={partner.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={partner.name}
                  >
                    <Image
                      src={partner.logo}
                      alt={`${partner.name} logo`}
                      width={220}
                      height={120}
                      className="partner-logo"
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      <SiteFooterFull anchors />

      {/* Expanded catalog item modal */}
      {expandedItem && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
          onClick={() => setExpandedItem(null)}
        >
          <div
            className="relative w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              aria-label="Close"
              onClick={() => setExpandedItem(null)}
              className="absolute right-3 top-3 sm:right-4 sm:top-4 z-10 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/90 shadow-md hover:bg-white transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Image area */}
            <div className="relative aspect-square sm:aspect-[16/9] bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 overflow-hidden rounded-t-3xl">
              {expandedItem.images.length > 0 ? (
                <>
                  <div className="relative h-full w-full">
                    {expandedItem.images.map((img, imgIdx) => (
                      <img
                        key={imgIdx}
                        src={img}
                        alt={`${expandedItem.title} ${imgIdx + 1}`}
                        className={`absolute inset-0 h-full w-full object-contain transition-all duration-700 ease-out ${
                          imgIdx === expandedSlider
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 scale-105'
                        }`}
                      />
                    ))}
                  </div>
                  {expandedItem.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous image"
                        onClick={() => setExpandedSlider(expandedSlider === 0 ? expandedItem.images.length - 1 : expandedSlider - 1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg hover:scale-110 transition-all"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Next image"
                        onClick={() => setExpandedSlider(expandedSlider === expandedItem.images.length - 1 ? 0 : expandedSlider + 1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg hover:scale-110 transition-all"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                        {expandedItem.images.map((_, dotIdx) => (
                          <button
                            key={dotIdx}
                            type="button"
                            aria-label={`Go to image ${dotIdx + 1}`}
                            onClick={() => setExpandedSlider(dotIdx)}
                            className={`h-2 rounded-full transition-all duration-300 ${
                              dotIdx === expandedSlider
                                ? 'w-6 bg-white shadow-sm'
                                : 'w-2 bg-white/50 hover:bg-white/80'
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
            <div className="p-5 sm:p-8">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-3">
                {(Array.isArray(expandedItem.category) ? expandedItem.category : [expandedItem.category]).map((cat) => (
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
                {expandedItem.showPublisher && expandedItem.publisher && (
                  <span className="rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs font-bold text-purple-700">
                    {expandedItem.publisher}
                  </span>
                )}
              </div>
              <h2 className="font-display text-xl sm:text-3xl font-bold text-primaryDark">{expandedItem.title}</h2>
              <p className="mt-2 sm:mt-3 text-sm sm:text-base text-muted leading-relaxed">{expandedItem.description}</p>
              <div className="mt-4 sm:mt-6 flex items-center gap-4">
                <span className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  ${expandedItem.price.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
