"""Store/update the dsh-app-boot platform patch entries (idempotent)."""
import json
import os
import shutil

ROOT = os.path.abspath(".")
STORE = os.path.join(ROOT, ".smoke", "platform-patches")
MANIFEST = os.path.join(STORE, "manifest.json")
PACKAGE = "@deepseek-ai/dsh-app-boot"
FILES = ("lib/index.js", "lib/worker/profile-resolution-bootstrap.js")

WHY = [
    "The host CANNOT START inside VS Code without this patch. dsh-app-boot reaches",
    "Node's internal module loader through `node-addon-require-builtin`, whose",
    "native addon identifies the embedder by fingerprint and accepts only an exact",
    "allowlist of Electron builds (0.2.2: 43.0.0, 44.0.0, 44.7.0, 45.0.0-alpha.6).",
    "The extension runs the host on VS Code's own binary as Node",
    "(ELECTRON_RUN_AS_NODE=1), which is Electron 43.8.3 on VS Code 1.144.1 -- not",
    "on that list -- so the addon answers `Unsupported/no-context` and the host",
    "dies during preparation:",
    "  dsh: host preparation failed: node-addon-require-builtin unsupported:",
    "  Unsupported/no-context (unsupported Electron runtime fingerprint:",
    "  Node 24.22.1, V8 15.0.245.31-electron.0)",
    "and every boot exits 1, leaving the panel on the error page.",
    "",
    "WHY THIS SHAPE. The rest of the platform (cordis-plugin-loader's",
    "requireInternal, dsh-hmr's copy) already resolves internals the same way:",
    "`--expose-internals` first, builtin addon only as a fallback. app-boot was the",
    "one place that hardcoded the addon. The extension always launches the host",
    "with --expose-internals, so the native path is available; verified under",
    "VS Code's binary that require('internal/modules/esm/loader') plus",
    "cjs/loader, helpers, esm/utils and esm/resolve all resolve and expose the",
    "same interfaces the addon returned (resolveSync, Module._resolveFilename,",
    "getCjsConditions, getDefaultConditions, defaultResolve, modern loader).",
    "The fallback keeps a plain node.exe path unchanged, and when BOTH fail the",
    "error names both causes instead of an opaque addon status.",
    "",
    "Verified by booting the real host on VS Code's Code.exe (ELECTRON_RUN_AS_NODE=1,",
    "--expose-internals): the web profile boots, the shell serves, all 14 bundled",
    "entries mount, 7 presets compose; the same command without the patch fails",
    "with the addon error above. Guarded by `boot-test.mjs --electron` and the byte",
    "check in platform-patches.py (pack.py refuses to package a tree without it).",
    "",
    "Re-apply after a vendor rebuild: python .smoke/patch-app-boot-internals.py apply",
]

manifest = json.load(open(MANIFEST, encoding="utf-8"))
manifest["patches"] = [patch for patch in manifest["patches"] if patch.get("package") != PACKAGE]
for rel in FILES:
    stored = os.path.join(STORE, "dsh-app-boot", *rel.split("/"))
    os.makedirs(os.path.dirname(stored), exist_ok=True)
    source = os.path.join(ROOT, "vendor", "node_modules", *PACKAGE.split("/"), *rel.split("/"))
    shutil.copyfile(source, stored)
    print("stored " + os.path.relpath(stored, ROOT))
    manifest["patches"].append({
        "package": PACKAGE,
        "file": rel,
        "expectedPackageVersion": "0.2.2-rc.2",
        "storedAs": "dsh-app-boot/" + rel,
        "why": WHY,
    })
with open(MANIFEST, "w", encoding="utf-8", newline="\n") as handle:
    json.dump(manifest, handle, indent=2, ensure_ascii=False)
    handle.write("\n")
print("manifest patches: " + str(len(manifest["patches"])))
