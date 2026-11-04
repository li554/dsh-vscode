#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PPT Master - Contact Sheet Builder

Packs all rendered inspection pages into a single grid image so a reviewer can
scan the whole deck in ONE image read instead of N.

WHY
    The visual inspection gate requires looking at every page. Reading 15 images
    one at a time is 15 tool calls and a lot of context. A contact sheet is one
    call, and the pages stay legible at ~600px wide (enough to spot overflow,
    collisions, and clipped content). It does NOT replace per-page inspection
    when a defect is suspected -- it makes the first pass cheap so that the
    expensive per-page look happens only where it is needed.

USAGE
    python3 build_contact_sheet.py <project_path>
    python3 build_contact_sheet.py <project_path> --cols 3 --width 640
    python3 build_contact_sheet.py <project_path> --out inspection/contact.png

    # also emit per-row strips (useful when a single sheet gets too tall)
    python3 build_contact_sheet.py <project_path> --rows

Dependencies: Pillow (PIL).
"""

from __future__ import annotations

import argparse
import glob
import os
import sys
from typing import List, Optional, Sequence

DEFAULT_COLS = 3
DEFAULT_TILE_W = 620
LABEL_H = 26
PAD = 10


def build(pages: List[str], out_path: str, cols: int = DEFAULT_COLS,
          tile_w: int = DEFAULT_TILE_W, label: bool = True) -> str:
    from PIL import Image, ImageDraw

    if not pages:
        raise ValueError('no pages to place')

    ims = []
    for p in pages:
        im = Image.open(p).convert('RGB')
        ims.append((os.path.basename(p), im))

    ar = ims[0][1].height / float(ims[0][1].width)
    tile_h = int(tile_w * ar)
    rows = (len(ims) + cols - 1) // cols
    lh = LABEL_H if label else 0

    W = cols * tile_w + (cols + 1) * PAD
    H = rows * (tile_h + lh) + (rows + 1) * PAD
    sheet = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(sheet)

    for i, (name, im) in enumerate(ims):
        r, c = divmod(i, cols)
        x = PAD + c * (tile_w + PAD)
        y = PAD + r * (tile_h + lh + PAD)
        sheet.paste(im.resize((tile_w, tile_h), Image.LANCZOS), (x, y + lh))
        if label:
            d.text((x + 4, y + 6), name[:52], fill='black')

    sheet.save(out_path)
    return out_path


def main(argv: Optional[Sequence[str]] = None) -> int:
    ap = argparse.ArgumentParser(description='Build a contact sheet from rendered pages.')
    ap.add_argument('project_path')
    ap.add_argument('--dir', default='inspection', help='subdir holding rendered PNGs')
    ap.add_argument('--out', default=None, help='output PNG path')
    ap.add_argument('--cols', type=int, default=DEFAULT_COLS)
    ap.add_argument('--width', type=int, default=DEFAULT_TILE_W, help='tile width in px')
    ap.add_argument('--no-label', action='store_true', help='omit filenames')
    ap.add_argument('--rows', action='store_true', help='also emit one strip per row')
    args = ap.parse_args(argv)

    src = os.path.join(args.project_path, args.dir)
    pages = sorted(glob.glob(os.path.join(src, '*.png')))
    pages = [p for p in pages if 'contact' not in os.path.basename(p).lower()]
    if not pages:
        print('No rendered PNGs in %s -- run render_inspection.py first.' % src,
              file=sys.stderr)
        return 2

    out = args.out or os.path.join(src, 'contact_sheet.png')
    build(pages, out, args.cols, args.width, not args.no_label)
    from PIL import Image
    im = Image.open(out)
    print('contact sheet: %d page(s) -> %s  (%dx%d, %.2f MB)'
          % (len(pages), out, im.width, im.height, os.path.getsize(out) / 1e6))

    if args.rows:
        per = args.cols
        for i in range(0, len(pages), per):
            chunk = pages[i:i + per]
            rp = os.path.join(src, 'contact_row%02d.png' % (i // per + 1))
            build(chunk, rp, len(chunk), args.width, not args.no_label)
            print('  row strip: %s' % rp)
    return 0


if __name__ == '__main__':
    sys.exit(main())
