'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import logo from '../../assets/logo.png'

/* --- Inline SVG icons (stroke, viewBox 0 0 24 24) --- */
function UserIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function CheckCircleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  )
}

function WarningTriangleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function GlobeIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  )
}

function InfoIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function SparkleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-6.5-2 2m-9 9-2 2m0-13 2 2m9 9 2 2" />
    </svg>
  )
}

function ArrowLeftIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function CopyIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
    </svg>
  )
}

/* Single credential row with copy-to-clipboard */
function CredentialRow({
  label,
  value,
  copyId,
  copiedId,
  onCopy,
}: {
  label: string
  value: string
  copyId: string
  copiedId: string | null
  onCopy: (id: string, value: string) => void
}) {
  const isCopied = copiedId === copyId
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-green-100 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-0.5 truncate font-mono text-sm font-semibold text-ink" title={value}>
          {value}
        </p>
      </div>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={() => onCopy(copyId, value)}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-100 outline-none focus:ring-2 focus:ring-green-500/40"
      >
        {isCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
        <span>{isCopied ? 'Copied!' : 'Copy'}</span>
      </button>
    </div>
  )
}

export default function CreateCashierPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [createdUser, setCreatedUser] = useState<any>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1600)
    } catch {
      // Clipboard unavailable — silently ignore
    }
  }

  const handleCreateCashier = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Create Firestore user document with cashier role
      await setDoc(doc(db, 'users', user.uid), {
        email: email,
        displayName: displayName || email.split('@')[0],
        role: 'cashier',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      setCreatedUser({
        email: email,
        password: password,
        displayName: displayName || email.split('@')[0],
        uid: user.uid,
        role: 'cashier'
      })

      setMessage('Cashier user created successfully!')

      // Clear form
      setEmail('')
      setPassword('')
      setDisplayName('')

    } catch (err: any) {
      setError(err.message || 'Failed to create cashier user')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    {
      title: 'Firebase Authentication',
      text: 'User is created in Firebase Authentication.',
    },
    {
      title: 'Firestore Profile',
      text: 'A user document is created in Firestore with a cashier role.',
      code: "role: 'cashier'",
    },
    {
      title: 'POS-only Access',
      text: "When the cashier logs in, they'll only see the POS page.",
    },
    {
      title: 'Restricted Navigation',
      text: 'No access to inventory, events, catalog, or settings.',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-all duration-300 hover:-translate-y-0.5 hover:text-primaryDark outline-none focus:ring-2 focus:ring-primary/30 rounded-lg px-1 py-0.5"
          >
            <ArrowLeftIcon />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Image src={logo} alt="Eduvate Kids" width={40} height={40} />
            <h1 className="font-display text-3xl font-bold text-primaryDark">Create Cashier User</h1>
          </div>
          <p className="text-muted">Add a new cashier user with POS-only access</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-primary/10">
          <form onSubmit={handleCreateCashier} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cashier@eduvatekids.com"
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Password *
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
                required
                minLength={6}
              />
              <p className="text-xs text-muted mt-1">Must be at least 6 characters</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Display Name (Optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="John Cashier"
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
              <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Cashier users will only have access to the POS page. They won't see inventory, events, catalog, or settings.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 animate-fadeIn">
                <WarningTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <p className="text-sm text-red-600 font-semibold">{error}</p>
              </div>
            )}

            {message && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200 animate-fadeIn">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <p className="text-sm text-green-600 font-semibold">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-shine flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-secondary px-6 py-4 text-sm font-bold text-white shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <Spinner className="h-5 w-5" />
                  Creating...
                </>
              ) : (
                <>
                  <UserIcon className="h-5 w-5" />
                  Create Cashier User
                </>
              )}
            </button>
          </form>

          {/* Created User Details */}
          {createdUser && (
            <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 animate-fadeIn">
              <h3 className="font-bold text-lg text-green-800 mb-1 flex items-center gap-2">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
                Cashier User Created Successfully!
              </h3>
              <p className="mb-4 text-sm text-green-700/80">Copy each credential below to share securely.</p>

              <div className="space-y-2.5">
                <CredentialRow label="Email" value={createdUser.email} copyId="email" copiedId={copiedId} onCopy={handleCopy} />
                <CredentialRow label="Password" value={createdUser.password} copyId="password" copiedId={copiedId} onCopy={handleCopy} />
                <CredentialRow label="Display Name" value={createdUser.displayName} copyId="displayName" copiedId={copiedId} onCopy={handleCopy} />
                <div className="flex items-center justify-between gap-3 rounded-xl border border-green-100 bg-white px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Role</p>
                    <span className="mt-1 inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
                      {createdUser.role}
                    </span>
                  </div>
                </div>
                <CredentialRow label="UID" value={createdUser.uid} copyId="uid" copiedId={copiedId} onCopy={handleCopy} />
              </div>

              <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <WarningTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-xs text-amber-800">
                  <strong>Important:</strong> Save these credentials! The password won't be shown again.
                </p>
              </div>

              <a
                href="https://eduvatekids-store.web.app/auth/login"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-shine mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-primaryDark"
              >
                <GlobeIcon className="h-5 w-5" />
                Test Login
              </a>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="mt-6 p-6 rounded-2xl bg-purple-50 border border-purple-200">
          <h4 className="mb-4 flex items-center gap-2 font-bold text-purple-900">
            <SparkleIcon className="h-5 w-5 text-primary" />
            How It Works
          </h4>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white shadow-sm">
                  {i + 1}
                </span>
                <div className="pt-0.5">
                  <p className="text-sm font-semibold text-purple-900">{step.title}</p>
                  <p className="text-sm text-purple-800">
                    {step.text}
                    {step.code && (
                      <>
                        {' '}
                        <code className="rounded bg-purple-100 px-2 py-0.5 font-mono text-xs text-purple-900">{step.code}</code>
                      </>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
