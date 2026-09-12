// Regression test for the webview auth broker in src/extension.js.
//
// WHY THIS EXISTS. DSH 0.1.5 gates its whole web surface behind a per-process
// launch token AND a signed HttpOnly cookie: `GET /?token=<t>` is the only
// request that mints the cookie, and every later request (the index and each
// /api call) is judged solely by that cookie. Inside VS Code the iframe is a
// third-party context whose requests VS Code's port-mapping layer relays, so a
// Set-Cookie on a relayed response never reaches the browser's cookie jar — the
// panel then renders DSH's "dsh web authentication required" page, which is
// exactly the 0.3.0-explore.1 regression this guards.
//
// The fix is that the EXTENSION HOST performs the token exchange itself and runs
// a loopback proxy for the webview, injecting the cookie and stripping the
// browser markers DSH's Host/Origin fence rejects. This test drives the real
// activate() through a stubbed `vscode` module and then probes the proxy port
// with NO cookie and WITH cross-site markers: the index must be 200 and /api
// must not be 401/403.
//
// Usage: node .smoke/extension-proxy-test.cjs  [port]
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

const ROOT = path.resolve(__dirname, "..");

// A dedicated port, not DEFAULT_HOST_PORT (37750): the developer's own VS Code
// window may already be holding that one, which would be a false failure.
const PORT = Number(process.argv[2] || process.env.DSH_PROXY_TEST_PORT || 37799);
const HOME_STORAGE = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-proxy-test-"));

// ---------------------------------------------------------------- vscode stub
// Intercept before extension.js is required. Only the surface the extension
// actually touches is implemented; everything is inert.
const disposable = { dispose() {} };
const settings = { port: PORT, cwd: ROOT, dshHome: "", openOnStartup: false, enableBakedPlugins: true };
const vscodeStub = {
  window: {
    createOutputChannel(name) {
      return { name, appendLine: (line) => process.stdout.write(`[${name}] ${line}\n`), show() {} };
    },
    registerWebviewViewProvider: () => disposable,
    showTextDocument: () => Promise.resolve()
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: ROOT } }],
    getConfiguration: (section) => ({ get: (key) => (section === "dsh" ? settings[key] : undefined) }),
    openTextDocument: () => Promise.resolve({})
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

// --------------------------------------------------------------------- probes
const base = `http://127.0.0.1:${PORT}`;

// Deliberately no cookie and no token, plus the markers a vscode-webview iframe
// really sends (the proxy is supposed to strip these).
const browserish = {
  accept: "*/*",
  "sec-fetch-site": "cross-site",
  "sec-fetch-mode": "navigate",
  "sec-fetch-dest": "iframe",
  origin: "vscode-webview://dsh-proxy-test"
};

let failures = 0;
async function probe(label, url, headers, extraHeaders = {}) {
  const res = await fetch(url, { headers: { ...headers, ...extraHeaders }, redirect: "manual" });
  const body = (await res.text().catch(() => "")).slice(0, 90).replace(/\s+/g, " ");
  // The two shapes DSH's guard can produce, plus the fence's 403.
  const unauthenticated = res.status === 401
    || body.includes("authentication required")
    || body.trim() === "unauthorized";
  const forbidden = res.status === 403 || body.trim() === "forbidden";
  const ok = !unauthenticated && !forbidden;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${String(res.status).padEnd(4)} ${label}  ${body || "(empty)"}`);
  return res;
}

(async () => {
  const context = {
    subscriptions: [],
    extension: { packageJSON: { version: "0.0.0-proxy-test" } },
    globalStorageUri: { fsPath: HOME_STORAGE }
  };

  console.log("bootstrapping a real host through activate() ...");
  await ext.activate(context);

  let live = false;
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${base}/`, { redirect: "manual" });
      if (res.status !== 502) { live = true; break; }
    } catch { /* proxy not listening yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!live) {
    console.log(`FAIL: the webview proxy never came up on ${PORT}`);
    await ext.deactivate();
    process.exit(2);
  }

  console.log("\nprobes through the proxy port the webview's portMapping points at");
  await probe("GET / (index)", `${base}/`, browserish);
  await probe("GET /?ts=<cache-buster>", `${base}/?ts=${Date.now()}`, browserish);
  // An unknown /api channel proves authentication independently of routing: the
  // auth guard runs BEFORE the RPC bridge, so unauthenticated is 401
  // "unauthorized" while authenticated falls through to the bridge's 404.
  await probe("GET /api/<unknown> (auth check)", `${base}/api/does-not-exist`, browserish, { accept: "application/json" });

  // Fetched separately: probe() already consumed its own response body.
  const html = await (await fetch(`${base}/`, { headers: browserish })).text();
  const hasGraph = /"id":/.test(html);
  const isAuthPage = html.includes("authentication required");
  if (!hasGraph || isAuthPage) failures++;
  console.log(`  ${hasGraph && !isAuthPage ? "ok  " : "FAIL"} index html ${html.length} bytes, module graph=${hasGraph}, authPage=${isAuthPage}`);

  // The web client opens ws://<origin>/api/remote.mux as its RPC mux (DSH
  // 0.1.5's api-gateway client creates a WebSocket; the old "fetch + SSE only"
  // reading is stale). It sits behind the same /api auth guard, so the proxy
  // MUST relay the upgrade — without it the panel renders but sits on
  // "自动重连中…" forever. Plain node has no WebSocket client, so do the
  // handshake on a raw socket.
  const statusLine = await upgradeStatus(PORT, "/api/remote.mux");
  const upgraded = statusLine.includes("101");
  if (!upgraded) failures++;
  console.log(`  ${upgraded ? "ok  " : "FAIL"} websocket upgrade /api/remote.mux -> ${statusLine}`);

  await ext.deactivate();
  console.log(`\nRESULT: ${failures === 0
    ? "PASS — the proxy authenticates the webview itself; no cookie or token in the browser"
    : `FAIL (${failures} check(s) rejected)`}`);
  process.exit(failures === 0 ? 0 : 1);
})();

/**
 * Perform a raw WebSocket handshake against the proxy and return the response
 * status line.
 * @param {number} port - the proxy port.
 * @param {string} pathname - the upgrade path.
 * @returns {Promise<string>} e.g. "HTTP/1.1 101 Switching Protocols".
 */
function upgradeStatus(port, pathname) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1", () => {
      // Same browser markers as the iframe sends; the proxy is meant to strip them.
      socket.write(
        `GET ${pathname} HTTP/1.1\r\n` +
        `Host: 127.0.0.1:${port}\r\n` +
        `Connection: Upgrade\r\n` +
        `Upgrade: websocket\r\n` +
        `Sec-WebSocket-Version: 13\r\n` +
        `Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n` +
        `Sec-Fetch-Site: cross-site\r\n` +
        `Origin: vscode-webview://dsh-proxy-test\r\n` +
        `\r\n`
      );
    });
    let buffer = "";
    const finish = (value) => { try { socket.destroy(); } catch { /* gone */ } resolve(value); };
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (buffer.includes("\r\n")) finish(buffer.split("\r\n")[0]);
    });
    socket.on("error", (error) => finish("ERR " + error.message));
    socket.setTimeout(10000, () => finish("TIMEOUT"));
  });
}
