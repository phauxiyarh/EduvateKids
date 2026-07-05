'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/**
 * Desktop "Event" nav pill with a dropdown → Summer Reads + Book Event.
 * Opens on hover and on click/focus (keyboard accessible); closes on outside
 * click or Escape. Matches the pill+icon nav styling used across public pages.
 * `active` highlights the pill when the current page is one of the event pages.
 */
export function EventNavDropdown({ active = false }: { active?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pill = `flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 ease-out ${
    active ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg' : 'bg-primary/5 text-primaryDark hover:bg-primary/10 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(124,58,237,0.14)]'
  }`

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className={pill} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <span>Event</span>
        <svg className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {/* Positioned flush to the button (top-full, no margin) so there is no
          hover dead-zone; the visual gap is created by transparent pt-2 INSIDE
          this still-hoverable container. This keeps the menu open while the
          cursor travels from the pill down to the items. */}
      <div
        className={`absolute left-0 top-full z-[100] w-52 pt-2 origin-top transition-all duration-200 ${
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div role="menu" className="overflow-hidden rounded-2xl border border-primary/10 bg-white/95 shadow-[0_16px_40px_rgba(124,58,237,0.16)] backdrop-blur-xl">
          <Link href="/summer-reads" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-primaryDark transition hover:bg-primary/5">
            <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            Summer Reads
          </Link>
          <Link href="/book-event" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-3 border-t border-black/5 px-4 py-3 text-sm font-semibold text-primaryDark transition hover:bg-primary/5">
            <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Book Event
          </Link>
        </div>
      </div>
    </div>
  )
}
