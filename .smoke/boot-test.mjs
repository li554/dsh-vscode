// Headless boot harness for the self-contained baked plugins.
// Replicates src/extension.js startHost(): forks the vendored dsh bin against a
// fresh temp DSH_HOME, pre-writes the web profile with the baked bundles in the
// manifest, transplants plugins/bundled into <profile>/node_modules, waits for
// the bound-port line, then asserts `/` and a plugin `/plugins/<id>/client.js`
// serve 200 (a platform-shadow or resolution failure surfaces as 400/404 or a
// host-side crash). Requires: fetch (node>=18).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const fileUrl = new URL(import.meta.url).pathname;
const ROOT = path.dirname(fileUrl.replace(/^\/([A-Za-z]:)/, "$1"));
const PROJ = path.resolve(ROOT, "..");

const BIN = path.join(PROJ, "vendor", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const BUNDLED = path.join(PROJ, "plugins", "bundled");
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-boot-"));
const PROFILE = path.join(HOME, "profiles", "web");
const MODULES = path.join(PROFILE, "node_modules");
const MANIFEST = "dsh.profile.bundles";

// Self-contained entry plugins: only these package dirs ship; each resolves by
// name from <profile>/node_modules so the DSH loader mounts exactly what we
// deliver. We register every one INDIVIDUALLY as a bundle entry (never the
// web-ui-all GROUP, whose full roster references plugins we do not ship).
const entries = [
  "@linxin666/dsh-chat-recovery",
  "@linxin666/dsh-client-ui-aionui-panel",
  "@linxin666/dsh-client-ui-community-plugins",
  "@linxin666/dsh-client-ui-git-graph",
  "@linxin666/dsh-client-ui-market",
  "@linxin666/dsh-client-ui-plugin-manager",
  "@linxin666/dsh-client-ui-skill-explorer",
  "@linxin666/dsh-client-ui-task-board",
  "@linxin666/dsh-client-ui-web-ui-settings",
  "@linxin666/dsh-desktop-launcher",
  "@linxin666/dsh-doctor",
  "@linxin666/dsh-liangshen",
  "@linxin666/dsh-pet",
  "@linxin666/dsh-tool-describe-image",
  "@mlgbnb/dsh-archive-manager",
  "dsh-better-sidebar",
  "dsh-client-auto-continue",
  "dsh-memory-evolve",
  "dsh-recall-plugin",
  "dsh-miraculous-standard",
  "@dsh-external/dsh-super-injector"
];

// 1. transplant bundled entry packages + flatten _hostdeps into profile/node_modules.
fs.mkdirSync(MODULES, { recursive: true });
for (const entry of fs.readdirSync(BUNDLED)) {
  if (entry === "_hostdeps") continue;
  const src = path.join(BUNDLED, entry);
  if (!fs.statSync(src).isDirectory()) continue;
  if (entry.startsWith("@")) {
    for (const sub of fs.readdirSync(src)) {
      fs.cpSync(path.join(src, sub), path.join(MODULES, entry, sub), { recursive: true, force: true });
    }
  } else {
    fs.cpSync(src, path.join(MODULES, entry), { recursive: true, force: true });
  }
}
const HD = path.join(BUNDLED, "_hostdeps");
if (fs.existsSync(HD)) {
  for (const entry of fs.readdirSync(HD)) {
    const s = path.join(HD, entry);
    if (fs.statSync(s).isDirectory()) fs.cpSync(s, path.join(MODULES, entry), { recursive: true, force: true });
  }
}
// 2. profile manifest: default web template + the baked bundles
fs.mkdirSync(PROFILE, { recursive: true });
const manifest = {
  dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", ...entries] } }
};
fs.writeFileSync(path.join(PROFILE, "package.json"), JSON.stringify(manifest, null, 2) + "\n");

// 3. fork host exactly like startHost()
const child = spawn(process.execPath, ["--expose-internals", BIN, "--profile", "web", "--port", "0", "--no-open"], {
  cwd: PROJ,
  env: { ...process.env, DSH_HOME: HOME, SSH_CONNECTION: "127.0.0.1 1 127.0.0.1 1" },
  stdio: ["ignore", "pipe", "pipe"]
});
let out = "", err = "";
child.stdout.on("data", (d) => { out += d.toString(); });
child.stderr.on("data", (d) => { err += d.toString(); });

const PORT_RE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)/;

function tail(text, n = 4000) { return text.length > n ? "…" + text.slice(-n) : text; }

(async () => {
  const deadline = Date.now() + 120000;
  let port = null;
  while (Date.now() < deadline) {
    const m = PORT_RE.exec(out);
    if (m) { port = Number(m[1]); break; }
    if (child.exitCode !== null) {
      console.log("HOST EXITED early code=" + child.exitCode);
      const fails = [...err.matchAll(/failed to import loader entry ([^(]+) \(([^)]+)\): (Cannot find (?:module|package) '[^']+')/g)]
        .map((m) => `  ${m[1].trim()} (${m[2]}): ${m[3]}`);
      if (fails.length) console.log("--- failed entries (" + fails.length + ") ---\n" + fails.join("\n"));
      console.log("--- stderr tail ---\n" + tail(err));
      console.log("--- stdout tail ---\n" + tail(out));
      process.exit(2);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!port) {
    console.log("TIMEOUT waiting for host port.");
    console.log("--- stdout tail ---\n" + tail(out, 8000));
    console.log("--- stderr tail ---\n" + tail(err, 8000));
    child.kill();
    process.exit(3);
  }
  console.log("HOST READY on 127.0.0.1:" + port);

  const checks = ["/", ...entries.map((n) => `/plugins/${n}/client.js`)];
  let pass = 0;
  for (const p of checks) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}${p}`, { headers: { accept: "*/*" } });
      const ok = res.status === 200;
      console.log((ok ? "  OK  " : "  WARN") + ` GET ${p} -> ${res.status} (${res.headers.get("content-type") || ""})`);
      if (ok) pass++;
    } catch (e) {
      console.log("  ERR  GET " + p + " -> " + String(e.message));
    }
  }
  console.log("RESULT: " + pass + "/" + checks.length + " routes served 200");
  const errLines = err.split("\n").filter((l) => l.includes("Error") || l.includes("Cannot find") || l.includes("MODULE_NOT_FOUND") || l.includes("resolve"));
  if (errLines.length) {
    console.log("--- resolve/crash stderr lines ---");
    console.log(tail(errLines.join("\n"), 4000));
  }
  child.kill();
  process.exit(pass === checks.length ? 0 : 4);
})();