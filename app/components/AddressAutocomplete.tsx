'use client'

/**
 * Google Places address autocomplete for the checkout street field.
 *
 * - Lazy-loads the Google Maps JS Places library once, only if a public API key
 *   (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) is configured.
 * - On selecting a suggestion, fills line1 / city / state / postalCode / country
 *   via onSelect. USPS still verifies the final address on submit (server-side).
 * - With no key configured it renders a plain text input (graceful fallback), so
 *   checkout keeps working without Google.
 *
 * The key is a browser key (public by design) and MUST be restricted by HTTP
 * referrer + API in the Google Cloud console.
 */
import { useEffect, useRef } from 'react'

type Parts = { line1: string; city: string; state: string; postalCode: string; country: string }

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

// Module-level loader so the script is only injected once across mounts.
let mapsPromise: Promise<void> | null = null
function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined' || !KEY) return Promise.reject(new Error('no key'))
  const w = window as unknown as { google?: { maps?: { places?: unknown } } }
  if (w.google?.maps?.places) return Promise.resolve()
  if (mapsPromise) return mapsPromise
  mapsPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY!)}&libraries=places&loading=async`
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(s)
  })
  return mapsPromise
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  className,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (parts: Parts) => void
  className?: string
  placeholder?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!KEY) return
    let ac: { addListener: (e: string, cb: () => void) => void; getPlace: () => unknown } | null = null
    let cancelled = false

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current) return
        const g = (window as unknown as {
          google: { maps: { places: { Autocomplete: new (el: HTMLInputElement, opts: unknown) => typeof ac } } }
        }).google
        ac = new g.maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          componentRestrictions: { country: ['us'] },
          fields: ['address_components'],
        }) as unknown as typeof ac
        ac!.addListener('place_changed', () => {
          const place = ac!.getPlace() as { address_components?: Array<{ long_name: string; short_name: string; types: string[] }> }
          const comps = place.address_components || []
          const get = (type: string, short = false) => {
            const c = comps.find((x) => x.types.includes(type))
            return c ? (short ? c.short_name : c.long_name) : ''
          }
          const streetNumber = get('street_number')
          const route = get('route')
          const line1 = [streetNumber, route].filter(Boolean).join(' ').trim()
          const city = get('locality') || get('sublocality') || get('postal_town')
          const state = get('administrative_area_level_1', true)
          const postalCode = get('postal_code')
          const country = get('country') || 'United States'
          if (line1) {
            onSelectRef.current({ line1, city, state, postalCode, country })
          }
        })
      })
      .catch(() => {
        /* Google unavailable — plain input still works */
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <input
      ref={inputRef}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      required
    />
  )
}
