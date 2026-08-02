'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { trackPageView } from '../../lib/analytics'
import { CONSENT_EVENT } from '../../lib/consent'

/**
 * Reports a page view on every route change.
 *
 * Next navigates on the client, so without this GA4 only ever records the
 * first page a visitor lands on and every subsequent page is invisible. The
 * call itself is a no-op until cookies are accepted.
 */
function Tracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const query = searchParams?.toString()
    trackPageView(query ? `${pathname}?${query}` : pathname, document.title)
  }, [pathname, searchParams])

  // Accepting cookies mid-session should not lose the page the visitor is
  // already on: record it once analytics comes online.
  useEffect(() => {
    const onConsent = (event: Event) => {
      const choice = (event as CustomEvent<string>).detail
      if (choice !== 'accepted') return
      // enableAnalytics resolves isSupported() asynchronously, so give it a
      // moment before the first event rather than firing into undefined.
      const id = setTimeout(() => trackPageView(window.location.pathname, document.title), 600)
      return () => clearTimeout(id)
    }
    window.addEventListener(CONSENT_EVENT, onConsent)
    return () => window.removeEventListener(CONSENT_EVENT, onConsent)
  }, [])

  return null
}

/**
 * useSearchParams needs a Suspense boundary for the static export build,
 * otherwise every page using this becomes dynamic and `output: export` fails.
 */
export function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  )
}
