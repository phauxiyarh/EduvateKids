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
  writeBatch
} from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { auth, db } from '../../lib/firebase'
import logo from '../../assets/logo.png'
import bg1 from '../../assets/bg1.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'

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
    sales: []
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
    sales: []
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
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(true)
  const [activeView, setActiveView] = useState<'home' | 'inventory' | 'events'>(
    'home'
  )
  const [inventory, setInventory] = useState<InventoryItem[]>(defaultInventory)
  const [events, setEvents] = useState<EventRecord[]>(defaultEvents)
  const [generalSales, setGeneralSales] = useState<Sale[]>([])
  const [uploadMessage, setUploadMessage] = useState<string>('')
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        setLoading(false)
      } else {
        router.push('/auth/login')
      }
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const loadData = async () => {
      try {
        const inventoryRef = collection(db, 'inventory')
        const eventsRef = collection(db, 'events')
        const generalSalesRef = collection(db, 'generalSales')
        const [inventorySnap, eventsSnap] = await Promise.all([
          getDocs(inventoryRef),
          getDocs(eventsRef)
        ])
        const generalSalesSnap = await getDocs(generalSalesRef)

        if (inventorySnap.empty && eventsSnap.empty) {
          const batch = writeBatch(db)
          defaultInventory.forEach((item) => {
            batch.set(doc(inventoryRef, item.id), item)
          })
          defaultEvents.forEach((event) => {
            batch.set(doc(eventsRef, event.id), event)
          })
          await batch.commit()

          if (!cancelled) {
            setInventory(defaultInventory)
            setEvents(defaultEvents)
          }
        } else {
          if (!cancelled) {
            if (inventorySnap.empty) {
              setInventory([])
            } else {
              const loadedInventory = inventorySnap.docs
                .map((snap) => normalizeInventoryItem(snap.data() as Partial<InventoryItem>, snap.id))
                .filter((item) => item.title)
              setInventory(loadedInventory)
            }

            if (eventsSnap.empty) {
              setEvents([])
            } else {
              const loadedEvents = eventsSnap.docs.map((snap) => {
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
                  sales
                }
              })
              setEvents(loadedEvents)
            }
          }
        }

        if (!cancelled) {
          if (generalSalesSnap.empty) {
            setGeneralSales([])
          } else {
            const loadedGeneralSales = generalSalesSnap.docs
              .map((snap) => normalizeSale(snap.data() as Partial<Sale>))
              .filter((sale): sale is Sale => Boolean(sale))
            setGeneralSales(loadedGeneralSales)
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
  }, [user])

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

  const convenienceFeeRate = paymentType === 'Card' ? 0.03 : 0
  const convenienceFee = Number((cartTotal * convenienceFeeRate).toFixed(2))
  const totalWithFee = Number((cartTotal + convenienceFee).toFixed(2))

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
        batch.set(doc(inventoryRef, item.id), item)
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
      let nextInventory: InventoryItem[] = []

      setInventory((current) => {
        const next = [...current]
        parsedItems.forEach((item) => {
          const matchIndex = next.findIndex(
            (existing) =>
              existing.title.toLowerCase() === item.title.toLowerCase() &&
              existing.publisher.toLowerCase() === item.publisher.toLowerCase()
          )

          if (matchIndex >= 0) {
            const existing = next[matchIndex]
            next[matchIndex] = {
              ...existing,
              ...item,
              quantity: existing.quantity + item.quantity
            }
            updated += 1
          } else {
            next.push(item)
            added += 1
          }
        })
        nextInventory = next
        return next
      })

      setUploadMessage(`Upload complete. Added ${added} items, updated ${updated}.`)
      await persistInventory(nextInventory)
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
      sales: []
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
      await setDoc(doc(db, 'events', newEvent.id), newEvent)
    } catch (error) {
      console.error('Create event error:', error)
      setEventMessage('Event saved locally, but failed to sync.')
    }
  }

  const handleToggleEventStatus = async (eventId: string) => {
    let nextStatus: EventStatus = 'active'

    setEvents((current) =>
      current.map((event) => {
        if (event.id !== eventId) return event
        nextStatus = event.status === 'active' ? 'closed' : 'active'
        return { ...event, status: nextStatus }
      })
    )

    try {
      await updateDoc(doc(db, 'events', eventId), { status: nextStatus })
    } catch (error) {
      console.error('Update event status error:', error)
      setEventMessage('Status updated locally, but failed to sync.')
    }
  }

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
    const salesToAdd: Sale[] = cartItems.map((cartItem) => ({
      id: `sale-${Date.now()}-${cartItem.itemId}`,
      itemId: cartItem.itemId,
      title: cartItem.title,
      quantity: cartItem.quantity,
      paymentType,
      total: Number((cartItem.price * cartItem.quantity * feeMultiplier).toFixed(2)),
      timestamp
    }))

    const updatedSales = eventRecord ? [...salesToAdd, ...eventRecord.sales] : salesToAdd
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
          event.id === eventRecord.id ? { ...event, sales: updatedSales } : event
        )
      )
    } else {
      setGeneralSales((current) => [...salesToAdd, ...current])
    }

    setInventory(nextInventory)

    setCartItems([])
    setEventMessage(`Sale recorded (${salesToAdd.length} items).`)

    try {
      const batch = writeBatch(db)
      if (eventRecord) {
        batch.update(doc(db, 'events', eventRecord.id), { sales: updatedSales })
      } else {
        salesToAdd.forEach((sale) => {
          batch.set(doc(db, 'generalSales', sale.id), sale)
        })
      }
      nextInventory.forEach((item) => {
        batch.update(doc(db, 'inventory', item.id), { quantity: item.quantity })
      })
      await batch.commit()
    } catch (error) {
      console.error('Record sale error:', error)
      setEventMessage('Sale saved locally, but failed to sync.')
    } finally {
      setIsSubmittingSale(false)
    }
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
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-primaryDark">Title</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-primaryDark">Category</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-primaryDark">Publisher</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-primaryDark">RRP</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-primaryDark">Discount %</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-primaryDark">Quantity</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-primaryDark">Selling Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {inventory.map((item, index) => (
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
                          className={`rounded-full px-3 py-1 text-xs font-bold transition-all hover:scale-105 ${
                            event.status === 'active'
                              ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                          type="button"
                        >
                          {event.status === 'active' ? '● Active' : '○ Closed'}
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

        <div className="panel-card rounded-3xl bg-gradient-to-br from-white to-emerald-50/50 p-6 shadow-xl border border-emerald-200/50">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 text-xl">
              💳
            </span>
            <div>
              <h3 className="font-display text-xl gradient-text">POS Sales</h3>
              <p className="text-xs text-muted">Record sales for active events</p>
            </div>
          </div>

          <div className="space-y-4">
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              className="w-full rounded-xl border-2 border-emerald-200 px-4 py-3 text-sm font-medium hover:border-emerald-300 transition-colors"
            >
              <option value="">Select active event</option>
              <option value="general">General Sales (no event)</option>
              {events
                .filter((event) => event.status === 'active')
                .map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
            </select>

            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="🔍 Search catalog by title, publisher, or category"
              className="w-full rounded-xl border-2 border-emerald-200 px-4 py-3 text-sm hover:border-emerald-300 transition-colors"
            />

            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="number"
                min={1}
                value={addQuantity}
                onChange={(event) => setAddQuantity(Number(event.target.value))}
                placeholder="Quantity"
                className="w-full rounded-xl border-2 border-emerald-200 px-4 py-3 text-sm hover:border-emerald-300 transition-colors"
              />
              <select
                value={paymentType}
                onChange={(event) => setPaymentType(event.target.value as Sale['paymentType'])}
                className="w-full rounded-xl border-2 border-emerald-200 px-4 py-3 text-sm hover:border-emerald-300 transition-colors"
              >
                <option value="Cash">💵 Cash</option>
                <option value="Card">💳 Card (+3%)</option>
                <option value="Transfer">🏦 Transfer</option>
              </select>
            </div>

            <div className="rounded-2xl border-2 border-emerald-200 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-100 to-green-100 px-4 py-3 border-b border-emerald-200">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Catalog</p>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-emerald-100">
                {filteredInventory.length ? (
                  filteredInventory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 hover:bg-emerald-50/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{item.title}</p>
                        <p className="text-xs text-muted mt-1">
                          {item.category} · Stock: {item.quantity} · ${formatNumber(item.sellingPrice)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddToCart(item.id)}
                        className="ml-3 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-xs font-bold text-white hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                        disabled={item.quantity === 0}
                      >
                        Add
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-xs text-muted">No matches found.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-primary/20 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-3 border-b border-primary/20 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-primaryDark">Cart</p>
                {cartItems.length > 0 && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-primaryDark shadow-sm border border-primary/20">
                    {cartItems.length} items
                  </span>
                )}
              </div>
              <div className="p-4">
                {cartItems.length ? (
                  <div className="space-y-3">
                    {cartItems.map((item) => (
                      <div key={item.itemId} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{item.title}</p>
                          <p className="text-xs text-muted">${formatNumber(item.price)} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(event) =>
                              handleUpdateCartQuantity(item.itemId, Number(event.target.value))
                            }
                            className="w-16 rounded-lg border-2 border-primary/20 px-2 py-1 text-xs text-center font-bold"
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
                    ))}
                    <div className="space-y-2 pt-3 border-t-2 border-primary/20">
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
                      <div className="flex items-center justify-between text-lg font-bold pt-2 border-t border-primary/10">
                        <span className="gradient-text">Total</span>
                        <span className="gradient-text">${formatNumber(totalWithFee)}</span>
                      </div>
                      {paymentType === 'Card' && (
                        <p className="text-[11px] text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                          💳 Card payments include a 3% convenience fee.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleClearCart}
                      className="w-full rounded-xl border-2 border-red-200 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                      type="button"
                    >
                      Clear cart
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted text-center py-8">Cart is empty. Add items from the catalog.</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowConfirmSale(true)}
              className="w-full rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-4 text-sm font-bold text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={!selectedEventId || cartItems.length === 0}
            >
              💰 Record Sale
            </button>
            {eventMessage && (
              <p className="text-xs text-center px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-medium">{eventMessage}</p>
            )}
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
                { id: 'events', label: 'Events', emoji: '🎪' }
              ].map((item) => (
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
              {/* Sync Status Indicator */}
              <div className="hidden lg:flex items-center gap-2 text-xs font-bold">
                <span className={`h-2 w-2 rounded-full ${dataLoading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                <span className={dataLoading ? 'text-amber-600' : 'text-green-600'}>
                  {dataLoading ? 'Syncing...' : 'Synced'}
                </span>
              </div>

              {/* User Email - Desktop Only */}
              <div className="hidden md:block text-sm text-right">
                <p className="font-semibold text-primaryDark">{user?.email || 'Admin'}</p>
              </div>

              {/* Sign Out Button - Desktop */}
              <button
                onClick={handleLogout}
                className="hidden md:block rounded-full border-2 border-primary/30 bg-white px-4 py-2 text-sm font-bold text-primaryDark hover:bg-primary/5 hover:-translate-y-0.5 transition-all duration-300 shadow-sm"
              >
                Sign out
              </button>

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
                  { id: 'events', label: 'Events', emoji: '🎪' }
                ].map((item) => (
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
                <div className="px-4 text-sm">
                  <p className="font-semibold text-primaryDark">{user?.email || 'Admin'}</p>
                  <p className="text-xs text-muted">Signed in</p>
                </div>

                <div className="px-4">
                  <div className={`inline-flex items-center gap-2 text-xs font-bold ${dataLoading ? 'text-amber-600' : 'text-green-600'}`}>
                    <span className={`h-2 w-2 rounded-full ${dataLoading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                    {dataLoading ? 'Syncing data...' : 'All synced'}
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full mx-4 rounded-full border-2 border-primary/30 bg-white px-4 py-2.5 text-sm font-bold text-primaryDark hover:bg-primary/5 transition-all duration-300 shadow-sm"
                  style={{ width: 'calc(100% - 2rem)' }}
                >
                  Sign out
                </button>
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
                  : 'Event Management'}
              </h1>
              <p className="mt-3 text-sm text-muted max-w-2xl">
                {activeView === 'home'
                  ? 'Monitor restock needs, best sellers, and event performance at a glance.'
                  : activeView === 'inventory'
                  ? 'Upload, update, and manage your complete inventory with ease.'
                  : 'Create events, record sales through POS, and review comprehensive summaries.'}
              </p>
            </div>

            {activeView === 'home' && renderHome()}
            {activeView === 'inventory' && renderInventory()}
            {activeView === 'events' && renderEvents()}
          </section>
        </div>
      </main>
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
