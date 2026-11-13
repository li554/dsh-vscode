"""Bump the extension version in the two places VS Code reads it."""
import io
import json
import os

ROOT = os.path.abspath(".")
VERSION = "0.4.1"

pkg_path = os.path.join(ROOT, "package.json")
pkg = json.load(io.open(pkg_path, encoding="utf-8"))
pkg["version"] = VERSION
with io.open(pkg_path, "w", encoding="utf-8", newline="\n") as handle:
    json.dump(pkg, handle, indent=2, ensure_ascii=False)
    handle.write("\n")
print("package.json -> " + VERSION)

manifest_path = os.path.join(ROOT, ".smoke", "meta", "extension.vsixmanifest")
text = io.open(manifest_path, encoding="utf-8", newline="").read()
needle = 'Id="dsh-vscode" Version="'
start = text.find(needle)
if start < 0:
    raise SystemExit("identity element not found")
version_start = start + len(needle)
version_end = text.find('"', version_start)
old = text[version_start:version_end]
text = text[:version_start] + VERSION + text[version_end:]
io.open(manifest_path, "w", encoding="utf-8", newline="").write(text)
print("extension.vsixmanifest -> " + old + " => " + VERSION)
