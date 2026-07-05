'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { EventNavDropdown } from '../components/EventNavDropdown'
import { HeaderCart } from '../components/HeaderCart'
import logo from '../../assets/logo.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'
import bg1 from '../../assets/bg1.png'

type IconProps = { className?: string }

const ShippingIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7.5h11v9H3zM14 10.5h4l3 3v3h-7z" />
    <circle cx="7" cy="18" r="1.6" strokeWidth={1.8} />
    <circle cx="17.5" cy="18" r="1.6" strokeWidth={1.8} />
  </svg>
)

const BookIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.5C10.5 5.3 8.5 4.8 6 4.8c-.9 0-1.7.1-2.5.3v13c.8-.2 1.6-.3 2.5-.3 2.5 0 4.5.5 6 1.7 1.5-1.2 3.5-1.7 6-1.7.9 0 1.7.1 2.5.3v-13c-.8-.2-1.6-.3-2.5-.3-2.5 0-4.5.5-6 1.7zM12 6.5v12.3" />
  </svg>
)

const ReturnIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14 4 9l5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 9h9a7 7 0 0 1 7 7v3" />
  </svg>
)

const EventIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" strokeWidth={1.8} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
)

const PaymentIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" strokeWidth={1.8} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h4" />
  </svg>
)

const faqCategories = [
  {
    category: 'Orders & Shipping',
    Icon: ShippingIcon,
    faqs: [
      {
        question: 'How long does shipping take?',
        answer: 'Standard shipping typically takes 5-7 business days within the continental United States. Expedited shipping (2-3 business days) is available at checkout. Orders are processed within 1-2 business days, though this may extend to 3-5 days during peak seasons.'
      },
      {
        question: 'Do you offer free shipping?',
        answer: 'Yes! We offer free standard shipping on all orders over $80 within the continental United States. For orders under $80, a flat standard shipping fee of $5.99 applies. Applicable sales tax is calculated at checkout.'
      },
      {
        question: 'Can I track my order?',
        answer: 'Absolutely! Once your order ships, you will receive a tracking number via email. You can use this number to track your package on the carrier\'s website.'
      },
      {
        question: 'Do you ship internationally?',
        answer: 'We ship to select international destinations. Shipping times and costs vary by location. Please note that customers are responsible for any customs fees or import duties.'
      }
    ]
  },
  {
    category: 'Products & Inventory',
    Icon: BookIcon,
    faqs: [
      {
        question: 'How do I know if a book is age-appropriate?',
        answer: 'Each product listing includes an age recommendation. We carefully curate our collection to ensure content is appropriate for the suggested age ranges. If you need personalized recommendations, feel free to contact us!'
      },
      {
        question: 'Can I request a specific book that\'s not in stock?',
        answer: 'Yes! We\'re happy to help you find specific titles. Contact us with the book details, and we\'ll do our best to source it for you or suggest similar alternatives.'
      },
      {
        question: 'Are your books available in different languages?',
        answer: 'We carry books in English and Arabic, as well as bilingual editions. Our collection includes Islamic literature, Arabic learning resources, and character-building stories in multiple languages.'
      },
      {
        question: 'Do you offer bulk discounts for schools or masajid?',
        answer: 'Yes! We offer special pricing for schools, masajid, and community organizations placing bulk orders. Please contact us directly to discuss your needs and receive a custom quote.'
      }
    ]
  },
  {
    category: 'Returns & Exchanges',
    Icon: ReturnIcon,
    faqs: [
      {
        question: 'What is your return policy?',
        answer: 'Items may be returned within 14 days of purchase in their original condition. Books must be unmarked and unread. Refunds are processed within 5-7 business days of receiving the returned items.'
      },
      {
        question: 'How do I initiate a return?',
        answer: 'Contact us via email or phone with your order number and reason for return. We\'ll provide you with a return authorization and shipping instructions.'
      },
      {
        question: 'Can I exchange an item instead of returning it?',
        answer: 'Yes! If you\'d like to exchange an item for a different product, let us know when you initiate the return. We\'ll help facilitate the exchange process.'
      },
      {
        question: 'What if I receive a damaged item?',
        answer: 'We apologize if that happens! Please contact us immediately with photos of the damage. We\'ll arrange a replacement or full refund, including shipping costs, at no charge to you.'
      }
    ]
  },
  {
    category: 'Events & Book Fairs',
    Icon: EventIcon,
    faqs: [
      {
        question: 'How do I book Eduvate Kids for a school event?',
        answer: 'Contact us at least 4-6 weeks before your event date. We\'ll discuss your needs, student demographics, budget, and event logistics to create a customized book fair experience.'
      },
      {
        question: 'What types of events do you support?',
        answer: 'We support school book fairs, masjid fundraisers, community literacy events, Ramadan bazaars, and educational conferences. Each event is tailored to your audience and goals.'
      },
      {
        question: 'Is there a minimum order for events?',
        answer: 'Event requirements vary based on the type and size of your gathering. Contact us to discuss your specific needs, and we\'ll work with you to create a suitable arrangement.'
      },
      {
        question: 'Can families order online after the event?',
        answer: 'Yes! We often extend event pricing for a limited time after the fair, allowing families to order online. We\'ll provide details during your event planning.'
      }
    ]
  },
  {
    category: 'Account & Payment',
    Icon: PaymentIcon,
    faqs: [
      {
        question: 'Do I need an account to place an order?',
        answer: 'No account is needed. You can check out as a guest by entering your shipping and payment details at checkout. You will receive an order confirmation by email.'
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover) via secure Stripe checkout. Orders are shipped to the address provided once payment is confirmed. Additional payment options are being added.'
      },
      {
        question: 'Is my payment information secure?',
        answer: 'Absolutely. We use industry-standard SSL encryption to protect your payment information. We do not store your full credit card details on our servers.'
      },
      {
        question: 'Can I modify my order after placing it?',
        answer: 'Orders can be modified within 24 hours of placement if they haven\'t been shipped yet. Contact us as soon as possible, and we\'ll do our best to accommodate your request.'
      }
    ]
  }
]

// Nav items before the "Event" dropdown
const navLinksBefore = [
  { label: 'Home', href: '/', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10' },
  { label: 'Our Catalogue', href: '/catalog', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }
]

// Nav items after the "Event" dropdown
const navLinksAfter = [
  { label: 'Contact', href: '/contact-us', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z' },
  { label: 'FAQs', href: '/faqs', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
]

function useReveal() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.reveal'))
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible'))
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
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])
}

export default function FAQsPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useReveal()

  const toggleFAQ = (categoryIndex: number, faqIndex: number) => {
    const key = `${categoryIndex}-${faqIndex}`
    setOpenIndex(openIndex === key ? null : key)
  }

  return (
    <div className="min-h-screen text-ink">
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)] backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-3 sm:gap-6 py-2.5">
          <Link className="group flex items-center gap-2 sm:gap-3 min-w-0" href="/">
            <Image
              src={logo}
              alt="Eduvate Kids logo"
              width={32}
              height={32}
              className="flex-shrink-0 transition-transform duration-300 group-hover:rotate-6"
            />
            <span className="flex flex-col min-w-0">
              <span className="font-display text-base sm:text-lg font-bold truncate">Eduvate Kids</span>
              <span className="text-xs sm:text-sm text-muted hidden sm:block">Islamic Bookstore</span>
            </span>
          </Link>

          <nav className="hidden flex-1 justify-center items-center gap-1 md:flex">
            {navLinksBefore.map((link) => (
              <Link
                key={link.href}
                className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5"
                href={link.href}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                </svg>
                <span>{link.label}</span>
              </Link>
            ))}
            <EventNavDropdown />
            {navLinksAfter.map((link) => {
              const isActive = link.href === '/faqs'
              return (
                <Link
                  key={link.href}
                  className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                      : 'bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5'
                  }`}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                  </svg>
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <HeaderCart />
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="md:hidden flex items-center justify-center rounded-full border border-primary/20 bg-white p-2.5 text-primaryDark transition-colors hover:bg-primary/5"
              aria-expanded={mobileOpen}
              aria-controls="faq-mobile-menu"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div
            id="faq-mobile-menu"
            className="animate-slideDown border-t border-primary/10 bg-white/95 backdrop-blur-xl md:hidden"
          >
            <nav className="mx-auto flex w-11/12 max-w-6xl flex-col gap-1 py-4">
              {navLinksBefore.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] bg-primary/5 text-primaryDark hover:bg-primary/10"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                  </svg>
                  <span>{link.label}</span>
                </Link>
              ))}
              <p className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Event</p>
              <Link href="/summer-reads" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] bg-primary/5 text-primaryDark hover:bg-primary/10">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                <span>Summer Reads</span>
              </Link>
              <Link href="/book-event" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] bg-primary/5 text-primaryDark hover:bg-primary/10">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>Book Event</span>
              </Link>
              {navLinksAfter.map((link) => {
                const isActive = link.href === '/faqs'
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] ${
                      isActive
                        ? 'bg-gradient-to-r from-primary to-secondary text-white'
                        : 'bg-primary/5 text-primaryDark hover:bg-primary/10'
                    }`}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                    </svg>
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
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
              key={`faq-design-${index}`}
              src={index % 2 === 0 ? design1 : design2}
              alt=""
              width={160}
              height={160}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 hidden md:block ${classes}`}
            />
          ))}
          <div className="relative z-10 mx-auto w-11/12 max-w-4xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
              Have Questions?
            </p>
            <h1 className="mt-4 font-display text-3xl sm:text-5xl">Frequently Asked Questions</h1>
            <p className="mt-4 text-base sm:text-lg text-muted">
              Find answers to common questions about our products, shipping, events,
              and policies. Can't find what you're looking for? Contact us!
            </p>
          </div>
        </section>

        <section className="relative py-16">
          <div className="mx-auto w-11/12 max-w-4xl space-y-8">
            {faqCategories.map((category, categoryIndex) => {
              const CategoryIcon = category.Icon
              return (
                <div
                  key={category.category}
                  className="reveal card-hover rounded-3xl bg-white p-5 sm:p-8 shadow-soft border border-primary/10"
                >
                  <div className="flex items-center gap-3 sm:gap-4 border-b border-black/10 pb-4">
                    <div className="flex h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primaryDark">
                      <CategoryIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>
                    <h2 className="font-display text-2xl gradient-text">{category.category}</h2>
                  </div>
                  <div className="mt-6 space-y-4">
                    {category.faqs.map((faq, faqIndex) => {
                      const key = `${categoryIndex}-${faqIndex}`
                      const isOpen = openIndex === key
                      const panelId = `faq-panel-${key}`
                      const buttonId = `faq-button-${key}`

                      return (
                        <div
                          key={faqIndex}
                          className="rounded-2xl border border-black/10 bg-cream transition-all duration-300 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
                        >
                          <button
                            id={buttonId}
                            onClick={() => toggleFAQ(categoryIndex, faqIndex)}
                            className="flex w-full items-center justify-between gap-4 rounded-2xl p-5 text-left"
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                          >
                            <span className="font-semibold text-primaryDark">
                              {faq.question}
                            </span>
                            <svg
                              className={`h-5 w-5 flex-shrink-0 text-primary transition-transform duration-300 ${
                                isOpen ? 'rotate-180' : 'rotate-0'
                              }`}
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
                            className={`overflow-hidden transition-all duration-300 ${
                              isOpen ? 'max-h-[600px]' : 'max-h-0'
                            }`}
                          >
                            <div className="px-5 pb-5 text-ink/80 leading-relaxed">
                              {faq.answer}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="relative py-16 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="mx-auto w-11/12 max-w-4xl">
            <div className="reveal card-hover rounded-3xl bg-white p-6 sm:p-10 shadow-soft text-center">
              <h2 className="font-display text-2xl sm:text-3xl">Still Have Questions?</h2>
              <p className="mt-3 text-muted">
                Our team is here to help! Reach out via email, phone, or the contact
                form, and we'll get back to you within 1 business day.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/contact-us"
                  className="btn-shine rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 font-semibold text-white shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Contact Us
                </Link>
                <a
                  href="https://wa.me/c/16674377777"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-full border border-green-500 bg-green-50 px-8 py-3 font-semibold text-green-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-100 hover:shadow-md"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] py-10 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="relative mx-auto w-11/12 max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link className="flex items-center gap-3" href="/">
              <Image src={logo} alt="Eduvate Kids logo" width={40} height={40} className="w-10 h-10" />
              <span className="font-display text-xl font-bold">Eduvate Kids</span>
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
            <Link
              href="/auth/login"
              aria-label="Admin Login"
              className="group inline-flex items-center justify-center rounded-full p-2 text-white/30 transition-all duration-300 hover:bg-white/5 hover:text-white/80"
            >
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
