'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import Image from 'next/image'
import logo from '../../assets/logo.png'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('admin')
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(false)
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [purgePassword, setPurgePassword] = useState('')
  const [purgeError, setPurgeError] = useState('')
  const [purging, setPurging] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/auth/login')
      } else {
        setUser(currentUser)
        // Fetch user role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || 'admin')
          }
        } catch (error) {
          console.error('Error fetching user role:', error)
        }
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    const saved = localStorage.getItem('eduvate-demo-mode')
    setDemoMode(saved === 'true')
  }, [])

  const handleToggleDemoMode = () => {
    const newMode = !demoMode
    setDemoMode(newMode)
    localStorage.setItem('eduvate-demo-mode', String(newMode))
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/auth/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handlePurgeData = async () => {
    if (purgePassword !== 'RESET2025') {
      setPurgeError('Incorrect password')
      return
    }

    setPurging(true)
    setPurgeError('')

    try {
      // Delete all inventory items
      const inventorySnap = await getDocs(collection(db, 'inventory'))
      for (const docSnap of inventorySnap.docs) {
        await deleteDoc(doc(db, 'inventory', docSnap.id))
      }

      // Delete all events
      const eventsSnap = await getDocs(collection(db, 'events'))
      for (const docSnap of eventsSnap.docs) {
        await deleteDoc(doc(db, 'events', docSnap.id))
      }

      // Delete all general sales
      const salesSnap = await getDocs(collection(db, 'generalSales'))
      for (const docSnap of salesSnap.docs) {
        await deleteDoc(doc(db, 'generalSales', docSnap.id))
      }

      alert('All live data has been reset successfully!')
      setShowPurgeConfirm(false)
      setPurgePassword('')
      window.location.reload()
    } catch (error) {
      console.error('Error purging data:', error)
      setPurgeError('Failed to reset data. Please try again.')
    } finally {
      setPurging(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <Image src={logo} alt="Eduvate Kids" width={40} height={40} className="w-10 h-10" />
            <div>
              <h1 className="font-display text-lg font-bold text-primary">Admin Settings</h1>
              <p className="text-xs text-muted">Configure your dashboard</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-full border-2 border-primary/30 bg-white px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-all"
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-11/12 max-w-4xl py-8 sm:py-12">
        <div className="space-y-6">
          {/* Account Info Card */}
          <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-lg border border-primary/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary text-2xl">
                👤
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-primaryDark">Account Information</h2>
                <p className="text-sm text-muted">Logged in user details</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <span className="text-sm font-semibold text-muted">Email</span>
                <span className="text-sm font-bold text-primaryDark">{user?.email || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <span className="text-sm font-semibold text-muted">Role</span>
                <span className="text-sm font-bold text-primaryDark">
                  {userRole === 'admin' ? 'Administrator' : userRole === 'cashier' ? 'Cashier' : 'User'}
                </span>
              </div>
            </div>
          </div>

          {/* Mode Settings Card */}
          <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-lg border border-primary/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-green-500 text-2xl">
                🔄
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-primaryDark">Dashboard Mode</h2>
                <p className="text-sm text-muted">Switch between demo and live data</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-amber-50 to-green-50 border-2 border-primary/20">
              <div>
                <p className="font-bold text-primaryDark mb-1">
                  {demoMode ? '📊 Demo Mode' : '🟢 Live Mode'}
                </p>
                <p className="text-xs text-muted">
                  {demoMode 
                    ? 'Using sample data for testing and demonstrations'
                    : 'Connected to live database with real data'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold transition-colors ${demoMode ? 'text-amber-600' : 'text-muted'}`}>Demo</span>
                <button
                  onClick={handleToggleDemoMode}
                  className={`relative h-8 w-14 rounded-full transition-colors duration-300 ${demoMode ? 'bg-amber-400' : 'bg-green-500'}`}
                  type="button"
                  aria-label={demoMode ? 'Switch to live mode' : 'Switch to demo mode'}
                >
                  <span
                    className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ${demoMode ? 'translate-x-0' : 'translate-x-6'}`}
                  />
                </button>
                <span className={`text-xs font-bold transition-colors ${!demoMode ? 'text-green-600' : 'text-muted'}`}>Live</span>
              </div>
            </div>

            {demoMode && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> Demo mode uses hardcoded sample data. Changes won't be saved to the database.
                </p>
              </div>
            )}
          </div>

          {/* Data Management Card - Admin Only */}
          {!demoMode && userRole === 'admin' && (
            <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-lg border border-red-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-red-600 text-2xl">
                  ⚠️
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-red-600">Danger Zone</h2>
                  <p className="text-sm text-muted">Irreversible actions - use with caution</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-red-50 border-2 border-red-200">
                  <h3 className="font-bold text-red-700 mb-2">Reset All Live Data</h3>
                  <p className="text-sm text-red-600 mb-4">
                    This will permanently delete all inventory items, events, and sales records from the live database. This action cannot be undone.
                  </p>
                  <button
                    onClick={() => { setShowPurgeConfirm(true); setPurgePassword(''); setPurgeError('') }}
                    className="rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-all hover:shadow-lg"
                    type="button"
                  >
                    Reset Live Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Additional Settings Card */}
          <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-lg border border-primary/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-2xl">
                ⚙️
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-primaryDark">General Settings</h2>
                <p className="text-sm text-muted">Configure dashboard preferences</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <div>
                  <p className="text-sm font-semibold text-primaryDark">Notifications</p>
                  <p className="text-xs text-muted">Receive alerts for new sales</p>
                </div>
                <button className="relative h-6 w-11 rounded-full bg-gray-300" type="button" disabled>
                  <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md" />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <div>
                  <p className="text-sm font-semibold text-primaryDark">Auto-sync</p>
                  <p className="text-xs text-muted">Automatically refresh data</p>
                </div>
                <button className="relative h-6 w-11 rounded-full bg-green-500" type="button" disabled>
                  <span className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>
          </div>

          {/* Sign Out Card */}
          <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-lg border border-primary/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-red-400 to-pink-500 text-2xl">
                🚪
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-primaryDark">Sign Out</h2>
                <p className="text-sm text-muted">End your current session</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-gray-50 to-pink-50 border-2 border-primary/20">
              <div>
                <p className="font-bold text-primaryDark mb-1">Logged in as</p>
                <p className="text-sm text-muted">{user?.email || 'Administrator'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-2.5 text-sm font-bold text-white hover:shadow-lg hover:-translate-y-0.5 transition-all"
                type="button"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Purge Confirmation Modal */}
      {showPurgeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setShowPurgeConfirm(false)}>
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPurgeConfirm(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              type="button"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-4xl mb-4">
                ⚠️
              </div>
              <h3 className="font-display text-2xl font-bold text-red-600 mb-2">Reset All Data?</h3>
              <p className="text-sm text-muted">
                This will permanently delete all inventory, events, and sales from the live database.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted mb-2">
                  Enter password to confirm: <span className="text-red-600">RESET2025</span>
                </label>
                <input
                  type="text"
                  value={purgePassword}
                  onChange={(e) => setPurgePassword(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-red-500 focus:outline-none"
                  placeholder="Type RESET2025"
                />
              </div>

              {purgeError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-xs text-red-600 font-semibold">{purgeError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPurgeConfirm(false)}
                  className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                  type="button"
                  disabled={purging}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurgeData}
                  disabled={purging || purgePassword !== 'RESET2025'}
                  className="flex-1 rounded-full bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  {purging ? 'Resetting...' : 'Reset Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
