/**
 * Book credit for a book fair: the school gets a share of what was sold, at
 * one rate for Learning Roots (LR) books and another for everything else.
 *
 * Sales are what customers paid for the books: each order's subtotal less its
 * discount. The card fee is left out, since it is a passthrough and not a
 * sale. An order's discount is shared across its lines in proportion to each
 * line's price, so a discounted order credits LR and non-LR books fairly.
 *
 * All sums are done in whole cents and the non-LR figure is taken as the
 * remainder, so LR + non-LR always equals the total exactly.
 */

export type CreditOrderItem = { itemId: string; title: string; quantity: number; lineTotal: number; price?: number }
export type CreditOrder = { items: CreditOrderItem[]; subtotal?: number; discount?: number }
export type CreditRates = { lr: number; other: number }

export const DEFAULT_CREDIT_RATES: CreditRates = { lr: 20, other: 10 }

/** True for a Learning Roots publisher, however it was typed. */
export function isLearningRoots(publisher: string | undefined | null): boolean {
  return String(publisher ?? '').toLowerCase().replace(/[^a-z]/g, '').includes('learningroots')
}

export type CreditTitle = { title: string; group: 'lr' | 'other' | 'unmatched'; copies: number; sales: number }

export type BookCredit = {
  orders: number
  total: { sales: number; copies: number }
  lr: { sales: number; copies: number; credit: number }
  other: { sales: number; copies: number; credit: number }
  /** Lines whose product is no longer in inventory. Counted as non-LR. */
  unmatched: { sales: number; copies: number }
  totalCredit: number
  rates: CreditRates
  titles: CreditTitle[]
}

const cents = (n: number) => Math.round((Number(n) || 0) * 100)

/**
 * @param publisherOf returns the product's publisher, or undefined when the
 *   product can't be found (deleted from inventory).
 */
export function computeBookCredit(
  orders: CreditOrder[],
  publisherOf: (item: CreditOrderItem) => string | undefined,
  rates: CreditRates
): BookCredit {
  let totalC = 0
  let lrC = 0
  let unmatchedC = 0
  let lrCopies = 0
  let otherCopies = 0
  let unmatchedCopies = 0
  const titles = new Map<string, CreditTitle>()
  let counted = 0

  for (const order of orders) {
    const items = (order.items ?? []).filter((i) => (i.quantity || 0) > 0)
    if (!items.length) continue
    const lineC = items.map((i) => cents(i.lineTotal ?? (i.price ?? 0) * i.quantity))
    const baseC = lineC.reduce((s, c) => s + c, 0)
    const subtotalC = order.subtotal != null ? cents(order.subtotal) : baseC
    // A fully discounted order still counts its copies; it just adds no money.
    const netC = Math.max(0, subtotalC - cents(order.discount ?? 0))
    counted += 1
    totalC += netC

    // Share the order's net across its lines by price, largest remainder last
    // so the shares add back to netC exactly.
    let allocated = 0
    items.forEach((item, idx) => {
      const shareC = idx === items.length - 1
        ? netC - allocated
        : baseC > 0 ? Math.round((netC * lineC[idx]) / baseC) : 0
      allocated += shareC
      const publisher = publisherOf(item)
      const group: CreditTitle['group'] = publisher === undefined ? 'unmatched' : isLearningRoots(publisher) ? 'lr' : 'other'
      if (group === 'lr') { lrC += shareC; lrCopies += item.quantity }
      else if (group === 'unmatched') { unmatchedC += shareC; unmatchedCopies += item.quantity }
      else otherCopies += item.quantity

      const key = `${group}|${item.itemId || item.title}`
      const row = titles.get(key) ?? { title: item.title, group, copies: 0, sales: 0 }
      row.copies += item.quantity
      row.sales += shareC
      titles.set(key, row)
    })
  }

  // Non-LR is the remainder, so the split always adds up to the total.
  const otherC = totalC - lrC
  const lrCreditC = Math.round((lrC * rates.lr) / 100)
  const otherCreditC = Math.round((otherC * rates.other) / 100)

  return {
    orders: counted,
    total: { sales: totalC / 100, copies: lrCopies + otherCopies + unmatchedCopies },
    lr: { sales: lrC / 100, copies: lrCopies, credit: lrCreditC / 100 },
    other: { sales: otherC / 100, copies: otherCopies + unmatchedCopies, credit: otherCreditC / 100 },
    unmatched: { sales: unmatchedC / 100, copies: unmatchedCopies },
    totalCredit: (lrCreditC + otherCreditC) / 100,
    rates,
    titles: [...titles.values()]
      .map((t) => ({ ...t, sales: t.sales / 100 }))
      .sort((a, b) => b.sales - a.sales || a.title.localeCompare(b.title))
  }
}
