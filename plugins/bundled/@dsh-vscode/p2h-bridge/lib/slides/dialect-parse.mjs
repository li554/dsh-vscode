/**
 * p2h-bridge — dialect parser: slide HTML → docgen slideData IR (browser-free).
 *
 * docgen's own parse step runs in a browser (iframe layout, Range/canvas measurement — see
 * .tmp-docgen dist/packages/slides/{createPresentation,parse}.js), which the DSH host process
 * does not have. The docgen IMPORT output, however, is a fully inline-styled dialect:
 * a 1280×720 px `position:relative` root whose children are `position:absolute` divs with
 * px geometry, inline colors and data-URI images (verified in dist/packages/slides/import-pptx.js,
 * and against a real roundtrip in .tmp-smoke). Because agent edits stay inside that dialect
 * (C2 boundary), a deterministic attribute parser is enough for the round trip — no layout
 * engine required.
 *
 * Output: the IR consumed by docgen's convert.js (`applyBackground` / `addElementsToSlide`),
 * all geometry in INCHES (px / (canvasWidthPx / 10) — 128 px/in for the 1280px canvas), font
 * sizes in POINTS (px × 72/128):
 *   { type:'text',  position, style, text }                       — plain text box
 *   { type:'shape', position, shape:{fill,line,rectRadius,...}, style, text|textRuns }
 *   { type:'image', position, src }                               — src is a data URI
 *   { type:'line',  x1,y1,x2,y2, color, width }
 * Anything not representable (charts/SVG, gradients) degrades to a warning, never an error.
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseHTML } from 'linkedom'
import { parseCssColor, parseStyleAttr, pxNumber, isAbsolutePositioned, imageDimensions, mimeForPath } from '../util.mjs'

const PX_PER_PT = 96 / 72 // css px per pt (1pt = 1/72in)

/** linkedom collections are array-like but not always iterable — normalize once. */
const kids = (node) => Array.from(node?.children ?? [])

const SKIP_ROOT_TAGS = new Set(['style', 'script', 'link', 'meta', 'title'])

/** Scale factors derived from the slide root's canvas size (docgen import emits 1280×720 px = 10"×5.625"). */
function makeScale(canvasW, canvasH, warnings) {
  const pxPerInchX = canvasW > 0 ? canvasW / 10 : 128
  const pxPerInchY = canvasH > 0 ? canvasH / 5.625 : 128
  if (Math.abs(pxPerInchX - pxPerInchY) / Math.max(pxPerInchX, pxPerInchY) > 0.05) {
    warnings.push(`non-16:9 canvas ${canvasW}x${canvasH} — geometry may stretch (using width-derived scale)`)
  }
  const pxPerInch = pxPerInchX
  return {
    inch: (px) => px / pxPerInch,
    pt: (px) => (72 / pxPerInch) * px,
  }
}

/** Convert a #rrggbb/rgba/named CSS color to a PptxGenJS hex (no '#'), or null. */
function toPptxColor(value) {
  const parsed = parseCssColor(value)
  return parsed ? parsed.hex.toUpperCase() : null
}

function alphaToTransparency(alpha) {
  if (alpha == null || alpha >= 1) return null
  return Math.round((1 - alpha) * 100)
}

/** Read the intrinsic size of an image (data URI or local file) for potential cover crops. */
function imageNaturalSize(src) {
  try {
    if (src.startsWith('data:')) {
      const base64 = src.slice(src.indexOf(',') + 1)
      return imageDimensions(Buffer.from(base64, 'base64'))
    }
    return imageDimensions(fs.readFileSync(src))
  } catch {
    return null
  }
}

/** Map a <img src> to either a data URI (inline/local) or the original URL (docgen fetches it). */
function toImageSrc(srcValue, htmlDir, warnings) {
  const src = String(srcValue ?? '').trim()
  if (!src) return null
  if (src.startsWith('data:')) return src
  if (/^https?:\/\//i.test(src)) return src // docgen's fetchImageAsDataUrl handles network images
  const local = path.isAbsolute(src) ? src : path.resolve(htmlDir, src.split('?')[0].split('#')[0])
  try {
    const buffer = fs.readFileSync(local)
    return `data:${mimeForPath(local)};base64,${buffer.toString('base64')}`
  } catch {
    warnings.push(`image not found, skipped: ${src}`)
    return null
  }
}

const BOLD_TAGS = new Set(['b', 'strong'])
const ITALIC_TAGS = new Set(['i', 'em'])
const UNDERLINE_TAGS = new Set(['u'])
const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'section', 'blockquote'])

/** Inline style of an element, merged with its <font>/inherited data attributes. */
function styleOf(el) {
  return parseStyleAttr(el.getAttribute?.('style'))
}

/**
 * Flatten one text container's paragraphs into PptxGenJS text runs.
 * Paragraph breaks become `breakLine: true` on the last run of each paragraph except the final one.
 */
function extractRuns(container, base, warnings, scale) {
  const runs = []
  const paragraphs = kids(container).filter((child) => BLOCK_TAGS.has((child.tagName ?? '').toLowerCase()))
  // No block children: treat the container's own inline content as one paragraph.
  if (paragraphs.length === 0) paragraphs.push(container)

  paragraphs.forEach((para, paraIdx) => {
    const paraStyle = styleOf(para)
    const paraAlign = paraStyle['text-align'] && ['left', 'center', 'right', 'justify'].includes(paraStyle['text-align'])
      ? paraStyle['text-align'] === 'justify' ? 'justify' : paraStyle['text-align']
      : null
    const paraRuns = []
    const walk = (node, inherited) => {
      for (const child of Array.from(node.childNodes ?? [])) {
        const tag = (child.tagName ?? '').toLowerCase()
        if (tag === 'br') {
          paraRuns.push({ text: '', options: { breakLine: true } })
          continue
        }
        if (tag === 'span' || tag === 'a' || BOLD_TAGS.has(tag) || ITALIC_TAGS.has(tag) || UNDERLINE_TAGS.has(tag) || tag === 'font') {
          const style = styleOf(child)
          const color = toPptxColor(style.color) ?? inherited.color
          const fontSizePx = pxNumber(style['font-size'], inherited.fontSizePx)
          const options = {
            ...inherited.options,
            fontSize: scale.pt(fontSizePx),
            color: color ?? undefined,
            bold: inherited.bold || BOLD_TAGS.has(tag) || /bold|[6-9]00/.test(style['font-weight'] ?? ''),
            italic: inherited.italic || ITALIC_TAGS.has(tag) || style['font-style'] === 'italic',
            underline: inherited.underline || UNDERLINE_TAGS.has(tag) || (style['text-decoration'] ?? '').includes('underline'),
          }
          if (style['font-family']) options.fontFace = style['font-family'].split(',')[0].replaceAll(/['"]/g, '').trim()
          if (!Number.isFinite(options.fontSize) || options.fontSize <= 0) delete options.fontSize
          if (!options.color) delete options.color
          walk(child, { ...inherited, options, color: options.color, fontSizePx, bold: options.bold, italic: options.italic, underline: options.underline })
          continue
        }
        if (child.nodeType === 1) {
          // Unknown inline element (small caps, sup, ...) — keep the text, drop exotic styling.
          walk(child, inherited)
          continue
        }
        const text = String(child.textContent ?? '').replace(/\s+/g, ' ')
        if (text.trim()) paraRuns.push({ text, options: { ...inherited.options } })
      }
    }
    walk(para, {
      options: { ...base.runOptions },
      color: base.color,
      fontSizePx: base.fontSizePx,
      bold: base.bold,
      italic: base.italic,
      underline: false,
    }, scale)
    if (paraRuns.length > 0) {
      if (paraAlign && paragraphs.length > 1) {
        // PptxGenJS paragraph alignment rides on the run that starts the paragraph.
        paraRuns[0].options.align = paraAlign
      }
      const isLast = paraIdx === paragraphs.length - 1
      if (!isLast) {
        const last = paraRuns[paraRuns.length - 1]
        if (!last.options.breakLine) last.options.breakLine = true
      }
      runs.push(...paraRuns)
    }
  })
  if (runs.length === 0) warnings.push('text box produced no text runs (whitespace-only?)')
  return runs
}

/** Per-cell flattening for dialect tables (explicit px col widths / row heights in inline styles). */
function flattenTable(table, pos, style, warnings, scale) {
  const elements = []
  const cols = Array.from(table.querySelectorAll('col')).map((col) => pxNumber(styleOf(col).width, 0))
  const rows = Array.from(table.querySelectorAll('tr'))
  let y = pos.y
  rows.forEach((row) => {
    const rowStyle = styleOf(row)
    const rowH = scale.inch(pxNumber(rowStyle.height, 0)) || 0
    let x = pos.x
    for (const cell of Array.from(row.children ?? [])) {
      if ((cell.tagName ?? '').toLowerCase() !== 'td') continue
      const cellStyle = styleOf(cell)
      const w = scale.inch(pxNumber(cellStyle.width, cols[elements.length % Math.max(cols.length, 1)] ?? 0)) || pos.w / Math.max(rows.length, 1)
      const h = rowH || pos.h / Math.max(rows.length, 1)
      const fill = toPptxColor(cellStyle['background-color'] ?? cellStyle.background)
      const shape = { fill: fill ?? undefined, line: undefined, rectRadius: 0, isEllipse: false, transparency: null, opacity: 1 }
      if (cellStyle['border']) {
        const color = toPptxColor(cellStyle['border'].match(/#[0-9a-f]+|rgb\([^)]*\)/)?.[0])
        const width = parseFloat(cellStyle['border']) || 1
        if (color) shape.line = { color, width }
      }
      const runs = extractRuns(cell, { runOptions: { fontSize: 12 }, fontSizePx: 16 }, warnings, scale)
      if (runs.length > 0 || fill) {
        elements.push({
          type: 'shape',
          position: { x, y, w, h },
          shape,
          style: { fontSize: 12, margin: [2, 4, 2, 4], valign: 'top' },
          textRuns: runs,
        })
      }
      x += w
    }
    y += rowH || pos.h / Math.max(rows.length, 1)
  })
  if (elements.length === 0) warnings.push('table produced no cells')
  return elements
}

/** Effective px offset of an element relative to the slide root (sums nested absolute ancestors). */
function effectiveOffset(el, root) {
  let dx = 0
  let dy = 0
  let node = el
  while (node && node !== root) {
    const style = styleOf(node)
    if (isAbsolutePositioned(style)) {
      dx += pxNumber(style.left, 0)
      dy += pxNumber(style.top, 0)
    }
    node = node.parentElement
  }
  return { dx, dy }
}

/**
 * Parse one slide document/fragment into IR.
 * @param {string} html slide-N.html content (full doc or bare fragment)
 * @param {string} htmlDir directory the slide file lives in (relative asset resolution)
 * @returns {{background: object|null, elements: object[], warnings: string[]}}
 */
export function parseSlideHtmlToIR(html, htmlDir) {
  const warnings = []
  const { document } = parseHTML(html)
  const body = document.body
  // The docgen import may prepend a Google-Fonts <style> block to the first slide fragment —
  // the slide root is the first CONTAINER element child.
  const root = Array.from(body?.children ?? []).find(
    (child) => !SKIP_ROOT_TAGS.has((child.tagName ?? '').toLowerCase()),
  )
  if (!root) {
    return { background: null, elements: [], warnings: ['slide has no root element'] }
  }

  const rootStyle0 = styleOf(root)
  const scale = makeScale(pxNumber(rootStyle0.width, 1280), pxNumber(rootStyle0.height, 720), warnings)

  // ---- slide background ----
  const rootStyle = rootStyle0
  let background = null
  const bgValue = rootStyle.background ?? rootStyle['background-color'] ?? ''
  const bgImage = bgValue.match(/url\((['"]?)([^'")]+)\1\)/)
  if (bgImage) {
    const src = toImageSrc(bgImage[2], htmlDir, warnings)
    if (src) background = { type: 'image', path: src }
  } else if (bgValue.includes('gradient')) {
    warnings.push('gradient slide background flattened to white (dialect v1 limitation)')
  } else {
    const color = toPptxColor(bgValue)
    background = color ? { type: 'color', value: color } : { type: 'color', value: 'FFFFFF' }
  }

  // ---- top-level absolute elements (root children + one wrap-nesting level) ----
  const topLevel = []
  for (const child of kids(root)) {
    if (isAbsolutePositioned(child.getAttribute?.('style'))) {
      topLevel.push(child)
    } else {
      for (const grand of kids(child)) {
        if (isAbsolutePositioned(grand.getAttribute?.('style'))) topLevel.push(grand)
      }
    }
  }

  const elements = []
  for (const el of topLevel) {
    const tag = (el.tagName ?? '').toLowerCase()
    const style = styleOf(el)
    const { dx, dy } = effectiveOffset(el, root)
    const x = scale.inch(pxNumber(style.left, 0) + dx)
    const y = scale.inch(pxNumber(style.top, 0) + dy)
    const w = scale.inch(pxNumber(style.width, 0))
    const h = scale.inch(pxNumber(style.height, 0))
    const position = { x, y, w, h }
    const elementType = el.getAttribute?.('data-elementType') ?? el.getAttribute?.('data-element-type')

    // ---- skip: charts (SVG) ----
    if (elementType === 'chart' || el.querySelector?.('svg')) {
      warnings.push('chart/SVG element skipped (dialect v1 renders text, shapes, images, tables)')
      continue
    }

    // ---- images (bare <img> or wrapper with inner <img>) ----
    if (tag === 'img' || elementType === 'image') {
      const img = tag === 'img' ? el : el.querySelector?.('img')
      const src = img ? toImageSrc(img.getAttribute?.('src'), htmlDir, warnings) : null
      if (!src || w <= 0 || h <= 0) {
        if (src) warnings.push('image without usable geometry, skipped')
        continue
      }
      const radius = pxNumber(style['border-radius'], 0)
      elements.push({
        type: 'image',
        position,
        src,
        ...(radius > 0 ? { rectRadius: scale.inch(radius) } : {}),
      })
      continue
    }

    // ---- horizontal rule → line ----
    if (tag === 'hr') {
      elements.push({
        type: 'line',
        x1: x,
        y1: y,
        x2: x + (w || 9),
        y2: y,
        color: toPptxColor(style['background-color'] ?? style.background ?? '#000000') ?? '000000',
        width: scale.pt(pxNumber(style.height, 1)),
      })
      continue
    }

    // ---- tables: flatten to per-cell shapes ----
    const table = tag === 'table' ? el : el.querySelector?.('table')
    if (table) {
      elements.push(...flattenTable(table, position, style, warnings, scale))
      continue
    }

    // ---- text / shape ----
    const hasTextContent = (el.textContent ?? '').trim().length > 0
    const fillRaw = style['background-color'] ?? style.background ?? ''
    const fillParsed = parseCssColor(fillRaw)
    const fill = fillParsed ? toPptxColor(fillRaw) : null
    const runBase = {
      runOptions: {},
      color: toPptxColor(style.color),
      fontSizePx: pxNumber(style['font-size'], 16),
      bold: /bold|[6-9]00/.test(style['font-weight'] ?? ''),
      italic: style['font-style'] === 'italic',
    }
    const runs = hasTextContent ? extractRuns(el, runBase, warnings, scale) : []
    if (!fill && runs.length === 0) continue // purely decorative empty box

    const commonStyle = {}
    if (runBase.fontSizePx > 0) commonStyle.fontSize = scale.pt(runBase.fontSizePx)
    const align = style['text-align']
    if (['left', 'center', 'right', 'justify'].includes(align)) commonStyle.align = align
    const lineHeight = pxNumber(style['line-height'], 0)
    if (lineHeight > 0) commonStyle.lineSpacing = scale.pt(lineHeight)
    if (runBase.color) commonStyle.color = runBase.color
    if (runBase.bold) commonStyle.bold = true
    if (runBase.italic) commonStyle.italic = true
    if (style['font-family']) commonStyle.fontFace = style['font-family'].split(',')[0].replaceAll(/['"]/g, '').trim()

    if (fill) {
      const shape = {
        fill,
        line: undefined,
        rectRadius: scale.inch(pxNumber(style['border-radius'], 0)),
        isEllipse: pxNumber(style['border-radius'], 0) >= Math.min(pxNumber(style.width, 0), pxNumber(style.height, 0)) / 2 && pxNumber(style['border-radius'], 0) > 0,
        transparency: alphaToTransparency(fillParsed.alpha),
        opacity: 1,
      }
      const borderColor = toPptxColor(style['border-color'] ?? style.border?.match(/#[0-9a-f]+|rgb\([^)]*\)/)?.[0])
      const borderWidth = parseFloat(style['border-width'] ?? style.border) || 0
      if (borderColor && borderWidth > 0) shape.line = { color: borderColor, width: scale.pt(borderWidth) }
      elements.push({
        type: 'shape',
        position,
        shape,
        style: { ...commonStyle, margin: [3, 5, 3, 5], valign: style['vertical-align'] ?? 'top' },
        ...(runs.length > 0 ? { textRuns: runs } : {}),
      })
    } else {
      elements.push({
        type: 'text',
        position,
        style: commonStyle,
        text: runs,
      })
    }
  }

  return { background, elements, warnings }
}
