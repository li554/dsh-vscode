// Behavioural test for the embedded "open configuration file" bridge.
//
// DSH 0.1.5 deleted dsh-host-apiproxy, which owned the DSH_EMBEDDED sentinel the
// VS Code panel relies on: when DSH_EMBEDDED=1 the settings handler must write the
// document path to stdout (so the extension can reveal it in its editor) instead
// of handing the file to a native opener the user cannot see. Without the
// restored branch, "打开配置文件" silently does nothing.
//
// This drives the real SettingsController from the vendored tree with stubbed
// internals, so it fails if the patch is dropped or the branch moves.
//
// Usage: node .smoke/embedded-open-settings-test.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
const MODULE = path.join(ROOT, "vendor", "node_modules", "@deepseek-ai", "dsh-api-settings-controller", "lib", "index.js");
const SENTINEL = "[dsh-vscode:open-settings] ";

const { SettingsController } = await import(pathToFileURL(MODULE).href);

let failures = 0;
const check = (label, ok, detail = "") => {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? "  " + detail : ""}`);
};

/**
 * Build a controller without running its constructor: openSettingsDocument only
 * needs `provider()`, `openTextFile` and the abort helpers, all of which are
 * supplied here so no cordis context is required.
 */
function makeController(settingsPath, nativeCalls) {
  const controller = Object.create(SettingsController.prototype);
  controller.provider = () => ({ prepareDocument: async () => settingsPath });
  controller.openTextFile = async () => { nativeCalls.push(settingsPath); };
  return controller;
}

/** Run one openSettingsDocument call and capture what it wrote to stdout. */
async function run(embedded, settingsPath) {
  const nativeCalls = [];
  const writes = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...rest) => { writes.push(String(chunk)); return true; };
  const previous = process.env.DSH_EMBEDDED;
  if (embedded) process.env.DSH_EMBEDDED = "1"; else delete process.env.DSH_EMBEDDED;
  let result, error;
  try {
    result = await makeController(settingsPath, nativeCalls).openSettingsDocument(new AbortController().signal);
  } catch (thrown) {
    error = thrown;
  } finally {
    process.stdout.write = originalWrite;
    if (previous === undefined) delete process.env.DSH_EMBEDDED; else process.env.DSH_EMBEDDED = previous;
  }
  return { result, error, nativeCalls, stdout: writes.join("") };
}

const SETTINGS = path.join(ROOT, ".tmp-vendor", "fake-settings.yaml");

console.log("embedded (DSH_EMBEDDED=1):");
const embedded = await run(true, SETTINGS);
check("no error", embedded.error === undefined, embedded.error?.message);
check("reports opened:true", embedded.result?.opened === true, JSON.stringify(embedded.result));
check("emits the extension sentinel", embedded.stdout.includes(SENTINEL + SETTINGS), JSON.stringify(embedded.stdout));
check("emits the sentinel on its own line", /\[dsh-vscode:open-settings\] .+\n$/.test(embedded.stdout));
check("does NOT call the native opener", embedded.nativeCalls.length === 0, JSON.stringify(embedded.nativeCalls));

console.log("\nnot embedded (DSH_EMBEDDED unset):");
const native = await run(false, SETTINGS);
check("no error", native.error === undefined, native.error?.message);
check("reports opened:true", native.result?.opened === true, JSON.stringify(native.result));
check("calls the native opener once", native.nativeCalls.length === 1, JSON.stringify(native.nativeCalls));
check("emits no sentinel", !native.stdout.includes(SENTINEL), JSON.stringify(native.stdout));

console.log(`\nRESULT: ${failures === 0 ? "PASS" : `FAIL (${failures} check(s))`}`);
process.exit(failures === 0 ? 0 : 1);
