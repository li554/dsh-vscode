"""Apply the dsh-app-boot embedded-runtime patch (see .smoke/platform-patches).

`node-addon-require-builtin` gates on an exact Electron-version allowlist, so the
VS Code deployment (Electron 43.8.3 on VS Code 1.144.1) is refused with
`Unsupported/no-context` and the host cannot even finish preparation. The rest of
the platform already prefers the native `--expose-internals` path; app-boot is
the one place that hardcodes the addon. This rewrites those two call sites.

Kept as a script because the patch has to be re-applied verbatim after a vendor
rebuild; .smoke/platform-patches.py stores/verifies the result by bytes.
"""
import io
import os
import sys

ROOT = os.path.abspath(".")
TARGETS = (
    "vendor/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js",
    "vendor/node_modules/@deepseek-ai/dsh-app-boot/lib/worker/profile-resolution-bootstrap.js",
)

OLD = (
    'function internalModules() {\n'
    '\tconst addon = createRequire(import.meta.url)("node-addon-require-builtin");\n'
    '\tconst esmModule = addon.requireBuiltin("internal/modules/esm/loader");\n'
    '\tconst cjsModule = addon.requireBuiltin("internal/modules/cjs/loader");\n'
    '\tconst cjsHelpers = addon.requireBuiltin("internal/modules/helpers");\n'
    '\tconst esmUtils = addon.requireBuiltin("internal/modules/esm/utils");\n'
    '\tconst esmResolve = addon.requireBuiltin("internal/modules/esm/resolve");\n'
)

NEW = (
    '/**\n'
    '* dsh-vscode LOCAL PATCH: resolve a Node internal module the way the rest of\n'
    '* this platform does -- cordis-plugin-loader and dsh-hmr both try the native\n'
    '* `--expose-internals` path first and only then the builtin addon.\n'
    '*\n'
    '* WHY. `node-addon-require-builtin` identifies the embedder by fingerprint and\n'
    '* accepts only an exact allowlist of Electron builds (0.2.2: 43.0.0, 44.0.0,\n'
    '* 44.7.0, 45.0.0-alpha.6). The VS Code deployment runs the host on VS Code own\n'
    '* binary (ELECTRON_RUN_AS_NODE=1, Electron 43.8.3 as of VS Code 1.144.1), which\n'
    '* is not on that list, so the addon answers `Unsupported/no-context` and the\n'
    '* host dies before serving anything:\n'
    '*   dsh: host preparation failed: node-addon-require-builtin unsupported\n'
    '* A plain node.exe runtime never hits it, which is why only the installed\n'
    '* extension failed. The same internals are reachable natively whenever the host\n'
    '* was launched with --expose-internals (the extension always does), and Node\n'
    '* reports a clear error when both paths fail.\n'
    '* @param id - internal module id, e.g. "internal/modules/esm/loader".\n'
    '* @returns the internal module namespace/exports.\n'
    '*/\n'
    'function requireInternalModule(id) {\n'
    '\tconst require = createRequire(import.meta.url);\n'
    '\tlet exposedError;\n'
    '\tif (process.execArgv.includes("--expose-internals")) {\n'
    '\t\ttry {\n'
    '\t\t\treturn require(id);\n'
    '\t\t} catch (error) {\n'
    '\t\t\texposedError = error;\n'
    '\t\t}\n'
    '\t}\n'
    '\ttry {\n'
    '\t\treturn require("node-addon-require-builtin").requireBuiltin(id);\n'
    '\t} catch (error) {\n'
    '\t\tconst exposed = exposedError === void 0\n'
    '\t\t\t? "was not attempted (host was not launched with --expose-internals)"\n'
    '\t\t\t: "failed with " + String(exposedError?.message ?? exposedError);\n'
    '\t\tthrow new Error(`profile resolution: cannot reach Node internals (${id}): the --expose-internals path ${exposed}; the builtin addon failed with ${String(error?.message ?? error)}`);\n'
    '\t}\n'
    '}\n'
    'function internalModules() {\n'
    '\tconst esmModule = requireInternalModule("internal/modules/esm/loader");\n'
    '\tconst cjsModule = requireInternalModule("internal/modules/cjs/loader");\n'
    '\tconst cjsHelpers = requireInternalModule("internal/modules/helpers");\n'
    '\tconst esmUtils = requireInternalModule("internal/modules/esm/utils");\n'
    '\tconst esmResolve = requireInternalModule("internal/modules/esm/resolve");\n'
)

action = sys.argv[1] if len(sys.argv) > 1 else "apply"
if action not in ("apply", "check"):
    sys.exit("usage: .smoke/patch-app-boot-internals.py [apply|check]")

problems = 0
for rel in TARGETS:
    path = os.path.join(ROOT, rel)
    with io.open(path, encoding="utf-8", newline="") as handle:
        data = handle.read()
    already = "function requireInternalModule(id)" in data
    if action == "check":
        print(("  ok      " if already else "  FAIL    ") + rel)
        problems += 0 if already else 1
        continue
    if already:
        print("  already patched: " + rel)
        continue
    if OLD not in data:
        print("  CANNOT PATCH (target block not found, upstream changed): " + rel)
        problems += 1
        continue
    with io.open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(data.replace(OLD, NEW, 1))
    print("  patched: " + rel)

sys.exit(1 if problems else 0)
