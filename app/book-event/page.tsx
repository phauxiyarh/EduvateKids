'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import logo from '../../assets/logo.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'
import bg1 from '../../assets/bg1.png'

const eventTypes = [
  {
    title: 'School Book Fairs',
    icon: '🏫',
    description: 'Bring the joy of reading to your school with a curated selection of Islamic books, educational materials, and learning kits.',
    features: ['Age-appropriate selections', 'Custom pricing tiers', 'On-site setup and support', 'Digital catalog access']
  },
  {
    title: 'Masjid Events',
    icon: '🕌',
    description: 'Perfect for Ramadan bazaars, Eid celebrations, and community fundraisers with Islamic literature and resources.',
    features: ['Fundraising opportunities', 'Community-focused titles', 'Flexible payment options', 'Extended online ordering']
  },
  {
    title: 'Educational Conferences',
    icon: '🎓',
    description: 'Showcase the latest in Islamic education at your conference or professional development event.',
    features: ['Teacher resources', 'Bulk discounts available', 'Professional display setup', 'Presenter materials']
  },
  {
    title: 'Community Gatherings',
    icon: '🎪',
    description: 'From family days to literacy events, we bring books and learning materials to your community.',
    features: ['Custom event packages', 'Interactive displays', 'Gift wrapping available', 'Multi-language options']
  }
]

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Form submission logic would go here
    console.log('Event booking request:', formData)
    alert('Thank you for your interest! We will contact you within 1-2 business days.')
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
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-6 py-2">
          <Link className="flex items-center gap-3" href="/">
            <Image src={logo} alt="Eduvate Kids logo" width={32} height={32} />
            <span className="flex flex-col">
              <span className="font-display text-lg font-bold">Eduvate Kids</span>
              <span className="text-sm text-muted">Islamic Bookstore</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-muted md:flex">
            <Link className="hover:text-primaryDark" href="/">
              Home
            </Link>
            <Link className="hover:text-primaryDark" href="/contact-us">
              Contact
            </Link>
          </nav>
          <Link
            className="flex items-center gap-2 rounded-full border border-primary/30 bg-white px-5 py-2 text-sm font-semibold text-primaryDark shadow-sm transition hover:-translate-y-0.5"
            href="/auth/login"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Admin Login
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
              key={`event-design-${index}`}
              src={index % 2 === 0 ? design1 : design2}
              alt=""
              width={160}
              height={160}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 ${classes}`}
            />
          ))}
          <div className="relative z-10 mx-auto w-11/12 max-w-4xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
              Partner With Us
            </p>
            <h1 className="mt-4 font-display text-5xl">Book an Event</h1>
            <p className="mt-4 text-lg text-muted">
              Bring Eduvate Kids to your school, masjid, or community event. We provide
              carefully curated Islamic books and educational materials with complete setup
              and support.
            </p>
          </div>
        </section>

        <section className="relative py-16 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="mx-auto w-11/12 max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl">Event Types We Support</h2>
              <p className="mt-3 text-muted">
                Choose the perfect format for your community
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {eventTypes.map((event) => (
                <div
                  key={event.title}
                  className="rounded-3xl bg-white p-8 shadow-soft border border-primary/10 transition hover:-translate-y-1"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 text-3xl">
                      {event.icon}
                    </div>
                    <h3 className="font-display text-2xl gradient-text">{event.title}</h3>
                  </div>
                  <p className="mt-4 text-muted leading-relaxed">{event.description}</p>
                  <ul className="mt-4 space-y-2">
                    {event.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <span className="text-primary">✦</span>
                        <span className="text-muted">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative py-16 bg-white">
          <div className="mx-auto w-11/12 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl">Request an Event</h2>
              <p className="mt-3 text-muted">
                Fill out the form below and we'll contact you within 1-2 business days to
                discuss your event needs.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="rounded-3xl bg-cream p-8 shadow-soft border border-primary/10">
              <div className="grid gap-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <label className="grid gap-2 font-semibold text-sm">
                    Organization Name *
                    <input
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 font-normal"
                      type="text"
                      name="organizationName"
                      value={formData.organizationName}
                      onChange={handleChange}
                      placeholder="Your School/Masjid/Organization"
                      required
                    />
                  </label>
                  <label className="grid gap-2 font-semibold text-sm">
                    Contact Name *
                    <input
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 font-normal"
                      type="text"
                      name="contactName"
                      value={formData.contactName}
                      onChange={handleChange}
                      placeholder="Your Full Name"
                      required
                    />
                  </label>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <label className="grid gap-2 font-semibold text-sm">
                    Email Address *
                    <input
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 font-normal"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="email@example.com"
                      required
                    />
                  </label>
                  <label className="grid gap-2 font-semibold text-sm">
                    Phone Number *
                    <input
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 font-normal"
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="(555) 123-4567"
                      required
                    />
                  </label>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <label className="grid gap-2 font-semibold text-sm">
                    Event Type *
                    <select
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 font-normal"
                      name="eventType"
                      value={formData.eventType}
                      onChange={handleChange}
                      required
                    >
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
                    <input
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 font-normal"
                      type="date"
                      name="eventDate"
                      value={formData.eventDate}
                      onChange={handleChange}
                      required
                    />
                  </label>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <label className="grid gap-2 font-semibold text-sm">
                    Expected Attendees *
                    <input
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 font-normal"
                      type="number"
                      name="expectedAttendees"
                      value={formData.expectedAttendees}
                      onChange={handleChange}
                      placeholder="e.g., 200"
                      required
                    />
                  </label>
                  <label className="grid gap-2 font-semibold text-sm">
                    Location (City, State) *
                    <input
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 font-normal"
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="e.g., Baltimore, MD"
                      required
                    />
                  </label>
                </div>

                <label className="grid gap-2 font-semibold text-sm">
                  Additional Information
                  <textarea
                    className="rounded-xl border border-black/10 bg-white px-4 py-3 font-normal min-h-32"
                    name="additionalInfo"
                    value={formData.additionalInfo}
                    onChange={handleChange}
                    placeholder="Tell us about your event, specific book interests, budget considerations, or any special requirements..."
                  />
                </label>

                <button
                  type="submit"
                  className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-4 font-semibold text-white shadow-soft transition hover:-translate-y-1 hover:shadow-lg"
                >
                  Submit Event Request
                </button>

                <p className="text-xs text-center text-muted">
                  We typically require 4-6 weeks advance notice for events. Rush requests may be accommodated based on availability.
                </p>
              </div>
            </form>
          </div>
        </section>

        <section className="relative py-16 bg-gradient-to-br from-emerald-50 to-blue-50">
          <div className="mx-auto w-11/12 max-w-4xl">
            <div className="rounded-3xl bg-white p-10 shadow-soft text-center">
              <h2 className="font-display text-3xl">Why Partner With Eduvate Kids?</h2>
              <div className="mt-8 grid gap-6 md:grid-cols-3 text-left">
                <div className="rounded-2xl bg-cream p-6">
                  <div className="text-3xl mb-3">📚</div>
                  <h3 className="font-semibold text-primaryDark">Curated Selection</h3>
                  <p className="mt-2 text-sm text-muted">
                    Hand-picked Islamic books and educational materials appropriate for all ages.
                  </p>
                </div>
                <div className="rounded-2xl bg-cream p-6">
                  <div className="text-3xl mb-3">🤝</div>
                  <h3 className="font-semibold text-primaryDark">Full Support</h3>
                  <p className="mt-2 text-sm text-muted">
                    Complete setup, on-site assistance, and post-event online ordering options.
                  </p>
                </div>
                <div className="rounded-2xl bg-cream p-6">
                  <div className="text-3xl mb-3">💰</div>
                  <h3 className="font-semibold text-primaryDark">Flexible Options</h3>
                  <p className="mt-2 text-sm text-muted">
                    Fundraising opportunities, bulk discounts, and custom pricing for your community.
                  </p>
                </div>
              </div>
              <div className="mt-8">
                <a
                  href="https://wa.me/c/16674377777"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-3 rounded-full border border-green-500 bg-green-50 px-8 py-3 font-semibold text-green-700 transition hover:-translate-y-1"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Questions? Chat with us on WhatsApp
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
