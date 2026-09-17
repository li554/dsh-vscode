// Regression test for the local dsh-web-review patch: annotation drafts are
// keyed by sessionId and do NOT require a live agent to accept.
//
// The dock syncs its annotation draft with POST /webview-annotations. Upstream
// answered 404 "session not found" whenever `agents.get(sessionId)` found
// nothing — the ordinary state of a session you merely reopened — which the
// dock rendered as "Could not sync browser comments. Try again." for both
// clearing (a host no-op) and non-empty drafts (pending until the next
// admitted human prompt). Pending now lives under sessionId and is injected
// on agent/pre-step once an agent is back.
//
// This drives the real host through the extension's proxy (the path the webview
// uses): empty and non-empty drafts both succeed without a live agent; the
// proxy is transparent (same status direct and proxied).
//
// Usage: node .smoke/annotations-clear-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Module from "node:module";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const PROXY_PORT = 37794;
const UNKNOWN_SESSION = "session-00000000-0000-4000-8000-000000000000";

let failures = 0;
const check = (label, ok, detail = "") => {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? "  " + detail : ""}`);
};

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-annotations-test-"));
const HOME = path.join(TMP, "dsh-home");

const logs = [];
const disposable = { dispose() {} };
const settings = { port: PROXY_PORT, cwd: ROOT, dshHome: HOME, openOnStartup: false, enableBakedPlugins: true };
const vscodeStub = {
  window: {
    createOutputChannel: (name) => ({ name, appendLine: (l) => { logs.push(l); }, show() {} }),
    registerWebviewViewProvider: () => disposable,
    showTextDocument: () => Promise.resolve()
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: ROOT } }],
    getConfiguration: (s) => ({ get: (k) => (s === "dsh" ? settings[k] : undefined) }),
    openTextDocument: () => Promise.resolve({}),
    onDidChangeConfiguration: () => disposable
  },
  commands: { registerCommand: () => disposable, executeCommand: () => Promise.resolve() },
  env: { openExternal: () => Promise.resolve(true) },
  Uri: { parse: (s) => ({ toString: () => s }) }
};
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "vscode") return vscodeStub;
  return originalLoad.call(this, request, ...rest);
};
const ext = require(path.join(ROOT, "src", "extension.js"));

async function post(base, body, cookie) {
  const headers = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${base}/webview-annotations`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, parsed };
}

/** One comment that satisfies every parser, so the request reaches the store. */
const validComment = {
  id: "probe-1",
  comment: "make this blue",
  tagName: "div",
  role: "",
  label: "",
  cssPath: "body > div",
  fullPath: "html > body > div",
  stableClasses: [],
  textContent: "hello",
  inToolChrome: false,
  anchor: null,
  changes: [],
  textChange: null,
  viewport: { width: 1280, height: 800 }
};
const draft = (comments) => ({
  sessionId: UNKNOWN_SESSION,
  selectedSkills: [],
  page: { url: "https://example.com", title: "probe" },
  comments
});

(async () => {
  await ext.activate({
    subscriptions: [],
    extension: { packageJSON: { version: "0.0.0-annotations-test" } },
    extensionPath: ROOT,
    globalStorageUri: { fsPath: TMP }
  });

  const deadline = Date.now() + 90000;
  let hostPort = null, token = null;
  while (Date.now() < deadline) {
    const ready = /host ready on 127\.0\.0\.1:(\d+)/.exec(logs.join("\n"));
    const tok = /dsh web: http:\/\/127\.0\.0\.1:\d+\/\?token=([A-Za-z0-9_-]+)/.exec(logs.join("\n"));
    if (ready && tok) { hostPort = Number(ready[1]); token = tok[1]; break; }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!hostPort || !token) {
    console.log("could not observe the host port/token:\n" + logs.slice(-8).join("\n"));
    failures++;
    await ext.deactivate();
    process.exit(1);
  }
  const host = `http://127.0.0.1:${hostPort}`;
  const exchange = await fetch(`${host}/?token=${token}`, { redirect: "manual" });
  const cookie = (exchange.headers.getSetCookie() || []).map((c) => c.split(";")[0]).join("; ");
  check("host reachable and authenticated", cookie.length > 0);
  console.log(`host 127.0.0.1:${hostPort}, proxy 127.0.0.1:${PROXY_PORT}`);

  console.log("\nclearing (comments: []) — no live agent required");
  const clearDirect = await post(host, draft([]), cookie);
  const clearProxied = await post(`http://127.0.0.1:${PROXY_PORT}`, draft([]), null);
  check("direct: reported success, not an error", clearDirect.status === 200, `${clearDirect.status} ${clearDirect.text.slice(0, 80)}`);
  check("direct: receipt is the empty kind", clearDirect.parsed?.kind === "empty", JSON.stringify(clearDirect.parsed));
  check("through the proxy: same result", clearProxied.status === 200, `${clearProxied.status} ${clearProxied.text.slice(0, 80)}`);
  check("through the proxy: same receipt", clearProxied.parsed?.kind === "empty", JSON.stringify(clearProxied.parsed));

  console.log("\nNON-empty draft without a live agent — stored under sessionId");
  const sendDirect = await post(host, draft([validComment]), cookie);
  const sendProxied = await post(`http://127.0.0.1:${PROXY_PORT}`, draft([validComment]), null);
  check("direct: accepted without a live agent", sendDirect.status === 200, `${sendDirect.status} ${sendDirect.text.slice(0, 80)}`);
  check("direct: receipt is ready with a snapshotId", sendDirect.parsed?.kind === "ready" && typeof sendDirect.parsed?.snapshotId === "string", JSON.stringify(sendDirect.parsed));
  check("through the proxy: same acceptance", sendProxied.status === 200, `${sendProxied.status} ${sendProxied.text.slice(0, 80)}`);
  check("through the proxy: same ready receipt shape", sendProxied.parsed?.kind === "ready" && typeof sendProxied.parsed?.snapshotId === "string", JSON.stringify(sendProxied.parsed));

  console.log("\nclear after a non-empty draft — drops the pending snapshot");
  const clearAfter = await post(host, draft([]), cookie);
  check("clear after draft reports success", clearAfter.status === 200, `${clearAfter.status} ${clearAfter.text.slice(0, 80)}`);
  check("clear after draft is the empty kind", clearAfter.parsed?.kind === "empty", JSON.stringify(clearAfter.parsed));

  console.log("\nthe proxy is transparent (same status direct and proxied)");
  check("clear path parity", clearDirect.status === clearProxied.status);
  check("send path parity", sendDirect.status === sendProxied.status);

  console.log(`\nRESULT: ${failures === 0 ? "PASS" : `FAIL (${failures} check(s))`}`);
  await ext.deactivate();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
  process.exit(failures === 0 ? 0 : 1);
})();
