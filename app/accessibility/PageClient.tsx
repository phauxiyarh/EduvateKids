'use client'

import Image from 'next/image'
import Link from 'next/link'
import { EventNavDropdown } from '../components/EventNavDropdown'
import { HeaderCart } from '../components/HeaderCart'
import { OPEN_COOKIE_PREFS } from '../components/CookieConsent'
import logo from '../../assets/logo.png'
import { SiteFooterFull } from '../components/SiteFooterFull'
import { SiteHeader } from '../components/SiteChrome'

const openCookiePrefs = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_COOKIE_PREFS))
}

const sections = [
  {
    title: 'Our commitment',
    body: [
      'Eduvate Kids is committed to making our website usable by everyone, including people with disabilities. We want every family, educator, and community member to be able to find, read, and use our content and services.',
      'We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1, Level AA, published by the World Wide Web Consortium (W3C). These guidelines explain how to make web content more accessible for people with a wide range of disabilities, and they are the standard referenced by Maryland State and federal accessibility requirements.',
    ],
  },
  {
    title: 'What we do',
    list: [
      'Use semantic HTML and page landmarks so screen readers can navigate the site.',
      'Provide text alternatives for meaningful images and icons.',
      'Support keyboard-only navigation, with a visible focus indicator and a “skip to main content” link.',
      'Respect the “reduce motion” setting on your device for our animations.',
      'Aim for sufficient color contrast between text and its background.',
      'Design layouts that adapt to zoom and to small screens.',
    ],
  },
  {
    title: 'Ongoing effort',
    body: [
      'Accessibility is an ongoing process. We review new pages and features for accessibility and work to fix issues as we find them. Some third-party content or older material may not yet fully meet our target, we are actively working to improve these areas.',
    ],
  },
]

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      <SiteHeader />

      <main id="main" className="mx-auto w-11/12 max-w-3xl py-12 sm:py-16">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Accessibility</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">Accessibility Statement</h1>
          <p className="mt-3 text-sm text-muted">We want everyone to be able to use Eduvate Kids. Here&apos;s how we work toward that.</p>
        </div>

        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.title} className="rounded-3xl border border-primary/10 bg-white p-6 shadow-soft sm:p-8">
              <h2 className="font-display text-xl text-primaryDark">{s.title}</h2>
              {s.body?.map((p, i) => (
                <p key={i} className="mt-3 text-sm leading-relaxed text-muted">{p}</p>
              ))}
              {s.list && (
                <ul className="mt-3 space-y-2">
                  {s.list.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-muted">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {/* Accommodation request + feedback */}
          <section className="rounded-3xl border border-primary/15 bg-gradient-to-br from-emerald-50 to-purple-50 p-6 shadow-soft sm:p-8">
            <h2 className="font-display text-xl text-primaryDark">Request an accommodation or report a problem</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              If you have trouble accessing any part of this site, or you need information in a different
              format (such as large print or a screen-reader-friendly document), please tell us, we will
              work with you to provide the information or service you need. When you contact us, it helps to
              include the page address, a description of the problem, and the device or assistive technology
              you are using.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href="mailto:info@haleyouthfoundation.org" className="btn-shine inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5">
                Email us
              </a>
              <Link href="/contact-us" className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/25 bg-white px-6 py-3 text-sm font-semibold text-primaryDark transition hover:-translate-y-0.5 hover:border-primary/40">
                Contact form
              </Link>
              <button type="button" onClick={openCookiePrefs} className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-muted transition hover:text-primaryDark">
                Cookie preferences
              </button>
            </div>
            <p className="mt-4 text-xs text-muted">We aim to respond to accessibility requests promptly during business days.</p>
          </section>
        </div>
      </main>

      <SiteFooterFull />
    </div>
  )
}
