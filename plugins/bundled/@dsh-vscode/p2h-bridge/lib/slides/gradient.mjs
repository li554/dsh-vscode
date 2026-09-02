/**
 * p2h-bridge — CSS gradient → docgen/PptxGenJS gradient IR.
 *
 * The docgen import emits exactly two gradient shapes (import-pptx.js extractGradientFill):
 *   linear-gradient(<deg>deg, <color> <pos>%, ...)      — CSS angle in degrees
 *   radial-gradient(ellipse at <x>% <y>%, <color> <pos>%, ...)
 * The vendored PptxGenJS consumes (genXmlGradientFill):
 *   { type: 'linear', angle: cssDeg, stops: [{color:'RRGGBB', position: 0-100, transparency?: 0-100}] }
 *   { type: 'radial', centerX: 0-100, centerY: 0-100, stops: [...] }
 * convert.js maps shape gradients (el.shape.gradient) and slide backgrounds
 * (background = { type: 'gradient', gradient }) natively, so a faithful CSS parser
 * closes the round trip with NO rasterization.
 *
 * Parsing is defensive beyond the docgen subset (keyword angles like `to right`,
 * missing stop positions distributed evenly, rgb()/hsl()/8-digit hex colors) because
 * agent-edited slides may carry hand-written gradients.
 */

import { parseCssColor } from '../util.mjs'

/** Parse one `<color> <pos>%` stop (position optional). Returns null on unusable colors. */
function parseStop(token) {
  const text = token.trim()
  const match = text.match(/^(.*?)(?:\s+(-?[\d.]+)%)?$/s)
  if (!match) return null
  const color = parseCssColor(match[1])
  if (!color) return null
  return {
    color: color.hex.toUpperCase(),
    transparency: color.alpha >= 1 ? undefined : Math.round((1 - color.alpha) * 100),
    position: match[2] !== undefined ? clampPercent(parseFloat(match[2])) : null,
  }
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value))
}

/** Keyword angle (`to right` …) or `<N>deg|grad|rad|turn` → CSS degrees, else null. */
function parseAngleToken(token) {
  const text = token.trim().toLowerCase()
  const deg = text.match(/^(-?[\d.]+)deg$/)
  if (deg) return ((parseFloat(deg[1]) % 360) + 360) % 360
  const grad = text.match(/^(-?[\d.]+)grad$/)
  if (grad) return ((parseFloat(grad[1]) * 0.9) % 360 + 360) % 360
  const rad = text.match(/^(-?[\d.]+)rad$/)
  if (rad) return ((parseFloat(rad[1]) * 180 / Math.PI) % 360 + 360) % 360
  const turn = text.match(/^(-?[\d.]+)turn$/)
  if (turn) return ((parseFloat(turn[1]) * 360) % 360 + 360) % 360
  switch (text) {
    case 'to top': return 0
    case 'to right': return 90
    case 'to bottom': return 180
    case 'to left': return 270
    case 'to top right': case 'to right top': return 45
    case 'to bottom right': case 'to right bottom': return 135
    case 'to bottom left': case 'to left bottom': return 225
    case 'to top left': case 'to left top': return 315
    default: return null
  }
}

/** Split top-level commas (not inside parentheses). */
function splitTopLevel(text) {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of text) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current)
  return parts
}

/**
 * Parse a CSS gradient value into the PptxGenJS gradient IR, or null when the value
 * is not a usable gradient (plain colors return null — callers keep the solid path).
 */
export function parseGradientCss(value) {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase()
  const linear = text.match(/^linear-gradient\(([\s\S]*)\)$/)
  const radial = text.match(/^radial-gradient\(([\s\S]*)\)$/)
  if (!linear && !radial) return null

  const args = splitTopLevel(linear ? linear[1] : radial[1]).map((part) => part.trim()).filter(Boolean)
  if (args.length === 0) return null

  let angle = 180 // CSS default: to bottom
  let centerX = 50
  let centerY = 50
  let stopArgs = args

  if (linear) {
    const first = args[0]
    if (!first.includes('%') || parseStop(first) === null) {
      const parsed = parseAngleToken(first)
      if (parsed !== null) {
        angle = parsed
        stopArgs = args.slice(1)
      } else if (first.startsWith('to ') || first.endsWith('deg')) {
        stopArgs = args.slice(1) // unparseable angle-ish token — drop it
      }
    }
  } else {
    const first = args[0]
    if (!first.includes('#') && !first.includes('rgb') && !first.includes('hsl')) {
      // shape part: `ellipse at 50% 50%` / `circle at x y` / bare `at x% y%`
      const at = first.match(/at\s+(-?[\d.]+)%\s+(-?[\d.]+)%/)
      if (at) {
        centerX = clampPercent(parseFloat(at[1]))
        centerY = clampPercent(parseFloat(at[2]))
      }
      stopArgs = args.slice(1)
    }
  }

  const stops = stopArgs
    .map((token) => parseStop(token))
    .filter(Boolean)
  if (stops.length < 2) return null

  // Distribute missing positions evenly across the declared stops.
  if (stops.some((stop) => stop.position === null)) {
    const n = stops.length - 1
    stops.forEach((stop, idx) => {
      if (stop.position === null) stop.position = n === 0 ? 0 : clampPercent((idx / n) * 100)
    })
  }
  stops.sort((a, b) => a.position - b.position)

  return linear
    ? { type: 'linear', angle: Math.round(angle), stops }
    : { type: 'radial', centerX: Math.round(centerX), centerY: Math.round(centerY), stops }
}

/** True when the CSS value is a gradient this module can represent. */
export function isGradient(value) {
  return typeof value === 'string' && /gradient\s*\(/i.test(value) && parseGradientCss(value) !== null
}
