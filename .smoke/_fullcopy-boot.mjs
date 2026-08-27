import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "D:/PycharmProjects/Work/dsh-vscode/.smoke";
const PROJ = "D:/PycharmProjects/Work/dsh-vscode";
const BIN = path.join(PROJ, "vendor", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const FLAT = path.join(PROJ, "plugins", "node_modules");
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-full-"));
const PROFILE = path.join(HOME, "profiles", "web");
const MODULES = path.join(PROFILE, "node_modules");
const extraBundles = ["@linxin666/dsh-web-ui-all", "dsh-recall-plugin", "dsh-client-auto-continue"];

fs.mkdirSync(MODULES, { recursive: true });
console.log("copying full flat tree into profile...");
fs.cpSync(FLAT, MODULES, { recursive: true, filter: (s) => path.basename(s) !== ".bin" });
console.log("flat tree copied");

fs.mkdirSync(PROFILE, { recursive: true });
const manifest = { dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", ...extraBundles] } } };
fs.writeFileSync(path.join(PROFILE, "package.json"), JSON.stringify(manifest, null, 2) + "\n");

const child = spawn(process.execPath, ["--expose-internals", BIN, "--profile", "web", "--port", "0", "--no-open"], {
  cwd: PROJ,
  env: { ...process.env, DSH_HOME: HOME, SSH_CONNECTION: "127.0.0.1 1 127.0.0.1 1" },
  stdio: ["ignore", "pipe", "pipe"]
});
let out = "", err = "";
child.stdout.on("data", (d) => { out += d.toString(); });
child.stderr.on("data", (d) => { err += d.toString(); });
const PORT_RE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)/;
const tail = (t, n = 5000) => t.length > n ? "…" + t.slice(-n) : t;

(async () => {
  const deadline = Date.now() + 180000;
  let port = null;
  while (Date.now() < deadline) {
    const m = PORT_RE.exec(out);
    if (m) { port = Number(m[1]); break; }
    if (child.exitCode !== null) {
      console.log("HOST EXITED early code=" + child.exitCode);
      console.log("--- stderr tail ---\n" + tail(err));
      process.exit(2);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!port) { console.log("TIMEOUT.\n--- stderr tail ---\n" + tail(err, 8000)); child.kill(); process.exit(3); }
  console.log("HOST READY on 127.0.0.1:" + port);
  const checks = ["/", "/plugins/@linxin666/dsh-web-ui-all/client.js", "/plugins/dsh-recall-plugin/client.js"];
  let pass = 0;
  for (const p of checks) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}${p}`, { headers: { accept: "*/*" } });
      const ok = res.status === 200;
      console.log((ok ? "  OK  " : "  WARN") + ` GET ${p} -> ${res.status}`);
      if (ok) pass++;
    } catch (e) { console.log("  ERR  GET " + p + " -> " + String(e.message)); }
  }
  console.log("RESULT: " + pass + "/" + checks.length);
  console.log("=== FULL STDERR ===");
  console.log(tail(err, 20000));
  try { child.kill(); } catch {}
  process.exit(pass === checks.length ? 0 : 4);
})();