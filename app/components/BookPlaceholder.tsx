'use client'

/**
 * A self-contained, 3D-realistic SVG "book" placeholder shown when a catalog
 * item has no image yet. Renders a hardcover at a slight angle: visible spine,
 * page block with stacked edges, cover bevel/gloss, a soft cast shadow, an
 * embossed title panel with the item's initials, and a small brand sprout.
 * Pure SVG, no external assets, scales to any container.
 */
export function BookPlaceholder({
  title = '',
  className = '',
}: {
  title?: string
  className?: string
}) {
  const initials =
    title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'EK'

  // Deterministic cover colour from the title so books look distinct.
  const palettes = [
    { a: '#1F8A46', b: '#0D5C2E', dk: '#08411F' }, // forest
    { a: '#2F9E98', b: '#155E5A', dk: '#0C3F3C' }, // teal
    { a: '#8A6BD1', b: '#4C3585', dk: '#332257' }, // violet
    { a: '#D3A24A', b: '#A9781F', dk: '#7C5613' }, // gold
    { a: '#D06576', b: '#8F3B49', dk: '#652832' }, // rose
    { a: '#4488E0', b: '#265596', dk: '#183a68' }, // blue
  ]
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) % 997
  const pal = palettes[hash % palettes.length]
  const uid = `bk${hash}`

  return (
    <svg
      viewBox="0 0 300 380"
      className={className}
      role="img"
      aria-label={title ? `${title} (no cover image yet)` : 'Book placeholder'}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* cover face gradient (light from top-left) */}
        <linearGradient id={`${uid}-face`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={pal.a} />
          <stop offset="55%" stopColor={pal.b} />
          <stop offset="100%" stopColor={pal.dk} />
        </linearGradient>
        {/* spine is darker */}
        <linearGradient id={`${uid}-spine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={pal.dk} />
          <stop offset="45%" stopColor={pal.b} />
          <stop offset="100%" stopColor={pal.dk} />
        </linearGradient>
        {/* page block gradient */}
        <linearGradient id={`${uid}-pages`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#efe6d2" />
          <stop offset="50%" stopColor="#fbf7ec" />
          <stop offset="100%" stopColor="#d9ceb4" />
        </linearGradient>
        {/* diagonal gloss sweep across the cover */}
        <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="18%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* soft cast shadow */}
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#20291F" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#20291F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-ivory`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBF8F1" />
          <stop offset="100%" stopColor="#F0E8D8" />
        </linearGradient>
      </defs>

      {/* backdrop */}
      <rect width="300" height="380" fill={`url(#${uid}-ivory)`} />

      {/* cast shadow on the "table" */}
      <ellipse cx="150" cy="340" rx="104" ry="20" fill={`url(#${uid}-shadow)`} />

      {/*
        3D book built from three quads (perspective, book tilted to the right):
          - top of pages (thin parallelogram)
          - right page block (fore-edge, with page lines)
          - spine (left, receding)
          - cover face (front)
        Coordinates chosen so the top and fore-edge give real thickness.
      */}

      {/* SPINE (left receding face) */}
      <path d="M64,70 L92,54 L92,300 L64,320 Z" fill={`url(#${uid}-spine)`} />

      {/* PAGE fore-edge (right side thickness) */}
      <path d="M214,74 L232,84 L232,326 L214,320 Z" fill={`url(#${uid}-pages)`} />
      {/* page lines on the fore-edge */}
      <g stroke="#c9bd9f" strokeWidth="1">
        <path d="M216,92 L230,101" opacity="0.7" />
        <path d="M216,120 L230,129" opacity="0.7" />
        <path d="M216,150 L230,159" opacity="0.7" />
        <path d="M216,180 L230,189" opacity="0.7" />
        <path d="M216,210 L230,219" opacity="0.7" />
        <path d="M216,240 L230,249" opacity="0.7" />
        <path d="M216,270 L230,279" opacity="0.7" />
        <path d="M216,300 L230,309" opacity="0.7" />
      </g>

      {/* TOP edge of the page block (thin) */}
      <path d="M92,54 L214,74 L232,84 L110,64 Z" fill="#f3ecdb" stroke="#d9ceb4" strokeWidth="0.8" />

      {/* COVER FACE (front) */}
      <path d="M92,54 L214,74 L214,320 L92,300 Z" fill={`url(#${uid}-face)`} />
      {/* cover bevel edge along the front */}
      <path d="M92,54 L214,74 L214,320 L92,300 Z" fill="none" stroke="#000000" strokeOpacity="0.18" strokeWidth="2" />
      {/* gloss sweep */}
      <path d="M92,54 L214,74 L214,320 L92,300 Z" fill={`url(#${uid}-gloss)`} />
      {/* spine hinge line */}
      <path d="M104,58 L104,302" stroke="#000000" strokeOpacity="0.16" strokeWidth="2" />
      <path d="M108,59 L108,303" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1" />

      {/* embossed title panel (follows the cover's perspective) */}
      <path
        d="M120,104 L200,116 L200,214 L120,202 Z"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="1.6"
      />
      <path
        d="M120,104 L200,116 L200,214 L120,202 Z"
        fill="#ffffff"
        opacity="0.06"
      />

      {/* initials (slightly sheared to sit on the cover plane) */}
      <g transform="translate(160,162) skewY(8.5)">
        <text
          x="0"
          y="0"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="52"
          fontWeight="700"
          fill="#ffffff"
          opacity="0.97"
        >
          {initials}
        </text>
      </g>

      {/* brand sprout near the base of the cover */}
      <g transform="translate(150,250) skewY(8.5)" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.92" fill="none">
        <path d="M0,18 V-8" />
        <path d="M0,4 C0,-8 8,-14 18,-14 C18,-4 10,4 0,4Z" fill="#ffffff" opacity="0.9" stroke="none" />
        <path d="M0,8 C0,-4 -8,-10 -18,-10 C-18,0 -10,8 0,8Z" fill="#ffffff" opacity="0.72" stroke="none" />
      </g>

      {/* caption on the cover */}
      <g transform="translate(153,292) skewY(8.5)">
        <text x="0" y="0" textAnchor="middle" fontFamily="Verdana, sans-serif" fontSize="10" letterSpacing="1.4" fill="#ffffff" opacity="0.8">
          EDUVATE KIDS
        </text>
      </g>
    </svg>
  )
}
