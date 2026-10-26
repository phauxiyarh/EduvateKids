'use client'

import { useEffect, useRef, useState } from 'react'

type ScannerHandle = {
  stop: () => Promise<void>
  clear: () => void
  getRunningTrackCameraCapabilities: () => {
    torchFeature: () => { isSupported: () => boolean; apply: (value: boolean) => Promise<void> }
  }
}

/** Map a camera start failure to something a cashier can act on. */
const describeCameraError = (err: unknown): string => {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'The camera needs a secure (HTTPS) connection. Open this page over https:// or enter the code manually below.'
  }
  const name = (err as { name?: string } | null)?.name ?? ''
  const text = String((err as { message?: string } | null)?.message ?? err ?? '')
  if (name === 'NotAllowedError' || /NotAllowedError|Permission/i.test(text)) {
    return 'Camera access is blocked. Allow it from the aA or lock icon in the address bar (on iPhone: Settings › Safari › Camera › Allow), then tap Retry. Or enter the code manually below.'
  }
  if (name === 'NotFoundError' || /NotFoundError|Requested device not found/i.test(text)) {
    return 'No camera was found on this device. Enter the code manually below.'
  }
  if (name === 'NotReadableError' || /NotReadableError|Could not start video source/i.test(text)) {
    return 'The camera is in use by another app or tab. Close it, then tap Retry. Or enter the code manually below.'
  }
  return 'Camera unavailable. Tap Retry, or enter the code manually below.'
}

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
  const scannerRef = useRef<ScannerHandle | null>(null)
  const lastRef = useRef<{ value: string; at: number }>({ value: '', at: 0 })
  // Latest callback in a ref so an inline parent prop doesn't restart the camera.
  const cbRef = useRef(onDetected)
  cbRef.current = onDetected
  const audioRef = useRef<AudioContext | null>(null)
  // Bumped per camera session so a stale cleanup doesn't wipe a newer session's DOM
  // (all instances share the same region id).
  const sessionRef = useRef(0)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')
  const [flash, setFlash] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  // Close the shared AudioContext on unmount.
  useEffect(() => () => {
    try { audioRef.current?.close() } catch { /* noop */ }
    audioRef.current = null
  }, [])

  // Lock page scroll behind the sheet while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open) return
    const session = ++sessionRef.current
    let cancelled = false
    let scanner: ScannerHandle | null = null
    let startP: Promise<unknown> | null = null

    ;(async () => {
      setError('')
      setTorchSupported(false)
      setTorchOn(false)
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelled) return
        const instance = new Html5Qrcode(regionId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        })
        scanner = instance as unknown as ScannerHandle
        scannerRef.current = scanner
        startP = instance.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            // Wide, short box suits 1D barcodes; library minimum is 50px per side.
            qrbox: (w: number) => {
              const base = Math.min(w, 400)
              return {
                width: Math.max(50, Math.floor(base * 0.9)),
                height: Math.max(50, Math.floor(base * 0.45)),
              }
            },
          },
          (decodedText) => {
            const now = Date.now()
            // Debounce: ignore the same value within 2.5s.
            if (decodedText === lastRef.current.value && now - lastRef.current.at < 2500) return
            lastRef.current = { value: decodedText, at: now }
            setFlash(true)
            setTimeout(() => setFlash(false), 300)
            try {
              // Short beep via one shared WebAudio context (best-effort; ignored if blocked).
              if (!audioRef.current) {
                const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
                audioRef.current = new AC()
              }
              const ctx = audioRef.current
              if (ctx.state === 'suspended') void ctx.resume()
              const osc = ctx.createOscillator()
              osc.frequency.value = 880
              osc.connect(ctx.destination)
              osc.start()
              osc.stop(ctx.currentTime + 0.08)
            } catch { /* no audio */ }
            try { navigator.vibrate?.(40) } catch { /* no vibration */ }
            cbRef.current(decodedText)
          },
          () => { /* per-frame decode failure, ignore */ }
        )
        await startP
        // Cancelled mid-start: the cleanup below already chained stop + clear onto startP.
        if (cancelled) return
        try {
          if (instance.getRunningTrackCameraCapabilities().torchFeature().isSupported()) setTorchSupported(true)
        } catch { /* torch not available */ }
      } catch (err) {
        if (!cancelled) {
          setError(describeCameraError(err))
          // eslint-disable-next-line no-console
          console.error('Scanner start failed:', err)
        }
      }
    })()

    return () => {
      cancelled = true
      const s = scanner
      scannerRef.current = null
      // Wait for a pending start() before stopping. If the import/constructor
      // hasn't run yet, the cancelled check after the import bails out.
      if (s && startP) {
        startP
          .then(() => s.stop())
          .catch(() => {})
          .finally(() => {
            if (sessionRef.current !== session) return
            try { s.clear() } catch { /* noop */ }
          })
      }
    }
  }, [open, retryKey])

  const toggleTorch = async () => {
    const s = scannerRef.current
    if (!s) return
    try {
      const next = !torchOn
      await s.getRunningTrackCameraCapabilities().torchFeature().apply(next)
      setTorchOn(next)
    } catch { /* torch toggle failed */ }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fadeIn" onClick={onClose}>
      <div className="relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-3">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-primaryDark">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16" /></svg>
            {title}
          </h3>
          <div className="flex items-center gap-1">
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                aria-pressed={torchOn}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition ${torchOn ? 'bg-amber-100 text-amber-700' : 'text-muted hover:bg-gray-100 hover:text-ink'}`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close scanner" className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition hover:bg-gray-100 hover:text-ink">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="mb-3 text-sm text-muted">{hint}</p>
          <div className={`relative overflow-hidden rounded-2xl border-2 transition-colors duration-200 ${flash ? 'border-emerald-400' : 'border-primary/20'}`}>
            <div id={regionId} className="w-full [&_video]:w-full [&_video]:rounded-2xl" />
            {flash && <div className="pointer-events-none absolute inset-0 bg-emerald-400/20" />}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="flex-1">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => { setError(''); setRetryKey((k) => k + 1) }}
                  className="mt-2 flex min-h-11 items-center rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                >
                  Retry
                </button>
              </div>
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
              enterKeyHint="search"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
            />
            <button type="submit" className="min-h-11 rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5">Find</button>
          </form>
        </div>
      </div>
    </div>
  )
}
