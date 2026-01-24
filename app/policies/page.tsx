'use client'

import Image from 'next/image'
import Link from 'next/link'
import logo from '../../assets/logo.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'
import bg2 from '../../assets/bg2.png'

const policies = [
  {
    title: 'Privacy Policy',
    icon: '🔒',
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
    title: 'Return & Refund Policy',
    icon: '↩️',
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
    title: 'Shipping Policy',
    icon: '📦',
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
    title: 'Terms of Service',
    icon: '📋',
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

export default function PoliciesPage() {
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
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 ${classes}`}
            />
          ))}
          <div className="relative z-10 mx-auto w-11/12 max-w-4xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
              Legal Information
            </p>
            <h1 className="mt-4 font-display text-5xl">Policies & Terms</h1>
            <p className="mt-4 text-lg text-muted">
              We believe in transparency and trust. Review our policies to understand
              how we protect your privacy and ensure a great shopping experience.
            </p>
          </div>
        </section>

        <section className="relative py-16">
          <div className="mx-auto w-11/12 max-w-5xl space-y-12">
            {policies.map((policy, policyIndex) => (
              <div
                key={policy.title}
                className="animate-float rounded-3xl bg-white p-8 shadow-soft border border-primary/10"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 text-3xl">
                    {policy.icon}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-display text-3xl gradient-text">{policy.title}</h2>
                    <div className="mt-6 space-y-6">
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
            ))}
          </div>
        </section>

        <section className="relative py-16 bg-gradient-to-br from-emerald-50 to-blue-50">
          <div className="mx-auto w-11/12 max-w-4xl text-center">
            <h2 className="font-display text-3xl">Questions About Our Policies?</h2>
            <p className="mt-3 text-muted">
              We're here to help. Reach out to our team if you need clarification
              on any of our policies or have specific concerns.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/contact-us"
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3 font-semibold text-white shadow-soft transition hover:-translate-y-1"
              >
                Contact Us
              </Link>
              <Link
                href="/faqs"
                className="rounded-full border border-primary px-8 py-3 font-semibold text-primaryDark transition hover:-translate-y-1"
              >
                View FAQs
              </Link>
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
