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
import { ApexBarChart } from '../components/ApexBarChart'
import { ApexDonutChart } from '../components/ApexDonutChart'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
    Bazaar: 'bg-amber-100 text-amber-700',
    Bookfair: 'bg-emerald-100 text-emerald-700',
    'Jummah Boot': 'bg-indigo-100 text-indigo-700'
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
        prefix: '$'
      },
      {
        label: 'Low Stock Items',
        value: restockItems.length,
        note: `Restock threshold: ${restockThreshold}`
      },
      {
        label: 'Active Events',
        value: events.filter((event) => event.status === 'active').length,
        note: `${events.length} total events`
      },
      {
        label: 'Catalog Size',
        value: inventory.length,
        note: 'Books & kits'
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
    <div className="space-y-10">
      <section className="fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-white to-accentThree/10 p-6 shadow-soft">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-accentThree/20 blur-2xl" />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-primary/15 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-2xl text-primaryDark">Daily Pulse</h2>
            <p className="mt-2 text-sm text-muted">
              A live snapshot of sales momentum, inventory health, and top performing events.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primaryDark">
              Updated moments ago
            </span>
          </div>
        </div>
        <div className="relative z-10 mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card, index) => (
            <div
              key={card.label}
              className="home-card panel-card rounded-2xl bg-white/80 p-5 shadow-soft backdrop-blur"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <p className="text-xs font-semibold uppercase text-muted">{card.label}</p>
              <h2 className="mt-3 font-display text-3xl text-primaryDark">
                {'prefix' in card ? card.prefix : ''}
                {formatNumber(card.value)}
              </h2>
              <p className="mt-2 text-xs text-muted">{card.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <ApexBarChart
          title="Weekly Sales Trend"
          labels={salesTrend.labels}
          values={salesTrend.values}
          height={280}
        />

        <div className="grid gap-6">
          <ApexDonutChart
            title="Category Mix"
            labels={categoryMix.labels}
            values={categoryMix.values}
            height={220}
          />

          <div className="panel-card rounded-2xl bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl">Best Sellers</h3>
              <span className="text-xs text-muted">Across all events</span>
            </div>
            {bestSellers.length ? (
              <div className="mt-4">
                <ApexBarChart
                  title="Top Items"
                  labels={bestSellers.map((item) => item.title)}
                  values={bestSellers.map((item) => item.quantity)}
                  height={220}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                No sales yet. Record a sale to see top items.
              </p>
            )}
            <ul className="mt-4 space-y-3 text-sm">
              {bestSellers.map((item) => (
                <li key={item.title} className="flex items-center justify-between">
                  <span>{item.title}</span>
                  <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primaryDark">
                    {item.quantity} sold
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="panel-card rounded-2xl bg-white p-6 shadow-soft">
          <h3 className="font-display text-xl">Best Event</h3>
          {bestEvent ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{bestEvent.name}</span>
                <span className="text-muted">
                  ${formatNumber(bestEvent.sales.reduce((sum, sale) => sum + sale.total, 0))}
                </span>
              </div>
              <div className="text-xs text-muted">
                Dates: {bestEvent.startDate || 'TBD'} - {bestEvent.endDate || 'TBD'}
              </div>
              <div className="text-xs text-muted">
                {bestEvent.type} · {bestEvent.location || 'Location TBD'}
              </div>
              <div className="text-xs text-muted">
                Status: {bestEvent.status === 'active' ? 'Active' : 'Closed'}
              </div>
              <div className="text-xs text-muted">Vendor fee: ${formatNumber(bestEvent.cost)}</div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">No events created yet.</p>
          )}
        </div>

        <div className="panel-card rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl">Inventory Health</h3>
            <span className="text-xs text-muted">Restock radar</span>
          </div>
          {restockItems.length ? (
            <div className="mt-4 space-y-4">
              {restockItems.slice(0, 6).map((item, index) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{item.title}</span>
                    <span className="text-xs text-muted">{item.quantity} left</span>
                  </div>
                  <div className="h-2 rounded-full bg-primary/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-accentOne to-primary"
                      style={{
                        width: `${Math.max(
                          15,
                          Math.min(100, (item.quantity / restockThreshold) * 100)
                        )}%`,
                        animationDelay: `${index * 120}ms`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">All items are healthy on stock.</p>
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
      <div className="panel-card rounded-2xl bg-white p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primaryDark">
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path
                d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3H4V7Zm0 5h16v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Zm4 2h4v2H8v-2Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <h2 className="font-display text-2xl">Inventory Upload</h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          Upload an .xlsx file to add new arrivals or update existing stock. Columns should follow the
          order: Title, Category, Publisher, RRP, Discount %, Quantity, Selling Price.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <input
            type="file"
            accept=".xlsx"
            onChange={handleInventoryUpload}
            className="rounded-lg border border-primary/20 bg-white px-4 py-2 text-sm"
          />
          <button
            onClick={handleDownloadTemplate}
            className="rounded-full border border-primary/30 bg-white px-4 py-2 text-sm font-semibold text-primaryDark"
            type="button"
          >
            Download template
          </button>
          {uploadMessage && <span className="text-sm text-muted">{uploadMessage}</span>}
        </div>
      </div>

      <div className="panel-card overflow-hidden rounded-2xl bg-white shadow-soft">
        <div className="border-b border-black/10 px-6 py-4">
          <h3 className="font-display text-xl">Current Stock</h3>
          <p className="text-xs text-muted">Total items: {inventory.length}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-primary/5 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Publisher</th>
                <th className="px-6 py-3">RRP</th>
                <th className="px-6 py-3">Discount %</th>
                <th className="px-6 py-3">Quantity</th>
                <th className="px-6 py-3">Selling Price</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id} className="border-t border-black/5">
                  <td className="px-6 py-4">{item.title}</td>
                  <td className="px-6 py-4">{item.category}</td>
                  <td className="px-6 py-4">{item.publisher}</td>
                  <td className="px-6 py-4">${formatNumber(item.rrp)}</td>
                  <td className="px-6 py-4">{item.discount}%</td>
                  <td className="px-6 py-4">{item.quantity}</td>
                  <td className="px-6 py-4">${formatNumber(item.sellingPrice)}</td>
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
      <div className="panel-card rounded-2xl bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primaryDark">
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  d="M7 4v2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2V4h-2v2H9V4H7Zm-2 6h14v8H5v-8Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <div>
              <h2 className="font-display text-2xl">Create Event</h2>
              <p className="text-xs text-muted">Schedule events with dates and vendor fees.</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateEvent(true)}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white"
            type="button"
          >
            New Event
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel-card rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primaryDark">
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path
                    d="M5 5h14a2 2 0 0 1 2 2v2H3V7a2 2 0 0 1 2-2Zm-2 6h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <h3 className="font-display text-xl">Events</h3>
            </div>
            <span className="text-xs text-muted">{events.length} total</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              value={eventTypeFilter}
              onChange={(event) =>
                setEventTypeFilter(event.target.value as typeof eventTypeFilter)
              }
              className="w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
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
                className="w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
              />
              <input
                type="date"
                value={eventDateEnd}
                onChange={(event) => setEventDateEnd(event.target.value)}
                className="w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {filteredEvents.map((event) => {
              const totalSales = event.sales.reduce((sum, sale) => sum + sale.total, 0)
              return (
                <div key={event.id} className="rounded-xl border border-black/10 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{event.name}</p>
                      <p className="text-xs text-muted">
                        {event.location || 'Location TBD'}
                      </p>
                      <p className="text-xs text-muted">Vendor fee: ${formatNumber(event.cost)}</p>
                      <p className="text-xs text-muted">
                        Dates: {event.startDate || 'TBD'} - {event.endDate || 'TBD'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${eventTypeBadgeClasses[event.type]}`}
                      >
                        {event.type}
                      </span>
                    <button
                      onClick={() => handleToggleEventStatus(event.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        event.status === 'active'
                          ? 'bg-accentThree/20 text-primaryDark'
                          : 'bg-black/5 text-muted'
                      }`}
                      type="button"
                    >
                      {event.status === 'active' ? 'Active' : 'Closed'}
                    </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted">
                    <span>{event.sales.length} transactions</span>
                    <span>Total sales: ${formatNumber(totalSales)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="panel-card rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primaryDark">
              <svg viewBox="0 0 24 24" className="h-4 w-4">
                <path
                  d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3H4V6Zm0 5h16v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Zm5 2h6v2H9v-2Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <h3 className="font-display text-xl">POS Sales</h3>
          </div>
          <p className="mt-2 text-xs text-muted">
            Record sales for active events only. Inventory will auto-deduct.
          </p>

          <div className="mt-4 space-y-3">
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              className="w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
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
              placeholder="Search catalog by title, publisher, or category"
              className="w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
            />

            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="number"
                min={1}
                value={addQuantity}
                onChange={(event) => setAddQuantity(Number(event.target.value))}
                className="w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
              />
              <select
                value={paymentType}
                onChange={(event) => setPaymentType(event.target.value as Sale['paymentType'])}
                className="w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
              >
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Transfer">Transfer</option>
              </select>
            </div>

            <div className="rounded-xl border border-black/10">
              <div className="border-b border-black/10 px-4 py-2 text-xs font-semibold uppercase text-muted">
                Catalog
              </div>
              <div className="max-h-48 overflow-y-auto px-4 py-2 text-sm">
                {filteredInventory.length ? (
                  filteredInventory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border-b border-black/5 py-2 last:border-b-0"
                    >
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-xs text-muted">
                          {item.category} - Stock: {item.quantity} - ${formatNumber(item.sellingPrice)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddToCart(item.id)}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primaryDark"
                        type="button"
                        disabled={item.quantity === 0}
                      >
                        Add
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-xs text-muted">No matches found.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-black/10">
              <div className="border-b border-black/10 px-4 py-2 text-xs font-semibold uppercase text-muted">
                Cart
              </div>
              <div className="space-y-3 px-4 py-3 text-sm">
                {cartItems.length ? (
                  cartItems.map((item) => (
                    <div key={item.itemId} className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{item.title}</p>
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
                          className="w-20 rounded-lg border border-primary/20 px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => handleRemoveFromCart(item.itemId)}
                          className="text-xs font-semibold text-accentOne"
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted">Cart is empty. Add items from the catalog.</p>
                )}
                <div className="space-y-1 border-t border-black/10 pt-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Subtotal</span>
                    <span>${formatNumber(cartTotal)}</span>
                  </div>
                  {paymentType === 'Card' && (
                    <div className="flex items-center justify-between text-accentOne">
                      <span>Convenience fee (3%)</span>
                      <span>${formatNumber(convenienceFee)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>${formatNumber(totalWithFee)}</span>
                  </div>
                  {paymentType === 'Card' && (
                    <p className="text-[11px] text-muted">
                      Card payments include a 3% convenience fee.
                    </p>
                  )}
                </div>
                {cartItems.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="w-full rounded-full border border-primary/20 py-2 text-xs font-semibold text-primaryDark"
                    type="button"
                  >
                    Clear cart
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowConfirmSale(true)}
              className="w-full rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white"
              type="button"
              disabled={!selectedEventId || cartItems.length === 0}
            >
              Record Sale
            </button>
            {eventMessage && (
              <p className="text-xs text-muted">{eventMessage}</p>
            )}
          </div>
        </div>
      </div>

      {showCreateEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-soft">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-display text-xl">Create New Event</h4>
                <p className="mt-1 text-xs text-muted">
                  Add dates, vendor fee, and keep the event active.
                </p>
              </div>
              <button
                onClick={() => setShowCreateEvent(false)}
                className="rounded-full border border-primary/20 px-3 py-1 text-xs font-semibold text-primaryDark"
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted">Event name</label>
                <input
                  type="text"
                  value={newEventName}
                  onChange={(event) => setNewEventName(event.target.value)}
                  placeholder="Event name"
                  className="mt-2 w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted">Location</label>
                <input
                  type="text"
                  value={newEventLocation}
                  onChange={(event) => setNewEventLocation(event.target.value)}
                  placeholder="Event location"
                  className="mt-2 w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted">Start date</label>
                <input
                  type="date"
                  value={newEventStart}
                  onChange={(event) => setNewEventStart(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted">End date</label>
                <input
                  type="date"
                  value={newEventEnd}
                  onChange={(event) => setNewEventEnd(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted">Event type</label>
                <select
                  value={newEventType}
                  onChange={(event) =>
                    setNewEventType(event.target.value as EventRecord['type'])
                  }
                  className="mt-2 w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
                >
                  <option value="Bazaar">Bazaar</option>
                  <option value="Bookfair">Bookfair</option>
                  <option value="Jummah Boot">Jummah Boot</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted">Vendor fee</label>
                <input
                  type="number"
                  value={newEventCost}
                  onChange={(event) => setNewEventCost(event.target.value)}
                  placeholder="Vendor fee"
                  className="mt-2 w-full rounded-lg border border-primary/20 px-4 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateEvent(false)}
                className="rounded-full border border-primary/20 px-4 py-2 text-xs font-semibold text-primaryDark"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white"
                type="button"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-soft">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-display text-xl">Confirm Sale</h4>
                <p className="mt-1 text-xs text-muted">
                  {selectedEventId === 'general'
                    ? 'General Sales (no event)'
                    : events.find((event) => event.id === selectedEventId)?.name ??
                      'Selected event'}
                </p>
              </div>
              <button
                onClick={() => setShowConfirmSale(false)}
                className="rounded-full border border-primary/20 px-3 py-1 text-xs font-semibold text-primaryDark"
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              {cartItems.map((item) => (
                <div key={item.itemId} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-muted">
                      {item.quantity} x ${formatNumber(item.price)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    ${formatNumber(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted">Subtotal</span>
                <span>${formatNumber(cartTotal)}</span>
              </div>
              {paymentType === 'Card' && (
                <div className="flex items-center justify-between text-accentOne">
                  <span>Convenience fee (3%)</span>
                  <span>${formatNumber(convenienceFee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>${formatNumber(totalWithFee)}</span>
              </div>
              {paymentType === 'Card' && (
                <p className="text-[11px] text-muted">
                  Card payments include a 3% convenience fee.
                </p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmSale(false)}
                className="rounded-full border border-primary/20 px-4 py-2 text-xs font-semibold text-primaryDark"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleRecordSale()
                  setShowConfirmSale(false)
                }}
                className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white"
                type="button"
                disabled={isSubmittingSale}
              >
                {isSubmittingSale ? 'Processing...' : 'Confirm Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel-card rounded-2xl bg-white p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primaryDark">
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path
                d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 4h8v2H8V8Zm0 4h8v2H8v-2Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <h3 className="font-display text-xl">Event Summaries</h3>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
              <div key={event.id} className="rounded-xl border border-black/10 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{event.name}</p>
                  <span className="text-xs text-muted">
                    {event.status === 'active' ? 'Active' : 'Closed'}
                  </span>
                </div>
                <div className="mt-3 text-xs text-muted">
                  <p>
                    {event.type} · {event.location || 'Location TBD'}
                  </p>
                  <p>Dates: {event.startDate || 'TBD'} - {event.endDate || 'TBD'}</p>
                  <p>Total sales: ${formatNumber(totalSales)}</p>
                  <p>Transactions: {transactions}</p>
                  <p>Best seller: {bestSellerName ?? 'No sales yet'}</p>
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen text-ink">
      <div
        className="hero-svg-bg absolute inset-0 opacity-22"
        style={{
          backgroundImage: `url(${bg1.src})`,
          backgroundSize: '75% auto',
          backgroundRepeat: 'repeat'
        }}
      />
      {[
        { src: design1, classes: 'left-6 top-12 h-16 w-16 opacity-30' },
        { src: design2, classes: 'right-10 top-10 h-20 w-20 opacity-25' },
        { src: design1, classes: 'left-1/4 top-64 h-14 w-14 opacity-20' },
        { src: design2, classes: 'right-1/3 top-56 h-16 w-16 opacity-25' },
        { src: design1, classes: 'left-16 bottom-20 h-20 w-20 opacity-20' },
        { src: design2, classes: 'right-20 bottom-16 h-16 w-16 opacity-25' },
        { src: design1, classes: 'left-1/2 top-24 h-24 w-24 opacity-20' },
        { src: design2, classes: 'right-1/2 bottom-24 h-14 w-14 opacity-20' },
        { src: design1, classes: 'left-10 bottom-1/3 h-12 w-12 opacity-30' },
        { src: design2, classes: 'right-10 bottom-1/2 h-14 w-14 opacity-20' }
      ].map((item, index) => (
        <Image
          key={`dash-design-${index}`}
          src={item.src}
          alt=""
          width={160}
          height={160}
          className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 ${item.classes}`}
        />
      ))}
      <header className="relative z-10 border-b border-black/10 bg-white">
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between py-4">
          <a className="flex items-center gap-3" href="/">
            <Image src={logo} alt="Eduvate Kids logo" width={46} height={46} />
            <span className="font-display text-lg font-bold">Eduvate Kids</span>
          </a>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted">
              {user?.email ? `Welcome, ${user.email}` : 'Admin Dashboard'}
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full border border-primary/30 bg-white px-4 py-2 text-sm font-semibold text-primaryDark hover:bg-primary/5"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full px-6 py-10">
        <aside
          className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-black/10 bg-white/95 px-4 pb-6 pt-6 shadow-soft backdrop-blur transition-all ${
            sidebarCollapsed ? 'w-20' : 'w-72'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primaryDark">
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path
                    d="M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 4 5 2.5v5L12 17l-5-2.5v-5L12 7Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              {!sidebarCollapsed && (
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Admin</p>
                  <p className="font-display text-lg text-primaryDark">Control Hub</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="rounded-full border border-primary/20 p-2 text-primaryDark"
              type="button"
              aria-label={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
            >
              {sidebarCollapsed ? '›' : '‹'}
            </button>
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-3">
            {[
              {
                id: 'home',
                label: 'Home',
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5">
                    <path
                      d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z"
                      fill="currentColor"
                    />
                  </svg>
                )
              },
              {
                id: 'inventory',
                label: 'Inventory',
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5">
                    <path
                      d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5H4V6Zm0 7h16v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Zm4 2h5v2H8v-2Z"
                      fill="currentColor"
                    />
                  </svg>
                )
              },
              {
                id: 'events',
                label: 'Event Management',
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5">
                    <path
                      d="M6 4v2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1V4h-2v2H8V4H6Zm-1 6h14v8H5v-8Z"
                      fill="currentColor"
                    />
                  </svg>
                )
              }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as typeof activeView)}
                className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                  activeView === item.id
                    ? 'bg-primary text-white shadow-soft'
                    : 'bg-primary/10 text-primaryDark'
                }`}
                type="button"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    activeView === item.id ? 'bg-white/20' : 'bg-white'
                  }`}
                >
                  {item.icon}
                </span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </nav>

          {!sidebarCollapsed && (
            <div className="rounded-2xl bg-primary/10 p-3 text-xs text-muted">
              {dataLoading ? 'Syncing Firestore data...' : 'All systems synced.'}
            </div>
          )}
        </aside>

        <div className={`mx-auto max-w-6xl ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
          <section className="flex-1 space-y-6">
            <div>
              <h1 className="font-display text-3xl">
                {activeView === 'home'
                  ? 'Admin Home'
                  : activeView === 'inventory'
                  ? 'Inventory'
                  : 'Event Management'}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {activeView === 'home'
                  ? 'Monitor restock needs, best sellers, and event performance.'
                  : activeView === 'inventory'
                  ? 'Upload, update, and view stock levels.'
                  : 'Create events, record sales, and review summaries.'}
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
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
        }

        .fade-up {
          animation: fade-up 0.6s ease both;
        }

        @keyframes fade-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
