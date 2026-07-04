'use client'

/**
 * Cart context for Eduvate Kids storefront.
 * - Client-only, persisted to localStorage.
 * - Holds display prices for UX only; the authoritative total is always
 *   recomputed server-side at checkout (see functions/src/orders.ts).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface CartItem {
  id: string
  title: string
  price: number
  image?: string
  quantity: number
}

interface CartContextValue {
  items: CartItem[]
  count: number
  subtotal: number
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void
  removeItem: (id: string) => void
  setQuantity: (id: string, qty: number) => void
  clear: () => void
}

const STORAGE_KEY = 'eduvate-cart'

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Load persisted cart on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setItems(parsed)
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true)
  }, [])

  // Persist on change (after hydration to avoid clobbering on first render).
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [items, hydrated])

  const addItem: CartContextValue['addItem'] = (item, qty = 1) => {
    setItems((current) => {
      const existing = current.find((i) => i.id === item.id)
      if (existing) {
        return current.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + qty } : i
        )
      }
      return [...current, { ...item, quantity: qty }]
    })
    setIsOpen(true)
  }

  const removeItem: CartContextValue['removeItem'] = (id) =>
    setItems((current) => current.filter((i) => i.id !== id))

  const setQuantity: CartContextValue['setQuantity'] = (id, qty) => {
    const q = Math.max(0, Math.floor(qty))
    setItems((current) =>
      q <= 0
        ? current.filter((i) => i.id !== id)
        : current.map((i) => (i.id === id ? { ...i, quantity: q } : i))
    )
  }

  const clear = () => setItems([])

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0)
    const subtotal = Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100
    return {
      items,
      count,
      subtotal,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem,
      removeItem,
      setQuantity,
      clear,
    }
  }, [items, isOpen])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
