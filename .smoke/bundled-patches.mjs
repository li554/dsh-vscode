// Every local patch we apply to bundled third-party code must still be there.
//
// Bundled plugins are re-transplanted from plugins/bundled on every boot, so a patch
// written into that tree survives boots — but NOT an upstream refresh of the plugin,
// which silently reverts it. Each entry names the file and the text that proves the
// patch is applied, so a revert fails here rather than in the field.
//
// 0.2.2 note: the @dsh-undo/* entries that used to live here are gone — that plugin
// is retired and dsh-rewind-plugin replaced it, with its own patch entry below.
//
// Usage: node .smoke/bundled-patches.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

const PATCHES = [
  {
    why: "the client CALLS contribution.description(), so a string fails the whole '/' command source",
    file: "plugins/bundled/@canglongcl/dsh-web-review/lib/client-official.js",
    applied: 'description: () => t("command.skills.description")',
    reverted: 'description: t("command.skills.description"),'
  },
  {
    why: "0.2.2 removed ctx.layout.closeDetails; an unguarded call throws when 'open preview' runs from the annotation dock (the other call site is already inside try/catch, so it is not a usable reverse marker)",
    file: "plugins/bundled/@canglongcl/dsh-web-review/lib/client-official.js",
    applied: "ctx.layout.closeDetails?.();",
    reverted: null
  },
  {
    why: "0.2.2's session format v4 refuses a producer-owned source of kind 'plugin' ('format v4 message requires a producer-owned source kind'); the annotation draft must be persisted as the plugin that wrote it",
    file: "plugins/bundled/@canglongcl/dsh-web-review/lib/index.js",
    applied: 'kind: "plugin:dsh-web-review",',
    reverted: 'kind: "plugin",'
  },
  {
    why: "same v4 admission rule: the first-step reminder message cannot be committed with kind 'plugin'",
    file: "plugins/bundled/dsh-zh-kit/lib/index.js",
    applied: "kind: `plugin:${name}`",
    reverted: null
  },
  {
    why: "the rollback plugin's planRewind must tolerate a target that compaction moved out of the model surface, instead of reporting 'no longer in the model context'",
    file: "plugins/bundled/dsh-rewind-plugin/lib/index.js",
    applied: "dsh-vscode:",
    reverted: null
  },
  {
    why: "the ppt-master preset declaration is owned by the generated @dsh-vscode/presets bundle; the package itself stays a bundle-only shell, and an upstream restore of its own insert row would duplicate id ppt-master",
    file: "plugins/bundled/dsh-ppt-master/cordis.patch.yml",
    applied: "BUNDLE-ONLY SHELL",
    reverted: "name: '@deepseek-ai/dsh-agent-preset'"
  }
];

let failures = 0;
const check = (label, ok, detail = "") => {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? "  " + detail : ""}`);
};

for (const patch of PATCHES) {
  const full = path.join(ROOT, patch.file);
  const exists = fs.existsSync(full);
  check(`${path.basename(patch.file)} present`, exists, patch.file);
  if (!exists) continue;
  const text = fs.readFileSync(full, "utf8");
  check(`patch applied: ${patch.applied.slice(0, 60)}`, text.includes(patch.applied), `— ${patch.why}`);
  if (patch.reverted) check("the old form is gone", !text.includes(patch.reverted));
}

console.log(`\nRESULT: ${failures === 0 ? "PASS" : `FAIL (${failures} check(s))`}`);
process.exit(failures === 0 ? 0 : 1);
