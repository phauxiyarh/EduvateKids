'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  onSnapshot,
  serverTimestamp,
  increment
} from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { normalizeShelf, shelfSlug, sortShelves, type Shelf } from '../../lib/shelves'
import {
  blogSlug,
  deriveExcerpt,
  normalizeBlogPost,
  readingMinutes,
  renderMarkdown,
  sortPosts,
  type BlogPost
} from '../../lib/blog'
import { uploadBlogImage } from '../../lib/uploadImage'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid
} from 'recharts'
import { httpsCallable } from 'firebase/functions'
import QRCode from 'qrcode'
import { auth, db, functions } from '../../lib/firebase'
import { isAdminHostAllowed } from '../../lib/adminAccess'
import { uploadCatalogImage } from '../../lib/uploadImage'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { BookPlaceholder } from '../components/BookPlaceholder'
import logo from '../../assets/logo.png'
import bg1 from '../../assets/bg1.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'

type InventoryCategory = 'Books' | 'Activity Books' | 'Cards' | 'Crafts' | 'Puzzles' | 'Games' | 'Gifts' | 'Others'

const ALL_CATALOG_CATEGORIES: InventoryCategory[] = ['Books', 'Activity Books', 'Cards', 'Crafts', 'Puzzles', 'Games', 'Gifts', 'Others']

type InventoryItem = {
  id: string
  title: string
  category: InventoryCategory
  publisher: string
  /**
   * The item's single scannable identifier — an ISBN-13 for books, a UPC for
   * non-book stock, or an internal EK- code. Replaces the old sku/isbn pair,
   * which split one concept across two fields and let the same book land in
   * two rows depending on which field an upload happened to fill.
   */
  code: string
  /** Secondary identifier kept so an older printed label still resolves. */
  altCode: string
  /**
   * Legacy mirrors of `code`. Still written on every save so the orders Cloud
   * Function (which queries inventory by sku/isbn) keeps resolving until it is
   * redeployed. Never read for display — read `code`.
   */
  sku: string
  isbn: string
  rrp: number
  discount: number
  quantity: number
  sellingPrice: number
  weight: number
}

/** An ISBN-13 / EAN barcode: exactly 13 digits once separators are stripped. */
const isIsbn13 = (value: string) => /^\d{13}$/.test(value.replace(/[\s-]/g, ''))

/**
 * Pick the single best identifier from a record that may carry the legacy
 * sku/isbn pair. A real 13-digit barcode wins over an internal code, because
 * it is what actually scans off the physical item.
 */
const resolveItemCode = (data: { code?: string; sku?: string; isbn?: string }) => {
  const candidates = [data.code, data.isbn, data.sku]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
  if (!candidates.length) return { code: '', altCode: '' }
  const scannable = candidates.find(isIsbn13)
  const code = scannable ?? candidates[0]
  // Anything else that is genuinely different is preserved, not discarded.
  const altCode = candidates.find((c) => c !== code) ?? ''
  return { code, altCode }
}

type Sale = {
  id: string
  itemId: string
  title: string
  quantity: number
  paymentType: 'Cash' | 'Card' | 'Transfer'
  total: number
  timestamp: string
  rrp: number
  sellingPrice: number
}

type OrderItem = {
  itemId: string
  title: string
  price: number
  quantity: number
  lineTotal: number
}

type Order = {
  id: string
  items: OrderItem[]
  subtotal: number
  discount: number
  discountType: 'percentage' | 'amount'
  discountValue: number
  convenienceFee: number
  paymentType: 'Cash' | 'Card' | 'Transfer'
  total: number
  timestamp: string
  eventId: string
}

type CartItem = {
  itemId: string
  title: string
  price: number
  quantity: number
}

/** Online store order (written by the Stripe webhook to the `orders` collection). */
type OnlineOrderItem = { id: string; inventoryId?: string; sku?: string; title: string; quantity: number; unitPrice: number; lineTotal: number }
type OnlineOrder = {
  id: string
  items: OnlineOrderItem[]
  subtotal: number
  shippingFee: number
  shipWeightGrams?: number
  shipZone?: number
  tax?: number
  total: number
  currency: string
  customer: { name: string; email: string; phone?: string }
  shippingAddress: { line1: string; line2?: string; city: string; state: string; postalCode: string; country: string }
  paymentProvider: string
  paymentRef: string
  status: 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'pending' | 'failed'
  // Live-mode flag. finalizeOrder writes it as `_live`; `live` kept for any
  // older docs. true = real (live-mode) Stripe payment; false/undefined = test.
  _live?: boolean
  live?: boolean
  stockRestored?: boolean // true once this order's stock has been returned to inventory
  createdAt?: { seconds: number } | null
  paidAt?: { seconds: number } | null
  shippedAt?: { seconds: number } | null
  deliveredAt?: { seconds: number } | null
}

/**
 * Build the customer purchase-confirmation email HTML for previewing in the
 * dashboard. Mirrors the server template in functions/src/email.ts
 * (buildCustomerPurchaseEmailHtml) so "View email draft" shows what will send.
 * The actual send is done server-side from the order record.
 */
function buildPurchaseEmailHtml(order: OnlineOrder): string {
  const esc = (s: unknown) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`
  const cur = String(order.currency || 'usd').toUpperCase()
  const a = order.shippingAddress || { line1: '', city: '', state: '', postalCode: '', country: '' }
  const firstName = String(order.customer?.name || '').trim().split(/\s+/)[0] || 'there'
  const rows = (order.items || [])
    .map(
      (i) =>
        `<tr><td style="padding:8px 10px;border-bottom:1px solid #eee">${esc(i.title)}</td>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${money(i.lineTotal)}</td></tr>`
    )
    .join('')
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
    <div style="background:linear-gradient(135deg,#1a7a3c,#7c3aed);color:#fff;padding:26px 24px;border-radius:14px 14px 0 0;text-align:center">
      <img src="https://eduvatekids.com/email-logo.png" alt="Eduvate Kids" width="60" height="86" style="display:block;margin:0 auto 12px;width:60px;height:86px;background:#fff;border-radius:14px;padding:8px 12px;object-fit:contain" />
      <h1 style="margin:0;font-size:22px">Thank you for your order!</h1>
      <p style="margin:8px 0 0;opacity:.92;font-size:14px">Order ${esc(order.id)}</p>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px;padding:26px;font-size:14px;line-height:1.6">
      <p style="margin:0 0 14px"><strong>Assalamu alaikum ${esc(firstName)},</strong></p>
      <p style="margin:0 0 18px">JazakAllahu khayran for shopping with Eduvate Kids! We've received your order and are getting it ready. Here's your summary:</p>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase">
          <th style="padding:6px 10px">Item</th><th style="padding:6px 10px;text-align:center">Qty</th><th style="padding:6px 10px;text-align:right">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <tr><td style="padding:3px 10px;color:#6b7280">Subtotal</td><td style="padding:3px 10px;color:#6b7280;text-align:right">${money(order.subtotal)}</td></tr>
        <tr><td style="padding:3px 10px;color:#6b7280">Shipping</td><td style="padding:3px 10px;color:#6b7280;text-align:right">${money(order.shippingFee)}</td></tr>
        <tr><td style="padding:3px 10px;color:#6b7280">Tax</td><td style="padding:3px 10px;color:#6b7280;text-align:right">${money(order.tax || 0)}</td></tr>
        <tr><td style="padding:8px 10px 3px;font-weight:bold">Total paid</td><td style="padding:8px 10px 3px;font-weight:bold;text-align:right">${money(order.total)} ${cur}</td></tr>
      </table>
      <h3 style="margin:22px 0 6px;font-size:14px">Shipping to</h3>
      <p style="margin:0;font-size:14px">
        ${esc(order.customer?.name)}<br>
        ${esc(a.line1)}${a.line2 ? '<br>' + esc(a.line2) : ''}<br>
        ${esc(a.city)}, ${esc(a.state)} ${esc(a.postalCode)}<br>${esc(a.country)}
      </p>
      <p style="margin:22px 0 0">We'll be in touch when your order ships, insha'Allah. If you have any questions, just reply to this email.</p>
      <p style="margin:18px 0 0">With gratitude,<br><strong>The Eduvate Kids Team</strong></p>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;border-top:1px solid #eee;padding-top:14px">Rooted in Faith. Growing in Knowledge.</p>
    </div>
  </div>`
}

/**
 * Build the Summer Reads reminder-broadcast email HTML for previewing in the
 * dashboard. Mirrors the server template in functions/src/email.ts
 * (buildSummerReminderEmailHtml) so the admin sees what will actually send.
 * The real send is done server-side to each registered parent.
 */
function buildReminderEmailHtml(): string {
  const logUrl = 'https://eduvatekids.com/summer-reads/log'
  const booksUrl = 'https://eduvatekids.com/summer-reads'
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
    <div style="background:linear-gradient(135deg,#1a7a3c,#7c3aed);color:#fff;padding:26px 24px;border-radius:14px 14px 0 0;text-align:center">
      <img src="https://eduvatekids.com/email-logo.png" alt="Eduvate Kids" width="60" height="86" style="display:block;margin:0 auto 12px;width:60px;height:86px;background:#fff;border-radius:14px;padding:8px 12px;object-fit:contain" />
      <h1 style="margin:0;font-size:22px">📚 A little Summer Reads reminder</h1>
      <p style="margin:8px 0 0;opacity:.92;font-size:14px">Rooted in Faith. Growing in Knowledge.</p>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px;padding:26px;font-size:15px;line-height:1.6">
      <p style="margin:0 0 14px"><strong>Assalamu alaikum dear parent,</strong></p>
      <p style="margin:0 0 14px">MashaAllah, the reading has started with such excitement, and we've seen fantastic performances so far! 🌟 Thank you for reading along with your reader this summer. It's a joy to watch these seeds of knowledge grow, biidhnillah.</p>
      <div style="background:#f5f3ff;border:1px solid #e9d5ff;border-radius:14px;padding:16px 18px;margin:18px 0">
        <p style="margin:0 0 8px;font-weight:bold;color:#4c1d95">A gentle reminder as you keep reading:</p>
        <ul style="margin:0;padding-left:20px">
          <li style="margin-bottom:8px">📖 <strong>Please stick to the recommended book list.</strong> We've noticed a few books logged from outside the recommendations, and those won't count towards the reading record. Ensure to review the recommended books from the <a href="${booksUrl}" style="color:#7c3aed;font-weight:bold">Summer Reads page</a>.</li>
          <li style="margin-bottom:8px">✅ <strong>Only books from the recommended list count</strong> towards completing a level and entering the raffle draw, so choosing from the list keeps every book counting.</li>
          <li style="margin-bottom:0">✍️ Don't forget to <a href="${logUrl}" style="color:#7c3aed;font-weight:bold">log each finished book</a> using your reading code.</li>
        </ul>
      </div>
      <div style="text-align:center;margin:22px 0">
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280">Program deadline</p>
        <div style="display:inline-block;border:2px dashed #1a7a3c;border-radius:14px;padding:10px 24px;font-size:20px;font-weight:bold;color:#166534">31 August</div>
        <p style="margin:8px 0 0;font-size:13px;color:#6b7280">There's no rush, but do aim to finish reading as soon as you comfortably can. 😊</p>
      </div>
      <div style="border-top:1px solid #eee;padding-top:18px;margin-top:22px">
        <p style="margin:0 0 12px;font-weight:bold;font-size:16px;color:#1f2937">Frequently asked questions</p>
        ${reminderEmailFaqs
          .map(
            (f) =>
              `<div style="margin:0 0 14px">
                <p style="margin:0 0 4px;font-weight:bold;color:#4c1d95;font-size:14px">${f.q}</p>
                <p style="margin:0;font-size:14px;color:#374151">${f.a}</p>
              </div>`
          )
          .join('')}
      </div>
      <div style="text-align:center;margin:24px 0 8px">
        <a href="${logUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:bold;padding:13px 28px;border-radius:999px">Log the next book →</a>
      </div>
      <p style="margin:18px 0 0">Keep up the wonderful reading!<br><strong>The Eduvate Kids Team</strong></p>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;border-top:1px solid #eee;padding-top:14px">You're receiving this because a child is registered for Eduvate Kids Summer Reads. Questions? Just reply to this email.</p>
    </div>
  </div>`
}

/**
 * FAQ content mirrored in the reminder email preview. Kept identical to the
 * server list (functions/src/email.ts summerReminderFaqs) so the dashboard
 * preview matches what actually sends.
 */
const reminderEmailFaqs: { q: string; a: string }[] = [
  {
    q: 'Can I begin to log the books I finish reading?',
    a: 'Yes! As soon as you finish a book, let your parent know first. They will help confirm you truly read and understood it, then log it together.',
  },
  {
    q: 'What do I need to log a book?',
    a: 'Your registration code. Share it with your parent and log the book together on the <a href="https://eduvatekids.com/summer-reads/log" style="color:#7c3aed;font-weight:bold">Log a Book</a> page, since every book is parent verified.',
  },
  {
    q: 'What if I read a book outside the recommended list?',
    a: 'We do our best to consider all books that align with our values. When a book is clearly outside this scope we are unable to count it, so it is marked invalid. Choosing from the recommended list keeps every book counting.',
  },
  {
    q: 'Can we buy a book we like online so we can read it?',
    a: 'Absolutely, though you are not required to buy any book to take part. We currently deliver direct online purchases across the USA and hope to expand further, in-sha-Allah. Browse our <a href="https://eduvatekids.com/catalog" style="color:#7c3aed;font-weight:bold">catalog</a> any time.',
  },
  {
    q: 'Why is it important to take part in the reading?',
    a: 'Reading nurtures the heart and the mind. It builds a lifelong love of reading rooted in faith and growing in knowledge, strengthens understanding, and is a joyful habit for the whole family, with a certificate and raffle entry when the goal is met.',
  },
]

/** Summer Reading Program registration (written to the `summerReads` collection). */
// `valid` is an admin's silent review flag: only valid books (valid !== false)
// count towards the reading goal / raffle eligibility.
type SummerBookLog = { title: string; author?: string; rating?: number; review?: string; dateFinished?: string; dateLogged?: string; valid?: boolean }
type SummerReader = {
  id: string
  code: string
  childName: string
  dateOfBirth?: string
  childAge?: number
  parentName: string
  parentEmail: string
  parentPhone?: string
  booksCount: number
  // `tier` mirrors the chosen level (kept for back-compat); `level` is the
  // fixed, chosen category and `goal`/`goalMet` track completion.
  tier: 'seedling' | 'reader' | 'scholar' | 'none' | string
  level?: 'seedling' | 'reader' | 'scholar' | 'none' | string
  goal?: number
  goalMet?: boolean
  country?: string
  state?: string
  city?: string
  raffleEligible?: boolean
  // Admin override: when set, forces eligibility regardless of country. Absent =
  // fall back to the country-derived default.
  raffleEligibleOverride?: boolean
  consent?: boolean
  booksLogged?: SummerBookLog[]
  createdAt?: { seconds: number } | null
}

const LEVEL_GOAL: Record<string, number> = { seedling: 4, reader: 6, scholar: 10 }
/** A reader's fixed level (prefers `level`, falls back to legacy `tier`). */
function readerLevel(r: { level?: string; tier?: string }): string {
  const v = (r.level || r.tier || 'none') as string
  return v === 'none' ? 'seedling' : v
}
/** Count of a reader's VALID logged books (valid !== false), used as a fallback. */
function readerValidBooksCount(r: SummerReader): number {
  if (Array.isArray(r.booksLogged)) return r.booksLogged.filter((b) => b.valid !== false).length
  return r.booksCount ?? 0
}
/** Whether a reader has reached their chosen goal (valid books only). */
function readerGoalMet(r: SummerReader): boolean {
  if (typeof r.goalMet === 'boolean') return r.goalMet
  const g = r.goal ?? LEVEL_GOAL[readerLevel(r)] ?? 3
  return readerValidBooksCount(r) >= g
}
// Raffle draw is currently open only to USA / Nigeria / Canada residents.
const RAFFLE_COUNTRIES = ['united states of america', 'united states', 'usa', 'us', 'nigeria', 'ng', 'canada', 'ca']
/**
 * Whether a reader is eligible for the prize raffle. An explicit admin override
 * wins; otherwise the stored flag; otherwise the country-derived default.
 */
function readerRaffleEligible(r: SummerReader): boolean {
  if (typeof r.raffleEligibleOverride === 'boolean') return r.raffleEligibleOverride
  if (typeof r.raffleEligible === 'boolean') return r.raffleEligible
  return RAFFLE_COUNTRIES.includes(String(r.country ?? '').trim().toLowerCase())
}

/** Dashboard navigation items, in sidebar order. `title`/`subtitle` drive the page header. */
const NAV_ITEMS: { id: string; label: string; title: string; subtitle: string }[] = [
  { id: 'home', label: 'Home', title: 'Admin Home', subtitle: 'Monitor restock needs, best sellers, and event performance at a glance.' },
  { id: 'inventory', label: 'Inventory', title: 'Inventory Management', subtitle: 'Upload, update, and manage your complete inventory with ease.' },
  { id: 'events', label: 'Events', title: 'Event Management', subtitle: 'Create events, manage dates and fees, and review event performance summaries.' },
  { id: 'pos', label: 'POS', title: 'Point of Sale', subtitle: 'Record sales for events or general transactions. Search products, manage cart, and process payments.' },
  { id: 'catalog', label: 'Catalog', title: 'Catalog Management', subtitle: 'Create, manage, and showcase your product catalog with images and details.' },
  { id: 'orders', label: 'Orders', title: 'Online Orders', subtitle: 'Online store orders paid via Stripe. Review details and mark items as shipped.' },
  { id: 'summer', label: 'Summer Reads', title: 'Summer Reads', subtitle: 'Registrations and reading progress for the Summer Reads program.' },
  { id: 'bookRequests', label: 'Book Requests', title: 'Book Requests', subtitle: 'Out-of-stock pre-orders reserved by shoppers. Follow up when items are back in stock.' },
  { id: 'website', label: 'Website', title: 'Website Content', subtitle: 'Manage the shelves, blog posts and freebies that appear on the public site.' },
]

type WebsiteTab = 'shelves' | 'blog' | 'freebies'

/** Sub-tabs inside the Website section. */
const WEBSITE_TABS: { id: WebsiteTab; label: string; blurb: string }[] = [
  { id: 'shelves', label: 'Shelves', blurb: 'Curated collections of books shown on the /shelves page.' },
  { id: 'blog', label: 'Blog', blurb: 'Articles and reading guides shown on the /blog page.' },
  { id: 'freebies', label: 'Freebies', blurb: 'Free downloads unlocked when a visitor subscribes.' },
]

/** The icon path(s) for a nav item id. */
function NavIcon({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      {id === 'home' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />}
      {id === 'inventory' && <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
      {id === 'events' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />}
      {id === 'pos' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />}
      {id === 'catalog' && <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h9a2 2 0 012 2v14l-6-3-6 3V5z" />}
      {id === 'orders' && <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />}
      {id === 'summer' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />}
      {id === 'bookRequests' && <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />}
      {id === 'website' && <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18 15 15 0 010-18z" />}
    </svg>
  )
}

/** Out-of-stock pre-order request (written by the submitBookRequest function). */
type BookRequest = {
  id: string
  bookId?: string
  bookTitle: string
  name: string
  email: string
  phone?: string
  quantity: number
  status?: string
  createdAt?: { seconds: number } | null
}

type EventStatus = 'active' | 'closed'

type Expense = {
  id: string
  description: string
  amount: number
  category: 'Transport' | 'Supplies' | 'Food' | 'Printing' | 'Decoration' | 'Other'
  date: string
}

type EventRecord = {
  id: string
  name: string
  cost: number
  startDate: string
  endDate: string
  location: string
  type: 'Bazaar' | 'Bookfair' | 'Jummah Boot'
  status: EventStatus
  sales: Sale[]
  orders: Order[]
  expenses: Expense[]
}

type AgeCategory = '0+' | '3+' | '6+' | '10+' | 'Adult'

const AGE_CATEGORIES: Record<AgeCategory, { range: string; title: string }> = {
  '0+': { range: '0+ years', title: 'Tiny Sprouts' },
  '3+': { range: '3+ years', title: 'Little Imaan Explorers' },
  '6+': { range: '6+ years', title: 'Deen Explorers' },
  '10+': { range: '10+ years', title: 'Young Scholars' },
  'Adult': { range: 'Adult', title: 'Wisdom Seekers' }
}

// Simple lower-bound "N+" label for an age category (public catalog style).
const AGE_SHORT_LABEL: Record<AgeCategory, string> = {
  '0+': '0+',
  '3+': '3+',
  '6+': '6+',
  '10+': '10+',
  'Adult': 'Adult'
}
const ageShortLabel = (age: string): string =>
  AGE_SHORT_LABEL[age as AgeCategory] || age

// Migration map for old age categories to the current set. Older items used
// ranges (0-5 displayed as 3+, 6-9 as 6+); map them to the matching new key.
const MIGRATE_AGE_CATEGORY = (oldCategory: string): AgeCategory => {
  const migrations: Record<string, AgeCategory> = {
    '0-3': '0+',
    '0-5': '3+',
    '4-6': '6+',
    '6-9': '6+',
    '7-9': '6+',
    '10-12': '10+',
    '13+': '10+'
  }
  return (migrations[oldCategory] as AgeCategory) || (oldCategory as AgeCategory)
}

type CatalogItem = {
  id: string
  title: string
  description: string
  category: InventoryCategory[]
  ageCategory: AgeCategory[]
  price: number
  publisher: string
  showPublisher?: boolean
  images: string[]
  createdAt: string
  sku?: string
  // Mirrored stock count so the storefront knows in/out of stock. Kept in sync
  // with the linked inventory item's quantity from the catalog form.
  stock?: number
  /**
   * Slugs of the shelves this product appears on. Held on the product rather
   * than the shelf so a book can sit on several shelves and assignment is one
   * field edit in the catalog form.
   */
  shelves?: string[]
}

const defaultInventory: InventoryItem[] = [
  {
    id: 'inv-1',
    title: 'My First Quran Stories',
    category: 'Books',
    publisher: 'Noor Press',
    code: '',
    altCode: '',
    sku: '',
    isbn: '',
    rrp: 22,
    discount: 10,
    quantity: 14,
    sellingPrice: 19.8,
    weight: 320
  },
  {
    id: 'inv-2',
    title: 'Ramadan Activity Kit',
    category: 'Crafts',
    publisher: 'Little Lanterns',
    code: '',
    altCode: '',
    sku: '',
    isbn: '',
    rrp: 35,
    discount: 5,
    quantity: 9,
    sellingPrice: 33.25,
    weight: 600
  },
  {
    id: 'inv-3',
    title: 'Hajj Adventure Puzzle',
    category: 'Puzzles',
    publisher: 'Kite & Compass',
    code: '',
    altCode: '',
    sku: '',
    isbn: '',
    rrp: 28,
    discount: 0,
    quantity: 12,
    sellingPrice: 28,
    weight: 450
  },
  {
    id: 'inv-4',
    title: 'Eid Gift Bundle',
    category: 'Gifts',
    publisher: 'Barakah Box',
    code: '',
    altCode: '',
    sku: '',
    isbn: '',
    rrp: 40,
    discount: 12,
    quantity: 6,
    sellingPrice: 35.2,
    weight: 800
  }
]

const defaultEvents: EventRecord[] = [
  {
    id: 'event-1',
    name: 'Masjid Book Fair',
    cost: 120,
    startDate: '2026-02-02',
    endDate: '2026-02-03',
    location: 'Downtown Masjid',
    type: 'Bookfair',
    status: 'active',
    sales: [],
    orders: [],
    expenses: []
  },
  {
    id: 'event-2',
    name: 'School Literacy Night',
    cost: 80,
    startDate: '2026-01-12',
    endDate: '2026-01-12',
    location: 'Greenwood School',
    type: 'Bazaar',
    status: 'closed',
    sales: [],
    orders: [],
    expenses: []
  }
]


const restockThreshold = 10

const parseNumber = (value: unknown) => {
  if (typeof value === 'number') return value
  const cleaned = String(value ?? '').replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Loose text key for matching the "same" item across spreadsheet uploads.
 * Collapses case, internal whitespace, punctuation and unicode variants so
 * "Allah Loves  Me!" and "allah loves me" resolve to the same key.
 */
const normalizeText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Canonical form of a scannable code, so "978-1-0681500-0-5" and
 * "9781068150005" are one key. Digit-ish codes keep only digits and X;
 * internal codes (EK-…) fall back to loose text normalization.
 */
const normalizeCode = (value: unknown) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const digits = raw.replace(/[^0-9xX]/g, '').toLowerCase()
  // Treat as a barcode only if stripping separators leaves a plausible one.
  if (digits.length >= 8 && /^[0-9]/.test(raw.replace(/[\s-]/g, ''))) return digits
  return normalizeText(raw)
}

/**
 * Identity keys for an item, most-authoritative first: its code (including any
 * legacy sku/isbn still on the record), then normalized title+publisher. Two
 * items are "the same" if they share ANY key. Used by both the upload merge
 * and the duplicate finder so the two always agree.
 */
const itemMatchKeys = (
  item: Partial<Pick<InventoryItem, 'code' | 'altCode' | 'sku' | 'isbn'>> &
    Pick<InventoryItem, 'title' | 'publisher'>
): string[] => {
  const keys: string[] = []
  // One namespace for every identifier: a value that used to live in `sku` now
  // matches the same value living in `code`, which is what collapsed the 136
  // duplicate groups in the first place.
  const codes = [item.code, item.altCode, item.sku, item.isbn]
    .map(normalizeCode)
    .filter(Boolean)
  new Set(codes).forEach((c) => keys.push(`code:${c}`))
  const title = normalizeText(item.title)
  if (title) keys.push(`tp:${title}|${normalizeText(item.publisher)}`)
  return keys
}

/**
 * Does a scanned/typed value identify this item? Checks the unified code, the
 * preserved alternate code, the legacy sku/isbn mirrors, and the doc id — all
 * in canonical form, so a hyphenated ISBN still matches its bare digits.
 */
const itemMatchesCode = (
  item: Partial<Pick<InventoryItem, 'code' | 'altCode' | 'sku' | 'isbn'>> & { id?: string },
  raw: string
) => {
  const wanted = normalizeCode(raw)
  if (!wanted) return false
  if (item.id && item.id.toLowerCase() === raw.trim().toLowerCase()) return true
  return [item.code, item.altCode, item.sku, item.isbn]
    .map(normalizeCode)
    .filter(Boolean)
    .includes(wanted)
}

/**
 * True when a row's cost fields are placeholders rather than real data: no
 * discount, and an RRP that merely echoes the selling price. This is the
 * signature of a sheet imported without a Discount column — RRP got filled
 * with the sale price. Such a row's rrp/discount/weight carry no information,
 * so a merge must never let them win over a row that has genuine trade data.
 */
const isPlaceholderPriced = (i: InventoryItem) =>
  i.discount === 0 && i.rrp > 0 && Math.abs(i.rrp - i.sellingPrice) < 0.005

/** Resolve a free-text category against the full category list (not a subset). */
const resolveCategory = (input: unknown): InventoryCategory => {
  const wanted = normalizeText(input)
  if (!wanted) return 'Books'
  const exact = ALL_CATALOG_CATEGORIES.find((c) => normalizeText(c) === wanted)
  if (exact) return exact
  // Tolerate singular/plural drift from hand-typed sheets ("Card", "Puzzle").
  const loose = ALL_CATALOG_CATEGORIES.find(
    (c) => normalizeText(c) === `${wanted}s` || `${normalizeText(c)}s` === wanted
  )
  return loose ?? 'Books'
}

const normalizeInventoryItem = (data: Partial<InventoryItem>, id: string): InventoryItem => {
  const title = String(data.title ?? '').trim()
  const category = resolveCategory(data.category ?? 'Books')
  const rrp = parseNumber(data.rrp)
  const discount = parseNumber(data.discount)
  const quantity = Math.max(0, Math.round(parseNumber(data.quantity)))
  const sellingPriceRaw = parseNumber(data.sellingPrice)
  const sellingPrice = sellingPriceRaw || Number((rrp * (1 - discount / 100)).toFixed(2))
  const weight = Math.max(0, parseNumber(data.weight))

  // Older docs carry sku/isbn instead of code; resolve them to the one field.
  const { code, altCode } = resolveItemCode(data)

  return {
    id,
    title,
    category,
    publisher: String(data.publisher ?? '').trim(),
    code,
    altCode: String(data.altCode ?? '').trim() || altCode,
    // Legacy mirrors, kept in sync so the orders function still resolves.
    sku: code,
    isbn: isIsbn13(code) ? code : '',
    rrp,
    discount,
    quantity,
    sellingPrice,
    weight
  }
}

const normalizeSale = (data: Partial<Sale>): Sale | null => {
  const title = String(data.title ?? '').trim()
  if (!title) return null
  const quantity = Math.max(1, Math.round(parseNumber(data.quantity)))
  const total = parseNumber(data.total)
  const paymentType =
    data.paymentType === 'Card' || data.paymentType === 'Transfer' ? data.paymentType : 'Cash'

  return {
    id: String(data.id ?? `sale-${Date.now()}`),
    itemId: String(data.itemId ?? ''),
    title,
    quantity,
    paymentType,
    total: Number.isFinite(total) ? total : 0,
    timestamp: String(data.timestamp ?? new Date().toISOString()),
    rrp: parseNumber((data as any).rrp),
    sellingPrice: parseNumber((data as any).sellingPrice)
  }
}

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// NOTE: keys here are the output of normalizeHeader() — lowercased, bracketed
// text stripped, non-alphanumerics collapsed to single spaces. So "Weight (g)"
// and "Weight g" and "WEIGHT_G" all arrive as "weight g".
const headerMap: Record<string, keyof InventoryItem> = {
  title: 'title',
  name: 'title',
  'item': 'title',
  'item name': 'title',
  'product': 'title',
  'product name': 'title',
  'book title': 'title',
  category: 'category',
  cat: 'category',
  type: 'category',
  publisher: 'publisher',
  brand: 'publisher',
  supplier: 'publisher',
  vendor: 'publisher',
  // Every identifier column lands in the single `code` field. Which header a
  // sheet happens to use no longer decides whether a row matches existing stock.
  code: 'code',
  'alt code': 'code',
  'alternate code': 'code',
  sku: 'code',
  'sku code': 'code',
  'product code': 'code',
  'item code': 'code',
  'stock code': 'code',
  ref: 'code',
  isbn: 'code',
  'isbn 13': 'code',
  isbn13: 'code',
  'isbn 10': 'code',
  'barcode': 'code',
  'bar code': 'code',
  ean: 'code',
  upc: 'code',
  rrp: 'rrp',
  'rrp price': 'rrp',
  'list price': 'rrp',
  'retail price': 'rrp',
  'recommended retail price': 'rrp',
  'cover price': 'rrp',
  msrp: 'rrp',
  discount: 'discount',
  disc: 'discount',
  'disc percent': 'discount',
  'discount percent': 'discount',
  'discount percentage': 'discount',
  'discount rate': 'discount',
  'discount %': 'discount',
  quantity: 'quantity',
  qty: 'quantity',
  stock: 'quantity',
  'stock qty': 'quantity',
  'stock quantity': 'quantity',
  'in stock': 'quantity',
  'on hand': 'quantity',
  count: 'quantity',
  units: 'quantity',
  'selling price': 'sellingPrice',
  'sellingprice': 'sellingPrice',
  'sale price': 'sellingPrice',
  'sell price': 'sellingPrice',
  price: 'sellingPrice',
  'our price': 'sellingPrice',
  'net price': 'sellingPrice',
  weight: 'weight',
  wt: 'weight',
  'weight g': 'weight',
  'weight gr': 'weight',
  'weight gram': 'weight',
  'weight grams': 'weight',
  'item weight': 'weight',
  'shipping weight': 'weight',
  'ship weight': 'weight',
  'weight kg': 'weight',
  'weight kgs': 'weight'
}

/**
 * Headers whose unit is kilograms rather than grams. Inventory stores weight in
 * grams throughout (shipping-zone maths in lib/geo.ts assumes grams), so these
 * columns are scaled on import instead of being silently 1000x too small.
 */
const KG_WEIGHT_HEADERS = new Set(['weight kg', 'weight kgs'])

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('admin')
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eduvate-demo-mode')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })
  const [activeView, setActiveView] = useState<'home' | 'inventory' | 'events' | 'pos' | 'catalog' | 'orders' | 'summer' | 'bookRequests' | 'website'>(
    'home'
  )
  const [websiteTab, setWebsiteTab] = useState<WebsiteTab>('shelves')

  // Shelves: curated collections rendered on /shelves. Membership is stored on
  // each catalog product, so creating a shelf here only defines the container.
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [shelvesLoading, setShelvesLoading] = useState(false)
  const [shelfName, setShelfName] = useState('')
  const [shelfDescription, setShelfDescription] = useState('')
  const [shelfOrder, setShelfOrder] = useState('')
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null)
  const [shelfMessage, setShelfMessage] = useState('')
  const [isSavingShelf, setIsSavingShelf] = useState(false)

  // Blog posts. Body is Markdown, typed directly or pasted from a .md file.
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([])
  const [blogLoading, setBlogLoading] = useState(false)
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null)
  const [showPostEditor, setShowPostEditor] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [postExcerpt, setPostExcerpt] = useState('')
  const [postBody, setPostBody] = useState('')
  const [postAuthor, setPostAuthor] = useState('Eduvate Kids')
  const [postTags, setPostTags] = useState('')
  const [postPublished, setPostPublished] = useState(true)
  const [postPublishedAt, setPostPublishedAt] = useState('')
  const [postLikes, setPostLikes] = useState('0')
  const [postExistingImages, setPostExistingImages] = useState<string[]>([])
  const [postNewImages, setPostNewImages] = useState<File[]>([])
  const [postImagePreviews, setPostImagePreviews] = useState<string[]>([])
  const [blogMessage, setBlogMessage] = useState('')
  const [isSavingPost, setIsSavingPost] = useState(false)
  const [postPreview, setPostPreview] = useState(false)
  const [orders, setOrders] = useState<OnlineOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'paid' | 'shipped' | 'delivered' | 'cancelled'>('all')
  const [expandedOrder, setExpandedOrder] = useState<OnlineOrder | null>(null)
  // Purchase-email controls for the open order: preview draft + manual send.
  const [purchaseEmailPreview, setPurchaseEmailPreview] = useState<OnlineOrder | null>(null)
  const [purchaseEmailSending, setPurchaseEmailSending] = useState(false)
  const [purchaseEmailSentId, setPurchaseEmailSentId] = useState<string | null>(null)
  const [summerReaders, setSummerReaders] = useState<SummerReader[]>([])
  const [summerLoading, setSummerLoading] = useState(false)
  const [expandedReader, setExpandedReader] = useState<SummerReader | null>(null)
  // Tracks the "Resend welcome email" button state for the open reader modal.
  const [welcomeSending, setWelcomeSending] = useState(false)
  const [welcomeSent, setWelcomeSent] = useState<string | null>(null)
  // Per-book validity toggle in-flight index (in the open reader modal).
  const [bookValidityBusy, setBookValidityBusy] = useState<number | null>(null)
  // Eligibility override toggle in-flight (open reader modal).
  const [eligibilityBusy, setEligibilityBusy] = useState(false)
  // Reminder-broadcast modal: open state, sending state, and last result.
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderSending, setReminderSending] = useState(false)
  const [reminderResult, setReminderResult] = useState<{ sent: number; failed: number; recipients: number; test?: boolean } | null>(null)
  // Test-send: a custom recipient to preview the email in a real inbox before
  // the full broadcast, and its own in-flight flag.
  const [reminderTestEmail, setReminderTestEmail] = useState('')
  const [reminderTestSending, setReminderTestSending] = useState(false)
  const [bookRequests, setBookRequests] = useState<BookRequest[]>([])
  const [bookRequestsLoading, setBookRequestsLoading] = useState(false)
  // Daily Pulse figures are hidden by default (privacy on a shared screen);
  // the admin reveals them with the eye toggle in the section header.
  const [pulseVisible, setPulseVisible] = useState(false)
  // Inventory Health: show the top restock items, expand for the full list.
  const [restockExpanded, setRestockExpanded] = useState(false)
  const [inventory, setInventory] = useState<InventoryItem[]>(() => demoMode ? defaultInventory : [])
  const [events, setEvents] = useState<EventRecord[]>(() => demoMode ? defaultEvents : [])
  const [generalSales, setGeneralSales] = useState<Sale[]>([])
  const [uploadMessage, setUploadMessage] = useState<string>('')
  // Inventory item that has no matching catalog entry; prompts the admin to add images/description.
  const [noCatalogPrompt, setNoCatalogPrompt] = useState<InventoryItem | null>(null)
  const [catalogLinkMessage, setCatalogLinkMessage] = useState('')
  const [inventorySortKey, setInventorySortKey] = useState<keyof InventoryItem | ''>('')
  const [inventorySortDir, setInventorySortDir] = useState<'asc' | 'desc'>('asc')
  const [inventorySearch, setInventorySearch] = useState('')
  // How an upload treats the Quantity column for items that already exist:
  //  'add'     — new arrivals; quantity is added to what's on the shelf
  //  'replace' — a stocktake; quantity becomes the sheet's number
  const [uploadMode, setUploadMode] = useState<'add' | 'replace'>('add')
  // Duplicate review panel (grouped by shared SKU / ISBN / title+publisher).
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [mergingGroup, setMergingGroup] = useState<string | null>(null)
  // Resizable Current Stock columns. Widths are in px, keyed by column id, and
  // persisted so a layout tuned for one screen survives a reload.
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = localStorage.getItem('eduvate-inv-col-widths')
      return saved ? (JSON.parse(saved) as Record<string, number>) : {}
    } catch {
      return {}
    }
  })
  const [eventMessage, setEventMessage] = useState('')
  const [newEventName, setNewEventName] = useState('')
  const [newEventCost, setNewEventCost] = useState('')
  const [newEventStart, setNewEventStart] = useState('')
  const [newEventEnd, setNewEventEnd] = useState('')
  const [newEventLocation, setNewEventLocation] = useState('')
  const [newEventType, setNewEventType] =
    useState<EventRecord['type']>('Bazaar')
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [eventTypeFilter, setEventTypeFilter] = useState<'All' | EventRecord['type']>(
    'All'
  )
  const [eventDateStart, setEventDateStart] = useState('')
  const [eventDateEnd, setEventDateEnd] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('general')
  const [searchQuery, setSearchQuery] = useState('')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [addQuantity, setAddQuantity] = useState(1)
  // POS "Scan to cart": camera scanner + a confirmation for the matched bound book.
  const [posScannerOpen, setPosScannerOpen] = useState(false)
  const [scanCartConfirm, setScanCartConfirm] = useState<InventoryItem | null>(null)
  // Inventory "scan to restock": a matched bound book is confirmed with a
  // quantity to add to its stock (rather than opening the full edit form).
  const [scanStockConfirm, setScanStockConfirm] = useState<InventoryItem | null>(null)
  const [scanStockQty, setScanStockQty] = useState(1)
  const [paymentType, setPaymentType] = useState<Sale['paymentType']>('Cash')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Left sidebar: collapsed to an icon-only rail on desktop; slide-in on mobile.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showConfirmSale, setShowConfirmSale] = useState(false)
  const [isSubmittingSale, setIsSubmittingSale] = useState(false)
  const [isSavingInventory, setIsSavingInventory] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage')
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null)
  const [viewingEventTransactions, setViewingEventTransactions] = useState<EventRecord | null>(null)
  const [editEventName, setEditEventName] = useState('')
  const [editEventCost, setEditEventCost] = useState('')
  const [editEventStart, setEditEventStart] = useState('')
  const [editEventEnd, setEditEventEnd] = useState('')
  const [editEventLocation, setEditEventLocation] = useState('')
  const [editEventType, setEditEventType] = useState<EventRecord['type']>('Bazaar')
  const [editEventStatus, setEditEventStatus] = useState<EventStatus>('active')
  const [viewingOrderHistory, setViewingOrderHistory] = useState<EventRecord | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editOrderItems, setEditOrderItems] = useState<OrderItem[]>([])
  const [editOrderPaymentType, setEditOrderPaymentType] = useState<Sale['paymentType']>('Cash')
  const [generalOrders, setGeneralOrders] = useState<Order[]>([])

  // Expense state
  const [viewingExpenses, setViewingExpenses] = useState<EventRecord | null>(null)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState<Expense['category']>('Other')
  const [expenseDate, setExpenseDate] = useState('')
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  // Inventory edit state
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null)
  const [showAddInventoryItem, setShowAddInventoryItem] = useState(false)
  const [inventoryScannerOpen, setInventoryScannerOpen] = useState(false)
  // QR bind + label workflow (inventory)
  const [bindTargetItem, setBindTargetItem] = useState<InventoryItem | null>(null)
  const [qrModalItem, setQrModalItem] = useState<InventoryItem | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [invEditTitle, setInvEditTitle] = useState('')
  const [invEditCategory, setInvEditCategory] = useState<InventoryCategory>('Books')
  const [invEditPublisher, setInvEditPublisher] = useState('')
  const [invEditCode, setInvEditCode] = useState('')
  const [invEditAltCode, setInvEditAltCode] = useState('')
  const [invEditRrp, setInvEditRrp] = useState('')
  const [invEditDiscount, setInvEditDiscount] = useState('')
  const [invEditQuantity, setInvEditQuantity] = useState('')
  const [invEditSellingPrice, setInvEditSellingPrice] = useState('')
  const [invEditWeight, setInvEditWeight] = useState('')

  // Catalog state
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [showCreateCatalog, setShowCreateCatalog] = useState(false)
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null)
  const [catalogTitle, setCatalogTitle] = useState('')
  const [catalogDescription, setCatalogDescription] = useState('')
  const [catalogCategories, setCatalogCategories] = useState<InventoryCategory[]>(['Books'])
  const [catalogAge, setCatalogAge] = useState<AgeCategory[]>(['0+'])
  const [catalogPrice, setCatalogPrice] = useState('')
  const [catalogPublisher, setCatalogPublisher] = useState('')
  // Whether the publisher name is shown to shoppers on the storefront.
  const [catalogShowPublisher, setCatalogShowPublisher] = useState(true)
  /** Shelf slugs this product belongs to. A product may sit on several. */
  const [catalogShelves, setCatalogShelves] = useState<string[]>([])
  const [catalogSku, setCatalogSku] = useState('')
  const [catalogQty, setCatalogQty] = useState('')
  const [catalogSellingPrice, setCatalogSellingPrice] = useState('')
  const [catalogImages, setCatalogImages] = useState<File[]>([])
  const [catalogImagePreviews, setCatalogImagePreviews] = useState<string[]>([])
  const [catalogExistingImages, setCatalogExistingImages] = useState<string[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<'All' | InventoryCategory>('All')
  // Static /book/<slug> pages are generated at build time, so catalog edits
  // are not on the public site until a rebuild runs. This mirrors
  // system/publishState so the admin can see whether one is pending.
  const [publishState, setPublishState] = useState<{
    lastCatalogChangeAt?: number
    lastDispatchAt?: number
    lastError?: string | null
  }>({})
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState('')
  const [isUploadingCatalog, setIsUploadingCatalog] = useState(false)
  const [catalogMessage, setCatalogMessage] = useState('')
  const [catalogSliderIndex, setCatalogSliderIndex] = useState<Record<string, number>>({})
  // When adding a catalog item, an inventory item can be selected to auto-fill
  // publisher, category, price and SKU (stock lives in inventory, so quantity and
  // the secondary selling price are not shown on the catalog form).
  const [catalogFromInventoryId, setCatalogFromInventoryId] = useState('')

  // Fill the catalog form from a chosen inventory item.
  const selectInventoryForCatalog = (invId: string) => {
    setCatalogFromInventoryId(invId)
    const inv = inventory.find((i) => i.id === invId)
    if (!inv) return
    setCatalogTitle(inv.title)
    setCatalogPublisher(inv.publisher)
    setCatalogCategories([inv.category])
    // Main price = the item's selling price (fallback to RRP).
    setCatalogPrice(String(inv.sellingPrice || inv.rrp || ''))
    setCatalogSellingPrice(String(inv.sellingPrice || ''))
    setCatalogQty(String(inv.quantity ?? ''))
    // Prefer the item's SKU; if none, its ISBN, so the catalog links to stock.
    setCatalogSku((inv.code || inv.sku || inv.isbn || '').trim())
  }

  useEffect(() => {
    // Admin backend only permitted from the canonical host; bounce others home.
    if (!isAdminHostAllowed()) {
      router.push('/')
      return
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        // Fetch user role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
          if (userDoc.exists()) {
            const role = userDoc.data().role || 'admin'
            setUserRole(role)
            // Redirect cashiers to POS view
            if (role === 'cashier') {
              setActiveView('pos')
            }
          }
        } catch (error) {
          console.error('Error fetching user role:', error)
        }
        setLoading(false)
      } else {
        router.push('/auth/login')
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleToggleDemoMode = () => {
    const newMode = !demoMode
    setDemoMode(newMode)
    localStorage.setItem('eduvate-demo-mode', String(newMode))
  }

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const loadData = async () => {
      try {
        if (demoMode) {
          // Demo mode: use hardcoded sample data
          if (!cancelled) {
            setInventory(defaultInventory)
            setEvents(defaultEvents)
            setGeneralSales([])
          }
        } else {
          // Live mode: load real data from Firestore
          const inventoryRef = collection(db, 'inventory')
          const eventsRef = collection(db, 'events')
          const generalSalesRef = collection(db, 'generalSales')
          const generalOrdersRef = collection(db, 'generalOrders')
          const [inventorySnap, eventsSnap, generalSalesSnap, generalOrdersSnap] = await Promise.all([
            getDocs(inventoryRef),
            getDocs(eventsRef),
            getDocs(generalSalesRef),
            getDocs(generalOrdersRef)
          ])

          // Check for a flag that indicates the user has real data
          // Items created/uploaded in live mode are tagged with _live: true
          if (!cancelled) {
            const loadedInventory = inventorySnap.docs
              .filter((snap) => snap.data()._live === true)
              .map((snap) => normalizeInventoryItem(snap.data() as Partial<InventoryItem>, snap.id))
              .filter((item) => item.title)
            setInventory(loadedInventory)

            const loadedEvents = eventsSnap.docs
              .filter((snap) => snap.data()._live === true)
              .map((snap) => {
                const data = snap.data() as Partial<EventRecord>
                const sales = Array.isArray(data.sales)
                  ? (data.sales as Partial<Sale>[])
                      .map((sale) => normalizeSale(sale))
                      .filter((sale): sale is Sale => Boolean(sale))
                  : []

                return {
                  id: snap.id,
                  name: String(data.name ?? ''),
                  cost: Number(data.cost ?? 0),
                  startDate: String(data.startDate ?? ''),
                  endDate: String(data.endDate ?? ''),
                  location: String(data.location ?? ''),
                  type: (data.type ?? 'Bazaar') as EventRecord['type'],
                  status: (data.status ?? 'closed') as EventStatus,
                  sales,
                  orders: Array.isArray(data.orders) ? data.orders as Order[] : [],
                  expenses: Array.isArray(data.expenses) ? data.expenses as Expense[] : []
                }
              })

            // ── Recover missing orders/sales from localStorage backup ──
            const recoveredEvents: EventRecord[] = []
            const eventsToResync: EventRecord[] = []
            for (const event of loadedEvents) {
              try {
                const backupOrdersRaw = localStorage.getItem(`eduvate-orders-${event.id}`)
                const backupSalesRaw = localStorage.getItem(`eduvate-sales-${event.id}`)
                if (backupOrdersRaw) {
                  const backupOrders = JSON.parse(backupOrdersRaw) as Order[]
                  const backupSales = backupSalesRaw ? JSON.parse(backupSalesRaw) as Sale[] : null
                  if (backupOrders.length > event.orders.length) {
                    console.warn(`[Recovery] Event "${event.name}": Firebase has ${event.orders.length} orders, localStorage has ${backupOrders.length}. Restoring.`)
                    const restored = {
                      ...event,
                      orders: backupOrders,
                      sales: backupSales && backupSales.length > event.sales.length ? backupSales : event.sales
                    }
                    recoveredEvents.push(restored)
                    eventsToResync.push(restored)
                    continue
                  }
                }
              } catch { /* ignore */ }
              recoveredEvents.push(event)
            }
            setEvents(recoveredEvents)

            // Re-push recovered data back to Firebase so it persists
            for (const event of eventsToResync) {
              try {
                await updateDoc(doc(db, 'events', event.id), {
                  orders: event.orders,
                  sales: event.sales,
                  _live: true
                })
                console.log(`[Recovery] Re-synced "${event.name}" to Firebase (${event.orders.length} orders, ${event.sales.length} sales).`)
              } catch (err) {
                console.error(`[Recovery] Failed to re-sync "${event.name}":`, err)
              }
            }

            const loadedGeneralSales = generalSalesSnap.docs
              .filter((snap) => snap.data()._live === true)
              .map((snap) => normalizeSale(snap.data() as Partial<Sale>))
              .filter((sale): sale is Sale => Boolean(sale))
            setGeneralSales(loadedGeneralSales)

            const loadedGeneralOrders = generalOrdersSnap.docs
              .filter((snap) => snap.data()._live === true)
              .map((snap) => snap.data() as Order)
            setGeneralOrders(loadedGeneralOrders)
          }
        }

        // Always load catalog items from Firestore (not affected by demo mode)
        const catalogSnap = await getDocs(collection(db, 'catalog'))
        if (!cancelled) {
          if (!catalogSnap.empty) {
            const loadedCatalog = await Promise.all(catalogSnap.docs.map(async (snap) => {
              const data = snap.data() as Partial<CatalogItem>
              // Handle both array and single category for backward compatibility
              const categoryData = data.category
              const categoryArray: InventoryCategory[] = Array.isArray(categoryData)
                ? categoryData
                : categoryData
                ? [categoryData as InventoryCategory]
                : ['Books']
              
              // Handle age category as array or single value
              const ageData = data.ageCategory
              let ageArray: AgeCategory[]
              
              if (Array.isArray(ageData)) {
                // Already an array, migrate any old values
                ageArray = ageData.map(age => MIGRATE_AGE_CATEGORY(String(age)))
              } else {
                // Single value, migrate and convert to array
                const migratedAge = MIGRATE_AGE_CATEGORY(String(ageData ?? '0-5'))
                ageArray = [migratedAge]
                
                // Update Firestore to array format
                try {
                  await updateDoc(doc(db, 'catalog', snap.id), {
                    ageCategory: ageArray
                  })
                } catch (err) {
                  console.error('Failed to migrate age category for', snap.id, err)
                }
              }
              
              return {
                id: snap.id,
                title: String(data.title ?? ''),
                description: String(data.description ?? ''),
                category: categoryArray,
                ageCategory: ageArray,
                price: Number(data.price ?? 0),
                publisher: String(data.publisher ?? ''),
                showPublisher: data.showPublisher !== false, // default visible
                stock: data.stock ?? (data as { quantity?: number }).quantity,
                shelves: Array.isArray((data as { shelves?: unknown }).shelves)
                  ? ((data as { shelves: unknown[] }).shelves.map(String))
                  : [],
                sku: data.sku ? String(data.sku) : undefined,
                images: Array.isArray(data.images) ? data.images : [],
                createdAt: String(data.createdAt ?? new Date().toISOString())
              } as CatalogItem
            }))
            setCatalogItems(loadedCatalog)

            // Auto-mirror inventory → catalog stock: inventory is the source of
            // truth, but the public storefront can only read the catalog doc.
            // On load, push each item's live inventory quantity onto its matching
            // catalog doc's `stock` wherever they differ, so out-of-stock (incl.
            // items already at 0) is always accurate without a manual sync.
            try {
              const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()
              // Live inventory (SKU, title, quantity), fetched here so it's in
              // scope regardless of demo/live branch above.
              const invSnap = await getDocs(collection(db, 'inventory'))
              const invList = invSnap.docs
                .filter((snap) => snap.data()._live === true)
                .map((snap) => {
                  const d = snap.data() as { sku?: unknown; title?: unknown; quantity?: unknown }
                  return { sku: String(d.sku ?? ''), title: String(d.title ?? ''), quantity: Math.max(0, Math.round(Number(d.quantity) || 0)) }
                })
              const stockFor = (c: { sku?: string; title: string }): number | null => {
                const cSku = norm(c.sku)
                const inv = invList.find((i) => (cSku && norm(i.sku) === cSku) || norm(i.title) === norm(c.title))
                return inv ? inv.quantity : null
              }
              const reconcile = writeBatch(db)
              let mirrored = 0
              for (const c of loadedCatalog) {
                const qty = stockFor(c)
                if (qty !== null && c.stock !== qty) {
                  reconcile.update(doc(db, 'catalog', c.id), { stock: qty })
                  mirrored += 1
                }
              }
              if (mirrored > 0) {
                await reconcile.commit()
                setCatalogItems((prev) =>
                  prev.map((c) => {
                    const qty = stockFor(c)
                    return qty !== null ? { ...c, stock: qty } : c
                  })
                )
              }
            } catch (mirrorErr) {
              console.error('Stock reconcile (inventory → catalog) failed:', mirrorErr)
            }
          } else {
            setCatalogItems([])
          }
        }
      } catch (error) {
        console.error('Firestore load error:', error)
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [user, demoMode])

  useEffect(() => {
    const activeEvent = events.find((event) => event.status === 'active')
    if (activeEvent && !selectedEventId) {
      setSelectedEventId(activeEvent.id)
    }
  }, [events, selectedEventId])

  const filteredInventory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return inventory
    return inventory.filter((item) =>
      [item.title, item.publisher, item.category].some((field) =>
        field.toLowerCase().includes(query)
      )
    )
  }, [inventory, searchQuery])

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  )

  const discountAmount = useMemo(() => {
    if (discount <= 0) return 0
    if (discountType === 'percentage') {
      const percentage = Math.min(100, Math.max(0, discount))
      return Number((cartTotal * (percentage / 100)).toFixed(2))
    }
    return Math.min(cartTotal, Math.max(0, discount))
  }, [cartTotal, discount, discountType])

  const subtotalAfterDiscount = Number((cartTotal - discountAmount).toFixed(2))
  const convenienceFeeRate = paymentType === 'Card' ? 0.03 : 0
  const convenienceFee = Number((subtotalAfterDiscount * convenienceFeeRate).toFixed(2))
  const totalWithFee = Number((subtotalAfterDiscount + convenienceFee).toFixed(2))

  const allSales = useMemo(
    () =>
      [
        ...events.flatMap((event) =>
          event.sales.map((sale) => ({
            ...sale,
            eventId: event.id,
            eventName: event.name
          }))
        ),
        ...generalSales.map((sale) => ({
          ...sale,
          eventId: 'general',
          eventName: 'General Sales'
        }))
      ],
    [events, generalSales]
  )

  // Units sold per item across POS/event sales AND fulfilled online orders,
  // keyed by BOTH itemId and title so we can tell "sold before" regardless of
  // which key a record used. Used to prioritise restock: an item that has SOLD
  // and is now out of stock is the urgent case; a 0-qty item that never sold is
  // just dead stock and shouldn't crowd the restock radar.
  const unitsSold = useMemo(() => {
    const m = new Map<string, number>()
    const add = (k: string | undefined, q: number) => {
      if (!k) return
      const key = k.toString().toLowerCase()
      m.set(key, (m.get(key) ?? 0) + q)
    }
    allSales.forEach((s) => { add(s.itemId, s.quantity); add(s.title, s.quantity) })
    orders
      .filter((o) => o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered')
      .forEach((o) => (o.items || []).forEach((it) => { add(it.inventoryId, it.quantity); add(it.sku, it.quantity); add(it.title, it.quantity) }))
    return m
  }, [allSales, orders])

  const soldUnits = (item: InventoryItem) =>
    (unitsSold.get(item.id.toLowerCase()) ?? 0) +
    (item.code ? (unitsSold.get(item.code.toLowerCase()) ?? 0) : 0) +
    (unitsSold.get(item.title.toLowerCase()) ?? 0)

  // Restock radar, split into groups by urgency:
  //  1) urgentOut  : out of stock AND sold before (needs reordering now)
  //  2) lowStock   : still has stock but at/under the threshold
  //  3) deadOut    : out of stock but never sold (dead stock, lowest priority)
  const restockGroups = useMemo(() => {
    const urgentOut: InventoryItem[] = []
    const lowStock: InventoryItem[] = []
    const deadOut: InventoryItem[] = []
    inventory.forEach((item) => {
      const qty = item.quantity || 0
      if (qty <= 0) {
        if (soldUnits(item) > 0) urgentOut.push(item)
        else deadOut.push(item)
      } else if (qty <= restockThreshold) {
        lowStock.push(item)
      }
    })
    urgentOut.sort((a, b) => soldUnits(b) - soldUnits(a))
    lowStock.sort((a, b) => a.quantity - b.quantity)
    deadOut.sort((a, b) => a.title.localeCompare(b.title))
    return { urgentOut, lowStock, deadOut }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory, unitsSold])

  // Flat list kept for the "Low Stock Items" summary card count (all items needing
  // attention: urgent out-of-stock + low stock; dead stock excluded from the count).
  const restockItems = useMemo(
    () => [...restockGroups.urgentOut, ...restockGroups.lowStock],
    [restockGroups]
  )

  const bestSellers = useMemo(() => {
    const tally = new Map<string, { title: string; quantity: number; revenue: number }>()
    allSales.forEach((sale) => {
      const current = tally.get(sale.title) ?? {
        title: sale.title,
        quantity: 0,
        revenue: 0
      }
      current.quantity += sale.quantity
      current.revenue += sale.total
      tally.set(sale.title, current)
    })

    return Array.from(tally.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  }, [allSales])

  const categoryMix = useMemo(() => {
    // Tally quantity across EVERY inventory category (books + non-book items like
    // Activity Books, Cards, Games, Others). The previous version only counted
    // 4 hardcoded categories, so non-book stock was silently dropped and the mix
    // was wrong. Bucket any category actually present, in the canonical order.
    const buckets = new Map<InventoryCategory, number>()
    inventory.forEach((item) => {
      const cat = (item.category || 'Others') as InventoryCategory
      buckets.set(cat, (buckets.get(cat) ?? 0) + (item.quantity || 0))
    })
    const present = ALL_CATALOG_CATEGORIES.filter((cat) => (buckets.get(cat) ?? 0) > 0)
    const labels = present.map((cat) => String(cat))
    const values = present.map((cat) => buckets.get(cat) ?? 0)
    return { labels, values }
  }, [inventory])

  const eventTypeBadgeClasses: Record<EventRecord['type'], string> = {
    Bazaar: 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border border-amber-200',
    Bookfair: 'bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 border border-emerald-200',
    'Jummah Boot': 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-700 border border-indigo-200'
  }

  const filteredEvents = useMemo(() => {
    const matchesType = (event: EventRecord) =>
      eventTypeFilter === 'All' || event.type === eventTypeFilter

    const matchesDate = (event: EventRecord) => {
      if (!eventDateStart && !eventDateEnd) return true
      const start = event.startDate ? new Date(event.startDate) : null
      const end = event.endDate ? new Date(event.endDate) : null
      const filterStart = eventDateStart ? new Date(eventDateStart) : null
      const filterEnd = eventDateEnd ? new Date(eventDateEnd) : null

      if (!start || !end) return false
      const rangeStart = filterStart ?? start
      const rangeEnd = filterEnd ?? end
      return start <= rangeEnd && end >= rangeStart
    }

    return events
      .filter((event) => matchesType(event) && matchesDate(event))
      .sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0
        return dateB - dateA
      })
  }, [events, eventTypeFilter, eventDateStart, eventDateEnd])

  const bestEvent = useMemo(() => {
    if (!events.length) return null
    const ranked = events
      .map((event) => {
        const totalSales = event.sales.reduce((sum, sale) => sum + sale.total, 0)
        return { ...event, totalSales }
      })
      .sort((a, b) => b.totalSales - a.totalSales)

    return ranked[0]
  }, [events])

  const salesTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      date.setHours(0, 0, 0, 0)
      return date
    })

    const labels = days.map((day) =>
      day.toLocaleDateString('en-US', { weekday: 'short' })
    )

    const values = days.map((day) => {
      const start = new Date(day)
      const end = new Date(day)
      end.setHours(23, 59, 59, 999)
      return allSales
        .filter((sale) => {
          const timestamp = new Date(sale.timestamp)
          return timestamp >= start && timestamp <= end
        })
        .reduce((sum, sale) => sum + sale.total, 0)
    })

    return { labels, values }
  }, [allSales])

  const paymentBreakdown = useMemo(() => {
    const buckets: Record<string, number> = {}
    allSales.forEach((sale) => {
      const type = sale.paymentType || 'Cash'
      buckets[type] = (buckets[type] ?? 0) + sale.total
    })
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }, [allSales])

  const eventRevenue = useMemo(() => {
    return events
      .map((event) => {
        const totalExpenses = event.expenses.reduce((s, e) => s + e.amount, 0)
        const totalCost = event.cost + totalExpenses
        const revenue = event.sales.reduce((sum, sale) => sum + sale.total, 0)
        const markup = event.sales.reduce((sum, sale) => sum + (sale.sellingPrice - sale.rrp) * sale.quantity, 0)
        return {
          name: event.name.length > 15 ? event.name.slice(0, 15) + '…' : event.name,
          revenue,
          cost: totalCost,
          profit: markup - totalCost
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
  }, [events])

  // Online store orders (Stripe) revenue + count. Paid, shipped or delivered
  // orders count as revenue (a fulfilled sale); cancelled/failed do not.
  const onlineOrderStats = useMemo(() => {
    const countable = orders.filter((o) => o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered')
    const revenue = countable.reduce((sum, o) => sum + (o.total || 0), 0)
    return { count: orders.length, revenue }
  }, [orders])

  // All POS/event order records (each carries subtotal / discount / card fee), so
  // we can separate product revenue from passthrough card fees reliably.
  const allPosOrders = useMemo(
    () => [...events.flatMap((e) => e.orders ?? []), ...generalOrders],
    [events, generalOrders]
  )

  // Reliable revenue breakdown. "Product revenue (net)" is what we actually earned
  // selling items (sellingPrice×qty minus discounts) and EXCLUDES passthroughs
  // (card fees, shipping, sales tax) that we collect but don't keep. The passthrough
  // parts are surfaced separately so the headline number isn't inflated by them.
  const revenueBreakdown = useMemo(() => {
    // POS/event: order.subtotal is the product total before discount/fee.
    const posProductNet = allPosOrders.reduce((s, o) => s + ((o.subtotal || 0) - (o.discount || 0)), 0)
    const posCardFees = allPosOrders.reduce((s, o) => s + (o.convenienceFee || 0), 0)

    // Online (Stripe), fulfilled orders only (paid/shipped/delivered).
    const countable = orders.filter((o) => o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered')
    const onlineProductNet = countable.reduce((s, o) => s + (o.subtotal || 0), 0)
    const onlineShipping = countable.reduce((s, o) => s + (o.shippingFee || 0), 0)
    const onlineTax = countable.reduce((s, o) => s + (o.tax || 0), 0)

    const productNet = posProductNet + onlineProductNet
    const shipping = onlineShipping
    const tax = onlineTax
    const cardFees = posCardFees
    const collected = productNet + shipping + tax + cardFees
    return { productNet, shipping, tax, cardFees, collected, onlineProductNet, posProductNet }
  }, [allPosOrders, orders])

  const summaryCards = useMemo(() => {
    const transactionCount = allSales.length
    // Headline = product revenue (net). Passthroughs shown separately on the card.
    const totalSales = revenueBreakdown.productNet

    return [
      {
        label: 'Total Sales',
        value: totalSales,
        note: `${transactionCount} POS/event + ${onlineOrderStats.count} online · net of tax/shipping/fees`,
        prefix: '$',
        icon: 'sales'
      },
      {
        label: 'Online Orders',
        value: revenueBreakdown.onlineProductNet,
        note: `${onlineOrderStats.count} orders · $${onlineOrderStats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} collected`,
        prefix: '$',
        icon: 'orders'
      },
      {
        label: 'Needs Restock',
        value: restockItems.length,
        note: `${restockGroups.urgentOut.length} sold out · ${restockGroups.lowStock.length} low (≤${restockThreshold})`,
        icon: 'stock'
      },
      {
        label: 'Active Events',
        value: events.filter((event) => event.status === 'active').length,
        note: `${events.length} total events`,
        icon: 'events'
      },
      {
        label: 'Catalog Size',
        value: inventory.length,
        note: 'Books & kits',
        icon: 'catalog'
      }
    ]
  }, [allSales, events, inventory.length, restockItems.length, restockGroups, onlineOrderStats, revenueBreakdown])

  const formatNumber = (value: number) => value.toLocaleString('en-US')

  // ── TXT Receipt Reference File ──────────────────────────────────
  const generateEventTxt = (eventName: string, orders: Order[]) => {
    const lines: string[] = []
    lines.push('═'.repeat(60))
    lines.push(`  EDUVATE KIDS - ${eventName.toUpperCase()}`)
    lines.push(`  Generated: ${new Date().toLocaleString()}`)
    lines.push('═'.repeat(60))
    lines.push('')

    if (orders.length === 0) {
      lines.push('No orders recorded.')
    } else {
      orders.forEach((order, idx) => {
        lines.push(`── Order #${orders.length - idx} ${'─'.repeat(40)}`)
        lines.push(`  Date/Time : ${new Date(order.timestamp).toLocaleString()}`)
        lines.push(`  Payment   : ${order.paymentType}`)
        lines.push(`  Items:`)
        order.items.forEach((item) => {
          lines.push(`    ${item.quantity}× ${item.title}  -  $${item.lineTotal.toFixed(2)}`)
        })
        lines.push(`  Subtotal      : $${order.subtotal.toFixed(2)}`)
        if (order.discount > 0) {
          lines.push(`  Discount (${order.discountType === 'percentage' ? `${order.discountValue}%` : `$${order.discountValue}`}) : -$${order.discount.toFixed(2)}`)
        }
        if (order.convenienceFee > 0) {
          lines.push(`  Card Fee (3%) : +$${order.convenienceFee.toFixed(2)}`)
        }
        lines.push(`  TOTAL         : $${order.total.toFixed(2)}`)
        lines.push('')
      })

      lines.push('═'.repeat(60))
      lines.push('  SUMMARY')
      lines.push('═'.repeat(60))
      const totalRevenue = orders.reduce((s, o) => s + o.total, 0)
      const totalItems = orders.reduce((s, o) => s + o.items.reduce((x, i) => x + i.quantity, 0), 0)
      lines.push(`  Total Orders  : ${orders.length}`)
      lines.push(`  Total Revenue : $${totalRevenue.toFixed(2)}`)
      lines.push(`  Items Sold    : ${totalItems}`)
      lines.push(`  Avg. Order    : $${(orders.length > 0 ? totalRevenue / orders.length : 0).toFixed(2)}`)
    }
    lines.push('')
    lines.push('═'.repeat(60))
    return lines.join('\n')
  }

  const downloadEventTxt = (eventName: string, orders: Order[]) => {
    const content = generateEventTxt(eventName, orders)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const safeName = eventName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    link.download = `eduvate-orders-${safeName}-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/auth/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const persistInventory = async (items: InventoryItem[]) => {
    try {
      const inventoryRef = collection(db, 'inventory')
      const batch = writeBatch(db)
      items.forEach((item) => {
        batch.set(doc(inventoryRef, item.id), { ...item, _live: true })
      })
      await batch.commit()
    } catch (error) {
      console.error('Inventory sync error:', error)
      setUploadMessage('Saved locally, but failed to sync to Firestore.')
    }
  }

  const handleDownloadTemplate = () => {
    const rows = [
      ['Title', 'Category', 'Publisher', 'Code', 'RRP', 'Discount %', 'Quantity', 'Selling Price', 'Weight (g)'],
      ['Sample Title', 'Books', 'Sample Publisher', '9781234567897', 20, 10, 5, 18, 350]
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory')

    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([output], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'eduvate-inventory-template.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportStock = () => {
    if (inventory.length === 0) {
      setUploadMessage('No inventory data to export.')
      return
    }
    const header = ['Title', 'Category', 'Publisher', 'Code', 'Alt Code', 'RRP', 'Discount %', 'Quantity', 'Selling Price', 'Weight (g)']
    const rows = inventory.map((item) => [
      item.title, item.category, item.publisher, item.code || '', item.altCode || '', item.rrp, item.discount, item.quantity, item.sellingPrice, item.weight
    ])
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock')
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([output], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const date = new Date().toISOString().slice(0, 10)
    link.download = `eduvate-stock-export-${date}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleInventoryUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: ''
      }) as Array<Array<string | number>>

      if (!rows.length) {
        setUploadMessage('No rows found in the file.')
        return
      }

      const headerRow = rows[0].map((value) => String(value))
      const normalizedHeaders = headerRow.map(normalizeHeader)
      const mappedHeaders = normalizedHeaders.filter((header) => headerMap[header])
      // A real header row must identify the item AND at least one data column.
      // The old bar (any 3 matches) let a data row masquerade as a header, which
      // silently switched the whole file to positional parsing.
      const hasTitleHeader = mappedHeaders.some((h) => headerMap[h] === 'title')
      const hasHeader = hasTitleHeader && mappedHeaders.length >= 3

      if (!hasHeader) {
        // Positional parsing is a guess about column order. Refuse rather than
        // shredding a sheet into wrong columns (the old behaviour, and the
        // reason uploaded rows arrived with blank weight/discount).
        setUploadMessage(
          '⚠️ Could not read the column headers. Make sure row 1 has a "Title" column plus at least two of: Category, Publisher, Code, RRP, Discount %, Quantity, Selling Price, Weight (g). Download the template for the expected format.'
        )
        event.target.value = ''
        return
      }

      // Which fields the sheet actually carries. Columns that are absent must
      // never overwrite existing values on merge — that is separate from a
      // column that is present but blank for a given row.
      const presentFields = new Set<keyof InventoryItem>(
        mappedHeaders.map((h) => headerMap[h])
      )

      const parsedItems: InventoryItem[] = []
      let skippedRows = 0

      rows.slice(1).forEach((row, index) => {
        const rowValues = row.map((cell) => (cell ?? '').toString())
        const rowData: Partial<InventoryItem> = {}
        let weightIsKg = false

        // A sheet may carry several identifier columns (SKU and ISBN and
        // Barcode) that all map to `code`. Collect them all rather than letting
        // the last column win, then pick the best one below.
        const codeCandidates: string[] = []

        normalizedHeaders.forEach((header, colIndex) => {
          const key = headerMap[header]
          if (!key) return
          const raw = rowValues[colIndex]
          if (key === 'code') {
            const v = String(raw ?? '').trim()
            if (v) codeCandidates.push(v)
            return
          }
          // Don't let a trailing blank column clobber a value already read from
          // an earlier alias of the same field (e.g. both "Price" and "Selling Price").
          if (rowData[key] !== undefined && !String(raw ?? '').trim()) return
          rowData[key] = raw as never
          if (key === 'weight' && KG_WEIGHT_HEADERS.has(header)) weightIsKg = true
        })

        const title = String(rowData.title ?? '').trim()
        if (!title) {
          if (rowValues.some((v) => v.trim())) skippedRows += 1
          return
        }

        // Prefer a scannable barcode; keep any other identifier as altCode.
        const uniqueCodes = [...new Set(codeCandidates)]
        const code = uniqueCodes.find(isIsbn13) ?? uniqueCodes[0] ?? ''
        const altCode = uniqueCodes.find((c) => c !== code) ?? ''

        const rrp = parseNumber(rowData.rrp)
        const discount = parseNumber(rowData.discount)
        const quantity = Math.max(0, Math.round(parseNumber(rowData.quantity)))
        const sellingPriceRaw = parseNumber(rowData.sellingPrice)
        const sellingPrice =
          sellingPriceRaw || Number((rrp * (1 - discount / 100)).toFixed(2))
        const weightRaw = Math.max(0, parseNumber(rowData.weight))
        const weight = weightIsKg ? Math.round(weightRaw * 1000) : weightRaw

        parsedItems.push({
          id: `inv-${Date.now()}-${index}`,
          title,
          category: resolveCategory(rowData.category ?? 'Books'),
          publisher: String(rowData.publisher ?? '').trim(),
          code,
          altCode,
          sku: code,
          isbn: isIsbn13(code) ? code : '',
          rrp,
          discount,
          quantity,
          sellingPrice,
          weight
        })
      })

      if (!parsedItems.length) {
        setUploadMessage('No valid rows found. Every row needs a Title.')
        event.target.value = ''
        return
      }

      const addToStock = uploadMode === 'add'
      let added = 0
      let updated = 0
      let mergedWithinFile = 0
      const currentInventory = [...inventory]

      // Index every identity key of every existing item so a match on ANY of
      // code (any identifier) or normalized title+publisher finds the same row. Rebuilt
      // incrementally as items are appended, so duplicates inside one file
      // collapse together too.
      const keyIndex = new Map<string, number>()
      currentInventory.forEach((existing, idx) => {
        itemMatchKeys(existing).forEach((key) => {
          if (!keyIndex.has(key)) keyIndex.set(key, idx)
        })
      })

      const indexItem = (item: InventoryItem, idx: number) => {
        itemMatchKeys(item).forEach((key) => {
          if (!keyIndex.has(key)) keyIndex.set(key, idx)
        })
      }

      // Which incoming rows have already been folded into a given existing row
      // this upload. First touch replaces/sets the quantity; later touches of
      // the SAME target add to it, so a sheet listing one book on two rows sums
      // correctly even in Replace mode.
      const touched = new Set<number>()

      parsedItems.forEach((item) => {
        // Priority order: SKU beats ISBN beats title+publisher.
        const matchIndex = itemMatchKeys(item)
          .map((key) => keyIndex.get(key))
          .find((idx) => idx !== undefined)

        if (matchIndex === undefined) {
          currentInventory.push(item)
          indexItem(item, currentInventory.length - 1)
          touched.add(currentInventory.length - 1)
          added += 1
          return
        }

        const existing = currentInventory[matchIndex]
        const alreadyTouched = touched.has(matchIndex)

        // Only overwrite a field when the sheet actually supplies a value for
        // it. A missing column, or a blank cell, leaves the existing value
        // alone — this is what stops a partial sheet wiping weight/discount.
        const keep = <K extends keyof InventoryItem>(
          field: K,
          incoming: InventoryItem[K],
          isBlank: (v: InventoryItem[K]) => boolean
        ): InventoryItem[K] =>
          presentFields.has(field) && !isBlank(incoming) ? incoming : existing[field]

        const blankStr = (v: string) => !String(v ?? '').trim()
        const blankNum = (v: number) => !Number.isFinite(v) || v === 0

        const nextQuantity = presentFields.has('quantity')
          ? addToStock || alreadyTouched
            ? existing.quantity + item.quantity
            : item.quantity
          : existing.quantity

        const rrp = keep('rrp', item.rrp, blankNum)
        const discount = presentFields.has('discount') ? item.discount : existing.discount
        // Selling price: take the sheet's if given, else recompute from the
        // resulting rrp/discount, else keep what was there.
        const sellingPrice = presentFields.has('sellingPrice') && !blankNum(item.sellingPrice)
          ? item.sellingPrice
          : rrp > 0 && discount > 0
          ? Number((rrp * (1 - discount / 100)).toFixed(2))
          : existing.sellingPrice || item.sellingPrice

        const nextCode = keep('code', item.code, blankStr)
        // A second, different identifier is preserved rather than dropped.
        const nextAltCode =
          [existing.altCode, existing.code, item.altCode, item.code]
            .map((v) => String(v ?? '').trim())
            .find((v) => v && normalizeCode(v) !== normalizeCode(nextCode)) ?? ''

        currentInventory[matchIndex] = {
          ...existing,
          title: keep('title', item.title, blankStr),
          category: presentFields.has('category') ? item.category : existing.category,
          publisher: keep('publisher', item.publisher, blankStr),
          code: nextCode,
          altCode: nextAltCode,
          sku: nextCode,
          isbn: isIsbn13(nextCode) ? nextCode : '',
          rrp,
          discount,
          sellingPrice,
          weight: keep('weight', item.weight, blankNum),
          quantity: nextQuantity
        }
        // Newly supplied codes become match keys for later rows in this file.
        indexItem(currentInventory[matchIndex], matchIndex)

        if (alreadyTouched) mergedWithinFile += 1
        else updated += 1
        touched.add(matchIndex)
      })

      setInventory(currentInventory)
      const notes = [
        `Added ${added}`,
        `${addToStock ? 'stock added to' : 'updated'} ${updated}`
      ]
      if (mergedWithinFile) notes.push(`${mergedWithinFile} duplicate row${mergedWithinFile === 1 ? '' : 's'} merged`)
      if (skippedRows) notes.push(`${skippedRows} row${skippedRows === 1 ? '' : 's'} skipped (no title)`)
      setUploadMessage(`✅ Upload complete. ${notes.join(', ')}.`)
      await persistInventory(currentInventory)
    } catch (error) {
      console.error('Upload error:', error)
      setUploadMessage('Upload failed. Please check the .xlsx file and try again.')
    } finally {
      // Allow re-selecting the same file (e.g. after fixing headers).
      event.target.value = ''
    }
  }

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) return
    const costValue = parseNumber(newEventCost)
    if (!newEventStart || !newEventEnd) {
      setEventMessage('Please add start and end dates for the event.')
      return
    }
    if (!newEventLocation.trim()) {
      setEventMessage('Please add an event location.')
      return
    }

    const newEvent: EventRecord = {
      id: `event-${Date.now()}`,
      name: newEventName.trim(),
      cost: costValue,
      startDate: newEventStart,
      endDate: newEventEnd,
      location: newEventLocation.trim(),
      type: newEventType,
      status: 'active',
      sales: [],
      orders: [],
      expenses: []
    }

    setEvents((current) => [newEvent, ...current])
    setNewEventName('')
    setNewEventCost('')
    setNewEventStart('')
    setNewEventEnd('')
    setNewEventLocation('')
    setNewEventType('Bazaar')
    setSelectedEventId(newEvent.id)
    setShowCreateEvent(false)

    try {
      await setDoc(doc(db, 'events', newEvent.id), { ...newEvent, _live: true })
    } catch (error) {
      console.error('Create event error:', error)
      setEventMessage('Event saved locally, but failed to sync.')
    }
  }

  const handleToggleEventStatus = async (eventId: string) => {
    const targetEvent = events.find((event) => event.id === eventId)
    if (!targetEvent) return

    // Closed events cannot be reopened via toggle - must edit the event
    if (targetEvent.status === 'closed') {
      setEventMessage('Closed events can only be re-activated by editing the event.')
      return
    }

    const nextStatus: EventStatus = 'closed'

    setEvents((current) =>
      current.map((event) =>
        event.id === eventId ? { ...event, status: nextStatus } : event
      )
    )

    try {
      await updateDoc(doc(db, 'events', eventId), { status: nextStatus, _live: true })
    } catch (error) {
      console.error('Update event status error:', error)
      setEventMessage('Status updated locally, but failed to sync.')
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    const targetEvent = events.find((e) => e.id === eventId)
    if (!targetEvent) return
    if (!confirm(`Delete event "${targetEvent.name}"? This will remove all its sales and orders. This cannot be undone.`)) return
    setEvents((current) => current.filter((e) => e.id !== eventId))
    try {
      await deleteDoc(doc(db, 'events', eventId))
    } catch (error) {
      console.error('Delete event error:', error)
      setEventMessage('Failed to delete event from server.')
    }
  }

  const openEditEvent = (event: EventRecord) => {
    setEditingEvent(event)
    setEditEventName(event.name)
    setEditEventCost(String(event.cost))
    setEditEventStart(event.startDate)
    setEditEventEnd(event.endDate)
    setEditEventLocation(event.location)
    setEditEventType(event.type)
    setEditEventStatus(event.status)
  }

  const handleEditEvent = async () => {
    if (!editingEvent) return
    if (!editEventName.trim()) return
    const costValue = parseNumber(editEventCost)
    if (!editEventStart || !editEventEnd) {
      setEventMessage('Please add start and end dates for the event.')
      return
    }
    if (!editEventLocation.trim()) {
      setEventMessage('Please add an event location.')
      return
    }

    const updatedFields = {
      name: editEventName.trim(),
      cost: costValue,
      startDate: editEventStart,
      endDate: editEventEnd,
      location: editEventLocation.trim(),
      type: editEventType,
      status: editEventStatus
    }

    setEvents((current) =>
      current.map((ev) =>
        ev.id === editingEvent.id ? { ...ev, ...updatedFields } : ev
      )
    )
    setEditingEvent(null)

    try {
      await updateDoc(doc(db, 'events', editingEvent.id), { ...updatedFields, _live: true })
    } catch (error) {
      console.error('Edit event error:', error)
      setEventMessage('Event updated locally, but failed to sync.')
    }
  }

  // Expense handlers
  const openExpenses = (event: EventRecord) => {
    setViewingExpenses(event)
    setShowAddExpense(false)
    resetExpenseForm()
  }

  const resetExpenseForm = () => {
    setExpenseDescription('')
    setExpenseAmount('')
    setExpenseCategory('Other')
    setExpenseDate(new Date().toISOString().slice(0, 10))
    setEditingExpense(null)
  }

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense)
    setExpenseDescription(expense.description)
    setExpenseAmount(String(expense.amount))
    setExpenseCategory(expense.category)
    setExpenseDate(expense.date)
    setShowAddExpense(true)
  }

  const handleSaveExpense = async () => {
    if (!viewingExpenses) return
    if (!expenseDescription.trim()) return
    const amount = parseNumber(expenseAmount)
    if (amount <= 0) return

    const expense: Expense = {
      id: editingExpense?.id ?? `exp-${Date.now()}`,
      description: expenseDescription.trim(),
      amount,
      category: expenseCategory,
      date: expenseDate || new Date().toISOString().slice(0, 10)
    }

    let updatedExpenses: Expense[]
    if (editingExpense) {
      updatedExpenses = viewingExpenses.expenses.map((e) => e.id === editingExpense.id ? expense : e)
    } else {
      updatedExpenses = [expense, ...viewingExpenses.expenses]
    }

    setEvents((current) =>
      current.map((ev) =>
        ev.id === viewingExpenses.id ? { ...ev, expenses: updatedExpenses } : ev
      )
    )
    setViewingExpenses({ ...viewingExpenses, expenses: updatedExpenses })
    setShowAddExpense(false)
    resetExpenseForm()

    try {
      await updateDoc(doc(db, 'events', viewingExpenses.id), { expenses: updatedExpenses, _live: true })
    } catch (error) {
      console.error('Save expense error:', error)
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (!viewingExpenses) return
    if (!confirm('Delete this expense?')) return

    const updatedExpenses = viewingExpenses.expenses.filter((e) => e.id !== expenseId)

    setEvents((current) =>
      current.map((ev) =>
        ev.id === viewingExpenses.id ? { ...ev, expenses: updatedExpenses } : ev
      )
    )
    setViewingExpenses({ ...viewingExpenses, expenses: updatedExpenses })

    try {
      await updateDoc(doc(db, 'events', viewingExpenses.id), { expenses: updatedExpenses, _live: true })
    } catch (error) {
      console.error('Delete expense error:', error)
    }
  }

  // Catalog handlers
  const resetCatalogForm = () => {
    setCatalogTitle('')
    setCatalogDescription('')
    setCatalogCategories(['Books'])
    setCatalogAge(['0+'])
    setCatalogPrice('')
    setCatalogPublisher('')
    setCatalogShowPublisher(true)
    setCatalogSku('')
    setCatalogQty('')
    setCatalogSellingPrice('')
    setCatalogImages([])
    setCatalogImagePreviews([])
    setCatalogExistingImages([])
    setCatalogFromInventoryId('')
    setCatalogShelves([])
  }

  // Open the catalog create form prefilled from an inventory item that lacks a
  // catalog entry, so an admin can add an image and description for it.
  const openCatalogFormFromInventory = (item: InventoryItem) => {
    resetCatalogForm()
    setEditingCatalogItem(null)
    setCatalogTitle(item.title)
    setCatalogPublisher(item.publisher)
    setCatalogPrice(item.rrp ? String(item.rrp) : String(item.sellingPrice || ''))
    setCatalogCategories([item.category])
    setCatalogSku(item.sku || '')
    setCatalogQty(String(item.quantity ?? ''))
    setCatalogSellingPrice(item.sellingPrice ? String(item.sellingPrice) : '')
    setShowCreateCatalog(true)
  }

  const handleCatalogImageSelect = (files: FileList | null) => {
    if (!files) return
    const currentCount = catalogImages.length + catalogExistingImages.length
    const remaining = 5 - currentCount
    if (remaining <= 0) {
      setCatalogMessage('Maximum 5 images allowed.')
      return
    }
    const newFiles = Array.from(files).slice(0, remaining)
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file))
    setCatalogImages((prev) => [...prev, ...newFiles])
    setCatalogImagePreviews((prev) => [...prev, ...newPreviews])
  }

  const handleRemoveCatalogNewImage = (index: number) => {
    setCatalogImages((prev) => prev.filter((_, i) => i !== index))
    setCatalogImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleRemoveCatalogExistingImage = (index: number) => {
    setCatalogExistingImages((prev) => prev.filter((_, i) => i !== index))
  }

  const fileToBase64 = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = document.createElement('img')
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let { width, height } = img
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('Canvas not supported')); return }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/webp', quality))
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const convertFilesToBase64 = async (files: File[]): Promise<string[]> => {
    const results: string[] = []
    for (const file of files) {
      const base64 = await fileToBase64(file)
      results.push(base64)
    }
    return results
  }

  // Upload each file to Firebase Storage and return its download URL. If an
  // upload throws (e.g. Storage not yet configured), fall back to base64 for
  // that one file so catalog images still work.
  const uploadCatalogFiles = async (files: File[], keyPrefix: string): Promise<string[]> => {
    const results: string[] = []
    for (const file of files) {
      try {
        const url = await uploadCatalogImage(file, keyPrefix)
        results.push(url)
      } catch (err) {
        console.error('Storage upload failed, falling back to base64:', err)
        const [b64] = await convertFilesToBase64([file])
        if (b64) results.push(b64)
      }
    }
    return results
  }

  // Upsert an inventory doc keyed by SKU from catalog form values. Updates the
  // local inventory state and Firestore. Returns the resolved inventory id.
  const upsertInventoryFromCatalog = async (opts: {
    title: string
    publisher: string
    category: InventoryCategory
    price: number
    sku: string
    quantity: number
    sellingPrice: number
  }): Promise<string> => {
    const sku = opts.sku.trim()
    // The catalog's "sku" is just an item code; match it against the unified
    // code field (falling back to the legacy mirror on not-yet-migrated docs).
    const existing = inventory.find(
      (i) => sku && normalizeCode(i.code || i.sku) === normalizeCode(sku)
    )
    const invId = existing ? existing.id : `inv-${Date.now()}`
    const invItem: InventoryItem = existing
      ? {
          ...existing,
          title: opts.title,
          publisher: opts.publisher,
          category: opts.category,
          code: sku || existing.code,
          sku: sku || existing.sku,
          isbn: isIsbn13(sku) ? sku : existing.isbn,
          quantity: opts.quantity,
          sellingPrice: opts.sellingPrice || opts.price
        }
      : {
          id: invId,
          title: opts.title,
          category: opts.category,
          publisher: opts.publisher,
          code: sku,
          altCode: '',
          sku,
          isbn: isIsbn13(sku) ? sku : '',
          rrp: opts.price,
          discount: 0,
          quantity: opts.quantity,
          sellingPrice: opts.sellingPrice || opts.price,
          weight: 0
        }
    setInventory((current) =>
      existing ? current.map((i) => (i.id === invId ? invItem : i)) : [...current, invItem]
    )
    await setDoc(doc(db, 'inventory', invId), { ...invItem, _live: true })
    return invId
  }

  const handleCreateCatalogItem = async () => {
    if (!catalogTitle.trim()) { setCatalogMessage('Title is required.'); return }
    if (!catalogDescription.trim()) { setCatalogMessage('Description is required.'); return }
    if (!catalogPublisher.trim()) { setCatalogMessage('Publisher is required.'); return }
    if (catalogCategories.length === 0) { setCatalogMessage('At least 1 category is required.'); return }
    // Images are optional: an item can be added now and given images later.
    // Until then, a book placeholder is shown wherever the item appears.

    setIsUploadingCatalog(true)
    setCatalogMessage('')
    const itemId = `catalog-${Date.now()}`

    try {
      const skuVal = catalogSku.trim()
      const price = parseNumber(catalogPrice)
      const imageUrls = await uploadCatalogFiles(catalogImages, skuVal || itemId)
      // Stock: written whenever the admin provides a quantity (0 = out of stock).
      // Left off entirely when blank so untracked items stay "available".
      const stockVal = catalogQty.trim() === '' ? undefined : Math.max(0, Math.round(parseNumber(catalogQty)))
      const newItem: CatalogItem = {
        id: itemId,
        title: catalogTitle.trim(),
        description: catalogDescription.trim(),
        category: catalogCategories,
        ageCategory: catalogAge,
        price,
        publisher: catalogPublisher.trim(),
        showPublisher: catalogShowPublisher,
        images: imageUrls,
        createdAt: new Date().toISOString(),
        sku: skuVal,
        shelves: catalogShelves,
        ...(stockVal !== undefined ? { stock: stockVal } : {})
      }

      setCatalogItems((prev) => [newItem, ...prev])
      resetCatalogForm()
      setShowCreateCatalog(false)

      await setDoc(doc(db, 'catalog', itemId), newItem)

      // Linked upsert: if a SKU is provided, mirror this into inventory.
      if (skuVal) {
        try {
          await upsertInventoryFromCatalog({
            title: newItem.title,
            publisher: newItem.publisher,
            category: catalogCategories[0] || 'Books',
            price,
            sku: skuVal,
            quantity: Number(catalogQty) || 0,
            sellingPrice: Number(catalogSellingPrice) || 0
          })
        } catch (invErr) {
          console.error('Inventory upsert from catalog failed:', invErr)
        }
      }
    } catch (error) {
      console.error('Create catalog item error:', error)
      setCatalogMessage('Failed to create catalog item. Please try again.')
    } finally {
      setIsUploadingCatalog(false)
    }
  }

  const openEditCatalogItem = (item: CatalogItem) => {
    setEditingCatalogItem(item)
    setCatalogShelves(item.shelves || [])
    setCatalogTitle(item.title)
    setCatalogDescription(item.description)
    setCatalogCategories(Array.isArray(item.category) ? item.category : [item.category])
    setCatalogAge(item.ageCategory)
    setCatalogPrice(String(item.price))
    setCatalogPublisher(item.publisher)
    setCatalogShowPublisher(item.showPublisher !== false)
    // Prefer sku from the catalog item; else fall back to a linked inventory item by title.
    const linkedInv = inventory.find(
      (i) => (item.sku && (i.sku || '') === item.sku) ||
        i.title.trim().toLowerCase() === item.title.trim().toLowerCase()
    )
    setCatalogSku(item.sku || linkedInv?.sku || '')
    setCatalogQty(linkedInv ? String(linkedInv.quantity ?? '') : (typeof item.stock === 'number' ? String(item.stock) : ''))
    setCatalogSellingPrice(linkedInv && linkedInv.sellingPrice ? String(linkedInv.sellingPrice) : '')
    setCatalogExistingImages([...item.images])
    setCatalogImages([])
    setCatalogImagePreviews([])
  }

  const handleEditCatalogItem = async () => {
    if (!editingCatalogItem) return
    if (!catalogTitle.trim()) { setCatalogMessage('Title is required.'); return }
    if (!catalogDescription.trim()) { setCatalogMessage('Description is required.'); return }
    if (!catalogPublisher.trim()) { setCatalogMessage('Publisher is required.'); return }
    // Images are optional; a placeholder is shown until they are added.

    setIsUploadingCatalog(true)
    setCatalogMessage('')

    try {
      const skuVal = catalogSku.trim()
      const price = parseNumber(catalogPrice)
      let newImageUrls: string[] = []
      if (catalogImages.length > 0) {
        newImageUrls = await uploadCatalogFiles(catalogImages, skuVal || editingCatalogItem.id)
      }

      const allImages = [...catalogExistingImages, ...newImageUrls]
      const stockVal = catalogQty.trim() === '' ? undefined : Math.max(0, Math.round(parseNumber(catalogQty)))
      const updatedFields = {
        title: catalogTitle.trim(),
        description: catalogDescription.trim(),
        category: catalogCategories,
        ageCategory: catalogAge,
        price,
        publisher: catalogPublisher.trim(),
        showPublisher: catalogShowPublisher,
        images: allImages,
        sku: skuVal,
        shelves: catalogShelves,
        ...(stockVal !== undefined ? { stock: stockVal } : {})
      }

      setCatalogItems((prev) =>
        prev.map((item) =>
          item.id === editingCatalogItem.id ? { ...item, ...updatedFields } : item
        )
      )
      setEditingCatalogItem(null)
      resetCatalogForm()

      await updateDoc(doc(db, 'catalog', editingCatalogItem.id), updatedFields)

      // Linked upsert: if a SKU is provided, mirror this into inventory.
      if (skuVal) {
        try {
          await upsertInventoryFromCatalog({
            title: updatedFields.title,
            publisher: updatedFields.publisher,
            category: catalogCategories[0] || 'Books',
            price,
            sku: skuVal,
            quantity: Number(catalogQty) || 0,
            sellingPrice: Number(catalogSellingPrice) || 0
          })
        } catch (invErr) {
          console.error('Inventory upsert from catalog failed:', invErr)
        }
      }
    } catch (error) {
      console.error('Edit catalog item error:', error)
      setCatalogMessage('Failed to update catalog item. Please try again.')
    } finally {
      setIsUploadingCatalog(false)
    }
  }

  // One-time reconcile: link catalog items to inventory items by SKU. For each
  // catalog item without a SKU, find an inventory item with the same (trimmed,
  // case-insensitive) title. If found, copy its SKU to the catalog item; if that
  // inventory item also lacks a SKU, generate one and write it to BOTH. Runs only
  // on click. Batches all writes and updates local state.
  const [isLinkingCatalog, setIsLinkingCatalog] = useState(false)
  // Live view of publish state, so the Catalog tab can say whether the public
  // product pages are behind the catalog.
  useEffect(() => {
    if (userRole !== 'admin' || demoMode) return
    // Watched for both the Catalog banner and the Website tab, since either can
    // leave the static pages behind.
    const unsub = onSnapshot(
      doc(db, 'system', 'publishState'),
      (snap) => {
        const d = snap.data() as
          | {
              lastCatalogChangeAt?: { toMillis: () => number }
              lastDispatchAt?: { toMillis: () => number }
              lastError?: string | null
            }
          | undefined
        setPublishState({
          lastCatalogChangeAt: d?.lastCatalogChangeAt?.toMillis(),
          lastDispatchAt: d?.lastDispatchAt?.toMillis(),
          lastError: d?.lastError ?? null
        })
      },
      // A missing doc or a rules denial should not break the Catalog tab.
      () => setPublishState({})
    )
    return () => unsub()
  }, [userRole, demoMode])

  /** True when the catalog changed after the most recent site build. */
  const publishPending =
    !!publishState.lastCatalogChangeAt &&
    publishState.lastCatalogChangeAt > (publishState.lastDispatchAt ?? 0)

  const handlePublishNow = async () => {
    setIsPublishing(true)
    setPublishMessage('')
    try {
      const callable = httpsCallable<
        Record<string, never>,
        { status: 'dispatched' | 'throttled'; retryAfterSeconds?: number }
      >(functions, 'requestPublish')
      const { data } = await callable({})
      if (data.status === 'throttled') {
        const mins = Math.ceil((data.retryAfterSeconds ?? 0) / 60)
        setPublishMessage(
          `A build ran very recently. Try again in about ${mins} minute${mins === 1 ? '' : 's'}.`
        )
      } else {
        setPublishMessage(
          '✅ Publishing started. The product pages go live in about 2 minutes.'
        )
      }
    } catch (error) {
      console.error('Publish error:', error)
      setPublishMessage('⚠️ Could not start publishing. Please try again.')
    } finally {
      setIsPublishing(false)
    }
  }

  // ── Shelves ────────────────────────────────────────────────────────────────
  // Loaded for the Website tab and for the catalog form's shelf picker.
  useEffect(() => {
    if ((activeView !== 'website' && activeView !== 'catalog') || demoMode) return
    let cancelled = false
    setShelvesLoading(true)
    getDocs(collection(db, 'shelves'))
      .then((snap) => {
        if (cancelled) return
        setShelves(
          snap.docs.map((d) => normalizeShelf(d.data() as Record<string, unknown>, d.id)).sort(sortShelves)
        )
      })
      .catch((error) => {
        console.error('Load shelves error:', error)
        if (!cancelled) setShelfMessage('Could not load shelves.')
      })
      .finally(() => !cancelled && setShelvesLoading(false))
    return () => {
      cancelled = true
    }
  }, [activeView, demoMode])

  const resetShelfForm = () => {
    setEditingShelf(null)
    setShelfName('')
    setShelfDescription('')
    setShelfOrder('')
  }

  const handleSaveShelf = async () => {
    const name = shelfName.trim()
    if (!name) {
      setShelfMessage('Give the shelf a name.')
      return
    }
    // The slug is the key products store, so it must stay stable once created.
    // Renaming an existing shelf keeps its original slug to avoid orphaning
    // every product already assigned to it.
    const slug = editingShelf ? editingShelf.slug : shelfSlug(name)
    if (!slug) {
      setShelfMessage('That name cannot be turned into a web address. Try adding a letter or number.')
      return
    }
    const clash = shelves.find((s) => s.slug === slug && s.id !== editingShelf?.id)
    if (clash) {
      setShelfMessage(`"${clash.name}" already uses that web address. Pick a different name.`)
      return
    }

    setIsSavingShelf(true)
    setShelfMessage('')
    const id = editingShelf ? editingShelf.id : `shelf-${Date.now()}`
    const record: Shelf = {
      id,
      name,
      slug,
      description: shelfDescription.trim(),
      order: shelfOrder.trim() === '' ? shelves.length : Math.round(parseNumber(shelfOrder)),
      active: editingShelf ? editingShelf.active : true,
      createdAt: editingShelf?.createdAt || new Date().toISOString()
    }

    try {
      await setDoc(doc(db, 'shelves', id), record)
      setShelves((prev) =>
        (editingShelf ? prev.map((s) => (s.id === id ? record : s)) : [...prev, record]).sort(sortShelves)
      )
      setShelfMessage(editingShelf ? `Updated "${name}".` : `Created "${name}".`)
      resetShelfForm()
    } catch (error) {
      console.error('Save shelf error:', error)
      setShelfMessage('Could not save the shelf. Please try again.')
    } finally {
      setIsSavingShelf(false)
    }
  }

  const handleToggleShelfActive = async (shelf: Shelf) => {
    const next = { ...shelf, active: !shelf.active }
    setShelves((prev) => prev.map((s) => (s.id === shelf.id ? next : s)))
    try {
      await updateDoc(doc(db, 'shelves', shelf.id), { active: next.active })
    } catch (error) {
      console.error('Toggle shelf error:', error)
      setShelves((prev) => prev.map((s) => (s.id === shelf.id ? shelf : s)))
      setShelfMessage('Could not change visibility. Please try again.')
    }
  }

  const handleDeleteShelf = async (shelf: Shelf) => {
    const assigned = catalogItems.filter((c) => (c.shelves || []).includes(shelf.slug))
    const warning = assigned.length
      ? `\n\n${assigned.length} book${assigned.length === 1 ? ' is' : 's are'} on this shelf. ` +
        `They will stay in the catalog but lose this shelf.`
      : ''
    if (!confirm(`Delete the shelf "${shelf.name}"?${warning}`)) return

    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, 'shelves', shelf.id))
      // Strip the slug from every product that referenced it, so no product is
      // left pointing at a shelf that no longer exists.
      assigned.forEach((c) => {
        batch.update(doc(db, 'catalog', c.id), {
          shelves: (c.shelves || []).filter((s) => s !== shelf.slug)
        })
      })
      await batch.commit()
      setShelves((prev) => prev.filter((s) => s.id !== shelf.id))
      setCatalogItems((prev) =>
        prev.map((c) =>
          (c.shelves || []).includes(shelf.slug)
            ? { ...c, shelves: (c.shelves || []).filter((s) => s !== shelf.slug) }
            : c
        )
      )
      setShelfMessage(`Deleted "${shelf.name}".`)
    } catch (error) {
      console.error('Delete shelf error:', error)
      setShelfMessage('Could not delete the shelf. Please try again.')
    }
  }

  /** How many catalog products sit on a given shelf. */
  const shelfBookCount = (slug: string) =>
    catalogItems.filter((c) => (c.shelves || []).includes(slug)).length

  // ── Blog ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeView !== 'website' || demoMode) return
    let cancelled = false
    setBlogLoading(true)
    getDocs(collection(db, 'blog'))
      .then((snap) => {
        if (cancelled) return
        setBlogPosts(
          snap.docs.map((d) => normalizeBlogPost(d.data() as Record<string, unknown>, d.id)).sort(sortPosts)
        )
      })
      .catch((error) => {
        console.error('Load blog error:', error)
        if (!cancelled) setBlogMessage('Could not load posts.')
      })
      .finally(() => !cancelled && setBlogLoading(false))
    return () => {
      cancelled = true
    }
  }, [activeView, demoMode])

  // Object URLs for newly picked images, revoked when they change so the
  // browser does not hold on to blobs for images the admin swapped out.
  useEffect(() => {
    const urls = postNewImages.map((f) => URL.createObjectURL(f))
    setPostImagePreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [postNewImages])

  const resetPostForm = () => {
    setEditingPost(null)
    setPostTitle('')
    setPostExcerpt('')
    setPostBody('')
    setPostAuthor('Eduvate Kids')
    setPostTags('')
    setPostPublished(true)
    setPostPublishedAt(new Date().toISOString().slice(0, 10))
    setPostLikes('0')
    setPostExistingImages([])
    setPostNewImages([])
    setPostPreview(false)
  }

  const openNewPost = () => {
    resetPostForm()
    setShowPostEditor(true)
    setBlogMessage('')
  }

  const openEditPost = (post: BlogPost) => {
    setEditingPost(post)
    setPostTitle(post.title)
    setPostExcerpt(post.excerpt)
    setPostBody(post.body)
    setPostAuthor(post.author)
    setPostTags(post.tags.join(', '))
    setPostPublished(post.published)
    setPostPublishedAt((post.publishedAt || '').slice(0, 10))
    setPostLikes(String(post.likes))
    setPostExistingImages([...post.images])
    setPostNewImages([])
    setPostPreview(false)
    setShowPostEditor(true)
    setBlogMessage('')
  }

  /**
   * Accept a dropped or picked .md file by reading it straight into the body.
   * The text stays fully editable afterwards; nothing is stored as an opaque
   * attachment.
   */
  const handleMarkdownFile = async (file: File | undefined) => {
    if (!file) return
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setBlogMessage('That is not a Markdown file. Pick a .md, .markdown or .txt file.')
      return
    }
    const text = await file.text()
    setPostBody(text)
    // A leading "# Heading" is the document's title; lift it into the title
    // field rather than repeating it at the top of the article body.
    const heading = text.match(/^\s*#\s+(.+)$/m)
    if (heading && !postTitle.trim()) setPostTitle(heading[1].trim())
    setBlogMessage(`Loaded ${file.name}. Edit it below as normal.`)
  }

  const handleSavePost = async () => {
    const title = postTitle.trim()
    if (!title) {
      setBlogMessage('Give the post a title.')
      return
    }
    if (!postBody.trim()) {
      setBlogMessage('The post has no content yet.')
      return
    }
    // Slug is fixed at creation: it is the public URL, and changing it on
    // rename would break every link already shared.
    const slug = editingPost ? editingPost.slug : blogSlug(title)
    if (!slug) {
      setBlogMessage('That title cannot be turned into a web address. Add a letter or number.')
      return
    }
    const clash = blogPosts.find((p) => p.slug === slug && p.id !== editingPost?.id)
    if (clash) {
      setBlogMessage(`"${clash.title}" already uses that web address. Pick a different title.`)
      return
    }

    setIsSavingPost(true)
    setBlogMessage('')
    const id = editingPost ? editingPost.id : `post-${Date.now()}`

    try {
      const uploaded: string[] = []
      for (const file of postNewImages) {
        uploaded.push(await uploadBlogImage(file, id))
      }
      const now = new Date().toISOString()
      const record: BlogPost = {
        id,
        title,
        slug,
        excerpt: postExcerpt.trim() || deriveExcerpt(postBody),
        body: postBody,
        author: postAuthor.trim() || 'Eduvate Kids',
        publishedAt: postPublishedAt ? new Date(postPublishedAt).toISOString() : now,
        published: postPublished,
        images: [...postExistingImages, ...uploaded],
        tags: postTags.split(',').map((t) => t.trim()).filter(Boolean),
        likes: Math.max(0, Math.round(parseNumber(postLikes))),
        createdAt: editingPost?.createdAt || now,
        updatedAt: now
      }

      await setDoc(doc(db, 'blog', id), record)
      setBlogPosts((prev) =>
        (editingPost ? prev.map((p) => (p.id === id ? record : p)) : [...prev, record]).sort(sortPosts)
      )
      setBlogMessage(editingPost ? `Updated "${title}".` : `Created "${title}".`)
      setShowPostEditor(false)
      resetPostForm()
    } catch (error) {
      console.error('Save post error:', error)
      setBlogMessage('Could not save the post. Please try again.')
    } finally {
      setIsSavingPost(false)
    }
  }

  const handleTogglePostPublished = async (post: BlogPost) => {
    const next = { ...post, published: !post.published }
    setBlogPosts((prev) => prev.map((p) => (p.id === post.id ? next : p)))
    try {
      await updateDoc(doc(db, 'blog', post.id), { published: next.published })
    } catch (error) {
      console.error('Toggle post error:', error)
      setBlogPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)))
      setBlogMessage('Could not change visibility. Please try again.')
    }
  }

  const handleDeletePost = async (post: BlogPost) => {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return
    const previous = blogPosts
    setBlogPosts((prev) => prev.filter((p) => p.id !== post.id))
    try {
      await deleteDoc(doc(db, 'blog', post.id))
      setBlogMessage(`Deleted "${post.title}".`)
    } catch (error) {
      console.error('Delete post error:', error)
      setBlogPosts(previous)
      setBlogMessage('Could not delete the post. Please try again.')
    }
  }

  /** Set the like count outright. Public hearts increment it via a function. */
  const handleSetPostLikes = async (post: BlogPost, likes: number) => {
    const safe = Math.max(0, Math.round(likes))
    const next = { ...post, likes: safe }
    setBlogPosts((prev) => prev.map((p) => (p.id === post.id ? next : p)))
    try {
      await updateDoc(doc(db, 'blog', post.id), { likes: safe })
    } catch (error) {
      console.error('Set likes error:', error)
      setBlogPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)))
      setBlogMessage('Could not update likes. Please try again.')
    }
  }

  const handleLinkCatalogInventory = async () => {
    setIsLinkingCatalog(true)
    setCatalogLinkMessage('')
    try {
      const batch = writeBatch(db)
      const catalogUpdates = new Map<string, string>() // catalogId -> sku
      const inventoryUpdates = new Map<string, string>() // inventoryId -> sku
      const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

      let linked = 0
      // Mirror the live inventory quantity onto each matched catalog doc's
      // `stock` so the storefront's in/out-of-stock state is always correct
      // (including 0 = out of stock). Match by SKU first, then by title.
      const stockUpdates = new Map<string, number>() // catalogId -> stock
      for (const c of catalogItems) {
        const cSku = (c.sku || '').trim()
        const match = inventory.find(
          (i) => (cSku && (i.sku || '').trim() === cSku) ||
                 i.title.trim().toLowerCase() === c.title.trim().toLowerCase()
        )
        if (!match) continue

        // Link SKUs for items that don't have one yet.
        if (!cSku) {
          let sku = (match.sku || '').trim()
          if (!sku) {
            sku = `EK-${slugify(c.title) || match.id}`
            inventoryUpdates.set(match.id, sku)
          }
          catalogUpdates.set(c.id, sku)
          linked += 1
        }

        // Mirror stock when the catalog doc is missing/out of sync.
        const qty = Math.max(0, Math.round(match.quantity ?? 0))
        if (c.stock !== qty) stockUpdates.set(c.id, qty)
      }

      catalogUpdates.forEach((sku, id) => batch.update(doc(db, 'catalog', id), { sku }))
      inventoryUpdates.forEach((sku, id) => batch.update(doc(db, 'inventory', id), { sku }))
      stockUpdates.forEach((stock, id) => batch.update(doc(db, 'catalog', id), { stock }))

      if (catalogUpdates.size > 0 || inventoryUpdates.size > 0 || stockUpdates.size > 0) {
        await batch.commit()
        setCatalogItems((prev) =>
          prev.map((c) => ({
            ...c,
            ...(catalogUpdates.has(c.id) ? { sku: catalogUpdates.get(c.id) } : {}),
            ...(stockUpdates.has(c.id) ? { stock: stockUpdates.get(c.id) } : {}),
          }))
        )
        setInventory((prev) =>
          prev.map((i) => (inventoryUpdates.has(i.id) ? { ...i, sku: inventoryUpdates.get(i.id) as string } : i))
        )
      }
      setCatalogLinkMessage(`Linked ${linked} product${linked === 1 ? '' : 's'}; synced stock for ${stockUpdates.size}.`)
    } catch (error) {
      console.error('Link catalog and inventory error:', error)
      setCatalogLinkMessage('Failed to link. Please try again.')
    } finally {
      setIsLinkingCatalog(false)
    }
  }

  const handleDeleteCatalogItem = async (itemId: string) => {
    const item = catalogItems.find((i) => i.id === itemId)
    if (!item) return

    setCatalogItems((prev) => prev.filter((i) => i.id !== itemId))

    try {
      await deleteDoc(doc(db, 'catalog', itemId))
    } catch (error) {
      console.error('Delete catalog item error:', error)
      setCatalogMessage('Item removed locally, but failed to sync deletion.')
    }
  }

  const filteredCatalogItems = useMemo(() => {
    return catalogItems.filter((item) => {
      const matchesSearch = !catalogSearch ||
        item.title.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        item.publisher.toLowerCase().includes(catalogSearch.toLowerCase())
      const itemCategories = Array.isArray(item.category) ? item.category : [item.category]
      const matchesCategory = catalogCategoryFilter === 'All' || itemCategories.includes(catalogCategoryFilter)
      return matchesSearch && matchesCategory
    })
  }, [catalogItems, catalogSearch, catalogCategoryFilter])

  const inventoryTitles = useMemo(() =>
    [...new Set(inventory.map((i) => i.title).filter(Boolean))].sort(),
    [inventory]
  )
  const inventoryPublishers = useMemo(() =>
    [...new Set(inventory.map((i) => i.publisher).filter(Boolean))].sort(),
    [inventory]
  )
  const inventoryCategories = useMemo(() =>
    [...new Set(inventory.map((i) => i.category).filter(Boolean))].sort(),
    [inventory]
  )
  // Inventory items that are NOT yet represented in the catalog (matched by
  // shared SKU or by title). These are the only items offered in the "Add from
  // inventory" picker, so a book already in the catalog can't be added twice.
  // Deleting a catalog item makes its inventory item eligible again.
  const inventoryNotInCatalog = useMemo(() => {
    const catSkus = new Set(
      catalogItems.map((c) => (c.sku || '').trim().toLowerCase()).filter(Boolean)
    )
    const catTitles = new Set(
      catalogItems.map((c) => c.title.trim().toLowerCase()).filter(Boolean)
    )
    return inventory.filter((i) => {
      const sku = (i.sku || '').trim().toLowerCase()
      const title = i.title.trim().toLowerCase()
      const inCatalog = (sku && catSkus.has(sku)) || (title && catTitles.has(title))
      return !inCatalog
    })
  }, [inventory, catalogItems])

  const handleAddToCart = (itemId: string, qtyOverride?: number) => {
    const item = inventory.find((stock) => stock.id === itemId)
    if (!item) return

    const quantity = Math.max(1, Math.round(qtyOverride ?? addQuantity))
    const existing = cartItems.find((cartItem) => cartItem.itemId === itemId)
    const currentQty = existing?.quantity ?? 0
    const available = item.quantity - currentQty

    if (available <= 0) {
      setEventMessage('No remaining stock available for this item.')
      return
    }

    if (quantity > available) {
      setEventMessage(`Only ${available} left for ${item.title}.`)
      return
    }

    setCartItems((current) => {
      if (!existing) {
        return [
          ...current,
          { itemId: item.id, title: item.title, price: item.sellingPrice, quantity }
        ]
      }
      return current.map((cartItem) =>
        cartItem.itemId === itemId
          ? { ...cartItem, quantity: cartItem.quantity + quantity }
          : cartItem
      )
    })

    setAddQuantity(1)
    setEventMessage(`${item.title} added to cart.`)
  }

  // POS scan-to-cart: a scanned/typed code is matched to a bound inventory item.
  // Since the same QR/ISBN is shared by all copies of the same book, a match
  // means "add one of this book", so we surface a confirmation before it hits the
  // cart. Actual stock is deducted when the sale is completed (handleRecordSale),
  // so adding to cart reserves one unit against remaining stock.
  const handlePosScan = (raw: string) => {
    const code = raw.trim().toLowerCase()
    if (!code) return
    const match = inventory.find((i) => itemMatchesCode(i, raw))
    if (!match) {
      setEventMessage(`No bound book matches "${raw.trim()}". Bind it to an item in Inventory first.`)
      return
    }
    setPosScannerOpen(false)
    setScanCartConfirm(match)
  }

  // Confirm the scanned book → add one unit to the cart (respecting stock).
  const confirmScanToCart = () => {
    const item = scanCartConfirm
    setScanCartConfirm(null)
    if (!item) return
    handleAddToCart(item.id, 1)
  }

  const handleUpdateCartQuantity = (itemId: string, nextValue: number) => {
    const item = inventory.find((stock) => stock.id === itemId)
    if (!item) return

    const quantity = Math.max(0, Math.round(nextValue))
    const clamped = Math.min(quantity, item.quantity)

    if (quantity > item.quantity) {
      setEventMessage(`Only ${item.quantity} available for ${item.title}.`)
    }

    setCartItems((current) => {
      if (clamped <= 0) {
        return current.filter((cartItem) => cartItem.itemId !== itemId)
      }
      return current.map((cartItem) =>
        cartItem.itemId === itemId ? { ...cartItem, quantity: clamped } : cartItem
      )
    })
  }

  const handleRemoveFromCart = (itemId: string) => {
    setCartItems((current) => current.filter((cartItem) => cartItem.itemId !== itemId))
  }

  const handleClearCart = () => {
    setCartItems([])
    setDiscount(0)
  }

  // ── localStorage backup helpers ──────────────────────────────
  const saveOrderBackupToLocal = (eventKey: string, orders: Order[], sales?: Sale[]) => {
    try {
      localStorage.setItem(`eduvate-orders-${eventKey}`, JSON.stringify(orders))
      if (sales) localStorage.setItem(`eduvate-sales-${eventKey}`, JSON.stringify(sales))
    } catch { /* quota exceeded - ignore */ }
  }

  const handleRecordSale = async () => {
    const isGeneralSale = selectedEventId === 'general'
    const eventRecord = events.find((event) => event.id === selectedEventId)
    if ((!eventRecord && !isGeneralSale) || cartItems.length === 0) return
    if (!isGeneralSale && eventRecord?.status !== 'active') return

    setIsSubmittingSale(true)
    const stockMap = new Map(inventory.map((item) => [item.id, item]))

    for (const cartItem of cartItems) {
      const stockItem = stockMap.get(cartItem.itemId)
      if (!stockItem || cartItem.quantity > stockItem.quantity) {
        setEventMessage(
          `Not enough stock for ${cartItem.title}. Please adjust the cart.`
        )
        setIsSubmittingSale(false)
        return
      }
    }

    const timestamp = new Date().toISOString()
    const feeMultiplier = paymentType === 'Card' ? 1.03 : 1
    
    // Calculate discount ratio to apply proportionally to each item
    const discountRatio = cartTotal > 0 ? (1 - (discountAmount / cartTotal)) : 1
    
    const salesToAdd: Sale[] = cartItems.map((cartItem) => {
      const itemSubtotal = cartItem.price * cartItem.quantity
      const itemAfterDiscount = itemSubtotal * discountRatio
      const itemTotal = Number((itemAfterDiscount * feeMultiplier).toFixed(2))
      const inventoryItem = inventory.find((item) => item.id === cartItem.itemId)
      
      return {
        id: `sale-${Date.now()}-${cartItem.itemId}`,
        itemId: cartItem.itemId,
        title: cartItem.title,
        quantity: cartItem.quantity,
        paymentType,
        total: itemTotal,
        timestamp,
        rrp: inventoryItem?.rrp ?? 0,
        sellingPrice: cartItem.price
      }
    })

    // Create Order record for this transaction
    const orderRecord: Order = {
      id: `order-${Date.now()}`,
      items: cartItems.map((cartItem) => ({
        itemId: cartItem.itemId,
        title: cartItem.title,
        price: cartItem.price,
        quantity: cartItem.quantity,
        lineTotal: Number((cartItem.price * cartItem.quantity).toFixed(2))
      })),
      subtotal: cartTotal,
      discount: discountAmount,
      discountType,
      discountValue: discount,
      convenienceFee: paymentType === 'Card' ? convenienceFee : 0,
      paymentType,
      total: totalWithFee,
      timestamp,
      eventId: selectedEventId
    }

    const updatedSales = eventRecord ? [...salesToAdd, ...eventRecord.sales] : salesToAdd
    const updatedOrders = eventRecord ? [orderRecord, ...eventRecord.orders] : [orderRecord]
    const nextInventory = inventory.map((item) => {
      const cartItem = cartItems.find((entry) => entry.itemId === item.id)
      if (!cartItem) return item
      return {
        ...item,
        quantity: Math.max(0, item.quantity - cartItem.quantity)
      }
    })
    // Track only items whose quantity actually changed
    const changedInventoryItems = nextInventory.filter((item) => {
      const original = inventory.find((i) => i.id === item.id)
      return original && original.quantity !== item.quantity
    })

    // 1️⃣ Update local state immediately (optimistic)
    if (eventRecord) {
      setEvents((current) =>
        current.map((event) =>
          event.id === eventRecord.id ? { ...event, sales: updatedSales, orders: updatedOrders } : event
        )
      )
    } else {
      setGeneralSales((current) => [...salesToAdd, ...current])
      setGeneralOrders((current) => [orderRecord, ...current])
    }

    setInventory(nextInventory)
    setCartItems([])
    setDiscount(0)

    // 2️⃣ Save order + TXT data to localStorage BEFORE cloud write
    const eventKey = eventRecord ? eventRecord.id : 'general'
    const eventName = eventRecord?.name ?? 'General Sales'
    saveOrderBackupToLocal(eventKey, updatedOrders, updatedSales)
    try {
      localStorage.setItem(`eduvate-txt-${eventKey}`, generateEventTxt(eventName, updatedOrders))
    } catch { /* ignore */ }

    // 3️⃣ Close modal & reset immediately - no waiting for Firebase
    setIsSubmittingSale(false)
    setShowConfirmSale(false)
    setEventMessage(`✅ Sale recorded (${salesToAdd.length} items). Syncing to cloud…`)

    // 4️⃣ Write to Firebase with retry (background - no await blocking UI)
    ;(async () => {
      const MAX_RETRIES = 2
      let writeSuccess = false

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Batch 1: Save orders/sales
          const orderBatch = writeBatch(db)
          if (eventRecord) {
            orderBatch.update(doc(db, 'events', eventRecord.id), { sales: updatedSales, orders: updatedOrders, _live: true })
          } else {
            salesToAdd.forEach((sale) => {
              orderBatch.set(doc(db, 'generalSales', sale.id), { ...sale, _live: true })
            })
            orderBatch.set(doc(db, 'generalOrders', orderRecord.id), { ...orderRecord, _live: true })
          }
          await orderBatch.commit()
          writeSuccess = true
          break
        } catch (error) {
          console.error(`Order save error (attempt ${attempt}/${MAX_RETRIES}):`, error)
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1500))
          }
        }
      }

      // Batch 2: Update inventory quantities separately, using atomic decrements
      // (increment) so a concurrent write (e.g. an online-order finalize) cannot
      // clobber the count.
      if (changedInventoryItems.length > 0) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const invBatch = writeBatch(db)
            changedInventoryItems.forEach((item) => {
              const sold = cartItems.find((c) => c.itemId === item.id)?.quantity ?? 0
              invBatch.update(doc(db, 'inventory', item.id), { quantity: increment(-sold), _live: true })
            })
            await invBatch.commit()
            // Mirror the new counts onto the storefront catalog.
            await Promise.all(changedInventoryItems.map((item) => mirrorStockToCatalog(item)))
            break
          } catch (error) {
            console.error(`Inventory update error (attempt ${attempt}/${MAX_RETRIES}):`, error)
            if (attempt < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, 1500))
            } else {
              setEventMessage('⚠️ Orders saved but inventory failed to sync. Quantities may be stale in cloud.')
            }
          }
        }
      }

      // 5️⃣ Verify the save in Firebase
      let verified = false
      if (writeSuccess) {
        try {
          if (eventRecord) {
            const verifySnap = await getDoc(doc(db, 'events', eventRecord.id))
            const verifyData = verifySnap.data()
            const savedOrderCount = (verifyData?.orders as Order[] | undefined)?.length ?? 0
            verified = savedOrderCount >= updatedOrders.length
          } else {
            const verifySnap = await getDoc(doc(db, 'generalOrders', orderRecord.id))
            verified = verifySnap.exists()
          }
        } catch {
          verified = false
        }
      }

      // 6️⃣ Update notification with final result
      if (verified) {
        setEventMessage(`✅ Sale confirmed & verified in cloud (${salesToAdd.length} items).`)
      } else if (writeSuccess) {
        setEventMessage('⚠️ Sale written but cloud verification failed. Data is saved locally. You can download a backup from Order History.')
      } else {
        setEventMessage('⚠️ Cloud sync failed after retries. Data is saved locally. You can download a backup from Order History.')
      }
    })()
  }

  const handleDeleteOrder = async (order: Order) => {
    if (!confirm(`Delete this order from ${new Date(order.timestamp).toLocaleString()}? This will restore inventory and remove all related sales records. Continue?`)) return

    // Restore inventory quantities from the deleted order. Build a per-item
    // add-back delta so the cloud write can use atomic increment().
    const restoreDeltas = new Map<string, number>() // inventoryId -> qty to add back
    for (const oi of order.items) {
      if (inventory.some((i) => i.id === oi.itemId)) {
        restoreDeltas.set(oi.itemId, (restoreDeltas.get(oi.itemId) ?? 0) + oi.quantity)
      }
    }
    const restoredInventory = inventory.map((item) =>
      restoreDeltas.has(item.id) ? { ...item, quantity: item.quantity + (restoreDeltas.get(item.id) as number) } : item
    )
    setInventory(restoredInventory)
    // Mirror the restored counts onto the storefront catalog.
    void Promise.all(
      restoredInventory
        .filter((it) => restoreDeltas.has(it.id))
        .map((it) => mirrorStockToCatalog(it, it.quantity))
    )

    const isGeneralOrder = order.eventId === 'general'
    if (isGeneralOrder) {
      // Remove order
      const updatedGeneralOrders = generalOrders.filter((o) => o.id !== order.id)
      setGeneralOrders(updatedGeneralOrders)
      // Remove matching sales (same timestamp)
      const salesToRemove = generalSales.filter((s) => s.timestamp === order.timestamp)
      setGeneralSales((current) => current.filter((s) => s.timestamp !== order.timestamp))
      // Update localStorage backup
      saveOrderBackupToLocal('general', updatedGeneralOrders)
      try {
        const batch = writeBatch(db)
        batch.delete(doc(db, 'generalOrders', order.id))
        salesToRemove.forEach((sale) => {
          batch.delete(doc(db, 'generalSales', sale.id))
        })
        restoreDeltas.forEach((qty, id) => {
          batch.update(doc(db, 'inventory', id), { quantity: increment(qty), _live: true })
        })
        await batch.commit()
      } catch (error) {
        console.error('Delete order error:', error)
      }
    } else {
      const eventRecord = events.find((e) => e.id === order.eventId)
      if (!eventRecord) return
      const updatedOrders = eventRecord.orders.filter((o) => o.id !== order.id)
      // Remove matching sales (same timestamp)
      const updatedSales = eventRecord.sales.filter((s) => s.timestamp !== order.timestamp)
      setEvents((current) =>
        current.map((e) =>
          e.id === eventRecord.id ? { ...e, orders: updatedOrders, sales: updatedSales } : e
        )
      )
      if (viewingOrderHistory) {
        setViewingOrderHistory({ ...viewingOrderHistory, orders: updatedOrders })
      }
      if (viewingEventTransactions) {
        setViewingEventTransactions({ ...viewingEventTransactions, sales: updatedSales })
      }
      // Update localStorage backup
      saveOrderBackupToLocal(eventRecord.id, updatedOrders, updatedSales)
      try {
        const batch = writeBatch(db)
        batch.update(doc(db, 'events', eventRecord.id), { orders: updatedOrders, sales: updatedSales, _live: true })
        restoreDeltas.forEach((qty, id) => {
          batch.update(doc(db, 'inventory', id), { quantity: increment(qty), _live: true })
        })
        await batch.commit()
      } catch (error) {
        console.error('Delete order error:', error)
      }
    }
  }

  const handleSaveEditOrder = async () => {
    if (!editingOrder) return
    const updatedOrder: Order = {
      ...editingOrder,
      items: editOrderItems,
      subtotal: editOrderItems.reduce((sum, item) => sum + item.lineTotal, 0),
      paymentType: editOrderPaymentType,
      total: (() => {
        const sub = editOrderItems.reduce((sum, item) => sum + item.lineTotal, 0)
        const discAmt = editingOrder.discountType === 'percentage'
          ? sub * (editingOrder.discountValue / 100)
          : editingOrder.discountValue
        const afterDiscount = sub - discAmt
        const fee = editOrderPaymentType === 'Card' ? afterDiscount * 0.03 : 0
        return Number((afterDiscount + fee).toFixed(2))
      })(),
      discount: (() => {
        const sub = editOrderItems.reduce((sum, item) => sum + item.lineTotal, 0)
        return editingOrder.discountType === 'percentage'
          ? Number((sub * (editingOrder.discountValue / 100)).toFixed(2))
          : editingOrder.discountValue
      })(),
      convenienceFee: (() => {
        const sub = editOrderItems.reduce((sum, item) => sum + item.lineTotal, 0)
        const discAmt = editingOrder.discountType === 'percentage'
          ? sub * (editingOrder.discountValue / 100)
          : editingOrder.discountValue
        const afterDiscount = sub - discAmt
        return editOrderPaymentType === 'Card' ? Number((afterDiscount * 0.03).toFixed(2)) : 0
      })()
    }

    const isGeneralOrder = updatedOrder.eventId === 'general'
    if (isGeneralOrder) {
      const updatedGeneralOrders = generalOrders.map((o) => o.id === updatedOrder.id ? updatedOrder : o)
      setGeneralOrders(updatedGeneralOrders)
      // Update localStorage backup
      saveOrderBackupToLocal('general', updatedGeneralOrders)
      try {
        await updateDoc(doc(db, 'generalOrders', updatedOrder.id), { ...updatedOrder, _live: true })
      } catch (error) {
        console.error('Edit order error:', error)
      }
    } else {
      const eventRecord = events.find((e) => e.id === updatedOrder.eventId)
      if (!eventRecord) return
      const updatedOrders = eventRecord.orders.map((o) => o.id === updatedOrder.id ? updatedOrder : o)
      setEvents((current) =>
        current.map((e) =>
          e.id === eventRecord.id ? { ...e, orders: updatedOrders } : e
        )
      )
      if (viewingOrderHistory) {
        setViewingOrderHistory({ ...viewingOrderHistory, orders: updatedOrders })
      }
      // Update localStorage backup
      saveOrderBackupToLocal(eventRecord.id, updatedOrders, eventRecord.sales)
      try {
        await updateDoc(doc(db, 'events', eventRecord.id), { orders: updatedOrders, _live: true })
      } catch (error) {
        console.error('Edit order error:', error)
      }
    }
    setEditingOrder(null)
    setEditOrderItems([])
  }

  const openEditOrder = (order: Order) => {
    setEditingOrder(order)
    setEditOrderItems(order.items.map((item) => ({ ...item })))
    setEditOrderPaymentType(order.paymentType)
  }

  const renderHome = () => (
    <div className="space-y-8">
      <section className="fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50 p-8 shadow-xl border border-primary/10">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-primary/30 to-accentThree/20 blur-3xl animate-pulse" />
        <div className="absolute -left-14 bottom-0 h-56 w-56 rounded-full bg-gradient-to-tr from-secondary/25 to-primary/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary/20 to-secondary/20 px-4 py-2 mb-3 border border-primary/10">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-primaryDark">Live Dashboard</span>
            </div>
            <h2 className="font-display text-3xl gradient-text">Daily Pulse</h2>
            <p className="mt-3 text-sm text-muted max-w-xl">
              Real-time snapshot of sales momentum, inventory health, and top performing events.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPulseVisible((v) => !v)}
              aria-pressed={pulseVisible}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/90 backdrop-blur px-4 py-3 shadow-soft border border-primary/10 text-sm font-bold text-primaryDark transition hover:bg-white hover:-translate-y-0.5"
              title={pulseVisible ? 'Hide the figures' : 'Show the figures'}
            >
              {pulseVisible ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
              )}
              {pulseVisible ? 'Hide figures' : 'Show figures'}
            </button>
            <div className="rounded-2xl bg-white/90 backdrop-blur px-5 py-3 shadow-soft border border-primary/10">
              <p className="text-xs font-semibold text-muted">Last updated</p>
              <p className="text-sm font-bold text-primaryDark">Moments ago</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {summaryCards.map((card, index) => (
            <div
              key={card.label}
              className="home-card group relative overflow-hidden rounded-2xl bg-white/90 backdrop-blur-sm p-6 shadow-xl border border-primary/5 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">{card.label}</p>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 text-primaryDark" aria-hidden="true">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      {card.icon === 'sales' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 10v2m0-10c1.11 0 2.08.402 2.599 1M12 16c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                      {card.icon === 'stock' && <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
                      {card.icon === 'events' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />}
                      {card.icon === 'catalog' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253" />}
                      {card.icon === 'orders' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />}
                    </svg>
                  </span>
                </div>
                <h2 className="mt-4 font-display text-2xl sm:text-3xl xl:text-[1.75rem] 2xl:text-4xl gradient-text leading-tight break-words">
                  {pulseVisible ? (
                    <>
                      {'prefix' in card ? card.prefix : ''}
                      {'prefix' in card && card.prefix === '$'
                        ? card.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : formatNumber(card.value)}
                    </>
                  ) : (
                    <span className="tracking-widest text-muted/70" aria-label="Hidden">••••</span>
                  )}
                </h2>
                <p className="mt-3 text-xs text-muted flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {card.note}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue breakdown: the headline "Total Sales" is product revenue (net).
            These are the passthroughs we collect but don't keep, shown separately
            so the numbers are transparent and reconcile to what was charged. */}
        {pulseVisible && (
          <div className="relative z-10 mt-5 rounded-2xl bg-white/80 backdrop-blur-sm p-5 shadow-soft border border-primary/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Revenue breakdown</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="font-semibold text-primaryDark">
                Product revenue (net): <span className="gradient-text font-bold">${revenueBreakdown.productNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </span>
              <span className="text-muted">+ Shipping collected: <strong className="text-ink">${revenueBreakdown.shipping.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              <span className="text-muted">+ Sales tax collected: <strong className="text-ink">${revenueBreakdown.tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              <span className="text-muted">+ Card fees collected: <strong className="text-ink">${revenueBreakdown.cardFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              <span className="ml-auto rounded-full bg-primary/10 px-4 py-1.5 font-bold text-primaryDark">
                Total collected: ${revenueBreakdown.collected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted">Tax and shipping are passthroughs (remitted / cover postage); card fees offset processing. They aren&apos;t product earnings, so they&apos;re excluded from the headline figure.</p>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-primary/5 p-6 shadow-xl border border-primary/10" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-xl gradient-text">Weekly Sales Trend</h3>
            <span className="text-xs font-semibold text-muted bg-primary/10 px-3 py-1 rounded-full">Last 7 days</span>
          </div>
          {salesTrend.labels.length ? (
            <>
              <div className="flex items-end gap-2 mt-1 mb-4">
                <span className="text-3xl font-bold gradient-text">${formatNumber(salesTrend.values.reduce((a, b) => a + b, 0))}</span>
                <span className="text-xs text-muted pb-1">total this week</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrend.labels.map((label, i) => ({ day: label, sales: salesTrend.values[i] ?? 0 }))} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: '13px' }}
                      formatter={(value: any) => [`$${formatNumber(Number(value))}`, 'Sales']}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#7c3aed" strokeWidth={3} fill="url(#salesGradient)" dot={{ r: 5, fill: '#7c3aed', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, fill: '#5b21b6', stroke: '#fff', strokeWidth: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-12 w-12 mb-3 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l4-4 3 3 5-6" />
              </svg>
              <p className="text-sm text-muted">No sales data yet. Record a sale to see trends.</p>
            </div>
          )}
        </div>

        <div className="grid gap-6">
          <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-secondary/5 p-6 shadow-xl border border-secondary/10" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-xl gradient-text">Category Mix</h3>
              <span className="text-xs font-semibold text-muted bg-secondary/10 px-3 py-1 rounded-full">Current inventory</span>
            </div>
            {categoryMix.labels.some((_, i) => categoryMix.values[i] > 0) ? (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryMix.labels.map((label, i) => ({ name: label, value: categoryMix.values[i] ?? 0 })).filter(d => d.value > 0)}
                      cx="50%" cy="50%"
                      innerRadius={45} outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryMix.labels.map((_, i) => (
                        <Cell key={i} fill={['#7c3aed', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#f43e5e'][i % 8]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', fontSize: '13px' }} formatter={(value: any) => [`${formatNumber(Number(value))} items`, '']} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', fontWeight: 500 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="h-12 w-12 mb-3 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-sm text-muted">No inventory data yet.</p>
              </div>
            )}
          </div>

          <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-primary/5 p-6 shadow-xl border border-primary/10" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-xl gradient-text">Best Sellers</h3>
              <span className="text-xs font-semibold text-muted bg-primary/10 px-3 py-1 rounded-full">Across all events</span>
            </div>
            {bestSellers.length ? (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={bestSellers.map((item) => ({ name: item.title.length > 18 ? item.title.slice(0, 18) + '…' : item.title, qty: item.quantity, revenue: item.revenue, fullName: item.title }))}
                    layout="vertical"
                    margin={{ top: 5, right: 15, left: 5, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="bestSellerGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', fontSize: '13px' }}
                      formatter={(value: any, name: any) => [name === 'qty' ? `${Number(value)} sold` : `$${formatNumber(Number(value))}`, name === 'qty' ? 'Quantity' : 'Revenue']}
                    />
                    <Bar dataKey="qty" fill="url(#bestSellerGradient)" radius={[0, 8, 8, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="h-12 w-12 mb-3 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m7-17H5v5a7 7 0 0014 0V4zM5 8H3a2 2 0 002 2m14-2h2a2 2 0 01-2 2" />
                </svg>
                <p className="text-sm text-muted">No sales yet. Record a sale to see top items.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-accentThree/5 p-6 shadow-xl border border-accentThree/10" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accentThree/20 to-primary/20 text-primaryDark"><svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6M15 19V9M4 21h16M12 21V5" /></svg></span>
              <h3 className="font-display text-xl gradient-text">Event Revenue</h3>
            </div>
            <span className="text-xs font-semibold text-muted bg-accentThree/10 px-3 py-1 rounded-full">Top events</span>
          </div>
          {eventRevenue.length ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventRevenue} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                    <linearGradient id="profitBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', fontSize: '13px' }}
                    formatter={(value: any, name: any) => [`$${formatNumber(Number(value))}`, name === 'revenue' ? 'Revenue' : name === 'cost' ? 'Total Costs' : 'Profit']}
                  />
                  <Bar dataKey="revenue" fill="url(#revenueBarGrad)" radius={[6, 6, 0, 0]} barSize={18} />
                  <Bar dataKey="profit" fill="url(#profitBarGrad)" radius={[6, 6, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-12 w-12 mb-3 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
              </svg>
              <p className="text-sm text-muted">No events created yet.</p>
            </div>
          )}
        </div>

        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-pink-50/50 p-6 shadow-xl border border-secondary/10" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 text-primaryDark"><svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg></span>
              <h3 className="font-display text-xl gradient-text">Payment Split</h3>
            </div>
            <span className="text-xs font-semibold text-muted bg-secondary/10 px-3 py-1 rounded-full">By type</span>
          </div>
          {paymentBreakdown.length ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                    label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {paymentBreakdown.map((_, i) => (
                      <Cell key={i} fill={['#10b981', '#3b82f6', '#f59e0b', '#ec4899'][i % 4]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', fontSize: '13px' }} formatter={(value: any) => [`$${formatNumber(Number(value))}`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-12 w-12 mb-3 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <p className="text-sm text-muted">No sales data yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-accentThree/5 p-6 shadow-xl border border-accentThree/10" style={{ animationDelay: '350ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accentThree/20 to-primary/20 text-amber-500"><svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m5-16v3a5 5 0 01-10 0V5a1 1 0 011-1h8a1 1 0 011 1zm0 0h3a2 2 0 01-2 4m-12-4H4a2 2 0 002 4" /></svg></span>
            <h3 className="font-display text-xl gradient-text">Best Event</h3>
          </div>
          {bestEvent ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 p-4 border border-primary/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-lg text-primaryDark">{bestEvent.name}</span>
                  <span className="text-xl font-bold gradient-text">
                    ${formatNumber(bestEvent.sales.reduce((sum, sale) => sum + sale.total, 0))}
                  </span>
                </div>
                <div className="space-y-2 text-xs text-muted">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>{bestEvent.startDate || 'TBD'} - {bestEvent.endDate || 'TBD'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span>{bestEvent.location || 'Location TBD'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /></svg>
                    <span>{bestEvent.type}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-black/10">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${bestEvent.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      {bestEvent.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                    <span>Vendor fee: ${formatNumber(bestEvent.cost)}</span>
                  </div>
                  {bestEvent.expenses.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        {bestEvent.expenses.length} expense{bestEvent.expenses.length !== 1 ? 's' : ''}
                      </span>
                      <span>${formatNumber(bestEvent.expenses.reduce((s, e) => s + e.amount, 0))}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-8">No events created yet.</p>
          )}
        </div>

        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-amber-50/50 p-6 shadow-xl border border-amber-200/50" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600"><svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></span>
              <h3 className="font-display text-xl gradient-text">Inventory Health</h3>
            </div>
            <span className="text-xs font-semibold text-muted bg-amber-100 px-3 py-1 rounded-full border border-amber-200">Restock radar</span>
          </div>
          {(() => {
            // A single restock row (progress bar + qty/sold badges).
            const Row = (item: InventoryItem, opts: { out?: boolean } = {}) => {
              const sold = soldUnits(item)
              const out = opts.out ?? item.quantity <= 0
              return (
                <div key={item.id} className="group hover:bg-amber-50/50 p-3 rounded-xl transition-colors">
                  <div className="flex items-center justify-between gap-2 text-sm mb-2">
                    <span className="font-medium min-w-0 truncate">{item.title}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      {sold > 0 && (
                        <span className="text-[11px] font-semibold text-muted whitespace-nowrap">{sold} sold</span>
                      )}
                      <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
                        out ? 'bg-red-100 text-red-700 border border-red-200'
                          : item.quantity <= 5 ? 'bg-orange-100 text-orange-700 border border-orange-200'
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>
                        {out ? 'Out of stock' : `${item.quantity} left`}
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gradient-to-r from-gray-200 to-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        out || item.quantity <= 5 ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-amber-400 to-orange-400'
                      }`}
                      style={{ width: `${out ? 4 : Math.max(15, Math.min(100, (item.quantity / restockThreshold) * 100))}%` }}
                    />
                  </div>
                </div>
              )
            }

            const { urgentOut, lowStock, deadOut } = restockGroups
            const needAttention = urgentOut.length + lowStock.length
            if (!needAttention && !deadOut.length) {
              return (
                <div className="text-center py-8 flex flex-col items-center">
                  <svg className="h-12 w-12 mb-3 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-muted">All items are healthy on stock.</p>
                </div>
              )
            }

            // Top priority: out-of-stock items that sold before (reorder now).
            // If there are none, fall back to showing the lowest-stock items.
            const topList = urgentOut.length ? urgentOut : lowStock
            const topShown = topList.slice(0, 5)
            const restUrgent = urgentOut.length ? urgentOut.slice(5) : []
            const restLow = urgentOut.length ? lowStock : lowStock.slice(5)
            const hiddenCount = restUrgent.length + restLow.length + deadOut.length

            return (
              <div className="space-y-4">
                {urgentOut.length > 0 && (
                  <p className="text-xs font-bold uppercase tracking-wider text-red-600">Sold out, reorder first</p>
                )}
                {topShown.map((item) => Row(item))}

                {hiddenCount > 0 && (
                  <>
                    {restockExpanded && (
                      <div className="space-y-4 pt-1">
                        {restUrgent.map((item) => Row(item, { out: true }))}
                        {restLow.length > 0 && (
                          <p className="text-xs font-bold uppercase tracking-wider text-amber-600 pt-1">Running low</p>
                        )}
                        {restLow.map((item) => Row(item))}
                        {deadOut.length > 0 && (
                          <p className="text-xs font-bold uppercase tracking-wider text-muted pt-1">Out of stock · no sales yet</p>
                        )}
                        {deadOut.map((item) => Row(item, { out: true }))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setRestockExpanded((v) => !v)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      {restockExpanded ? 'Show less' : `Show all ${needAttention + deadOut.length} items`}
                      <svg className={`h-4 w-4 transition-transform ${restockExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </>
                )}
              </div>
            )
          })()}
        </div>
      </section>
      <style jsx>{`
        .home-card {
          animation: float-in 0.6s ease forwards;
          opacity: 0;
          transform: translateY(10px);
        }

        @keyframes float-in {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )

  /**
   * Group inventory into duplicate clusters using the same identity keys the
   * upload merge uses (SKU, then ISBN, then normalized title+publisher).
   * Union-find, because A can match B by SKU while B matches C by title — all
   * three belong in one group.
   */
  const duplicateGroups = useMemo(() => {
    const parent = inventory.map((_, i) => i)
    const find = (i: number): number => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]]
        i = parent[i]
      }
      return i
    }
    const union = (a: number, b: number) => {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent[rb] = ra
    }

    const seen = new Map<string, number>()
    inventory.forEach((item, idx) => {
      itemMatchKeys(item).forEach((key) => {
        const prev = seen.get(key)
        if (prev === undefined) seen.set(key, idx)
        else union(prev, idx)
      })
    })

    const clusters = new Map<number, InventoryItem[]>()
    inventory.forEach((item, idx) => {
      const root = find(idx)
      const bucket = clusters.get(root)
      if (bucket) bucket.push(item)
      else clusters.set(root, [item])
    })

    return Array.from(clusters.entries())
      .filter(([, items]) => items.length > 1)
      .map(([root, items]) => ({
        // Stable per-cluster id so the merge button survives re-renders.
        id: items.map((i) => i.id).sort().join('|'),
        root,
        items,
        // What actually tied them together — shown so the admin can sanity-check
        // before merging (a title-only match is weaker than a SKU match).
        reason: (() => {
          const codes = new Set(
            items.flatMap((i) => [i.code, i.altCode, i.sku, i.isbn]).map(normalizeCode).filter(Boolean)
          )
          if (codes.size === 1 && items.length > 1) return 'Same code'
          return 'Same title & publisher'
        })()
      }))
      .sort((a, b) => b.items.length - a.items.length)
  }, [inventory])

  /** Ids of every item that sits in a duplicate cluster — for the row badge. */
  const duplicateIds = useMemo(
    () => new Set(duplicateGroups.flatMap((g) => g.items.map((i) => i.id))),
    [duplicateGroups]
  )

  /**
   * Compute the single row a duplicate cluster collapses into: quantities are
   * summed, and every other field takes the first non-empty value found
   * (preferring the row that already has the most data filled in). The survivor
   * keeps the oldest id so existing catalog links and sale records still resolve.
   */
  const computeMerge = (items: InventoryItem[]): { merged: InventoryItem; removeIds: string[] } => {
    // Richest row first: most non-empty fields wins ties for each field below.
    // Placeholder-priced rows sort last regardless of score, so a real trade
    // RRP always beats an RRP that is just a copy of the selling price.
    const score = (i: InventoryItem) =>
      [i.code, i.publisher, i.title].filter((v) => String(v ?? '').trim()).length +
      [i.rrp, i.discount, i.sellingPrice, i.weight].filter((v) => Number(v) > 0).length
    const ranked = [...items].sort(
      (a, b) =>
        Number(isPlaceholderPriced(a)) - Number(isPlaceholderPriced(b)) || score(b) - score(a)
    )
    // Keep the oldest id (ids are `inv-<timestamp>`), not the richest row's, so
    // anything already pointing at this item keeps working.
    const survivorId = [...items].sort((a, b) => a.id.localeCompare(b.id))[0].id

    const firstStr = (pick: (i: InventoryItem) => string) =>
      ranked.map(pick).find((v) => String(v ?? '').trim())?.trim() ?? ''
    const firstNum = (pick: (i: InventoryItem) => number) =>
      ranked.map(pick).find((v) => Number(v) > 0) ?? 0

    const totalQty = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)
    const rrp = firstNum((i) => i.rrp)
    const discount = firstNum((i) => i.discount)

    // Gather every identifier the cluster carries, prefer a scannable barcode,
    // and keep one genuinely different survivor as altCode so a printed label
    // that used the old code still resolves.
    const allCodes = [
      ...new Set(
        ranked
          .flatMap((i) => [i.code, i.altCode, i.sku, i.isbn])
          .map((v) => String(v ?? '').trim())
          .filter(Boolean)
      )
    ]
    const code = allCodes.find(isIsbn13) ?? allCodes[0] ?? ''
    const altCode = allCodes.find((c) => normalizeCode(c) !== normalizeCode(code)) ?? ''

    const merged: InventoryItem = {
      id: survivorId,
      title: firstStr((i) => i.title) || items[0].title,
      // Prefer a real category over the 'Books' fallback when the rows disagree.
      category: ranked.find((i) => i.category && i.category !== 'Books')?.category ?? items[0].category,
      publisher: firstStr((i) => i.publisher),
      code,
      altCode,
      sku: code,
      isbn: isIsbn13(code) ? code : '',
      rrp,
      discount,
      sellingPrice:
        firstNum((i) => i.sellingPrice) ||
        (rrp > 0 ? Number((rrp * (1 - discount / 100)).toFixed(2)) : 0),
      quantity: totalQty,
      weight: firstNum((i) => i.weight)
    }

    return { merged, removeIds: items.map((i) => i.id).filter((id) => id !== survivorId) }
  }

  /**
   * A cluster is "safe" to merge unattended only when collapsing it loses no
   * information: every row agrees on selling price, and no field holds two
   * DIFFERENT real values across rows. Anything else (two genuine prices, two
   * different ISBNs) needs a human.
   */
  const isSafeMerge = (items: InventoryItem[]): boolean => {
    const distinctStr = (list: InventoryItem[], pick: (i: InventoryItem) => string) =>
      new Set(list.map((i) => normalizeText(pick(i))).filter(Boolean)).size
    const distinctNum = (list: InventoryItem[], pick: (i: InventoryItem) => number) =>
      new Set(list.map((i) => Number(pick(i))).filter((v) => v > 0)).size

    // Price must be unanimous among rows that state one at all.
    if (distinctNum(items, (i) => i.sellingPrice) > 1) return false
    // No conflicting identities. Codes are compared in canonical form, so a
    // hyphenated ISBN and its bare digits are not treated as a conflict.
    if (new Set(items.map((i) => normalizeCode(i.code)).filter(Boolean)).size > 1) return false
    if (distinctStr(items, (i) => i.publisher) > 1) return false
    // Differing real categories (ignoring the 'Books' default) is a judgment call.
    if (new Set(items.map((i) => i.category).filter((c) => c && c !== 'Books')).size > 1) return false

    // Cost fields are judged only against rows that actually carry cost data.
    // A placeholder row states no discount and an RRP that merely echoes the
    // selling price — the signature of a sheet imported without a discount
    // column. Its rrp/weight hold no information, so they cannot conflict.
    const real = items.filter((i) => !isPlaceholderPriced(i))
    const judge = real.length > 0 ? real : items
    if (distinctNum(judge, (i) => i.rrp) > 1) return false
    if (distinctNum(judge, (i) => i.discount) > 1) return false
    if (distinctNum(judge, (i) => i.weight) > 1) return false
    return true
  }

  const handleMergeDuplicates = async (group: { id: string; items: InventoryItem[] }) => {
    const { items } = group
    const { merged, removeIds } = computeMerge(items)
    const totalQty = merged.quantity
    if (
      !confirm(
        `Merge ${items.length} entries of "${merged.title}" into one?\n\n` +
          `• Combined quantity: ${totalQty}\n` +
          `• Keeps: code ${merged.code || '—'}${merged.altCode ? ` (+ ${merged.altCode})` : ''}, ` +
          `weight ${merged.weight || '—'}g, discount ${merged.discount || 0}%\n` +
          `• Deletes ${removeIds.length} duplicate row${removeIds.length === 1 ? '' : 's'}\n\n` +
          `This cannot be undone.`
      )
    )
      return

    setMergingGroup(group.id)
    setInventory((current) => [
      ...current.filter((i) => !removeIds.includes(i.id) && i.id !== merged.id),
      merged
    ])
    try {
      const batch = writeBatch(db)
      batch.set(doc(db, 'inventory', merged.id), { ...merged, _live: true })
      removeIds.forEach((id) => batch.delete(doc(db, 'inventory', id)))
      await batch.commit()
      await mirrorStockToCatalog(merged, merged.quantity)
      setUploadMessage(`✅ Merged ${items.length} entries of "${merged.title}" (quantity ${totalQty}).`)
    } catch (error) {
      console.error('Merge duplicates error:', error)
      setUploadMessage(`⚠️ "${merged.title}" merged locally but failed to sync to cloud.`)
    } finally {
      setMergingGroup(null)
    }
  }

  /** Clusters that collapse without losing information — see isSafeMerge. */
  const safeDuplicateGroups = useMemo(
    () => duplicateGroups.filter((g) => isSafeMerge(g.items)),
    [duplicateGroups]
  )

  /**
   * Merge every safe cluster in one pass. Groups needing a judgment call are
   * left untouched for manual review. Firestore caps a batch at 500 writes, so
   * this chunks conservatively; a failed chunk aborts before local state is
   * committed, leaving the remaining groups for a retry.
   */
  /**
   * Items whose Firestore doc predates the unified `code` field, or whose
   * mirrors have drifted out of sync with it. Backfilling these is what lets
   * the orders Cloud Function and any older reader keep resolving stock.
   */
  const itemsNeedingCodeMigration = useMemo(
    () =>
      inventory.filter((i) => {
        const code = (i.code || '').trim()
        const expectedIsbn = isIsbn13(code) ? code : ''
        return (i.sku || '') !== code || (i.isbn || '') !== expectedIsbn
      }),
    [inventory]
  )

  /**
   * One-time backfill: write `code` (and its sku/isbn mirrors) onto every
   * inventory doc. Safe to re-run — it only touches docs that are actually out
   * of sync, and the value written is already what the UI is displaying.
   */
  const handleMigrateCodes = async () => {
    const targets = itemsNeedingCodeMigration
    if (!targets.length) return
    if (
      !confirm(
        `Save the unified code field to ${targets.length} item${targets.length === 1 ? '' : 's'}?\n\n` +
          `• Writes each item's code, plus sku/isbn mirrors so online orders keep resolving\n` +
          `• Values are exactly what the dashboard already shows — nothing is recalculated\n` +
          `• Safe to run more than once`
      )
    )
      return

    setMergingGroup('__migrate__')
    try {
      const CHUNK = 400
      for (let start = 0; start < targets.length; start += CHUNK) {
        const batch = writeBatch(db)
        targets.slice(start, start + CHUNK).forEach((item) => {
          const code = (item.code || '').trim()
          batch.update(doc(db, 'inventory', item.id), {
            code,
            altCode: (item.altCode || '').trim(),
            sku: code,
            isbn: isIsbn13(code) ? code : '',
            _live: true
          })
        })
        await batch.commit()
      }
      // Mirror local state so the banner clears without a reload.
      setInventory((current) =>
        current.map((i) => {
          const code = (i.code || '').trim()
          return { ...i, code, sku: code, isbn: isIsbn13(code) ? code : '' }
        })
      )
      setUploadMessage(`✅ Saved the code field to ${targets.length} item${targets.length === 1 ? '' : 's'}.`)
    } catch (error) {
      console.error('Code migration error:', error)
      setUploadMessage('⚠️ Code migration failed partway. Reload and try again — it is safe to re-run.')
    } finally {
      setMergingGroup(null)
    }
  }

  const handleMergeAllSafe = async () => {
    const groups = safeDuplicateGroups
    if (!groups.length) return

    const rowsRemoved = groups.reduce((n, g) => n + g.items.length - 1, 0)
    const skipped = duplicateGroups.length - groups.length
    if (
      !confirm(
        `Merge ${groups.length} duplicate group${groups.length === 1 ? '' : 's'} automatically?\n\n` +
          `• ${rowsRemoved} duplicate row${rowsRemoved === 1 ? '' : 's'} will be deleted\n` +
          `• Quantities are summed; every other field keeps its first non-empty value\n` +
          `• Only groups that lose no information are included` +
          (skipped
            ? `\n• ${skipped} group${skipped === 1 ? '' : 's'} left for manual review (conflicting values)`
            : '') +
          `\n\nThis cannot be undone.`
      )
    )
      return

    setMergingGroup('__all__')
    const results = groups.map((g) => computeMerge(g.items))
    const allRemoved = new Set(results.flatMap((r) => r.removeIds))
    const mergedById = new Map(results.map((r) => [r.merged.id, r.merged]))

    try {
      // Chunk by writes, not groups: each group costs 1 set + N deletes.
      const CHUNK = 400
      let batch = writeBatch(db)
      let writes = 0
      for (const { merged, removeIds } of results) {
        const cost = 1 + removeIds.length
        if (writes + cost > CHUNK) {
          await batch.commit()
          batch = writeBatch(db)
          writes = 0
        }
        batch.set(doc(db, 'inventory', merged.id), { ...merged, _live: true })
        removeIds.forEach((id) => batch.delete(doc(db, 'inventory', id)))
        writes += cost
      }
      if (writes > 0) await batch.commit()

      setInventory((current) =>
        current
          .filter((i) => !allRemoved.has(i.id))
          .map((i) => mergedById.get(i.id) ?? i)
      )

      // Push the new combined quantities to the storefront. Sequential and
      // best-effort: a catalog mirror failure must not undo a committed merge.
      let mirrorFailures = 0
      for (const { merged } of results) {
        try {
          await mirrorStockToCatalog(merged, merged.quantity)
        } catch {
          mirrorFailures += 1
        }
      }

      setUploadMessage(
        `✅ Merged ${groups.length} group${groups.length === 1 ? '' : 's'}, removed ${rowsRemoved} duplicate row${rowsRemoved === 1 ? '' : 's'}.` +
          (skipped ? ` ${skipped} left for manual review.` : '') +
          (mirrorFailures ? ` (${mirrorFailures} catalog stock mirror${mirrorFailures === 1 ? '' : 's'} failed.)` : '')
      )
    } catch (error) {
      console.error('Merge all duplicates error:', error)
      setUploadMessage('⚠️ Bulk merge failed partway. Reload the page to see the current state, then try again.')
    } finally {
      setMergingGroup(null)
    }
  }

  // ---- Current Stock column layout -------------------------------------
  // Default widths in px. A fixed table-layout plus explicit widths is what
  // makes dragging feel stable — with auto layout the browser re-flows every
  // column as content changes.
  const INVENTORY_COLUMNS = useMemo(
    () =>
      [
        { id: 'title', label: 'Item', sortKey: 'title' as keyof InventoryItem, align: 'left', width: 280, min: 160 },
        { id: 'category', label: 'Category', sortKey: 'category' as keyof InventoryItem, align: 'left', width: 130, min: 90 },
        { id: 'publisher', label: 'Publisher', sortKey: 'publisher' as keyof InventoryItem, align: 'left', width: 160, min: 90 },
        { id: 'rrp', label: 'RRP', sortKey: 'rrp' as keyof InventoryItem, align: 'right', width: 100, min: 70 },
        { id: 'discount', label: 'Discount %', sortKey: 'discount' as keyof InventoryItem, align: 'center', width: 110, min: 80 },
        { id: 'sellingPrice', label: 'Selling Price', sortKey: 'sellingPrice' as keyof InventoryItem, align: 'right', width: 120, min: 80 },
        { id: 'quantity', label: 'Stock', sortKey: 'quantity' as keyof InventoryItem, align: 'center', width: 90, min: 70 },
        { id: 'weight', label: 'Weight', sortKey: 'weight' as keyof InventoryItem, align: 'right', width: 100, min: 70 }
      ] as const,
    []
  )
  const ACTION_COLUMNS = useMemo(
    () =>
      [
        { id: 'code', label: 'Code', width: 150, min: 110 },
        { id: 'manage', label: 'Manage', width: 130, min: 110 }
      ] as const,
    []
  )

  const columnWidth = (id: string, fallback: number) => colWidths[id] ?? fallback

  // Two scrollbars drive the same table: one pinned above the header (always
  // reachable without scrolling to the bottom of a 300-row table) and the
  // native one under the rows. Each mirrors the other's scrollLeft, with a
  // guard so the echoed scroll event doesn't bounce back.
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const topScrollRef = useRef<HTMLDivElement | null>(null)
  const syncingScroll = useRef(false)
  const syncScroll = (from: 'top' | 'table') => () => {
    if (syncingScroll.current) {
      syncingScroll.current = false
      return
    }
    const src = from === 'top' ? topScrollRef.current : tableScrollRef.current
    const dst = from === 'top' ? tableScrollRef.current : topScrollRef.current
    if (!src || !dst || src.scrollLeft === dst.scrollLeft) return
    syncingScroll.current = true
    dst.scrollLeft = src.scrollLeft
  }

  /**
   * Sum of the current column widths. Setting this on the table (rather than
   * w-full) is what produces a genuine horizontal scrollbar once the columns
   * are widened past the container.
   */
  const totalTableWidth = useMemo(() => {
    const cols = [...INVENTORY_COLUMNS, ...(userRole === 'admin' ? ACTION_COLUMNS : [])]
    return cols.reduce((sum, c) => sum + (colWidths[c.id] ?? c.width), 0)
  }, [colWidths, INVENTORY_COLUMNS, ACTION_COLUMNS, userRole])

  /** Persist widths (debounced by React's batching — one write per drag end). */
  const saveColWidths = (next: Record<string, number>) => {
    setColWidths(next)
    try {
      localStorage.setItem('eduvate-inv-col-widths', JSON.stringify(next))
    } catch {
      /* storage unavailable (private mode) — resizing still works this session */
    }
  }

  const resetColWidths = () => {
    setColWidths({})
    try {
      localStorage.removeItem('eduvate-inv-col-widths')
    } catch {
      /* ignore */
    }
  }

  /**
   * Drag handle sitting on a header's right edge. Tracks pointer movement on
   * the window so the drag survives the cursor leaving the thin handle, and
   * commits to localStorage once on release rather than on every mousemove.
   */
  const ColumnResizer = ({ col }: { col: string }) => {
    const all = [...INVENTORY_COLUMNS, ...ACTION_COLUMNS]
    const def = all.find((c) => c.id === col)
    const minWidth = def?.min ?? 70
    const startWidth = columnWidth(col, def?.width ?? 120)

    const beginResize = (startX: number) => {
      let latest = startWidth
      const onMove = (clientX: number) => {
        latest = Math.max(minWidth, Math.round(startWidth + (clientX - startX)))
        // Live feedback without a state write per pixel.
        setColWidths((prev) => ({ ...prev, [col]: latest }))
      }
      const onMouseMove = (e: MouseEvent) => onMove(e.clientX)
      const onTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientX)
      const stop = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', stop)
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', stop)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        setColWidths((prev) => {
          const next = { ...prev, [col]: latest }
          try {
            localStorage.setItem('eduvate-inv-col-widths', JSON.stringify(next))
          } catch {
            /* ignore */
          }
          return next
        })
      }
      // Suppress text selection while dragging.
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', stop)
      window.addEventListener('touchmove', onTouchMove)
      window.addEventListener('touchend', stop)
    }

    return (
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${def?.label ?? col} column`}
        title="Drag to resize · double-click to reset"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          beginResize(e.clientX)
        }}
        onTouchStart={(e) => {
          e.stopPropagation()
          beginResize(e.touches[0].clientX)
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          setColWidths((prev) => {
            const next = { ...prev }
            delete next[col]
            try {
              localStorage.setItem('eduvate-inv-col-widths', JSON.stringify(next))
            } catch {
              /* ignore */
            }
            return next
          })
        }}
        className="group absolute right-0 top-0 z-10 flex h-full w-3 translate-x-1/2 cursor-col-resize items-center justify-center touch-none"
      >
        <span className="h-1/2 w-0.5 rounded bg-primaryDark/15 transition-colors group-hover:bg-primary" />
      </span>
    )
  }

  const sortedInventory = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase()
    const base = query
      ? inventory.filter((item) =>
          [item.title, item.publisher, item.category, item.code, item.altCode]
            .some((field) => (field ?? '').toString().toLowerCase().includes(query))
        )
      : inventory
    if (!inventorySortKey) return base
    return [...base].sort((a, b) => {
      const aVal = a[inventorySortKey]
      const bVal = b[inventorySortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return inventorySortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return inventorySortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [inventory, inventorySortKey, inventorySortDir, inventorySearch])

  const handleInventorySort = (key: keyof InventoryItem) => {
    if (inventorySortKey === key) {
      if (inventorySortDir === 'asc') setInventorySortDir('desc')
      else { setInventorySortKey(''); setInventorySortDir('asc') }
    } else {
      setInventorySortKey(key)
      setInventorySortDir('asc')
    }
  }

  const SortIcon = ({ col }: { col: keyof InventoryItem }) => {
    const isActive = inventorySortKey === col
    const isAsc = isActive && inventorySortDir === 'asc'
    const isDesc = isActive && inventorySortDir === 'desc'
    return (
      <span className="inline-flex flex-col ml-1 align-middle -space-y-1" aria-hidden="true">
        <svg className={`h-2.5 w-2.5 ${isAsc ? 'text-primary' : 'text-primaryDark/25'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 6l6 8H6z" />
        </svg>
        <svg className={`h-2.5 w-2.5 ${isDesc ? 'text-primary' : 'text-primaryDark/25'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 18l-6-8h12z" />
        </svg>
      </span>
    )
  }

  const openEditInventoryItem = (item: InventoryItem) => {
    setEditingInventoryItem(item)
    setInvEditTitle(item.title)
    setInvEditCategory(item.category)
    setInvEditPublisher(item.publisher)
    setInvEditCode(item.code ?? '')
    setInvEditAltCode(item.altCode ?? '')
    setInvEditRrp(String(item.rrp))
    setInvEditDiscount(String(item.discount))
    setInvEditQuantity(String(item.quantity))
    setInvEditSellingPrice(String(item.sellingPrice))
    setInvEditWeight(item.weight ? String(item.weight) : '')
  }

  const openAddInventoryItem = () => {
    setShowAddInventoryItem(true)
    setInvEditTitle('')
    setInvEditCategory('Books')
    setInvEditPublisher('')
    setInvEditCode('')
    setInvEditAltCode('')
    setInvEditRrp('')
    setInvEditDiscount('0')
    setInvEditQuantity('')
    setInvEditSellingPrice('')
    setInvEditWeight('')
  }

  const handleInventoryScan = (raw: string) => {
    const code = raw.trim().toLowerCase()
    if (!code) return
    const exact = inventory.find((i) => itemMatchesCode(i, raw))
    if (exact) {
      // Matched a bound book → confirm how many to add to its stock.
      setInventoryScannerOpen(false)
      setScanStockQty(1)
      setScanStockConfirm(exact)
      return
    }
    const titleMatches = inventory.filter((i) => i.title.toLowerCase().includes(code))
    if (titleMatches.length === 1) {
      setInventoryScannerOpen(false)
      setScanStockQty(1)
      setScanStockConfirm(titleMatches[0])
      return
    }
    // No or ambiguous match → open the Add form pre-filled with the scanned code.
    openAddInventoryItem()
    setInvEditCode(raw.trim())
    setUploadMessage(`No item matched "${raw.trim()}". Add it as a new item.`)
    setInventoryScannerOpen(false)
  }

  // Confirm a scanned book → add the chosen quantity to its stock and persist.
  const confirmScanToInventory = async () => {
    const item = scanStockConfirm
    const addQty = Math.max(1, Math.round(scanStockQty))
    setScanStockConfirm(null)
    if (!item) return
    const updatedItem: InventoryItem = { ...item, quantity: item.quantity + addQty }
    setInventory((current) => current.map((i) => (i.id === updatedItem.id ? updatedItem : i)))
    setUploadMessage(`Added ${addQty} to "${item.title}" (now ${updatedItem.quantity} in stock).`)
    try {
      // Atomic add so a concurrent sale can't clobber the restock.
      await updateDoc(doc(db, 'inventory', updatedItem.id), { quantity: increment(addQty), _live: true })
      await mirrorStockToCatalog(updatedItem, updatedItem.quantity)
    } catch (error) {
      console.error('Scan restock error:', error)
      setUploadMessage(`"${item.title}" updated locally but failed to sync to cloud.`)
    }
  }

  const handleSaveInventoryItem = async () => {
    if (!invEditTitle.trim() || !invEditQuantity) return
    setIsSavingInventory(true)
    const updatedItem: InventoryItem = {
      id: editingInventoryItem ? editingInventoryItem.id : `inv-${Date.now()}`,
      title: invEditTitle.trim(),
      category: invEditCategory,
      publisher: invEditPublisher.trim(),
      code: invEditCode.trim(),
      altCode: invEditAltCode.trim(),
      // Legacy mirrors so the orders Cloud Function still resolves this item.
      sku: invEditCode.trim(),
      isbn: isIsbn13(invEditCode.trim()) ? invEditCode.trim() : '',
      rrp: Number(invEditRrp) || 0,
      discount: Number(invEditDiscount) || 0,
      quantity: Number(invEditQuantity) || 0,
      sellingPrice: Number(invEditSellingPrice) || 0,
      weight: Number(invEditWeight) || 0
    }
    if (editingInventoryItem) {
      setInventory((current) => current.map((i) => i.id === updatedItem.id ? updatedItem : i))
    } else {
      setInventory((current) => [...current, updatedItem])
    }
    // Close modal immediately and show confirmation
    setEditingInventoryItem(null)
    setShowAddInventoryItem(false)
    setIsSavingInventory(false)
    setUploadMessage(editingInventoryItem ? `✅ "${updatedItem.title}" updated.` : `✅ "${updatedItem.title}" added.`)
    // Reverse link: if this item has a SKU but no catalog entry exists for it,
    // prompt the admin to add images and description (do not fabricate anything).
    if (updatedItem.sku) {
      const hasCatalog = catalogItems.some(
        (c) =>
          (c.sku && c.sku.trim() === updatedItem.sku.trim()) ||
          c.title.trim().toLowerCase() === updatedItem.title.trim().toLowerCase()
      )
      setNoCatalogPrompt(hasCatalog ? null : updatedItem)
    } else {
      setNoCatalogPrompt(null)
    }
    // Sync to Firebase in the background
    try {
      await setDoc(doc(db, 'inventory', updatedItem.id), { ...updatedItem, _live: true })
      await mirrorStockToCatalog(updatedItem)
    } catch (error) {
      console.error('Save inventory item error:', error)
      setUploadMessage(`⚠️ "${updatedItem.title}" saved locally but failed to sync to cloud.`)
    }
  }

  const handleDeleteInventoryItem = async (item: InventoryItem) => {
    if (!confirm(`Delete "${item.title}" from inventory?`)) return
    setInventory((current) => current.filter((i) => i.id !== item.id))
    try {
      await deleteDoc(doc(db, 'inventory', item.id))
    } catch (error) {
      console.error('Delete inventory item error:', error)
    }
  }

  // Bind a scanned/typed code to an existing inventory item. Everything lands
  // in the one `code` field; any code already on the item is kept as altCode so
  // a previously printed label still scans.
  const handleBindCode = async (item: InventoryItem, rawValue: string) => {
    const value = rawValue.trim()
    if (!value) return
    const priorCode = (item.code || '').trim()
    const updatedItem: InventoryItem = {
      ...item,
      code: value,
      altCode: priorCode && normalizeCode(priorCode) !== normalizeCode(value) ? priorCode : item.altCode,
      sku: value,
      isbn: isIsbn13(value) ? value : ''
    }
    setInventory((current) => current.map((i) => (i.id === updatedItem.id ? updatedItem : i)))
    setBindTargetItem(null)
    setUploadMessage(`Bound code "${value}" to "${item.title}".`)
    try {
      await setDoc(doc(db, 'inventory', updatedItem.id), { ...updatedItem, _live: true })
    } catch (error) {
      console.error('Bind code error:', error)
      setUploadMessage(`"${item.title}" bound locally but failed to sync to cloud.`)
    }
  }

  // Clear the code bound to an item so a mistaken one can be corrected
  // (then re-bind). Persists via the same setDoc path.
  const handleUnbindCode = async (item: InventoryItem) => {
    if (!item.code && !item.altCode) return
    if (!confirm(`Unbind the code from "${item.title}"? You can re-bind a new QR/barcode afterwards.`)) return
    const updatedItem: InventoryItem = { ...item, code: '', altCode: '', sku: '', isbn: '' }
    setInventory((current) => current.map((i) => (i.id === updatedItem.id ? updatedItem : i)))
    setQrModalItem((cur) => (cur && cur.id === updatedItem.id ? updatedItem : cur))
    setUploadMessage(`Unbound the code from "${item.title}".`)
    try {
      await setDoc(doc(db, 'inventory', updatedItem.id), { ...updatedItem, _live: true })
    } catch (error) {
      console.error('Unbind code error:', error)
      setUploadMessage(`"${item.title}" unbound locally but failed to sync to cloud.`)
    }
  }

  // Generate a QR image for an item's code (or id if it has none) and open the label modal.
  const openQrLabel = async (item: InventoryItem) => {
    const value = (item.code || item.id).trim()
    setQrModalItem(item)
    setQrDataUrl('')
    try {
      const url = await QRCode.toDataURL(value, { width: 320, margin: 2 })
      setQrDataUrl(url)
    } catch (error) {
      console.error('QR generation error:', error)
    }
  }

  const handleClearInventory = async () => {
    if (!confirm('Are you sure you want to clear ALL inventory? This will remove every item from stock. Events and catalog will not be affected.')) return
    if (!confirm('This action cannot be undone. Type OK to confirm you want to delete all inventory items.')) return
    const oldInventory = [...inventory]
    setInventory([])
    setUploadMessage('Inventory cleared successfully.')
    try {
      const batch = writeBatch(db)
      oldInventory.forEach((item) => {
        batch.delete(doc(db, 'inventory', item.id))
      })
      await batch.commit()
    } catch (error) {
      console.error('Clear inventory error:', error)
      setInventory(oldInventory)
      setUploadMessage('Failed to clear inventory. Restored locally.')
    }
  }

  // ─── Online orders (Stripe) ───
  const loadOrders = async () => {
    setOrdersLoading(true)
    try {
      const snap = await getDocs(collection(db, 'orders'))
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OnlineOrder, 'id'>) }))
      // Separate live from test-mode orders. finalizeOrder stamps `_live` from
      // pi.livemode on each order (older docs may use `live`). In demo mode we
      // show test orders; in live mode we show only real (live-mode) orders, so
      // test orders never appear alongside genuine sales.
      const isLiveOrder = (o: OnlineOrder) => (o._live ?? o.live) === true
      const rows = all.filter((o) => (demoMode ? !isLiveOrder(o) : isLiveOrder(o)))
      // Newest first by createdAt seconds (fallback: keep order).
      rows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      setOrders(rows)
    } catch (error) {
      console.error('Failed to load orders:', error)
    } finally {
      setOrdersLoading(false)
    }
  }

  // Fetch orders when the Orders or Home view opens (admin only).
  // Home reuses the same `orders` state so its summary reflects online orders.
  useEffect(() => {
    if ((activeView === 'orders' || activeView === 'home') && userRole === 'admin') {
      loadOrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, userRole, demoMode])

  // ─── Summer Reading Program registrations ───
  const loadSummerReaders = async () => {
    setSummerLoading(true)
    try {
      const snap = await getDocs(collection(db, 'summerReads'))
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SummerReader, 'id'>) }))
      // Newest first by createdAt seconds.
      rows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      setSummerReaders(rows)
    } catch (error) {
      console.error('Failed to load summer readers:', error)
    } finally {
      setSummerLoading(false)
    }
  }

  // Fetch summer readers when the Summer Reads view opens (admin only).
  useEffect(() => {
    if (activeView === 'summer' && userRole === 'admin') {
      loadSummerReaders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, userRole])

  // ─── Book requests (out-of-stock pre-orders) ───
  const loadBookRequests = async () => {
    setBookRequestsLoading(true)
    try {
      const snap = await getDocs(collection(db, 'bookRequests'))
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BookRequest, 'id'>) }))
      rows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      setBookRequests(rows)
    } catch (error) {
      console.error('Failed to load book requests:', error)
    } finally {
      setBookRequestsLoading(false)
    }
  }

  // Fetch book requests when that view opens (admin only).
  useEffect(() => {
    if (activeView === 'bookRequests' && userRole === 'admin') {
      loadBookRequests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, userRole])

  // Manually send the customer their purchase-confirmation email. Not automatic
  // on payment; the admin triggers it from the order record.
  const sendPurchaseEmailToCustomer = async (order: OnlineOrder) => {
    if (!order.customer?.email) { alert('This order has no customer email.'); return }
    if (!confirm(`Send the purchase email to ${order.customer.email}?`)) return
    setPurchaseEmailSending(true)
    try {
      const callable = httpsCallable<{ orderId: string }, { ok: boolean; to: string }>(functions, 'sendPurchaseEmail')
      await callable({ orderId: order.id })
      setPurchaseEmailSentId(order.id)
    } catch (err) {
      console.error('sendPurchaseEmail failed', err)
      alert('Could not send the purchase email. Please try again.')
    } finally {
      setPurchaseEmailSending(false)
    }
  }

  const markOrderShipped = async (order: OnlineOrder) => {
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: 'shipped', shippedAt: serverTimestamp() })
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'shipped' } : o)))
      setExpandedOrder((cur) => (cur && cur.id === order.id ? { ...cur, status: 'shipped' } : cur))
    } catch (error) {
      console.error('Failed to mark order shipped:', error)
      alert('Could not update the order. Please try again.')
    }
  }

  const markOrderDelivered = async (order: OnlineOrder) => {
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: 'delivered', deliveredAt: serverTimestamp() })
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'delivered' } : o)))
      setExpandedOrder((cur) => (cur && cur.id === order.id ? { ...cur, status: 'delivered' } : cur))
    } catch (error) {
      console.error('Failed to mark order delivered:', error)
      alert('Could not update the order. Please try again.')
    }
  }

  const deleteOnlineOrder = async (order: OnlineOrder) => {
    // Return stock only if this order reduced it (paid/shipped) AND it hasn't
    // already been restored (e.g. it was cancelled first).
    const willRestore = (order.status === 'paid' || order.status === 'shipped') && !order.stockRestored
    if (!confirm(`Delete order ${order.id}?${willRestore ? ' Its items will be returned to inventory.' : ''} This cannot be undone.`)) return
    const restore = willRestore ? restoreInventoryForOnlineOrder(order) : new Map<string, number>()
    try {
      await deleteDoc(doc(db, 'orders', order.id))
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
      setExpandedOrder(null)
      await syncInventoryDeltas(restore)
    } catch (error) {
      console.error('Failed to delete order:', error)
      alert('Could not delete the order. Please try again.')
    }
  }

  // Resolve which inventory item an online-order line corresponds to. New orders
  // carry inventoryId/sku (set server-side); older ones fall back to sku, ISBN,
  // then exact title (mirroring the server's resolution order).
  const findInventoryForOrderItem = (it: OnlineOrderItem): InventoryItem | undefined => {
    if (it.inventoryId) {
      const byId = inventory.find((i) => i.id === it.inventoryId)
      if (byId) return byId
    }
    if (it.sku && it.sku.trim()) {
      const bySku = inventory.find((i) => (i.sku || '').trim() === it.sku!.trim())
      if (bySku) return bySku
    }
    return inventory.find((i) => i.title.trim().toLowerCase() === it.title.trim().toLowerCase())
  }

  // Add an online order's quantities back to inventory (on cancel/delete of a
  // previously-paid order). Returns a map of inventoryId -> quantity to add back,
  // and applies the change to local state. The cloud write uses increment() so it
  // merges safely with any concurrent decrement (e.g. a racing online finalize).
  const restoreInventoryForOnlineOrder = (order: OnlineOrder): Map<string, number> => {
    const deltas = new Map<string, number>() // inventoryId -> qty to add back (positive)
    let unmatched = 0
    for (const it of order.items ?? []) {
      const inv = findInventoryForOrderItem(it)
      if (inv) deltas.set(inv.id, (deltas.get(inv.id) ?? 0) + it.quantity)
      else unmatched += 1
    }
    if (unmatched > 0) {
      alert(`Note: ${unmatched} item(s) on this order could not be matched to an inventory record, so their stock was not restored. Adjust those items manually.`)
    }
    if (deltas.size === 0) return deltas
    setInventory((current) =>
      current.map((i) => (deltas.has(i.id) ? { ...i, quantity: i.quantity + (deltas.get(i.id) as number) } : i))
    )
    return deltas
  }

  // Apply inventory quantity CHANGES atomically. `deltas` maps inventoryId to a
  // signed change (negative = sold, positive = restored). Uses Firestore
  // increment() so concurrent writers never clobber each other's counts, then
  // mirrors the resulting count onto the storefront catalog.
  const syncInventoryDeltas = async (deltas: Map<string, number>) => {
    const entries = [...deltas.entries()].filter(([, d]) => d !== 0)
    if (entries.length === 0) return
    try {
      const batch = writeBatch(db)
      entries.forEach(([id, d]) => batch.update(doc(db, 'inventory', id), { quantity: increment(d), _live: true }))
      await batch.commit()
    } catch (error) {
      console.error('Inventory delta sync error:', error)
    }
    // Mirror to catalog using the post-change quantity (snapshot + delta).
    await Promise.all(
      entries.map(([id, d]) => {
        const it = inventory.find((i) => i.id === id)
        return it ? mirrorStockToCatalog(it, it.quantity + d) : Promise.resolve()
      })
    )
  }

  // Inventory is the single stock source of truth; the catalog carries a
  // mirrored display count so the storefront shows correct availability. Push an
  // inventory item's current quantity onto its linked catalog doc (matched by
  // SKU, else title). Best-effort and non-blocking.
  const mirrorStockToCatalog = async (item: InventoryItem, quantityOverride?: number) => {
    const sku = (item.sku || '').trim()
    const match = catalogItems.find(
      (c) => (sku && (c.sku || '').trim() === sku) ||
             c.title.trim().toLowerCase() === item.title.trim().toLowerCase()
    )
    if (!match) return
    const qty = quantityOverride ?? item.quantity
    try {
      await updateDoc(doc(db, 'catalog', match.id), { stock: Math.max(0, qty) })
    } catch (error) {
      console.error('Catalog stock mirror error:', error)
    }
  }

  const updateOnlineOrderStatus = async (order: OnlineOrder, status: OnlineOrder['status']) => {
    if (status === order.status) return
    // Cancelling/failing a paid or shipped order returns its stock to inventory,
    // but only ONCE (guarded by the stockRestored flag) so toggling status can't
    // inflate stock. Once restored, the flag stays set for the order's life.
    const nowCancelled = status === 'cancelled' || status === 'failed'
    const shouldRestore = nowCancelled && !order.stockRestored
    const restore = shouldRestore ? restoreInventoryForOnlineOrder(order) : new Map<string, number>()
    const didRestore = restore.size > 0
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status,
        ...(didRestore ? { stockRestored: true } : {}),
      })
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status, ...(didRestore ? { stockRestored: true } : {}) } : o)))
      setExpandedOrder((cur) => (cur && cur.id === order.id ? { ...cur, status, ...(didRestore ? { stockRestored: true } : {}) } : cur))
      await syncInventoryDeltas(restore)
    } catch (error) {
      console.error('Failed to update order status:', error)
      alert('Could not update the order status. Please try again.')
    }
  }

  // Recompute an order's items/totals (admin edit): quantities and line removals.
  // Keeps the order's original tax rate; re-applies free shipping over $80.
  const recomputeOrder = (order: OnlineOrder, items: OnlineOrderItem[]): OnlineOrder => {
    const round2 = (n: number) => Math.round(n * 100) / 100
    const nextItems = items.map((it) => ({ ...it, lineTotal: round2(it.unitPrice * it.quantity) }))
    const subtotal = round2(nextItems.reduce((s, it) => s + it.lineTotal, 0))
    const taxRate = order.subtotal > 0 ? (order.tax ?? 0) / order.subtotal : 0
    const tax = round2(subtotal * taxRate)
    const shippingFee = subtotal >= 80 ? 0 : (subtotal > 0 ? 5.99 : 0)
    const total = round2(subtotal + tax + shippingFee)
    return { ...order, items: nextItems, subtotal, tax, shippingFee, total }
  }

  const [savingOrder, setSavingOrder] = useState(false)
  const saveOrderItems = async (order: OnlineOrder) => {
    setSavingOrder(true)
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        shippingFee: order.shippingFee,
        total: order.total,
      })
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)))
    } catch (error) {
      console.error('Failed to save order items:', error)
      alert('Could not save the order changes. Please try again.')
    } finally {
      setSavingOrder(false)
    }
  }

  const deleteReaderRegistration = async (reader: SummerReader) => {
    if (!confirm(`Delete registration for ${reader.childName}? This cannot be undone.`)) return
    try {
      await deleteDoc(doc(db, 'summerReads', reader.id))
      setSummerReaders((prev) => prev.filter((r) => r.id !== reader.id))
      setExpandedReader(null)
    } catch (error) {
      console.error('Failed to delete registration:', error)
      alert('Could not delete the registration. Please try again.')
    }
  }

  // Re-send the Summer Reads welcome email to a reader's parent (for signups made
  // before the welcome email existed, or that never arrived). Server re-sends from
  // the record on file; requires the code + parent email to match.
  const resendReaderWelcome = async (reader: SummerReader) => {
    if (!reader.parentEmail) { alert('This reader has no parent email on file.'); return }
    if (!confirm(`Send the welcome email to ${reader.parentEmail}?`)) return
    setWelcomeSending(true)
    setWelcomeSent(null)
    try {
      const callable = httpsCallable<
        { code: string; parentEmail: string },
        { sent: boolean; parentEmail: string }
      >(functions, 'resendSummerWelcome')
      await callable({ code: reader.code, parentEmail: reader.parentEmail })
      setWelcomeSent(reader.id)
    } catch (err) {
      console.error('resendSummerWelcome failed', err)
      alert('Could not send the welcome email. Please try again.')
    } finally {
      setWelcomeSending(false)
    }
  }

  const deleteReaderBook = async (reader: SummerReader, index: number) => {
    if (!confirm('Delete this logged book?')) return
    try {
      const callable = httpsCallable<
        { code: string; index: number; parentEmail: string },
        { booksLogged?: SummerBookLog[]; booksCount?: number; level?: string; goal?: number; goalMet?: boolean }
      >(functions, 'deleteSummerBook')
      const res = await callable({ code: reader.code, index, parentEmail: reader.parentEmail })
      const data = res.data || {}
      // The callable returns counts/level but NOT the array, so remove the entry
      // locally by index (server already removed it from Firestore).
      const removeAt = (arr?: SummerBookLog[]) => (arr ? arr.filter((_, i) => i !== index) : arr)
      setSummerReaders((prev) =>
        prev.map((r) =>
          r.id === reader.id
            ? {
                ...r,
                booksLogged: removeAt(r.booksLogged),
                booksCount: data.booksCount ?? r.booksCount,
                level: data.level ?? r.level,
                goal: data.goal ?? r.goal,
                goalMet: data.goalMet ?? r.goalMet,
                tier: data.level ?? r.tier,
              }
            : r
        )
      )
      setExpandedReader((cur) =>
        cur && cur.id === reader.id
          ? {
              ...cur,
              booksLogged: removeAt(cur.booksLogged),
              booksCount: data.booksCount ?? cur.booksCount,
              level: data.level ?? cur.level,
              goal: data.goal ?? cur.goal,
              goalMet: data.goalMet ?? cur.goalMet,
              tier: data.level ?? cur.tier,
            }
          : cur
      )
    } catch (error) {
      console.error('Failed to delete logged book:', error)
      alert('Could not delete the book. Please try again.')
    }
  }

  // Admin: silently mark a logged book valid/invalid. Only valid books count
  // toward the goal & raffle eligibility (recomputed server-side).
  const setReaderBookValidity = async (reader: SummerReader, index: number, valid: boolean) => {
    setBookValidityBusy(index)
    try {
      const callable = httpsCallable<
        { code: string; index: number; valid: boolean },
        { booksCount?: number; level?: string; goal?: number; goalMet?: boolean; valid?: boolean }
      >(functions, 'setSummerBookValidity')
      const res = await callable({ code: reader.code, index, valid })
      const data = res.data || {}
      const applyValid = (arr?: SummerBookLog[]) => (arr ? arr.map((b, i) => (i === index ? { ...b, valid } : b)) : arr)
      const patch = (r: SummerReader): SummerReader => ({
        ...r,
        booksLogged: applyValid(r.booksLogged),
        booksCount: data.booksCount ?? r.booksCount,
        level: data.level ?? r.level,
        goal: data.goal ?? r.goal,
        goalMet: data.goalMet ?? r.goalMet,
        tier: data.level ?? r.tier,
      })
      setSummerReaders((prev) => prev.map((r) => (r.id === reader.id ? patch(r) : r)))
      setExpandedReader((cur) => (cur && cur.id === reader.id ? patch(cur) : cur))
    } catch (error) {
      console.error('Failed to set book validity:', error)
      alert('Could not update the book. Please try again.')
    } finally {
      setBookValidityBusy(null)
    }
  }

  // Admin: override a reader's raffle eligibility. `eligible` = true/false to
  // force, or null to clear the override (revert to country-derived default).
  const setReaderEligibilityOverride = async (reader: SummerReader, eligible: boolean | null) => {
    setEligibilityBusy(true)
    try {
      const callable = httpsCallable<
        { code: string; eligible: boolean | null },
        { raffleEligible: boolean; overridden: boolean }
      >(functions, 'setSummerReaderEligibility')
      const res = await callable({ code: reader.code, eligible })
      const data = res.data
      const patch = (r: SummerReader): SummerReader => ({
        ...r,
        raffleEligible: data.raffleEligible,
        raffleEligibleOverride: data.overridden ? data.raffleEligible : undefined,
      })
      setSummerReaders((prev) => prev.map((r) => (r.id === reader.id ? patch(r) : r)))
      setExpandedReader((cur) => (cur && cur.id === reader.id ? patch(cur) : cur))
    } catch (error) {
      console.error('Failed to set eligibility:', error)
      alert('Could not update eligibility. Please try again.')
    } finally {
      setEligibilityBusy(false)
    }
  }

  // Admin: send the Summer Reads reminder. With no args it broadcasts to every
  // registered parent (recipients gathered server-side); with a testEmail it
  // sends only to that address so the admin can preview it in a real inbox.
  const sendReminder = async (opts?: { testEmail?: string }) => {
    const isTest = Boolean(opts?.testEmail)
    if (isTest) setReminderTestSending(true)
    else setReminderSending(true)
    setReminderResult(null)
    try {
      const callable = httpsCallable<
        { testEmail?: string },
        { sent: number; failed: number; recipients: number; skipped?: boolean; test?: boolean }
      >(functions, 'sendSummerReminder')
      const res = await callable(isTest ? { testEmail: opts!.testEmail } : {})
      const data = res.data
      setReminderResult({ sent: data.sent ?? 0, failed: data.failed ?? 0, recipients: data.recipients ?? 0, test: data.test })
    } catch (error) {
      console.error('Failed to send reminder:', error)
      const msg = (error as { message?: string })?.message
      alert(msg && /email/i.test(msg) ? msg : 'Could not send the reminder. Please try again.')
    } finally {
      if (isTest) setReminderTestSending(false)
      else setReminderSending(false)
    }
  }

  const orderStatusBadge = (status: OnlineOrder['status']) => {
    const map: Record<OnlineOrder['status'], string> = {
      paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      shipped: 'bg-blue-100 text-blue-700 border-blue-200',
      delivered: 'bg-green-100 text-green-800 border-green-300',
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      failed: 'bg-red-100 text-red-700 border-red-200',
      cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
    }
    return `rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${map[status] ?? map.pending}`
  }

  const fmtDate = (ts?: { seconds: number } | null) =>
    ts?.seconds ? new Date(ts.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'

  const renderOrders = () => {
    const filtered = orders.filter((o) => (orderStatusFilter === 'all' ? true : o.status === orderStatusFilter))
    const paidCount = orders.filter((o) => o.status === 'paid').length
    const revenue = orders.filter((o) => o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered').reduce((s, o) => s + o.total, 0)
    return (
      <div className="fade-up space-y-6">
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total Orders', value: String(orders.length) },
            { label: 'Awaiting Shipment', value: String(paidCount) },
            { label: 'Revenue (paid)', value: `$${revenue.toFixed(2)}` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-5 shadow-xl border border-primary/5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{s.label}</p>
              <p className="mt-2 font-display text-2xl gradient-text">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-xl border border-primary/10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(['all', 'paid', 'shipped', 'delivered', 'cancelled'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOrderStatusFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-all duration-300 ${
                    orderStatusFilter === f ? 'bg-gradient-to-r from-primary to-secondary text-white shadow' : 'bg-primary/5 text-primaryDark hover:bg-primary/10'
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={loadOrders}
              className="flex items-center gap-1.5 rounded-full border border-primary/20 px-4 py-1.5 text-xs font-bold text-primaryDark transition hover:bg-primary/5"
            >
              <svg className={`h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
          </div>

          {ordersLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted">
              <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading orders…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/40">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              </div>
              <p className="text-muted">No {orderStatusFilter === 'all' ? '' : orderStatusFilter} orders yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-xs uppercase tracking-wider text-muted">
                    <th className="pb-3 pr-4 font-semibold">Order</th>
                    <th className="pb-3 pr-4 font-semibold">Customer</th>
                    <th className="pb-3 pr-4 font-semibold">Date</th>
                    <th className="pb-3 pr-4 font-semibold">Total</th>
                    <th className="pb-3 pr-4 font-semibold">Status</th>
                    <th className="pb-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} className="border-b border-black/5 transition hover:bg-primary/5">
                      <td className="py-3 pr-4 font-mono text-xs text-muted">{o.id.slice(0, 8)}…</td>
                      <td className="py-3 pr-4"><span className="font-medium text-ink">{o.customer?.name}</span><br /><span className="text-xs text-muted">{o.customer?.email}</span></td>
                      <td className="py-3 pr-4 text-muted">{fmtDate(o.createdAt)}</td>
                      <td className="py-3 pr-4 font-bold text-primaryDark">${o.total?.toFixed(2)}</td>
                      <td className="py-3 pr-4"><span className={orderStatusBadge(o.status)}>{o.status}</span></td>
                      <td className="py-3 text-right">
                        <button type="button" onClick={() => setExpandedOrder(o)} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primaryDark transition hover:bg-primary/20">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  const summerTierBadge = (tier: SummerReader['tier']) => {
    const map: Record<string, string> = {
      seedling: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      reader: 'bg-primary/10 text-primaryDark border-primary/20',
      scholar: 'bg-secondary/10 text-secondary border-secondary/20',
      none: 'bg-gray-100 text-gray-600 border-gray-200',
    }
    return `rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${map[tier] ?? map.none}`
  }

  const exportSummerCsv = () => {
    const header = ['Code', 'Child Name', 'Child Age', 'Parent Name', 'Parent Email', 'Parent Phone', 'Country', 'Valid Books', 'Invalid Books', 'Total Logged', 'Level', 'Goal', 'Goal Met', 'Raffle Eligible', 'Eligibility Override']
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = summerReaders.map((r) => {
      const lvl = readerLevel(r)
      const g = r.goal ?? LEVEL_GOAL[lvl] ?? 3
      const validBooks = readerValidBooksCount(r)
      const totalLogged = Array.isArray(r.booksLogged) ? r.booksLogged.length : (r.booksCount ?? 0)
      const invalidBooks = totalLogged - validBooks
      const override = typeof r.raffleEligibleOverride === 'boolean' ? (r.raffleEligibleOverride ? 'Eligible' : 'Not eligible') : ''
      return [r.code, r.childName, r.childAge, r.parentName, r.parentEmail, r.parentPhone, r.country, validBooks, invalidBooks, totalLogged, lvl, g, readerGoalMet(r) ? 'Yes' : 'No', readerRaffleEligible(r) ? 'Yes' : 'No', override].map(escape).join(',')
    })
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `eduvate-summer-reads-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const renderSummer = () => {
    const goalsMet = summerReaders.filter((r) => readerGoalMet(r)).length
    // Total valid books logged (only valid books count towards the record).
    const totalValidBooks = summerReaders.reduce((s, r) => s + readerValidBooksCount(r), 0)
    const totalInvalidBooks = summerReaders.reduce(
      (s, r) => s + (Array.isArray(r.booksLogged) ? r.booksLogged.filter((b) => b.valid === false).length : 0),
      0
    )
    // Eligible for the prize draw = goal met AND raffle-eligible (country/override).
    const raffleEntries = summerReaders.filter((r) => readerGoalMet(r) && readerRaffleEligible(r)).length

    // ── Chart data ──
    // Reader distribution by level.
    const LEVEL_LABEL: Record<string, string> = { seedling: 'Early Readers', reader: 'Growing Readers', scholar: 'Confident Readers' }
    const levelData = (['seedling', 'reader', 'scholar'] as const).map((lvl) => ({
      name: LEVEL_LABEL[lvl],
      level: lvl,
      readers: summerReaders.filter((r) => readerLevel(r) === lvl).length,
      met: summerReaders.filter((r) => readerLevel(r) === lvl && readerGoalMet(r)).length,
    }))
    // Reader distribution by country (top 6, rest grouped as "Other").
    const countryCounts = new Map<string, number>()
    summerReaders.forEach((r) => {
      const c = (r.country || '').trim() || 'Unknown'
      countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1)
    })
    const countrySorted = Array.from(countryCounts.entries()).sort((a, b) => b[1] - a[1])
    const countryTop = countrySorted.slice(0, 6).map(([name, readers]) => ({ name, readers }))
    const countryOther = countrySorted.slice(6).reduce((s, [, n]) => s + n, 0)
    const countryData = countryOther > 0 ? [...countryTop, { name: 'Other', readers: countryOther }] : countryTop
    // Raffle eligibility split.
    const eligibleCount = summerReaders.filter((r) => readerRaffleEligible(r)).length
    const eligibilityData = [
      { name: 'Eligible', value: eligibleCount },
      { name: 'Not eligible', value: summerReaders.length - eligibleCount },
    ]
    // Book validity split.
    const bookStatusData = [
      { name: 'Valid (counted)', value: totalValidBooks },
      { name: 'Invalid (off-list)', value: totalInvalidBooks },
    ]
    // Palette (CVD-validated): green, purple, pink, amber.
    const CAT = ['#1a7a3c', '#7c3aed', '#ec4899', '#f59e0b']
    const ELIG_COLORS = ['#1a7a3c', '#cbd5e1']
    const BOOK_COLORS = ['#1a7a3c', '#ec4899']
    const hasData = summerReaders.length > 0

    return (
      <div className="fade-up space-y-6">
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Total Registered', value: String(summerReaders.length) },
            { label: 'Goals Met', value: String(goalsMet) },
            { label: 'Raffle Entries', value: String(raffleEntries) },
            { label: 'Valid Books', value: String(totalValidBooks) },
            { label: 'Invalid Books', value: String(totalInvalidBooks) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-5 shadow-xl border border-primary/5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{s.label}</p>
              <p className="mt-2 font-display text-2xl gradient-text">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Program insights (charts) */}
        {hasData && (
          <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-xl border border-primary/10">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 text-primaryDark">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l3-4 3 3 4-6" /></svg>
              </span>
              <div>
                <p className="font-display text-base font-bold text-primaryDark">Program insights</p>
                <p className="text-xs text-muted">Reader participation, distribution, and book validity at a glance</p>
              </div>
            </div>

            {/* Group 1: Readers */}
            <p className="mt-6 mb-3 text-[11px] font-bold uppercase tracking-wider text-muted">Readers</p>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-black/5 bg-gray-50/60 p-4">
                <p className="text-sm font-bold text-primaryDark">Distribution by level</p>
                <p className="text-xs text-muted">Registered readers and how many have met their goal</p>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={levelData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e9e9ef" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="readers" name="Registered" fill={CAT[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="met" name="Goal met" fill={CAT[1]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-black/5 bg-gray-50/60 p-4">
                <p className="text-sm font-bold text-primaryDark">Distribution by country</p>
                <p className="text-xs text-muted">Where our readers are joining from</p>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={countryData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e9e9ef" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                      <Bar dataKey="readers" name="Readers" fill={CAT[1]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Group 2: Books & eligibility */}
            <p className="mt-8 mb-3 text-[11px] font-bold uppercase tracking-wider text-muted">Books &amp; eligibility</p>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-black/5 bg-gray-50/60 p-4">
                <p className="text-sm font-bold text-primaryDark">Raffle eligibility</p>
                <p className="text-xs text-muted">Eligible for the draw (US / Nigeria / Canada or admin override)</p>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={eligibilityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} label={(e) => `${e.name}: ${e.value}`} labelLine={false} style={{ fontSize: 11 }}>
                        {eligibilityData.map((_, i) => <Cell key={i} fill={ELIG_COLORS[i]} stroke="#fff" strokeWidth={2} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-black/5 bg-gray-50/60 p-4">
                <p className="text-sm font-bold text-primaryDark">Books logged: valid vs invalid</p>
                <p className="text-xs text-muted">Only books from the recommended list count towards the record</p>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={bookStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} label={(e) => `${e.name}: ${e.value}`} labelLine={false} style={{ fontSize: 11 }}>
                        {bookStatusData.map((_, i) => <Cell key={i} fill={BOOK_COLORS[i]} stroke="#fff" strokeWidth={2} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-xl border border-primary/10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportSummerCsv}
                disabled={summerReaders.length === 0}
                className="flex items-center gap-1.5 rounded-full border border-primary/20 px-4 py-1.5 text-xs font-bold text-primaryDark transition hover:bg-primary/5 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => { setReminderResult(null); setReminderOpen(true) }}
                disabled={summerReaders.length === 0}
                className="flex items-center gap-1.5 rounded-full border border-secondary/30 px-4 py-1.5 text-xs font-bold text-secondary transition hover:bg-secondary/5 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Reminder Email
              </button>
            </div>
            <button
              type="button"
              onClick={loadSummerReaders}
              className="flex items-center gap-1.5 rounded-full border border-primary/20 px-4 py-1.5 text-xs font-bold text-primaryDark transition hover:bg-primary/5"
            >
              <svg className={`h-4 w-4 ${summerLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
          </div>

          {summerLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted">
              <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading registrations…
            </div>
          ) : summerReaders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/40">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <p className="text-muted">No registrations yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-xs uppercase tracking-wider text-muted">
                    <th className="pb-3 pr-4 font-semibold">Code</th>
                    <th className="pb-3 pr-4 font-semibold">Child</th>
                    <th className="pb-3 pr-4 font-semibold">Parent</th>
                    <th className="pb-3 pr-4 font-semibold">Books</th>
                    <th className="pb-3 pr-4 font-semibold">Level</th>
                    <th className="pb-3 pr-4 font-semibold">Raffle</th>
                    <th className="pb-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {summerReaders.map((r) => {
                    const lvl = readerLevel(r)
                    const g = r.goal ?? LEVEL_GOAL[lvl] ?? 3
                    const met = readerGoalMet(r)
                    const eligible = readerRaffleEligible(r)
                    return (
                    <tr key={r.id} className="border-b border-black/5 transition hover:bg-primary/5">
                      <td className="py-3 pr-4 font-mono text-xs text-muted">{r.code}</td>
                      <td className="py-3 pr-4"><span className="font-medium text-ink">{r.childName}</span>{r.childAge != null && <><br /><span className="text-xs text-muted">Age {r.childAge}</span></>}</td>
                      <td className="py-3 pr-4"><span className="font-medium text-ink">{r.parentName}</span><br /><span className="text-xs text-muted">{r.parentEmail}</span></td>
                      <td className="py-3 pr-4 font-bold text-primaryDark">{readerValidBooksCount(r)}<span className="font-normal text-muted"> / {g}</span></td>
                      <td className="py-3 pr-4">
                        <span className={summerTierBadge(lvl)}>{lvl}</span>
                        {met && <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700" title="Goal met"><svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></span>}
                      </td>
                      <td className="py-3 pr-4">
                        {eligible
                          ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700" title={r.country || 'USA / Nigeria / Canada'}>Eligible</span>
                          : <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-500" title={r.country || 'Country not on file'}>Not eligible</span>}
                      </td>
                      <td className="py-3 text-right">
                        <button type="button" onClick={() => setExpandedReader(r)} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primaryDark transition hover:bg-primary/20">View</button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  const exportBookRequestsCsv = () => {
    const header = ['Date', 'Book', 'Name', 'Email', 'Phone', 'Quantity', 'Status']
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = bookRequests.map((r) => [
      r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toISOString().slice(0, 10) : '',
      r.bookTitle, r.name, r.email, r.phone, r.quantity, r.status || 'requested',
    ].map(escape).join(','))
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `eduvate-book-requests-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const renderBookRequests = () => {
    const totalCopies = bookRequests.reduce((s, r) => s + (r.quantity ?? 0), 0)
    return (
      <div className="fade-up space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total Requests', value: String(bookRequests.length) },
            { label: 'Copies Requested', value: String(totalCopies) },
            { label: 'Unique Books', value: String(new Set(bookRequests.map((r) => r.bookTitle)).size) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-5 shadow-xl border border-primary/5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{s.label}</p>
              <p className="mt-2 font-display text-2xl gradient-text">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-xl border border-primary/10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={exportBookRequestsCsv}
              disabled={bookRequests.length === 0}
              className="flex items-center gap-1.5 rounded-full border border-primary/20 px-4 py-1.5 text-xs font-bold text-primaryDark transition hover:bg-primary/5 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
              Export CSV
            </button>
            <button
              type="button"
              onClick={loadBookRequests}
              className="flex items-center gap-1.5 rounded-full border border-primary/20 px-4 py-1.5 text-xs font-bold text-primaryDark transition hover:bg-primary/5"
            >
              <svg className={`h-4 w-4 ${bookRequestsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
          </div>

          {bookRequestsLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted">
              <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading requests…
            </div>
          ) : bookRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/40">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <p className="text-muted">No book requests yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-xs uppercase tracking-wider text-muted">
                    <th className="pb-3 pr-4 font-semibold">Date</th>
                    <th className="pb-3 pr-4 font-semibold">Book</th>
                    <th className="pb-3 pr-4 font-semibold">Requested By</th>
                    <th className="pb-3 pr-4 font-semibold">Phone</th>
                    <th className="pb-3 pr-4 font-semibold">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {bookRequests.map((r) => (
                    <tr key={r.id} className="border-b border-black/5 transition hover:bg-primary/5">
                      <td className="py-3 pr-4 text-xs text-muted">{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : '-'}</td>
                      <td className="py-3 pr-4"><span className="font-medium text-ink">{r.bookTitle}</span></td>
                      <td className="py-3 pr-4"><span className="font-medium text-ink">{r.name}</span><br /><span className="text-xs text-muted">{r.email}</span></td>
                      <td className="py-3 pr-4 text-xs text-muted">{r.phone || '-'}</td>
                      <td className="py-3 pr-4 font-bold text-primaryDark">{r.quantity ?? 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderInventory = () => (
    <div className="fade-up space-y-6">
      <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-purple-50/50 p-8 shadow-xl border border-purple-200/50">
        <div className="flex items-center gap-4 mb-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primaryDark shadow-soft">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </span>
          <div>
            <h2 className="font-display text-2xl gradient-text">Inventory Upload</h2>
            <p className="text-xs text-muted">Add new arrivals or update existing stock</p>
          </div>
        </div>
        <p className="text-sm text-muted mb-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
          <span className="font-semibold text-primaryDark">💡 Tip:</span> Upload an .xlsx file with columns: Title, Category, Publisher, Code, RRP, Discount %, Quantity, Selling Price, Weight (g).
          <span className="block mt-1">Rows are matched to existing stock by <strong>code</strong> (ISBN, barcode, or your own), then title + publisher. Columns you leave out are never overwritten.</span>
        </p>

        {/* How the Quantity column is applied to items that already exist. */}
        <div className="mb-6 rounded-2xl border-2 border-primary/15 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-primaryDark mb-3">
            For items already in stock, the Quantity column should:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ['add', 'Add to stock', 'New arrivals — quantities are added to what is on the shelf.'],
              ['replace', 'Replace stock count', 'A stocktake — quantities become exactly what the sheet says.']
            ] as const).map(([mode, label, help]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setUploadMode(mode)}
                aria-pressed={uploadMode === mode}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  uploadMode === mode
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-black/10 bg-white hover:border-primary/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      uploadMode === mode ? 'border-primary' : 'border-black/25'
                    }`}
                  >
                    {uploadMode === mode && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span className="text-sm font-bold text-primaryDark">{label}</span>
                </span>
                <span className="mt-1 block pl-6 text-xs text-muted">{help}</span>
              </button>
            ))}
          </div>
          {uploadMode === 'replace' && (
            <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-800">
              Replace mode overwrites stock counts. Export your stock first if you need a backup.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx"
              onChange={handleInventoryUpload}
              className="hidden"
            />
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload File
            </span>
          </label>
          <button
            onClick={handleDownloadTemplate}
            className="rounded-full border-2 border-primary/30 bg-white px-6 py-3 text-sm font-semibold text-primaryDark hover:bg-primary/5 hover:-translate-y-0.5 transition-all shadow-sm"
            type="button"
          >
            Download Template
          </button>
          <button
            onClick={handleExportStock}
            className="rounded-full border-2 border-green-300 bg-white px-6 py-3 text-sm font-semibold text-green-700 hover:bg-green-50 hover:-translate-y-0.5 transition-all shadow-sm"
            type="button"
          >
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Stock
            </span>
          </button>
          {userRole === 'admin' && (
            <button
              onClick={() => setInventoryScannerOpen(true)}
              className="rounded-full border-2 border-primary/30 bg-white px-6 py-3 text-sm font-semibold text-primaryDark hover:bg-primary/5 hover:-translate-y-0.5 transition-all shadow-sm"
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" /></svg>
                Scan
              </span>
            </button>
          )}
          {userRole === 'admin' && inventory.length > 0 && (
            <button
              onClick={handleClearInventory}
              className="rounded-full border-2 border-red-300 bg-white px-6 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 hover:-translate-y-0.5 transition-all shadow-sm"
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Inventory
              </span>
            </button>
          )}
          {uploadMessage && (
            <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700 border border-green-200">
              {uploadMessage}
            </span>
          )}
        </div>
      </div>

      {noCatalogPrompt && (
        <div className="panel-card rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14A2 2 0 0021 16.7L13.7 5.3a2 2 0 00-3.4 0L3 16.7A2 2 0 004.93 19z" /></svg>
            <span>No catalog entry for &quot;{noCatalogPrompt.title}&quot;.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { const item = noCatalogPrompt; setNoCatalogPrompt(null); openCatalogFormFromInventory(item) }}
              className="rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              Add images &amp; description
            </button>
            <button
              type="button"
              onClick={() => setNoCatalogPrompt(null)}
              className="rounded-full border-2 border-amber-300 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* One-time backfill of the unified code field onto older docs. */}
      {userRole === 'admin' && itemsNeedingCodeMigration.length > 0 && (
        <div className="panel-card rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-200 text-blue-800">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold text-blue-900">
                {itemsNeedingCodeMigration.length} item{itemsNeedingCodeMigration.length === 1 ? '' : 's'} still store the old SKU/ISBN pair
              </p>
              <p className="text-xs text-blue-800">
                SKU and ISBN are now one <strong>Code</strong> field. Save it to these items so scanning and online orders resolve consistently.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleMigrateCodes}
            disabled={mergingGroup !== null}
            className="shrink-0 rounded-full bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-soft transition-all hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {mergingGroup === '__migrate__' ? 'Saving…' : 'Save code field'}
          </button>
        </div>
      )}

      {/* Duplicate review: groups sharing a code or title+publisher. */}
      {userRole === 'admin' && duplicateGroups.length > 0 && (
        <div id="inventory-duplicates" className="panel-card overflow-hidden rounded-3xl bg-white shadow-xl border-2 border-amber-300 scroll-mt-24">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 px-6 py-5">
            <button
              type="button"
              onClick={() => setShowDuplicates((v) => !v)}
              aria-expanded={showDuplicates}
              aria-controls="inventory-duplicates-list"
              className="flex flex-1 items-center gap-3 text-left"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-200 text-amber-800">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </span>
              <div className="flex-1">
                <h3 className="font-display text-xl text-amber-900">
                  {duplicateGroups.length} possible duplicate{duplicateGroups.length === 1 ? '' : ' groups'}
                </h3>
                <p className="text-xs font-medium text-amber-800">
                  {duplicateGroups.reduce((n, g) => n + g.items.length, 0)} entries share a code or title
                  {safeDuplicateGroups.length > 0 && (
                    <> · <strong>{safeDuplicateGroups.length}</strong> can be merged automatically</>
                  )}
                  {duplicateGroups.length - safeDuplicateGroups.length > 0 && (
                    <> · <strong>{duplicateGroups.length - safeDuplicateGroups.length}</strong> need review</>
                  )}
                </p>
              </div>
              <svg
                className={`h-5 w-5 shrink-0 text-amber-800 transition-transform ${showDuplicates ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {safeDuplicateGroups.length > 0 && (
              <button
                type="button"
                onClick={handleMergeAllSafe}
                disabled={mergingGroup !== null}
                className="shrink-0 rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-xs font-bold text-white shadow-soft transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {mergingGroup === '__all__'
                  ? 'Merging…'
                  : `Merge ${safeDuplicateGroups.length} safe group${safeDuplicateGroups.length === 1 ? '' : 's'}`}
              </button>
            )}
          </div>

          {showDuplicates && (
            <div id="inventory-duplicates-list" className="divide-y divide-amber-200/60">
              {duplicateGroups.map((group) => {
                const totalQty = group.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)
                const safe = isSafeMerge(group.items)
                return (
                  <div key={group.id} className="px-6 py-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-primaryDark">{group.items[0].title}</span>
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-300">
                          {group.reason}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-600 border border-gray-200">
                          {group.items.length} entries · {totalQty} total qty
                        </span>
                        {safe ? (
                          <span
                            title="No field holds two different real values, so merging loses nothing."
                            className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200"
                          >
                            Safe to merge
                          </span>
                        ) : (
                          <span
                            title="These rows disagree on a selling price, code, publisher, or category. Check which is correct before merging."
                            className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700 border border-red-200"
                          >
                            Needs review
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMergeDuplicates(group)}
                        disabled={mergingGroup !== null}
                        className="rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2 text-xs font-bold text-white shadow-soft transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                      >
                        {mergingGroup === group.id ? 'Merging…' : 'Merge into one'}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-xs">
                        <thead>
                          <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-muted">
                            <th className="py-2 pr-3">Title</th>
                            <th className="py-2 pr-3">Publisher</th>
                            <th className="py-2 pr-3">Category</th>
                            <th className="py-2 pr-3">Code</th>
                            <th className="py-2 pr-3">Alt code</th>
                            <th className="py-2 pr-3 text-right">Qty</th>
                            <th className="py-2 pr-3 text-right">Disc %</th>
                            <th className="py-2 pr-3 text-right">Weight</th>
                            <th className="py-2 text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {group.items.map((item) => {
                            // Grey out what this row is missing — makes it obvious
                            // which entry is the thin duplicate.
                            const missing = 'text-red-500 font-semibold'
                            const placeholder = isPlaceholderPriced(item)
                            return (
                              <tr key={item.id} className={placeholder ? 'opacity-70' : ''}>
                                <td className="py-2 pr-3 font-medium">
                                  {item.title}
                                  {placeholder && (
                                    <span
                                      title="No discount and RRP equals the selling price — imported without cost data. The other row's values win."
                                      className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500 border border-gray-200 align-middle"
                                    >
                                      no cost data
                                    </span>
                                  )}
                                </td>
                                <td className={`py-2 pr-3 ${item.publisher ? 'text-muted' : missing}`}>{item.publisher || 'missing'}</td>
                                <td className="py-2 pr-3 text-muted">{item.category}</td>
                                <td className={`py-2 pr-3 ${item.code ? 'text-muted' : missing}`}>{item.code || 'missing'}</td>
                                <td className={`py-2 pr-3 ${item.altCode ? 'text-muted' : 'text-muted/40'}`}>{item.altCode || '—'}</td>
                                <td className="py-2 pr-3 text-right font-bold">{item.quantity}</td>
                                <td className={`py-2 pr-3 text-right ${item.discount > 0 ? '' : missing}`}>{item.discount > 0 ? `${item.discount}%` : 'missing'}</td>
                                <td className={`py-2 pr-3 text-right ${item.weight > 0 ? '' : missing}`}>{item.weight > 0 ? `${formatNumber(item.weight)} g` : 'missing'}</td>
                                <td className="py-2 text-right font-bold text-primaryDark">${formatNumber(item.sellingPrice)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-[11px] text-muted">
                      Merging sums the quantities and keeps the first non-empty value for every other field.
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="panel-card overflow-hidden rounded-3xl bg-white shadow-xl border border-primary/10">
        <div className="bg-gradient-to-r from-primary/5 to-secondary/5 px-6 py-5 border-b border-primary/10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-display text-2xl gradient-text">Current Stock</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Total items:</span>
              <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-primaryDark shadow-sm border border-primary/10">{inventory.length}</span>
              {userRole === 'admin' && (
                <button
                  onClick={openAddInventoryItem}
                  className="rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2 text-xs font-bold text-white shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  type="button"
                >
                  + Add Item
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={inventorySearch}
                onChange={(event) => setInventorySearch(event.target.value)}
                placeholder="Search stock by title, publisher, category, or code..."
                className="w-full rounded-2xl border-2 border-primary/20 bg-white pl-11 pr-11 py-3 text-sm font-medium hover:border-primary/40 focus:border-primary focus:outline-none transition-colors shadow-sm"
              />
              {inventorySearch && (
                <button
                  type="button"
                  onClick={() => setInventorySearch('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-primary/10 hover:text-primaryDark"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            {inventorySearch.trim() && (
              <span className="whitespace-nowrap text-xs font-semibold text-muted">
                {sortedInventory.length} match{sortedInventory.length === 1 ? '' : 'es'}
              </span>
            )}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-4 3 4 3m8-6l4 3-4 3" />
            </svg>
            Scroll sideways with the bar above the table · drag a divider between headers to resize · double-click a divider to reset it
            {Object.keys(colWidths).length > 0 && (
              <button
                type="button"
                onClick={resetColWidths}
                className="rounded-full border border-primary/30 px-2.5 py-0.5 text-[11px] font-bold text-primaryDark transition-colors hover:bg-primary/5"
              >
                Reset widths
              </button>
            )}
          </p>
        </div>
        {/* Scrollbar above the header, mirroring the table's. Without it the
            only horizontal scrollbar sits below ~350 rows, off-screen. */}
        <div
          ref={topScrollRef}
          onScroll={syncScroll('top')}
          className="inv-scroll overflow-x-auto overflow-y-hidden border-b border-primary/10"
          aria-hidden="true"
        >
          <div style={{ width: totalTableWidth, minWidth: '100%', height: 1 }} />
        </div>

        {/* Horizontal scroller. table-fixed + an explicit colgroup is what lets
            the drag handles set real widths; without it the browser re-flows
            every column whenever cell content changes. */}
        <div
          ref={tableScrollRef}
          onScroll={syncScroll('table')}
          className="inv-scroll overflow-x-auto overscroll-x-contain"
        >
          <table className="text-sm table-fixed" style={{ width: totalTableWidth, minWidth: '100%' }}>
            <colgroup>
              {INVENTORY_COLUMNS.map((c) => (
                <col key={c.id} style={{ width: columnWidth(c.id, c.width) }} />
              ))}
              {userRole === 'admin' &&
                ACTION_COLUMNS.map((c) => (
                  <col key={c.id} style={{ width: columnWidth(c.id, c.width) }} />
                ))}
            </colgroup>
            <thead className="sticky top-0 z-20 bg-gradient-to-r from-purple-50 to-pink-50 text-left shadow-sm">
              <tr>
                {INVENTORY_COLUMNS.map((c) => (
                  <th
                    key={c.id}
                    className={`relative px-3 sm:px-4 py-3 sm:py-4 ${
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleInventorySort(c.sortKey)}
                      className="inline-flex max-w-full items-center truncate text-xs font-bold uppercase tracking-wider text-primaryDark hover:text-primary transition-colors cursor-pointer select-none"
                    >
                      <span className="truncate">{c.label}</span>
                      <SortIcon col={c.sortKey} />
                    </button>
                    <ColumnResizer col={c.id} />
                  </th>
                ))}
                {userRole === 'admin' && (
                  <>
                    {/* Actions split by intent so the column stops wrapping into
                        an unpredictable pile of pills. */}
                    <th className="relative px-3 sm:px-4 py-3 sm:py-4 text-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-primaryDark">Code</span>
                      <ColumnResizer col="code" />
                    </th>
                    <th className="relative px-3 sm:px-4 py-3 sm:py-4 text-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-primaryDark">Manage</span>
                      <ColumnResizer col="manage" />
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {sortedInventory.map((item, index) => (
                <tr key={item.id} className={`hover:bg-primary/5 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 font-medium">
                    <span className="block truncate" title={item.title}>{item.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {item.code ? (
                        <span
                          title={item.altCode ? `Also recognised: ${item.altCode}` : undefined}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" /></svg>
                          {item.code}
                          {item.altCode && <span className="opacity-60">+1</span>}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 border border-gray-200">
                          No code
                        </span>
                      )}
                      {duplicateIds.has(item.id) && (
                        <button
                          type="button"
                          onClick={() => { setShowDuplicates(true); document.getElementById('inventory-duplicates')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                          title="This item shares a code or title with another entry. Click to review."
                          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          Duplicate
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primaryDark border border-primary/20 whitespace-nowrap">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 text-muted truncate">{item.publisher || <span className="text-red-400">—</span>}</td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 text-right font-semibold whitespace-nowrap">${formatNumber(item.rrp)}</td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 text-center">
                    {item.discount > 0 ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 border border-green-200">
                        {item.discount}%
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 text-right font-bold text-primaryDark whitespace-nowrap">${formatNumber(item.sellingPrice)}</td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 text-center">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                      item.quantity <= 5
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : item.quantity <= restockThreshold
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-green-100 text-green-700 border border-green-200'
                    }`}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 text-right text-muted whitespace-nowrap">
                    {item.weight ? `${formatNumber(item.weight)} g` : <span className="text-red-400">—</span>}
                  </td>
                  {userRole === 'admin' && (
                    <>
                      {/* Code: everything that touches the item's identity. */}
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {item.code ? (
                            <button
                              onClick={() => handleUnbindCode(item)}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap"
                              type="button"
                              aria-label={`Unbind code from ${item.title}`}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1M4 4l16 16" />
                              </svg>
                              Unbind
                            </button>
                          ) : (
                            <button
                              onClick={() => setBindTargetItem(item)}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold bg-purple-50 text-primaryDark border border-primary/30 hover:bg-purple-100 transition-colors whitespace-nowrap"
                              type="button"
                              aria-label={`Bind a code to ${item.title}`}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" />
                              </svg>
                              Bind
                            </button>
                          )}
                          <button
                            onClick={() => openQrLabel(item)}
                            className="inline-flex items-center justify-center rounded-full p-1.5 bg-pink-50 text-secondary border border-secondary/30 hover:bg-pink-100 transition-colors"
                            type="button"
                            title="Print QR label"
                            aria-label={`Print QR label for ${item.title}`}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 3h3m-3 3h6m0-6v3" />
                            </svg>
                          </button>
                        </div>
                      </td>

                      {/* Manage: full record edit and removal. */}
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditInventoryItem(item)}
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                            type="button"
                            aria-label={`Edit ${item.title}`}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteInventoryItem(item)}
                            className="inline-flex items-center justify-center rounded-full p-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                            type="button"
                            title="Delete item"
                            aria-label={`Delete ${item.title}`}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {sortedInventory.length === 0 && (
                <tr>
                  <td
                    colSpan={INVENTORY_COLUMNS.length + (userRole === 'admin' ? ACTION_COLUMNS.length : 0)}
                    className="px-6 py-10 text-center text-sm text-muted"
                  >
                    {inventorySearch.trim()
                      ? <>No items match &ldquo;{inventorySearch.trim()}&rdquo;.</>
                      : 'No inventory items yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderPOS = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Search & Browse */}
      <div className="lg:col-span-2 space-y-6">
        {/* Event Selection Card */}
        <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 text-primaryDark">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 5a4 4 0 100 8 4 4 0 000-8zm0 3a1 1 0 100 2 1 1 0 000-2z" /></svg>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Event</label>
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-2.5 text-sm font-medium hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
              >
                <option value="">Choose an event...</option>
                <option value="general">💰 General Sales (No Event)</option>
                {events
                  .filter((event) => event.status === 'active')
                  .map((event) => (
                    <option key={event.id} value={event.id}>
                      🎪 {event.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          {selectedEventId && selectedEventId !== 'general' && (
            <button
              onClick={() => {
                const ev = events.find((e) => e.id === selectedEventId)
                if (ev) setViewingOrderHistory(ev)
              }}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2.5 text-xs font-bold text-amber-700 border border-amber-200 hover:shadow-md transition-all"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              View Order History
            </button>
          )}
        </div>

        {/* Search & Catalog Card */}
        <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10">
          <div className="mb-6 flex items-stretch gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search products by title, publisher, or category..."
                className="w-full h-full rounded-2xl border-2 border-primary/20 px-5 py-4 pr-12 text-sm font-medium hover:border-primary/40 focus:border-primary focus:outline-none transition-colors shadow-sm"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            {/* Scan to cart: an alternative to typing a search. Scans a bound
                QR/ISBN and, after confirmation, adds that book to the cart. */}
            <button
              type="button"
              onClick={() => setPosScannerOpen(true)}
              title="Scan a book's QR/barcode to add it to the cart"
              className="flex flex-col items-center justify-center gap-1 whitespace-nowrap rounded-2xl bg-gradient-to-r from-primary to-secondary px-5 text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" /></svg>
              <span className="text-[11px] font-bold uppercase tracking-wide">Scan to cart</span>
            </button>
          </div>

          {/* Product Grid */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredInventory.length ? (
              filteredInventory.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-50/50 to-pink-50/50 hover:from-purple-50 hover:to-pink-50 border border-primary/10 hover:border-primary/20 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 text-sm mb-1 truncate">{item.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span className="px-2 py-1 rounded-full bg-white/80 border border-primary/10">
                        {item.category}
                      </span>
                      <span className={`font-semibold ${item.quantity <= 5 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.quantity > 0 ? `${item.quantity} in stock` : 'Out of stock'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary mb-2">${formatNumber(item.sellingPrice)}</p>
                    <button
                      onClick={() => handleAddToCart(item.id)}
                      className="rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2 text-xs font-bold text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                      type="button"
                      disabled={item.quantity === 0}
                    >
                      <span className="mr-1">+</span> Add
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 flex flex-col items-center">
                <svg className="h-14 w-14 mb-4 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                  {searchQuery ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  )}
                </svg>
                <p className="text-gray-500 font-medium">
                  {searchQuery ? 'No products found' : 'Start searching to browse products'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Cart & Checkout */}
      <div className="space-y-6">
        {/* Shopping Cart Card */}
        <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10 lg:sticky lg:top-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 text-primaryDark">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800">Cart</h3>
            </div>
            {cartItems.length > 0 && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary text-xs font-bold text-white shadow-md">
                {cartItems.length}
              </span>
            )}
          </div>

          {/* Cart Items */}
          <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {cartItems.length ? (
              cartItems.map((item) => (
                <div key={item.itemId} className="p-3 rounded-xl bg-gradient-to-r from-purple-50/30 to-pink-50/30 border border-primary/10">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="font-bold text-sm text-gray-800 mb-1">{item.title}</h4>
                      <p className="text-xs text-muted">${formatNumber(item.price)} each</p>
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(item.itemId)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      type="button"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateCartQuantity(item.itemId, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border-2 border-primary/20 hover:border-primary/40 transition-colors"
                        type="button"
                      >
                        <span className="text-sm font-bold">−</span>
                      </button>
                      <span className="w-10 text-center font-bold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateCartQuantity(item.itemId, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border-2 border-primary/20 hover:border-primary/40 transition-colors"
                        type="button"
                      >
                        <span className="text-sm font-bold">+</span>
                      </button>
                    </div>
                    <span className="text-base font-bold text-primary">
                      ${formatNumber(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 flex flex-col items-center">
                <svg className="h-12 w-12 mb-3 text-primary/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-sm text-gray-400">Your cart is empty</p>
              </div>
            )}
          </div>

          {cartItems.length > 0 && (
            <>
              {/* Payment Method */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentType('Cash')}
                    className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                      paymentType === 'Cash'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white border-transparent shadow-md'
                        : 'bg-white text-gray-700 border-primary/20 hover:border-primary/40'
                    }`}
                    type="button"
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      Cash
                    </span>
                  </button>
                  <button
                    onClick={() => setPaymentType('Card')}
                    className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                      paymentType === 'Card'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white border-transparent shadow-md'
                        : 'bg-white text-gray-700 border-primary/20 hover:border-primary/40'
                    }`}
                    type="button"
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                      Card
                    </span>
                  </button>
                  <button
                    onClick={() => setPaymentType('Transfer')}
                    className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                      paymentType === 'Transfer'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white border-transparent shadow-md'
                        : 'bg-white text-gray-700 border-primary/20 hover:border-primary/40'
                    }`}
                    type="button"
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 10h16M5 6l7-3 7 3M5 10v11m4-11v11m6-11v11m4-11v11" /></svg>
                      Transfer
                    </span>
                  </button>
                </div>
              </div>

              {/* Discount */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">Discount (Optional)</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => setDiscountType('percentage')}
                    className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                      discountType === 'percentage'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white border-transparent shadow-md'
                        : 'bg-white text-gray-700 border-primary/20 hover:border-primary/40'
                    }`}
                    type="button"
                  >
                    % Percentage
                  </button>
                  <button
                    onClick={() => setDiscountType('amount')}
                    className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                      discountType === 'amount'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white border-transparent shadow-md'
                        : 'bg-white text-gray-700 border-primary/20 hover:border-primary/40'
                    }`}
                    type="button"
                  >
                    $ Amount
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={discountType === 'percentage' ? 100 : cartTotal}
                    step={discountType === 'percentage' ? 1 : 0.01}
                    value={discount || ''}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    placeholder={discountType === 'percentage' ? 'Enter percentage (0-100)' : 'Enter amount'}
                    className="w-full rounded-xl border-2 border-primary/20 px-4 py-2.5 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                    {discountType === 'percentage' ? '%' : '$'}
                  </span>
                </div>
                {discount > 0 && (
                  <p className="text-xs text-green-600 mt-2 font-medium">
                    💰 Discount: -${formatNumber(discountAmount)}
                  </p>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-3 mb-6 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Subtotal</span>
                  <span className="font-semibold">${formatNumber(cartTotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({discountType === 'percentage' ? `${discount}%` : `$${formatNumber(discount)}`})</span>
                    <span className="font-semibold">-${formatNumber(discountAmount)}</span>
                  </div>
                )}
                {paymentType === 'Card' && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Card Fee (3%)</span>
                    <span className="font-semibold">${formatNumber(convenienceFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-gray-800 pt-3 border-t-2 border-primary/20">
                  <span>Total</span>
                  <span className="gradient-text">${formatNumber(totalWithFee)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowConfirmSale(true)}
                  className="w-full rounded-2xl bg-gradient-to-r from-primary to-secondary px-6 py-4 text-sm font-bold text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  type="button"
                  disabled={!selectedEventId || cartItems.length === 0}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Complete Sale
                  </span>
                </button>
                <button
                  onClick={handleClearCart}
                  className="w-full rounded-xl border-2 border-red-200 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                  type="button"
                >
                  Clear Cart
                </button>
              </div>

              {eventMessage && (
                <div className="mt-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
                  <p className="text-xs text-center text-blue-700 font-medium">{eventMessage}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  const renderEvents = () => (
    <div className="fade-up space-y-6">
      <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-blue-50/50 p-6 shadow-xl border border-blue-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-accentThree shadow-soft">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /></svg>
            </span>
            <div>
              <h2 className="font-display text-2xl gradient-text">Event Management</h2>
              <p className="text-xs text-muted">Schedule events with dates and vendor fees</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateEvent(true)}
            className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all"
            type="button"
          >
            + New Event
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primaryDark">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </span>
              <div>
                <h3 className="font-display text-xl gradient-text">All Events</h3>
                <span className="text-xs font-semibold text-muted">{events.length} total</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 mb-4">
            <select
              value={eventTypeFilter}
              onChange={(event) =>
                setEventTypeFilter(event.target.value as typeof eventTypeFilter)
              }
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm font-medium hover:border-primary/40 transition-colors"
            >
              <option value="All">All types</option>
              <option value="Bazaar">Bazaar</option>
              <option value="Bookfair">Bookfair</option>
              <option value="Jummah Boot">Jummah Boot</option>
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="date"
                value={eventDateStart}
                onChange={(event) => setEventDateStart(event.target.value)}
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
              />
              <input
                type="date"
                value={eventDateEnd}
                onChange={(event) => setEventDateEnd(event.target.value)}
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
              />
            </div>
          </div>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {filteredEvents.map((event) => {
              const totalSales = event.sales.reduce((sum, sale) => sum + sale.total, 0)
              return (
                <div key={event.id} className="group rounded-2xl border-2 border-primary/10 p-5 hover:border-primary/30 hover:shadow-lg transition-all bg-gradient-to-br from-white to-primary/5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-2">
                    <div className="flex-1">
                      <p className="font-bold text-base sm:text-lg text-primaryDark mb-1">{event.name}</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span
                          className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${eventTypeBadgeClasses[event.type]}`}
                        >
                          {event.type}
                        </span>
                        <button
                          onClick={() => handleToggleEventStatus(event.id)}
                          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                            event.status === 'active'
                              ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200 hover:scale-105 cursor-pointer'
                              : 'bg-gray-100 text-gray-500 border border-gray-200 cursor-not-allowed opacity-70'
                          }`}
                          type="button"
                          title={event.status === 'closed' ? 'Edit event to reactivate' : 'Click to close event'}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {event.status === 'active' ? (
                              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            )}
                            {event.status === 'active' ? 'Active' : 'Closed'}
                          </span>
                        </button>
                        <button
                          onClick={() => openEditEvent(event)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 transition-all hover:scale-105"
                          type="button"
                          aria-label={`Edit ${event.name}`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Edit
                        </button>
                        <button
                          onClick={() => setViewingEventTransactions(event)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border border-purple-200 transition-all hover:scale-105"
                          type="button"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6m4 6V9m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          View Transactions
                        </button>
                        <button
                          onClick={() => setViewingOrderHistory(event)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200 transition-all hover:scale-105"
                          type="button"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                          Order History
                        </button>
                        <button
                          onClick={() => openExpenses(event)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-700 border border-teal-200 transition-all hover:scale-105"
                          type="button"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          Expenses{event.expenses.length > 0 ? ` (${event.expenses.length})` : ''}
                        </button>
                        {userRole === 'admin' && (
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-red-50 to-red-100 text-red-700 border border-red-200 transition-all hover:scale-105"
                            type="button"
                            aria-label={`Delete ${event.name}`}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold gradient-text">${formatNumber(totalSales)}</p>
                      <p className="text-xs text-muted">{event.sales.length} transactions</p>
                      {(event.expenses.length > 0 || event.cost > 0) && (
                        <p className="text-xs text-muted mt-1">
                          Costs: ${formatNumber(event.cost + event.expenses.reduce((s, e) => s + e.amount, 0))}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted bg-white/50 rounded-xl p-3 border border-primary/5">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span>{event.location || 'Location TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span>{event.startDate || 'TBD'} - {event.endDate || 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      <span>Vendor fee: ${formatNumber(event.cost)}</span>
                    </div>
                    {event.expenses.length > 0 && (
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <span>{event.expenses.length} expense{event.expenses.length !== 1 ? 's' : ''}: ${formatNumber(event.expenses.reduce((s, e) => s + e.amount, 0))}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* General Sales Card */}
            {generalSales.length > 0 && (
              <div className="group rounded-2xl border-2 border-emerald-200 p-5 hover:border-emerald-300 hover:shadow-lg transition-all bg-gradient-to-br from-white to-emerald-50/50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="font-bold text-lg text-primaryDark mb-1">💰 General Sales</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="rounded-full px-3 py-1 text-[11px] font-bold bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200">
                        No Event
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                        Always Active
                      </span>
                      <button
                        onClick={() => setViewingEventTransactions({
                          id: 'general', name: 'General Sales', type: 'Bazaar', location: 'Various',
                          startDate: '', endDate: '', cost: 0, status: 'active', sales: generalSales, orders: generalOrders, expenses: []
                        })}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border border-purple-200 transition-all hover:scale-105"
                        type="button"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6m4 6V9m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        View Transactions
                      </button>
                      <button
                        onClick={() => setViewingOrderHistory({
                          id: 'general', name: 'General Sales', type: 'Bazaar', location: 'Various',
                          startDate: '', endDate: '', cost: 0, status: 'active', sales: generalSales, orders: generalOrders, expenses: []
                        })}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200 transition-all hover:scale-105"
                        type="button"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        Order History
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold gradient-text">${formatNumber(generalSales.reduce((sum, s) => sum + s.total, 0))}</p>
                    <p className="text-xs text-muted">{generalSales.length} transactions</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted bg-white/50 rounded-xl p-3 border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Sales made outside of any specific event</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <span>{generalOrders.length} order{generalOrders.length !== 1 ? 's' : ''} recorded</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">Create New Event</h4>
                <p className="mt-2 text-sm text-muted">
                  Add dates, vendor fee, and keep the event active.
                </p>
              </div>
              <button
                onClick={() => setShowCreateEvent(false)}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                <span>Close</span>
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Event name *</label>
                <input
                  type="text"
                  value={newEventName}
                  onChange={(event) => setNewEventName(event.target.value)}
                  placeholder="e.g., Masjid Book Fair"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Location *</label>
                <input
                  type="text"
                  value={newEventLocation}
                  onChange={(event) => setNewEventLocation(event.target.value)}
                  placeholder="e.g., Downtown Community Center"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Start date *</label>
                <input
                  type="date"
                  value={newEventStart}
                  onChange={(event) => setNewEventStart(event.target.value)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">End date *</label>
                <input
                  type="date"
                  value={newEventEnd}
                  onChange={(event) => setNewEventEnd(event.target.value)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Event type *</label>
                <select
                  value={newEventType}
                  onChange={(event) =>
                    setNewEventType(event.target.value as EventRecord['type'])
                  }
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                >
                  <option value="Bazaar">Bazaar</option>
                  <option value="Bookfair">Bookfair</option>
                  <option value="Jummah Boot">Jummah Boot</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Vendor fee ($) *</label>
                <input
                  type="number"
                  value={newEventCost}
                  onChange={(event) => setNewEventCost(event.target.value)}
                  placeholder="e.g., 120"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateEvent(false)}
                className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                type="button"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">Edit Event</h4>
                <p className="mt-2 text-sm text-muted">
                  Update event details. Changes sync to Firebase.
                </p>
              </div>
              <button
                onClick={() => setEditingEvent(null)}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                <span>Close</span>
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Event name *</label>
                <input
                  type="text"
                  value={editEventName}
                  onChange={(e) => setEditEventName(e.target.value)}
                  placeholder="e.g., Masjid Book Fair"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Location *</label>
                <input
                  type="text"
                  value={editEventLocation}
                  onChange={(e) => setEditEventLocation(e.target.value)}
                  placeholder="e.g., Downtown Community Center"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Start date *</label>
                <input
                  type="date"
                  value={editEventStart}
                  onChange={(e) => setEditEventStart(e.target.value)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">End date *</label>
                <input
                  type="date"
                  value={editEventEnd}
                  onChange={(e) => setEditEventEnd(e.target.value)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Event type *</label>
                <select
                  value={editEventType}
                  onChange={(e) => setEditEventType(e.target.value as EventRecord['type'])}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                >
                  <option value="Bazaar">Bazaar</option>
                  <option value="Bookfair">Bookfair</option>
                  <option value="Jummah Boot">Jummah Boot</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Vendor fee ($) *</label>
                <input
                  type="number"
                  value={editEventCost}
                  onChange={(e) => setEditEventCost(e.target.value)}
                  placeholder="e.g., 120"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Event status *</label>
                <select
                  value={editEventStatus}
                  onChange={(e) => setEditEventStatus(e.target.value as EventStatus)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                >
                  <option value="active">● Active</option>
                  <option value="closed">○ Closed</option>
                </select>
                <p className="text-[10px] text-muted mt-1">
                  {editEventStatus === 'active'
                    ? 'Event is active and accepting transactions.'
                    : 'Event is closed. No new transactions will be accepted.'}
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingEvent(null)}
                className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleEditEvent}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                type="button"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingEventTransactions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-5xl rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">{viewingEventTransactions.name} - Sales Record</h4>
                <p className="mt-2 text-sm text-muted">
                  {viewingEventTransactions.sales.length} total sales · ${formatNumber(viewingEventTransactions.sales.reduce((sum, sale) => sum + sale.total, 0))} total revenue
                </p>
              </div>
              <button
                onClick={() => setViewingEventTransactions(null)}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                <span>Close</span>
              </button>
            </div>

            {viewingEventTransactions.sales.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl flex flex-col items-center">
                <svg className="h-14 w-14 mb-4 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6m4 6V9m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                <p className="text-lg font-semibold text-gray-700">No transactions yet</p>
                <p className="text-sm text-muted mt-2">Sales will appear here once the event goes live</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {(() => {
                  // Group sales by itemId
                  const groupedSales = viewingEventTransactions.sales.reduce((acc, sale) => {
                    const key = sale.itemId || sale.title;
                    if (!acc[key]) {
                      acc[key] = {
                        itemId: sale.itemId,
                        title: sale.title,
                        totalQuantity: 0,
                        totalAmount: 0,
                        transactions: 0,
                        paymentTypes: new Set<string>(),
                        firstTimestamp: sale.timestamp
                      };
                    }
                    acc[key].totalQuantity += sale.quantity;
                    acc[key].totalAmount += sale.total;
                    acc[key].transactions += 1;
                    acc[key].paymentTypes.add(sale.paymentType);
                    return acc;
                  }, {} as Record<string, {
                    itemId: string;
                    title: string;
                    totalQuantity: number;
                    totalAmount: number;
                    transactions: number;
                    paymentTypes: Set<string>;
                    firstTimestamp: string;
                  }>);

                  return Object.values(groupedSales).map((item, index) => (
                    <div key={item.itemId || item.title} className="rounded-2xl border-2 border-primary/10 p-5 bg-gradient-to-br from-white to-primary/5 hover:border-primary/30 transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
                            Item #{Object.values(groupedSales).length - index}
                          </p>
                          <p className="font-bold text-lg text-primaryDark mb-2">{item.title}</p>
                          <div className="flex flex-wrap gap-2 items-center">
                            {Array.from(item.paymentTypes).map((paymentType) => (
                              <span key={paymentType} className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                                paymentType === 'Cash' 
                                  ? 'bg-green-100 text-green-700 border border-green-200'
                                  : paymentType === 'Card'
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-purple-100 text-purple-700 border border-purple-200'
                              }`}>
                                {paymentType === 'Cash' ? '💵' : paymentType === 'Card' ? '💳' : '🏦'} {paymentType}
                              </span>
                            ))}
                            <span className="text-xs text-muted">
                              {item.transactions} transaction{item.transactions > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-2xl font-bold gradient-text">${formatNumber(item.totalAmount)}</p>
                          <p className="text-xs text-muted mt-1">{item.totalQuantity} × item{item.totalQuantity > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}

            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Sales</p>
                  <p className="text-2xl font-bold gradient-text">{viewingEventTransactions.sales.length}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold gradient-text">
                    ${formatNumber(viewingEventTransactions.sales.reduce((sum, sale) => sum + sale.total, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Items Sold</p>
                  <p className="text-2xl font-bold gradient-text">
                    {viewingEventTransactions.sales.reduce((sum, sale) => sum + sale.quantity, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Avg. Sale</p>
                  <p className="text-2xl font-bold gradient-text">
                    ${formatNumber(viewingEventTransactions.sales.length > 0 
                      ? viewingEventTransactions.sales.reduce((sum, sale) => sum + sale.total, 0) / viewingEventTransactions.sales.length 
                      : 0
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order History Modal */}
      {viewingOrderHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-5xl rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-amber-200/50 animate-fadeIn my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">{viewingOrderHistory.name} - Order History</h4>
                <p className="mt-2 text-sm text-muted">
                  {viewingOrderHistory.orders.length} order{viewingOrderHistory.orders.length !== 1 ? 's' : ''} · ${formatNumber(viewingOrderHistory.orders.reduce((sum, o) => sum + o.total, 0))} total
                </p>
              </div>
              <div className="flex items-center gap-2">
                {viewingOrderHistory.orders.length > 0 && (
                  <button
                    onClick={() => downloadEventTxt(viewingOrderHistory.name, viewingOrderHistory.orders)}
                    className="inline-flex items-center gap-1.5 rounded-full border-2 border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-100 transition-colors"
                    type="button"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download TXT
                  </button>
                )}
                <button
                  onClick={() => setViewingOrderHistory(null)}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                  type="button"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Close</span>
                </button>
              </div>
            </div>

            {viewingOrderHistory.orders.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl flex flex-col items-center">
                <svg className="h-14 w-14 mb-4 text-amber-500/50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                <p className="text-lg font-semibold text-gray-700">No orders yet</p>
                <p className="text-sm text-muted mt-2">Orders will appear here once sales are confirmed</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {viewingOrderHistory.orders.map((order, idx) => (
                  <div key={order.id} className="rounded-2xl border-2 border-amber-100 p-5 bg-gradient-to-br from-white to-amber-50/50 hover:border-amber-200 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
                          Order #{viewingOrderHistory.orders.length - idx}
                        </p>
                        <p className="text-xs text-muted inline-flex items-center gap-1.5">
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {new Date(order.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          order.paymentType === 'Cash'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : order.paymentType === 'Card'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-purple-100 text-purple-700 border border-purple-200'
                        }`}>
                          {order.paymentType === 'Cash' ? '💵' : order.paymentType === 'Card' ? '💳' : '🏦'} {order.paymentType}
                        </span>
                        {userRole === 'admin' && (
                          <>
                            <button
                              onClick={() => openEditOrder(order)}
                              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:scale-105 transition-all"
                              type="button"
                              aria-label="Edit order"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order)}
                              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:scale-105 transition-all"
                              type="button"
                              aria-label="Delete order"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-primary/5 text-sm">
                          <div>
                            <span className="font-semibold">{item.quantity}× </span>
                            <span>{item.title}</span>
                          </div>
                          <span className="font-bold text-primaryDark">${formatNumber(item.lineTotal)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1 px-3 py-2 rounded-xl bg-gradient-to-r from-gray-50 to-amber-50/50 border border-primary/5 text-sm">
                      <div className="flex justify-between text-muted">
                        <span>Subtotal</span>
                        <span>${formatNumber(order.subtotal)}</span>
                      </div>
                      {order.discount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Discount ({order.discountType === 'percentage' ? `${order.discountValue}%` : `$${order.discountValue}`})</span>
                          <span>-${formatNumber(order.discount)}</span>
                        </div>
                      )}
                      {order.convenienceFee > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>Card fee (3%)</span>
                          <span>+${formatNumber(order.convenienceFee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-1 border-t border-primary/10">
                        <span className="gradient-text">Total</span>
                        <span className="gradient-text">${formatNumber(order.total)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewingOrderHistory.orders.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Orders</p>
                    <p className="text-2xl font-bold gradient-text">{viewingOrderHistory.orders.length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold gradient-text">${formatNumber(viewingOrderHistory.orders.reduce((sum, o) => sum + o.total, 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Items Sold</p>
                    <p className="text-2xl font-bold gradient-text">{viewingOrderHistory.orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Avg. Order</p>
                    <p className="text-2xl font-bold gradient-text">
                      ${formatNumber(viewingOrderHistory.orders.length > 0
                        ? viewingOrderHistory.orders.reduce((sum, o) => sum + o.total, 0) / viewingOrderHistory.orders.length
                        : 0
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Order Modal (Admin Only) */}
      {editingOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-blue-200/50 animate-fadeIn my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">Edit Order</h4>
                <p className="mt-2 text-sm text-muted">
                  {new Date(editingOrder.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => { setEditingOrder(null); setEditOrderItems([]); }}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/20 text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Items</label>
              {editOrderItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{item.title}</p>
                    <p className="text-xs text-muted">${formatNumber(item.price)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditOrderItems((prev) =>
                          prev.map((it, idx) => idx === i && it.quantity > 1
                            ? { ...it, quantity: it.quantity - 1, lineTotal: Number(((it.quantity - 1) * it.price).toFixed(2)) }
                            : it
                          )
                        )
                      }}
                      className="w-7 h-7 rounded-full bg-white border-2 border-primary/20 text-sm font-bold hover:bg-primary/10 transition-colors"
                      type="button"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-bold">{item.quantity}</span>
                    <button
                      onClick={() => {
                        setEditOrderItems((prev) =>
                          prev.map((it, idx) => idx === i
                            ? { ...it, quantity: it.quantity + 1, lineTotal: Number(((it.quantity + 1) * it.price).toFixed(2)) }
                            : it
                          )
                        )
                      }}
                      className="w-7 h-7 rounded-full bg-white border-2 border-primary/20 text-sm font-bold hover:bg-primary/10 transition-colors"
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-bold text-primaryDark min-w-[70px] text-right">${formatNumber(item.quantity * item.price)}</span>
                  <button
                    onClick={() => setEditOrderItems((prev) => prev.filter((_, idx) => idx !== i))}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
                    type="button"
                    aria-label="Remove item"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Payment Type</label>
              <select
                value={editOrderPaymentType}
                onChange={(e) => setEditOrderPaymentType(e.target.value as Sale['paymentType'])}
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
              >
                <option value="Cash">💵 Cash</option>
                <option value="Card">💳 Card</option>
                <option value="Transfer">🏦 Transfer</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-gradient-to-r from-gray-50 to-primary/5 border border-primary/10 text-sm space-y-1 mb-6">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>${formatNumber(editOrderItems.reduce((sum, it) => sum + it.quantity * it.price, 0))}</span>
              </div>
              {editingOrder.discountValue > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount ({editingOrder.discountType === 'percentage' ? `${editingOrder.discountValue}%` : `$${editingOrder.discountValue}`})</span>
                  <span>-${formatNumber(
                    editingOrder.discountType === 'percentage'
                      ? editOrderItems.reduce((sum, it) => sum + it.quantity * it.price, 0) * (editingOrder.discountValue / 100)
                      : editingOrder.discountValue
                  )}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-1 border-t border-primary/10">
                <span>Total</span>
                <span className="gradient-text">${formatNumber((() => {
                  const sub = editOrderItems.reduce((sum, it) => sum + it.quantity * it.price, 0)
                  const disc = editingOrder.discountType === 'percentage' ? sub * (editingOrder.discountValue / 100) : editingOrder.discountValue
                  const after = sub - disc
                  const fee = editOrderPaymentType === 'Card' ? after * 0.03 : 0
                  return after + fee
                })())}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setEditingOrder(null); setEditOrderItems([]); }}
                className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditOrder}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                type="button"
                disabled={editOrderItems.length === 0}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Save Changes
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Modal */}
      {viewingExpenses && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-teal-200/50 animate-fadeIn my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">{viewingExpenses.name} - Expenses</h4>
                <p className="mt-2 text-sm text-muted">
                  {viewingExpenses.expenses.length} expense{viewingExpenses.expenses.length !== 1 ? 's' : ''} · ${formatNumber(viewingExpenses.expenses.reduce((sum, e) => sum + e.amount, 0))} total
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { resetExpenseForm(); setShowAddExpense(true) }}
                  className="rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-2 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  type="button"
                >
                  + Add Expense
                </button>
                <button
                  onClick={() => { setViewingExpenses(null); resetExpenseForm(); setShowAddExpense(false) }}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                  type="button"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Close</span>
                </button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 p-4 border border-teal-200/50 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Expenses</p>
                <p className="text-2xl font-bold text-teal-700">${formatNumber(viewingExpenses.expenses.reduce((s, e) => s + e.amount, 0))}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 border border-blue-200/50 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">+ Vendor Fee</p>
                <p className="text-2xl font-bold text-blue-700">${formatNumber(viewingExpenses.cost)}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 p-4 border border-purple-200/50 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Costs</p>
                <p className="text-2xl font-bold gradient-text">${formatNumber(viewingExpenses.cost + viewingExpenses.expenses.reduce((s, e) => s + e.amount, 0))}</p>
              </div>
            </div>

            {/* Add / Edit Expense Form */}
            {showAddExpense && (
              <div className="mb-6 rounded-2xl bg-gradient-to-br from-teal-50/50 to-cyan-50/30 p-5 border border-teal-200/30">
                <h5 className="font-display text-lg gradient-text mb-4">{editingExpense ? 'Edit Expense' : 'Add New Expense'}</h5>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">Description *</label>
                    <input
                      type="text"
                      value={expenseDescription}
                      onChange={(e) => setExpenseDescription(e.target.value)}
                      placeholder="e.g., Uber to venue"
                      className="w-full rounded-xl border-2 border-teal-200 px-4 py-3 text-sm hover:border-teal-400 transition-colors focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">Amount ($) *</label>
                    <input
                      type="number"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full rounded-xl border-2 border-teal-200 px-4 py-3 text-sm hover:border-teal-400 transition-colors focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">Category</label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value as Expense['category'])}
                      className="w-full rounded-xl border-2 border-teal-200 px-4 py-3 text-sm hover:border-teal-400 transition-colors focus:border-teal-500 focus:outline-none"
                    >
                      <option value="Transport">🚗 Transport</option>
                      <option value="Supplies">🛒 Supplies</option>
                      <option value="Food">🍔 Food</option>
                      <option value="Printing">🖨️ Printing</option>
                      <option value="Decoration">🎨 Decoration</option>
                      <option value="Other">📌 Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">Date</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full rounded-xl border-2 border-teal-200 px-4 py-3 text-sm hover:border-teal-400 transition-colors focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <button
                      onClick={handleSaveExpense}
                      disabled={!expenseDescription.trim() || parseNumber(expenseAmount) <= 0}
                      className="flex-1 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        {editingExpense ? (
                          <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Update</>
                        ) : (
                          <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>Add</>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => { setShowAddExpense(false); resetExpenseForm() }}
                      className="rounded-full border-2 border-teal-200 px-4 py-3 text-sm font-bold text-teal-700 hover:bg-teal-50 transition-colors"
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Expense List */}
            {viewingExpenses.expenses.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {viewingExpenses.expenses.map((expense) => {
                  const categoryIcons: Record<Expense['category'], string> = {
                    Transport: '🚗', Supplies: '🛒', Food: '🍔', Printing: '🖨️', Decoration: '🎨', Other: '📌'
                  }
                  return (
                    <div key={expense.id} className="group flex items-center justify-between rounded-2xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/30 p-4 hover:border-teal-200 hover:shadow-md transition-all">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 text-lg shrink-0">
                          {categoryIcons[expense.category] || '📌'}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-primaryDark truncate">{expense.description}</p>
                          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-700 font-medium">{expense.category}</span>
                            <span>{expense.date}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-lg font-bold text-teal-700">${formatNumber(expense.amount)}</span>
                        <button
                          onClick={() => openEditExpense(expense)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-blue-600 hover:bg-blue-50 transition-colors"
                          type="button"
                          title="Edit"
                          aria-label="Edit expense"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50 transition-colors"
                          type="button"
                          title="Delete"
                          aria-label="Delete expense"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 flex flex-col items-center">
                <svg className="h-12 w-12 mb-3 text-teal-500/50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                <p className="text-sm text-muted">No expenses recorded for this event yet.</p>
                <p className="text-xs text-muted mt-1">Click &quot;+ Add Expense&quot; to track costs.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-indigo-50/50 p-6 shadow-xl border border-indigo-200/50">
        <div className="flex items-center gap-3 mb-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 text-primaryDark shadow-soft">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6M15 19V9M4 21h16M12 21V5" /></svg>
          </span>
          <h3 className="font-display text-2xl gradient-text">Event Summaries</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {/* General Sales Summary */}
          {generalSales.length > 0 && (() => {
            const totalSales = generalSales.reduce((sum, sale) => sum + sale.total, 0)
            const transactions = generalSales.length
            const bestSeller = generalSales
              .reduce((acc, sale) => {
                acc[sale.title] = (acc[sale.title] ?? 0) + sale.quantity
                return acc
              }, {} as Record<string, number>)
            const bestSellerName = Object.entries(bestSeller)
              .sort(([, a], [, b]) => b - a)
              .map(([name]) => name)[0]
            return (
              <div className="rounded-2xl border-2 border-emerald-200/50 p-5 bg-gradient-to-br from-white to-emerald-50/30 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-lg text-primaryDark">💰 General Sales</p>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                    Always Active
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-muted">
                    <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Sales outside events · {generalOrders.length} orders</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-emerald-200/50">
                    <div className="rounded-xl bg-white/80 p-3 border border-emerald-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Total Sales</p>
                      <p className="text-lg font-bold gradient-text">${formatNumber(totalSales)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 border border-emerald-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Transactions</p>
                      <p className="text-lg font-bold text-primaryDark">{transactions}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-emerald-200/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Best Seller</p>
                    <p className="font-semibold text-primaryDark">{bestSellerName ?? 'No sales yet'}</p>
                  </div>
                </div>
              </div>
            )
          })()}
          {events.map((event) => {
            const totalSales = event.sales.reduce((sum, sale) => sum + sale.total, 0)
            const transactions = event.sales.length
            const bestSeller = event.sales
              .reduce((acc, sale) => {
                acc[sale.title] = (acc[sale.title] ?? 0) + sale.quantity
                return acc
              }, {} as Record<string, number>)

            const bestSellerName = Object.entries(bestSeller)
              .sort(([, a], [, b]) => b - a)
              .map(([name]) => name)[0]

            return (
              <div key={event.id} className="rounded-2xl border-2 border-indigo-200/50 p-5 bg-gradient-to-br from-white to-indigo-50/30 hover:border-indigo-300 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-lg text-primaryDark">{event.name}</p>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    event.status === 'active'
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${event.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} aria-hidden="true" />
                      {event.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-muted">
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /></svg>
                    <span>{event.type} · {event.location || 'Location TBD'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>{event.startDate || 'TBD'} - {event.endDate || 'TBD'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-indigo-200/50">
                    <div className="rounded-xl bg-white/80 p-3 border border-indigo-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Total Sales</p>
                      <p className="text-lg font-bold gradient-text">${formatNumber(totalSales)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 border border-indigo-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Transactions</p>
                      <p className="text-lg font-bold text-primaryDark">{transactions}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 border border-indigo-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Total Costs</p>
                      <p className="text-lg font-bold text-red-600">${formatNumber(event.cost + event.expenses.reduce((s, e) => s + e.amount, 0))}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 border border-indigo-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Net Profit</p>
                      <p className={`text-lg font-bold ${(() => {
                        const markup = event.sales.reduce((s, sale) => s + (sale.sellingPrice - sale.rrp) * sale.quantity, 0)
                        const expenses = event.expenses.reduce((s, e) => s + e.amount, 0) + event.cost
                        return markup - expenses >= 0 ? 'text-green-600' : 'text-red-600'
                      })()}`}>
                        ${formatNumber((() => {
                          const markup = event.sales.reduce((s, sale) => s + (sale.sellingPrice - sale.rrp) * sale.quantity, 0)
                          const expenses = event.expenses.reduce((s, e) => s + e.amount, 0) + event.cost
                          return markup - expenses
                        })())}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-indigo-200/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Best Seller</p>
                    <p className="font-semibold text-primaryDark">{bestSellerName ?? 'No sales yet'}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const catalogAgeBadgeClasses: Record<AgeCategory, string> = {
    '0+': 'bg-gradient-to-r from-rose-100 to-rose-50 text-rose-700 border border-rose-200',
    '3+': 'bg-gradient-to-r from-pink-100 to-pink-50 text-pink-700 border border-pink-200',
    '6+': 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 border border-blue-200',
    '10+': 'bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700 border border-purple-200',
    'Adult': 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-200'
  }

  const catalogCategoryBadgeClasses: Record<InventoryCategory, string> = {
    Books: 'bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 border border-emerald-200',
    'Activity Books': 'bg-gradient-to-r from-teal-100 to-teal-50 text-teal-700 border border-teal-200',
    Cards: 'bg-gradient-to-r from-sky-100 to-sky-50 text-sky-700 border border-sky-200',
    Crafts: 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border border-amber-200',
    Puzzles: 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-700 border border-indigo-200',
    Games: 'bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700 border border-orange-200',
    Gifts: 'bg-gradient-to-r from-rose-100 to-rose-50 text-rose-700 border border-rose-200',
    Others: 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-200'
  }

  const renderCatalogFormModal = (isEdit: boolean) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h4 className="font-display text-2xl gradient-text">{isEdit ? 'Edit Catalog Item' : 'New Catalog Item'}</h4>
            <p className="mt-2 text-sm text-muted">
              {isEdit ? 'Update item details and images.' : 'Add a new item to your catalog.'}
            </p>
          </div>
          <button
            onClick={() => { isEdit ? setEditingCatalogItem(null) : setShowCreateCatalog(false); resetCatalogForm() }}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
            type="button"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            <span>Close</span>
          </button>
        </div>

        {catalogMessage && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
            {catalogMessage}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {!isEdit && inventoryNotInCatalog.length > 0 && (
            <div className="md:col-span-2 rounded-2xl border-2 border-dashed border-primary/25 bg-primary/5 p-4">
              <label className="text-xs font-bold uppercase tracking-wider text-primaryDark mb-2 block">Add from inventory</label>
              <select
                value={catalogFromInventoryId}
                onChange={(e) => selectInventoryForCatalog(e.target.value)}
                className="w-full rounded-xl border-2 border-primary/20 bg-white px-4 py-3 text-sm hover:border-primary/40 transition-colors"
              >
                <option value="">Select an inventory item to auto-fill…</option>
                {[...inventoryNotInCatalog]
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}{i.publisher ? ` (${i.publisher})` : ''}{i.code ? ` (${i.code})` : ''}
                    </option>
                  ))}
              </select>
              <p className="mt-1.5 text-[11px] text-muted">Only inventory items not already in the catalog are listed. Fills title, publisher, category, price and SKU; you still add the description and images.</p>
            </div>
          )}
          {!isEdit && inventory.length > 0 && inventoryNotInCatalog.length === 0 && (
            <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
              Every inventory item is already in the catalog. Add a new inventory item first, or fill this form manually.
            </div>
          )}
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Title *</label>
            <input
              type="text"
              list="catalog-titles-list"
              value={catalogTitle}
              onChange={(e) => setCatalogTitle(e.target.value)}
              placeholder="e.g., My First Quran Stories"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
            />
            <datalist id="catalog-titles-list">
              {inventoryTitles.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Description *</label>
            <textarea
              value={catalogDescription}
              onChange={(e) => setCatalogDescription(e.target.value)}
              placeholder="Describe the item..."
              rows={3}
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors resize-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Categories * (Select one or more)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_CATALOG_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-all ${
                    catalogCategories.includes(cat)
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-primary/20 hover:border-primary/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={catalogCategories.includes(cat)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCatalogCategories((prev) => [...prev, cat])
                      } else {
                        setCatalogCategories((prev) => prev.filter((c) => c !== cat))
                      }
                    }}
                    className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary/50"
                  />
                  <span className="text-xs font-semibold text-primaryDark">{cat}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Age Category * (Select multiple)</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(AGE_CATEGORIES) as AgeCategory[]).map((age) => (
                <label
                  key={age}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-all ${
                    catalogAge.includes(age)
                      ? 'border-primary bg-primary/5'
                      : 'border-primary/20 hover:border-primary/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={catalogAge.includes(age)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCatalogAge((prev) => [...prev, age])
                      } else {
                        setCatalogAge((prev) => prev.filter((a) => a !== age))
                      }
                    }}
                    className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary/50"
                  />
                  <span className="text-xs font-semibold text-primaryDark">
                    {ageShortLabel(age)} <span className="font-normal text-muted">({AGE_CATEGORIES[age].title})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Shelves: optional, and a book may sit on several. Shelves are
              created under Website > Shelves. */}
          <div className="sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
              Shelves <span className="normal-case font-medium">(optional, select any)</span>
            </label>
            {shelves.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted">
                No shelves yet. Create one under <span className="font-semibold text-primaryDark">Website &rsaquo; Shelves</span>, then come back to assign this book.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {shelves.map((shelf) => (
                  <label
                    key={shelf.id}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-all ${
                      catalogShelves.includes(shelf.slug)
                        ? 'border-primary bg-primary/5'
                        : 'border-primary/20 hover:border-primary/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={catalogShelves.includes(shelf.slug)}
                      onChange={(e) =>
                        setCatalogShelves((prev) =>
                          e.target.checked
                            ? [...prev, shelf.slug]
                            : prev.filter((s) => s !== shelf.slug)
                        )
                      }
                      className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary/50"
                    />
                    <span className="text-xs font-semibold text-primaryDark truncate">
                      {shelf.name}
                      {!shelf.active && <span className="ml-1 font-normal text-muted">(hidden)</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Price ($) *</label>
            <input
              type="number"
              value={catalogPrice}
              onChange={(e) => setCatalogPrice(e.target.value)}
              placeholder="e.g., 12.99"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Publisher *</label>
            <input
              type="text"
              list="catalog-publishers-list"
              value={catalogPublisher}
              onChange={(e) => setCatalogPublisher(e.target.value)}
              placeholder="e.g., Learning Roots"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
            />
            <datalist id="catalog-publishers-list">
              {inventoryPublishers.map((p) => <option key={p} value={p} />)}
            </datalist>
            {/* Toggle: show the publisher name on the public storefront or hide it. */}
            <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={catalogShowPublisher}
                onClick={() => setCatalogShowPublisher((v) => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${catalogShowPublisher ? 'bg-gradient-to-r from-primary to-secondary' : 'bg-black/20'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${catalogShowPublisher ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs font-semibold text-primaryDark">
                {catalogShowPublisher ? 'Publisher shown on storefront' : 'Publisher hidden from storefront'}
              </span>
            </label>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">SKU</label>
            <input
              type="text"
              value={catalogSku}
              onChange={(e) => setCatalogSku(e.target.value)}
              placeholder="e.g., EK-1024 (links to inventory)"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
            />
            <p className="mt-1 text-[11px] text-muted">Shared SKU links this product to an inventory stock record.</p>
          </div>

          {/* Stock: controls in/out-of-stock on the storefront. 0 = out of stock
              (shoppers get the reserve prompt). Blank = untracked (always available).
              Auto-filled from the linked inventory item when there is one. */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Stock</label>
            <input
              type="number"
              min={0}
              value={catalogQty}
              onChange={(e) => setCatalogQty(e.target.value)}
              placeholder="e.g., 12  (0 = out of stock)"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
            />
            <p className="mt-1 text-[11px] text-muted">Set to <span className="font-semibold">0</span> to mark out of stock, and shoppers then get the reserve/pre-order prompt. Leave blank to keep it always available.</p>
          </div>
          {/* Secondary selling price is carried from the linked inventory item. */}

          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
              Images (optional, up to 5) - {catalogExistingImages.length + catalogImages.length}/5 selected. You can add images later; a book placeholder shows until then.
            </label>

            {/* Existing images (edit mode) */}
            {catalogExistingImages.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {catalogExistingImages.map((url, index) => (
                  <div key={`existing-${index}`} className="relative group">
                    <img
                      src={url}
                      alt={`Image ${index + 1}`}
                      className="h-24 w-24 rounded-xl object-cover border-2 border-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCatalogExistingImage(index)}
                      aria-label={`Remove image ${index + 1}`}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New image previews */}
            {catalogImagePreviews.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {catalogImagePreviews.map((url, index) => (
                  <div key={`new-${index}`} className="relative group">
                    <img
                      src={url}
                      alt={`New image ${index + 1}`}
                      className="h-24 w-24 rounded-xl object-cover border-2 border-green-300"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCatalogNewImage(index)}
                      aria-label={`Remove new image ${index + 1}`}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            {(catalogExistingImages.length + catalogImages.length) < 5 && (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 px-4 py-6 text-sm text-muted hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Click to upload images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleCatalogImageSelect(e.target.files)}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            onClick={() => { isEdit ? setEditingCatalogItem(null) : setShowCreateCatalog(false); resetCatalogForm() }}
            className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
            type="button"
            disabled={isUploadingCatalog}
          >
            Cancel
          </button>
          <button
            onClick={isEdit ? handleEditCatalogItem : handleCreateCatalogItem}
            className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
            type="button"
            disabled={isUploadingCatalog}
          >
            {isUploadingCatalog ? 'Uploading...' : isEdit ? 'Save Changes' : 'Create Item'}
          </button>
        </div>
      </div>
    </div>
  )

  /** Shelves manager: create, reorder, hide and delete curated collections. */
  const renderShelvesTab = () => (
    <div className="space-y-6">
      <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-purple-50/50 p-6 shadow-xl border border-purple-200/50">
        <h3 className="font-display text-xl gradient-text">
          {editingShelf ? `Edit "${editingShelf.name}"` : 'Create a shelf'}
        </h3>
        <p className="mt-1 text-xs text-muted">
          Shelves group books on the public <span className="font-semibold">/shelves</span> page.
          Assign books to a shelf from the Catalog tab when adding or editing an item.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Shelf name *</label>
            <input
              type="text"
              value={shelfName}
              onChange={(e) => setShelfName(e.target.value)}
              placeholder="e.g. Ramadan Picks"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
            />
            {editingShelf ? (
              <p className="mt-1.5 text-[11px] text-muted">
                Web address stays <span className="font-mono">/shelves#{editingShelf.slug}</span> so books already on this shelf keep their link.
              </p>
            ) : (
              shelfName.trim() && (
                <p className="mt-1.5 text-[11px] text-muted">
                  Web address: <span className="font-mono">{shelfSlug(shelfName) || '(needs a letter or number)'}</span>
                </p>
              )
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Short description</label>
            <input
              type="text"
              value={shelfDescription}
              onChange={(e) => setShelfDescription(e.target.value)}
              placeholder="One line shown under the shelf name"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Order</label>
            <input
              type="number"
              value={shelfOrder}
              onChange={(e) => setShelfOrder(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
            />
            <p className="mt-1.5 text-[11px] text-muted">Lower numbers appear first.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveShelf}
            disabled={isSavingShelf}
            className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isSavingShelf ? 'Saving...' : editingShelf ? 'Save changes' : 'Create shelf'}
          </button>
          {editingShelf && (
            <button
              type="button"
              onClick={resetShelfForm}
              className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
            >
              Cancel
            </button>
          )}
          {shelfMessage && (
            <span className="rounded-full bg-primary/5 border border-primary/20 px-4 py-2 text-xs font-medium text-primaryDark">
              {shelfMessage}
            </span>
          )}
        </div>
      </div>

      <div className="panel-card overflow-hidden rounded-3xl bg-white shadow-xl border border-primary/10">
        <div className="bg-gradient-to-r from-primary/5 to-secondary/5 px-6 py-5 border-b border-primary/10">
          <h3 className="font-display text-xl gradient-text">
            Shelves ({shelves.length})
          </h3>
        </div>
        {shelvesLoading ? (
          <p className="px-6 py-10 text-center text-sm text-muted">Loading shelves...</p>
        ) : shelves.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">
            No shelves yet. Create your first one above.
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {shelves.map((shelf) => {
              const count = shelfBookCount(shelf.slug)
              return (
                <li key={shelf.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-primaryDark">{shelf.name}</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-600 border border-gray-200">
                        {count} {count === 1 ? 'book' : 'books'}
                      </span>
                      {!shelf.active && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                          Hidden
                        </span>
                      )}
                      {shelf.active && count === 0 && (
                        <span
                          title="A shelf with no books is skipped on the public page."
                          className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200"
                        >
                          Not shown yet
                        </span>
                      )}
                    </div>
                    {shelf.description && (
                      <p className="mt-1 text-xs text-muted">{shelf.description}</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted">
                      order {shelf.order} &middot; <span className="font-mono">{shelf.slug}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingShelf(shelf)
                        setShelfName(shelf.name)
                        setShelfDescription(shelf.description)
                        setShelfOrder(String(shelf.order))
                        setShelfMessage('')
                      }}
                      className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleShelfActive(shelf)}
                      className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                    >
                      {shelf.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteShelf(shelf)}
                      className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )

  /** Blog manager: write, edit, publish and delete posts. */
  const renderBlogTab = () => (
    <div className="space-y-6">
      {!showPostEditor ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {blogLoading ? 'Loading posts...' : `${blogPosts.length} post${blogPosts.length === 1 ? '' : 's'}`}
          </p>
          <button
            type="button"
            onClick={openNewPost}
            className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
          >
            + Write a post
          </button>
        </div>
      ) : (
        <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-purple-50/50 p-6 shadow-xl border border-purple-200/50">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl gradient-text">
              {editingPost ? `Edit "${editingPost.title}"` : 'New post'}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPostPreview((v) => !v)}
                className="rounded-full border-2 border-primary/20 px-4 py-2 text-xs font-bold text-primaryDark hover:bg-primary/5 transition-colors"
              >
                {postPreview ? 'Back to editing' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={() => { setShowPostEditor(false); resetPostForm() }}
                className="rounded-full border-2 border-primary/20 px-4 py-2 text-xs font-bold text-primaryDark hover:bg-primary/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          {postPreview ? (
            <div className="rounded-2xl border-2 border-primary/10 bg-white p-6">
              <h1 className="font-display text-3xl font-bold text-primaryDark">{postTitle || 'Untitled'}</h1>
              <p className="mt-2 text-xs text-muted">
                {postAuthor || 'Eduvate Kids'} &middot; {readingMinutes(postBody)} min read
              </p>
              <div
                className="mt-6 text-ink/90"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(postBody) }}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Title *</label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="How to Start a Ramadan Reading Routine"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
                />
                {editingPost ? (
                  <p className="mt-1.5 text-[11px] text-muted">
                    Address stays <span className="font-mono">/blog/{editingPost.slug}</span> so shared links keep working.
                  </p>
                ) : (
                  postTitle.trim() && (
                    <p className="mt-1.5 text-[11px] text-muted">
                      Address: <span className="font-mono">/blog/{blogSlug(postTitle) || '(needs a letter or number)'}</span>
                    </p>
                  )
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
                  Summary <span className="normal-case font-medium">(optional, taken from the first lines if blank)</span>
                </label>
                <input
                  type="text"
                  value={postExcerpt}
                  onChange={(e) => setPostExcerpt(e.target.value)}
                  placeholder="One line shown on the blog card and in search results"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted">Content * (Markdown)</label>
                  <label className="cursor-pointer rounded-full border-2 border-primary/20 px-3 py-1.5 text-[11px] font-bold text-primaryDark hover:bg-primary/5 transition-colors">
                    <input
                      type="file"
                      accept=".md,.markdown,.txt"
                      className="hidden"
                      onChange={(e) => { handleMarkdownFile(e.target.files?.[0]); e.target.value = '' }}
                    />
                    Load a .md file
                  </label>
                </div>
                <textarea
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  rows={16}
                  placeholder={'# A heading\n\nWrite here, or paste a whole Markdown document.\n\n- bullet points\n- **bold** and *italic*\n- [links](https://example.com)'}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 font-mono text-xs leading-relaxed hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
                />
                <p className="mt-1.5 text-[11px] text-muted">
                  {readingMinutes(postBody)} min read &middot; supports headings, bold, italic, lists, quotes, links, images and code.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
                  Images <span className="normal-case font-medium">(more than one becomes a slider)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPostNewImages(Array.from(e.target.files || []))}
                  className="w-full rounded-xl border-2 border-dashed border-primary/25 px-4 py-3 text-xs"
                />
                {(postExistingImages.length > 0 || postImagePreviews.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {postExistingImages.map((src) => (
                      <span key={src} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-20 w-20 rounded-xl object-cover ring-1 ring-black/10" />
                        <button
                          type="button"
                          onClick={() => setPostExistingImages((prev) => prev.filter((s) => s !== src))}
                          aria-label="Remove image"
                          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow"
                        >
                          x
                        </button>
                      </span>
                    ))}
                    {postImagePreviews.map((src, i) => (
                      <span key={src} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-20 w-20 rounded-xl object-cover ring-2 ring-primary/40" />
                        <span className="absolute bottom-0 inset-x-0 rounded-b-xl bg-primary/80 text-center text-[9px] font-bold text-white">new</span>
                        <button
                          type="button"
                          onClick={() => setPostNewImages((prev) => prev.filter((_, n) => n !== i))}
                          aria-label="Remove image"
                          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Author</label>
                <input
                  type="text"
                  value={postAuthor}
                  onChange={(e) => setPostAuthor(e.target.value)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Date</label>
                <input
                  type="date"
                  value={postPublishedAt}
                  onChange={(e) => setPostPublishedAt(e.target.value)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
                  Tags <span className="normal-case font-medium">(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={postTags}
                  onChange={(e) => setPostTags(e.target.value)}
                  placeholder="ramadan, reading habits"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Likes</label>
                <input
                  type="number"
                  min={0}
                  value={postLikes}
                  onChange={(e) => setPostLikes(e.target.value)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
                />
                <p className="mt-1.5 text-[11px] text-muted">Readers add to this by tapping the heart.</p>
              </div>

              <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border-2 border-primary/20 px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={postPublished}
                  onChange={(e) => setPostPublished(e.target.checked)}
                  className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary/50"
                />
                <span className="text-sm font-semibold text-primaryDark">
                  Published
                  <span className="ml-1 font-normal text-muted">
                    (unpublished posts stay here as drafts and never appear on the site)
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSavePost}
              disabled={isSavingPost}
              className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isSavingPost ? 'Saving...' : editingPost ? 'Save changes' : 'Create post'}
            </button>
            {blogMessage && (
              <span className="rounded-full bg-primary/5 border border-primary/20 px-4 py-2 text-xs font-medium text-primaryDark">
                {blogMessage}
              </span>
            )}
          </div>
        </div>
      )}

      {!showPostEditor && blogMessage && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs font-medium text-primaryDark">
          {blogMessage}
        </div>
      )}

      {!showPostEditor && (
        <div className="panel-card overflow-hidden rounded-3xl bg-white shadow-xl border border-primary/10">
          {blogLoading ? (
            <p className="px-6 py-10 text-center text-sm text-muted">Loading posts...</p>
          ) : blogPosts.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted">
              No posts yet. Write your first one above.
            </p>
          ) : (
            <ul className="divide-y divide-black/5">
              {blogPosts.map((post) => (
                <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-primaryDark">{post.title}</span>
                      {!post.published && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                          Draft
                        </span>
                      )}
                      <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-[11px] font-bold text-pink-700 border border-pink-200">
                        {post.likes} {post.likes === 1 ? 'like' : 'likes'}
                      </span>
                      {post.images.length > 1 && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-600 border border-gray-200">
                          {post.images.length} images
                        </span>
                      )}
                    </div>
                    {post.excerpt && <p className="mt-1 line-clamp-1 text-xs text-muted">{post.excerpt}</p>}
                    <p className="mt-1 text-[11px] text-muted">
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'no date'} &middot;{' '}
                      {post.author} &middot; <span className="font-mono">/blog/{post.slug}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetPostLikes(post, post.likes + 1)}
                      title="Add a like"
                      className="rounded-full bg-pink-50 px-2.5 py-1.5 text-[11px] font-bold text-pink-700 border border-pink-200 hover:bg-pink-100 transition-colors"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPostLikes(post, post.likes - 1)}
                      disabled={post.likes <= 0}
                      title="Remove a like"
                      className="rounded-full bg-pink-50 px-2.5 py-1.5 text-[11px] font-bold text-pink-700 border border-pink-200 hover:bg-pink-100 transition-colors disabled:opacity-40"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditPost(post)}
                      className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePostPublished(post)}
                      className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                    >
                      {post.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post)}
                      className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )

  /** Website content: tabbed shell over shelves, blog and freebies. */
  const renderWebsite = () => (
    <div className="fade-up space-y-6">
      <div className="panel-card rounded-3xl bg-white p-2 shadow-xl border border-primary/10">
        <div className="flex flex-wrap gap-1">
          {WEBSITE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setWebsiteTab(tab.id)}
              aria-current={websiteTab === tab.id ? 'page' : undefined}
              className={`flex-1 min-w-[120px] rounded-2xl px-5 py-3 text-sm font-bold transition-all ${
                websiteTab === tab.id
                  ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                  : 'text-primaryDark hover:bg-primary/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted">
        {WEBSITE_TABS.find((t) => t.id === websiteTab)?.blurb}
      </p>

      {/* The public pages are generated at build time, so content edits are not
          live until the site rebuilds. Say so plainly and offer the shortcut. */}
      {!demoMode && (
        <div
          className={`panel-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-4 ${
            publishPending ? 'border-amber-300 bg-amber-50' : 'border-primary/15 bg-primary/5'
          }`}
        >
          <p className={`text-xs font-medium ${publishPending ? 'text-amber-900' : 'text-muted'}`}>
            {publishPending ? (
              <>
                <span className="font-bold">Changes are not on the public site yet.</span>{' '}
                They publish automatically about 10 minutes after your last edit, or publish now.
              </>
            ) : (
              <>
                Public pages are up to date
                {publishState.lastDispatchAt
                  ? ` (last published ${new Date(publishState.lastDispatchAt).toLocaleString()})`
                  : ''}
                .
              </>
            )}
          </p>
          <button
            type="button"
            onClick={handlePublishNow}
            disabled={isPublishing}
            className="shrink-0 rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2 text-xs font-bold text-white shadow-soft transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isPublishing ? 'Starting...' : 'Publish now'}
          </button>
        </div>
      )}
      {publishMessage && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs font-medium text-primaryDark">
          {publishMessage}
        </div>
      )}

      {demoMode ? (
        <div className="panel-card rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          Website content is only editable in <strong>Live</strong> mode. Switch modes using the toggle in the header.
        </div>
      ) : websiteTab === 'shelves' ? (
        renderShelvesTab()
      ) : websiteTab === 'blog' ? (
        renderBlogTab()
      ) : (
        <div className="panel-card rounded-3xl bg-white p-10 text-center shadow-xl border border-primary/10">
          <p className="text-sm text-muted">This section is coming next.</p>
        </div>
      )}
    </div>
  )

  const renderCatalog = () => (
    <div className="fade-up space-y-6">
      {/* Header */}
      <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-purple-50/50 p-6 shadow-xl border border-purple-200/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl gradient-text">Product Catalog</h2>
            <p className="mt-1 text-sm text-muted">{catalogItems.length} items in catalog</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleLinkCatalogInventory}
              disabled={isLinkingCatalog}
              className="inline-flex items-center gap-2 rounded-full border-2 border-primary/20 px-5 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors disabled:opacity-50"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m8.656-2.828a4 4 0 00-5.656 0l-3 3a4 4 0 000 5.656" /></svg>
              {isLinkingCatalog ? 'Linking...' : 'Link Catalog & Inventory'}
            </button>
            <button
              onClick={() => { resetCatalogForm(); setShowCreateCatalog(true) }}
              className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
              type="button"
            >
              + New Item
            </button>
          </div>
        </div>
        {catalogLinkMessage && (
          <div className="mt-3 rounded-xl bg-green-50 border border-green-200 p-3 text-xs font-medium text-green-700">
            {catalogLinkMessage}
          </div>
        )}

        {/* Each book also has a static /book/<slug> page built from this
            catalog. Those only refresh when the site rebuilds, so surface
            whether the public pages are currently behind. */}
        {!demoMode && (
          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-4 ${
              publishPending ? 'border-amber-300 bg-amber-50' : 'border-primary/15 bg-primary/5'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  publishPending ? 'bg-amber-200 text-amber-800' : 'bg-primary/15 text-primaryDark'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
                </svg>
              </span>
              <div>
                <p className={`text-sm font-bold ${publishPending ? 'text-amber-900' : 'text-primaryDark'}`}>
                  {publishPending
                    ? 'Catalog changes are not on the public site yet'
                    : 'Public product pages are up to date'}
                </p>
                <p className={`text-xs ${publishPending ? 'text-amber-800' : 'text-muted'}`}>
                  {publishPending
                    ? 'Each book has its own page for Google and AI search. These rebuild automatically about 10 minutes after your last edit, or publish now.'
                    : `Last published ${
                        publishState.lastDispatchAt
                          ? new Date(publishState.lastDispatchAt).toLocaleString()
                          : 'not yet'
                      }.`}
                </p>
                {publishState.lastError && (
                  <p className="mt-1 text-xs font-semibold text-red-600">
                    Last publish attempt failed. Try again, or check the deploy logs.
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handlePublishNow}
              disabled={isPublishing}
              className="shrink-0 rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-xs font-bold text-white shadow-soft transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isPublishing ? 'Starting…' : 'Publish now'}
            </button>
          </div>
        )}
        {publishMessage && (
          <div className="mt-3 rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs font-medium text-primaryDark">
            {publishMessage}
          </div>
        )}
      </div>

      {catalogMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
          {catalogMessage}
        </div>
      )}

      {/* Search & Filters */}
      <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search by title or publisher..."
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
            />
          </div>
          <select
            value={catalogCategoryFilter}
            onChange={(e) => setCatalogCategoryFilter(e.target.value as 'All' | InventoryCategory)}
            className="rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
          >
            <option value="All">All Categories</option>
            {ALL_CATALOG_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalog Grid */}
      {filteredCatalogItems.length === 0 ? (
        <div className="panel-card rounded-3xl bg-white p-12 shadow-xl border border-primary/10 text-center flex flex-col items-center">
          <svg className="h-14 w-14 mb-4 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h9a2 2 0 012 2v14l-6-3-6 3V5z" /></svg>
          <p className="text-lg font-semibold text-muted">No catalog items found</p>
          <p className="mt-2 text-sm text-muted">Click &quot;+ New Item&quot; to add your first product.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredCatalogItems.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col rounded-2xl bg-white shadow-[0_4px_24px_rgba(124,58,237,0.08)] border border-primary/5 overflow-hidden hover:shadow-[0_8px_40px_rgba(124,58,237,0.16)] hover:-translate-y-1 transition-all duration-500"
            >
              {/* Image Slider - book covers show fully (object-contain, no cropping) */}
              <div className="relative aspect-[3/4] bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 overflow-hidden">
                {item.images.length > 0 ? (
                  <>
                    <div className="relative h-full w-full">
                      {item.images.map((img, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={img}
                          alt={`${item.title} ${imgIdx + 1}`}
                          className={`absolute inset-0 h-full w-full object-contain p-2 transition-all duration-700 ease-out ${
                            imgIdx === (catalogSliderIndex[item.id] ?? 0)
                              ? 'opacity-100 scale-100'
                              : 'opacity-0 scale-110'
                          }`}
                        />
                      ))}
                    </div>
                    {item.images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const cur = catalogSliderIndex[item.id] ?? 0
                            setCatalogSliderIndex((prev) => ({ ...prev, [item.id]: cur === 0 ? item.images.length - 1 : cur - 1 }))
                          }}
                          aria-label="Previous image"
                          className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-primaryDark shadow-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const cur = catalogSliderIndex[item.id] ?? 0
                            setCatalogSliderIndex((prev) => ({ ...prev, [item.id]: cur === item.images.length - 1 ? 0 : cur + 1 }))
                          }}
                          aria-label="Next image"
                          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-primaryDark shadow-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                          {item.images.map((_, dotIdx) => (
                            <button
                              key={dotIdx}
                              type="button"
                              aria-label={`Go to image ${dotIdx + 1}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setCatalogSliderIndex((prev) => ({ ...prev, [item.id]: dotIdx }))
                              }}
                              className="flex items-center justify-center h-6 w-4 group/dot"
                            >
                              <span className={`block h-1.5 rounded-full transition-all duration-300 ${
                                dotIdx === (catalogSliderIndex[item.id] ?? 0)
                                  ? 'w-5 bg-white shadow-sm'
                                  : 'w-1.5 bg-white/50 group-hover/dot:bg-white/80'
                              }`} />
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <BookPlaceholder title={item.title} className="h-full w-full" />
                )}
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col p-3.5">
                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-1 mb-2">
                  {(Array.isArray(item.category) ? item.category : [item.category]).map((cat) => (
                    <span key={cat} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${catalogCategoryBadgeClasses[cat] || catalogCategoryBadgeClasses.Others}`}>
                      {cat}
                    </span>
                  ))}
                  {(Array.isArray(item.ageCategory) ? item.ageCategory : [item.ageCategory]).map((age) => (
                    <span
                      key={age}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${catalogAgeBadgeClasses[age as AgeCategory]}`}
                      title={AGE_CATEGORIES[age as AgeCategory]?.range || age}
                    >
                      {ageShortLabel(age)}
                    </span>
                  ))}
                </div>

                <h3 className="font-display text-sm font-bold text-primaryDark leading-snug line-clamp-2 min-h-[2.5rem]">{item.title}</h3>
                <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2 min-h-[2rem]">{item.description}</p>

                <div className="mt-auto pt-3 space-y-2.5">
                  {/* Price and publisher row */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-extrabold gradient-text">${formatNumber(item.price)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200/60 px-2 py-0.5 min-w-0">
                      <svg className="h-3 w-3 shrink-0 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                      <span className="text-[11px] font-semibold text-purple-700 max-w-[80px] truncate">{item.publisher}</span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openEditCatalogItem(item)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                      type="button"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      Edit
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this item? This cannot be undone.')) handleDeleteCatalogItem(item.id) }}
                      className="flex items-center justify-center rounded-lg px-2 py-1.5 text-xs font-bold text-red-500 border border-red-200 transition-all duration-300 hover:bg-red-50 hover:-translate-y-0.5 active:scale-95"
                      type="button"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50">
        <div className="text-center">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-lg font-semibold text-primaryDark">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen text-ink bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div
        className="hero-svg-bg absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url(${bg1.src})`,
          backgroundSize: '75% auto',
          backgroundRepeat: 'repeat'
        }}
      />
      {[
        { src: design1, classes: 'left-6 top-12 h-16 w-16 opacity-20' },
        { src: design2, classes: 'right-10 top-10 h-20 w-20 opacity-15' },
        { src: design1, classes: 'left-1/4 top-64 h-14 w-14 opacity-10' },
        { src: design2, classes: 'right-1/3 top-56 h-16 w-16 opacity-15' },
        { src: design1, classes: 'left-16 bottom-20 h-20 w-20 opacity-10' },
        { src: design2, classes: 'right-20 bottom-16 h-16 w-16 opacity-15' },
        { src: design1, classes: 'left-1/2 top-24 h-24 w-24 opacity-10' },
        { src: design2, classes: 'right-1/2 bottom-24 h-14 w-14 opacity-10' },
        { src: design1, classes: 'left-10 bottom-1/3 h-12 w-12 opacity-15' },
        { src: design2, classes: 'right-10 bottom-1/2 h-14 w-14 opacity-10' }
      ].map((item, index) => (
        <Image
          key={`dash-design-${index}`}
          src={item.src}
          alt=""
          width={160}
          height={160}
          priority={index === 0}
          className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 ${item.classes}`}
        />
      ))}

      {/* Slim top bar: brand at the left, Live indicator + Settings + Logout at the right. */}
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgba(124,58,237,0.06)] animate-fadeIn">
        <div className="h-[3px] w-full bg-gradient-to-r from-primary via-secondary to-accentOne" aria-hidden="true" />
        <div className="w-full px-4">
          <div className="flex items-center justify-between py-3.5">
            {/* Left: mobile menu toggle + logo */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl border-2 border-primary/30 text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <a className="flex items-center gap-3 group" href="/">
                <Image
                  src={logo}
                  alt="Eduvate Kids logo"
                  width={32}
                  height={32}
                  className="group-hover:scale-110 transition-transform duration-300"
                />
                <div className="hidden sm:block">
                  <span className="font-display text-xl font-bold gradient-text">Eduvate Kids</span>
                  <p className="text-xs text-muted">Admin Dashboard</p>
                </div>
              </a>
            </div>

            {/* Right: Live indicator + Settings + Logout */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-green-50 border border-primary/20">
                <span className={`h-2 w-2 rounded-full ${demoMode ? 'bg-amber-500' : 'bg-green-500'}`} />
                <span className="text-[11px] font-bold text-primaryDark">{demoMode ? 'Demo' : 'Live'}</span>
              </div>
              {userRole === 'admin' && (
                <button
                  onClick={() => router.push('/settings')}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/30 bg-white hover:bg-primary/5 hover:-translate-y-0.5 transition-all duration-300"
                  type="button"
                  aria-label="Settings"
                >
                  <svg className="h-5 w-5 text-primaryDark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex h-10 items-center justify-center gap-2 rounded-full border-2 border-red-200 bg-white px-3 sm:px-4 text-sm font-bold text-red-600 hover:bg-red-50 hover:-translate-y-0.5 transition-all duration-300"
                type="button"
                aria-label="Log out"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {(() => {
        const navItems = NAV_ITEMS.filter((item) => userRole === 'admin' || item.id === 'pos')
        const current = NAV_ITEMS.find((n) => n.id === activeView) ?? NAV_ITEMS[0]
        return (
      <div className="relative z-10 flex">
        {/* ── Left sidebar (desktop): collapsible icon rail ── */}
        <aside
          className={`sticky top-[71px] hidden md:flex h-[calc(100vh-71px)] flex-col border-r border-primary/10 bg-white/70 backdrop-blur-xl transition-all duration-300 ${sidebarCollapsed ? 'w-[74px]' : 'w-60'}`}
        >
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as typeof activeView)}
                type="button"
                aria-current={activeView === item.id ? 'page' : undefined}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200 ${sidebarCollapsed ? 'justify-center' : ''} ${
                  activeView === item.id
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                    : 'text-primaryDark hover:bg-primary/10'
                }`}
              >
                <NavIcon id={item.id} className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </nav>
          {/* collapse toggle */}
          <div className="border-t border-primary/10 p-3">
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              type="button"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-primary/5 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <svg className={`h-5 w-5 flex-shrink-0 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              {!sidebarCollapsed && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        {/* ── Mobile slide-in sidebar ── */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fadeIn" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
            <aside className="absolute left-0 top-0 h-full w-72 max-w-[82%] bg-white shadow-2xl animate-slideInLeft flex flex-col">
              <div className="flex items-center justify-between border-b border-primary/10 px-4 py-4">
                <span className="font-display text-lg font-bold gradient-text">Menu</span>
                <button onClick={() => setMobileMenuOpen(false)} type="button" aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 text-primaryDark hover:bg-primary/5">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveView(item.id as typeof activeView); setMobileMenuOpen(false) }}
                    type="button"
                    aria-current={activeView === item.id ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-all duration-200 ${
                      activeView === item.id
                        ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                        : 'text-primaryDark hover:bg-primary/10'
                    }`}
                  >
                    <NavIcon id={item.id} className="h-5 w-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* ── Main content ── */}
        <main className="relative z-10 min-w-0 flex-1 px-4 py-8 md:px-8 md:py-10">
          <div className="mx-auto max-w-6xl">
            <section className="flex-1 space-y-8">
              <div className="fade-up">
                <h1 className="font-display text-3xl md:text-4xl gradient-text">{current.title}</h1>
                <p className="mt-3 text-sm text-muted max-w-2xl">{current.subtitle}</p>
              </div>

              {activeView === 'home' && renderHome()}
              {activeView === 'inventory' && renderInventory()}
              {activeView === 'events' && renderEvents()}
              {activeView === 'catalog' && renderCatalog()}
              {activeView === 'pos' && renderPOS()}
              {activeView === 'orders' && renderOrders()}
              {activeView === 'summer' && renderSummer()}
              {activeView === 'bookRequests' && renderBookRequests()}
              {activeView === 'website' && renderWebsite()}
            </section>
          </div>
        </main>
      </div>
        )
      })()}

      {/* Global Modals - rendered outside page views */}
      {showCreateCatalog && renderCatalogFormModal(false)}
      {editingCatalogItem && renderCatalogFormModal(true)}

      {/* Inventory barcode / QR scanner */}
      <BarcodeScanner
        open={inventoryScannerOpen}
        onClose={() => setInventoryScannerOpen(false)}
        onDetected={handleInventoryScan}
        title="Scan to add / find stock"
        hint="Scan a book barcode or QR code to find it in inventory or add it as new."
      />

      {/* Bind-mode scanner: attach a scanned/typed code to a specific inventory item */}
      <BarcodeScanner
        open={bindTargetItem !== null}
        onClose={() => setBindTargetItem(null)}
        onDetected={(value) => { if (bindTargetItem) handleBindCode(bindTargetItem, value) }}
        title={bindTargetItem ? `Bind a code to "${bindTargetItem.title}"` : 'Bind a code'}
        hint="Scan or type a barcode/QR. A 13-digit value is saved as ISBN, anything else as SKU."
      />

      {/* POS scan-to-cart scanner */}
      <BarcodeScanner
        open={posScannerOpen}
        onClose={() => setPosScannerOpen(false)}
        onDetected={handlePosScan}
        title="Scan to cart"
        hint="Scan a book's QR or barcode to add it to the sale. The book must already be bound in Inventory."
      />

      {/* Scan-to-cart confirmation: same QR/ISBN = same book, so confirm before adding a unit */}
      {scanCartConfirm && (() => {
        const inCart = cartItems.find((c) => c.itemId === scanCartConfirm.id)?.quantity ?? 0
        const remaining = scanCartConfirm.quantity - inCart
        return (
          <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fadeIn" onClick={() => setScanCartConfirm(null)}>
            <div className="w-full sm:max-w-sm max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl border-2 border-primary/20" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" /></svg>
                </span>
                <div className="min-w-0">
                  <h4 className="font-display text-lg font-bold text-primaryDark">Add to cart?</h4>
                  <p className="mt-1 text-sm text-muted">This book is already bound. Add one unit to the current sale?</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-gray-50 border border-black/5 p-4">
                <p className="font-semibold text-ink">{scanCartConfirm.title}</p>
                <p className="mt-1 font-mono text-xs text-muted">{scanCartConfirm.isbn ? `ISBN ${scanCartConfirm.isbn}` : scanCartConfirm.sku ? `SKU ${scanCartConfirm.sku}` : scanCartConfirm.id}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted">Price</span>
                  <span className="font-bold text-primaryDark">${formatNumber(scanCartConfirm.sellingPrice)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-muted">In cart / stock</span>
                  <span className="font-semibold text-ink">{inCart} / {scanCartConfirm.quantity}</span>
                </div>
              </div>
              {remaining <= 0 && (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">No remaining stock for this book.</p>
              )}
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setScanCartConfirm(null)}
                  className="flex-1 rounded-full border-2 border-primary/20 px-4 py-2.5 text-sm font-bold text-primaryDark transition hover:bg-primary/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmScanToCart}
                  disabled={remaining <= 0}
                  className="flex-1 rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  Add to cart
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Scan-to-inventory confirmation: add a chosen quantity to a matched book's stock */}
      {scanStockConfirm && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fadeIn" onClick={() => setScanStockConfirm(null)}>
          <div className="w-full sm:max-w-sm max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl border-2 border-primary/20" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" /></svg>
              </span>
              <div className="min-w-0">
                <h4 className="font-display text-lg font-bold text-primaryDark">Add to inventory?</h4>
                <p className="mt-1 text-sm text-muted">This book is already in stock. Choose how many to add.</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-gray-50 border border-black/5 p-4">
              <p className="font-semibold text-ink">{scanStockConfirm.title}</p>
              <p className="mt-1 font-mono text-xs text-muted">{scanStockConfirm.isbn ? `ISBN ${scanStockConfirm.isbn}` : scanStockConfirm.sku ? `SKU ${scanStockConfirm.sku}` : scanStockConfirm.id}</p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted">Current stock</span>
                <span className="font-semibold text-ink">{scanStockConfirm.quantity}</span>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Quantity to add</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setScanStockQty((q) => Math.max(1, q - 1))}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-primary/20 text-primaryDark transition hover:bg-primary/5"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
                <input
                  type="number"
                  min={1}
                  value={scanStockQty}
                  onChange={(e) => setScanStockQty(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-2.5 text-center text-lg font-bold text-primaryDark focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setScanStockQty((q) => q + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-primary/20 text-primaryDark transition hover:bg-primary/5"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">New stock will be <span className="font-semibold text-primaryDark">{scanStockConfirm.quantity + Math.max(1, Math.round(scanStockQty))}</span>.</p>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setScanStockConfirm(null)}
                className="flex-1 rounded-full border-2 border-primary/20 px-4 py-2.5 text-sm font-bold text-primaryDark transition hover:bg-primary/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmScanToInventory}
                className="flex-1 rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5"
              >
                Add to inventory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR label modal: generate + print a QR for an item's SKU (or id) */}
      {qrModalItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn print:static print:bg-white print:p-0" onClick={() => { setQrModalItem(null); setQrDataUrl('') }}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border-2 border-primary/20 print:border-0 print:shadow-none" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4 print:hidden">
              <div>
                <h4 className="font-display text-xl gradient-text">QR Label</h4>
                <p className="mt-1 text-xs text-muted">Print or screenshot to attach to the book.</p>
              </div>
              <button
                onClick={() => { setQrModalItem(null); setQrDataUrl('') }}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary/20 text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex flex-col items-center text-center">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt={`QR code for ${qrModalItem.title}`} className="h-56 w-56 rounded-xl border border-black/5" />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-dashed border-primary/30 text-sm text-muted">Generating…</div>
              )}
              <p className="mt-4 font-display text-base font-bold text-primaryDark">{qrModalItem.title}</p>
              <p className="mt-1 font-mono text-xs text-muted">{qrModalItem.code || qrModalItem.id}</p>
            </div>
            <button
              onClick={() => window.print()}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 print:hidden"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-12 0v4h12v-4m-12 0h12" /></svg>
              Print QR
            </button>
          </div>
        </div>
      )}

      {/* Inventory Edit/Add Modal */}
      {(editingInventoryItem || showAddInventoryItem) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:px-4 animate-fadeIn">
          <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">
                  {editingInventoryItem ? 'Edit Inventory Item' : 'Add New Item'}
                </h4>
                <p className="mt-2 text-sm text-muted">
                  {editingInventoryItem ? 'Update the details below' : 'Fill in the details to add a new inventory item'}
                </p>
              </div>
              <button
                onClick={() => { setEditingInventoryItem(null); setShowAddInventoryItem(false); }}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/20 text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Title *</label>
                <input
                  type="text"
                  value={invEditTitle}
                  onChange={(e) => setInvEditTitle(e.target.value)}
                  placeholder="e.g., ABC of Allah Loves Me"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Category *</label>
                <select
                  value={invEditCategory}
                  onChange={(e) => setInvEditCategory(e.target.value as InventoryCategory)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                >
                  {['Books', 'Activity Books', 'Cards', 'Crafts', 'Puzzles', 'Games', 'Gifts', 'Others'].map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Publisher</label>
                <input
                  type="text"
                  value={invEditPublisher}
                  onChange={(e) => setInvEditPublisher(e.target.value)}
                  placeholder="e.g., Learning Roots"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              {/* One identifier field. Books use their ISBN, other stock a
                  barcode or internal code — splitting this across SKU and ISBN
                  is what let the same item be entered twice. */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
                  Code <span className="normal-case text-[10px] font-medium">(ISBN, barcode, or your own)</span>
                </label>
                <input
                  type="text"
                  value={invEditCode}
                  onChange={(e) => setInvEditCode(e.target.value)}
                  placeholder="e.g., 9781234567890 or EK-my-item"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
                {invEditAltCode.trim() && (
                  <p className="mt-1.5 text-[11px] text-muted">
                    Also recognised: <span className="font-semibold">{invEditAltCode}</span>{' '}
                    <button
                      type="button"
                      onClick={() => setInvEditAltCode('')}
                      className="text-red-600 underline hover:no-underline"
                    >
                      remove
                    </button>
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">RRP ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={invEditRrp}
                  onChange={(e) => setInvEditRrp(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Discount %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={invEditDiscount}
                  onChange={(e) => setInvEditDiscount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Quantity *</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={invEditQuantity}
                  onChange={(e) => setInvEditQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Selling Price ($) *</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={invEditSellingPrice}
                  onChange={(e) => setInvEditSellingPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Weight (grams)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={invEditWeight}
                  onChange={(e) => setInvEditWeight(e.target.value)}
                  placeholder="e.g., 350"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => { setEditingInventoryItem(null); setShowAddInventoryItem(false); }}
                className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInventoryItem}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                type="button"
                disabled={!invEditTitle.trim() || !invEditQuantity || isSavingInventory}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {isSavingInventory ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                      Saving...
                    </>
                  ) : editingInventoryItem ? (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Save Changes
                    </>
                  ) : '+ Add Item'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Confirm Sale Modal */}
      {showConfirmSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">Confirm Sale</h4>
                <p className="mt-2 text-sm text-muted">
                  {selectedEventId === 'general'
                    ? 'General Sales (no event)'
                    : events.find((event) => event.id === selectedEventId)?.name ??
                      'Selected event'}
                </p>
              </div>
              <button
                onClick={() => setShowConfirmSale(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/20 text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-1">
              {cartItems.map((item) => (
                <div key={item.itemId} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-muted mt-1">
                      {item.quantity} x ${formatNumber(item.price)}
                    </p>
                  </div>
                  <span className="text-lg font-bold gradient-text">
                    ${formatNumber(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-primary/5 border border-primary/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold">${formatNumber(cartTotal)}</span>
              </div>
              {paymentType === 'Card' && (
                <div className="flex items-center justify-between text-sm text-amber-600">
                  <span>Convenience fee (3%)</span>
                  <span className="font-semibold">${formatNumber(convenienceFee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xl font-bold pt-2 border-t border-primary/10">
                <span className="gradient-text">Total</span>
                <span className="gradient-text">${formatNumber(totalWithFee)}</span>
              </div>
              {paymentType === 'Card' && (
                <p className="text-[11px] text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                  💳 Card payments include a 3% convenience fee.
                </p>
              )}
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmSale(false)}
                className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRecordSale()}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                type="button"
                disabled={isSubmittingSale}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {isSubmittingSale ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Confirm Sale
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .panel-card {
          transition: transform 0.35s ease, box-shadow 0.35s ease;
        }

        .panel-card:hover {
          transform: translateY(-4px);
        }

        .fade-up {
          animation: fade-up 0.6s ease both;
        }

        @keyframes fade-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fade-in 0.3s ease both;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: scale-in 0.3s ease both;
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Custom Scrollbar Styles */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #7c3aed, #ec4899);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #6d28d9, #db2777);
        }

        .gradient-text {
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* Online order detail modal */}
      {expandedOrder && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-fadeIn" onClick={() => setExpandedOrder(null)}>
          <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-primaryDark">Order Details</h3>
                <p className="font-mono text-xs text-muted">{expandedOrder.id}</p>
              </div>
              <button type="button" onClick={() => setExpandedOrder(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-gray-100 hover:text-ink">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <span className={orderStatusBadge(expandedOrder.status)}>{expandedOrder.status}</span>
                <span className="text-xs text-muted">Paid {fmtDate(expandedOrder.paidAt)}</span>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Items <span className="font-normal normal-case">(editable)</span></p>
                <ul className="mt-2 space-y-2">
                  {expandedOrder.items?.map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 p-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-ink" title={it.title}>{it.title}</span>
                      <div className="flex items-center gap-1 rounded-full border border-gray-200">
                        <button type="button" aria-label={`Decrease ${it.title}`} onClick={() => setExpandedOrder((cur) => cur ? recomputeOrder(cur, cur.items.map((x, i) => i === idx ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)) : cur)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-gray-100">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                        </button>
                        <span className="min-w-[1.5rem] text-center font-semibold">{it.quantity}</span>
                        <button type="button" aria-label={`Increase ${it.title}`} onClick={() => setExpandedOrder((cur) => cur ? recomputeOrder(cur, cur.items.map((x, i) => i === idx ? { ...x, quantity: x.quantity + 1 } : x)) : cur)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-gray-100">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </button>
                      </div>
                      <span className="w-16 text-right font-semibold text-primaryDark">${it.lineTotal?.toFixed(2)}</span>
                      <button type="button" aria-label={`Remove ${it.title}`} onClick={() => setExpandedOrder((cur) => cur ? recomputeOrder(cur, cur.items.filter((_, i) => i !== idx)) : cur)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-500">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-black/5 pt-3 text-sm">
                  <div className="flex justify-between text-muted"><span>Subtotal</span><span>${expandedOrder.subtotal?.toFixed(2)}</span></div>
                  <div className="flex justify-between text-muted"><span>Shipping{expandedOrder.shipWeightGrams ? ` (${(expandedOrder.shipWeightGrams / 1000).toFixed(2)} kg${expandedOrder.shipZone ? `, zone ${expandedOrder.shipZone}` : ''})` : ''}</span><span>${expandedOrder.shippingFee?.toFixed(2)}</span></div>
                  <div className="flex justify-between text-muted"><span>Tax</span><span>${(expandedOrder.tax ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between pt-1 text-base font-bold text-primaryDark"><span>Total</span><span>${expandedOrder.total?.toFixed(2)}</span></div>
                </div>
                <button
                  type="button"
                  onClick={() => saveOrderItems(expandedOrder)}
                  disabled={savingOrder}
                  className="btn-shine mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {savingOrder ? 'Saving…' : 'Save item changes'}
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Customer</p>
                  <p className="mt-1 text-sm font-medium text-ink">{expandedOrder.customer?.name}</p>
                  <p className="text-sm text-muted">{expandedOrder.customer?.email}</p>
                  {expandedOrder.customer?.phone && <p className="text-sm text-muted">{expandedOrder.customer.phone}</p>}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Ship To</p>
                  <p className="mt-1 text-sm text-ink">{expandedOrder.shippingAddress?.line1}</p>
                  {expandedOrder.shippingAddress?.line2 && <p className="text-sm text-ink">{expandedOrder.shippingAddress.line2}</p>}
                  <p className="text-sm text-muted">{expandedOrder.shippingAddress?.city}, {expandedOrder.shippingAddress?.state} {expandedOrder.shippingAddress?.postalCode}</p>
                  <p className="text-sm text-muted">{expandedOrder.shippingAddress?.country}</p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-3 text-xs text-muted">
                <span className="font-semibold">Payment:</span> {expandedOrder.paymentProvider} · <span className="font-mono">{expandedOrder.paymentRef}</span>
              </div>

              {/* Purchase email (manual): preview the draft, or send it to the customer. */}
              <div className="rounded-xl border border-primary/10 bg-primary/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Customer purchase email</p>
                <p className="mt-1 text-xs text-muted break-all">To: {expandedOrder.customer?.email || 'no email on file'}</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPurchaseEmailPreview(expandedOrder)}
                    className="flex items-center justify-center gap-2 rounded-full border-2 border-primary/20 bg-white px-4 py-2.5 text-sm font-semibold text-primaryDark transition-all hover:bg-primary/5 hover:-translate-y-0.5"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    View email draft
                  </button>
                  <button
                    type="button"
                    onClick={() => sendPurchaseEmailToCustomer(expandedOrder)}
                    disabled={purchaseEmailSending || !expandedOrder.customer?.email}
                    className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {purchaseEmailSending ? (
                      <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending…</>
                    ) : purchaseEmailSentId === expandedOrder.id ? (
                      <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Email sent</>
                    ) : (
                      <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>Send purchase email</>
                    )}
                  </button>
                </div>
              </div>

              {expandedOrder.status === 'paid' && (
                <button
                  type="button"
                  onClick={() => markOrderShipped(expandedOrder)}
                  className="btn-shine flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 100-4h14a2 2 0 100 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>
                  Mark as Shipped
                </button>
              )}
              {expandedOrder.status === 'shipped' && (
                <button
                  type="button"
                  onClick={() => markOrderDelivered(expandedOrder)}
                  className="btn-shine flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Mark as Delivered
                </button>
              )}
              {expandedOrder.status === 'delivered' && (
                <div className="flex items-center justify-center gap-2 rounded-full bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Delivered {fmtDate(expandedOrder.deliveredAt)}
                </div>
              )}

              {/* Admin controls: change status + delete */}
              <div className="flex flex-col gap-3 border-t border-black/5 pt-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">Update Status</label>
                <select
                  value={expandedOrder.status}
                  onChange={(e) => updateOnlineOrderStatus(expandedOrder, e.target.value as OnlineOrder['status'])}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-2.5 text-sm font-medium hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
                >
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  type="button"
                  onClick={() => deleteOnlineOrder(expandedOrder)}
                  className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-red-200 bg-white px-6 py-3 text-sm font-semibold text-red-700 transition-all hover:bg-red-50 hover:-translate-y-0.5"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase-email draft preview */}
      {purchaseEmailPreview && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-fadeIn" onClick={() => setPurchaseEmailPreview(null)}>
          <div className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/95 backdrop-blur px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-primaryDark">Email draft</h3>
                <p className="text-xs text-muted break-all">To: {purchaseEmailPreview.customer?.email || '-'} · Subject: Your Eduvate Kids order, ${formatNumber(purchaseEmailPreview.total)} {String(purchaseEmailPreview.currency || 'usd').toUpperCase()}</p>
              </div>
              <button type="button" onClick={() => setPurchaseEmailPreview(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-gray-100 hover:text-ink">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 sm:p-6 bg-gray-50">
              <div className="rounded-2xl bg-white p-3 shadow-inner" dangerouslySetInnerHTML={{ __html: buildPurchaseEmailHtml(purchaseEmailPreview) }} />
            </div>
            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-black/10 bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => setPurchaseEmailPreview(null)}
                className="rounded-full border-2 border-primary/20 px-5 py-2.5 text-sm font-semibold text-primaryDark transition hover:bg-primary/5"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => { const o = purchaseEmailPreview; setPurchaseEmailPreview(null); if (o) sendPurchaseEmailToCustomer(o) }}
                disabled={purchaseEmailSending || !purchaseEmailPreview.customer?.email}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Send purchase email
              </button>
            </div>
          </div>
        </div>
      )}

      {expandedReader && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-fadeIn" onClick={() => setExpandedReader(null)}>
          <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-primaryDark">{expandedReader.childName}</h3>
                <p className="font-mono text-xs text-muted">{expandedReader.code}</p>
              </div>
              <button type="button" onClick={() => setExpandedReader(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-gray-100 hover:text-ink">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <span className={summerTierBadge(readerLevel(expandedReader))}>{readerLevel(expandedReader)}</span>
                {readerGoalMet(expandedReader) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Goal met
                  </span>
                )}
                <span className="text-xs text-muted">{readerValidBooksCount(expandedReader)} of {expandedReader.goal ?? LEVEL_GOAL[readerLevel(expandedReader)] ?? 3} valid book{(expandedReader.goal ?? LEVEL_GOAL[readerLevel(expandedReader)] ?? 3) === 1 ? '' : 's'} goal</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Child</p>
                  <p className="mt-1 text-sm font-medium text-ink">{expandedReader.childName}</p>
                  {expandedReader.childAge != null && <p className="text-sm text-muted">Age {expandedReader.childAge}</p>}
                  {expandedReader.dateOfBirth && <p className="text-sm text-muted">DOB {expandedReader.dateOfBirth}</p>}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Parent / Guardian</p>
                  <p className="mt-1 text-sm font-medium text-ink">{expandedReader.parentName}</p>
                  <p className="text-sm text-muted break-all">{expandedReader.parentEmail}</p>
                  {expandedReader.parentPhone && <p className="text-sm text-muted">{expandedReader.parentPhone}</p>}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Location</p>
                  {(expandedReader.city || expandedReader.state || expandedReader.country) ? (
                    <p className="mt-1 text-sm font-medium text-ink">
                      {[expandedReader.city, expandedReader.state, expandedReader.country].filter(Boolean).join(', ')}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted">Not provided</p>
                  )}
                  <p className="mt-1 text-xs">
                    {readerRaffleEligible(expandedReader)
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">Raffle eligible</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-500">Not raffle eligible</span>}
                    {typeof expandedReader.raffleEligibleOverride === 'boolean' && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700" title="Manually set by an admin">Admin override</span>
                    )}
                  </p>
                  {/* Admin override of raffle eligibility. */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReaderEligibilityOverride(expandedReader, true)}
                      disabled={eligibilityBusy}
                      className="rounded-full border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      Set eligible
                    </button>
                    <button
                      type="button"
                      onClick={() => setReaderEligibilityOverride(expandedReader, false)}
                      disabled={eligibilityBusy}
                      className="rounded-full border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Set not eligible
                    </button>
                    {typeof expandedReader.raffleEligibleOverride === 'boolean' && (
                      <button
                        type="button"
                        onClick={() => setReaderEligibilityOverride(expandedReader, null)}
                        disabled={eligibilityBusy}
                        className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                      >
                        Clear override
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Reading Level</p>
                  <p className="mt-1 text-sm font-medium capitalize text-ink">{readerLevel(expandedReader)}</p>
                  <p className="text-sm text-muted">Goal: {expandedReader.goal ?? LEVEL_GOAL[readerLevel(expandedReader)] ?? 3} books · {readerValidBooksCount(expandedReader)} valid{readerGoalMet(expandedReader) ? ' · goal met' : ''}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Registered</p>
                  <p className="mt-1 text-sm font-medium text-ink">
                    {expandedReader.createdAt?.seconds ? new Date(expandedReader.createdAt.seconds * 1000).toLocaleString() : '-'}
                  </p>
                  <p className="text-sm text-muted">Consent: {expandedReader.consent ? 'Given' : 'Not recorded'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Code</p>
                  <p className="mt-1 font-mono text-sm font-medium text-ink">{expandedReader.code}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Books Logged</p>
                  <p className="text-[11px] text-muted">{readerValidBooksCount(expandedReader)} valid · only valid books count</p>
                </div>
                {expandedReader.booksLogged && expandedReader.booksLogged.length > 0 ? (
                  <ul className="mt-2 space-y-3">
                    {expandedReader.booksLogged.map((b, idx) => {
                      const invalid = b.valid === false
                      return (
                      <li key={idx} className={`rounded-xl border p-3 transition ${invalid ? 'border-red-200 bg-red-50/60' : 'border-black/5 bg-gray-50'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className={invalid ? 'opacity-60' : ''}>
                            <p className="text-sm font-medium text-ink">{b.title}</p>
                            {b.author && <p className="text-xs text-muted">by {b.author}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {b.rating != null && (
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <svg key={n} className={`h-3.5 w-3.5 ${n <= (b.rating ?? 0) ? 'text-amber-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.366 2.446c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.098 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>
                                ))}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteReaderBook(expandedReader, idx)}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                              aria-label={`Delete logged book ${b.title}`}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                        {b.dateFinished && <p className={`mt-1 text-xs text-muted ${invalid ? 'opacity-60' : ''}`}>Finished {b.dateFinished}</p>}
                        {b.review && <p className={`mt-2 text-sm text-ink ${invalid ? 'opacity-60' : ''}`}>{b.review}</p>}
                        {/* Admin silent review: toggle whether this book counts. */}
                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-black/5 pt-2.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${invalid ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {invalid ? 'Invalid, not counted' : 'Valid, counts'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReaderBookValidity(expandedReader, idx, invalid)}
                            disabled={bookValidityBusy === idx}
                            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition disabled:opacity-50 ${invalid ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-red-200 text-red-700 hover:bg-red-50'}`}
                          >
                            {bookValidityBusy === idx ? 'Saving…' : invalid ? 'Mark valid' : 'Mark invalid'}
                          </button>
                        </div>
                      </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">No books logged yet.</p>
                )}
              </div>

              <div className="space-y-3 border-t border-black/5 pt-4">
                <button
                  type="button"
                  onClick={() => resendReaderWelcome(expandedReader)}
                  disabled={welcomeSending || !expandedReader.parentEmail}
                  className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary/30 bg-white px-6 py-3 text-sm font-semibold text-primaryDark transition-all hover:bg-primary/5 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {welcomeSending ? (
                    <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending…</>
                  ) : welcomeSent === expandedReader.id ? (
                    <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Welcome email sent</>
                  ) : (
                    <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>Resend welcome email</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => deleteReaderRegistration(expandedReader)}
                  className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-red-200 bg-white px-6 py-3 text-sm font-semibold text-red-700 transition-all hover:bg-red-50 hover:-translate-y-0.5"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete registration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summer Reads reminder broadcast: preview + send to all registered parents */}
      {reminderOpen && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-fadeIn" onClick={() => !reminderSending && setReminderOpen(false)}>
          <div className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-primaryDark">Reminder email</h3>
                <p className="text-xs text-muted">Broadcast to every registered parent · {summerReaders.length} registration{summerReaders.length === 1 ? '' : 's'}</p>
              </div>
              <button type="button" onClick={() => !reminderSending && setReminderOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-gray-100 hover:text-ink">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                This sends one email to each unique parent email on file. Recipients are gathered on the server, so each parent sees only their own address.
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Preview</p>
                <div className="rounded-2xl border border-black/10 bg-gray-50 p-3">
                  <div className="overflow-hidden rounded-xl bg-white" dangerouslySetInnerHTML={{ __html: buildReminderEmailHtml() }} />
                </div>
              </div>
              {/* Test send: preview the exact email in a real inbox first. */}
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Send a test first</p>
                <p className="mt-0.5 text-xs text-muted">Send this exact email to one address to check how it looks. Registered parents are not contacted.</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={reminderTestEmail}
                    onChange={(e) => setReminderTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="flex-1 rounded-full border border-primary/20 bg-white px-4 py-2 text-sm text-ink outline-none focus:border-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => sendReminder({ testEmail: reminderTestEmail.trim() })}
                    disabled={reminderTestSending || reminderSending || !reminderTestEmail.trim()}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-primary/30 bg-white px-5 py-2 text-sm font-bold text-primaryDark transition hover:bg-primary/5 disabled:opacity-50"
                  >
                    {reminderTestSending ? (
                      <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending…</>
                    ) : 'Send test'}
                  </button>
                </div>
              </div>
              {reminderResult && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {reminderResult.test
                    ? <>Test email sent to <strong>{reminderTestEmail.trim()}</strong>{reminderResult.failed > 0 && <span className="text-red-700">, but it failed to send</span>}. Check the inbox, then send the broadcast below.</>
                    : <>Sent to {reminderResult.sent} of {reminderResult.recipients} parent{reminderResult.recipients === 1 ? '' : 's'}{reminderResult.failed > 0 && <span className="text-red-700"> · {reminderResult.failed} failed</span>}.</>}
                </div>
              )}
              <div className="flex flex-col-reverse gap-3 border-t border-black/5 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setReminderOpen(false)}
                  disabled={reminderSending || reminderTestSending}
                  className="rounded-full border-2 border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:bg-gray-50 disabled:opacity-60"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => sendReminder()}
                  disabled={reminderSending || reminderTestSending || summerReaders.length === 0}
                  className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-bold text-white shadow transition hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {reminderSending ? (
                    <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending…</>
                  ) : (
                    <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>{reminderResult && !reminderResult.test ? 'Send again' : `Send to all ${summerReaders.length}`}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
