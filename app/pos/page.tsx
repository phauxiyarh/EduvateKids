'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { BarcodeScanner } from '../components/BarcodeScanner'
import logo from '../../assets/logo.png'

type InventoryCategory = 'Books' | 'Crafts' | 'Puzzles' | 'Gifts'

type InventoryItem = {
  id: string
  title: string
  category: InventoryCategory
  publisher: string
  rrp: number
  discount: number
  quantity: number
  sellingPrice: number
  /** Unified scannable identifier. Legacy docs still carry sku/isbn instead. */
  code: string
  altCode: string
}

type Sale = {
  id: string
  itemId: string
  title: string
  quantity: number
  paymentType: 'Cash' | 'Card' | 'Transfer'
  total: number
  timestamp: string
}

type CartItem = {
  itemId: string
  title: string
  price: number
  quantity: number
}

const convenienceFeeRate = 0.03

const formatNumber = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'

const categoryColors: Record<InventoryCategory, string> = {
  Books: 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-200',
  Crafts: 'bg-gradient-to-r from-pink-100 to-rose-100 text-pink-700 border border-pink-200',
  Puzzles: 'bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 border border-purple-200',
  Gifts: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border border-amber-200'
}

export default function POSPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'All' | InventoryCategory>('All')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [paymentType, setPaymentType] = useState<Sale['paymentType']>('Cash')
  const [showConfirmSale, setShowConfirmSale] = useState(false)
  const [isSubmittingSale, setIsSubmittingSale] = useState(false)
  const [message, setMessage] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage')

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const inventorySnap = await getDocs(collection(db, 'inventory'))

        if (!inventorySnap.empty) {
          // Filter for _live items only (same as admin dashboard)
          const items = inventorySnap.docs
            .filter((d) => d.data()._live === true)
            .map((d) => {
              const data = d.data()
              return {
                id: d.id,
                title: String(data.title ?? ''),
                category: String(data.category ?? 'Books') as InventoryCategory,
                publisher: String(data.publisher ?? ''),
                rrp: Number(data.rrp ?? 0),
                discount: Number(data.discount ?? 0),
                quantity: Number(data.quantity ?? 0),
                sellingPrice: Number(data.sellingPrice ?? 0),
                // Fall back to the legacy sku/isbn pair for docs that predate
                // the unified code field.
                code: String(data.code ?? data.isbn ?? data.sku ?? ''),
                altCode: String(data.altCode ?? '')
              }
            })
            .filter((item) => item.title) // Only include items with titles
          setInventory(items)
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()
  }, [])

  const filteredInventory = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return inventory.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(query) ||
        item.publisher.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [inventory, searchQuery, categoryFilter])

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
  const convenienceFee = Number((subtotalAfterDiscount * convenienceFeeRate).toFixed(2))
  const totalWithFee = Number((subtotalAfterDiscount + (paymentType === 'Card' ? convenienceFee : 0)).toFixed(2))

  const handleAddToCart = (itemId: string) => {
    const item = inventory.find((stock) => stock.id === itemId)
    if (!item) return

    const existing = cartItems.find((cartItem) => cartItem.itemId === itemId)
    const currentQty = existing?.quantity ?? 0
    const available = item.quantity - currentQty

    if (available <= 0) {
      setMessage('No remaining stock available for this item.')
      return
    }

    setCartItems((current) => {
      if (!existing) {
        return [...current, { itemId: item.id, title: item.title, price: item.sellingPrice, quantity: 1 }]
      }
      return current.map((cartItem) =>
        cartItem.itemId === itemId ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
      )
    })

    setMessage(`${item.title} added to cart.`)
  }

  // Resolve a scanned/typed code to an inventory item: exact code/id first,
  // then a loose title match. Adds to cart on a confident single match.
  const handleScanDetected = (raw: string) => {
    const code = raw.trim().toLowerCase()
    if (!code) return
    // Compare digits-only so a hyphenated barcode still matches its bare form.
    const canon = (v: string) => {
      const digits = v.replace(/[^0-9xX]/g, '').toLowerCase()
      return digits.length >= 8 ? digits : v.trim().toLowerCase()
    }
    const wanted = canon(raw)
    const exact = inventory.find(
      (i) =>
        i.id.toLowerCase() === code ||
        (i.code && canon(i.code) === wanted) ||
        (i.altCode && canon(i.altCode) === wanted)
    )
    if (exact) {
      handleAddToCart(exact.id)
      setScannerOpen(false)
      return
    }
    const titleMatches = inventory.filter((i) => i.title.toLowerCase().includes(code))
    if (titleMatches.length === 1) {
      handleAddToCart(titleMatches[0].id)
      setScannerOpen(false)
      return
    }
    if (titleMatches.length > 1) {
      // Ambiguous - drop the scanner and pre-fill search so the cashier picks.
      setSearchQuery(raw.trim())
      setScannerOpen(false)
      setMessage(`Multiple matches for "${raw.trim()}". Showing search results.`)
      return
    }
    setMessage(`No item found for "${raw.trim()}". Try manual search.`)
  }

  const handleUpdateCartQuantity = (itemId: string, nextValue: number) => {
    const item = inventory.find((stock) => stock.id === itemId)
    if (!item) return

    const quantity = Math.max(0, Math.round(nextValue))
    const clamped = Math.min(quantity, item.quantity)

    if (quantity > item.quantity) {
      setMessage(`Only ${item.quantity} available for ${item.title}.`)
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

  const handleRecordSale = async () => {
    if (cartItems.length === 0) return

    setIsSubmittingSale(true)
    const stockMap = new Map(inventory.map((item) => [item.id, item]))

    for (const cartItem of cartItems) {
      const stockItem = stockMap.get(cartItem.itemId)
      if (!stockItem || cartItem.quantity > stockItem.quantity) {
        setMessage(`Not enough stock for ${cartItem.title}. Please adjust the cart.`)
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
      
      return {
        id: `sale-${Date.now()}-${cartItem.itemId}`,
        itemId: cartItem.itemId,
        title: cartItem.title,
        quantity: cartItem.quantity,
        paymentType,
        total: itemTotal,
        timestamp
      }
    })

    const nextInventory = inventory.map((item) => {
      const cartItem = cartItems.find((entry) => entry.itemId === item.id)
      if (!cartItem) return item
      return { ...item, quantity: Math.max(0, item.quantity - cartItem.quantity) }
    })

    setInventory(nextInventory)
    setCartItems([])
    setDiscount(0)
    setMessage(`Sale recorded (${salesToAdd.length} items).`)
    setShowConfirmSale(false)

    try {
      const batch = writeBatch(db)
      salesToAdd.forEach((sale) => {
        batch.set(doc(db, 'generalSales', sale.id), { ...sale, _live: true })
      })
      nextInventory.forEach((item) => {
        batch.update(doc(db, 'inventory', item.id), { quantity: item.quantity, _live: true })
      })
      await batch.commit()
    } catch (error) {
      console.error('Record sale error:', error)
      setMessage('Sale saved locally, but failed to sync.')
    } finally {
      setIsSubmittingSale(false)
    }
  }

  return (
    <div className="min-h-screen text-ink bg-gradient-to-br from-purple-50 via-white to-emerald-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgba(124,58,237,0.06)]">
        <div className="h-0.5 w-full bg-gradient-to-r from-primary via-secondary to-emerald-400" />
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-4 py-2">
          <Link className="flex items-center gap-2 sm:gap-3 min-w-0" href="/">
            <Image src={logo} alt="Eduvate Kids logo" width={32} height={32} className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" />
            <span className="flex flex-col min-w-0">
              <span className="font-display text-base sm:text-lg font-bold truncate">Eduvate Kids</span>
              <span className="text-xs sm:text-sm text-muted hidden sm:block">Point of Sale</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            {[
              { label: 'Home', href: '/', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10' },
              { label: 'Our Catalog', href: '/catalog', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
              { label: 'Contact', href: '/contact-us', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z' }
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:-translate-y-0.5"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <button
              className="flex items-center justify-center w-10 h-10 rounded-xl border border-primary/20 bg-white transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/30 outline-none md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-primary/10 bg-white px-6 py-4 space-y-2 animate-slideDown">
            {[
              { label: 'Home', href: '/', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10' },
              { label: 'Our Catalog', href: '/catalog', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
              { label: 'Contact', href: '/contact-us', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z' }
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-bold text-primaryDark transition hover:bg-primary/10 active:scale-[0.98]"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto w-11/12 max-w-6xl py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20" role="status" aria-live="polite">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-sm font-semibold text-muted">Loading inventory...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-emerald-50/50 p-6 shadow-xl border border-emerald-200/50">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 shadow-soft">
                  <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 10h20M6 15h4" />
                  </svg>
                </span>
                <div>
                  <h1 className="font-display text-2xl gradient-text">Point of Sale</h1>
                  <p className="text-sm text-muted">Browse inventory and record sales</p>
                </div>
              </div>
            </div>

            {/* Two Column Layout - Catalog & Cart */}
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              {/* Left Column - Catalog */}
              <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
                    <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a2 2 0 012-2h6v16H6a2 2 0 00-2 2V5zM20 5a2 2 0 00-2-2h-6v16h6a2 2 0 012 2V5z" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="font-display text-xl gradient-text">Inventory Catalog</h3>
                    <span className="text-xs font-semibold text-muted">{inventory.length} items in stock</span>
                  </div>
                </div>

                {/* Search & Filter */}
                <div className="space-y-3 mb-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search products..."
                        aria-label="Search products by title, publisher, or category"
                        className="w-full rounded-xl border-2 border-primary/20 pl-11 pr-4 py-3 text-sm hover:border-primary/40 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      aria-label="Scan a barcode or QR code"
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" /></svg>
                      <span className="hidden sm:inline">Scan</span>
                    </button>
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
                    aria-label="Filter by category"
                    className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm font-medium hover:border-primary/40 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition"
                  >
                    <option value="All">All Categories</option>
                    <option value="Books">📖 Books</option>
                    <option value="Crafts">🎨 Crafts</option>
                    <option value="Puzzles">🧩 Puzzles</option>
                    <option value="Gifts">🎁 Gifts</option>
                  </select>
                </div>

                {/* Inventory List */}
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {filteredInventory.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-12 animate-fadeIn">
                      <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10">
                        <svg className="h-8 w-8 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </span>
                      <p className="text-sm font-semibold text-muted">
                        {inventory.length === 0 ? 'No inventory available yet.' : 'No items found.'}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {inventory.length === 0 ? 'Check back soon for new stock.' : 'Try adjusting your search or filter.'}
                      </p>
                    </div>
                  ) : (
                    filteredInventory.map((item) => {
                      const inCart = cartItems.find((c) => c.itemId === item.id)
                      const availableQty = item.quantity - (inCart?.quantity ?? 0)
                      return (
                        <div
                          key={item.id}
                          className={`group rounded-2xl border-2 p-4 transition-all ${
                            item.quantity === 0
                              ? 'border-gray-200 bg-gray-50 opacity-60'
                              : 'border-primary/10 hover:border-primary/30 hover:shadow-lg bg-gradient-to-br from-white to-primary/5'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-primaryDark truncate">{item.title}</p>
                              <p className="text-xs text-muted truncate">{item.publisher}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${categoryColors[item.category]}`}>
                                  {item.category}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  item.quantity === 0
                                    ? 'bg-red-100 text-red-700 border border-red-200'
                                    : item.quantity < 5
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-green-100 text-green-700 border border-green-200'
                                }`}>
                                  Stock: {item.quantity}
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold gradient-text">${formatNumber(item.sellingPrice)}</p>
                              {item.discount > 0 && (
                                <p className="text-[10px] text-muted line-through">${formatNumber(item.rrp)}</p>
                              )}
                              <button
                                onClick={() => handleAddToCart(item.id)}
                                disabled={availableQty <= 0}
                                aria-label={availableQty <= 0 ? `${item.title} is out of stock` : `Add ${item.title} to cart`}
                                className="btn-shine mt-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-1.5 text-xs font-bold text-white hover:shadow-lg hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/40 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                                type="button"
                              >
                                {availableQty <= 0 ? (
                                  'Out of Stock'
                                ) : (
                                  <>
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
                                    </svg>
                                    Add
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Right Column - Cart & Checkout */}
              <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-emerald-50/50 p-6 shadow-2xl ring-1 ring-emerald-200/60 border border-emerald-200/60 h-fit lg:sticky lg:top-24">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-green-100">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2 5h12M9 20a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="font-display text-xl gradient-text">Shopping Cart</h3>
                    <p className="text-xs text-muted">{cartItems.length} items</p>
                  </div>
                </div>

                {/* Cart Items */}
                <div className="space-y-3 mb-4 max-h-[280px] overflow-y-auto">
                  {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-8 animate-fadeIn">
                      <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100/70 to-green-100/70">
                        <svg className="h-7 w-7 text-emerald-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2 5h12M9 20a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" />
                        </svg>
                      </span>
                      <p className="text-xs font-semibold text-muted">Cart is empty</p>
                      <p className="text-[10px] text-muted mt-1">Add items from the catalog</p>
                    </div>
                  ) : (
                    cartItems.map((item) => (
                      <div key={item.itemId} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10 animate-fadeIn">
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="font-semibold text-sm truncate">{item.title}</p>
                          <p className="text-xs text-muted">${formatNumber(item.price)} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(e) => handleUpdateCartQuantity(item.itemId, Number(e.target.value))}
                            aria-label={`Quantity for ${item.title}`}
                            className="w-16 h-10 rounded-lg border-2 border-primary/20 px-2 py-1 text-sm text-center font-bold focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition"
                          />
                          <button
                            onClick={() => handleRemoveFromCart(item.itemId)}
                            aria-label={`Remove ${item.title} from cart`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-300 outline-none transition-colors"
                            type="button"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {cartItems.length > 0 && (
                  <>
                    {/* Payment Type */}
                    <div className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Payment Method</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Cash', 'Card', 'Transfer'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setPaymentType(type)}
                            aria-label={`Pay by ${type}`}
                            aria-pressed={paymentType === type}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/40 outline-none ${
                              paymentType === type
                                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                                : 'bg-white border-2 border-primary/20 text-primaryDark hover:border-primary/40'
                            }`}
                            type="button"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              {type === 'Cash' ? (
                                <>
                                  <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth={2} />
                                  <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
                                </>
                              ) : type === 'Card' ? (
                                <>
                                  <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={2} />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 10h20" />
                                </>
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4 4-4M3 12h11M17 8l4 4-4 4M21 12H10" />
                              )}
                            </svg>
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Discount */}
                    <div className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Discount (Optional)</p>
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => setDiscountType('percentage')}
                          aria-pressed={discountType === 'percentage'}
                          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/40 outline-none ${
                            discountType === 'percentage'
                              ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                              : 'bg-white border-2 border-primary/20 text-primaryDark hover:border-primary/40'
                          }`}
                          type="button"
                        >
                          % Percentage
                        </button>
                        <button
                          onClick={() => setDiscountType('amount')}
                          aria-pressed={discountType === 'amount'}
                          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/40 outline-none ${
                            discountType === 'amount'
                              ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                              : 'bg-white border-2 border-primary/20 text-primaryDark hover:border-primary/40'
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
                          aria-label={discountType === 'percentage' ? 'Discount percentage' : 'Discount amount'}
                          className="w-full rounded-xl border-2 border-primary/20 px-4 py-2.5 text-sm hover:border-primary/40 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition pr-10"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                          {discountType === 'percentage' ? '%' : '$'}
                        </span>
                      </div>
                      {discount > 0 && (
                        <p className="flex items-center gap-1.5 text-xs text-green-600 mt-1 font-medium">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6m-6 4h6m-3 4v-8m-6 8V6a2 2 0 012-2h8a2 2 0 012 2v14l-3-2-3 2-3-2-3 2z" />
                          </svg>
                          Discount: -${formatNumber(discountAmount)}
                        </p>
                      )}
                    </div>

                    {/* Totals */}
                    <div className="space-y-2 p-4 rounded-xl bg-white border-2 border-primary/10 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Subtotal</span>
                        <span className="font-semibold">${formatNumber(cartTotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex items-center justify-between text-sm text-green-600">
                          <span>Discount ({discountType === 'percentage' ? `${discount}%` : `$${formatNumber(discount)}`})</span>
                          <span className="font-semibold">-${formatNumber(discountAmount)}</span>
                        </div>
                      )}
                      {paymentType === 'Card' && (
                        <div className="flex items-center justify-between text-sm text-amber-600">
                          <span>Card Fee (3%)</span>
                          <span className="font-semibold">${formatNumber(convenienceFee)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-lg font-bold pt-2 border-t border-primary/10">
                        <span className="gradient-text">Total</span>
                        <span className="gradient-text">${formatNumber(totalWithFee)}</span>
                      </div>
                    </div>

                    {paymentType === 'Card' && (
                      <p className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 mb-4">
                        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={2} />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 10h20" />
                        </svg>
                        Card payments include a 3% convenience fee.
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowConfirmSale(true)}
                        aria-label="Record sale"
                        className="btn-shine flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 text-sm font-bold text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-emerald-400/50 outline-none transition-all"
                        type="button"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6m-6 4h6m-3 4v-8m-6 8V6a2 2 0 012-2h8a2 2 0 012 2v14l-3-2-3 2-3-2-3 2z" />
                        </svg>
                        Record Sale
                      </button>
                      <button
                        onClick={handleClearCart}
                        aria-label="Clear cart"
                        className="w-full rounded-xl border-2 border-red-200 py-2 text-xs font-bold text-red-600 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-300 outline-none transition-colors"
                        type="button"
                      >
                        Clear Cart
                      </button>
                    </div>
                  </>
                )}

              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast */}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[60] max-w-xs animate-slideDown"
        >
          <div className="flex items-start gap-2 rounded-xl bg-white/95 backdrop-blur px-4 py-3 text-xs font-medium text-blue-700 shadow-2xl ring-1 ring-blue-200 border border-blue-200">
            <svg className="h-4 w-4 flex-shrink-0 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{message}</span>
          </div>
        </div>
      )}

      {/* Confirm Sale Modal */}
      {showConfirmSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn" role="dialog" aria-modal="true" aria-label="Confirm sale">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-[0_25px_80px_rgba(124,58,237,0.25)] ring-1 ring-primary/10 border-2 border-primary/20 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-emerald-100 to-green-100 mb-4">
                <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6m-6 4h6m-3 4v-8m-6 8V6a2 2 0 012-2h8a2 2 0 012 2v14l-3-2-3 2-3-2-3 2z" />
                </svg>
              </div>
              <h3 className="font-display text-2xl gradient-text">Confirm Sale</h3>
              <p className="text-sm text-muted mt-2">
                You&apos;re about to record a sale of {cartItems.length} item(s).
              </p>
            </div>

            <div className="space-y-3 mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Items</span>
                <span className="font-semibold">{cartItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Payment</span>
                <span className="font-semibold">{paymentType}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold pt-2 border-t border-primary/10">
                <span className="gradient-text">Total</span>
                <span className="gradient-text">${formatNumber(totalWithFee)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmSale(false)}
                aria-label="Cancel sale"
                className="flex-1 rounded-full border-2 border-primary/20 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/30 outline-none transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordSale}
                disabled={isSubmittingSale}
                aria-label="Confirm sale"
                className="btn-shine flex flex-[2] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 text-sm font-bold text-white shadow-xl hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-emerald-400/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                {isSubmittingSale ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Recording...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative overflow-hidden bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] py-10 mt-12 text-white">
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
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/70">
              <Link href="/" className="transition-colors hover:text-white">Home</Link>
              <Link href="/catalog" className="transition-colors hover:text-white">Our Catalog</Link>
              <Link href="/contact-us" className="transition-colors hover:text-white">Contact</Link>
              <Link href="/faqs" className="transition-colors hover:text-white">FAQs</Link>
              <Link href="/policies" className="transition-colors hover:text-white">Policies</Link>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 border-t border-white/10 pt-6 text-center text-sm text-white/50 sm:flex-row">
            <p>© {new Date().getFullYear()} Eduvate Kids. Islamic Bookstore.</p>
            <Link href="/auth/login" aria-label="Admin Login" className="group inline-flex items-center justify-center rounded-full p-1.5 text-white/30 transition-all duration-300 hover:bg-white/5 hover:text-white/80">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.418-3.03 7.79-7 9-3.97-1.21-7-4.582-7-9V7l7-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.75 1.75L15 10" />
              </svg>
            </Link>
          </div>
        </div>
      </footer>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScanDetected}
        title="Scan to add to cart"
        hint="Scan a book's barcode or QR code to add it to the cart. You can keep scanning."
      />
    </div>
  )
}
