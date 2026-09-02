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
import JSZip from 'jszip'
import { applyBackground, addElementsToSlide, setSlideSize } from 'docgen-utils/packages/slides/convert'
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

/** custGeom XML for a picture (points are EMU relative to the shape box). */
function picCustGeomXml(points, cx, cy) {
  const cmds = points
    .map((p) => {
      if (p.moveTo) return `<a:moveTo><a:pt x="${p.x}" y="${p.y}"/></a:moveTo>`
      if (p.close) return '<a:close/>'
      return `<a:lnTo><a:pt x="${p.x}" y="${p.y}"/></a:lnTo>`
    })
    .join('')
  return (
    '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>' +
    '<a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="' + cx + '" h="' + cy + '">' + cmds + '</a:path></a:pathLst></a:custGeom>'
  )
}

/**
 * Swap prstGeom→custGeom on pictures whose IR carries clipGeom (custGeom-clipped
 * photos: PptxGenJS pictures have no geometry API, so the patch happens after
 * pres.write by rewriting slide XML inside the zip). Pictures are matched by their
 * box (a:off/a:ext EMU) within a small tolerance.
 */
async function applyPictureClips(buffer, parsed) {
  const EMU_PER_IN = 914400
  const perSlide = parsed.map(({ elements }) =>
    (elements ?? [])
      .filter((el) => el.type === 'image' && el.clipGeom && el.position)
      .map((el) => ({
        x: Math.round(el.position.x * EMU_PER_IN),
        y: Math.round(el.position.y * EMU_PER_IN),
        cx: Math.round(el.position.w * EMU_PER_IN),
        cy: Math.round(el.position.h * EMU_PER_IN),
        points: el.clipGeom,
      })),
  )
  if (!perSlide.some((list) => list.length > 0)) return buffer
  const zip = await JSZip.loadAsync(buffer)
  let patched = 0
  for (let i = 0; i < perSlide.length; i++) {
    const targets = perSlide[i]
    if (targets.length === 0) continue
    const entry = zip.file(`ppt/slides/slide${i + 1}.xml`)
    if (!entry) continue
    const xml = await entry.async('string')
    const patchedXml = xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (pic) => {
      const off = pic.match(/<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>/)
      const ext = pic.match(/<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/)
      if (!off || !ext) return pic
      const hit = targets.find(
        (t) =>
          Math.abs(t.x - Number(off[1])) < 2000 &&
          Math.abs(t.y - Number(off[2])) < 2000 &&
          Math.abs(t.cx - Number(ext[1])) < 2000 &&
          Math.abs(t.cy - Number(ext[2])) < 2000,
      )
      if (!hit) return pic
      const next = pic.replace(/<a:prstGeom prst="rect">\s*<a:avLst\/>\s*<\/a:prstGeom>/, picCustGeomXml(hit.points, Number(ext[1]), Number(ext[2])))
      if (next !== pic) patched++
      return next
    })
    zip.file(`ppt/slides/slide${i + 1}.xml`, patchedXml)
  }
  if (patched === 0) return buffer
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
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

  // Parse every slide up front: the source canvas size (embedded as data attributes on the
  // slide root by import-pptx) must be known BEFORE the presentation is set up, because
  // PptxGenJS fixes the slide layout from `pres.layout` at the first addSlide().
  const parsed = slides.map((fileName) => {
    const html = fs.readFileSync(path.join(slidesDir, fileName), 'utf8')
    const { background, elements, warnings: slideWarnings, canvasSize } = parseSlideHtmlToIR(html, slidesDir)
    warnings.push(...slideWarnings.map((w) => `${fileName}: ${w}`))
    return { fileName, background, elements, canvasSize }
  })

  // Export canvas: original slide width, 16:9 height — matches the 1280×720 HTML viewport
  // docgen imports into, so geometry stays faithful for any source aspect ratio.
  const { w: canvasW, h: canvasH, sourceH } = parsed[0]?.canvasSize ?? { w: 10, h: 5.625, sourceH: 5.625 }
  if (sourceH && Math.abs(sourceH - canvasH) / canvasH > 0.01) {
    warnings.push(
      `source is non-16:9 (${canvasW.toFixed(2)}"×${sourceH.toFixed(2)}") — exporting at ${canvasW.toFixed(2)}"×${canvasH.toFixed(2)}" (16:9, width-derived) to match the HTML canvas`,
    )
  }

  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'p2h-custom', width: canvasW, height: canvasH })
  pres.layout = 'p2h-custom'
  setSlideSize(canvasW, canvasH)

  for (const { background, elements } of parsed) {
    const slide = pres.addSlide()
    await applyBackground(background ?? { type: 'color', value: 'FFFFFF' }, slide)
    await addElementsToSlide(elements, slide, pres)
  }

  const resolvedOut = reserveOutputPath(slidesDir, sourcePptx, outPptx)
  const rawBuffer = await pres.write({ outputType: 'nodebuffer' })
  const buffer = await applyPictureClips(rawBuffer, parsed)
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true })
  fs.writeFileSync(resolvedOut, buffer)

  return { outPptx: resolvedOut, slideCount: slides.length, warnings }
}
