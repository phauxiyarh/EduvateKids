'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { doc, getDoc } from 'firebase/firestore'
import { functions, db } from '../../../lib/firebase'
import { EventNavDropdown } from '../../components/EventNavDropdown'
import { HeaderCart } from '../../components/HeaderCart'
import { OPEN_COOKIE_PREFS } from '../../components/CookieConsent'
import { SummerCelebration } from '../../components/SummerCelebration'
import logo from '../../../assets/logo.png'

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30'

type Level = 'none' | 'seedling' | 'reader' | 'scholar'

type LoggedBook = {
  title: string
  author?: string
  rating?: number
  review?: string
  dateFinished?: string
  dateLogged?: string
}

type ChildDoc = {
  code: string
  childName: string
  dateOfBirth?: string
  childAge?: number
  parentName?: string
  booksCount: number
  level: Level
  goal: number
  goalMet: boolean
  booksLogged: LoggedBook[]
}

const LEVEL_LABELS: Record<Level, string> = {
  none: 'Growing Readers',
  seedling: 'Early Readers',
  reader: 'Growing Readers',
  scholar: 'Confident Readers',
}

const LEVEL_GOALS: Record<Exclude<Level, 'none'>, number> = { seedling: 4, reader: 6, scholar: 10 }

/**
 * The chosen level is FIXED. Older docs may only carry a legacy `tier`; fall
 * back to it, then to seedling. The goal is that level's book target — it never
 * changes based on how many books are logged.
 */
function resolveLevel(data: Partial<ChildDoc> & { tier?: Level }): Exclude<Level, 'none'> {
  const raw = (data.level ?? data.tier) as Level | undefined
  if (raw === 'scholar' || raw === 'reader' || raw === 'seedling') return raw
  return 'seedling'
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function Stars({ value }: { value?: number }) {
  const n = value || 0
  return (
    <span className="inline-flex" aria-label={n ? `${n} out of 5 stars` : 'No rating'}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`h-4 w-4 ${s <= n ? 'text-amber-400' : 'text-black/15'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.35 4.16a1 1 0 00.95.69h4.37c.97 0 1.37 1.24.59 1.81l-3.54 2.57a1 1 0 00-.36 1.12l1.35 4.16c.3.92-.75 1.68-1.54 1.11l-3.53-2.57a1 1 0 00-1.18 0l-3.53 2.57c-.79.57-1.84-.19-1.54-1.11l1.35-4.16a1 1 0 00-.36-1.12L1.44 9.6c-.78-.57-.38-1.81.59-1.81h4.37a1 1 0 00.95-.69L9.05 2.93z" />
        </svg>
      ))}
    </span>
  )
}

export default function SummerLogPage() {
  // STATE 1: code lookup
  const [codeInput, setCodeInput] = useState('')
  const [looking, setLooking] = useState(false)
  const [lookupError, setLookupError] = useState('')

  // STATE 2: loaded child
  const [child, setChild] = useState<ChildDoc | null>(null)
  const [booksCount, setBooksCount] = useState(0)
  const [level, setLevel] = useState<Level>('seedling')
  const [goal, setGoal] = useState(3)
  const [booksLogged, setBooksLogged] = useState<LoggedBook[]>([])

  // Log form
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [review, setReview] = useState('')
  const [dateFinished, setDateFinished] = useState(todayStr())
  const [parentVerified, setParentVerified] = useState(false)
  const [parentEmailInput, setParentEmailInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Celebration (shown when the child reaches their chosen goal)
  const [celebrateGoal, setCelebrateGoal] = useState<string | null>(null)

  // Edit / delete state
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editRating, setEditRating] = useState(0)
  const [editHoverRating, setEditHoverRating] = useState(0)
  const [editReview, setEditReview] = useState('')
  const [editDateFinished, setEditDateFinished] = useState(todayStr())
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null)

  const code = child?.code || ''

  const startEdit = (i: number, b: LoggedBook) => {
    setConfirmDeleteIndex(null)
    setEditError('')
    setEditingIndex(i)
    setEditTitle(b.title)
    setEditAuthor(b.author || '')
    setEditRating(b.rating || 0)
    setEditHoverRating(0)
    setEditReview(b.review || '')
    setEditDateFinished(b.dateFinished || todayStr())
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setEditError('')
  }

  const saveEdit = async (index: number) => {
    setEditError('')
    if (!editTitle.trim() || !code) return
    setSavingEdit(true)
    try {
      const call = httpsCallable(functions, 'editSummerBook')
      const res = await call({
        code,
        parentEmail: parentEmailInput.trim(),
        index,
        title: editTitle.trim(),
        author: editAuthor.trim(),
        rating: editRating,
        review: editReview.trim(),
        dateFinished: editDateFinished,
      })
      const result = res.data as { booksCount: number; level: Level; goal: number; goalMet: boolean }
      setBooksLogged((prev) => prev.map((b, i) => (
        i === index
          ? {
              ...b,
              title: editTitle.trim(),
              author: editAuthor.trim() || undefined,
              rating: editRating || undefined,
              review: editReview.trim() || undefined,
              dateFinished: editDateFinished,
            }
          : b
      )))
      setBooksCount(result.booksCount)
      setEditingIndex(null)
    } catch (err) {
      setEditError((err as { message?: string })?.message || 'Could not save changes. Please try again.')
    } finally {
      setSavingEdit(false)
    }
  }

  const deleteBook = async (index: number) => {
    setEditError('')
    if (!code) return
    setDeletingIndex(index)
    try {
      const call = httpsCallable(functions, 'deleteSummerBook')
      const res = await call({ code, index, parentEmail: parentEmailInput.trim() })
      const result = res.data as { booksCount: number; level: Level; goal: number; goalMet: boolean }
      setBooksLogged((prev) => prev.filter((_, i) => i !== index))
      setBooksCount(result.booksCount)
      setConfirmDeleteIndex(null)
      if (editingIndex === index) setEditingIndex(null)
    } catch (err) {
      setEditError((err as { message?: string })?.message || 'Could not delete the book. Please try again.')
    } finally {
      setDeletingIndex(null)
    }
  }

  const findProgress = async (e: React.FormEvent) => {
    e.preventDefault()
    setLookupError('')
    const c = codeInput.trim().toUpperCase()
    if (!c) return
    setLooking(true)
    try {
      const snap = await getDoc(doc(db, 'summerReads', c))
      if (!snap.exists()) {
        setLookupError('Code not found. Check the code and try again.')
        return
      }
      const data = snap.data() as Partial<ChildDoc> & { tier?: Level }
      const lvl = resolveLevel(data)
      const g = typeof data.goal === 'number' ? data.goal : LEVEL_GOALS[lvl]
      const count = data.booksCount || 0
      const loaded: ChildDoc = {
        code: data.code || c,
        childName: data.childName || 'Reader',
        dateOfBirth: data.dateOfBirth,
        childAge: data.childAge,
        parentName: data.parentName,
        booksCount: count,
        level: lvl,
        goal: g,
        goalMet: typeof data.goalMet === 'boolean' ? data.goalMet : count >= g,
        booksLogged: Array.isArray(data.booksLogged) ? data.booksLogged : [],
      }
      setChild(loaded)
      setBooksCount(loaded.booksCount)
      setLevel(loaded.level)
      setGoal(loaded.goal)
      setBooksLogged(loaded.booksLogged)
    } catch {
      setLookupError('Something went wrong. Please try again.')
    } finally {
      setLooking(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setAuthor('')
    setRating(0)
    setHoverRating(0)
    setReview('')
    setDateFinished(todayStr())
    setParentVerified(false)
  }

  const submitBook = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!title.trim() || !parentVerified || !code) return
    if (!parentEmailInput.trim()) { setFormError('Enter the parent email used at registration to verify this is your child.'); return }
    setSubmitting(true)
    try {
      const call = httpsCallable(functions, 'logSummerBook')
      const res = await call({
        code,
        parentEmail: parentEmailInput.trim(),
        title: title.trim(),
        author: author.trim(),
        rating,
        review: review.trim(),
        dateFinished,
        parentVerified: true,
      })
      const result = res.data as { booksCount: number; level: Level; goal: number; goalMet: boolean; goalJustMet?: boolean }

      const newEntry: LoggedBook = {
        title: title.trim(),
        author: author.trim() || undefined,
        rating: rating || undefined,
        review: review.trim() || undefined,
        dateFinished,
        dateLogged: todayStr(),
      }
      setBooksLogged((prev) => [newEntry, ...prev])
      setBooksCount(result.booksCount)
      resetForm()

      // Celebrate the moment they reach their chosen goal (not a promotion).
      // The SummerCelebration overlay auto-dismisses itself via onDone.
      if (result.goalJustMet) {
        setCelebrateGoal(LEVEL_LABELS[result.level] || level)
      }
    } catch (err) {
      setFormError((err as { message?: string })?.message || 'Could not log the book. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Progress ring geometry — always relative to THIS reader's chosen goal.
  const R = 52
  const CIRC = 2 * Math.PI * R
  const progress = goal > 0 ? Math.min(booksCount / goal, 1) : 0
  const dashOffset = CIRC * (1 - progress)
  const reachedGoal = booksCount >= goal
  const booksToGoal = Math.max(0, goal - booksCount)
  const bonusBooks = Math.max(0, booksCount - goal)
  const levelLabel = LEVEL_LABELS[level]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/60 via-white to-emerald-50/60 text-ink">
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)]">
        <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-xl" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between py-3">
          <Link href="/summer-reads" className="flex items-center gap-2">
            <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="font-display text-base sm:text-lg font-bold">Summer Reads</span>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-2 md:flex">
            <Link href="/" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 ease-out hover:bg-primary/10 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(124,58,237,0.14)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /></svg>
              <span>Home</span>
            </Link>
            <Link href="/catalog" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 ease-out hover:bg-primary/10 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(124,58,237,0.14)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <span>Our Catalog</span>
            </Link>
            <EventNavDropdown active />
            <Link href="/contact-us" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 ease-out hover:bg-primary/10 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(124,58,237,0.14)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /></svg>
              <span>Contact</span>
            </Link>
            <Link href="/faqs" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 ease-out hover:bg-primary/10 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(124,58,237,0.14)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>FAQs</span>
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <HeaderCart />
          </div>
        </div>
      </header>

      <main className="mx-auto w-11/12 max-w-2xl py-10 sm:py-14">
        {!child ? (
          /* ---------- STATE 1: enter code ---------- */
          <div className="mx-auto max-w-lg">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Summer Reads 2026</p>
              <h1 className="mt-3 font-display text-2xl sm:text-3xl">Log a Book</h1>
              <p className="mt-2 text-sm text-muted">Enter your reading code to see your progress and log a book.</p>
            </div>
            <form onSubmit={findProgress} className="mt-8 rounded-3xl border border-primary/10 bg-white p-6 shadow-soft sm:p-8">
              {lookupError && (
                <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 animate-slideDown">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
                  <span>{lookupError}</span>
                </div>
              )}
              <label className="grid gap-1.5 text-sm font-semibold" htmlFor="code">Reading Code
                <input
                  id="code"
                  className={`${inputClass} text-center font-display text-lg font-bold uppercase tracking-widest`}
                  placeholder="EK-XXXX"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  autoComplete="off"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={!codeInput.trim() || looking}
                className="btn-shine mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {looking ? (
                  <><svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Finding…</>
                ) : 'Find my progress'}
              </button>
              <p className="mt-4 text-center text-xs text-muted">
                No code yet? <Link href="/summer-reads/register" className="font-semibold text-primaryDark hover:underline">Register your child</Link>.
              </p>
            </form>
          </div>
        ) : (
          /* ---------- STATE 2: progress + log form ---------- */
          <div className="animate-fadeIn">
            {/* Animated full-screen celebration — fires for ANY level's goal. */}
            {celebrateGoal && (
              <SummerCelebration label={celebrateGoal} onDone={() => setCelebrateGoal(null)} />
            )}

            {/* Progress card */}
            <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-soft sm:p-8">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
                <div className="relative flex h-36 w-36 flex-shrink-0 items-center justify-center">
                  <div className="pointer-events-none absolute inset-2 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-xl" aria-hidden="true" />
                  <svg className="relative h-36 w-36 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                    <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeWidth="10" className="text-primary/10" />
                    <circle
                      cx="60"
                      cy="60"
                      r={R}
                      fill="none"
                      stroke="url(#ringGrad)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={CIRC}
                      strokeDashoffset={dashOffset}
                      filter="url(#ringGlow)"
                      style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                    />
                    <defs>
                      <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="55%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                      <filter id="ringGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="2.4" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span key={booksCount} className="animate-fadeIn font-display text-4xl font-bold text-primaryDark">{booksCount}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">books</span>
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Reading with code {code}</p>
                  <h1 className="mt-1 font-display text-2xl">{child.childName}</h1>
                  <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted sm:justify-start">
                    <span>Level: <span className="font-semibold text-primaryDark">{levelLabel}</span> · Goal: <span className="font-semibold text-primaryDark">{goal} books</span></span>
                    {reachedGoal && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Goal achieved
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {reachedGoal
                      ? bonusBooks > 0
                        ? <>You&apos;ve read <span className="font-semibold text-primaryDark">{bonusBooks}</span> bonus {bonusBooks === 1 ? 'book' : 'books'} beyond your goal — mashaAllah! Keep going.</>
                        : <>You reached your goal — mashaAllah! Every extra book you log is a bonus.</>
                      : <>Read <span className="font-semibold text-primaryDark">{booksToGoal}</span> more to reach your <span className="font-semibold text-primaryDark">{levelLabel}</span> goal.</>}
                  </p>
                </div>
              </div>
            </section>

            {/* Log form */}
            <form onSubmit={submitBook} className="mt-8 rounded-3xl border border-primary/10 bg-white p-6 shadow-soft sm:p-8">
              <h2 className="font-display text-xl">Log a Book</h2>
              <p className="mt-1 text-sm text-muted">Tell us about a book {child.childName} finished.</p>

              {formError && (
                <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 animate-slideDown">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
                  <span>{formError}</span>
                </div>
              )}

              <div className="mt-6 grid gap-4">
                <label className="grid gap-1.5 text-sm font-semibold" htmlFor="title">Book Title *
                  <input id="title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold" htmlFor="author">Author
                  <input id="author" className={inputClass} value={author} onChange={(e) => setAuthor(e.target.value)} />
                </label>

                <div className="grid gap-1.5 text-sm font-semibold">
                  <span>Rating</span>
                  <div className="flex items-center gap-1" role="radiogroup" aria-label="Book rating out of 5 stars">
                    {[1, 2, 3, 4, 5].map((s) => {
                      const active = s <= (hoverRating || rating)
                      return (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={rating === s}
                          aria-label={`${s} star${s > 1 ? 's' : ''}`}
                          onClick={() => setRating(s === rating ? 0 : s)}
                          onMouseEnter={() => setHoverRating(s)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="rounded-full p-1 outline-none transition focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <svg className={`h-7 w-7 transition-colors ${active ? 'text-amber-400' : 'text-black/15'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.35 4.16a1 1 0 00.95.69h4.37c.97 0 1.37 1.24.59 1.81l-3.54 2.57a1 1 0 00-.36 1.12l1.35 4.16c.3.92-.75 1.68-1.54 1.11l-3.53-2.57a1 1 0 00-1.18 0l-3.53 2.57c-.79.57-1.84-.19-1.54-1.11l1.35-4.16a1 1 0 00-.36-1.12L1.44 9.6c-.78-.57-.38-1.81.59-1.81h4.37a1 1 0 00.95-.69L9.05 2.93z" />
                          </svg>
                        </button>
                      )
                    })}
                    {rating > 0 && <span className="ml-2 text-xs font-normal text-muted">{rating}/5</span>}
                  </div>
                </div>

                <label className="grid gap-1.5 text-sm font-semibold" htmlFor="review">Short Review
                  <textarea id="review" rows={3} maxLength={500} className={`${inputClass} resize-none`} value={review} onChange={(e) => setReview(e.target.value)} placeholder="What did you think of it?" />
                  <span className="text-right text-xs font-normal text-muted">{review.length}/500</span>
                </label>

                <label className="grid gap-1.5 text-sm font-semibold" htmlFor="dateFinished">Date Finished
                  <input id="dateFinished" type="date" className={inputClass} value={dateFinished} max={todayStr()} onChange={(e) => setDateFinished(e.target.value)} />
                </label>

                <label className="grid gap-1.5 text-sm font-semibold" htmlFor="parentEmail">Parent email (verification)
                  <input id="parentEmail" type="email" className={inputClass} value={parentEmailInput} placeholder="The email used when you registered" onChange={(e) => setParentEmailInput(e.target.value)} required />
                  <span className="text-xs font-normal text-muted">Used to confirm this is your child&apos;s record before saving.</span>
                </label>

                <label className="flex items-start gap-2.5 text-sm text-muted">
                  <input type="checkbox" checked={parentVerified} onChange={(e) => setParentVerified(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-black/20 text-primary focus:ring-primary/30" required />
                  <span>Parent verified this book was fully read.</span>
                </label>

                <button
                  type="submit"
                  disabled={!title.trim() || !parentVerified || !parentEmailInput.trim() || submitting}
                  className="btn-shine mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {submitting ? (
                    <><svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Logging…</>
                  ) : 'Log this book'}
                </button>
              </div>
            </form>

            {/* Books logged history - book shelf */}
            <section className="mt-8">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl">Your bookshelf</h2>
                {booksLogged.length > 0 && (
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">{booksLogged.length} on the shelf</span>
                )}
              </div>

              {editError && editingIndex === null && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 animate-slideDown">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
                  <span>{editError}</span>
                </div>
              )}

              {booksLogged.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-primary/20 bg-white/60 p-6 text-center text-sm text-muted">
                  No books logged yet. Log your first one above!
                </p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {booksLogged.map((b, i) => {
                    const isEditing = editingIndex === i
                    const isDeleting = deletingIndex === i
                    const isConfirming = confirmDeleteIndex === i
                    return (
                      <li
                        key={`${b.title}-${b.dateLogged ?? ''}-${i}`}
                        className="animate-fadeIn group relative overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        {/* book-spine accent */}
                        <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-primary via-secondary to-accentThree" aria-hidden="true" />

                        {isEditing ? (
                          <div className="p-4 pl-5">
                            {editError && (
                              <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 animate-slideDown">
                                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
                                <span>{editError}</span>
                              </div>
                            )}
                            <div className="grid gap-3">
                              <label className="grid gap-1.5 text-sm font-semibold">Book Title *
                                <input className={inputClass} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                              </label>
                              <label className="grid gap-1.5 text-sm font-semibold">Author
                                <input className={inputClass} value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} />
                              </label>
                              <div className="grid gap-1.5 text-sm font-semibold">
                                <span>Rating</span>
                                <div className="flex items-center gap-1" role="radiogroup" aria-label="Book rating out of 5 stars">
                                  {[1, 2, 3, 4, 5].map((s) => {
                                    const active = s <= (editHoverRating || editRating)
                                    return (
                                      <button
                                        key={s}
                                        type="button"
                                        role="radio"
                                        aria-checked={editRating === s}
                                        aria-label={`${s} star${s > 1 ? 's' : ''}`}
                                        onClick={() => setEditRating(s === editRating ? 0 : s)}
                                        onMouseEnter={() => setEditHoverRating(s)}
                                        onMouseLeave={() => setEditHoverRating(0)}
                                        className="rounded-full p-1 outline-none transition focus-visible:ring-2 focus-visible:ring-primary/40"
                                      >
                                        <svg className={`h-6 w-6 transition-colors ${active ? 'text-amber-400' : 'text-black/15'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                          <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.35 4.16a1 1 0 00.95.69h4.37c.97 0 1.37 1.24.59 1.81l-3.54 2.57a1 1 0 00-.36 1.12l1.35 4.16c.3.92-.75 1.68-1.54 1.11l-3.53-2.57a1 1 0 00-1.18 0l-3.53 2.57c-.79.57-1.84-.19-1.54-1.11l1.35-4.16a1 1 0 00-.36-1.12L1.44 9.6c-.78-.57-.38-1.81.59-1.81h4.37a1 1 0 00.95-.69L9.05 2.93z" />
                                        </svg>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                              <label className="grid gap-1.5 text-sm font-semibold">Short Review
                                <textarea rows={3} maxLength={500} className={`${inputClass} resize-none`} value={editReview} onChange={(e) => setEditReview(e.target.value)} />
                              </label>
                              <label className="grid gap-1.5 text-sm font-semibold">Date Finished
                                <input type="date" className={inputClass} value={editDateFinished} max={todayStr()} onChange={(e) => setEditDateFinished(e.target.value)} />
                              </label>
                              <div className="mt-1 flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(i)}
                                  disabled={!editTitle.trim() || savingEdit}
                                  className="btn-shine flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                                >
                                  {savingEdit ? (
                                    <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</>
                                  ) : 'Save changes'}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={savingEdit}
                                  className="rounded-full border border-primary/25 bg-white px-5 py-2.5 text-sm font-semibold text-primaryDark transition hover:border-primary/40 disabled:opacity-60"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3 p-4 pl-5">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-ink">{b.title}</p>
                              {b.author && <p className="truncate text-sm text-muted">by {b.author}</p>}
                              <div className="mt-1.5"><Stars value={b.rating} /></div>
                              {b.review && <p className="mt-2 line-clamp-3 text-sm text-muted">{b.review}</p>}
                              {b.dateFinished && (
                                <p className="mt-2 text-xs font-medium text-muted">Finished {b.dateFinished}</p>
                              )}
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                aria-label={`Edit ${b.title}`}
                                onClick={() => startEdit(i, b)}
                                disabled={isDeleting}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 text-primaryDark transition hover:bg-primary/5 disabled:opacity-50"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${b.title}`}
                                onClick={() => setConfirmDeleteIndex(i)}
                                disabled={isDeleting}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                              >
                                {isDeleting ? (
                                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                ) : (
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* inline delete confirm */}
                        {isConfirming && !isEditing && (
                          <div className="animate-slideDown flex flex-wrap items-center justify-between gap-3 border-t border-red-100 bg-red-50/70 px-4 py-3 pl-5">
                            <span className="text-sm font-medium text-red-700">Delete this book from the shelf?</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => deleteBook(i)}
                                disabled={isDeleting}
                                className="flex items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:opacity-60"
                              >
                                {isDeleting ? (
                                  <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Deleting...</>
                                ) : 'Delete'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteIndex(null)}
                                disabled={isDeleting}
                                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-black/5 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="relative overflow-hidden bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] py-10 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="mx-auto w-11/12 max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" className="flex items-center gap-3">
              <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} />
              <span className="flex flex-col leading-tight">
                <span className="font-display text-lg font-bold">Eduvate Kids</span>
                <span className="font-display text-xs font-semibold italic text-emerald-300">Rooted in Faith. Growing in Knowledge.</span>
              </span>
            </Link>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/70">
              <Link href="/" className="transition-colors hover:text-white">Home</Link>
              <Link href="/summer-reads/register" className="transition-colors hover:text-white">Register</Link>
              <Link href="/summer-reads/log" className="transition-colors hover:text-white">Log a Book</Link>
              <Link href="/catalog" className="transition-colors hover:text-white">Our Catalog</Link>
              <Link href="/accessibility" className="transition-colors hover:text-white">Accessibility</Link>
              <button type="button" onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_COOKIE_PREFS)) }} className="transition-colors hover:text-white">Cookie Preferences</button>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 border-t border-white/10 pt-6 text-center text-sm text-white/50 sm:flex-row">
            <p>© 2026 Eduvate Kids. All rights reserved.</p>
            <Link href="/auth/login" aria-label="Admin Login" className="group inline-flex items-center justify-center rounded-full p-1.5 text-white/30 transition-all duration-300 hover:bg-white/5 hover:text-white/80">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.418-3.03 7.79-7 9-3.97-1.21-7-4.582-7-9V7l7-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.75 1.75L15 10" />
              </svg>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
