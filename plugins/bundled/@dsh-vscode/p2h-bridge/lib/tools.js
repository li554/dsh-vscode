/**
 * p2h-bridge — agent tools: slides_import / slides_export.
 *
 * Registration follows the dsh-tool-todo pattern (ctx.tools.register(defineTool({...}))).
 * Presentation: presentCall gives the generic card a meaningful title; presentResult of
 * slides_export declares `kind: 'edit'` + `locations` so the official
 * @deepseek-ai/dsh-client-ui-deliverables turn-tail row ("Produced files") renders the
 * .pptx chip with the stock openFile opener — no bespoke client code (design doc §4.1-②).
 */

import path from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { slidesRoot, workspaceRoot } from './routes.js'
import { importPptxToSlides } from './slides/import.mjs'
import { exportSlidesToPptx } from './slides/export.mjs'

const IMPORT_DESCRIPTION =
  'Import a .pptx file into the workspace slide project at .html-slides/ (one slide-N.html per page ' +
  'plus index.html and manifest.json). Use it to start the PPT→HTML review workflow: after calling this, ' +
  'give the user the returned previewUrl to open in web-review for annotation, then edit the slide-N.html ' +
  'files. Only inline-styled slides produced by this tool (or hand-written in the same dialect) export ' +
  'faithfully; complex agent-authored CSS (flex/grid/external fonts) will lose layout on export.'

const EXPORT_DESCRIPTION =
  'Export the workspace slide project (.html-slides/, produced by slides_import and then edited) back to ' +
  'a .pptx file. Defaults to <source>-modified.pptx next to the imported deck and never overwrites existing ' +
  'files. Charts/SVG and CSS gradients are skipped with warnings; everything else (text boxes, shapes, ' +
  'images, tables) converts through the 960x540 px inline-style dialect at 96 DPI.'

function resolveSlidesDir(htmlDir) {
  const root = slidesRoot()
  if (!htmlDir) return root
  const resolved = path.isAbsolute(htmlDir) ? path.normalize(htmlDir) : path.resolve(workspaceRoot(), htmlDir)
  if (path.relative(root, resolved).startsWith('..')) {
    throw new Error(`slides_export: htmlDir must stay inside the workspace slide project (${root})`)
  }
  return resolved
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
                `Imported ${value.slideCount} slide(s) into ${value.htmlDir}.\n` +
                `Preview URL: ${value.previewUrl}\n` +
                (value.warnings.length > 0 ? `Warnings:\n- ${value.warnings.join('\n- ')}` : 'No warnings.'),
            },
          ],
        },
        async execute(args) {
          const htmlDir = slidesRoot()
          const result = await importPptxToSlides(args.pptxPath, htmlDir)
          const port = ctx.webServer?.port ?? 37750
          return {
            htmlDir: result.htmlDir,
            slideCount: result.slideCount,
            slides: result.slides,
            previewUrl: `http://127.0.0.1:${port}/html-slides/index.html`,
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
          title: `Imported ${result?.slideCount ?? '?'} slide(s) → .html-slides/`,
          kind: 'edit',
          locations: [{ path: path.join(slidesRoot(), 'index.html') }],
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
          htmlDir: {
            type: 'string',
            description: 'Slide project directory; defaults to the workspace .html-slides/.',
          },
          outPptx: {
            type: 'string',
            description: 'Explicit output .pptx path (must not already exist); defaults to <source>-modified.pptx.',
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
          return exportSlidesToPptx(resolveSlidesDir(args?.htmlDir), args?.outPptx ?? null)
        },
        presentCall: (args) => ({
          card: 'generic',
          title: 'Export slides → PPTX',
          kind: 'edit',
          rawInput: args?.outPptx ?? args?.htmlDir,
          locations: args?.htmlDir ? [{ path: resolveSlidesDir(args.htmlDir) }] : undefined,
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
