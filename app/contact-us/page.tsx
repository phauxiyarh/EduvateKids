'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { EventNavDropdown } from '../components/EventNavDropdown'
import { HeaderCart } from '../components/HeaderCart'
import logo from '../../assets/logo.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'
import bg1 from '../../assets/bg1.png'

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

export default function ContactUsPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const infoReveal = useReveal<HTMLDivElement>()
  const formReveal = useReveal<HTMLDivElement>()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      // Save contact message to Firestore
      await addDoc(collection(db, 'contactMessages'), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || '',
        subject: formData.subject,
        message: formData.message,
        status: 'unread',
        createdAt: serverTimestamp()
      })

      setSubmitted(true)
      // Clear form
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      })
    } catch (error) {
      console.error('Error submitting contact form:', error)
      setError('There was an error sending your message. Please try again or contact us via WhatsApp.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const inputClass =
    'rounded-xl border border-black/10 bg-cream px-4 py-3 font-normal outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30'

  return (
    <div className="min-h-screen text-ink">
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)] backdrop-blur-xl">
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
              { label: 'Our Catalogue', href: '/catalog', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', active: false }
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 ${
                  item.active
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                    : 'bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            ))}
            <EventNavDropdown />
            {[
              { label: 'Contact', href: '/contact-us', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z', active: true },
              { label: 'FAQs', href: '/faqs', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', active: false }
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 ${
                  item.active
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                    : 'bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
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
        <section className="relative overflow-hidden pb-10 sm:pb-16 pt-24 sm:pt-32">
          <div
            className="hero-svg-bg absolute inset-0 z-0 opacity-15"
            style={{
              backgroundImage: `url(${bg1.src})`,
              backgroundSize: '70% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          {[
            'left-16 top-16 h-24 w-24 opacity-25',
            'right-20 top-24 h-32 w-32 opacity-20',
            'left-1/3 top-56 h-20 w-20 opacity-30',
            'right-1/4 top-40 h-28 w-28 opacity-25'
          ].map((classes, index) => (
            <Image
              key={`contact-design-${index}`}
              src={index % 2 === 0 ? design1 : design2}
              alt=""
              width={160}
              height={160}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 hidden md:block ${classes}`}
            />
          ))}
          <div className="reveal is-visible relative z-10 mx-auto w-11/12 max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-accentThree backdrop-blur">
              Get In Touch
            </span>
            <h1 className="mt-4 font-display text-3xl sm:text-5xl">
              Contact <span className="gradient-text">Us</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
              Have questions about our books, events, or services? We&apos;d love to hear from you.
              Reach out and we&apos;ll get back to you within 1 business day.
            </p>
          </div>
        </section>

        <section className="relative py-14 sm:py-20 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="mx-auto w-11/12 max-w-5xl">
            <div className="grid gap-8 md:grid-cols-2">
              <div ref={infoReveal} className="reveal space-y-6">
                <div className="card-hover rounded-3xl bg-white p-5 sm:p-8 shadow-soft border border-primary/10 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(124,58,237,0.12)]">
                  <div className="flex items-center gap-3 sm:gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primaryDark">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <h3 className="font-display text-xl gradient-text">Location</h3>
                  </div>
                  <p className="text-muted">Maryland, USA</p>
                  <p className="mt-2 text-sm text-muted">
                    Serving families, schools, and communities with Islamic educational resources
                    across North America.
                  </p>
                </div>

                <div className="card-hover rounded-3xl bg-white p-5 sm:p-8 shadow-soft border border-primary/10 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(124,58,237,0.12)]">
                  <div className="flex items-center gap-3 sm:gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accentThree/20 to-primary/20 text-primaryDark">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /></svg>
                    </div>
                    <h3 className="font-display text-xl gradient-text">Quick Response</h3>
                  </div>
                  <p className="text-muted">
                    We typically respond within 1 business day. For urgent inquiries, reach out via
                    WhatsApp for faster assistance.
                  </p>
                  <a
                    href="https://wa.me/c/16674377777"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-500 bg-green-50 px-6 py-3 font-semibold text-green-700 transition-all duration-300 hover:-translate-y-1 hover:bg-green-100"
                  >
                    <WhatsAppIcon />
                    Chat on WhatsApp
                  </a>
                </div>

                <div className="card-hover rounded-3xl bg-white p-5 sm:p-8 shadow-soft border border-primary/10 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(124,58,237,0.12)]">
                  <div className="flex items-center gap-3 sm:gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20 text-primaryDark">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <h3 className="font-display text-xl gradient-text">What We Can Help With</h3>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {[
                      'Book recommendations for your child',
                      'School and masjid event bookings',
                      'Bulk orders and special pricing',
                      'Product availability inquiries',
                      'Partnership opportunities',
                      'General questions about our services'
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        <span className="text-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div ref={formReveal} className="reveal flex justify-center">
                <div className="w-full">
                  {submitted ? (
                    <div className="animate-fadeIn rounded-3xl bg-gradient-to-br from-emerald-50 to-green-50 p-8 sm:p-10 shadow-soft border border-emerald-200 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <h3 className="mt-5 font-display text-2xl gradient-text">Message Sent!</h3>
                      <p className="mt-3 text-muted">
                        Thank you for reaching out. We&apos;ll get back to you within 1 business day.
                      </p>
                      <button type="button" onClick={() => setSubmitted(false)} className="mt-6 rounded-full border border-primary/30 bg-white px-6 py-3 text-sm font-semibold text-primaryDark transition hover:-translate-y-0.5 hover:bg-primary/5">
                        Send another message
                      </button>
                    </div>
                  ) : (
                  <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-5 sm:p-8 shadow-soft border border-primary/10">
                    <h3 className="font-display text-2xl gradient-text mb-6">Send Us a Message</h3>
                    <div className="grid gap-5">
                      {error && (
                        <div className="animate-slideDown flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                          <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
                          <span>{error}</span>
                        </div>
                      )}
                      <label className="grid gap-2 font-semibold text-sm">
                        Name *
                        <input
                          className={inputClass}
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Your full name"
                          required
                        />
                      </label>

                      <label className="grid gap-2 font-semibold text-sm">
                        Email *
                        <input
                          className={inputClass}
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="your@email.com"
                          required
                        />
                      </label>

                      <label className="grid gap-2 font-semibold text-sm">
                        Phone (Optional)
                        <input
                          className={inputClass}
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="(555) 123-4567"
                        />
                      </label>

                      <label className="grid gap-2 font-semibold text-sm">
                        Subject *
                        <select
                          className={inputClass}
                          name="subject"
                          value={formData.subject}
                          onChange={handleChange}
                          required
                        >
                          <option value="">Select a subject</option>
                          <option value="general">General Inquiry</option>
                          <option value="recommendation">Book Recommendation</option>
                          <option value="event">Event Booking</option>
                          <option value="bulk">Bulk Order</option>
                          <option value="partnership">Partnership Opportunity</option>
                          <option value="other">Other</option>
                        </select>
                      </label>

                      <label className="grid gap-2 font-semibold text-sm">
                        Message *
                        <textarea
                          className={`${inputClass} min-h-36`}
                          name="message"
                          value={formData.message}
                          onChange={handleChange}
                          placeholder="Tell us how we can help you..."
                          required
                        />
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
                          'Send Message'
                        )}
                      </button>

                      <p className="text-xs text-center text-muted">
                        We respect your privacy and will never share your information with third parties.
                      </p>
                    </div>
                  </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-16 bg-white">
          <div className="mx-auto w-11/12 max-w-5xl">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-blue-50 p-6 sm:p-10 text-center">
              <h2 className="font-display text-2xl sm:text-3xl">Looking for Something Specific?</h2>
              <p className="mt-3 text-muted">
                Explore our resources or book an event with us.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/faqs"
                  className="rounded-full border border-primary bg-white px-8 py-3 font-semibold text-primaryDark shadow-sm transition hover:-translate-y-1"
                >
                  Browse FAQs
                </Link>
                <Link
                  href="/book-event"
                  className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 font-semibold text-white shadow-soft transition hover:-translate-y-1"
                >
                  Book an Event
                </Link>
                <a
                  href="https://wa.me/c/16674377777"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-green-500 bg-green-50 px-8 py-3 font-semibold text-green-700 transition hover:-translate-y-1"
                >
                  View Digital Catalog
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] py-10 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="mx-auto w-11/12 max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" className="flex items-center gap-3">
              <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} />
              <span className="font-display text-lg font-bold">Eduvate Kids</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <Link href="/" className="text-white/70 transition-colors hover:text-white">Home</Link>
              <Link href="/catalog" className="text-white/70 transition-colors hover:text-white">Our Catalogue</Link>
              <Link href="/book-event" className="text-white/70 transition-colors hover:text-white">Book Event</Link>
              <Link href="/contact-us" className="text-white/70 transition-colors hover:text-white">Contact</Link>
              <Link href="/faqs" className="text-white/70 transition-colors hover:text-white">FAQs</Link>
              <Link href="/policies" className="text-white/70 transition-colors hover:text-white">Policies</Link>
            </div>
          </div>
          <div className="mt-8 flex justify-center">
            <Link href="/auth/login" aria-label="Admin Login" className="group inline-flex items-center justify-center rounded-full p-2 text-white/30 transition-all duration-300 hover:bg-white/5 hover:text-white/80">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.418-3.03 7.79-7 9-3.97-1.21-7-4.582-7-9V7l7-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.75 1.75L15 10" />
              </svg>
            </Link>
          </div>
          <div className="mt-8 border-t border-white/10 pt-6 text-center text-sm text-white/50">
            <p>&copy; 2026 Eduvate Kids. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
