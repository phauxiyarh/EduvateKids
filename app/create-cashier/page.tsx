'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import logo from '../../assets/logo.png'

export default function CreateCashierPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [createdUser, setCreatedUser] = useState<any>(null)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 text-sm text-primary hover:text-primaryDark font-semibold"
          >
            ← Back to Dashboard
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
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm focus:border-primary focus:outline-none"
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
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm focus:border-primary focus:outline-none"
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
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Cashier users will only have access to the POS page. They won't see inventory, events, catalog, or settings.
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-600 font-semibold">{error}</p>
              </div>
            )}

            {message && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <p className="text-sm text-green-600 font-semibold">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-primary to-secondary px-6 py-4 text-sm font-bold text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : '👤 Create Cashier User'}
            </button>
          </form>

          {/* Created User Details */}
          {createdUser && (
            <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
              <h3 className="font-bold text-lg text-green-800 mb-4 flex items-center gap-2">
                <span>✅</span> Cashier User Created Successfully!
              </h3>
              
              <div className="space-y-3 bg-white rounded-xl p-4 border border-green-200">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-gray-600">Email:</span>
                  <span className="text-sm font-bold text-gray-800">{createdUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-gray-600">Password:</span>
                  <span className="text-sm font-bold text-gray-800">{createdUser.password}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-gray-600">Display Name:</span>
                  <span className="text-sm font-bold text-gray-800">{createdUser.displayName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-gray-600">Role:</span>
                  <span className="inline-block px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold">
                    {createdUser.role}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-gray-600">UID:</span>
                  <span className="text-xs font-mono text-gray-600">{createdUser.uid}</span>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-800">
                  <strong>⚠️ Important:</strong> Save these credentials! The password won't be shown again.
                </p>
              </div>

              <a
                href="https://eduvatekids-store.web.app/auth/login"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block text-center rounded-xl bg-primary text-white px-4 py-3 text-sm font-bold hover:bg-primaryDark transition-colors"
              >
                🌐 Test Login
              </a>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-6 rounded-2xl bg-purple-50 border border-purple-200">
          <h4 className="font-bold text-purple-900 mb-2">How It Works:</h4>
          <ul className="space-y-2 text-sm text-purple-800">
            <li className="flex items-start gap-2">
              <span>1.</span>
              <span>User is created in Firebase Authentication</span>
            </li>
            <li className="flex items-start gap-2">
              <span>2.</span>
              <span>User document is created in Firestore with <code className="bg-purple-100 px-2 py-0.5 rounded">role: 'cashier'</code></span>
            </li>
            <li className="flex items-start gap-2">
              <span>3.</span>
              <span>When cashier logs in, they'll only see the POS page</span>
            </li>
            <li className="flex items-start gap-2">
              <span>4.</span>
              <span>Navigation is restricted - no access to inventory, events, catalog, or settings</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
