'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { EventNavDropdown } from '../components/EventNavDropdown'
import logo from '../../assets/logo.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'
import bg2 from '../../assets/bg2.png'

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

type PolicyIcon = 'privacy' | 'returns' | 'shipping' | 'terms'

const PolicyGlyph = ({ name, className = 'h-6 w-6 sm:h-7 sm:w-7' }: { name: PolicyIcon; className?: string }) => {
  switch (name) {
    case 'privacy':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.5 12.5v-1.5a2.5 2.5 0 015 0v1.5M8.75 12.5h6.5v3.5h-6.5z" />
        </svg>
      )
    case 'returns':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
      )
    case 'shipping':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      )
    case 'terms':
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 4h6l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 4v4h4M9.5 13h5M9.5 16h5" />
        </svg>
      )
  }
}

const policies: {
  id: string
  title: string
  icon: PolicyIcon
  sections: { heading: string; content: string }[]
}[] = [
  {
    id: 'privacy',
    title: 'Privacy Policy',
    icon: 'privacy',
    sections: [
      {
        heading: 'Information We Collect',
        content: 'We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This may include your name, email address, shipping address, and payment information.'
      },
      {
        heading: 'How We Use Your Information',
        content: 'We use the information we collect to process your orders, communicate with you, improve our services, and provide you with updates about new products and events.'
      },
      {
        heading: 'Data Security',
        content: 'We implement appropriate security measures to protect your personal information from unauthorized access, alteration, or disclosure. Your payment information is processed securely through encrypted channels.'
      },
      {
        heading: 'Sharing of Information',
        content: 'We do not sell or rent your personal information to third parties. We may share information with service providers who help us operate our business, but only to the extent necessary.'
      }
    ]
  },
  {
    id: 'returns',
    title: 'Return & Refund Policy',
    icon: 'returns',
    sections: [
      {
        heading: 'Return Window',
        content: 'Items may be returned within 14 days of purchase in their original condition with all packaging intact. Books must be unmarked and unread to qualify for a return.'
      },
      {
        heading: 'Refund Process',
        content: 'Refunds will be processed to the original payment method within 5-7 business days after we receive and inspect the returned items. Shipping costs are non-refundable unless the return is due to our error.'
      },
      {
        heading: 'Event Sales',
        content: 'Items purchased at book fairs or community events follow the same return policy. Please contact us within 14 days of the event date to arrange a return.'
      },
      {
        heading: 'Damaged Items',
        content: 'If you receive a damaged item, please contact us immediately with photos. We will arrange a replacement or full refund, including shipping costs.'
      }
    ]
  },
  {
    id: 'shipping',
    title: 'Shipping Policy',
    icon: 'shipping',
    sections: [
      {
        heading: 'Processing Time',
        content: 'Orders are typically processed within 1-2 business days. During peak seasons and special events, processing may take up to 3-5 business days.'
      },
      {
        heading: 'Shipping Methods',
        content: 'We offer standard shipping (5-7 business days) and expedited shipping (2-3 business days). Free standard shipping is available on orders over $50 within the continental United States.'
      },
      {
        heading: 'Event Delivery',
        content: 'For school book fairs and community events, we coordinate delivery directly with event organizers. Items are typically delivered 1-2 days before the event start date.'
      },
      {
        heading: 'International Shipping',
        content: 'We currently ship to select international destinations. Shipping times and costs vary by location. Additional customs fees may apply and are the responsibility of the customer.'
      }
    ]
  },
  {
    id: 'terms',
    title: 'Terms of Service',
    icon: 'terms',
    sections: [
      {
        heading: 'Account Responsibilities',
        content: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Please notify us immediately of any unauthorized use.'
      },
      {
        heading: 'Product Availability',
        content: 'We strive to keep our inventory current, but products may become unavailable. We reserve the right to limit quantities and discontinue products at any time.'
      },
      {
        heading: 'Pricing',
        content: 'All prices are in USD and subject to change without notice. We reserve the right to correct pricing errors and may cancel orders placed at incorrect prices.'
      },
      {
        heading: 'Intellectual Property',
        content: 'All content on our website, including text, images, logos, and designs, is the property of Eduvate Kids or our content suppliers and is protected by copyright laws.'
      }
    ]
  }
]

type NavItem = { label: string; href: string; icon: string; active?: boolean }

// Nav items before the "Event" dropdown
const navItemsBefore: NavItem[] = [
  { label: 'Home', href: '/', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10' },
  { label: 'Our Products', href: '/catalog', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }
]

// Nav items after the "Event" dropdown
const navItemsAfter: NavItem[] = [
  { label: 'Contact', href: '/contact-us', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z' },
  { label: 'FAQs', href: '/faqs', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
]

export default function PoliciesPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const sectionReveal = useReveal<HTMLDivElement>()

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
          <nav className="hidden items-center gap-1 md:flex">
            {navItemsBefore.map((item) => (
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
            {navItemsAfter.map((item) => (
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
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex md:hidden h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-white/70 text-primaryDark backdrop-blur transition hover:bg-primary/5 active:scale-95"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="animate-slideDown md:hidden border-t border-primary/10 bg-white/95 backdrop-blur-xl shadow-lg">
            <nav className="mx-auto w-11/12 max-w-6xl flex flex-col py-3 gap-1">
              {navItemsBefore.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] ${
                    item.active
                      ? 'bg-gradient-to-r from-primary to-secondary text-white'
                      : 'bg-primary/5 text-primaryDark hover:bg-primary/10'
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              ))}
              <p className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Event</p>
              <Link href="/summer-reads" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] bg-primary/5 text-primaryDark hover:bg-primary/10">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                <span>Summer Reads</span>
              </Link>
              <Link href="/book-event" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] bg-primary/5 text-primaryDark hover:bg-primary/10">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>Book Event</span>
              </Link>
              {navItemsAfter.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] ${
                    item.active
                      ? 'bg-gradient-to-r from-primary to-secondary text-white'
                      : 'bg-primary/5 text-primaryDark hover:bg-primary/10'
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden pb-10 sm:pb-16 pt-24 sm:pt-32">
          <div
            className="hero-svg-bg absolute inset-0 z-0 opacity-20"
            style={{
              backgroundImage: `url(${bg2.src})`,
              backgroundSize: '75% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          {[
            'left-10 top-12 h-20 w-20 opacity-30',
            'right-16 top-20 h-28 w-28 opacity-20',
            'left-1/4 top-64 h-24 w-24 opacity-25',
            'right-1/3 top-48 h-16 w-16 opacity-30'
          ].map((classes, index) => (
            <Image
              key={`policy-design-${index}`}
              src={index % 2 === 0 ? design1 : design2}
              alt=""
              width={160}
              height={160}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 hidden md:block ${classes}`}
            />
          ))}
          <div className="reveal is-visible relative z-10 mx-auto w-11/12 max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-accentThree backdrop-blur">
              Legal Information
            </span>
            <h1 className="mt-4 font-display text-3xl sm:text-5xl">
              Policies &amp; <span className="gradient-text">Terms</span>
            </h1>
            <p className="mt-3 text-sm font-medium text-muted/80">Last updated: June 2026</p>
            <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
              We believe in transparency and trust. Review our policies to understand
              how we protect your privacy and ensure a great shopping experience.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
              {policies.map((policy) => (
                <a
                  key={`jump-${policy.id}`}
                  href={`#${policy.id}`}
                  className="group inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-4 py-2 text-sm font-semibold text-primaryDark shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white"
                >
                  <PolicyGlyph name={policy.icon} className="h-4 w-4" />
                  {policy.title}
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="relative py-14 sm:py-16">
          <div ref={sectionReveal} className="reveal reveal-stagger mx-auto w-11/12 max-w-5xl space-y-5 sm:space-y-6">
            {policies.map((policy, policyIndex) => {
              const isOpen = openIndex === policyIndex
              const panelId = `policy-panel-${policy.id}`
              const buttonId = `policy-button-${policy.id}`
              return (
                <div
                  key={policy.title}
                  id={policy.id}
                  className="scroll-mt-28 overflow-hidden rounded-3xl border border-primary/10 bg-white shadow-soft transition-shadow duration-300 hover:shadow-[0_18px_44px_rgba(124,58,237,0.12)]"
                >
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : policyIndex)}
                    className="flex w-full items-center gap-3 sm:gap-4 p-5 sm:p-6 text-left transition-colors duration-200 hover:bg-primary/[0.03]"
                  >
                    <span className="flex h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primaryDark">
                      <PolicyGlyph name={policy.icon} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-display text-xl sm:text-2xl gradient-text">{policy.title}</span>
                      <span className="mt-0.5 block text-xs sm:text-sm text-muted">
                        {policy.sections.length} sections
                      </span>
                    </span>
                    <svg
                      className={`h-6 w-6 flex-shrink-0 text-primaryDark transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={`grid transition-all duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-6 border-t border-primary/10 px-5 sm:px-6 pb-6 pt-5">
                        {policy.sections.map((section, sectionIndex) => (
                          <div key={sectionIndex}>
                            <h3 className="text-lg font-semibold text-primaryDark">
                              {section.heading}
                            </h3>
                            <p className="mt-2 text-muted leading-relaxed">
                              {section.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="relative py-16 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="mx-auto w-11/12 max-w-4xl text-center">
            <h2 className="font-display text-2xl sm:text-3xl">Questions About Our Policies?</h2>
            <p className="mt-3 text-muted">
              We&apos;re here to help. Reach out to our team if you need clarification
              on any of our policies or have specific concerns.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/contact-us"
                className="btn-shine rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 font-semibold text-white shadow-soft transition-all duration-300 hover:-translate-y-0.5"
              >
                Contact Us
              </Link>
              <Link
                href="/faqs"
                className="rounded-full border border-primary px-8 py-3 font-semibold text-primaryDark transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/5"
              >
                View FAQs
              </Link>
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
              <Link href="/catalog" className="text-white/70 transition-colors hover:text-white">Our Products</Link>
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
          <div className="mt-6 border-t border-white/10 pt-6 text-center text-sm text-white/50">
            <p>&copy; 2026 Eduvate Kids. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
