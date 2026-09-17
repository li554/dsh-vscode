"""Verify and (re)apply the vendored-platform patches for dsh-vscode.

WHY THIS EXISTS
    vendor/node_modules is committed, so patches to it normally travel with the
    repo. But vendor/ is also regenerated wholesale on every platform upgrade
    (npm install into a staging dir, then a bulk copy over vendor/node_modules).
    That silently drops every local patch and brings back whatever it fixed —
    including, for the session-format patch, a session-loading failure that only
    shows up when a user opens old history.

    Storing the patched files here lets them be rediscovered, re-applied and
    VERIFIED, and pack.py refuses to package a tree whose patches are missing.

USAGE
    python .smoke/platform-patches.py verify     # report; exit 1 if any patch is missing
    python .smoke/platform-patches.py apply      # re-apply missing patches

    verify also flags a patch whose expected upstream version no longer matches,
    which means the upstream file changed and the patch needs re-deriving.
"""

from __future__ import annotations

import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STORE = os.path.join(HERE, "platform-patches")
VENDOR = os.path.join(ROOT, "vendor", "node_modules")


def load_manifest() -> dict:
    with open(os.path.join(STORE, "manifest.json"), "r", encoding="utf-8") as handle:
        return json.load(handle)


def installed_version(package: str) -> str | None:
    """Version of an installed vendored package, or None when it is absent."""
    pkg_json = os.path.join(VENDOR, *package.split("/"), "package.json")
    if not os.path.isfile(pkg_json):
        return None
    try:
        with open(pkg_json, "r", encoding="utf-8") as handle:
            return json.load(handle).get("version")
    except Exception:
        return None


def read_bytes(path: str) -> bytes | None:
    try:
        with open(path, "rb") as handle:
            return handle.read()
    except OSError:
        return None


def check(patch: dict) -> tuple[str, str]:
    """Classify one patch: ('ok'|'missing'|'drift'|'absent'|'version', detail)."""
    package = patch["package"]
    rel = patch["file"]
    target = os.path.join(VENDOR, *package.split("/"), *rel.split("/"))
    stored = os.path.join(STORE, *patch["storedAs"].split("/"))

    version = installed_version(package)
    if version is None:
        return "absent", f"{package} is not installed under vendor/node_modules"
    if version != patch["expectedPackageVersion"]:
        return "version", (
            f"{package} is {version}, patch was derived against "
            f"{patch['expectedPackageVersion']} — re-derive before applying"
        )

    stored_bytes = read_bytes(stored)
    if stored_bytes is None:
        return "missing", f"stored patch file is gone: {patch['storedAs']}"
    target_bytes = read_bytes(target)
    if target_bytes is None:
        return "missing", f"target file is gone: {os.path.join(package, rel)}"
    if target_bytes == stored_bytes:
        return "ok", f"{package}/{rel} matches the stored patch"
    return "drift", f"{package}/{rel} differs from the stored patch"


def run(action: str) -> int:
    manifest = load_manifest()
    patches = manifest.get("patches", [])
    if not patches:
        print("no patches declared")
        return 0

    failures = 0
    for patch in patches:
        state, detail = check(patch)
        label = f"{patch['package']}/{patch['file']}"
        if state == "ok":
            print(f"  ok      {label}")
            continue
        if state == "absent":
            # A package this patch targets is simply not installed in this build
            # (e.g. a platform that dropped it). Nothing to patch, nothing wrong.
            print(f"  n/a     {label}: {detail}")
            continue
        if action == "apply" and state == "drift":
            stored = os.path.join(STORE, *patch["storedAs"].split("/"))
            target = os.path.join(VENDOR, *patch["package"].split("/"), *patch["file"].split("/"))
            shutil.copyfile(stored, target)
            print(f"  applied {label}")
            continue
        failures += 1
        print(f"  FAIL    {label}: {detail}")

    if failures:
        print(
            f"\n{failures} platform patch(es) need attention."
            + ("" if action == "apply" else " Run: python .smoke/platform-patches.py apply")
        )
        return 1
    print("\nplatform patches OK")
    return 0


def main() -> int:
    action = sys.argv[1] if len(sys.argv) > 1 else "verify"
    if action not in ("verify", "apply"):
        print("usage: platform-patches.py [verify|apply]")
        return 2
    return run(action)


if __name__ == "__main__":
    sys.exit(main())
