'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getConsent, setConsent, type ConsentChoice } from '../../lib/consent'
import { enableAnalytics } from '../../lib/firebase'

// A footer "Cookie Preferences" link dispatches this event to re-open the panel.
export const OPEN_COOKIE_PREFS = 'eduvate-open-cookie-prefs'

/**
 * Cookie consent banner + preferences panel. Client-side only (static export).
 * - Necessary cookies (cart, admin session, preferences) are always on.
 * - Analytics is off until the visitor accepts; accepting calls enableAnalytics().
 * The visitor can revisit their choice any time via the footer "Cookie
 * Preferences" link, which opens this panel again.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Show automatically only if no choice has been made yet.
    if (getConsent() === null) setOpen(true)
    const reopen = () => {
      setExpanded(true)
      setOpen(true)
    }
    window.addEventListener(OPEN_COOKIE_PREFS, reopen)
    return () => window.removeEventListener(OPEN_COOKIE_PREFS, reopen)
  }, [])

  const choose = (choice: ConsentChoice) => {
    setConsent(choice)
    if (choice === 'accepted') enableAnalytics()
    setOpen(false)
    setExpanded(false)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-primary/15 bg-white/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-md sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h.01M15 13h.01M10.5 15h.01M14 9.5h.01" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-bold text-ink">We value your privacy</h2>
            <p className="mt-1 text-sm text-muted">
              We use cookies that are necessary for the site to work (such as your shopping cart).
              With your permission, we also use analytics cookies to understand how the site is
              used so we can improve it. You can change your choice any time.{' '}
              <Link href="/policies" className="font-semibold text-primaryDark underline underline-offset-2 hover:text-primary">
                Learn more
              </Link>.
            </p>

            {expanded && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">Strictly necessary</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Always on</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">Required for core features like your cart, sign-in, and saved settings. These cannot be turned off.</p>
                </div>
                <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
                  <p className="text-sm font-semibold text-ink">Analytics</p>
                  <p className="mt-1 text-xs text-muted">Helps us see which pages are popular and how to improve. Off unless you accept.</p>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => choose('accepted')}
                className="btn-shine rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => choose('rejected')}
                className="rounded-full border border-primary/25 bg-white px-5 py-2.5 text-sm font-semibold text-primaryDark transition hover:border-primary/40"
              >
                Reject non-essential
              </button>
              {!expanded && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted transition hover:text-primaryDark sm:ml-auto"
                >
                  Manage preferences
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
