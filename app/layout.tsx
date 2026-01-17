import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Eduvate Kids Platform',
  description:
    'Eduvate Kids is a child-friendly bookstore management platform for Muslim families.'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
