/**
 * p2h-bridge — HTML slides → PPTX (slides_export backend).
 *
 * Reuses docgen's pure-Node rendering half (dist/packages/slides/convert.js — applyBackground /
 * addElementsToSlide over the vendored PptxGenJS) and replaces its browser-only parse step with
 * our dialect parser (dialect-parse.mjs). Geometry is already inline px @96 DPI, so no layout
 * engine is needed; this is exactly the split docgen's own headless CLI makes (browser parses,
 * Node assembles — verified in dist/packages/cli/commands/export-slides.js).
 *
 * Output naming follows the design doc: default <source-basename>-modified.pptx next to the
 * source deck, createIfAbsent with -N suffixes — the tool never overwrites user files.
 */

import fs from 'node:fs'
import path from 'node:path'
import PptxGenJS from 'docgen-utils/packages/slides/vendor/pptxgen'
import { applyBackground, addElementsToSlide } from 'docgen-utils/packages/slides/convert'
import { parseSlideHtmlToIR } from './dialect-parse.mjs'

/** Read the slide project: manifest when present, otherwise a numeric scan of slide-*.html. */
function readSlideList(slidesDir) {
  const manifestPath = path.join(slidesDir, 'manifest.json')
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (Array.isArray(manifest.slides) && manifest.slides.length > 0) {
        return { slides: manifest.slides, sourcePptx: manifest.sourcePptx ?? null }
      }
    } catch (error) {
      // fall through to the scan
      var scanNote = `manifest unreadable (${String(error?.message ?? error)}), falling back to slide-*.html scan`
    }
  }
  const slides = fs
    .readdirSync(slidesDir)
    .filter((name) => /^slide-\d+\.html$/i.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  if (slides.length === 0) {
    throw new Error(`slides_export: no slide-*.html files under ${slidesDir} — run slides_import first`)
  }
  return { slides, sourcePptx: null, scanNote }
}

/** createIfAbsent output path: <base>-modified.pptx, then <base>-modified-1.pptx, ... */
function reserveOutputPath(slidesDir, sourcePptx, requested) {
  if (requested) {
    const out = path.isAbsolute(requested) ? path.normalize(requested) : path.resolve(process.cwd(), requested)
    if (!out.toLowerCase().endsWith('.pptx')) throw new Error('slides_export: outPptx must end with .pptx')
    if (fs.existsSync(out)) throw new Error(`slides_export: refusing to overwrite existing file: ${out} (pick another name)`)
    return out
  }
  const base = sourcePptx
    ? path.join(path.dirname(sourcePptx), path.basename(sourcePptx, path.extname(sourcePptx)))
    : path.join(path.dirname(slidesDir), path.basename(path.dirname(slidesDir)))
  let candidate = `${base}-modified.pptx`
  for (let n = 1; fs.existsSync(candidate); n++) {
    candidate = `${base}-modified-${n}.pptx`
  }
  return candidate
}

/**
 * Export the .html-slides project back to a .pptx.
 * @param {string} slidesDir absolute path of the slide project
 * @param {string|null} outPptx explicit output path (must not exist), or null for auto naming
 * @returns {{outPptx: string, slideCount: number, warnings: string[]}}
 */
export async function exportSlidesToPptx(slidesDir, outPptx = null) {
  if (!fs.statSync(slidesDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`slides_export: slide directory not found: ${slidesDir}`)
  }
  const { slides, sourcePptx, scanNote } = readSlideList(slidesDir)
  const warnings = []
  if (scanNote) warnings.push(scanNote)

  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_16x9' // 10" × 5.625" — matches convert.js SLIDE_W/SLIDE_H clipping

  for (const fileName of slides) {
    const html = fs.readFileSync(path.join(slidesDir, fileName), 'utf8')
    const { background, elements, warnings: slideWarnings } = parseSlideHtmlToIR(html, slidesDir)
    warnings.push(...slideWarnings.map((w) => `${fileName}: ${w}`))
    const slide = pres.addSlide()
    await applyBackground(background ?? { type: 'color', value: 'FFFFFF' }, slide)
    await addElementsToSlide(elements, slide, pres)
  }

  const resolvedOut = reserveOutputPath(slidesDir, sourcePptx, outPptx)
  const buffer = await pres.write({ outputType: 'nodebuffer' })
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true })
  fs.writeFileSync(resolvedOut, buffer)

  return { outPptx: resolvedOut, slideCount: slides.length, warnings }
}
