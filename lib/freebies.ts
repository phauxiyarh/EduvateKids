/**
 * Freebies: free resources revealed after an email subscription.
 *
 * The file itself lives on Google Drive, not in our Storage, so the admin
 * uploads nothing here beyond a cover image. That keeps storage costs at zero
 * and lets the admin manage the documents where they already live.
 *
 * A consequence worth being clear about: the gate is a reveal, not an
 * enforcement. Once a visitor has the Drive URL they can share it, and anyone
 * with that link skips the email step. Signed, expiring URLs would prevent
 * that, but only for files we host ourselves. For free printables this is the
 * accepted trade.
 */

export type Freebie = {
  id: string
  title: string
  slug: string
  /** Short pitch shown on the card. */
  description: string
  /** Google Drive (or any) share URL, revealed after subscribing. */
  fileUrl: string
  /** e.g. "PDF, 4 pages". Free text, since we never see the file. */
  fileLabel: string
  /** Public cover image for the card. */
  coverImage: string
  order: number
  active: boolean
  /** Incremented each time the link is revealed. */
  downloads: number
  createdAt: string
}

export function freebieSlug(title: string): string {
  return String(title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

export function normalizeFreebie(data: Record<string, unknown>, id: string): Freebie {
  const title = String(data.title ?? '').trim()
  return {
    id,
    title,
    slug: String(data.slug ?? '').trim() || freebieSlug(title),
    description: String(data.description ?? '').trim(),
    fileUrl: String(data.fileUrl ?? '').trim(),
    fileLabel: String(data.fileLabel ?? '').trim(),
    coverImage: String(data.coverImage ?? '').trim(),
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 0,
    active: data.active !== false,
    downloads: Math.max(0, Math.round(Number(data.downloads) || 0)),
    createdAt: String(data.createdAt ?? '')
  }
}

export const sortFreebies = (a: Freebie, b: Freebie) =>
  a.order - b.order || a.title.localeCompare(b.title)

/**
 * Client-side email check. Deliberately permissive: the server validates too,
 * and rejecting unusual but legitimate addresses loses a subscriber for no
 * security benefit.
 */
export const isPlausibleEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? '').trim())

/**
 * Turn a Drive "view" link into one that downloads directly, so the button
 * behaves like a download rather than bouncing through Drive's preview.
 * Anything that is not a recognised Drive URL is returned unchanged.
 */
export function directDownloadUrl(url: string): string {
  const raw = String(url ?? '').trim()
  const fileMatch = raw.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/)
  if (fileMatch) return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`
  const openMatch = raw.match(/drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/)
  if (openMatch) return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`
  return raw
}

/** Basic sanity check so the admin cannot save an obviously broken link. */
export const isUsableUrl = (value: string) => /^https?:\/\/.+/i.test(String(value ?? '').trim())
