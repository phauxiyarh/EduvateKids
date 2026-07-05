'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  serverTimestamp
} from 'firebase/firestore'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid
} from 'recharts'
import { httpsCallable } from 'firebase/functions'
import QRCode from 'qrcode'
import { auth, db, functions } from '../../lib/firebase'
import { isAdminHostAllowed } from '../../lib/adminAccess'
import { uploadCatalogImage } from '../../lib/uploadImage'
import { BarcodeScanner } from '../components/BarcodeScanner'
import logo from '../../assets/logo.png'
import bg1 from '../../assets/bg1.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'

type InventoryCategory = 'Books' | 'Activity Books' | 'Cards' | 'Crafts' | 'Puzzles' | 'Games' | 'Gifts' | 'Others'

const ALL_CATALOG_CATEGORIES: InventoryCategory[] = ['Books', 'Activity Books', 'Cards', 'Crafts', 'Puzzles', 'Games', 'Gifts', 'Others']

type InventoryItem = {
  id: string
  title: string
  category: InventoryCategory
  publisher: string
  sku: string
  isbn: string
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
  rrp: number
  sellingPrice: number
}

type OrderItem = {
  itemId: string
  title: string
  price: number
  quantity: number
  lineTotal: number
}

type Order = {
  id: string
  items: OrderItem[]
  subtotal: number
  discount: number
  discountType: 'percentage' | 'amount'
  discountValue: number
  convenienceFee: number
  paymentType: 'Cash' | 'Card' | 'Transfer'
  total: number
  timestamp: string
  eventId: string
}

type CartItem = {
  itemId: string
  title: string
  price: number
  quantity: number
}

/** Online store order (written by the Stripe webhook to the `orders` collection). */
type OnlineOrderItem = { id: string; title: string; quantity: number; unitPrice: number; lineTotal: number }
type OnlineOrder = {
  id: string
  items: OnlineOrderItem[]
  subtotal: number
  shippingFee: number
  tax?: number
  total: number
  currency: string
  customer: { name: string; email: string; phone?: string }
  shippingAddress: { line1: string; line2?: string; city: string; state: string; postalCode: string; country: string }
  paymentProvider: string
  paymentRef: string
  status: 'pending' | 'paid' | 'failed' | 'shipped' | 'cancelled'
  createdAt?: { seconds: number } | null
  paidAt?: { seconds: number } | null
  shippedAt?: { seconds: number } | null
}

/** Summer Reading Program registration (written to the `summerReads` collection). */
type SummerBookLog = { title: string; author?: string; rating?: number; review?: string; dateFinished?: string; dateLogged?: string }
type SummerReader = {
  id: string
  code: string
  childName: string
  dateOfBirth?: string
  childAge?: number
  parentName: string
  parentEmail: string
  parentPhone?: string
  booksCount: number
  tier: 'seedling' | 'reader' | 'scholar' | 'none' | string
  booksLogged?: SummerBookLog[]
  createdAt?: { seconds: number } | null
}

type EventStatus = 'active' | 'closed'

type Expense = {
  id: string
  description: string
  amount: number
  category: 'Transport' | 'Supplies' | 'Food' | 'Printing' | 'Decoration' | 'Other'
  date: string
}

type EventRecord = {
  id: string
  name: string
  cost: number
  startDate: string
  endDate: string
  location: string
  type: 'Bazaar' | 'Bookfair' | 'Jummah Boot'
  status: EventStatus
  sales: Sale[]
  orders: Order[]
  expenses: Expense[]
}

type AgeCategory = '0-5' | '6-9' | '10+' | 'Adult'

const AGE_CATEGORIES: Record<AgeCategory, { range: string; title: string }> = {
  '0-5': { range: '0-5 years', title: 'Little Imaan Explorers' },
  '6-9': { range: '6-9 years', title: 'Deen Explorers' },
  '10+': { range: '10+ years', title: 'Young Scholars' },
  'Adult': { range: 'Adult', title: 'Wisdom Seekers' }
}

// Simple lower-bound "N+" label for an age category (public catalogue style).
const AGE_SHORT_LABEL: Record<AgeCategory, string> = {
  '0-5': '3+',
  '6-9': '6+',
  '10+': '10+',
  'Adult': 'Adult'
}
const ageShortLabel = (age: string): string =>
  AGE_SHORT_LABEL[age as AgeCategory] || age

// Migration map for old age categories to new ones
const MIGRATE_AGE_CATEGORY = (oldCategory: string): AgeCategory => {
  const migrations: Record<string, AgeCategory> = {
    '0-3': '0-5',
    '4-6': '6-9',
    '7-9': '6-9',
    '10-12': '10+',
    '13+': '10+'
  }
  return (migrations[oldCategory] as AgeCategory) || (oldCategory as AgeCategory)
}

type CatalogItem = {
  id: string
  title: string
  description: string
  category: InventoryCategory[]
  ageCategory: AgeCategory[]
  price: number
  publisher: string
  images: string[]
  createdAt: string
  sku?: string
}

const defaultInventory: InventoryItem[] = [
  {
    id: 'inv-1',
    title: 'My First Quran Stories',
    category: 'Books',
    publisher: 'Noor Press',
    sku: '',
    isbn: '',
    rrp: 22,
    discount: 10,
    quantity: 14,
    sellingPrice: 19.8
  },
  {
    id: 'inv-2',
    title: 'Ramadan Activity Kit',
    category: 'Crafts',
    publisher: 'Little Lanterns',
    sku: '',
    isbn: '',
    rrp: 35,
    discount: 5,
    quantity: 9,
    sellingPrice: 33.25
  },
  {
    id: 'inv-3',
    title: 'Hajj Adventure Puzzle',
    category: 'Puzzles',
    publisher: 'Kite & Compass',
    sku: '',
    isbn: '',
    rrp: 28,
    discount: 0,
    quantity: 12,
    sellingPrice: 28
  },
  {
    id: 'inv-4',
    title: 'Eid Gift Bundle',
    category: 'Gifts',
    publisher: 'Barakah Box',
    sku: '',
    isbn: '',
    rrp: 40,
    discount: 12,
    quantity: 6,
    sellingPrice: 35.2
  }
]

const defaultEvents: EventRecord[] = [
  {
    id: 'event-1',
    name: 'Masjid Book Fair',
    cost: 120,
    startDate: '2026-02-02',
    endDate: '2026-02-03',
    location: 'Downtown Masjid',
    type: 'Bookfair',
    status: 'active',
    sales: [],
    orders: [],
    expenses: []
  },
  {
    id: 'event-2',
    name: 'School Literacy Night',
    cost: 80,
    startDate: '2026-01-12',
    endDate: '2026-01-12',
    location: 'Greenwood School',
    type: 'Bazaar',
    status: 'closed',
    sales: [],
    orders: [],
    expenses: []
  }
]


const restockThreshold = 10

const parseNumber = (value: unknown) => {
  if (typeof value === 'number') return value
  const cleaned = String(value ?? '').replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeInventoryItem = (data: Partial<InventoryItem>, id: string): InventoryItem => {
  const title = String(data.title ?? '').trim()
  const categoryInput = String(data.category ?? 'Books').trim()
  const category =
    (['Books', 'Crafts', 'Puzzles', 'Gifts'].find(
      (item) => item.toLowerCase() === categoryInput.toLowerCase()
    ) as InventoryCategory) ?? 'Books'
  const rrp = parseNumber(data.rrp)
  const discount = parseNumber(data.discount)
  const quantity = Math.max(0, Math.round(parseNumber(data.quantity)))
  const sellingPriceRaw = parseNumber(data.sellingPrice)
  const sellingPrice = sellingPriceRaw || Number((rrp * (1 - discount / 100)).toFixed(2))

  return {
    id,
    title,
    category,
    publisher: String(data.publisher ?? '').trim(),
    sku: String(data.sku ?? '').trim(),
    isbn: String(data.isbn ?? '').trim(),
    rrp,
    discount,
    quantity,
    sellingPrice
  }
}

const normalizeSale = (data: Partial<Sale>): Sale | null => {
  const title = String(data.title ?? '').trim()
  if (!title) return null
  const quantity = Math.max(1, Math.round(parseNumber(data.quantity)))
  const total = parseNumber(data.total)
  const paymentType =
    data.paymentType === 'Card' || data.paymentType === 'Transfer' ? data.paymentType : 'Cash'

  return {
    id: String(data.id ?? `sale-${Date.now()}`),
    itemId: String(data.itemId ?? ''),
    title,
    quantity,
    paymentType,
    total: Number.isFinite(total) ? total : 0,
    timestamp: String(data.timestamp ?? new Date().toISOString()),
    rrp: parseNumber((data as any).rrp),
    sellingPrice: parseNumber((data as any).sellingPrice)
  }
}

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const headerMap: Record<string, keyof InventoryItem> = {
  title: 'title',
  category: 'category',
  publisher: 'publisher',
  rrp: 'rrp',
  discount: 'discount',
  quantity: 'quantity',
  'selling price': 'sellingPrice',
  'sellingprice': 'sellingPrice',
  'discount percent': 'discount',
  'discount %': 'discount',
  'recommended retail price': 'rrp'
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('admin')
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eduvate-demo-mode')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })
  const [activeView, setActiveView] = useState<'home' | 'inventory' | 'events' | 'pos' | 'catalog' | 'orders' | 'summer'>(
    'home'
  )
  const [orders, setOrders] = useState<OnlineOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'paid' | 'shipped'>('all')
  const [expandedOrder, setExpandedOrder] = useState<OnlineOrder | null>(null)
  const [summerReaders, setSummerReaders] = useState<SummerReader[]>([])
  const [summerLoading, setSummerLoading] = useState(false)
  const [expandedReader, setExpandedReader] = useState<SummerReader | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>(() => demoMode ? defaultInventory : [])
  const [events, setEvents] = useState<EventRecord[]>(() => demoMode ? defaultEvents : [])
  const [generalSales, setGeneralSales] = useState<Sale[]>([])
  const [uploadMessage, setUploadMessage] = useState<string>('')
  // Inventory item that has no matching catalogue entry; prompts the admin to add images/description.
  const [noCatalogPrompt, setNoCatalogPrompt] = useState<InventoryItem | null>(null)
  const [catalogLinkMessage, setCatalogLinkMessage] = useState('')
  const [inventorySortKey, setInventorySortKey] = useState<keyof InventoryItem | ''>('')
  const [inventorySortDir, setInventorySortDir] = useState<'asc' | 'desc'>('asc')
  const [eventMessage, setEventMessage] = useState('')
  const [newEventName, setNewEventName] = useState('')
  const [newEventCost, setNewEventCost] = useState('')
  const [newEventStart, setNewEventStart] = useState('')
  const [newEventEnd, setNewEventEnd] = useState('')
  const [newEventLocation, setNewEventLocation] = useState('')
  const [newEventType, setNewEventType] =
    useState<EventRecord['type']>('Bazaar')
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [eventTypeFilter, setEventTypeFilter] = useState<'All' | EventRecord['type']>(
    'All'
  )
  const [eventDateStart, setEventDateStart] = useState('')
  const [eventDateEnd, setEventDateEnd] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [addQuantity, setAddQuantity] = useState(1)
  const [paymentType, setPaymentType] = useState<Sale['paymentType']>('Cash')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showConfirmSale, setShowConfirmSale] = useState(false)
  const [isSubmittingSale, setIsSubmittingSale] = useState(false)
  const [isSavingInventory, setIsSavingInventory] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage')
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null)
  const [viewingEventTransactions, setViewingEventTransactions] = useState<EventRecord | null>(null)
  const [editEventName, setEditEventName] = useState('')
  const [editEventCost, setEditEventCost] = useState('')
  const [editEventStart, setEditEventStart] = useState('')
  const [editEventEnd, setEditEventEnd] = useState('')
  const [editEventLocation, setEditEventLocation] = useState('')
  const [editEventType, setEditEventType] = useState<EventRecord['type']>('Bazaar')
  const [editEventStatus, setEditEventStatus] = useState<EventStatus>('active')
  const [viewingOrderHistory, setViewingOrderHistory] = useState<EventRecord | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editOrderItems, setEditOrderItems] = useState<OrderItem[]>([])
  const [editOrderPaymentType, setEditOrderPaymentType] = useState<Sale['paymentType']>('Cash')
  const [generalOrders, setGeneralOrders] = useState<Order[]>([])

  // Expense state
  const [viewingExpenses, setViewingExpenses] = useState<EventRecord | null>(null)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState<Expense['category']>('Other')
  const [expenseDate, setExpenseDate] = useState('')
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  // Inventory edit state
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null)
  const [showAddInventoryItem, setShowAddInventoryItem] = useState(false)
  const [inventoryScannerOpen, setInventoryScannerOpen] = useState(false)
  // QR bind + label workflow (inventory)
  const [bindTargetItem, setBindTargetItem] = useState<InventoryItem | null>(null)
  const [qrModalItem, setQrModalItem] = useState<InventoryItem | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [invEditTitle, setInvEditTitle] = useState('')
  const [invEditCategory, setInvEditCategory] = useState<InventoryCategory>('Books')
  const [invEditPublisher, setInvEditPublisher] = useState('')
  const [invEditSku, setInvEditSku] = useState('')
  const [invEditIsbn, setInvEditIsbn] = useState('')
  const [invEditRrp, setInvEditRrp] = useState('')
  const [invEditDiscount, setInvEditDiscount] = useState('')
  const [invEditQuantity, setInvEditQuantity] = useState('')
  const [invEditSellingPrice, setInvEditSellingPrice] = useState('')

  // Catalog state
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [showCreateCatalog, setShowCreateCatalog] = useState(false)
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null)
  const [catalogTitle, setCatalogTitle] = useState('')
  const [catalogDescription, setCatalogDescription] = useState('')
  const [catalogCategories, setCatalogCategories] = useState<InventoryCategory[]>(['Books'])
  const [catalogAge, setCatalogAge] = useState<AgeCategory[]>(['0-5'])
  const [catalogPrice, setCatalogPrice] = useState('')
  const [catalogPublisher, setCatalogPublisher] = useState('')
  const [catalogSku, setCatalogSku] = useState('')
  const [catalogQty, setCatalogQty] = useState('')
  const [catalogSellingPrice, setCatalogSellingPrice] = useState('')
  const [catalogImages, setCatalogImages] = useState<File[]>([])
  const [catalogImagePreviews, setCatalogImagePreviews] = useState<string[]>([])
  const [catalogExistingImages, setCatalogExistingImages] = useState<string[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<'All' | InventoryCategory>('All')
  const [isUploadingCatalog, setIsUploadingCatalog] = useState(false)
  const [catalogMessage, setCatalogMessage] = useState('')
  const [catalogSliderIndex, setCatalogSliderIndex] = useState<Record<string, number>>({})

  useEffect(() => {
    // Admin backend only permitted from the canonical host; bounce others home.
    if (!isAdminHostAllowed()) {
      router.push('/')
      return
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        // Fetch user role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
          if (userDoc.exists()) {
            const role = userDoc.data().role || 'admin'
            setUserRole(role)
            // Redirect cashiers to POS view
            if (role === 'cashier') {
              setActiveView('pos')
            }
          }
        } catch (error) {
          console.error('Error fetching user role:', error)
        }
        setLoading(false)
      } else {
        router.push('/auth/login')
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleToggleDemoMode = () => {
    const newMode = !demoMode
    setDemoMode(newMode)
    localStorage.setItem('eduvate-demo-mode', String(newMode))
  }

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const loadData = async () => {
      try {
        if (demoMode) {
          // Demo mode: use hardcoded sample data
          if (!cancelled) {
            setInventory(defaultInventory)
            setEvents(defaultEvents)
            setGeneralSales([])
          }
        } else {
          // Live mode: load real data from Firestore
          const inventoryRef = collection(db, 'inventory')
          const eventsRef = collection(db, 'events')
          const generalSalesRef = collection(db, 'generalSales')
          const generalOrdersRef = collection(db, 'generalOrders')
          const [inventorySnap, eventsSnap, generalSalesSnap, generalOrdersSnap] = await Promise.all([
            getDocs(inventoryRef),
            getDocs(eventsRef),
            getDocs(generalSalesRef),
            getDocs(generalOrdersRef)
          ])

          // Check for a flag that indicates the user has real data
          // Items created/uploaded in live mode are tagged with _live: true
          if (!cancelled) {
            const loadedInventory = inventorySnap.docs
              .filter((snap) => snap.data()._live === true)
              .map((snap) => normalizeInventoryItem(snap.data() as Partial<InventoryItem>, snap.id))
              .filter((item) => item.title)
            setInventory(loadedInventory)

            const loadedEvents = eventsSnap.docs
              .filter((snap) => snap.data()._live === true)
              .map((snap) => {
                const data = snap.data() as Partial<EventRecord>
                const sales = Array.isArray(data.sales)
                  ? (data.sales as Partial<Sale>[])
                      .map((sale) => normalizeSale(sale))
                      .filter((sale): sale is Sale => Boolean(sale))
                  : []

                return {
                  id: snap.id,
                  name: String(data.name ?? ''),
                  cost: Number(data.cost ?? 0),
                  startDate: String(data.startDate ?? ''),
                  endDate: String(data.endDate ?? ''),
                  location: String(data.location ?? ''),
                  type: (data.type ?? 'Bazaar') as EventRecord['type'],
                  status: (data.status ?? 'closed') as EventStatus,
                  sales,
                  orders: Array.isArray(data.orders) ? data.orders as Order[] : [],
                  expenses: Array.isArray(data.expenses) ? data.expenses as Expense[] : []
                }
              })

            // ── Recover missing orders/sales from localStorage backup ──
            const recoveredEvents: EventRecord[] = []
            const eventsToResync: EventRecord[] = []
            for (const event of loadedEvents) {
              try {
                const backupOrdersRaw = localStorage.getItem(`eduvate-orders-${event.id}`)
                const backupSalesRaw = localStorage.getItem(`eduvate-sales-${event.id}`)
                if (backupOrdersRaw) {
                  const backupOrders = JSON.parse(backupOrdersRaw) as Order[]
                  const backupSales = backupSalesRaw ? JSON.parse(backupSalesRaw) as Sale[] : null
                  if (backupOrders.length > event.orders.length) {
                    console.warn(`[Recovery] Event "${event.name}": Firebase has ${event.orders.length} orders, localStorage has ${backupOrders.length}. Restoring.`)
                    const restored = {
                      ...event,
                      orders: backupOrders,
                      sales: backupSales && backupSales.length > event.sales.length ? backupSales : event.sales
                    }
                    recoveredEvents.push(restored)
                    eventsToResync.push(restored)
                    continue
                  }
                }
              } catch { /* ignore */ }
              recoveredEvents.push(event)
            }
            setEvents(recoveredEvents)

            // Re-push recovered data back to Firebase so it persists
            for (const event of eventsToResync) {
              try {
                await updateDoc(doc(db, 'events', event.id), {
                  orders: event.orders,
                  sales: event.sales,
                  _live: true
                })
                console.log(`[Recovery] Re-synced "${event.name}" to Firebase (${event.orders.length} orders, ${event.sales.length} sales).`)
              } catch (err) {
                console.error(`[Recovery] Failed to re-sync "${event.name}":`, err)
              }
            }

            const loadedGeneralSales = generalSalesSnap.docs
              .filter((snap) => snap.data()._live === true)
              .map((snap) => normalizeSale(snap.data() as Partial<Sale>))
              .filter((sale): sale is Sale => Boolean(sale))
            setGeneralSales(loadedGeneralSales)

            const loadedGeneralOrders = generalOrdersSnap.docs
              .filter((snap) => snap.data()._live === true)
              .map((snap) => snap.data() as Order)
            setGeneralOrders(loadedGeneralOrders)
          }
        }

        // Always load catalog items from Firestore (not affected by demo mode)
        const catalogSnap = await getDocs(collection(db, 'catalog'))
        if (!cancelled) {
          if (!catalogSnap.empty) {
            const loadedCatalog = await Promise.all(catalogSnap.docs.map(async (snap) => {
              const data = snap.data() as Partial<CatalogItem>
              // Handle both array and single category for backward compatibility
              const categoryData = data.category
              const categoryArray: InventoryCategory[] = Array.isArray(categoryData)
                ? categoryData
                : categoryData
                ? [categoryData as InventoryCategory]
                : ['Books']
              
              // Handle age category as array or single value
              const ageData = data.ageCategory
              let ageArray: AgeCategory[]
              
              if (Array.isArray(ageData)) {
                // Already an array, migrate any old values
                ageArray = ageData.map(age => MIGRATE_AGE_CATEGORY(String(age)))
              } else {
                // Single value, migrate and convert to array
                const migratedAge = MIGRATE_AGE_CATEGORY(String(ageData ?? '0-5'))
                ageArray = [migratedAge]
                
                // Update Firestore to array format
                try {
                  await updateDoc(doc(db, 'catalog', snap.id), {
                    ageCategory: ageArray
                  })
                } catch (err) {
                  console.error('Failed to migrate age category for', snap.id, err)
                }
              }
              
              return {
                id: snap.id,
                title: String(data.title ?? ''),
                description: String(data.description ?? ''),
                category: categoryArray,
                ageCategory: ageArray,
                price: Number(data.price ?? 0),
                publisher: String(data.publisher ?? ''),
                images: Array.isArray(data.images) ? data.images : [],
                createdAt: String(data.createdAt ?? new Date().toISOString())
              }
            }))
            setCatalogItems(loadedCatalog)
          } else {
            setCatalogItems([])
          }
        }
      } catch (error) {
        console.error('Firestore load error:', error)
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [user, demoMode])

  useEffect(() => {
    const activeEvent = events.find((event) => event.status === 'active')
    if (activeEvent && !selectedEventId) {
      setSelectedEventId(activeEvent.id)
    }
  }, [events, selectedEventId])

  const restockItems = useMemo(
    () =>
      inventory
        .filter((item) => item.quantity <= restockThreshold)
        .sort((a, b) => a.quantity - b.quantity),
    [inventory]
  )

  const filteredInventory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return inventory
    return inventory.filter((item) =>
      [item.title, item.publisher, item.category].some((field) =>
        field.toLowerCase().includes(query)
      )
    )
  }, [inventory, searchQuery])

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
  const convenienceFeeRate = paymentType === 'Card' ? 0.03 : 0
  const convenienceFee = Number((subtotalAfterDiscount * convenienceFeeRate).toFixed(2))
  const totalWithFee = Number((subtotalAfterDiscount + convenienceFee).toFixed(2))

  const allSales = useMemo(
    () =>
      [
        ...events.flatMap((event) =>
          event.sales.map((sale) => ({
            ...sale,
            eventId: event.id,
            eventName: event.name
          }))
        ),
        ...generalSales.map((sale) => ({
          ...sale,
          eventId: 'general',
          eventName: 'General Sales'
        }))
      ],
    [events, generalSales]
  )

  const bestSellers = useMemo(() => {
    const tally = new Map<string, { title: string; quantity: number; revenue: number }>()
    allSales.forEach((sale) => {
      const current = tally.get(sale.title) ?? {
        title: sale.title,
        quantity: 0,
        revenue: 0
      }
      current.quantity += sale.quantity
      current.revenue += sale.total
      tally.set(sale.title, current)
    })

    return Array.from(tally.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  }, [allSales])

  const categoryMix = useMemo(() => {
    const buckets = new Map<InventoryCategory, number>()
    inventory.forEach((item) => {
      buckets.set(item.category, (buckets.get(item.category) ?? 0) + item.quantity)
    })
    const labels = ['Books', 'Crafts', 'Puzzles', 'Gifts']
    const values = labels.map((label) => buckets.get(label as InventoryCategory) ?? 0)
    return { labels, values }
  }, [inventory])

  const eventTypeBadgeClasses: Record<EventRecord['type'], string> = {
    Bazaar: 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border border-amber-200',
    Bookfair: 'bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 border border-emerald-200',
    'Jummah Boot': 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-700 border border-indigo-200'
  }

  const filteredEvents = useMemo(() => {
    const matchesType = (event: EventRecord) =>
      eventTypeFilter === 'All' || event.type === eventTypeFilter

    const matchesDate = (event: EventRecord) => {
      if (!eventDateStart && !eventDateEnd) return true
      const start = event.startDate ? new Date(event.startDate) : null
      const end = event.endDate ? new Date(event.endDate) : null
      const filterStart = eventDateStart ? new Date(eventDateStart) : null
      const filterEnd = eventDateEnd ? new Date(eventDateEnd) : null

      if (!start || !end) return false
      const rangeStart = filterStart ?? start
      const rangeEnd = filterEnd ?? end
      return start <= rangeEnd && end >= rangeStart
    }

    return events
      .filter((event) => matchesType(event) && matchesDate(event))
      .sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0
        return dateB - dateA
      })
  }, [events, eventTypeFilter, eventDateStart, eventDateEnd])

  const bestEvent = useMemo(() => {
    if (!events.length) return null
    const ranked = events
      .map((event) => {
        const totalSales = event.sales.reduce((sum, sale) => sum + sale.total, 0)
        return { ...event, totalSales }
      })
      .sort((a, b) => b.totalSales - a.totalSales)

    return ranked[0]
  }, [events])

  const salesTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      date.setHours(0, 0, 0, 0)
      return date
    })

    const labels = days.map((day) =>
      day.toLocaleDateString('en-US', { weekday: 'short' })
    )

    const values = days.map((day) => {
      const start = new Date(day)
      const end = new Date(day)
      end.setHours(23, 59, 59, 999)
      return allSales
        .filter((sale) => {
          const timestamp = new Date(sale.timestamp)
          return timestamp >= start && timestamp <= end
        })
        .reduce((sum, sale) => sum + sale.total, 0)
    })

    return { labels, values }
  }, [allSales])

  const paymentBreakdown = useMemo(() => {
    const buckets: Record<string, number> = {}
    allSales.forEach((sale) => {
      const type = sale.paymentType || 'Cash'
      buckets[type] = (buckets[type] ?? 0) + sale.total
    })
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }, [allSales])

  const eventRevenue = useMemo(() => {
    return events
      .map((event) => {
        const totalExpenses = event.expenses.reduce((s, e) => s + e.amount, 0)
        const totalCost = event.cost + totalExpenses
        const revenue = event.sales.reduce((sum, sale) => sum + sale.total, 0)
        const markup = event.sales.reduce((sum, sale) => sum + (sale.sellingPrice - sale.rrp) * sale.quantity, 0)
        return {
          name: event.name.length > 15 ? event.name.slice(0, 15) + '…' : event.name,
          revenue,
          cost: totalCost,
          profit: markup - totalCost
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
  }, [events])

  // Online store orders (Stripe) revenue + count. Paid or shipped orders count as revenue.
  const onlineOrderStats = useMemo(() => {
    const countable = orders.filter((o) => o.status === 'paid' || o.status === 'shipped')
    const revenue = countable.reduce((sum, o) => sum + (o.total || 0), 0)
    return { count: orders.length, revenue }
  }, [orders])

  const summaryCards = useMemo(() => {
    const posEventSales = allSales.reduce((sum, sale) => sum + sale.total, 0)
    const transactionCount = allSales.length
    // Combined sales: POS/event sales plus online store order revenue.
    const totalSales = posEventSales + onlineOrderStats.revenue

    return [
      {
        label: 'Total Sales',
        value: totalSales,
        note: `${transactionCount} POS/event + ${onlineOrderStats.count} online`,
        prefix: '$',
        icon: 'sales'
      },
      {
        label: 'Online Orders',
        value: onlineOrderStats.revenue,
        note: `${onlineOrderStats.count} orders placed`,
        prefix: '$',
        icon: 'orders'
      },
      {
        label: 'Low Stock Items',
        value: restockItems.length,
        note: `Restock threshold: ${restockThreshold}`,
        icon: 'stock'
      },
      {
        label: 'Active Events',
        value: events.filter((event) => event.status === 'active').length,
        note: `${events.length} total events`,
        icon: 'events'
      },
      {
        label: 'Catalog Size',
        value: inventory.length,
        note: 'Books & kits',
        icon: 'catalog'
      }
    ]
  }, [allSales, events, inventory.length, restockItems.length, onlineOrderStats])

  const formatNumber = (value: number) => value.toLocaleString('en-US')

  // ── TXT Receipt Reference File ──────────────────────────────────
  const generateEventTxt = (eventName: string, orders: Order[]) => {
    const lines: string[] = []
    lines.push('═'.repeat(60))
    lines.push(`  EDUVATE KIDS - ${eventName.toUpperCase()}`)
    lines.push(`  Generated: ${new Date().toLocaleString()}`)
    lines.push('═'.repeat(60))
    lines.push('')

    if (orders.length === 0) {
      lines.push('No orders recorded.')
    } else {
      orders.forEach((order, idx) => {
        lines.push(`── Order #${orders.length - idx} ${'─'.repeat(40)}`)
        lines.push(`  Date/Time : ${new Date(order.timestamp).toLocaleString()}`)
        lines.push(`  Payment   : ${order.paymentType}`)
        lines.push(`  Items:`)
        order.items.forEach((item) => {
          lines.push(`    ${item.quantity}× ${item.title}  -  $${item.lineTotal.toFixed(2)}`)
        })
        lines.push(`  Subtotal      : $${order.subtotal.toFixed(2)}`)
        if (order.discount > 0) {
          lines.push(`  Discount (${order.discountType === 'percentage' ? `${order.discountValue}%` : `$${order.discountValue}`}) : -$${order.discount.toFixed(2)}`)
        }
        if (order.convenienceFee > 0) {
          lines.push(`  Card Fee (3%) : +$${order.convenienceFee.toFixed(2)}`)
        }
        lines.push(`  TOTAL         : $${order.total.toFixed(2)}`)
        lines.push('')
      })

      lines.push('═'.repeat(60))
      lines.push('  SUMMARY')
      lines.push('═'.repeat(60))
      const totalRevenue = orders.reduce((s, o) => s + o.total, 0)
      const totalItems = orders.reduce((s, o) => s + o.items.reduce((x, i) => x + i.quantity, 0), 0)
      lines.push(`  Total Orders  : ${orders.length}`)
      lines.push(`  Total Revenue : $${totalRevenue.toFixed(2)}`)
      lines.push(`  Items Sold    : ${totalItems}`)
      lines.push(`  Avg. Order    : $${(orders.length > 0 ? totalRevenue / orders.length : 0).toFixed(2)}`)
    }
    lines.push('')
    lines.push('═'.repeat(60))
    return lines.join('\n')
  }

  const downloadEventTxt = (eventName: string, orders: Order[]) => {
    const content = generateEventTxt(eventName, orders)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const safeName = eventName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    link.download = `eduvate-orders-${safeName}-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/auth/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const persistInventory = async (items: InventoryItem[]) => {
    try {
      const inventoryRef = collection(db, 'inventory')
      const batch = writeBatch(db)
      items.forEach((item) => {
        batch.set(doc(inventoryRef, item.id), { ...item, _live: true })
      })
      await batch.commit()
    } catch (error) {
      console.error('Inventory sync error:', error)
      setUploadMessage('Saved locally, but failed to sync to Firestore.')
    }
  }

  const handleDownloadTemplate = () => {
    const rows = [
      ['Title', 'Category', 'Publisher', 'RRP', 'Discount %', 'Quantity', 'Selling Price'],
      ['Sample Title', 'Books', 'Sample Publisher', 20, 10, 5, 18]
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory')

    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([output], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'eduvate-inventory-template.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportStock = () => {
    if (inventory.length === 0) {
      setUploadMessage('No inventory data to export.')
      return
    }
    const header = ['Title', 'Category', 'Publisher', 'RRP', 'Discount %', 'Quantity', 'Selling Price']
    const rows = inventory.map((item) => [
      item.title, item.category, item.publisher, item.rrp, item.discount, item.quantity, item.sellingPrice
    ])
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock')
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([output], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const date = new Date().toISOString().slice(0, 10)
    link.download = `eduvate-stock-export-${date}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleInventoryUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: ''
      }) as Array<Array<string | number>>

      if (!rows.length) {
        setUploadMessage('No rows found in the file.')
        return
      }

      const headerRow = rows[0].map((value) => String(value))
      const normalizedHeaders = headerRow.map(normalizeHeader)
      const headerMatches = normalizedHeaders.filter(
        (header) => headerMap[header]
      )
      const hasHeader = headerMatches.length >= 3

      const parsedItems: InventoryItem[] = []

      rows.slice(hasHeader ? 1 : 0).forEach((row, index) => {
        const rowValues = row.map((cell) => (cell ?? '').toString())
        const rowData: Partial<InventoryItem> = {}

        if (hasHeader) {
          normalizedHeaders.forEach((header, colIndex) => {
            const key = headerMap[header]
            if (!key) return
            rowData[key] = rowValues[colIndex] as never
          })
        } else {
          ;[rowData.title, rowData.category, rowData.publisher, rowData.rrp, rowData.discount, rowData.quantity, rowData.sellingPrice] =
            rowValues as never[]
        }

        const title = String(rowData.title ?? '').trim()
        if (!title) return

        const categoryInput = String(rowData.category ?? 'Books').trim()
        const category =
          (['Books', 'Crafts', 'Puzzles', 'Gifts'].find(
            (item) => item.toLowerCase() === categoryInput.toLowerCase()
          ) as InventoryCategory) ?? 'Books'

        const rrp = parseNumber(rowData.rrp)
        const discount = parseNumber(rowData.discount)
        const quantity = Math.max(0, Math.round(parseNumber(rowData.quantity)))
        const sellingPriceRaw = parseNumber(rowData.sellingPrice)
        const sellingPrice =
          sellingPriceRaw || Number((rrp * (1 - discount / 100)).toFixed(2))

        parsedItems.push({
          id: `inv-${Date.now()}-${index}`,
          title,
          category,
          publisher: String(rowData.publisher ?? '').trim(),
          sku: String(rowData.sku ?? '').trim(),
          isbn: String(rowData.isbn ?? '').trim(),
          rrp,
          discount,
          quantity,
          sellingPrice
        })
      })

      if (!parsedItems.length) {
        setUploadMessage('No valid rows found. Please check the spreadsheet format.')
        return
      }

      let added = 0
      let updated = 0
      const currentInventory = [...inventory]

      parsedItems.forEach((item) => {
        const matchIndex = currentInventory.findIndex(
          (existing) =>
            existing.title.toLowerCase() === item.title.toLowerCase() &&
            existing.publisher.toLowerCase() === item.publisher.toLowerCase()
        )

        if (matchIndex >= 0) {
          const existing = currentInventory[matchIndex]
          currentInventory[matchIndex] = {
            ...existing,
            ...item,
            quantity: existing.quantity + item.quantity
          }
          updated += 1
        } else {
          currentInventory.push(item)
          added += 1
        }
      })

      setInventory(currentInventory)
      setUploadMessage(`Upload complete. Added ${added} items, updated ${updated}.`)
      await persistInventory(currentInventory)
    } catch (error) {
      console.error('Upload error:', error)
      setUploadMessage('Upload failed. Please check the .xlsx file and try again.')
    }
  }

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) return
    const costValue = parseNumber(newEventCost)
    if (!newEventStart || !newEventEnd) {
      setEventMessage('Please add start and end dates for the event.')
      return
    }
    if (!newEventLocation.trim()) {
      setEventMessage('Please add an event location.')
      return
    }

    const newEvent: EventRecord = {
      id: `event-${Date.now()}`,
      name: newEventName.trim(),
      cost: costValue,
      startDate: newEventStart,
      endDate: newEventEnd,
      location: newEventLocation.trim(),
      type: newEventType,
      status: 'active',
      sales: [],
      orders: [],
      expenses: []
    }

    setEvents((current) => [newEvent, ...current])
    setNewEventName('')
    setNewEventCost('')
    setNewEventStart('')
    setNewEventEnd('')
    setNewEventLocation('')
    setNewEventType('Bazaar')
    setSelectedEventId(newEvent.id)
    setShowCreateEvent(false)

    try {
      await setDoc(doc(db, 'events', newEvent.id), { ...newEvent, _live: true })
    } catch (error) {
      console.error('Create event error:', error)
      setEventMessage('Event saved locally, but failed to sync.')
    }
  }

  const handleToggleEventStatus = async (eventId: string) => {
    const targetEvent = events.find((event) => event.id === eventId)
    if (!targetEvent) return

    // Closed events cannot be reopened via toggle - must edit the event
    if (targetEvent.status === 'closed') {
      setEventMessage('Closed events can only be re-activated by editing the event.')
      return
    }

    const nextStatus: EventStatus = 'closed'

    setEvents((current) =>
      current.map((event) =>
        event.id === eventId ? { ...event, status: nextStatus } : event
      )
    )

    try {
      await updateDoc(doc(db, 'events', eventId), { status: nextStatus, _live: true })
    } catch (error) {
      console.error('Update event status error:', error)
      setEventMessage('Status updated locally, but failed to sync.')
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    const targetEvent = events.find((e) => e.id === eventId)
    if (!targetEvent) return
    if (!confirm(`Delete event "${targetEvent.name}"? This will remove all its sales and orders. This cannot be undone.`)) return
    setEvents((current) => current.filter((e) => e.id !== eventId))
    try {
      await deleteDoc(doc(db, 'events', eventId))
    } catch (error) {
      console.error('Delete event error:', error)
      setEventMessage('Failed to delete event from server.')
    }
  }

  const openEditEvent = (event: EventRecord) => {
    setEditingEvent(event)
    setEditEventName(event.name)
    setEditEventCost(String(event.cost))
    setEditEventStart(event.startDate)
    setEditEventEnd(event.endDate)
    setEditEventLocation(event.location)
    setEditEventType(event.type)
    setEditEventStatus(event.status)
  }

  const handleEditEvent = async () => {
    if (!editingEvent) return
    if (!editEventName.trim()) return
    const costValue = parseNumber(editEventCost)
    if (!editEventStart || !editEventEnd) {
      setEventMessage('Please add start and end dates for the event.')
      return
    }
    if (!editEventLocation.trim()) {
      setEventMessage('Please add an event location.')
      return
    }

    const updatedFields = {
      name: editEventName.trim(),
      cost: costValue,
      startDate: editEventStart,
      endDate: editEventEnd,
      location: editEventLocation.trim(),
      type: editEventType,
      status: editEventStatus
    }

    setEvents((current) =>
      current.map((ev) =>
        ev.id === editingEvent.id ? { ...ev, ...updatedFields } : ev
      )
    )
    setEditingEvent(null)

    try {
      await updateDoc(doc(db, 'events', editingEvent.id), { ...updatedFields, _live: true })
    } catch (error) {
      console.error('Edit event error:', error)
      setEventMessage('Event updated locally, but failed to sync.')
    }
  }

  // Expense handlers
  const openExpenses = (event: EventRecord) => {
    setViewingExpenses(event)
    setShowAddExpense(false)
    resetExpenseForm()
  }

  const resetExpenseForm = () => {
    setExpenseDescription('')
    setExpenseAmount('')
    setExpenseCategory('Other')
    setExpenseDate(new Date().toISOString().slice(0, 10))
    setEditingExpense(null)
  }

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense)
    setExpenseDescription(expense.description)
    setExpenseAmount(String(expense.amount))
    setExpenseCategory(expense.category)
    setExpenseDate(expense.date)
    setShowAddExpense(true)
  }

  const handleSaveExpense = async () => {
    if (!viewingExpenses) return
    if (!expenseDescription.trim()) return
    const amount = parseNumber(expenseAmount)
    if (amount <= 0) return

    const expense: Expense = {
      id: editingExpense?.id ?? `exp-${Date.now()}`,
      description: expenseDescription.trim(),
      amount,
      category: expenseCategory,
      date: expenseDate || new Date().toISOString().slice(0, 10)
    }

    let updatedExpenses: Expense[]
    if (editingExpense) {
      updatedExpenses = viewingExpenses.expenses.map((e) => e.id === editingExpense.id ? expense : e)
    } else {
      updatedExpenses = [expense, ...viewingExpenses.expenses]
    }

    setEvents((current) =>
      current.map((ev) =>
        ev.id === viewingExpenses.id ? { ...ev, expenses: updatedExpenses } : ev
      )
    )
    setViewingExpenses({ ...viewingExpenses, expenses: updatedExpenses })
    setShowAddExpense(false)
    resetExpenseForm()

    try {
      await updateDoc(doc(db, 'events', viewingExpenses.id), { expenses: updatedExpenses, _live: true })
    } catch (error) {
      console.error('Save expense error:', error)
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (!viewingExpenses) return
    if (!confirm('Delete this expense?')) return

    const updatedExpenses = viewingExpenses.expenses.filter((e) => e.id !== expenseId)

    setEvents((current) =>
      current.map((ev) =>
        ev.id === viewingExpenses.id ? { ...ev, expenses: updatedExpenses } : ev
      )
    )
    setViewingExpenses({ ...viewingExpenses, expenses: updatedExpenses })

    try {
      await updateDoc(doc(db, 'events', viewingExpenses.id), { expenses: updatedExpenses, _live: true })
    } catch (error) {
      console.error('Delete expense error:', error)
    }
  }

  // Catalog handlers
  const resetCatalogForm = () => {
    setCatalogTitle('')
    setCatalogDescription('')
    setCatalogCategories(['Books'])
    setCatalogAge(['0-5'])
    setCatalogPrice('')
    setCatalogPublisher('')
    setCatalogSku('')
    setCatalogQty('')
    setCatalogSellingPrice('')
    setCatalogImages([])
    setCatalogImagePreviews([])
    setCatalogExistingImages([])
  }

  // Open the catalog create form prefilled from an inventory item that lacks a
  // catalogue entry, so an admin can add an image and description for it.
  const openCatalogFormFromInventory = (item: InventoryItem) => {
    resetCatalogForm()
    setEditingCatalogItem(null)
    setCatalogTitle(item.title)
    setCatalogPublisher(item.publisher)
    setCatalogPrice(item.rrp ? String(item.rrp) : String(item.sellingPrice || ''))
    setCatalogCategories([item.category])
    setCatalogSku(item.sku || '')
    setCatalogQty(String(item.quantity ?? ''))
    setCatalogSellingPrice(item.sellingPrice ? String(item.sellingPrice) : '')
    setShowCreateCatalog(true)
  }

  const handleCatalogImageSelect = (files: FileList | null) => {
    if (!files) return
    const currentCount = catalogImages.length + catalogExistingImages.length
    const remaining = 5 - currentCount
    if (remaining <= 0) {
      setCatalogMessage('Maximum 5 images allowed.')
      return
    }
    const newFiles = Array.from(files).slice(0, remaining)
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file))
    setCatalogImages((prev) => [...prev, ...newFiles])
    setCatalogImagePreviews((prev) => [...prev, ...newPreviews])
  }

  const handleRemoveCatalogNewImage = (index: number) => {
    setCatalogImages((prev) => prev.filter((_, i) => i !== index))
    setCatalogImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleRemoveCatalogExistingImage = (index: number) => {
    setCatalogExistingImages((prev) => prev.filter((_, i) => i !== index))
  }

  const fileToBase64 = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = document.createElement('img')
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let { width, height } = img
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('Canvas not supported')); return }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/webp', quality))
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const convertFilesToBase64 = async (files: File[]): Promise<string[]> => {
    const results: string[] = []
    for (const file of files) {
      const base64 = await fileToBase64(file)
      results.push(base64)
    }
    return results
  }

  // Upload each file to Firebase Storage and return its download URL. If an
  // upload throws (e.g. Storage not yet configured), fall back to base64 for
  // that one file so catalog images still work.
  const uploadCatalogFiles = async (files: File[], keyPrefix: string): Promise<string[]> => {
    const results: string[] = []
    for (const file of files) {
      try {
        const url = await uploadCatalogImage(file, keyPrefix)
        results.push(url)
      } catch (err) {
        console.error('Storage upload failed, falling back to base64:', err)
        const [b64] = await convertFilesToBase64([file])
        if (b64) results.push(b64)
      }
    }
    return results
  }

  // Upsert an inventory doc keyed by SKU from catalog form values. Updates the
  // local inventory state and Firestore. Returns the resolved inventory id.
  const upsertInventoryFromCatalog = async (opts: {
    title: string
    publisher: string
    category: InventoryCategory
    price: number
    sku: string
    quantity: number
    sellingPrice: number
  }): Promise<string> => {
    const sku = opts.sku.trim()
    const existing = inventory.find((i) => (i.sku || '').trim() && (i.sku || '').trim() === sku)
    const invId = existing ? existing.id : `inv-${Date.now()}`
    const invItem: InventoryItem = existing
      ? {
          ...existing,
          title: opts.title,
          publisher: opts.publisher,
          category: opts.category,
          sku,
          quantity: opts.quantity,
          sellingPrice: opts.sellingPrice || opts.price
        }
      : {
          id: invId,
          title: opts.title,
          category: opts.category,
          publisher: opts.publisher,
          sku,
          isbn: '',
          rrp: opts.price,
          discount: 0,
          quantity: opts.quantity,
          sellingPrice: opts.sellingPrice || opts.price
        }
    setInventory((current) =>
      existing ? current.map((i) => (i.id === invId ? invItem : i)) : [...current, invItem]
    )
    await setDoc(doc(db, 'inventory', invId), { ...invItem, _live: true })
    return invId
  }

  const handleCreateCatalogItem = async () => {
    if (!catalogTitle.trim()) { setCatalogMessage('Title is required.'); return }
    if (!catalogDescription.trim()) { setCatalogMessage('Description is required.'); return }
    if (!catalogPublisher.trim()) { setCatalogMessage('Publisher is required.'); return }
    if (catalogCategories.length === 0) { setCatalogMessage('At least 1 category is required.'); return }
    if (catalogImages.length === 0) { setCatalogMessage('At least 1 image is required.'); return }

    setIsUploadingCatalog(true)
    setCatalogMessage('')
    const itemId = `catalog-${Date.now()}`

    try {
      const skuVal = catalogSku.trim()
      const price = parseNumber(catalogPrice)
      const imageUrls = await uploadCatalogFiles(catalogImages, skuVal || itemId)
      const newItem: CatalogItem = {
        id: itemId,
        title: catalogTitle.trim(),
        description: catalogDescription.trim(),
        category: catalogCategories,
        ageCategory: catalogAge,
        price,
        publisher: catalogPublisher.trim(),
        images: imageUrls,
        createdAt: new Date().toISOString(),
        sku: skuVal
      }

      setCatalogItems((prev) => [newItem, ...prev])
      resetCatalogForm()
      setShowCreateCatalog(false)

      await setDoc(doc(db, 'catalog', itemId), newItem)

      // Linked upsert: if a SKU is provided, mirror this into inventory.
      if (skuVal) {
        try {
          await upsertInventoryFromCatalog({
            title: newItem.title,
            publisher: newItem.publisher,
            category: catalogCategories[0] || 'Books',
            price,
            sku: skuVal,
            quantity: Number(catalogQty) || 0,
            sellingPrice: Number(catalogSellingPrice) || 0
          })
        } catch (invErr) {
          console.error('Inventory upsert from catalog failed:', invErr)
        }
      }
    } catch (error) {
      console.error('Create catalog item error:', error)
      setCatalogMessage('Failed to create catalog item. Please try again.')
    } finally {
      setIsUploadingCatalog(false)
    }
  }

  const openEditCatalogItem = (item: CatalogItem) => {
    setEditingCatalogItem(item)
    setCatalogTitle(item.title)
    setCatalogDescription(item.description)
    setCatalogCategories(Array.isArray(item.category) ? item.category : [item.category])
    setCatalogAge(item.ageCategory)
    setCatalogPrice(String(item.price))
    setCatalogPublisher(item.publisher)
    // Prefer sku from the catalog item; else fall back to a linked inventory item by title.
    const linkedInv = inventory.find(
      (i) => (item.sku && (i.sku || '') === item.sku) ||
        i.title.trim().toLowerCase() === item.title.trim().toLowerCase()
    )
    setCatalogSku(item.sku || linkedInv?.sku || '')
    setCatalogQty(linkedInv ? String(linkedInv.quantity ?? '') : '')
    setCatalogSellingPrice(linkedInv && linkedInv.sellingPrice ? String(linkedInv.sellingPrice) : '')
    setCatalogExistingImages([...item.images])
    setCatalogImages([])
    setCatalogImagePreviews([])
  }

  const handleEditCatalogItem = async () => {
    if (!editingCatalogItem) return
    if (!catalogTitle.trim()) { setCatalogMessage('Title is required.'); return }
    if (!catalogDescription.trim()) { setCatalogMessage('Description is required.'); return }
    if (!catalogPublisher.trim()) { setCatalogMessage('Publisher is required.'); return }
    if (catalogExistingImages.length + catalogImages.length === 0) {
      setCatalogMessage('At least 1 image is required.')
      return
    }

    setIsUploadingCatalog(true)
    setCatalogMessage('')

    try {
      const skuVal = catalogSku.trim()
      const price = parseNumber(catalogPrice)
      let newImageUrls: string[] = []
      if (catalogImages.length > 0) {
        newImageUrls = await uploadCatalogFiles(catalogImages, skuVal || editingCatalogItem.id)
      }

      const allImages = [...catalogExistingImages, ...newImageUrls]
      const updatedFields = {
        title: catalogTitle.trim(),
        description: catalogDescription.trim(),
        category: catalogCategories,
        ageCategory: catalogAge,
        price,
        publisher: catalogPublisher.trim(),
        images: allImages,
        sku: skuVal
      }

      setCatalogItems((prev) =>
        prev.map((item) =>
          item.id === editingCatalogItem.id ? { ...item, ...updatedFields } : item
        )
      )
      setEditingCatalogItem(null)
      resetCatalogForm()

      await updateDoc(doc(db, 'catalog', editingCatalogItem.id), updatedFields)

      // Linked upsert: if a SKU is provided, mirror this into inventory.
      if (skuVal) {
        try {
          await upsertInventoryFromCatalog({
            title: updatedFields.title,
            publisher: updatedFields.publisher,
            category: catalogCategories[0] || 'Books',
            price,
            sku: skuVal,
            quantity: Number(catalogQty) || 0,
            sellingPrice: Number(catalogSellingPrice) || 0
          })
        } catch (invErr) {
          console.error('Inventory upsert from catalog failed:', invErr)
        }
      }
    } catch (error) {
      console.error('Edit catalog item error:', error)
      setCatalogMessage('Failed to update catalog item. Please try again.')
    } finally {
      setIsUploadingCatalog(false)
    }
  }

  // One-time reconcile: link catalogue items to inventory items by SKU. For each
  // catalog item without a SKU, find an inventory item with the same (trimmed,
  // case-insensitive) title. If found, copy its SKU to the catalog item; if that
  // inventory item also lacks a SKU, generate one and write it to BOTH. Runs only
  // on click. Batches all writes and updates local state.
  const [isLinkingCatalog, setIsLinkingCatalog] = useState(false)
  const handleLinkCatalogInventory = async () => {
    setIsLinkingCatalog(true)
    setCatalogLinkMessage('')
    try {
      const batch = writeBatch(db)
      const catalogUpdates = new Map<string, string>() // catalogId -> sku
      const inventoryUpdates = new Map<string, string>() // inventoryId -> sku
      const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

      let linked = 0
      for (const c of catalogItems) {
        if (c.sku && c.sku.trim()) continue
        const match = inventory.find(
          (i) => i.title.trim().toLowerCase() === c.title.trim().toLowerCase()
        )
        if (!match) continue
        let sku = (match.sku || '').trim()
        if (!sku) {
          sku = `EK-${slugify(c.title) || match.id}`
          inventoryUpdates.set(match.id, sku)
        }
        catalogUpdates.set(c.id, sku)
        linked += 1
      }

      catalogUpdates.forEach((sku, id) => batch.update(doc(db, 'catalog', id), { sku }))
      inventoryUpdates.forEach((sku, id) => batch.update(doc(db, 'inventory', id), { sku }))

      if (catalogUpdates.size > 0 || inventoryUpdates.size > 0) {
        await batch.commit()
        setCatalogItems((prev) =>
          prev.map((c) => (catalogUpdates.has(c.id) ? { ...c, sku: catalogUpdates.get(c.id) } : c))
        )
        setInventory((prev) =>
          prev.map((i) => (inventoryUpdates.has(i.id) ? { ...i, sku: inventoryUpdates.get(i.id) as string } : i))
        )
      }
      setCatalogLinkMessage(`Linked ${linked} product${linked === 1 ? '' : 's'}.`)
    } catch (error) {
      console.error('Link catalogue and inventory error:', error)
      setCatalogLinkMessage('Failed to link. Please try again.')
    } finally {
      setIsLinkingCatalog(false)
    }
  }

  const handleDeleteCatalogItem = async (itemId: string) => {
    const item = catalogItems.find((i) => i.id === itemId)
    if (!item) return

    setCatalogItems((prev) => prev.filter((i) => i.id !== itemId))

    try {
      await deleteDoc(doc(db, 'catalog', itemId))
    } catch (error) {
      console.error('Delete catalog item error:', error)
      setCatalogMessage('Item removed locally, but failed to sync deletion.')
    }
  }

  const filteredCatalogItems = useMemo(() => {
    return catalogItems.filter((item) => {
      const matchesSearch = !catalogSearch ||
        item.title.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        item.publisher.toLowerCase().includes(catalogSearch.toLowerCase())
      const itemCategories = Array.isArray(item.category) ? item.category : [item.category]
      const matchesCategory = catalogCategoryFilter === 'All' || itemCategories.includes(catalogCategoryFilter)
      return matchesSearch && matchesCategory
    })
  }, [catalogItems, catalogSearch, catalogCategoryFilter])

  const inventoryTitles = useMemo(() =>
    [...new Set(inventory.map((i) => i.title).filter(Boolean))].sort(),
    [inventory]
  )
  const inventoryPublishers = useMemo(() =>
    [...new Set(inventory.map((i) => i.publisher).filter(Boolean))].sort(),
    [inventory]
  )
  const inventoryCategories = useMemo(() =>
    [...new Set(inventory.map((i) => i.category).filter(Boolean))].sort(),
    [inventory]
  )

  const handleAddToCart = (itemId: string) => {
    const item = inventory.find((stock) => stock.id === itemId)
    if (!item) return

    const quantity = Math.max(1, Math.round(addQuantity))
    const existing = cartItems.find((cartItem) => cartItem.itemId === itemId)
    const currentQty = existing?.quantity ?? 0
    const available = item.quantity - currentQty

    if (available <= 0) {
      setEventMessage('No remaining stock available for this item.')
      return
    }

    if (quantity > available) {
      setEventMessage(`Only ${available} left for ${item.title}.`)
      return
    }

    setCartItems((current) => {
      if (!existing) {
        return [
          ...current,
          { itemId: item.id, title: item.title, price: item.sellingPrice, quantity }
        ]
      }
      return current.map((cartItem) =>
        cartItem.itemId === itemId
          ? { ...cartItem, quantity: cartItem.quantity + quantity }
          : cartItem
      )
    })

    setAddQuantity(1)
    setEventMessage(`${item.title} added to cart.`)
  }

  const handleUpdateCartQuantity = (itemId: string, nextValue: number) => {
    const item = inventory.find((stock) => stock.id === itemId)
    if (!item) return

    const quantity = Math.max(0, Math.round(nextValue))
    const clamped = Math.min(quantity, item.quantity)

    if (quantity > item.quantity) {
      setEventMessage(`Only ${item.quantity} available for ${item.title}.`)
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

  // ── localStorage backup helpers ──────────────────────────────
  const saveOrderBackupToLocal = (eventKey: string, orders: Order[], sales?: Sale[]) => {
    try {
      localStorage.setItem(`eduvate-orders-${eventKey}`, JSON.stringify(orders))
      if (sales) localStorage.setItem(`eduvate-sales-${eventKey}`, JSON.stringify(sales))
    } catch { /* quota exceeded - ignore */ }
  }

  const handleRecordSale = async () => {
    const isGeneralSale = selectedEventId === 'general'
    const eventRecord = events.find((event) => event.id === selectedEventId)
    if ((!eventRecord && !isGeneralSale) || cartItems.length === 0) return
    if (!isGeneralSale && eventRecord?.status !== 'active') return

    setIsSubmittingSale(true)
    const stockMap = new Map(inventory.map((item) => [item.id, item]))

    for (const cartItem of cartItems) {
      const stockItem = stockMap.get(cartItem.itemId)
      if (!stockItem || cartItem.quantity > stockItem.quantity) {
        setEventMessage(
          `Not enough stock for ${cartItem.title}. Please adjust the cart.`
        )
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
      const inventoryItem = inventory.find((item) => item.id === cartItem.itemId)
      
      return {
        id: `sale-${Date.now()}-${cartItem.itemId}`,
        itemId: cartItem.itemId,
        title: cartItem.title,
        quantity: cartItem.quantity,
        paymentType,
        total: itemTotal,
        timestamp,
        rrp: inventoryItem?.rrp ?? 0,
        sellingPrice: cartItem.price
      }
    })

    // Create Order record for this transaction
    const orderRecord: Order = {
      id: `order-${Date.now()}`,
      items: cartItems.map((cartItem) => ({
        itemId: cartItem.itemId,
        title: cartItem.title,
        price: cartItem.price,
        quantity: cartItem.quantity,
        lineTotal: Number((cartItem.price * cartItem.quantity).toFixed(2))
      })),
      subtotal: cartTotal,
      discount: discountAmount,
      discountType,
      discountValue: discount,
      convenienceFee: paymentType === 'Card' ? convenienceFee : 0,
      paymentType,
      total: totalWithFee,
      timestamp,
      eventId: selectedEventId
    }

    const updatedSales = eventRecord ? [...salesToAdd, ...eventRecord.sales] : salesToAdd
    const updatedOrders = eventRecord ? [orderRecord, ...eventRecord.orders] : [orderRecord]
    const nextInventory = inventory.map((item) => {
      const cartItem = cartItems.find((entry) => entry.itemId === item.id)
      if (!cartItem) return item
      return {
        ...item,
        quantity: Math.max(0, item.quantity - cartItem.quantity)
      }
    })
    // Track only items whose quantity actually changed
    const changedInventoryItems = nextInventory.filter((item) => {
      const original = inventory.find((i) => i.id === item.id)
      return original && original.quantity !== item.quantity
    })

    // 1️⃣ Update local state immediately (optimistic)
    if (eventRecord) {
      setEvents((current) =>
        current.map((event) =>
          event.id === eventRecord.id ? { ...event, sales: updatedSales, orders: updatedOrders } : event
        )
      )
    } else {
      setGeneralSales((current) => [...salesToAdd, ...current])
      setGeneralOrders((current) => [orderRecord, ...current])
    }

    setInventory(nextInventory)
    setCartItems([])
    setDiscount(0)

    // 2️⃣ Save order + TXT data to localStorage BEFORE cloud write
    const eventKey = eventRecord ? eventRecord.id : 'general'
    const eventName = eventRecord?.name ?? 'General Sales'
    saveOrderBackupToLocal(eventKey, updatedOrders, updatedSales)
    try {
      localStorage.setItem(`eduvate-txt-${eventKey}`, generateEventTxt(eventName, updatedOrders))
    } catch { /* ignore */ }

    // 3️⃣ Close modal & reset immediately - no waiting for Firebase
    setIsSubmittingSale(false)
    setShowConfirmSale(false)
    setEventMessage(`✅ Sale recorded (${salesToAdd.length} items). Syncing to cloud…`)

    // 4️⃣ Write to Firebase with retry (background - no await blocking UI)
    ;(async () => {
      const MAX_RETRIES = 2
      let writeSuccess = false

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Batch 1: Save orders/sales
          const orderBatch = writeBatch(db)
          if (eventRecord) {
            orderBatch.update(doc(db, 'events', eventRecord.id), { sales: updatedSales, orders: updatedOrders, _live: true })
          } else {
            salesToAdd.forEach((sale) => {
              orderBatch.set(doc(db, 'generalSales', sale.id), { ...sale, _live: true })
            })
            orderBatch.set(doc(db, 'generalOrders', orderRecord.id), { ...orderRecord, _live: true })
          }
          await orderBatch.commit()
          writeSuccess = true
          break
        } catch (error) {
          console.error(`Order save error (attempt ${attempt}/${MAX_RETRIES}):`, error)
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1500))
          }
        }
      }

      // Batch 2: Update inventory quantities separately
      if (changedInventoryItems.length > 0) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const invBatch = writeBatch(db)
            changedInventoryItems.forEach((item) => {
              invBatch.update(doc(db, 'inventory', item.id), { quantity: item.quantity, _live: true })
            })
            await invBatch.commit()
            break
          } catch (error) {
            console.error(`Inventory update error (attempt ${attempt}/${MAX_RETRIES}):`, error)
            if (attempt < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, 1500))
            } else {
              setEventMessage('⚠️ Orders saved but inventory failed to sync. Quantities may be stale in cloud.')
            }
          }
        }
      }

      // 5️⃣ Verify the save in Firebase
      let verified = false
      if (writeSuccess) {
        try {
          if (eventRecord) {
            const verifySnap = await getDoc(doc(db, 'events', eventRecord.id))
            const verifyData = verifySnap.data()
            const savedOrderCount = (verifyData?.orders as Order[] | undefined)?.length ?? 0
            verified = savedOrderCount >= updatedOrders.length
          } else {
            const verifySnap = await getDoc(doc(db, 'generalOrders', orderRecord.id))
            verified = verifySnap.exists()
          }
        } catch {
          verified = false
        }
      }

      // 6️⃣ Update notification with final result
      if (verified) {
        setEventMessage(`✅ Sale confirmed & verified in cloud (${salesToAdd.length} items).`)
      } else if (writeSuccess) {
        setEventMessage('⚠️ Sale written but cloud verification failed. Data is saved locally. You can download a backup from Order History.')
      } else {
        setEventMessage('⚠️ Cloud sync failed after retries. Data is saved locally. You can download a backup from Order History.')
      }
    })()
  }

  const handleDeleteOrder = async (order: Order) => {
    if (!confirm(`Delete this order from ${new Date(order.timestamp).toLocaleString()}? This will restore inventory and remove all related sales records. Continue?`)) return

    // Restore inventory quantities from the deleted order
    const restoredInventory = inventory.map((item) => {
      const orderItem = order.items.find((oi) => oi.itemId === item.id)
      if (!orderItem) return item
      return { ...item, quantity: item.quantity + orderItem.quantity }
    })
    setInventory(restoredInventory)

    const isGeneralOrder = order.eventId === 'general'
    if (isGeneralOrder) {
      // Remove order
      const updatedGeneralOrders = generalOrders.filter((o) => o.id !== order.id)
      setGeneralOrders(updatedGeneralOrders)
      // Remove matching sales (same timestamp)
      const salesToRemove = generalSales.filter((s) => s.timestamp === order.timestamp)
      setGeneralSales((current) => current.filter((s) => s.timestamp !== order.timestamp))
      // Update localStorage backup
      saveOrderBackupToLocal('general', updatedGeneralOrders)
      try {
        const batch = writeBatch(db)
        batch.delete(doc(db, 'generalOrders', order.id))
        salesToRemove.forEach((sale) => {
          batch.delete(doc(db, 'generalSales', sale.id))
        })
        restoredInventory.forEach((item) => {
          batch.update(doc(db, 'inventory', item.id), { quantity: item.quantity, _live: true })
        })
        await batch.commit()
      } catch (error) {
        console.error('Delete order error:', error)
      }
    } else {
      const eventRecord = events.find((e) => e.id === order.eventId)
      if (!eventRecord) return
      const updatedOrders = eventRecord.orders.filter((o) => o.id !== order.id)
      // Remove matching sales (same timestamp)
      const updatedSales = eventRecord.sales.filter((s) => s.timestamp !== order.timestamp)
      setEvents((current) =>
        current.map((e) =>
          e.id === eventRecord.id ? { ...e, orders: updatedOrders, sales: updatedSales } : e
        )
      )
      if (viewingOrderHistory) {
        setViewingOrderHistory({ ...viewingOrderHistory, orders: updatedOrders })
      }
      if (viewingEventTransactions) {
        setViewingEventTransactions({ ...viewingEventTransactions, sales: updatedSales })
      }
      // Update localStorage backup
      saveOrderBackupToLocal(eventRecord.id, updatedOrders, updatedSales)
      try {
        const batch = writeBatch(db)
        batch.update(doc(db, 'events', eventRecord.id), { orders: updatedOrders, sales: updatedSales, _live: true })
        restoredInventory.forEach((item) => {
          batch.update(doc(db, 'inventory', item.id), { quantity: item.quantity, _live: true })
        })
        await batch.commit()
      } catch (error) {
        console.error('Delete order error:', error)
      }
    }
  }

  const handleSaveEditOrder = async () => {
    if (!editingOrder) return
    const updatedOrder: Order = {
      ...editingOrder,
      items: editOrderItems,
      subtotal: editOrderItems.reduce((sum, item) => sum + item.lineTotal, 0),
      paymentType: editOrderPaymentType,
      total: (() => {
        const sub = editOrderItems.reduce((sum, item) => sum + item.lineTotal, 0)
        const discAmt = editingOrder.discountType === 'percentage'
          ? sub * (editingOrder.discountValue / 100)
          : editingOrder.discountValue
        const afterDiscount = sub - discAmt
        const fee = editOrderPaymentType === 'Card' ? afterDiscount * 0.03 : 0
        return Number((afterDiscount + fee).toFixed(2))
      })(),
      discount: (() => {
        const sub = editOrderItems.reduce((sum, item) => sum + item.lineTotal, 0)
        return editingOrder.discountType === 'percentage'
          ? Number((sub * (editingOrder.discountValue / 100)).toFixed(2))
          : editingOrder.discountValue
      })(),
      convenienceFee: (() => {
        const sub = editOrderItems.reduce((sum, item) => sum + item.lineTotal, 0)
        const discAmt = editingOrder.discountType === 'percentage'
          ? sub * (editingOrder.discountValue / 100)
          : editingOrder.discountValue
        const afterDiscount = sub - discAmt
        return editOrderPaymentType === 'Card' ? Number((afterDiscount * 0.03).toFixed(2)) : 0
      })()
    }

    const isGeneralOrder = updatedOrder.eventId === 'general'
    if (isGeneralOrder) {
      const updatedGeneralOrders = generalOrders.map((o) => o.id === updatedOrder.id ? updatedOrder : o)
      setGeneralOrders(updatedGeneralOrders)
      // Update localStorage backup
      saveOrderBackupToLocal('general', updatedGeneralOrders)
      try {
        await updateDoc(doc(db, 'generalOrders', updatedOrder.id), { ...updatedOrder, _live: true })
      } catch (error) {
        console.error('Edit order error:', error)
      }
    } else {
      const eventRecord = events.find((e) => e.id === updatedOrder.eventId)
      if (!eventRecord) return
      const updatedOrders = eventRecord.orders.map((o) => o.id === updatedOrder.id ? updatedOrder : o)
      setEvents((current) =>
        current.map((e) =>
          e.id === eventRecord.id ? { ...e, orders: updatedOrders } : e
        )
      )
      if (viewingOrderHistory) {
        setViewingOrderHistory({ ...viewingOrderHistory, orders: updatedOrders })
      }
      // Update localStorage backup
      saveOrderBackupToLocal(eventRecord.id, updatedOrders, eventRecord.sales)
      try {
        await updateDoc(doc(db, 'events', eventRecord.id), { orders: updatedOrders, _live: true })
      } catch (error) {
        console.error('Edit order error:', error)
      }
    }
    setEditingOrder(null)
    setEditOrderItems([])
  }

  const openEditOrder = (order: Order) => {
    setEditingOrder(order)
    setEditOrderItems(order.items.map((item) => ({ ...item })))
    setEditOrderPaymentType(order.paymentType)
  }

  const renderHome = () => (
    <div className="space-y-8">
      <section className="fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50 p-8 shadow-xl border border-primary/10">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-primary/30 to-accentThree/20 blur-3xl animate-pulse" />
        <div className="absolute -left-14 bottom-0 h-56 w-56 rounded-full bg-gradient-to-tr from-secondary/25 to-primary/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary/20 to-secondary/20 px-4 py-2 mb-3 border border-primary/10">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-primaryDark">Live Dashboard</span>
            </div>
            <h2 className="font-display text-3xl gradient-text">Daily Pulse</h2>
            <p className="mt-3 text-sm text-muted max-w-xl">
              Real-time snapshot of sales momentum, inventory health, and top performing events.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/90 backdrop-blur px-5 py-3 shadow-soft border border-primary/10">
              <p className="text-xs font-semibold text-muted">Last updated</p>
              <p className="text-sm font-bold text-primaryDark">Moments ago</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {summaryCards.map((card, index) => (
            <div
              key={card.label}
              className="home-card group relative overflow-hidden rounded-2xl bg-white/90 backdrop-blur-sm p-6 shadow-xl border border-primary/5 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">{card.label}</p>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 text-primaryDark" aria-hidden="true">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      {card.icon === 'sales' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 10v2m0-10c1.11 0 2.08.402 2.599 1M12 16c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                      {card.icon === 'stock' && <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
                      {card.icon === 'events' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />}
                      {card.icon === 'catalog' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253" />}
                      {card.icon === 'orders' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />}
                    </svg>
                  </span>
                </div>
                <h2 className="mt-4 font-display text-2xl sm:text-4xl gradient-text">
                  {'prefix' in card ? card.prefix : ''}
                  {formatNumber(card.value)}
                </h2>
                <p className="mt-3 text-xs text-muted flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {card.note}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-primary/5 p-6 shadow-xl border border-primary/10" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-xl gradient-text">Weekly Sales Trend</h3>
            <span className="text-xs font-semibold text-muted bg-primary/10 px-3 py-1 rounded-full">Last 7 days</span>
          </div>
          {salesTrend.labels.length ? (
            <>
              <div className="flex items-end gap-2 mt-1 mb-4">
                <span className="text-3xl font-bold gradient-text">${formatNumber(salesTrend.values.reduce((a, b) => a + b, 0))}</span>
                <span className="text-xs text-muted pb-1">total this week</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrend.labels.map((label, i) => ({ day: label, sales: salesTrend.values[i] ?? 0 }))} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: '13px' }}
                      formatter={(value: any) => [`$${formatNumber(Number(value))}`, 'Sales']}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#7c3aed" strokeWidth={3} fill="url(#salesGradient)" dot={{ r: 5, fill: '#7c3aed', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, fill: '#5b21b6', stroke: '#fff', strokeWidth: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-12 w-12 mb-3 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l4-4 3 3 5-6" />
              </svg>
              <p className="text-sm text-muted">No sales data yet. Record a sale to see trends.</p>
            </div>
          )}
        </div>

        <div className="grid gap-6">
          <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-secondary/5 p-6 shadow-xl border border-secondary/10" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-xl gradient-text">Category Mix</h3>
              <span className="text-xs font-semibold text-muted bg-secondary/10 px-3 py-1 rounded-full">Current inventory</span>
            </div>
            {categoryMix.labels.some((_, i) => categoryMix.values[i] > 0) ? (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryMix.labels.map((label, i) => ({ name: label, value: categoryMix.values[i] ?? 0 })).filter(d => d.value > 0)}
                      cx="50%" cy="50%"
                      innerRadius={45} outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryMix.labels.map((_, i) => (
                        <Cell key={i} fill={['#7c3aed', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#f43e5e'][i % 8]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', fontSize: '13px' }} formatter={(value: any) => [`${formatNumber(Number(value))} items`, '']} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', fontWeight: 500 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="h-12 w-12 mb-3 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-sm text-muted">No inventory data yet.</p>
              </div>
            )}
          </div>

          <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-primary/5 p-6 shadow-xl border border-primary/10" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-xl gradient-text">Best Sellers</h3>
              <span className="text-xs font-semibold text-muted bg-primary/10 px-3 py-1 rounded-full">Across all events</span>
            </div>
            {bestSellers.length ? (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={bestSellers.map((item) => ({ name: item.title.length > 18 ? item.title.slice(0, 18) + '…' : item.title, qty: item.quantity, revenue: item.revenue, fullName: item.title }))}
                    layout="vertical"
                    margin={{ top: 5, right: 15, left: 5, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="bestSellerGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', fontSize: '13px' }}
                      formatter={(value: any, name: any) => [name === 'qty' ? `${Number(value)} sold` : `$${formatNumber(Number(value))}`, name === 'qty' ? 'Quantity' : 'Revenue']}
                    />
                    <Bar dataKey="qty" fill="url(#bestSellerGradient)" radius={[0, 8, 8, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="h-12 w-12 mb-3 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m7-17H5v5a7 7 0 0014 0V4zM5 8H3a2 2 0 002 2m14-2h2a2 2 0 01-2 2" />
                </svg>
                <p className="text-sm text-muted">No sales yet. Record a sale to see top items.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-accentThree/5 p-6 shadow-xl border border-accentThree/10" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accentThree/20 to-primary/20 text-primaryDark"><svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6M15 19V9M4 21h16M12 21V5" /></svg></span>
              <h3 className="font-display text-xl gradient-text">Event Revenue</h3>
            </div>
            <span className="text-xs font-semibold text-muted bg-accentThree/10 px-3 py-1 rounded-full">Top events</span>
          </div>
          {eventRevenue.length ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventRevenue} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                    <linearGradient id="profitBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', fontSize: '13px' }}
                    formatter={(value: any, name: any) => [`$${formatNumber(Number(value))}`, name === 'revenue' ? 'Revenue' : name === 'cost' ? 'Total Costs' : 'Profit']}
                  />
                  <Bar dataKey="revenue" fill="url(#revenueBarGrad)" radius={[6, 6, 0, 0]} barSize={18} />
                  <Bar dataKey="profit" fill="url(#profitBarGrad)" radius={[6, 6, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-12 w-12 mb-3 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
              </svg>
              <p className="text-sm text-muted">No events created yet.</p>
            </div>
          )}
        </div>

        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-pink-50/50 p-6 shadow-xl border border-secondary/10" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 text-primaryDark"><svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg></span>
              <h3 className="font-display text-xl gradient-text">Payment Split</h3>
            </div>
            <span className="text-xs font-semibold text-muted bg-secondary/10 px-3 py-1 rounded-full">By type</span>
          </div>
          {paymentBreakdown.length ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                    label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {paymentBreakdown.map((_, i) => (
                      <Cell key={i} fill={['#10b981', '#3b82f6', '#f59e0b', '#ec4899'][i % 4]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', fontSize: '13px' }} formatter={(value: any) => [`$${formatNumber(Number(value))}`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-12 w-12 mb-3 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <p className="text-sm text-muted">No sales data yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-accentThree/5 p-6 shadow-xl border border-accentThree/10" style={{ animationDelay: '350ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accentThree/20 to-primary/20 text-amber-500"><svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m5-16v3a5 5 0 01-10 0V5a1 1 0 011-1h8a1 1 0 011 1zm0 0h3a2 2 0 01-2 4m-12-4H4a2 2 0 002 4" /></svg></span>
            <h3 className="font-display text-xl gradient-text">Best Event</h3>
          </div>
          {bestEvent ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 p-4 border border-primary/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-lg text-primaryDark">{bestEvent.name}</span>
                  <span className="text-xl font-bold gradient-text">
                    ${formatNumber(bestEvent.sales.reduce((sum, sale) => sum + sale.total, 0))}
                  </span>
                </div>
                <div className="space-y-2 text-xs text-muted">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>{bestEvent.startDate || 'TBD'} - {bestEvent.endDate || 'TBD'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span>{bestEvent.location || 'Location TBD'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /></svg>
                    <span>{bestEvent.type}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-black/10">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${bestEvent.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      {bestEvent.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                    <span>Vendor fee: ${formatNumber(bestEvent.cost)}</span>
                  </div>
                  {bestEvent.expenses.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        {bestEvent.expenses.length} expense{bestEvent.expenses.length !== 1 ? 's' : ''}
                      </span>
                      <span>${formatNumber(bestEvent.expenses.reduce((s, e) => s + e.amount, 0))}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-8">No events created yet.</p>
          )}
        </div>

        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-amber-50/50 p-6 shadow-xl border border-amber-200/50" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600"><svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></span>
              <h3 className="font-display text-xl gradient-text">Inventory Health</h3>
            </div>
            <span className="text-xs font-semibold text-muted bg-amber-100 px-3 py-1 rounded-full border border-amber-200">Restock radar</span>
          </div>
          {restockItems.length ? (
            <div className="space-y-4">
              {restockItems.slice(0, 6).map((item, index) => (
                <div key={item.id} className="group hover:bg-amber-50/50 p-3 rounded-xl transition-colors" style={{ animationDelay: `${index * 80}ms` }}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium">{item.title}</span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      item.quantity <= 5 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                      {item.quantity} left
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gradient-to-r from-gray-200 to-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.quantity <= 5
                          ? 'bg-gradient-to-r from-red-500 to-orange-500'
                          : 'bg-gradient-to-r from-amber-400 to-orange-400'
                      }`}
                      style={{
                        width: `${Math.max(
                          15,
                          Math.min(100, (item.quantity / restockThreshold) * 100)
                        )}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 flex flex-col items-center">
              <svg className="h-12 w-12 mb-3 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-muted">All items are healthy on stock.</p>
            </div>
          )}
        </div>
      </section>
      <style jsx>{`
        .home-card {
          animation: float-in 0.6s ease forwards;
          opacity: 0;
          transform: translateY(10px);
        }

        @keyframes float-in {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )

  const sortedInventory = useMemo(() => {
    if (!inventorySortKey) return inventory
    return [...inventory].sort((a, b) => {
      const aVal = a[inventorySortKey]
      const bVal = b[inventorySortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return inventorySortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return inventorySortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [inventory, inventorySortKey, inventorySortDir])

  const handleInventorySort = (key: keyof InventoryItem) => {
    if (inventorySortKey === key) {
      if (inventorySortDir === 'asc') setInventorySortDir('desc')
      else { setInventorySortKey(''); setInventorySortDir('asc') }
    } else {
      setInventorySortKey(key)
      setInventorySortDir('asc')
    }
  }

  const SortIcon = ({ col }: { col: keyof InventoryItem }) => {
    const isActive = inventorySortKey === col
    const isAsc = isActive && inventorySortDir === 'asc'
    const isDesc = isActive && inventorySortDir === 'desc'
    return (
      <span className="inline-flex flex-col ml-1 align-middle -space-y-1" aria-hidden="true">
        <svg className={`h-2.5 w-2.5 ${isAsc ? 'text-primary' : 'text-primaryDark/25'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 6l6 8H6z" />
        </svg>
        <svg className={`h-2.5 w-2.5 ${isDesc ? 'text-primary' : 'text-primaryDark/25'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 18l-6-8h12z" />
        </svg>
      </span>
    )
  }

  const openEditInventoryItem = (item: InventoryItem) => {
    setEditingInventoryItem(item)
    setInvEditTitle(item.title)
    setInvEditCategory(item.category)
    setInvEditPublisher(item.publisher)
    setInvEditSku(item.sku ?? '')
    setInvEditIsbn(item.isbn ?? '')
    setInvEditRrp(String(item.rrp))
    setInvEditDiscount(String(item.discount))
    setInvEditQuantity(String(item.quantity))
    setInvEditSellingPrice(String(item.sellingPrice))
  }

  const openAddInventoryItem = () => {
    setShowAddInventoryItem(true)
    setInvEditTitle('')
    setInvEditCategory('Books')
    setInvEditPublisher('')
    setInvEditSku('')
    setInvEditIsbn('')
    setInvEditRrp('')
    setInvEditDiscount('0')
    setInvEditQuantity('')
    setInvEditSellingPrice('')
  }

  const handleInventoryScan = (raw: string) => {
    const code = raw.trim().toLowerCase()
    if (!code) return
    const exact = inventory.find(
      (i) =>
        (i.sku || '').toLowerCase() === code ||
        (i.isbn || '').toLowerCase() === code ||
        i.id.toLowerCase() === code
    )
    if (exact) {
      openEditInventoryItem(exact)
      setInventoryScannerOpen(false)
      return
    }
    const titleMatches = inventory.filter((i) => i.title.toLowerCase().includes(code))
    if (titleMatches.length === 1) {
      openEditInventoryItem(titleMatches[0])
      setInventoryScannerOpen(false)
      return
    }
    // No or ambiguous match → open the Add form pre-filled with the scanned code.
    const looksLikeIsbn = /^\d{13}$/.test(raw.trim())
    openAddInventoryItem()
    if (looksLikeIsbn) {
      setInvEditIsbn(raw.trim())
    } else {
      setInvEditSku(raw.trim())
    }
    setUploadMessage(`No item matched "${raw.trim()}". Add it as a new item.`)
    setInventoryScannerOpen(false)
  }

  const handleSaveInventoryItem = async () => {
    if (!invEditTitle.trim() || !invEditQuantity) return
    setIsSavingInventory(true)
    const updatedItem: InventoryItem = {
      id: editingInventoryItem ? editingInventoryItem.id : `inv-${Date.now()}`,
      title: invEditTitle.trim(),
      category: invEditCategory,
      publisher: invEditPublisher.trim(),
      sku: invEditSku.trim(),
      isbn: invEditIsbn.trim(),
      rrp: Number(invEditRrp) || 0,
      discount: Number(invEditDiscount) || 0,
      quantity: Number(invEditQuantity) || 0,
      sellingPrice: Number(invEditSellingPrice) || 0
    }
    if (editingInventoryItem) {
      setInventory((current) => current.map((i) => i.id === updatedItem.id ? updatedItem : i))
    } else {
      setInventory((current) => [...current, updatedItem])
    }
    // Close modal immediately and show confirmation
    setEditingInventoryItem(null)
    setShowAddInventoryItem(false)
    setIsSavingInventory(false)
    setUploadMessage(editingInventoryItem ? `✅ "${updatedItem.title}" updated.` : `✅ "${updatedItem.title}" added.`)
    // Reverse link: if this item has a SKU but no catalogue entry exists for it,
    // prompt the admin to add images and description (do not fabricate anything).
    if (updatedItem.sku) {
      const hasCatalog = catalogItems.some(
        (c) =>
          (c.sku && c.sku.trim() === updatedItem.sku.trim()) ||
          c.title.trim().toLowerCase() === updatedItem.title.trim().toLowerCase()
      )
      setNoCatalogPrompt(hasCatalog ? null : updatedItem)
    } else {
      setNoCatalogPrompt(null)
    }
    // Sync to Firebase in the background
    try {
      await setDoc(doc(db, 'inventory', updatedItem.id), { ...updatedItem, _live: true })
    } catch (error) {
      console.error('Save inventory item error:', error)
      setUploadMessage(`⚠️ "${updatedItem.title}" saved locally but failed to sync to cloud.`)
    }
  }

  const handleDeleteInventoryItem = async (item: InventoryItem) => {
    if (!confirm(`Delete "${item.title}" from inventory?`)) return
    setInventory((current) => current.filter((i) => i.id !== item.id))
    try {
      await deleteDoc(doc(db, 'inventory', item.id))
    } catch (error) {
      console.error('Delete inventory item error:', error)
    }
  }

  // Bind a scanned/typed code to an existing inventory item.
  // 13 digits -> isbn, otherwise -> sku. Persists via the same setDoc path used when editing.
  const handleBindCode = async (item: InventoryItem, rawValue: string) => {
    const value = rawValue.trim()
    if (!value) return
    const isIsbn = /^\d{13}$/.test(value)
    const updatedItem: InventoryItem = isIsbn
      ? { ...item, isbn: value }
      : { ...item, sku: value }
    setInventory((current) => current.map((i) => (i.id === updatedItem.id ? updatedItem : i)))
    setBindTargetItem(null)
    setUploadMessage(`Bound ${isIsbn ? 'ISBN' : 'SKU'} "${value}" to "${item.title}".`)
    try {
      await setDoc(doc(db, 'inventory', updatedItem.id), { ...updatedItem, _live: true })
    } catch (error) {
      console.error('Bind code error:', error)
      setUploadMessage(`"${item.title}" bound locally but failed to sync to cloud.`)
    }
  }

  // Generate a QR image for an item's sku (or id if no sku) and open the label modal.
  const openQrLabel = async (item: InventoryItem) => {
    const value = (item.sku || item.id).trim()
    setQrModalItem(item)
    setQrDataUrl('')
    try {
      const url = await QRCode.toDataURL(value, { width: 320, margin: 2 })
      setQrDataUrl(url)
    } catch (error) {
      console.error('QR generation error:', error)
    }
  }

  const handleClearInventory = async () => {
    if (!confirm('Are you sure you want to clear ALL inventory? This will remove every item from stock. Events and catalog will not be affected.')) return
    if (!confirm('This action cannot be undone. Type OK to confirm you want to delete all inventory items.')) return
    const oldInventory = [...inventory]
    setInventory([])
    setUploadMessage('Inventory cleared successfully.')
    try {
      const batch = writeBatch(db)
      oldInventory.forEach((item) => {
        batch.delete(doc(db, 'inventory', item.id))
      })
      await batch.commit()
    } catch (error) {
      console.error('Clear inventory error:', error)
      setInventory(oldInventory)
      setUploadMessage('Failed to clear inventory. Restored locally.')
    }
  }

  // ─── Online orders (Stripe) ───
  const loadOrders = async () => {
    setOrdersLoading(true)
    try {
      const snap = await getDocs(collection(db, 'orders'))
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OnlineOrder, 'id'>) }))
      // Newest first by createdAt seconds (fallback: keep order).
      rows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      setOrders(rows)
    } catch (error) {
      console.error('Failed to load orders:', error)
    } finally {
      setOrdersLoading(false)
    }
  }

  // Fetch orders when the Orders or Home view opens (admin only).
  // Home reuses the same `orders` state so its summary reflects online orders.
  useEffect(() => {
    if ((activeView === 'orders' || activeView === 'home') && userRole === 'admin') {
      loadOrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, userRole])

  // ─── Summer Reading Program registrations ───
  const loadSummerReaders = async () => {
    setSummerLoading(true)
    try {
      const snap = await getDocs(collection(db, 'summerReads'))
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SummerReader, 'id'>) }))
      // Newest first by createdAt seconds.
      rows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      setSummerReaders(rows)
    } catch (error) {
      console.error('Failed to load summer readers:', error)
    } finally {
      setSummerLoading(false)
    }
  }

  // Fetch summer readers when the Summer Reads view opens (admin only).
  useEffect(() => {
    if (activeView === 'summer' && userRole === 'admin') {
      loadSummerReaders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, userRole])

  const markOrderShipped = async (order: OnlineOrder) => {
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: 'shipped', shippedAt: serverTimestamp() })
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'shipped' } : o)))
      setExpandedOrder((cur) => (cur && cur.id === order.id ? { ...cur, status: 'shipped' } : cur))
    } catch (error) {
      console.error('Failed to mark order shipped:', error)
      alert('Could not update the order. Please try again.')
    }
  }

  const deleteOnlineOrder = async (order: OnlineOrder) => {
    if (!confirm(`Delete order ${order.id}? This cannot be undone.`)) return
    try {
      await deleteDoc(doc(db, 'orders', order.id))
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
      setExpandedOrder(null)
    } catch (error) {
      console.error('Failed to delete order:', error)
      alert('Could not delete the order. Please try again.')
    }
  }

  const updateOnlineOrderStatus = async (order: OnlineOrder, status: OnlineOrder['status']) => {
    if (status === order.status) return
    try {
      await updateDoc(doc(db, 'orders', order.id), { status })
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)))
      setExpandedOrder((cur) => (cur && cur.id === order.id ? { ...cur, status } : cur))
    } catch (error) {
      console.error('Failed to update order status:', error)
      alert('Could not update the order status. Please try again.')
    }
  }

  const deleteReaderRegistration = async (reader: SummerReader) => {
    if (!confirm(`Delete registration for ${reader.childName}? This cannot be undone.`)) return
    try {
      await deleteDoc(doc(db, 'summerReads', reader.id))
      setSummerReaders((prev) => prev.filter((r) => r.id !== reader.id))
      setExpandedReader(null)
    } catch (error) {
      console.error('Failed to delete registration:', error)
      alert('Could not delete the registration. Please try again.')
    }
  }

  const deleteReaderBook = async (reader: SummerReader, index: number) => {
    if (!confirm('Delete this logged book?')) return
    try {
      const callable = httpsCallable<
        { code: string; index: number },
        { booksLogged?: SummerBookLog[]; booksCount?: number; tier?: string }
      >(functions, 'deleteSummerBook')
      const res = await callable({ code: reader.code, index })
      const data = res.data || {}
      setSummerReaders((prev) =>
        prev.map((r) =>
          r.id === reader.id
            ? {
                ...r,
                booksLogged: data.booksLogged ?? r.booksLogged,
                booksCount: data.booksCount ?? r.booksCount,
                tier: data.tier ?? r.tier
              }
            : r
        )
      )
      setExpandedReader((cur) =>
        cur && cur.id === reader.id
          ? {
              ...cur,
              booksLogged: data.booksLogged ?? cur.booksLogged,
              booksCount: data.booksCount ?? cur.booksCount,
              tier: data.tier ?? cur.tier
            }
          : cur
      )
    } catch (error) {
      console.error('Failed to delete logged book:', error)
      alert('Could not delete the book. Please try again.')
    }
  }

  const orderStatusBadge = (status: OnlineOrder['status']) => {
    const map: Record<OnlineOrder['status'], string> = {
      paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      shipped: 'bg-blue-100 text-blue-700 border-blue-200',
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      failed: 'bg-red-100 text-red-700 border-red-200',
      cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
    }
    return `rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${map[status]}`
  }

  const fmtDate = (ts?: { seconds: number } | null) =>
    ts?.seconds ? new Date(ts.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'

  const renderOrders = () => {
    const filtered = orders.filter((o) => (orderStatusFilter === 'all' ? true : o.status === orderStatusFilter))
    const paidCount = orders.filter((o) => o.status === 'paid').length
    const revenue = orders.filter((o) => o.status === 'paid' || o.status === 'shipped').reduce((s, o) => s + o.total, 0)
    return (
      <div className="fade-up space-y-6">
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total Orders', value: String(orders.length) },
            { label: 'Awaiting Shipment', value: String(paidCount) },
            { label: 'Revenue (paid)', value: `$${revenue.toFixed(2)}` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-5 shadow-xl border border-primary/5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{s.label}</p>
              <p className="mt-2 font-display text-2xl gradient-text">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-xl border border-primary/10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(['all', 'paid', 'shipped'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOrderStatusFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-all duration-300 ${
                    orderStatusFilter === f ? 'bg-gradient-to-r from-primary to-secondary text-white shadow' : 'bg-primary/5 text-primaryDark hover:bg-primary/10'
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={loadOrders}
              className="flex items-center gap-1.5 rounded-full border border-primary/20 px-4 py-1.5 text-xs font-bold text-primaryDark transition hover:bg-primary/5"
            >
              <svg className={`h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
          </div>

          {ordersLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted">
              <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading orders…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/40">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              </div>
              <p className="text-muted">No {orderStatusFilter === 'all' ? '' : orderStatusFilter} orders yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-xs uppercase tracking-wider text-muted">
                    <th className="pb-3 pr-4 font-semibold">Order</th>
                    <th className="pb-3 pr-4 font-semibold">Customer</th>
                    <th className="pb-3 pr-4 font-semibold">Date</th>
                    <th className="pb-3 pr-4 font-semibold">Total</th>
                    <th className="pb-3 pr-4 font-semibold">Status</th>
                    <th className="pb-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} className="border-b border-black/5 transition hover:bg-primary/5">
                      <td className="py-3 pr-4 font-mono text-xs text-muted">{o.id.slice(0, 8)}…</td>
                      <td className="py-3 pr-4"><span className="font-medium text-ink">{o.customer?.name}</span><br /><span className="text-xs text-muted">{o.customer?.email}</span></td>
                      <td className="py-3 pr-4 text-muted">{fmtDate(o.createdAt)}</td>
                      <td className="py-3 pr-4 font-bold text-primaryDark">${o.total?.toFixed(2)}</td>
                      <td className="py-3 pr-4"><span className={orderStatusBadge(o.status)}>{o.status}</span></td>
                      <td className="py-3 text-right">
                        <button type="button" onClick={() => setExpandedOrder(o)} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primaryDark transition hover:bg-primary/20">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  const summerTierBadge = (tier: SummerReader['tier']) => {
    const map: Record<string, string> = {
      seedling: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      reader: 'bg-primary/10 text-primaryDark border-primary/20',
      scholar: 'bg-secondary/10 text-secondary border-secondary/20',
      none: 'bg-gray-100 text-gray-600 border-gray-200',
    }
    return `rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${map[tier] ?? map.none}`
  }

  const exportSummerCsv = () => {
    const header = ['Code', 'Child Name', 'Child Age', 'Parent Name', 'Parent Email', 'Parent Phone', 'Books Logged', 'Tier']
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = summerReaders.map((r) => [r.code, r.childName, r.childAge, r.parentName, r.parentEmail, r.parentPhone, r.booksCount, r.tier].map(escape).join(','))
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `eduvate-summer-reads-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const renderSummer = () => {
    const scholars = summerReaders.filter((r) => r.tier === 'scholar').length
    const totalBooks = summerReaders.reduce((s, r) => s + (r.booksCount ?? 0), 0)
    return (
      <div className="fade-up space-y-6">
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total Registered', value: String(summerReaders.length) },
            { label: 'Scholars', value: String(scholars) },
            { label: 'Total Books Logged', value: String(totalBooks) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-5 shadow-xl border border-primary/5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{s.label}</p>
              <p className="mt-2 font-display text-2xl gradient-text">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-xl border border-primary/10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={exportSummerCsv}
              disabled={summerReaders.length === 0}
              className="flex items-center gap-1.5 rounded-full border border-primary/20 px-4 py-1.5 text-xs font-bold text-primaryDark transition hover:bg-primary/5 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
              Export CSV
            </button>
            <button
              type="button"
              onClick={loadSummerReaders}
              className="flex items-center gap-1.5 rounded-full border border-primary/20 px-4 py-1.5 text-xs font-bold text-primaryDark transition hover:bg-primary/5"
            >
              <svg className={`h-4 w-4 ${summerLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
          </div>

          {summerLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted">
              <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading registrations…
            </div>
          ) : summerReaders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/40">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <p className="text-muted">No registrations yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-xs uppercase tracking-wider text-muted">
                    <th className="pb-3 pr-4 font-semibold">Code</th>
                    <th className="pb-3 pr-4 font-semibold">Child</th>
                    <th className="pb-3 pr-4 font-semibold">Parent</th>
                    <th className="pb-3 pr-4 font-semibold">Books</th>
                    <th className="pb-3 pr-4 font-semibold">Tier</th>
                    <th className="pb-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {summerReaders.map((r) => (
                    <tr key={r.id} className="border-b border-black/5 transition hover:bg-primary/5">
                      <td className="py-3 pr-4 font-mono text-xs text-muted">{r.code}</td>
                      <td className="py-3 pr-4"><span className="font-medium text-ink">{r.childName}</span>{r.childAge != null && <><br /><span className="text-xs text-muted">Age {r.childAge}</span></>}</td>
                      <td className="py-3 pr-4"><span className="font-medium text-ink">{r.parentName}</span><br /><span className="text-xs text-muted">{r.parentEmail}</span></td>
                      <td className="py-3 pr-4 font-bold text-primaryDark">{r.booksCount ?? 0}</td>
                      <td className="py-3 pr-4"><span className={summerTierBadge(r.tier)}>{r.tier || 'none'}</span></td>
                      <td className="py-3 text-right">
                        <button type="button" onClick={() => setExpandedReader(r)} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primaryDark transition hover:bg-primary/20">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderInventory = () => (
    <div className="fade-up space-y-6">
      <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-purple-50/50 p-8 shadow-xl border border-purple-200/50">
        <div className="flex items-center gap-4 mb-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primaryDark shadow-soft">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </span>
          <div>
            <h2 className="font-display text-2xl gradient-text">Inventory Upload</h2>
            <p className="text-xs text-muted">Add new arrivals or update existing stock</p>
          </div>
        </div>
        <p className="text-sm text-muted mb-6 p-4 bg-primary/5 rounded-xl border border-primary/10">
          <span className="font-semibold text-primaryDark">💡 Tip:</span> Upload an .xlsx file with columns: Title, Category, Publisher, RRP, Discount %, Quantity, Selling Price
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx"
              onChange={handleInventoryUpload}
              className="hidden"
            />
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload File
            </span>
          </label>
          <button
            onClick={handleDownloadTemplate}
            className="rounded-full border-2 border-primary/30 bg-white px-6 py-3 text-sm font-semibold text-primaryDark hover:bg-primary/5 hover:-translate-y-0.5 transition-all shadow-sm"
            type="button"
          >
            Download Template
          </button>
          <button
            onClick={handleExportStock}
            className="rounded-full border-2 border-green-300 bg-white px-6 py-3 text-sm font-semibold text-green-700 hover:bg-green-50 hover:-translate-y-0.5 transition-all shadow-sm"
            type="button"
          >
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Stock
            </span>
          </button>
          {userRole === 'admin' && (
            <button
              onClick={() => setInventoryScannerOpen(true)}
              className="rounded-full border-2 border-primary/30 bg-white px-6 py-3 text-sm font-semibold text-primaryDark hover:bg-primary/5 hover:-translate-y-0.5 transition-all shadow-sm"
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" /></svg>
                Scan
              </span>
            </button>
          )}
          {userRole === 'admin' && inventory.length > 0 && (
            <button
              onClick={handleClearInventory}
              className="rounded-full border-2 border-red-300 bg-white px-6 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 hover:-translate-y-0.5 transition-all shadow-sm"
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Inventory
              </span>
            </button>
          )}
          {uploadMessage && (
            <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700 border border-green-200">
              {uploadMessage}
            </span>
          )}
        </div>
      </div>

      {noCatalogPrompt && (
        <div className="panel-card rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14A2 2 0 0021 16.7L13.7 5.3a2 2 0 00-3.4 0L3 16.7A2 2 0 004.93 19z" /></svg>
            <span>No catalogue entry for &quot;{noCatalogPrompt.title}&quot;.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { const item = noCatalogPrompt; setNoCatalogPrompt(null); openCatalogFormFromInventory(item) }}
              className="rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              Add images &amp; description
            </button>
            <button
              type="button"
              onClick={() => setNoCatalogPrompt(null)}
              className="rounded-full border-2 border-amber-300 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="panel-card overflow-hidden rounded-3xl bg-white shadow-xl border border-primary/10">
        <div className="bg-gradient-to-r from-primary/5 to-secondary/5 px-6 py-5 border-b border-primary/10">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-2xl gradient-text">Current Stock</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Total items:</span>
              <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-primaryDark shadow-sm border border-primary/10">{inventory.length}</span>
              {userRole === 'admin' && (
                <button
                  onClick={openAddInventoryItem}
                  className="rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2 text-xs font-bold text-white shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  type="button"
                >
                  + Add Item
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-primary/10 to-secondary/10 text-left">
              <tr>
                {([['title', 'Title'], ['category', 'Category'], ['publisher', 'Publisher'], ['rrp', 'RRP'], ['discount', 'Discount %'], ['quantity', 'Quantity'], ['sellingPrice', 'Selling Price']] as [keyof InventoryItem, string][]).map(([key, label]) => (
                  <th key={key} className="px-3 sm:px-6 py-3 sm:py-4">
                    <button
                      type="button"
                      onClick={() => handleInventorySort(key)}
                      className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-primaryDark hover:text-primary transition-colors cursor-pointer select-none"
                    >
                      {label}<SortIcon col={key} />
                    </button>
                  </th>
                ))}
                {userRole === 'admin' && (
                  <th className="px-3 sm:px-6 py-3 sm:py-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-primaryDark">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {sortedInventory.map((item, index) => (
                <tr key={item.id} className={`hover:bg-primary/5 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 font-medium">
                    <span className="block">{item.title}</span>
                    {item.isbn || item.sku ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" /></svg>
                        {item.isbn ? `ISBN ${item.isbn}` : `SKU ${item.sku}`}
                      </span>
                    ) : (
                      <span className="mt-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 border border-gray-200">
                        No code
                      </span>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primaryDark border border-primary/20">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-muted">{item.publisher}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">${formatNumber(item.rrp)}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    {item.discount > 0 ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 border border-green-200">
                        {item.discount}%
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                      item.quantity <= 5
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : item.quantity <= restockThreshold
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-green-100 text-green-700 border border-green-200'
                    }`}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 font-bold text-primaryDark">${formatNumber(item.sellingPrice)}</td>
                  {userRole === 'admin' && (
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => openEditInventoryItem(item)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:scale-105 transition-all"
                          type="button"
                          aria-label={`Edit ${item.title}`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => setBindTargetItem(item)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold bg-purple-50 text-primaryDark border border-primary/30 hover:scale-105 transition-all"
                          type="button"
                          aria-label={`Bind a code to ${item.title}`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" />
                          </svg>
                          Bind QR
                        </button>
                        <button
                          onClick={() => openQrLabel(item)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold bg-pink-50 text-secondary border border-secondary/30 hover:scale-105 transition-all"
                          type="button"
                          aria-label={`Print QR label for ${item.title}`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 3h3m-3 3h6m0-6v3" />
                          </svg>
                          QR Label
                        </button>
                        <button
                          onClick={() => handleDeleteInventoryItem(item)}
                          className="inline-flex items-center justify-center rounded-full p-2 text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:scale-105 transition-all"
                          type="button"
                          aria-label={`Delete ${item.title}`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderPOS = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Search & Browse */}
      <div className="lg:col-span-2 space-y-6">
        {/* Event Selection Card */}
        <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 text-primaryDark">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 5a4 4 0 100 8 4 4 0 000-8zm0 3a1 1 0 100 2 1 1 0 000-2z" /></svg>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Event</label>
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-2.5 text-sm font-medium hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
              >
                <option value="">Choose an event...</option>
                <option value="general">💰 General Sales (No Event)</option>
                {events
                  .filter((event) => event.status === 'active')
                  .map((event) => (
                    <option key={event.id} value={event.id}>
                      🎪 {event.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          {selectedEventId && selectedEventId !== 'general' && (
            <button
              onClick={() => {
                const ev = events.find((e) => e.id === selectedEventId)
                if (ev) setViewingOrderHistory(ev)
              }}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2.5 text-xs font-bold text-amber-700 border border-amber-200 hover:shadow-md transition-all"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              View Order History
            </button>
          )}
        </div>

        {/* Search & Catalog Card */}
        <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10">
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search products by title, publisher, or category..."
                className="w-full rounded-2xl border-2 border-primary/20 px-5 py-4 pr-12 text-sm font-medium hover:border-primary/40 focus:border-primary focus:outline-none transition-colors shadow-sm"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredInventory.length ? (
              filteredInventory.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-50/50 to-pink-50/50 hover:from-purple-50 hover:to-pink-50 border border-primary/10 hover:border-primary/20 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 text-sm mb-1 truncate">{item.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span className="px-2 py-1 rounded-full bg-white/80 border border-primary/10">
                        {item.category}
                      </span>
                      <span className={`font-semibold ${item.quantity <= 5 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.quantity > 0 ? `${item.quantity} in stock` : 'Out of stock'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary mb-2">${formatNumber(item.sellingPrice)}</p>
                    <button
                      onClick={() => handleAddToCart(item.id)}
                      className="rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2 text-xs font-bold text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                      type="button"
                      disabled={item.quantity === 0}
                    >
                      <span className="mr-1">+</span> Add
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 flex flex-col items-center">
                <svg className="h-14 w-14 mb-4 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                  {searchQuery ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  )}
                </svg>
                <p className="text-gray-500 font-medium">
                  {searchQuery ? 'No products found' : 'Start searching to browse products'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Cart & Checkout */}
      <div className="space-y-6">
        {/* Shopping Cart Card */}
        <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10 lg:sticky lg:top-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 text-primaryDark">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800">Cart</h3>
            </div>
            {cartItems.length > 0 && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary text-xs font-bold text-white shadow-md">
                {cartItems.length}
              </span>
            )}
          </div>

          {/* Cart Items */}
          <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {cartItems.length ? (
              cartItems.map((item) => (
                <div key={item.itemId} className="p-3 rounded-xl bg-gradient-to-r from-purple-50/30 to-pink-50/30 border border-primary/10">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="font-bold text-sm text-gray-800 mb-1">{item.title}</h4>
                      <p className="text-xs text-muted">${formatNumber(item.price)} each</p>
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(item.itemId)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      type="button"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateCartQuantity(item.itemId, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border-2 border-primary/20 hover:border-primary/40 transition-colors"
                        type="button"
                      >
                        <span className="text-sm font-bold">−</span>
                      </button>
                      <span className="w-10 text-center font-bold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateCartQuantity(item.itemId, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border-2 border-primary/20 hover:border-primary/40 transition-colors"
                        type="button"
                      >
                        <span className="text-sm font-bold">+</span>
                      </button>
                    </div>
                    <span className="text-base font-bold text-primary">
                      ${formatNumber(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 flex flex-col items-center">
                <svg className="h-12 w-12 mb-3 text-primary/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-sm text-gray-400">Your cart is empty</p>
              </div>
            )}
          </div>

          {cartItems.length > 0 && (
            <>
              {/* Payment Method */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentType('Cash')}
                    className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                      paymentType === 'Cash'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white border-transparent shadow-md'
                        : 'bg-white text-gray-700 border-primary/20 hover:border-primary/40'
                    }`}
                    type="button"
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      Cash
                    </span>
                  </button>
                  <button
                    onClick={() => setPaymentType('Card')}
                    className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                      paymentType === 'Card'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white border-transparent shadow-md'
                        : 'bg-white text-gray-700 border-primary/20 hover:border-primary/40'
                    }`}
                    type="button"
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                      Card
                    </span>
                  </button>
                  <button
                    onClick={() => setPaymentType('Transfer')}
                    className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                      paymentType === 'Transfer'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white border-transparent shadow-md'
                        : 'bg-white text-gray-700 border-primary/20 hover:border-primary/40'
                    }`}
                    type="button"
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 10h16M5 6l7-3 7 3M5 10v11m4-11v11m6-11v11m4-11v11" /></svg>
                      Transfer
                    </span>
                  </button>
                </div>
              </div>

              {/* Discount */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">Discount (Optional)</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => setDiscountType('percentage')}
                    className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                      discountType === 'percentage'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white border-transparent shadow-md'
                        : 'bg-white text-gray-700 border-primary/20 hover:border-primary/40'
                    }`}
                    type="button"
                  >
                    % Percentage
                  </button>
                  <button
                    onClick={() => setDiscountType('amount')}
                    className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                      discountType === 'amount'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white border-transparent shadow-md'
                        : 'bg-white text-gray-700 border-primary/20 hover:border-primary/40'
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
                    className="w-full rounded-xl border-2 border-primary/20 px-4 py-2.5 text-sm hover:border-primary/40 focus:border-primary focus:outline-none transition-colors pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                    {discountType === 'percentage' ? '%' : '$'}
                  </span>
                </div>
                {discount > 0 && (
                  <p className="text-xs text-green-600 mt-2 font-medium">
                    💰 Discount: -${formatNumber(discountAmount)}
                  </p>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-3 mb-6 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Subtotal</span>
                  <span className="font-semibold">${formatNumber(cartTotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({discountType === 'percentage' ? `${discount}%` : `$${formatNumber(discount)}`})</span>
                    <span className="font-semibold">-${formatNumber(discountAmount)}</span>
                  </div>
                )}
                {paymentType === 'Card' && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Card Fee (3%)</span>
                    <span className="font-semibold">${formatNumber(convenienceFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-gray-800 pt-3 border-t-2 border-primary/20">
                  <span>Total</span>
                  <span className="gradient-text">${formatNumber(totalWithFee)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowConfirmSale(true)}
                  className="w-full rounded-2xl bg-gradient-to-r from-primary to-secondary px-6 py-4 text-sm font-bold text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  type="button"
                  disabled={!selectedEventId || cartItems.length === 0}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Complete Sale
                  </span>
                </button>
                <button
                  onClick={handleClearCart}
                  className="w-full rounded-xl border-2 border-red-200 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                  type="button"
                >
                  Clear Cart
                </button>
              </div>

              {eventMessage && (
                <div className="mt-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
                  <p className="text-xs text-center text-blue-700 font-medium">{eventMessage}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  const renderEvents = () => (
    <div className="fade-up space-y-6">
      <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-blue-50/50 p-6 shadow-xl border border-blue-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-accentThree shadow-soft">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /></svg>
            </span>
            <div>
              <h2 className="font-display text-2xl gradient-text">Event Management</h2>
              <p className="text-xs text-muted">Schedule events with dates and vendor fees</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateEvent(true)}
            className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all"
            type="button"
          >
            + New Event
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primaryDark">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </span>
              <div>
                <h3 className="font-display text-xl gradient-text">All Events</h3>
                <span className="text-xs font-semibold text-muted">{events.length} total</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 mb-4">
            <select
              value={eventTypeFilter}
              onChange={(event) =>
                setEventTypeFilter(event.target.value as typeof eventTypeFilter)
              }
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm font-medium hover:border-primary/40 transition-colors"
            >
              <option value="All">All types</option>
              <option value="Bazaar">Bazaar</option>
              <option value="Bookfair">Bookfair</option>
              <option value="Jummah Boot">Jummah Boot</option>
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="date"
                value={eventDateStart}
                onChange={(event) => setEventDateStart(event.target.value)}
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
              />
              <input
                type="date"
                value={eventDateEnd}
                onChange={(event) => setEventDateEnd(event.target.value)}
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
              />
            </div>
          </div>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {filteredEvents.map((event) => {
              const totalSales = event.sales.reduce((sum, sale) => sum + sale.total, 0)
              return (
                <div key={event.id} className="group rounded-2xl border-2 border-primary/10 p-5 hover:border-primary/30 hover:shadow-lg transition-all bg-gradient-to-br from-white to-primary/5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-2">
                    <div className="flex-1">
                      <p className="font-bold text-base sm:text-lg text-primaryDark mb-1">{event.name}</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span
                          className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${eventTypeBadgeClasses[event.type]}`}
                        >
                          {event.type}
                        </span>
                        <button
                          onClick={() => handleToggleEventStatus(event.id)}
                          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                            event.status === 'active'
                              ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200 hover:scale-105 cursor-pointer'
                              : 'bg-gray-100 text-gray-500 border border-gray-200 cursor-not-allowed opacity-70'
                          }`}
                          type="button"
                          title={event.status === 'closed' ? 'Edit event to reactivate' : 'Click to close event'}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {event.status === 'active' ? (
                              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            )}
                            {event.status === 'active' ? 'Active' : 'Closed'}
                          </span>
                        </button>
                        <button
                          onClick={() => openEditEvent(event)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 transition-all hover:scale-105"
                          type="button"
                          aria-label={`Edit ${event.name}`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Edit
                        </button>
                        <button
                          onClick={() => setViewingEventTransactions(event)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border border-purple-200 transition-all hover:scale-105"
                          type="button"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6m4 6V9m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          View Transactions
                        </button>
                        <button
                          onClick={() => setViewingOrderHistory(event)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200 transition-all hover:scale-105"
                          type="button"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                          Order History
                        </button>
                        <button
                          onClick={() => openExpenses(event)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-700 border border-teal-200 transition-all hover:scale-105"
                          type="button"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          Expenses{event.expenses.length > 0 ? ` (${event.expenses.length})` : ''}
                        </button>
                        {userRole === 'admin' && (
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-red-50 to-red-100 text-red-700 border border-red-200 transition-all hover:scale-105"
                            type="button"
                            aria-label={`Delete ${event.name}`}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold gradient-text">${formatNumber(totalSales)}</p>
                      <p className="text-xs text-muted">{event.sales.length} transactions</p>
                      {(event.expenses.length > 0 || event.cost > 0) && (
                        <p className="text-xs text-muted mt-1">
                          Costs: ${formatNumber(event.cost + event.expenses.reduce((s, e) => s + e.amount, 0))}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted bg-white/50 rounded-xl p-3 border border-primary/5">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span>{event.location || 'Location TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span>{event.startDate || 'TBD'} - {event.endDate || 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      <span>Vendor fee: ${formatNumber(event.cost)}</span>
                    </div>
                    {event.expenses.length > 0 && (
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <span>{event.expenses.length} expense{event.expenses.length !== 1 ? 's' : ''}: ${formatNumber(event.expenses.reduce((s, e) => s + e.amount, 0))}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* General Sales Card */}
            {generalSales.length > 0 && (
              <div className="group rounded-2xl border-2 border-emerald-200 p-5 hover:border-emerald-300 hover:shadow-lg transition-all bg-gradient-to-br from-white to-emerald-50/50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="font-bold text-lg text-primaryDark mb-1">💰 General Sales</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="rounded-full px-3 py-1 text-[11px] font-bold bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200">
                        No Event
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                        Always Active
                      </span>
                      <button
                        onClick={() => setViewingEventTransactions({
                          id: 'general', name: 'General Sales', type: 'Bazaar', location: 'Various',
                          startDate: '', endDate: '', cost: 0, status: 'active', sales: generalSales, orders: generalOrders, expenses: []
                        })}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border border-purple-200 transition-all hover:scale-105"
                        type="button"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6m4 6V9m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        View Transactions
                      </button>
                      <button
                        onClick={() => setViewingOrderHistory({
                          id: 'general', name: 'General Sales', type: 'Bazaar', location: 'Various',
                          startDate: '', endDate: '', cost: 0, status: 'active', sales: generalSales, orders: generalOrders, expenses: []
                        })}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200 transition-all hover:scale-105"
                        type="button"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        Order History
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold gradient-text">${formatNumber(generalSales.reduce((sum, s) => sum + s.total, 0))}</p>
                    <p className="text-xs text-muted">{generalSales.length} transactions</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted bg-white/50 rounded-xl p-3 border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Sales made outside of any specific event</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <span>{generalOrders.length} order{generalOrders.length !== 1 ? 's' : ''} recorded</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">Create New Event</h4>
                <p className="mt-2 text-sm text-muted">
                  Add dates, vendor fee, and keep the event active.
                </p>
              </div>
              <button
                onClick={() => setShowCreateEvent(false)}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                <span>Close</span>
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Event name *</label>
                <input
                  type="text"
                  value={newEventName}
                  onChange={(event) => setNewEventName(event.target.value)}
                  placeholder="e.g., Masjid Book Fair"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Location *</label>
                <input
                  type="text"
                  value={newEventLocation}
                  onChange={(event) => setNewEventLocation(event.target.value)}
                  placeholder="e.g., Downtown Community Center"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Start date *</label>
                <input
                  type="date"
                  value={newEventStart}
                  onChange={(event) => setNewEventStart(event.target.value)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">End date *</label>
                <input
                  type="date"
                  value={newEventEnd}
                  onChange={(event) => setNewEventEnd(event.target.value)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Event type *</label>
                <select
                  value={newEventType}
                  onChange={(event) =>
                    setNewEventType(event.target.value as EventRecord['type'])
                  }
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                >
                  <option value="Bazaar">Bazaar</option>
                  <option value="Bookfair">Bookfair</option>
                  <option value="Jummah Boot">Jummah Boot</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Vendor fee ($) *</label>
                <input
                  type="number"
                  value={newEventCost}
                  onChange={(event) => setNewEventCost(event.target.value)}
                  placeholder="e.g., 120"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateEvent(false)}
                className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                type="button"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">Edit Event</h4>
                <p className="mt-2 text-sm text-muted">
                  Update event details. Changes sync to Firebase.
                </p>
              </div>
              <button
                onClick={() => setEditingEvent(null)}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                <span>Close</span>
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Event name *</label>
                <input
                  type="text"
                  value={editEventName}
                  onChange={(e) => setEditEventName(e.target.value)}
                  placeholder="e.g., Masjid Book Fair"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Location *</label>
                <input
                  type="text"
                  value={editEventLocation}
                  onChange={(e) => setEditEventLocation(e.target.value)}
                  placeholder="e.g., Downtown Community Center"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Start date *</label>
                <input
                  type="date"
                  value={editEventStart}
                  onChange={(e) => setEditEventStart(e.target.value)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">End date *</label>
                <input
                  type="date"
                  value={editEventEnd}
                  onChange={(e) => setEditEventEnd(e.target.value)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Event type *</label>
                <select
                  value={editEventType}
                  onChange={(e) => setEditEventType(e.target.value as EventRecord['type'])}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                >
                  <option value="Bazaar">Bazaar</option>
                  <option value="Bookfair">Bookfair</option>
                  <option value="Jummah Boot">Jummah Boot</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Vendor fee ($) *</label>
                <input
                  type="number"
                  value={editEventCost}
                  onChange={(e) => setEditEventCost(e.target.value)}
                  placeholder="e.g., 120"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Event status *</label>
                <select
                  value={editEventStatus}
                  onChange={(e) => setEditEventStatus(e.target.value as EventStatus)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                >
                  <option value="active">● Active</option>
                  <option value="closed">○ Closed</option>
                </select>
                <p className="text-[10px] text-muted mt-1">
                  {editEventStatus === 'active'
                    ? 'Event is active and accepting transactions.'
                    : 'Event is closed. No new transactions will be accepted.'}
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingEvent(null)}
                className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleEditEvent}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                type="button"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingEventTransactions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-5xl rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">{viewingEventTransactions.name} - Sales Record</h4>
                <p className="mt-2 text-sm text-muted">
                  {viewingEventTransactions.sales.length} total sales · ${formatNumber(viewingEventTransactions.sales.reduce((sum, sale) => sum + sale.total, 0))} total revenue
                </p>
              </div>
              <button
                onClick={() => setViewingEventTransactions(null)}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                <span>Close</span>
              </button>
            </div>

            {viewingEventTransactions.sales.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl flex flex-col items-center">
                <svg className="h-14 w-14 mb-4 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6m4 6V9m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                <p className="text-lg font-semibold text-gray-700">No transactions yet</p>
                <p className="text-sm text-muted mt-2">Sales will appear here once the event goes live</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {(() => {
                  // Group sales by itemId
                  const groupedSales = viewingEventTransactions.sales.reduce((acc, sale) => {
                    const key = sale.itemId || sale.title;
                    if (!acc[key]) {
                      acc[key] = {
                        itemId: sale.itemId,
                        title: sale.title,
                        totalQuantity: 0,
                        totalAmount: 0,
                        transactions: 0,
                        paymentTypes: new Set<string>(),
                        firstTimestamp: sale.timestamp
                      };
                    }
                    acc[key].totalQuantity += sale.quantity;
                    acc[key].totalAmount += sale.total;
                    acc[key].transactions += 1;
                    acc[key].paymentTypes.add(sale.paymentType);
                    return acc;
                  }, {} as Record<string, {
                    itemId: string;
                    title: string;
                    totalQuantity: number;
                    totalAmount: number;
                    transactions: number;
                    paymentTypes: Set<string>;
                    firstTimestamp: string;
                  }>);

                  return Object.values(groupedSales).map((item, index) => (
                    <div key={item.itemId || item.title} className="rounded-2xl border-2 border-primary/10 p-5 bg-gradient-to-br from-white to-primary/5 hover:border-primary/30 transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
                            Item #{Object.values(groupedSales).length - index}
                          </p>
                          <p className="font-bold text-lg text-primaryDark mb-2">{item.title}</p>
                          <div className="flex flex-wrap gap-2 items-center">
                            {Array.from(item.paymentTypes).map((paymentType) => (
                              <span key={paymentType} className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                                paymentType === 'Cash' 
                                  ? 'bg-green-100 text-green-700 border border-green-200'
                                  : paymentType === 'Card'
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-purple-100 text-purple-700 border border-purple-200'
                              }`}>
                                {paymentType === 'Cash' ? '💵' : paymentType === 'Card' ? '💳' : '🏦'} {paymentType}
                              </span>
                            ))}
                            <span className="text-xs text-muted">
                              {item.transactions} transaction{item.transactions > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-2xl font-bold gradient-text">${formatNumber(item.totalAmount)}</p>
                          <p className="text-xs text-muted mt-1">{item.totalQuantity} × item{item.totalQuantity > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}

            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Sales</p>
                  <p className="text-2xl font-bold gradient-text">{viewingEventTransactions.sales.length}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold gradient-text">
                    ${formatNumber(viewingEventTransactions.sales.reduce((sum, sale) => sum + sale.total, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Items Sold</p>
                  <p className="text-2xl font-bold gradient-text">
                    {viewingEventTransactions.sales.reduce((sum, sale) => sum + sale.quantity, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Avg. Sale</p>
                  <p className="text-2xl font-bold gradient-text">
                    ${formatNumber(viewingEventTransactions.sales.length > 0 
                      ? viewingEventTransactions.sales.reduce((sum, sale) => sum + sale.total, 0) / viewingEventTransactions.sales.length 
                      : 0
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order History Modal */}
      {viewingOrderHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-5xl rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-amber-200/50 animate-fadeIn my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">{viewingOrderHistory.name} - Order History</h4>
                <p className="mt-2 text-sm text-muted">
                  {viewingOrderHistory.orders.length} order{viewingOrderHistory.orders.length !== 1 ? 's' : ''} · ${formatNumber(viewingOrderHistory.orders.reduce((sum, o) => sum + o.total, 0))} total
                </p>
              </div>
              <div className="flex items-center gap-2">
                {viewingOrderHistory.orders.length > 0 && (
                  <button
                    onClick={() => downloadEventTxt(viewingOrderHistory.name, viewingOrderHistory.orders)}
                    className="inline-flex items-center gap-1.5 rounded-full border-2 border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-100 transition-colors"
                    type="button"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download TXT
                  </button>
                )}
                <button
                  onClick={() => setViewingOrderHistory(null)}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                  type="button"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Close</span>
                </button>
              </div>
            </div>

            {viewingOrderHistory.orders.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl flex flex-col items-center">
                <svg className="h-14 w-14 mb-4 text-amber-500/50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                <p className="text-lg font-semibold text-gray-700">No orders yet</p>
                <p className="text-sm text-muted mt-2">Orders will appear here once sales are confirmed</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {viewingOrderHistory.orders.map((order, idx) => (
                  <div key={order.id} className="rounded-2xl border-2 border-amber-100 p-5 bg-gradient-to-br from-white to-amber-50/50 hover:border-amber-200 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
                          Order #{viewingOrderHistory.orders.length - idx}
                        </p>
                        <p className="text-xs text-muted inline-flex items-center gap-1.5">
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {new Date(order.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          order.paymentType === 'Cash'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : order.paymentType === 'Card'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-purple-100 text-purple-700 border border-purple-200'
                        }`}>
                          {order.paymentType === 'Cash' ? '💵' : order.paymentType === 'Card' ? '💳' : '🏦'} {order.paymentType}
                        </span>
                        {userRole === 'admin' && (
                          <>
                            <button
                              onClick={() => openEditOrder(order)}
                              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:scale-105 transition-all"
                              type="button"
                              aria-label="Edit order"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order)}
                              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:scale-105 transition-all"
                              type="button"
                              aria-label="Delete order"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-primary/5 text-sm">
                          <div>
                            <span className="font-semibold">{item.quantity}× </span>
                            <span>{item.title}</span>
                          </div>
                          <span className="font-bold text-primaryDark">${formatNumber(item.lineTotal)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1 px-3 py-2 rounded-xl bg-gradient-to-r from-gray-50 to-amber-50/50 border border-primary/5 text-sm">
                      <div className="flex justify-between text-muted">
                        <span>Subtotal</span>
                        <span>${formatNumber(order.subtotal)}</span>
                      </div>
                      {order.discount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Discount ({order.discountType === 'percentage' ? `${order.discountValue}%` : `$${order.discountValue}`})</span>
                          <span>-${formatNumber(order.discount)}</span>
                        </div>
                      )}
                      {order.convenienceFee > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>Card fee (3%)</span>
                          <span>+${formatNumber(order.convenienceFee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-1 border-t border-primary/10">
                        <span className="gradient-text">Total</span>
                        <span className="gradient-text">${formatNumber(order.total)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewingOrderHistory.orders.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Orders</p>
                    <p className="text-2xl font-bold gradient-text">{viewingOrderHistory.orders.length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold gradient-text">${formatNumber(viewingOrderHistory.orders.reduce((sum, o) => sum + o.total, 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Items Sold</p>
                    <p className="text-2xl font-bold gradient-text">{viewingOrderHistory.orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Avg. Order</p>
                    <p className="text-2xl font-bold gradient-text">
                      ${formatNumber(viewingOrderHistory.orders.length > 0
                        ? viewingOrderHistory.orders.reduce((sum, o) => sum + o.total, 0) / viewingOrderHistory.orders.length
                        : 0
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Order Modal (Admin Only) */}
      {editingOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-blue-200/50 animate-fadeIn my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">Edit Order</h4>
                <p className="mt-2 text-sm text-muted">
                  {new Date(editingOrder.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => { setEditingOrder(null); setEditOrderItems([]); }}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/20 text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Items</label>
              {editOrderItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{item.title}</p>
                    <p className="text-xs text-muted">${formatNumber(item.price)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditOrderItems((prev) =>
                          prev.map((it, idx) => idx === i && it.quantity > 1
                            ? { ...it, quantity: it.quantity - 1, lineTotal: Number(((it.quantity - 1) * it.price).toFixed(2)) }
                            : it
                          )
                        )
                      }}
                      className="w-7 h-7 rounded-full bg-white border-2 border-primary/20 text-sm font-bold hover:bg-primary/10 transition-colors"
                      type="button"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-bold">{item.quantity}</span>
                    <button
                      onClick={() => {
                        setEditOrderItems((prev) =>
                          prev.map((it, idx) => idx === i
                            ? { ...it, quantity: it.quantity + 1, lineTotal: Number(((it.quantity + 1) * it.price).toFixed(2)) }
                            : it
                          )
                        )
                      }}
                      className="w-7 h-7 rounded-full bg-white border-2 border-primary/20 text-sm font-bold hover:bg-primary/10 transition-colors"
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-bold text-primaryDark min-w-[70px] text-right">${formatNumber(item.quantity * item.price)}</span>
                  <button
                    onClick={() => setEditOrderItems((prev) => prev.filter((_, idx) => idx !== i))}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
                    type="button"
                    aria-label="Remove item"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Payment Type</label>
              <select
                value={editOrderPaymentType}
                onChange={(e) => setEditOrderPaymentType(e.target.value as Sale['paymentType'])}
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
              >
                <option value="Cash">💵 Cash</option>
                <option value="Card">💳 Card</option>
                <option value="Transfer">🏦 Transfer</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-gradient-to-r from-gray-50 to-primary/5 border border-primary/10 text-sm space-y-1 mb-6">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>${formatNumber(editOrderItems.reduce((sum, it) => sum + it.quantity * it.price, 0))}</span>
              </div>
              {editingOrder.discountValue > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount ({editingOrder.discountType === 'percentage' ? `${editingOrder.discountValue}%` : `$${editingOrder.discountValue}`})</span>
                  <span>-${formatNumber(
                    editingOrder.discountType === 'percentage'
                      ? editOrderItems.reduce((sum, it) => sum + it.quantity * it.price, 0) * (editingOrder.discountValue / 100)
                      : editingOrder.discountValue
                  )}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-1 border-t border-primary/10">
                <span>Total</span>
                <span className="gradient-text">${formatNumber((() => {
                  const sub = editOrderItems.reduce((sum, it) => sum + it.quantity * it.price, 0)
                  const disc = editingOrder.discountType === 'percentage' ? sub * (editingOrder.discountValue / 100) : editingOrder.discountValue
                  const after = sub - disc
                  const fee = editOrderPaymentType === 'Card' ? after * 0.03 : 0
                  return after + fee
                })())}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setEditingOrder(null); setEditOrderItems([]); }}
                className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditOrder}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                type="button"
                disabled={editOrderItems.length === 0}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Save Changes
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Modal */}
      {viewingExpenses && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-teal-200/50 animate-fadeIn my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">{viewingExpenses.name} - Expenses</h4>
                <p className="mt-2 text-sm text-muted">
                  {viewingExpenses.expenses.length} expense{viewingExpenses.expenses.length !== 1 ? 's' : ''} · ${formatNumber(viewingExpenses.expenses.reduce((sum, e) => sum + e.amount, 0))} total
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { resetExpenseForm(); setShowAddExpense(true) }}
                  className="rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-2 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  type="button"
                >
                  + Add Expense
                </button>
                <button
                  onClick={() => { setViewingExpenses(null); resetExpenseForm(); setShowAddExpense(false) }}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                  type="button"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Close</span>
                </button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 p-4 border border-teal-200/50 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Expenses</p>
                <p className="text-2xl font-bold text-teal-700">${formatNumber(viewingExpenses.expenses.reduce((s, e) => s + e.amount, 0))}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 border border-blue-200/50 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">+ Vendor Fee</p>
                <p className="text-2xl font-bold text-blue-700">${formatNumber(viewingExpenses.cost)}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 p-4 border border-purple-200/50 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Total Costs</p>
                <p className="text-2xl font-bold gradient-text">${formatNumber(viewingExpenses.cost + viewingExpenses.expenses.reduce((s, e) => s + e.amount, 0))}</p>
              </div>
            </div>

            {/* Add / Edit Expense Form */}
            {showAddExpense && (
              <div className="mb-6 rounded-2xl bg-gradient-to-br from-teal-50/50 to-cyan-50/30 p-5 border border-teal-200/30">
                <h5 className="font-display text-lg gradient-text mb-4">{editingExpense ? 'Edit Expense' : 'Add New Expense'}</h5>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">Description *</label>
                    <input
                      type="text"
                      value={expenseDescription}
                      onChange={(e) => setExpenseDescription(e.target.value)}
                      placeholder="e.g., Uber to venue"
                      className="w-full rounded-xl border-2 border-teal-200 px-4 py-3 text-sm hover:border-teal-400 transition-colors focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">Amount ($) *</label>
                    <input
                      type="number"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full rounded-xl border-2 border-teal-200 px-4 py-3 text-sm hover:border-teal-400 transition-colors focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">Category</label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value as Expense['category'])}
                      className="w-full rounded-xl border-2 border-teal-200 px-4 py-3 text-sm hover:border-teal-400 transition-colors focus:border-teal-500 focus:outline-none"
                    >
                      <option value="Transport">🚗 Transport</option>
                      <option value="Supplies">🛒 Supplies</option>
                      <option value="Food">🍔 Food</option>
                      <option value="Printing">🖨️ Printing</option>
                      <option value="Decoration">🎨 Decoration</option>
                      <option value="Other">📌 Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted mb-1 block">Date</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full rounded-xl border-2 border-teal-200 px-4 py-3 text-sm hover:border-teal-400 transition-colors focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <button
                      onClick={handleSaveExpense}
                      disabled={!expenseDescription.trim() || parseNumber(expenseAmount) <= 0}
                      className="flex-1 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        {editingExpense ? (
                          <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Update</>
                        ) : (
                          <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>Add</>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => { setShowAddExpense(false); resetExpenseForm() }}
                      className="rounded-full border-2 border-teal-200 px-4 py-3 text-sm font-bold text-teal-700 hover:bg-teal-50 transition-colors"
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Expense List */}
            {viewingExpenses.expenses.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {viewingExpenses.expenses.map((expense) => {
                  const categoryIcons: Record<Expense['category'], string> = {
                    Transport: '🚗', Supplies: '🛒', Food: '🍔', Printing: '🖨️', Decoration: '🎨', Other: '📌'
                  }
                  return (
                    <div key={expense.id} className="group flex items-center justify-between rounded-2xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/30 p-4 hover:border-teal-200 hover:shadow-md transition-all">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 text-lg shrink-0">
                          {categoryIcons[expense.category] || '📌'}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-primaryDark truncate">{expense.description}</p>
                          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-700 font-medium">{expense.category}</span>
                            <span>{expense.date}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-lg font-bold text-teal-700">${formatNumber(expense.amount)}</span>
                        <button
                          onClick={() => openEditExpense(expense)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-blue-600 hover:bg-blue-50 transition-colors"
                          type="button"
                          title="Edit"
                          aria-label="Edit expense"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50 transition-colors"
                          type="button"
                          title="Delete"
                          aria-label="Delete expense"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 flex flex-col items-center">
                <svg className="h-12 w-12 mb-3 text-teal-500/50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                <p className="text-sm text-muted">No expenses recorded for this event yet.</p>
                <p className="text-xs text-muted mt-1">Click &quot;+ Add Expense&quot; to track costs.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-indigo-50/50 p-6 shadow-xl border border-indigo-200/50">
        <div className="flex items-center gap-3 mb-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 text-primaryDark shadow-soft">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6M15 19V9M4 21h16M12 21V5" /></svg>
          </span>
          <h3 className="font-display text-2xl gradient-text">Event Summaries</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {/* General Sales Summary */}
          {generalSales.length > 0 && (() => {
            const totalSales = generalSales.reduce((sum, sale) => sum + sale.total, 0)
            const transactions = generalSales.length
            const bestSeller = generalSales
              .reduce((acc, sale) => {
                acc[sale.title] = (acc[sale.title] ?? 0) + sale.quantity
                return acc
              }, {} as Record<string, number>)
            const bestSellerName = Object.entries(bestSeller)
              .sort(([, a], [, b]) => b - a)
              .map(([name]) => name)[0]
            return (
              <div className="rounded-2xl border-2 border-emerald-200/50 p-5 bg-gradient-to-br from-white to-emerald-50/30 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-lg text-primaryDark">💰 General Sales</p>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                    Always Active
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-muted">
                    <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Sales outside events · {generalOrders.length} orders</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-emerald-200/50">
                    <div className="rounded-xl bg-white/80 p-3 border border-emerald-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Total Sales</p>
                      <p className="text-lg font-bold gradient-text">${formatNumber(totalSales)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 border border-emerald-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Transactions</p>
                      <p className="text-lg font-bold text-primaryDark">{transactions}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-emerald-200/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Best Seller</p>
                    <p className="font-semibold text-primaryDark">{bestSellerName ?? 'No sales yet'}</p>
                  </div>
                </div>
              </div>
            )
          })()}
          {events.map((event) => {
            const totalSales = event.sales.reduce((sum, sale) => sum + sale.total, 0)
            const transactions = event.sales.length
            const bestSeller = event.sales
              .reduce((acc, sale) => {
                acc[sale.title] = (acc[sale.title] ?? 0) + sale.quantity
                return acc
              }, {} as Record<string, number>)

            const bestSellerName = Object.entries(bestSeller)
              .sort(([, a], [, b]) => b - a)
              .map(([name]) => name)[0]

            return (
              <div key={event.id} className="rounded-2xl border-2 border-indigo-200/50 p-5 bg-gradient-to-br from-white to-indigo-50/30 hover:border-indigo-300 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-lg text-primaryDark">{event.name}</p>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    event.status === 'active'
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${event.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} aria-hidden="true" />
                      {event.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-muted">
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /></svg>
                    <span>{event.type} · {event.location || 'Location TBD'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>{event.startDate || 'TBD'} - {event.endDate || 'TBD'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-indigo-200/50">
                    <div className="rounded-xl bg-white/80 p-3 border border-indigo-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Total Sales</p>
                      <p className="text-lg font-bold gradient-text">${formatNumber(totalSales)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 border border-indigo-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Transactions</p>
                      <p className="text-lg font-bold text-primaryDark">{transactions}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 border border-indigo-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Total Costs</p>
                      <p className="text-lg font-bold text-red-600">${formatNumber(event.cost + event.expenses.reduce((s, e) => s + e.amount, 0))}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 border border-indigo-200/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Net Profit</p>
                      <p className={`text-lg font-bold ${(() => {
                        const markup = event.sales.reduce((s, sale) => s + (sale.sellingPrice - sale.rrp) * sale.quantity, 0)
                        const expenses = event.expenses.reduce((s, e) => s + e.amount, 0) + event.cost
                        return markup - expenses >= 0 ? 'text-green-600' : 'text-red-600'
                      })()}`}>
                        ${formatNumber((() => {
                          const markup = event.sales.reduce((s, sale) => s + (sale.sellingPrice - sale.rrp) * sale.quantity, 0)
                          const expenses = event.expenses.reduce((s, e) => s + e.amount, 0) + event.cost
                          return markup - expenses
                        })())}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-indigo-200/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Best Seller</p>
                    <p className="font-semibold text-primaryDark">{bestSellerName ?? 'No sales yet'}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const catalogAgeBadgeClasses: Record<AgeCategory, string> = {
    '0-5': 'bg-gradient-to-r from-pink-100 to-pink-50 text-pink-700 border border-pink-200',
    '6-9': 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 border border-blue-200',
    '10+': 'bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700 border border-purple-200',
    'Adult': 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-200'
  }

  const catalogCategoryBadgeClasses: Record<InventoryCategory, string> = {
    Books: 'bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 border border-emerald-200',
    'Activity Books': 'bg-gradient-to-r from-teal-100 to-teal-50 text-teal-700 border border-teal-200',
    Cards: 'bg-gradient-to-r from-sky-100 to-sky-50 text-sky-700 border border-sky-200',
    Crafts: 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border border-amber-200',
    Puzzles: 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-700 border border-indigo-200',
    Games: 'bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700 border border-orange-200',
    Gifts: 'bg-gradient-to-r from-rose-100 to-rose-50 text-rose-700 border border-rose-200',
    Others: 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-200'
  }

  const renderCatalogFormModal = (isEdit: boolean) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h4 className="font-display text-2xl gradient-text">{isEdit ? 'Edit Catalog Item' : 'New Catalog Item'}</h4>
            <p className="mt-2 text-sm text-muted">
              {isEdit ? 'Update item details and images.' : 'Add a new item to your catalog.'}
            </p>
          </div>
          <button
            onClick={() => { isEdit ? setEditingCatalogItem(null) : setShowCreateCatalog(false); resetCatalogForm() }}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
            type="button"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            <span>Close</span>
          </button>
        </div>

        {catalogMessage && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
            {catalogMessage}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Title *</label>
            <input
              type="text"
              list="catalog-titles-list"
              value={catalogTitle}
              onChange={(e) => setCatalogTitle(e.target.value)}
              placeholder="e.g., My First Quran Stories"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
            />
            <datalist id="catalog-titles-list">
              {inventoryTitles.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Description *</label>
            <textarea
              value={catalogDescription}
              onChange={(e) => setCatalogDescription(e.target.value)}
              placeholder="Describe the item..."
              rows={3}
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors resize-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Categories * (Select one or more)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_CATALOG_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-all ${
                    catalogCategories.includes(cat)
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-primary/20 hover:border-primary/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={catalogCategories.includes(cat)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCatalogCategories((prev) => [...prev, cat])
                      } else {
                        setCatalogCategories((prev) => prev.filter((c) => c !== cat))
                      }
                    }}
                    className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary/50"
                  />
                  <span className="text-xs font-semibold text-primaryDark">{cat}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Age Category * (Select multiple)</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(AGE_CATEGORIES) as AgeCategory[]).map((age) => (
                <label
                  key={age}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-all ${
                    catalogAge.includes(age)
                      ? 'border-primary bg-primary/5'
                      : 'border-primary/20 hover:border-primary/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={catalogAge.includes(age)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCatalogAge((prev) => [...prev, age])
                      } else {
                        setCatalogAge((prev) => prev.filter((a) => a !== age))
                      }
                    }}
                    className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary/50"
                  />
                  <span className="text-xs font-semibold text-primaryDark">
                    {ageShortLabel(age)} <span className="font-normal text-muted">({AGE_CATEGORIES[age].title})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Price ($) *</label>
            <input
              type="number"
              value={catalogPrice}
              onChange={(e) => setCatalogPrice(e.target.value)}
              placeholder="e.g., 12.99"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Publisher *</label>
            <input
              type="text"
              list="catalog-publishers-list"
              value={catalogPublisher}
              onChange={(e) => setCatalogPublisher(e.target.value)}
              placeholder="e.g., Learning Roots"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
            />
            <datalist id="catalog-publishers-list">
              {inventoryPublishers.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">SKU</label>
            <input
              type="text"
              value={catalogSku}
              onChange={(e) => setCatalogSku(e.target.value)}
              placeholder="e.g., EK-1024 (links to inventory)"
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
            />
            <p className="mt-1 text-[11px] text-muted">Shared SKU links this product to an inventory stock record.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Quantity</label>
              <input
                type="number"
                value={catalogQty}
                onChange={(e) => setCatalogQty(e.target.value)}
                placeholder="e.g., 20"
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Selling Price ($)</label>
              <input
                type="number"
                value={catalogSellingPrice}
                onChange={(e) => setCatalogSellingPrice(e.target.value)}
                placeholder="defaults to price"
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
              Images * (min 1, max 5) - {catalogExistingImages.length + catalogImages.length}/5 selected
            </label>

            {/* Existing images (edit mode) */}
            {catalogExistingImages.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {catalogExistingImages.map((url, index) => (
                  <div key={`existing-${index}`} className="relative group">
                    <img
                      src={url}
                      alt={`Image ${index + 1}`}
                      className="h-24 w-24 rounded-xl object-cover border-2 border-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCatalogExistingImage(index)}
                      aria-label={`Remove image ${index + 1}`}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New image previews */}
            {catalogImagePreviews.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {catalogImagePreviews.map((url, index) => (
                  <div key={`new-${index}`} className="relative group">
                    <img
                      src={url}
                      alt={`New image ${index + 1}`}
                      className="h-24 w-24 rounded-xl object-cover border-2 border-green-300"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCatalogNewImage(index)}
                      aria-label={`Remove new image ${index + 1}`}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            {(catalogExistingImages.length + catalogImages.length) < 5 && (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 px-4 py-6 text-sm text-muted hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Click to upload images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleCatalogImageSelect(e.target.files)}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            onClick={() => { isEdit ? setEditingCatalogItem(null) : setShowCreateCatalog(false); resetCatalogForm() }}
            className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
            type="button"
            disabled={isUploadingCatalog}
          >
            Cancel
          </button>
          <button
            onClick={isEdit ? handleEditCatalogItem : handleCreateCatalogItem}
            className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
            type="button"
            disabled={isUploadingCatalog}
          >
            {isUploadingCatalog ? 'Uploading...' : isEdit ? 'Save Changes' : 'Create Item'}
          </button>
        </div>
      </div>
    </div>
  )

  const renderCatalog = () => (
    <div className="fade-up space-y-6">
      {/* Header */}
      <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-purple-50/50 p-6 shadow-xl border border-purple-200/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl gradient-text">Product Catalog</h2>
            <p className="mt-1 text-sm text-muted">{catalogItems.length} items in catalog</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleLinkCatalogInventory}
              disabled={isLinkingCatalog}
              className="inline-flex items-center gap-2 rounded-full border-2 border-primary/20 px-5 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors disabled:opacity-50"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m8.656-2.828a4 4 0 00-5.656 0l-3 3a4 4 0 000 5.656" /></svg>
              {isLinkingCatalog ? 'Linking...' : 'Link Catalogue & Inventory'}
            </button>
            <button
              onClick={() => { resetCatalogForm(); setShowCreateCatalog(true) }}
              className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
              type="button"
            >
              + New Item
            </button>
          </div>
        </div>
        {catalogLinkMessage && (
          <div className="mt-3 rounded-xl bg-green-50 border border-green-200 p-3 text-xs font-medium text-green-700">
            {catalogLinkMessage}
          </div>
        )}
      </div>

      {catalogMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
          {catalogMessage}
        </div>
      )}

      {/* Search & Filters */}
      <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search by title or publisher..."
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
            />
          </div>
          <select
            value={catalogCategoryFilter}
            onChange={(e) => setCatalogCategoryFilter(e.target.value as 'All' | InventoryCategory)}
            className="rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
          >
            <option value="All">All Categories</option>
            {ALL_CATALOG_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalog Grid */}
      {filteredCatalogItems.length === 0 ? (
        <div className="panel-card rounded-3xl bg-white p-12 shadow-xl border border-primary/10 text-center flex flex-col items-center">
          <svg className="h-14 w-14 mb-4 text-primary/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h9a2 2 0 012 2v14l-6-3-6 3V5z" /></svg>
          <p className="text-lg font-semibold text-muted">No catalog items found</p>
          <p className="mt-2 text-sm text-muted">Click &quot;+ New Item&quot; to add your first product.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredCatalogItems.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col rounded-2xl bg-white shadow-[0_4px_24px_rgba(124,58,237,0.08)] border border-primary/5 overflow-hidden hover:shadow-[0_8px_40px_rgba(124,58,237,0.16)] hover:-translate-y-1 transition-all duration-500"
            >
              {/* Image Slider - book covers show fully (object-contain, no cropping) */}
              <div className="relative aspect-[3/4] bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 overflow-hidden">
                {item.images.length > 0 ? (
                  <>
                    <div className="relative h-full w-full">
                      {item.images.map((img, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={img}
                          alt={`${item.title} ${imgIdx + 1}`}
                          className={`absolute inset-0 h-full w-full object-contain p-2 transition-all duration-700 ease-out ${
                            imgIdx === (catalogSliderIndex[item.id] ?? 0)
                              ? 'opacity-100 scale-100'
                              : 'opacity-0 scale-110'
                          }`}
                        />
                      ))}
                    </div>
                    {item.images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const cur = catalogSliderIndex[item.id] ?? 0
                            setCatalogSliderIndex((prev) => ({ ...prev, [item.id]: cur === 0 ? item.images.length - 1 : cur - 1 }))
                          }}
                          aria-label="Previous image"
                          className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-primaryDark shadow-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const cur = catalogSliderIndex[item.id] ?? 0
                            setCatalogSliderIndex((prev) => ({ ...prev, [item.id]: cur === item.images.length - 1 ? 0 : cur + 1 }))
                          }}
                          aria-label="Next image"
                          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-primaryDark shadow-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                          {item.images.map((_, dotIdx) => (
                            <button
                              key={dotIdx}
                              type="button"
                              aria-label={`Go to image ${dotIdx + 1}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setCatalogSliderIndex((prev) => ({ ...prev, [item.id]: dotIdx }))
                              }}
                              className="flex items-center justify-center h-6 w-4 group/dot"
                            >
                              <span className={`block h-1.5 rounded-full transition-all duration-300 ${
                                dotIdx === (catalogSliderIndex[item.id] ?? 0)
                                  ? 'w-5 bg-white shadow-sm'
                                  : 'w-1.5 bg-white/50 group-hover/dot:bg-white/80'
                              }`} />
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <svg className="h-12 w-12 text-muted/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-xs text-muted/60 font-medium">No images</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col p-3.5">
                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-1 mb-2">
                  {(Array.isArray(item.category) ? item.category : [item.category]).map((cat) => (
                    <span key={cat} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${catalogCategoryBadgeClasses[cat] || catalogCategoryBadgeClasses.Others}`}>
                      {cat}
                    </span>
                  ))}
                  {(Array.isArray(item.ageCategory) ? item.ageCategory : [item.ageCategory]).map((age) => (
                    <span
                      key={age}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${catalogAgeBadgeClasses[age as AgeCategory]}`}
                      title={AGE_CATEGORIES[age as AgeCategory]?.range || age}
                    >
                      {ageShortLabel(age)}
                    </span>
                  ))}
                </div>

                <h3 className="font-display text-sm font-bold text-primaryDark leading-snug line-clamp-2 min-h-[2.5rem]">{item.title}</h3>
                <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2 min-h-[2rem]">{item.description}</p>

                <div className="mt-auto pt-3 space-y-2.5">
                  {/* Price and publisher row */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-extrabold gradient-text">${formatNumber(item.price)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200/60 px-2 py-0.5 min-w-0">
                      <svg className="h-3 w-3 shrink-0 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                      <span className="text-[11px] font-semibold text-purple-700 max-w-[80px] truncate">{item.publisher}</span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openEditCatalogItem(item)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                      type="button"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      Edit
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this item? This cannot be undone.')) handleDeleteCatalogItem(item.id) }}
                      className="flex items-center justify-center rounded-lg px-2 py-1.5 text-xs font-bold text-red-500 border border-red-200 transition-all duration-300 hover:bg-red-50 hover:-translate-y-0.5 active:scale-95"
                      type="button"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50">
        <div className="text-center">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-lg font-semibold text-primaryDark">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen text-ink bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div
        className="hero-svg-bg absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url(${bg1.src})`,
          backgroundSize: '75% auto',
          backgroundRepeat: 'repeat'
        }}
      />
      {[
        { src: design1, classes: 'left-6 top-12 h-16 w-16 opacity-20' },
        { src: design2, classes: 'right-10 top-10 h-20 w-20 opacity-15' },
        { src: design1, classes: 'left-1/4 top-64 h-14 w-14 opacity-10' },
        { src: design2, classes: 'right-1/3 top-56 h-16 w-16 opacity-15' },
        { src: design1, classes: 'left-16 bottom-20 h-20 w-20 opacity-10' },
        { src: design2, classes: 'right-20 bottom-16 h-16 w-16 opacity-15' },
        { src: design1, classes: 'left-1/2 top-24 h-24 w-24 opacity-10' },
        { src: design2, classes: 'right-1/2 bottom-24 h-14 w-14 opacity-10' },
        { src: design1, classes: 'left-10 bottom-1/3 h-12 w-12 opacity-15' },
        { src: design2, classes: 'right-10 bottom-1/2 h-14 w-14 opacity-10' }
      ].map((item, index) => (
        <Image
          key={`dash-design-${index}`}
          src={item.src}
          alt=""
          width={160}
          height={160}
          priority={index === 0}
          className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 ${item.classes}`}
        />
      ))}

      {/* Sticky Header with Horizontal Navigation */}
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgba(124,58,237,0.06)] animate-fadeIn">
        <div className="h-[3px] w-full bg-gradient-to-r from-primary via-secondary to-accentOne" aria-hidden="true" />
        <div className="mx-auto w-full max-w-7xl px-4">
          <div className="flex items-center justify-between py-4">
            {/* Logo */}
            <a className="flex items-center gap-3 group" href="/">
              <Image
                src={logo}
                alt="Eduvate Kids logo"
                width={32}
                height={32}
                className="group-hover:scale-110 transition-transform duration-300"
              />
              <div className="hidden sm:block">
                <span className="font-display text-xl font-bold gradient-text">Eduvate Kids</span>
                <p className="text-xs text-muted">Admin Dashboard</p>
              </div>
            </a>

            {/* Desktop Horizontal Tabs */}
            <nav className="hidden md:flex items-center gap-2">
              {[
                { id: 'home', label: 'Home' },
                { id: 'inventory', label: 'Inventory' },
                { id: 'events', label: 'Events' },
                { id: 'pos', label: 'POS' },
                { id: 'catalog', label: 'Catalog' },
                { id: 'orders', label: 'Orders' },
                { id: 'summer', label: 'Summer Reads' }
              ].filter(item => userRole === 'admin' || item.id === 'pos').map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as typeof activeView)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                    activeView === item.id
                      ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg scale-105'
                      : 'bg-primary/5 text-primaryDark hover:bg-primary/10 hover:scale-102'
                  }`}
                  type="button"
                  aria-current={activeView === item.id ? 'page' : undefined}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    {item.id === 'home' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />}
                    {item.id === 'inventory' && <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
                    {item.id === 'events' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />}
                    {item.id === 'pos' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />}
                    {item.id === 'catalog' && <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h9a2 2 0 012 2v14l-6-3-6 3V5z" />}
                    {item.id === 'orders' && <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />}
                    {item.id === 'summer' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />}
                  </svg>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Right Side - User Info & Actions */}
            <div className="flex items-center gap-3">
              {/* Mode Indicator */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-green-50 border border-primary/20">
                <span className={`h-2 w-2 rounded-full ${demoMode ? 'bg-amber-500' : 'bg-green-500'}`} />
                <span className="text-[11px] font-bold text-primaryDark">
                  {demoMode ? 'Demo' : 'Live'}
                </span>
              </div>

              {/* Settings Button - Admin Only */}
              {userRole === 'admin' && (
                <button
                  onClick={() => router.push('/settings')}
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/30 bg-white hover:bg-primary/5 hover:-translate-y-0.5 transition-all duration-300"
                  type="button"
                  aria-label="Settings"
                >
                  <svg className="h-5 w-5 text-primaryDark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}

              {/* Mobile Hamburger Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden flex h-11 w-11 items-center justify-center rounded-xl border-2 border-primary/30 text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-primary/10 py-4 animate-slideDown">
              <nav className="flex flex-col gap-2">
                {[
                  { id: 'home', label: 'Home' },
                  { id: 'inventory', label: 'Inventory' },
                  { id: 'events', label: 'Events' },
                  { id: 'pos', label: 'POS' },
                  { id: 'catalog', label: 'Catalog' },
                  { id: 'summer', label: 'Summer Reads' }
                ].filter(item => userRole === 'admin' || item.id === 'pos').map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveView(item.id as typeof activeView)
                      setMobileMenuOpen(false)
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                      activeView === item.id
                        ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                        : 'bg-primary/5 text-primaryDark hover:bg-primary/10'
                    }`}
                    type="button"
                    aria-current={activeView === item.id ? 'page' : undefined}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      {item.id === 'home' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />}
                      {item.id === 'inventory' && <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
                      {item.id === 'events' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />}
                      {item.id === 'pos' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />}
                      {item.id === 'catalog' && <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h9a2 2 0 012 2v14l-6-3-6 3V5z" />}
                    {item.id === 'orders' && <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />}
                    {item.id === 'summer' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />}
                    </svg>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              <div className="mt-4 pt-4 border-t border-primary/10 space-y-3">
                {userRole === 'admin' && (
                  <button
                    onClick={() => { router.push('/settings'); setMobileMenuOpen(false) }}
                    className="w-full mx-4 rounded-full border-2 border-primary/30 bg-white px-4 py-2.5 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-all duration-300 shadow-sm flex items-center justify-center gap-2"
                    style={{ width: 'calc(100% - 2rem)' }}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 w-full px-4 py-8 md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl">
          <section className="flex-1 space-y-8">
            <div className="fade-up">
              <h1 className="font-display text-3xl md:text-4xl gradient-text">
                {activeView === 'home'
                  ? 'Admin Home'
                  : activeView === 'inventory'
                  ? 'Inventory Management'
                  : activeView === 'catalog'
                  ? 'Catalog Management'
                  : activeView === 'pos'
                  ? 'Point of Sale'
                  : activeView === 'orders'
                  ? 'Online Orders'
                  : activeView === 'summer'
                  ? 'Summer Reads'
                  : 'Event Management'}
              </h1>
              <p className="mt-3 text-sm text-muted max-w-2xl">
                {activeView === 'home'
                  ? 'Monitor restock needs, best sellers, and event performance at a glance.'
                  : activeView === 'inventory'
                  ? 'Upload, update, and manage your complete inventory with ease.'
                  : activeView === 'catalog'
                  ? 'Create, manage, and showcase your product catalog with images and details.'
                  : activeView === 'pos'
                  ? 'Record sales for events or general transactions. Search products, manage cart, and process payments.'
                  : activeView === 'orders'
                  ? 'Online store orders paid via Stripe. Review details and mark items as shipped.'
                  : activeView === 'summer'
                  ? 'Registrations and reading progress for the Summer Reads program.'
                  : 'Create events, manage dates and fees, and review event performance summaries.'}
              </p>
            </div>

            {activeView === 'home' && renderHome()}
            {activeView === 'inventory' && renderInventory()}
            {activeView === 'events' && renderEvents()}
            {activeView === 'catalog' && renderCatalog()}
            {activeView === 'pos' && renderPOS()}
            {activeView === 'orders' && renderOrders()}
            {activeView === 'summer' && renderSummer()}
          </section>
        </div>
      </main>

      {/* Global Modals - rendered outside page views */}
      {showCreateCatalog && renderCatalogFormModal(false)}
      {editingCatalogItem && renderCatalogFormModal(true)}

      {/* Inventory barcode / QR scanner */}
      <BarcodeScanner
        open={inventoryScannerOpen}
        onClose={() => setInventoryScannerOpen(false)}
        onDetected={handleInventoryScan}
        title="Scan to add / find stock"
        hint="Scan a book barcode or QR code to find it in inventory or add it as new."
      />

      {/* Bind-mode scanner: attach a scanned/typed code to a specific inventory item */}
      <BarcodeScanner
        open={bindTargetItem !== null}
        onClose={() => setBindTargetItem(null)}
        onDetected={(value) => { if (bindTargetItem) handleBindCode(bindTargetItem, value) }}
        title={bindTargetItem ? `Bind a code to "${bindTargetItem.title}"` : 'Bind a code'}
        hint="Scan or type a barcode/QR. A 13-digit value is saved as ISBN, anything else as SKU."
      />

      {/* QR label modal: generate + print a QR for an item's SKU (or id) */}
      {qrModalItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn print:static print:bg-white print:p-0" onClick={() => { setQrModalItem(null); setQrDataUrl('') }}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border-2 border-primary/20 print:border-0 print:shadow-none" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4 print:hidden">
              <div>
                <h4 className="font-display text-xl gradient-text">QR Label</h4>
                <p className="mt-1 text-xs text-muted">Print or screenshot to attach to the book.</p>
              </div>
              <button
                onClick={() => { setQrModalItem(null); setQrDataUrl('') }}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary/20 text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex flex-col items-center text-center">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt={`QR code for ${qrModalItem.title}`} className="h-56 w-56 rounded-xl border border-black/5" />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-dashed border-primary/30 text-sm text-muted">Generating…</div>
              )}
              <p className="mt-4 font-display text-base font-bold text-primaryDark">{qrModalItem.title}</p>
              <p className="mt-1 font-mono text-xs text-muted">{qrModalItem.sku || qrModalItem.id}</p>
            </div>
            <button
              onClick={() => window.print()}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 print:hidden"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-12 0v4h12v-4m-12 0h12" /></svg>
              Print QR
            </button>
          </div>
        </div>
      )}

      {/* Inventory Edit/Add Modal */}
      {(editingInventoryItem || showAddInventoryItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">
                  {editingInventoryItem ? 'Edit Inventory Item' : 'Add New Item'}
                </h4>
                <p className="mt-2 text-sm text-muted">
                  {editingInventoryItem ? 'Update the details below' : 'Fill in the details to add a new inventory item'}
                </p>
              </div>
              <button
                onClick={() => { setEditingInventoryItem(null); setShowAddInventoryItem(false); }}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/20 text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Title *</label>
                <input
                  type="text"
                  value={invEditTitle}
                  onChange={(e) => setInvEditTitle(e.target.value)}
                  placeholder="e.g., ABC of Allah Loves Me"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Category *</label>
                <select
                  value={invEditCategory}
                  onChange={(e) => setInvEditCategory(e.target.value as InventoryCategory)}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                >
                  {['Books', 'Activity Books', 'Cards', 'Crafts', 'Puzzles', 'Games', 'Gifts', 'Others'].map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Publisher</label>
                <input
                  type="text"
                  value={invEditPublisher}
                  onChange={(e) => setInvEditPublisher(e.target.value)}
                  placeholder="e.g., Learning Roots"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">SKU</label>
                <input
                  type="text"
                  value={invEditSku}
                  onChange={(e) => setInvEditSku(e.target.value)}
                  placeholder="e.g., LR-ABC-001"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">ISBN / Barcode</label>
                <input
                  type="text"
                  value={invEditIsbn}
                  onChange={(e) => setInvEditIsbn(e.target.value)}
                  placeholder="e.g., 9781234567890"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">RRP ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={invEditRrp}
                  onChange={(e) => setInvEditRrp(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Discount %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={invEditDiscount}
                  onChange={(e) => setInvEditDiscount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Quantity *</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={invEditQuantity}
                  onChange={(e) => setInvEditQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">Selling Price ($) *</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={invEditSellingPrice}
                  onChange={(e) => setInvEditSellingPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => { setEditingInventoryItem(null); setShowAddInventoryItem(false); }}
                className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInventoryItem}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                type="button"
                disabled={!invEditTitle.trim() || !invEditQuantity || isSavingInventory}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {isSavingInventory ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                      Saving...
                    </>
                  ) : editingInventoryItem ? (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Save Changes
                    </>
                  ) : '+ Add Item'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Confirm Sale Modal */}
      {showConfirmSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border-2 border-primary/20 animate-fadeIn my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">Confirm Sale</h4>
                <p className="mt-2 text-sm text-muted">
                  {selectedEventId === 'general'
                    ? 'General Sales (no event)'
                    : events.find((event) => event.id === selectedEventId)?.name ??
                      'Selected event'}
                </p>
              </div>
              <button
                onClick={() => setShowConfirmSale(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/20 text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-1">
              {cartItems.map((item) => (
                <div key={item.itemId} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-muted mt-1">
                      {item.quantity} x ${formatNumber(item.price)}
                    </p>
                  </div>
                  <span className="text-lg font-bold gradient-text">
                    ${formatNumber(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-primary/5 border border-primary/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold">${formatNumber(cartTotal)}</span>
              </div>
              {paymentType === 'Card' && (
                <div className="flex items-center justify-between text-sm text-amber-600">
                  <span>Convenience fee (3%)</span>
                  <span className="font-semibold">${formatNumber(convenienceFee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xl font-bold pt-2 border-t border-primary/10">
                <span className="gradient-text">Total</span>
                <span className="gradient-text">${formatNumber(totalWithFee)}</span>
              </div>
              {paymentType === 'Card' && (
                <p className="text-[11px] text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                  💳 Card payments include a 3% convenience fee.
                </p>
              )}
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmSale(false)}
                className="rounded-full border-2 border-primary/20 px-6 py-3 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRecordSale()}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                type="button"
                disabled={isSubmittingSale}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {isSubmittingSale ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Confirm Sale
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .panel-card {
          transition: transform 0.35s ease, box-shadow 0.35s ease;
        }

        .panel-card:hover {
          transform: translateY(-4px);
        }

        .fade-up {
          animation: fade-up 0.6s ease both;
        }

        @keyframes fade-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fade-in 0.3s ease both;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: scale-in 0.3s ease both;
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Custom Scrollbar Styles */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #7c3aed, #ec4899);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #6d28d9, #db2777);
        }

        .gradient-text {
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* Online order detail modal */}
      {expandedOrder && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-fadeIn" onClick={() => setExpandedOrder(null)}>
          <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-primaryDark">Order Details</h3>
                <p className="font-mono text-xs text-muted">{expandedOrder.id}</p>
              </div>
              <button type="button" onClick={() => setExpandedOrder(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-gray-100 hover:text-ink">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <span className={orderStatusBadge(expandedOrder.status)}>{expandedOrder.status}</span>
                <span className="text-xs text-muted">Paid {fmtDate(expandedOrder.paidAt)}</span>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Items</p>
                <ul className="mt-2 space-y-2">
                  {expandedOrder.items?.map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-ink">{it.title} <span className="text-muted">× {it.quantity}</span></span>
                      <span className="font-semibold text-primaryDark">${it.lineTotal?.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-black/5 pt-3 text-sm">
                  <div className="flex justify-between text-muted"><span>Subtotal</span><span>${expandedOrder.subtotal?.toFixed(2)}</span></div>
                  <div className="flex justify-between text-muted"><span>Shipping</span><span>${expandedOrder.shippingFee?.toFixed(2)}</span></div>
                  <div className="flex justify-between text-muted"><span>Tax</span><span>${(expandedOrder.tax ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between pt-1 text-base font-bold text-primaryDark"><span>Total</span><span>${expandedOrder.total?.toFixed(2)}</span></div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Customer</p>
                  <p className="mt-1 text-sm font-medium text-ink">{expandedOrder.customer?.name}</p>
                  <p className="text-sm text-muted">{expandedOrder.customer?.email}</p>
                  {expandedOrder.customer?.phone && <p className="text-sm text-muted">{expandedOrder.customer.phone}</p>}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Ship To</p>
                  <p className="mt-1 text-sm text-ink">{expandedOrder.shippingAddress?.line1}</p>
                  {expandedOrder.shippingAddress?.line2 && <p className="text-sm text-ink">{expandedOrder.shippingAddress.line2}</p>}
                  <p className="text-sm text-muted">{expandedOrder.shippingAddress?.city}, {expandedOrder.shippingAddress?.state} {expandedOrder.shippingAddress?.postalCode}</p>
                  <p className="text-sm text-muted">{expandedOrder.shippingAddress?.country}</p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-3 text-xs text-muted">
                <span className="font-semibold">Payment:</span> {expandedOrder.paymentProvider} · <span className="font-mono">{expandedOrder.paymentRef}</span>
              </div>

              {expandedOrder.status === 'paid' && (
                <button
                  type="button"
                  onClick={() => markOrderShipped(expandedOrder)}
                  className="btn-shine flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 100-4h14a2 2 0 100 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>
                  Mark as Shipped
                </button>
              )}
              {expandedOrder.status === 'shipped' && (
                <div className="flex items-center justify-center gap-2 rounded-full bg-blue-50 px-6 py-3 text-sm font-semibold text-blue-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Shipped {fmtDate(expandedOrder.shippedAt)}
                </div>
              )}

              {/* Admin controls: change status + delete */}
              <div className="flex flex-col gap-3 border-t border-black/5 pt-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">Update Status</label>
                <select
                  value={expandedOrder.status}
                  onChange={(e) => updateOnlineOrderStatus(expandedOrder, e.target.value as OnlineOrder['status'])}
                  className="w-full rounded-xl border-2 border-primary/20 px-4 py-2.5 text-sm font-medium hover:border-primary/40 focus:border-primary focus:outline-none transition-colors"
                >
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  type="button"
                  onClick={() => deleteOnlineOrder(expandedOrder)}
                  className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-red-200 bg-white px-6 py-3 text-sm font-semibold text-red-700 transition-all hover:bg-red-50 hover:-translate-y-0.5"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {expandedReader && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-fadeIn" onClick={() => setExpandedReader(null)}>
          <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-primaryDark">{expandedReader.childName}</h3>
                <p className="font-mono text-xs text-muted">{expandedReader.code}</p>
              </div>
              <button type="button" onClick={() => setExpandedReader(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-gray-100 hover:text-ink">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <span className={summerTierBadge(expandedReader.tier)}>{expandedReader.tier || 'none'}</span>
                <span className="text-xs text-muted">{expandedReader.booksCount ?? 0} book{(expandedReader.booksCount ?? 0) === 1 ? '' : 's'} logged</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Child</p>
                  <p className="mt-1 text-sm font-medium text-ink">{expandedReader.childName}</p>
                  {expandedReader.childAge != null && <p className="text-sm text-muted">Age {expandedReader.childAge}</p>}
                  {expandedReader.dateOfBirth && <p className="text-sm text-muted">DOB {expandedReader.dateOfBirth}</p>}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Parent</p>
                  <p className="mt-1 text-sm font-medium text-ink">{expandedReader.parentName}</p>
                  <p className="text-sm text-muted">{expandedReader.parentEmail}</p>
                  {expandedReader.parentPhone && <p className="text-sm text-muted">{expandedReader.parentPhone}</p>}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Books Logged</p>
                {expandedReader.booksLogged && expandedReader.booksLogged.length > 0 ? (
                  <ul className="mt-2 space-y-3">
                    {expandedReader.booksLogged.map((b, idx) => (
                      <li key={idx} className="rounded-xl border border-black/5 bg-gray-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-ink">{b.title}</p>
                            {b.author && <p className="text-xs text-muted">by {b.author}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {b.rating != null && (
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <svg key={n} className={`h-3.5 w-3.5 ${n <= (b.rating ?? 0) ? 'text-amber-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.366 2.446c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.098 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>
                                ))}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteReaderBook(expandedReader, idx)}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                              aria-label={`Delete logged book ${b.title}`}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                        {b.dateFinished && <p className="mt-1 text-xs text-muted">Finished {b.dateFinished}</p>}
                        {b.review && <p className="mt-2 text-sm text-ink">{b.review}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">No books logged yet.</p>
                )}
              </div>

              <div className="border-t border-black/5 pt-4">
                <button
                  type="button"
                  onClick={() => deleteReaderRegistration(expandedReader)}
                  className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-red-200 bg-white px-6 py-3 text-sm font-semibold text-red-700 transition-all hover:bg-red-50 hover:-translate-y-0.5"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete registration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
