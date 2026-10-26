'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../../../lib/firebase'
import { ADMIN_ALLOWED_HOSTS, isAdminHostAllowed } from '../../../lib/adminAccess'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import bg4 from '../../../assets/bg4.png'
import logo from '../../../assets/logo.png'

const CANONICAL_ADMIN_HOST = ADMIN_ALLOWED_HOSTS[0]

/** Turn a Firebase Auth error into something staff can act on. */
const friendlyAuthError = (err: unknown): string => {
  const code = (err as { code?: string } | null)?.code ?? ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Email or password is incorrect.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.'
    case 'auth/network-request-failed':
      return 'No internet connection.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact an admin.'
    default:
      return 'Could not sign in. Please try again.'
  }
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [hostBlocked, setHostBlocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setHostBlocked(false)

    // Admin backend is only permitted from the canonical host.
    if (!isAdminHostAllowed()) {
      setHostBlocked(true)
      setError(`Staff sign-in only works at ${CANONICAL_ADMIN_HOST}.`)
      return
    }

    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(friendlyAuthError(err))
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
      <main className="relative z-10 mx-auto flex min-h-screen w-11/12 max-w-5xl items-center justify-center py-6 sm:py-16">
        <div className="animate-fadeIn grid w-full gap-6 sm:gap-10 rounded-3xl bg-white p-5 sm:p-10 shadow-soft md:grid-cols-[1.1fr_0.9fr]">
          <Link className="flex items-center gap-3 md:col-span-2 transition-all duration-300 hover:-translate-y-0.5" href="/">
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
          {/* Marketing copy sits below the form on phones so the form is reachable without scrolling. */}
          <section className="order-last md:order-none">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
              Admin Portal
            </p>
            <h1 className="mt-4 font-display text-2xl sm:text-3xl">Sign in to Eduvate Kids</h1>
            <p className="mt-3 text-muted">
              Access inventory, event sales, and POS dashboards. Secure admin
              access for the Eduvate Kids management team.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Inventory control and pricing tiers.',
                'Event-based sales and profitability.',
                'Low stock alerts and best sellers.'
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-primary/10 bg-cream p-6">
            <form className="grid gap-4 text-sm" onSubmit={handleLogin}>
              {error && (
                <div className="animate-slideDown flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>
                    {error}
                    {hostBlocked && (
                      <>
                        {' '}
                        <a
                          className="font-semibold underline"
                          href={`https://${CANONICAL_ADMIN_HOST}/auth/login`}
                        >
                          Go to {CANONICAL_ADMIN_HOST}
                        </a>
                      </>
                    )}
                  </span>
                </div>
              )}
              <label className="grid gap-1 font-semibold">
                Email
                <input
                  className="rounded-xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
                  type="email"
                  name="email"
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
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
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 pr-12 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:text-primary"
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
                className="btn-shine flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                    </svg>
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
