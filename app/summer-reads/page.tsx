'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { EventNavDropdown } from '../components/EventNavDropdown'
import logo from '../../assets/logo.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'
import bg1 from '../../assets/bg1.png'

function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { el.classList.add('is-visible'); return }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target) } }),
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

const steps = [
  { title: 'Register your child', text: 'Sign up in a minute and receive a unique reading code.', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { title: 'Choose great books', text: 'Pick Islamic stories, prophets & companions, Arabic readers, and more.', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { title: 'Log each book', text: 'Enter your code and log every book your child finishes (parent-verified).', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { title: 'Earn certificates', text: 'Reach milestones to unlock Seedling, Reader, and Scholar certificates.', icon: 'M8 21h8m-4-4v4m5-16v3a5 5 0 01-10 0V5a1 1 0 011-1h8a1 1 0 011 1zm0 0h3a2 2 0 01-2 4m-12-4H4a2 2 0 002 4' },
]

const tiers = [
  { name: 'Seedling', books: 3, color: 'from-emerald-400 to-green-500', ring: 'from-emerald-300 via-emerald-500 to-green-600' },
  { name: 'Reader', books: 6, color: 'from-primary to-accentThree', ring: 'from-violet-400 via-primary to-fuchsia-500' },
  { name: 'Scholar', books: 10, color: 'from-secondary to-primary', ring: 'from-pink-400 via-secondary to-primary' },
]

const prizes = [
  {
    text: 'Grand Prize: a special Eduvate Kids gift bundle',
    tile: 'from-amber-400 to-orange-500',
    icon: (
      // Trophy
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10v5a5 5 0 01-10 0V4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 6H4.5A1.5 1.5 0 003 7.5V8a4 4 0 004 4M17 6h2.5A1.5 1.5 0 0121 7.5V8a4 4 0 01-4 4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v3m-3 3h6m-5 0a1 1 0 011-1h2a1 1 0 011 1" />
      </svg>
    ),
  },
  {
    text: 'Two runner-up prizes',
    tile: 'from-secondary to-pink-600',
    icon: (
      // Medal with ribbon
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3l2.5 5M16 3l-2.5 5" />
        <circle cx="12" cy="15" r="5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 13l.9 1.8 2 .3-1.45 1.4.34 2L12 17.6l-1.79.9.34-2L9.1 15.1l2-.3.9-1.8z" />
      </svg>
    ),
  },
  {
    text: 'A certificate for every milestone reached',
    tile: 'from-primary to-violet-600',
    icon: (
      // Certificate / scroll with award seal
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h9l3 3v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v3h3M7 8h6M7 11h4" />
        <circle cx="15" cy="17" r="2.6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.4 19l-.9 2.4 2.5-1.2 2.5 1.2-.9-2.4" />
      </svg>
    ),
  },
]

const eligibleBooks = [
  {
    text: 'Islamic stories & picture books',
    tile: 'from-primary to-violet-600',
    icon: (
      // Open book
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.6 5.5 8.7 5 7 5c-1.3 0-2.6.3-3.7.8v11.4C4.4 16.7 5.7 16.5 7 16.5c1.7 0 3.6.5 5 1.5 1.4-1 3.3-1.5 5-1.5 1.3 0 2.6.2 3.7.7V5.8C19.6 5.3 18.3 5 17 5c-1.7 0-3.6.5-5 1.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5V18" />
      </svg>
    ),
  },
  {
    text: 'Prophets & Companions',
    tile: 'from-emerald-400 to-green-600',
    icon: (
      // Mosque
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c1.8 1.6 3 3.3 3 5 0 1.7-1.3 2.7-3 2.7S9 9.7 9 8c0-1.7 1.2-3.4 3-5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 21v-6a2 2 0 012-2h10a2 2 0 012 2v6M5 21h14M4 21V11m16 10V11M4 11c.8-.6 1.3-1.4 1.3-2.3M20 11c-.8-.6-1.3-1.4-1.3-2.3M10 21v-2.5a2 2 0 014 0V21" />
      </svg>
    ),
  },
  {
    text: "Qur'an & Tafsir for children",
    tile: 'from-amber-400 to-orange-500',
    icon: (
      // Scroll
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 5a2 2 0 012-2h9a2 2 0 012 2v11a3 3 0 01-3 3H8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 19a3 3 0 01-3-3V5M6 5a2 2 0 00-2 2 2 2 0 002 2h2V5M9 8h6M9 11h6" />
      </svg>
    ),
  },
  {
    text: 'Arabic readers & Islamic history',
    tile: 'from-secondary to-pink-600',
    icon: (
      // Scholar cap / globe
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l9 4-9 4-9-4 9-4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8v5M7 10.2V15c0 1.1 2.2 2.5 5 2.5s5-1.4 5-2.5v-4.8" />
      </svg>
    ),
  },
]

export default function SummerReadsPage() {
  const stepsReveal = useReveal<HTMLDivElement>()
  const tiersReveal = useReveal<HTMLDivElement>()
  const prizeReveal = useReveal<HTMLDivElement>()

  return (
    <div className="min-h-screen text-ink">
      <style jsx global>{`
        @keyframes ring-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes tier-glow {
          0%, 100% { opacity: 0.75; filter: blur(6px); }
          50% { opacity: 1; filter: blur(10px); }
        }
        .tier-ring::before,
        .tier-ring::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: conic-gradient(
            from 0deg,
            rgba(255, 255, 255, 0) 0deg,
            rgba(255, 255, 255, 0.95) 70deg,
            rgba(255, 255, 255, 0) 150deg,
            rgba(255, 255, 255, 0) 360deg
          );
          animation: ring-spin 4s linear infinite;
        }
        /* Mask the spinning highlight into a thin ring shape */
        .tier-ring::before {
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px));
        }
        /* Soft outer glow that pulses in sync */
        .tier-ring::after {
          animation: ring-spin 4s linear infinite, tier-glow 4s ease-in-out infinite;
          opacity: 0.7;
        }
      `}</style>
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)] backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-3 py-3">
          <Link className="group flex items-center gap-2 sm:gap-3 min-w-0" href="/">
            <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 transition-transform duration-500 group-hover:rotate-6" />
            <span className="flex flex-col min-w-0 leading-tight">
              <span className="font-display text-base sm:text-lg font-bold truncate">Eduvate Kids</span>
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-primary/70 hidden sm:block">Summer Reads 2026</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            <Link href="/" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:-translate-y-0.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /></svg>
              <span>Home</span>
            </Link>
            <Link href="/catalog" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:-translate-y-0.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <span>Our Catalogue</span>
            </Link>
            <EventNavDropdown active />
            <Link href="/contact-us" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:-translate-y-0.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /></svg>
              <span>Contact</span>
            </Link>
            <Link href="/faqs" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:-translate-y-0.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>FAQs</span>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16 sm:pt-24 bg-gradient-to-br from-purple-50 via-white to-emerald-50">
          <div className="hero-svg-bg absolute inset-0 z-0 opacity-15" style={{ backgroundImage: `url(${bg1.src})`, backgroundSize: '70% auto', backgroundRepeat: 'repeat' }} />
          {['left-10 top-16 h-24 w-24 opacity-25', 'right-16 top-24 h-32 w-32 opacity-20', 'left-1/4 bottom-10 h-20 w-20 opacity-25'].map((c, i) => (
            <Image key={i} src={i % 2 === 0 ? design1 : design2} alt="" width={160} height={160} className={`hero-drift ${i % 2 ? 'delay' : ''} pointer-events-none absolute z-0 hidden md:block ${c}`} />
          ))}
          <div className="reveal is-visible relative z-10 mx-auto w-11/12 max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-accentThree backdrop-blur">
              June 15 - August 31, 2026
            </span>
            <h1 className="mt-4 font-display text-3xl sm:text-5xl leading-tight">
              Eduvate Kids <span className="gradient-text">Summer Reads</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
              A joyful summer reading challenge for ages 5-14. Read Islamic and Arabic books,
              log your progress, and earn certificates as you climb from Seedling to Scholar.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/summer-reads/register" className="btn-shine inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.3)] transition-all duration-300 hover:-translate-y-0.5">
                Register Your Child
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/summer-reads/log" className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white/70 px-6 py-3.5 text-sm font-semibold text-primaryDark backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40">
                Log a Book
              </Link>
              <Link href="/catalog" className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white/70 px-6 py-3.5 text-sm font-semibold text-primaryDark backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40">
                Browse Books
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="relative py-14 sm:py-20 bg-white">
          <div ref={stepsReveal} className="reveal mx-auto w-11/12 max-w-6xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">How It Works</p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">Four simple steps</h2>
            </div>
            <div className="reveal-stagger mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <div key={s.title} className="card-hover rounded-3xl bg-gradient-to-br from-white to-purple-50/40 p-6 shadow-soft border border-primary/10 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(124,58,237,0.14)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primaryDark">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={s.icon} /></svg>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primaryDark">{i + 1}</span>
                    <h3 className="font-display text-lg font-bold text-primaryDark">{s.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tiers */}
        <section className="relative py-14 sm:py-20 bg-gradient-to-br from-emerald-50 via-white to-purple-50">
          <div ref={tiersReveal} className="reveal mx-auto w-11/12 max-w-5xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Milestones</p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">Climb the reading tiers</h2>
              <p className="mt-3 text-muted">Every tier earns a certificate. Reach Scholar to enter the grand prize drawing.</p>
            </div>
            <div className="reveal-stagger mt-10 grid gap-6 sm:grid-cols-3">
              {tiers.map((t) => (
                <div key={t.name} className="card-hover rounded-3xl bg-white p-6 text-center shadow-soft border border-primary/10 hover:-translate-y-1.5">
                  {/* Animated glowing conic-gradient ring wrapping a 3D coin */}
                  <div className="relative mx-auto h-24 w-24">
                    <div className={`tier-ring absolute inset-0 rounded-full bg-gradient-to-br ${t.ring}`} aria-hidden="true" />
                    <div className={`tier-coin absolute inset-[6px] flex items-center justify-center rounded-full bg-gradient-to-br ${t.color} text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]`}>
                      {/* Top highlight to read as a 3D sphere */}
                      <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(120%_90%_at_30%_22%,rgba(255,255,255,0.6),rgba(255,255,255,0)_55%)]" aria-hidden="true" />
                      {/* Bottom inner shading */}
                      <span className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_-8px_16px_rgba(0,0,0,0.22),inset_0_6px_10px_rgba(255,255,255,0.28)]" aria-hidden="true" />
                      <span className="relative font-display text-2xl font-bold drop-shadow-sm">{t.books}</span>
                    </div>
                  </div>
                  <h3 className="mt-4 font-display text-xl gradient-text">{t.name}</h3>
                  <p className="mt-1 text-sm text-muted">Read {t.books} books</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Prizes + eligible books */}
        <section className="relative py-14 sm:py-20 bg-white">
          <div ref={prizeReveal} className="reveal mx-auto grid w-11/12 max-w-5xl gap-8 md:grid-cols-2">
            <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 p-6 sm:p-8 shadow-soft border border-amber-200/60">
              <h3 className="font-display text-2xl gradient-text">Prizes</h3>
              <ul className="mt-4 space-y-3 text-sm">
                {prizes.map((p) => (
                  <li key={p.text} className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${p.tile} shadow-sm`}>
                      {p.icon}
                    </span>
                    <span className="pt-1.5 text-muted">{p.text}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted">All Scholars (10 books) are entered into the grand prize drawing. Winners announced after the program.</p>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-purple-50 to-pink-50 p-6 sm:p-8 shadow-soft border border-primary/10">
              <h3 className="font-display text-2xl gradient-text">Eligible Books</h3>
              <ul className="mt-4 space-y-3 text-sm">
                {eligibleBooks.map((b) => (
                  <li key={b.text} className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${b.tile} shadow-sm`}>
                      {b.icon}
                    </span>
                    <span className="pt-1.5 text-muted">{b.text}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted">Books should be age-appropriate, fully read, and parent-verified when logged.</p>
              <Link href="/catalog" className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5">
                Browse our books
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Link href="/summer-reads/register" className="btn-shine inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.3)] transition-all duration-300 hover:-translate-y-0.5">
              Register Your Child Now
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] py-10 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="mx-auto w-11/12 max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" className="flex items-center gap-3">
              <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} />
              <span className="font-display text-lg font-bold">Eduvate Kids</span>
            </Link>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/70">
              <Link href="/" className="transition-colors hover:text-white">Home</Link>
              <Link href="/summer-reads/register" className="transition-colors hover:text-white">Register</Link>
              <Link href="/summer-reads/log" className="transition-colors hover:text-white">Log a Book</Link>
              <Link href="/catalog" className="transition-colors hover:text-white">Our Catalogue</Link>
            </div>
          </div>
          <div className="mt-8 flex justify-center">
            <Link href="/auth/login" aria-label="Admin Login" className="group inline-flex items-center justify-center rounded-full p-2 text-white/30 transition-all duration-300 hover:bg-white/5 hover:text-white/80">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.418-3.03 7.79-7 9-3.97-1.21-7-4.582-7-9V7l7-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.75 1.75L15 10" />
              </svg>
            </Link>
          </div>
          <div className="mt-6 border-t border-white/10 pt-6 text-center text-sm text-white/50">
            <p>© 2026 Eduvate Kids. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
