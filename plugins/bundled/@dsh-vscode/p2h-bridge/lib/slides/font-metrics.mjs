/**
 * p2h-bridge — font-metrics.mjs
 *
 * Precise text measurement for PPTX export using the vendored pure-JS fontkit.
 *
 * Why: the docgen convert.js text path uses heuristic width/height "buffers"
 * (2–10%) to compensate for font-metric drift between Chromium and PowerPoint /
 * LibreOffice. That guesswork is what makes exported text truncate or reflow
 * differently from the HTML. Instead we measure the ACTUAL glyph advance width
 * with fontkit against the real system font the text will render with, so the
 * single-line / wrap / box-fit decisions become deterministic.
 *
 * Resolution model:
 *  1. Resolve CSS `font-family` → a system font file (per-platform font dirs).
 *     A lazy one-time scan builds a family→face index (TTC collections
 *     contribute each of their faces), cached for the process lifetime.
 *  2. If the text run contains CJK code points and the resolved face cannot
 *     cover them, fall back to a CJK-capable system font so measurements match
 *     what PowerPoint will actually draw.
 *  3. Face selection honors `bold` via the matching Bold subfamily when present.
 *
 * All measurements are returned in points at the requested pt size. The module
 * is dependency-free besides the vendored fontkit and only touches the file
 * system lazily (font dir scan) — safe for the offline embedded runtime.
 */

import { openSync } from 'fontkit'
import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// System font directory discovery
// ---------------------------------------------------------------------------

function systemFontDirs() {
  if (process.platform === 'win32') {
    const winDir = process.env.WINDIR || 'C:\\Windows'
    return [path.join(winDir, 'Fonts')]
  }
  if (process.platform === 'darwin') {
    const home = process.env.HOME || ''
    return ['/System/Library/Fonts', '/Library/Fonts', path.join(home, 'Library', 'Fonts')]
  }
  const home = process.env.HOME || ''
  return ['/usr/share/fonts', '/usr/local/share/fonts', path.join(home, '.fonts')]
}

// ---------------------------------------------------------------------------
// Family → face index (built lazily once, then cached)
// ---------------------------------------------------------------------------

/** @type {Map<string, {file: string, subfamily: string, postscript: string}>} */
let familyIndex = null

/** Build {lowercasedFamily: [{file, subfamily, postscript}]} by scanning font dirs. */
function buildFamilyIndex() {
  const index = new Map()
  const pushFace = (family, subfamily, postscript, file) => {
    if (!family) return
    const key = family.toLowerCase()
    if (!index.has(key)) index.set(key, [])
    const list = index.get(key)
    if (!list.some((f) => f.file === file && f.subfamily === subfamily)) {
      list.push({ file, subfamily, postscript })
    }
  }
  for (const dir of systemFontDirs()) {
    let names = []
    try {
      names = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (!/\.(ttf|otf|ttc)$/i.test(name)) continue
      const file = path.join(dir, name)
      try {
        const font = openSync(file)
        if (Array.isArray(font.fonts)) {
          // TrueType collection: index each face separately.
          for (const face of font.fonts) {
            pushFace(face.familyName, face.subfamilyName, face.postscriptName, file)
          }
        } else {
          pushFace(font.familyName, font.subfamilyName, font.postscriptName, file)
        }
      } catch {
        // unreadable/corrupt font file — skip
      }
    }
  }
  return index
}

function familyIndexCache() {
  if (!familyIndex) familyIndex = buildFamilyIndex()
  return familyIndex
}

// ---------------------------------------------------------------------------
// Face opening with caching
// ---------------------------------------------------------------------------

const FONT_CACHE = new Map()

/** @type {Map<string, object>} open fontkit font objects, keyed by "file#postscript". */
function getFont(file, postscript) {
  const key = postscript ? `${file}#${postscript}` : file
  let font = FONT_CACHE.get(key)
  if (font) return font
  try {
    const opened = openSync(file)
    if (Array.isArray(opened.fonts)) {
      // Collection: select the requested face (default: first).
      const face = postscript
        ? opened.fonts.find((f) => f.postscriptName === postscript)
        : opened.fonts[0]
      font = face ?? opened.fonts[0]
    } else {
      font = opened
    }
  } catch {
    font = null
  }
  FONT_CACHE.set(key, font)
  return font
}

/**
 * Resolve a CSS font-family string + text to the best fontkit font.
 * Returns null when nothing usable is found (caller falls back to heuristics).
 */
function resolveFont(fontFamily, text, bold) {
  const fam = String(fontFamily ?? '').trim().replace(/^["']|["']$/g, '')
  const index = familyIndexCache()
  const hasCJK = /[\u3000-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/.test(text ?? '')

  const pickFace = (candidates) => {
    if (!candidates || candidates.length === 0) return null
    if (bold) {
      const boldFace = candidates.find((c) => /\bbold\b/i.test(c.subfamily))
      if (boldFace) return boldFace
    }
    return candidates.find((c) => !/bold|italic/i.test(c.subfamily)) ?? candidates[0]
  }

  // Families to try, in order: the declared one (if any), then the platform
  // sans-serif defaults — HTML with no font-family renders as Chromium's
  // sans-serif (Arial on Windows), which is what PowerPoint shows too.
  const familyQueue = []
  if (fam) familyQueue.push(fam)
  familyQueue.push('Arial', 'Segoe UI', 'Helvetica Neue', 'Helvetica')

  let font = null
  for (const f of familyQueue) {
    const lower = f.toLowerCase()
    if (!lower || lower === 'sans-serif' || lower === 'serif' || lower === 'monospace') continue
    const candidates = index.get(lower)
    if (!candidates || candidates.length === 0) continue
    const chosen = pickFace(candidates)
    if (!chosen) continue
    const candidate = getFont(chosen.file, chosen.postscript)
    if (!candidate) continue
    // CJK coverage check: if the run contains CJK but the face can't draw it,
    // try the next family (a latin-only face would under-measure those glyphs).
    if (hasCJK) {
      let covered = true
      for (const cp of uniqueCodePoints(text)) {
        if (!candidate.hasGlyphForCodePoint(cp)) {
          covered = false
          break
        }
      }
      if (!covered) continue
    }
    font = candidate
    break
  }

  if (!font && hasCJK) {
    // Try CJK-capable families from the index (prefer ones with CJK coverage).
    const cjkKeys = ['microsoft yahei', '微软雅黑', 'simhei', '黑体', 'simsun', '宋体', 'pingfang sc', 'pingfang', 'songti sc', 'noto sans sc', 'noto sans cjk sc', 'hei']
    for (const key of cjkKeys) {
      const cjkCands = index.get(key)
      if (!cjkCands || cjkCands.length === 0) continue
      const face = pickFace(cjkCands)
      if (!face) continue
      const f = getFont(face.file, face.postscript)
      if (!f) continue
      let ok = true
      for (const cp of uniqueCodePoints(text)) {
        if (!f.hasGlyphForCodePoint(cp)) {
          ok = false
          break
        }
      }
      if (ok) {
        font = f
        break
      }
    }
  }

  return font
}

function uniqueCodePoints(text) {
  const set = new Set()
  for (const ch of String(text ?? '')) set.add(ch.codePointAt(0))
  return set
}

// ---------------------------------------------------------------------------
// Measurement API
// ---------------------------------------------------------------------------

/**
 * Measure a text run at the given point size.
 * @param {string} text
 * @param {{fontFace?: string, fontSizePt?: number, bold?: boolean, italic?: boolean,
 *          charSpacingPt?: number, boxWidthPt?: number, boxHeightPt?: number,
 *          lineSpacingPt?: number}} opts
 * @returns {{fontFamily: string, singleWidthPt: number, lineCount: number,
 *            heightPt: number, fittedWidthPt: number, lineHeightPt: number}|null}
 *   singleWidthPt: width of the whole run on one line (points).
 *   lineCount: lines produced by wrapping at boxWidthPt (1 when no wrap needed or no box width).
 *   heightPt: estimated rendered height = lineCount * lineHeightPt.
 */
export function measureText(text, opts = {}) {
  if (text == null || text === '') return null
  const {
    fontFace,
    fontSizePt = 12,
    bold = false,
    italic = false,
    charSpacingPt = 0,
    boxWidthPt,
    boxHeightPt,
    lineSpacingPt,
  } = opts
  const font = resolveFont(fontFace, text, bold)
  if (!font) return null

  let widthPt
  let glyphs = null
  try {
    const run = font.layout(String(text))
    glyphs = run.glyphs
    widthPt = (run.advanceWidth / font.unitsPerEm) * fontSizePt
  } catch {
    return null
  }
  widthPt += (String(text).length - 1) * (charSpacingPt ?? 0)

  // Line height: prefer the face's own metrics (ascent−descent+lineGap), which
  // is what PowerPoint uses, over a blanket 1.2em.
  const fontLineHeightPt =
    (font.ascent - font.descent + font.lineGap) / font.unitsPerEm * fontSizePt
  const lineHeightPt = lineSpacingPt || fontLineHeightPt || fontSizePt * 1.2

  let lineCount = 1
  if (boxWidthPt && boxWidthPt > 0 && widthPt > boxWidthPt && glyphs && glyphs.length > 0) {
    // Word-aware greedy wrap, mirroring PowerPoint's word-wrap: break at the
    // last space on the line when one is present, else break inside the word
    // (long single tokens). Pure glyph-greedy would over-split latin text.
    const scale = fontSizePt / font.unitsPerEm
    const usable = Math.max(boxWidthPt, 1)
    let lines = 1
    let cursor = 0
    let lineStart = 0
    let lastSpace = -1
    for (let i = 0; i < glyphs.length; i++) {
      const w = glyphs[i].advanceWidth * scale
      if (glyphs[i].codePoints?.[0] === 0x20 && cursor > 0) lastSpace = i
      cursor += w
      if (cursor <= usable) continue
      const breakAt = lastSpace > lineStart ? lastSpace + 1 : i
      lines++
      // re-measure the remainder actually placed on the new line
      let nextCursor = 0
      for (let k = breakAt; k <= i; k++) nextCursor += glyphs[k].advanceWidth * scale
      lineStart = breakAt
      lastSpace = -1
      cursor = nextCursor
    }
    lineCount = lines
  }

  return {
    fontFamily: font.familyName,
    singleWidthPt: widthPt,
    lineCount,
    heightPt: lineCount * lineHeightPt,
    fittedWidthPt: lineCount === 1 ? widthPt : boxWidthPt,
    lineHeightPt,
  }
}
