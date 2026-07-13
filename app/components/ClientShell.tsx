'use client'

import type { ReactNode } from 'react'
import { CartProvider } from '../../lib/cart'
import { CartDrawer } from './CartDrawer'
import { CookieConsent } from './CookieConsent'

/**
 * Global client shell: provides cart context to the whole app and renders the
 * cart drawer + cookie-consent banner once. Wrapped around all pages by the
 * root layout, so both are reachable on every page.
 */
export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      {children}
      <CartDrawer />
      <CookieConsent />
    </CartProvider>
  )
}
