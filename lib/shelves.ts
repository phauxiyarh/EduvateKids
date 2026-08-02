/**
 * Shelves: curated groupings of catalog products.
 *
 * A shelf is an editorial collection ("Ramadan Picks", "First Readers") that
 * cuts across the category and age taxonomies. Membership lives on the product
 * (`shelves: string[]`) rather than on the shelf, so a book can sit on several
 * shelves at once and assigning one is a single field edit in the catalog form.
 *
 * Shelves themselves are documents in `shelves`, managed from Settings, so new
 * ones can be created without a deploy.
 */

export type Shelf = {
  id: string
  /** Display name, e.g. "Ramadan Picks". */
  name: string
  /** URL segment, derived from the name and stable once created. */
  slug: string
  /** Optional one-line blurb shown under the shelf heading. */
  description: string
  /** Controls left-to-right order on the shelves page; lower comes first. */
  order: number
  /** Hidden shelves stay in the admin list but do not render on the site. */
  active: boolean
  createdAt: string
}

/** Shape used by the storefront once products have been attached. */
export type ShelfWithBooks = Shelf & {
  books: Array<{
    id: string
    slug: string
    title: string
    /** This book's own covers, used for the hover slideshow. May be empty. */
    images: string[]
    price: number
  }>
}

export function shelfSlug(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Normalise a Firestore shelf doc, tolerating partially written records. */
export function normalizeShelf(data: Record<string, unknown>, id: string): Shelf {
  const name = String(data.name ?? '').trim()
  return {
    id,
    name,
    slug: String(data.slug ?? '').trim() || shelfSlug(name),
    description: String(data.description ?? '').trim(),
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 0,
    // Only an explicit false hides a shelf; older docs without the field stay visible.
    active: data.active !== false,
    createdAt: String(data.createdAt ?? '')
  }
}

/** Sort by explicit order, then name, so the page is stable between builds. */
export const sortShelves = (a: Shelf, b: Shelf) =>
  a.order - b.order || a.name.localeCompare(b.name)
