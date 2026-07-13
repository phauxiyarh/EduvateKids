'use client'

import logo from '../../assets/logo.png'

/**
 * Self-contained SVG placeholder shown when a catalog item has no cover image
 * yet. Drawn as a realistic hardcover book seen at a 3/4 angle: a front cover
 * facing the viewer, a shaded spine turning away to the left, and a block of
 * page edges along the right + bottom for real thickness. The cover is a plain
 * green gradient carrying the Eduvate Kids logo, the word "Book", and the brand
 * name. Pure SVG — scales to any container and embeds the real logo image.
 */
export function BookPlaceholder({
  title = '',
  className = '',
}: {
  title?: string
  className?: string
}) {
  // A single, on-brand green identity for every placeholder (plain + consistent).
  const uid = 'bookph'
  const logoSrc = (logo as { src: string }).src

  return (
    <svg
      viewBox="0 0 300 300"
      className={className}
      role="img"
      aria-label={title ? `${title} (no cover image yet)` : 'Book placeholder'}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Front cover: green, lit from the top-left. */}
        <linearGradient id={`${uid}-cover`} x1="0" y1="0" x2="0.75" y2="1">
          <stop offset="0%" stopColor="#3BB56C" />
          <stop offset="45%" stopColor="#22935A" />
          <stop offset="100%" stopColor="#0D5C2E" />
        </linearGradient>
        {/* Spine: darker green (turned away from the light). */}
        <linearGradient id={`${uid}-spine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0A4423" />
          <stop offset="100%" stopColor="#12692F" />
        </linearGradient>
        {/* Page-edge block. */}
        <linearGradient id={`${uid}-pages`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFDF7" />
          <stop offset="100%" stopColor="#DACFB8" />
        </linearGradient>
        <linearGradient id={`${uid}-pagesBottom`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3ECDB" />
          <stop offset="100%" stopColor="#CFC4AC" />
        </linearGradient>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBF8F1" />
          <stop offset="100%" stopColor="#F1EADB" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#20291F" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#20291F" stopOpacity="0" />
        </radialGradient>
        {/* Soft sheen sweeping the cover. */}
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}-coverClip`}>
          <path d="M96,44 L250,66 L250,232 L96,254 Z" />
        </clipPath>
      </defs>

      {/* backdrop */}
      <rect width="300" height="300" fill={`url(#${uid}-bg)`} />

      {/* cast shadow */}
      <ellipse cx="158" cy="266" rx="104" ry="18" fill={`url(#${uid}-shadow)`} />

      {/*
        3/4 perspective. The book sits with its spine on the left (angled toward
        us) and the front cover facing right. Coordinates form a gentle isometric
        parallelogram so it reads as a solid 3D object.
      */}

      {/* ---- page edges: right side (fore-edge) ---- */}
      <path d="M250,66 L266,74 L266,240 L250,232 Z" fill={`url(#${uid}-pages)`} stroke="#CFC4AC" strokeWidth="1" />
      <g stroke="#C9BEA6" strokeWidth="1" opacity="0.55">
        <path d="M252,72 L264,79" />
        <path d="M252,86 L264,93" />
        <path d="M252,100 L264,107" />
        <path d="M252,200 L264,207" />
        <path d="M252,214 L264,221" />
      </g>

      {/* ---- page edges: bottom ---- */}
      <path d="M96,254 L250,232 L266,240 L112,262 Z" fill={`url(#${uid}-pagesBottom)`} stroke="#CFC4AC" strokeWidth="1" />

      {/* ---- spine (left face, turning away) ---- */}
      <path d="M80,60 L96,44 L96,254 L80,270 Z" fill={`url(#${uid}-spine)`} stroke="#0A3D1F" strokeWidth="1.5" />
      {/* spine bands */}
      <g stroke="#ffffff" strokeOpacity="0.16" strokeWidth="2">
        <path d="M82,72 L94,58" />
        <path d="M82,246 L94,232" />
      </g>

      {/* ---- front cover (the face) ---- */}
      <path d="M96,44 L250,66 L250,232 L96,254 Z" fill={`url(#${uid}-cover)`} stroke="#0A3D1F" strokeWidth="1.5" />
      {/* inner border frame */}
      <path d="M110,64 L236,82 L236,216 L110,234 Z" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.6" />
      {/* cover sheen (clipped to the cover) */}
      <path d="M96,44 L250,66 L250,232 L96,254 Z" fill={`url(#${uid}-sheen)`} clipPath={`url(#${uid}-coverClip)`} />

      {/*
        Cover contents, skewed to sit flat on the tilted cover plane. The cover's
        top edge rises ~22px over its width, so we rotate content ~ -8deg and
        place it about the cover centre (~173,149).
      */}
      <g transform="translate(173,150) rotate(-8.2)" clipPath={`url(#${uid}-coverClip)`}>
        {/* logo badge */}
        <circle cx="0" cy="-44" r="34" fill="#ffffff" opacity="0.16" />
        <circle cx="0" cy="-44" r="34" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" />
        <image href={logoSrc} x="-28" y="-72" width="56" height="56" preserveAspectRatio="xMidYMid meet" />

        {/* the word "Book" */}
        <text
          x="0" y="24" textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="30" fontWeight="700" fill="#ffffff" opacity="0.98"
        >
          Book
        </text>

        {/* divider */}
        <path d="M-40,40 L40,40" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.4" />

        {/* brand name */}
        <text
          x="0" y="60" textAnchor="middle"
          fontFamily="Verdana, sans-serif"
          fontSize="11" letterSpacing="2" fontWeight="700"
          fill="#ffffff" opacity="0.9"
        >
          EDUVATE KIDS
        </text>
      </g>
    </svg>
  )
}
