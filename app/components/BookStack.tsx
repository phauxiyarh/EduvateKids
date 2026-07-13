'use client'

/**
 * BookStack — a 3D stack of books that piles up in a continuous loop.
 *
 * Each book is drawn in a light isometric projection (a cover top face, a front
 * spine face, and a page edge) so the pile reads as real, dimensional books.
 * Books drop in one-by-one from above with a bounce, the stack holds, then the
 * whole pile fades and the loop repeats. All motion is transform/opacity only
 * and disabled under prefers-reduced-motion (static full stack shown instead).
 *
 * `count` books are stacked; `palette` tints them (per reading level). Give each
 * instance a unique `uid` so gradient ids don't collide across multiple stacks.
 */

export type StackPalette = {
  cover: [string, string]  // cover top gradient (light → dark)
  spine: [string, string]  // front face gradient
  edge: string             // page edge color
}

// Brand-aligned palettes per reading level.
export const STACK_PALETTES: Record<string, StackPalette> = {
  emerald: { cover: ['#34d399', '#059669'], spine: ['#10b981', '#047857'], edge: '#ecfdf5' },
  violet: { cover: ['#a78bfa', '#7c3aed'], spine: ['#8b5cf6', '#6d28d9'], edge: '#f5f3ff' },
  pink: { cover: ['#f472b6', '#db2777'], spine: ['#ec4899', '#be185d'], edge: '#fdf2f8' },
}

export function BookStack({
  count,
  palette,
  uid,
  className,
  loopSeconds = 6,
  mode = 'loop',
}: {
  count: number
  palette: StackPalette
  uid: string
  className?: string
  loopSeconds?: number
  // 'loop' — pile up, fade, repeat forever (marketing).
  // 'progress' — a real stack of `count` books that drop in once and stay
  //   (used on the log page where the height IS the child's progress).
  mode?: 'loop' | 'progress'
}) {
  // Layout in view-box units.
  const W = 120
  const H = 120
  const bookH = 9          // spine (front face) height
  const depth = 5          // isometric depth of the cover top
  const baseW = 74         // widest book (bottom)
  const cx = W / 2
  const groundY = H - 14   // where the bottom book rests

  // Slight per-book width + horizontal jitter so the pile looks hand-stacked.
  const widths = Array.from({ length: count }, (_, i) => baseW - (i % 3) * 6 - Math.min(i, 5) * 1.2)
  const jitter = [0, -3, 2, -1.5, 3, -2, 1, -2.5, 2.5, -1]

  // Total time each book's drop+hold occupies; staggered so they pile in order.
  const perBook = (loopSeconds * 1000) / (count + 2)
  // In progress mode books drop in quickly one after another and stay put.
  const stepMs = mode === 'progress' ? 110 : perBook

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`A stack of ${count} books`}
    >
      <defs>
        <linearGradient id={`bs-cover-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.cover[0]} />
          <stop offset="100%" stopColor={palette.cover[1]} />
        </linearGradient>
        <linearGradient id={`bs-spine-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.spine[0]} />
          <stop offset="100%" stopColor={palette.spine[1]} />
        </linearGradient>
        <radialGradient id={`bs-shadow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#0b1220" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0b1220" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* contact shadow on the ground */}
      <ellipse className={`bs-shadow bs-shadow-${uid}`} cx={cx} cy={groundY + bookH + 3} rx={baseW / 2 + 4} ry="5" fill={`url(#bs-shadow-${uid})`} />

      {Array.from({ length: count }).map((_, i) => {
        const w = widths[i]
        const x = cx - w / 2 + (jitter[i % jitter.length] || 0)
        // Stack upward: book 0 sits on the ground, each next one sits on top.
        const y = groundY - i * bookH
        const delay = (i * stepMs).toFixed(0)
        return (
          <g
            key={i}
            className={`bs-book bs-book-${uid} bs-${mode}-${uid}`}
            style={{ animationDelay: `${delay}ms` }}
          >
            {/* front spine face */}
            <rect x={x} y={y} width={w} height={bookH} rx="1.5" fill={`url(#bs-spine-${uid})`} />
            {/* page edge (thin strip on the right of the spine face) */}
            <rect x={x + w - 3} y={y + 1.4} width="2.4" height={bookH - 2.8} rx="1" fill={palette.edge} opacity="0.9" />
            {/* a couple of spine lines for detail */}
            <rect x={x + 3} y={y + 2} width={Math.max(6, w * 0.4)} height="1.1" rx="0.5" fill="#ffffff" opacity="0.35" />
            <rect x={x + 3} y={y + bookH - 3} width={Math.max(4, w * 0.28)} height="1" rx="0.5" fill="#000000" opacity="0.12" />
            {/* cover top face (isometric parallelogram) */}
            <path
              d={`M${x} ${y} l${depth} ${-depth} h${w} l${-depth} ${depth} z`}
              fill={`url(#bs-cover-${uid})`}
            />
            {/* right side face (depth) */}
            <path
              d={`M${x + w} ${y} l${depth} ${-depth} v${bookH} l${-depth} ${depth} z`}
              fill={palette.spine[1]}
              opacity="0.85"
            />
            {/* top highlight */}
            <path
              d={`M${x} ${y} l${depth} ${-depth} h${w * 0.5} l${-depth} ${depth} z`}
              fill="#ffffff"
              opacity="0.16"
            />
          </g>
        )
      })}

      <style jsx>{`
        .bs-book-${uid} {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          will-change: transform, opacity;
        }
        /* LOOP: drop with a bounce, hold, fade the whole pile, repeat. */
        .bs-loop-${uid} {
          animation: bs-drop-${uid} ${loopSeconds}s cubic-bezier(0.3, 1.4, 0.5, 1) infinite;
        }
        @keyframes bs-drop-${uid} {
          0% { opacity: 0; transform: translateY(-42px) scaleX(0.82); }
          6% { opacity: 1; }
          14% { transform: translateY(2px) scaleX(1.04); }
          20% { transform: translateY(0) scaleX(1); }
          80% { opacity: 1; transform: translateY(0) scaleX(1); }
          94% { opacity: 0; transform: translateY(-8px) scaleX(0.96); }
          100% { opacity: 0; transform: translateY(-42px) scaleX(0.82); }
        }
        /* PROGRESS: drop in once (staggered) and stay — height = real count. */
        .bs-progress-${uid} {
          animation: bs-drop-once-${uid} 620ms cubic-bezier(0.3, 1.4, 0.5, 1) both;
        }
        @keyframes bs-drop-once-${uid} {
          0% { opacity: 0; transform: translateY(-42px) scaleX(0.82); }
          40% { opacity: 1; }
          72% { transform: translateY(2px) scaleX(1.05); }
          100% { opacity: 1; transform: translateY(0) scaleX(1); }
        }
        .bs-shadow-${uid} {
          transform-box: fill-box;
          transform-origin: center;
          ${mode === 'loop'
            ? `animation: bs-shadow-pulse-${uid} ${loopSeconds}s ease-in-out infinite;`
            : ''}
        }
        @keyframes bs-shadow-pulse-${uid} {
          0%, 100% { opacity: 0.35; transform: scaleX(0.7); }
          50% { opacity: 1; transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bs-book-${uid} { opacity: 1 !important; animation: none !important; transform: none !important; }
          .bs-shadow-${uid} { opacity: 1 !important; animation: none !important; transform: none !important; }
        }
      `}</style>
    </svg>
  )
}
