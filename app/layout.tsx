import type { Metadata } from 'next'
import './globals.css'
import { ClientShell } from './components/ClientShell'

const SITE_URL = 'https://eduvatekids.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Each route supplies its own title; `template` appends the brand so we never
  // ship the same headline on every page again.
  title: {
    default: "Eduvate Kids | Islamic Children's Books & Learning Kits",
    template: '%s | Eduvate Kids'
  },
  description:
    'Eduvate Kids is a Maryland-based Islamic bookstore for families and schools. Shop curated children’s books, Arabic learning kits, crafts, and gifts. Free shipping over $150.',
  applicationName: 'Eduvate Kids',
  keywords: [
    'Islamic children books',
    'Muslim kids books',
    'Arabic learning kits',
    'Islamic bookstore',
    'Ramadan books for kids',
    'Eid gifts for children',
    'school book fair',
    'Maryland Islamic bookstore'
  ],
  authors: [{ name: 'Eduvate Kids' }],
  creator: 'Eduvate Kids',
  publisher: 'Eduvate Kids',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 }
  },
  openGraph: {
    siteName: 'Eduvate Kids',
    locale: 'en_US',
    type: 'website',
    url: SITE_URL,
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Eduvate Kids' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: "Eduvate Kids | Islamic Children's Books & Learning Kits",
    description:
      'Curated Islamic books, Arabic learning kits, crafts, and gifts for Muslim families and schools.',
    images: ['/logo.png']
  },
  icons: { icon: '/favicon.ico' }
}

/**
 * Site-level structured data. Emitted as static HTML in the document head so
 * crawlers that do not execute JavaScript still see who this business is —
 * the rest of the page renders client-side.
 */
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['Organization', 'OnlineStore'],
      '@id': `${SITE_URL}/#organization`,
      name: 'Eduvate Kids',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
      description:
        'Maryland-based Islamic bookstore offering curated children’s books, Arabic learning kits, crafts and gifts for Muslim families and schools.',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'MD',
        addressCountry: 'US'
      },
      areaServed: { '@type': 'Country', name: 'United States' },
      knowsAbout: [
        'Islamic children’s literature',
        'Arabic language learning for children',
        'Islamic school book fairs'
      ]
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Eduvate Kids',
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en-US'
    }
  ]
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          // Static, developer-authored JSON — no user input reaches this string.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  )
}
