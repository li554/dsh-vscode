// End-to-end UI boot: does the SHIPPED extension actually render in a browser?
//
// WHY THIS EXISTS. Twice now a defect passed every host-side check and still
// broke the panel, because it lives on a plane the host cannot see:
//   - dsh-mcp's client half self-mounted a Remote contribution in a namespace
//     the platform also mounts; the two deadlocked the client gateway and the
//     page sat on "Loading plugins…" forever (host: healthy, 0 stderr);
//   - node-addon-require-builtin's embedder fingerprint refused VS Code's
//     Electron, but only under ELECTRON_RUN_AS_NODE — a plain node host booted
//     fine, so every node-based test passed and only the installed extension
//     failed.
// So this boots the host on the REAL deployment runtime (VS Code's own binary as
// Node) out of the PACKAGED vsix, opens the served shell in a real browser over
// CDP, and asserts the boot card goes away with no error-level console output
// (uncaught exceptions, console.error, failed resource loads).
//
// Usage: node .smoke/ui-boot-test.mjs [options]
//   --vsix=<path>   vsix to test (default: <repo>/dsh-vscode.vsix)
//   --from-repo     boot the repository tree instead of a vsix (fast dev loop)
//   --electron      force VS Code's Code.exe (default when it can be found)
//   --runtime=<exe> explicit runtime binary
//   --keep          keep the unpacked tree / edge profile for inspection
// Exit: 0 PASS, 2 setup problem, 3 host timeout, 4 assertion failure.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const SMOKE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PROJ = path.resolve(SMOKE, "..");
const argv = process.argv.slice(2);
const opt = (name) => argv.find((a) => a.startsWith(`--${name}=`));
const FROM_REPO = argv.includes("--from-repo");
const KEEP = argv.includes("--keep");
const VSIX = opt("vsix") ? path.resolve(opt("vsix").slice("--vsix=".length)) : path.join(PROJ, "dsh-vscode.vsix");
const UNPACK = path.join(SMOKE, "installed");

function findVsCodeExe() {
  const candidates = [
    process.env.DSH_VSCODE_EXE,
    path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Microsoft VS Code", "Code.exe"),
    path.join(process.env.PROGRAMFILES ?? "", "Microsoft VS Code", "Code.exe")
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "";
}
const explicitRuntime = opt("runtime") ? path.resolve(opt("runtime").slice("--runtime=".length)) : "";
const RUNTIME = explicitRuntime || findVsCodeExe() || process.execPath;
const RUNTIME_IS_ELECTRON = /code|electron/i.test(path.basename(RUNTIME));
function findBrowser() {
  const candidates = [
    process.env.DSH_BROWSER,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "";
}
const BROWSER = findBrowser();

let failures = 0;
const check = (label, ok, detail = "") => {
  if (ok) { console.log(`  ok   ${label}${detail ? "  " + detail : ""}`); return true; }
  failures++;
  console.log(`  FAIL ${label}${detail ? "  " + detail : ""}`);
  return false;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!BROWSER) { console.log("no Edge/Chrome found; set DSH_BROWSER=<exe>"); process.exit(2); }

// ---------------------------------------------------------------- extension tree
let EXT;
if (FROM_REPO) {
  EXT = PROJ;
  console.log("source: repository tree");
} else {
  if (!fs.existsSync(VSIX)) { console.log("missing vsix: " + VSIX); process.exit(2); }
  console.log(`source: ${VSIX} (${(fs.statSync(VSIX).size / 1024 / 1024).toFixed(0)} MB)`);
  fs.rmSync(UNPACK, { recursive: true, force: true });
  fs.mkdirSync(UNPACK, { recursive: true });
  let unpack = spawnSync("tar", ["-xf", VSIX, "-C", UNPACK], { encoding: "utf8" });
  if (unpack.status !== 0) unpack = spawnSync("python", ["-m", "zipfile", "-e", VSIX, UNPACK], { encoding: "utf8" });
  if (unpack.status !== 0) { console.log("cannot unpack the vsix: " + String(unpack.stderr || unpack.stdout).slice(0, 300)); process.exit(2); }
  EXT = path.join(UNPACK, "extension");
}
const BIN = path.join(EXT, "vendor", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const DSH_PKG = path.join(EXT, "vendor", "node_modules", "@deepseek-ai", "dsh", "package.json");
const BUNDLED = path.join(EXT, "plugins", "bundled");
if (!fs.existsSync(BIN)) { console.log("no dsh bin under " + EXT); process.exit(2); }
const runtimeVersion = JSON.parse(fs.readFileSync(DSH_PKG, "utf8")).version;
console.log(`dsh ${runtimeVersion}; host runtime: ${RUNTIME}${RUNTIME_IS_ELECTRON ? " (Electron-as-Node: the real deployment)" : " (plain node)"}`);

// ---------------------------------------------------------------- throwaway profile
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-ui-"));
const PROFILE = path.join(HOME, "profiles", "web");
const MODULES = path.join(PROFILE, "node_modules");
function readBundledPlugins() {
  const src = fs.readFileSync(path.join(EXT, "src", "extension.js"), "utf8");
  const m = /const BUNDLED_PLUGINS = \[([\s\S]*?)\];/.exec(src);
  if (!m) throw new Error("BUNDLED_PLUGINS not found");
  const body = m[1].split("\n").map((line) => line.replace(/\/\/.*$/, "")).filter((line) => !/^\s*[/*]/.test(line)).join("\n");
  return [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
const entries = readBundledPlugins();
const manifestOf = (name) => {
  try { return JSON.parse(fs.readFileSync(path.join(BUNDLED, ...name.split("/"), "package.json"), "utf8")); } catch { return null; }
};
fs.mkdirSync(MODULES, { recursive: true });
for (const dir of fs.readdirSync(BUNDLED)) {
  if (dir === "_hostdeps") continue;
  const full = path.join(BUNDLED, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  if (dir.startsWith("@")) {
    for (const sub of fs.readdirSync(full)) fs.cpSync(path.join(full, sub), path.join(MODULES, dir, sub), { recursive: true, force: true });
  } else {
    fs.cpSync(full, path.join(MODULES, dir), { recursive: true, force: true });
  }
}
const hostdeps = path.join(BUNDLED, "_hostdeps");
if (fs.existsSync(hostdeps)) for (const dir of fs.readdirSync(hostdeps)) fs.cpSync(path.join(hostdeps, dir), path.join(MODULES, dir), { recursive: true, force: true });
fs.writeFileSync(path.join(PROFILE, "package.json"), JSON.stringify({
  dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", ...entries] } }
}, null, 2) + "\n");
const exemptions = {};
for (const name of entries) {
  const manifest = manifestOf(name);
  if (manifest?.name && manifest?.version) exemptions[`${manifest.name}@${manifest.version}`] = [runtimeVersion];
}
fs.writeFileSync(path.join(PROFILE, "compatibility.json"), JSON.stringify(exemptions, null, 2) + "\n");

// ---------------------------------------------------------------- host
const host = spawn(RUNTIME, ["--expose-internals", BIN, "--profile", "web", "--port", "0", "--no-open"], {
  cwd: HOME,
  env: { ...process.env, DSH_HOME: HOME, ...(RUNTIME_IS_ELECTRON ? { ELECTRON_RUN_AS_NODE: "1" } : {}) },
  stdio: ["ignore", "pipe", "pipe"]
});
let hostOut = "", hostErr = "";
host.stdout.on("data", (d) => { hostOut += d.toString(); });
host.stderr.on("data", (d) => { hostErr += d.toString(); });
const PORT_RE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/(?:\?token=([A-Za-z0-9_-]+))?/;

const edgeProfile = path.join(SMOKE, ".ui-edge-profile");
const cleanups = [];
function cleanup(code) {
  try { host.kill(); } catch { /* gone */ }
  for (const fn of cleanups.reverse()) { try { fn(); } catch { /* best effort */ } }
  if (!KEEP) {
    for (const target of [HOME, edgeProfile]) { try { fs.rmSync(target, { recursive: true, force: true }); } catch { /* best effort */ } }
    if (!FROM_REPO) { try { fs.rmSync(UNPACK, { recursive: true, force: true }); } catch { /* best effort */ } }
  } else {
    console.log(`kept home: ${HOME}${FROM_REPO ? "" : "; unpacked: " + UNPACK}`);
  }
  process.exit(code);
}

let base = "", token = "";
let deadline = Date.now() + 240000;
while (Date.now() < deadline) {
  const m = PORT_RE.exec(hostOut);
  if (m) { base = `http://127.0.0.1:${m[1]}`; token = m[2] ?? ""; break; }
  if (host.exitCode !== null) {
    console.log("HOST EXITED early code=" + host.exitCode + "\n--- stderr tail ---\n" + hostErr.slice(-4000));
    cleanup(2);
  }
  await wait(300);
}
if (!base) { console.log("host timeout\n" + hostErr.slice(-4000)); cleanup(3); }
check("host booted on the deployment runtime", true, base);

// ---------------------------------------------------------------- browser over CDP
const CDP_PORT = Number(process.env.DSH_CDP_PORT ?? 9444);
fs.rmSync(edgeProfile, { recursive: true, force: true });
const browser = spawn(BROWSER, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-features=Translate,OptimizationHints",
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${edgeProfile}`, "about:blank"
], { stdio: ["ignore", "pipe", "pipe"] });
cleanups.push(() => browser.kill());
const httpJson = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => { let body = ""; res.on("data", (d) => { body += d; }); res.on("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } }); }).on("error", reject);
});
let wsUrl = "";
deadline = Date.now() + 40000;
while (Date.now() < deadline) {
  try { const v = await httpJson(`http://127.0.0.1:${CDP_PORT}/json/version`); if (v.webSocketDebuggerUrl) { wsUrl = v.webSocketDebuggerUrl; break; } } catch { /* not up yet */ }
  await wait(300);
}
if (!wsUrl) { console.log("browser CDP did not start"); cleanup(2); }

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", () => resolve()); ws.addEventListener("error", (e) => reject(e)); });
let nextId = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (raw) => {
  const message = JSON.parse(typeof raw.data === "string" ? raw.data : raw.data.toString());
  if (message.id !== undefined) {
    const entry = pending.get(message.id);
    if (entry) { pending.delete(message.id); message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result); }
  } else events.push(message);
});
const send = (method, params = {}, sessionId) => {
  const id = ++nextId;
  const payload = { id, method, params };
  if (sessionId) payload.sessionId = sessionId;
  ws.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error("timeout " + method)); } }, 30000);
  });
};
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Runtime.enable", {}, sessionId);
await send("Log.enable", {}, sessionId);
await send("Page.enable", {}, sessionId);
await send("Page.navigate", { url: `${base}/?token=${encodeURIComponent(token)}` }, sessionId);

let booted = false;
let lastText = "";
for (let i = 0; i < 45; i++) {
  await wait(2000);
  const probe = await send("Runtime.evaluate", {
    expression: "(() => ({ boot: !!document.querySelector('[data-dsh-boot]'), text: (document.body?.innerText ?? '').replace(/\\s+/g,' ').slice(0,160) }))()",
    returnByValue: true
  }, sessionId).catch(() => null);
  const value = probe?.result?.value ?? {};
  lastText = value.text ?? "";
  if (value.boot === false) { booted = true; break; }
}
check("the page leaves the DSH boot card", booted, `${Math.round((Date.now() - deadline) / -1000)}s`);
const snapshot = await send("Runtime.evaluate", {
  expression: `(() => ({
    title: document.title,
    readyState: document.readyState,
    text: (document.body?.innerText ?? '').replace(/\\s+/g,' ').slice(0, 300),
    hasApp: !!document.querySelector('#root, main, [data-dsh-app]'),
    bootCard: !!document.querySelector('[data-dsh-boot]')
  }))()`,
  returnByValue: true
}, sessionId).catch(() => null);
const page = snapshot?.result?.value ?? {};
check("the shell renders application content", Boolean(page.hasApp) && (page.text ?? "").length > 40, JSON.stringify((page.text ?? lastText).slice(0, 120)));

const errors = [];
const consoleLines = [];
for (const event of events) {
  if (event.method === "Runtime.consoleAPICalled") {
    const text = (event.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 500);
    consoleLines.push(`[${event.params.type}] ${text}`);
    if (["error", "assert"].includes(event.params.type)) errors.push({ kind: "console." + event.params.type, text });
  } else if (event.method === "Runtime.exceptionThrown") {
    const details = event.params?.exceptionDetails ?? {};
    errors.push({ kind: "exception", text: (details.exception?.description ?? details.text ?? "").slice(0, 500) });
  } else if (event.method === "Log.entryAdded" && event.params?.entry?.level === "error") {
    errors.push({ kind: "log", text: `${event.params.entry.source}: ${event.params.entry.text}`.slice(0, 500) });
  }
}
const pluginish = errors.filter((e) => /plugin|mcpManager|api-remotes|modlens|mnemon|better-sidebar|rewind|auto-continue|git-manager|slot|Cannot read|is not a function|failed to (load|mount)/i.test(e.text));
check("no browser console errors", errors.length === 0, errors.length ? errors.slice(0, 3).map((e) => `[${e.kind}] ${e.text.slice(0, 200)}`).join(" | ") : `(${consoleLines.length} console line(s), none error-level)`);
if (pluginish.length) console.log("--- plugin/remote-mount related errors ---\n" + pluginish.map((e) => `  [${e.kind}] ${e.text}`).join("\n"));

// The client surface must not be silently short: count what the shell advertised.
const surface = await send("Runtime.evaluate", {
  expression: "(() => ({ rows: (document.documentElement.innerHTML.match(/plugins\\/\\?\\?[^\"'\\s<>\\)]+/g) ?? []).length }))()",
  returnByValue: true
}, sessionId).catch(() => null);
check("the shell advertises its client plugin bundles", (surface?.result?.value?.rows ?? 0) > 0, `${surface?.result?.value?.rows ?? 0} combo URL(s)`);

if (hostErr.trim()) {
  const notes = hostErr.split("\n").filter((line) => /skipping profile bundle|failed to import|has been registered at|unsupported/i.test(line));
  check("host reported no skipped or crashed entries", notes.length === 0, notes.slice(0, 3).join(" | "));
} else {
  check("host reported no skipped or crashed entries", true);
}

console.log("");
console.log(failures === 0 ? "RESULT: PASS — the shipped surface renders in a real browser on the deployment runtime" : `RESULT: FAIL (${failures} check(s))`);
cleanup(failures === 0 ? 0 : 4);
