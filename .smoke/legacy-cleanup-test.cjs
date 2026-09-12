// Regression test for pruneRetiredArtifacts() in src/extension.js.
//
// It builds a DSH_HOME that reproduces every leftover class observed on a real
// repeatedly-upgraded home, runs the REAL activate() through a stubbed `vscode`
// module, and asserts two things at once:
//   1. the leftovers are gone (stale module links, stale profile dependencies,
//      empty scope dirs, *.pnpm-old / .ignored_* / cordis.patch.yml.bak-*), and
//   2. everything that makes a home worth keeping is UNTOUCHED.
//
// The second half is the point: the user's hard requirement is that cleaning up
// leftovers must never cost them sessions, memories or configuration, so this
// test fails if any of those paths so much as loses a byte.
//
// Usage: node .smoke/legacy-cleanup-test.cjs
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.DSH_CLEANUP_TEST_PORT || 37797);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-cleanup-test-"));
const HOME = path.join(TMP, "dsh-home");
const PROFILES = path.join(HOME, "profiles");
const SHARED = path.join(PROFILES, "node_modules");
const WEB = path.join(PROFILES, "web");
const WEB_MODULES = path.join(WEB, "node_modules");

// A stand-in for a DIFFERENT installed extension, and for a global npm dsh.
const OTHER_EXT = path.join(TMP, "vscode", "extensions", "your-publisher-id.dsh-vscode-0.2.53", "vendor", "node_modules");
const GLOBAL_NPM = path.join(TMP, "npm", "node_modules", "@deepseek-ai", "dsh", "node_modules");
const CURRENT_EXT = path.join(ROOT, "vendor", "node_modules");

const mkdir = (p) => fs.mkdirSync(p, { recursive: true });
const write = (p, text) => { mkdir(path.dirname(p)); fs.writeFileSync(p, text); };
const link = (target, at) => { mkdir(path.dirname(at)); fs.symlinkSync(target, at, "junction"); };

// ---------------------------------------------------------------- the fixture
// (a) things that must be preserved byte-for-byte by the cleanup
const PRESERVED = [
  ["settings.yaml", "llm-pi-ai:\n  providers: {}\n"],
  ["memories/dsh-memory-evolve/index.json", '{"facts":42}\n'],
  ["memories/skills-state.json", '{"disabled":[],"customDirs":[]}\n'],
  ["sessions/--D-proj--/session-aaaa/session.jsonl.zstd", "PRETEND-ZSTD"],
  ["storages/workspace.json", "{}\n"],
  ["attachments/v1/blob", "attachment-bytes"],
  // active plugin state (dsh-undo-plugin and the still-shipped presets)
  ["rollback-undo/undo/state.json", '{"snapshots":["s1"]}\n'],
  ["rollback-archive/index.json", '{"archived":1}\n'],
  // leftover-looking but ambiguous: holds user data / is read by a live preset,
  // so it is deliberately NOT in the quarantine allowlist.
  ["task-board/ledger-v2.json", '{"cards":["mine"]}\n'],
  ["router-standard/stages.json", '{"stage":0}\n']
];
// (b) files the CLEANUP must not delete, but which the host or syncBakedPresets
// legitimately rewrites on every boot (the browser-auth secret is initialised,
// the anonymous id is minted, the shipped agent preset is re-synced). Asserted as
// "still there with the user's marker intact", not byte-equality.
const SURVIVES = [
  [".credentials.yaml", "secret: keep-me\n", "keep-me"],
  [".anonymous-user-id", "abc123\n", null],
  [".agent-presets/router-standard/agent.cordis.yml", "[]\n", null]
];
// (c) retired-plugin state: quarantined, never deleted
const QUARANTINED = [
  ["super-injector/cache.bin", "super-injector-state"],
  ["diff-review/report.json", "diff-review-state"],
  ["change-ledger/v1/ledger.jsonl", "ledger-line\n"],
  ["doctor/state.json", "doctor-state\n"],
  ["pet.json", '{"petId":"whale-girl"}\n'],
  ["dsh-easyrewrite.log", "old log\n"]
];

for (const [rel, text] of [...PRESERVED, ...SURVIVES.map(([r, t]) => [r, t]), ...QUARANTINED]) write(path.join(HOME, rel), text);

// (c) module-fallback links. The rule is deliberately narrow: remove ONLY a link
// whose target is gone. A link that still resolves is kept even when it points at
// another extension version or a global npm dsh, because this install's vendor
// tree may not carry the package at all (katex, shiki … are absent from the 0.1.5
// closure), so the link can be the only copy.
write(path.join(OTHER_EXT, "left-pad", "package.json"), '{"name":"left-pad","version":"1.0.0"}\n');
write(path.join(GLOBAL_NPM, "katex", "package.json"), '{"name":"katex","version":"0.16.0"}\n');
link(path.join(TMP, "vscode", "extensions", "your-publisher-id.dsh-vscode-0.1.7", "vendor", "node_modules", "react"),
  path.join(SHARED, "react"));                                                         // dangling (ext uninstalled)
link(path.join(TMP, "deleted-extension", "left-pad"), path.join(SHARED, "left-pad"));   // dangling (plain target gone)
link(path.join(OTHER_EXT, "left-pad"), path.join(SHARED, "kept-other-ext"));            // resolves: KEEP
link(path.join(GLOBAL_NPM, "katex"), path.join(SHARED, "kept-global-npm"));             // resolves: KEEP
link(path.join(CURRENT_EXT, "zod"), path.join(SHARED, "zod"));                          // current: KEEP
write(path.join(SHARED, "typescript", "package.json"), "{}\n");                        // real dir: KEEP
// a profile-owned fallback link is legitimate by design
const PROFILE_FALLBACK = path.join(WEB, ".dsh-module-fallback", "node_modules");
write(path.join(PROFILE_FALLBACK, "@deepseek-ai/dsh-client-ui-slots", "package.json"), "{}\n");
link(path.join(PROFILE_FALLBACK, "@deepseek-ai", "dsh-client-ui-slots"),
  path.join(WEB_MODULES, "@deepseek-ai", "dsh-client-ui-slots"));

// (d) profile manifest with stale dependencies + one the user added themselves
write(path.join(WEB, "package.json"), JSON.stringify({
  dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"] } },
  dependencies: {
    "dsh-free-search": "^0.4.17",                                                   // retired plugin
    "@dsh-vscode/p2h-bridge": "link:" + path.join(ROOT, "plugins", "bundled", "@dsh-vscode", "p2h-bridge"),
    "some-user-plugin": "^1.0.0"                                                    // user's own: KEEP
  }
}, null, 2) + "\n");

// (e) structural residue
mkdir(path.join(WEB_MODULES, "@linxin666"));                                            // empty scope dir
write(path.join(WEB_MODULES, "@dsh-vscode", "p2h-bridge.pnpm-old", "package.json"), "{}\n");
write(path.join(WEB_MODULES, "@canglongcl", ".ignored_dsh-web-review", "package.json"), "{}\n");
write(path.join(WEB_MODULES, "dsh-memory-evolve", "package.json"), '{"name":"dsh-memory-evolve"}\n'); // real dir: KEEP
write(path.join(WEB, "cordis.patch.yml"), "[]\n");
write(path.join(WEB, "cordis.patch.yml.bak-plugin-manager"), "- id: x\n");

// ------------------------------------------------------------------- the stub
const disposable = { dispose() {} };
const settings = { port: PORT, cwd: ROOT, dshHome: HOME, openOnStartup: false, enableBakedPlugins: true };
const vscodeStub = {
  window: {
    createOutputChannel: (name) => ({ name, appendLine: (l) => process.stdout.write(`[${name}] ${l}\n`), show() {} }),
    registerWebviewViewProvider: () => disposable,
    showTextDocument: () => Promise.resolve()
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: ROOT } }],
    getConfiguration: (s) => ({ get: (k) => (s === "dsh" ? settings[k] : undefined) }),
    openTextDocument: () => Promise.resolve({})
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

// -------------------------------------------------------------------- asserts
let failures = 0;
const check = (label, condition, detail = "") => {
  if (condition) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? "  " + detail : ""}`);
};
const exists = (p) => fs.existsSync(p);
const isLink = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };

(async () => {
  await ext.activate({
    subscriptions: [],
    extension: { packageJSON: { version: "0.0.0-cleanup-test" } },
    extensionPath: ROOT,
    globalStorageUri: { fsPath: TMP }
  });

  // The cleanup runs synchronously inside startHost, before the fork; poll briefly
  // so the assertion does not race the (async) activate() wrapper.
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (!isLink(path.join(SHARED, "react")) && !isLink(path.join(SHARED, "left-pad"))) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("\nleftovers removed");
  check("dangling link (target extension uninstalled) removed", !isLink(path.join(SHARED, "react")));
  check("dangling link (plain target gone) removed", !isLink(path.join(SHARED, "left-pad")));
  check("empty @scope directory removed", !exists(path.join(WEB_MODULES, "@linxin666")));
  check("*.pnpm-old removed", !exists(path.join(WEB_MODULES, "@dsh-vscode", "p2h-bridge.pnpm-old")));
  check(".ignored_* removed", !exists(path.join(WEB_MODULES, "@canglongcl", ".ignored_dsh-web-review")));
  check("cordis.patch.yml.bak-* removed", !exists(path.join(WEB, "cordis.patch.yml.bak-plugin-manager")));

  const manifest = JSON.parse(fs.readFileSync(path.join(WEB, "package.json"), "utf8"));
  check("retired profile dependency removed", !("dsh-free-search" in (manifest.dependencies ?? {})));
  check("self `link:` profile dependency removed", !("@dsh-vscode/p2h-bridge" in (manifest.dependencies ?? {})));
  check("user's own dependency kept", (manifest.dependencies ?? {})["some-user-plugin"] === "^1.0.0");

  console.log("\nstill intact");
  // Narrow-rule invariants: only DANGLING links may go.
  check("resolvable link to another extension KEPT", isLink(path.join(SHARED, "kept-other-ext")));
  check("resolvable link to a global npm dsh KEPT", isLink(path.join(SHARED, "kept-global-npm")));
  check("current-install module link kept", isLink(path.join(SHARED, "zod")));
  check("real package dir kept", exists(path.join(SHARED, "typescript", "package.json")));
  check("profile-owned fallback link kept", isLink(path.join(WEB_MODULES, "@deepseek-ai", "dsh-client-ui-slots")));
  check("transplanted plugin dir kept", exists(path.join(WEB_MODULES, "dsh-memory-evolve", "package.json")));
  check("cordis.patch.yml kept", exists(path.join(WEB, "cordis.patch.yml")));

  console.log("\nnever touched: sessions / memories / config / active plugin state");
  for (const [rel, text] of PRESERVED) {
    const p = path.join(HOME, rel);
    let actual = null;
    try { actual = fs.readFileSync(p, "utf8"); } catch { actual = null; }
    check(`preserved ${rel}`, actual === text, actual === null ? "(MISSING)" : "(content changed)");
  }
  for (const [rel, text, marker] of SURVIVES) {
    const p = path.join(HOME, rel);
    let actual = null;
    try { actual = fs.readFileSync(p, "utf8"); } catch { actual = null; }
    const kept = actual !== null && (marker === null || actual.includes(marker));
    check(`survived ${rel}`, kept, actual === null ? "(MISSING)" : "(marker lost)");
    void text;
  }

  console.log("\nretired plugin state: quarantined, not deleted");
  const quarantineRoot = path.join(HOME, ".dsh-vscode-retired");
  const stamps = exists(quarantineRoot) ? fs.readdirSync(quarantineRoot) : [];
  check("quarantine directory created", stamps.length > 0);
  for (const [rel, text] of QUARANTINED) {
    const movedAway = !exists(path.join(HOME, rel));
    let quarantined = false;
    for (const stamp of stamps) {
      const candidate = path.join(quarantineRoot, stamp, rel.split("/")[0]);
      if (exists(candidate)) { quarantined = true; break; }
    }
    check(`${rel} moved out of the live home`, movedAway);
    check(`${rel} recoverable in quarantine`, quarantined);
  }

  await ext.deactivate();
  console.log(`\nRESULT: ${failures === 0 ? "PASS" : `FAIL (${failures} check(s))`}`);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
  process.exit(failures === 0 ? 0 : 1);
})();
