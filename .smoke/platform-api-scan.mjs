// Cross-check every named import a bundled plugin takes from the platform
// (@deepseek-ai/*) against what the vendored tree actually exports.
//
// WHY THIS EXISTS. Bundled plugins are prebuilt elsewhere and simply dropped
// into plugins/bundled, so nothing in the build notices when the platform drops
// an export they rely on. The failure mode is brutal and misleading: cordis
// reports it as a failed loader entry naming the PLUGIN, while the real cause is
// a missing symbol in the PLATFORM — and because it happens during bootstrap it
// takes the whole host down, so the panel dies with an auth/connection error
// rather than anything about a plugin.
//
// Concretely: dsh-undo-plugin@0.1.0-rc.8 (built for 0.1.1) imports
// `resolveSessionPreset` from @deepseek-ai/dsh-agent-presets, which 0.1.5 no
// longer exports. Running this after any platform upgrade finds every such
// breakage in one pass instead of one boot failure per symbol.
//
// Usage: node .smoke/platform-api-scan.mjs [dir ...]   (default: plugins/bundled)
// Exit:  0 when every imported symbol still exists, 1 with a list otherwise.
import fs from "node:fs";
import path from "node:path";

const fileUrl = new URL(import.meta.url).pathname;
const ROOT = path.dirname(path.dirname(fileUrl.replace(/^\/([A-Za-z]:)/, "$1")));
const VENDOR = path.join(ROOT, "vendor", "node_modules");
const targets = process.argv.slice(2);
const scanRoots = targets.length ? targets : ["plugins/bundled"];

/** All exported binding names of a vendored package (lib/ entry + re-exports). */
function exportedNames(pkgName) {
  const dir = path.join(VENDOR, ...pkgName.split("/"));
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) return { missing: true, names: new Set() };
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")); } catch { return { missing: true, names: new Set() }; }
  // Union the exports of every candidate entry file. A symbol that survived an
  // upgrade appears somewhere in the package's entries; one that was REMOVED
  // appears nowhere, which is the failure this scan exists to catch.
  const dot = pkg.exports?.["."];
  const candidates = [
    typeof dot === "object" && dot !== null ? dot.import : undefined,
    typeof dot === "object" && dot !== null ? dot.default : undefined,
    typeof dot === "string" ? dot : undefined,
    pkg.module,
    pkg.main
  ].filter((x) => typeof x === "string");
  if (candidates.length === 0) candidates.push("lib/index.js");
  const files = candidates.map((rel) => path.join(dir, rel)).filter((f) => fs.existsSync(f));
  const names = new Set();
  for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
    // `export { a, b as c }`: the IMPORTABLE name is the alias when present
    // (`export { Schema as default }` exposes `default`, not `Schema`).
    for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const part of m[1].split(",")) {
        const seg = part.trim();
        if (!seg) continue;
        const asMatch = /^(\S+)\s+as\s+(\S+)$/.exec(seg);
        names.add(asMatch ? asMatch[2] : seg);
      }
    }
    for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    if (/\bexport\s+default\b/.test(text)) names.add("default");
    if (/export\s*\*/.test(text)) names.add("*");
  }
  return { missing: false, names };
}

/** Every file worth scanning under a root. */
function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (/\.(m?js|cjs)$/.test(e.name)) yield full;
  }
}

const problems = [];
const checked = [];
for (const root of scanRoots) {
  const abs = path.isAbsolute(root) ? root : path.join(ROOT, root);
  for (const file of walk(abs)) {
    const text = fs.readFileSync(file, "utf8");
    // import { a, b as c } from "@deepseek-ai/x"   /   import Def from "@deepseek-ai/x"
    // `[^;\n]*?` keeps the clause on ONE line: allowing newlines let a lazy
    // match span from an earlier relative import to a later platform one and
    // attribute the wrong symbols to it.
    for (const m of text.matchAll(/import\s+([^;\n]*?)\s+from\s+["'](@deepseek-ai\/[^"']+)["']/g)) {
      const clause = m[1];
      const spec = m[2];
      // Skip subpath imports like "@deepseek-ai/x/y" (different entry points).
      if (spec.split("/").length > 2) continue;
      const { missing, names } = exportedNames(spec);
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      if (missing) { problems.push(`${rel}: imports from ${spec} which is NOT INSTALLED`); continue; }
      const braced = /\{([^}]*)\}/.exec(clause);
      if (braced) {
        for (const part of braced[1].split(",")) {
          const seg = part.trim();
          if (!seg) continue;
          const original = seg.split(/\s+as\s+/)[0].trim();
          if (!original) continue;
          checked.push(`${rel} -> ${spec}:${original}`);
          if (!names.has(original) && !names.has("*")) {
            problems.push(`${rel}: ${spec} does NOT export '${original}'`);
          }
        }
      } else {
        const def = clause.trim();
        if (def && !/^\*/.test(def) && !names.has("default") && !names.has("*")) {
          problems.push(`${rel}: ${spec} has no default export (imported as '${def}')`);
        }
      }
    }
  }
}

console.log(`checked ${checked.length} named platform imports under ${scanRoots.join(", ")}`);
if (!problems.length) {
  console.log("RESULT: every imported platform symbol still exists.");
  process.exit(0);
}
console.log(`\nRESULT: ${problems.length} broken platform import(s):`);
for (const p of problems) console.log("  " + p);
process.exit(1);
