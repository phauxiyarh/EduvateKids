'use client'

import Image from 'next/image'
import Link from 'next/link'
import { EventNavDropdown } from './EventNavDropdown'
import { HeaderCart } from './HeaderCart'
import logo from '../../assets/logo.png'

/**
 * Shared header and footer for the newer pages.
 *
 * The original pages each carry their own copy of this markup, which is why
 * adding one nav link meant editing eight files. New pages use this instead;
 * the older ones can migrate when they are next touched.
 */

const NAV = [
  { label: 'Home', href: '/', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10' },
  {
    label: 'Catalog',
    href: '/catalog',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
  },
  { label: 'Shelves', href: '/shelves', icon: 'M6 5v10M10 7v8M14 4v11M18 8v7M3.5 15.5h17M5 15.5v3.5m14-3.5v3.5' },
  { label: 'Blog', href: '/blog', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2zM14 4v6h6M8 13h8M8 17h5' },
  { label: 'Freebies', href: '/freebies', icon: 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z' }
]

export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)]">
      <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-xl" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-3 sm:gap-6 py-3">
        <Link className="group flex items-center gap-2 sm:gap-3 min-w-0" href="/">
          <Image
            src={logo}
            alt="Eduvate Kids logo"
            width={36}
            height={36}
            className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 transition-transform duration-500 group-hover:rotate-6"
          />
          <span className="flex flex-col min-w-0 leading-tight">
            <span className="font-display text-base sm:text-lg font-bold truncate">Eduvate Kids</span>
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-primary/70 hidden sm:block">
              Islamic Bookstore
            </span>
          </span>
        </Link>

        <nav className="hidden flex-1 justify-center items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = item.href === current
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-bold transition-all duration-300 ${
                  active
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                    : 'bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            )
          })}
          <EventNavDropdown />
        </nav>

        <div className="flex items-center gap-2">
          <HeaderCart />
        </div>
      </div>

      {/* Below the desktop breakpoint the full nav does not fit; show a
          scrollable strip rather than hiding navigation entirely. */}
      <div className="lg:hidden border-t border-primary/10 bg-white/70">
        <div className="mx-auto flex w-11/12 max-w-6xl gap-2 overflow-x-auto py-2 text-xs">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.href === current ? 'page' : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 font-bold transition ${
                item.href === current
                  ? 'bg-gradient-to-r from-primary to-secondary text-white'
                  : 'bg-primary/5 text-primaryDark'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  )
}
