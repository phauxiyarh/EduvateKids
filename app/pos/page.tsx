'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase'
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
                sellingPrice: Number(data.sellingPrice ?? 0)
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
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-4 py-2">
          <Link className="flex items-center gap-2 sm:gap-3 min-w-0" href="/">
            <Image src={logo} alt="Eduvate Kids logo" width={32} height={32} className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" />
            <span className="flex flex-col min-w-0">
              <span className="font-display text-base sm:text-lg font-bold truncate">Eduvate Kids</span>
              <span className="text-xs sm:text-sm text-muted hidden sm:block">Point of Sale</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-muted md:flex">
            <Link className="hover:text-primaryDark" href="/">Home</Link>
            <Link className="hover:text-primaryDark" href="/contact-us">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              className="flex items-center gap-2 rounded-full border border-primary/30 bg-white px-5 py-2 text-sm font-semibold text-primaryDark shadow-sm transition hover:-translate-y-0.5"
              href="/auth/login"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden sm:inline">Admin</span>
            </Link>
            <button
              className="flex items-center justify-center w-10 h-10 rounded-xl border border-primary/20 bg-white md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-black/10 bg-white px-6 py-4 space-y-2">
            <Link className="block rounded-xl px-4 py-3 text-sm font-semibold text-muted hover:bg-gray-50" href="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            <Link className="block rounded-xl px-4 py-3 text-sm font-semibold text-muted hover:bg-gray-50" href="/contact-us" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
          </div>
        )}
      </header>

      <main className="mx-auto w-11/12 max-w-6xl py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-emerald-50/50 p-6 shadow-xl border border-emerald-200/50">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 text-3xl shadow-soft">
                  💳
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
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-xl">
                    📚
                  </span>
                  <div>
                    <h3 className="font-display text-xl gradient-text">Inventory Catalog</h3>
                    <span className="text-xs font-semibold text-muted">{inventory.length} items in stock</span>
                  </div>
                </div>

                {/* Search & Filter */}
                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Search by title, publisher, or category..."
                    className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                  />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
                    className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm font-medium hover:border-primary/40 transition-colors"
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
                    <div className="text-center py-12">
                      <p className="text-4xl mb-3">📦</p>
                      <p className="text-sm text-muted">No items found.</p>
                      <p className="text-xs text-muted mt-1">Try adjusting your search or filter.</p>
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
                                className="mt-2 rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-1.5 text-xs font-bold text-white hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                type="button"
                              >
                                {availableQty <= 0 ? 'Out of Stock' : '+ Add'}
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
              <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-emerald-50/50 p-6 shadow-xl border border-emerald-200/50 h-fit lg:sticky lg:top-24">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 text-xl">
                    🛒
                  </span>
                  <div>
                    <h3 className="font-display text-xl gradient-text">Shopping Cart</h3>
                    <p className="text-xs text-muted">{cartItems.length} items</p>
                  </div>
                </div>

                {/* Cart Items */}
                <div className="space-y-3 mb-4 max-h-[280px] overflow-y-auto">
                  {cartItems.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-3xl mb-2">🛒</p>
                      <p className="text-xs text-muted">Cart is empty</p>
                      <p className="text-[10px] text-muted mt-1">Add items from the catalog</p>
                    </div>
                  ) : (
                    cartItems.map((item) => (
                      <div key={item.itemId} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
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
                            className="w-14 rounded-lg border-2 border-primary/20 px-2 py-1 text-xs text-center font-bold"
                          />
                          <button
                            onClick={() => handleRemoveFromCart(item.itemId)}
                            className="text-xs font-bold text-red-600 hover:text-red-700 px-2"
                            type="button"
                          >
                            ✕
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
                            className={`rounded-xl py-2 text-xs font-bold transition-all ${
                              paymentType === type
                                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                                : 'bg-white border-2 border-primary/20 text-primaryDark hover:border-primary/40'
                            }`}
                            type="button"
                          >
                            {type === 'Cash' ? '💵' : type === 'Card' ? '💳' : '🏦'} {type}
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
                          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
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
                          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
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
                          className="w-full rounded-xl border-2 border-primary/20 px-4 py-2.5 text-sm hover:border-primary/40 transition-colors pr-10"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                          {discountType === 'percentage' ? '%' : '$'}
                        </span>
                      </div>
                      {discount > 0 && (
                        <p className="text-xs text-green-600 mt-1 font-medium">
                          💰 Discount: -${formatNumber(discountAmount)}
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
                      <p className="text-[10px] text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 mb-4">
                        💳 Card payments include a 3% convenience fee.
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowConfirmSale(true)}
                        className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 text-sm font-bold text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
                        type="button"
                      >
                        💰 Record Sale
                      </button>
                      <button
                        onClick={handleClearCart}
                        className="w-full rounded-xl border-2 border-red-200 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                        type="button"
                      >
                        Clear Cart
                      </button>
                    </div>
                  </>
                )}

                {message && (
                  <p className="mt-4 text-xs text-center px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                    {message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Confirm Sale Modal */}
      {showConfirmSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border-2 border-primary/20">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-emerald-100 to-green-100 text-3xl mb-4">
                💰
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
                className="flex-1 rounded-full border-2 border-primary/20 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordSale}
                disabled={isSubmittingSale}
                className="flex-[2] rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 text-sm font-bold text-white shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
                type="button"
              >
                {isSubmittingSale ? 'Recording...' : '✓ Confirm Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-black/10 bg-white py-8 mt-12">
        <div className="mx-auto w-11/12 max-w-6xl text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Image src={logo} alt="Eduvate Kids" width={24} height={24} />
            <span className="font-display font-bold text-primaryDark">Eduvate Kids</span>
          </Link>
          <p className="text-xs text-muted">© {new Date().getFullYear()} Eduvate Kids. Islamic Bookstore.</p>
        </div>
      </footer>
    </div>
  )
}
