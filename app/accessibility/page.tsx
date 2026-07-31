import type { Metadata } from 'next'
import AccessibilityPage from './PageClient'

export const metadata: Metadata = {
  title: 'Accessibility Statement',
  description:
    'How Eduvate Kids works to keep our online bookstore usable for everyone, and how to report an accessibility barrier.',
  alternates: { canonical: '/accessibility' },
  robots: { index: true, follow: true }
}

export default function Page() {
  return <AccessibilityPage />
}
