'use client'

import type { ReactNode } from 'react'
import { CartProvider } from '../../lib/cart'
import { CartDrawer } from './CartDrawer'
import { CartFab } from './CartFab'

/**
 * Global client shell: provides cart context to the whole app and renders the
 * cart drawer once. Wrapped around all pages by the root layout.
 */
export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      {children}
      <CartFab />
      <CartDrawer />
    </CartProvider>
  )
}
