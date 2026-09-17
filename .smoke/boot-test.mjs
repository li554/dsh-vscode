// Headless boot harness for the self-contained baked plugins.
// Replicates src/extension.js startHost(): forks the vendored dsh bin against a
// fresh temp DSH_HOME, pre-writes the web profile with the baked bundles in the
// manifest, transplants plugins/bundled into <profile>/node_modules, waits for
// the bound-port line, then asserts `/` and every plugin's
// `/plugins/<id>/client.js` serve 200 (a platform-shadow or resolution failure
// surfaces as 400/404 or a host-side crash). Requires: fetch (node>=18).
//
// The entry list is READ OUT OF src/extension.js (BUNDLED_PLUGINS) rather than
// duplicated here, so the harness cannot silently drift from what ships.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const fileUrl = new URL(import.meta.url).pathname;
const ROOT = path.dirname(fileUrl.replace(/^\/([A-Za-z]:)/, "$1"));
const PROJ = path.resolve(ROOT, "..");

const BIN = path.join(PROJ, "vendor", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const BUNDLED = path.join(PROJ, "plugins", "bundled");
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-boot-"));
const PROFILE = path.join(HOME, "profiles", "web");
const MODULES = path.join(PROFILE, "node_modules");

function readBundledPlugins() {
  const src = fs.readFileSync(path.join(PROJ, "src", "extension.js"), "utf8");
  const m = /const BUNDLED_PLUGINS = \[([\s\S]*?)\];/.exec(src);
  if (!m) throw new Error("BUNDLED_PLUGINS not found in src/extension.js");
  const names = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  if (!names.length) throw new Error("BUNDLED_PLUGINS is empty");
  return names;
}

// Self-contained entry plugins: only these package dirs ship; each resolves by
// name from <profile>/node_modules so the DSH loader mounts exactly what we
// deliver. Every one is registered INDIVIDUALLY (never an upstream GROUP whose
// roster references plugins we do not ship).
const entries = readBundledPlugins();
console.log("baked plugin entries (" + entries.length + "): " + entries.join(", "));

/** True when the entry declares a web client half, i.e. is expected to be
 * advertised as a /plugins/ combo URL and injected as a graph row. A pure bundle
 * layer (e.g. dsh-undo-plugin, whose cordis patch mounts its @dsh-undo/* members)
 * has no dsh.client and therefore no client bundle of its own. */
function isWebClientEntry(name) {
  const pkgPath = path.join(BUNDLED, ...name.split("/"), "package.json");
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf8"))?.dsh?.client?.platform === "web";
  } catch {
    return false;
  }
}
const webEntries = entries.filter(isWebClientEntry);
console.log("  of which web client entries: " + webEntries.length + " (" + webEntries.join(", ") + ")");

// 1. transplant bundled entry packages + flatten _hostdeps into profile/node_modules.
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
// 2. profile manifest: default web template + the baked bundles
fs.mkdirSync(PROFILE, { recursive: true });
const manifest = {
  dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", ...entries] } }
};
fs.writeFileSync(path.join(PROFILE, "package.json"), JSON.stringify(manifest, null, 2) + "\n");

// 3. fork host exactly like startHost()
const child = spawn(process.execPath, ["--expose-internals", BIN, "--profile", "web", "--port", "0", "--no-open"], {
  cwd: PROJ,
  env: { ...process.env, DSH_HOME: HOME, SSH_CONNECTION: "127.0.0.1 1 127.0.0.1 1" },
  stdio: ["ignore", "pipe", "pipe"]
});
let out = "", err = "";
child.stdout.on("data", (d) => { out += d.toString(); });
child.stderr.on("data", (d) => { err += d.toString(); });

const PORT_RE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/(?:\?token=([A-Za-z0-9_-]+))?/;

function tail(text, n = 4000) { return text.length > n ? "…" + text.slice(-n) : text; }

/** Node's fetch keeps no cookie jar, so mirror what the webview browser does:
 * exchange the launch token for the auth cookie, then reuse it explicitly.
 * @returns {Promise<string>} the Cookie header value, or "" when unauthenticated. */
async function authCookie(base, token) {
  if (!token) return "";
  const res = await fetch(`${base}/?token=${encodeURIComponent(token)}`, { redirect: "manual", headers: { accept: "*/*" } });
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie")];
  const jar = (raw || []).filter(Boolean).map((c) => String(c).split(";")[0]).join("; ");
  console.log(`  auth: GET /?token=*** -> ${res.status} (location ${res.headers.get("location")}); cookie ${jar ? "minted" : "MISSING"}`);
  return jar;
}

(async () => {
  const deadline = Date.now() + 120000;
  let port = null, token = "";
  while (Date.now() < deadline) {
    const m = PORT_RE.exec(out);
    if (m) { port = Number(m[1]); token = m[2] ?? ""; break; }
    if (child.exitCode !== null) {
      console.log("HOST EXITED early code=" + child.exitCode);
      const fails = [...err.matchAll(/failed to import loader entry ([^(]+) \(([^)]+)\): (Cannot find (?:module|package) '[^']+')/g)]
        .map((m) => `  ${m[1].trim()} (${m[2]}): ${m[3]}`);
      if (fails.length) console.log("--- failed entries (" + fails.length + ") ---\n" + fails.join("\n"));
      console.log("--- stderr tail ---\n" + tail(err));
      console.log("--- stdout tail ---\n" + tail(out));
      process.exit(2);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!port) {
    console.log("TIMEOUT waiting for host port.");
    console.log("--- stdout tail ---\n" + tail(out, 8000));
    console.log("--- stderr tail ---\n" + tail(err, 8000));
    child.kill();
    process.exit(3);
  }
  console.log("HOST READY on 127.0.0.1:" + port + (token ? " (launch token present)" : " (no token: pre-0.1.5 host)"));

  const base = `http://127.0.0.1:${port}`;
  const cookie = await authCookie(base, token);
  const headers = { accept: "*/*", ...(cookie ? { cookie } : {}) };

  // 0.1.5 does NOT serve the bare `/plugins/<id>/client.js` path: the module
  // registry precomputes exactly the revisioned combo URLs it advertises
  // (comboUrl() -> `/plugins/??<id>/client.js,...&rev=<hash>`) and 404s anything
  // else. So discover the real URLs from the served shell instead of guessing.
  let html = "";
  let indexStatus = 0;
  try {
    const res = await fetch(base + "/", { headers, redirect: "manual" });
    indexStatus = res.status;
    html = await res.text();
  } catch (e) {
    console.log("  ERR  GET / -> " + String(e.message));
  }
  console.log(`  ${indexStatus === 200 ? "OK  " : "WARN"} GET / -> ${indexStatus}`);
  const pluginUrls = [...new Set([...html.matchAll(/\/plugins\/[^"'\s<>\\)]+/g)].map((m) => m[0].replace(/&amp;/g, "&")))];

  let pass = indexStatus === 200 ? 1 : 0;
  const checks = 1 + webEntries.length;
  for (const url of pluginUrls) {
    try {
      const res = await fetch(base + url, { headers, redirect: "manual" });
      const ok = res.status === 200;
      console.log((ok ? "  OK  " : "  WARN") + ` GET ${url.length > 120 ? url.slice(0, 117) + "..." : url} -> ${res.status}`);
    } catch (e) {
      console.log("  ERR  GET " + url + " -> " + String(e.message));
    }
  }
  // Each baked WEB entry must be advertised in at least one served combo URL and
  // appear as a graph row in the shell carrier. Bundle-only entries are mounted
  // by their cordis patch instead and legitimately have neither.
  for (const n of webEntries) {
    const advertised = pluginUrls.some((u) => u.includes(`${n}/client.js`));
    const graphRow = new RegExp(`"id":"${n.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"`).test(html);
    const ok = advertised && graphRow;
    if (ok) pass++;
    console.log(`  ${ok ? "OK  " : "WARN"} entry ${n}: advertised=${advertised} graphRow=${graphRow}`);
  }
  console.log("RESULT: " + pass + "/" + checks + " checks passed");

  const errLines = err.split("\n").filter((l) => l.includes("Error") || l.includes("Cannot find") || l.includes("MODULE_NOT_FOUND") || l.includes("resolve"));
  if (errLines.length) {
    console.log("--- resolve/crash stderr lines ---");
    console.log(tail(errLines.join("\n"), 4000));
  }
  child.kill();
  process.exit(pass === checks ? 0 : 4);
})();
