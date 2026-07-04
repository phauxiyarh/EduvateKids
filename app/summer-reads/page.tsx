'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
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
  { name: 'Seedling', books: 3, color: 'from-emerald-400 to-green-500', ring: 'text-emerald-500' },
  { name: 'Reader', books: 6, color: 'from-primary to-accentThree', ring: 'text-primary' },
  { name: 'Scholar', books: 10, color: 'from-secondary to-primary', ring: 'text-secondary' },
]

export default function SummerReadsPage() {
  const stepsReveal = useReveal<HTMLDivElement>()
  const tiersReveal = useReveal<HTMLDivElement>()
  const prizeReveal = useReveal<HTMLDivElement>()

  return (
    <div className="min-h-screen text-ink">
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
            <Link href="/" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:-translate-y-0.5">Home</Link>
            <Link href="/summer-reads/register" className="btn-shine flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5">Register</Link>
            <Link href="/summer-reads/log" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:-translate-y-0.5">Log a Book</Link>
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
              June 15 – August 31, 2026
            </span>
            <h1 className="mt-4 font-display text-3xl sm:text-5xl leading-tight">
              Eduvate Kids <span className="gradient-text">Summer Reads</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
              A joyful summer reading challenge for ages 5–14. Read Islamic and Arabic books,
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
                  <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${t.color} text-white shadow-lg`}>
                    <span className="font-display text-2xl font-bold">{t.books}</span>
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
                {['Grand Prize: a special Eduvate Kids gift bundle', 'Two runner-up prizes', 'A certificate for every milestone reached'].map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span className="text-muted">{p}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted">All Scholars (10 books) are entered into the grand prize drawing. Winners announced after the program.</p>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-purple-50 to-pink-50 p-6 sm:p-8 shadow-soft border border-primary/10">
              <h3 className="font-display text-2xl gradient-text">Eligible Books</h3>
              <ul className="mt-4 space-y-3 text-sm">
                {['Islamic stories & picture books', 'Prophets & Companions', "Qur'an & Tafsir for children", 'Arabic readers & Islamic history'].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="text-primary">✦</span>
                    <span className="text-muted">{b}</span>
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
              <Link href="/catalog" className="transition-colors hover:text-white">Our Products</Link>
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
