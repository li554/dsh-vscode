// Boot the PACKAGED extension, not the repository.
//
// The repository's boot-test proves the source tree works; it cannot prove the
// .vsix works, because packaging changes the tree: *.map files are dropped and
// pack.py PRUNES non-Windows platform payloads (@deepseek-ai/libreoffice-kit-wasm,
// @img/sharp-wasm32). A platform module that turns out to import the pruned copy
// on Windows would break only in the installed extension. So this unpacks the
// real vsix and boots the host + web surface out of it, then repeats the checks
// that matter: host ready, index serves, every bundled web client is advertised
// and mounted, and every preset declaration composes.
//
// Usage: node .smoke/installed-boot.mjs [--vsix=<path>] [--keep]
//   --vsix   vsix to test (default: <repo>/dsh-vscode.vsix)
//   --keep   keep the unpacked tree at .smoke/installed/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const fileUrl = new URL(import.meta.url).pathname;
const SMOKE = path.dirname(fileUrl.replace(/^\/([A-Za-z]:)/, "$1"));
const PROJ = path.resolve(SMOKE, "..");
const argv = process.argv.slice(2);
const vsixArg = argv.find((a) => a.startsWith("--vsix="));
const VSIX = vsixArg ? path.resolve(vsixArg.slice("--vsix=".length)) : path.join(PROJ, "dsh-vscode.vsix");
const KEEP = argv.includes("--keep");
const UNPACK = path.join(SMOKE, "installed");

if (!fs.existsSync(VSIX)) {
  console.log("missing vsix: " + VSIX + " (run `python .smoke/pack.py` first)");
  process.exit(2);
}
const sizeMb = (fs.statSync(VSIX).size / 1024 / 1024).toFixed(0);
console.log(`vsix: ${VSIX} (${sizeMb} MB)`);

fs.rmSync(UNPACK, { recursive: true, force: true });
fs.mkdirSync(UNPACK, { recursive: true });
// Windows ships bsdtar, which reads zip archives; fall back to python's zipfile.
let unpack = spawnSync("tar", ["-xf", VSIX, "-C", UNPACK], { encoding: "utf8" });
if (unpack.status !== 0) {
  unpack = spawnSync("python", ["-m", "zipfile", "-e", VSIX, UNPACK], { encoding: "utf8" });
}
if (unpack.status !== 0) {
  console.log("cannot unpack the vsix: " + String(unpack.stderr || unpack.stdout).slice(0, 400));
  process.exit(2);
}
const EXT = path.join(UNPACK, "extension");
if (!fs.existsSync(path.join(EXT, "package.json"))) {
  console.log("unpacked vsix has no extension/package.json");
  process.exit(2);
}
const pkg = JSON.parse(fs.readFileSync(path.join(EXT, "package.json"), "utf8"));
const BIN = path.join(EXT, "vendor", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const DSH_PKG = path.join(EXT, "vendor", "node_modules", "@deepseek-ai", "dsh", "package.json");
const BUNDLED = path.join(EXT, "plugins", "bundled");
if (!fs.existsSync(BIN)) {
  console.log("packaged tree has no dsh bin at " + BIN);
  process.exit(2);
}
const runtimeVersion = JSON.parse(fs.readFileSync(DSH_PKG, "utf8")).version;
console.log(`packaged extension ${pkg.version}, dsh ${runtimeVersion}`);

// Pruned-on-purpose packages must be absent from the archive, or pack.py drifted.
for (const pruned of ["@deepseek-ai/libreoffice-kit-wasm", "@img/sharp-wasm32"]) {
  const present = fs.existsSync(path.join(EXT, "vendor", "node_modules", ...pruned.split("/")));
  console.log(`  ${present ? "FAIL" : "ok  "} pruned payload absent: ${pruned}`);
  if (present) process.exitCode = 4;
}

function readBundledPlugins() {
  const src = fs.readFileSync(path.join(EXT, "src", "extension.js"), "utf8");
  const m = /const BUNDLED_PLUGINS = \[([\s\S]*?)\];/.exec(src);
  if (!m) throw new Error("BUNDLED_PLUGINS not found in the packaged extension.js");
  const body = m[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .filter((line) => !/^\s*[/*]/.test(line))
    .join("\n");
  return [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
const entries = readBundledPlugins();
console.log(`  ok   packaged BUNDLED_PLUGINS: ${entries.length} entries`);
function manifestOf(name) {
  try { return JSON.parse(fs.readFileSync(path.join(BUNDLED, ...name.split("/"), "package.json"), "utf8")); } catch { return null; }
}
const webEntries = entries.filter((name) => manifestOf(name)?.dsh?.client?.platform === "web");

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-installed-"));
const PROFILE = path.join(HOME, "profiles", "web");
const MODULES = path.join(PROFILE, "node_modules");

// Mirror startHost/syncBakedPlugins against the PACKAGED plugins/bundled tree.
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
if (fs.existsSync(hostdeps)) {
  for (const dir of fs.readdirSync(hostdeps)) fs.cpSync(path.join(hostdeps, dir), path.join(MODULES, dir), { recursive: true, force: true });
}
fs.writeFileSync(path.join(PROFILE, "package.json"), JSON.stringify({
  dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", ...entries] } }
}, null, 2) + "\n");
const exemptions = {};
for (const name of entries) {
  const manifest = manifestOf(name);
  if (manifest?.name && manifest?.version) exemptions[`${manifest.name}@${manifest.version}`] = [runtimeVersion];
}
fs.writeFileSync(path.join(PROFILE, "compatibility.json"), JSON.stringify(exemptions, null, 2) + "\n");

const child = spawn(process.execPath, ["--expose-internals", BIN, "--profile", "web", "--port", "0", "--no-open"], {
  cwd: HOME, env: { ...process.env, DSH_HOME: HOME }, stdio: ["ignore", "pipe", "pipe"]
});
let out = "", err = "";
child.stdout.on("data", (d) => { out += d.toString(); });
child.stderr.on("data", (d) => { err += d.toString(); });
const PORT_RE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/(?:\?token=([A-Za-z0-9_-]+))?/;
const tail = (t, n = 6000) => (t.length > n ? "…" + t.slice(-n) : t);

function done(code) {
  try { child.kill(); } catch { /* gone */ }
  for (const p of [UNPACK]) if (!KEEP) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* best effort */ } }
  try { fs.rmSync(HOME, { recursive: true, force: true }); } catch { /* best effort */ }
  process.exit(code);
}

(async () => {
  const deadline = Date.now() + 240000;
  let port = null, token = "";
  while (Date.now() < deadline) {
    const m = PORT_RE.exec(out);
    if (m) { port = Number(m[1]); token = m[2] ?? ""; break; }
    if (child.exitCode !== null) {
      console.log("HOST EXITED early code=" + child.exitCode);
      console.log("--- stderr tail ---\n" + tail(err));
      done(2);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!port) { console.log("TIMEOUT.\n--- stderr tail ---\n" + tail(err, 8000)); done(3); }
  console.log(`  ok   HOST READY on 127.0.0.1:${port}`);

  const base = `http://127.0.0.1:${port}`;
  const auth = await fetch(`${base}/?token=${encodeURIComponent(token)}`, { redirect: "manual" });
  const cookie = auth.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const headers = { accept: "*/*", ...(cookie ? { cookie } : {}) };
  const index = await fetch(`${base}/`, { headers, redirect: "manual" });
  const html = await index.text();
  console.log(`  ${index.status === 200 ? "ok  " : "FAIL"} GET / -> ${index.status} (${html.length} bytes)`);

  const urls = [...new Set([...html.matchAll(/(?:^|["'(\s])((?:\.\/|\/)?plugins\/[^"'\s<>\\)]+)/g)].map((m) => {
    const url = m[1].replace(/&amp;/g, "&").replace(/^\.\//, "/");
    return url.startsWith("/") ? url : "/" + url;
  }))];
  let served = 0;
  for (const url of urls) {
    const res = await fetch(base + url, { headers });
    if (res.status === 200) served++;
    else console.log(`  WARN GET ${url.slice(0, 110)} -> ${res.status}`);
  }
  const servedOk = served === urls.length;
  console.log(`  ${servedOk ? "ok  " : "FAIL"} served client bundles: ${served}/${urls.length}`);

  let mounted = 0;
  for (const name of webEntries) {
    const advertised = urls.some((u) => u.includes(`${name}/client.js`));
    const graph = new RegExp(`"id":"${name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"`).test(html);
    if (advertised && graph) mounted++;
    else console.log(`  WARN entry ${name}: advertised=${advertised} graphRow=${graph}`);
  }
  const mountedOk = mounted === webEntries.length;
  console.log(`  ${mountedOk ? "ok  " : "FAIL"} bundled web entries mounted: ${mounted}/${webEntries.length}`);

  let presetsOk = true;
  try {
    const res = await fetch(`${base}/api/agentPresets/list`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ type: "client-request", rpcId: randomUUID(), method: "agentPresets/list", payload: { args: {} } })
    });
    const body = await res.json();
    const presets = body?.result?.value?.presets ?? [];
    const broken = presets.filter((p) => p.broken);
    presetsOk = body?.result?.ok === true && broken.length === 0 && presets.length > 0;
    console.log(`  ${presetsOk ? "ok  " : "FAIL"} preset roster: ${presets.length} declaration(s)` +
      (broken.length ? " broken: " + broken.map((p) => `${p.id}(${p.broken})`).join(", ") : ""));
  } catch (error) {
    presetsOk = false;
    console.log("  FAIL preset roster: " + String(error.message ?? error));
  }

  const notes = err.split("\n").filter((l) => /skipping profile bundle|failed to import|has been registered at/.test(l));
  if (notes.length) console.log("--- host notes ---\n" + notes.join("\n"));
  const ok = index.status === 200 && servedOk && mountedOk && presetsOk && notes.length === 0;
  console.log("\nRESULT: " + (ok ? "PASS — the packaged extension boots and serves the full surface" : "FAIL"));
  done(ok ? 0 : 4);
})();
