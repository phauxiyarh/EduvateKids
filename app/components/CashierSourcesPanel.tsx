'use client'

import { useState } from 'react'
import type { SellerSales } from './MySalesCard'

export type CashierRow = { uid: string; email: string; name: string; posEventId: string }
export type EventOption = { id: string; name: string; active: boolean; bookFair: boolean }

type Props = {
  cashiers: CashierRow[]
  loading: boolean
  /** Every event, open or closed. Only open ones can be picked. */
  events: EventOption[]
  /** Resolves to an error message, or null on success. */
  onChange: (uid: string, posEventId: string) => Promise<string | null>
  /** Takings per seller uid. */
  sales?: Record<string, SellerSales>
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Where each cashier sells. Cashiers don't choose: the admin picks an event
 * (or General Sales) here, and every sale on that cashier's POS is recorded
 * there until the admin changes it. An event holding book fair stock sells
 * only that stock.
 */
export function CashierSourcesPanel({ cashiers, loading, events, onChange, sales }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const change = async (uid: string, value: string) => {
    setSaving(uid)
    setError('')
    const err = await onChange(uid, value)
    setSaving(null)
    if (err) setError(err)
  }

  const open = events.filter((e) => e.active)

  return (
    <div className="rounded-3xl border border-primary/10 bg-white p-5 sm:p-6 shadow-xl">
      <h3 className="font-display text-xl text-primaryDark">Where each cashier sells</h3>
      <p className="mt-1 text-xs text-muted">
        Pick the event each cashier is working at. Their POS records every sale there and shows no other events, until you
        change it here. If their event closes, their POS stops selling until you pick another. Changes reach their phone
        straight away.
      </p>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading cashiers…</p>
      ) : cashiers.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No cashier accounts yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-black/5">
          {cashiers.map((c) => {
            const assigned = c.posEventId ? events.find((e) => e.id === c.posEventId) : undefined
            const stuck = Boolean(c.posEventId) && !assigned?.active
            const sold = sales?.[c.uid]
            return (
              <li key={c.uid} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <p className="truncate text-sm font-semibold text-gray-800">{c.name || c.email || c.uid}</p>
                  {c.name && c.email && <p className="truncate text-xs text-muted">{c.email}</p>}
                  {sales && (
                    <p className="text-xs text-gray-700">
                      Today <span className="font-bold">{money(sold?.today.total ?? 0)}</span> ({sold?.today.orders ?? 0} sale{(sold?.today.orders ?? 0) === 1 ? '' : 's'})
                      {' · '}All time <span className="font-bold">{money(sold?.all.total ?? 0)}</span>
                    </p>
                  )}
                  {stuck && (
                    <p className="text-xs font-semibold text-red-700">
                      Their event is {assigned ? 'closed' : 'deleted'}, so their POS can&apos;t sell. Pick another.
                    </p>
                  )}
                </div>
                <select
                  value={c.posEventId}
                  disabled={saving === c.uid}
                  onChange={(e) => change(c.uid, e.target.value)}
                  aria-label={`Event for ${c.name || c.email}`}
                  className={`min-h-[44px] w-full sm:w-64 rounded-xl border-2 px-3 text-sm font-medium focus:border-primary focus:outline-none ${stuck ? 'border-red-300' : 'border-primary/20'}`}
                >
                  <option value="">General Sales (no event)</option>
                  {/* Keep the stored value selectable, or the select would show
                      General Sales while the cashier is really stuck on a closed
                      event, and picking General Sales would fire no change. */}
                  {stuck && (
                    <option value={c.posEventId} disabled>
                      {assigned ? `${assigned.name} (closed)` : 'Deleted event'}
                    </option>
                  )}
                  {open.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}{e.bookFair ? ' · book fair stock' : ''}
                    </option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
