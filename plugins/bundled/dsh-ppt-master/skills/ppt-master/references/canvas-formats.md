# Canvas Format Specification

> See shared-standards.md for SVG basic rules.

## Format Quick Reference

| Format | viewBox | Ratio | Use Case |
|--------|---------|-------|----------|
| PPT 16:9 | `0 0 1280 720` | 16:9 | Business presentations, meetings |
| PPT 4:3 | `0 0 1024 768` | 4:3 | Traditional projectors, academic talks |
| Xiaohongshu (RED) | `0 0 1242 1660` | 3:4 | Image-text sharing, knowledge posts |
| WeChat Moments / IG | `0 0 1080 1080` | 1:1 | Square posters, brand showcases |
| Story / TikTok | `0 0 1080 1920` | 9:16 | Vertical stories, short video covers |
| WeChat Article Header | `0 0 900 383` | 2.35:1 | WeChat article cover images |
| Landscape Banner | `0 0 1920 1080` | 16:9 | Web banners, digital screens |
| Portrait Poster | `0 0 1080 1920` | 9:16 | Phone screens, elevator ads |
| A4 Print | `0 0 1240 1754` | 1:sqrt(2) | Print posters, flyers |

## Format Selection Decision Tree

```
Content purpose?
├── Presentation
│   ├── Modern devices → PPT 16:9 (1280x720)
│   └── Traditional devices → PPT 4:3 (1024x768)
├── Social sharing
│   ├── Xiaohongshu (RED) → 1242x1660
│   ├── WeChat Moments / IG → 1080x1080
│   └── Story / TikTok → 1080x1920
└── Marketing materials
    ├── WeChat Article Header → 900x383
    ├── Banner → 1920x1080
    └── Print → 1240x1754
```

## Layout Principles

### Landscape (16:9, 4:3, 2.35:1)
- Visual flow: Z-pattern, left to right
- Margins: 40-80px
- Layouts: multi-column, left-right split, grid
- Card dimensions (16:9): single-row 530-600px, double-row 265-295px

### Portrait (3:4, 9:16)
- Visual flow: top to bottom
- Margins: 60-120px
- Layouts: single-column, top-bottom split, card stacking
- Card dimensions (3:4): height 400-600px, gap 40-60px

### Square (1:1)
- Visual flow: center-radiating
- Margins: 60-100px
- Core area: ~800x800px

## Occlusion Safe Area — device UI over the slide (classroom / kiosk)

> **When to apply.** Whenever the deck is presented on a device that draws its own
> UI **on top of** the slide, or on a mirrored display whose chrome overlaps the
> canvas. The common cases: **Seewo / 希沃 whiteboard** (toolbar + page strip along
> the bottom), other interactive whiteboard software, a laptop driving a projector
> in mirror mode (taskbar over the bottom edge), and kiosk / video-wall players
> with a persistent overlay. If the deck is only ever shown full-screen by a
> clean player, skip this section.

The UI is **not part of the slide**, so nothing in the SVG can push it out of the
way — content under it is simply **covered**. Text and figures must therefore be
kept out of the occluded strip by design.

### Reserve the strip, don't fight it

Pick a **bottom safe line** and treat everything below it as unusable. For the
**PPT 16:9 (1280×720)** canvas the recommended value is:

| Target | Bottom safe line | Reserved strip | Notes |
|---|---|---|---|
| PPT 16:9 + Seewo / 希沃 whiteboard | **y ≤ 585** | bottom **135px** | Seewo's toolbar + page strip; the recommended default |
| PPT 16:9 + mirrored laptop projector | y ≤ 640 | bottom 80px | Windows taskbar height |
| PPT 4:3 (1024×768) + Seewo | y ≤ 620 | bottom 148px | same 135px strip, scaled by canvas height |

Rule of thumb: reserve **at least 100px** on 16:9, and scale proportionally for
taller canvases. When in doubt about the venue, use the **585** default — it is
the safest value that still leaves a comfortable content area.

### What goes in the reserved strip: nothing

The strip must be **completely empty**. That includes elements that feel
"decorative" or "structural" and are easy to overlook:

- page numbers and footers / source credits → **move up** to sit just above the line
  (for 1280×720 with a 585 line, put the footer baseline at **y ≈ 570**, leaving
  ~15px of descender room)
- full-height side accent bars and vertical rules → **stop at the safe line**,
  do not run to y=720
- figure geometry, connector lines, and axis labels → keep the whole figure box above the line
- background panels / bands → end above the line

A footer moved from y=578 to y=570 looks identical to the audience and is the
difference between "readable" and "hidden behind a toolbar".

### Enforce it, don't just intend it

Declare the value in `spec_lock.md` under `## canvas` as `safe_area_bottom`, then
verify mechanically — intent alone reliably drifts on the last few pages:

```bash
python scripts/svg_text_metrics.py audit <project>/svg_output --quiet-margin --safe-bottom 585
```

`--safe-bottom` reports a `[bottom]` finding for **any drawn shape or text** whose
box crosses the line, naming the offending extent and the overflow in px. Treat it
as a **hard error** alongside `[clip]` / `[container]` / `[overlap]` — the gate is
not passed while a `[bottom]` finding stands.

> **Why a mechanical check rather than "remember to leave space".** The bottom
> strip is the one region where a page can look perfect in a rendered PNG (the
> white space is genuinely there) and still fail in the room, because the
> occluding UI is not in the render. Only an explicit coordinate check catches a
> footer placed at y=578 on page 3 after 20 pages were fine.

--- 

## Format-specific Design

| Format | Title Area | Content Area | Special Notes |
|--------|-----------|--------------|---------------|
| PPT | 80-100px | Full width utilization | Page number bottom-right |
| Xiaohongshu (RED) | 180-240px (bold) | Generous top/bottom whitespace | Brand area at bottom 120-160px |
| WeChat Moments | 200-280px | Center 500-600px | QR code area at bottom 150-200px |
| Story | — | Middle 1500px | Top safe zone 120px, bottom 180px |
| WeChat Article Header | Center/left-aligned 48-72px | — | Image on right or as background |

> **Body font baseline scales with canvas and delivery purpose** — a PPT 16:9 baseline confirmed for read-close / business / projection cannot be carried onto tall canvases (Xiaohongshu / Story / A4). Pick the baseline from the confirmed canvas, not the recommended one; see the per-canvas px anchors in [`strategist.md`](strategist.md) §g "Font Size Ramp" (the system is px-only — all sizes are unitless px on every canvas).

## ViewBox Examples

```xml
<svg width="1280" height="720" viewBox="0 0 1280 720">   <!-- PPT 16:9 -->
<svg width="1242" height="1660" viewBox="0 0 1242 1660"> <!-- Xiaohongshu -->
<svg width="1080" height="1080" viewBox="0 0 1080 1080"> <!-- WeChat Moments -->
<svg width="1080" height="1920" viewBox="0 0 1080 1920"> <!-- Story -->
<svg width="900" height="383" viewBox="0 0 900 383">     <!-- WeChat Article Header -->
```
