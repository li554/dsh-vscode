#!/usr/bin/env python3
"""Render finalized SVG pages to PNG for the mandatory visual inspection gate (Step 7.3).

Usage:
    python scripts/render_inspection.py <project_path> [--scale 1.5] [--out inspection] [--pages 04 07]

Reads <project_path>/svg_final/*.svg (run finalize_svg.py first), renders each page
at its own viewBox size x scale into <project_path>/<out>/<stem>.png, then prints
the inspection checklist. The agent MUST view every PNG with its vision tool and
check each page for:

  1. Text overlapping other text, icons, shapes, or lines
  2. Text extending past its container (card / chip / band) or the canvas edge
  3. Clipped or hidden text (badges covering digits, labels covered by chips)
  4. Figure / label collisions in diagrams
  5. Missing glyphs (tofu boxes)

Fix any issue in `svg_output/` (NEVER edit svg_final/ or the PNGs), re-run
finalize_svg.py, then re-render the changed pages with --pages <NN> and re-view
them. The gate passes only when every page is clean; only then run svg_to_pptx.py.

Exit codes: 0 = rendered, 2 = no svg_final/ found, 3 = playwright unavailable.
"""

import argparse
import re
import sys
from pathlib import Path


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    ap = argparse.ArgumentParser(description="Render finalized SVG pages to PNG for visual inspection")
    ap.add_argument("project", help="project path")
    ap.add_argument("--scale", type=float, default=1.5, help="device scale factor (default 1.5)")
    ap.add_argument("--out", default="inspection", help="output dir name under project (default inspection)")
    ap.add_argument("--pages", nargs="*", default=None,
                    help="page numbers or stems to (re-)render, e.g. 04 07 or 04_例题; default all")
    args = ap.parse_args()

    project = Path(args.project).resolve()
    src = project / "svg_final"
    out = project / args.out

    if not src.is_dir() or not any(src.glob("*.svg")):
        print("[ERR] no SVG files in svg_final/ - run finalize_svg.py first", file=sys.stderr)
        return 2

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[ERR] playwright not installed. Run: pip install playwright && playwright install chromium",
              file=sys.stderr)
        print("(fallback: open each page in the live preview server and screenshot manually, "
              "but the mandatory visual inspection gate still applies)", file=sys.stderr)
        return 3

    svgs = sorted(src.glob("*.svg"))
    if args.pages:
        keys = set(args.pages) | {p.lstrip("0") or "0" for p in args.pages}
        selected = [s for s in svgs if s.stem in keys or s.stem.split("_", 1)[0] in keys]
        if not selected:
            print(f"[ERR] --pages {args.pages} matched none of {len(svgs)} page(s)", file=sys.stderr)
            return 2
        svgs = selected

    out.mkdir(parents=True, exist_ok=True)
    vb_re = re.compile(r'viewBox\s*=\s*"0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)')

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for svg in svgs:
            m = vb_re.search(svg.read_text(encoding="utf-8", errors="ignore")[:4000])
            w, h = (float(m.group(1)), float(m.group(2))) if m else (1280.0, 720.0)
            page = browser.new_page(viewport={"width": int(w), "height": int(h)},
                                    device_scale_factor=args.scale)
            page.goto(svg.as_uri())
            page.wait_for_timeout(300)
            png = out / (svg.stem + ".png")
            page.screenshot(path=str(png))
            page.close()
            print(f"[OK] {svg.stem} -> {png}")
        browser.close()

    print(f"[DONE] {len(svgs)} page(s) rendered to {out}/")
    print("[NEXT] View EVERY png with the vision tool and check per page:")
    print("  1. text overlapping text / icons / shapes / lines")
    print("  2. text past its container (card / chip / band) or the canvas edge")
    print("  3. clipped or hidden text (badges covering digits, chips covering formulas)")
    print("  4. figure / label collisions in diagrams; missing glyphs (tofu)")
    print("Fix in svg_output/ only -> re-run finalize_svg.py -> re-render with --pages <NN> -> re-view.")
    print("Export (svg_to_pptx.py) only after every page is clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
