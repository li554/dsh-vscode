/**
 * p2h-bridge — agent tools: slides_import / slides_export.
 *
 * Storage model v2 (user request 2026-08-31): every deck lives in its own folder
 * <workspaceRoot>/.ppt/<deck>/ = source .pptx + html-slides/ + exported pptx.
 * slides_import creates/refreshes the deck folder and sets it active; slides_export
 * writes <deck>-modified.pptx beside the source (createIfAbsent -N suffixes).
 *
 * Registration follows the dsh-tool-todo pattern (ctx.tools.register(defineTool({...}))).
 * presentResult of slides_export declares `kind: 'edit'` + `locations` so the official
 * deliverables turn-tail row renders the .pptx chip with the stock openFile opener.
 */

import path from 'node:path'
import fs from 'node:fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { pptRoot, deckDir, deckNameFromFile, activeDeckName, listDecks, workspaceRoot } from './routes.js'
import { importPptxToSlides } from './slides/import.mjs'
import { exportSlidesToPptx } from './slides/export.mjs'

const IMPORT_DESCRIPTION =
  'Import a .pptx into its own deck folder at .ppt/<deck>/ (source .pptx copied in, converted ' +
  'html-slides/ beside it, deck set active). Returns the per-deck previewUrl for web-review ' +
  'annotation. Only inline-styled slides produced by this tool (or hand-written in the same ' +
  'dialect) export faithfully; complex agent-authored CSS (flex/grid/external fonts) will lose layout on export.'

const EXPORT_DESCRIPTION =
  'Export a deck (default: the active one) back to a .pptx written INSIDE its folder ' +
  '(.ppt/<deck>/<deck>-modified.pptx, never overwrites — -N suffixes). Charts/SVG reconstruct ' +
  'as native editable shapes, gradients as native gradient fills; text boxes, shapes, images, ' +
  'tables convert through the inline-style dialect.'

/** Resolve an htmlDir argument to a deck slides dir (deck name, or path inside .ppt). */
function resolveDeckSlides(args) {
  const decks = listDecks()
  if (args?.deck) {
    const name = String(args.deck)
    const deck = decks.find((d) => d.name === name)
    if (!deck) throw new Error(`slides_export: no such deck: ${name} (existing: ${decks.map((d) => d.name).join(', ') || 'none'})`)
    return deckSlidesDirSafe(name)
  }
  if (args?.htmlDir) {
    const resolved = path.isAbsolute(args.htmlDir) ? path.normalize(args.htmlDir) : path.resolve(workspaceRoot(), args.htmlDir)
    if (!resolved.toLowerCase().includes(`${pptRoot().toLowerCase()}${path.sep}`)) {
      throw new Error(`slides_export: htmlDir must stay inside the deck folders (${pptRoot()})`)
    }
    return resolved
  }
  const active = activeDeckName()
  if (!active) throw new Error('slides_export: no deck imported yet (run slides_import first)')
  return deckSlidesDirSafe(active)
}

function deckSlidesDirSafe(name) {
  return deckDir(name) ? path.join(deckDir(name), 'html-slides') : null
}

export function registerTools(ctx) {
  const disposers = []

  disposers.push(
    ctx.tools.register(
      defineTool({
        name: 'slides_import',
        description: IMPORT_DESCRIPTION,
        parameters: {
          pptxPath: {
            type: 'string',
            required: true,
            description: 'Path of the .pptx to import — absolute, or relative to the workspace root.',
          },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              deck: { type: 'string', required: true },
              htmlDir: { type: 'string', required: true },
              slideCount: { type: 'integer', required: true },
              previewUrl: { type: 'string', required: true },
              slides: { type: 'array', required: true, items: { type: 'string' } },
              warnings: { type: 'array', required: true, items: { type: 'string' } },
            },
          },
          render: (_args, value) => [
            {
              type: 'text',
              text:
                `Imported ${value.slideCount} slide(s) into .ppt/${value.deck}/html-slides.\n` +
                `Preview URL: ${value.previewUrl}\n` +
                (value.warnings.length > 0 ? `Warnings:\n- ${value.warnings.join('\n- ')}` : 'No warnings.'),
            },
          ],
        },
        async execute(args) {
          const source = path.isAbsolute(args.pptxPath)
            ? path.normalize(args.pptxPath)
            : path.resolve(workspaceRoot(), args.pptxPath)
          if (!fs.existsSync(source)) throw new Error(`slides_import: file not found: ${source}`)
          const deck = deckNameFromFile(path.basename(source))
          const dir = deckDir(deck)
          fs.mkdirSync(dir, { recursive: true })
          // Keep the source copy inside the deck folder (createIfAbsent -N suffixes).
          let copy = path.join(dir, path.basename(source))
          if (path.resolve(copy) !== path.resolve(source)) {
            const dot = path.basename(source).lastIndexOf('.')
            const base = path.basename(source)
            for (let n = 1; fs.existsSync(copy); n++) {
              copy = path.join(dir, `${base.slice(0, dot)}-${n}${base.slice(dot)}`)
            }
            fs.copyFileSync(source, copy)
          }
          const result = await importPptxToSlides(copy, path.join(dir, 'html-slides'))
          const port = ctx.webServer?.port ?? 37750
          // Set the deck active (pointer file used by the tab and /html-slides alias).
          const { writeActive } = await import('./routes.js')
          writeActive(deck)
          return {
            deck,
            htmlDir: result.htmlDir,
            slideCount: result.slideCount,
            slides: result.slides,
            previewUrl: `http://127.0.0.1:${port}/p2h-bridge/decks/${encodeURIComponent(deck)}/html-slides/index.html`,
            warnings: [],
          }
        },
        presentCall: (args) => ({
          card: 'generic',
          title: `Import PPTX: ${path.basename(String(args?.pptxPath ?? ''))}`,
          kind: 'other',
          rawInput: args?.pptxPath,
        }),
        presentResult: (_args, result) => ({
          card: 'generic',
          title: `Imported ${result?.slideCount ?? '?'} slide(s) → .ppt/${result?.deck ?? ''}/html-slides`,
          kind: 'edit',
          locations: result?.deck ? [{ path: deckDir(result.deck) }] : undefined,
        }),
      }),
    ),
  )

  disposers.push(
    ctx.tools.register(
      defineTool({
        name: 'slides_export',
        description: EXPORT_DESCRIPTION,
        parameters: {
          deck: {
            type: 'string',
            description: 'Deck name (folder under .ppt/); defaults to the active deck.',
          },
          htmlDir: {
            type: 'string',
            description: 'Advanced: explicit slide project directory inside .ppt/ (overrides deck).',
          },
          outPptx: {
            type: 'string',
            description: 'Explicit output .pptx file name (written inside the deck folder, must not already exist).',
          },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              outPptx: { type: 'string', required: true },
              slideCount: { type: 'integer', required: true },
              warnings: { type: 'array', required: true, items: { type: 'string' } },
            },
          },
          render: (_args, value) => [
            {
              type: 'text',
              text:
                `Exported ${value.slideCount} slide(s) to ${value.outPptx}.\n` +
                (value.warnings.length > 0 ? `Warnings:\n- ${value.warnings.join('\n- ')}` : 'No warnings.'),
            },
          ],
        },
        async execute(args) {
          const slidesDir = resolveDeckSlides(args)
          const outName = args?.outPptx ? path.basename(String(args.outPptx)) : null
          return exportSlidesToPptx(slidesDir, outName ? path.join(path.dirname(slidesDir), outName) : null)
        },
        presentCall: (args) => ({
          card: 'generic',
          title: `Export slides → PPTX${args?.deck ? ` (${args.deck})` : ''}`,
          kind: 'edit',
          rawInput: args?.deck ?? args?.htmlDir,
        }),
        presentResult: (_args, result) => ({
          card: 'generic',
          title: `Exported ${result?.slideCount ?? '?'} slide(s) → ${path.basename(String(result?.outPptx ?? ''))}`,
          kind: 'edit',
          locations: result?.outPptx ? [{ path: result.outPptx }] : undefined,
        }),
      }),
    ),
  )

  return disposers
}
