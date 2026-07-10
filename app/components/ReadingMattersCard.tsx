'use client'

/**
 * "Rooted in Faith. Growing in Knowledge" hero card — a premium, choreographed
 * SVG scene of two happy Muslim children (a girl in hijab, a boy in a kufi)
 * reading together and earning a reading award, set in a layered, softly-lit
 * landscape with a mosque and a growing tree. Benefits scroll as a marquee.
 * Count-up stats below. Self-contained inline SVG + scoped CSS, reduced-motion aware.
 */
import { useEffect, useRef, useState } from 'react'

function useCountUp(target: number, run: boolean, duration = 1600) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!run) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target); return
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
      { threshold: 0.2 }
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
  const marquee = [...benefits, ...benefits]

  return (
    <div
      ref={ref}
      className={`reading-card glass-card card-hover relative overflow-hidden rounded-3xl p-5 sm:p-7 shadow-soft hover:-translate-y-1 hover:shadow-[0_30px_70px_rgba(26,122,60,0.18)] ${inView ? 'is-active' : ''}`}
    >
      <style jsx>{`
        /* All animated SVG elements pivot around their own box, not the viewBox. */
        .reading-card :global(svg [class*='rm-']) { transform-box: fill-box; transform-origin: 50% 50%; }
        .reading-card :global(svg .rm-canopy) { transform-box: fill-box; transform-origin: 50% 92%; }
        /* Tree parts pivot on fixed view-box coordinates so the foot never moves:
           trunk rises from its foot on the ground (260,164); the crown emerges
           from the trunk top (260,120); each leaf blooms from its own centre.
           NOTE: these are qualified with 'svg' so they out-specify the generic
           'svg [class*=rm-] { transform-box: fill-box }' rule above — otherwise
           the view-box origin gets clobbered and the pivot flies off (tree then
           appears to grow from the sky). */
        .reading-card :global(svg .rm-trunk) { transform-box: view-box; transform-origin: 260px 164px; }
        .reading-card :global(svg .rm-crown) { transform-box: view-box; transform-origin: 260px 120px; }
        .reading-card :global(svg .rm-leaf) { transform-box: fill-box; transform-origin: 50% 50%; }
        /* Pin the rays and award to view-box coordinates (same specificity fix). */
        .reading-card :global(svg .rm-rays) { transform-box: view-box; transform-origin: 298px 40px; }
        .reading-card :global(svg .rm-awardgrp) { transform-box: view-box; transform-origin: 153px 37px; }

        /* Hide the scene until it scrolls into view, then everything runs on one
           synchronized 15s day-cycle: dim -> kids read -> world brightens ->
           stars + sun appear -> certificate -> peak brightness + big star ->
           dim again, and repeat. Every keyframe below shares the 15s period so
           the beats stay in sync. */
        .reading-card:not(.is-active) :global(.rm-scene) { opacity: 0; }
        .reading-card.is-active :global(.rm-scene) { animation: rm-fadein .6s ease-out both; }

        /* ATMOSPHERE: a dark overlay that lifts as the day brightens. */
        @keyframes rm-atmos {
          0%   { opacity: .55; }   /* dim dawn */
          15%  { opacity: .5; }
          40%  { opacity: .22; }   /* brightening */
          62%  { opacity: .06; }
          78%  { opacity: 0; }     /* peak brightness */
          90%  { opacity: .06; }
          100% { opacity: .55; }   /* fade back to dim -> loop */
        }
        .reading-card.is-active :global(.rm-atmos) { animation: rm-atmos 15s ease-in-out infinite; }

        /* BREATHING kids (steady idle within the cycle). */
        @keyframes rm-breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.6px); } }
        .reading-card.is-active :global(.rm-child) { animation: rm-breathe 4.6s ease-in-out infinite; }
        .reading-card.is-active :global(.rm-child-2) { animation-delay: -1.7s; }

        /* rising knowledge sparkles — fade in with the brightening, drift up. */
        @keyframes rm-sparkcycle {
          0%,18% { opacity: 0; transform: translateY(6px) scale(.5) rotate(0); }
          40%    { opacity: 1; transform: translateY(0) scale(1) rotate(20deg); }
          78%    { opacity: 1; transform: translateY(-6px) scale(1.05) rotate(40deg); }
          92%    { opacity: 0; transform: translateY(-12px) scale(.6) rotate(55deg); }
          100%   { opacity: 0; }
        }
        .reading-card.is-active :global(.rm-spark) { animation: rm-sparkcycle 15s ease-in-out infinite; }

        /* BOOK opens early in the cycle and closes at the end. */
        @keyframes rm-bookcycle {
          0%   { opacity: 0; transform: scale(.55) rotate(-6deg); }
          8%   { opacity: 1; transform: scale(1) rotate(0); }
          90%  { opacity: 1; transform: scale(1) rotate(0); }
          100% { opacity: 0; transform: scale(.55) rotate(-6deg); }
        }
        .reading-card.is-active :global(.rm-book) { animation: rm-bookcycle 15s ease-in-out infinite; }
        /* page text writes on as the child starts reading, clears at cycle end */
        @keyframes rm-pagecycle { 0% { stroke-dashoffset: 40; } 10% { stroke-dashoffset: 40; } 22% { stroke-dashoffset: 0; } 92% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 40; } }
        .reading-card.is-active :global(.rm-page) { stroke-dasharray: 40; animation: rm-pagecycle 15s ease-in-out infinite; }

        /* TREE grows like a real sapling: the trunk rises out of the ground
           (scaleY from a stub, foot fixed), the crown lifts up out of the trunk
           top and swells, and the leaf clusters bloom in for a "filling out"
           feel. At cycle end it recedes back to a stub, then repeats. */

        /* trunk: rises out of the ground, pivoting on its foot at (260,164) */
        @keyframes rm-trunkcycle {
          0%   { transform: scaleY(0.06); }
          6%   { transform: scaleY(0.5); animation-timing-function: cubic-bezier(.3,.9,.4,1); }
          24%  { transform: scaleY(1.03); }
          30%  { transform: scaleY(1); }
          90%  { transform: scaleY(1); }
          100% { transform: scaleY(0.06); }
        }
        .reading-card.is-active :global(.rm-trunk) { animation: rm-trunkcycle 15s ease-in-out infinite; }

        /* crown: emerges from the trunk top (260,120), rising + swelling as the
           trunk pushes it up; slightly lags the trunk so it looks pushed up */
        @keyframes rm-crowncycle {
          0%   { opacity: 0; transform: translateY(24px) scale(0.02); }
          8%   { opacity: 0; transform: translateY(24px) scale(0.02); }
          16%  { opacity: 1; transform: translateY(10px) scale(0.45); animation-timing-function: cubic-bezier(.3,.9,.4,1); }
          26%  { transform: translateY(-2px) scale(1.06); }
          32%  { transform: translateY(0) scale(1); }
          90%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(24px) scale(0.02); }
        }
        .reading-card.is-active :global(.rm-crown) { animation: rm-crowncycle 15s ease-in-out infinite; }

        /* individual leaf clusters pop in (staggered via inline delays) so the
           canopy visibly fills out rather than just scaling as one blob */
        @keyframes rm-leafcycle {
          0%,12% { opacity: 0; transform: scale(0); }
          20%    { opacity: 1; transform: scale(1.12); }
          26%    { transform: scale(1); }
          90%    { opacity: 1; transform: scale(1); }
          100%   { opacity: 0; transform: scale(0); }
        }
        .reading-card.is-active :global(.rm-leaf) { animation: rm-leafcycle 15s ease-in-out infinite both; }
        /* centre-outward ripple as the crown fills in (tiny offsets) */
        .reading-card.is-active :global(.rm-leaf-1) { animation-delay: 0s; }
        .reading-card.is-active :global(.rm-leaf-2) { animation-delay: 0.15s; }
        .reading-card.is-active :global(.rm-leaf-3) { animation-delay: 0.3s; }
        .reading-card.is-active :global(.rm-leaf-4) { animation-delay: 0.45s; }

        @keyframes rm-sway { 0%,100% { transform: rotate(0); } 30% { transform: rotate(-1.6deg); } 70% { transform: rotate(1.6deg); } }
        .reading-card.is-active :global(.rm-canopy) { animation: rm-sway 6.5s ease-in-out infinite; }

        /* SUN: rises + grows in the second half, sinks at the end; rays keep turning. */
        @keyframes rm-suncycle {
          0%   { opacity: 0; transform: translateY(14px) scale(.5); }
          40%  { opacity: 0; transform: translateY(14px) scale(.5); }
          55%  { opacity: 1; transform: translateY(0) scale(1); }
          78%  { opacity: 1; transform: translateY(-2px) scale(1.12); }  /* peak */
          92%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(14px) scale(.5); }
        }
        .reading-card.is-active :global(.rm-sun) { transform-box: view-box; transform-origin: 298px 40px; animation: rm-suncycle 15s ease-in-out infinite; }
        @keyframes rm-rays { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .reading-card.is-active :global(.rm-rays) { animation: rm-rays 16s linear infinite; }

        /* STARS twinkle in as the sky darkens-to-bright transition; brightest at peak. */
        @keyframes rm-starcycle {
          0%   { opacity: 0; transform: scale(.4); }
          30%  { opacity: 0; transform: scale(.4); }
          42%  { opacity: 1; transform: scale(1); }
          62%  { opacity: .85; transform: scale(.92); }
          78%  { opacity: 1; transform: scale(1.1); }   /* peak */
          92%  { opacity: .5; transform: scale(.8); }
          100% { opacity: 0; transform: scale(.4); }
        }
        .reading-card.is-active :global(.rm-star) { transform-box: fill-box; transform-origin: center; animation: rm-starcycle 15s ease-in-out infinite; }
        /* the BIG hero star only blooms at peak brightness */
        @keyframes rm-bigstar {
          0%,66% { opacity: 0; transform: scale(0) rotate(-20deg); }
          74%    { opacity: 1; transform: scale(1.15) rotate(0); }
          82%    { opacity: 1; transform: scale(1) rotate(0); }
          90%    { opacity: 0; transform: scale(.7) rotate(15deg); }
          100%   { opacity: 0; transform: scale(0); }
        }
        .reading-card.is-active :global(.rm-bigstar) { transform-box: fill-box; transform-origin: center; animation: rm-bigstar 15s ease-in-out infinite; }

        /* CERTIFICATE / award pops in during the bright phase, holds, then leaves. */
        @keyframes rm-awardcycle {
          0%,58% { opacity: 0; transform: scale(0) rotate(-8deg); }
          64%    { opacity: 1; transform: scale(1.14) rotate(3deg); }
          68%    { transform: scale(.97); }
          72%    { opacity: 1; transform: scale(1) rotate(0); }
          88%    { opacity: 1; transform: scale(1) rotate(0); }
          96%    { opacity: 0; transform: scale(.85) rotate(6deg); }
          100%   { opacity: 0; transform: scale(0); }
        }
        .reading-card :global(.rm-awardgrp) { opacity: 0; }
        .reading-card.is-active :global(.rm-awardgrp) { animation: rm-awardcycle 15s ease-in-out infinite; }
        @keyframes rm-shine { 0%,70% { opacity: 0; transform: translateX(-34px) rotate(18deg); } 72% { opacity: .5; } 80% { opacity: .5; transform: translateX(72px) rotate(18deg); } 81%,100% { opacity: 0; } }
        .reading-card.is-active :global(.rm-shine) { animation: rm-shine 15s ease-out infinite; }
        @keyframes rm-burst { 0%,66% { opacity: 0; transform: scale(0); } 72% { opacity: 1; transform: scale(1); } 80% { opacity: 0; transform: scale(.5); } 100% { opacity: 0; } }
        .reading-card.is-active :global(.rm-burst) { animation: rm-burst 15s ease-out infinite; }

        /* GLOW halo strengthens toward peak brightness. */
        @keyframes rm-glowcycle { 0%,40% { opacity: .12; } 78% { opacity: .7; } 100% { opacity: .12; } }
        .reading-card.is-active :global(.rm-glow) { animation: rm-glowcycle 15s ease-in-out infinite; }

        @keyframes rm-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .rm-track { display: flex; width: max-content; animation: rm-marquee 26s linear infinite; }
        .reading-card:hover .rm-track { animation-play-state: paused; }
        .reading-card :global(.rm-glow2) { opacity: 0; transition: opacity .4s; }
        .reading-card:hover :global(.rm-glow2) { opacity: .3; }

        @keyframes rm-fadein { from { opacity: 0; } to { opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .reading-card :global(.rm-scene),
          .reading-card :global(.rm-atmos),
          .reading-card :global(.rm-child),
          .reading-card :global(.rm-child-2),
          .reading-card :global(.rm-book),
          .reading-card :global(.rm-trunk),
          .reading-card :global(.rm-crown),
          .reading-card :global(.rm-leaf),
          .reading-card :global(.rm-canopy),
          .reading-card :global(.rm-sun),
          .reading-card :global(.rm-rays),
          .reading-card :global(.rm-glow),
          .reading-card :global(.rm-star),
          .reading-card :global(.rm-bigstar),
          .reading-card :global(.rm-awardgrp),
          .reading-card :global(.rm-shine),
          .reading-card :global(.rm-burst),
          .rm-track { animation: none !important; }
          /* static, fully-lit final frame */
          .reading-card :global(.rm-atmos) { opacity: 0 !important; }
          .reading-card :global(.rm-page) { stroke-dashoffset: 0 !important; }
          .reading-card :global(.rm-book), .reading-card :global(.rm-sun),
          .reading-card :global(.rm-star), .reading-card :global(.rm-awardgrp),
          .reading-card :global(.rm-trunk), .reading-card :global(.rm-crown),
          .reading-card :global(.rm-leaf),
          .reading-card :global(.rm-spark) { opacity: 1 !important; transform: none !important; }
          .reading-card :global(.rm-bigstar), .reading-card :global(.rm-shine),
          .reading-card :global(.rm-burst) { opacity: 0 !important; }
          .rm-track { flex-wrap: wrap; width: 100%; justify-content: center; gap: .25rem 1rem; }
          .rm-track span:nth-child(n+4) { display: none; }
        }
      `}</style>

      {/* Centered motto (replaces the old "Why Reading Matters" header) */}
      <div className="text-center">
        <p className="font-display text-base sm:text-lg font-bold text-emerald-800">Rooted in Faith. Growing in Knowledge.</p>
      </div>

      {/* Scene */}
      <div className="relative mt-4 overflow-hidden rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_0_40px_rgba(26,122,60,0.05)]">
        <svg viewBox="0 0 340 200" className="w-full block" role="img" aria-label="A Muslim girl and boy reading happily and earning a reading award">
          <defs>
            <linearGradient id="rm-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#DFF2E4" />
              <stop offset="55%" stopColor="#F5EEDC" />
              <stop offset="100%" stopColor="#FBF8F1" />
            </linearGradient>
            <radialGradient id="rm-warm" cx="0.88" cy="0.2" r="0.6">
              <stop offset="0%" stopColor="#F9E7B8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#F9E7B8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="rm-sunrad" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#F6D68A" /><stop offset="100%" stopColor="#F6D68A" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="rm-suncore" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0%" stopColor="#FFE9AD" /><stop offset="100%" stopColor="#E9B95C" />
            </radialGradient>
            <linearGradient id="rm-dress" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8A68D6" /><stop offset="100%" stopColor="#5B3E9E" />
            </linearGradient>
            <linearGradient id="rm-tunic" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3AAFA5" /><stop offset="100%" stopColor="#1F7E76" />
            </linearGradient>
            <linearGradient id="rm-hijab" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#D96B7C" /><stop offset="100%" stopColor="#B04A5A" />
            </linearGradient>
            <radialGradient id="rm-skin-g" cx="0.4" cy="0.35" r="0.75">
              <stop offset="0%" stopColor="#F8D4B0" /><stop offset="100%" stopColor="#EEB98E" />
            </radialGradient>
            <radialGradient id="rm-skin-b" cx="0.4" cy="0.35" r="0.75">
              <stop offset="0%" stopColor="#F2C79A" /><stop offset="100%" stopColor="#DDA477" />
            </radialGradient>
            <linearGradient id="rm-bookg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2FA25A" /><stop offset="100%" stopColor="#0D5C2E" />
            </linearGradient>
            <linearGradient id="rm-bookgold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E0B45A" /><stop offset="100%" stopColor="#B27F2E" />
            </linearGradient>
            <radialGradient id="rm-vig" cx="0.5" cy="0.5" r="0.72">
              <stop offset="70%" stopColor="#0D5C2E" stopOpacity="0" />
              <stop offset="100%" stopColor="#0D5C2E" stopOpacity="0.06" />
            </radialGradient>
            {/* 3D mosque materials */}
            <linearGradient id="rm-dome" x1="0.2" y1="0" x2="0.9" y2="1">
              <stop offset="0%" stopColor="#2FA25A" /><stop offset="55%" stopColor="#1A7A3C" /><stop offset="100%" stopColor="#0D5C2E" />
            </linearGradient>
            <linearGradient id="rm-wall" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#DDECE1" /><stop offset="55%" stopColor="#C4DCCB" /><stop offset="100%" stopColor="#A9C8B4" />
            </linearGradient>
            <linearGradient id="rm-minaret" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1A7A3C" /><stop offset="100%" stopColor="#0A4423" />
            </linearGradient>
            {/* dusk veil — deep blue overhead easing to a warm horizon */}
            <linearGradient id="rm-dusk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#243B6B" />
              <stop offset="55%" stopColor="#3E5687" />
              <stop offset="100%" stopColor="#8A7A6B" />
            </linearGradient>
            <clipPath id="rm-cert"><rect x="-34" y="-14" width="46" height="34" rx="3" /></clipPath>
          </defs>

          {/* sky + warm wash */}
          <rect width="340" height="200" fill="url(#rm-sky)" />
          <rect width="340" height="200" fill="url(#rm-warm)" />

          <g className="rm-scene">
            {/* sky glow disc — always present, its opacity is the atmosphere's warmth */}
            <circle className="rm-glow" cx="298" cy="40" r="52" fill="url(#rm-sunrad)" />
            <circle className="rm-glow2" cx="298" cy="40" r="44" fill="url(#rm-sunrad)" />

            {/* stars — appear as the sky brightens, brightest at peak */}
            <g>
              {[
                { x: 96, y: 30, r: 2.2 }, { x: 132, y: 20, r: 1.6 }, { x: 60, y: 48, r: 1.8 },
                { x: 172, y: 26, r: 2 }, { x: 210, y: 18, r: 1.5 }, { x: 250, y: 34, r: 1.7 },
                { x: 118, y: 52, r: 1.4 }, { x: 200, y: 44, r: 1.9 },
              ].map((s, i) => (
                <path key={i} className="rm-star"
                  style={{ animationDelay: `${-(i * 0.4)}s` }}
                  d={`M${s.x} ${s.y - s.r * 2.2} l${s.r * 0.75} ${s.r * 1.6} ${s.r * 1.6} ${s.r * 0.75} -${s.r * 1.6} ${s.r * 0.75} -${s.r * 0.75} ${s.r * 1.6} -${s.r * 0.75} -${s.r * 1.6} -${s.r * 1.6} -${s.r * 0.75} ${s.r * 1.6} -${s.r * 0.75}z`}
                  fill="#FBE7B0" />
              ))}
            </g>

            {/* sun bloom + rays + core (rises + grows in the second half) */}
            <g className="rm-sun">
              <g className="rm-rays" opacity="0.85">
                {Array.from({ length: 12 }).map((_, i) => (
                  <rect key={i}
                    x={i % 2 ? '296.8' : '296.3'} y={i === 0 ? '2' : i % 2 ? '9' : '5'}
                    width={i % 2 ? '2.4' : '3.4'} height={i === 0 ? '16' : i % 2 ? '8' : '13'} rx="1.2"
                    fill="#E0B45A" transform={`rotate(${i * 30} 298 40)`} />
                ))}
              </g>
              <circle cx="298" cy="40" r="14" fill="url(#rm-suncore)" />
            </g>

            {/* the big hero star that blooms at peak brightness */}
            <path className="rm-bigstar"
              d="M156 34 l3 7 7.6 1.1 -5.5 5.4 1.3 7.6 -6.4 -3.6 -6.4 3.6 1.3 -7.6 -5.5 -5.4 7.6 -1.1z"
              fill="#FFEFB4" stroke="#F6D68A" strokeWidth="1" />

            {/* distant hills */}
            <path d="M0 152 Q70 132 150 150 T340 148 L340 163 L0 163 Z" fill="#CFE5D6" opacity="0.7" />
            <path d="M0 158 Q120 146 250 156 T340 155 L340 163 L0 163 Z" fill="#C3DCCB" opacity="0.85" />

            {/* mosque — dimensional / 3D shaded */}
            <g>
              {/* left minaret with cap + finial */}
              <rect x="11" y="108" width="6" height="55" rx="2" fill="url(#rm-minaret)" />
              <path d="M11 108 h6 l-1 -4 h-4z" fill="#0D5C2E" />
              <path d="M11 106 q3 -8 3 -8 q0 0 3 8z" fill="#1A7A3C" />
              <circle cx="14" cy="96" r="2.4" fill="#E0B45A" />
              {/* right minaret */}
              <rect x="59" y="108" width="6" height="55" rx="2" fill="url(#rm-minaret)" />
              <path d="M59 108 h6 l-1 -4 h-4z" fill="#0D5C2E" />
              <path d="M59 106 q3 -8 3 -8 q0 0 3 8z" fill="#1A7A3C" />
              <circle cx="62" cy="96" r="2.4" fill="#E0B45A" />
              {/* main block: lit front face + shaded right side (depth) */}
              <path d="M20 122 h30 v41 h-30z" fill="url(#rm-wall)" />
              <path d="M50 122 l6 4 v37 h-6z" fill="#9BBFA8" />
              {/* cornice: front strip + skewed side piece (no sky sliver) */}
              <path d="M20 120 h30 v4 h-30z" fill="#B7D2C0" />
              <path d="M50 120 l6 4 v4 l-6 -4z" fill="#8FB49B" />
              {/* dome + drum + crescent finial */}
              <rect x="30" y="112" width="12" height="6" rx="2" fill="#B7D2C0" />
              <path d="M36 92 c9 6 13 12 13 18 0 5-5 8-13 8s-13-3-13-8c0-6 4-12 13-18z" fill="url(#rm-dome)" />
              <path d="M30 106 q6 -9 12 -12 q-3 6 -4 13z" fill="#ffffff" opacity="0.18" />
              <rect x="35" y="86" width="2" height="7" fill="#C9963A" />
              <path d="M37.4 82.3 a3 3 0 1 0 .5 5.4 a2.3 2.3 0 1 1 -.5 -5.4z" fill="#E0B45A" />
              {/* arched door + windows (kept on the front face) */}
              <path d="M31 163 v-10 a5 5 0 0110 0 v10z" fill="#0D5C2E" opacity="0.8" />
              <path d="M33 163 v-8 a3 3 0 016 0 v8z" fill="#1A7A3C" opacity="0.5" />
              <path d="M24 140 a3 3 0 016 0 v6 h-6z" fill="#0D5C2E" opacity="0.45" />
              <path d="M44 140 a3 3 0 016 0 v6 h-6z" fill="#0D5C2E" opacity="0.45" />
            </g>

            {/* tree — a real sapling-to-tree growth: the trunk rises out of the
               ground (pivoting on its foot) pushing up the canopy, and the leaf
               clusters bloom in outward from the centre. Foot stays fixed at the
               ground line (y=164), same baseline as the kids. */}
            <g className="rm-tree">
              {/* trunk grows in height from a stub at the ground */}
              <g className="rm-trunk">
                <rect x="256" y="120" width="8" height="44" rx="3" fill="#8a5a33" />
                <rect x="256" y="120" width="3" height="44" rx="1.5" fill="#a06e42" opacity="0.6" />
              </g>
              {/* canopy: the whole crown lifts + scales in as the trunk rises,
                 then the individual leaf clusters pop out for a "filling in" feel */}
              <g className="rm-canopy">
                <g className="rm-crown">
                  <circle className="rm-leaf rm-leaf-1" cx="260" cy="107" r="27" fill="#1A7A3C" />
                  <circle className="rm-leaf rm-leaf-2" cx="242" cy="117" r="16" fill="#0D5C2E" />
                  <circle className="rm-leaf rm-leaf-2" cx="278" cy="117" r="16" fill="#23935F" />
                  <circle className="rm-leaf rm-leaf-3" cx="253" cy="95" r="14" fill="#2FA25A" />
                  <circle className="rm-leaf rm-leaf-3" cx="267" cy="99" r="12" fill="#3fbf6a" />
                  <circle className="rm-leaf rm-leaf-4" cx="265" cy="94" r="8" fill="#7BC98F" opacity="0.55" />
                </g>
              </g>
            </g>

            {/* ground */}
            <path d="M0 163 h340 v37 h-340 z" fill="#DCEBE1" />
            <path d="M0 163 q170 -10 340 0 v6 h-340 z" fill="#E6F1E9" />
            <path d="M0 163 q170 -12 340 0" fill="none" stroke="#B8D4C0" strokeWidth="2" />
            {[70, 96, 300, 315].map((x) => (
              <path key={x} d={`M${x} 162 q1 -4 2 0`} stroke="#9DC4A8" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            ))}

            {/* contact shadows */}
            <ellipse cx="140" cy="164" rx="26" ry="4" fill="#0D5C2E" opacity="0.10" />
            <ellipse cx="217" cy="164" rx="25" ry="4" fill="#0D5C2E" opacity="0.10" />
            <ellipse cx="260" cy="163" rx="22" ry="3.5" fill="#0D5C2E" opacity="0.08" />
            <ellipse cx="38" cy="164" rx="28" ry="4" fill="#0D5C2E" opacity="0.08" />

            {/* success: certificate + trophy, hung on a soft glow disc */}
            <g className="rm-awardgrp">
              <g transform="translate(150,34)">
                <ellipse cx="0" cy="22" rx="34" ry="7" fill="#F6D68A" opacity="0.25" />
                {/* certificate */}
                <g>
                  <rect x="-34" y="-14" width="46" height="34" rx="3" fill="#FFFDF6" stroke="#E0B45A" strokeWidth="2" />
                  <path d="M-28 -6 h34 M-28 0 h34 M-28 6 h22" stroke="#C9963A" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
                  <circle cx="-6" cy="12" r="6" fill="#C9963A" />
                  <path d="M-9 15 l-2 8 3 -2 3 2 -2 -8z" fill="#C9963A" />
                  {/* shine sweep */}
                  <g clipPath="url(#rm-cert)"><rect className="rm-shine" x="-40" y="-24" width="9" height="58" fill="#ffffff" opacity="0.5" /></g>
                </g>
                {/* trophy */}
                <g transform="translate(28,0)">
                  <path d="M-8 -12 h16 v6 a8 8 0 01-16 0z" fill="url(#rm-bookgold)" />
                  <path d="M-8 -10 h-4 a4 4 0 004 5M8 -10 h4 a4 4 0 01-4 5" fill="none" stroke="#E0B45A" strokeWidth="2" strokeLinecap="round" />
                  <rect x="-2" y="-2" width="4" height="6" fill="#C9963A" />
                  <rect x="-6" y="4" width="12" height="3" rx="1.5" fill="#C9963A" />
                  <path d="M0 -9 l1 2 2 .3 -1.5 1.5 .4 2.2 -1.9 -1 -1.9 1 .4 -2.2 -1.5 -1.5 2 -.3z" fill="#FFF3D6" opacity="0.9" />
                </g>
                {/* sparkle burst around the trophy */}
                {[{x:44,y:-14},{x:14,y:-16},{x:36,y:16},{x:52,y:4}].map((s,i)=>(
                  <path key={i} className="rm-burst" d={`M${s.x} ${s.y-4} l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2z`} fill="#E0B45A" />
                ))}
              </g>
            </g>

            {/* ── GIRL (hijab) ── */}
            <g className="rm-girl">
              <g transform="translate(118,0)"><g className="rm-child">
                {/* dress */}
                <path d="M4 162 C4 138 10 128 22 128 C34 128 40 138 40 162 Z" fill="url(#rm-dress)" />
                <ellipse cx="30" cy="140" rx="6" ry="11" fill="#ffffff" opacity="0.16" transform="rotate(-15 30 140)" />
                <ellipse cx="10" cy="150" rx="5" ry="12" fill="#3B2E6B" opacity="0.12" />
                {/* sleeves + hands */}
                <path d="M8 140 Q4 150 8 152" stroke="#5B3E9E" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M36 140 Q40 150 36 152" stroke="#5B3E9E" strokeWidth="5" strokeLinecap="round" fill="none" />
                {/* hijab */}
                <path d="M9 130 Q8 147 14 151 L30 151 Q36 147 35 130 Z" fill="url(#rm-hijab)" />
                <circle cx="22" cy="125" r="15" fill="url(#rm-hijab)" />
                <circle cx="22" cy="127" r="10.3" fill="url(#rm-skin-g)" />
                <path d="M11 119 A13 13 0 0 1 33 119" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.32" />
                {/* soft brows + round open eyes (pupil + catch-light) + gentle smile */}
                <path d="M15.8 122.6 q2.4 -1.3 4.6 0" fill="none" stroke="#7A5340" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
                <path d="M23.6 122.6 q2.4 -1.3 4.6 0" fill="none" stroke="#7A5340" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
                <ellipse cx="18.3" cy="126.4" rx="1.9" ry="2.3" fill="#ffffff" />
                <ellipse cx="25.7" cy="126.4" rx="1.9" ry="2.3" fill="#ffffff" />
                <circle cx="18.6" cy="126.8" r="1.35" fill="#3A2B22" />
                <circle cx="26" cy="126.8" r="1.35" fill="#3A2B22" />
                <circle cx="18.1" cy="126.2" r="0.5" fill="#ffffff" />
                <circle cx="25.5" cy="126.2" r="0.5" fill="#ffffff" />
                <path d="M17.8 131.4 q4.2 3.4 8.4 0" fill="none" stroke="#8a4a3a" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M19 132.6 q3 1.4 6 0" fill="none" stroke="#c96b6b" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
                <ellipse cx="15.3" cy="130" rx="2.1" ry="1.5" fill="#E8927C" opacity="0.45" />
                <ellipse cx="28.7" cy="130" rx="2.1" ry="1.5" fill="#E8927C" opacity="0.45" />
                {/* realistic open book: two gently-curved pages meeting at a spine valley */}
                <g className="rm-book">
                  {/* cover underside (peeks below the pages) */}
                  <path d="M1 148 Q22 141 43 148 L43 152 Q22 145 1 152 Z" fill="#0b3d1f" />
                  {/* left + right pages, curved with a soft page edge */}
                  <path d="M22 141 Q11 141 2 147 L2 158 Q11 152 22 152 Z" fill="url(#rm-bookg)" />
                  <path d="M22 141 Q33 141 42 147 L42 158 Q33 152 22 152 Z" fill="#1A7A3C" />
                  <path d="M22 141 Q11 141 2 147" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.35" />
                  <path d="M22 141 Q33 141 42 147" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.25" />
                  {/* spine valley */}
                  <path d="M22 141 V152" stroke="#083019" strokeWidth="1.4" strokeLinecap="round" />
                  {/* text lines following the page curve */}
                  <path className="rm-page" d="M6 148 Q13 145 19 145" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
                  <path className="rm-page" d="M5 151 Q13 148 19 148" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
                  <path className="rm-page" d="M25 145 Q31 145 38 148" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
                  <path className="rm-page" d="M25 148 Q31 148 39 151" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
                  {/* hands resting on the page edges */}
                  <ellipse cx="5" cy="153" rx="3" ry="2.4" fill="url(#rm-skin-g)" />
                  <ellipse cx="39" cy="153" rx="3" ry="2.4" fill="url(#rm-skin-g)" />
                </g>
              </g></g>
            </g>

            {/* ── BOY (kufi) ── */}
            <g className="rm-boy">
              <g transform="translate(196,8)"><g className="rm-child rm-child-2">
                <path d="M3 154 C3 132 9 122 21 122 C33 122 39 132 39 154 Z" fill="url(#rm-tunic)" />
                <ellipse cx="29" cy="134" rx="5.5" ry="10" fill="#ffffff" opacity="0.15" transform="rotate(-15 29 134)" />
                <ellipse cx="10" cy="144" rx="5" ry="11" fill="#0d4b46" opacity="0.14" />
                <path d="M7 134 Q3 144 7 146" stroke="#1F7E76" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M35 134 Q39 144 35 146" stroke="#1F7E76" strokeWidth="5" strokeLinecap="round" fill="none" />
                {/* head + kufi cap */}
                <circle cx="21" cy="120" r="11" fill="url(#rm-skin-b)" />
                <path d="M10 116 q11 -13 22 0 q-11 -5 -22 0z" fill="#0D5C2E" />
                <path d="M10 116 q11 -7 22 0" fill="none" stroke="#C9963A" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M10 118 q11 -6 22 0" fill="none" stroke="#C9963A" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
                <path d="M12 111 A11 11 0 0 1 30 111" fill="none" stroke="#2FA25A" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
                {/* round open eyes (pupil + catch-light) + happy smile */}
                <ellipse cx="17.7" cy="120.4" rx="1.9" ry="2.3" fill="#ffffff" />
                <ellipse cx="25.3" cy="120.4" rx="1.9" ry="2.3" fill="#ffffff" />
                <circle cx="18" cy="120.8" r="1.35" fill="#3A2B22" />
                <circle cx="25.6" cy="120.8" r="1.35" fill="#3A2B22" />
                <circle cx="17.5" cy="120.2" r="0.5" fill="#ffffff" />
                <circle cx="25.1" cy="120.2" r="0.5" fill="#ffffff" />
                <path d="M16.8 125.4 q4.2 3.4 8.4 0" fill="none" stroke="#8a4a3a" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M18 126.6 q3 1.4 6 0" fill="none" stroke="#b85f4f" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
                <ellipse cx="14.3" cy="123.8" rx="2.1" ry="1.5" fill="#E8927C" opacity="0.42" />
                <ellipse cx="27.7" cy="123.8" rx="2.1" ry="1.5" fill="#E8927C" opacity="0.42" />
                {/* realistic open book (gold, echoes the award) */}
                <g className="rm-book">
                  <path d="M0 142 Q20 135 40 142 L40 146 Q20 139 0 146 Z" fill="#7c580f" />
                  <path d="M20 135 Q10 135 1 141 L1 152 Q10 146 20 146 Z" fill="url(#rm-bookgold)" />
                  <path d="M20 135 Q30 135 39 141 L39 152 Q30 146 20 146 Z" fill="#B27F2E" />
                  <path d="M20 135 Q10 135 1 141" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.35" />
                  <path d="M20 135 V146" stroke="#5c4109" strokeWidth="1.4" strokeLinecap="round" />
                  <path className="rm-page" d="M5 142 Q11 139 17 139" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
                  <path className="rm-page" d="M4 145 Q11 142 17 142" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
                  <path className="rm-page" d="M23 139 Q29 139 36 142" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
                  <path className="rm-page" d="M23 142 Q29 142 37 145" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
                  <ellipse cx="4" cy="147" rx="3" ry="2.4" fill="url(#rm-skin-b)" />
                  <ellipse cx="36" cy="147" rx="3" ry="2.4" fill="url(#rm-skin-b)" />
                </g>
              </g></g>
            </g>

            {/* rising knowledge sparkles — soft glow (halo circles, no filter for perf) */}
            <g>
              {[
                { x: 168, y: 92, d: '1.2s', c: '#F0C766', r: 1 },
                { x: 186, y: 74, d: '1.6s', c: '#5FD08C', r: 0.85 },
                { x: 150, y: 80, d: '2.0s', c: '#A98CE6', r: 0.8 },
                { x: 202, y: 96, d: '2.4s', c: '#F0C766', r: 0.9 },
                { x: 176, y: 72, d: '2.8s', c: '#F6D68A', r: 1.15 },
              ].map((s, i) => (
                <g key={i} className="rm-spark" style={{ animationDelay: s.d, transformBox: 'fill-box', transformOrigin: 'center' }}>
                  <circle cx={s.x} cy={s.y} r="3.6" fill={s.c} opacity="0.3" />
                  <path d={`M${s.x} ${s.y - 5} l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z`} fill={s.c} />
                  <path d={`M${s.x} ${s.y - 2.4} l.7 1.7 1.7 .7 -1.7 .7 -.7 1.7 -.7 -1.7 -1.7 -.7 1.7 -.7z`} fill="#ffffff" opacity="0.9" />
                </g>
              ))}
            </g>

            {/* atmosphere: a cool dusk veil that lifts as the day brightens, then
               settles back — this is what drives the dim → bright → dim loop */}
            <rect className="rm-atmos" width="340" height="200" fill="url(#rm-dusk)" style={{ mixBlendMode: 'multiply' }} />
          </g>

          {/* vignette */}
          <rect width="340" height="200" fill="url(#rm-vig)" />
        </svg>

        {/* benefit marquee inside the scene */}
        <div
          className="relative -mt-1 overflow-hidden bg-gradient-to-r from-emerald-50/70 to-white/70 py-1.5"
          style={{ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}
        >
          <div className="rm-track">
            {marquee.map((b, i) => (
              <span key={i} aria-hidden={i >= benefits.length || undefined} className="mr-8 flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-emerald-800">
                <svg className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.6h7.6z" /></svg>
                {b}
              </span>
            ))}
          </div>
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
