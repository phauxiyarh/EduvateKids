import type { Metadata } from 'next'
import BookEventPage from './PageClient'

export const metadata: Metadata = {
  title: 'Book a School Book Fair or Community Event',
  description:
    'Invite Eduvate Kids to run an Islamic book fair or pop-up shop at your school, masjid or community event. Serving Maryland and the surrounding region.',
  alternates: { canonical: '/book-event' },
  openGraph: {
    title: 'Book a School Book Fair or Community Event | Eduvate Kids',
    description:
      'Host an Islamic book fair or pop-up at your school, masjid or community event.',
    url: '/book-event',
    type: 'website'
  }
}

export default function Page() {
  return <BookEventPage />
}
