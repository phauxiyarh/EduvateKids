/**
 * Admin backend host allow-list.
 *
 * The admin login + dashboard must only be usable from the canonical host
 * (eduvatekids-store.web.app), plus localhost for development. This is a
 * client-side guard for defense-in-depth. The AUTHORITATIVE control is Firebase
 * Authentication "Authorized domains" (Console -> Authentication -> Settings):
 * remove any domain (e.g. eduvatekids.com) you don't want sign-in to work from.
 */
export const ADMIN_ALLOWED_HOSTS = [
  'eduvatekids-store.web.app',
  'eduvatekids-store.firebaseapp.com', // Firebase's default paired domain
  'localhost',
  '127.0.0.1',
]

/** True if the current browser host is allowed to use the admin backend. */
export function isAdminHostAllowed(): boolean {
  if (typeof window === 'undefined') return true // SSR/build: don't block prerender
  return ADMIN_ALLOWED_HOSTS.includes(window.location.hostname)
}
