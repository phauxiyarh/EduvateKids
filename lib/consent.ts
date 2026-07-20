/**
 * Cookie / analytics consent, client-side only (this is a static-export site,
 * so there is no server to set cookies). The user's choice is stored in
 * localStorage and gates any non-essential tracking (Firebase Analytics).
 *
 * Categories:
 *  - "necessary" cookies (cart, admin session, saved preferences) are always on
 *    and are NOT covered by this consent, the site can't function without them.
 *  - "analytics" is the only non-essential category and is OFF until the user
 *    opts in.
 */

export type ConsentChoice = 'accepted' | 'rejected'

export const CONSENT_KEY = 'eduvate-cookie-consent'
export const CONSENT_EVENT = 'eduvate-consent-change'

/** Read the stored choice, or null if the visitor hasn't chosen yet. */
export function getConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(CONSENT_KEY)
    return v === 'accepted' || v === 'rejected' ? v : null
  } catch {
    return null
  }
}

/** True only when the visitor has explicitly accepted analytics cookies. */
export function analyticsAllowed(): boolean {
  return getConsent() === 'accepted'
}

/** Persist a choice and notify listeners (banner, analytics gate) in this tab. */
export function setConsent(choice: ConsentChoice): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSENT_KEY, choice)
  } catch {
    /* storage unavailable (private mode), consent simply won't persist */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }))
}
