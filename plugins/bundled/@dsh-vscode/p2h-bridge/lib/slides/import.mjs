/**
 * p2h-bridge — PPTX → HTML slides (slides_import backend).
 *
 * Vendor chain (plugins/bundled/_hostdeps/):
 *   - docgen-utils/dist/packages/shared/dom-parser-shim.js — linkedom-backed DOMParser polyfill.
 *     MUST be imported before any code path that touches `new DOMParser()`; docgen's
 *     import-pptx.js uses it at CALL time, so ordering the shim first is sufficient.
 *   - docgen-utils/packages/slides/import-pptx — pptx → per-slide HTML fragments
 *     (inline-CSS absolute-position dialect, 960×540 px @96 DPI, data-URI images).
 *
 * Output layout (<workspaceRoot>/.html-slides/, fully regenerated per import):
 *   slide-N.html   — bare document, body = the slide fragment (export parser input)
 *   index.html     — stacked review page (web-review annotation target)
 *   manifest.json  — {sourcePptx, slideCount, slides[], dialect, importedAt}
 */

import fs from 'node:fs'
import path from 'node:path'

// Order matters: the shim polyfills globalThis.DOMParser (linkedom) before docgen runs.
import 'docgen-utils/packages/shared/dom-parser-shim'
import importPptx from 'docgen-utils/packages/slides/import-pptx'
import { escapeHtml } from '../util.mjs'

const SLIDE_DOC_TEMPLATE = (title, fragment) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>html,body{margin:0;padding:0;background:#1e1e1e}</style>
</head>
<body>
${fragment}
</body>
</html>
`

const INDEX_TEMPLATE = (sections, count, sourceName) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(sourceName)} — 幻灯片预览（${count} 页）</title>
<style>
body{margin:0;padding:24px 0 96px;background:#141414;display:flex;flex-direction:column;align-items:center;gap:28px}
.p2h-slide-frame{width:960px;height:540px;overflow:hidden;position:relative;background:#fff;
  box-shadow:0 4px 24px rgba(0,0,0,.55);border-radius:4px;flex:none}
/* docgen canvas is 1280×720 — scale it to the 960×540 review frame (transform, not layout) */
.p2h-slide-frame>div{transform:scale(.75);transform-origin:top left}
.p2h-slide-frame>*{margin:0}
.p2h-slide-number{position:fixed;top:10px;right:16px;z-index:9;color:#9aa0a6;font:12px/1.6 Consolas,monospace;
  background:rgba(20,20,20,.85);padding:2px 10px;border-radius:10px}
</style>
</head>
<body>
<div class="p2h-slide-number" id="p2h-slide-number"></div>
${sections}
<script>
(function(){var n=document.getElementById('p2h-slide-number');
function update(){var frames=document.querySelectorAll('.p2h-slide-frame');
for(var i=0;i<frames.length;i++){var r=frames[i].getBoundingClientRect();
if(r.top<=120&&r.bottom>120){n.textContent=(i+1)+' / '+frames.length;break}}}
addEventListener('scroll',update,{passive:true});update()})();
</script>
</body>
</html>
`

/**
 * Convert a .pptx into the .html-slides workspace project.
 * @param {string} pptxPath absolute or workspace-relative path to the .pptx
 * @param {string} slidesDir absolute <workspaceRoot>/.html-slides
 * @returns {{htmlDir: string, slideCount: number, slides: string[], sourcePptx: string}}
 */
export async function importPptxToSlides(pptxPath, slidesDir) {
  const sourcePptx = path.isAbsolute(pptxPath) ? path.normalize(pptxPath) : path.resolve(process.cwd(), pptxPath)
  let stat
  try {
    stat = fs.statSync(sourcePptx)
  } catch {
    throw new Error(`slides_import: file not found: ${sourcePptx}`)
  }
  if (!stat.isFile()) throw new Error(`slides_import: not a file: ${sourcePptx}`)
  if (!sourcePptx.toLowerCase().endsWith('.pptx')) {
    throw new Error('slides_import: only .pptx files are supported')
  }

  const buffer = fs.readFileSync(sourcePptx)
  const fragments = await importPptx(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
  if (!Array.isArray(fragments) || fragments.length === 0) {
    throw new Error('slides_import: document contains no slides')
  }

  // Regenerate the derived project from scratch (uploads live outside in .p2h-uploads).
  fs.rmSync(slidesDir, { recursive: true, force: true })
  fs.mkdirSync(slidesDir, { recursive: true })

  const slideFiles = []
  const sections = []
  fragments.forEach((fragment, idx) => {
    const fileName = `slide-${idx + 1}.html`
    fs.writeFileSync(path.join(slidesDir, fileName), SLIDE_DOC_TEMPLATE(`Slide ${idx + 1}`, fragment), 'utf8')
    slideFiles.push(fileName)
    sections.push(
      `<section class="p2h-slide-frame" id="p2h-slide-${idx + 1}" data-p2h-slide="${idx + 1}">\n${fragment}\n</section>`,
    )
  })

  const sourceName = path.basename(sourcePptx)
  fs.writeFileSync(path.join(slidesDir, 'index.html'), INDEX_TEMPLATE(sections.join('\n'), fragments.length, sourceName), 'utf8')

  const manifest = {
    version: 1,
    dialect: 'docgen-import-v1',
    sourcePptx: sourcePptx,
    sourceName,
    slideCount: fragments.length,
    slides: slideFiles,
    importedAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(slidesDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

  return { htmlDir: slidesDir, slideCount: fragments.length, slides: slideFiles, sourcePptx }
}
