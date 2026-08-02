/**
 * Product URL slugs.
 *
 * Lives in its own module because both the build-time page generator and
 * client components need it, and lib/catalogBuild.ts is server-only (it reads
 * Firestore over REST at build time and must never reach the browser bundle).
 *
 * A product has exactly one canonical URL: /book/<slug>. The older
 * /catalog?product=<id> links redirect to it.
 */
export function slugify(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** The canonical path for a product, given its title. */
export const bookPath = (title: string) => `/book/${slugify(title)}`
