'use client'

import Image from 'next/image'
import Link from 'next/link'
import { OPEN_COOKIE_PREFS } from './CookieConsent'
import logo from '../../assets/logo.png'

/**
 * The site footer, shared by every page.
 *
 * This is the homepage footer lifted into a component. It previously existed
 * only there, with each other page carrying its own thinner copy, so the links
 * drifted apart and new sections had to be added in several places.
 *
 * The homepage passes `anchors` so its in-page links (#about, #partners) work;
 * elsewhere those become links back to the homepage section.
 */
export function SiteFooterFull({ anchors = false }: { anchors?: boolean }) {
  const explore = [
    { label: 'Catalog', href: '/catalog' },
    { label: 'Shelves', href: '/shelves' },
    { label: 'Blog', href: '/blog' },
    { label: 'Freebies', href: '/freebies' },
    { label: 'Summer Reads', href: '/summer-reads' }
  ]

  // Reviews live here rather than in the header nav: reading and leaving a
  // review is something a customer seeks out after a purchase, not a primary
  // shopping destination competing with Catalog and Shelves.
  const about = [
    { label: 'About Us', href: anchors ? '#about' : '/#about', anchor: true },
    { label: 'Publishers', href: anchors ? '#partners' : '/#partners', anchor: true },
    { label: 'Book an Event', href: '/book-event', anchor: false },
    { label: 'Contact Us', href: '/contact-us', anchor: false },
    { label: 'Customer Reviews', href: '/reviews', anchor: false },
    { label: 'Write a Review', href: '/reviews/new', anchor: false },
    { label: 'FAQs', href: '/faqs', anchor: false }
  ]

  const linkClass =
    'group flex items-center gap-2 rounded-lg py-1.5 text-white/70 transition-colors duration-200 hover:text-white'
  const dot = (colour: string) =>
    `h-1 w-1 rounded-full ${colour} opacity-0 transition-opacity duration-200 group-hover:opacity-100`

  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] pt-12 pb-10 sm:pt-16 text-white">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]">
        <div className="pulse-glow absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary blur-3xl" />
        <div
          className="pulse-glow absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-secondary blur-3xl"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div className="relative z-10 mx-auto w-11/12 max-w-6xl">
        <div className="grid gap-8 sm:gap-12 grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} className="drop-shadow-lg" />
              <div>
                <h3 className="font-display text-xl font-bold">Eduvate Kids</h3>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Islamic Bookstore</p>
              </div>
            </div>
            <p className="mt-3 font-display text-sm font-semibold italic text-emerald-300">
              Rooted in Faith. Growing in Knowledge.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Curating Islamic children&apos;s literature and learning tools for families, educators,
              and communities.
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href="https://wa.me/c/16674377777"
                target="_blank"
                rel="noreferrer"
                className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-green-400/40 hover:bg-green-500"
                aria-label="WhatsApp"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/eduvatekids?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
                target="_blank"
                rel="noreferrer"
                className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-pink-400/40 hover:bg-gradient-to-br hover:from-fuchsia-500 hover:to-orange-400"
                aria-label="Instagram"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <span
                className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/5 bg-white/5 backdrop-blur opacity-40"
                aria-label="TikTok (Coming Soon)"
                title="Coming Soon"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </span>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-white/50">Shop</h4>
            <div className="mt-4 space-y-1 text-sm">
              {explore.map((l) => (
                <Link key={l.label} href={l.href} className={linkClass}>
                  <span className={dot('bg-primary')} />
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5">{l.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* About */}
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-white/50">About</h4>
            <div className="mt-4 space-y-1 text-sm">
              {about.map((l) =>
                l.anchor ? (
                  <a key={l.label} href={l.href} className={linkClass}>
                    <span className={dot('bg-secondary')} />
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5">{l.label}</span>
                  </a>
                ) : (
                  <Link key={l.label} href={l.href} className={linkClass}>
                    <span className={dot('bg-secondary')} />
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5">{l.label}</span>
                  </Link>
                )
              )}
            </div>
          </div>

          {/* Location + event CTA */}
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-white/50">Location</h4>
            <div className="mt-4 space-y-3 text-sm text-white/70">
              <p className="flex items-center gap-2">
                <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Maryland, USA</span>
              </p>
              <Link
                href="/book-event"
                className="group mt-4 block rounded-2xl border border-accentThree/30 bg-gradient-to-r from-accentThree/20 to-primary/20 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-accentThree/50 hover:from-accentThree/30 hover:to-primary/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                      <svg className="h-4 w-4 text-accentThree" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      Book an Event
                    </p>
                    <p className="mt-1 text-xs text-white/70">School fairs, masjid events &amp; more</p>
                  </div>
                  <svg className="h-5 w-5 flex-shrink-0 text-white/70 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/50">
            <p>&copy; 2026 Eduvate Kids. All rights reserved.</p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link href="/policies" className="transition-colors duration-200 hover:text-white">Privacy Policy</Link>
              <Link href="/policies" className="transition-colors duration-200 hover:text-white">Terms of Service</Link>
              <Link href="/faqs" className="transition-colors duration-200 hover:text-white">Help Center</Link>
              <Link href="/accessibility" className="transition-colors duration-200 hover:text-white">Accessibility</Link>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_COOKIE_PREFS))
                }}
                className="transition-colors duration-200 hover:text-white"
              >
                Cookie Preferences
              </button>
              <Link href="/auth/login" className="transition-colors duration-200 hover:text-white">Staff Login</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
