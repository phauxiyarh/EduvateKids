/**
 * Book fair stock as a formatted .xlsx: a branded title block, a styled
 * header, banded rows and a totals row, set up to print on one page across.
 *
 * Built with ExcelJS because the SheetJS build the dashboard uses elsewhere
 * cannot write cell styles. It is imported on demand, so the library only
 * loads when someone downloads a sheet.
 */

export type FairStockRow = {
  title: string
  code: string
  category: string
  publisher: string
  sellingPrice: number
  atFair: number
}

export type FairStockMeta = {
  eventName: string
  location?: string
  startDate?: string
  endDate?: string
}

const BRAND = 'FF7C3AED' // primary purple
const BRAND_DARK = 'FF4C1D95'
const HEADER_FILL = 'FFEDE9FE'
const BAND_FILL = 'FFF8F7FF'
const BORDER = 'FFDDD6FE'
const MUTED = 'FF6B7280'

const COLUMNS = [
  { header: 'Title', key: 'title', width: 44 },
  { header: 'Code', key: 'code', width: 17 },
  { header: 'Category', key: 'category', width: 14 },
  { header: 'Publisher', key: 'publisher', width: 20 },
  { header: 'Selling Price', key: 'sellingPrice', width: 13 },
  { header: 'At Fair', key: 'atFair', width: 10 }
] as const

const fmtDate = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export async function buildFairStockWorkbook(meta: FairStockMeta, rows: FairStockRow[]): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Eduvate Kids'
  wb.created = new Date()

  const ws = wb.addWorksheet('Book Fair Stock', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      printTitlesRow: '5:5'
    },
    headerFooter: { oddFooter: '&L&8Eduvate Kids · Book fair stock&R&8Page &P of &N' }
  })
  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }))
  const lastCol = String.fromCharCode(64 + COLUMNS.length)

  // Title block: rows 1-3, then a spacer row, then the header on row 5.
  ws.mergeCells(`A1:${lastCol}1`)
  const title = ws.getCell('A1')
  title.value = 'Eduvate Kids · Book Fair Stock'
  title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
  title.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(1).height = 30

  ws.mergeCells(`A2:${lastCol}2`)
  const event = ws.getCell('A2')
  event.value = meta.eventName
  event.font = { name: 'Calibri', size: 13, bold: true, color: { argb: BRAND_DARK } }
  event.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(2).height = 22

  const copies = rows.reduce((sum, r) => sum + r.atFair, 0)
  const dates = [fmtDate(meta.startDate), fmtDate(meta.endDate)].filter(Boolean)
  const details = [
    meta.location,
    dates.length === 2 && dates[0] !== dates[1] ? `${dates[0]} – ${dates[1]}` : dates[0],
    `${rows.length} title${rows.length === 1 ? '' : 's'} · ${copies} cop${copies === 1 ? 'y' : 'ies'} at the fair`,
    `Exported ${fmtDate(new Date().toISOString())}`
  ].filter(Boolean).join('   ·   ')
  ws.mergeCells(`A3:${lastCol}3`)
  const sub = ws.getCell('A3')
  sub.value = details
  sub.font = { name: 'Calibri', size: 10, color: { argb: MUTED } }
  sub.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(3).height = 18
  ws.getRow(4).height = 8

  const thin = { style: 'thin' as const, color: { argb: BORDER } }
  const box = { top: thin, left: thin, bottom: thin, right: thin }

  // Header
  const header = ws.getRow(5)
  COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND_DARK } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.border = { ...box, bottom: { style: 'medium', color: { argb: BRAND } } }
    cell.alignment = { vertical: 'middle', horizontal: i >= 4 ? 'center' : 'left', indent: i >= 4 ? 0 : 1 }
  })
  header.height = 24

  // Body
  rows.forEach((r, idx) => {
    const row = ws.addRow({
      title: r.title,
      // Text, so a 13-digit ISBN isn't shown as 9.78E+12 or lose a leading 0.
      code: r.code,
      category: r.category,
      publisher: r.publisher,
      sellingPrice: r.sellingPrice,
      atFair: r.atFair
    })
    row.height = 20
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { name: 'Calibri', size: 11, color: { argb: r.atFair > 0 ? 'FF111827' : 'FF9CA3AF' } }
      cell.border = box
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL } }
      cell.alignment = { vertical: 'middle', horizontal: col >= 5 ? 'center' : 'left', indent: col >= 5 ? 0 : 1, wrapText: col === 1 }
    })
    row.getCell('code').numFmt = '@'
    row.getCell('sellingPrice').numFmt = '$#,##0.00'
    row.getCell('atFair').numFmt = '#,##0'
  })

  // Totals, straight under the last book.
  const first = 6
  const last = 5 + rows.length
  const total = ws.addRow({ title: 'Total', atFair: rows.length ? { formula: `SUM(F${first}:F${last})`, result: copies } : 0 })
  total.height = 24
  total.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: BRAND_DARK } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.border = { top: { style: 'medium', color: { argb: BRAND } }, bottom: thin, left: thin, right: thin }
    cell.alignment = { vertical: 'middle', horizontal: col >= 5 ? 'center' : 'left', indent: col >= 5 ? 0 : 1 }
  })
  total.getCell('atFair').numFmt = '#,##0'

  if (rows.length) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: last, column: COLUMNS.length } }

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
