import fs from "node:fs";
import path from "node:path";
const V = "D:/PycharmProjects/Work/dsh-vscode/vendor/node_modules";

function bareImports(p, seen) {
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return;
  let code; try { code = fs.readFileSync(p, "utf8"); } catch { return; }
  for (const pat of [
    /import\s+(?:[^'"]*?from\s*)?['"]([^.'" ][^'"]*)['"]/g,
    /import\s*\(\s*['"]([^.'" ][^'"]*)['"]/g,
    /require\s*\(\s*['"]([^.'" ][^'"]*)['"]/g,
    /from\s*['"]([^.'" ][^'"]*)['"]/g,
  ]) { pat.lastIndex = 0; let m; while ((m = pat.exec(code))) { const s = m[1].split("/")[0]; seen.add(s.startsWith("@") ? m[1].split("/").slice(0, 2).join("/") : s); } }
}

for (const n of ["@deepseek-ai/dsh-web-app", "@deepseek-ai/dsh-base", "@deepseek-ai/dsh"]) {
  const dir = path.join(V, n);
  const j = path.join(dir, "package.json");
  if (!fs.existsSync(j)) { console.log("MISSING " + n); continue; }
  const seen = new Set();
  for (const rel of ["lib/index.js", "lib/bin.js"]) { const p = path.join(dir, rel); if (fs.existsSync(p) && fs.statSync(p).isFile()) bareImports(p, seen); }
  // for dsh web-app also scan lib dir
  if (n === "@deepseek-ai/dsh-web-app" && fs.existsSync(path.join(dir, "lib"))) {
    for (const f of fs.readdirSync(path.join(dir, "lib"))) { if (f.endsWith(".js")) bareImports(path.join(dir, "lib", f), seen); }
  }
  console.log("=== " + n + " imports: " + [...seen].sort().join(", "));
}
console.log("bare schemastery at vendor/schemastery:", fs.existsSync(path.join(V, "schemastery")));
console.log("@deepseek-ai/schemastery exists:", fs.existsSync(path.join(V, "@deepseek-ai", "schemastery")));
// does the dsh bin set up a global bare-schemastery alias?
const dshBin = path.join(V, "@deepseek-ai", "dsh", "lib", "bin.js");
console.log("dsh bin.js size:", fs.statSync(dshBin).size);