'use client'

/**
 * "Why Reading Matters" hero card — a premium, animated illustration of two happy
 * Muslim children (a girl in hijab and a boy) reading together, with a success
 * banner (trophy + certificate), floating knowledge sparkles, a swaying tree and
 * a little mosque. The three benefits scroll as an animated marquee inside the
 * scene. Count-up stats below. Self-contained SVG + scoped CSS, reduced-motion aware.
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
      const eased = 1 - Math.pow(1 - t, 3)
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
    'Builds Islamic identity through stories',
    'Expands vocabulary and comprehension',
    'Creates family moments and shared reflection',
  ]
  // Duplicate the list so the marquee loops seamlessly.
  const marquee = [...benefits, ...benefits]

  return (
    <div ref={ref} className="glass-card card-hover relative overflow-hidden rounded-3xl p-5 sm:p-7 shadow-soft hover:-translate-y-1 hover:shadow-[0_30px_70px_rgba(26,122,60,0.18)]">
      <style jsx>{`
        @keyframes rm-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes rm-sway { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        @keyframes rm-twinkle { 0%,100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes rm-draw { to { stroke-dashoffset: 0; } }
        @keyframes rm-spin { to { transform: rotate(360deg); } }
        @keyframes rm-pop { 0% { transform: scale(0) rotate(-12deg); opacity: 0; } 60% { transform: scale(1.12) rotate(4deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes rm-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .rm-float { animation: rm-float 4s ease-in-out infinite; }
        .rm-sway { animation: rm-sway 5s ease-in-out infinite; transform-origin: bottom center; }
        .rm-twinkle { animation: rm-twinkle 2.4s ease-in-out infinite; }
        .rm-spin { animation: rm-spin 18s linear infinite; transform-origin: center; }
        .rm-pop { animation: rm-pop .7s cubic-bezier(.22,1,.36,1) .5s both; transform-origin: center; }
        .rm-page { stroke-dasharray: 60; stroke-dashoffset: 60; animation: rm-draw 1.1s ease-out .3s forwards; }
        .rm-track { display: flex; width: max-content; animation: rm-marquee 16s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rm-float, .rm-sway, .rm-twinkle, .rm-spin, .rm-pop, .rm-track { animation: none !important; }
          .rm-page { stroke-dashoffset: 0 !important; animation: none !important; }
          .rm-track { flex-wrap: wrap; }
        }
      `}</style>

      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="text-primaryDark">Why Reading Matters</span>
        <span className="rounded-full bg-gradient-to-r from-emerald-100 to-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
          Faith · Language · Character
        </span>
      </div>

      {/* Animated scene */}
      <div className="relative mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-amber-50/40 to-white p-4">
        <svg viewBox="0 0 340 200" className="w-full" role="img" aria-label="A Muslim girl and boy reading happily and earning a reading award">
          <defs>
            <linearGradient id="rm-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EAF6EE" />
              <stop offset="100%" stopColor="#FBF8F1" />
            </linearGradient>
            <linearGradient id="rm-book" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2FA25A" />
              <stop offset="100%" stopColor="#0D5C2E" />
            </linearGradient>
            <linearGradient id="rm-book2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5A9BEA" />
              <stop offset="100%" stopColor="#265596" />
            </linearGradient>
            <radialGradient id="rm-sun" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#F6D68A" />
              <stop offset="100%" stopColor="#F6D68A" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="340" height="200" fill="url(#rm-sky)" />

          {/* sun with rotating rays */}
          <circle cx="298" cy="40" r="44" fill="url(#rm-sun)" />
          <g className="rm-spin" opacity="0.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={i} x="296" y="8" width="4" height="11" rx="2" fill="#E0B45A" transform={`rotate(${i * 45} 298 40)`} />
            ))}
          </g>
          <circle cx="298" cy="40" r="14" fill="#F0C766" />

          {/* mosque */}
          <g opacity="0.85">
            <rect x="16" y="126" width="42" height="30" rx="3" fill="#B8D4C0" />
            <path d="M37 108c7 5 11 10 11 15 0 5-4 8-11 8s-11-3-11-8c0-5 4-10 11-15z" fill="#1A7A3C" />
            <rect x="13" y="114" width="4" height="42" rx="2" fill="#0D5C2E" />
            <circle cx="15" cy="112" r="3" fill="#C9963A" />
            <rect x="58" y="114" width="4" height="42" rx="2" fill="#0D5C2E" />
            <circle cx="60" cy="112" r="3" fill="#C9963A" />
          </g>

          {/* swaying tree */}
          <g className="rm-sway">
            <rect x="256" y="120" width="8" height="40" rx="3" fill="#8a5a33" />
            <circle cx="260" cy="110" r="24" fill="#2FA25A" />
            <circle cx="244" cy="118" r="15" fill="#1A7A3C" />
            <circle cx="276" cy="118" r="15" fill="#37B0A9" />
            <circle cx="254" cy="99" r="13" fill="#3fbf6a" />
          </g>

          {/* ground */}
          <path d="M0 162 h340 v38 h-340 z" fill="#DCEBE1" />
          <path d="M0 162 q170 -14 340 0" fill="none" stroke="#B8D4C0" strokeWidth="2" />

          {/* success banner: a certificate + trophy that pops in */}
          <g className="rm-pop">
            <g transform="translate(150,26)">
              {/* certificate */}
              <rect x="-34" y="-14" width="46" height="34" rx="3" fill="#FFFDF6" stroke="#E0B45A" strokeWidth="2" />
              <path d="M-28 -6 h34 M-28 0 h34 M-28 6 h22" stroke="#C9963A" strokeWidth="1.5" opacity="0.7" />
              <circle cx="-6" cy="12" r="6" fill="#C9963A" />
              <path d="M-9 15 l-2 8 3 -2 3 2 -2 -8z" fill="#C9963A" />
              {/* trophy */}
              <g transform="translate(28,0)">
                <path d="M-8 -12 h16 v6 a8 8 0 01-16 0z" fill="#E0B45A" />
                <path d="M-8 -10 h-4 a4 4 0 004 5M8 -10 h4 a4 4 0 01-4 5" fill="none" stroke="#E0B45A" strokeWidth="2" />
                <rect x="-2" y="-2" width="4" height="6" fill="#C9963A" />
                <rect x="-6" y="4" width="12" height="3" rx="1.5" fill="#C9963A" />
              </g>
            </g>
          </g>

          {/* ── GIRL (hijab), reading, happy ── */}
          <g transform="translate(118,0)">
            {/* body / dress */}
            <path d="M2 162 q0 -30 20 -30 q20 0 20 30 z" fill="#7C5CBF" />
            {/* hijab */}
            <path d="M8 128 a14 14 0 0128 0 q0 12 -4 18 l-6 -2 q2 -8 2 -16 a10 10 0 00-14 0 q0 8 2 16 l-6 2 q-4 -6 -4 -18z" fill="#C65B6B" />
            {/* face */}
            <circle cx="22" cy="126" r="11" fill="#F3C9A6" />
            <path d="M12 124 a10 10 0 0120 0 q0 10 -10 14 q-10 -4 -10 -14z" fill="none" />
            {/* happy eyes + smile */}
            <circle cx="18" cy="126" r="1.5" fill="#3a2b22" />
            <circle cx="26" cy="126" r="1.5" fill="#3a2b22" />
            <path d="M18 131 q4 4 8 0" fill="none" stroke="#8a4a3a" strokeWidth="1.6" strokeLinecap="round" />
            {/* rosy cheeks */}
            <circle cx="15" cy="130" r="2" fill="#EFA9A9" opacity="0.6" />
            <circle cx="29" cy="130" r="2" fill="#EFA9A9" opacity="0.6" />
            {/* open book (purple/green) */}
            <g className="rm-float">
              <path d="M0 152 l22 -6 v18 l-22 6 z" fill="url(#rm-book)" />
              <path d="M44 152 l-22 -6 v18 l22 6 z" fill="#1A7A3C" />
              <path d="M22 146 v18" stroke="#0b3d1f" strokeWidth="1.4" />
              <path className="rm-page" d="M6 154 l12 -3" stroke="#fff" strokeWidth="1.4" opacity="0.85" />
              <path className="rm-page" d="M6 159 l12 -3" stroke="#fff" strokeWidth="1.4" opacity="0.7" />
              <path className="rm-page" d="M26 151 l12 3" stroke="#fff" strokeWidth="1.4" opacity="0.85" />
              <path className="rm-page" d="M26 156 l12 3" stroke="#fff" strokeWidth="1.4" opacity="0.7" />
            </g>
          </g>

          {/* ── BOY (cap), reading, happy ── */}
          <g transform="translate(196,8)">
            <path d="M2 154 q0 -28 19 -28 q19 0 19 28 z" fill="#2F9E98" />
            {/* head + kufi cap */}
            <circle cx="21" cy="120" r="11" fill="#EBB98C" />
            <path d="M10 116 q11 -13 22 0 q-11 -5 -22 0z" fill="#0D5C2E" />
            <path d="M10 116 q11 -7 22 0" fill="none" stroke="#C9963A" strokeWidth="1.6" />
            {/* happy eyes + smile */}
            <circle cx="17" cy="121" r="1.5" fill="#3a2b22" />
            <circle cx="25" cy="121" r="1.5" fill="#3a2b22" />
            <path d="M17 126 q4 4 8 0" fill="none" stroke="#8a4a3a" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="14" cy="125" r="2" fill="#EFA9A9" opacity="0.55" />
            <circle cx="28" cy="125" r="2" fill="#EFA9A9" opacity="0.55" />
            {/* open book (blue) */}
            <g className="rm-float" style={{ animationDelay: '.5s' }}>
              <path d="M0 148 l20 -6 v17 l-20 6 z" fill="url(#rm-book2)" />
              <path d="M40 148 l-20 -6 v17 l20 6 z" fill="#265596" />
              <path d="M20 142 v17" stroke="#173a63" strokeWidth="1.4" />
              <path className="rm-page" d="M5 150 l11 -3" stroke="#fff" strokeWidth="1.4" opacity="0.85" />
              <path className="rm-page" d="M5 155 l11 -3" stroke="#fff" strokeWidth="1.4" opacity="0.7" />
              <path className="rm-page" d="M24 147 l11 3" stroke="#fff" strokeWidth="1.4" opacity="0.85" />
              <path className="rm-page" d="M24 152 l11 3" stroke="#fff" strokeWidth="1.4" opacity="0.7" />
            </g>
          </g>

          {/* knowledge sparkles rising between the kids */}
          {[
            { x: 168, y: 96, d: '0s', c: '#C9963A' },
            { x: 186, y: 78, d: '.6s', c: '#2FA25A' },
            { x: 150, y: 84, d: '.9s', c: '#37B0A9' },
            { x: 200, y: 100, d: '1.2s', c: '#C9963A' },
          ].map((s, i) => (
            <path key={i} className="rm-twinkle" style={{ animationDelay: s.d }}
              d={`M${s.x} ${s.y - 5} l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z`}
              fill={s.c} />
          ))}
        </svg>

        {/* animated marquee of benefits, inside the scene */}
        <div className="relative mt-2 overflow-hidden">
          <div className="rm-track gap-6">
            {marquee.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-emerald-800">
                <svg className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.6h7.6z" /></svg>
                {b}
              </span>
            ))}
          </div>
          {/* soft fade edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent" />
        </div>
      </div>

      {/* animated stats */}
      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
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
