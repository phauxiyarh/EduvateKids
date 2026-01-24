'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import logo from '../../assets/logo.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'
import bg1 from '../../assets/bg1.png'

const faqCategories = [
  {
    category: 'Orders & Shipping',
    icon: '📦',
    faqs: [
      {
        question: 'How long does shipping take?',
        answer: 'Standard shipping typically takes 5-7 business days within the continental United States. Expedited shipping (2-3 business days) is available at checkout. Orders are processed within 1-2 business days, though this may extend to 3-5 days during peak seasons.'
      },
      {
        question: 'Do you offer free shipping?',
        answer: 'Yes! We offer free standard shipping on all orders over $50 within the continental United States. For orders under $50, standard shipping costs $5.99.'
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
    icon: '📚',
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
    icon: '↩️',
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
    icon: '🎪',
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
    icon: '💳',
    faqs: [
      {
        question: 'Do I need an account to place an order?',
        answer: 'No, you can checkout as a guest. However, creating an account allows you to track orders, save your shipping information, and receive exclusive updates about new arrivals.'
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover), PayPal, and Apple Pay. All transactions are processed securely through encrypted channels.'
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

export default function FAQsPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null)

  const toggleFAQ = (categoryIndex: number, faqIndex: number) => {
    const key = `${categoryIndex}-${faqIndex}`
    setOpenIndex(openIndex === key ? null : key)
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
              key={`faq-design-${index}`}
              src={index % 2 === 0 ? design1 : design2}
              alt=""
              width={160}
              height={160}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 ${classes}`}
            />
          ))}
          <div className="relative z-10 mx-auto w-11/12 max-w-4xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
              Have Questions?
            </p>
            <h1 className="mt-4 font-display text-5xl">Frequently Asked Questions</h1>
            <p className="mt-4 text-lg text-muted">
              Find answers to common questions about our products, shipping, events,
              and policies. Can't find what you're looking for? Contact us!
            </p>
          </div>
        </section>

        <section className="relative py-16">
          <div className="mx-auto w-11/12 max-w-4xl space-y-8">
            {faqCategories.map((category, categoryIndex) => (
              <div
                key={category.category}
                className="rounded-3xl bg-white p-8 shadow-soft border border-primary/10"
              >
                <div className="flex items-center gap-4 border-b border-black/10 pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-2xl">
                    {category.icon}
                  </div>
                  <h2 className="font-display text-2xl gradient-text">{category.category}</h2>
                </div>
                <div className="mt-6 space-y-4">
                  {category.faqs.map((faq, faqIndex) => {
                    const key = `${categoryIndex}-${faqIndex}`
                    const isOpen = openIndex === key

                    return (
                      <div
                        key={faqIndex}
                        className="rounded-2xl border border-black/10 bg-cream transition-all hover:border-primary/30"
                      >
                        <button
                          onClick={() => toggleFAQ(categoryIndex, faqIndex)}
                          className="flex w-full items-center justify-between gap-4 p-5 text-left"
                          type="button"
                        >
                          <span className="font-semibold text-primaryDark">
                            {faq.question}
                          </span>
                          <span
                            className={`text-2xl transition-transform ${
                              isOpen ? 'rotate-45' : 'rotate-0'
                            }`}
                          >
                            +
                          </span>
                        </button>
                        <div
                          className={`overflow-hidden transition-all duration-300 ${
                            isOpen ? 'max-h-96' : 'max-h-0'
                          }`}
                        >
                          <div className="px-5 pb-5 text-muted leading-relaxed">
                            {faq.answer}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative py-16 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="mx-auto w-11/12 max-w-4xl">
            <div className="rounded-3xl bg-white p-10 shadow-soft text-center">
              <h2 className="font-display text-3xl">Still Have Questions?</h2>
              <p className="mt-3 text-muted">
                Our team is here to help! Reach out via email, phone, or the contact
                form, and we'll get back to you within 1 business day.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/contact-us"
                  className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 font-semibold text-white shadow-soft transition hover:-translate-y-1"
                >
                  Contact Us
                </Link>
                <a
                  href="https://wa.me/c/16674377777"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-full border border-green-500 bg-green-50 px-8 py-3 font-semibold text-green-700 transition hover:-translate-y-1"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Chat on WhatsApp
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
