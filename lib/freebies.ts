/**
 * Freebies: downloadable resources gated behind an email subscription.
 *
 * The file itself lives in a Storage folder that is not publicly readable
 * (see storage.rules). `filePath` below is a storage path, never a URL. A
 * visitor who subscribes gets a short-lived signed URL minted server-side by
 * the getFreebieDownload function, so a shared link expires rather than
 * becoming a permanent way around the gate.
 */

export type Freebie = {
  id: string
  title: string
  slug: string
  description: string
  /** Storage path, not a URL. Resolved to a signed URL only after subscribing. */
  filePath: string
  /** Shown on the download button, e.g. "PDF, 2.4 MB". */
  fileLabel: string
  /** Public cover image for the card. */
  coverImage: string
  order: number
  active: boolean
  /** Incremented each time a signed URL is issued. */
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
    filePath: String(data.filePath ?? '').trim(),
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

/** Human-readable size for the button label. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Client-side email check. Deliberately permissive: the server validates too,
 * and rejecting unusual but legitimate addresses loses a subscriber for no
 * security benefit.
 */
export const isPlausibleEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? '').trim())
