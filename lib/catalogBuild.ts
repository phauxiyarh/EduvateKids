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
  /** Only http(s) images — base64 data URIs are unusable in metadata/JSON-LD. */
  images: string[]
  stock?: number
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

/**
 * URL-safe slug from a product title. Verified collision-free across the
 * current 241 items; `dedupeSlugs` below still guards against future clashes.
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
          // Data-URI images are inlined base64 (avg 8KB, some far larger).
          // They cannot be referenced from JSON-LD or og:image, so only real
          // hosted URLs are kept here.
          images: toArray(d.images).filter((u) => /^https?:\/\//i.test(u)),
          stock: typeof d.stock === 'number' ? (d.stock as number) : undefined
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

/**
 * One plain "who this is for" sentence per product.
 *
 * The audit's point: when a parent asks an assistant "what's a good first Quran
 * book for a 6-year-old?", the model needs a quotable sentence that states the
 * audience outright. Age tags rendered as badges do not give it one.
 *
 * Built only from data we actually hold — age tags, category and publisher —
 * so nothing here is invented about a book.
 */
export function audienceLine(p: CatalogProduct): string {
  const tags = p.ageCategory.filter(Boolean)
  const kids = tags.filter((a) => a.trim().toLowerCase() !== 'adult')
  const adultOnly = tags.length > 0 && kids.length === 0

  const cats = p.category.map((c) => c.toLowerCase())
  const isBook = cats.includes('books') || cats.includes('activity books') || !cats.length
  const noun = cats.includes('activity books')
    ? 'activity book'
    : cats.includes('puzzles')
    ? 'puzzle'
    : cats.includes('games')
    ? 'game'
    : cats.includes('cards')
    ? 'card set'
    : cats.includes('crafts')
    ? 'craft'
    : cats.includes('gifts')
    ? 'gift'
    : isBook
    ? 'book'
    : 'item'

  if (adultOnly) {
    return `Best for adult readers and older teens. A ${noun} for parents, teachers and anyone studying the subject themselves.`
  }

  if (!kids.length) {
    // No age data at all (3 items) — stay factual rather than guess a range.
    return `A ${noun} from the Eduvate Kids collection, curated for Muslim families and schools.`
  }

  const min = Math.min(...kids.map(ageLowerBound))
  const spansAdult = tags.length > kids.length

  // Reading-stage wording only makes sense for books. A puzzle or craft gets a
  // neutral age description instead of "beginning to read on their own".
  const readingItem = noun === 'book' || noun === 'activity book'

  const stage = readingItem
    ? min <= 0
      ? 'babies and toddlers just beginning to share books with a grown-up'
      : min <= 3
      ? 'preschoolers and early readers sharing the pages with a grown-up'
      : min <= 6
      ? 'children beginning to read on their own'
      : min <= 10
      ? 'confident independent readers'
      : 'older children and teens reading independently'
    : min <= 3
    ? 'toddlers and preschoolers, with a grown-up alongside'
    : min <= 6
    ? 'younger children, at home or in the classroom'
    : 'older children, at home or in the classroom'

  const tail = spansAdult
    ? ' Also read by adults and used in family and classroom settings.'
    : ''

  return `Best for children ages ${min}+: ${stage}.${tail}`
}
