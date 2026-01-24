'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import logo from '../../assets/logo.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'
import bg1 from '../../assets/bg1.png'

export default function ContactUsPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Form submission logic would go here
    console.log('Contact form submitted:', formData)
    alert('Thank you for reaching out! We will get back to you within 1 business day.')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen text-ink">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-6 py-4">
          <Link className="flex items-center gap-3" href="/">
            <Image src={logo} alt="Eduvate Kids logo" width={16} height={16} />
            <span className="flex flex-col">
              <span className="font-display text-lg font-bold">Eduvate Kids</span>
              <span className="text-sm text-muted">Islamic Bookstore</span>
            </span>
          </Link>
          <Link
            className="rounded-full border border-primary/30 bg-white px-5 py-2 text-sm font-semibold text-primaryDark shadow-sm transition hover:-translate-y-0.5"
            href="/"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden pb-16 pt-32">
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
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 ${classes}`}
            />
          ))}
          <div className="relative z-10 mx-auto w-11/12 max-w-4xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
              Get In Touch
            </p>
            <h1 className="mt-4 font-display text-5xl">Contact Us</h1>
            <p className="mt-4 text-lg text-muted">
              Have questions about our books, events, or services? We'd love to hear from you.
              Reach out and we'll get back to you within 1 business day.
            </p>
          </div>
        </section>

        <section className="relative py-16 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="mx-auto w-11/12 max-w-5xl">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-6">
                <div className="rounded-3xl bg-white p-8 shadow-soft border border-primary/10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-2xl">
                      📍
                    </div>
                    <h3 className="font-display text-xl gradient-text">Location</h3>
                  </div>
                  <p className="text-muted">Maryland, USA</p>
                  <p className="mt-2 text-sm text-muted">
                    Serving families, schools, and communities with Islamic educational resources
                    across North America.
                  </p>
                </div>

                <div className="rounded-3xl bg-white p-8 shadow-soft border border-primary/10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accentThree/20 to-primary/20 text-2xl">
                      💬
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
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-500 bg-green-50 px-6 py-3 font-semibold text-green-700 transition hover:-translate-y-1"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    Chat on WhatsApp
                  </a>
                </div>

                <div className="rounded-3xl bg-white p-8 shadow-soft border border-primary/10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20 text-2xl">
                      📚
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
                        <span className="text-primary">✦</span>
                        <span className="text-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-full">
                  <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-8 shadow-soft border border-primary/10">
                    <h3 className="font-display text-2xl gradient-text mb-6">Send Us a Message</h3>
                    <div className="grid gap-5">
                      <label className="grid gap-2 font-semibold text-sm">
                        Name *
                        <input
                          className="rounded-xl border border-black/10 bg-cream px-4 py-3 font-normal"
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
                          className="rounded-xl border border-black/10 bg-cream px-4 py-3 font-normal"
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
                          className="rounded-xl border border-black/10 bg-cream px-4 py-3 font-normal"
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
                          className="rounded-xl border border-black/10 bg-cream px-4 py-3 font-normal"
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
                          className="rounded-xl border border-black/10 bg-cream px-4 py-3 font-normal min-h-36"
                          name="message"
                          value={formData.message}
                          onChange={handleChange}
                          placeholder="Tell us how we can help you..."
                          required
                        />
                      </label>

                      <button
                        type="submit"
                        className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-4 font-semibold text-white shadow-soft transition hover:-translate-y-1 hover:shadow-lg"
                      >
                        Send Message
                      </button>

                      <p className="text-xs text-center text-muted">
                        We respect your privacy and will never share your information with third parties.
                      </p>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-16 bg-white">
          <div className="mx-auto w-11/12 max-w-5xl">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-blue-50 p-10 text-center">
              <h2 className="font-display text-3xl">Looking for Something Specific?</h2>
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

      <footer className="bg-[#1f1b2e] py-8 text-white">
        <div className="mx-auto w-11/12 max-w-6xl text-center text-sm text-white/70">
          <p>&copy; 2026 Eduvate Kids. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
