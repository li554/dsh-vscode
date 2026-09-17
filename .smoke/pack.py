import os, shutil, zipfile, time

ROOT = r"D:/PycharmProjects/Work/dsh-vscode"
OUT = os.path.join(ROOT, "dsh-vscode.vsix")

RIPGREP_PKGS = ("ripgrep", "ripgrep-win32-x64")

def ensure_ripgrep(root):
    """The packaged host resolves @vscode/ripgrep at runtime (glob/grep never
    use a system rg). Keep the packaged binary in the vendor tree so a freshly
    installed extension works out of the box; auto-mirror it from the dev
    node_modules tree and fail loudly instead of shipping a broken extension."""
    src_base = os.path.join(root, "node_modules", "@vscode")
    dst_base = os.path.join(root, "vendor", "node_modules", "@vscode")
    for pkg in RIPGREP_PKGS:
        src = os.path.join(src_base, pkg)
        dst = os.path.join(dst_base, pkg)
        if os.path.isdir(src) and not os.path.isdir(dst):
            print(f"vendor missing {pkg}; copying from node_modules", flush=True)
            os.makedirs(dst_base, exist_ok=True)
            shutil.copytree(src, dst)
    rg_exe = os.path.join(dst_base, "ripgrep-win32-x64", "bin", "rg.exe")
    if not os.path.isfile(rg_exe):
        raise RuntimeError(
            "ripgrep binary not packaged: expected " + rg_exe
            + " (run npm install / fix-dsh-ripgrep.ps1 first)"
        )
    return rg_exe

t0 = time.time()
count = 0

def add(zf, src, arc):
    global count
    zf.write(src, arc, compress_type=zipfile.ZIP_DEFLATED, compresslevel=1)
    count += 1
    if count % 2000 == 0:
        print(f"  {count} files, {time.time()-t0:.0f}s", flush=True)

def verify_platform_patches(root):
    """Refuse to package a vendored tree whose local patches are missing.

    vendor/ is regenerated wholesale on a platform upgrade, which silently drops
    every patch stored under .smoke/platform-patches/. Shipping that produces a
    build whose old-session history cannot load, so this is a hard gate rather
    than a warning."""
    import importlib.util
    module_path = os.path.join(root, ".smoke", "platform-patches.py")
    spec = importlib.util.spec_from_file_location("platform_patches", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if module.run("verify") != 0:
        raise SystemExit(
            "vendored platform patches are missing or drifted; "
            "run `python .smoke/platform-patches.py apply` (and re-derive if it reports a version change)"
        )

# Verify BEFORE opening the output archive: raising inside the `with` would leave
# a truncated dsh-vscode.vsix behind, which looks like a build artifact.
verify_platform_patches(ROOT)

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=1) as zf:
    ensure_ripgrep(ROOT)
    zf.write(os.path.join(ROOT, ".smoke", "meta", "[Content_Types].xml"), "[Content_Types].xml")
    zf.write(os.path.join(ROOT, ".smoke", "meta", "extension.vsixmanifest"), "extension.vsixmanifest")
    add(zf, os.path.join(ROOT, "package.json"), "extension/package.json")
    add(zf, os.path.join(ROOT, "README.md"), "extension/readme.md")
    add(zf, os.path.join(ROOT, "LICENSE"), "extension/LICENSE.txt")
    add(zf, os.path.join(ROOT, "src", "extension.js"), "extension/src/extension.js")
    add(zf, os.path.join(ROOT, "media", "dsh.svg"), "extension/media/dsh.svg")
    vend = os.path.join(ROOT, "vendor")
    for dirpath, dirnames, filenames in os.walk(vend):
        # drop only leftover shim dirs, never the node_modules tree itself
        dirnames[:] = [d for d in dirnames if d != ".bin"]
        for name in filenames:
            if name.endswith(".map"):
                continue
            src = os.path.join(dirpath, name)
            rel = os.path.relpath(src, ROOT).replace(os.sep, "/")
            add(zf, src, "extension/" + rel)
    # Baked-in offline ecosystem plugins (self-contained bundle-root packages;
    # each root carries its own nested node_modules; see selfcontained-plugins.mjs)
    plugs = os.path.join(ROOT, "plugins", "bundled")
    if os.path.isdir(plugs):
        for dirpath, dirnames, filenames in os.walk(plugs):
            dirnames[:] = [d for d in dirnames if d not in (".bin",)]
            for name in filenames:
                if name.endswith(".map"):
                    continue
                src = os.path.join(dirpath, name)
                rel = os.path.relpath(src, ROOT).replace(os.sep, "/")
                add(zf, src, "extension/" + rel)
    # Baked-in offline agent-presets (dsh-routing-suite preset/ folders).
    pres = os.path.join(ROOT, "plugins", "presets")
    if os.path.isdir(pres):
        for dirpath, dirnames, filenames in os.walk(pres):
            for name in filenames:
                src = os.path.join(dirpath, name)
                rel = os.path.relpath(src, ROOT).replace(os.sep, "/")
                add(zf, src, "extension/" + rel)

print(f"DONE {count} files, {time.time()-t0:.0f}s, size={os.path.getsize(OUT)//(1024*1024)}MB", flush=True)