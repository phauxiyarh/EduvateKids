'use client'

/**
 * A self-contained SVG placeholder shown when a catalog item has no cover image
 * yet. Drawn as a simple, chunky children's BOARD BOOK stood slightly open at an
 * angle: thick rounded pages, a padded cover, gentle 3D shading and a soft cast
 * shadow. The cover reads "Book" and carries a small brand sprout. Pure SVG,
 * scales to any container, and the cover colour varies by title so items look
 * distinct.
 */
export function BookPlaceholder({
  title = '',
  className = '',
}: {
  title?: string
  className?: string
}) {
  // Deterministic, on-brand cover colour from the title.
  const palettes = [
    { a: '#2FA25A', b: '#1A7A3C', dk: '#0D5C2E' }, // forest green
    { a: '#37B0A9', b: '#1E8C86', dk: '#12615C' }, // teal
    { a: '#9B82DE', b: '#6E52C0', dk: '#4C3585' }, // violet
    { a: '#E0B45A', b: '#C9963A', dk: '#A9781F' }, // gold
    { a: '#E27A88', b: '#C65B6B', dk: '#8F3B49' }, // rose
    { a: '#5A9BEA', b: '#3B7DD8', dk: '#265596' }, // blue
  ]
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) % 997
  const pal = palettes[hash % palettes.length]
  const uid = `bb${hash}`

  return (
    <svg
      viewBox="0 0 300 300"
      className={className}
      role="img"
      aria-label={title ? `${title} (no cover image yet)` : 'Book placeholder'}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`${uid}-cover`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={pal.a} />
          <stop offset="60%" stopColor={pal.b} />
          <stop offset="100%" stopColor={pal.dk} />
        </linearGradient>
        <linearGradient id={`${uid}-coverR`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={pal.b} />
          <stop offset="100%" stopColor={pal.dk} />
        </linearGradient>
        {/* creamy page block */}
        <linearGradient id={`${uid}-page`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFDF7" />
          <stop offset="100%" stopColor="#EFE7D6" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#20291F" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#20291F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBF8F1" />
          <stop offset="100%" stopColor="#F1EADB" />
        </linearGradient>
      </defs>

      {/* backdrop */}
      <rect width="300" height="300" fill={`url(#${uid}-bg)`} />

      {/* cast shadow under the standing book */}
      <ellipse cx="150" cy="248" rx="98" ry="20" fill={`url(#${uid}-shadow)`} />

      {/*
        A board book standing slightly open, viewed from the front-top.
        Two thick covers meeting at the spine (centre), each with a rounded page
        block behind it. Left and right are mirrored for the open-book look.
      */}

      {/* ---- LEFT half ---- */}
      {/* thick page block (left) */}
      <path
        d="M150,64 L64,84 Q52,88 52,100 L52,196 Q52,208 64,210 L150,228 Z"
        fill={`url(#${uid}-page)`}
        stroke="#E3DAC7"
        strokeWidth="1.5"
      />
      {/* page-edge lines (left) */}
      <g stroke="#E3DAC7" strokeWidth="1.4" opacity="0.8">
        <path d="M150,74 L60,93" />
        <path d="M150,84 L57,102" />
        <path d="M150,94 L56,112" />
      </g>
      {/* cover (left) sits slightly proud of the pages */}
      <path
        d="M150,58 L60,78 Q46,82 46,96 L46,196 Q46,210 60,214 L150,234 Z"
        fill={`url(#${uid}-cover)`}
        stroke={pal.dk}
        strokeWidth="1.5"
      />
      {/* rounded cover highlight (left) */}
      <path d="M150,66 L66,85 Q57,88 57,98 L57,150" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" />

      {/* ---- RIGHT half ---- */}
      {/* thick page block (right) */}
      <path
        d="M150,64 L236,84 Q248,88 248,100 L248,196 Q248,208 236,210 L150,228 Z"
        fill={`url(#${uid}-page)`}
        stroke="#E3DAC7"
        strokeWidth="1.5"
      />
      <g stroke="#E3DAC7" strokeWidth="1.4" opacity="0.8">
        <path d="M150,74 L240,93" />
        <path d="M150,84 L243,102" />
        <path d="M150,94 L244,112" />
      </g>
      {/* cover (right) */}
      <path
        d="M150,58 L240,78 Q254,82 254,96 L254,196 Q254,210 240,214 L150,234 Z"
        fill={`url(#${uid}-coverR)`}
        stroke={pal.dk}
        strokeWidth="1.5"
      />

      {/* spine crease down the centre */}
      <path d="M150,58 L150,234" stroke={pal.dk} strokeWidth="3" opacity="0.55" />
      <path d="M150,58 L150,234" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />

      {/* title panel on the right cover */}
      <g transform="translate(202,150) rotate(6)">
        <rect x="-46" y="-30" width="92" height="60" rx="9" fill="#ffffff" opacity="0.12" />
        <rect x="-46" y="-30" width="92" height="60" rx="9" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.6" />
        {/* brand sprout */}
        <g stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.95" transform="translate(0,-6)">
          <path d="M0,2 V-12" />
          <path d="M0,-4 C0,-13 6,-18 15,-18 C15,-9 8,-4 0,-4Z" fill="#ffffff" opacity="0.9" stroke="none" />
          <path d="M0,-1 C0,-10 -6,-15 -15,-15 C-15,-6 -8,-1 0,-1Z" fill="#ffffff" opacity="0.72" stroke="none" />
        </g>
        {/* the word "Book" */}
        <text
          x="0"
          y="22"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="20"
          fontWeight="700"
          fill="#ffffff"
          opacity="0.97"
        >
          Book
        </text>
      </g>

      {/* small caption on the left cover */}
      <g transform="translate(98,150) rotate(-6)">
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fontFamily="Verdana, sans-serif"
          fontSize="10"
          letterSpacing="1.2"
          fill="#ffffff"
          opacity="0.8"
        >
          EDUVATE KIDS
        </text>
      </g>
    </svg>
  )
}
