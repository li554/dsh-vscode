const fs = require("fs");
const path = require("path");
const base = "plugins/node_modules";
const targets = [
  "@linxin666/dsh-client-ui-plugin-manager",
  "@linxin666/dsh-client-ui-git-graph",
  "@linxin666/dsh-client-ui-community-plugins",
  "@linxin666/dsh-ai-iconify-panel", // may not exist, guard
  "@mlgbnb/dsh-archive-manager",
  "dsh-better-sidebar"
];
for (const t of targets) {
  const pj = path.join(base, t, "package.json");
  if (!fs.existsSync(pj)) { console.log(t, "-> (no package.json)"); continue; }
  const pkg = JSON.parse(fs.readFileSync(pj, "utf8"));
  const client = pkg.exports?.["./client"];
  const cpath = client ? path.join(base, t, typeof client === "string" ? client : client.default) : null;
  if (!cpath || !fs.existsSync(cpath)) { console.log(t, "-> no client.js"); continue; }
  const s = fs.readFileSync(cpath, "utf8");
  const bare = [];
  for (const m of s.matchAll(/require\(\s*(["'])([^"']+)\1\s*\)/g)) {
    const id = m[2];
    if (!id.startsWith(".") && !id.startsWith("node:") && !id.startsWith(t)) bare.push(id);
  }
  console.log(t, "client.js", s.length, "B length, bare require:", [...new Set(bare)].slice(0,30).join(",") || "(none)");
}