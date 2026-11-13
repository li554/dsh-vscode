"""Find runtime dependencies that the bundled tree cannot resolve.

WHY. `plugins/bundled/_hostdeps` is a hand-curated flattening of the third-party
packages the baked plugins need at runtime. Missing one is silent in the repo (the
dev `node_modules` at the project root or the old vendor tree used to satisfy it)
and only fails in the packaged extension: `@linxin666/dsh-ssh` could not import
because `asn1` requires `safer-buffer`, which was never shipped — the plugin then
fails to mount and its UI silently disappears.

This walks every package that ships at runtime (`_hostdeps/**` plus each bundled
plugin root) and checks each declared `dependencies` entry resolves from one of:
  * `_hostdeps/<name>` (flattened into <profile>/node_modules),
  * the vendored platform closure `vendor/node_modules/<name>`,
  * the plugin's own nested `node_modules/<name>`,
  * Node's builtin modules.
Optional and peer dependencies are skipped on purpose (optional = the code path
guards for absence; peers are supplied by the host).

Usage: python .smoke/check-hostdeps.py
Exit: 0 when every dependency resolves, 1 with the missing list.
"""
import json
import os
import sys

ROOT = os.path.abspath(".")
BUNDLED = os.path.join(ROOT, "plugins", "bundled")
HOSTDEPS = os.path.join(BUNDLED, "_hostdeps")
VENDOR = os.path.join(ROOT, "vendor", "node_modules")

BUILTINS = set(sys.builtin_module_names) | {
    "assert", "buffer", "child_process", "cluster", "console", "constants", "crypto",
    "dgram", "diagnostics_channel", "dns", "domain", "events", "fs", "http", "http2",
    "https", "inspector", "module", "net", "os", "path", "perf_hooks", "process",
    "punycode", "querystring", "readline", "repl", "stream", "string_decoder", "sys",
    "timers", "tls", "trace_events", "tty", "url", "util", "v8", "vm", "wasi",
    "worker_threads", "zlib", "test", "sea", "sqlite", "node:test", "node:sqlite",
}


def package_dirs():
    """(label, package dir) for every runtime package in the bundled tree."""
    out = []
    if os.path.isdir(HOSTDEPS):
        for entry in sorted(os.listdir(HOSTDEPS)):
            full = os.path.join(HOSTDEPS, entry)
            if not os.path.isdir(full):
                continue
            if entry.startswith("@"):
                for sub in sorted(os.listdir(full)):
                    sub_full = os.path.join(full, sub)
                    if os.path.isdir(sub_full):
                        out.append(("_hostdeps/" + entry + "/" + sub, sub_full))
            else:
                out.append(("_hostdeps/" + entry, full))
    for entry in sorted(os.listdir(BUNDLED)):
        if entry.startswith("@") or entry == "node_modules":
            continue
        full = os.path.join(BUNDLED, entry)
        if os.path.isdir(full):
            out.append((entry, full))
        if entry == "_hostdeps":
            continue
    return out


def read_json(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return None


def resolves(name, package_dir):
    if name in BUILTINS or name.startswith("node:"):
        return True
    # A bundled SIBLING package is transplanted next to the entry in the profile
    # (mnemon's provider/source/strategy packages are declared as dependencies but
    # ship as their own dirs under plugins/bundled), so "declared" and "shipped"
    # both hold.
    candidates = (
        HOSTDEPS,
        VENDOR,
        os.path.join(package_dir, "node_modules"),
        BUNDLED,
    )
    for base in candidates:
        if os.path.isdir(os.path.join(base, *name.split("/"))):
            return True
    return False


def is_build_only(manifest, name):
    """A declared dependency that only the plugin's prebuilt client half needs.

    dsh-better-sidebar's client bundle inlines CodeMirror/xterm/mermaid/react-icons
    at its own build time; its runtime `lib/client.js` carries ZERO bare imports
    (verified by the boot harness serving it and by .smoke/client-command-shape).
    Such deps are never resolved at runtime, so shipping them would be dead weight.
    """
    if manifest.get("dsh", {}).get("client", {}).get("platform") == "web":
        return name in BUILD_ONLY_HINTS
    return False


BUILD_ONLY_HINTS = {
    "@codemirror/commands", "@codemirror/lang-cpp", "@codemirror/lang-css",
    "@codemirror/lang-go", "@codemirror/lang-html", "@codemirror/lang-java",
    "@codemirror/lang-javascript", "@codemirror/lang-json", "@codemirror/lang-markdown",
    "@codemirror/lang-php", "@codemirror/lang-python", "@codemirror/lang-rust",
    "@codemirror/lang-sql", "@codemirror/lang-vue", "@codemirror/lang-xml",
    "@codemirror/lang-yaml", "@codemirror/language", "@codemirror/legacy-modes",
    "@codemirror/search", "@codemirror/state", "@codemirror/view",
    "@formkit/auto-animate", "@lezer/highlight", "@xterm/addon-fit", "@xterm/xterm",
    "clsx", "dompurify", "mermaid", "react-icons", "rxjs", "@tanstack/react-virtual",
}


problems = []
checked = 0
for label, directory in package_dirs():
    manifest = read_json(os.path.join(directory, "package.json"))
    if not manifest:
        continue
    dependencies = manifest.get("dependencies") or {}
    if not isinstance(dependencies, dict):
        continue
    for name in sorted(dependencies):
        checked += 1
        if is_build_only(manifest, name):
            continue
        if not resolves(name, directory):
            problems.append((label, name, dependencies[name]))

if problems:
    print(f"checked {checked} declared runtime dependencies; {len(problems)} unresolvable:")
    for label, name, spec in problems:
        print(f"  MISSING {name}@{spec} required by {label}")
    sys.exit(1)
print(f"checked {checked} declared runtime dependencies; every one resolves")
