// Baked-plugin set: provenance and verification.
//
// History: this file used to RE-MATERIALIZE plugins/bundled from
// plugins/node_modules (a flat npm install of the whole ecosystem roster),
// walking each root package's cordis.patch.yml to collect its transitively
// mounted sibling entries. That regeneration model no longer applies: the
// 0.1.5 exploration build ships a small hand-picked set, and several are not
// npm packages at all —
//
//   @dsh-vscode/p2h-bridge       hand-written in this repo
//   dsh-client-auto-continue     npm  (pinned in plugins-rc2 provenance below)
//   @canglongcl/dsh-web-review   npm
//
// so a blanket regeneration would delete the hand-maintained packages. This
// script instead VERIFIES that the on-disk bundled set matches BUNDLED_PLUGINS
// and that every entry is actually loadable, which is what the boot harness
// depends on. Sources used to refresh the npm-sourced pair are recorded in the
// table below. dsh-memory-evolve was removed from the baked set (explore.17).
//
// To update an npm-sourced plugin:
//   npm pack <name>@<version>            # registry: https://registry.npmmirror.com
//   tar -xzf <tarball> -C <stage>
//   # copy lib/ + cordis.patch.yml + package.json (+ skills/ where present),
//   # dropping docs/, src/, tsconfig*, scripts/ and every *.map, into
//   # plugins/bundled/<name>/  — then re-run this script and .smoke/boot-test.mjs
import fs from "node:fs";
import path from "node:path";

const fileUrl = new URL(import.meta.url).pathname;
const ROOT = path.dirname(fileUrl.replace(/^\/([A-Za-z]:)/, "$1"));
const PROJ = path.resolve(ROOT, "..");
const BUNDLED = path.join(PROJ, "plugins", "bundled");

/** Where each bundled entry came from. npm-sourced versions must equal the
 * `version` inside the bundled package.json. */
const PROVENANCE = {
  "@dsh-vscode/p2h-bridge": "local (this repo) — hand-written client bundle, no build step",
  "dsh-client-auto-continue": "npm dsh-client-auto-continue@0.11.5",
  "@canglongcl/dsh-web-review": "npm @canglongcl/dsh-web-review@0.6.0 (one local patch: clearing annotations no longer demands a live agent)",
  "@liustack/modlens": "npm @liustack/modlens@3.26.1 (carries its own node_modules/{commander,undici} for the CLI it spawns)",
  "dsh-undo-plugin": "npm dsh-undo-plugin@0.1.0-rc.8 (bundle layer; mounts @dsh-undo/* members, restored from 0.2.53)",
  "dsh-mnemon": "npm dsh-mnemon@0.5.8 (Starter + source/strategy/provider children transplanted as sibling packages; zod/fflate/schemastery in _hostdeps; @mnemon-dev/mnemon@0.2.8 + win32-x64 binary for offline Native)"
};

/** Read BUNDLED_PLUGINS straight out of the extension so this check cannot
 * drift from what actually ships. */
function readBundledPlugins() {
  const src = fs.readFileSync(path.join(PROJ, "src", "extension.js"), "utf8");
  const m = /const BUNDLED_PLUGINS = \[([\s\S]*?)\];/.exec(src);
  if (!m) throw new Error("BUNDLED_PLUGINS not found in src/extension.js");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/** Every package dir physically present under plugins/bundled (scopes expanded). */
function onDiskEntries() {
  const out = [];
  for (const entry of fs.readdirSync(BUNDLED)) {
    if (entry === "_hostdeps") continue;
    const full = path.join(BUNDLED, entry);
    if (!fs.statSync(full).isDirectory()) continue;
    if (entry.startsWith("@")) {
      for (const sub of fs.readdirSync(full)) {
        if (fs.statSync(path.join(full, sub)).isDirectory()) out.push(`${entry}/${sub}`);
      }
    } else {
      out.push(entry);
    }
  }
  return out.sort();
}

/** Every package name a declared entry's cordis patch mounts as a member row
 * (`- id: x` / `name: '@scope/pkg'`). A bundled package is legitimate when it is
 * either a declared entry or claimed by one this way — that is exactly how the
 * @dsh-undo/* members arrive: only dsh-undo-plugin is a bundle entry, and its
 * patch inserts the seven packages it needs. */
function claimedMembers(entries) {
  const claimed = new Set();
  for (const n of entries) {
    const dir = path.join(BUNDLED, ...n.split("/"));
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")); } catch { continue; }
    const rel = pkg?.dsh?.bundle?.patch;
    if (!rel) continue;
    const patchPath = path.join(dir, rel);
    if (!fs.existsSync(patchPath)) continue;
    for (const m of fs.readFileSync(patchPath, "utf8").matchAll(/\b(?:name|use)\s*:\s*["']?([@a-zA-Z0-9._/-]+)["']?/g)) {
      if (!m[1].startsWith("@deepseek-ai/") && m[1] !== "cordis:group") claimed.add(m[1]);
    }
  }
  return claimed;
}

const declared = readBundledPlugins().slice().sort();
const present = onDiskEntries();
const claimed = claimedMembers(declared);

let failures = 0;
const fail = (msg) => { failures++; console.log("  FAIL " + msg); };
const ok = (msg) => console.log("  ok   " + msg);

console.log("BUNDLED_PLUGINS declared (" + declared.length + "): " + declared.join(", "));
console.log("plugins/bundled on disk (" + present.length + "): " + present.join(", "));
console.log("");

for (const n of declared) {
  if (!present.includes(n)) { fail(`${n}: declared but MISSING from plugins/bundled`); continue; }
  const dir = path.join(BUNDLED, ...n.split("/"));
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) { fail(`${n}: no package.json`); continue; }
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")); } catch (e) { fail(`${n}: package.json is not valid JSON (${e.message})`); continue; }
  if (pkg.name !== n) fail(`${n}: package.json name is "${pkg.name}"`);

  // The loader only mounts a bundle entry through a cordis patch.
  const patch = pkg.dsh?.bundle?.patch;
  if (!patch) fail(`${n}: dsh.bundle.patch missing — the loader cannot mount it`);
  else if (!fs.existsSync(path.join(dir, patch))) fail(`${n}: dsh.bundle.patch "${patch}" does not exist`);
  const inject = pkg.dsh?.client?.inject;
  if (inject !== undefined && !Array.isArray(inject)) fail(`${n}: dsh.client.inject is not an array`);

  // The one inject entry that silently broke every 0.1.1-era plugin: the
  // package was deleted upstream after 0.1.1-rc.2, so injecting it is dead
  // weight and (for anything that actually required it) fatal.
  if (Array.isArray(inject) && inject.includes("@deepseek-ai/dsh-client-runtime")) {
    fail(`${n}: injects @deepseek-ai/dsh-client-runtime, which no longer exists in 0.1.5`);
  }

  // Two legitimate shapes:
  //  - a WEB CLIENT entry declares dsh.client.platform "web" and must ship a
  //    __ModuleLoader__ bundle the client registry can serve;
  //  - a BUNDLE-ONLY entry (e.g. dsh-undo-plugin, whose cordis patch mounts its
  //    @dsh-undo/* members) declares no dsh.client and has no client half.
  if (pkg.dsh?.client !== undefined) {
    if (pkg.dsh.client.platform !== "web") fail(`${n}: declares dsh.client but platform is not "web"`);
    // The client half is advertised through exports["./client"], which is not
    // always lib/client.js (web-review ships lib/client-official.js). Resolve the
    // declared entry, then fall back to the conventional path.
    const clientRel = typeof pkg.exports?.["./client"] === "string"
      ? pkg.exports["./client"]
      : pkg.exports?.["./client"]?.default;
    const clientPath = path.join(dir, clientRel ?? "lib/client.js");
    if (!fs.existsSync(clientPath)) fail(`${n}: web client entry missing (${clientRel ?? "lib/client.js"})`);
    else {
      const src = fs.readFileSync(clientPath, "utf8");
      if (!src.includes("__ModuleLoader__.load")) fail(`${n}: ${clientRel ?? "lib/client.js"} is not a __ModuleLoader__ bundle`);
    }
  }

  const provenance = PROVENANCE[n];
  if (!provenance) fail(`${n}: no PROVENANCE entry — record where this package came from`);
  else ok(`${n}@${pkg.version} — ${provenance}`);
}

for (const n of present) {
  if (declared.includes(n)) continue;
  if (claimed.has(n)) {
    ok(`${n}: mounted as a member row by a declared bundle entry`);
    continue;
  }
  // Offline Native CLI for dsh-mnemon (not a Cordis entry; pointed at via MNEMON_CLI_PATH).
  if (n === "@mnemon-dev/mnemon" || n === "@mnemon-dev/mnemon-win32-x64") {
    ok(`${n}: offline Mnemon CLI binary (not a Cordis entry)`);
    continue;
  }
  fail(`${n}: present in plugins/bundled but neither declared in BUNDLED_PLUGINS nor claimed by any entry's cordis patch`);
}

// _hostdeps is flattened into <profile>/node_modules, so each child must be a
// real package dir or the requiring plugin gets ERR_MODULE_NOT_FOUND.
const hd = path.join(BUNDLED, "_hostdeps");
if (fs.existsSync(hd)) {
  const deps = fs.readdirSync(hd).filter((e) => fs.statSync(path.join(hd, e)).isDirectory());
  const bad = deps.filter((e) => !fs.existsSync(path.join(hd, e, "package.json")));
  if (bad.length) fail(`_hostdeps entries without package.json: ${bad.join(", ")}`);
  else ok(`_hostdeps: ${deps.length} packages, all with package.json`);
}

console.log("");
if (failures) {
  console.log(`RESULT: ${failures} problem(s) in the bundled plugin set.`);
  process.exit(1);
}
console.log("RESULT: bundled plugin set OK.");
