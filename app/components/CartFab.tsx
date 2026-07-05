'use client'

import { usePathname } from 'next/navigation'
import { useCart } from '../../lib/cart'

/**
 * Floating cart button.
 * - Always visible on the catalogue page (a persistent "view cart" entry point).
 * - On other storefront pages, appears whenever the cart has items.
 * - Hidden on checkout/confirmation and admin pages (redundant/out of place there).
 */
export function CartFab() {
  const { count, openCart } = useCart()
  const pathname = usePathname() || '/'

  const hiddenOn = ['/checkout', '/order-confirmation', '/dashboard', '/pos', '/settings', '/create-cashier', '/auth/login']
  if (hiddenOn.some((p) => pathname.startsWith(p))) return null

  const onCatalogue = pathname.startsWith('/catalog')
  // Show always on the catalogue page; elsewhere only when the cart has items.
  if (!onCatalogue && count === 0) return null

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Open cart (${count} item${count === 1 ? '' : 's'})`}
      className="btn-shine fixed bottom-5 right-5 z-[65] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary text-white shadow-[0_10px_30px_rgba(124,58,237,0.4)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(124,58,237,0.5)]"
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-primaryDark shadow ring-2 ring-primary/20">
          {count}
        </span>
      )}
    </button>
  )
}
