// Regression test for the local dsh-web-review patch: clearing annotations must
// not fail just because the session has no live agent.
//
// The dock syncs its annotation draft with POST /webview-annotations. Its clear
// path sends `comments: []`, and the handler answered 404 "session not found"
// whenever `agents.get(sessionId)` found nothing — the ordinary state of a
// session you merely reopened — which the dock rendered as
// "Could not sync browser comments. Try again." over an operation that had
// nothing to do. The patch relaxes ONLY that branch.
//
// This drives the real host through the extension's proxy (the path the webview
// uses), and checks both halves: the empty case now succeeds, and a NON-empty
// draft for an unknown session still refuses with 404 — so the agent requirement
// was relaxed for a no-op, not removed.
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

/** One comment that satisfies every parser, so the request reaches the agent lookup. */
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

  console.log("\nclearing (comments: []) — the patched branch");
  const clearDirect = await post(host, draft([]), cookie);
  const clearProxied = await post(`http://127.0.0.1:${PROXY_PORT}`, draft([]), null);
  check("direct: reported success, not an error", clearDirect.status === 200, `${clearDirect.status} ${clearDirect.text.slice(0, 80)}`);
  check("direct: receipt is the empty kind", clearDirect.parsed?.kind === "empty", JSON.stringify(clearDirect.parsed));
  check("through the proxy: same result", clearProxied.status === 200, `${clearProxied.status} ${clearProxied.text.slice(0, 80)}`);
  check("through the proxy: same receipt", clearProxied.parsed?.kind === "empty", JSON.stringify(clearProxied.parsed));

  console.log("\na NON-empty draft for an unknown session — the agent requirement must survive");
  const sendDirect = await post(host, draft([validComment]), cookie);
  const sendProxied = await post(`http://127.0.0.1:${PROXY_PORT}`, draft([validComment]), null);
  check("direct: still refuses without a live agent", sendDirect.status === 404, `${sendDirect.status} ${sendDirect.text.slice(0, 80)}`);
  check("direct: refusal names the session", sendDirect.text.includes("session not found"), sendDirect.text.slice(0, 60));
  check("through the proxy: same refusal", sendProxied.status === 404, `${sendProxied.status} ${sendProxied.text.slice(0, 80)}`);

  console.log("\nthe proxy is transparent (same status direct and proxied)");
  check("clear path parity", clearDirect.status === clearProxied.status);
  check("send path parity", sendDirect.status === sendProxied.status);

  console.log(`\nRESULT: ${failures === 0 ? "PASS" : `FAIL (${failures} check(s))`}`);
  await ext.deactivate();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
  process.exit(failures === 0 ? 0 : 1);
})();
