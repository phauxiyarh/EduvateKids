'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Auto-advancing image slider.
 *
 * A single image renders as a plain picture with no controls or timer. The
 * slideshow pauses on hover and while the tab is hidden, so a page of cards
 * does not run timers nobody is watching, and respects prefers-reduced-motion
 * by not auto-advancing at all.
 */
export function ImageSlider({
  images,
  alt,
  className = '',
  intervalMs = 3800,
  showDots = true
}: {
  images: string[]
  alt: string
  className?: string
  intervalMs?: number
  showDots?: boolean
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = useRef(false)

  useEffect(() => {
    reduceMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  }, [])

  useEffect(() => {
    if (images.length < 2 || paused || reduceMotion.current) return
    const id = setInterval(() => {
      // Skip the tick entirely when the tab is in the background.
      if (document.visibilityState !== 'visible') return
      setIndex((i) => (i + 1) % images.length)
    }, intervalMs)
    return () => clearInterval(id)
  }, [images.length, paused, intervalMs])

  if (!images.length) return null

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={i === 0 ? alt : ''}
          aria-hidden={i !== index}
          loading={i === 0 ? 'eager' : 'lazy'}
          className={`h-full w-full object-cover transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'absolute inset-0 opacity-0'
          }`}
        />
      ))}

      {showDots && images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Show image ${i + 1} of ${images.length}`}
              onClick={(e) => {
                // The slider often sits inside a link; changing image should
                // not navigate.
                e.preventDefault()
                e.stopPropagation()
                setIndex(i)
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? 'w-5 bg-white shadow' : 'w-1.5 bg-white/60 hover:bg-white/90'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
