'use client'

import { logEvent, setCurrentScreen } from 'firebase/analytics'
import { getAnalyticsInstance } from './firebase'

/**
 * Analytics events.
 *
 * Every call is a no-op unless the visitor has accepted cookies, because
 * getAnalyticsInstance() only returns something once consent is granted. That
 * keeps the consent check in one place rather than repeating it at each call
 * site, and means a forgotten check cannot leak tracking.
 *
 * Failures are swallowed on purpose: an ad blocker or a network error must
 * never break add-to-cart or a download.
 */

type Params = Record<string, string | number | boolean | undefined>

function track(event: string, params?: Params) {
  try {
    const analytics = getAnalyticsInstance()
    if (!analytics) return
    logEvent(analytics, event as string, params)
  } catch {
    /* analytics must never break the feature it is measuring */
  }
}

/**
 * Record a page view. Next routes on the client, so without this GA only ever
 * sees the first page a visitor lands on.
 */
export function trackPageView(path: string, title?: string) {
  try {
    const analytics = getAnalyticsInstance()
    if (!analytics) return
    if (title) setCurrentScreen(analytics, title)
    logEvent(analytics, 'page_view', {
      page_path: path,
      page_location: typeof window !== 'undefined' ? window.location.href : path,
      page_title: title ?? (typeof document !== 'undefined' ? document.title : '')
    })
  } catch {
    /* ignore */
  }
}

// ---- Commerce ------------------------------------------------------------
// Names follow GA4's recommended ecommerce events so the standard reports and
// funnels work without custom configuration.

export const trackViewItem = (item: { id: string; title: string; price: number }) =>
  track('view_item', {
    currency: 'USD',
    value: item.price,
    item_id: item.id,
    item_name: item.title
  })

export const trackAddToCart = (item: { id: string; title: string; price: number; quantity?: number }) =>
  track('add_to_cart', {
    currency: 'USD',
    value: item.price * (item.quantity ?? 1),
    item_id: item.id,
    item_name: item.title,
    quantity: item.quantity ?? 1
  })

export const trackBeginCheckout = (value: number, itemCount: number) =>
  track('begin_checkout', { currency: 'USD', value, item_count: itemCount })

export const trackPurchase = (orderId: string, value: number, itemCount: number) =>
  track('purchase', { transaction_id: orderId, currency: 'USD', value, item_count: itemCount })

// ---- Content -------------------------------------------------------------

export const trackBlogLike = (slug: string, title: string) =>
  track('blog_like', { post_slug: slug, post_title: title })

export const trackFreebieUnlock = (slug: string, title: string, isNewSubscriber: boolean) =>
  track('freebie_unlock', {
    freebie_slug: slug,
    freebie_title: title,
    new_subscriber: isNewSubscriber
  })

/** GA4 has a recommended name for newsletter-style signups. */
export const trackSubscribe = (source: string) => track('generate_lead', { method: source })

export const trackShelfBookClick = (shelf: string, bookSlug: string) =>
  track('select_item', { item_list_name: `shelf:${shelf}`, item_id: bookSlug })

export const trackSearch = (term: string) => track('search', { search_term: term })
