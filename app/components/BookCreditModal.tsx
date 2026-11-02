'use client'

import { useState } from 'react'
import type { BookCredit, CreditRates } from '../../lib/bookCredit'

type Props = {
  eventName: string
  credit: BookCredit
  canEditRates: boolean
  /** Saves new rates for this event. Resolves to an error message or null. */
  onSaveRates: (rates: CreditRates) => Promise<string | null>
  onClose: () => void
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n: number) => `${Number(n.toFixed(2))}%`

/**
 * Book fair sales split into Learning Roots and other books, and the book
 * credit the school earns on each at this fair's rates.
 */
export function BookCreditModal({ eventName, credit, canEditRates, onSaveRates, onClose }: Props) {
  const [editing, setEditing] = useState(false)
  const [lr, setLr] = useState(String(credit.rates.lr))
  const [other, setOther] = useState(String(credit.rates.other))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showTitles, setShowTitles] = useState(false)

  const valid = (v: string) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100
  const save = async () => {
    if (!valid(lr) || !valid(other)) {
      setError('Enter rates between 0 and 100.')
      return
    }
    setSaving(true)
    setError('')
    const err = await onSaveRates({ lr: Number(lr), other: Number(other) })
    setSaving(false)
    if (err) setError(err)
    else setEditing(false)
  }

  const rows = [
    { label: 'Learning Roots', sales: credit.lr.sales, copies: credit.lr.copies, rate: credit.rates.lr, credit: credit.lr.credit },
    { label: 'Other publishers', sales: credit.other.sales, copies: credit.other.copies, rate: credit.rates.other, credit: credit.other.credit }
  ]

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-fadeIn" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Book credit for ${eventName}`}
        className="w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-5 sm:-mx-6 flex items-start justify-between gap-3 border-b border-black/5 bg-white px-5 sm:px-6 pt-5 pb-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Book credit</p>
            <h4 className="font-display text-lg sm:text-2xl leading-tight text-primaryDark break-words">{eventName}</h4>
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

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Total sales', value: money(credit.total.sales), sub: `${credit.total.copies} books` },
            { label: 'LR sales', value: money(credit.lr.sales), sub: `${credit.lr.copies} books` },
            { label: 'Non-LR sales', value: money(credit.other.sales), sub: `${credit.other.copies} books` }
          ].map((s) => (
            <div key={s.label} className="min-w-0 rounded-2xl border border-primary/10 bg-primary/5 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{s.label}</p>
              <p className="mt-0.5 truncate font-display text-base sm:text-lg text-primaryDark">{s.value}</p>
              <p className="text-[11px] text-muted">{s.sub}</p>
            </div>
          ))}
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl border border-primary/15">
          <table className="w-full text-sm">
            <thead className="bg-primary/5 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2">Books</th>
                <th className="px-2 py-2 text-right">Sales</th>
                <th className="px-2 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="px-3 py-2.5 font-semibold text-gray-800">{r.label}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{money(r.sales)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted">{pct(r.rate)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(r.credit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50">
                <td className="px-3 py-3 font-bold text-emerald-900" colSpan={3}>Book credit for the school</td>
                <td className="px-3 py-3 text-right font-display text-lg text-emerald-800 tabular-nums">{money(credit.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <p className="mt-2 text-xs text-muted">
          Sales are what customers paid for books after discounts. Card fees are not included. Learning Roots books are those
          whose publisher is Learning Roots.
        </p>

        {credit.unmatched.copies > 0 && (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            {credit.unmatched.copies} book{credit.unmatched.copies === 1 ? '' : 's'} ({money(credit.unmatched.sales)}) are no longer in
            inventory, so their publisher can&apos;t be checked. They are counted as non-LR. They&apos;re marked in the list below.
          </p>
        )}

        {canEditRates && (
          <div className="mt-4">
            {editing ? (
              <div className="rounded-2xl border border-primary/15 p-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'rate-lr', label: 'Learning Roots %', value: lr, set: setLr },
                    { id: 'rate-other', label: 'Other publishers %', value: other, set: setOther }
                  ].map((f) => (
                    <label key={f.id} htmlFor={f.id} className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{f.label}</span>
                      <input
                        id={f.id}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step="0.5"
                        value={f.value}
                        onChange={(e) => f.set(e.target.value)}
                        className="mt-1 h-11 w-full rounded-xl border-2 border-primary/20 px-3 text-sm font-semibold focus:border-primary focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
                {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setEditing(false); setError(''); setLr(String(credit.rates.lr)); setOther(String(credit.rates.other)) }} className="min-h-[44px] rounded-full border-2 border-primary/20 text-sm font-bold text-primaryDark">
                    Cancel
                  </button>
                  <button type="button" onClick={save} disabled={saving} className="min-h-[44px] rounded-full bg-gradient-to-r from-primary to-secondary text-sm font-bold text-white disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save rates'}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="min-h-[40px] text-sm font-bold text-primary">
                Change rates for this fair
              </button>
            )}
          </div>
        )}

        {credit.titles.length > 0 && (
          <div className="mt-4">
            <button type="button" onClick={() => setShowTitles((v) => !v)} aria-expanded={showTitles} className="min-h-[40px] text-sm font-bold text-primary">
              {showTitles ? 'Hide' : 'Show'} sales by title ({credit.titles.length})
            </button>
            {showTitles && (
              <ul className="mt-1 divide-y divide-black/5 rounded-2xl border border-black/5">
                {credit.titles.map((t, i) => (
                  <li key={`${t.group}-${t.title}-${i}`} className="flex items-start gap-3 px-3 py-2 text-sm">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        t.group === 'lr' ? 'bg-emerald-100 text-emerald-800' : t.group === 'unmatched' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t.group === 'lr' ? 'LR' : t.group === 'unmatched' ? '?' : 'Other'}
                    </span>
                    <span className="min-w-0 flex-1 text-gray-800">{t.title} <span className="text-muted">× {t.copies}</span></span>
                    <span className="shrink-0 font-semibold tabular-nums">{money(t.sales)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
