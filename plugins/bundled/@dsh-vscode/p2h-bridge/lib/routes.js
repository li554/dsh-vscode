/**
 * p2h-bridge — webServer routes (storage model v2).
 *
 * Storage (user request 2026-08-31): everything lives under <workspaceRoot>/.ppt/
 *   .ppt/<deck>/<source>.pptx      — the uploaded/origin deck
 *   .ppt/<deck>/html-slides/       — the derived slide project (import output)
 *   .ppt/<deck>/<deck>-modified.pptx — exports (createIfAbsent -N suffixes)
 *   .ppt/active.json               — {name} of the deck the tab previews
 * One folder per uploaded PPT; exports sit beside the source.
 *
 * Migration: a legacy workspace (.html-slides/ + .p2h-uploads/ from v1) is folded
 * into the new layout on first state/upload/import call — idempotent, never
 * overwrites an existing deck folder.
 *
 * Routes:
 *   /html-slides/*            — static preview of the ACTIVE deck's html-slides
 *                               (path kept for web-review session compat)
 *   /p2h-bridge/decks/<deck>/* — static preview of a specific deck's html-slides
 *   /p2h-bridge/api/*         — JSON API backing the PPT manager tab
 *
 * Dispatch contract (verified in @deepseek-ai/dsh-host-webserver lib/index.js L186):
 * the host calls `route.handler(req, res)` with EXACTLY two arguments — every
 * handler parses `req.url` itself.
 *
 * Intentionally NO sandbox CSP here: web-review's isolated preview proxy adds
 * `frame-ancestors` for HTML responses itself.
 */

import fs from 'node:fs'
import path from 'node:path'

import { importPptxToSlides } from './slides/import.mjs'
import { exportSlidesToPptx } from './slides/export.mjs'

const MAX_STATIC_BYTES = 20 * 1024 * 1024 // design doc C1: single file ≤ 20MB
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const PPT_DIRNAME = '.ppt'
const SLIDES_SUBDIR = 'html-slides'
const LEGACY_SLIDES_DIRNAME = '.html-slides'
const LEGACY_UPLOADS_DIRNAME = '.p2h-uploads'
const API_PREFIX = '/p2h-bridge/api'
const DECKS_PREFIX = '/p2h-bridge/decks'
const LEGACY_PREVIEW_PREFIX = '/html-slides'

/** The URL object handlers need — built from the request itself (host passes only req/res). */
function urlOf(req) {
  return new URL(req.url ?? '/', 'http://x')
}

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

/** Root folder of the per-deck storage model. */
export function pptRoot() {
  return path.join(workspaceRoot(), PPT_DIRNAME)
}

/** Folder of one deck (name already sanitized by the caller). */
export function deckDir(name) {
  return path.join(pptRoot(), name)
}

/** Derived slide project dir of one deck. */
export function deckSlidesDir(name) {
  return path.join(deckDir(name), SLIDES_SUBDIR)
}

/**
 * Sanitize a deck folder name from a pptx file name: keep letters/digits/space/
 * dash/underscore/dot (CJK included via unicode), collapse the rest to '-'.
 */
export function sanitizeDeckName(stem) {
  const cleaned = String(stem ?? '')
    .replace(/[\\/:*?"<>|\0]/g, '-')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
  return cleaned || 'deck'
}

/** Deck name derived from a pptx file name ("Laporan Q3.pptx" → "Laporan Q3"). */
export function deckNameFromFile(fileName) {
  const base = path.basename(String(fileName ?? ''))
  const stem = base.replace(/\.pptx$/i, '')
  return sanitizeDeckName(stem)
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Legacy migration (v1: .html-slides/ + .p2h-uploads/ flat layout)
// ---------------------------------------------------------------------------

/** Move `from` inside `toDir` keeping the basename; skip if target already exists. */
function moveInto(from, toDir) {
  const target = path.join(toDir, path.basename(from))
  if (fs.existsSync(target)) return false
  fs.mkdirSync(toDir, { recursive: true })
  fs.renameSync(from, target)
  return true
}

/**
 * Fold the legacy layout into .ppt/<deck>/. Idempotent: every step checks the
 * target first, so a second call (or a crash mid-way) is safe.
 */
export function migrateLegacyIfNeeded() {
  const root = pptRoot()
  const legacySlides = path.join(workspaceRoot(), LEGACY_SLIDES_DIRNAME)
  const legacyUploads = path.join(workspaceRoot(), LEGACY_UPLOADS_DIRNAME)
  const hasLegacy = fs.existsSync(legacySlides) || fs.existsSync(legacyUploads)
  if (!hasLegacy) return
  fs.mkdirSync(root, { recursive: true })

  // 1. The derived slide project → .ppt/<stem>/html-slides
  let activeDeck = null
  if (fs.existsSync(path.join(legacySlides, 'manifest.json'))) {
    const manifest = readJson(path.join(legacySlides, 'manifest.json')) ?? {}
    const sourceName = manifest.sourceName ?? path.basename(String(manifest.sourcePptx ?? 'deck.pptx'))
    const deck = deckNameFromFile(sourceName)
    const target = deckSlidesDir(deck)
    if (!fs.existsSync(target)) {
      fs.mkdirSync(path.join(root, deck), { recursive: true })
      fs.renameSync(legacySlides, target)
      activeDeck = deck
      // Keep the manifest's sourcePptx pointing at the deck's own copy if present.
      const sourceCopy = path.join(root, deck, sourceName)
      if (fs.existsSync(sourceCopy)) {
        try {
          const m = readJson(path.join(target, 'manifest.json'))
          if (m) {
            m.sourcePptx = sourceCopy
            fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(m, null, 2), 'utf8')
          }
        } catch {
          // manifest rewrite is best-effort
        }
      }
    }
  }

  // 2. Uploaded/exported pptx files → their decks
  if (fs.existsSync(legacyUploads)) {
    for (const name of fs.readdirSync(legacyUploads)) {
      if (!name.toLowerCase().endsWith('.pptx')) continue
      const from = path.join(legacyUploads, name)
      if (!fs.statSync(from).isFile()) continue
      // "X-modified.pptx"/"X-modified-2.pptx" belong to deck X; "X.pptx" → deck X.
      const deck = deckNameFromFile(name.replace(/-modified(-\d+)?\.pptx$/i, '.pptx'))
      moveInto(from, path.join(root, deck))
    }
    // Remove the legacy dir when empty.
    try {
      if (fs.readdirSync(legacyUploads).length === 0) fs.rmdirSync(legacyUploads)
    } catch {
      // non-empty or locked — leave it
    }
  }

  if (activeDeck) writeActive(activeDeck)
}

// ---------------------------------------------------------------------------
// Active deck pointer
// ---------------------------------------------------------------------------

function activeFile() {
  return path.join(pptRoot(), 'active.json')
}

function readActive() {
  const data = readJson(activeFile())
  return data && typeof data.name === 'string' ? data.name : null
}

function writeActive(name) {
  fs.mkdirSync(pptRoot(), { recursive: true })
  fs.writeFileSync(activeFile(), JSON.stringify({ name }, null, 2), 'utf8')
}

// ---------------------------------------------------------------------------
// Deck listing
// ---------------------------------------------------------------------------

function statOf(filePath) {
  try {
    const st = fs.statSync(filePath)
    return { size: st.size, mtime: st.mtime.toISOString() }
  } catch {
    return null
  }
}

/** List every deck folder with its source/project/exports summary. */
export function listDecks() {
  migrateLegacyIfNeeded()
  const root = pptRoot()
  if (!fs.existsSync(root)) return []
  const decks = []
  for (const name of fs.readdirSync(root, { withFileTypes: true })) {
    if (!name.isDirectory() || name.name.startsWith('.')) continue
    const dir = deckDir(name.name)
    const slidesDir = deckSlidesDir(name.name)
    const manifest = readJson(path.join(slidesDir, 'manifest.json'))
    const exports = []
    for (const f of fs.readdirSync(dir)) {
      if (!/\.pptx$/i.test(f)) continue
      const st = statOf(path.join(dir, f))
      if (st) exports.push({ name: f, relative: `${PPT_DIRNAME}/${name.name}/${f}`, ...st })
    }
    exports.sort((a, b) => b.mtime.localeCompare(a.mtime))
    const deck = {
      name: name.name,
      previewUrl: previewUrlForDeck(ctxPort(), name.name),
      project: manifest && Array.isArray(manifest.slides)
        ? { slideCount: manifest.slideCount ?? manifest.slides.length, importedAt: manifest.importedAt ?? null, sourceName: manifest.sourceName ?? null }
        : null,
      exports,
    }
    // Source = a pptx that is not an export.
    deck.source = deck.exports.find((f) => !/-modified(-\d+)?\.pptx$/i.test(f.name)) ?? null
    deck.exports = deck.exports.filter((f) => /-modified(-\d+)?\.pptx$/i.test(f.name))
    decks.push(deck)
  }
  decks.sort((a, b) => (b.project?.importedAt ?? '').localeCompare(a.project?.importedAt ?? ''))
  return decks
}

function ctxPort() {
  return globalThis.__p2hPort ?? 37750
}

function previewUrlForDeck(port, deck) {
  return `http://127.0.0.1:${port}${DECKS_PREFIX}/${encodeURIComponent(deck)}/html-slides/index.html`
}

/** The deck the tab previews (pointer file, else most recent project, else first). */
export function activeDeckName() {
  const decks = listDecks()
  if (decks.length === 0) return null
  const wanted = readActive()
  if (wanted && decks.some((d) => d.name === wanted)) return wanted
  const withProject = decks.find((d) => d.project)
  return (withProject ?? decks[0]).name
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

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
        // NOTE: never req.destroy() here — killing the socket makes the client's
        // fetch reject with "Failed to fetch" instead of reading a proper 413.
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
 * Cheap cross-origin guard: when the browser sends Origin/Referer (it does for
 * non-GET), their host must match the request Host.
 */
function sameOrigin(req) {
  const host = req.headers.host
  if (!host) return true
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

function serveStatic(ctx, req, res, url, root, label) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: 'preview route is GET/HEAD only' })
    return
  }
  const target = resolveInside(root, url.pathname)
  if (!target) {
    sendJson(res, 403, { ok: false, error: `path escapes ${label}` })
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

// ---------------------------------------------------------------------------
// API handlers
// ---------------------------------------------------------------------------

/** Resolve an API-supplied workspace-relative path to a safe absolute .pptx inside the workspace. */
function resolveWorkspacePptx(relativePath) {
  const rel = String(relativePath ?? '').replaceAll('\\', '/')
  if (rel === '' || rel.includes('\0')) return null
  const abs = path.resolve(workspaceRoot(), rel)
  if (!isWithin(workspaceRoot(), abs)) return null
  if (!abs.toLowerCase().endsWith('.pptx')) return null
  return abs
}

/** Import a pptx into a deck folder, set it active, return the deck descriptor. */
async function importIntoDeck(ctx, absolutePptx, deckName) {
  const deck = sanitizeDeckName(deckName)
  const dir = deckDir(deck)
  fs.mkdirSync(dir, { recursive: true })
  // Keep the source copy inside the deck (createIfAbsent -N suffixes).
  const sourceName = path.basename(absolutePptx)
  let sourceCopy = path.join(dir, sourceName)
  if (path.resolve(absolutePptx) !== path.resolve(sourceCopy)) {
    const dot = sourceName.lastIndexOf('.')
    for (let n = 1; fs.existsSync(sourceCopy); n++) {
      sourceCopy = path.join(dir, `${sourceName.slice(0, dot)}-${n}${sourceName.slice(dot)}`)
    }
    fs.copyFileSync(absolutePptx, sourceCopy)
  }
  const result = await importPptxToSlides(sourceCopy, deckSlidesDir(deck))
  writeActive(deck)
  return { deck, slideCount: result.slideCount, previewUrl: previewUrlForDeck(ctxPort(), deck) }
}

async function handleApi(ctx, req, res, url) {
  globalThis.__p2hPort = ctx?.webServer?.port ?? globalThis.__p2hPort ?? 37750
  if (!sameOrigin(req)) {
    sendJson(res, 403, { ok: false, error: 'cross-origin request rejected' })
    return
  }
  const pathname = url.pathname

  if (req.method === 'GET' && pathname === `${API_PREFIX}/health`) {
    sendJson(res, 200, { ok: true, plugin: 'p2h-bridge' })
    return
  }

  if (req.method === 'GET' && pathname === `${API_PREFIX}/state`) {
    const decks = listDecks()
    const active = activeDeckName()
    const activeDeck = decks.find((d) => d.name === active) ?? null
    sendJson(res, 200, {
      ok: true,
      root: `${PPT_DIRNAME}/`,
      active,
      decks,
      previewUrl: activeDeck ? activeDeck.previewUrl : previewUrlForDeck(ctxPort(), ''),
    })
    return
  }

  if (req.method === 'POST' && pathname === `${API_PREFIX}/upload`) {
    let raw
    try {
      raw = await readBody(req, Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 64 * 1024)
    } catch (err) {
      const tooLarge = String(err?.message ?? '') === 'PAYLOAD_TOO_LARGE'
      sendJson(res, tooLarge ? 413 : 500, {
        ok: false,
        error: tooLarge ? `upload exceeds ${MAX_UPLOAD_BYTES} bytes` : 'request body could not be read',
      })
      return
    }
    let payload
    try {
      payload = JSON.parse(raw.toString('utf8'))
    } catch {
      sendJson(res, 400, { ok: false, error: 'body must be JSON {name, dataBase64}' })
      return
    }
    const name = String(payload?.name ?? '')
    if (!/^[^\\/]{1,128}\.pptx$/i.test(name) || name.includes('..') || name.includes('\0')) {
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
    const deck = deckNameFromFile(name)
    const dir = deckDir(deck)
    fs.mkdirSync(dir, { recursive: true })
    let finalName = name
    const dot = name.lastIndexOf('.')
    for (let n = 1; fs.existsSync(path.join(dir, finalName)); n++) {
      finalName = `${name.slice(0, dot)}-${n}${name.slice(dot)}`
    }
    fs.writeFileSync(path.join(dir, finalName), data)
    sendJson(res, 200, {
      ok: true,
      deck,
      file: finalName,
      relative: `${PPT_DIRNAME}/${deck}/${finalName}`,
      bytes: data.length,
    })
    return
  }

  if (req.method === 'POST' && pathname === `${API_PREFIX}/import`) {
    const raw = await readBody(req, 64 * 1024)
    let payload = null
    try {
      payload = JSON.parse(raw.toString('utf8'))
    } catch {
      // handled below
    }
    let absolutePath = null
    let deckName = null
    if (payload?.deck) {
      deckName = sanitizeDeckName(String(payload.deck))
      const dir = deckDir(deckName)
      const source = (listDecks().find((d) => d.name === deckName) ?? { source: null }).source
      absolutePath = source ? path.join(dir, source.name) : null
    } else if (payload?.relativePath) {
      absolutePath = resolveWorkspacePptx(payload.relativePath)
      deckName = deckNameFromFile(path.basename(absolutePath ?? ''))
    } else if (payload?.file) {
      // file = '<deck>/<name>.pptx' relative to .ppt/
      const rel = String(payload.file).replaceAll('\\', '/')
      const [deckPart, ...rest] = rel.split('/')
      const fileName = rest.join('/')
      if (!deckPart || !fileName || fileName.includes('..')) {
        sendJson(res, 400, { ok: false, error: 'file must be <deck>/<name>.pptx' })
        return
      }
      deckName = sanitizeDeckName(deckPart)
      absolutePath = path.join(deckDir(deckName), path.basename(fileName))
      if (!isWithin(deckDir(deckName), absolutePath)) absolutePath = null
    }
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      sendJson(res, 400, { ok: false, error: 'source .pptx not found (use deck / relativePath / file)' })
      return
    }
    try {
      const result = await importIntoDeck(ctx, absolutePath, deckName)
      sendJson(res, 200, { ok: true, ...result })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
    }
    return
  }

  if (req.method === 'POST' && pathname === `${API_PREFIX}/export`) {
    const raw = await readBody(req, 16 * 1024)
    let payload = null
    try {
      payload = JSON.parse(raw.toString('utf8'))
    } catch {
      // defaults below
    }
    const decks = listDecks()
    const deck = payload?.deck ? decks.find((d) => d.name === sanitizeDeckName(String(payload.deck))) : decks.find((d) => d.name === activeDeckName()) ?? decks[0] ?? null
    if (!deck) {
      sendJson(res, 400, { ok: false, error: 'no deck to export' })
      return
    }
    // Default output: <deck>-modified.pptx INSIDE the deck folder (export.mjs appends
    // -N suffixes on collision) — never beside the source in the workspace root.
    const outName = payload?.outName ? String(payload.outName) : `${deck.name}-modified.pptx`
    const result = await exportSlidesToPptx(deckSlidesDir(deck.name), path.join(deckDir(deck.name), path.basename(outName)))
    sendJson(res, 200, {
      ok: true,
      deck: deck.name,
      outPptx: result.outPptx,
      relative: `${PPT_DIRNAME}/${deck.name}/${path.basename(result.outPptx)}`,
      slideCount: result.slideCount,
      warnings: result.warnings,
    })
    return
  }

  if (req.method === 'POST' && pathname === `${API_PREFIX}/setActive`) {
    const raw = await readBody(req, 16 * 1024)
    let payload = null
    try {
      payload = JSON.parse(raw.toString('utf8'))
    } catch {
      // handled below
    }
    const deck = sanitizeDeckName(String(payload?.deck ?? ''))
    if (!fs.existsSync(deckDir(deck))) {
      sendJson(res, 404, { ok: false, error: `no such deck: ${deck}` })
      return
    }
    writeActive(deck)
    sendJson(res, 200, { ok: true, active: deck })
    return
  }

  if (req.method === 'POST' && pathname === `${API_PREFIX}/remove`) {
    const raw = await readBody(req, 16 * 1024)
    let payload = null
    try {
      payload = JSON.parse(raw.toString('utf8'))
    } catch {
      // handled below
    }
    const deck = sanitizeDeckName(String(payload?.deck ?? ''))
    const dir = deckDir(deck)
    if (payload?.file) {
      // Remove one file from the deck (source or export).
      const fileName = path.basename(String(payload.file))
      const abs = path.join(dir, fileName)
      if (!isWithin(dir, abs) || !fs.existsSync(abs)) {
        sendJson(res, 404, { ok: false, error: 'no such file in deck' })
        return
      }
      fs.rmSync(abs, { force: true })
      sendJson(res, 200, { ok: true })
      return
    }
    if (!fs.existsSync(dir)) {
      sendJson(res, 404, { ok: false, error: `no such deck: ${deck}` })
      return
    }
    fs.rmSync(dir, { recursive: true, force: true })
    if (readActive() === deck) {
      const decks = listDecks()
      writeActive(decks[0]?.name ?? '')
    }
    sendJson(res, 200, { ok: true })
    return
  }

  sendJson(res, 404, { ok: false, error: `no such endpoint: ${req.method} ${pathname}` })
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/** prefix /html-slides — static preview of the ACTIVE deck (web-review compat). */
export function registerPreviewRoute(ctx) {
  const webServer = ctx.webServer
  if (!webServer?.register) return null
  return webServer.register({
    kind: 'prefix',
    path: LEGACY_PREVIEW_PREFIX,
    handler(req, res) {
      try {
        const deck = activeDeckName()
        if (!deck) {
          sendJson(res, 404, { ok: false, error: 'no deck imported yet' })
          return
        }
        const url = urlOf(req)
        // Map /html-slides/<rest> → .ppt/<deck>/html-slides/<rest>
        const rest = url.pathname.slice(LEGACY_PREVIEW_PREFIX.length) || '/'
        serveStatic(ctx, req, res, new URL(rest, url.origin), deckSlidesDir(deck), LEGACY_PREVIEW_PREFIX)
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
      }
    },
  })
}

/** prefix /p2h-bridge/decks/<deck> — static preview of one deck's html-slides. */
export function registerDecksRoute(ctx) {
  const webServer = ctx.webServer
  if (!webServer?.register) return null
  return webServer.register({
    kind: 'prefix',
    path: DECKS_PREFIX,
    handler(req, res) {
      try {
        const url = urlOf(req)
        const rest = url.pathname.slice(DECKS_PREFIX.length) // /<deck>/html-slides/<file>
        const parts = rest.split('/').filter(Boolean)
        if (parts.length < 2 || parts[1] !== SLIDES_SUBDIR) {
          sendJson(res, 404, { ok: false, error: 'expected /decks/<deck>/html-slides/<file>' })
          return
        }
        const deck = sanitizeDeckName(decodeURIComponent(parts[0]))
        const slidesDir = deckSlidesDir(deck)
        if (!fs.existsSync(slidesDir)) {
          sendJson(res, 404, { ok: false, error: `deck has no html-slides: ${deck}` })
          return
        }
        const fileRest = '/' + parts.slice(2).join('/')
        serveStatic(ctx, req, res, new URL(fileRest, url.origin), slidesDir, DECKS_PREFIX)
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
      }
    },
  })
}

/** prefix /p2h-bridge/api — JSON API for the PPT manager tab. Returns a disposer, or null. */
export function registerApiRoute(ctx) {
  const webServer = ctx.webServer
  if (!webServer?.register) return null
  globalThis.__p2hPort = ctx.webServer?.port ?? 37750
  return webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    async handler(req, res) {
      try {
        await handleApi(ctx, req, res, urlOf(req))
      } catch (error) {
        const message = String(error?.message ?? error)
        const code = message === 'PAYLOAD_TOO_LARGE' ? 413 : 500
        sendJson(res, code, { ok: false, error: message })
      }
    },
  })
}
