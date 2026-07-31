import type { Metadata } from 'next'
import PoliciesPage from './PageClient'

export const metadata: Metadata = {
  title: 'Shipping, Returns & Privacy Policies',
  description:
    'Eduvate Kids shipping rates and delivery times, return and refund policy, privacy policy and terms of service.',
  alternates: { canonical: '/policies' },
  openGraph: {
    title: 'Shipping, Returns & Privacy Policies | Eduvate Kids',
    description: 'Shipping rates, returns and refunds, privacy policy and terms.',
    url: '/policies',
    type: 'website'
  }
}

export default function Page() {
  return <PoliciesPage />
}
