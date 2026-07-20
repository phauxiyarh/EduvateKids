'use client'

/**
 * BookStack: a 3D stack of books that piles up in a continuous loop.
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
  // 'loop': pile up, fade, repeat forever (marketing).
  // 'progress': a real stack of `count` books that drop in once and stay
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

  // One shared loop clock for every book so the pile fills in order, holds
  // together, then ALL books fade out in unison before the loop restarts.
  // (Per-book animation-delay is avoided, it phase-shifts books so they never
  // clear together. Instead each book gets its own keyframes with a staggered
  // drop-in but a SHARED fade-out window.)
  const n = Math.max(count, 1)
  const fillEnd = 55        // % of timeline by which the last book has landed
  const holdEnd = 84        // % where the whole pile starts to leave
  const clearEnd = 95       // % where every book is gone (stays gone to 100%)
  const perBookPct = fillEnd / n

  // Build one @keyframes per book (shared duration, staggered entrance, common
  // exit). Book i enters at `enter%`, bounces, holds, then every book leaves in
  // the same holdEnd→clearEnd window so the pile clears all at once.
  const keyframesFor = (i: number) => {
    const enter = +(i * perBookPct).toFixed(2)
    const settle = Math.min(enter + perBookPct * 0.75, fillEnd)
    const p = (v: number) => +v.toFixed(2)
    return `@keyframes bs-book-${uid}-${i} {
      0% { opacity: 0; transform: translateY(-42px) scaleX(0.82); }
      ${p(enter)}% { opacity: 0; transform: translateY(-42px) scaleX(0.82); }
      ${p(enter + 0.01)}% { opacity: 1; transform: translateY(-42px) scaleX(0.82); }
      ${p((enter + settle) / 2)}% { transform: translateY(3px) scaleX(1.05); }
      ${p(settle)}% { opacity: 1; transform: translateY(0) scaleX(1); }
      ${holdEnd}% { opacity: 1; transform: translateY(0) scaleX(1); }
      ${clearEnd}% { opacity: 0; transform: translateY(-10px) scaleX(0.94); }
      100% { opacity: 0; transform: translateY(-42px) scaleX(0.82); }
    }
    .bs-book-${uid}-${i} { animation: bs-book-${uid}-${i} ${loopSeconds}s cubic-bezier(0.3,1.35,0.5,1) infinite; }`
  }
  const bookKeyframes = Array.from({ length: count }, (_, i) => keyframesFor(i)).join('\n')

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
        return (
          <g
            key={i}
            className={`bs-book bs-book-${uid} bs-book-${uid}-${i}`}
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

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .bs-book-${uid} {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          will-change: transform, opacity;
        }
        ${bookKeyframes}
        /* Shadow tracks the pile: strong while books are present, gone while cleared. */
        .bs-shadow-${uid} {
          transform-box: fill-box;
          transform-origin: center;
          animation: bs-shadow-${uid} ${loopSeconds}s ease-in-out infinite;
        }
        @keyframes bs-shadow-${uid} {
          0% { opacity: 0.2; transform: scaleX(0.55); }
          ${fillEnd}% { opacity: 1; transform: scaleX(1); }
          ${holdEnd}% { opacity: 1; transform: scaleX(1); }
          ${clearEnd}% { opacity: 0; transform: scaleX(0.55); }
          100% { opacity: 0; transform: scaleX(0.55); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bs-book-${uid} { opacity: 1 !important; animation: none !important; transform: none !important; }
          .bs-shadow-${uid} { opacity: 1 !important; animation: none !important; transform: none !important; }
        }
      `,
        }}
      />
    </svg>
  )
}
