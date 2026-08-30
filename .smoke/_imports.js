const fs = require("fs");
const files = ["client.js", "index.js", "typert.host.js", "remote.js"];
for (const f of files) {
  const t = fs.readFileSync(`d:/PycharmProjects/Work/dsh-vscode/plugins/bundled/dsh-file-review/lib/${f}`, "utf8");
  const imports = [...t.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  console.log(f + ":\n  " + [...new Set(imports)].join("\n  "));
}
