// Materialize the baked ecosystem plugins for OFFLINE, EMBEDDED (VS Code webview)
// bootstrap. Historical lesson that shaped this:
//
//  * Transplants that hoist the flat tree's @deepseek-ai / schemastery into the
//    profile top-level resolver SHADOW the vendored platform (0.1.1-rc.2) with
//    the flat plugin-pinned versions (0.1.0-rc.8): base/web-app either 400 on
//    `/` or crash (native ABI) once a native experiment (ssh2/cpu-features,
//    cloudflared, lightningcss) is loadable.
//  * The DSH host ALREADY publishes its own vendored dependency closure at
//    `$DSH_HOME/profiles/node_modules` (healProfilesModuleFallback). So an
//    out-of-tree plugin package dropped into <profile>/node_modules resolves
//    react / @deepseek-ai/* via the ordinary Node parent-walk against that
//    fallback -- at the SAME versions as the running host. We therefore ship
//    only the plugin packages themselves plus the handful of NON-platform host
//    deps the flat closure carries that the vendored closure does NOT.
//
// Output (plugins/bundled):
//   <entry>...          lean sibling plugin package dirs (loader include names)
//   _hostdeps/<name>... the extra non-platform host deps (own nested node_modules)
// Each is copied from plugins/node_modules (the flat, resolution-consistent
// install) with nested node_modules preserved, so their own transitive deps
// resolve. `react`/`@deepseek-ai`/`@deepseek-ai/schemastery` are deliberately
// NOT duplicated -- the vendored fallback provides them.
import fs from "node:fs";
import path from "node:path";

const fileUrl = new URL(import.meta.url).pathname;
const ROOT = path.dirname(fileUrl.replace(/^\/([A-Za-z]:)/, "$1"));
const PROJ = path.resolve(ROOT, "..");
const FLAT = path.join(ROOT, "node_modules");
const OUT = path.join(ROOT, "bundled");
const DEPS = path.join(OUT, "_hostdeps");

// Embedded-lite scope (user decision): the VS Code embedded Node ABI cannot
// stably load native addons, so DROP the plugins whose server entry pulls a
// native ABI addon (ssh2, lightningcss). They would otherwise abort the host
// with an AggregateError and blank the panel. The remote-access plugin is
// removed on security grounds (its LAN/pairing + cloudflared tunnel are the
// only paths that would expose this loopback host to the network).
const ENTRY_EXCLUDE = new Set([
  "@linxin666/dsh-ssh",
  "@linxin666/dsh-client-ui-skin-center",
  // Remote access is removed on security grounds (user decision): the
  // remote-web-ui plugin is the surface that mounts LAN/pairing and drives the
  // cloudflared public tunnel, so it is dropped from the baked set — which also
  // stops the cloudflared hostdep from being shipped.
  "@linxin666/dsh-remote-web-ui",
  // The web-ui-all meta-aggregator cannot be embedded-lite'd: its cordis.patch
  // mounts the FULL roster (incl. native ssh/skin-center) and its manifest
  // depends on them. Its content is delivered by mounting the member plugins
  // individually instead.
  "@linxin666/dsh-web-ui-all"
]);
// Native-ABI / binary packages that must NOT be shipped (clean MODULE_NOT_FOUND
// is safer for embedded than an ABI crash; only pure-JS deps are kept).
const NATIVE_EXCLUDE = new Set(["ssh2", "cpu-features", "lightningcss"]);
// Host deps pulled ONLY through the removed remote-access plugin. cloudflared
// is the spawned tunnel binary that would map this loopback host onto a public
// trycloudflare URL — with remote-web-ui gone it has no consumer, so drop it to
// keep any remote-exposure surface out of the shipped bundle.
const HOSTDEP_EXCLUDE = new Set(["cloudflared"]);

function readNameRows(text) { const n = []; for (const mm of text.matchAll(/name\s*:\s*["']([^"']+)["']/g)) n.push(mm[1]); return n; }

// entry set = roots + web-ui-all bundle children (minus its @deepseek-ai rows)
const roots = ["@linxin666/dsh-web-ui-all", "dsh-recall-plugin", "dsh-client-auto-continue", "dsh-memory-evolve", "dsh-miraculous-standard", "@dsh-external/dsh-super-injector"];
const entries = new Set();
const q = [...roots];
while (q.length) {
  const n = q.shift(); if (entries.has(n)) continue; entries.add(n);
  const pd = path.join(FLAT, n); if (!fs.existsSync(pd)) continue;
  const pkg = JSON.parse(fs.readFileSync(path.join(pd, "package.json"), "utf8"));
  if (pkg.dsh?.bundle?.patch) { const pf = path.join(pd, pkg.dsh.bundle.patch); if (fs.existsSync(pf)) for (const c of readNameRows(fs.readFileSync(pf, "utf8"))) if (!c.startsWith("@deepseek-ai/")) q.push(c); }
}
console.log("entry packages:", [...entries].sort().join(", "));

// vendored closure names (the fallback healProfilesModuleFallback will link)
const V = path.join(PROJ, "vendor", "node_modules");
const closure = new Set();
const am = JSON.parse(fs.readFileSync(path.join(V, "@deepseek-ai", "dsh", "package.json"), "utf8"));
const cq = [{ dir: path.join(V, "@deepseek-ai", "dsh"), m: am }];
while (cq.length) {
  const { dir, m } = cq.shift();
  for (const dep of [...Object.keys(m.dependencies ?? {}), ...Object.keys(m.peerDependencies ?? {})]) {
    if (closure.has(dep)) continue;
    const sp = dep.split("/");
    const cand = path.join(dir, "node_modules", ...sp);
    const real = fs.existsSync(cand) ? cand : path.join(V, ...sp);
    if (!fs.existsSync(real) || !fs.statSync(real).isDirectory()) continue;
    closure.add(dep);
    try { cq.push({ dir: real, m: JSON.parse(fs.readFileSync(path.join(real, "package.json"), "utf8")) }); } catch { /* ignore */ }
  }
}

function mainEntry(dir, pkg) {
  const ex = pkg.exports;
  const dot = typeof ex === "string" ? ex : ex?.["."];
  const list = [typeof dot === "string" ? dot : dot?.import, pkg.main, pkg.module];
  for (const c of list) {
    if (typeof c !== "string" || c.includes(".d.ts") || c.includes("{")) continue;
    for (const cand of [path.join(dir, c), path.join(dir, c + ".js"), path.join(dir, c, "index.js"), path.join(dir, c, "index.mjs")])
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}
function bareImports(p) {
  let code; try { code = fs.readFileSync(p, "utf8"); } catch { return []; }
  const s = new Set();
  for (const pat of [/\bimport\b\s+(?:[^'"]*?from\s*)?['"]([^.'" ][^'"]*)['"]/g, /import\s*\(\s*['"]([^.'" ][^'"]*)['"]/g, /require\s*\(\s*['"]([^.'" ][^'"]*)['"]/g]) {
    pat.lastIndex = 0; let m; while ((m = pat.exec(code))) { const a = m[1].split("/"); if (!m[1].startsWith("${")) s.add(a[0].startsWith("@") ? a[0] + "/" + a[1] : a[0]); }
  }
  return [...s];
}
// walk host entry files (transitive) to discover non-platform deps to ship
const hostDeps = new Set();
const seenFiles = new Set();
const fq = [];
for (const n of entries) { const pd = path.join(FLAT, n); const pkg = JSON.parse(fs.readFileSync(path.join(pd, "package.json"), "utf8")); const e = mainEntry(pd, pkg); if (e) fq.push(e); }
while (fq.length) {
  const file = fq.shift(); if (seenFiles.has(file)) continue; seenFiles.add(file);
  for (const spec of bareImports(file)) {
    if (spec.startsWith("@deepseek-ai/") || spec === "node" || spec.startsWith("node:")) continue;
    if (closure.has(spec) || NATIVE_EXCLUDE.has(spec) || HOSTDEP_EXCLUDE.has(spec)) continue;
    if (!hostDeps.has(spec)) {
      hostDeps.add(spec);
      const d = path.join(FLAT, ...spec.split("/"));
      if (fs.existsSync(d) && fs.statSync(d).isDirectory()) { try { const pkg = JSON.parse(fs.readFileSync(path.join(d, "package.json"), "utf8")); const e = mainEntry(d, pkg); if (e) fq.push(e); } catch { /* ignore */ } }
    }
  }
}
console.log("extra host deps to ship:", hostDeps.size);
console.log("  " + [...hostDeps].sort().join(", "));

// materialize
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(DEPS, { recursive: true });
function strip(c) { const b = path.basename(c); return b !== ".bin"; }
let files = 0, bytes = 0;
function mk(n) { const src = path.join(FLAT, n); if (!fs.existsSync(src)) return false; const dest = path.join(OUT, ...n.split("/")); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.cpSync(src, dest, { recursive: true, filter: strip }); return true; }
for (const n of [...entries].sort()) { if (ENTRY_EXCLUDE.has(n)) { console.log("  EXCLUDED entry (native ABI):", n); continue; } if (mk(n)) { /* count */ const c = fs.readdirSync(path.join(OUT, ...n.split("/")), { recursive: true }).length; files += c; } else console.log("  MISSING entry dir:", n); }
for (const n of [...hostDeps].sort()) { if (HOSTDEP_EXCLUDE.has(n)) continue; const src = path.join(FLAT, n); if (!fs.existsSync(src)) { console.log("  MISSING hostdep:", n); continue; } const dest = path.join(DEPS, ...n.split("/")); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.cpSync(src, dest, { recursive: true, filter: strip }); files += fs.readdirSync(dest, { recursive: true }).length; }
for (const d of ["D:/PycharmProjects/Work/dsh-vscode/plugins/bundled", "D:/PycharmProjects/Work/dsh-vscode/plugins/bundled/_hostdeps"]) {
  if (fs.existsSync(d)) { const st = fs.statSync(d); bytes = st.size; }
}
console.log("OK. bundled dirs written to " + OUT);
console.log("(files counted approximately; verify by walk)");