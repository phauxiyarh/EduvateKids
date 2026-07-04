import type { Metadata } from 'next'
import './globals.css'
import { ClientShell } from './components/ClientShell'

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
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  )
}
