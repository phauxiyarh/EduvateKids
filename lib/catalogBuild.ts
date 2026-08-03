/**
 * Build-time catalog reader.
 *
 * Runs on the server during `next build` to turn the live `catalog` collection
 * into static product pages. Uses the Firestore REST API with the public
 * project id — the catalog collection is world-readable (see firestore.rules:
 * `match /catalog/{document=**} { allow read: if true }`), so this needs no
 * service-account key and no secret in CI.
 *
 * Never import this from a client component: it is build/server only.
 */

import { slugify } from './slug'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'eduvatekids-store'
const REST_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

export const SITE_URL = 'https://eduvatekids.com'

export type CatalogProduct = {
  id: string
  slug: string
  title: string
  description: string
  category: string[]
  ageCategory: string[]
  price: number
  publisher: string
  showPublisher: boolean
  /**
   * Every image, including inlined base64 data URIs. Used for display, where
   * a data URI renders perfectly well.
   */
  images: string[]
  /**
   * Hosted http(s) images only. Use these for og:image and JSON-LD, which need
   * a URL a crawler can fetch; a data URI there is useless and would bloat the
   * page by hundreds of KB.
   */
  hostedImages: string[]
  stock?: number
  /** Slugs of the shelves this product appears on. Empty is normal. */
  shelves: string[]
}

// ---- Firestore REST value decoding -------------------------------------
type FsValue = Record<string, unknown>

function decode(v: FsValue | undefined): unknown {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) {
    const arr = (v.arrayValue as { values?: FsValue[] })?.values ?? []
    return arr.map((x) => decode(x))
  }
  if ('mapValue' in v) {
    const fields = (v.mapValue as { fields?: Record<string, FsValue> })?.fields ?? {}
    return decodeFields(fields)
  }
  return null
}

function decodeFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(fields)) out[key] = decode(fields[key])
  return out
}

// Imported from lib/slug so the client and the build derive identical slugs.
// Two copies of this function would silently drift and break links.
export { slugify }

/** Append -2, -3… to any repeated slug so every product keeps a unique URL. */
function dedupeSlugs(items: CatalogProduct[]): CatalogProduct[] {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const base = item.slug || item.id
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? item : { ...item, slug: `${base}-${n}` }
  })
}

const toArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).filter(Boolean) : v ? [String(v)] : []

let cached: CatalogProduct[] | null = null

/**
 * Fetch every catalog item. Memoised for the lifetime of the build so
 * generateStaticParams + 241 generateMetadata calls + the sitemap all share
 * one network read rather than hammering Firestore.
 */
export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  if (cached) return cached

  const products: CatalogProduct[] = []
  let pageToken = ''

  try {
    do {
      const url = `${REST_BASE}/catalog?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`
      // Must stay cacheable: `no-store` marks the caller dynamic, which a
      // static export rejects outright.
      //
      // The build logs two "Failed to set Next.js data cache, items over 2MB"
      // warnings here. They are benign — the fetch itself succeeds and all 241
      // pages generate — because catalog rows carry inlined base64 images that
      // push each response past Next's 2MB cache-entry ceiling. Next simply
      // skips caching it. The module-level `cached` below already guarantees a
      // single read per build, so nothing is refetched.
      //
      // Tried and rejected: `mask.fieldPaths` to slim the payload (Firestore
      // then omits the `images` array entirely, losing every product image).
      // The real fix is migrating those base64 images to Storage URLs — 80 of
      // 522 remain inlined.
      const res = await fetch(url, { next: { revalidate: false } })
      if (!res.ok) throw new Error(`Firestore REST ${res.status}: ${await res.text()}`)
      const json = (await res.json()) as {
        documents?: Array<{ name: string; fields?: Record<string, FsValue> }>
        nextPageToken?: string
      }

      for (const doc of json.documents ?? []) {
        const d = decodeFields(doc.fields ?? {})
        const title = String(d.title ?? '').trim()
        if (!title) continue

        products.push({
          id: doc.name.split('/').pop() as string,
          slug: slugify(title),
          title,
          description: String(d.description ?? '').trim(),
          category: toArray(d.category),
          ageCategory: toArray(d.ageCategory),
          price: Number(d.price) || 0,
          publisher: String(d.publisher ?? '').trim(),
          showPublisher: d.showPublisher !== false,
          // Keep every image for display. 25 products store their covers as
          // inlined base64 rather than Storage URLs, and filtering those out
          // here made them render a placeholder despite having artwork.
          images: toArray(d.images),
          hostedImages: toArray(d.images).filter((u) => /^https?:\/\//i.test(u)),
          stock: typeof d.stock === 'number' ? (d.stock as number) : undefined,
          shelves: toArray(d.shelves)
        })
      }
      pageToken = json.nextPageToken ?? ''
    } while (pageToken)
  } catch (error) {
    // A network blip must not produce a silently product-less site. Fail the
    // build loudly instead of deploying 0 product pages over 241 good ones.
    throw new Error(
      `Failed to read the catalog from Firestore at build time. ` +
        `Product pages cannot be generated. Original error: ${(error as Error).message}`
    )
  }

  if (!products.length) {
    throw new Error('Catalog read returned 0 products — refusing to build a product-less site.')
  }

  cached = dedupeSlugs(products)
  return cached
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | undefined> {
  const all = await getCatalogProducts()
  return all.find((p) => p.slug === slug)
}

/**
 * Generic build-time reader for a public collection. Same REST + memoisation
 * approach as the catalog: these collections are world-readable, so no
 * service-account key is needed in CI.
 */
const collectionCache = new Map<string, Array<Record<string, unknown> & { id: string }>>()

export async function getPublicCollection(
  name: string
): Promise<Array<Record<string, unknown> & { id: string }>> {
  const hit = collectionCache.get(name)
  if (hit) return hit

  const out: Array<Record<string, unknown> & { id: string }> = []
  let pageToken = ''
  try {
    do {
      const url = `${REST_BASE}/${name}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`
      const res = await fetch(url, { next: { revalidate: false } })
      // A collection that does not exist yet returns 404. That is a normal
      // state before the first document is created, not a build failure.
      if (res.status === 404) break
      if (!res.ok) throw new Error(`Firestore REST ${res.status}: ${await res.text()}`)
      const json = (await res.json()) as {
        documents?: Array<{ name: string; fields?: Record<string, FsValue> }>
        nextPageToken?: string
      }
      for (const doc of json.documents ?? []) {
        out.push({ id: doc.name.split('/').pop() as string, ...decodeFields(doc.fields ?? {}) })
      }
      pageToken = json.nextPageToken ?? ''
    } while (pageToken)
  } catch (error) {
    // Content collections are additive: an empty blog or shelf list is a valid
    // site. Failing the whole build over one would be worse than shipping
    // without that section, so log and continue.
    console.warn(`[build] could not read "${name}": ${(error as Error).message}`)
    return []
  }

  collectionCache.set(name, out)
  return out
}

/** A tracked stock of 0 or less means out of stock; untracked means available. */
export const isInStock = (p: CatalogProduct) => typeof p.stock !== 'number' || p.stock > 0

/** Trim a description to a clean sentence boundary for meta tags. */
export function metaDescription(p: CatalogProduct, limit = 155): string {
  const base = p.description.replace(/\s+/g, ' ').trim()
  if (!base) {
    return `${p.title}${p.publisher ? ` by ${p.publisher}` : ''} is available from Eduvate Kids.`
  }
  if (base.length <= limit) return base
  const cut = base.slice(0, limit)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  if (lastStop > limit * 0.6) return cut.slice(0, lastStop + 1)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

/**
 * Lower bound in years for an age tag. The catalog mixes two generations of
 * values: the current `N+` keys and legacy ranges (`0-5`, `6-9`) still on 37
 * items. Both must resolve, and 'Adult' sorts last.
 */
function ageLowerBound(tag: string): number {
  const t = tag.trim().toLowerCase()
  if (!t) return Number.POSITIVE_INFINITY
  if (t === 'adult') return 99
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

/** Human-readable age line, e.g. "Ages 3+" or "Adult readers". */
export function ageLabel(p: CatalogProduct): string {
  const tags = p.ageCategory.filter(Boolean)
  if (!tags.length) return ''
  const kids = tags.filter((a) => a.trim().toLowerCase() !== 'adult')
  if (!kids.length) return 'Adult readers'
  const min = Math.min(...kids.map(ageLowerBound))
  return Number.isFinite(min) ? `Ages ${min}+` : ''
}


