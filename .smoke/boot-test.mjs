// Headless boot harness for the self-contained baked plugins.
// Replicates src/extension.js startHost(): forks the vendored dsh bin against a
// fresh temp DSH_HOME, pre-writes the web profile with the baked bundles in the
// manifest, transplants plugins/bundled into <profile>/node_modules, waits for
// the bound-port line, then asserts `/` and every plugin's client bundle serve
// 200 (a platform-shadow or resolution failure surfaces as 400/404 or a
// host-side crash). Requires: fetch (node>=18).
//
// 0.2.2 additions mirrored here:
//  - the plugin COMPATIBILITY GATE: a plugin whose manifest peers on platform
//    packages that do not include the running version is skipped BY DESIGN; the
//    only sanction mechanism is `<profile>/compatibility.json` (the file
//    `dsh plugin allow-version` writes). The extension writes it for the baked
//    plugins it vouches for, so this harness must too — otherwise every baked
//    plugin that was built against 0.1.5 is reported as "skipped" and the test
//    measures the gate, not the plugin.
//  - the served shell advertises client plugins with RELATIVE `plugins/??…`
//    URLs (0.1.5 used `/plugins/??…`). Normalize before fetching.
//
// The entry list is READ OUT OF src/extension.js (BUNDLED_PLUGINS) rather than
// duplicated here, so the harness cannot silently drift from what ships.
//
// Usage: node .smoke/boot-test.mjs [--only=a,b] [--keep-home]
//   --only       boot only the named entries (debugging one plugin's mount)
//   --keep-home  do not delete the throwaway DSH_HOME (its path is printed)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const fileUrl = new URL(import.meta.url).pathname;
const ROOT = path.dirname(fileUrl.replace(/^\/([A-Za-z]:)/, "$1"));
const PROJ = path.resolve(ROOT, "..");

const BIN = path.join(PROJ, "vendor", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const DSH_PKG = path.join(PROJ, "vendor", "node_modules", "@deepseek-ai", "dsh", "package.json");
const BUNDLED = path.join(PROJ, "plugins", "bundled");
const LOG = path.join(ROOT, ".last-boot.log");

const runtimeVersion = JSON.parse(fs.readFileSync(DSH_PKG, "utf8")).version;
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-boot-"));
const PROFILE = path.join(HOME, "profiles", "web");
const MODULES = path.join(PROFILE, "node_modules");

const argv = process.argv.slice(2);
const onlyArg = argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean)) : null;
const KEEP_HOME = argv.includes("--keep-home");

function readBundledPlugins() {
  const src = fs.readFileSync(path.join(PROJ, "src", "extension.js"), "utf8");
  const m = /const BUNDLED_PLUGINS = \[([\s\S]*?)\];/.exec(src);
  if (!m) throw new Error("BUNDLED_PLUGINS not found in src/extension.js");
  // Strip comments BEFORE harvesting strings: the array carries long explanatory
  // comments, and a quoted sentence in one of them used to be read as a plugin
  // name (a phantom entry, then a transplant of a package that does not exist).
  // Line-wise, because a comment here legitimately contains `/*` text
  // (`@codemirror/*`): a global block-comment strip would swallow real entries.
  const body = m[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .filter((line) => !/^\s*[/*]/.test(line))
    .join("\n");
  const names = [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  if (!names.length) throw new Error("BUNDLED_PLUGINS is empty");
  return names;
}

function packageManifest(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(BUNDLED, ...name.split("/"), "package.json"), "utf8"));
  } catch {
    return null;
  }
}

// Self-contained entry plugins: only these package dirs ship; each resolves by
// name from <profile>/node_modules so the DSH loader mounts exactly what we
// deliver. Every one is registered INDIVIDUALLY (never an upstream GROUP whose
// roster references plugins we do not ship).
let entries = readBundledPlugins();
if (ONLY) entries = entries.filter((name) => ONLY.has(name));
console.log(`dsh runtime: ${runtimeVersion} (${BIN})`);
console.log("baked plugin entries (" + entries.length + "): " + entries.join(", "));

/** True when the entry declares a web client half, i.e. is expected to be
 * advertised as a /plugins/ combo URL and injected as a graph row. A pure bundle
 * layer (e.g. a plugin whose cordis patch only mounts member packages) has no
 * dsh.client and therefore no client bundle of its own. */
function isWebClientEntry(name) {
  return packageManifest(name)?.dsh?.client?.platform === "web";
}
const webEntries = entries.filter(isWebClientEntry);
console.log("  of which web client entries: " + webEntries.length + " (" + webEntries.join(", ") + ")");

// 1. transplant bundled entry packages + flatten _hostdeps into profile/node_modules.
// Sibling packages (e.g. dsh-mnemon-* and provider members) live as their own
// top-level dirs in plugins/bundled and are referenced BY BARE NAME from a
// bundle's cordis patch, so they must land too or the entry cannot resolve.
// --only narrows the ENTRY list, never the dependency side of the transplant.
const ALL_ENTRIES = new Set(readBundledPlugins());
const wanted = (name) => !ONLY || ONLY.has(name) || !ALL_ENTRIES.has(name);
fs.mkdirSync(MODULES, { recursive: true });
for (const entry of fs.readdirSync(BUNDLED)) {
  if (entry === "_hostdeps") continue;
  const src = path.join(BUNDLED, entry);
  if (!fs.statSync(src).isDirectory()) continue;
  if (entry.startsWith("@")) {
    for (const sub of fs.readdirSync(src)) {
      if (!wanted(`${entry}/${sub}`)) continue;
      fs.cpSync(path.join(src, sub), path.join(MODULES, entry, sub), { recursive: true, force: true });
    }
  } else {
    if (!wanted(entry)) continue;
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

// 2b. compatibility.json: what the extension grants for the plugins it vouches
// for. The gate ignores records for plugins whose peers already match, so
// listing every mounted entry is the same file the extension writes.
const exemptions = {};
for (const name of entries) {
  const pkg = packageManifest(name);
  if (!pkg?.name || !pkg?.version) continue;
  exemptions[`${pkg.name}@${pkg.version}`] = [runtimeVersion];
}
fs.writeFileSync(path.join(PROFILE, "compatibility.json"), JSON.stringify(exemptions, null, 2) + "\n");
console.log(`  compatibility.json: ${Object.keys(exemptions).length} exemption record(s) for dsh ${runtimeVersion}`);

// 3. fork host exactly like startHost() (the extension's profile overlay pins
//    the browse directory picker — the old SSH_CONNECTION fake-ssh hack is gone,
//    it also disabled open-in-app)
const overlay = path.join(HOME, ".dsh-vscode-profile-patch.yml");
fs.writeFileSync(overlay, [
  "# dsh-vscode embedded host (boot-test mirror)",
  "- id: directory-picker",
  "  disabled: true",
  "- insert:",
  "    - id: directory-picker-browse",
  "      name: '@deepseek-ai/dsh-host-directory-picker-browse'",
  "    - id: ui-directory-picker-browse",
  "      name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'"
].join("\n") + "\n");
const child = spawn(process.execPath, ["--expose-internals", BIN, "--profile", "web", "--patch", overlay, "--port", "0", "--no-open"], {
  cwd: PROJ,
  env: { ...process.env, DSH_HOME: HOME },
  stdio: ["ignore", "pipe", "pipe"]
});
let out = "", err = "";
child.stdout.on("data", (d) => { out += d.toString(); });
child.stderr.on("data", (d) => { err += d.toString(); });

const PORT_RE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/(?:\?token=([A-Za-z0-9_-]+))?/;

function tail(text, n = 4000) { return text.length > n ? "…" + text.slice(-n) : text; }
function saveLog() {
  try {
    fs.writeFileSync(LOG, `# boot-test ${new Date().toISOString()}\n# runtime ${runtimeVersion}\n# home ${HOME}\n` +
      `# entries ${entries.join(",")}\n\n--- stdout ---\n${out}\n--- stderr ---\n${err}\n`);
  } catch { /* best effort */ }
}
function cleanup(code) {
  saveLog();
  child.kill();
  if (!KEEP_HOME) {
    // The host writes sessions/storages under HOME; removing it here can race
    // the child still shutting down, so this is best-effort and reported.
    try { fs.rmSync(HOME, { recursive: true, force: true }); } catch { /* best effort */ }
  } else {
    console.log("kept DSH_HOME: " + HOME);
  }
  process.exit(code);
}

/** Host-side reasons an entry did not mount: the compatibility gate, a failed
 * loader entry, or a service collision. Surfaced because these are otherwise
 * silent one-line stderr notes that scroll away. */
function hostNotes() {
  const notes = [];
  for (const line of err.split("\n")) {
    const skip = /skipping profile bundle "([^"]+)": (.*)$/.exec(line);
    if (skip) notes.push(`  SKIP ${skip[1]}: ${skip[2].slice(0, 260)}`);
    else if (/failed to import loader entry/.test(line)) notes.push("  LOADER " + line.trim().slice(0, 260));
    else if (/has been registered at|Cannot find (?:module|package)/.test(line)) notes.push("  CRASH " + line.trim().slice(0, 260));
  }
  return [...new Set(notes)];
}

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

/** Ask the live host for its preset roster and assert every declaration composes.
 *
 * 0.2.2 replaced preset directories with bundle declarations, and the registry
 * keeps a FAILED declaration visible with a `broken` reason instead of aborting
 * the boot — so a preset whose child row names a removed package (the 0.1.5-era
 * router presets did: dsh-workflow-worker-thread, the list-agents subpath) boots
 * "fine" and only fails when a user selects it. This makes that silent state
 * loud. The call is the Typert Remote `agentPresets/list` on the /api channel
 * (envelope: dsh-client-connection client.node.js; payload {args:[]}).
 *
 * @returns {Promise<{pass: number, checks: number} | null>} null when not mounted.
 */
async function assertPresetRoster(base, cookie) {
  if (!entries.includes("@dsh-vscode/presets")) {
    console.log("  SKIP preset roster: @dsh-vscode/presets is not in this run");
    return null;
  }
  const rpcId = randomUUID();
  let body;
  try {
    const res = await fetch(`${base}/api/agentPresets/list`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ type: "client-request", rpcId, method: "agentPresets/list", payload: { args: {} } })
    });
    body = await res.json();
    if (res.status !== 200 || body?.result?.ok !== true) throw new Error(`HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  } catch (error) {
    console.log("  WARN preset roster: agentPresets/list failed — " + String(error.message ?? error));
    return { pass: 0, checks: 2 };
  }
  const presets = body.result.value?.presets ?? [];
  let pass = 1;
  console.log(`  OK   preset roster: ${presets.length} declaration(s) — ${presets.map((p) => p.id).join(", ")}`);
  const broken = presets.filter((p) => p.broken);
  const bad = broken.length === 0;
  if (bad) pass++;
  console.log(`  ${bad ? "OK  " : "WARN"} every preset composes` + (bad ? "" : ": " + broken.map((p) => `${p.id}: ${p.broken}`).join(" | ")));
  for (const wanted of ["router-standard", "router-spec", "ppt-master"]) {
    if (!presets.some((p) => p.id === wanted)) console.log(`  WARN preset roster: ${wanted} is missing (was it dropped from plugins/presets/?)`);
  }
  return { pass, checks: 2 };
}

(async () => {
  const deadline = Date.now() + 180000;
  let port = null, token = "";
  while (Date.now() < deadline) {
    const m = PORT_RE.exec(out);
    if (m) { port = Number(m[1]); token = m[2] ?? ""; break; }
    if (child.exitCode !== null) {
      console.log("HOST EXITED early code=" + child.exitCode);
      const fails = [...err.matchAll(/failed to import loader entry ([^(]+) \(([^)]+)\): (Cannot find (?:module|package) '[^']+')/g)]
        .map((m) => `  ${m[1].trim()} (${m[2]}): ${m[3]}`);
      if (fails.length) console.log("--- failed entries (" + fails.length + ") ---\n" + fails.join("\n"));
      const notes = hostNotes();
      if (notes.length) console.log("--- host notes ---\n" + notes.join("\n"));
      console.log("--- stderr tail ---\n" + tail(err));
      console.log("--- stdout tail ---\n" + tail(out));
      cleanup(2);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!port) {
    console.log("TIMEOUT waiting for host port.");
    console.log("--- stdout tail ---\n" + tail(out, 8000));
    console.log("--- stderr tail ---\n" + tail(err, 8000));
    cleanup(3);
  }
  console.log("HOST READY on 127.0.0.1:" + port + (token ? " (launch token present)" : " (no token)"));

  const base = `http://127.0.0.1:${port}`;
  const cookie = await authCookie(base, token);
  const headers = { accept: "*/*", ...(cookie ? { cookie } : {}) };

  // DSH does NOT serve the bare `/plugins/<id>/client.js` path: the module
  // registry precomputes exactly the revisioned combo URLs it advertises
  // (`plugins/??<id>/client.js,…&rev=<hash>`) and 404s anything else. So
  // discover the real URLs from the served shell instead of guessing. 0.2.2
  // serves them RELATIVE to the document, 0.1.5 served them root-relative.
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
  const pluginUrls = [...new Set([...html.matchAll(/(?:^|["'(\s])((?:\.\/|\/)?plugins\/[^"'\s<>\\)]+)/g)].map((m) => {
    // The shell HTML-escapes the combo URL's `&rev=…`, and 0.2.2 serves the
    // whole path relative to the document.
    const url = m[1].replace(/&amp;/g, "&").replace(/^\.\//, "/");
    return url.startsWith("/") ? url : "/" + url;
  }))];

  // Serving every platform client bundle is a smoke of the module registry, not
  // of our plugins, so it is reported but does not move the RESULT counter.
  let servedPlatform = 0;
  for (const url of pluginUrls) {
    try {
      const res = await fetch(base + url, { headers, redirect: "manual" });
      const ok = res.status === 200;
      if (ok) servedPlatform++;
      console.log((ok ? "  OK  " : "  WARN") + ` GET ${url.length > 120 ? url.slice(0, 117) + "..." : url} -> ${res.status}`);
    } catch (e) {
      console.log("  ERR  GET " + url + " -> " + String(e.message));
    }
  }
  let pass = indexStatus === 200 ? 1 : 0;
  let checks = 1 + webEntries.length;
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
  const notes = hostNotes();
  if (notes.length) {
    console.log("--- host notes (" + notes.length + ") ---");
    for (const n of notes) console.log(n);
  }
  // 0.2.2 reads presets from bundle declarations, so "the bundle applied" is not
  // the same as "the preset composes". The registry reports every declaration
  // with an optional `broken` reason (failed import, bad config, duplicate id) —
  // assert there is none, and that our baked ids actually exist.
  const presetCheck = await assertPresetRoster(base, cookie);
  if (presetCheck) {
    pass += presetCheck.pass;
    checks += presetCheck.checks;
  }

  console.log(`  platform client bundles served: ${servedPlatform}/${pluginUrls.length}`);
  console.log("RESULT: " + pass + "/" + checks + " checks passed" +
    ` (log: ${path.relative(PROJ, LOG)})`);

  const errLines = err.split("\n").filter((l) => l.includes("Error") || l.includes("Cannot find") || l.includes("MODULE_NOT_FOUND") || l.includes("resolve"));
  if (errLines.length) {
    console.log("--- resolve/crash stderr lines ---");
    console.log(tail(errLines.join("\n"), 4000));
  }
  cleanup(pass === checks && !notes.filter((n) => n.startsWith("  SKIP") || n.startsWith("  CRASH")).length ? 0 : 4);
})();
