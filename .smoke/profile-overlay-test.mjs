// Verifies the dsh.modlensFamilies -> `--patch` overlay path end to end.
//
// Three things have to hold, and each has failed in some tool at some point:
//   1. the extension materializes the setting into a valid overlay file;
//   2. dsh actually COMPOSES that overlay onto the profile, reaching the modlens
//      row's config (proved with --dump-config, not by assuming the flag works);
//   3. the user's own <profile>/cordis.patch.yml is never rewritten.
//
// Usage: node .smoke/profile-overlay-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Module from "node:module";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const BUNDLED = path.join(ROOT, "plugins", "bundled");
const BIN = path.join(ROOT, "vendor", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");

/** What the user configures: EXTRAS only, aliases their gateway hides models behind. */
const FAMILIES = ["code_instuct", "code_think", "weird:prefix", '"quoted"'];
/** What must end up in the overlay: the extras AND modlens' built-in three. */
const EXPECTED_FAMILIES = ["deepseek", "glm", "mimo", ...FAMILIES];

let failures = 0;
const check = (label, ok, detail = "") => {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? "  " + detail : ""}`);
};

// ---------------------------------------------------------------- fixture home
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-overlay-test-"));
const HOME = path.join(TMP, "dsh-home");
const PROFILE = path.join(HOME, "profiles", "web");
const MODULES = path.join(PROFILE, "node_modules");
fs.mkdirSync(MODULES, { recursive: true });

const entries = (() => {
  const src = fs.readFileSync(path.join(ROOT, "src", "extension.js"), "utf8");
  return [.../const BUNDLED_PLUGINS = \[([\s\S]*?)\];/.exec(src)[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
})();
for (const entry of fs.readdirSync(BUNDLED)) {
  if (entry === "_hostdeps") continue;
  const src = path.join(BUNDLED, entry);
  if (!fs.statSync(src).isDirectory()) continue;
  if (entry.startsWith("@")) {
    for (const sub of fs.readdirSync(src)) fs.cpSync(path.join(src, sub), path.join(MODULES, entry, sub), { recursive: true, force: true });
  } else {
    fs.cpSync(src, path.join(MODULES, entry), { recursive: true, force: true });
  }
}
for (const entry of fs.readdirSync(path.join(BUNDLED, "_hostdeps"))) {
  const s = path.join(BUNDLED, "_hostdeps", entry);
  if (fs.statSync(s).isDirectory()) fs.cpSync(s, path.join(MODULES, entry), { recursive: true, force: true });
}
fs.writeFileSync(path.join(PROFILE, "package.json"), JSON.stringify({
  dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", ...entries] } }
}, null, 2) + "\n");
// The user's own patch file, which must survive untouched.
const USER_PATCH = "# my own notes\n- id: something-else\n  disabled: true\n";
fs.writeFileSync(path.join(PROFILE, "cordis.patch.yml"), USER_PATCH);
fs.writeFileSync(path.join(HOME, "settings.yaml"), "locale:\n  preference: zh\n");

// ------------------------------------------------------------------- the stub
const disposable = { dispose() {} };
const settings = { port: 37796, cwd: ROOT, dshHome: HOME, openOnStartup: false, enableBakedPlugins: true, modlensFamilies: FAMILIES };
const vscodeStub = {
  window: {
    createOutputChannel: (name) => ({ name, appendLine: (l) => process.stdout.write(`[${name}] ${l}\n`), show() {} }),
    registerWebviewViewProvider: () => disposable,
    showTextDocument: () => Promise.resolve()
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: ROOT } }],
    getConfiguration: (s) => ({ get: (k) => (s === "dsh" ? settings[k] : undefined) }),
    openTextDocument: () => Promise.resolve({}),
    onDidChangeConfiguration: () => disposable
  },
  commands: { registerCommand: () => disposable, executeCommand: () => Promise.resolve() },
  env: { openExternal: () => Promise.resolve(true) },
  Uri: { parse: (s) => ({ toString: () => s }) }
};
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "vscode") return vscodeStub;
  return originalLoad.call(this, request, ...rest);
};

const ext = require(path.join(ROOT, "src", "extension.js"));

(async () => {
  console.log("driving the real activate() with dsh.modlensFamilies set ...");
  await ext.activate({
    subscriptions: [],
    extension: { packageJSON: { version: "0.0.0-overlay-test" } },
    extensionPath: ROOT,
    globalStorageUri: { fsPath: TMP }
  });

  const overlay = path.join(HOME, ".dsh-vscode-profile-patch.yml");
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && !fs.existsSync(overlay)) await new Promise((r) => setTimeout(r, 200));

  console.log("\n1. the extension materialized the setting");
  check("overlay file written", fs.existsSync(overlay), overlay);
  const text = fs.existsSync(overlay) ? fs.readFileSync(overlay, "utf8") : "";
  check("targets the modlens row", /^- id: modlens$/m.test(text), JSON.stringify(text.slice(0, 120)));
  check("declares a families list", /^\s{4}families:$/m.test(text));
  for (const family of EXPECTED_FAMILIES) {
    // The value must survive YAML round-tripping even when it contains `:` or quotes.
    check(`family present: ${family}`, text.includes(`"${family.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`));
  }
  // The setting is additive: a list emitted without the built-ins would REPLACE
  // them (modlens resolves `config.families || [defaults]`), silently dropping the
  // DeepSeek/GLM routes a user already had working.
  for (const builtin of ["deepseek", "glm", "mimo"]) {
    check(`built-in family ${builtin} kept`, text.includes(`"${builtin}"`));
  }

  console.log("\n3. the user's own patch file is untouched");
  check("cordis.patch.yml unchanged", fs.readFileSync(path.join(PROFILE, "cordis.patch.yml"), "utf8") === USER_PATCH);

  console.log("\n4. the diagnostic log is on disk with a session header");
  const logPath = path.join(TMP, "dsh-vscode.log");
  check("log file written", fs.existsSync(logPath), logPath);
  const logText = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
  check("header records the build", /=== dsh-vscode \S+ \| \d{4}-/.test(logText));
  check("header records the resolved DSH_HOME", logText.includes(HOME), "DSH_HOME missing from the header");
  check("header records the port and plugin switch", /dsh\.port: \d+ \| baked plugins: true/.test(logText));

  await ext.deactivate();

  console.log("\n2. dsh composes the overlay onto the profile");
  const dumpWith = (extra) => {
    const r = spawnSync(process.execPath, ["--expose-internals", BIN, "--profile", "web", ...extra, "--dump-config"], {
      cwd: ROOT,
      env: { ...process.env, DSH_HOME: HOME, SSH_CONNECTION: "127.0.0.1 1 127.0.0.1 1" },
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    });
    return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
  };
  const dump = dumpWith(["--patch", overlay]);
  const without = dumpWith([]);
  const out = dump.out;
  check("--dump-config succeeded", dump.status === 0, `exit ${dump.status}: ${out.slice(-300)}`);
  for (const family of ["deepseek", "code_instuct", "code_think"]) {
    check(`composed config carries ${family}`, out.includes(family), "not found in --dump-config output");
  }
  check("modlens row still present", out.includes("modlens"));

  // The invariant that matters most and that this test originally missed: an
  // overlay that names one row must not disturb any other. A patch list row with
  // a bare `id` could have been read as a top-level entry and re-composed the tree,
  // which would unmount every other bundled plugin while this test still passed.
  const rowNames = (text) => new Set([...text.matchAll(/name:\s*'?([@a-z0-9._/-]+)'?/gi)].map((m) => m[1]));
  const withRows = rowNames(out);
  const withoutRows = rowNames(without.out);
  check("the overlay adds no rows", withRows.size === withoutRows.size, `${withoutRows.size} -> ${withRows.size}`);
  const lost = [...withoutRows].filter((n) => !withRows.has(n));
  check("the overlay drops no rows", lost.length === 0, "missing: " + lost.slice(0, 8).join(", "));
  for (const plugin of ["@canglongcl/dsh-web-review", "@liustack/modlens", "dsh-undo-plugin", "dsh-client-auto-continue"]) {
    check(`${plugin} still mounted`, out.includes(plugin));
  }

  console.log(`\nRESULT: ${failures === 0 ? "PASS" : `FAIL (${failures} check(s))`}`);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
  process.exit(failures === 0 ? 0 : 1);
})();
