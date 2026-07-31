import type { Metadata } from 'next'
import { FAQ_ENTRIES } from '../../lib/faqData'
import { SITE_URL } from '../../lib/catalogBuild'
import FAQsPage from './PageClient'

export const metadata: Metadata = {
  title: 'Shipping, Returns & FAQs',
  description:
    'Answers to common questions about shipping times, returns, bulk and school orders, book fairs, events and payment at Eduvate Kids.',
  alternates: { canonical: '/faqs' },
  openGraph: {
    title: 'Shipping, Returns & FAQs | Eduvate Kids',
    description:
      'Shipping times, returns, bulk and school orders, book fairs and payment questions answered.',
    url: '/faqs',
    type: 'website'
  }
}

/**
 * FAQPage structured data. The visible answers render client-side, so without
 * this the whole FAQ is invisible to crawlers and AI assistants — which is
 * exactly the content they are most likely to quote.
 */
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/faqs#faq`,
  mainEntity: FAQ_ENTRIES.map((entry) => ({
    '@type': 'Question',
    name: entry.question,
    acceptedAnswer: { '@type': 'Answer', text: entry.answer }
  }))
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <FAQsPage />
      {/* Crawlable copy of the answers. The interactive accordion above renders
          client-side only; this keeps the text in the static HTML. */}
      <div className="sr-only">
        <h2>Frequently asked questions</h2>
        <dl>
          {FAQ_ENTRIES.map((entry) => (
            <div key={entry.question}>
              <dt>{entry.question}</dt>
              <dd>{entry.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  )
}
