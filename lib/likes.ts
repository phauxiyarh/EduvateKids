'use client'

/**
 * Which blog posts this browser has already liked.
 *
 * A like is one per browser, remembered in localStorage so the heart stays
 * filled on every later visit and a second click does nothing. This is a
 * courtesy rather than a guarantee: clearing site data or switching device
 * allows another like. That is the right trade for a vanity counter that
 * carries no privileges, and the admin can correct the number directly.
 */

const LIKED_KEY = 'eduvate-liked-posts'

export function readLikedSlugs(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(LIKED_KEY) || '[]')
    return Array.isArray(raw) ? raw.map(String) : []
  } catch {
    // Private mode, quota, or corrupt value. Treat as "nothing liked" rather
    // than breaking the page.
    return []
  }
}

export const hasLiked = (slug: string) => readLikedSlugs().includes(slug)

export function rememberLiked(slug: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LIKED_KEY, JSON.stringify([...new Set([...readLikedSlugs(), slug])]))
  } catch {
    /* storage unavailable; the like still registered server-side */
  }
}

export function forgetLiked(slug: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LIKED_KEY, JSON.stringify(readLikedSlugs().filter((s) => s !== slug)))
  } catch {
    /* ignore */
  }
}
