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
import { parseGradientCss } from './gradient.mjs'
import { measureText } from './font-metrics.mjs'

const PX_PER_PT = 96 / 72 // css px per pt (1pt = 1/72in)

/** linkedom collections are array-like but not always iterable — normalize once. */
const kids = (node) => Array.from(node?.children ?? [])

const SKIP_ROOT_TAGS = new Set(['style', 'script', 'link', 'meta', 'title'])

/**
 * Scale factors derived from the slide root's canvas size (docgen import emits 1280×720 px).
 * The target slide size (inches) decides the px→inch mapping: 1280px maps to `slideW` inches.
 * `slideH` defaults to a 16:9 height so non-16:9 sources stay HTML-faithful (no vertical stretch).
 */
function makeScale(canvasW, canvasH, warnings, slideW = 10, slideH = 5.625) {
  const pxPerInchX = canvasW > 0 ? canvasW / slideW : 128
  const pxPerInchY = canvasH > 0 ? canvasH / slideH : 128
  if (Math.abs(pxPerInchX - pxPerInchY) / Math.max(pxPerInchX, pxPerInchY) > 0.05) {
    warnings.push(`canvas ${canvasW}x${canvasH} vs slide ${slideW}"x${slideH}" aspect mismatch — geometry may stretch (using width-derived scale)`)
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

const EMU_PER_INCH = 914400

/**
 * CSS `clip-path: polygon(...)` → PptxGenJS custGeom point array (EMU, relative to the
 * element's border box). Coordinates may be % or px (missing unit = %, per CSS). Returns
 * null when the value is not a polygon we can map, so the element falls back to a plain
 * rect instead of being dropped. convert.js renders `el.shape.customGeometry` as a
 * ShapeType.custGeom (docgen's browser parse does the same for clip-path: polygon shapes).
 */
function clipPathPolygonToCustGeom(value, widthPx, heightPx, wInch, hInch) {
  const match = String(value ?? '').match(/polygon\(\s*([\s\S]*?)\s*\)/)
  if (!match) return null
  const rawPoints = match[1].split(',').map((p) => p.trim()).filter(Boolean)
  if (rawPoints.length < 3) return null // not a valid polygon
  const coordToEmu = (coord, dimPx, dimInch) => {
    const m = String(coord).trim().match(/^([-+]?[\d.]+)(%|px)?$/)
    if (!m) return null
    const num = parseFloat(m[1])
    const pct = m[2] === '%' ? num : dimPx > 0 ? (num / dimPx) * 100 : 0
    return Math.round((pct / 100) * dimInch * EMU_PER_INCH)
  }
  const points = []
  for (let i = 0; i < rawPoints.length; i++) {
    const [xRaw, yRaw] = rawPoints[i].split(/\s+/)
    if (xRaw == null || yRaw == null) return null
    const x = coordToEmu(xRaw, widthPx, wInch)
    const y = coordToEmu(yRaw, heightPx, hInch)
    if (x == null || y == null) return null
    points.push(i === 0 ? { x, y, moveTo: true } : { x, y })
  }
  points.push({ close: true })
  return points
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
            strike: inherited.strike || (style['text-decoration'] ?? '').includes('line-through'),
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
      strike: base.strike,
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
 * Measure the flattened text of a run set with fontkit (precise width / wrap /
 * height at the element's box width). Returns null when measurement is
 * impossible (empty text, unknown font) — convert.js then keeps its heuristics.
 * Geometry passed in INCHES; font-metrics works in points (1in = 72pt).
 */
function measureRuns(runs, style, wInch, hInch) {
  const text = (runs ?? []).map((r) => r.text ?? '').join('')
  if (!text.trim()) return null
  return measureText(text, {
    fontFace: style?.fontFace,
    fontSizePt: style?.fontSize,
    bold: style?.bold === true,
    italic: style?.italic === true,
    charSpacingPt: style?.charSpacing,
    lineSpacingPt: style?.lineSpacing,
    boxWidthPt: wInch > 0 ? wInch * 72 : undefined,
    boxHeightPt: hInch > 0 ? hInch * 72 : undefined,
  })
}

//#region chart SVG → native PPTX elements (docgen chart dialect round trip)
/**
 * docgen's import renders pptx charts as inline SVGs inside
 * `<div data-elementType="chart" style="position:absolute;…">` wrappers (renderChartSvg:
 * bars as rounded <path>/<rect>, axes/gridlines as <line>, labels/titles as <text>).
 * Instead of dropping charts on export, walk that SVG back into native pptx elements —
 * bars become editable shapes, labels stay editable text. Geometry inside the svg maps
 * 1:1 to wrapper px (svg width/height attrs == wrapper size), so each coordinate is
 * wrapper origin + px → inches via the slide scale.
 */
function svgColorAttr(value) {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase()
  if (!text || text === 'none' || text === 'transparent') return null
  return toPptxColor(text)
}

function svgNumber(el, attr, fallback = 0) {
  const value = parseFloat(el.getAttribute?.(attr) ?? '')
  return Number.isFinite(value) ? value : fallback
}

/** Bounding box of an SVG path (absolute M/L/H/V/Q/C commands only — docgen's chart subset). */
function pathBoundingBox(d) {
  const tokens = String(d ?? '').match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []
  let x = 0
  let y = 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let hasPoint = false
  let curved = false
  const track = (px, py) => {
    if (!Number.isFinite(px) || !Number.isFinite(py)) return
    minX = Math.min(minX, px)
    minY = Math.min(minY, py)
    maxX = Math.max(maxX, px)
    maxY = Math.max(maxY, py)
    hasPoint = true
  }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (/[a-zA-Z]/.test(token)) {
      const cmd = token.toUpperCase()
      if (cmd === 'Q' || cmd === 'C' || cmd === 'S' || cmd === 'T') curved = true
      if (cmd === 'M' || cmd === 'L' || cmd === 'T') {
        x = parseFloat(tokens[++i]); y = parseFloat(tokens[++i]); track(x, y)
      } else if (cmd === 'H') {
        x = parseFloat(tokens[++i]); track(x, y)
      } else if (cmd === 'V') {
        y = parseFloat(tokens[++i]); track(x, y)
      } else if (cmd === 'Q' || cmd === 'S') {
        track(x, parseFloat(tokens[++i])); track(parseFloat(tokens[++i]), parseFloat(tokens[++i]))
        x = parseFloat(tokens[++i]); y = parseFloat(tokens[++i]); track(x, y)
      } else if (cmd === 'C') {
        track(x, parseFloat(tokens[++i])); track(parseFloat(tokens[++i]), parseFloat(tokens[++i]))
        track(parseFloat(tokens[++i]), parseFloat(tokens[++i]))
        x = parseFloat(tokens[++i]); y = parseFloat(tokens[++i]); track(x, y)
      } else if (cmd === 'Z') {
        // close — no coordinates
      } else {
        // relative or unsupported — bail out conservatively
        return null
      }
    }
  }
  return hasPoint ? { minX, minY, maxX, maxY, curved } : null
}

/** One docgen chart SVG → pptx elements (shapes/lines/texts) in slide inches. */
function parseChartSvg(wrapper, position, warnings, scale) {
  const svg = wrapper.querySelector?.('svg')
  if (!svg) return []
  const elements = []
  const anchorX = position.x
  const anchorY = position.y

  const place = (px, py) => ({ x: anchorX + scale.inch(px), y: anchorY + scale.inch(py) })
  const box = (px, py, pw, ph) => ({
    x: anchorX + scale.inch(px),
    y: anchorY + scale.inch(py),
    w: scale.inch(Math.max(pw, 1)),
    h: scale.inch(Math.max(ph, 1)),
  })

  for (const node of Array.from(svg.children ?? [])) {
    const tag = (node.tagName ?? '').toLowerCase()
    if (tag === 'line') {
      const color = svgColorAttr(node.getAttribute?.('stroke')) ?? 'D0D0D0'
      const width = scale.pt(svgNumber(node, 'stroke-width', 1))
      elements.push({
        type: 'line',
        x1: anchorX + scale.inch(svgNumber(node, 'x1')),
        y1: anchorY + scale.inch(svgNumber(node, 'y1')),
        x2: anchorX + scale.inch(svgNumber(node, 'x2')),
        y2: anchorY + scale.inch(svgNumber(node, 'y2')),
        color,
        width,
      })
      continue
    }
    if (tag === 'rect') {
      const fill = svgColorAttr(node.getAttribute?.('fill'))
      const stroke = svgColorAttr(node.getAttribute?.('stroke'))
      if (!fill && !stroke) continue
      const px = svgNumber(node, 'x')
      const py = svgNumber(node, 'y')
      const pw = svgNumber(node, 'width')
      const ph = svgNumber(node, 'height')
      const rx = svgNumber(node, 'rx')
      const fillOpacity = parseFloat(node.getAttribute?.('fill-opacity') ?? '1')
      elements.push({
        type: 'shape',
        position: box(px, py, pw, ph),
        shape: {
          fill: fill ?? undefined,
          line: stroke ? { color: stroke, width: scale.pt(svgNumber(node, 'stroke-width', 1)) } : undefined,
          rectRadius: rx > 0 ? scale.inch(rx) : 0,
          isEllipse: false,
          transparency: Number.isFinite(fillOpacity) && fillOpacity < 1 ? Math.round((1 - fillOpacity) * 100) : null,
          opacity: 1,
        },
        style: {},
      })
      continue
    }
    if (tag === 'path') {
      const fill = svgColorAttr(node.getAttribute?.('fill'))
      const bbox = pathBoundingBox(node.getAttribute?.('d'))
      if (!fill || !bbox) continue
      elements.push({
        type: 'shape',
        position: box(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY),
        shape: {
          fill,
          line: undefined,
          rectRadius: bbox.curved ? scale.inch(Math.min(4, (bbox.maxX - bbox.minX) * 0.12)) : 0,
          isEllipse: false,
          transparency: null,
          opacity: 1,
        },
        style: {},
      })
      continue
    }
    if (tag === 'text') {
      const content = String(node.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (!content) continue
      const fontSize = svgNumber(node, 'font-size', 11)
      const color = svgColorAttr(node.getAttribute?.('fill')) ?? '333333'
      const anchor = (node.getAttribute?.('text-anchor') ?? 'start').toLowerCase()
      const bold = (node.getAttribute?.('font-weight') ?? '') === 'bold'
      const transform = node.getAttribute?.('transform') ?? ''
      const rotateMatch = transform.match(/rotate\(\s*(-?[\d.]+)/)
      const rotate = rotateMatch ? parseFloat(rotateMatch[1]) : 0
      // Estimate a text box around the anchor point; PowerPoint re-flows single-line
      // labels inside it, so generous width + matching align keeps the visual position.
      const estW = Math.max(fontSize * 0.68 * content.length, fontSize * 2.2) + fontSize
      const estH = fontSize * 1.7
      let px
      let align
      if (anchor === 'middle') {
        px = svgNumber(node, 'x') - estW / 2
        align = 'center'
      } else if (anchor === 'end') {
        px = svgNumber(node, 'x') - estW
        align = 'right'
      } else {
        px = svgNumber(node, 'x')
        align = 'left'
      }
      const py = svgNumber(node, 'y') - fontSize * 0.92
      const element = {
        type: 'text',
        position: box(px, py, estW, estH),
        style: {
          fontSize: scale.pt(fontSize),
          color,
          align,
          valign: 'top',
          margin: [0, 0, 0, 0],
          wrap: false,
        },
        text: [{ text: content, options: { fontSize: scale.pt(fontSize), color, bold: bold || undefined } }],
      }
      if (rotate !== 0) {
        // Rotated axis titles: center the box on the transform origin, then rotate.
        const rotMatch = transform.match(/rotate\(\s*-?[\d.]+(?:\s*,\s*(-?[\d.]+))?(?:\s*,\s*(-?[\d.]+))?\s*\)/)
        const cx = rotMatch && rotMatch[1] !== undefined ? parseFloat(rotMatch[1]) : svgNumber(node, 'x')
        const cy = rotMatch && rotMatch[2] !== undefined ? parseFloat(rotMatch[2]) : svgNumber(node, 'y')
        element.position = box(cx - estH / 2, cy - estW / 2, estH, estW)
        element.style.rotate = rotate
      }
      elements.push(element)
      continue
    }
    // g/defs/etc. — docgen charts emit a flat svg; ignore anything else
  }
  if (elements.length === 0) warnings.push('chart svg produced no elements (unsupported dialect?)')
  return elements
}
//#endregion

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
    return { background: null, elements: [], warnings: ['slide has no root element'], canvasSize: { w: 10, h: 5.625, sourceH: 5.625 } }
  }

  // Source slide size carried by docgen import as EMU data attributes on the root div
  // (falls back to the classic 10"×5.625" canvas for hand-written / legacy fragments).
  const srcWEmu = Number(root.getAttribute?.('data-slide-w-emu') ?? 0)
  const srcHEmu = Number(root.getAttribute?.('data-slide-h-emu') ?? 0)
  const slideW = srcWEmu > 0 ? srcWEmu / EMU_PER_INCH : 10
  const slideH = srcWEmu > 0 ? slideW * (9 / 16) : 5.625
  const sourceH = srcHEmu > 0 ? srcHEmu / EMU_PER_INCH : slideH

  const rootStyle0 = styleOf(root)
  const scale = makeScale(pxNumber(rootStyle0.width, 1280), pxNumber(rootStyle0.height, 720), warnings, slideW, slideH)

  // ---- slide background ----
  const rootStyle = rootStyle0
  let background = null
  const bgValue = rootStyle.background ?? rootStyle['background-color'] ?? ''
  const bgImageValue = rootStyle['background-image'] ?? ''
  const bgImage = bgValue.match(/url\((['"]?)([^'")]+)\1\)/) ?? bgImageValue.match(/url\((['"]?)([^'")]+)\1\)/)
  // docgen import renders picture backgrounds as a full-bleed absolutely-positioned
  // <img> as the FIRST child of the slide root. Lift it back into the background slot
  // so export keeps native slide-background semantics instead of a foreground pic.
  const rootKids = kids(root)
  let bgImgEl = null
  if (rootKids.length > 0 && (rootKids[0].tagName ?? '').toLowerCase() === 'img') {
    const bgSt = styleOf(rootKids[0])
    const rootW = pxNumber(rootStyle0.width, 1280)
    const rootH = pxNumber(rootStyle0.height, 720)
    const wStr = String(bgSt.width ?? '')
    const hStr = String(bgSt.height ?? '')
    const fullBleed = pxNumber(bgSt.left, 0) === 0 && pxNumber(bgSt.top, 0) === 0 &&
      (pxNumber(bgSt.width, 0) === rootW || /100%$/i.test(wStr)) &&
      (pxNumber(bgSt.height, 0) === rootH || /100%$/i.test(hStr))
    if (fullBleed) bgImgEl = rootKids[0]
  }
  if (bgImgEl) {
    const src = toImageSrc(bgImgEl.getAttribute?.('src'), htmlDir, warnings)
    if (src) background = { type: 'image', path: src }
    else background = { type: 'color', value: 'FFFFFF' }
  } else if (bgImage) {
    const src = toImageSrc(bgImage[2], htmlDir, warnings)
    if (src) background = { type: 'image', path: src }
  } else if (parseGradientCss(bgValue) || parseGradientCss(bgImageValue)) {
    // docgen IR natively supports gradient backgrounds (convert.js applyBackground) —
    // emit {type:'gradient'} instead of flattening to white.
    background = { type: 'gradient', gradient: parseGradientCss(bgValue) ?? parseGradientCss(bgImageValue) }
  } else {
    const color = toPptxColor(bgValue)
    background = color ? { type: 'color', value: color } : { type: 'color', value: 'FFFFFF' }
  }

  // ---- top-level absolute elements (root children + one wrap-nesting level) ----
  const topLevel = []
  for (const child of rootKids) {
    if (child === bgImgEl) continue
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

    // ---- charts: reconstruct docgen chart SVGs as native (editable) pptx elements ----
    // Only elements explicitly marked as charts carry reconstructable chart SVGs;
    // generic `div > svg` (e.g. decorative icon freeforms imported from PPTX) must
    // fall through to normal shape/text handling, not be parsed as a chart.
    if (elementType === 'chart') {
      const chartElements = parseChartSvg(el, position, warnings, scale)
      if (chartElements.length > 0) {
        elements.push(...chartElements)
      } else {
        warnings.push('chart/SVG element skipped (dialect renders text, shapes, images, tables)')
      }
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
      const imageEl = {
        type: 'image',
        position,
        src,
        ...(radius > 0 ? { rectRadius: scale.inch(radius) } : {}),
      }
      // srcRect-cropped images: import-pptx renders them as an `overflow:hidden` wrapper
      // div whose inner <img> is scaled up and offset (negative left/top) so the visible
      // region fills the wrapper. Preserve that crop on export via PptxGenJS crop sizing,
      // otherwise the full image is stretched into the box and the crop is lost.
      if (tag !== 'img' && img && /hidden/i.test(style.overflow ?? '')) {
        const imgStyle = styleOf(img)
        const wrapperW = pxNumber(style.width, 0)
        const wrapperH = pxNumber(style.height, 0)
        const imgW = pxNumber(imgStyle.width, wrapperW)
        const imgH = pxNumber(imgStyle.height, wrapperH)
        const imgLeft = pxNumber(imgStyle.left, 0)
        const imgTop = pxNumber(imgStyle.top, 0)
        const isCropped = wrapperW > 0 && wrapperH > 0 && imgW > 0 && imgH > 0 &&
          (Math.abs(imgW - wrapperW) > 0.5 || Math.abs(imgH - wrapperH) > 0.5 || imgLeft !== 0 || imgTop !== 0)
        if (isCropped) {
          const visL = -imgLeft
          const visT = -imgTop
          const visR = visL + wrapperW
          const visB = visT + wrapperH
          if (visR > visL && visB > visT) {
            // Full (unclipped) image extent = the inner img display box; visible box =
            // the wrapper. convert.js maps these to a PPTX <a:srcRect>.
            imageEl.effW = scale.inch(imgW)
            imageEl.effH = scale.inch(imgH)
            imageEl.sizing = {
              type: 'crop',
              x: scale.inch(visL),
              y: scale.inch(visT),
              w: scale.inch(wrapperW),
              h: scale.inch(wrapperH),
            }
          }
        }
      }
      elements.push(imageEl)
      // clip-path on pictures: import-pptx renders custGeom-clipped photos as a
      // polygon clip on the wrapper (e.g. the right-triangle photo mask). PptxGenJS
      // pictures cannot carry custom geometry natively — export.mjs post-processes
      // the generated pptx and swaps the pic's prstGeom for this custGeom so the
      // clip survives the round trip and artwork underneath stays visible.
      const picClipGeom = clipPathPolygonToCustGeom(
        style['clip-path'],
        pxNumber(style.width, 0),
        pxNumber(style.height, 0),
        w,
        h,
      )
      if (picClipGeom) imageEl.clipGeom = picClipGeom
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
    const fillRaw = style['background-color'] ?? style.background ?? style['background-image'] ?? ''
    const gradient = parseGradientCss(fillRaw)
    const fillParsed = parseCssColor(fillRaw)
    const fill = fillParsed ? toPptxColor(fillRaw) : null
    const runBase = {
      runOptions: {},
      color: toPptxColor(style.color),
      fontSizePx: pxNumber(style['font-size'], 16),
      bold: /bold|[6-9]00/.test(style['font-weight'] ?? ''),
      italic: style['font-style'] === 'italic',
      strike: (style['text-decoration'] ?? '').includes('line-through'),
    }
    const runs = hasTextContent ? extractRuns(el, runBase, warnings, scale) : []

    // ---- line shapes: zero-dimension boxes carrying a border edge ----
    // The import of PPTX `line` preset shapes renders as a border-top/left stroke on an
    // h=0 / w=0 box. Reconstruct it as a native line so round-trips don't lose it.
    if (!fill && !gradient && runs.length === 0 && (w === 0 || h === 0)) {
      const borderSide = style['border-top'] ?? style['border-left'] ?? style['border-right'] ?? style['border-bottom'] ?? ''
      const stroke = borderSide.match(/([\d.]+)px\s+\w+\s*(#[0-9a-fA-F]+|rgb\([^)]*\))/)
      if (stroke) {
        const isHorizontal = h === 0
        elements.push({
          type: 'line',
          x1: x,
          y1: y,
          x2: isHorizontal ? x + w : x,
          y2: isHorizontal ? y : y + h,
          color: toPptxColor(stroke[2]) ?? '000000',
          width: scale.pt(Math.max(parseFloat(stroke[1]), 1)),
        })
        continue
      }
    }
    if (!fill && !gradient && runs.length === 0) continue // purely decorative empty box

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
    const letterSpacing = pxNumber(style['letter-spacing'], 0)
    if (letterSpacing !== 0) commonStyle.charSpacing = scale.pt(letterSpacing)

    /** CSS box-shadow → PptxGenJS outer shadow (px offsets/blur → pt, rgba alpha → opacity). */
    const parseBoxShadow = (value) => {
      const match = String(value ?? '').match(/(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?(?:\s+(-?[\d.]+)px)?\s*(rgba?\([^)]*\)|#[0-9a-fA-F]+|\b\w+\b)?/)
      if (!match) return null
      const dx = parseFloat(match[1])
      const dy = parseFloat(match[2])
      const blur = match[3] !== undefined ? parseFloat(match[3]) : 0
      // match[4] is the optional spread radius; the color is match[5].
      const color = match[5] !== undefined ? parseCssColor(match[5]) : { hex: '000000', alpha: 0.4 }
      if (!color) return null
      return {
        type: 'outer',
        angle: Math.round((Math.atan2(dy, dx) * 180) / Math.PI),
        blur: scale.pt(blur),
        offset: scale.pt(Math.hypot(dx, dy)),
        color: color.hex.toUpperCase(),
        opacity: color.alpha,
      }
    }
    const shadow = parseBoxShadow(style['box-shadow'])
    const rotateMatch = (style.transform ?? '').match(/rotate\(\s*(-?[\d.]+)deg/)
    const clipGeom = clipPathPolygonToCustGeom(style['clip-path'], pxNumber(style.width, 0), pxNumber(style.height, 0), w, h)

    if (fill || gradient) {
      const shape = {
        fill: fill ?? undefined,
        // Native gradient fill (convert.js maps el.shape.gradient → PptxGenJS gradFill).
        ...(gradient ? { gradient } : {}),
        line: undefined,
        rectRadius: scale.inch(pxNumber(style['border-radius'], 0)),
        isEllipse: pxNumber(style['border-radius'], 0) >= Math.min(pxNumber(style.width, 0), pxNumber(style.height, 0)) / 2 && pxNumber(style['border-radius'], 0) > 0,
        transparency: fillParsed ? alphaToTransparency(fillParsed.alpha) : null,
        opacity: 1,
        ...(shadow ? { shadow } : {}),
        // convert.js reads the CSS rotation from el.shape.rotate (not style) for shapes.
        ...(rotateMatch ? { rotate: parseFloat(rotateMatch[1]) } : {}),
        // clip-path: polygon() → native custGeom polygon (angled wedges/triangles stay vector).
        ...(clipGeom ? { customGeometry: clipGeom } : {}),
      }
      const borderColor = toPptxColor(style['border-color'] ?? style.border?.match(/#[0-9a-f]+|rgb\([^)]*\)/)?.[0])
      const borderWidth = parseFloat(style['border-width'] ?? style.border) || 0
      if (borderColor && borderWidth > 0) shape.line = { color: borderColor, width: scale.pt(borderWidth) }
      elements.push({
        type: 'shape',
        position,
        shape,
        style: { ...commonStyle, margin: [3, 5, 3, 5], valign: style['vertical-align'] ?? 'top' },
        ...(runs.length > 0
          ? {
              textRuns: runs,
              measured: measureRuns(runs, { ...commonStyle, margin: [3, 5, 3, 5] }, w, h),
            }
          : {}),
      })
    } else {
      elements.push({
        type: 'text',
        position,
        style: commonStyle,
        text: runs,
        measured: measureRuns(runs, commonStyle, w, h),
      })
    }
  }

  return { background, elements, warnings, canvasSize: { w: slideW, h: slideH, sourceH } }
}
