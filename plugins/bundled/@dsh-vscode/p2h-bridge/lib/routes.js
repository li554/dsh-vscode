/**
 * p2h-bridge — webServer routes.
 *
 * `/html-slides/*`      — static preview of <workspaceRoot>/.html-slides (GET/HEAD only).
 * `/p2h-bridge/api/*`   — JSON API backing the client dock capsule (POST /upload, GET /health).
 *
 * Matching order on the host webServer is exact → longest-prefix → fallback, and no existing
 * registration claims these prefixes (verified against the full roster: /api/recall, /sidebar/*,
 * /git, /describe-image, /memory-evolve, /skills-manager, /super-injector/api, ...), so a single
 * `prefix` registration per namespace is sufficient and shadows nothing.
 *
 * Intentionally NO sandbox CSP here: web-review's isolated preview proxy adds `frame-ancestors`
 * for HTML responses itself; layering our own sandbox header would break its annotation bridge
 * (design doc C1 route spec).
 */

import fs from 'node:fs'
import path from 'node:path'

const MAX_STATIC_BYTES = 20 * 1024 * 1024 // design doc C1: single file ≤ 20MB
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // same ceiling for .pptx uploads
const SLIDES_DIRNAME = '.html-slides'
const UPLOADS_DIRNAME = '.p2h-uploads'

const MIME_BY_EXT = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
])

/** Workspace root the host fork was launched in (src/extension.js forks with cwd: hostCwd()). */
export function workspaceRoot() {
  return process.cwd()
}

/** Directory served by the preview route / written by slides_import. */
export function slidesRoot() {
  return path.join(workspaceRoot(), SLIDES_DIRNAME)
}

/** Upload landing dir for the client capsule (kept OUTSIDE .html-slides so imports can clobber it). */
export function uploadsRoot() {
  return path.join(workspaceRoot(), UPLOADS_DIRNAME)
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(body)
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    let aborted = false
    req.on('data', (chunk) => {
      if (aborted) return
      total += chunk.length
      if (total > maxBytes) {
        aborted = true
        reject(new Error('PAYLOAD_TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!aborted) resolve(Buffer.concat(chunks))
    })
    req.on('error', (error) => {
      if (!aborted) reject(error)
    })
  })
}

/**
 * Cheap cross-origin guard: when the browser sends Origin/Referer (it does for non-GET),
 * their host must match the request Host. The webview origin and the webServer share the
 * same host:port, so same-origin fetches pass and foreign pages fail.
 */
function sameOrigin(req) {
  const host = req.headers.host
  if (!host) return true // curl / non-browser callers without Host are handled by loopback binding
  const origin = req.headers.origin
  if (origin) {
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }
  const referer = req.headers.referer
  if (referer) {
    try {
      return new URL(referer).host === host
    } catch {
      return false
    }
  }
  return true
}

/** True when `target` resolves inside `root` (no traversal). Both must be absolute. */
function isWithin(root, target) {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** Resolve the URL path after the prefix to an absolute file inside `root`, or null. */
function resolveInside(root, urlPath) {
  let rel
  try {
    rel = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  if (rel.includes('\0')) return null
  const target = path.resolve(root, '.' + path.posix.join('/', rel))
  if (!isWithin(root, target)) return null
  return target
}

function serveStatic(ctx, req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: 'preview route is GET/HEAD only' })
    return
  }
  const root = slidesRoot()
  let target = resolveInside(root, url.pathname.slice('/html-slides'.length) || '/')
  if (!target) {
    sendJson(res, 403, { ok: false, error: 'path escapes .html-slides' })
    return
  }
  let stat = fs.existsSync(target) ? fs.statSync(target) : null
  if (stat?.isDirectory()) {
    target = path.join(target, 'index.html')
    stat = fs.existsSync(target) ? fs.statSync(target) : null
  }
  if (!stat?.isFile()) {
    sendJson(res, 404, { ok: false, error: `not found: ${path.basename(target)}` })
    return
  }
  if (stat.size > MAX_STATIC_BYTES) {
    sendJson(res, 413, { ok: false, error: `file exceeds ${MAX_STATIC_BYTES} bytes` })
    return
  }
  const mime = MIME_BY_EXT.get(path.extname(target).toLowerCase()) ?? 'application/octet-stream'
  res.writeHead(200, {
    'content-type': mime,
    'content-length': stat.size,
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  fs.createReadStream(target).pipe(res)
  ctx?.logger?.debug?.(`p2h-bridge: served ${url.pathname}`)
}

/** prefix /html-slides — static preview (GET/HEAD). Returns a disposer, or null when webServer is absent. */
export function registerPreviewRoute(ctx) {
  const webServer = ctx.webServer
  if (!webServer?.register) return null
  return webServer.register({
    kind: 'prefix',
    path: '/html-slides',
    handler(req, res, url) {
      try {
        serveStatic(ctx, req, res, url)
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
      }
    },
  })
}

/** prefix /p2h-bridge/api — JSON API for the client capsule. Returns a disposer, or null. */
export function registerApiRoute(ctx) {
  const webServer = ctx.webServer
  if (!webServer?.register) return null
  return webServer.register({
    kind: 'prefix',
    path: '/p2h-bridge/api',
    async handler(req, res, url) {
      try {
        if (!sameOrigin(req)) {
          sendJson(res, 403, { ok: false, error: 'cross-origin request rejected' })
          return
        }
        if (req.method === 'GET' && url.pathname === '/p2h-bridge/api/health') {
          sendJson(res, 200, { ok: true, plugin: 'p2h-bridge' })
          return
        }
        if (req.method === 'POST' && url.pathname === '/p2h-bridge/api/upload') {
          const raw = await readBody(req, Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 64 * 1024)
          let payload
          try {
            payload = JSON.parse(raw.toString('utf8'))
          } catch {
            sendJson(res, 400, { ok: false, error: 'body must be JSON {name, dataBase64}' })
            return
          }
          const name = String(payload?.name ?? '')
          if (!/^[A-Za-z0-9._-]{1,128}$/.test(name) || !name.toLowerCase().endsWith('.pptx')) {
            sendJson(res, 400, { ok: false, error: 'name must be a bare <file>.pptx (no path separators)' })
            return
          }
          let data
          try {
            data = Buffer.from(String(payload?.dataBase64 ?? ''), 'base64')
          } catch {
            sendJson(res, 400, { ok: false, error: 'dataBase64 is not valid base64' })
            return
          }
          if (data.length === 0) {
            sendJson(res, 400, { ok: false, error: 'empty upload' })
            return
          }
          if (data.length > MAX_UPLOAD_BYTES) {
            sendJson(res, 413, { ok: false, error: `upload exceeds ${MAX_UPLOAD_BYTES} bytes` })
            return
          }
          const dir = uploadsRoot()
          fs.mkdirSync(dir, { recursive: true })
          // createIfAbsent for the landing copy too: never clobber a prior upload of the same name
          let finalName = name
          const dot = name.lastIndexOf('.')
          for (let n = 1; fs.existsSync(path.join(dir, finalName)); n++) {
            finalName = `${name.slice(0, dot)}-${n}${name.slice(dot)}`
          }
          const absolutePath = path.join(dir, finalName)
          fs.writeFileSync(absolutePath, data)
          sendJson(res, 200, {
            ok: true,
            absolutePath,
            relativePath: `${UPLOADS_DIRNAME}/${finalName}`,
            bytes: data.length,
          })
          return
        }
        sendJson(res, 404, { ok: false, error: `no such endpoint: ${req.method} ${url.pathname}` })
      } catch (error) {
        const code = error?.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500
        sendJson(res, code, { ok: false, error: String(error?.message ?? error) })
      }
    },
  })
}
