import fs from "node:fs";
import path from "node:path";

const PROJ = "D:/PycharmProjects/Work/dsh-vscode";
const F = path.join(PROJ, "plugins", "node_modules");
const V = path.join(PROJ, "vendor", "node_modules");

// 1. vendored closure package names (what healProfilesModuleFallback links)
const appManifest = JSON.parse(fs.readFileSync(path.join(V, "@deepseek-ai", "dsh", "package.json"), "utf8"));
const closure = new Set();
const queue = [{ dir: path.join(V, "@deepseek-ai", "dsh"), m: appManifest }];
while (queue.length) {
  const { dir, m } = queue.shift();
  for (const dep of [...Object.keys(m.dependencies ?? {}), ...Object.keys(m.peerDependencies ?? {})]) {
    if (closure.has(dep)) continue;
    const parts = dep.split("/");
    const cand = path.join(dir, "node_modules", ...parts);
    const cand2 = path.join(V, ...parts);
    const real = fs.existsSync(cand) ? cand : cand2;
    if (!fs.existsSync(real) || !fs.statSync(real).isDirectory()) { continue; }
    closure.add(dep);
    try { queue.push({ dir: real, m: JSON.parse(fs.readFileSync(path.join(real, "package.json"), "utf8")) }); } catch { /* ignore */ }
  }
}
console.log("vendored closure package count:", closure.size);

// 2. all host entry packages (3 roots + web-ui-all bundle children)
function readNameRows(text) { const n=[]; for(const mm of text.matchAll(/name\s*:\s*["']([^"']+)["']/g)) n.push(mm[1]); return n; }
const roots = ["@linxin666/dsh-web-ui-all", "dsh-recall-plugin", "dsh-client-auto-continue"];
const entries = new Set();
const q = [...roots];
while (q.length) {
  const n = q.shift(); if (entries.has(n)) continue; entries.add(n);
  const pd = path.join(F, n); if (!fs.existsSync(pd)) continue;
  const pkg = JSON.parse(fs.readFileSync(path.join(pd, "package.json"), "utf8"));
  if (pkg.dsh?.bundle?.patch) { const pf = path.join(pd, pkg.dsh.bundle.patch); if (fs.existsSync(pf)) for (const c of readNameRows(fs.readFileSync(pf, "utf8"))) if (!c.startsWith("@deepseek-ai/")) q.push(c); }
}
console.log("host entry packages:", entries.size);

// 3. compute bare imports of each entry's host lib/index.js + recurse into non-closure packages
function mainEntry(dir, pkg) {
  for (const c of [typeof pkg.exports === "string" ? pkg.exports : (pkg.exports?.["."] && (typeof pkg.exports["."] === "string" ? pkg.exports["."] : pkg.exports["."].import)), pkg.main, pkg.module]) {
    if (typeof c !== "string" || c.includes(".d.ts")) continue;
    for (const cand of [path.join(dir, c), path.join(dir, c + ".js"), path.join(dir, c, "index.js"), path.join(dir, c, "index.mjs")]) if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}
function bareImports(p) {
  let code; try { code = fs.readFileSync(p, "utf8"); } catch { return []; }
  const s = new Set();
  for (const pat of [/\bimport\b\s+(?:[^'"]*?from\s*)?['"]([^.'" ][^'"]*)['"]/g, /import\s*\(\s*['"]([^.'" ][^'"]*)['"]/g, /require\s*\(\s*['"]([^.'" ][^'"]*)['"]/g]) {
    pat.lastIndex = 0; let m; while ((m = pat.exec(code))) { const sp = m[1].split("/"); s.add(sp[0].startsWith("@") ? sp[0] + "/" + sp[1] : sp[0]); }
  }
  return [...s];
}
const seenFiles = new Set();
const fileQueue = [];
for (const n of entries) { const pkg = JSON.parse(fs.readFileSync(path.join(F, n, "package.json"), "utf8")); const e = mainEntry(path.join(F, n), pkg); if (e) fileQueue.push(e); }
const neededNotInClosure = new Set();
const additionalNeeded = new Set(); // non-closure packages we must ship
while (fileQueue.length) {
  const file = fileQueue.shift();
  const key = file; if (seenFiles.has(key)) continue; seenFiles.add(key);
  for (const spec of bareImports(file)) {
    if (spec.startsWith("@deepseek-ai/") || spec === "node:" || spec.includes("node:")) { continue; } // platform provides via fallback
    if (closure.has(spec)) { continue; }
    additionalNeeded.add(spec);
    // resolve spec in flat and recurse its index
    const d = path.join(F, ...spec.split("/"));
    if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
      try { const pkg = JSON.parse(fs.readFileSync(path.join(d, "package.json"), "utf8")); const e = mainEntry(d, pkg); if (e) fileQueue.push(e); } catch { /* ignore */ }
    }
  }
}
console.log("additional non-platform, non-closure packages the host entries need:");
console.log([...additionalNeeded].sort().join(", "));
// which entry references them (for sanity)
for (const spec of [...additionalNeeded].sort()) {
  const who = [];
  for (const n of entries) {
    const d = path.join(F, n); if (!fs.existsSync(d)) continue;
    try { const pkg = JSON.parse(fs.readFileSync(path.join(d, "package.json"), "utf8")); const e = mainEntry(d, pkg); if (e && fs.existsSync(e) && fs.readFileSync(e, "utf8").includes("'" + spec + "'") ) who.push(n); } catch {}
  }
  console.log("  " + spec + "  <- " + who.join(", "));
}