/**
 * p2h-bridge — host entry (persistent npm plugin, mounted via cordis.patch.yml insert).
 *
 * Design doc: docs/superpowers/specs/2026-08-29-dsh-ppt-html-review-workflow-design.md (C1 / §4.1)
 *
 * Responsibilities:
 *  1. Static preview route  `prefix /html-slides`      — serves <workspaceRoot>/.html-slides over the
 *     HOST webServer (fixed loopback port, same origin as the DSH webview), so web-review's
 *     HTTP(S)-only address bar can open workspace slides. GET/HEAD only, path-traversal guarded.
 *  2. Upload API route      `prefix /p2h-bridge/api`     — POST /upload backs the client "导入 PPT"
 *     dock capsule (browser File → base64 → workspace .p2h-uploads/<name>).
 *  3. Agent tools           `slides_import` / `slides_export` — docgen-based PPTX→HTML and
 *     dialect-constrained HTML→PPTX conversion (see lib/slides/).
 *
 * The host fork runs with cwd = workspace root (src/extension.js forks with `cwd: hostCwd()`),
 * so `process.cwd()` is the workspace the session opened — same convention better-sidebar's
 * sessionCwdOf() falls back to.
 */

import { registerPreviewRoute, registerApiRoute } from './routes.js'
import { registerTools } from './tools.js'

export const name = 'p2h-bridge'

// webServer: route carrier (preview + upload API).
// tools: agent-facing tool registry (slides_import / slides_export).
export const inject = ['webServer', 'tools']

export function apply(ctx) {
  const disposers = []

  const preview = registerPreviewRoute(ctx)
  if (preview) disposers.push(preview)
  const api = registerApiRoute(ctx)
  if (api) disposers.push(api)
  disposers.push(...registerTools(ctx))

  ctx.effect(
    () => () => {
      for (const dispose of disposers) {
        try {
          dispose?.()
        } catch {
          // disposal is best-effort; never mask a later disposer
        }
      }
    },
    'p2h-bridge: routes + tools cleanup',
  )
}
