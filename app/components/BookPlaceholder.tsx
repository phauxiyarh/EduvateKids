'use client'

/**
 * Self-contained SVG placeholder shown when a catalog item has no cover image.
 * A realistic hardcover book at a 3/4 angle: front cover facing the viewer, a
 * shaded spine turning away on the left, and a stack of page edges on the right
 * + bottom for genuine thickness, over a soft cast shadow. Plain green cover
 * carrying the Eduvate Kids sprout mark (drawn as vector so it always renders),
 * the word "Book", and the brand name. Pure SVG — scales to any container.
 */
export function BookPlaceholder({
  title = '',
  className = '',
}: {
  title?: string
  className?: string
}) {
  const uid = 'bookph'

  return (
    <svg
      viewBox="0 0 300 320"
      className={className}
      role="img"
      aria-label={title ? `${title} (no cover image yet)` : 'Book placeholder'}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Front cover: green, lit top-left → deep green bottom-right. */}
        <linearGradient id={`${uid}-cover`} x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#3FBE72" />
          <stop offset="48%" stopColor="#1F9457" />
          <stop offset="100%" stopColor="#0B5329" />
        </linearGradient>
        {/* Spine: darker, turned away from the light. */}
        <linearGradient id={`${uid}-spine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#083C1E" />
          <stop offset="100%" stopColor="#14682F" />
        </linearGradient>
        {/* Page edges. */}
        <linearGradient id={`${uid}-foreedge`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F6EFDD" />
          <stop offset="100%" stopColor="#CDBF9F" />
        </linearGradient>
        <linearGradient id={`${uid}-bottomedge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F2EAD7" />
          <stop offset="100%" stopColor="#C6B896" />
        </linearGradient>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBF8F1" />
          <stop offset="100%" stopColor="#EFE7D6" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#1c2a1a" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#1c2a1a" stopOpacity="0" />
        </radialGradient>
        {/* Diagonal sheen on the cover. */}
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="38%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}-coverClip`}>
          <path d="M104,40 L250,70 L250,244 L104,272 Z" />
        </clipPath>
      </defs>

      {/* backdrop */}
      <rect width="300" height="320" fill={`url(#${uid}-bg)`} />

      {/* cast shadow */}
      <ellipse cx="168" cy="288" rx="110" ry="17" fill={`url(#${uid}-shadow)`} />

      {/* ---- page edges: right fore-edge (thickness) ---- */}
      <path d="M250,70 L272,80 L272,254 L250,244 Z" fill={`url(#${uid}-foreedge)`} stroke="#C6B896" strokeWidth="1" />
      <g stroke="#C6B896" strokeWidth="1" opacity="0.6">
        <path d="M253,78 L269,86" />
        <path d="M253,92 L269,100" />
        <path d="M253,106 L269,114" />
        <path d="M253,206 L269,214" />
        <path d="M253,220 L269,228" />
        <path d="M253,234 L269,242" />
      </g>

      {/* ---- page edges: bottom ---- */}
      <path d="M104,272 L250,244 L272,254 L126,282 Z" fill={`url(#${uid}-bottomedge)`} stroke="#C6B896" strokeWidth="1" />

      {/* ---- spine (left face turning away) ---- */}
      <path d="M86,56 L104,40 L104,272 L86,288 Z" fill={`url(#${uid}-spine)`} stroke="#062E17" strokeWidth="1.5" />
      <g stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2">
        <path d="M89,70 L101,54" />
        <path d="M89,262 L101,246" />
      </g>

      {/* ---- front cover ---- */}
      <path d="M104,40 L250,70 L250,244 L104,272 Z" fill={`url(#${uid}-cover)`} stroke="#062E17" strokeWidth="1.5" />
      {/* embossed inner frame */}
      <path d="M118,62 L236,86 L236,228 L118,252 Z" fill="none" stroke="#ffffff" strokeOpacity="0.32" strokeWidth="1.6" />
      {/* cover sheen */}
      <path d="M104,40 L250,70 L250,244 L104,272 Z" fill={`url(#${uid}-sheen)`} clipPath={`url(#${uid}-coverClip)`} />

      {/*
        Cover contents skewed onto the tilted cover plane. The cover top edge
        rises ~30px across its ~146px width → slope ≈ -11.6°. Rotate content to
        match and centre it on the cover (~177,156).
      */}
      <g transform="translate(177,156) rotate(-11.6)">
        {/* logo medallion */}
        <circle cx="0" cy="-46" r="36" fill="#ffffff" opacity="0.14" />
        <circle cx="0" cy="-46" r="36" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.8" />

        {/* Eduvate Kids mark — drawn as vector so it always renders: a dark
           pencil rising into three forked green shoots (tallest in the centre). */}
        <g transform="translate(0,-44)">
          {/* pencil body + sharpened white nib */}
          <path d="M-3.4,30 L3.4,30 L3.4,8 L0,2 L-3.4,8 Z" fill="#171717" />
          <path d="M0,2 L3.4,8 L-3.4,8 Z" fill="#ffffff" />
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* left shoot */}
            <g stroke="#1F9C55" strokeWidth="3">
              <path d="M0,10 C-5,2 -11,-1 -13,-10" />
              <path d="M-13,-10 L-19,-16 M-13,-10 L-8,-17" />
            </g>
            {/* right shoot */}
            <g stroke="#3FD37C" strokeWidth="3">
              <path d="M0,10 C5,2 11,-1 13,-10" />
              <path d="M13,-10 L19,-16 M13,-10 L8,-17" />
            </g>
            {/* centre shoot (tallest) */}
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
          fontSize="32" fontWeight="700" fill="#ffffff"
        >
          Book
        </text>

        {/* divider */}
        <path d="M-42,42 L42,42" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.4" />

        {/* brand name */}
        <text
          x="0" y="62" textAnchor="middle"
          fontFamily="Verdana, Geneva, sans-serif"
          fontSize="11" letterSpacing="2.5" fontWeight="700"
          fill="#ffffff" opacity="0.92"
        >
          EDUVATE KIDS
        </text>
      </g>
    </svg>
  )
}
