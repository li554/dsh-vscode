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
import os from "node:os";
import { join } from "node:path";
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

// Part 1b. The SANDBOX path (restricted token), which is what every confined command
// goes through. A runtime trace of one `powershell -NoProfile -Command "echo hi"` ended
// at `CreateProcessAsUserW flags=4`, and the confined child's STARTUPINFOW had
// `dwFlags: 256` (STARTF_USESTDHANDLES only): the `wShowWindow: 0` sitting right beside
// it was INERT, because Windows only honours wShowWindow when STARTF_USESHOWWINDOW is
// set. With no usable console inheritance (the VS Code host is Electron/Code.exe, a GUI
// binary for which CREATE_NO_WINDOW is ignored) Windows therefore allocated a VISIBLE
// console for every sandboxed command.
//
// Fixed the way dsh-silent-pwsh does it — set STARTF_USESHOWWINDOW so SW_HIDE takes
// effect — and NOT with CREATE_NO_WINDOW, which the DSH maintainers verified makes the
// child die with STATUS_DLL_INIT_FAILED (0xC0000142) under the restricted token (it
// happened to work in one local run here, which is exactly the kind of latent breakage
// not worth shipping).
const WIN32_FILE = "vendor/node_modules/@deepseek-ai/dsh-win32-process/lib/index.js";
const win32 = fs.readFileSync(WIN32_FILE, "utf8");
check("both STARTUPINFOW sites set STARTF_USESHOWWINDOW (dwFlags 257)",
  (win32.match(/dwFlags: 257,/g) ?? []).length === 2,
  `dwFlags sites: ${(win32.match(/dwFlags: \d+,/g) ?? []).join(", ")}`);
check("both STARTUPINFOW sites carry wShowWindow: 0 (SW_HIDE)",
  (win32.match(/wShowWindow: 0,/g) ?? []).length === 2);
check("no dwFlags: 256 site is left (the inert shape)",
  !/dwFlags: 256,/.test(win32));
check("the restricted call sites do NOT pass CREATE_NO_WINDOW (0xC0000142 risk)",
  /createRestrictedProcess\(api, options, commandLine, 4, startupInfo, processInfo\)/.test(win32) &&
  /createRestrictedProcess\(api, options, buildCommandLine\([^)]*\), 0, startupInfo, processInfo\)/.test(win32),
  win32.split("\n").filter((line) => line.includes("createRestrictedProcess(api")).map((l) => l.trim().slice(0, 110)).join("  ||  "));
check("the one-time windows-acl capability probe is hidden",
  /windowsHide: true/.test(fs.readFileSync("vendor/node_modules/@deepseek-ai/dsh-sandbox-local/lib/index.js", "utf8")));

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

console.log("\n3. the sandbox path end to end (a confined command still runs, no window opens)");
const ACL_RUNNER = "vendor/node_modules/@deepseek-ai/dsh-sandbox-windows-acl/lib/runner.js";
const pidsOf = (script) => {
  const r = spawnSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8", timeout: 30000 });
  if (r.status !== 0) return null;
  return new Set((r.stdout ?? "").trim().split(",").map((s) => s.trim()).filter(Boolean));
};
const VISIBLE = "(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 }).Id -join ','";
const CONSOLE_HOSTS = "(Get-Process -Name WindowsTerminal,OpenConsole -ErrorAction SilentlyContinue).Id -join ','";
if (process.platform !== "win32" || !fs.existsSync(ACL_RUNNER)) {
  console.log("  SKIP (windows-acl sandbox runner unavailable)");
} else {
  const beforeVisible = pidsOf(VISIBLE);
  const beforeHosts = pidsOf(CONSOLE_HOSTS);
  if (beforeVisible === null) {
    console.log("  SKIP (PowerShell unavailable, so window state cannot be observed)");
  } else {
    const ws = fs.mkdtempSync(join(os.tmpdir(), "dsh-hide-ws-"));
    const temp = fs.mkdtempSync(join(os.tmpdir(), "dsh-hide-tmp-"));
    const run = spawnSync(process.execPath, [
      ACL_RUNNER, "--workspace", ws, "--temp", temp, "--mode", "workspace-write", "--",
      "powershell", "-NoProfile", "-NonInteractive", "-Command", "echo confined-ok"
    ], { encoding: "utf8", windowsHide: true, timeout: 180000 });
    const newVisible = [...(pidsOf(VISIBLE) ?? [])].filter((id) => !beforeVisible.has(id));
    const newHosts = [...(pidsOf(CONSOLE_HOSTS) ?? [])].filter((id) => !(beforeHosts ?? new Set()).has(id));
    check("a confined (workspace-write) command still runs", run.status === 0,
      `status=${run.status} stderr=${(run.stderr ?? "").trim().slice(0, 200)}`);
    check("its stdout flows through the inherited stdio", /confined-ok/.test(run.stdout ?? ""),
      JSON.stringify((run.stdout ?? "").trim().slice(0, 100)));
    check("…and no console window opened", newVisible.length === 0 && newHosts.length === 0,
      `newVisiblePids=[${newVisible.join(",")}] newConsoleHostPids=[${newHosts.join(",")}]`);
    fs.rmSync(ws, { recursive: true, force: true });
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

console.log(`\nRESULT: ${failures === 0 ? "PASS" : `FAIL (${failures} check(s))`}`);
process.exit(failures === 0 ? 0 : 1);
