'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Auto-advancing image slider.
 *
 * A single image renders as a plain picture with no controls or timer. The
 * slideshow pauses on hover and while the tab is hidden, so a page of cards
 * does not run timers nobody is watching, and respects prefers-reduced-motion
 * by not auto-advancing at all.
 *
 * Prev/next arrows sit on top of the image. They are always in the DOM (so
 * keyboard and screen-reader users reach them) but fade in on hover on pointer
 * devices, where a permanently visible chrome would fight the artwork. On touch
 * there is no hover, so they stay visible.
 */
export function ImageSlider({
  images,
  alt,
  className = '',
  // Roughly half the previous 3800ms: the old pace read as static on a card
  // the reader only glances at.
  intervalMs = 2000,
  showDots = true,
  showArrows = true,
  /**
   * 'cover' crops to fill the box, which is what card grids want: every card
   * is then the same size whatever the image's own proportions.
   *
   * 'contain' shows the whole image with nothing cropped away, letterboxed
   * inside the box. Used on the article page, where the artwork is the point
   * and cutting the top off a portrait cover loses information.
   */
  fit = 'cover'
}: {
  images: string[]
  alt: string
  className?: string
  intervalMs?: number
  showDots?: boolean
  showArrows?: boolean
  fit?: 'cover' | 'contain'
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

  // The slider often sits inside a link, so every control must swallow the
  // click rather than navigating to the article.
  const step = useCallback(
    (delta: number) => (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setIndex((i) => (i + delta + images.length) % images.length)
    },
    [images.length]
  )

  if (!images.length) return null

  const multiple = images.length > 1

  return (
    <div
      className={`group/slider relative overflow-hidden ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Every slide is absolutely positioned inside the same box, so the
          container's height comes from the caller's aspect ratio rather than
          from whichever image happens to be showing. A tall portrait cover and
          a wide landscape one therefore produce identically sized cards, and
          switching slides cannot change the card's height. */}
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={i === 0 ? alt : ''}
          aria-hidden={i !== index}
          loading={i === 0 ? 'eager' : 'lazy'}
          className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
            fit === 'contain' ? 'object-contain' : 'object-cover'
          } ${i === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}

      {showArrows && multiple && (
        <>
          <button
            type="button"
            onClick={step(-1)}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-primaryDark shadow-lg backdrop-blur transition-all hover:bg-white hover:scale-105 focus-visible:opacity-100 md:opacity-0 md:group-hover/slider:opacity-100"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={step(1)}
            aria-label="Next image"
            className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-primaryDark shadow-lg backdrop-blur transition-all hover:bg-white hover:scale-105 focus-visible:opacity-100 md:opacity-0 md:group-hover/slider:opacity-100"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {showDots && multiple && (
        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Show image ${i + 1} of ${images.length}`}
              onClick={(e) => {
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
