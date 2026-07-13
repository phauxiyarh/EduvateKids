'use client'

/**
 * Self-contained SVG placeholder shown when a catalog item has no cover image.
 * A clean, straight-on hardcover book (no perspective): a darker spine strip on
 * the left, the front cover facing the viewer, and a thin page-edge strip on the
 * right for a little depth. Plain green cover carrying the Eduvate Kids sprout
 * mark (vector, so it always renders), the word "Book", and the brand name.
 * Pure SVG — scales to any container.
 */
export function BookPlaceholder({
  title = '',
  className = '',
}: {
  title?: string
  className?: string
}) {
  const uid = 'bookph'

  // Straight book geometry (no skew). Cover spans x: 96 → 246, y: 40 → 280.
  const coverX = 96
  const coverW = 150
  const coverY = 40
  const coverH = 240
  const coverCX = coverX + coverW / 2 // 171

  return (
    <svg
      viewBox="0 0 300 320"
      className={className}
      role="img"
      aria-label={title ? `${title} (no cover image yet)` : 'Book placeholder'}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`${uid}-cover`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3FBE72" />
          <stop offset="50%" stopColor="#1F9457" />
          <stop offset="100%" stopColor="#0B5329" />
        </linearGradient>
        {/* Spine: darker green, with a soft vertical shade. */}
        <linearGradient id={`${uid}-spine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0A4522" />
          <stop offset="70%" stopColor="#0E5C2E" />
          <stop offset="100%" stopColor="#083C1E" />
        </linearGradient>
        {/* Page edges on the right. */}
        <linearGradient id={`${uid}-pages`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#EFE6D0" />
          <stop offset="100%" stopColor="#D8CBAC" />
        </linearGradient>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBF8F1" />
          <stop offset="100%" stopColor="#EFE7D6" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#1c2a1a" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#1c2a1a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* backdrop */}
      <rect width="300" height="320" fill={`url(#${uid}-bg)`} />

      {/* cast shadow */}
      <ellipse cx={coverCX + 4} cy={coverY + coverH + 12} rx="96" ry="14" fill={`url(#${uid}-shadow)`} />

      {/* page edges: a thin cream strip just behind the cover's right edge */}
      <rect x={coverX + coverW - 2} y={coverY + 5} width="10" height={coverH - 10} rx="2" fill={`url(#${uid}-pages)`} stroke="#CDBF9F" strokeWidth="0.75" />
      <g stroke="#CBBE9C" strokeWidth="0.75" opacity="0.7">
        <line x1={coverX + coverW} y1={coverY + 22} x2={coverX + coverW + 8} y2={coverY + 22} />
        <line x1={coverX + coverW} y1={coverY + 40} x2={coverX + coverW + 8} y2={coverY + 40} />
        <line x1={coverX + coverW} y1={coverY + coverH - 40} x2={coverX + coverW + 8} y2={coverY + coverH - 40} />
        <line x1={coverX + coverW} y1={coverY + coverH - 22} x2={coverX + coverW + 8} y2={coverY + coverH - 22} />
      </g>

      {/* spine strip on the left (drawn straight) */}
      <rect x={coverX - 18} y={coverY} width="20" height={coverH} rx="3" fill={`url(#${uid}-spine)`} stroke="#062E17" strokeWidth="1.5" />
      {/* spine end-bands */}
      <g stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2">
        <line x1={coverX - 15} y1={coverY + 12} x2={coverX - 3} y2={coverY + 12} />
        <line x1={coverX - 15} y1={coverY + coverH - 12} x2={coverX - 3} y2={coverY + coverH - 12} />
      </g>

      {/* front cover (straight rectangle) */}
      <rect x={coverX} y={coverY} width={coverW} height={coverH} rx="4" fill={`url(#${uid}-cover)`} stroke="#062E17" strokeWidth="1.5" />
      {/* hinge line where the cover meets the spine */}
      <line x1={coverX + 4} y1={coverY + 4} x2={coverX + 4} y2={coverY + coverH - 4} stroke="#062E17" strokeOpacity="0.35" strokeWidth="1.5" />
      {/* embossed inner frame */}
      <rect x={coverX + 14} y={coverY + 16} width={coverW - 28} height={coverH - 32} rx="4" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.5" />

      {/* ── cover contents (centred, straight) ── */}
      <g transform={`translate(${coverCX + 2}, ${coverY + 108})`}>
        {/* logo medallion */}
        <circle cx="0" cy="-50" r="38" fill="#ffffff" opacity="0.14" />
        <circle cx="0" cy="-50" r="38" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.8" />

        {/* Eduvate Kids mark: a dark pencil rising into three forked green shoots. */}
        <g transform="translate(0,-48)">
          <path d="M-3.4,30 L3.4,30 L3.4,8 L0,2 L-3.4,8 Z" fill="#171717" />
          <path d="M0,2 L3.4,8 L-3.4,8 Z" fill="#ffffff" />
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <g stroke="#1F9C55" strokeWidth="3">
              <path d="M0,10 C-5,2 -11,-1 -13,-10" />
              <path d="M-13,-10 L-19,-16 M-13,-10 L-8,-17" />
            </g>
            <g stroke="#3FD37C" strokeWidth="3">
              <path d="M0,10 C5,2 11,-1 13,-10" />
              <path d="M13,-10 L19,-16 M13,-10 L8,-17" />
            </g>
            <g stroke="#2FBE6A" strokeWidth="3.4">
              <path d="M0,12 L0,-20" />
              <path d="M0,-9 L-8,-19 M0,-9 L8,-19" />
              <path d="M0,-20 L-6,-28 M0,-20 L6,-28" />
            </g>
          </g>
        </g>

        {/* the word "Book" */}
        <text
          x="0" y="26" textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="30" fontWeight="700" fill="#ffffff"
        >
          Book
        </text>

        {/* divider */}
        <line x1="-40" y1="42" x2="40" y2="42" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.4" />

        {/* brand name — sized + spaced to sit inside the cover */}
        <text
          x="0" y="60" textAnchor="middle"
          fontFamily="Verdana, Geneva, sans-serif"
          fontSize="10" letterSpacing="1.5" fontWeight="700"
          fill="#ffffff" opacity="0.9"
        >
          EDUVATE KIDS
        </text>
      </g>
    </svg>
  )
}
