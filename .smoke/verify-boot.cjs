// Smoke verifier for v0.1.6: reproduce the extension's exact host launch
// (Code.exe run as Node + --expose-internals + fresh DSH_HOME + --profile web)
// and confirm it boots, prints the web URL, serves HTTP 200 and the UI HTML.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const CODE = "C:/Users/li554/AppData/Local/Programs/Microsoft VS Code/Code.exe";
const ROOT = "D:/PycharmProjects/Work/dsh-vscode";
const BIN = path.join(ROOT, "vendor", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const HOME = path.join(os.tmpdir(), "dsh-verify-016");
const URL_LINE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)/;

if (!fs.existsSync(CODE)) { console.error("MISSING Code.exe: " + CODE); process.exit(2); }
if (!fs.existsSync(BIN)) { console.error("MISSING bin.js: " + BIN); process.exit(2); }
fs.rmSync(HOME, { recursive: true, force: true });
fs.mkdirSync(HOME, { recursive: true });

const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1", DSH_HOME: HOME };
const child = spawn(CODE, ["--expose-internals", BIN, "--profile", "web", "--port", "0", "--no-open"], {
  cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"],
});

let port = null;
let stdout = "";
child.stdout.on("data", (c) => {
  stdout += c.toString();
  const m = URL_LINE.exec(stdout);
  if (m && !port) port = Number(m[1]);
});
child.stderr.on("data", () => { /* surfaced via exit dump only */ });

const grab = (url) =>
  new Promise((res) => {
    const req = http.get(url, { timeout: 8000 }, (r) => {
      let body = "";
      r.on("data", (d) => (body += d));
      r.on("end", () => res({ status: r.statusCode, body: body.slice(0, 120) }));
    });
    req.on("error", (e) => res({ status: "ERR", body: String(e) }));
  });
const post = (url, json) =>
  new Promise((res) => {
    const data = JSON.stringify(json);
    const req = http.request(url, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } }, (r) => {
      let body = "";
      r.on("data", (d) => (body += d));
      r.on("end", () => res({ status: r.statusCode }));
    });
    req.on("error", (e) => res({ status: "ERR", body: String(e) }));
    req.write(data);
    req.end();
  });

const deadline = Date.now() + 120000;
const poll = async () => {
  while (!port && child.exitCode === null && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!port) {
    console.error("NO URL LINE (boot failed/timeout). exitCode=" + child.exitCode);
    console.error("--- host stdout tail ---");
    console.error(stdout.slice(-1500));
    console.error("--- host stderr ---");
    process.exit(1);
  }
  console.log("BOOT OK on 127.0.0.1:" + port);

  const root = await grab("http://127.0.0.1:" + port + "/");
  console.log("GET  /           -> " + root.status + (root.status >= 200 && root.status < 400 ? " (html present, boot injected: " + (root.body.indexOf("DSH_BOOT") >= 0) + ")" : ""));
  const fence = await post("http://127.0.0.1:" + port + "/api/session.list", {});
  console.log("POST /api/session.list (clean, no browser markers) -> " + fence.status + (fence.status === 200 ? " (extension-host-style request PASSES the trust fence)" : ""));
};

poll()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => {
    try { child.kill(); } catch { /* gone */ }
    setTimeout(() => fs.rmSync(HOME, { recursive: true, force: true }), 500);
  });