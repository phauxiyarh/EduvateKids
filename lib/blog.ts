/**
 * Blog posts.
 *
 * A post's body is Markdown. The admin can type directly into the editor or
 * paste a whole .md file; both end up in the same field, so a pasted document
 * stays fully editable afterwards rather than becoming an opaque blob.
 *
 * Likes live on the post document. Public visitors increment through a Cloud
 * Function (clients cannot write the field directly), and the admin can set the
 * count outright, so both views read the same number.
 */

export type BlogPost = {
  id: string
  title: string
  slug: string
  /** One-line summary used on cards, in search results and social previews. */
  excerpt: string
  /** Markdown source. Typed in the editor or pasted from a .md file. */
  body: string
  author: string
  /** ISO date. Controls ordering and the displayed date. */
  publishedAt: string
  /** Drafts stay in the admin list but never render publicly. */
  published: boolean
  /** Hosted image URLs. More than one turns the card into an auto slider. */
  images: string[]
  tags: string[]
  likes: number
  createdAt: string
  updatedAt: string
}

export function blogSlug(title: string): string {
  return String(title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

const toArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).filter(Boolean) : v ? [String(v)] : []

/** Normalise a Firestore doc, tolerating partially written records. */
export function normalizeBlogPost(data: Record<string, unknown>, id: string): BlogPost {
  const title = String(data.title ?? '').trim()
  return {
    id,
    title,
    slug: String(data.slug ?? '').trim() || blogSlug(title),
    excerpt: String(data.excerpt ?? '').trim(),
    body: String(data.body ?? ''),
    author: String(data.author ?? 'Eduvate Kids').trim(),
    publishedAt: String(data.publishedAt ?? data.createdAt ?? ''),
    // Only an explicit false hides a post, so older docs without the field stay visible.
    published: data.published !== false,
    images: toArray(data.images).filter((u) => /^https?:\/\//i.test(u)),
    tags: toArray(data.tags),
    likes: Math.max(0, Math.round(Number(data.likes) || 0)),
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? '')
  }
}

/** Newest first. */
export const sortPosts = (a: BlogPost, b: BlogPost) =>
  (b.publishedAt || '').localeCompare(a.publishedAt || '')

/** Rough reading time, at 200 words per minute. */
export function readingMinutes(body: string): number {
  const words = String(body ?? '').trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

/** First paragraph of the body, for when the admin leaves the excerpt blank. */
export function deriveExcerpt(body: string, limit = 180): string {
  const plain = String(body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= limit) return plain
  const cut = plain.slice(0, limit)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

// ---------------------------------------------------------------------------
// Markdown rendering
//
// Deliberately hand-rolled rather than pulling in a parser: the site is a
// static export with no server, the supported subset is small, and shipping a
// full Markdown library to every reader for headings and links is not worth
// the bytes. Everything is escaped before any tag is emitted, so pasted
// content cannot inject HTML.
// ---------------------------------------------------------------------------

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Inline spans: code, images, links, bold, italic. Input must be pre-escaped. */
function renderInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code class="rounded bg-black/5 px-1 py-0.5 text-[0.9em]">$1</code>')
    .replace(
      /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
      '<img src="$2" alt="$1" loading="lazy" class="my-4 w-full rounded-2xl" />'
    )
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
      '<a href="$2" class="font-semibold text-primaryDark underline hover:no-underline">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
}

/**
 * Render a small Markdown subset to HTML: headings, bold, italic, links,
 * images, inline code, fenced code, blockquotes, bullet and numbered lists,
 * horizontal rules and paragraphs.
 */
export function renderMarkdown(md: string): string {
  const source = String(md ?? '').replace(/\r\n/g, '\n')
  const out: string[] = []
  const lines = source.split('\n')

  let inCode = false
  let codeBuffer: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let paragraph: string[] = []

  const closeParagraph = () => {
    if (!paragraph.length) return
    out.push(`<p class="mb-4 leading-relaxed">${renderInline(paragraph.join(' '))}</p>`)
    paragraph = []
  }
  const closeList = () => {
    if (!listType) return
    out.push(`</${listType}>`)
    listType = null
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    // Fenced code blocks pass through verbatim, no inline processing.
    if (/^```/.test(line)) {
      if (inCode) {
        out.push(
          `<pre class="mb-4 overflow-x-auto rounded-2xl bg-[#1f1b2e] p-4 text-sm text-white"><code>${escapeHtml(
            codeBuffer.join('\n')
          )}</code></pre>`
        )
        codeBuffer = []
        inCode = false
      } else {
        closeParagraph()
        closeList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuffer.push(raw)
      continue
    }

    if (!line.trim()) {
      closeParagraph()
      closeList()
      continue
    }

    const safe = escapeHtml(line)

    const heading = safe.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      closeParagraph()
      closeList()
      const level = heading[1].length
      const sizes = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg']
      out.push(
        `<h${level + 1} class="mb-3 mt-8 font-display ${sizes[level - 1]} font-bold text-primaryDark">${renderInline(
          heading[2]
        )}</h${level + 1}>`
      )
      continue
    }

    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      closeParagraph()
      closeList()
      out.push('<hr class="my-8 border-black/10" />')
      continue
    }

    const quote = safe.match(/^&gt;\s?(.*)$/)
    if (quote) {
      closeParagraph()
      closeList()
      out.push(
        `<blockquote class="mb-4 border-l-4 border-primary/40 bg-primary/5 px-4 py-3 italic">${renderInline(
          quote[1]
        )}</blockquote>`
      )
      continue
    }

    const bullet = safe.match(/^[-*+]\s+(.*)$/)
    if (bullet) {
      closeParagraph()
      if (listType !== 'ul') {
        closeList()
        out.push('<ul class="mb-4 list-disc space-y-1 pl-6">')
        listType = 'ul'
      }
      out.push(`<li>${renderInline(bullet[1])}</li>`)
      continue
    }

    const numbered = safe.match(/^\d+\.\s+(.*)$/)
    if (numbered) {
      closeParagraph()
      if (listType !== 'ol') {
        closeList()
        out.push('<ol class="mb-4 list-decimal space-y-1 pl-6">')
        listType = 'ol'
      }
      out.push(`<li>${renderInline(numbered[1])}</li>`)
      continue
    }

    closeList()
    paragraph.push(safe)
  }

  // Flush anything still open at the end of the document.
  if (inCode && codeBuffer.length) {
    out.push(
      `<pre class="mb-4 overflow-x-auto rounded-2xl bg-[#1f1b2e] p-4 text-sm text-white"><code>${escapeHtml(
        codeBuffer.join('\n')
      )}</code></pre>`
    )
  }
  closeParagraph()
  closeList()

  return out.join('\n')
}
