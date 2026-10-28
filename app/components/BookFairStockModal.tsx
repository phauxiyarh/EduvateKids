'use client'

import { useMemo, useRef, useState } from 'react'

export type FairStockItem = {
  id: string
  title: string
  category: string
  code: string
  altCode: string
  sellingPrice: number
  /** Copies in main inventory. */
  quantity: number
}

type Props = {
  eventName: string
  eventActive: boolean
  /** inventory id -> copies at the fair */
  stock: Record<string, number>
  inventory: FairStockItem[]
  /** Copies sold at this fair so far, per inventory id. */
  soldHere: Record<string, number>
  /** delta > 0 moves copies to the fair, < 0 returns them. Resolves to an error or null. */
  onTransfer: (itemId: string, delta: number) => Promise<string | null>
  onReturnAll: () => Promise<string | null>
  onClose: () => void
}

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Book fair stock: copies the admin moves out of main inventory to sell at one
 * event. Moving them lowers the main count straight away, so the website and
 * other events can't sell copies that are physically at the fair.
 */
export function BookFairStockModal({ eventName, eventActive, stock, inventory, soldHere, onTransfer, onReturnAll, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  // State updates land a render late, so two quick taps could both pass a
  // `busy` check and move the copies twice. The ref closes that gap.
  const inFlight = useRef(false)

  const byId = useMemo(() => new Map(inventory.map((i) => [i.id, i])), [inventory])

  const atFair = useMemo(
    () =>
      Object.entries(stock)
        .map(([id, qty]) => ({ item: byId.get(id), qty }))
        .filter((row): row is { item: FairStockItem; qty: number } => Boolean(row.item))
        .sort((a, b) => a.item.title.localeCompare(b.item.title)),
    [stock, byId]
  )
  const copiesAtFair = atFair.reduce((sum, r) => sum + Math.max(0, r.qty), 0)
  const valueAtFair = atFair.reduce((sum, r) => sum + Math.max(0, r.qty) * r.item.sellingPrice, 0)
  const copiesSold = Object.values(soldHere).reduce((sum, q) => sum + q, 0)

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return inventory
      .filter((i) => [i.title, i.category, i.code, i.altCode].some((f) => (f || '').toLowerCase().includes(q)))
      .slice(0, 30)
  }, [inventory, search])

  const draft = (id: string) => {
    const n = Math.round(Number(qtyDrafts[id] ?? '1'))
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  const run = async (id: string, delta: number, done: string) => {
    if (!delta || inFlight.current) return
    if (delta > 0 && !eventActive) return
    inFlight.current = true
    setBusy(id)
    setMessage(null)
    const error = await onTransfer(id, delta)
    inFlight.current = false
    setBusy(null)
    if (error) {
      setMessage({ tone: 'error', text: error })
      return
    }
    setQtyDrafts((d) => ({ ...d, [id]: '1' }))
    setMessage({ tone: 'ok', text: done })
  }

  const returnAll = async () => {
    if (!copiesAtFair || inFlight.current) return
    if (!confirm(`Return all ${copiesAtFair} unsold copies from ${eventName} to main inventory?`)) return
    inFlight.current = true
    setBusy('all')
    setMessage(null)
    const error = await onReturnAll()
    inFlight.current = false
    setBusy(null)
    setMessage(error ? { tone: 'error', text: error } : { tone: 'ok', text: `All ${copiesAtFair} copies are back in main inventory.` })
  }

  const qtyInput = (id: string, max: number) => (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      value={qtyDrafts[id] ?? '1'}
      onChange={(e) => setQtyDrafts((d) => ({ ...d, [id]: e.target.value }))}
      aria-label="Number of copies"
      className="h-11 w-16 rounded-xl border-2 border-primary/20 px-2 text-center text-sm font-semibold focus:border-primary focus:outline-none"
    />
  )

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Book fair stock for ${eventName}`}
        className="flex w-full sm:max-w-3xl max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-black/5 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Book fair stock</p>
            <h4 className="font-display text-xl sm:text-2xl text-primaryDark break-words">{eventName}</h4>
            <p className="mt-1 text-xs text-muted">
              Copies moved here leave main inventory, and this event&apos;s POS sells only from them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 text-primaryDark hover:bg-primary/5"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Copies here', value: String(copiesAtFair) },
              { label: 'Value here', value: `$${money(valueAtFair)}` },
              { label: 'Sold here', value: String(copiesSold) }
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-primary/10 bg-primary/5 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{s.label}</p>
                <p className="mt-0.5 font-display text-lg text-primaryDark">{s.value}</p>
              </div>
            ))}
          </div>

          {!eventActive && copiesAtFair > 0 && (
            <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              This event is closed but still holds stock. Return it so it can be sold elsewhere.
            </p>
          )}

          {message && (
            <p
              role="status"
              className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${
                message.tone === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-green-200 bg-green-50 text-green-700'
              }`}
            >
              {message.text}
            </p>
          )}

          {/* Add from main inventory */}
          <section className="mt-5">
            <label htmlFor="fair-stock-search" className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
              Add books from main inventory
            </label>
            <input
              id="fair-stock-search"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, ISBN or category..."
              className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />
            {search.trim() && (
              <ul className="mt-2 divide-y divide-black/5 rounded-2xl border border-black/5">
                {candidates.length === 0 && <li className="px-4 py-3 text-sm text-muted">No inventory matches.</li>}
                {candidates.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <p className="line-clamp-2 text-sm font-semibold text-gray-800">{item.title}</p>
                      <p className="text-xs text-muted">
                        {item.quantity} in main inventory{(stock[item.id] ?? 0) > 0 ? ` · ${stock[item.id]} already here` : ''}
                      </p>
                    </div>
                    {qtyInput(item.id, item.quantity)}
                    <button
                      type="button"
                      disabled={busy !== null || !eventActive || item.quantity <= 0 || draft(item.id) <= 0}
                      onClick={() => run(item.id, draft(item.id), `Moved ${draft(item.id)} × ${item.title} to the fair.`)}
                      className="min-h-[44px] rounded-xl bg-gradient-to-r from-primary to-secondary px-4 text-sm font-bold text-white disabled:opacity-40"
                    >
                      {busy === item.id ? 'Moving…' : 'Move here'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* At the fair */}
          <section className="mt-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-muted">At the fair ({atFair.length} titles)</h5>
              {copiesAtFair > 0 && (
                <button
                  type="button"
                  onClick={returnAll}
                  disabled={busy !== null}
                  className="min-h-[40px] rounded-full border-2 border-amber-300 bg-amber-50 px-4 text-xs font-bold text-amber-800 disabled:opacity-40"
                >
                  {busy === 'all' ? 'Returning…' : 'Return all unsold'}
                </button>
              )}
            </div>
            {atFair.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-primary/20 px-4 py-6 text-center text-sm text-muted">
                Nothing here yet. Search above to move books to this fair.
              </p>
            ) : (
              <ul className="divide-y divide-black/5 rounded-2xl border border-black/5">
                {atFair.map(({ item, qty }) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <p className="line-clamp-2 text-sm font-semibold text-gray-800">{item.title}</p>
                      <p className="text-xs text-muted">
                        <span className={`font-bold ${qty < 0 ? 'text-red-600' : qty === 0 ? 'text-muted' : 'text-green-700'}`}>
                          {qty} here
                        </span>
                        {(soldHere[item.id] ?? 0) > 0 && ` · ${soldHere[item.id]} sold`}
                        {` · ${item.quantity} in main`}
                        {qty < 0 && ' · oversold across tills, recount'}
                      </p>
                    </div>
                    {(qty > 0 || item.quantity > 0) && (
                      <>
                        {qtyInput(item.id, Math.max(qty, item.quantity))}
                        {qty > 0 && (
                          <button
                            type="button"
                            disabled={busy !== null || draft(item.id) <= 0}
                            onClick={() => run(item.id, -draft(item.id), `Returned ${draft(item.id)} × ${item.title} to main inventory.`)}
                            className="min-h-[44px] rounded-xl border-2 border-primary/25 px-4 text-sm font-bold text-primaryDark disabled:opacity-40"
                          >
                            {busy === item.id ? 'Returning…' : 'Return'}
                          </button>
                        )}
                        {item.quantity > 0 && (
                          <button
                            type="button"
                            disabled={busy !== null || !eventActive || draft(item.id) <= 0}
                            onClick={() => run(item.id, draft(item.id), `Moved ${draft(item.id)} more × ${item.title} to the fair.`)}
                            className="min-h-[44px] rounded-xl bg-primary/10 px-4 text-sm font-bold text-primaryDark disabled:opacity-40"
                          >
                            Add
                          </button>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
