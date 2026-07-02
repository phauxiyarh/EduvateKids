'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, getDocs, deleteDoc, doc, getDoc, setDoc, query, orderBy, limit, Timestamp, writeBatch } from 'firebase/firestore'
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
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null)
  const [lastBackupId, setLastBackupId] = useState<string | null>(null)
  const [backingUp, setBackingUp] = useState(false)
  const [downloadingBackup, setDownloadingBackup] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [restoreFileData, setRestoreFileData] = useState<any>(null)
  const [restoreFileName, setRestoreFileName] = useState('')
  const restoreInputRef = useRef<HTMLInputElement>(null)

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

  // Load last backup info
  useEffect(() => {
    const loadLastBackup = async () => {
      try {
        const backupsSnap = await getDocs(query(collection(db, 'backups'), orderBy('createdAt', 'desc'), limit(1)))
        if (!backupsSnap.empty) {
          const backupDoc = backupsSnap.docs[0]
          const data = backupDoc.data()
          setLastBackupId(backupDoc.id)
          if (data.createdAt) {
            const date = data.createdAt.toDate()
            setLastBackupDate(date.toLocaleString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
            }))
          }
        }
      } catch (error) {
        console.error('Error loading last backup:', error)
      }
    }
    if (user) loadLastBackup()
  }, [user])

  // Helper to convert Firestore data to plain JSON-safe objects
  const sanitizeForJSON = (obj: any): any => {
    if (obj === null || obj === undefined) return obj
    if (obj.toDate && typeof obj.toDate === 'function') return obj.toDate().toISOString()
    if (Array.isArray(obj)) return obj.map(sanitizeForJSON)
    if (typeof obj === 'object') {
      const clean: any = {}
      for (const key of Object.keys(obj)) {
        clean[key] = sanitizeForJSON(obj[key])
      }
      return clean
    }
    return obj
  }

  const handleCreateBackup = async () => {
    if (!user) return
    setBackingUp(true)
    try {
      // Fetch all collections
      const [inventorySnap, eventsSnap, generalSalesSnap, generalOrdersSnap, catalogSnap] = await Promise.all([
        getDocs(collection(db, 'inventory')),
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'generalSales')),
        getDocs(collection(db, 'generalOrders')),
        getDocs(collection(db, 'catalog'))
      ])

      const collections: Record<string, any[]> = {
        inventory: inventorySnap.docs.map(d => sanitizeForJSON({ id: d.id, ...d.data() })),
        events: eventsSnap.docs.map(d => sanitizeForJSON({ id: d.id, ...d.data() })),
        generalSales: generalSalesSnap.docs.map(d => sanitizeForJSON({ id: d.id, ...d.data() })),
        generalOrders: generalOrdersSnap.docs.map(d => sanitizeForJSON({ id: d.id, ...d.data() })),
        catalog: catalogSnap.docs.map(d => sanitizeForJSON({ id: d.id, ...d.data() }))
      }

      const now = new Date()
      const backupId = `backup_${now.getTime()}`

      // Save metadata document
      await setDoc(doc(db, 'backups', backupId), {
        createdAt: Timestamp.fromDate(now),
        createdBy: user.email || 'unknown',
        itemCounts: {
          inventory: collections.inventory.length,
          events: collections.events.length,
          generalSales: collections.generalSales.length,
          generalOrders: collections.generalOrders.length,
          catalog: collections.catalog.length
        }
      })

      // Save each collection in a subcollection document to avoid 1MB doc limit
      const batch = writeBatch(db)
      for (const [colName, items] of Object.entries(collections)) {
        const jsonStr = JSON.stringify(items)
        // Split into chunks of ~800KB if needed
        const chunkSize = 800000
        if (jsonStr.length <= chunkSize) {
          batch.set(doc(db, 'backups', backupId, 'data', colName), { json: jsonStr })
        } else {
          const totalChunks = Math.ceil(jsonStr.length / chunkSize)
          for (let i = 0; i < totalChunks; i++) {
            const chunk = jsonStr.slice(i * chunkSize, (i + 1) * chunkSize)
            await setDoc(doc(db, 'backups', backupId, 'data', `${colName}_chunk${i}`), { json: chunk, chunkIndex: i, totalChunks, collection: colName })
          }
        }
      }
      await batch.commit()

      setLastBackupId(backupId)
      setLastBackupDate(now.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
      }))

      alert('✅ Backup created successfully!')
    } catch (error) {
      console.error('Error creating backup:', error)
      alert('❌ Failed to create backup. Please try again.')
    } finally {
      setBackingUp(false)
    }
  }

  const handleDownloadBackup = async () => {
    if (!lastBackupId) {
      alert('No backup available to download. Create a backup first.')
      return
    }
    setDownloadingBackup(true)
    try {
      const backupMetaDoc = await getDoc(doc(db, 'backups', lastBackupId))
      if (!backupMetaDoc.exists()) {
        alert('Backup not found in database.')
        setDownloadingBackup(false)
        return
      }

      const meta = backupMetaDoc.data()

      // Read all data subcollection docs
      const dataSnap = await getDocs(collection(db, 'backups', lastBackupId, 'data'))

      // Reassemble: handle both whole docs and chunked docs
      const wholeCollections: Record<string, any[]> = {}
      const chunks: Record<string, { totalChunks: number; parts: Record<number, string> }> = {}

      for (const d of dataSnap.docs) {
        const data = d.data()
        if (data.totalChunks) {
          const colName = data.collection
          if (!chunks[colName]) chunks[colName] = { totalChunks: data.totalChunks, parts: {} }
          chunks[colName].parts[data.chunkIndex] = data.json
        } else {
          wholeCollections[d.id] = JSON.parse(data.json)
        }
      }

      // Reassemble chunked collections
      for (const [colName, chunkInfo] of Object.entries(chunks)) {
        let fullJson = ''
        for (let i = 0; i < chunkInfo.totalChunks; i++) {
          fullJson += chunkInfo.parts[i]
        }
        wholeCollections[colName] = JSON.parse(fullJson)
      }

      const downloadPayload = {
        exportedAt: meta.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
        exportedBy: meta.createdBy,
        itemCounts: meta.itemCounts,
        ...wholeCollections
      }

      const blob = new Blob([JSON.stringify(downloadPayload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      a.download = `EduvateKids_Backup_${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading backup:', error)
      alert('❌ Failed to download backup.')
    } finally {
      setDownloadingBackup(false)
    }
  }

  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        // Validate structure
        if (!data.inventory && !data.events && !data.catalog) {
          alert('❌ Invalid backup file. Missing expected data collections.')
          return
        }
        setRestoreFileData(data)
        setRestoreFileName(file.name)
        setShowRestoreConfirm(true)
      } catch {
        alert('❌ Invalid file. Please upload a valid JSON backup file.')
      }
    }
    reader.readAsText(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleRestoreBackup = async () => {
    if (!restoreFileData || !user) return
    setRestoring(true)
    try {
      const collectionsToRestore: { name: string; items: any[] }[] = [
        { name: 'inventory', items: restoreFileData.inventory || [] },
        { name: 'events', items: restoreFileData.events || [] },
        { name: 'generalSales', items: restoreFileData.generalSales || [] },
        { name: 'generalOrders', items: restoreFileData.generalOrders || [] },
        { name: 'catalog', items: restoreFileData.catalog || [] }
      ]

      // Step 1: Delete existing data in each collection
      for (const col of collectionsToRestore) {
        const snap = await getDocs(collection(db, col.name))
        if (!snap.empty) {
          const batch = writeBatch(db)
          snap.docs.forEach(d => batch.delete(doc(db, col.name, d.id)))
          await batch.commit()
        }
      }

      // Step 2: Write restored data
      for (const col of collectionsToRestore) {
        for (const item of col.items) {
          const { id, ...data } = item
          const docId = id || doc(collection(db, col.name)).id
          await setDoc(doc(db, col.name, docId), data)
        }
      }

      alert('✅ Data restored successfully! The page will reload.')
      setShowRestoreConfirm(false)
      setRestoreFileData(null)
      setRestoreFileName('')
      window.location.reload()
    } catch (error) {
      console.error('Error restoring backup:', error)
      alert('❌ Failed to restore backup. Please try again.')
    } finally {
      setRestoring(false)
    }
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
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgba(124,58,237,0.06)]">
        <div className="h-0.5 w-full bg-gradient-to-r from-primary via-secondary to-amber-400" />
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
            className="group flex items-center gap-2 rounded-full border-2 border-primary/30 bg-white px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 hover:border-primary/50 transition-all duration-300"
            type="button"
            aria-label="Back to Dashboard"
          >
            <svg className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-11/12 max-w-4xl py-8 sm:py-12">
        <div className="space-y-6">
          {/* Account Info Card */}
          <div className="card-hover rounded-3xl bg-white p-6 sm:p-8 shadow-lg border border-primary/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-primaryDark">Account Information</h2>
                <p className="text-sm text-muted">Logged in user details</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span className="text-sm font-semibold text-muted">Email</span>
                </div>
                <span className="text-sm font-bold text-primaryDark truncate">{user?.email || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </span>
                  <span className="text-sm font-semibold text-muted">Role</span>
                </div>
                <span className="text-sm font-bold text-primaryDark">
                  {userRole === 'admin' ? 'Administrator' : userRole === 'cashier' ? 'Cashier' : 'User'}
                </span>
              </div>
            </div>
          </div>

          {/* Mode Settings Card */}
          <div className="card-hover rounded-3xl bg-white p-6 sm:p-8 shadow-lg border border-primary/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-green-500 text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-primaryDark">Dashboard Mode</h2>
                <p className="text-sm text-muted">Switch between demo and live data</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-50 to-green-50 border-2 border-primary/20">
              <div>
                <p className="flex items-center gap-2 font-bold text-primaryDark mb-1">
                  {demoMode ? (
                    <>
                      <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Demo Mode
                    </>
                  ) : (
                    <>
                      <span className="relative flex h-3 w-3" aria-hidden="true">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                      </span>
                      Live Mode
                    </>
                  )}
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
                  role="switch"
                  aria-checked={!demoMode}
                  className={`relative h-8 w-14 rounded-full transition-colors duration-300 ease-in-out shadow-inner ${demoMode ? 'bg-amber-400' : 'bg-green-500'}`}
                  type="button"
                  aria-label={demoMode ? 'Switch to live mode' : 'Switch to demo mode'}
                >
                  <span
                    className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${demoMode ? 'translate-x-0' : 'translate-x-6'}`}
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

          {/* Backup & Restore Card - Admin Only */}
          {!demoMode && userRole === 'admin' && (
            <div className="card-hover rounded-3xl bg-white p-6 sm:p-8 shadow-lg border border-primary/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-teal-500 text-white">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-primaryDark">Backup &amp; Restore</h2>
                  <p className="text-sm text-muted">Create and download database backups</p>
                </div>
              </div>

              {/* Last Backup Info */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-200 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-bold text-primaryDark">Last Backup</p>
                </div>
                {lastBackupDate ? (
                  <p className="text-sm text-green-700 font-semibold ml-7">{lastBackupDate}</p>
                ) : (
                  <p className="text-sm text-muted ml-7">No backups yet</p>
                )}
              </div>

              {/* Backup Actions */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-primaryDark">Create Backup</p>
                    <p className="text-xs text-muted">Save all data (inventory, events, sales, orders, catalog) to Firebase</p>
                  </div>
                  <button
                    onClick={handleCreateBackup}
                    disabled={backingUp}
                    className="inline-flex min-w-[9.5rem] items-center justify-center gap-2 self-start sm:self-center rounded-full bg-gradient-to-r from-green-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    type="button"
                    aria-label="Create backup now"
                  >
                    {backingUp ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Backing up...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Backup Now
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-primaryDark">Download Backup</p>
                    <p className="text-xs text-muted">Download the latest backup as a JSON file to your device</p>
                  </div>
                  <button
                    onClick={handleDownloadBackup}
                    disabled={downloadingBackup || !lastBackupId}
                    className="inline-flex min-w-[9.5rem] items-center justify-center gap-2 self-start sm:self-center rounded-full border-2 border-green-400 bg-white px-5 py-2.5 text-sm font-bold text-green-700 hover:bg-green-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                    aria-label="Download latest backup"
                  >
                    {downloadingBackup ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div>
                    <p className="text-sm font-semibold text-primaryDark">Restore from Backup</p>
                    <p className="text-xs text-muted">Upload a backup JSON file to restore all data</p>
                  </div>
                  <input
                    ref={restoreInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleRestoreFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => restoreInputRef.current?.click()}
                    disabled={restoring}
                    className="inline-flex min-w-[9.5rem] items-center justify-center gap-2 self-start sm:self-center rounded-full border-2 border-amber-400 bg-white px-5 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                    aria-label="Restore from backup file"
                  >
                    {restoring ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Restoring...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Restore
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-800">
                  <strong>Tip:</strong> Create regular backups before making large changes. Backups include all inventory, events, sales, orders, and catalog data.
                </p>
              </div>
            </div>
          )}

          {/* Data Management Card - Admin Only */}
          {!demoMode && userRole === 'admin' && (
            <div className="rounded-3xl bg-red-50/40 p-6 sm:p-8 shadow-lg border-2 border-red-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="flex items-center gap-2 font-display text-xl font-bold text-red-600">Danger Zone</h2>
                  <p className="text-sm text-red-500/80">Irreversible actions - use with caution</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-white border-2 border-red-200 shadow-sm">
                  <h3 className="flex items-center gap-2 font-bold text-red-700 mb-2">
                    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Reset All Live Data
                  </h3>
                  <p className="text-sm text-red-600 mb-4">
                    This will permanently delete all inventory items, events, and sales records from the live database. This action cannot be undone.
                  </p>
                  <button
                    onClick={() => { setShowPurgeConfirm(true); setPurgePassword(''); setPurgeError('') }}
                    className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                    type="button"
                    aria-label="Reset all live data"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Reset Live Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Additional Settings Card */}
          <div className="card-hover rounded-3xl bg-white p-6 sm:p-8 shadow-lg border border-primary/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-primaryDark">General Settings</h2>
                <p className="text-sm text-muted">Configure dashboard preferences</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-500 shadow-sm">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-primaryDark">Notifications</p>
                    <p className="text-xs text-muted">Receive alerts for new sales</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Coming soon</span>
                  <button className="relative h-6 w-11 rounded-full bg-gray-300 cursor-not-allowed" type="button" disabled aria-label="Notifications (coming soon)">
                    <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-green-500 shadow-sm">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-primaryDark">Auto-sync</p>
                    <p className="text-xs text-muted">Automatically refresh data</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Coming soon</span>
                  <button className="relative h-6 w-11 rounded-full bg-green-500 cursor-not-allowed" type="button" disabled aria-label="Auto-sync (coming soon)">
                    <span className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-white shadow-md" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sign Out Card */}
          <div className="card-hover rounded-3xl bg-white p-6 sm:p-8 shadow-lg border border-primary/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-red-400 to-pink-500 text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-primaryDark">Sign Out</h2>
                <p className="text-sm text-muted">End your current session</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-gray-50 to-pink-50 border-2 border-primary/20">
              <div>
                <p className="font-bold text-primaryDark mb-1">Logged in as</p>
                <p className="text-sm text-muted">{user?.email || 'Administrator'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 self-start sm:self-center rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-2.5 text-sm font-bold text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                type="button"
                aria-label="Sign out"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && restoreFileData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => { setShowRestoreConfirm(false); setRestoreFileData(null) }}>
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setShowRestoreConfirm(false); setRestoreFileData(null) }}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-300"
              type="button"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <h3 className="font-display text-2xl font-bold text-amber-700 mb-2">Restore Backup?</h3>
              <p className="text-sm text-muted">
                This will <strong>replace all current data</strong> with the data from the backup file.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="p-4 rounded-xl bg-gray-50">
                <p className="text-xs text-muted mb-1">File</p>
                <p className="text-sm font-bold text-primaryDark truncate">{restoreFileName}</p>
              </div>
              {restoreFileData.exportedAt && (
                <div className="p-4 rounded-xl bg-gray-50">
                  <p className="text-xs text-muted mb-1">Backup Date</p>
                  <p className="text-sm font-bold text-primaryDark">{new Date(restoreFileData.exportedAt).toLocaleString()}</p>
                </div>
              )}
              <div className="p-4 rounded-xl bg-gray-50">
                <p className="text-xs text-muted mb-2">Data Summary</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted">Inventory:</span>
                  <span className="font-bold text-primaryDark">{restoreFileData.inventory?.length || 0} items</span>
                  <span className="text-muted">Events:</span>
                  <span className="font-bold text-primaryDark">{restoreFileData.events?.length || 0} events</span>
                  <span className="text-muted">General Sales:</span>
                  <span className="font-bold text-primaryDark">{restoreFileData.generalSales?.length || 0} records</span>
                  <span className="text-muted">Orders:</span>
                  <span className="font-bold text-primaryDark">{restoreFileData.generalOrders?.length || 0} orders</span>
                  <span className="text-muted">Catalog:</span>
                  <span className="font-bold text-primaryDark">{restoreFileData.catalog?.length || 0} items</span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <svg className="h-4 w-4 shrink-0 mt-0.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-red-700 font-semibold">Warning: This will overwrite all existing data. Create a backup first if needed.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowRestoreConfirm(false); setRestoreFileData(null) }}
                className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                disabled={restoring}
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={restoring}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-3 text-sm font-bold text-white hover:bg-amber-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                aria-label="Restore now"
              >
                {restoring ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Restoring...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Restore Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Confirmation Modal */}
      {showPurgeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setShowPurgeConfirm(false)}>
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPurgeConfirm(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-300"
              type="button"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
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
                  className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  disabled={purging}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurgeData}
                  disabled={purging || purgePassword !== 'RESET2025'}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  aria-label="Reset data"
                >
                  {purging ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Reset Data'
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
