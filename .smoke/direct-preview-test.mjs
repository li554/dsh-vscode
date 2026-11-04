// Verification for the preview-frame routing fixes (explore.76 loopback-direct,
// superseded by the 2026-09-18 routed-frame round + the global opener). Boots the
// vendored host exactly like boot-test.mjs, then asserts:
//   1. A loopback target ON the public port (a p2h deck preview) returns a ROUTED
//      descriptor: same public origin, session id in the path. That is the only form
//      the VS Code webview can load (LocalNetworkAccessChecks + a portMapping fused
//      to the webview), and unlike the old DIRECT descriptor it still carries the
//      isolated wrapper — so the annotation bridge runs and elements can be picked.
//   2. That routed frame really serves the rewritten page through a proxy hop:
//      bridge config injected, routed bridge script reachable, `<base>` pointing at
//      the routed proxy prefix.
//   3. A loopback target on a DIFFERENT port keeps the DIRECT descriptor (a foreign
//      local service must not be promoted onto the DSH surface's origin).
//   4. An EXTERNAL target still gets the isolated `<id>.localhost` wrapper.
//   5. The served client bundles carry the wiring both halves of「打开预览」need.
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const fileUrl = new URL(import.meta.url).pathname;
const ROOT = path.dirname(fileUrl.replace(/^\/([A-Za-z]:)/, "$1"));
const PROJ = path.resolve(ROOT, "..");

const BIN = path.join(PROJ, "vendor", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const BUNDLED = path.join(PROJ, "plugins", "bundled");
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-direct-"));
const PROFILE = path.join(HOME, "profiles", "web");
const MODULES = path.join(PROFILE, "node_modules");

function readBundledPlugins() {
  const src = fs.readFileSync(path.join(PROJ, "src", "extension.js"), "utf8");
  const m = /const BUNDLED_PLUGINS = \[([\s\S]*?)\];/.exec(src);
  if (!m) throw new Error("BUNDLED_PLUGINS not found in src/extension.js");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
const entries = readBundledPlugins();

fs.mkdirSync(MODULES, { recursive: true });
for (const entry of fs.readdirSync(BUNDLED)) {
  if (entry === "_hostdeps") continue;
  const src = path.join(BUNDLED, entry);
  if (!fs.statSync(src).isDirectory()) continue;
  if (entry.startsWith("@")) {
    for (const sub of fs.readdirSync(src)) {
      fs.cpSync(path.join(src, sub), path.join(MODULES, entry, sub), { recursive: true, force: true });
    }
  } else {
    fs.cpSync(src, path.join(MODULES, entry), { recursive: true, force: true });
  }
}
const HD = path.join(BUNDLED, "_hostdeps");
if (fs.existsSync(HD)) {
  for (const entry of fs.readdirSync(HD)) {
    const s = path.join(HD, entry);
    if (fs.statSync(s).isDirectory()) fs.cpSync(s, path.join(MODULES, entry), { recursive: true, force: true });
  }
}
fs.mkdirSync(PROFILE, { recursive: true });
const manifest = {
  dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", ...entries] } }
};
fs.writeFileSync(path.join(PROFILE, "package.json"), JSON.stringify(manifest, null, 2) + "\n");

const overlay = path.join(HOME, ".dsh-vscode-profile-patch.yml");
fs.writeFileSync(overlay, [
  "# dsh-vscode embedded host (direct-preview mirror)",
  "- id: directory-picker",
  "  disabled: true",
  "- insert:",
  "    - id: directory-picker-browse",
  "      name: '@deepseek-ai/dsh-host-directory-picker-browse'",
  "    - id: ui-directory-picker-browse",
  "      name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'"
].join("\n") + "\n");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

// The VS Code topology: the webview can only reach the mediating proxy port, so the
// harness stands in for that proxy (DSH_PROXY_PORT) and serves a deck-like page.
const PROXY_PORT = await freePort();
const DECK_PAGE = "<!doctype html><html><head><title>Deck</title></head><body>"
  + "<div id=\"slide-1\" class=\"p2h-slide-frame\">deck slide one</div>"
  + "<div id=\"slide-2\" class=\"p2h-slide-frame\">deck slide two</div></body></html>";
let hostPort = 0;
const proxyServer = http.createServer((req, res) => {
  if (req.url === "/deck.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(DECK_PAGE);
    return;
  }
  // Everything else is relayed to the host, exactly as the extension proxy does.
  if (hostPort === 0) { res.writeHead(503); res.end("host not ready"); return; }
  const upstream = http.request({
    host: "127.0.0.1",
    port: hostPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${hostPort}` }
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on("error", () => { try { res.writeHead(502); res.end("relay failed"); } catch { /* sent */ } });
  req.pipe(upstream);
});
await new Promise((resolve) => proxyServer.listen(PROXY_PORT, "127.0.0.1", resolve));

const child = spawn(process.execPath, ["--expose-internals", BIN, "--profile", "web", "--patch", overlay, "--port", "0", "--no-open"], {
  cwd: PROJ,
  env: { ...process.env, DSH_HOME: HOME, DSH_PROXY_PORT: String(PROXY_PORT) },
  stdio: ["ignore", "pipe", "pipe"]
});
let out = "", err = "";
child.stdout.on("data", (d) => { out += d.toString(); });
child.stderr.on("data", (d) => { err += d.toString(); });

const PORT_RE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/(?:\?token=([A-Za-z0-9_-]+))?/;
function tail(text, n = 4000) { return text.length > n ? "…" + text.slice(-n) : text; }

async function authCookie(base, token) {
  if (!token) return "";
  const res = await fetch(`${base}/?token=${encodeURIComponent(token)}`, { redirect: "manual", headers: { accept: "*/*" } });
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie")];
  return (raw || []).filter(Boolean).map((c) => String(c).split(";")[0]).join("; ");
}

(async () => {
  const deadline = Date.now() + 120000;
  let port = null, token = "";
  while (Date.now() < deadline) {
    const m = PORT_RE.exec(out);
    if (m) { port = Number(m[1]); token = m[2] ?? ""; break; }
    if (child.exitCode !== null) {
      console.log("HOST EXITED early code=" + child.exitCode);
      console.log("--- stderr tail ---\n" + tail(err));
      process.exit(2);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!port) {
    console.log("TIMEOUT waiting for host port.\n--- stdout tail ---\n" + tail(out, 8000));
    child.kill();
    process.exit(3);
  }
  hostPort = port;
  console.log("HOST READY on 127.0.0.1:" + port + " (proxy/mapped port " + PROXY_PORT + ")");
  const base = `http://127.0.0.1:${port}`;
  const cookie = await authCookie(base, token);
  const headers = { accept: "*/*", ...(cookie ? { cookie } : {}) };
  let pass = 0, checks = 0;
  const ok = (label, cond) => { checks++; if (cond) pass++; console.log(`  ${cond ? "OK  " : "FAIL"} ${label}`); };
  const createSession = async (target) => {
    const res = await fetch(base + "/webview-preview-sessions", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json", "x-dsh-web-review-client": "1", origin: base },
      body: JSON.stringify({ target })
    });
    return { status: res.status, descriptor: await res.json().catch(() => null) };
  };
  const frameHeaders = { accept: "text/html,*/*", ...(cookie ? { cookie } : {}) };
  const relay = (pathAndQuery) => fetch(`http://127.0.0.1:${PROXY_PORT}${pathAndQuery}`, { headers: frameHeaders, redirect: "manual" });

  // 1. loopback target on the public port -> ROUTED descriptor (bridged, reachable)
  const routed = await createSession(`http://127.0.0.1:${PROXY_PORT}/deck.html`);
  const routedUrl = routed.descriptor?.frameUrl ?? "";
  const routedId = routedUrl.match(/\/\.dsh-web-review-frame\/([a-f\d]{32})\//)?.[1] ?? "";
  ok(`deck on the public port -> ${routed.status} routed descriptor`,
    routed.status === 201 &&
    routedUrl.startsWith(`http://127.0.0.1:${PROXY_PORT}/.dsh-web-review-frame/`) &&
    routedUrl.includes("/.dsh-web-review/entry/") &&
    routed.descriptor?.frameOrigin === `http://127.0.0.1:${PROXY_PORT}` &&
    routed.descriptor?.targetOrigin === `http://127.0.0.1:${PROXY_PORT}` &&
    routedId.length === 32);
  ok("routed descriptor encodes the deck target",
    routedUrl.endsWith(encodeURIComponent(`http://127.0.0.1:${PROXY_PORT}/deck.html`).replace(/%2F/g, "/")));

  // 2. the routed frame really serves the rewritten page (through the proxy hop)
  if (routedUrl !== "") {
    const framePath = routedUrl.slice(`http://127.0.0.1:${PROXY_PORT}`.length);
    const frameRes = await relay(framePath);
    const html = await frameRes.text();
    ok(`routed frame serves rewritten HTML (status ${frameRes.status})`,
      frameRes.status === 200 && html.includes("deck slide one"));
    ok("routed frame injects the bridge config (channel + parent origin)",
      html.includes("__DSH_WEB_REVIEW_BRIDGE_CONFIG__") && html.includes(routed.descriptor.channel) &&
      html.includes(`http://127.0.0.1:${PROXY_PORT}`));
    ok("routed frame points the page at the routed proxy prefix",
      html.includes(`/.dsh-web-review-frame/${routedId}/.dsh-web-review/proxy/`));

    const bridgeRes = await relay(`/.dsh-web-review-frame/${routedId}/.dsh-web-review/bridge.js`);
    const bridgeJs = await bridgeRes.text();
    ok(`routed bridge script is reachable (status ${bridgeRes.status})`,
      bridgeRes.status === 200 && bridgeJs.includes("dsh-web-review/bridge") && bridgeJs.includes("__DSH_WEB_REVIEW_BRIDGE_CONFIG__"));

    const unknown = await relay(`/.dsh-web-review-frame/${"0".repeat(32)}/.dsh-web-review/entry/x`);
    ok("an unknown routed session id is refused", unknown.status === 404);

    // A VS Code webview always adds a `vscode-webview://` ancestor, and
    // frame-ancestors is checked against EVERY ancestor — so a routed frame that
    // asserted one rendered blank ("页面无法通过隔离预览加载").
    const routedCsp = frameRes.headers.get("content-security-policy") ?? "";
    ok("routed frame asserts no frame-ancestors", !routedCsp.includes("frame-ancestors"), routedCsp || "none");
  }

  // 3. loopback target on ANOTHER port -> DIRECT descriptor (no origin promotion)
  const foreign = await createSession("http://127.0.0.1:9/dev.html");
  ok(`dev server on its own port -> ${foreign.status} direct descriptor`,
    foreign.status === 201 && foreign.descriptor?.frameUrl === "http://127.0.0.1:9/dev.html");

  // 4. external target -> isolated descriptor (regression), and that isolated
  //    sessions KEEP the frame-ancestors guard (only routed ones drop it)
  const external = "https://example.com/page";
  const ext = await createSession(external);
  ok(`external target -> ${ext.status} isolated descriptor`,
    ext.status === 201 && typeof ext.descriptor?.frameUrl === "string" &&
    ext.descriptor.frameUrl.startsWith("http://") && ext.descriptor.frameUrl.includes(".dsh-web-review.localhost") === false &&
    ext.descriptor.frameUrl.includes(".dsh-web-review/entry/"));
  if (ext.status === 201 && typeof ext.descriptor?.frameUrl === "string") {
    const isolatedUrl = new URL(ext.descriptor.frameUrl);
    const isolated = await new Promise((resolve) => {
      // the isolated listener keys sessions off its own Host header, so the request
      // has to present the per-session `*.localhost` authority
      const req = http.request({
        host: "127.0.0.1",
        port: Number(isolatedUrl.port),
        path: `${isolatedUrl.pathname}${isolatedUrl.search}`,
        method: "GET",
        headers: { host: isolatedUrl.host, accept: "text/html" }
      }, (res) => { const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") })); });
      req.on("error", () => resolve({ status: 0, headers: {}, body: "" }));
      req.end();
    });
    ok(`isolated session answers for its own authority (upstream status ${isolated.status})`,
      isolated.status > 0 && String(isolated.headers["content-security-policy"] ?? "").length > 0,
      JSON.stringify(isolated.headers));
    ok("isolated session keeps frame-ancestors",
      String(isolated.headers["content-security-policy"] ?? "").includes(`frame-ancestors ${base}`),
      String(isolated.headers["content-security-policy"] ?? "none"));
  }

  // 5. served client bundles expose the global opener
  let html = "";
  try { html = await (await fetch(base + "/", { headers, redirect: "manual" })).text(); } catch { /* shell may need cookie path */ }
  const urls = [...new Set([...html.matchAll(/\/plugins\/[^"'\s<>\\)]+/g)].map((m) => m[0].replace(/&amp;/g, "&")))];
  let webReview = "";
  for (const u of urls) {
    const res = await fetch(base + u, { headers, redirect: "manual" });
    if (res.status !== 200) continue;
    const text = await res.text();
    if (u.includes("@canglongcl/dsh-web-review") && !webReview) webReview = text;
  }
  ok("web-review client exposes __dshWebReviewOpenPreview__", webReview.includes("__dshWebReviewOpenPreview__"));
  ok("web-review opener mints the engine from the per-session registry",
    webReview.includes("createWebviewStoreRegistry") &&
    webReview.includes("instanceFor(sessionId).actions") &&
    !webReview.includes("engineActions") &&
    !webReview.includes("store: webviewStore"));
  ok("web-review registrations hand out the registry engine (hooks + actions)",
    webReview.includes("hooks: { webviewStore: engine }") && webReview.includes("useWebviewStore"));
  ok("web-review client accepts routed frames and keeps the bridge for them",
    webReview.includes("PREVIEW_FRAME_ROUTE") &&
    webReview.includes("routedEntryPrefix") &&
    webReview.includes("const bridged = directUrl.pathname.startsWith(PREVIEW_FRAME_ROUTE)"));

  console.log("RESULT: " + pass + "/" + checks + " checks passed");
  child.kill();
  proxyServer.close();
  process.exit(pass === checks ? 0 : 4);
})();
