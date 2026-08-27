// Re-materialize the baked ecosystem plugins as SELF-CONTAINED units.
//
// The DSH web client resolves plugin imports through an in-memory module
// graph (dsh-client-modules): every package the profile loader includes as an
// entry and that declares `dsh.client.platform:"web"` serves a PRE-BUILT
// `./client.js` over /plugins/<id>/client.js. Import specifiers for react and
// @deepseek-ai/* are satisfied by the shared base/web-app graph rows — NOT by
// a physical node_modules. So the runtime payload is just the loader-entry
// package set (sibling package dirs each with their built lib + patch), and
// shared/vendor discipline is: NEVER duplicate react / @deepseek-ai /
// schemastery. Any package that additionally needs a physical host-side
// dependency (dsh-ssh -> ssh2, etc.) must carry that dep in its OWN nested
// node_modules — discovered by running the real host boot; this script only
// materializes the lean sibling root set (no nested node_modules).
//
// Source:  plugins/node_modules   (flat npm-hoisted install of all packages)
// Output:  plugins/bundled/       (sibling loader-entry package dirs)
import fs from "node:fs";
import path from "node:path";

const fileUrl = new URL(import.meta.url).pathname;
const ROOT = path.dirname(fileUrl.replace(/^\/([A-Za-z]:)/, "$1"));
const PROJ = path.resolve(ROOT, "..");
const FLAT = path.join(PROJ, "plugins", "node_modules");
const OUT  = path.join(PROJ, "plugins", "bundled");

// yarn-parse the initial seed roots' patch to gather children, then recurse
function readNameRows(text) {
  const names = [];
  for (const m of text.matchAll(/name\s*:\s*["']([^"']+)["']/g)) names.push(m[1]);
  return names;
}

// manual mini-parse of the roots' patch files to seed children (avoids a yaml dep here)
const roots = ["@linxin666/dsh-web-ui-all", "dsh-client-auto-continue", "dsh-memory-evolve", "dsh-recall-plugin", "dsh-miraculous-standard", "@dsh-external/dsh-super-injector"];
const seen = new Set();
const queue = [...roots];
while (queue.length) {
  const name = queue.shift();
  if (seen.has(name)) continue;
  seen.add(name);
  const dir = path.join(FLAT, name);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  const rel = pkg.dsh?.bundle?.patch;
  if (!rel) continue;
  const file = path.join(dir, rel);
  if (!fs.existsSync(file)) continue;
  for (const child of readNameRows(fs.readFileSync(file, "utf8"))) {
    if (child.startsWith("@deepseek-ai/")) continue;           // platform graph provides these
    if (!seen.has(child)) queue.push(child);
  }
}
const ENTRIES = [...seen].sort();
console.log("self-contained entry packages:", ENTRIES.length);
console.log(ENTRIES.join(", "));

// materialize each entry as a lean sibling package dir (strip any nested node_modules)
fs.rmSync(OUT, { recursive: true, force: true });
let files = 0, bytes = 0;
for (const name of ENTRIES) {
  const src = path.join(FLAT, name);
  const dest = path.join(OUT, ...name.split("/"));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // recursive copy stripping node_modules; cpSync(follows real dirs, copies
  // symlinks) is used because the flat tree symlinks a few packages.
  const filter = (s) => {
    const b = path.basename(s);
    return b !== "node_modules" && b !== ".bin";
  };
  fs.cpSync(src, dest, { recursive: true, filter });
  const count = (p) => { let c = 0; for (const e of fs.readdirSync(p, { withFileTypes: true })) { if (e.isDirectory()) c += count(path.join(p, e.name)); else c++; } return c; };
  files += count(dest);
  bytes += fs.statSync(dest).size;
}
console.log("OK entry files=" + files + " bytes=" + Math.round(bytes / (1024 * 1024)) + "MB");
console.log("OUT:", OUT);