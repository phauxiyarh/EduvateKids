'use client'

/**
 * "Why Reading Matters" hero card — a premium, animated illustration of a Muslim
 * child reading and growing, with floating knowledge sparkles, a rising sprout,
 * benefit rows, and count-up stats. Self-contained SVG + scoped CSS keyframes,
 * brand-coloured, and fully reduced-motion aware.
 */
import { useEffect, useRef, useState } from 'react'

function useCountUp(target: number, run: boolean, duration = 1400) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!run) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, duration])
  return value
}

export function ReadingMattersCard() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setInView(true); io.disconnect() } }),
      { threshold: 0.25 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const titles = useCountUp(400, inView)
  const kits = useCountUp(50, inView)
  const events = useCountUp(10, inView)

  const benefits = [
    { text: 'Builds Islamic identity through stories.', icon: 'M12 3l2.09 6.26L20 9.27l-5 3.64L16.18 20 12 16.9 7.82 20 9 12.91l-5-3.64 5.91.01L12 3z' },
    { text: 'Expands vocabulary and comprehension.', icon: 'M12 6.5C10.5 5.3 8.5 4.8 6 4.8c-.9 0-1.7.1-2.5.3v13c.8-.2 1.6-.3 2.5-.3 2.5 0 4.5.5 6 1.7 1.5-1.2 3.5-1.7 6-1.7.9 0 1.7.1 2.5.3v-13c-.8-.2-1.6-.3-2.5-.3-2.5 0-4.5.5-6 1.7zM12 6.5v12.3' },
    { text: 'Creates family moments and shared reflection.', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z' },
  ]

  return (
    <div ref={ref} className="glass-card card-hover relative overflow-hidden rounded-3xl p-5 sm:p-7 shadow-soft hover:-translate-y-1 hover:shadow-[0_30px_70px_rgba(26,122,60,0.18)]">
      <style jsx>{`
        @keyframes rm-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes rm-sway { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        @keyframes rm-twinkle { 0%,100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes rm-rise { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes rm-draw { to { stroke-dashoffset: 0; } }
        @keyframes rm-spin { to { transform: rotate(360deg); } }
        .rm-float { animation: rm-float 4s ease-in-out infinite; }
        .rm-sway { animation: rm-sway 5s ease-in-out infinite; transform-origin: bottom center; }
        .rm-twinkle { animation: rm-twinkle 2.4s ease-in-out infinite; }
        .rm-spin { animation: rm-spin 18s linear infinite; transform-origin: center; }
        .rm-rise { animation: rm-rise .6s ease-out both; }
        .rm-page { stroke-dasharray: 60; stroke-dashoffset: 60; animation: rm-draw 1.1s ease-out .3s forwards; }
        @media (prefers-reduced-motion: reduce) {
          .rm-float, .rm-sway, .rm-twinkle, .rm-spin, .rm-rise { animation: none !important; }
          .rm-page { stroke-dashoffset: 0 !important; animation: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="text-primaryDark">Why Reading Matters</span>
        <span className="rounded-full bg-gradient-to-r from-emerald-100 to-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
          Faith · Language · Character
        </span>
      </div>

      {/* Animated scene: a child reading under a growing tree, with a little
          mosque, a rising sprout of knowledge, and floating sparkles. */}
      <div className="relative mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-amber-50/40 to-white p-4">
        <svg viewBox="0 0 340 190" className="w-full" role="img" aria-label="A child reading and growing in knowledge">
          <defs>
            <linearGradient id="rm-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EAF6EE" />
              <stop offset="100%" stopColor="#FBF8F1" />
            </linearGradient>
            <linearGradient id="rm-book" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2FA25A" />
              <stop offset="100%" stopColor="#0D5C2E" />
            </linearGradient>
            <radialGradient id="rm-sun" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#F6D68A" />
              <stop offset="100%" stopColor="#F6D68A" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="340" height="190" fill="url(#rm-sky)" />
          {/* warm sun glow, slowly rotating rays */}
          <circle cx="288" cy="44" r="46" fill="url(#rm-sun)" />
          <g className="rm-spin" opacity="0.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={i} x="286" y="10" width="4" height="12" rx="2" fill="#E0B45A"
                transform={`rotate(${i * 45} 288 44)`} />
            ))}
          </g>
          <circle cx="288" cy="44" r="15" fill="#F0C766" />

          {/* little mosque on the horizon */}
          <g opacity="0.85">
            <rect x="20" y="120" width="46" height="34" rx="3" fill="#B8D4C0" />
            <path d="M43 100c8 6 12 11 12 16 0 6-5 9-12 9s-12-3-12-9c0-5 4-10 12-16z" fill="#1A7A3C" />
            <rect x="17" y="108" width="4" height="46" rx="2" fill="#0D5C2E" />
            <circle cx="19" cy="106" r="3" fill="#C9963A" />
            <rect x="66" y="108" width="4" height="46" rx="2" fill="#0D5C2E" />
            <circle cx="68" cy="106" r="3" fill="#C9963A" />
          </g>

          {/* growing tree (gentle sway) */}
          <g className="rm-sway">
            <rect x="250" y="118" width="8" height="40" rx="3" fill="#8a5a33" />
            <circle cx="254" cy="108" r="26" fill="#2FA25A" />
            <circle cx="236" cy="116" r="16" fill="#1A7A3C" />
            <circle cx="272" cy="116" r="16" fill="#37B0A9" />
            <circle cx="248" cy="96" r="14" fill="#3fbf6a" />
          </g>

          {/* ground */}
          <path d="M0 158 h340 v32 h-340 z" fill="#DCEBE1" />
          <path d="M0 158 q170 -14 340 0" fill="none" stroke="#B8D4C0" strokeWidth="2" />

          {/* rising sprout of knowledge in front */}
          <g className="rm-float">
            <path d="M120 158 v-16" stroke="#1A7A3C" strokeWidth="3" strokeLinecap="round" />
            <path d="M120 150 c0 -9 6 -14 15 -14 c0 8 -7 14 -15 14z" fill="#2FA25A" />
            <path d="M120 154 c0 -9 -6 -14 -15 -14 c0 8 7 14 15 14z" fill="#37B0A9" />
          </g>

          {/* child sitting, reading an open book */}
          <g>
            {/* body */}
            <path d="M150 158 q0 -30 22 -30 q22 0 22 30 z" fill="#5B7C9D" />
            {/* head + simple cap */}
            <circle cx="172" cy="120" r="13" fill="#F3C9A6" />
            <path d="M159 116 q13 -14 26 0 q-13 -5 -26 0z" fill="#2B2B2B" />
            <path d="M159 116 q13 -8 26 0" fill="none" stroke="#C9963A" strokeWidth="2" />
            {/* arms holding the book */}
            <path d="M154 150 q8 6 18 4" fill="none" stroke="#F3C9A6" strokeWidth="6" strokeLinecap="round" />
            <path d="M190 150 q-8 6 -18 4" fill="none" stroke="#F3C9A6" strokeWidth="6" strokeLinecap="round" />
            {/* open book */}
            <g className="rm-float">
              <path d="M150 150 l22 -6 v20 l-22 6 z" fill="url(#rm-book)" />
              <path d="M194 150 l-22 -6 v20 l22 6 z" fill="#1A7A3C" />
              <path d="M172 144 v20" stroke="#0b3d1f" strokeWidth="1.5" />
              {/* drawn text lines on the pages */}
              <path className="rm-page" d="M156 152 l12 -3" stroke="#ffffff" strokeWidth="1.5" opacity="0.85" />
              <path className="rm-page" d="M156 157 l12 -3" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
              <path className="rm-page" d="M176 149 l12 3" stroke="#ffffff" strokeWidth="1.5" opacity="0.85" />
              <path className="rm-page" d="M176 154 l12 3" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
            </g>
          </g>

          {/* floating knowledge sparkles rising from the book */}
          {[
            { x: 176, y: 118, d: '0s', c: '#C9963A' },
            { x: 196, y: 100, d: '.6s', c: '#2FA25A' },
            { x: 210, y: 122, d: '1.1s', c: '#37B0A9' },
            { x: 158, y: 104, d: '.9s', c: '#C9963A' },
          ].map((s, i) => (
            <path key={i} className="rm-twinkle"
              style={{ animationDelay: s.d }}
              d={`M${s.x} ${s.y - 5} l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z`}
              fill={s.c} />
          ))}
        </svg>

        <p className="mt-1 text-sm leading-relaxed text-inkMuted" style={{ color: '#5C6B5E' }}>
          A few pages a day nurture empathy, strengthen language, and connect
          children to their faith through stories, building confidence, curiosity,
          and lifelong learning habits.
        </p>
      </div>

      {/* benefits */}
      <div className="mt-5 grid gap-2.5">
        {benefits.map((b, i) => (
          <div
            key={b.text}
            className={inView ? 'rm-rise' : ''}
            style={{ animationDelay: `${0.15 + i * 0.12}s` }}
          >
            <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white/70 px-3 py-2.5">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-sm">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={b.icon} />
                </svg>
              </span>
              <span className="text-sm font-medium text-primaryDark">{b.text}</span>
            </div>
          </div>
        ))}
      </div>

      {/* animated stats */}
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        {[
          { value: titles, suffix: '+', label: 'Curated Titles' },
          { value: kits, suffix: '+', label: 'Learning Kits' },
          { value: events, suffix: '+', label: 'Events Monthly' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/50 px-2 py-3 shadow-soft">
            <h3 className="bg-gradient-to-r from-emerald-600 to-green-700 bg-clip-text text-2xl font-extrabold text-transparent">
              {s.value}{s.suffix}
            </h3>
            <p className="mt-0.5 text-[11px] font-semibold text-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
