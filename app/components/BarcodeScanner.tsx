'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Camera-based QR + barcode (EAN-13/ISBN) scanner modal.
 * - Uses html5-qrcode (pure browser; needs HTTPS + camera permission).
 * - Debounces duplicate reads; plays a short beep + visual pulse on success.
 * - Always offers a manual-entry fallback (permission denied / no camera / typos).
 *
 * onDetected(value) fires with the decoded string. The parent decides what it
 * means (match sku/isbn/title). Keep the modal open for batch scanning, or close
 * from the parent after a single scan.
 */
export function BarcodeScanner({
  open,
  onClose,
  onDetected,
  title = 'Scan a code',
  hint = 'Point the camera at a barcode or QR code.',
}: {
  open: boolean
  onClose: () => void
  onDetected: (value: string) => void
  title?: string
  hint?: string
}) {
  const regionId = 'ek-scanner-region'
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)
  const lastRef = useRef<{ value: string; at: number }>({ value: '', at: 0 })
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    ;(async () => {
      setError('')
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode(regionId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          verbose: false,
        })
        scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void }
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 160 } },
          (decodedText) => {
            const now = Date.now()
            // Debounce: ignore the same value within 2.5s.
            if (decodedText === lastRef.current.value && now - lastRef.current.at < 2500) return
            lastRef.current = { value: decodedText, at: now }
            setFlash(true)
            setTimeout(() => setFlash(false), 300)
            try {
              // Short beep via WebAudio (best-effort; ignored if blocked).
              const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
              const ctx = new AC()
              const osc = ctx.createOscillator()
              osc.frequency.value = 880
              osc.connect(ctx.destination)
              osc.start()
              osc.stop(ctx.currentTime + 0.08)
            } catch { /* no audio */ }
            onDetected(decodedText)
          },
          () => { /* per-frame decode failure, ignore */ }
        )
      } catch (err) {
        if (!cancelled) {
          setError('Camera unavailable or permission denied. Enter the code manually below.')
          // eslint-disable-next-line no-console
          console.error('Scanner start failed:', err)
        }
      }
    })()

    return () => {
      cancelled = true
      const s = scannerRef.current
      if (s) {
        s.stop().then(() => s.clear()).catch(() => { try { s.clear() } catch { /* noop */ } })
        scannerRef.current = null
      }
    }
  }, [open, onDetected])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fadeIn" onClick={onClose}>
      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-primaryDark">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" /></svg>
            {title}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close scanner" className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-gray-100 hover:text-ink">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5">
          <p className="mb-3 text-sm text-muted">{hint}</p>
          <div className={`relative overflow-hidden rounded-2xl border-2 transition-colors duration-200 ${flash ? 'border-emerald-400' : 'border-primary/20'}`}>
            <div id={regionId} className="w-full [&_video]:w-full [&_video]:rounded-2xl" />
            {flash && <div className="pointer-events-none absolute inset-0 bg-emerald-400/20" />}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
            </div>
          )}

          {/* Manual entry fallback, always available */}
          <form
            onSubmit={(e) => { e.preventDefault(); const v = manual.trim(); if (v) { onDetected(v); setManual('') } }}
            className="mt-4 flex gap-2"
          >
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Or type a code / ISBN / title"
              aria-label="Enter code manually"
              className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
            />
            <button type="submit" className="rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5">Find</button>
          </form>
        </div>
      </div>
    </div>
  )
}
