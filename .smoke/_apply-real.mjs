// Manual diagnostics: materialize dsh-undo into the REAL web profile and boot a
// host against the real DSH_HOME on a spare port, capturing full stderr so we can
// see the actual "rollback undo: refusing prompt ... snapshot failed: <reason>".
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const EXT = "C:\\Users\\li554\\AppData\\Roaming\\Code\\User\\globalStorage\\your-publisher-id.dsh-vscode";
const HOME = path.join(EXT, "dsh-home");
const PROFILE = path.join(HOME, "profiles", "web");
const MANIFEST = path.join(PROFILE, "package.json");
const PORT = 38991;

const BASE_BUNDLES = ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"];
const BUNDLED_PLUGINS = [
  "dsh-reasoning-effort", "@linxin666/dsh-chat-recovery", "@linxin666/dsh-client-ui-aionui-panel",
  "@linxin666/dsh-client-ui-community-plugins", "@linxin666/dsh-client-ui-git-graph", "@linxin666/dsh-client-ui-market",
  "@linxin666/dsh-client-ui-plugin-manager", "@linxin666/dsh-client-ui-skill-explorer", "@linxin666/dsh-client-ui-task-board",
  "@linxin666/dsh-client-ui-web-ui-settings", "@linxin666/dsh-desktop-launcher", "@linxin666/dsh-doctor",
  "@linxin666/dsh-liangshen", "@linxin666/dsh-pet", "@linxin666/dsh-tool-describe-image",
  "@mlgbnb/dsh-archive-manager", "@canglongcl/dsh-web-review", "@dsh-vscode/p2h-bridge",
  "@huanlin/dsh-plugin-better-sidebar-plugin-office", "dsh-auto-compact", "dsh-better-sidebar",
  "dsh-client-auto-continue", "dsh-zh-kit", "dsh-file-review", "dsh-free-search",
  "dsh-miraculous-standard", "dsh-memory-evolve", "dsh-undo-plugin", "@dsh-external/dsh-super-injector",
];
const RETIRED_PLUGINS = ["@linxin666/dsh-remote-web-ui", "dsh-easyrewrite", "dsh-mnemon", "@dsh-external/dsh-diff-review", "dsh-recall-plugin", "@anionex/dsh-turn-rewind"];

// ---- transplant: copy bundled @dsh-undo/* + dsh-undo-plugin into profile node_modules ----
function transplant(profileDir) {
  const srcRoot = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "plugins", "bundled");
  const modules = path.join(profileDir, "node_modules");
  const done = new Set();
  const copyReal = (srcEntry, dst) => {
    const st = fs.lstatSync(srcEntry);
    fs.rmSync(dst, { recursive: true, force: true });
    if (st.isSymbolicLink()) { fs.cpSync(fs.realpathSync(srcEntry), dst, { recursive: true, force: true }); }
    else fs.cpSync(srcEntry, dst, { recursive: true, force: true });
  };
  const copyScoped = (scopeDir, scopeName) => {
    const dstScope = path.join(modules, scopeName);
    for (const sub of fs.readdirSync(scopeDir)) { copyReal(path.join(scopeDir, sub), path.join(dstScope, sub)); done.add(sub); }
  };
  for (const entry of fs.readdirSync(srcRoot)) {
    if (done.has(entry)) continue;
    if (entry.startsWith("@")) { copyScoped(path.join(srcRoot, entry), entry); }
    else if (BUNDLED_PLUGINS.includes(entry)) { copyReal(path.join(srcRoot, entry), path.join(modules, entry)); }
  }
  // host deps flatten: zod + any runtime deps of @dsh-undo that aren't vendored
  for (const dep of ["zod"]) {
    const src = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "vendor", "node_modules", dep);
    if (fs.existsSync(src)) copyReal(src, path.join(modules, dep));
  }
}

// ---- sync manifest ----
function sync(profileDir) {
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(path.join(profileDir, "package.json"), "utf8")); } catch { manifest = null; }
  const bundles = manifest?.dsh?.profile?.bundles ?? [];
  const changed = [
    ...BASE_BUNDLES,
    ...bundles.filter((b) => !BASE_BUNDLES.includes(b) && !BUNDLED_PLUGINS.includes(b) && !RETIRED_PLUGINS.includes(b)),
  ];
  for (const name of RETIRED_PLUGINS) {
    const i = changed.indexOf(name); if (i >= 0) changed.splice(i, 1);
    fs.rmSync(path.join(profileDir, "node_modules", ...name.split("/")), { recursive: true, force: true });
  }
  for (const name of BUNDLED_PLUGINS) if (!changed.includes(name)) changed.push(name);
  const next = manifest ?? {};
  next.dsh = { ...(next.dsh ?? {}), profile: { ...(next.dsh?.profile ?? {}), bundles: changed } };
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(profileDir, "package.json"), JSON.stringify(next, null, 2) + "\n");
  transplant(profileDir);
  console.log("manifest bundles now contain dsh-undo-plugin: " + changed.includes("dsh-undo-plugin"));
  console.log("manifest bundles still have turn-rewind: " + changed.includes("@anionex/dsh-turn-rewind"));
  console.log("transplanted @dsh-undo  : " + fs.existsSync(path.join(profileDir, "node_modules", "@dsh-undo")));
  console.log("transplanted dsh-undo-plugin: " + fs.existsSync(path.join(profileDir, "node_modules", "dsh-undo-plugin")));
}

// ---- boot host & capture stderr ----
function boot() {
  const hostBin = "C:\\Users\\li554\\.vscode\\extensions\\your-publisher-id.dsh-vscode-0.2.53\\vendor\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js";
  if (!fs.existsSync(hostBin)) { console.log("0.2.53 host bin missing: " + hostBin); process.exit(2); }
  const child = spawn("node", ["--expose-internals", hostBin, "--profile", "web", "--port", String(PORT), "--no-open"], {
    cwd: path.dirname(hostBin), env: { ...process.env, DSH_HOME: HOME }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "", err = "";
  child.stdout.on("data", (c) => (out += c));
  child.stderr.on("data", (c) => (err += c));
  const ready = new Promise((res) => {
    const t = setInterval(async () => {
      try { const r = await fetch("http://127.0.0.1:" + PORT + "/status"); if (r.ok) { clearInterval(t); res(); } } catch {}
    }, 600);
    setTimeout(() => { clearInterval(t); res(); }, 45000);
  });
  ready.then(async () => {
    console.log("HOST READY port " + PORT);
    try {
      const html = await (await fetch("http://127.0.0.1:" + PORT + "/", { headers: { accept: "*/*" } })).text();
      const undo = html.match(/"id":"@dsh-undo\/[^"]+"/g) || [];
      console.log("injected @dsh-undo client modules: " + undo.length); undo.forEach((s) => console.log("  " + s));
    } catch (e) { console.log("inject-scan ERR " + String(e.message)); }
    console.log("--- stderr (first 4000 chars) ---");
    console.log(err.slice(0, 4000) || "(no stderr)");
    child.kill(); process.exit(0);
  });
}

fs.mkdirSync(PROFILE, { recursive: true });
sync(PROFILE);
boot();