// Will the bundled plugins actually MOUNT on this vendored DSH runtime?
//
// WHY THIS EXISTS. 0.2.1-alpha.3 added a plugin compatibility gate: at profile
// startup every bundle manifest is judged against the running version — an own
// `engines.dsh` range decides ALONE, otherwise each peerDependency named
// `@deepseek-ai/dsh` or `@deepseek-ai/dsh-*` must match it. A mismatch SKIPS the
// bundle with one stderr line, and the panel then renders without that plugin's
// UI. Nothing in the build noticed before this script: the plugins are prebuilt
// upstream artifacts, refreshed independently of the vendored platform.
//
// It also checks the second, quieter failure: a peer named on a package the
// platform no longer ships (dsh-better-sidebar peer-required dsh-invariants,
// removed in 0.2.0) — the gate would pass on the range but the import would die.
//
// Usage: node .smoke/plugin-compat.mjs
// Exit:  0 when every bundled entry mounts under the gate, 1 otherwise.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const VENDOR = path.join(ROOT, "vendor", "node_modules");
const BUNDLED = path.join(ROOT, "plugins", "bundled");
const requireVendor = createRequire(path.join(VENDOR, "noop.js"));

/** Semver from the vendored tree (a transitive dependency, not a repo dep). */
let satisfies;
try {
  ({ satisfies } = requireVendor("semver"));
} catch (error) {
  // Fall back to the exact-match rule only: better a loud gap than a silent pass.
  console.log("WARN semver unavailable in the vendored tree (" + String(error.message) + "); strict range checks skipped");
  satisfies = (version, range) => version === range;
}
/**
 * The gate's own comparison: dsh-app-boot passes includePrerelease:true
 * (lib/index.js:1100). Without it, semver's prerelease-tuple rule would reject
 * 0.2.2-rc.2 against ranges like ^0.2.0-rc.1 or * and this script would report
 * plugins as skipped that DSH mounts happily.
 */
const satisfiesGate = (version, range) => satisfies(version, range, { includePrerelease: true });

// Packages the prebuilt web frontend registers in its own shared module table
// instead of shipping in the vendor tree (they are NOT npm dependencies in
// 0.2.2, but `require()` of them inside a client bundle resolves at runtime).
const FRONTEND_PROVIDED = new Set([
  "@deepseek-ai/dsh-client-ui-primitives",
  "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-client-modules",
  "@deepseek-ai/dsh-client-store",
  "@deepseek-ai/dsh-client-ui-dockkit",
  "@deepseek-ai/dsh-client-runtime"
]);

function readBundledPlugins() {
  const src = fs.readFileSync(path.join(ROOT, "src", "extension.js"), "utf8");
  const m = /const BUNDLED_PLUGINS = \[([\s\S]*?)\];/.exec(src);
  if (!m) throw new Error("BUNDLED_PLUGINS not found in src/extension.js");
  // Line-wise comment strip: a comment in the array contains `@codemirror/*`, so
  // a global block-comment strip would eat real entries.
  const body = m[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .filter((line) => !/^\s*[/*]/.test(line))
    .join("\n");
  return [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function readExemptions() {
  const src = fs.readFileSync(path.join(ROOT, "src", "extension.js"), "utf8");
  const m = /const PLUGIN_VERSION_EXEMPTIONS = \[([\s\S]*?)\];/.exec(src);
  if (!m) throw new Error("PLUGIN_VERSION_EXEMPTIONS not found in src/extension.js");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function installedVersion(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(VENDOR, ...name.split("/"), "package.json"), "utf8")).version;
  } catch {
    return undefined;
  }
}

const runtime = installedVersion("@deepseek-ai/dsh");
if (!runtime) {
  console.log("FAIL the vendored tree has no @deepseek-ai/dsh");
  process.exit(1);
}
const entries = readBundledPlugins();
const exemptions = new Set(readExemptions());
console.log(`vendored dsh ${runtime}; ${entries.length} bundled entries; ${exemptions.size} declared exemption(s)\n`);

let failures = 0;
const fail = (message) => { failures++; console.log("  FAIL " + message); };
const ok = (message) => console.log("  ok   " + message);

/** Mirror of dsh-app-boot's evaluatePluginCompatibility (0.2.2). */
function evaluate(manifest) {
  if (manifest.engines && typeof manifest.engines === "object" && typeof manifest.engines.dsh === "string") {
    return satisfiesGate(runtime, manifest.engines.dsh) ? {} : { "engines.dsh": manifest.engines.dsh };
  }
  const unmet = {};
  for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
    if (name !== "@deepseek-ai/dsh" && !name.startsWith("@deepseek-ai/dsh-")) continue;
    if (typeof range !== "string") continue;
    const effective = ["workspace:^", "workspace:~", "workspace:*"].includes(range) ? runtime : range;
    if (!satisfiesGate(runtime, effective)) unmet[name] = range;
  }
  return unmet;
}

for (const name of entries) {
  const dir = path.join(BUNDLED, ...name.split("/"));
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  } catch (error) {
    fail(`${name}: cannot read package.json (${String(error.message)})`);
    continue;
  }
  const key = `${manifest.name}@${manifest.version}`;
  const unmet = evaluate(manifest);
  if (Object.keys(unmet).length > 0) {
    if (exemptions.has(key)) ok(`${key}: gate mismatch covered by a declared exemption`);
    else fail(`${key}: SKIPPED by the 0.2.2 gate — requirements ${JSON.stringify(unmet)} (upgrade the plugin, add engines.dsh, or add an EXEMPTION after verifying it)`);
  } else {
    ok(`${key}: mounts under the gate`);
    if (exemptions.has(key)) fail(`${key}: declares a redundant exemption — remove it once the manifest agrees with the runtime`);
  }

  // Every platform peer must exist in the vendored tree (or be frontend-provided).
  for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
    if (!peer.startsWith("@deepseek-ai/dsh")) continue;
    if (FRONTEND_PROVIDED.has(peer)) continue;
    if (installedVersion(peer) === undefined) fail(`${key}: peer ${peer} is NOT installed in vendor/ — its import will fail even if the gate passes`);
  }
  // A plugin that relies on a removed package through imports rather than peers
  // is caught by platform-api-scan.mjs; this is the manifest-level half.
}

console.log("");
if (failures) {
  console.log(`RESULT: ${failures} compatibility problem(s).`);
  process.exit(1);
}
console.log("RESULT: every bundled plugin mounts under this vendored runtime.");
