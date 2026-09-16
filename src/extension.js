"use strict";
/**
 * dsh-vscode — Method B wrapper: run the DSH web host inside the VS Code
 * extension host and show its browser surface in a sidebar webview view.
 *
 * Transport design (all mechanisms verified against VS Code 1.133 and
 * @deepseek-ai/dsh 0.1.5-rc.2):
 *
 *  1. The DSH host is forked as a child process from the extension host:
 *     child_process.fork runs the @deepseek-ai/dsh bin with
 *     ELECTRON_RUN_AS_NODE=1, so the VS Code binary itself doubles as the
 *     Node runtime — the user machine needs no standalone Node.
 *  2. The host binds the web profile on 127.0.0.1 with --port 0 (OS-assigned).
 *  3. The sidebar view contains only a local HTML shell with a full-viewport
 *     iframe pointing at http://127.0.0.1:<port>/. VS Code's service worker
 *     intercepts the iframe navigation and every subresource request, and
 *     routes them through the extension host because the view declares the
 *     stable WebviewPortMapping API ({ webviewPort: port, extensionHostPort: port }).
 *  4. Because those /api requests now originate from the extension host
 *     process (a plain Node fetch — no Origin, no Sec-Fetch-Site headers),
 *     the DSH browser-trust fence sees a clean loopback request and passes.
 *     No host code is modified.
 *  5. The DSH web client uses fetch + SSE only (no WebSocket), which the
 *     port-mapping proxy supports.
 *
 * Nothing in this file needs Node/npm on the user machine: dependencies are
 * bundled into the .vsix at build time (vendor/node_modules).
 */
const vscode = require("vscode");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const os = require("node:os");

/**
 * The host's ready line. 0.1.5 gates the whole web surface behind a per-process
 * launch token: the printed URL is
 *   dsh web: http://127.0.0.1:<port>/?token=<launchToken>
 * A GET of that exact URL (pathname `/`, exactly one token) mints a signed
 * HttpOnly cookie and 303-redirects to clean `/`; every other request to the
 * root — including a bare `/` — gets a minimal 401. There is no config to turn
 * this off (dsh-web-app's Config has only openBrowser/printUrl/surfaceContext/
 * trustedHosts), so the token MUST be threaded into the webview iframe. The
 * token is intentionally optional in this pattern: an older platform prints a
 * tokenless URL and still boots.
 */
const URL_LINE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/(?:\?token=([A-Za-z0-9_-]+))?/;
const VIEW_ID = "dsh.harness";

/** @type {import("node:child_process").ChildProcess | null} */
let host = null;
/** @type {vscode.WebviewView | null} */
let currentView = null;
let hostPort = 0;
/** Per-process launch token printed on the host's ready line (0.1.5+). */
let hostToken = "";
/**
 * The `Cookie` header the mediating proxy sends upstream. The extension host
 * mints it itself (see exchangeToken) so the webview never has to hold it.
 */
let hostCookie = "";
/**
 * The loopback authority the cookie is bound to. DSH signs the cookie's audience
 * with the request's `Host`, so the exchange and every proxied request must
 * present exactly this value.
 */
let appAuthority = "";
/** The local mediating proxy the webview talks to (see startAppProxy). */
let appServer = null;
/** @type {Promise<number> | null} */
let readyPromise = null;
let shutdownRequested = false;
/** Cooldown so a crashing host cannot tight-loop restarts. */
let lastHostExitAt = 0;
let output = null;
/** @type {vscode.ExtensionContext | null} */
let extensionContext = null;
/** Ring buffer of recent host log lines, shown on the error page. */
const recentLog = [];
/**
 * Rolling diagnostic log under globalStorage.
 *
 * The Output channel is in-memory and dies with the window, so "send me the log"
 * is impossible after the fact — which is exactly what blocked diagnosing a
 * report of several plugin tabs fetching into nothing. Same stream, on disk.
 */
let logFilePath = "";
let logFileBytes = 0;
const LOG_MAX_BYTES = 4 * 1024 * 1024;
/** Cap on non-2xx proxy lines per session, so one broken route cannot flood the file. */
let proxyFailureLines = 0;

/**
 * Open, and rotate, the diagnostic log.
 * @param {import("vscode").ExtensionContext} context - supplies the storage directory.
 * @returns {void}
 */
function openLogFile(context) {
  try {
    const dir = context?.globalStorageUri?.fsPath;
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "dsh-vscode.log");
    try {
      if (fs.statSync(file).size > LOG_MAX_BYTES) {
        try { fs.rmSync(file + ".1", { force: true }); } catch { /* ignore */ }
        try { fs.renameSync(file, file + ".1"); } catch { /* ignore */ }
      }
    } catch { /* no existing file */ }
    logFilePath = file;
    try { logFileBytes = fs.statSync(file).size; } catch { logFileBytes = 0; }
  } catch { logFilePath = ""; }
}

function log(line) {
  if (!output) output = vscode.window.createOutputChannel("DeepSeek Harness");
  output.appendLine(line);
  recentLog.push(line);
  if (recentLog.length > 60) recentLog.shift();
  if (logFilePath === "") return;
  try {
    if (logFileBytes > LOG_MAX_BYTES) {
      try { fs.rmSync(logFilePath + ".1", { force: true }); } catch { /* ignore */ }
      try { fs.renameSync(logFilePath, logFilePath + ".1"); } catch { /* ignore */ }
      logFileBytes = 0;
    }
    const text = line + "\n";
    fs.appendFileSync(logFilePath, text);
    logFileBytes += Buffer.byteLength(text);
  } catch { /* best effort: never fail a boot over a log write */ }
}

/**
 * Path of the bundled dsh CLI entry. The .vsix carries the production
 * dependency tree under vendor/node_modules (vsce's --no-dependencies mode
 * skips its own dependency resolution), so resolution prefers vendor and
 * falls back to a dev install for local development.
 */
const vendorNodeModules = path.join(__dirname, "..", "vendor", "node_modules");
function hostModulePath() {
  const vendored = path.join(vendorNodeModules, "@deepseek-ai", "dsh", "lib", "bin.js");
  if (fs.existsSync(vendored)) return vendored;
  try {
    const pkgJson = require.resolve("@deepseek-ai/dsh/package.json");
    return path.join(path.dirname(pkgJson), "lib", "bin.js");
  } catch {
    return require.resolve("@deepseek-ai/dsh/lib/bin.js");
  }
}

/**
 * DSH_HOME for the child host. Defaults to an extension-owned directory so
 * the bundled host never inherits profile plugins from another DSH install
 * (e.g. a desktop profile with market plugins) that cannot resolve from the
 * vendored tree. Point dsh.dshHome at an existing home to share it instead.
 */
function dshHomeForHost() {
  const configured = String(vscode.workspace.getConfiguration("dsh").get("dshHome") ?? "");
  if (configured.trim() !== "") return configured;
  if (extensionContext) return path.join(extensionContext.globalStorageUri.fsPath, "dsh-home");
  return path.join(os.homedir(), ".dsh-vscode");
}

/**
 * Publisher ids that once shipped this extension. VS Code keys globalStorage
 * by `<publisher>.<name>`, so changing the publisher strands the old
 * `dsh-home` under a sibling folder the new install never reads.
 */
const LEGACY_PUBLISHER_STORAGE_IDS = ["your-publisher-id.dsh-vscode"];

/** True when a DSH_HOME looks like it already holds user data. */
function dshHomeLooksUsed(home) {
  try {
    if (!fs.statSync(home).isDirectory()) return false;
    for (const name of ["settings.yaml", "sessions", ".credentials.yaml", "profiles", "memories"]) {
      if (fs.existsSync(path.join(home, name))) return true;
    }
    return fs.readdirSync(home).length > 0;
  } catch {
    return false;
  }
}

/**
 * One-shot: if the current extension's dsh-home is still empty and a previous
 * publisher's globalStorage has data, copy that data over. Only runs when the
 * user has not set `dsh.dshHome`, never overwrites a used current home, and
 * leaves the legacy folder in place as a backup.
 */
function migrateLegacyPublisherHome() {
  try {
    const configured = String(vscode.workspace.getConfiguration("dsh").get("dshHome") ?? "").trim();
    if (configured !== "") return;
    if (!extensionContext?.globalStorageUri?.fsPath) return;
    const currentHome = path.join(extensionContext.globalStorageUri.fsPath, "dsh-home");
    if (dshHomeLooksUsed(currentHome)) return;
    const storageRoot = path.dirname(extensionContext.globalStorageUri.fsPath);
    for (const legacyId of LEGACY_PUBLISHER_STORAGE_IDS) {
      const legacyHome = path.join(storageRoot, legacyId, "dsh-home");
      if (!dshHomeLooksUsed(legacyHome)) continue;
      fs.mkdirSync(currentHome, { recursive: true });
      fs.cpSync(legacyHome, currentHome, { recursive: true });
      log(`migrated DSH_HOME from legacy publisher storage: ${legacyHome} -> ${currentHome}`);
      try {
        fs.writeFileSync(path.join(currentHome, ".migrated-from-publisher"), legacyId + "\n");
      } catch { /* marker is best-effort */ }
      return;
    }
  } catch (err) {
    log("legacy publisher home migration failed: " + String(err && err.message ? err.message : err));
  }
}

/**
 * Fixed port the DSH host binds. Using a fixed port (instead of --port 0) lets
 * us configure the webview's portMapping synchronously in resolveWebviewView,
 * before the webview receives any html. VS Code 1.134 runs webviews with
 * LocalNetworkAccessChecks enabled, so the shell iframe can *only* reach the
 * host via the portMapping proxy — and that mapping is fused to the webview at
 * its creation, so it must be known up front rather than updated after boot.
 * Overridable with dsh.port (empty => this default).
 */
const DEFAULT_HOST_PORT = 37750;
function hostPortFor() {
  const configured = Number(vscode.workspace.getConfiguration("dsh").get("port") ?? 0);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_HOST_PORT;
}

/**
 * The URL the webview iframe navigates to: the local mediating proxy, which
 * always speaks to the DSH host as an authenticated client.
 *
 * Why a proxy exists at all. From 0.1.5 dsh-client-connection gates the web
 * surface behind a per-process launch token AND a signed HttpOnly cookie:
 * `GET /?token=<t>` is the only request that mints the cookie (303 +
 * Set-Cookie), and every later request — the index and each `/api` call — is
 * judged solely by that cookie (BrowserAuth.isAuthenticated). In this
 * deployment the iframe is a THIRD-PARTY context (`http://127.0.0.1:<port>`
 * nested inside `vscode-webview://`) whose requests VS Code's port-mapping
 * layer relays instead of letting the renderer's own network stack issue them,
 * so a `Set-Cookie` on a relayed response never reaches the browser's cookie
 * jar. The post-redirect `GET /` then arrives with no cookie and the panel
 * renders DSH's "dsh web authentication required" page.
 *
 * Rather than depend on cookie behaviour we cannot control, the extension host
 * performs the token exchange ITSELF (a plain Node request, which does keep the
 * cookie) and runs a loopback reverse proxy for the webview. The proxy is what
 * the portMapping points at; it injects the cookie and strips the browser
 * markers DSH's fence rejects (`Sec-Fetch-Site: cross-site`, cross-origin
 * `Origin`/`Referer`). The launch token never reaches the webview at all.
 *
 * @param {number} port - the proxy port, i.e. hostPortFor().
 * @returns {string} the iframe URL.
 */
function appUrl(port) {
  return `http://127.0.0.1:${port}/`;
}

/**
 * The host's own authenticated URL (token in the query string). Only ever handed
 * to a REAL browser — `DSH: Open in External Browser` — which performs the token
 * exchange and cookie handling natively. Never point the webview here: that is
 * exactly the path that fails behind VS Code's relay.
 * @returns {string} the direct host URL, token included when there is one.
 */
function hostAuthUrl() {
  const base = `http://127.0.0.1:${hostPort}/`;
  return hostToken ? `${base}?token=${encodeURIComponent(hostToken)}` : base;
}

/** Hop-by-hop headers plus the browser markers DSH's Host/Origin fence rejects
 * (`sec-fetch-site: cross-site` is a hard 403, and a cross-origin `Origin`/
 * `Referer` fails the same-origin check). Dropping them restores the clean
 * loopback request the fence is built to accept. */
const STRIPPED_REQUEST_HEADERS = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
  "origin", "referer",
  "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "sec-fetch-user"
]);

/** The same cleanup for a WebSocket handshake, where `Connection: Upgrade` and
 * `Upgrade: websocket` are the request's whole point and must survive. */
const STRIPPED_UPGRADE_HEADERS = new Set([
  "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer",
  "transfer-encoding",
  "origin", "referer",
  "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "sec-fetch-user"
]);

/** Serialize a response head for a raw socket (the upgrade path bypasses
 * ServerResponse, because 101 has no body to manage). */
function rawResponseHead(statusCode, statusMessage, headers) {
  const lines = [`HTTP/1.1 ${statusCode} ${statusMessage}`];
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) for (const one of value) lines.push(`${key}: ${one}`);
    else if (value !== undefined) lines.push(`${key}: ${value}`);
  }
  return lines.join("\r\n") + "\r\n\r\n";
}

/**
 * Client plugins the profile actually ships.
 *
 * A bundled plugin is only useful if the host MOUNTS it, and a plugin whose
 * `inject` cannot be satisfied is skipped silently — nothing appears in the host
 * log, so "the plugin does nothing" leaves no trace anywhere. The host does
 * advertise exactly what it mounted, in the shell's combined
 * `/plugins/??<id>/client.js,…&rev=…` URL, so comparing the shipped set against the
 * advertised set turns that silence into a named list.
 *
 * @param {string} profileDir - the web profile directory.
 * @returns {Set<string>} package names declaring a web client half.
 */
function shippedClientPlugins(profileDir) {
  const names = new Set();
  const modules = path.join(profileDir, "node_modules");
  const consider = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, entry.name, "package.json"), "utf8"));
        if (pkg?.dsh?.client?.platform === "web" && typeof pkg.name === "string") names.add(pkg.name);
      } catch { /* not a readable package */ }
    }
  };
  consider(modules);
  let scopes = [];
  try {
    scopes = fs.readdirSync(modules, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("@"))
      .map((entry) => entry.name);
  } catch { /* no node_modules yet */ }
  for (const scope of scopes) consider(path.join(modules, scope));
  return names;
}

/**
 * Log which shipped web-client plugins the host actually advertised to the browser.
 *
 * Reads the served shell instead of guessing a URL: 0.1.5 serves client plugins
 * only through the revisioned combo URL it prints into that document. A plugin
 * that shipped but was never mounted is a plugin whose UI silently does nothing —
 * which is what this line exists to make visible.
 *
 * @param {string} profileDir - the web profile directory.
 * @param {string} authority - the proxy authority that holds the auth cookie.
 */
async function logClientSurface(profileDir, authority) {
  const shipped = shippedClientPlugins(profileDir);
  if (shipped.size === 0) return;
  let html = "";
  try {
    const res = await fetch(`http://${authority}/`, {
      headers: { accept: "text/html", ...(hostCookie ? { cookie: hostCookie } : {}) },
      redirect: "manual"
    });
    html = await res.text();
  } catch (error) {
    log("client surface probe failed: " + String(error));
    return;
  }
  const advertised = new Set();
  for (const match of html.matchAll(/\/plugins\/\?\?([^"'\s<>\\)]+)/g)) {
    for (const part of match[1].split(",")) {
      const id = part.split("/client.js")[0].trim();
      if (id) advertised.add(id);
    }
  }
  if (advertised.size === 0) {
    log("client surface: the shell advertised no client plugins — the web bundle did not compose");
    return;
  }
  const missing = [...shipped].filter((name) => !advertised.has(name)).sort();
  log(`client surface: ${advertised.size} mounted of ${shipped.size} shipped` +
    (missing.length ? `; shipped but NOT mounted: ${missing.join(", ")}` : " (every shipped client plugin mounted)"));
}

/**
 * Exchange the host's launch token for its browser-session cookie, from the
 * extension host, where the `Set-Cookie` header is plainly readable.
 *
 * The request deliberately presents `authority` as its Host: DSH binds the
 * cookie to that exact authority (both the cookie NAME and the signed audience
 * are derived from it), so it must equal the Host that proxied webview requests
 * carry later.
 *
 * @param {number} port - the DSH host's real (ephemeral) port.
 * @param {string} authority - the authority to bind the cookie to.
 * @param {string} token - the process launch token.
 * @returns {Promise<string>} the `Cookie` header value, or "" when unauthenticated.
 */
function exchangeToken(port, authority, token) {
  return new Promise((resolve) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      method: "GET",
      // The token only counts as pathname "/" with exactly one `token` param.
      path: `/?token=${encodeURIComponent(token)}`,
      headers: { host: authority, accept: "*/*" }
    }, (response) => {
      // The host answers 303 + Set-Cookie; a redirect is never followed here.
      const raw = response.headers["set-cookie"] ?? [];
      response.resume();
      const cookie = raw.map((line) => String(line).split(";")[0]).filter(Boolean).join("; ");
      log("token exchange -> " + response.statusCode + (cookie ? " (cookie minted)" : " (NO cookie)"));
      resolve(cookie);
    });
    request.on("error", (error) => { log("token exchange failed: " + String(error)); resolve(""); });
    request.end();
  });
}

/**
 * Forward one webview request to the DSH host as an authenticated client.
 * @param {import("node:http").IncomingMessage} req - webview request.
 * @param {import("node:http").ServerResponse} res - webview response.
 * @param {boolean} retrying - true on the single post-401 retry.
 */
function forwardToHost(req, res, retrying) {
  // LOCAL PATCH: after an unexpected host exit hostPort is cleared. Dialing 0
  // only produced opaque ECONNREFUSED noise; answer 502 so the UI can show a
  // real "host request failed" while recoverHostAfterExit boots a replacement.
  if (!(hostPort > 0)) {
    if (proxyFailureLines < 200) {
      proxyFailureLines++;
      log(`proxy 502 ${req.method} ${req.url} (host down)`);
    }
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("dsh-vscode: host is not running\n");
    return;
  }
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (STRIPPED_REQUEST_HEADERS.has(key)) continue;
    headers[key] = value;
  }
  headers.host = appAuthority;
  // Only assert a credential we actually hold: an empty `Cookie` header would
  // read as a present-but-invalid cookie rather than an anonymous request.
  if (hostCookie) headers.cookie = hostCookie;

  const upstream = http.request({
    host: "127.0.0.1",
    port: hostPort,
    method: req.method,
    path: req.url,
    headers
  }, (response) => {
    // A 401 means the credential was rejected (or never minted). Re-mint once
    // for a body-less request and replay it; everything else passes through
    // untouched, including the SSE stream.
    if (response.statusCode === 401 && !retrying && (req.method === "GET" || req.method === "HEAD")) {
      response.resume();
      void exchangeToken(hostPort, appAuthority, hostToken).then((cookie) => {
        log("proxy got 401 for " + req.url + " — re-minted cookie: " + (cookie ? "yes" : "no"));
        if (cookie) hostCookie = cookie;
        forwardToHost(req, res, true);
      });
      return;
    }
    res.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(res);
    // Record refusals, because "the tab says fetch error" is otherwise
    // unattributable: the status and path say whether the route is missing, the
    // credential was rejected, or the plugin refused the payload. Bundle fetches
    // are excluded (a stale page legitimately 404s after a host restart) and the
    // volume is capped.
    const status = response.statusCode ?? 502;
    if (status >= 400 && !String(req.url).startsWith("/plugins/") && proxyFailureLines < 200) {
      proxyFailureLines++;
      log(`proxy ${status} ${req.method} ${req.url}`);
      if (proxyFailureLines === 200) log("proxy: further non-2xx responses this session are not logged");
    }
  });
  upstream.on("error", (error) => {
    log("proxy upstream error for " + req.url + ": " + String(error));
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("dsh-vscode: host request failed\n");
  });
  req.pipe(upstream);
}

/**
 * Proxy a WebSocket upgrade to the host.
 *
 * This is not optional: DSH 0.1.5's web client opens `ws://<origin>/api/remote.mux`
 * as its RPC mux (the 0.1.1-era "fetch + SSE only" reading no longer holds), and
 * it sits behind the same `/api` auth guard. An HTTP-only proxy leaves the panel
 * rendered but permanently showing "自动重连中…".
 *
 * @param {import("node:http").IncomingMessage} req - the upgrade request.
 * @param {import("node:net").Socket} socket - the webview's raw socket.
 * @param {Buffer} head - bytes already read past the request head.
 */
function forwardUpgrade(req, socket, head) {
  if (!(hostPort > 0)) {
    log("proxy websocket upgrade refused: host is not running for " + req.url);
    socket.write(rawResponseHead(502, "Bad Gateway", { connection: "close" }));
    try { socket.destroy(); } catch { /* already gone */ }
    return;
  }
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (STRIPPED_UPGRADE_HEADERS.has(key)) continue;
    headers[key] = value;
  }
  headers.host = appAuthority;
  if (hostCookie) headers.cookie = hostCookie;
  headers.connection = "Upgrade";
  headers.upgrade = req.headers.upgrade ?? "websocket";

  const upstream = http.request({
    host: "127.0.0.1",
    port: hostPort,
    method: req.method,
    path: req.url,
    headers
  });

  upstream.on("upgrade", (upRes, upSocket, upHead) => {
    log("proxy websocket upgrade accepted for " + req.url);
    socket.write(rawResponseHead(upRes.statusCode ?? 101, upRes.statusMessage ?? "Switching Protocols", upRes.headers));
    if (upHead && upHead.length) socket.write(upHead);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
    const teardown = () => {
      try { upSocket.destroy(); } catch { /* already gone */ }
      try { socket.destroy(); } catch { /* already gone */ }
    };
    socket.on("error", teardown);
    upSocket.on("error", teardown);
    socket.on("close", teardown);
    upSocket.on("close", teardown);
  });

  // The host may refuse the handshake with a plain HTTP response (401 when the
  // cookie is missing, 403 from the Host/Origin fence). Relay it verbatim.
  upstream.on("response", (response) => {
    log("proxy websocket upgrade refused: " + response.statusCode + " for " + req.url);
    socket.write(rawResponseHead(response.statusCode ?? 502, response.statusMessage ?? "Bad Gateway", response.headers));
    response.pipe(socket);
  });

  upstream.on("error", (error) => {
    log("proxy websocket error for " + req.url + ": " + String(error));
    try { socket.destroy(); } catch { /* already gone */ }
  });

  if (head && head.length) upstream.write(head);
  upstream.end();
}

/**
 * Start the loopback proxy the webview's portMapping points at, unless it is
 * already listening. It reads `hostPort`/`hostCookie`/`appAuthority` live, so a
 * host restart only requires re-minting the cookie.
 * @param {number} port - the proxy port (hostPortFor()).
 */
function startAppProxy(port) {
  if (appServer) return;
  appServer = http.createServer((req, res) => forwardToHost(req, res, false));
  appServer.on("upgrade", (req, socket, head) => forwardUpgrade(req, socket, head));
  appServer.on("error", (error) => {
    if (error && error.code === "EADDRINUSE") {
      // The port is fixed on purpose (the view declares its portMapping once, at
      // creation, and VS Code cannot re-fuse it), so a second VS Code window has
      // to use a different one.
      log(`proxy port ${port} is already in use — another VS Code window is already serving DeepSeek Harness there. `
        + `Close that window, or point the "dsh.port" setting at a free port. `
        + `Until then this window's panel talks to whichever process owns ${port}, which is why every request can fail.`);
    } else {
      log("proxy server error: " + String(error));
    }
    appServer = null;
  });
  appServer.listen(port, "127.0.0.1", () => log("webview proxy listening on 127.0.0.1:" + port));
}

/** Stop the proxy and drop the credential it was injecting. */
function stopAppProxy() {
  const server = appServer;
  appServer = null;
  hostCookie = "";
  appAuthority = "";
  if (server) { try { server.close(); } catch { /* already closed */ } }
}

/** Working directory for the host = agent cwd. */
function hostCwd() {
  const configured = String(vscode.workspace.getConfiguration("dsh").get("cwd") ?? "");
  if (configured.trim() !== "") return configured;
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? folder.uri.fsPath : os.homedir();
}

/**
 * The baked ecosystem plugins shipped under <extension>/plugins/bundled.
 * Embedded-lite scope: every entry is self-contained (own third-party deps in
 * plugins/bundled/_hostdeps) and resolves by name from <profile>/node_modules.
 *
 * This is the 0.1.5 exploration set — exactly four plugins are kept. Each member
 * is still registered INDIVIDUALLY: never an upstream GROUP bundle (e.g.
 * @linxin666/dsh-web-ui-all), whose manifest pulls native members (dsh-ssh,
 * dsh-client-ui-skin-center) and whose cordis.patch mounts a full roster. An
 * AggregateError on any missing roster member aborts the whole host boot, and
 * those native deps (ssh2/lightningcss) cannot load in the VS Code embedded Node
 * anyway.
 */
const BUNDLED_PLUGINS = [
  "@canglongcl/dsh-web-review",
  "@dsh-vscode/p2h-bridge",
  "@liustack/modlens",
  "dsh-client-auto-continue",
  "dsh-rewind-plugin",
  "@mlgbnb/dsh-archive-manager",
  "dsh-zh-kit",
  "dsh-mnemon"
];
/** Plugins that older vsix releases bundled but this build does not. A DSH_HOME
 * that previously ran with them enabled still carries their names in the profile
 * manifest's `bundles` list AND a transplanted tree under
 * <profile>/node_modules — so they must be pruned on every boot, otherwise a
 * stale profile keeps surfacing the removed plugin's UI and settings.
 *
 * Group 1 was retired upstream in earlier 0.2.x releases. Group 2 is the whole
 * ecosystem roster the pre-0.3 builds baked; the 0.1.5 exploration build keeps
 * only BUNDLED_PLUGINS and retires the rest. */
const RETIRED_PLUGINS = [
  // retired upstream in earlier 0.2.x releases
  "@linxin666/dsh-remote-web-ui",
  "dsh-easyrewrite",
  // NOTE: dsh-mnemon was retired in 0.2.x and is shipped again in explore.21+;
  // it must NOT stay in RETIRED_PLUGINS (that would prune the live bundle).
  "@dsh-external/dsh-diff-review",
  "dsh-recall-plugin",
  "@anionex/dsh-turn-rewind",
  // 大肥鱼滑块 / reasoning-effort UI — older builds baked it; not in the 0.1.5+
  // exploration set. Leftover profile bundles + node_modules kept the settings UI alive.
  "dsh-reasoning-effort",
  // dropped by the 0.1.5 exploration build (only four plugins are kept)
  "@linxin666/dsh-chat-recovery",
  "@linxin666/dsh-client-ui-aionui-panel",
  "@linxin666/dsh-client-ui-community-plugins",
  "@linxin666/dsh-client-ui-git-graph",
  "@linxin666/dsh-client-ui-market",
  "@linxin666/dsh-client-ui-plugin-manager",
  "@linxin666/dsh-client-ui-skill-explorer",
  "@linxin666/dsh-client-ui-task-board",
  "@linxin666/dsh-client-ui-web-ui-settings",
  "@linxin666/dsh-desktop-launcher",
  "@linxin666/dsh-doctor",
  "@linxin666/dsh-liangshen",
  "@linxin666/dsh-pet",
  "@linxin666/dsh-tool-describe-image",
  // NOTE: @mlgbnb/dsh-archive-manager re-added as explore.57 — not retired.
  "@huanlin/dsh-plugin-better-sidebar-plugin-office",
  "@dsh-external/dsh-super-injector",
  "dsh-auto-compact",
  "dsh-better-sidebar",
  "dsh-file-review",
  "dsh-free-search",
  "dsh-miraculous-standard",
  // NOTE: dsh-zh-kit was in the 0.1.5 retirement list; re-added as explore.57
  // (must NOT stay in RETIRED_PLUGINS when bundled).
  // retired by dsh-vscode explore.17: advisor 400-storm on session switch + host deaths
  "dsh-memory-evolve",
  // retired by dsh-vscode explore.20: broke chat composer / command list in the panel
  "graph-memory",
  // retired by from-33-rewind: replaced by dsh-rewind-plugin
  "dsh-undo-plugin",
  "@dsh-undo/client-rollback-button",
  "@dsh-undo/client-rollback-settings",
  "@dsh-undo/client-rollback-toolcards",
  "@dsh-undo/client-rollback-trailfold",
  "@dsh-undo/rollback-archive",
  "@dsh-undo/rollback-fork",
  "@dsh-undo/rollback-undo",
  "dsh-rollback-withdraw"
];
/** Platform web profile bundles. They must ALWAYS precede the baked plugins:
 * they provide webServer (and the other services every UI bundle waits on).
 * On a fresh DSH_HOME (brand-new install) there is no manifest yet, so without
 * forcing them, the profile would carry ONLY the baked plugins and never expose
 * webServer -> every entry stays "pending waiting for service: webServer" and
 * assertEntriesActivated aborts the whole host. */
const BASE_BUNDLES = ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"];
/** Baked-in plugins are ON by default (dsh.enableBakedPlugins). The default web
 * profile carries base+web-app plus every bundled ecosystem plugin. */
function bakedPluginsEnabled() {
  return Boolean(vscode.workspace.getConfiguration("dsh").get("enableBakedPlugins", true));
}
/**
 * Synchronize the baked plugin state with the web profile: when enabled,
 * transplant the self-contained plugin package dirs (each carries its own
 * nested node_modules; only the 3 bundle roots land in the profile) into the
 * profile's node_modules and add their names to `dsh.profile.bundles`; when
 * disabled, remove any stale baked-plugin names from `bundles` so a profile
 * left in the "enabled, then disabled" state still boots. Also removes the
 * transplanted plugin tree when turning off, so a leftover polluting tree can
 * never shadow the vendored platform again.
 * @param {string} profileDir - the resolved profile dir under DSH_HOME.
 */
function syncBakedPlugins(profileDir) {
  const enabled = bakedPluginsEnabled();
  const manifestPath = path.join(profileDir, "package.json");
  let manifest = null;
  try { if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { manifest = null; }
  const bundles = manifest?.dsh?.profile?.bundles ?? [];
  const hasAny = BUNDLED_PLUGINS.some((n) => bundles.includes(n));
  // Always put the platform web profile (base + web-app) first; keep any other
  // non-baked custom entries, and let the enabled/disabled logic below add or
  // remove exactly the baked plugin set.
  const changed = [
    ...BASE_BUNDLES,
    ...bundles.filter((b) => !BASE_BUNDLES.includes(b) && !BUNDLED_PLUGINS.includes(b) && !RETIRED_PLUGINS.includes(b))
  ];
  // Retire plugins that older vsix releases bundled: drop them from the manifest
  // and delete any previously-transplanted tree, so a stale DSH_HOME can never
  // surface the removed plugin's UI/settings again (e.g. remote-web-ui).
  for (const name of RETIRED_PLUGINS) {
    const i = changed.indexOf(name);
    if (i >= 0) changed.splice(i, 1);
    const retiredDir = path.join(profileDir, "node_modules", ...name.split("/"));
    try { if (fs.existsSync(retiredDir)) { fs.rmSync(retiredDir, { recursive: true, force: true }); log("retired plugin removed: " + name); } } catch { /* best effort */ }
  }
  if (enabled) {
    for (const name of BUNDLED_PLUGINS) if (!changed.includes(name)) changed.push(name);
    // Always re-transplant on every boot (force-overwrite). A prior install
    // already materialized the bundle dirs, so a mere existence check would
    // keep running the STALE plugin code transplanted from an older vsix —
    // exactly how fixes shipped in the bundled plugins never took effect.
    // fs.cpSync(..., force: true) replaces the transplanted tree, so an
    // upgraded vsix propagates its new plugin code to the profile.
    transplantBundledPlugins(profileDir);
  } else {
    for (const name of BUNDLED_PLUGINS) {
      const i = changed.indexOf(name);
      if (i >= 0) changed.splice(i, 1);
    }
  }
  if (hasAny && !enabled) {
    const modules = path.join(profileDir, "node_modules");
    try { if (fs.existsSync(modules)) { fs.rmSync(modules, { recursive: true, force: true }); log("removed baked plugin tree from profile " + profileDir); } } catch { /* best effort */ }
  }
  const changedBundles = JSON.stringify(changed) !== JSON.stringify(bundles);
  if (changedBundles || !manifest) {
    const next = manifest ?? {};
    next.dsh = { ...(next.dsh ?? {}), profile: { ...(next.dsh?.profile ?? {}), bundles: changed } };
    try { fs.mkdirSync(profileDir, { recursive: true }); fs.writeFileSync(manifestPath, JSON.stringify(next, null, 2) + "\n"); } catch { /* best effort */ }
  }
}
/**
 * Ship the baked agent-presets (router-standard / router-spec from the
 * dsh-routing-suite preset/ folder) into the DSH_HOME agent-presets dir. DSH
 * discovers agent presets under `<home>/.agent-presets/<name>/agent.cordis.yml`
 * (one level, flattest layout), so each preset dir is copied wholesale. Runs
 * alongside syncBakedPlugins on host boot so the presets are available offline.
 * @param {string} home - the DSH_HOME dir.
 */
function syncBakedPresets(home) {
  const srcRoot = path.join(__dirname, "..", "plugins", "presets");
  if (!fs.existsSync(srcRoot)) return;
  const agentRoot = path.join(home, ".agent-presets");
  fs.mkdirSync(agentRoot, { recursive: true });
  for (const name of ["router-standard", "router-spec"]) {
    const src = path.join(srcRoot, name);
    if (!fs.statSync(src).isDirectory()) continue;
    const dst = path.join(agentRoot, name);
    try {
      fs.cpSync(src, dst, { recursive: true, force: true });
      log("baked agent-preset installed: " + name + " -> " + dst);
    } catch { /* best effort */ }
  }
}
/** Extension-generated profile overlay, handed to the host with `--patch`. */
const PROFILE_OVERLAY_FILE = ".dsh-vscode-profile-patch.yml";
/**
 * modlens' own default family prefixes, from its registerVisionProvider.
 *
 * It resolves `config.families || ['deepseek', 'glm', 'mimo']`, so any list we
 * pass REPLACES those rather than extending them.
 */
const MODLENS_DEFAULT_FAMILIES = ["deepseek", "glm", "mimo"];
/**
 * Model-id prefixes the user wants `@liustack/modlens` to treat as text-only.
 *
 * modlens only bridges models whose id begins with a family it recognises
 * (`deepseek`, `glm`, `mimo` by default), which fails for gateways that hide the
 * real model behind an opaque alias — a route called `code_think` serving
 * DeepSeek V4 Flash matches nothing. `dsh.modlensFamilies` lets the user name
 * those aliases without editing any file.
 *
 * ADDITIVE on purpose: the setting lists EXTRA families and the built-in three are
 * always kept. Emitting only what the user typed would silently drop them, so a
 * user adding a gateway alias would lose the DeepSeek/GLM routes that already
 * worked — and nothing would say so.
 * @returns {string[]} the merged prefix list, or [] when the setting is empty.
 */
function modlensFamilies() {
  const raw = vscode.workspace.getConfiguration("dsh").get("modlensFamilies");
  const configured = Array.isArray(raw)
    ? raw.map((value) => String(value).trim()).filter((value) => value !== "")
    : [];
  if (configured.length === 0) return [];
  const seen = new Set();
  const merged = [];
  for (const family of [...MODLENS_DEFAULT_FAMILIES, ...configured]) {
    const key = family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(family);
  }
  return merged;
}
/**
 * Quote one YAML scalar. Model-id prefixes can carry `: # @ [ ]` and friends, and
 * a bare prefix starting with `*` would be read as an alias node.
 * @param {string} value - the raw scalar.
 * @returns {string} a double-quoted YAML string.
 */
function yamlScalar(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
/**
 * Materialize the extension-managed profile overlay that carries per-plugin
 * configuration the DSH settings page cannot express, and return its path.
 *
 * This is a `--patch` overlay rather than an edit to the profile's own
 * cordis.patch.yml: dsh composes bundles, then cordis.patch.yml, then every
 * `--patch` file — so an overlay composes on top of whatever the user keeps in
 * their patch file and never rewrites a file they own. Returning null when there
 * is nothing to apply keeps the flag off the command line entirely.
 * @param {string} home - the resolved DSH_HOME.
 * @returns {string | null} the overlay path, or null when nothing is configured.
 */
function writeProfileOverlay(home) {
  const overlayPath = path.join(home, PROFILE_OVERLAY_FILE);
  const families = modlensFamilies();
  if (families.length === 0) {
    try {
      if (fs.existsSync(overlayPath)) {
        fs.rmSync(overlayPath, { force: true });
        log("profile overlay removed (dsh.modlensFamilies is empty)");
      }
    } catch { /* best effort */ }
    return null;
  }
  const body = [
    "# Generated by the dsh-vscode extension from the dsh.modlensFamilies setting.",
    "# Applied with `dsh --patch`, AFTER the profile layer, so the profile's own",
    "# cordis.patch.yml is never rewritten. Local edits here are overwritten on boot.",
    "- id: modlens",
    "  config:",
    "    families:",
    ...families.map((family) => `      - ${yamlScalar(family)}`)
  ].join("\n") + "\n";
  try {
    let current = null;
    try { if (fs.existsSync(overlayPath)) current = fs.readFileSync(overlayPath, "utf8"); } catch { current = null; }
    if (current !== body) {
      fs.mkdirSync(home, { recursive: true });
      fs.writeFileSync(overlayPath, body);
      log("profile overlay written: " + overlayPath + " (modlens families: " + families.join(", ") + ")");
    }
    return overlayPath;
  } catch (error) {
    log("profile overlay write failed: " + String(error));
    return null;
  }
}
/**
 * Home-relative artifacts owned by plugins this build no longer ships. Their
 * state is MOVED to a dated quarantine directory under the home rather than
 * deleted, because some of it is data the user may still want (task ledgers,
 * archives). Nothing here is required for a boot.
 */
const RETIRED_HOME_ARTIFACTS = [
  ["super-injector", "@dsh-external/dsh-super-injector"],
  ["diff-review", "@dsh-external/dsh-diff-review"],
  ["change-ledger", "@anionex/dsh-turn-rewind"],
  ["doctor", "@linxin666/dsh-doctor"],
  ["pet.json", "@linxin666/dsh-pet"],
  ["dsh-easyrewrite.log", "dsh-easyrewrite"]
];
/**
 * Leftover names inside a profile's node_modules that no plugin owns any more.
 * `*.pnpm-old` is a relink backup and `.ignored_*` is a directory some older
 * tooling renamed instead of removing; both are dead weight that keeps showing up
 * in resolution walks.
 */
const RETIRED_PROFILE_ENTRY = /\.pnpm-old$|^\.ignored_/;
/**
 * Remove the artifacts retired plugins and older extension versions left behind,
 * in the places DSH actually resolves through.
 *
 * WHY. A repeatedly-upgraded DSH_HOME accumulates three classes of leftover that
 * nothing else cleans:
 *
 *  1. Stale module-fallback links. `<home>/profiles/node_modules` is a forest of
 *     junctions into the RUNNING extension's vendor tree, but DSH's own heal only
 *     revisits packages in the CURRENT install's dependency closure. Packages a
 *     newer platform dropped from that closure (react, react-dom, zustand, immer,
 *     clsx …) keep whatever link an older version left, and once VS Code
 *     uninstalls that older extension the link DANGLES. Verified on a real home:
 *     10 such links, all pointing at an uninstalled 0.2.53, plus links into a
 *     global npm `@deepseek-ai/dsh@0.1.0-rc.6`. Removing them lets DSH re-link
 *     from the install that is actually running.
 *  2. Stale profile manifest entries. `dependencies` keeps a `link:` spec pointing
 *     back into this extension's own plugins/bundled (a development leftover that
 *     makes pnpm re-create the link the transplant deliberately replaces), and
 *     names of plugins this build retired.
 *  3. Structural residue: empty `@scope` directories, `*.pnpm-old` relink
 *     backups, `.ignored_*` renamed directories, and `cordis.patch.yml.bak-*`.
 *
 * WHAT THIS MUST NEVER TOUCH. Sessions, memories, attachments, storages,
 * settings, credentials and agent presets are what make a DSH_HOME worth keeping,
 * and none of them live under a `profiles/**\/node_modules` path — so this
 * function's reach is structurally limited to module trees, the profile manifest's
 * `dependencies` map, and the explicit RETIRED_HOME_ARTIFACTS allowlist above.
 * Every removal is logged.
 * @param {string} home - the resolved DSH_HOME.
 */
function pruneRetiredArtifacts(home) {
  // 1. Stale module-fallback links.
  const currentExtension = path.resolve(extensionContext?.extensionPath ?? path.join(__dirname, "..")).toLowerCase();
  const profilesRoot = path.join(home, "profiles");
  let removedLinks = 0, reLinkable = 0;
  /** Distinct kinds of resolvable-but-foreign link seen, reported once per boot. */
  const foreignLinks = new Set();
  const sweepLinks = (modulesDir) => {
    let entries;
    try { entries = fs.readdirSync(modulesDir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(modulesDir, entry.name);
      let stat;
      try { stat = fs.lstatSync(full); } catch { continue; }
      if (!stat.isSymbolicLink()) {
        // One level into a scope directory; real package dirs are never touched.
        if (entry.isDirectory() && entry.name.startsWith("@")) sweepLinks(full);
        continue;
      }
      let target = "";
      try { target = fs.readlinkSync(full); } catch { continue; }
      const normalized = target.replace(/\\/g, "/").toLowerCase();
      // The profile-owned fallback (profiles/<name>/.dsh-module-fallback) holds
      // packages a bundle carries privately; those links are correct by design.
      if (normalized.includes("/.dsh-module-fallback/")) continue;
      // ONLY remove a link whose target is gone, OR one that points OUTSIDE this
      // install at a package this install ships. A link that still resolves is
      // otherwise left alone even when it points at another extension version or a
      // global npm dsh: this install's vendor tree may not carry that package at all
      // (katex, shiki and friends are not in the 0.1.5 closure), so the link can be
      // the only copy, and deleting it would be a regression rather than a cleanup.
      //
      // The second case matters because DSH heals these links only when their target
      // is GONE. Installing a new vsix next to an older one therefore leaves every
      // module resolving into the OLD extension's vendor tree, and the host keeps
      // running the previous build's platform code: patches bundled in the new vsix
      // silently never load. Removing the link makes DSH re-link it from the install
      // that is actually running.
      if (fs.existsSync(full)) {
        const shippedHere = (relative) => {
          if (!relative) return false;
          try { return fs.existsSync(path.join(currentExtension, ...relative.split("/"))); } catch { return false; }
        };
        const foreignExt = /\/extensions\/([^/]+)\/(.+)$/.exec(normalized);
        const foreignNpm = /\/npm\/node_modules\/(.+)$/.exec(normalized);
        let stale = null;
        if (foreignExt && !normalized.startsWith(currentExtension + "/")) {
          if (shippedHere(foreignExt[2])) stale = "a different installed extension (" + foreignExt[1] + ")";
          else foreignLinks.add("a different installed extension (" + foreignExt[1] + ")");
        } else if (foreignNpm) {
          if (shippedHere("vendor/node_modules/" + foreignNpm[1])) stale = "a global npm dsh install";
          else foreignLinks.add("a global npm dsh install");
        }
        if (stale === null) continue;
        try {
          fs.unlinkSync(full);
          removedLinks++;
          if (removedLinks <= 12) log("stale module link re-pointed at this install: " + path.relative(home, full) + " (" + stale + ")");
        } catch { /* locked or already gone */ }
        continue;
      }
      let reason = "target is gone";
      if (/\/extensions\/([^/]+)\//.test(normalized)) reason = "target extension was uninstalled";
      else if (/\/npm\/node_modules\/@deepseek-ai\//.test(normalized)) reason = "target global npm dsh was removed";
      try {
        fs.unlinkSync(full);
        removedLinks++;
        if (removedLinks <= 12) log("dangling module link removed: " + path.relative(home, full) + " (" + reason + ")");
      } catch { /* locked or already gone */ }
    }
  };
  try {
    // The SHARED fallback is `profiles/node_modules` itself — it is not a profile
    // directory, so it must be swept explicitly; a per-profile loop that treats
    // every entry under profiles/ as a profile would look for
    // `profiles/node_modules/node_modules` and sweep nothing.
    const sharedModules = path.join(profilesRoot, "node_modules");
    if (fs.existsSync(sharedModules)) { sweepLinks(sharedModules); reLinkable++; }
    for (const entry of fs.readdirSync(profilesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      const modules = path.join(profilesRoot, entry.name, "node_modules");
      if (fs.existsSync(modules)) { sweepLinks(modules); reLinkable++; }
    }
  } catch { /* no profiles yet */ }
  if (removedLinks > 12) log(`dangling module links removed: ${removedLinks} total`);
  if (removedLinks > 0) log(`(dsh re-links ${removedLinks} package(s) from the running install on boot)`);
  for (const kind of foreignLinks) {
    log(`note: some module links resolve to ${kind}; left in place because this install may not carry the package, and they are only removed once their target is gone`);
  }

  // 2 + 3. Per-profile manifest and structural residue.
  let removedScopes = 0, removedEntries = 0;
  try {
    for (const entry of fs.readdirSync(profilesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const profileDir = path.join(profilesRoot, entry.name);
      const manifestPath = path.join(profileDir, "package.json");
      try {
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
          const deps = manifest?.dependencies;
          if (deps && typeof deps === "object") {
            let changed = false;
            for (const [name, spec] of Object.entries(deps)) {
              const selfLink = typeof spec === "string"
                && spec.startsWith("link:")
                && path.resolve(spec.slice("link:".length)).toLowerCase().startsWith(path.resolve(__dirname, "..").toLowerCase());
              if (RETIRED_PLUGINS.includes(name) || selfLink) {
                delete deps[name];
                changed = true;
                log(`stale profile dependency removed from ${entry.name}: ${name}${selfLink ? " (link into this extension's own bundled plugins)" : " (retired plugin)"}`);
              }
            }
            if (changed) {
              if (Object.keys(deps).length === 0) delete manifest.dependencies;
              fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
            }
          }
        }
      } catch { /* unreadable manifest: leave it alone */ }

      const modules = path.join(profileDir, "node_modules");
      // Clean the module dir AND one level inside each @scope: `*.pnpm-old` and
      // `.ignored_*` residue sits inside scopes (e.g. @dsh-vscode/x.pnpm-old), so
      // a top-level-only pass misses it.
      let children = [];
      try { children = fs.readdirSync(modules, { withFileTypes: true }); } catch { children = []; }
      const dropResidue = (full, label) => {
        try {
          fs.rmSync(full, { recursive: true, force: true });
          removedEntries++;
          log("retired profile entry removed: " + path.relative(home, full) + " (" + label + ")");
          return true;
        } catch { return false; }
      };
      for (const child of children) {
        const full = path.join(modules, child.name);
        let isLink = false;
        try { isLink = fs.lstatSync(full).isSymbolicLink(); } catch { continue; }
        if (isLink) continue;
        if (RETIRED_PROFILE_ENTRY.test(child.name)) { dropResidue(full, "relink backup or ignored dir"); continue; }
        if (!child.name.startsWith("@")) continue;
        let scoped = [];
        try { scoped = fs.readdirSync(full, { withFileTypes: true }); } catch { continue; }
        for (const sub of scoped) {
          if (!RETIRED_PROFILE_ENTRY.test(sub.name)) continue;
          const subFull = path.join(full, sub.name);
          let subIsLink = false;
          try { subIsLink = fs.lstatSync(subFull).isSymbolicLink(); } catch { continue; }
          if (subIsLink) continue;
          dropResidue(subFull, "relink backup or ignored dir");
        }
        let remaining = [];
        try { remaining = fs.readdirSync(full); } catch { continue; }
        if (remaining.length === 0) {
          try { fs.rmSync(full, { recursive: true, force: true }); removedScopes++; log("empty scope directory removed: " + path.relative(home, full)); } catch { /* best effort */ }
        }
      }
      // Backups an older plugin manager left next to the profile's patch file.
      try {
        for (const file of fs.readdirSync(profileDir)) {
          if (!/^cordis\.patch\.yml\.bak/.test(file)) continue;
          fs.rmSync(path.join(profileDir, file), { force: true });
          removedEntries++;
          log("retired profile file removed: " + path.relative(home, path.join(profileDir, file)));
        }
      } catch { /* best effort */ }
    }
  } catch { /* no profiles yet */ }
  if (removedScopes || removedEntries) log(`profile residue removed: ${removedScopes} empty scope dir(s), ${removedEntries} stale entry(ies)`);

  // 4. Home-level state from retired plugins: quarantine, never delete.
  const present = RETIRED_HOME_ARTIFACTS.filter(([name]) => fs.existsSync(path.join(home, name)));
  if (present.length === 0) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const quarantine = path.join(home, ".dsh-vscode-retired", stamp);
  try { fs.mkdirSync(quarantine, { recursive: true }); } catch { return; }
  for (const [name, owner] of present) {
    const from = path.join(home, name);
    try {
      fs.renameSync(from, path.join(quarantine, name));
      log(`retired plugin state quarantined: ${name} (was ${owner}) -> ${path.relative(home, path.join(quarantine, name))}`);
    } catch {
      try { fs.cpSync(from, path.join(quarantine, name), { recursive: true, force: true }); fs.rmSync(from, { recursive: true, force: true }); log(`retired plugin state quarantined: ${name} (copied then removed)`); } catch { /* best effort */ }
    }
  }
  log("quarantine is recoverable: nothing was deleted, move it back to restore it");
}
/**
 * Transplant the self-contained bundle-root packages. plugins/bundled holds
 * the transitive family of loader-entry client plugins as sibling package
 * dirs, plus `_hostdeps/` (the non-platform third-party deps those entries
 * must self-resolve — schemastery, ssh2, jpeg-js, ...).
 *
 * Layout into <profile>/node_modules:
 *  - entry plugin dirs go at their own scoped/unscoped path, so the DSH loader
 *    can resolve every bundle entry by name;
 *  - `_hostdeps/*` is FLATTENED one level: each dep lands at the profile
 *    top-level (e.g. <name>/schemastery -> node_modules/schemastery), which is
 *    where the importing plugin's parent-walk finds it. base/web-app read the
 *    same package names from their own vendored graph, so these siblings do
 *    not shadow that graph.
 * react / @deepseek-ai/* are deliberately NOT shipped — the vendored fallback
 * (and the running host itself) provides the single instance of that realm.
 */
/**
 * Copy a dir as a REAL package tree. A destination that is a symlink/junction
 * (e.g. a pnpm `link:` dependency pointing back at plugins/bundled) must be
 * removed first: fs.cpSync(force) copies THROUGH the link into its target, and
 * even a successful copy leaves the plugin resolving against plugins/bundled —
 * where _hostdeps is NOT a node_modules dir — so bare-specifier deps (e.g.
 * @dsh-vscode/p2h-bridge -> docgen-utils) fail with ERR_MODULE_NOT_FOUND.
 */
function copyReal(src, dest) {
  try { if (fs.lstatSync(dest).isSymbolicLink()) fs.rmSync(dest, { recursive: true, force: true }); } catch { /* not present */ }
  fs.cpSync(src, dest, { recursive: true, force: true });
}
/**
 * True if any bundled plugin was transplanted into the profile as a
 * symlink/junction (stale pnpm `link:`). The fast-path marker only tracks
 * package versions, so it would otherwise skip the fix and keep the broken link.
 */
function hasBundledLink(modules) {
  for (const name of BUNDLED_PLUGINS) {
    const p = path.join(modules, ...name.split("/"));
    try { if (fs.lstatSync(p).isSymbolicLink()) return true; } catch { /* not transplanted yet */ }
  }
  return false;
}
function transplantBundledPlugins(profileDir) {
  const bundled = path.join(__dirname, "..", "plugins", "bundled");
  if (!fs.existsSync(bundled)) return;
  const modules = path.join(profileDir, "node_modules");
  // Fast path: when the extension version AND every bundled package version
  // are unchanged since the last transplant, skip the copy. Re-copying the
  // whole self-contained tree (~64 MB, ~2100 files) on every boot was the
  // single largest startup cost and the reason the panel needed several tab
  // switches before first paint. Any version change (vsix upgrade or a
  // plugin's package.json inside plugins/bundled) invalidates the marker and
  // the force-overwrite below still propagates it, exactly as before.
  const markerPath = path.join(modules, ".dsh-baked-marker.json");
  const fingerprint = {};
  const collect = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir)) {
      const src = path.join(dir, entry);
      if (!fs.statSync(src).isDirectory()) continue;
      if (entry.startsWith("@")) { collect(src, prefix + entry + "/"); continue; }
      if (prefix === "" && entry === "_hostdeps") { collect(src, "_hostdeps/"); continue; }
      let v = "0";
      try { v = String(JSON.parse(fs.readFileSync(path.join(src, "package.json"), "utf8")).version ?? "0"); } catch { /* unversioned dir */ }
      fingerprint[prefix + entry] = v;
    }
  };
  collect(bundled, "");
  const extVersion = String(extensionContext?.extension?.packageJSON?.version ?? "unknown");
  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(markerPath, "utf8")); } catch { /* first boot or wiped profile */ }
  if (previous && previous.extVersion === extVersion && JSON.stringify(previous.packages) === JSON.stringify(fingerprint) && !hasBundledLink(modules)) {
    log("baked-in ecosystem plugins unchanged since last boot — transplant skipped (" + Object.keys(fingerprint).length + " packages)");
    return;
  }
  fs.mkdirSync(modules, { recursive: true });
  let copied = 0;
  for (const entry of fs.readdirSync(bundled)) {
    const src = path.join(bundled, entry);
    if (!fs.statSync(src).isDirectory() || entry === "_hostdeps") continue;
    if (entry.startsWith("@")) {
      const scope = path.join(bundled, entry);
      for (const sub of fs.readdirSync(scope)) {
        try { copyReal(path.join(scope, sub), path.join(modules, entry, sub)); copied++; } catch { /* skip */ }
      }
    } else {
      try { copyReal(src, path.join(modules, entry)); copied++; } catch { /* skip */ }
    }
  }
  // flatten _hostdeps/* so each dep is resolvable at <profile>/node_modules/<dep>
  const hostdeps = path.join(bundled, "_hostdeps");
  if (fs.existsSync(hostdeps)) {
    for (const entry of fs.readdirSync(hostdeps)) {
      const src = path.join(hostdeps, entry);
      if (!fs.statSync(src).isDirectory()) continue;
      try { copyReal(src, path.join(modules, entry)); copied++; } catch { /* skip */ }
    }
  }
  try { fs.writeFileSync(markerPath, JSON.stringify({ extVersion, packages: fingerprint }, null, 2) + "\n"); } catch { /* best effort */ }
  log("baked-in ecosystem plugins enabled into profile " + profileDir + " (" + copied + " self-contained entry packages)");
}

/**
 * Report whether the host's children can actually run `git`.
 *
 * The bundled rollback plugin builds each turn's before-tree with `git` executed
 * from the host process, and a capture it cannot perform is deliberately admitted
 * without undo coverage rather than blocking the conversation. That makes "the
 * rollback button is missing and /undo has nothing to do" a possible symptom of git
 * being unreachable from the host's environment — which is not the same as git being
 * installed, and is invisible without this line.
 *
 * @param {NodeJS.ProcessEnv} env - exactly the environment the host is spawned with.
 * @param {string} cwd - the working directory the host is spawned in.
 */
function probeGit(env, cwd) {
  try {
    const child = spawn("git", ["--version"], { env, cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk.toString(); });
    child.on("error", (error) => {
      log(`git probe: cannot run git (${error.code ?? "error"}: ${error.message}) — rollback needs git on the PATH this host inherits, which is not the same as git being installed`);
    });
    child.on("close", (code) => {
      const text = out.trim();
      if (code === 0) log("git probe: " + (text || "git responded"));
      else log(`git probe: "git --version" exited ${code}${text ? " — " + text : ""}`);
    });
  } catch (error) {
    log("git probe failed: " + String(error));
  }
}

/** Start the DSH web host as a child process and resolve with its bound port. */
function startHost(requestedPort = 0) {
  return new Promise((resolve, reject) => {
    const home = dshHomeForHost();
    syncBakedPlugins(path.join(home, "profiles", "web"));
    syncBakedPresets(home);
    // Runs after syncBakedPlugins so scope directories it empties are removed in
    // the same boot, and before the fork so DSH re-links the stale module
    // fallback entries from the install that is actually running.
    pruneRetiredArtifacts(home);
    // Launcher flags must come before app flags: dsh's launcher hands everything
    // after the first token it does not recognise to the booted profile, so
    // `--patch` has to land before `--port`.
    const args = ["--profile", "web"];
    const overlay = writeProfileOverlay(home);
    if (overlay) args.push("--patch", overlay);
    args.push("--port", String(requestedPort), "--no-open");
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      DSH_HOME: home,
      // Marks this host as the VS Code embedded deployment so the DSH web
      // surface can adapt gestures that otherwise reach for a desktop shell
      // (e.g. "打开配置文件" opens the settings document through the extension
      // host's editor instead of a native opener).
      DSH_EMBEDDED: "1",
      // Redirect dsh-doctor's state into the extension-owned DSH_HOME instead
      // of $HOME/.dsh-doctor. The embedded host's writeJsonAtomic rename to the
      // machine home dir can hit EPERM (file locked / ACL), and previous boots
      // also collide mid-write; keeping doctor state under DSH_HOME is writable
      // and private to this deployment.
      DSH_DOCTOR_HOME: path.join(home, "doctor"),
      // Sentinel to force the DSH host's directory-picker seam onto the pure-JS
      // `browse` backend. Without it, the resolver picks the `native` backend on
      // win32/darwin, which drives a Win32 COM dialog through the bundled `koffi`
      // FFI addon — that addon aborts the host (napi_fatal_error) when run under
      // the VS Code embedded runtime, killing the panel the moment a folder
      // chooser opens. The DSH web host only ever reads SSH_CONNECTION for (a)
      // this picker resolution and (b) disabling auto browser-open, which is
      // already a no-op here because we always pass --no-open.
      SSH_CONNECTION: "127.0.0.1 1 127.0.0.1 1",
      // Offline bundle: point Mnemon Native at the platform binary shipped in
      // the vsix so the host never needs PATH or a global npm install.
      MNEMON_CLI_PATH: path.join(__dirname, "..", "plugins", "bundled", "@mnemon-dev", "mnemon-win32-x64", "bin", "mnemon.exe")
    };

    log(`spawning dsh host: ${hostModulePath()} ${args.join(" ")}`);
    // The bundled rollback plugin captures each turn's before-tree by running `git`
    // FROM THE HOST PROCESS, and a capture it cannot perform is admitted without
    // undo coverage on purpose ("a snapshot must never block the conversation"). So
    // "no rollback button and /undo has nothing to roll back" can simply mean git is
    // not on the PATH this host inherits from VS Code — which is otherwise invisible,
    // and is a different problem from git not being installed. Probe it with the same
    // env the host gets and say so.
    void probeGit(env, hostCwd());
    // --expose-internals matches the upstream desktop launcher: the web
    // profile's HMR loader entry requires it (cordis-plugin-hmr checks
    // loader.internal, which only exists with this flag).
    //
    // LOCAL PATCH for dsh-vscode. Use spawn (not fork) so the host is not a
    // Node IPC child of the extension host. fork() requires an IPC channel;
    // on Windows that channel/job teardown when a webview view is disposed
    // (tab switch without retainContextWhenHidden) can SIGTERM the host.
    // detached:true puts the host in its own process group so it survives
    // view dispose; deactivate still taskkill's the tree.
    const child = spawn(process.execPath, ["--expose-internals", "--max-old-space-size=8192", hostModulePath(), ...args], {
      cwd: hostCwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform === "win32",
      windowsHide: true
    });
    host = child;
    log("host child pid " + child.pid + ", cwd " + hostCwd() + ", DSH_HOME " + env.DSH_HOME + (process.platform === "win32" ? " (spawn detached)" : " (spawn)"));

    let settled = false;
    const settle = (fn, value) => { if (!settled) { settled = true; fn(value); } };

    const onLine = (line) => {
      log("[host] " + line);
      const m = URL_LINE.exec(line);
      if (m) {
        hostPort = Number(m[1]);
        hostToken = m[2] ?? "";
        // The cookie is bound to the authority the WEBVIEW will use, which is
        // the proxy's, not the host's ephemeral one.
        appAuthority = `127.0.0.1:${hostPortFor()}`;
        log("host ready on 127.0.0.1:" + hostPort + (hostToken ? " (auth token captured)" : " (no auth token: pre-0.1.5 host)"));
        // Authenticate as the extension host before opening the door for the
        // webview: the proxy must already hold the cookie when the iframe asks
        // for "/" — a 401 there is what renders DSH's auth page.
        const authenticated = hostToken
          ? exchangeToken(hostPort, appAuthority, hostToken).then((cookie) => { hostCookie = cookie; })
          : Promise.resolve();
        authenticated.then(() => {
          startAppProxy(hostPortFor());
          // Off the boot path: reports which shipped client plugins the host did
          // NOT mount, which is otherwise silent (a plugin whose inject is
          // unsatisfied is skipped without logging anything).
          void logClientSurface(path.join(home, "profiles", "web"), `127.0.0.1:${hostPortFor()}`);
          settle(resolve, hostPort);
        }, (error) => settle(reject, error));
      } else {
        const open = /\[dsh-vscode:open-settings\]\s+(.+)$/.exec(line);
        if (open) {
          const file = open[1];
          void vscode.workspace.openTextDocument(file).then(
            (doc) => vscode.window.showTextDocument(doc),
            (error) => log("open settings document failed: " + String(error))
          );
        }
      }
    };
    let stdoutBuf = "";
    let stderrBuf = "";
    let sawOutput = false;
    child.stdout?.on("data", (chunk) => {
      if (!sawOutput) { sawOutput = true; log("host stdout open, first chunk " + chunk.length + " bytes"); }
      stdoutBuf += chunk.toString();
      let i;
      while ((i = stdoutBuf.indexOf("\n")) >= 0) {
        onLine(stdoutBuf.slice(0, i).replace(/\r$/, ""));
        stdoutBuf = stdoutBuf.slice(i + 1);
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderrBuf += chunk.toString();
      let i;
      while ((i = stderrBuf.indexOf("\n")) >= 0) {
        log("[host-err] " + stderrBuf.slice(0, i).replace(/\r$/, ""));
        stderrBuf = stderrBuf.slice(i + 1);
      }
    });
    child.on("error", (err) => {
      log("host failed to spawn: " + String(err));
      settle(reject, err);
    });
    child.on("exit", (code, signal) => {
      log(`host exited code=${code} signal=${signal} wasCurrent=${String(host === child)} shutdownRequested=${String(shutdownRequested)} view=${String(currentView !== null)}`);
      const wasCurrent = host === child;
      if (wasCurrent) host = null;
      readyPromise = null;
      // The launch token and its cookie are minted per host process; keeping
      // either would make the proxy present a credential the replacement host
      // rejects, and every request would 401.
      hostToken = "";
      hostCookie = "";
      appAuthority = "";
      // Drop the dead upstream so the proxy stops dialing a closed port and
      // answers 502 immediately until a replacement host is ready.
      if (wasCurrent) hostPort = 0;
      settle(reject, new Error(`dsh host exited (code ${code})`));
      // LOCAL PATCH for dsh-vscode. Rewriting webview.html on an already-rendered
      // view does not repaint (see resolveWebviewView), so the old iframe used to
      // stay up and every panel fetch failed with "Failed to fetch" after the
      // host was SIGTERM'd (window reload / extension-host recycle / restart).
      // Auto-recover like restartHost: boot a replacement and bounce the shell.
      if (wasCurrent && !shutdownRequested) void recoverHostAfterExit();
    });
  });
}

/**
 * After an unexpected host exit, start a fresh host and point the live shell at
 * it. Throttled so a crash loop cannot spam spawns. If the view is gone, still
 * warm-start so the next open is instant.
 */
async function recoverHostAfterExit() {
  if (host && hostPort > 0) return;
  if (readyPromise) return;
  const now = Date.now();
  if (now - lastHostExitAt < 3000) {
    log("host exit ignored for restart (cooldown)");
    return;
  }
  lastHostExitAt = now;
  log("host exited unexpectedly — restarting");
  const view = currentView;
  if (view) view.badge = { tooltip: "Host stopped — restarting…", value: 1 };
  try {
    const port = await withTimeout(ensureHost(), 90e3, "DSH host restart after exit");
    log("recover: host ready on " + port);
    if (currentView === view && view) {
      view.badge = undefined;
      try { view.webview.postMessage({ command: "reload", url: appUrl(hostPortFor()) }); } catch { /* best effort */ }
    }
  } catch (err) {
    log("recover failed: " + String(err && err.message ? err.message : err));
    if (currentView === view && view) {
      view.badge = undefined;
      // Last resort only: html swap may not paint, but the user still gets logs.
      try { view.webview.html = errorHtml("The DeepSeek Harness host stopped and could not be restarted.", recentLog); } catch { /* best effort */ }
    }
  }
}

/**
 * Kill one host child. On Windows a detached child is its own process group;
 * child.kill() alone can leave grandchildren. Prefer taskkill /T.
 * @param {import("node:child_process").ChildProcess} child
 */
function killHostChild(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    try {
      const { spawn } = require("node:child_process");
      spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      return;
    } catch { /* fall through to kill() */ }
  }
  try { child.kill(); } catch { /* already gone */ }
}

/** Idempotent: return the live host port, starting the host if needed. */
function ensureHost() {
  if (host && hostPort > 0) return Promise.resolve(hostPort);
  // The host binds an OS-assigned port: the STABLE port belongs to the
  // mediating proxy (see appUrl), which is what the webview's portMapping and
  // dsh.port describe.
  if (!readyPromise) readyPromise = startHost(0);
  return readyPromise;
}

/** Reject a promise after ms, so a silently stuck host can never wedge the UI. */
function withTimeout(promise, ms, what) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(what + " timed out after " + Math.round(ms / 1000) + "s (see log below)")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/**
 * The webview shell: a full-viewport iframe plus a "Starting…" overlay. The
 * iframe stays on about:blank until the extension posts 'reload', which carries
 * the AUTHORITATIVE app URL (`event.data.url`) — the extension cannot bake it
 * into this HTML because the 0.1.5 launch token only exists once the host has
 * booted, and it changes on every host restart. The baked `src` stays as a
 * fallback for a reload message that arrives without a url.
 * @param {number} port - the fixed host port this shell's iframe will reach.
 */
function shellHtml(port) {
  const src = `http://127.0.0.1:${port}/`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; frame-src http://127.0.0.1:* http://localhost:* http://*.localhost:*; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
</head>
<body style="margin:0;padding:0;overflow:hidden;background:#1e1e1e">
<div id="boot" style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;
  color:var(--vscode-descriptionForeground);font-family:var(--vscode-font-family);background:#1e1e1e">
Starting DeepSeek Harness…
</div>
<iframe id="app" title="DeepSeek Harness" src="about:blank"
  style="position:absolute;inset:0;width:100%;height:100%;border:0;z-index:1"
  allow="clipboard-read; clipboard-write; autoplay"></iframe>
<script>
  let vsc = null;
  try { vsc = acquireVsCodeApi(); } catch (e) { /* will record via fallback below */ }
  const report = (cmd, detail) => {
    try {
      if (vsc) vsc.postMessage({ command: cmd, detail: detail || '' });
    } catch (e) { /* best effort */ }
  };
  report('dsh:shell-ready');
  window.addEventListener('error', (e) => report('dsh:js-error', String((e && e.message) || e)));
  window.addEventListener('unhandledrejection', (e) => report('dsh:js-error', 'unhandled:' + String((e && e.reason) || e)));

  const appFrame = document.getElementById('app');
  const boot = document.getElementById('boot');
  // The iframe stays on about:blank until the extension says the host is up
  // ('reload' message): the app then boots EXACTLY ONCE, directly against a
  // listening host. A 0.2.33/0.2.34 bug bounced the iframe mid-boot onto
  // "/&ts=..." (a shell-page location.search leak) which the server answers
  // with 404 — killing every boot with a blank page.
  let appRequested = false;
  let tickTimer = null, fallbackTimer = null;
  const stopWaiting = () => {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
  };
  const hideBoot = () => { stopWaiting(); if (boot) boot.style.display = 'none'; };
  appFrame.addEventListener('error', () => report('dsh:iframe-error'));
  // Render path: after the reload bounce, an iframe 'load' means the real app
  // answered — hide the overlay. (about:blank loads before that are ignored.)
  appFrame.addEventListener('load', () => {
    if (!appRequested) return;
    report('dsh:iframe-load');
    hideBoot();
  });
  // Handshake: the extension answers our 'dsh:shell-ready' with 'reload'
  // whenever the host is already up (and sends one when the host becomes
  // ready) — a deterministic handshake that cannot race the webview load,
  // because resolve-time postMessages sent before this script runs are
  // silently dropped.
  const status = document.createElement('div');
  status.style.cssText = 'margin-top:10px;font-size:12px;opacity:.75';
  boot.appendChild(status);
  const t0 = Date.now();
  tickTimer = setInterval(() => { status.textContent = 'starting DSH host… ' + Math.round((Date.now() - t0) / 1000) + 's'; }, 1000);

  window.addEventListener('message', (event) => {
    if (event.data && event.data.command === 'reload') {
      report('dsh:reload-received');
      status.textContent = 'loading interface…';
      appRequested = true;
      // Prefer the extension-supplied URL: it carries the per-process launch
      // token the 0.1.5 host demands (bare "/" answers 401). Keep the cache
      // buster — it is a second query param, and the token exchange only cares
      // that exactly ONE token param reaches pathname "/".
      const base = (event.data.url ? String(event.data.url) : '${src}');
      appFrame.src = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'ts=' + Date.now();
      // Fallback in case the load event never surfaces.
      fallbackTimer = setTimeout(hideBoot, 8000);
    }
  });
</script>
</body></html>`;
}

function errorHtml(message, logLines) {
  const text = String(message).replace(/</g, "&lt;");
  const tail = (logLines ?? [])
    .slice(-24)
    .map((l) => String(l).replace(/</g, "&lt;"))
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
</head>
<body style="font-family:var(--vscode-font-family);padding:24px;color:var(--vscode-foreground)">
<h2>DeepSeek Harness stopped</h2>
<p>${text}</p>
<pre style="white-space:pre-wrap;word-break:break-all;background:var(--vscode-textCodeBlock-background);
padding:12px;border-radius:6px;max-height:50vh;overflow:auto">${tail}</pre>
<button onclick="vscode.postMessage({command:'restart'})">Restart host</button>
<button onclick="vscode.postMessage({command:'logs'})">Show logs</button>
<script>const vscode = acquireVsCodeApi();</script>
</body></html>`;
}

const provider = {
  resolveWebviewView(view) {
    log("webview view resolved");
    currentView = view;
    // Configure options (enableScripts + portMapping for the fixed host port)
    // and hand the webview its FIRST and ONLY html (the shell) right here.
    // Rewriting webview.html afterwards on an already-rendered webview view
    // does not repaint in VS Code, which is the real reason the panel was
    // stuck on the loading page. So we never swap html: the shell embeds its
    // own "Starting…" overlay and the iframe is simply reloaded via
    // postMessage once the host is ready.
    const hp = hostPortFor();
    view.webview.options = { enableScripts: true, portMapping: [{ webviewPort: hp, extensionHostPort: hp }] };
    view.badge = { tooltip: "Starting DeepSeek Harness…", value: 1 };
    view.webview.html = shellHtml(hp);

    // NOTE: deliberately NO send-side dedupe. The resolve-time send usually
    // lands before the shell script runs and is silently dropped; suppressing
    // the shell-ready handshake that follows within 500ms left the overlay up
    // forever (the 0.2.33 first-open regression). Duplicate reloads are
    // harmless — the shell just re-navigates the iframe.
    const bounceShellIframe = (why) => {
      log("reload shell iframe (" + why + ")");
      try { view.webview.postMessage({ command: "reload", url: appUrl(hostPortFor()) }); } catch { /* best effort */ }
    };

    const showRealUi = (port) => {
      if (currentView !== view) return;
      view.badge = undefined;
      bounceShellIframe("host ready on " + port);
    };

    view.onDidChangeVisibility?.((visible) => {
      if (visible && hostPort > 0) showRealUi(hostPort);
    });

    withTimeout(ensureHost(), 90e3, "DSH host startup")
      .then((port) => showRealUi(port))
      .catch((err) => {
        log("resolve startup failed: " + String(err && err.message ? err.message : err));
        if (currentView !== view) return;
        view.badge = undefined;
        view.webview.html = errorHtml(err && err.message ? err.message : err, recentLog);
      });

    view.webview.onDidReceiveMessage((msg) => {
      log("[webview] " + (msg.command || "msg") + (msg.detail ? " :: " + msg.detail : ""));
      if (msg.command === "dsh:shell-ready" && hostPort > 0) {
        // Deterministic warm-start handshake. The resolve-time postMessage
        // races the webview content load — messages posted before the shell
        // script runs are silently dropped, which is why the first open of an
        // already-running host stayed dead until a tab switch re-resolved the
        // view. The shell reports ready only AFTER its script runs, so
        // replying here always reaches a listening shell.
        view.badge = undefined;
        bounceShellIframe("shell-ready handshake");
      }
      if (msg.command === "restart") void restartHost();
      if (msg.command === "logs") { if (output) output.show(); }
    });
    view.onDidDispose(() => {
      log("webview view disposed (host pid " + String(host?.pid ?? "none") + " stays up unless deactivate)");
      if (currentView === view) currentView = null;
    });
  }
};

/**
 * No DSH_HOME reset entry point. Deletion is intentionally not exposed: a
 * mis-click would wipe all sessions and configuration, so there is no profile
 * reset command, button, or handler. Recover from a half-written profile by
 * restarting the host (Restart host), which re-runs syncBakedPlugins/syncBakedPresets
 * to re-materialize the profile.
 */

/** Kill the host; the live view (if any) re-attaches to the fresh instance. */
async function restartHost() {
  shutdownRequested = true;
  const old = host;
  host = null;
  hostPort = 0;
  hostToken = "";
  // Drop the old credential but keep the proxy listening: it reads hostPort and
  // hostCookie live, and a still-bound port means the webview never sees a
  // connection refused while the replacement host boots.
  hostCookie = "";
  appAuthority = "";
  readyPromise = null;
  const exited = old
    ? new Promise((resolve) => {
      const timer = setTimeout(resolve, 2000);
      if (typeof timer.unref === "function") timer.unref();
      old.once("exit", () => { clearTimeout(timer); resolve(); });
    })
    : Promise.resolve();
  if (old) killHostChild(old);
  // LOCAL PATCH: wait for the child's exit event before clearing the flag.
  // Clearing immediately raced recoverHostAfterExit() (exit is async), which
  // could spawn a second host while restartHost was also calling ensureHost().
  await exited;
  shutdownRequested = false;

  const view = currentView;
  if (!view) return;
  view.badge = { tooltip: "Restarting…", value: 1 };
  try {
    const port = await withTimeout(ensureHost(), 90e3, "DSH host startup");
    if (currentView === view) {
      view.badge = undefined;
      log("restart: host ready -> reload shell iframe to " + port);
      try { view.webview.postMessage({ command: "reload", url: appUrl(hostPortFor()) }); } catch { /* best effort */ }
    }
  } catch (err) {
    if (currentView === view) {
      view.badge = undefined;
      log("restart failed: " + String(err && err.message ? err.message : err));
    }
  }
}

async function openView() {
  try {
    await vscode.commands.executeCommand(VIEW_ID + ".focus");
  } catch {
    // Fallback: the view provider resolves once the container is revealed.
    await vscode.commands.executeCommand("workbench.view.extension.dsh");
  }
}

async function activate(context) {
  extensionContext = context;
  openLogFile(context);
  // A session header, because the questions that matter in a bug report (which
  // build, which DSH_HOME, which ports, whether the proxy actually bound) are
  // not reconstructible from the lines that follow.
  log(`=== dsh-vscode ${context.extension?.packageJSON?.version ?? "?"} | ${new Date().toISOString()} ===`);
  log(`extension path: ${context.extensionPath}`);
  // Before the first host boot: if the publisher id changed, the new
  // globalStorage folder is empty while sessions/settings still live under the
  // old publisher. Copy them forward once so an upgrade does not look like a
  // wipe.
  migrateLegacyPublisherHome();
  log(`DSH_HOME: ${dshHomeForHost()}`);
  log(`cwd: ${hostCwd()}`);
  log(`dsh.port: ${hostPortFor()} | baked plugins: ${String(vscode.workspace.getConfiguration("dsh").get("enableBakedPlugins"))}`);
  // Register the provider with the portMapping baked into the view's own
  // webviewOptions at creation time. This is the level at which VS Code fuses
  // webview.options into a WebviewView; setting it later via view.webview.options
  // does not reliably take effect on 1.134, so the shell iframe never reached
  // the loopback host. The host binds the fixed hostPortFor() port, so the
  // mapping is known up front. Do NOT retain the context when hidden: keeping
  // it alive while hidden never re-renders the shell.
  const hp = hostPortFor();
  const providerHandle = vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
    webviewOptions: {
      enableScripts: true,
      portMapping: [{ webviewPort: hp, extensionHostPort: hp }]
    }
  });
  const open = vscode.commands.registerCommand("dsh.open", () => void openView());
  const restart = vscode.commands.registerCommand("dsh.restart", () => void restartHost());
  const browser = vscode.commands.registerCommand("dsh.openInBrowser", async () => {
    await ensureHost();
    // The real browser can do the launch-token exchange itself, so hand it the
    // authenticated host URL — NOT the proxy port, which serves no token route.
    await vscode.env.openExternal(vscode.Uri.parse(hostAuthUrl()));
  });
  const logs = vscode.commands.registerCommand("dsh.showLogs", () => { if (output) output.show(); });
  // A plugin's cordis config is read when the plugin is applied, so a settings
  // change only takes effect on a fresh host. Killing the running one is enough:
  // a live view re-attaches through restartHost, and a hidden view re-forks with
  // the new overlay on its next resolve.
  const settingsWatcher = vscode.workspace.onDidChangeConfiguration?.((event) => {
    if (!event.affectsConfiguration("dsh.modlensFamilies")) return;
    log("dsh.modlensFamilies changed -> restarting the host so the new overlay applies");
    void restartHost();
  });
  const subscriptions = [providerHandle, open, restart, browser, logs];
  if (settingsWatcher) subscriptions.push(settingsWatcher);
  context.subscriptions.push(...subscriptions);

  if (vscode.workspace.getConfiguration("dsh").get("openOnStartup") === true) {
    void openView();
  }
  // Warm-start the host in the background so opening the view is instant;
  // any failure is logged and retried when the view resolves.
  log("pre-warming host");
  ensureHost().then(
    () => log("pre-warm ok"),
    (err) => log("pre-warm failed: " + String(err && err.message ? err.message : err))
  );
}

async function deactivate() {
  log("deactivate: shutting down host pid " + String(host?.pid ?? "none"));
  shutdownRequested = true;
  stopAppProxy();
  const child = host;
  host = null;
  if (!child) return;
  await new Promise((resolve) => {
    // Wait for the child to actually exit before returning. Tearing down while
    // the fork handle is still closing trips a libuv assertion on Windows
    // ("!(handle->flags & UV_HANDLE_CLOSING)" in src\win\async.c), which aborts
    // the whole process instead of shutting down cleanly — the same abort the
    // smoke harness hits when it calls process.exit() straight after kill().
    let settled = false;
    const finish = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
    const timer = setTimeout(finish, 2000);
    if (typeof timer.unref === "function") timer.unref();
    child.once("exit", finish);
    killHostChild(child);
  });
}

module.exports = { activate, deactivate };
