'use client'

import { useState } from 'react'

const STAR_PATH =
  'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.287 3.958c.3.922-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.175 0l-3.366 2.446c-.784.57-1.838-.196-1.539-1.118l1.287-3.958a1 1 0 00-.364-1.118L2.98 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.958z'

/** Read-only star row. Sized in Tailwind units so callers can scale it. */
export function Stars({
  value,
  size = 'h-4 w-4',
  className = ''
}: {
  value: number
  size?: string
  className?: string
}) {
  const filled = Math.round(value)
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          className={`${size} ${n <= filled ? 'text-amber-400' : 'text-black/15'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  )
}

/**
 * Interactive rating input.
 *
 * Five real radio inputs under the hood, so it is keyboard reachable and
 * announced as a single group; the stars are the visible label. Hovering
 * previews a rating without committing it.
 */
export function StarPicker({
  value,
  onChange,
  disabled = false
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  const labels = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent']

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Your rating"
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            onMouseEnter={() => !disabled && setHover(n)}
            className={disabled ? 'cursor-default' : 'cursor-pointer'}
          >
            <input
              type="radio"
              name="rating"
              value={n}
              checked={value === n}
              disabled={disabled}
              onChange={() => onChange(n)}
              className="sr-only peer"
            />
            <svg
              className={`h-9 w-9 transition-transform peer-focus-visible:ring-2 peer-focus-visible:ring-primary rounded ${
                n <= shown ? 'text-amber-400' : 'text-black/15'
              } ${!disabled && n <= hover ? 'scale-110' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d={STAR_PATH} />
            </svg>
            <span className="sr-only">
              {n} {n === 1 ? 'star' : 'stars'} - {labels[n - 1]}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-1.5 h-4 text-xs font-semibold text-muted" aria-live="polite">
        {shown ? labels[shown - 1] : 'Tap a star to rate'}
      </p>
    </div>
  )
}
