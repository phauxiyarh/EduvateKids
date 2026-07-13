'use client'

import { useEffect, useState } from 'react'

/**
 * Full-screen animated celebration shown when a reader reaches ANY level's goal
 * (Early / Growing / Confident Readers). Confetti rains down and a trophy badge
 * pops in. Self-contained (no external confetti lib), auto-dismisses, and honors
 * prefers-reduced-motion (falls back to a static badge, no falling pieces).
 */

// Brand-palette confetti colors. Piece positions/timing vary by index (kept
// deterministic so the layout is stable across renders).
const COLORS = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f43f5e']

export function SummerCelebration({
  label,
  onDone,
}: {
  label: string
  onDone?: () => void
}) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // Fade out shortly before the parent clears the trigger.
    const t1 = setTimeout(() => setLeaving(true), 4200)
    const t2 = setTimeout(() => onDone?.(), 5000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [onDone])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sr-cel-root pointer-events-none fixed inset-0 z-[120] flex items-center justify-center ${leaving ? 'sr-cel-leaving' : ''}`}
    >
      {/* dim backdrop */}
      <div className="sr-cel-backdrop absolute inset-0 bg-ink/30 backdrop-blur-[2px]" aria-hidden="true" />

      {/* confetti layer (hidden under reduced motion) */}
      <div className="sr-cel-confetti absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 46 }).map((_, i) => {
          const left = (i * 37) % 100
          const delay = (i % 10) * 0.12
          const duration = 2.6 + ((i % 5) * 0.35)
          const size = 6 + (i % 4) * 2
          const color = COLORS[i % COLORS.length]
          const rounded = i % 3 === 0
          return (
            <span
              key={i}
              className="sr-cel-piece"
              style={{
                left: `${left}%`,
                width: `${size}px`,
                height: `${size + (i % 2 ? 4 : 0)}px`,
                background: color,
                borderRadius: rounded ? '50%' : '2px',
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
              }}
            />
          )
        })}
      </div>

      {/* trophy badge card */}
      <div className="sr-cel-card relative mx-4 flex max-w-sm flex-col items-center rounded-3xl border border-amber-200 bg-white/95 px-8 py-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
        <span className="sr-cel-badge flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-primary text-white shadow-lg">
          <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3" />
          </svg>
        </span>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Goal reached</p>
        <h2 className="mt-1 font-display text-2xl font-bold gradient-text">{label} complete! 🎉</h2>
        <p className="mt-2 text-sm text-muted">MashaAllah! Keep reading — every extra book is a bonus.</p>
      </div>

      <style jsx>{`
        .sr-cel-root { animation: srCelIn 260ms ease-out both; }
        .sr-cel-leaving { animation: srCelOut 700ms ease-in forwards; }
        @keyframes srCelIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes srCelOut { from { opacity: 1; } to { opacity: 0; } }

        .sr-cel-card { animation: srCelPop 620ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @keyframes srCelPop {
          0% { opacity: 0; transform: scale(0.7) translateY(12px); }
          60% { opacity: 1; transform: scale(1.04) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .sr-cel-badge { animation: srCelBadge 900ms cubic-bezier(0.34, 1.56, 0.64, 1) 120ms both; }
        @keyframes srCelBadge {
          0% { transform: scale(0) rotate(-25deg); }
          55% { transform: scale(1.18) rotate(8deg); }
          75% { transform: scale(0.95) rotate(-3deg); }
          100% { transform: scale(1) rotate(0); }
        }

        .sr-cel-piece {
          position: absolute;
          top: -6%;
          opacity: 0;
          animation-name: srCelFall;
          animation-timing-function: cubic-bezier(0.4, 0.1, 0.5, 1);
          animation-iteration-count: 1;
          animation-fill-mode: forwards;
        }
        @keyframes srCelFall {
          0% { opacity: 0; transform: translateY(-10vh) rotate(0deg); }
          8% { opacity: 1; }
          100% { opacity: 0.9; transform: translateY(108vh) rotate(560deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .sr-cel-root, .sr-cel-card, .sr-cel-badge { animation: none !important; }
          .sr-cel-confetti { display: none; }
        }
      `}</style>
    </div>
  )
}
