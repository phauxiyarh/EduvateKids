'use client'

import { useCart } from '../../lib/cart'

/**
 * Cart icon button for the header's right zone (storefront pages).
 * - Always shown, so the cart is reachable from every menu/page.
 * - When the cart has items it takes the "active" gradient pill treatment,
 *   matching the active menu item; otherwise it uses the same soft pill +
 *   fluid lift-on-hover as the other nav items.
 * - Opens the cart drawer; shows a count badge when items exist.
 */
export function HeaderCart() {
  const { count, openCart } = useCart()
  const hasItems = count > 0

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Open cart${count ? ` (${count} item${count === 1 ? '' : 's'})` : ''}`}
      className={`relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
        hasItems
          ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
          : 'bg-primary/5 text-primaryDark hover:bg-primary/10'
      }`}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-primaryDark shadow ring-2 ring-primary/20">
          {count}
        </span>
      )}
    </button>
  )
}
