'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { EventNavDropdown } from '../components/EventNavDropdown'
import { HeaderCart } from '../components/HeaderCart'
import { OPEN_COOKIE_PREFS } from '../components/CookieConsent'
import logo from '../../assets/logo.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'
import bg1 from '../../assets/bg1.png'
import { SiteFooterFull } from '../components/SiteFooterFull'

type EventType = {
  title: string
  icon: JSX.Element
  description: string
  features: string[]
}

const eventTypes: EventType[] = [
  {
    title: 'School Book Fairs',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l6.16-3.42A12.08 12.08 0 0121 15.5c0 .66-.14 1.29-.4 1.86A11.95 11.95 0 0112 21a11.95 11.95 0 01-8.6-3.64A4.98 4.98 0 013 15.5a12.08 12.08 0 012.84-4.92L12 14z" /></svg>
    ),
    description: 'Bring the joy of reading to your school with a curated selection of Islamic books, educational materials, and learning kits.',
    features: ['Age-appropriate selections', 'Custom pricing tiers', 'On-site setup and support', 'Digital catalog access']
  },
  {
    title: 'Masjid Events',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21h18M5 21V10m14 11V10M5 10a7 7 0 0114 0M12 3v3m0 0a2 2 0 00-2 2m2-2a2 2 0 012 2M9 21v-4a3 3 0 016 0v4" /></svg>
    ),
    description: 'Perfect for Ramadan bazaars, Eid celebrations, and community fundraisers with Islamic literature and resources.',
    features: ['Fundraising opportunities', 'Community-focused titles', 'Flexible payment options', 'Extended online ordering']
  },
  {
    title: 'Educational Conferences',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m-4-3.5V17a4 4 0 008 0v-2.5" /></svg>
    ),
    description: 'Showcase the latest in Islamic education at your conference or professional development event.',
    features: ['Teacher resources', 'Bulk discounts available', 'Professional display setup', 'Presenter materials']
  },
  {
    title: 'Community Gatherings',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.83-4M7 12a3 3 0 01-2.83-4" /></svg>
    ),
    description: 'From family days to literacy events, we bring books and learning materials to your community.',
    features: ['Custom event packages', 'Interactive displays', 'Gift wrapping available', 'Multi-language options']
  }
]

const whyPartner = [
  {
    title: 'Curated Selection',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    ),
    text: 'Hand-picked Islamic books and educational materials appropriate for all ages.'
  },
  {
    title: 'Full Support',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" /></svg>
    ),
    text: 'Complete setup, on-site assistance, and post-event online ordering options.'
  },
  {
    title: 'Flexible Options',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
    text: 'Fundraising opportunities, bulk discounts, and custom pricing for your community.'
  }
]

function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible')
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

const WhatsAppIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
)

export default function BookEventPage() {
  const [formData, setFormData] = useState({
    organizationName: '',
    contactName: '',
    email: '',
    phone: '',
    eventType: '',
    eventDate: '',
    expectedAttendees: '',
    location: '',
    additionalInfo: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const typesReveal = useReveal<HTMLDivElement>()
  const typesGridReveal = useReveal<HTMLDivElement>()
  const formReveal = useReveal<HTMLDivElement>()
  const whyReveal = useReveal<HTMLDivElement>()
  const whyGridReveal = useReveal<HTMLDivElement>()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await addDoc(collection(db, 'eventBookings'), {
        organizationName: formData.organizationName,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        eventType: formData.eventType,
        eventDate: formData.eventDate,
        expectedAttendees: formData.expectedAttendees,
        location: formData.location,
        additionalInfo: formData.additionalInfo || '',
        status: 'new',
        createdAt: serverTimestamp()
      })
      setSubmitted(true)
      setFormData({
        organizationName: '',
        contactName: '',
        email: '',
        phone: '',
        eventType: '',
        eventDate: '',
        expectedAttendees: '',
        location: '',
        additionalInfo: ''
      })
    } catch (err) {
      console.error('Error submitting event booking:', err)
      setError('There was an error sending your request. Please try again or reach us on WhatsApp.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const inputClass =
    'rounded-xl border border-black/10 bg-white px-4 py-3 font-normal outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30'

  return (
    <div className="min-h-screen text-ink">
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)]">
        <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-xl" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-3 sm:gap-6 py-3">
          <Link className="group flex items-center gap-2 sm:gap-3 min-w-0" href="/">
            <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 transition-transform duration-500 group-hover:rotate-6" />
            <span className="flex flex-col min-w-0 leading-tight">
              <span className="font-display text-base sm:text-lg font-bold truncate">Eduvate Kids</span>
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-primary/70 hidden sm:block">Islamic Bookstore</span>
            </span>
          </Link>
          <nav className="hidden flex-1 justify-center items-center gap-1 md:flex">
            {[
              { label: 'Home', href: '/', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10', active: false },
              { label: 'Our Catalog', href: '/catalog', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', active: false },
              { label: 'Shelves', href: '/shelves', icon: 'M6 5v10M10 7v8M14 4v11M18 8v7M3.5 15.5h17M5 15.5v3.5m14-3.5v3.5', active: false }
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 ${item.active ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg' : 'bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5'}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                <span>{item.label}</span>
              </Link>
            ))}
            <EventNavDropdown active={true} />
            {[
              { label: 'Contact', href: '/contact-us', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z', active: false },
              { label: 'FAQs', href: '/faqs', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', active: false }
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 ${item.active ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg' : 'bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5'}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <HeaderCart />
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden pb-10 sm:pb-16 pt-20 sm:pt-28">
          <div className="hero-svg-bg absolute inset-0 z-0 opacity-15" style={{ backgroundImage: `url(${bg1.src})`, backgroundSize: '70% auto', backgroundRepeat: 'repeat' }} />
          {[
            'left-16 top-16 h-24 w-24 opacity-25',
            'right-20 top-24 h-32 w-32 opacity-20',
            'left-1/3 top-56 h-20 w-20 opacity-30',
            'right-1/4 top-40 h-28 w-28 opacity-25'
          ].map((classes, index) => (
            <Image key={`event-design-${index}`} src={index % 2 === 0 ? design1 : design2} alt="" width={160} height={160} className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 hidden md:block ${classes}`} />
          ))}
          <div className="reveal is-visible relative z-10 mx-auto w-11/12 max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-accentThree backdrop-blur">
              Partner With Us
            </span>
            <h1 className="mt-4 font-display text-3xl sm:text-5xl">
              Book an <span className="gradient-text">Event</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
              Bring Eduvate Kids to your school, masjid, or community event. We provide carefully
              curated Islamic books and educational materials with complete setup and support.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href="#request" className="btn-shine inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.3)] transition-all duration-300 hover:-translate-y-0.5">
                Request an Event
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </a>
            </div>
          </div>
        </section>

        <section className="relative py-14 sm:py-20 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div ref={typesReveal} className="reveal mx-auto w-11/12 max-w-6xl">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">What We Offer</p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">Event Types We Support</h2>
              <p className="mt-3 text-muted">Choose the perfect format for your community</p>
            </div>
            <div ref={typesGridReveal} className="reveal-stagger grid gap-6 md:grid-cols-2">
              {eventTypes.map((event) => (
                <div key={event.title} className="card-hover rounded-3xl bg-white p-5 sm:p-8 shadow-soft border border-primary/10 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(124,58,237,0.14)]">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primaryDark">
                      {event.icon}
                    </div>
                    <h3 className="font-display text-xl sm:text-2xl gradient-text">{event.title}</h3>
                  </div>
                  <p className="mt-4 text-muted leading-relaxed">{event.description}</p>
                  <ul className="mt-4 space-y-2">
                    {event.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        <span className="text-muted">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="request" className="relative py-14 sm:py-20 bg-white scroll-mt-24">
          <div ref={formReveal} className="reveal mx-auto w-11/12 max-w-3xl">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Let&apos;s Plan Together</p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">Request an Event</h2>
              <p className="mt-3 text-muted">
                Fill out the form below and we&apos;ll contact you within 1-2 business days to discuss your event needs.
              </p>
            </div>

            {submitted ? (
              <div className="animate-fadeIn rounded-3xl bg-gradient-to-br from-emerald-50 to-green-50 p-8 sm:p-10 shadow-soft border border-emerald-200 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="mt-5 font-display text-2xl gradient-text">Request Received!</h3>
                <p className="mt-3 text-muted">
                  Thank you for your interest. Our team will review your request and contact you within 1-2 business days.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-6 rounded-full border border-primary/30 bg-white px-6 py-3 text-sm font-semibold text-primaryDark transition hover:-translate-y-0.5 hover:bg-primary/5"
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="rounded-3xl bg-cream p-5 sm:p-8 shadow-soft border border-primary/10">
                <div className="grid gap-6">
                  {error && (
                    <div className="animate-slideDown flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                      <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="grid gap-6 md:grid-cols-2">
                    <label className="grid gap-2 font-semibold text-sm">
                      Organization Name *
                      <input className={inputClass} type="text" name="organizationName" value={formData.organizationName} onChange={handleChange} placeholder="Your School/Masjid/Organization" required />
                    </label>
                    <label className="grid gap-2 font-semibold text-sm">
                      Contact Name *
                      <input className={inputClass} type="text" name="contactName" value={formData.contactName} onChange={handleChange} placeholder="Your Full Name" required />
                    </label>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <label className="grid gap-2 font-semibold text-sm">
                      Email Address *
                      <input className={inputClass} type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" required />
                    </label>
                    <label className="grid gap-2 font-semibold text-sm">
                      Phone Number *
                      <input className={inputClass} type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="(555) 123-4567" required />
                    </label>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <label className="grid gap-2 font-semibold text-sm">
                      Event Type *
                      <select className={inputClass} name="eventType" value={formData.eventType} onChange={handleChange} required>
                        <option value="">Select Event Type</option>
                        <option value="school">School Book Fair</option>
                        <option value="masjid">Masjid Event</option>
                        <option value="conference">Educational Conference</option>
                        <option value="community">Community Gathering</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="grid gap-2 font-semibold text-sm">
                      Preferred Event Date *
                      <input className={inputClass} type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} required />
                    </label>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <label className="grid gap-2 font-semibold text-sm">
                      Expected Attendees *
                      <input className={inputClass} type="number" name="expectedAttendees" value={formData.expectedAttendees} onChange={handleChange} placeholder="e.g., 200" required />
                    </label>
                    <label className="grid gap-2 font-semibold text-sm">
                      Location (City, State) *
                      <input className={inputClass} type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g., Baltimore, MD" required />
                    </label>
                  </div>

                  <label className="grid gap-2 font-semibold text-sm">
                    Additional Information
                    <textarea className={`${inputClass} min-h-32`} name="additionalInfo" value={formData.additionalInfo} onChange={handleChange} placeholder="Tell us about your event, specific book interests, budget considerations, or any special requirements..." />
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-shine flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-4 font-semibold text-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Sending...
                      </>
                    ) : (
                      'Submit Event Request'
                    )}
                  </button>

                  <p className="text-xs text-center text-muted">
                    We typically require 4-6 weeks advance notice for events. Rush requests may be accommodated based on availability.
                  </p>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="relative py-14 sm:py-20 bg-gradient-to-br from-emerald-50 to-blue-50">
          <div ref={whyReveal} className="reveal mx-auto w-11/12 max-w-4xl">
            <div className="rounded-3xl bg-white p-6 sm:p-10 shadow-soft text-center">
              <h2 className="font-display text-2xl sm:text-3xl">Why Partner With Eduvate Kids?</h2>
              <div ref={whyGridReveal} className="reveal-stagger mt-8 grid gap-6 md:grid-cols-3 text-left">
                {whyPartner.map((item) => (
                  <div key={item.title} className="card-hover rounded-2xl bg-cream p-6 hover:-translate-y-1 hover:shadow-soft">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primaryDark">
                      {item.icon}
                    </div>
                    <h3 className="mt-3 font-semibold text-primaryDark">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <a href="https://wa.me/c/16674377777" target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 rounded-full border border-green-500 bg-green-50 px-8 py-3 font-semibold text-green-700 transition-all duration-300 hover:-translate-y-1 hover:bg-green-100">
                  <WhatsAppIcon />
                  Questions? Chat with us on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooterFull />
    </div>
  )
}
