'use client'

import { useState } from 'react'
import type { SellerSales } from './MySalesCard'

export type CashierRow = { uid: string; email: string; name: string; posEventId: string }
export type FairOption = { id: string; name: string; active: boolean }

type Props = {
  cashiers: CashierRow[]
  loading: boolean
  /** Events that hold their own book fair stock. */
  fairs: FairOption[]
  /** Resolves to an error message, or null on success. */
  onChange: (uid: string, posEventId: string) => Promise<string | null>
  /** Takings per seller uid. */
  sales?: Record<string, SellerSales>
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Where each cashier sells from. "Main inventory" leaves the cashier free to
 * pick any active event other than a book fair; choosing a book fair locks
 * their POS to that fair and its own stock until the admin changes it back.
 */
export function CashierSourcesPanel({ cashiers, loading, fairs, onChange, sales }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const change = async (uid: string, value: string) => {
    setSaving(uid)
    setError('')
    const err = await onChange(uid, value)
    setSaving(null)
    if (err) setError(err)
  }

  return (
    <div className="rounded-3xl border border-primary/10 bg-white p-5 sm:p-6 shadow-xl">
      <h3 className="font-display text-xl text-primaryDark">Cashier selling source</h3>
      <p className="mt-1 text-xs text-muted">
        Main inventory: the cashier sells at any active event except a book fair. Book fair: their POS is locked to that fair and sells only its stock.
        Changes reach their phone straight away.
      </p>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading cashiers…</p>
      ) : cashiers.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No cashier accounts yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-black/5">
          {cashiers.map((c) => {
            const assigned = fairs.find((f) => f.id === c.posEventId)
            const sold = sales?.[c.uid]
            return (
              <li key={c.uid} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <p className="truncate text-sm font-semibold text-gray-800">{c.name || c.email || c.uid}</p>
                  {c.name && c.email && <p className="truncate text-xs text-muted">{c.email}</p>}
                  {sales && (
                    <p className="text-xs text-gray-700">
                      Today <span className="font-bold">{money(sold?.today.total ?? 0)}</span> ({sold?.today.orders ?? 0} sales)
                      {' · '}All time <span className="font-bold">{money(sold?.all.total ?? 0)}</span>
                    </p>
                  )}
                  {c.posEventId && (!assigned || !assigned.active) && (
                    <p className="text-xs font-semibold text-amber-700">
                      Assigned fair is closed or gone, so they are selling from main inventory.
                    </p>
                  )}
                </div>
                <select
                  value={c.posEventId}
                  disabled={saving === c.uid}
                  onChange={(e) => change(c.uid, e.target.value)}
                  aria-label={`Selling source for ${c.name || c.email}`}
                  className="min-h-[44px] w-full sm:w-auto rounded-xl border-2 border-primary/20 px-3 text-sm font-medium focus:border-primary focus:outline-none"
                >
                  <option value="">Main inventory</option>
                  {/* Without a matching option the select would show Main while
                      the stored value still points at a fair, and picking Main
                      would fire no change, so the admin couldn't reset it. */}
                  {c.posEventId && !assigned && <option value={c.posEventId}>Ended or deleted fair</option>}
                  {fairs.map((f) => (
                    <option key={f.id} value={f.id} disabled={!f.active && f.id !== c.posEventId}>
                      Book fair: {f.name}{f.active ? '' : ' (closed)'}
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
