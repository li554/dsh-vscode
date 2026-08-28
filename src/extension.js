"use strict";
/**
 * dsh-vscode — Method B wrapper: run the DSH web host inside the VS Code
 * extension host and show its browser surface in a sidebar webview view.
 *
 * Transport design (all mechanisms verified against VS Code 1.133 and
 * @deepseek-ai/dsh 0.1.1-rc.2):
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
const { fork } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const URL_LINE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)/;
const VIEW_ID = "dsh.harness";

/** @type {import("node:child_process").ChildProcess | null} */
let host = null;
/** @type {vscode.WebviewView | null} */
let currentView = null;
let hostPort = 0;
/** @type {Promise<number> | null} */
let readyPromise = null;
let shutdownRequested = false;
let output = null;
/** @type {vscode.ExtensionContext | null} */
let extensionContext = null;
/** Ring buffer of recent host log lines, shown on the error page. */
const recentLog = [];

function log(line) {
  if (!output) output = vscode.window.createOutputChannel("DeepSeek Harness");
  output.appendLine(line);
  recentLog.push(line);
  if (recentLog.length > 60) recentLog.shift();
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
 * We register EACH member INDIVIDUALLY — never the @linxin666/dsh-web-ui-all
 * GROUP, whose manifest depends on native members (dsh-ssh,
 * dsh-client-ui-skin-center) and whose cordis.patch mounts the full roster; an
 * AggregateError on any missing roster member aborts the whole host boot.
 * web-ui-all's content is delivered instead by mounting its non-native member
 * plugins individually.
 * Native-ABI members (dsh-ssh, dsh-client-ui-skin-center) are intentionally
 * excluded: their native deps (ssh2/lightningcss) cannot load in the VS Code
 * embedded Node and would blank the panel.
 */
const BUNDLED_PLUGINS = [
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
  "@mlgbnb/dsh-archive-manager",
  "dsh-better-sidebar",
  "dsh-client-auto-continue",
  "dsh-miraculous-standard",
  "dsh-memory-evolve",
  "dsh-recall-plugin",
  "@dsh-external/dsh-diff-review",
  "@dsh-external/dsh-super-injector"
];
/** Plugins that older vsix releases bundled but have since been retired
 * (e.g. remote-web-ui, removed for security). A DSH_HOME that previously ran
 * with baked plugins enabled will still carry these entries in the profile
 * manifest's `bundles` list AND a transplanted tree under
 * <profile>/node_modules — so they must be pruned on every boot, otherwise a
 * stale profile keeps surfacing the removed plugin's UI and settings. */
const RETIRED_PLUGINS = ["@linxin666/dsh-remote-web-ui", "dsh-easyrewrite", "dsh-mnemon"];
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
function transplantBundledPlugins(profileDir) {
  const bundled = path.join(__dirname, "..", "plugins", "bundled");
  if (!fs.existsSync(bundled)) return;
  const modules = path.join(profileDir, "node_modules");
  fs.mkdirSync(modules, { recursive: true });
  let copied = 0;
  for (const entry of fs.readdirSync(bundled)) {
    const src = path.join(bundled, entry);
    if (!fs.statSync(src).isDirectory() || entry === "_hostdeps") continue;
    if (entry.startsWith("@")) {
      const scope = path.join(bundled, entry);
      for (const sub of fs.readdirSync(scope)) {
        try { fs.cpSync(path.join(scope, sub), path.join(modules, entry, sub), { recursive: true, force: true }); copied++; } catch { /* skip */ }
      }
    } else {
      try { fs.cpSync(src, path.join(modules, entry), { recursive: true, force: true }); copied++; } catch { /* skip */ }
    }
  }
  // flatten _hostdeps/* so each dep is resolvable at <profile>/node_modules/<dep>
  const hostdeps = path.join(bundled, "_hostdeps");
  if (fs.existsSync(hostdeps)) {
    for (const entry of fs.readdirSync(hostdeps)) {
      const src = path.join(hostdeps, entry);
      if (!fs.statSync(src).isDirectory()) continue;
      try { fs.cpSync(src, path.join(modules, entry), { recursive: true, force: true }); copied++; } catch { /* skip */ }
    }
  }
  log("baked-in ecosystem plugins enabled into profile " + profileDir + " (" + copied + " self-contained entry packages)");
}

/** Start the DSH web host as a child process and resolve with its bound port. */
function startHost(requestedPort = 0) {
  return new Promise((resolve, reject) => {
    const home = dshHomeForHost();
    syncBakedPlugins(path.join(home, "profiles", "web"));
    syncBakedPresets(home);
    const args = ["--profile", "web", "--port", String(requestedPort), "--no-open"];
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
      SSH_CONNECTION: "127.0.0.1 1 127.0.0.1 1"
    };

    log(`spawning dsh host: ${hostModulePath()} ${args.join(" ")}`);
    // --expose-internals matches the upstream desktop launcher: the web
    // profile's HMR loader entry requires it (cordis-plugin-hmr checks
    // loader.internal, which only exists with this flag).
    const child = fork(hostModulePath(), args, {
      cwd: hostCwd(),
      env,
      execArgv: ["--expose-internals"],
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    });
    host = child;
    log("host child pid " + child.pid + ", cwd " + hostCwd() + ", DSH_HOME " + env.DSH_HOME);

    let settled = false;
    const settle = (fn, value) => { if (!settled) { settled = true; fn(value); } };

    const onLine = (line) => {
      log("[host] " + line);
      const m = URL_LINE.exec(line);
      if (m) {
        hostPort = Number(m[1]);
        log("host ready on 127.0.0.1:" + hostPort);
        settle(resolve, hostPort);
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
      log(`host exited code=${code} signal=${signal}`);
      if (host === child) host = null;
      readyPromise = null;
      settle(reject, new Error(`dsh host exited (code ${code})`));
      if (!shutdownRequested && currentView) {
        currentView.webview.html = errorHtml(`The DeepSeek Harness host stopped (exit code ${code}).`, recentLog);
      }
    });
  });
}

/** Idempotent: return the live host port, starting the host if needed. */
function ensureHost() {
  if (host && hostPort > 0) return Promise.resolve(hostPort);
  if (!readyPromise) readyPromise = startHost(hostPortFor());
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

function shellHtml(port) {
  const src = `http://127.0.0.1:${port}/`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; frame-src http://127.0.0.1:* http://localhost:*; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
</head>
<body style="margin:0;padding:0;overflow:hidden;background:#1e1e1e">
<div id="boot" style="position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;
  color:var(--vscode-descriptionForeground);font-family:var(--vscode-font-family);background:#1e1e1e">
Starting DeepSeek Harness…
</div>
<iframe id="app" title="DeepSeek Harness" src="${src}"
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
  const hideBoot = () => { if (boot) boot.style.display = 'none'; };
  appFrame.addEventListener('load', hideBoot);
  appFrame.addEventListener('error', () => report('dsh:iframe-error'));
  // Safety net: even if the postMessage 'reload' never arrives, drop the
  // overlay a short while after load — the iframe will have started loading
  // the (now-ready) host on its own by then.
  setTimeout(hideBoot, 2500);

  window.addEventListener('message', (event) => {
    if (event.data && event.data.command === 'reload') {
      report('dsh:reload-received');
      hideBoot();
      appFrame.src = '${src}' + (location.search ? '&' : '?') + 'ts=' + Date.now();
      setTimeout(hideBoot, 3000);
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
<button onclick="vscode.postMessage({command:'reset'})">Reset profile &amp; restart</button>
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

    const showRealUi = (port) => {
      if (currentView !== view) return;
      view.badge = undefined;
      log("host ready -> reload shell iframe to " + port);
      try { view.webview.postMessage({ command: "reload" }); } catch { /* best effort */ }
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
      if (msg.command === "restart") void restartHost();
      if (msg.command === "logs") { if (output) output.show(); }
      if (msg.command === "reset") void resetProfileAndRestart();
    });
    view.onDidDispose(() => {
      if (currentView === view) currentView = null;
    });
  }
};

/**
 * Delete the extension-managed DSH_HOME (only when it is the default
 * globalStorage directory — never a user-configured home), then restart.
 * Heals profiles left half-written by a previous failed boot.
 */
async function resetProfileAndRestart() {
  const home = dshHomeForHost();
  const managed = extensionContext
    ? path.join(extensionContext.globalStorageUri.fsPath, "dsh-home")
    : null;
  if (managed && path.resolve(home) === path.resolve(managed)) {
    log("resetting managed DSH_HOME: " + home);
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (err) { log("reset rm failed: " + String(err)); }
  } else {
    log("refusing to delete non-managed DSH_HOME: " + home);
  }
  await restartHost();
}

/** Kill the host; the live view (if any) re-attaches to the fresh instance. */
async function restartHost() {
  shutdownRequested = true;
  const old = host;
  host = null;
  hostPort = 0;
  readyPromise = null;
  if (old) { try { old.kill(); } catch { /* already gone */ } }
  shutdownRequested = false;

  const view = currentView;
  if (!view) return;
  view.badge = { tooltip: "Restarting…", value: 1 };
  try {
    const port = await withTimeout(ensureHost(), 90e3, "DSH host startup");
    if (currentView === view) {
      view.badge = undefined;
      log("restart: host ready -> reload shell iframe to " + port);
      try { view.webview.postMessage({ command: "reload" }); } catch { /* best effort */ }
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
    const port = await ensureHost();
    await vscode.env.openExternal(vscode.Uri.parse(`http://127.0.0.1:${port}/`));
  });
  const logs = vscode.commands.registerCommand("dsh.showLogs", () => { if (output) output.show(); });
  context.subscriptions.push(providerHandle, open, restart, browser, logs);

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

function deactivate() {
  shutdownRequested = true;
  if (host) {
    try { host.kill(); } catch { /* already gone */ }
    host = null;
  }
}

module.exports = { activate, deactivate };
