/**
 * p2h-bridge — shared parsing/format helpers for the dialect converter.
 *
 * The docgen import dialect is inline-CSS at 96 DPI (960×540 px slide); PptxGenJS consumes
 * inches for geometry and points for type. Everything in here is pure and browser-free
 * (linkedom supplies the DOM on the import side; our parser walks attributes directly).
 */

/** CSS named colors we accept (subset covers what docgen import emits; unknown → null). */
const NAMED_COLORS = new Map(Object.entries({
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', brown: '#a52a2a',
  gray: '#808080', grey: '#808080', navy: '#000080', teal: '#008080', silver: '#c0c0c0',
  gold: '#ffd700', maroon: '#800000', olive: '#808000', lime: '#00ff00', aqua: '#00ffff',
  cyan: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff', indigo: '#4b0082', violet: '#ee82ee',
}))

function clamp255(n) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function hex2(n) {
  return n.toString(16).padStart(2, '0')
}

/**
 * Parse any CSS color the dialect emits into `{hex, alpha}`.
 * Supports #rgb/#rgba/#rrggbb/#rrggbbaa, rgb()/rgba() (float or %, optional alpha),
 * and a named-color subset. Returns null for gradients/unsupported forms.
 */
export function parseCssColor(input) {
  if (typeof input !== 'string') return null
  let text = input.trim().toLowerCase()
  if (!text || text === 'transparent' || text === 'none' || text.includes('gradient')) return null
  if (NAMED_COLORS.has(text)) {
    return { hex: NAMED_COLORS.get(text).slice(1), alpha: 1 }
  }
  if (text.startsWith('#')) {
    const body = text.slice(1)
    if (body.length === 3 || body.length === 4) {
      const r = parseInt(body[0] + body[0], 16)
      const g = parseInt(body[1] + body[1], 16)
      const b = parseInt(body[2] + body[2], 16)
      const alpha = body.length === 4 ? parseInt(body[3] + body[3], 16) / 255 : 1
      return { hex: hex2(r) + hex2(g) + hex2(b), alpha }
    }
    if (body.length === 6 || body.length === 8) {
      const alpha = body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1
      return { hex: body.slice(0, 6), alpha }
    }
    return null
  }
  const fn = text.match(/^(rgba?|hsla?)\(([^)]*)\)$/)
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean)
    if (fn[1] === 'rgb' || fn[1] === 'rgba') {
      if (parts.length < 3) return null
      const ch = parts.slice(0, 3).map((p) => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p)))
      if (ch.some((v) => !Number.isFinite(v))) return null
      const alpha = parts.length > 3 && Number.isFinite(parseFloat(parts[3])) ? parseFloat(parts[3]) : 1
      return { hex: hex2(clamp255(ch[0])) + hex2(clamp255(ch[1])) + hex2(clamp255(ch[2])), alpha }
    }
    // hsl/hsla → rgb
    if (parts.length < 3) return null
    const h = ((parseFloat(parts[0]) % 360) + 360) % 360
    const s = parseFloat(parts[1]) / 100
    const l = parseFloat(parts[2]) / 100
    if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return null
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = l - c / 2
    let rgb
    if (h < 60) rgb = [c, x, 0]
    else if (h < 120) rgb = [x, c, 0]
    else if (h < 180) rgb = [0, c, x]
    else if (h < 240) rgb = [0, x, c]
    else if (h < 300) rgb = [x, 0, c]
    else rgb = [c, 0, x]
    const alpha = parts.length > 3 && Number.isFinite(parseFloat(parts[3])) ? parseFloat(parts[3]) : 1
    return {
      hex: hex2(clamp255((rgb[0] + m) * 255)) + hex2(clamp255((rgb[1] + m) * 255)) + hex2(clamp255((rgb[2] + m) * 255)),
      alpha,
    }
  }
  return null
}

/** Split an inline style attribute into a lowercase-keyed map (last declaration wins). */
export function parseStyleAttr(style) {
  const out = {}
  if (typeof style !== 'string') return out
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':')
    if (idx <= 0) continue
    const key = decl.slice(0, idx).trim().toLowerCase()
    const value = decl.slice(idx + 1).trim()
    if (key) out[key] = value
  }
  return out
}

/** Parse a px/pt/number dimension into a float (or fallback). */
export function pxNumber(value, fallback = 0) {
  if (typeof value !== 'string') return fallback
  const m = value.match(/^(-?\d+(?:\.\d+)?)px/)
  return m ? parseFloat(m[1]) : fallback
}

/** True when the element carries `position:absolute` in its inline style. */
export function isAbsolutePositioned(style) {
  return /(^|[\s;])position\s*:\s*absolute/.test(style ?? '')
}

/**
 * Read intrinsic image dimensions from bytes (PNG IHDR / JPEG SOF / GIF header) so
 * object-fit cover crops stay faithful. Returns null for unknown formats.
 */
export function imageDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null
  // PNG: 8-byte signature, IHDR at offset 16 (width 16..20, height 20..24, big-endian)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  // GIF: "GIF8" + logical screen width/height at 6..10 (little-endian)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) }
  }
  // JPEG: scan segment markers for SOF0..SOF3/SOF9 (baseline/progressive with dims)
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++
        continue
      }
      const marker = buffer[offset + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }
      }
      const len = buffer.readUInt16BE(offset + 2)
      if (len <= 0) return null
      offset += 2 + len
    }
  }
  return null
}

/** Best-effort MIME for a local asset path (falls back to png, docgen's own default). */
export function mimeForPath(filePath) {
  const ext = String(filePath).toLowerCase().replace(/^.*\./, '.')
  return MIME_BY_EXT.get(ext) ?? 'image/png'
}

const MIME_BY_EXT = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.bmp', 'image/bmp'],
])

/** Escape text for HTML emission. */
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
