import JsBarcode from 'jsbarcode'

/**
 * Printable barcode labels for inventory items.
 *
 * A label matches the barcode printed on a book's back cover, so cashiers look
 * for the same kind of mark on every item: an ISBN-13 or EAN-13 code is drawn
 * as EAN-13, a 12-digit UPC as UPC-A, an 8-digit code as EAN-8, and anything
 * else (EK- codes, item ids) as Code 128. The POS scanner reads all four.
 */

type Format = 'EAN13' | 'UPC' | 'EAN8' | 'CODE128'

// GS1 check digit: weights alternate 3,1 from the rightmost data digit.
const gs1CheckValid = (digits: string) => {
  const body = digits.slice(0, -1)
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    sum += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1])
}

export function barcodeFormatFor(value: string): Format {
  if (/^\d+$/.test(value) && gs1CheckValid(value)) {
    if (value.length === 13) return 'EAN13'
    if (value.length === 12) return 'UPC'
    if (value.length === 8) return 'EAN8'
  }
  return 'CODE128'
}

const OPTIONS = {
  // Drawing units: 2px per bar module. The printed size is set separately by
  // barcodePrintSizeMm, so these only fix the proportions.
  width: 2,
  // 40 modules tall: about 13mm when printed, short enough for small items.
  height: 80,
  // 10 modules of white each side. A scanner needs this quiet zone, and it
  // matters most on a small label stuck close to other print.
  margin: 20,
  displayValue: true,
  fontSize: 18,
  textMargin: 4,
  background: '#ffffff',
  lineColor: '#000000'
}

/**
 * Draws the barcode for `value`. Returns an SVG data URL, which stays sharp at
 * any print size, or '' when the value can't be encoded.
 */
export function barcodeSvgDataUrl(value: string): string {
  if (typeof document === 'undefined' || !value) return ''
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  try {
    JsBarcode(svg, value, { ...OPTIONS, format: barcodeFormatFor(value) })
  } catch {
    try {
      // Code 128 encodes any printable ASCII, so this only fails on odd input.
      JsBarcode(svg, value, { ...OPTIONS, format: 'CODE128' })
    } catch {
      return ''
    }
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
}

/** PNG of the same barcode at 3x, for saving to a phone or a label-printer app. */
export function barcodePngDataUrl(value: string): string {
  if (typeof document === 'undefined' || !value) return ''
  const canvas = document.createElement('canvas')
  const big = { ...OPTIONS, width: 6, height: 240, margin: 60, fontSize: 54, textMargin: 12 }
  try {
    JsBarcode(canvas, value, { ...big, format: barcodeFormatFor(value) })
  } catch {
    try {
      JsBarcode(canvas, value, { ...big, format: 'CODE128' })
    } catch {
      return ''
    }
  }
  return canvas.toDataURL('image/png')
}

// Printed bar module size. 0.33mm is the standard (100%) size of the EAN-13 on
// a book's cover, about 37mm across. A longer Code 128 value shrinks toward
// 0.25mm, the smallest a phone camera still reads reliably, to stay within
// MAX_PRINT_MM; past that it prints wider rather than less readable.
const MODULE_MM = 0.33
const MIN_MODULE_MM = 0.25
const MAX_PRINT_MM = 45

/** Size, in millimetres, to print the barcode from barcodeSvgDataUrl at. */
export function barcodePrintSizeMm(svgDataUrl: string): { width: number; height: number } | null {
  const svg = decodeURIComponent(svgDataUrl.slice(svgDataUrl.indexOf(',') + 1))
  const w = Number(svg.match(/\swidth="([\d.]+)(?:px)?"/)?.[1])
  const h = Number(svg.match(/\sheight="([\d.]+)(?:px)?"/)?.[1])
  if (!w || !h) return null
  const modules = w / OPTIONS.width
  const moduleMm = Math.max(MIN_MODULE_MM, Math.min(MODULE_MM, MAX_PRINT_MM / modules))
  const scale = moduleMm / OPTIONS.width
  return { width: Math.round(w * scale * 10) / 10, height: Math.round(h * scale * 10) / 10 }
}

/** Widest a label should print for small items; wider ones get a store code offered. */
export const LABEL_MAX_MM = MAX_PRINT_MM

/**
 * A short in-store barcode for an item whose own code prints too wide. EAN-13
 * numbers starting with 20-29 are reserved by GS1 for a shop's internal use,
 * so this never collides with a publisher's ISBN (978/979) or a product UPC,
 * and it prints at the same small size as a book's barcode. `taken` holds the
 * codes already in use.
 */
export function makeStoreCode(taken: Set<string>): string {
  for (;;) {
    let body = '20'
    for (let i = 0; i < 10; i++) body += Math.floor(Math.random() * 10)
    let sum = 0
    for (let i = 0; i < 12; i++) sum += Number(body[11 - i]) * (i % 2 === 0 ? 3 : 1)
    const code = body + ((10 - (sum % 10)) % 10)
    if (!taken.has(code)) return code
  }
}
