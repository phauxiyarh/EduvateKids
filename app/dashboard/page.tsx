'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../../lib/firebase'
import { ApexBarChart } from '../components/ApexBarChart'
import logo from '../../assets/logo.png'
import bg1 from '../../assets/bg1.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'

const dashboardData = {
  today: {
    summary: [
      { label: "Today's Sales", value: 8420, note: '14 transactions', prefix: '$' },
      { label: 'Low Stock Items', value: 56, note: 'Restock in 7 days' },
      { label: 'Active Events', value: 4, note: '2 open, 2 upcoming' },
      { label: 'Catalog Size', value: 1250, note: 'Books & kits' }
    ],
    bestSellers: [
      { title: 'My First Quran Stories', sold: 84 },
      { title: 'Ramadan Activity Kit', sold: 63 },
      { title: 'Prophets & Heroes', sold: 52 },
      { title: 'Hajj Adventure Puzzle', sold: 41 }
    ],
    chart: [62, 48, 80, 55, 72, 66, 90],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  },
  week: {
    summary: [
      { label: 'Weekly Sales', value: 42180, note: '89 transactions', prefix: '$' },
      { label: 'Low Stock Items', value: 64, note: 'Restock in 5 days' },
      { label: 'Active Events', value: 6, note: '4 open, 2 upcoming' },
      { label: 'Catalog Size', value: 1262, note: 'Books & kits' }
    ],
    bestSellers: [
      { title: 'Seerah Storybook', sold: 210 },
      { title: 'Eid Gift Bundle', sold: 168 },
      { title: 'My First Quran Stories', sold: 152 },
      { title: 'Arabic Alphabet Flashcards', sold: 121 }
    ],
    chart: [72, 60, 88, 74, 92, 70, 86],
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7']
  },
  month: {
    summary: [
      { label: 'Monthly Sales', value: 138400, note: '312 transactions', prefix: '$' },
      { label: 'Low Stock Items', value: 72, note: 'Restock in 4 days' },
      { label: 'Active Events', value: 9, note: '6 open, 3 upcoming' },
      { label: 'Catalog Size', value: 1310, note: 'Books & kits' }
    ],
    bestSellers: [
      { title: 'Ramadan Activity Kit', sold: 640 },
      { title: 'Prophets & Heroes', sold: 520 },
      { title: 'My First Quran Stories', sold: 488 },
      { title: 'Hajj Adventure Puzzle', sold: 410 }
    ],
    chart: [68, 76, 90, 82, 95, 88, 93],
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7']
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today')
  const activeData = dashboardData[range]
  const [animatedCounts, setAnimatedCounts] = useState(
    activeData.bestSellers.map(() => 0)
  )
  const [animatedSummary, setAnimatedSummary] = useState(
    activeData.summary.map(() => 0)
  )

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

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/auth/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  useEffect(() => {
    let frame: number
    const start = performance.now()
    const duration = 900
    const targets = activeData.bestSellers.map((item) => item.sold)

    const tick = (time: number) => {
      const progress = Math.min((time - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedCounts(targets.map((value) => Math.floor(value * eased)))

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [range, activeData.bestSellers])

  useEffect(() => {
    let frame: number
    const start = performance.now()
    const duration = 900
    const targets = activeData.summary.map((item) => item.value)

    const tick = (time: number) => {
      const progress = Math.min((time - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedSummary(targets.map((value) => Math.floor(value * eased)))

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [range, activeData.summary])

  const formatNumber = (value: number) => value.toLocaleString('en-US')

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

      <main className="relative z-10 mx-auto w-11/12 max-w-6xl py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl">Bookstore Overview</h1>
            <p className="mt-2 text-sm text-muted">
              Store records snapshot (demo data) across sales, inventory, and events.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {(['today', 'week', 'month'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setRange(item)}
                className={`rounded-full px-3 py-1 font-semibold transition ${
                  range === item
                    ? 'bg-primary text-white'
                    : 'bg-primary/10 text-primaryDark'
                }`}
                type="button"
              >
                {item === 'today' ? 'Today' : item === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
            <span className="rounded-full bg-secondary/10 px-3 py-1 text-secondary">
              Updated 5 mins ago
            </span>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {activeData.summary.map((card, index) => (
            <div
              key={`${range}-${card.label}`}
              className="rounded-2xl bg-white p-5 shadow-soft transition-all duration-500 hover:-translate-y-1"
            >
              <p className="text-xs font-semibold uppercase text-muted">{card.label}</p>
              <h2 className="mt-3 font-display text-3xl text-primaryDark">
                {'prefix' in card ? card.prefix : ''}
                {formatNumber(animatedSummary[index])}
              </h2>
              <p className="mt-2 text-xs text-muted">{card.note}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <ApexBarChart
            title="Sales Trend"
            labels={activeData.labels}
            values={activeData.chart}
            height={280}
          />

          <div className="rounded-2xl bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl">Best Sellers</h3>
              <span className="text-xs text-muted">Event season</span>
            </div>
            <div className="mt-4">
              <ApexBarChart
                title="Top Items"
                labels={activeData.bestSellers.map((item) => item.title)}
                values={activeData.bestSellers.map((item) => item.sold)}
                height={240}
              />
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              {activeData.bestSellers.map((item, index) => (
                <li key={item.title} className="flex items-center justify-between">
                  <span>{item.title}</span>
                  <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primaryDark transition hover:-translate-y-0.5">
                    {animatedCounts[index]} sold
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-soft">
            <h3 className="font-display text-xl">Event Performance</h3>
            <div className="mt-4 space-y-4 text-sm">
              {[
                { name: 'Masjid Book Fair', value: '$4,300', progress: '70%' },
                { name: 'School Literacy Night', value: '$2,150', progress: '54%' },
                { name: 'Community Eid Bazaar', value: '$1,970', progress: '61%' }
              ].map((event) => (
                <div key={event.name}>
                  <div className="flex items-center justify-between">
                    <span>{event.name}</span>
                    <span className="text-muted">{event.value}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-primary/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-primary to-accentThree"
                      style={{ width: event.progress }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-soft">
            <h3 className="font-display text-xl">Inventory Alerts</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                'Quran for Kids (Stock: 6)',
                'Arabic Alphabet Flashcards (Stock: 8)',
                'Seerah Storybook (Stock: 5)',
                'Craft Kit: Masjid (Stock: 9)'
              ].map((item) => (
                <li key={item} className="flex items-center justify-between">
                  <span>{item}</span>
                  <span className="text-xs font-semibold text-accentOne">Restock</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  )
}
