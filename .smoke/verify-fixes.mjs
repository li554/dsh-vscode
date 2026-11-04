// Verification for the explore.74 round of fixes:
//   1. clipboard shim is served with the SPA entry (GET / contains the shim)
//   2. POST /webview-preview-sessions returns 201 when the request carries a
//      SAME-ORIGIN Origin (what the extension proxy now forwards), and 403
//      when Origin is absent (what the proxy used to strip — the bug).
// Boots the vendored host against a scratch DSH_HOME exactly like boot-test.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const fileUrl = new URL(import.meta.url).pathname;
const ROOT = path.dirname(fileUrl.replace(/^\/([A-Za-z]:)/, "$1"));
const PROJ = path.resolve(ROOT, "..");

const BIN = path.join(PROJ, "vendor", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const BUNDLED = path.join(PROJ, "plugins", "bundled");
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-verify-"));
const PROFILE = path.join(HOME, "profiles", "web");
const MODULES = path.join(PROFILE, "node_modules");

function readBundledPlugins() {
  const src = fs.readFileSync(path.join(PROJ, "src", "extension.js"), "utf8");
  const m = /const BUNDLED_PLUGINS = \[([\s\S]*?)\];/.exec(src);
  if (!m) throw new Error("BUNDLED_PLUGINS not found in src/extension.js");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
const entries = readBundledPlugins();

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
fs.mkdirSync(PROFILE, { recursive: true });
const manifest = {
  dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", ...entries] } }
};
fs.writeFileSync(path.join(PROFILE, "package.json"), JSON.stringify(manifest, null, 2) + "\n");

const overlay = path.join(HOME, ".dsh-vscode-profile-patch.yml");
fs.writeFileSync(overlay, [
  "# dsh-vscode embedded host (verify mirror)",
  "- id: directory-picker",
  "  disabled: true",
  "- insert:",
  "    - id: directory-picker-browse",
  "      name: '@deepseek-ai/dsh-host-directory-picker-browse'",
  "    - id: ui-directory-picker-browse",
  "      name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'"
].join("\n") + "\n");
const child = spawn(process.execPath, ["--expose-internals", BIN, "--profile", "web", "--patch", overlay, "--port", "0", "--no-open"], {
  cwd: PROJ,
  env: { ...process.env, DSH_HOME: HOME },
  stdio: ["ignore", "pipe", "pipe"]
});
let out = "", err = "";
child.stdout.on("data", (d) => { out += d.toString(); });
child.stderr.on("data", (d) => { err += d.toString(); });

const PORT_RE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/(?:\?token=([A-Za-z0-9_-]+))?/;
function tail(text, n = 4000) { return text.length > n ? "…" + text.slice(-n) : text; }

async function authCookie(base, token) {
  if (!token) return "";
  const res = await fetch(`${base}/?token=${encodeURIComponent(token)}`, { redirect: "manual", headers: { accept: "*/*" } });
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie")];
  const jar = (raw || []).filter(Boolean).map((c) => String(c).split(";")[0]).join("; ");
  return jar;
}

(async () => {
  const deadline = Date.now() + 120000;
  let port = null, token = "";
  while (Date.now() < deadline) {
    const m = PORT_RE.exec(out);
    if (m) { port = Number(m[1]); token = m[2] ?? ""; break; }
    if (child.exitCode !== null) {
      console.log("HOST EXITED early code=" + child.exitCode);
      console.log("--- stderr tail ---\n" + tail(err));
      process.exit(2);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!port) {
    console.log("TIMEOUT waiting for host port.\n--- stdout tail ---\n" + tail(out, 8000) + "\n--- stderr tail ---\n" + tail(err, 8000));
    child.kill();
    process.exit(3);
  }
  console.log("HOST READY on 127.0.0.1:" + port + (token ? " (launch token present)" : " (no token)"));

  const base = `http://127.0.0.1:${port}`;
  const cookie = await authCookie(base, token);
  const headers = { accept: "*/*", ...(cookie ? { cookie } : {}) };
  let pass = 0, checks = 0;

  // 1. clipboard shim served with the SPA entry
  const index = await fetch(base + "/", { headers, redirect: "manual" });
  const html = await index.text();
  checks++;
  const hasShim = html.includes("dsh-vscode: VS Code webviews block the async Clipboard API");
  if (hasShim) pass++;
  console.log((hasShim ? "  OK  " : "  FAIL") + ` GET / -> ${index.status}, clipboard shim present=${hasShim}`);

  // 2. same-origin Origin -> 201 (the fix); no Origin -> 403 (the old bug)
  const body = JSON.stringify({ target: "http://example.com" });
  for (const [label, extra] of [
    ["no Origin (should be 403)", {}],
    ["same-origin Origin (should be 201)", { origin: base }]
  ]) {
    checks++;
    const res = await fetch(base + "/webview-preview-sessions", {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        "x-dsh-web-review-client": "1",
        ...extra
      },
      body
    });
    const payload = await res.text().catch(() => "");
    const expected = extra.origin ? 201 : 403;
    const ok = res.status === expected;
    if (ok) pass++;
    console.log(`  ${ok ? "OK  " : "FAIL"} POST /webview-preview-sessions ${label} -> ${res.status} (expected ${expected})${res.status === 201 ? " session created" : ""}${payload.length > 120 ? "" : " " + payload}`);
  }

  console.log("RESULT: " + pass + "/" + checks + " checks passed");
  const errLines = err.split("\n").filter((l) => l.includes("Error") || l.includes("Cannot find") || l.includes("MODULE_NOT_FOUND"));
  if (errLines.length) console.log("--- stderr Error lines ---\n" + tail(errLines.join("\n"), 4000));
  child.kill();
  process.exit(pass === checks ? 0 : 4);
})();
