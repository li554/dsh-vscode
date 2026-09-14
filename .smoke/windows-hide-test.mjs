// Regression guard for the local dsh-subprocess-local patch: running a command
// must not pop up a console window.
//
// Two parts, because either alone is weak:
//  1. SOURCE — launchWindowsJob's spawn options carry windowsHide, and the fallback
//     path (spawnSubprocess) still carries its own. This is what actually fails if
//     the patch is reverted; the platform-patches manifest byte-compares the file,
//     and this states the property that matters in readable terms.
//  2. MECHANISM — spawn a child both ways and ask it whether Windows gave it a
//     console. `windowsHide` passes CREATE_NO_WINDOW, so the child reports
//     NO_CONSOLE and no window can exist; without it a console is allocated, which
//     on a console-less host (the Electron extension host) is a window the user
//     sees for the lifetime of the command.
//
// Usage: node .smoke/windows-hide-test.mjs
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const FILE = "vendor/node_modules/@deepseek-ai/dsh-subprocess-local/lib/index.js";
const FALLBACK_FILE = "vendor/node_modules/@deepseek-ai/dsh-subprocess-local/lib/runner-launch-COYGu0Dl.js";

let failures = 0;
const check = (label, ok, detail = "") => {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? "  " + detail : ""}`);
};

/** The body of a top-level function, up to the next one. Good enough to ask
 *  "is this option set inside that function" without a JS parser. */
function functionBody(text, name) {
  const start = text.indexOf(`function ${name}(`);
  if (start < 0) return "";
  const next = text.indexOf("\nfunction ", start + 1);
  return text.slice(start, next < 0 ? text.length : next);
}

console.log("1. the patched call sites");
const sub = fs.readFileSync(FILE, "utf8");
const winJob = functionBody(sub, "launchWindowsJob");
check("launchWindowsJob spawns a child", winJob.includes("(internals.spawn ?? spawn)"));
check("its spawn options set windowsHide", winJob.includes("windowsHide"), winJob.replace(/\s+/g, " ").slice(-200));
check("windowsHide is unconditional (windowsHide: true)", /windowsHide:\s*true/.test(winJob));

const fallback = fs.readFileSync(FALLBACK_FILE, "utf8");
const fallbackBody = functionBody(fallback, "spawnSubprocess");
check("the fallback path still sets windowsHide", fallbackBody.includes("windowsHide"));

console.log("\n2. the mechanism (does windowsHide actually prevent a console?)");
const PS = [
  "Add-Type -Namespace W -Name N -MemberDefinition '[DllImport(\"kernel32.dll\")] public static extern IntPtr GetConsoleWindow();'",
  "$h=[W.N]::GetConsoleWindow()",
  "if($h -eq [IntPtr]::Zero){'NO_CONSOLE'}else{'HAS_CONSOLE'}"
].join("; ");
const probe = (options) => {
  const r = spawnSync("powershell", ["-NoProfile", "-Command", PS], { encoding: "utf8", timeout: 30000, ...options });
  return { status: r.status, out: (r.stdout ?? "").trim() };
};
const plain = probe({});
const hidden = probe({ windowsHide: true });
if (plain.status !== 0 || hidden.status !== 0 || plain.out === "") {
  console.log("  SKIP powershell/Add-Type unavailable here, so the mechanism cannot be observed in this shell");
} else {
  check("a plain spawn is given a console", plain.out === "HAS_CONSOLE", plain.out);
  check("a windowsHide spawn is given none", hidden.out === "NO_CONSOLE", hidden.out);
}

console.log(`\nRESULT: ${failures === 0 ? "PASS" : `FAIL (${failures} check(s))`}`);
process.exit(failures === 0 ? 0 : 1);
