'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../../lib/firebase'
import logo from '../../../assets/logo.png'
import { COUNTRIES, US_STATES, US_COUNTRY } from '../../../lib/geo'

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30'

function computeAge(dob: string): number | null {
  if (!dob) return null
  const b = new Date(dob)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age >= 0 && age < 120 ? age : null
}

export default function SummerRegisterPage() {
  const [form, setForm] = useState({ childName: '', dateOfBirth: '', parentName: '', parentEmail: '', parentPhone: '', country: '', state: '', city: '', consent: false })
  const childAge = computeAge(form.dateOfBirth)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)

  const isUS = form.country === US_COUNTRY
  const canSubmit = form.childName.trim() && form.dateOfBirth && form.parentName.trim() && form.parentEmail.trim() && form.country && (!isUS || form.state) && form.consent

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const call = httpsCallable(functions, 'registerSummerReader')
      const res = await call({ ...form, childAge })
      setCode((res.data as { code: string }).code)
    } catch (err) {
      setError((err as { message?: string })?.message || 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/60 via-white to-emerald-50/60 text-ink">
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)] backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between py-3">
          <Link href="/summer-reads" className="flex items-center gap-2">
            <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="font-display text-base sm:text-lg font-bold">Summer Reads</span>
          </Link>
          <Link href="/summer-reads/log" className="text-sm font-semibold text-muted transition hover:text-primaryDark">Log a Book</Link>
        </div>
      </header>

      <main className="mx-auto w-11/12 max-w-lg py-10 sm:py-14">
        {code ? (
          <div className="animate-fadeIn rounded-3xl bg-white p-6 sm:p-8 shadow-soft border border-emerald-200 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h1 className="mt-5 font-display text-2xl gradient-text">You&apos;re registered!</h1>
            <p className="mt-2 text-sm text-muted">Save this code. You&apos;ll need it every time you log a book.</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-3 font-display text-2xl font-bold tracking-widest text-primaryDark">{code}</span>
              <button type="button" onClick={copyCode} aria-label="Copy code" className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 text-primaryDark transition hover:bg-primary/5">
                {copied ? (
                  <svg className="h-5 w-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                )}
              </button>
            </div>
            {copied && <p className="mt-2 text-xs font-semibold text-emerald-600">Copied!</p>}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/summer-reads/log" className="btn-shine rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5">Log your first book</Link>
              <Link href="/catalog" className="rounded-full border border-primary/25 bg-white px-6 py-3 text-sm font-semibold text-primaryDark transition hover:-translate-y-0.5 hover:border-primary/40">Browse books</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Summer Reads 2026</p>
              <h1 className="mt-3 font-display text-2xl sm:text-3xl">Register Your Child</h1>
              <p className="mt-2 text-sm text-muted">One minute to sign up and you&apos;ll get a unique reading code.</p>
            </div>
            <form onSubmit={submit} className="mt-8 rounded-3xl bg-white p-6 sm:p-8 shadow-soft border border-primary/10">
              {error && (
                <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 animate-slideDown">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
                  <span>{error}</span>
                </div>
              )}
              <div className="grid gap-4">
                <label className="grid gap-1.5 text-sm font-semibold">Child&apos;s Name *
                  <input className={inputClass} value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} required />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">Date of Birth *
                  <input type="date" className={inputClass} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} required max={new Date().toISOString().split('T')[0]} />
                  {childAge !== null && <span className="text-xs font-normal text-primaryDark">Age: {childAge} years</span>}
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">Parent/Guardian Name *
                  <input className={inputClass} value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} required />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">Parent Email *
                  <input type="email" className={inputClass} value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} required />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">Parent Phone
                  <input type="tel" className={inputClass} value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">Country *
                  <select
                    className={inputClass}
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value, state: '' })}
                    required
                  >
                    <option value="">Select a country</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                {isUS ? (
                  <label className="grid gap-1.5 text-sm font-semibold">State *
                    <select
                      className={inputClass}
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      required
                    >
                      <option value="">Select a state</option>
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="grid gap-1.5 text-sm font-semibold">State / Province
                    <input className={inputClass} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                  </label>
                )}
                <label className="grid gap-1.5 text-sm font-semibold">City
                  <input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </label>
                <label className="flex items-start gap-2.5 text-sm text-muted">
                  <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-black/20 text-primary focus:ring-primary/30" required />
                  <span>I consent to registering my child for the Summer Reads program and confirm the information is accurate.</span>
                </label>
                <button type="submit" disabled={!canSubmit || submitting} className="btn-shine mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
                  {submitting ? (
                    <><svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Registering…</>
                  ) : 'Get My Reading Code'}
                </button>
              </div>
            </form>
          </>
        )}
      </main>

      <footer className="relative overflow-hidden bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] py-10 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="mx-auto w-11/12 max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" className="flex items-center gap-3">
              <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} />
              <span className="font-display text-lg font-bold">Eduvate Kids</span>
            </Link>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/70">
              <Link href="/" className="transition-colors hover:text-white">Home</Link>
              <Link href="/summer-reads/register" className="transition-colors hover:text-white">Register</Link>
              <Link href="/summer-reads/log" className="transition-colors hover:text-white">Log a Book</Link>
              <Link href="/catalog" className="transition-colors hover:text-white">Our Products</Link>
            </div>
          </div>
          <div className="mt-8 flex justify-center">
            <Link href="/auth/login" aria-label="Admin Login" className="group inline-flex items-center justify-center rounded-full p-2 text-white/30 transition-all duration-300 hover:bg-white/5 hover:text-white/80">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.418-3.03 7.79-7 9-3.97-1.21-7-4.582-7-9V7l7-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.75 1.75L15 10" />
              </svg>
            </Link>
          </div>
          <div className="mt-6 border-t border-white/10 pt-6 text-center text-sm text-white/50">
            <p>© 2026 Eduvate Kids. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
