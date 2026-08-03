'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../lib/firebase'
import { directDownloadUrl, isPlausibleEmail, type Freebie } from '../../lib/freebies'
import { trackFreebieUnlock, trackSubscribe } from '../../lib/analytics'
import { SiteHeader } from '../components/SiteChrome'
import { SiteFooterFull } from '../components/SiteFooterFull'

/** The card shape the page receives: everything except the download link. */
type PublicFreebie = Omit<Freebie, 'fileUrl'>

type Reveal = {
  status: 'subscribed' | 'already-subscribed'
  downloadUrl: string
  title: string
}

/** Remembers the email so a returning visitor is not asked again. */
const EMAIL_KEY = 'eduvate-subscriber-email'

function SubscribeModal({
  freebie,
  onClose
}: {
  freebie: PublicFreebie
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reveal, setReveal] = useState<Reveal | null>(null)

  // Prefill from a previous download so a repeat visitor just presses the
  // button. They are still recorded, and still told they already subscribed.
  useEffect(() => {
    try {
      setEmail(localStorage.getItem(EMAIL_KEY) || '')
    } catch {
      /* private mode */
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!isPlausibleEmail(value)) {
      setError('Please enter a valid email address.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const callable = httpsCallable<{ email: string; slug: string }, Reveal>(
        functions,
        'getFreebieDownload'
      )
      const { data } = await callable({ email: value, slug: freebie.slug })
      try {
        localStorage.setItem(EMAIL_KEY, value)
      } catch {
        /* private mode */
      }
      trackFreebieUnlock(freebie.slug, freebie.title, data.status === 'subscribed')
      if (data.status === 'subscribed') trackSubscribe('freebie')
      setReveal(data)
    } catch (err) {
      console.error('Freebie download error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Download ${freebie.title}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-black/5"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {reveal ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-700">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <h2 className="mt-4 font-display text-xl font-bold text-primaryDark">
              {reveal.status === 'already-subscribed'
                ? 'You are already subscribed, thank you'
                : 'Thank you for subscribing'}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {reveal.status === 'already-subscribed'
                ? 'Here is your download, ready when you are.'
                : `${freebie.title} is ready to download.`}
            </p>
            <a
              href={directDownloadUrl(reveal.downloadUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Download {freebie.title}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-full border-2 border-primary/20 px-6 py-2.5 text-sm font-bold text-primaryDark transition hover:bg-primary/5"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 className="font-display text-xl font-bold text-primaryDark">
              Get {freebie.title}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Pop in your email and we will unlock the download. We send occasional book
              recommendations and never share your address.
            </p>

            <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-muted" htmlFor="freebie-email">
              Email address
            </label>
            <input
              id="freebie-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              placeholder="you@example.com"
              autoFocus
              required
              className="mt-2 w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
            />
            {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 w-full rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {busy ? 'Unlocking...' : 'Unlock the download'}
            </button>
            <p className="mt-3 text-center text-[11px] text-muted">
              Free, and you can unsubscribe any time.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

function FreebieCard({ freebie, onGet }: { freebie: PublicFreebie; onGet: () => void }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-primary/10 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/10 to-secondary/10">
        {freebie.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={freebie.coverImage}
            alt={freebie.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg className="h-14 w-14 text-primary/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primaryDark shadow">
          Free
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="font-display text-lg font-bold leading-snug text-primaryDark">{freebie.title}</h2>
        {freebie.description && <p className="mt-2 flex-1 text-sm text-muted">{freebie.description}</p>}
        {freebie.fileLabel && (
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {freebie.fileLabel}
          </p>
        )}
        <button
          type="button"
          onClick={onGet}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Get it free
        </button>
      </div>
    </article>
  )
}

export default function FreebiesPageClient({ freebies }: { freebies: PublicFreebie[] }) {
  const [active, setActive] = useState<PublicFreebie | null>(null)

  return (
    <div className="min-h-screen text-ink">
      <SiteHeader current="/freebies" />

      <main className="mx-auto w-11/12 max-w-6xl py-10 sm:py-14">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Freebies</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl gradient-text">Free for your family</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-muted">
            Printables, charts and activity sheets to use at home or in the classroom. Enter your
            email once and everything here is yours.
          </p>
        </div>

        {freebies.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {freebies.map((f) => (
              <FreebieCard key={f.id} freebie={f} onGet={() => setActive(f)} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 p-10 text-center">
            <p className="text-sm text-muted">
              We are putting together a set of free printables for you. Check back shortly.
            </p>
            <Link
              href="/catalog"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Browse the catalog
            </Link>
          </div>
        )}
      </main>

      <SiteFooterFull />

      {active && <SubscribeModal freebie={active} onClose={() => setActive(null)} />}
    </div>
  )
}
