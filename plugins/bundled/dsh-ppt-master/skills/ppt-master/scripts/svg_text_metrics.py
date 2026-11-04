#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PPT Master - SVG Text Metrics & Fit Auditor

Exact text measurement for SVG authoring, using real font metrics.

WHY THIS EXISTS
    Hand-estimating text width ("30 CJK glyphs x 36px = 1080") is systematically
    wrong for mixed CJK / Latin / digit strings, because a CJK glyph and a Latin
    letter have different advances. That estimate error is the single largest
    source of layout defects (text past its card, text over a figure, labels
    colliding). This tool computes the real advance instead of guessing.

RELATIONSHIP TO OTHER TOOLS
    - svg_position_calculator.py : chart coordinate geometry (bar/pie/line/grid)
    - svg_text_metrics.py        : text advance width + fit/containment audit
    - svg_quality_checker.py     : spec_lock drift, banned features, viewBox

USAGE
    # Exact width of one string
    python3 svg_text_metrics.py width --text "角的平分线" --size 32

    # Does it fit between x and a right boundary?
    python3 svg_text_metrics.py fit --text "..." --size 32 --x 164 --right 1204

    # Widest string that fits a given width (authoring aid)
    python3 svg_text_metrics.py budget --size 24 --width 320

    # Greedy wrap for a fixed column width
    python3 svg_text_metrics.py wrap --text "..." --size 24 --width 320

    # Audit a whole file: canvas margins, card containment, text collisions
    python3 svg_text_metrics.py audit <svg_file|directory>

EXIT CODES
    0 = clean, 1 = issues found (for `fit` / `audit`)

Dependencies: Pillow (PIL). Falls back to a conservative metric estimate if
Pillow or the expected fonts are unavailable.
"""

from __future__ import annotations

import argparse
import glob
import os
import re
import sys
from typing import Dict, List, Optional, Sequence, Tuple

# --------------------------------------------------------------------------
# Font resolution
# --------------------------------------------------------------------------
# Advance widths differ per family, so the family stack matters. We resolve the
# stack to the first font file actually present on this machine.
_FONT_CANDIDATES: Dict[str, List[str]] = {
    'simhei': [
        r'C:\Windows\Fonts\simhei.ttf',
        '/usr/share/fonts/truetype/arphic/uming.ttc',
        '/System/Library/Fonts/STHeiti Medium.ttc',
    ],
    'yahei': [
        r'C:\Windows\Fonts\msyh.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        '/System/Library/Fonts/PingFang.ttc',
    ],
    'yahei-bold': [
        r'C:\Windows\Fonts\msyhbd.ttc',
        r'C:\Windows\Fonts\msyh.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    ],
    'latin': [
        r'C:\Windows\Fonts\arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
    ],
}

# Conservative fallback ratios (advance / font-size) when no font file is usable.
_FALLBACK_RATIO = {'cjk': 1.00, 'latin': 0.70, 'digit': 0.60, 'space': 0.28, 'punct': 0.50}

_FONT_CACHE: Dict[Tuple[str, int], object] = {}
_FONT_PATH_CACHE: Dict[str, Optional[str]] = {}


def _find_font_file(key: str) -> Optional[str]:
    if key in _FONT_PATH_CACHE:
        return _FONT_PATH_CACHE[key]
    found = None
    for cand in _FONT_CANDIDATES.get(key, []):
        if os.path.exists(cand):
            found = cand
            break
    _FONT_PATH_CACHE[key] = found
    return found


def _pick_key(family: str, bold: bool) -> str:
    """Map a CSS font stack to one of our font keys."""
    fam = (family or '').lower()
    if 'simhei' in fam or 'heiti' in fam:
        return 'simhei'
    if 'yahei' in fam or 'pingfang' in fam or 'noto sans cjk' in fam or 'uming' in fam:
        return 'yahei-bold' if bold else 'yahei'
    # No CJK family named: still need CJK coverage for Chinese text, so prefer a
    # CJK font when the string contains CJK (decided by caller); here default to
    # the Latin face.
    return 'latin'


def _load_font(key: str, size: int):
    cache_key = (key, int(round(size)))
    if cache_key in _FONT_CACHE:
        return _FONT_CACHE[cache_key]
    path = _find_font_file(key)
    font = None
    if path:
        try:
            from PIL import ImageFont
            font = ImageFont.truetype(path, max(1, int(round(size))))
        except Exception:
            font = None
    _FONT_CACHE[cache_key] = font
    return font


def _is_cjk(ch: str) -> bool:
    o = ord(ch)
    return (0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF or
            0x3000 <= o <= 0x303F or 0xFF00 <= o <= 0xFFEF or
            0x2E80 <= o <= 0x2EFF)


def text_width(text: str, size: float, family: str = 'Microsoft YaHei',
               bold: bool = False) -> float:
    """Advance width of `text` in px at `size`, using real font metrics."""
    if not text:
        return 0.0

    has_cjk = any(_is_cjk(c) for c in text)
    key = _pick_key(family, bold)
    # If the string has CJK but the resolved family is Latin-only, use a CJK
    # face so the CJK glyphs are measured with the font that will render them.
    if has_cjk and key == 'latin':
        key = 'yahei-bold' if bold else 'yahei'

    font = _load_font(key, size)
    if font is not None:
        try:
            return float(font.getlength(text))
        except Exception:
            pass

    # Fallback: per-character ratio estimate (conservative / slightly wide).
    total = 0.0
    for ch in text:
        if _is_cjk(ch):
            r = _FALLBACK_RATIO['cjk']
        elif ch.isdigit():
            r = _FALLBACK_RATIO['digit']
        elif ch == ' ':
            r = _FALLBACK_RATIO['space']
        elif ch.isascii() and (ch.isalpha() or ch in '.,;:!?()[]{}<>/\\|-_+=*&^%$#@~`"\''):
            r = _FALLBACK_RATIO['latin'] if ch.isalpha() else _FALLBACK_RATIO['punct']
        else:
            r = _FALLBACK_RATIO['cjk']
        total += r * size
    return total


def describe_fonts() -> List[Tuple[str, str]]:
    out = []
    for key in _FONT_CANDIDATES:
        path = _find_font_file(key)
        out.append((key, path or '(not found - fallback estimate in use)'))
    return out


# --------------------------------------------------------------------------
# SVG parsing helpers
# --------------------------------------------------------------------------
_ENTITIES = [('&lt;', '<'), ('&gt;', '>'), ('&quot;', '"'),
             ('&apos;', "'"), ('&amp;', '&')]


def _unescape(s: str) -> str:
    for a, b in _ENTITIES:
        s = s.replace(a, b)
    return s


def _attr(attrs: str, name: str) -> Optional[str]:
    m = re.search(r'\b%s="([^"]*)"' % re.escape(name), attrs)
    return m.group(1) if m else None


def _num(attrs: str, name: str, default: Optional[float] = None) -> Optional[float]:
    v = _attr(attrs, name)
    if v is None:
        return default
    try:
        return float(v)
    except ValueError:
        return default


class TextBox:
    __slots__ = ('text', 'x1', 'x2', 'y1', 'y2', 'y', 'size', 'anchor', 'line')

    def __init__(self, text, x1, x2, y1, y2, y, size, anchor, line):
        self.text, self.x1, self.x2 = text, x1, x2
        self.y1, self.y2, self.y = y1, y2, y
        self.size, self.anchor, self.line = size, anchor, line

    def __repr__(self):
        return '<TextBox y=%g x=%g..%g %r>' % (self.y, self.x1, self.x2, self.text[:24])


def parse_text_boxes(src: str, default_family: str = 'Microsoft YaHei') -> List[TextBox]:
    """Extract every <text> element with its computed horizontal extent.

    Handles nested <tspan> runs that change font-size / weight, summing each
    run's advance at its own size.
    """
    boxes: List[TextBox] = []
    for m in re.finditer(r'<text\b([^>]*)>(.*?)</text>', src, re.S):
        attrs, body = m.group(1), m.group(2)
        x = _num(attrs, 'x')
        y = _num(attrs, 'y')
        if x is None or y is None:
            continue
        base_size = _num(attrs, 'size') or _num(attrs, 'font-size', 24.0)
        base_fam = _attr(attrs, 'font-family') or default_family
        base_bold = 'bold' in (attrs or '')
        anchor = _attr(attrs, 'text-anchor') or 'start'

        # Split into runs: plain text + <tspan ...>inner</tspan>
        width = 0.0
        plain_parts: List[str] = []
        pos = 0
        for tm in re.finditer(r'<tspan\b([^>]*)>(.*?)</tspan>', body, re.S):
            pre = body[pos:tm.start()]
            if pre:
                pre_t = _unescape(re.sub(r'<[^>]+>', '', pre))
                plain_parts.append(pre_t)
                width += text_width(pre_t, base_size, base_fam, base_bold)
            t_attrs, t_body = tm.group(1), tm.group(2)
            t_size = _num(t_attrs, 'font-size', base_size) or base_size
            t_fam = _attr(t_attrs, 'font-family') or base_fam
            t_bold = base_bold or ('bold' in (t_attrs or ''))
            t_text = _unescape(re.sub(r'<[^>]+>', '', t_body))
            plain_parts.append(t_text)
            width += text_width(t_text, t_size, t_fam, t_bold)
            pos = tm.end()
        tail = body[pos:]
        if tail:
            tail_t = _unescape(re.sub(r'<[^>]+>', '', tail))
            plain_parts.append(tail_t)
            width += text_width(tail_t, base_size, base_fam, base_bold)

        plain = ''.join(plain_parts)
        if not plain.strip():
            continue

        if anchor == 'middle':
            x1, x2 = x - width / 2.0, x + width / 2.0
        elif anchor == 'end':
            x1, x2 = x - width, x
        else:
            x1, x2 = x, x + width

        line = src[:m.start()].count('\n') + 1
        boxes.append(TextBox(plain, x1, x2, y - 0.80 * base_size,
                             y + 0.22 * base_size, y, base_size, anchor, line))
    return boxes


# --- rounded-rect / rect containers ---------------------------------------
_NUM_RE = re.compile(r'-?\d+(?:\.\d+)?')


def _path_bbox(d: str) -> Optional[Tuple[float, float, float, float]]:
    """Bounding box of an axis-aligned / rounded-rect path.

    Handles BOTH absolute (uppercase) and relative (lowercase) commands --
    the pipeline emits both forms for rounded rects, and treating `h 136`
    as absolute puts the box at x=-184 instead of x=76.
    """
    tokens = re.findall(r'[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?', d)
    if not tokens:
        return None

    PARAMS = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4,
              'Q': 4, 'T': 2, 'A': 7, 'Z': 0}

    cx = cy = sx = sy = 0.0
    xs: List[float] = []
    ys: List[float] = []
    cmd: Optional[str] = None
    nums: List[float] = []
    k = 0

    while k < len(tokens):
        t = tokens[k]
        if re.match(r'[A-Za-z]', t):
            cmd = t
            k += 1
            nums = []
            if cmd.upper() == 'Z':
                cx, cy = sx, sy
                xs.append(cx)
                ys.append(cy)
            continue

        nums.append(float(t))
        k += 1
        if cmd is None:
            continue

        up = cmd.upper()
        rel = cmd.islower()
        need = PARAMS.get(up, 2)
        if need == 0 or len(nums) < need:
            continue

        if up == 'M':
            cx, cy = (nums[0], nums[1]) if not rel else (cx + nums[0], cy + nums[1])
            sx, sy = cx, cy
            # subsequent pairs after M behave as implicit lineto
            cmd = 'l' if rel else 'L'
        elif up == 'L':
            cx, cy = (nums[0], nums[1]) if not rel else (cx + nums[0], cy + nums[1])
        elif up == 'H':
            cx = nums[0] if not rel else cx + nums[0]
        elif up == 'V':
            cy = nums[0] if not rel else cy + nums[0]
        elif up in ('C', 'S', 'Q', 'T', 'A'):
            ex, ey = nums[-2], nums[-1]
            cx, cy = (ex, ey) if not rel else (cx + ex, cy + ey)
        else:
            cx, cy = (nums[0], nums[1]) if not rel else (cx + nums[0], cy + nums[1])

        xs.append(cx)
        ys.append(cy)
        nums = nums[need:]

    if not xs:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def parse_shape_bboxes(src: str, canvas_w: float = 1280.0,
                       canvas_h: float = 720.0) -> List[Tuple[float, float, float, float]]:
    """Bounding boxes of EVERY drawn shape (line / rect / circle / path / poly).

    Used by the bottom safe-area check: an occluding device UI (Seewo / 希沃
    whiteboard toolbar, laptop taskbar on a mirrored projector) covers the
    bottom strip of the slide, so *anything* drawn there -- text, figure
    geometry, cards, decorative bars -- is at risk, not just text. The
    full-canvas background rect is excluded (it is meant to reach the edges).
    """
    out: List[Tuple[float, float, float, float]] = []

    def add(x1: float, y1: float, x2: float, y2: float):
        # full-canvas background is intentional, not content
        if (x2 - x1) >= canvas_w - 2 and (y2 - y1) >= canvas_h - 2:
            return
        out.append((min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)))

    for m in re.finditer(r'<line\b([^>]*?)/?>', src):
        a = m.group(1)
        add(_num(a, 'x1', 0.0) or 0.0, _num(a, 'y1', 0.0) or 0.0,
            _num(a, 'x2', 0.0) or 0.0, _num(a, 'y2', 0.0) or 0.0)

    for m in re.finditer(r'<rect\b([^>]*?)/?>', src):
        a = m.group(1)
        x = _num(a, 'x', 0.0) or 0.0
        y = _num(a, 'y', 0.0) or 0.0
        add(x, y, x + (_num(a, 'width', 0.0) or 0.0),
            y + (_num(a, 'height', 0.0) or 0.0))

    for m in re.finditer(r'<circle\b([^>]*?)/?>', src):
        a = m.group(1)
        cx = _num(a, 'cx', 0.0) or 0.0
        cy = _num(a, 'cy', 0.0) or 0.0
        r = _num(a, 'r', 0.0) or 0.0
        add(cx - r, cy - r, cx + r, cy + r)

    for m in re.finditer(r'<(?:polygon|polyline)\b([^>]*?)/?>', src):
        pts = _attr(m.group(1), 'points') or ''
        nums = [float(v) for v in _NUM_RE.findall(pts)]
        if len(nums) >= 4:
            xs, ys = nums[0::2], nums[1::2]
            add(min(xs), min(ys), max(xs), max(ys))

    for m in re.finditer(r'<path\b([^>]*?)/?>', src):
        d = _attr(m.group(1), 'd')
        if not d:
            continue
        bb = _path_bbox(d)
        if bb:
            add(*bb)

    return out


def parse_containers(src: str, canvas_w: float = 1280.0,
                     canvas_h: float = 720.0) -> List[Tuple[float, float, float, float]]:
    """Bounding boxes of card-like containers (filled rounded rects / rects).

    Excludes the full-canvas background and thin accent bars: a card must be a
    substantial panel that plausibly owns body text.
    """
    out: List[Tuple[float, float, float, float]] = []
    seen = set()

    def consider(x1: float, y1: float, x2: float, y2: float):
        w, h = x2 - x1, y2 - y1
        if w < 120 or h < 60:
            return
        # full-canvas background is not a card
        if w >= canvas_w - 2 and h >= canvas_h - 2:
            return
        key = (round(x1), round(y1), round(x2), round(y2))
        if key in seen:
            return
        seen.add(key)
        out.append((x1, y1, x2, y2))

    for m in re.finditer(r'<path\b([^>]*?)/?>', src):
        attrs = m.group(1)
        d = _attr(attrs, 'd')
        if not d:
            continue
        fill = _attr(attrs, 'fill') or ''
        if fill.lower() in ('none', '') or 'url(' in fill:
            continue
        bb = _path_bbox(d)
        if bb:
            consider(*bb)

    for m in re.finditer(r'<rect\b([^>]*?)/?>', src):
        attrs = m.group(1)
        x = _num(attrs, 'x', 0.0) or 0.0
        y = _num(attrs, 'y', 0.0) or 0.0
        w = _num(attrs, 'width', 0.0) or 0.0
        h = _num(attrs, 'height', 0.0) or 0.0
        fill = _attr(attrs, 'fill') or ''
        if fill.lower() in ('none', '') or 'url(' in fill:
            continue
        consider(x, y, x + w, y + h)

    return out


# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------
DEFAULT_MARGIN = 60.0


def _overlap(a: TextBox, b: TextBox, tol: float) -> bool:
    return (a.x1 < b.x2 - tol and b.x1 < a.x2 - tol and
            a.y1 < b.y2 - tol and b.y1 < a.y2 - tol)


def audit_file(path: str, canvas_w: float = 1280, canvas_h: float = 720,
               margin: float = DEFAULT_MARGIN, pad: float = 8.0,
               verbose: bool = False,
               safe_bottom: Optional[float] = None) -> Dict[str, List[str]]:
    src = open(path, encoding='utf-8').read()
    boxes = parse_text_boxes(src)
    containers = parse_containers(src)
    res: Dict[str, List[str]] = {'clip': [], 'margin': [], 'container': [],
                                 'overlap': [], 'bottom': []}

    for b in boxes:
        # 1. Hard clip: text runs off the canvas entirely.
        if b.x2 > canvas_w + 0.5 or b.x1 < -0.5:
            res['clip'].append('L%d clipped: right=%.0f (canvas %d)  %r'
                               % (b.line, b.x2, canvas_w, b.text[:44]))
        elif b.x2 > canvas_w - margin + 0.5 or b.x1 < margin - 0.5:
            res['margin'].append('L%d past safe margin: %.0f..%.0f  %r'
                                 % (b.line, b.x1, b.x2, b.text[:44]))
        if b.y2 > canvas_h + 0.5 or b.y1 < -0.5:
            res['clip'].append('L%d clipped vertically: y=%.0f  %r'
                               % (b.line, b.y, b.text[:44]))

    # 2. Container containment: text whose baseline sits in a card must fit it.
    #    Ownership rule: the text must START inside the card horizontally
    #    (within a small inset). Text beginning to the right of a card belongs
    #    to the page, not to that card -- without this, every right-hand column
    #    is falsely reported against the left-hand card.
    for b in boxes:
        for (cx1, cy1, cx2, cy2) in containers:
            if not (cy1 - 2 <= b.y <= cy2 + 2):
                continue
            if not (cx1 - 4 <= b.x1 <= cx2):
                continue
            if b.x2 > cx2 - pad:
                res['container'].append(
                    'L%d overflows card by %.0fpx (card right=%.0f, text right=%.0f)  %r'
                    % (b.line, b.x2 - (cx2 - pad), cx2, b.x2, b.text[:40]))
            if b.x1 < cx1 + pad - 1:
                res['container'].append(
                    'L%d starts left of card by %.0fpx  %r'
                    % (b.line, (cx1 + pad) - b.x1, b.text[:40]))
            break

    # 3. Text-text collision (ignore same-line neighbours sharing a baseline).
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            if abs(a.y - b.y) < 1.0:
                continue
            if _overlap(a, b, tol=2.0):
                res['overlap'].append('L%d/L%d overlap  %r  <>  %r'
                                      % (a.line, b.line, a.text[:26], b.text[:26]))

    # 4. Bottom safe area: an occluding device UI covers the bottom strip.
    #    ANY drawn shape or text counts here -- a figure, card, accent bar or
    #    footer reaching into the strip is hidden exactly the same way.
    if safe_bottom is not None:
        worst = None
        cand = list(parse_shape_bboxes(src, canvas_w, canvas_h))
        cand += [(b.x1, b.y1, b.x2, b.y2) for b in boxes]
        for (x1, y1, x2, y2) in cand:
            if y2 > safe_bottom + 0.5:
                if worst is None or y2 > worst[4]:
                    worst = (x1, y1, x2, y2, y2)
        if worst is not None:
            x1, y1, x2, y2, low = worst
            res['bottom'].append(
                'content reaches y=%.0f, past safe bottom %.0f (over by %.0f)  '
                'box x %.0f..%.0f y %.0f..%.0f'
                % (low, safe_bottom, low - safe_bottom, x1, x2, y1, y2))
    return res


# --------------------------------------------------------------------------
# Wrap / budget
# --------------------------------------------------------------------------
_BREAK_AFTER = set('，。、；：！？）】》」』%,.;:!?)]}>')
_BREAK_BEFORE = set('（【《「『([{<')


def wrap_text(text: str, size: float, width: float, family: str = 'Microsoft YaHei',
              bold: bool = False) -> List[str]:
    """Greedy wrap that respects CJK break opportunities and Latin words."""
    lines: List[str] = []
    cur = ''
    i = 0
    while i < len(text):
        ch = text[i]
        # keep Latin/digit runs atomic
        if ch.isascii() and (ch.isalnum() or ch in '.-_/'):
            j = i
            while j < len(text) and text[j].isascii() and (text[j].isalnum() or text[j] in '.-_/'):
                j += 1
            token = text[i:j]
        else:
            token = ch
            j = i + 1

        trial = cur + token
        if text_width(trial, size, family, bold) <= width or not cur:
            cur = trial
            i = j
        else:
            # break before a closing punctuation? move it down with the line above
            if token and token[0] in _BREAK_BEFORE and cur:
                lines.append(cur)
                cur = token
                i = j
            else:
                lines.append(cur)
                cur = ''
    if cur:
        lines.append(cur)
    return lines


def budget_chars(size: float, width: float, family: str = 'Microsoft YaHei',
                 bold: bool = False, sample: str = '角') -> int:
    """How many glyphs of `sample` fit in `width` at `size`."""
    one = text_width(sample, size, family, bold)
    if one <= 0:
        return 0
    return int(width // one)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def main(argv: Optional[Sequence[str]] = None) -> int:
    ap = argparse.ArgumentParser(
        description='Exact SVG text measurement and fit auditing (real font metrics).',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)

    p = sub.add_parser('width', help='exact advance width of a string')
    p.add_argument('--text', required=True)
    p.add_argument('--size', type=float, required=True)
    p.add_argument('--family', default='Microsoft YaHei')
    p.add_argument('--bold', action='store_true')

    p = sub.add_parser('fit', help='does the string fit a box?')
    p.add_argument('--text', required=True)
    p.add_argument('--size', type=float, required=True)
    p.add_argument('--x', type=float, required=True)
    p.add_argument('--right', type=float, default=1220.0)
    p.add_argument('--left', type=float, default=60.0)
    p.add_argument('--family', default='Microsoft YaHei')
    p.add_argument('--bold', action='store_true')
    p.add_argument('--anchor', default='start', choices=['start', 'middle', 'end'])

    p = sub.add_parser('budget', help='max glyphs that fit a width')
    p.add_argument('--size', type=float, required=True)
    p.add_argument('--width', type=float, required=True)
    p.add_argument('--family', default='Microsoft YaHei')
    p.add_argument('--bold', action='store_true')
    p.add_argument('--sample', default='角')

    p = sub.add_parser('wrap', help='greedy wrap to a column width')
    p.add_argument('--text', required=True)
    p.add_argument('--size', type=float, required=True)
    p.add_argument('--width', type=float, required=True)
    p.add_argument('--family', default='Microsoft YaHei')
    p.add_argument('--bold', action='store_true')

    p = sub.add_parser('audit', help='audit SVG file(s) for fit problems')
    p.add_argument('target', help='svg file or directory')
    p.add_argument('--canvas', default='1280x720')
    p.add_argument('--margin', type=float, default=DEFAULT_MARGIN)
    p.add_argument('--pad', type=float, default=8.0)
    p.add_argument('--quiet-margin', action='store_true',
                   help='hide safe-margin warnings, show only clip/container/overlap')
    p.add_argument('--safe-bottom', type=float, default=None,
                   help='bottom safe-area line in px (e.g. 585). Any shape drawn '
                        'below it is reported as [bottom] -- use for decks shown '
                        'behind an occluding device UI (Seewo / 希沃 whiteboard, '
                        'taskbar on a mirrored projector)')
    p.add_argument('--json', action='store_true')

    p = sub.add_parser('fonts', help='show resolved font files')

    args = ap.parse_args(argv)

    if args.cmd == 'fonts':
        for k, v in describe_fonts():
            print('%-12s %s' % (k, v))
        return 0

    if args.cmd == 'width':
        w = text_width(args.text, args.size, args.family, args.bold)
        print('%.1f' % w)
        return 0

    if args.cmd == 'fit':
        w = text_width(args.text, args.size, args.family, args.bold)
        if args.anchor == 'middle':
            x1, x2 = args.x - w / 2, args.x + w / 2
        elif args.anchor == 'end':
            x1, x2 = args.x - w, args.x
        else:
            x1, x2 = args.x, args.x + w
        ok = (x2 <= args.right + 0.5) and (x1 >= args.left - 0.5)
        print('width   : %.1f px' % w)
        print('extent  : %.1f .. %.1f' % (x1, x2))
        print('bounds  : %.1f .. %.1f  (usable %.1f)' % (args.left, args.right, args.right - args.left))
        print('verdict : %s%s' % ('FITS' if ok else 'DOES NOT FIT',
                                  '' if ok else '  (over by %.0f)' % max(x2 - args.right, args.left - x1)))
        return 0 if ok else 1

    if args.cmd == 'budget':
        n = budget_chars(args.size, args.width, args.family, args.bold)
        one = text_width(args.sample, args.size, args.family, args.bold)
        print('at size %g, one %r = %.1f px' % (args.size, args.sample, one))
        print('max glyphs in %.0f px: %d' % (args.width, n))
        return 0

    if args.cmd == 'wrap':
        lines = wrap_text(args.text, args.size, args.width, args.family, args.bold)
        for i, l in enumerate(lines, 1):
            print('%2d | %-40s | %.1f px' % (i, l, text_width(l, args.size, args.family, args.bold)))
        print('-> %d line(s)' % len(lines))
        return 0

    if args.cmd == 'audit':
        try:
            cw, ch = (float(v) for v in args.canvas.lower().split('x'))
        except Exception:
            cw, ch = 1280.0, 720.0

        target = args.target
        if os.path.isdir(target):
            files = sorted(glob.glob(os.path.join(target, '*.svg')))
        else:
            files = [target]
        if not files:
            print('no SVG files found at %s' % target, file=sys.stderr)
            return 2

        total_issues = 0
        for f in files:
            res = audit_file(f, cw, ch, args.margin, args.pad,
                             safe_bottom=args.safe_bottom)
            keys = ['clip', 'container', 'overlap', 'bottom']
            if not args.quiet_margin:
                keys.append('margin')
            n = sum(len(res[k]) for k in keys)
            if n:
                print('=== %s ===' % os.path.basename(f))
                for k in keys:
                    for line in res[k]:
                        print('  [%s] %s' % (k, line))
                print()
            total_issues += n

        if total_issues == 0:
            print('No fit issues found in %d file(s).' % len(files))
            return 0
        print('%d issue(s) across %d file(s).' % (total_issues, len(files)))
        return 1

    return 2


if __name__ == '__main__':
    sys.exit(main())
