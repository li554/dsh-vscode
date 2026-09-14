// Every local patch we apply to bundled third-party client code must still be there.
//
// Bundled plugins are re-transplanted from plugins/bundled on every boot, so a patch
// written into that tree survives boots — but NOT an upstream refresh of the plugin,
// which silently reverts it. Each entry names the file and the text that proves the
// patch is applied, so a revert fails here rather than in the field.
//
// Usage: node .smoke/bundled-patches.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

const PATCHES = [
  {
    why: "0.1.5's client CALLS contribution.description(), so a string fails the whole '/' command source",
    file: "plugins/bundled/@canglongcl/dsh-web-review/lib/client-official.js",
    applied: 'description: () => t("command.skills.description")',
    reverted: 'description: t("command.skills.description"),'
  },
  {
    why: "the archive read's rejection reason was discarded, leaving the failure untraceable",
    file: "plugins/bundled/@dsh-undo/client-rollback-settings/lib/client.js",
    applied: "[dsh-vscode] reading archived tasks failed:",
    reverted: null
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
