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

import { registerPreviewRoute, registerDecksRoute, registerApiRoute } from './routes.js'
import { registerTools } from './tools.js'
import Schema from '@deepseek-ai/schemastery'

export const name = 'p2h-bridge'

// webServer: route carrier (preview + upload API).
// tools: agent-facing tool registry (slides_import / slides_export).
export const inject = ['webServer', 'tools']

// 单文件上限（字节）：PPT 源文件上传 + html-slides 预览资产共同生效。
// cordis Config schema，默认 100MB，可经插件配置覆盖热调，避免 web-review
// 代理"upstream body exceeds"截断含大图/大视频的巨型 PPT。
export const Config = Schema.object({
  maxBytes: Schema.number().default(100 * 1024 * 1024).description('PPT 单文件大小上限（字节），用于上传 .pptx 与预览 html-slides 静态资产'),
})

export function apply(ctx, config) {
  const disposers = []

  const preview = registerPreviewRoute(ctx, config)
  if (preview) disposers.push(preview)
  const decks = registerDecksRoute(ctx, config)
  if (decks) disposers.push(decks)
  const api = registerApiRoute(ctx, config)
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
