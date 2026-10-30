'use client'

import { useState } from 'react'

export type SalesTotals = {
  orders: number
  copies: number
  total: number
  byPayment: Record<string, number>
}

export type SellerSales = { today: SalesTotals; all: SalesTotals }

export const emptyTotals = (): SalesTotals => ({ orders: 0, copies: 0, total: 0, byPayment: {} })

type RecentOrder = { id: string; timestamp: string; total: number; copies: number; paymentType: string; group: string }

type Props = {
  sales: SellerSales
  recent: RecentOrder[]
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * What the signed-in seller has taken, so a cashier can check their till
 * against the POS at the end of a shift. Counts only orders this account rang
 * up; sales recorded before orders carried a seller are not included.
 */
export function MySalesCard({ sales, recent }: Props) {
  const [period, setPeriod] = useState<'today' | 'all'>('today')
  const [showRecent, setShowRecent] = useState(false)
  const t = sales[period]
  const payments = (['Cash', 'Card', 'Transfer'] as const).filter((p) => (t.byPayment[p] ?? 0) > 0)

  return (
    <div className="panel-card rounded-3xl bg-white p-5 sm:p-6 shadow-xl border border-primary/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg text-primaryDark">My sales</h3>
        <div role="tablist" aria-label="Period" className="flex rounded-full bg-primary/5 p-1">
          {(['today', 'all'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`min-h-[36px] rounded-full px-4 text-xs font-bold ${period === p ? 'bg-white text-primaryDark shadow' : 'text-muted'}`}
            >
              {p === 'today' ? 'Today' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Total sold', value: money(t.total) },
          { label: 'Orders', value: String(t.orders) },
          { label: 'Books', value: String(t.copies) }
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-primary/10 bg-primary/5 px-3 py-2.5 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{s.label}</p>
            <p className="mt-0.5 truncate font-display text-lg text-primaryDark">{s.value}</p>
          </div>
        ))}
      </div>

      {payments.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {payments.map((p) => `${p} ${money(t.byPayment[p])}`).join(' · ')}
        </p>
      )}

      {recent.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowRecent((v) => !v)}
            aria-expanded={showRecent}
            className="mt-3 min-h-[40px] text-xs font-bold text-primary"
          >
            {showRecent ? 'Hide my last sales' : `Show my last ${recent.length} sales`}
          </button>
          {showRecent && (
            <ul className="mt-1 divide-y divide-black/5 rounded-2xl border border-black/5">
              {recent.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate text-muted">
                    {new Date(o.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {' · '}{o.group} · {o.copies} book{o.copies === 1 ? '' : 's'} · {o.paymentType}
                  </span>
                  <span className="shrink-0 font-bold text-gray-800">{money(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
