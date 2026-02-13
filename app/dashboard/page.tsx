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
  getDoc
} from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { auth, db } from '../../lib/firebase'
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

type EventStatus = 'active' | 'closed'

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
}

type AgeCategory = '0-5' | '6-9' | '10+' | 'Adult'

const AGE_CATEGORIES: Record<AgeCategory, { range: string; title: string }> = {
  '0-5': { range: '0-5 years', title: 'Little Imaan Explorers' },
  '6-9': { range: '6-9 years', title: 'Deen Explorers' },
  '10+': { range: '10+ years', title: 'Young Scholars' },
  'Adult': { range: 'Adult', title: 'Wisdom Seekers' }
}

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
}

const defaultInventory: InventoryItem[] = [
  {
    id: 'inv-1',
    title: 'My First Quran Stories',
    category: 'Books',
    publisher: 'Noor Press',
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
    orders: []
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
    orders: []
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
    timestamp: String(data.timestamp ?? new Date().toISOString())
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
  const [activeView, setActiveView] = useState<'home' | 'inventory' | 'events' | 'pos' | 'catalog'>(
    'home'
  )
  const [inventory, setInventory] = useState<InventoryItem[]>(() => demoMode ? defaultInventory : [])
  const [events, setEvents] = useState<EventRecord[]>(() => demoMode ? defaultEvents : [])
  const [generalSales, setGeneralSales] = useState<Sale[]>([])
  const [uploadMessage, setUploadMessage] = useState<string>('')
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
  const [catalogImages, setCatalogImages] = useState<File[]>([])
  const [catalogImagePreviews, setCatalogImagePreviews] = useState<string[]>([])
  const [catalogExistingImages, setCatalogExistingImages] = useState<string[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<'All' | InventoryCategory>('All')
  const [isUploadingCatalog, setIsUploadingCatalog] = useState(false)
  const [catalogMessage, setCatalogMessage] = useState('')
  const [catalogSliderIndex, setCatalogSliderIndex] = useState<Record<string, number>>({})

  useEffect(() => {
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
                  orders: Array.isArray(data.orders) ? data.orders as Order[] : []
                }
              })
            setEvents(loadedEvents)

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

    return events.filter((event) => matchesType(event) && matchesDate(event))
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

  const summaryCards = useMemo(() => {
    const totalSales = allSales.reduce((sum, sale) => sum + sale.total, 0)
    const transactionCount = allSales.length

    return [
      {
        label: 'Total Sales',
        value: totalSales,
        note: `${transactionCount} transactions`,
        prefix: '$',
        icon: '💰'
      },
      {
        label: 'Low Stock Items',
        value: restockItems.length,
        note: `Restock threshold: ${restockThreshold}`,
        icon: '📦'
      },
      {
        label: 'Active Events',
        value: events.filter((event) => event.status === 'active').length,
        note: `${events.length} total events`,
        icon: '🎪'
      },
      {
        label: 'Catalog Size',
        value: inventory.length,
        note: 'Books & kits',
        icon: '📚'
      }
    ]
  }, [allSales, events, inventory.length, restockItems.length])

  const formatNumber = (value: number) => value.toLocaleString('en-US')

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
      orders: []
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

  // Catalog handlers
  const resetCatalogForm = () => {
    setCatalogTitle('')
    setCatalogDescription('')
    setCatalogCategories(['Books'])
    setCatalogAge(['0-5'])
    setCatalogPrice('')
    setCatalogPublisher('')
    setCatalogImages([])
    setCatalogImagePreviews([])
    setCatalogExistingImages([])
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
      const imageUrls = await convertFilesToBase64(catalogImages)
      const newItem: CatalogItem = {
        id: itemId,
        title: catalogTitle.trim(),
        description: catalogDescription.trim(),
        category: catalogCategories,
        ageCategory: catalogAge,
        price: parseNumber(catalogPrice),
        publisher: catalogPublisher.trim(),
        images: imageUrls,
        createdAt: new Date().toISOString()
      }

      setCatalogItems((prev) => [newItem, ...prev])
      resetCatalogForm()
      setShowCreateCatalog(false)

      await setDoc(doc(db, 'catalog', itemId), newItem)
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
      let newImageBase64: string[] = []
      if (catalogImages.length > 0) {
        newImageBase64 = await convertFilesToBase64(catalogImages)
      }

      const allImages = [...catalogExistingImages, ...newImageBase64]
      const updatedFields = {
        title: catalogTitle.trim(),
        description: catalogDescription.trim(),
        category: catalogCategories,
        ageCategory: catalogAge,
        price: parseNumber(catalogPrice),
        publisher: catalogPublisher.trim(),
        images: allImages
      }

      setCatalogItems((prev) =>
        prev.map((item) =>
          item.id === editingCatalogItem.id ? { ...item, ...updatedFields } : item
        )
      )
      setEditingCatalogItem(null)
      resetCatalogForm()

      await updateDoc(doc(db, 'catalog', editingCatalogItem.id), updatedFields)
    } catch (error) {
      console.error('Edit catalog item error:', error)
      setCatalogMessage('Failed to update catalog item. Please try again.')
    } finally {
      setIsUploadingCatalog(false)
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
    setEventMessage(`Sale recorded (${salesToAdd.length} items).`)

    try {
      const batch = writeBatch(db)
      if (eventRecord) {
        batch.update(doc(db, 'events', eventRecord.id), { sales: updatedSales, orders: updatedOrders, _live: true })
      } else {
        salesToAdd.forEach((sale) => {
          batch.set(doc(db, 'generalSales', sale.id), { ...sale, _live: true })
        })
        batch.set(doc(db, 'generalOrders', orderRecord.id), { ...orderRecord, _live: true })
      }
      nextInventory.forEach((item) => {
        batch.update(doc(db, 'inventory', item.id), { quantity: item.quantity, _live: true })
      })
      await batch.commit()
    } catch (error) {
      console.error('Record sale error:', error)
      setEventMessage('Sale saved locally, but failed to sync.')
    } finally {
      setIsSubmittingSale(false)
    }
  }

  const handleDeleteOrder = async (order: Order) => {
    if (!confirm(`Delete this order from ${new Date(order.timestamp).toLocaleString()}? This will restore inventory quantities. Continue?`)) return

    // Restore inventory quantities from the deleted order
    const restoredInventory = inventory.map((item) => {
      const orderItem = order.items.find((oi) => oi.itemId === item.id)
      if (!orderItem) return item
      return { ...item, quantity: item.quantity + orderItem.quantity }
    })
    setInventory(restoredInventory)

    const isGeneralOrder = order.eventId === 'general'
    if (isGeneralOrder) {
      setGeneralOrders((current) => current.filter((o) => o.id !== order.id))
      try {
        const batch = writeBatch(db)
        batch.delete(doc(db, 'generalOrders', order.id))
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
      setEvents((current) =>
        current.map((e) =>
          e.id === eventRecord.id ? { ...e, orders: updatedOrders } : e
        )
      )
      if (viewingOrderHistory) {
        setViewingOrderHistory({ ...viewingOrderHistory, orders: updatedOrders })
      }
      try {
        const batch = writeBatch(db)
        batch.update(doc(db, 'events', eventRecord.id), { orders: updatedOrders, _live: true })
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
      setGeneralOrders((current) => current.map((o) => o.id === updatedOrder.id ? updatedOrder : o))
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
        <div className="relative z-10 mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
                  <span className="text-2xl">{card.icon}</span>
                </div>
                <h2 className="mt-4 font-display text-4xl gradient-text">
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
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl gradient-text">Weekly Sales Trend</h3>
            <span className="text-xs font-semibold text-muted bg-primary/10 px-3 py-1 rounded-full">Last 7 days</span>
          </div>
          {salesTrend.labels.length ? (
            <div className="mt-4 space-y-3 text-sm text-muted">
              {salesTrend.labels.map((label, index) => (
                <div key={label} className="flex items-center justify-between rounded-xl bg-white/80 px-4 py-3 shadow-soft border border-primary/5">
                  <span className="font-medium">{label}</span>
                  <span className="text-base font-semibold text-primaryDark">
                    ${formatNumber(salesTrend.values[index] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted text-center py-8">
              No sales data yet. Record a sale to see trends.
            </p>
          )}
        </div>

        <div className="grid gap-6">
          <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-secondary/5 p-6 shadow-xl border border-secondary/10" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl gradient-text">Category Mix</h3>
              <span className="text-xs font-semibold text-muted bg-secondary/10 px-3 py-1 rounded-full">Current inventory</span>
            </div>
            {categoryMix.labels.length ? (
              <div className="mt-4 space-y-3 text-sm text-muted">
                {categoryMix.labels.map((label, index) => (
                  <div key={label} className="flex items-center justify-between rounded-xl bg-white/80 px-4 py-3 shadow-soft border border-secondary/5">
                    <span className="font-medium">{label}</span>
                    <span className="text-base font-semibold text-primaryDark">
                      {formatNumber(categoryMix.values[index] ?? 0)} items
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted text-center py-8">
                No inventory data yet.
              </p>
            )}
          </div>

          <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-primary/5 p-6 shadow-xl border border-primary/10" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl gradient-text">Best Sellers</h3>
              <span className="text-xs font-semibold text-muted bg-primary/10 px-3 py-1 rounded-full">Across all events</span>
            </div>
            {bestSellers.length ? (
              <ul className="mt-4 space-y-3 text-sm">
                {bestSellers.map((item, index) => (
                  <li key={item.title} className="flex items-center justify-between group hover:bg-primary/5 p-3 rounded-xl transition-colors" style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 text-xs font-bold text-primaryDark">{index + 1}</span>
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <span className="rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-2 text-sm font-semibold text-primaryDark border border-primary/10">
                      {item.quantity} sold
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted text-center py-8">
                No sales yet. Record a sale to see top items.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-accentThree/5 p-6 shadow-xl border border-accentThree/10" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accentThree/20 to-primary/20 text-2xl">🏆</span>
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
                    <span className="text-primary">📅</span>
                    <span>{bestEvent.startDate || 'TBD'} - {bestEvent.endDate || 'TBD'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary">📍</span>
                    <span>{bestEvent.location || 'Location TBD'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary">🎪</span>
                    <span>{bestEvent.type}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-black/10">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${bestEvent.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      {bestEvent.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                    <span>Vendor fee: ${formatNumber(bestEvent.cost)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-8">No events created yet.</p>
          )}
        </div>

        <div className="fade-up panel-card rounded-3xl bg-gradient-to-br from-white to-amber-50/50 p-6 shadow-xl border border-amber-200/50" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-2xl">📦</span>
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
            <div className="text-center py-8">
              <div className="text-5xl mb-3">✅</div>
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

  const SortIcon = ({ col }: { col: keyof InventoryItem }) => (
    <span className="inline-block ml-1 align-middle">
      {inventorySortKey === col ? (
        inventorySortDir === 'asc' ? '▲' : '▼'
      ) : (
        <span className="opacity-30">⇅</span>
      )}
    </span>
  )

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

  const renderInventory = () => (
    <div className="fade-up space-y-6">
      <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-purple-50/50 p-8 shadow-xl border border-purple-200/50">
        <div className="flex items-center gap-4 mb-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 text-3xl shadow-soft">
            📦
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
          {userRole === 'admin' && inventory.length > 0 && (
            <button
              onClick={handleClearInventory}
              className="rounded-full border-2 border-red-300 bg-white px-6 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 hover:-translate-y-0.5 transition-all shadow-sm"
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                🗑 Clear Inventory
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

      <div className="panel-card overflow-hidden rounded-3xl bg-white shadow-xl border border-primary/10">
        <div className="bg-gradient-to-r from-primary/5 to-secondary/5 px-6 py-5 border-b border-primary/10">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-2xl gradient-text">Current Stock</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Total items:</span>
              <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-primaryDark shadow-sm border border-primary/10">{inventory.length}</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-primary/10 to-secondary/10 text-left">
              <tr>
                {([['title', 'Title'], ['category', 'Category'], ['publisher', 'Publisher'], ['rrp', 'RRP'], ['discount', 'Discount %'], ['quantity', 'Quantity'], ['sellingPrice', 'Selling Price']] as [keyof InventoryItem, string][]).map(([key, label]) => (
                  <th key={key} className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleInventorySort(key)}
                      className="text-xs font-bold uppercase tracking-wider text-primaryDark hover:text-primary transition-colors cursor-pointer select-none"
                    >
                      {label}<SortIcon col={key} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {sortedInventory.map((item, index) => (
                <tr key={item.id} className={`hover:bg-primary/5 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-6 py-4 font-medium">{item.title}</td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primaryDark border border-primary/20">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted">{item.publisher}</td>
                  <td className="px-6 py-4 font-semibold">${formatNumber(item.rrp)}</td>
                  <td className="px-6 py-4">
                    {item.discount > 0 ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 border border-green-200">
                        {item.discount}%
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4 font-bold text-primaryDark">${formatNumber(item.sellingPrice)}</td>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100">
              <span className="text-2xl">🎯</span>
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
        </div>

        {/* Search & Catalog Card */}
        <div className="panel-card rounded-3xl bg-white p-6 shadow-xl border border-primary/10">
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="🔍 Search products by title, publisher, or category..."
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
              <div className="text-center py-16">
                <div className="text-6xl mb-4">
                  {searchQuery ? '🔍' : '📦'}
                </div>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-pink-100">
                <span className="text-xl">🛒</span>
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
              <div className="text-center py-12">
                <div className="text-5xl mb-3">🛒</div>
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
                    💵 Cash
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
                    💳 Card
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
                    🏦 Transfer
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
                  <span className="mr-2">💰</span> Complete Sale
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
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-3xl shadow-soft">
              🎪
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
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-xl">
                📅
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
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-bold text-lg text-primaryDark mb-1">{event.name}</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-bold ${eventTypeBadgeClasses[event.type]}`}
                        >
                          {event.type}
                        </span>
                        <button
                          onClick={() => handleToggleEventStatus(event.id)}
                          className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                            event.status === 'active'
                              ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200 hover:scale-105 cursor-pointer'
                              : 'bg-gray-100 text-gray-500 border border-gray-200 cursor-not-allowed opacity-70'
                          }`}
                          type="button"
                          title={event.status === 'closed' ? 'Edit event to reactivate' : 'Click to close event'}
                        >
                          {event.status === 'active' ? '● Active' : '🔒 Closed'}
                        </button>
                        <button
                          onClick={() => openEditEvent(event)}
                          className="rounded-full px-3 py-1 text-xs font-bold bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 transition-all hover:scale-105"
                          type="button"
                        >
                          ✎ Edit
                        </button>
                        <button
                          onClick={() => setViewingEventTransactions(event)}
                          className="rounded-full px-3 py-1 text-xs font-bold bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border border-purple-200 transition-all hover:scale-105"
                          type="button"
                        >
                          📊 View Transactions
                        </button>
                        <button
                          onClick={() => setViewingOrderHistory(event)}
                          className="rounded-full px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200 transition-all hover:scale-105"
                          type="button"
                        >
                          📋 Order History
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold gradient-text">${formatNumber(totalSales)}</p>
                      <p className="text-xs text-muted">{event.sales.length} transactions</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted bg-white/50 rounded-xl p-3 border border-primary/5">
                    <div className="flex items-center gap-2">
                      <span className="text-primary">📍</span>
                      <span>{event.location || 'Location TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-primary">📅</span>
                      <span>{event.startDate || 'TBD'} - {event.endDate || 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-primary">💵</span>
                      <span>Vendor fee: ${formatNumber(event.cost)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showCreateEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl border-2 border-primary/20 animate-scale-in">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">Create New Event</h4>
                <p className="mt-2 text-sm text-muted">
                  Add dates, vendor fee, and keep the event active.
                </p>
              </div>
              <button
                onClick={() => setShowCreateEvent(false)}
                className="rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                ✕ Close
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl border-2 border-primary/20 animate-scale-in">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">Edit Event</h4>
                <p className="mt-2 text-sm text-muted">
                  Update event details. Changes sync to Firebase.
                </p>
              </div>
              <button
                onClick={() => setEditingEvent(null)}
                className="rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                ✕ Close
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in overflow-y-auto">
          <div className="w-full max-w-5xl rounded-3xl bg-white p-8 shadow-2xl border-2 border-primary/20 animate-scale-in my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">{viewingEventTransactions.name} - Sales Record</h4>
                <p className="mt-2 text-sm text-muted">
                  {viewingEventTransactions.sales.length} total sales · ${formatNumber(viewingEventTransactions.sales.reduce((sum, sale) => sum + sale.total, 0))} total revenue
                </p>
              </div>
              <button
                onClick={() => setViewingEventTransactions(null)}
                className="rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                ✕ Close
              </button>
            </div>

            {viewingEventTransactions.sales.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl">
                <div className="text-6xl mb-4">📊</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in overflow-y-auto">
          <div className="w-full max-w-5xl rounded-3xl bg-white p-8 shadow-2xl border-2 border-amber-200/50 animate-scale-in my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">{viewingOrderHistory.name} - Order History</h4>
                <p className="mt-2 text-sm text-muted">
                  {viewingOrderHistory.orders.length} order{viewingOrderHistory.orders.length !== 1 ? 's' : ''} · ${formatNumber(viewingOrderHistory.orders.reduce((sum, o) => sum + o.total, 0))} total
                </p>
              </div>
              <button
                onClick={() => setViewingOrderHistory(null)}
                className="rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                ✕ Close
              </button>
            </div>

            {viewingOrderHistory.orders.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl">
                <div className="text-6xl mb-4">📋</div>
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
                        <p className="text-xs text-muted">
                          🕐 {new Date(order.timestamp).toLocaleString()}
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
                              className="rounded-full px-3 py-1 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:scale-105 transition-all"
                              type="button"
                            >
                              ✎ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order)}
                              className="rounded-full px-3 py-1 text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:scale-105 transition-all"
                              type="button"
                            >
                              🗑 Delete
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl border-2 border-blue-200/50 animate-scale-in my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="font-display text-2xl gradient-text">Edit Order</h4>
                <p className="mt-2 text-sm text-muted">
                  {new Date(editingOrder.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => { setEditingOrder(null); setEditOrderItems([]); }}
                className="rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                ✕
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
                    className="w-7 h-7 rounded-full bg-red-50 border border-red-200 text-red-600 text-sm hover:bg-red-100 transition-colors"
                    type="button"
                  >
                    ✕
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
                ✓ Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-indigo-50/50 p-6 shadow-xl border border-indigo-200/50">
        <div className="flex items-center gap-3 mb-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 text-2xl shadow-soft">
            📊
          </span>
          <h3 className="font-display text-2xl gradient-text">Event Summaries</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
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
                    {event.status === 'active' ? '● Active' : '○ Closed'}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-muted">
                    <span className="text-primary">🎪</span>
                    <span>{event.type} · {event.location || 'Location TBD'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <span className="text-primary">📅</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl border-2 border-primary/20 animate-scale-in">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h4 className="font-display text-2xl gradient-text">{isEdit ? 'Edit Catalog Item' : 'New Catalog Item'}</h4>
            <p className="mt-2 text-sm text-muted">
              {isEdit ? 'Update item details and images.' : 'Add a new item to your catalog.'}
            </p>
          </div>
          <button
            onClick={() => { isEdit ? setEditingCatalogItem(null) : setShowCreateCatalog(false); resetCatalogForm() }}
            className="rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
            type="button"
          >
            ✕ Close
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
                    {AGE_CATEGORIES[age].title}
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

          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2 block">
              Images * (min 1, max 5) — {catalogExistingImages.length + catalogImages.length}/5 selected
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
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
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
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
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
          <button
            onClick={() => { resetCatalogForm(); setShowCreateCatalog(true) }}
            className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            type="button"
          >
            + New Item
          </button>
        </div>
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
        <div className="panel-card rounded-3xl bg-white p-12 shadow-xl border border-primary/10 text-center">
          <p className="text-lg font-semibold text-muted">No catalog items found</p>
          <p className="mt-2 text-sm text-muted">Click &quot;+ New Item&quot; to add your first product.</p>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCatalogItems.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col rounded-[2rem] bg-white shadow-[0_4px_32px_rgba(124,58,237,0.08)] border border-primary/5 overflow-hidden hover:shadow-[0_8px_48px_rgba(124,58,237,0.16)] hover:-translate-y-1.5 transition-all duration-500"
            >
              {/* Image Slider — clean, no overlays */}
              <div className="relative aspect-[4/3] bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 overflow-hidden">
                {item.images.length > 0 ? (
                  <>
                    <div className="relative h-full w-full">
                      {item.images.map((img, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={img}
                          alt={`${item.title} ${imgIdx + 1}`}
                          className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out ${
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
                          className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-primaryDark shadow-md opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
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
                          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-primaryDark shadow-md opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {item.images.map((_, dotIdx) => (
                            <button
                              key={dotIdx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setCatalogSliderIndex((prev) => ({ ...prev, [item.id]: dotIdx }))
                              }}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                dotIdx === (catalogSliderIndex[item.id] ?? 0)
                                  ? 'w-5 bg-white shadow-sm'
                                  : 'w-1.5 bg-white/50 hover:bg-white/80'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <span className="text-5xl opacity-30">📷</span>
                    <span className="text-xs text-muted/60 font-medium">No images</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col p-5">
                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {(Array.isArray(item.category) ? item.category : [item.category]).map((cat) => (
                    <span key={cat} className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${catalogCategoryBadgeClasses[cat] || catalogCategoryBadgeClasses.Others}`}>
                      {cat}
                    </span>
                  ))}
                  {(Array.isArray(item.ageCategory) ? item.ageCategory : [item.ageCategory]).map((age) => (
                    <span 
                      key={age}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${catalogAgeBadgeClasses[age]}`}
                      title={AGE_CATEGORIES[age]?.range || age}
                    >
                      {AGE_CATEGORIES[age]?.title || age}
                    </span>
                  ))}
                </div>

                <h3 className="font-display text-base font-bold text-primaryDark leading-snug line-clamp-2">{item.title}</h3>
                <p className="mt-1.5 text-[13px] text-muted leading-relaxed line-clamp-2">{item.description}</p>

                <div className="mt-auto pt-4 space-y-3">
                  {/* Price and publisher row */}
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-extrabold gradient-text">${formatNumber(item.price)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200/60 px-2.5 py-0.5">
                      <svg className="h-3 w-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                      <span className="text-[11px] font-semibold text-purple-700 max-w-[100px] truncate">{item.publisher}</span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditCatalogItem(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                      type="button"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      Edit
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this item? This cannot be undone.')) handleDeleteCatalogItem(item.id) }}
                      className="flex items-center justify-center rounded-xl px-3 py-2 text-xs font-bold text-red-500 border border-red-200 transition-all duration-300 hover:bg-red-50 hover:-translate-y-0.5 active:scale-95"
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
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/95 backdrop-blur-xl shadow-sm animate-fadeIn">
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
                { id: 'home', label: 'Home', emoji: '🏠' },
                { id: 'inventory', label: 'Inventory', emoji: '📦' },
                { id: 'events', label: 'Events', emoji: '🎪' },
                { id: 'pos', label: 'POS', emoji: '💳' },
                { id: 'catalog', label: 'Catalog', emoji: '📕' }
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
                >
                  <span className="text-lg">{item.emoji}</span>
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
                  className="rounded-full border-2 border-primary/30 bg-white p-2 hover:bg-primary/5 transition-all"
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
                className="md:hidden rounded-xl border-2 border-primary/30 p-2.5 text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
                aria-label="Toggle menu"
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
                  { id: 'home', label: 'Home', emoji: '🏠' },
                  { id: 'inventory', label: 'Inventory', emoji: '📦' },
                  { id: 'events', label: 'Events', emoji: '🎪' },
                  { id: 'pos', label: 'POS', emoji: '💳' },
                  { id: 'catalog', label: 'Catalog', emoji: '📕' }
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
                  >
                    <span className="text-xl">{item.emoji}</span>
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
                  : 'Create events, manage dates and fees, and review event performance summaries.'}
              </p>
            </div>

            {activeView === 'home' && renderHome()}
            {activeView === 'inventory' && renderInventory()}
            {activeView === 'events' && renderEvents()}
            {activeView === 'catalog' && renderCatalog()}
            {activeView === 'pos' && renderPOS()}
          </section>
        </div>
      </main>

      {/* Global Modals - rendered outside page views */}
      {showCreateCatalog && renderCatalogFormModal(false)}
      {editingCatalogItem && renderCatalogFormModal(true)}

      {/* POS Confirm Sale Modal */}
      {showConfirmSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl border-2 border-primary/20 animate-scale-in">
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
                className="rounded-full border-2 border-primary/20 px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-colors"
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-6">
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
                onClick={async () => {
                  await handleRecordSale()
                  setShowConfirmSale(false)
                }}
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                type="button"
                disabled={isSubmittingSale}
              >
                {isSubmittingSale ? '⏳ Processing...' : '✓ Confirm Sale'}
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

        .animate-fade-in {
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

        .animate-scale-in {
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
    </div>
  )
}
