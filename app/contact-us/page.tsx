import type { Metadata } from 'next'
import ContactUsPage from './PageClient'

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with Eduvate Kids about orders, bulk and school pricing, book fairs, or product questions.',
  alternates: { canonical: '/contact-us' },
  openGraph: {
    title: 'Contact Us | Eduvate Kids',
    description: 'Questions about orders, bulk pricing, book fairs or products? Reach out.',
    url: '/contact-us',
    type: 'website'
  }
}

export default function Page() {
  return <ContactUsPage />
}
