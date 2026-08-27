const fs = require("fs");
const path = require("path");
const base = "plugins/node_modules";
const yaml = require("yaml"); // is yaml available? if not we'll parse name rows by regex

function hasYaml() { try { require.resolve("yaml"); return true; } catch { return false; } }
const Y = hasYaml();

function patchNames(pkgDir) {
  // read package.json to locate dsh.bundle.patch
  let dsh;
  try {
    const p = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
    dsh = p.dsh?.bundle?.patch;
  } catch { return []; }
  if (!dsh) return [];
  const file = path.join(pkgDir, dsh);
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  const names = [];
  if (Y) {
    try {
      const rows = yaml.parse(text);
      for (const row of rows || []) {
        if (row && Array.isArray(row.insert)) for (const ins of row.insert) if (ins?.name) names.push(ins.name);
      }
      return names;
    } catch { /* fall through to regex */ }
  }
  // regex fallback: capture name: '...' or name: "..." inside insert blocks
  for (const m of text.matchAll(/name\s*:\s*["']([^"']+)["']/g)) names.push(m[1]);
  return names;
}

const roots = ["@linxin666/dsh-web-ui-all", "dsh-recall-plugin", "dsh-client-auto-continue"];
const seen = new Set();
const queue = [...roots];
const noClient = [];
const errors = [];
while (queue.length) {
  const name = queue.shift();
  if (seen.has(name)) continue;
  seen.add(name);
  const dir = path.join(base, name);
  if (!fs.existsSync(path.join(dir, "package.json"))) { errors.push(`${name}: no package.json`); continue; }
  // check client export exists
  const p = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  if (p.dsh?.client?.platform === "web" && !p.exports?.["./client"]) noClient.push(name);
  for (const child of patchNames(dir)) {
    if (child.startsWith("@deepseek-ai/")) { console.log("  (platform client) " + child); continue; }
    if (!seen.has(child)) queue.push(child);
  }
}
console.log("=== entry closure count:", seen.size, "===");
console.log([...seen].join(", "));
console.log("=== @deepseek-ai child refs skipped listed above ===");
console.log("=== web client packages WITHOUT ./client export:", noClient.length ? noClient.join(", ") : "(none) ===");
console.log("=== errors:", errors.length ? errors.join(" | ") : "(none) ===");
console.log("yaml available:", Y);