// GENERATED FILE - DO NOT EDIT.
// Copied from lib/summerReminderEmail.ts by scripts/sync-shared-email.mjs.
// Edit the original in lib/ and run: node scripts/sync-shared-email.mjs
/**
 * Summer Reads reminder email: the editable content, and the one function that
 * turns it into HTML.
 *
 * The admin edits these fields in the dashboard preview and the result is saved
 * to `emailTemplates/summerReminder`. The server reads the same document and
 * calls the same builder, so what the admin approves is exactly what sends.
 *
 * Shared deliberately. The dashboard preview and the Cloud Function used to
 * hold two hand-maintained copies of this markup, which is precisely the kind
 * of duplication that drifts: a wording change in one place silently left the
 * other stale, so the preview stopped being evidence of anything.
 *
 * The branded shell - logo, gradient header, card, palette - is NOT editable.
 * Layout and inline CSS are what make an email render across Gmail, Outlook and
 * Apple Mail; a free-text HTML box invites a stray tag that breaks the send for
 * every parent at once.
 */

/** A question and answer in the FAQ block. Answers may contain inline links. */
export type ReminderFaq = { q: string; a: string }

/** Everything an admin can change about the reminder email. */
export type ReminderContent = {
  subject: string
  /** Follows "Assalamu alaikum " and precedes the comma. */
  greeting: string
  intro: string
  /** Heading above the bullet list. */
  remindersTitle: string
  /** Bullets in the highlighted reminder box. May contain inline links. */
  bullets: string[]
  deadlineLabel: string
  deadlineValue: string
  deadlineNote: string
  faqsTitle: string
  faqs: ReminderFaq[]
  ctaLabel: string
  signOff: string
  signature: string
  footerNote: string
}

const LOG_URL = 'https://eduvatekids.com/summer-reads/log'
const BOOKS_URL = 'https://eduvatekids.com/summer-reads'
const CATALOG_URL = 'https://eduvatekids.com/catalog'

/** Inline link, styled to match the email. Keeps the long markup out of copy. */
const link = (href: string, text: string) =>
  `<a href="${href}" style="color:#7c3aed;font-weight:bold">${text}</a>`

/**
 * The built-in wording. Also the target of "Reset to default", so an admin can
 * always get back to a known-good email after an unwanted edit.
 */
export const DEFAULT_REMINDER_CONTENT: ReminderContent = {
  subject:
    '📚 Summer Reads reminder: keep reading from the recommended list (deadline 31 Aug)',
  greeting: 'dear parent',
  intro:
    "MashaAllah, the reading has started with such excitement, and we've seen fantastic performances so far! 🌟 Thank you for reading along with {{child}} this summer. It's a joy to watch these seeds of knowledge grow, biidhnillah.",
  remindersTitle: 'A gentle reminder as you keep reading:',
  bullets: [
    `📖 <strong>Please stick to the recommended book list.</strong> We've noticed a few books logged from outside the recommendations, and those won't count towards the reading record. Ensure to review the recommended books from the ${link(BOOKS_URL, 'Summer Reads page')}.`,
    '✅ <strong>Only books from the recommended list count</strong> towards completing a level and entering the raffle draw, so choosing from the list keeps every book counting.',
    `✍️ Don't forget to ${link(LOG_URL, 'log each finished book')} using your reading code.`,
  ],
  deadlineLabel: 'Program deadline',
  deadlineValue: '31 August',
  deadlineNote:
    "There's no rush, but do aim to finish reading as soon as you comfortably can. 😊",
  faqsTitle: 'Frequently asked questions',
  faqs: [
    {
      q: 'Can I begin to log the books I finish reading?',
      a: 'Yes! As soon as you finish a book, let your parent know first. They will help confirm you truly read and understood it, then log it together.',
    },
    {
      q: 'What do I need to log a book?',
      a: `Your registration code. Share it with your parent and log the book together on the ${link(LOG_URL, 'Log a Book')} page, since every book is parent verified.`,
    },
    {
      q: 'What if I read a book outside the recommended list?',
      a: 'We do our best to consider all books that align with our values. When a book is clearly outside this scope we are unable to count it, so it is marked invalid. Choosing from the recommended list keeps every book counting.',
    },
    {
      q: 'Can we buy a book we like online so we can read it?',
      a: `Absolutely, though you are not required to buy any book to take part. We currently deliver direct online purchases across the USA and hope to expand further, in-sha-Allah. Browse our ${link(CATALOG_URL, 'catalog')} any time.`,
    },
    {
      q: 'Why is it important to take part in the reading?',
      a: 'Reading nurtures the heart and the mind. It builds a lifelong love of reading rooted in faith and growing in knowledge, strengthens understanding, and is a joyful habit for the whole family, with a certificate and raffle entry when the goal is met.',
    },
  ],
  ctaLabel: 'Log the next book →',
  signOff: 'Keep up the wonderful reading!',
  signature: 'The Eduvate Kids Team',
  footerNote:
    "You're receiving this because a child is registered for Eduvate Kids Summer Reads. Questions? Just reply to this email.",
}

/**
 * Escape text destined for an HTML attribute or a text node.
 *
 * Applied to values that must never carry markup (the child's name, the
 * deadline). Body copy is deliberately NOT escaped: the default content and the
 * admin's edits use inline <strong> and <a> tags, and escaping those would show
 * the raw tags to every parent. Only an authenticated admin can write this
 * template, so the trust boundary sits at the dashboard, not here.
 */
const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Fill in the per-recipient placeholders an admin can use in body copy. */
const fill = (text: string, vars: { child: string; parent: string }) =>
  String(text ?? '')
    .replace(/\{\{\s*child\s*\}\}/g, vars.child)
    .replace(/\{\{\s*parent\s*\}\}/g, vars.parent)

/** Merge a stored (possibly partial or malformed) document over the defaults. */
export function normalizeReminderContent(data: unknown): ReminderContent {
  const d = (data ?? {}) as Partial<Record<keyof ReminderContent, unknown>>
  const str = (v: unknown, fallback: string) => {
    const s = typeof v === 'string' ? v.trim() : ''
    return s || fallback
  }
  const bullets = Array.isArray(d.bullets)
    ? d.bullets.map((b) => String(b ?? '').trim()).filter(Boolean)
    : []
  const faqs = Array.isArray(d.faqs)
    ? (d.faqs as unknown[])
        .map((f) => {
          const row = (f ?? {}) as { q?: unknown; a?: unknown }
          return { q: String(row.q ?? '').trim(), a: String(row.a ?? '').trim() }
        })
        // A half-filled row would render an empty question or answer.
        .filter((f) => f.q && f.a)
    : []

  return {
    subject: str(d.subject, DEFAULT_REMINDER_CONTENT.subject),
    greeting: str(d.greeting, DEFAULT_REMINDER_CONTENT.greeting),
    intro: str(d.intro, DEFAULT_REMINDER_CONTENT.intro),
    remindersTitle: str(d.remindersTitle, DEFAULT_REMINDER_CONTENT.remindersTitle),
    // An empty list means the admin removed every bullet, which is a valid
    // choice: the box is dropped rather than silently refilled with defaults.
    bullets: Array.isArray(d.bullets) ? bullets : DEFAULT_REMINDER_CONTENT.bullets,
    deadlineLabel: str(d.deadlineLabel, DEFAULT_REMINDER_CONTENT.deadlineLabel),
    deadlineValue: str(d.deadlineValue, DEFAULT_REMINDER_CONTENT.deadlineValue),
    deadlineNote: str(d.deadlineNote, DEFAULT_REMINDER_CONTENT.deadlineNote),
    faqsTitle: str(d.faqsTitle, DEFAULT_REMINDER_CONTENT.faqsTitle),
    faqs: Array.isArray(d.faqs) ? faqs : DEFAULT_REMINDER_CONTENT.faqs,
    ctaLabel: str(d.ctaLabel, DEFAULT_REMINDER_CONTENT.ctaLabel),
    signOff: str(d.signOff, DEFAULT_REMINDER_CONTENT.signOff),
    signature: str(d.signature, DEFAULT_REMINDER_CONTENT.signature),
    footerNote: str(d.footerNote, DEFAULT_REMINDER_CONTENT.footerNote),
  }
}

/**
 * Render the reminder email.
 *
 * `parentName` and `childName` are per-recipient; omitting them (as the preview
 * does) yields the generic wording a bulk send uses.
 */
export function buildReminderEmail(
  content: ReminderContent,
  params?: { parentName?: string; childName?: string }
): string {
  const vars = {
    child: esc(params?.childName?.trim() || 'your reader'),
    parent: esc(params?.parentName?.trim() || 'dear parent'),
  }
  const greeting = params?.parentName?.trim()
    ? esc(params.parentName.trim())
    : content.greeting
  const body = (text: string) => fill(text, vars)

  const bullets = content.bullets
    .map(
      (b, i) =>
        `<li style="margin-bottom:${i === content.bullets.length - 1 ? '0' : '8px'}">${body(b)}</li>`
    )
    .join('')

  const remindersBox = content.bullets.length
    ? `<div style="background:#f5f3ff;border:1px solid #e9d5ff;border-radius:14px;padding:16px 18px;margin:18px 0">
        <p style="margin:0 0 8px;font-weight:bold;color:#4c1d95">${body(content.remindersTitle)}</p>
        <ul style="margin:0;padding-left:20px">${bullets}</ul>
      </div>`
    : ''

  const faqs = content.faqs.length
    ? `<div style="border-top:1px solid #eee;padding-top:18px;margin-top:22px">
        <p style="margin:0 0 12px;font-weight:bold;font-size:16px;color:#1f2937">${body(content.faqsTitle)}</p>
        ${content.faqs
          .map(
            (f) =>
              `<div style="margin:0 0 14px">
                <p style="margin:0 0 4px;font-weight:bold;color:#4c1d95;font-size:14px">${esc(f.q)}</p>
                <p style="margin:0;font-size:14px;color:#374151">${body(f.a)}</p>
              </div>`
          )
          .join('')}
      </div>`
    : ''

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
    <div style="background:linear-gradient(135deg,#1a7a3c,#7c3aed);color:#fff;padding:26px 24px;border-radius:14px 14px 0 0;text-align:center">
      <img src="https://eduvatekids.com/email-logo.png" alt="Eduvate Kids" width="60" height="86" style="display:block;margin:0 auto 12px;width:60px;height:86px;background:#fff;border-radius:14px;padding:8px 12px;object-fit:contain" />
      <h1 style="margin:0;font-size:22px">📚 A little Summer Reads reminder</h1>
      <p style="margin:8px 0 0;opacity:.92;font-size:14px">Rooted in Faith. Growing in Knowledge.</p>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px;padding:26px;font-size:15px;line-height:1.6">
      <p style="margin:0 0 14px"><strong>Assalamu alaikum ${greeting},</strong></p>
      <p style="margin:0 0 14px">${body(content.intro)}</p>
      ${remindersBox}
      <div style="text-align:center;margin:22px 0">
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280">${esc(content.deadlineLabel)}</p>
        <div style="display:inline-block;border:2px dashed #1a7a3c;border-radius:14px;padding:10px 24px;font-size:20px;font-weight:bold;color:#166534">${esc(content.deadlineValue)}</div>
        <p style="margin:8px 0 0;font-size:13px;color:#6b7280">${body(content.deadlineNote)}</p>
      </div>
      ${faqs}
      <div style="text-align:center;margin:24px 0 8px">
        <a href="${LOG_URL}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:bold;padding:13px 28px;border-radius:999px">${esc(content.ctaLabel)}</a>
      </div>
      <p style="margin:18px 0 0">${body(content.signOff)}<br><strong>${esc(content.signature)}</strong></p>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;border-top:1px solid #eee;padding-top:14px">${body(content.footerNote)}</p>
    </div>
  </div>`
}
