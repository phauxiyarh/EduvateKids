'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../../../lib/firebase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import bg4 from '../../../assets/bg4.png'
import logo from '../../../assets/logo.png'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen text-ink">
      <div
        className="hero-svg-bg absolute inset-0 opacity-45"
        style={{
          backgroundImage: `url(${bg4.src})`,
          backgroundSize: '75% auto',
          backgroundRepeat: 'repeat'
        }}
      />
      <main className="relative z-10 mx-auto flex min-h-screen w-11/12 max-w-5xl items-center justify-center py-16">
        <div className="grid w-full gap-10 rounded-3xl bg-white p-10 shadow-soft md:grid-cols-[1.1fr_0.9fr]">
          <Link className="flex items-center gap-3 md:col-span-2" href="/">
            <Image
              src={logo}
              alt="Eduvate Kids logo"
              width={32}
              height={32}
            />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Back to home</p>
              <p className="font-display text-lg text-primaryDark">Eduvate Kids</p>
            </div>
          </Link>
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
              Admin Portal
            </p>
            <h1 className="mt-4 font-display text-3xl">Sign in to Eduvate Kids</h1>
            <p className="mt-3 text-muted">
              Access inventory, event sales, and POS dashboards. This is a
              static demo login screen; hook into NextAuth for production.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Inventory control and pricing tiers.',
                'Event-based sales and profitability.',
                'Low stock alerts and best sellers.'
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-primary">✦</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-primary/10 bg-cream p-6">
            <form className="grid gap-4 text-sm" onSubmit={handleLogin}>
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                  {error}
                </div>
              )}
              <label className="grid gap-1 font-semibold">
                Email
                <input
                  className="rounded-xl border border-black/10 bg-white px-4 py-3"
                  type="email"
                  placeholder="admin@eduvatekids.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="grid gap-1 font-semibold">
                Password
                <div className="relative">
                  <input
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 pr-12"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primaryDark transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </label>
              <button
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 font-semibold text-white disabled:opacity-50"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
              
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
