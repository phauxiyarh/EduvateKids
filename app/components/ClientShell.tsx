'use client'

import type { ReactNode } from 'react'
import { CartProvider } from '../../lib/cart'
import { CartDrawer } from './CartDrawer'

/**
 * Global client shell: provides cart context to the whole app and renders the
 * cart drawer once. Wrapped around all pages by the root layout.
 * The cart is reachable from the header cart icon on every page.
 */
export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      {children}
      <CartDrawer />
    </CartProvider>
  )
}
