# Page Transitions & Per-Element Animations

PPT Master's exported PPTX supports **page transitions** (slide-to-slide) and **per-element entrance animations** (within a slide). Both are controlled by `svg_to_pptx.py` CLI flags and ship as real OOXML — they animate inside PowerPoint and Keynote, no embedded video.

## Pick a Reveal Preset First (`--reveal`)

Three axes decide how a deck feels when presented: **trigger** (who advances it), **pacing**, and **effect**. Hand-combining the individual flags gets this wrong in a predictable way — the presenter-paced mode is not the default, so a classroom deck silently ships with click-free auto-cascades. Use a **preset** instead: one name that bundles all three.

```bash
python3 scripts/svg_to_pptx.py <project> --reveal lecture
```

| Preset | Trigger | Effect | Use for |
|---|---|---|---|
| **`lecture`** | one click per block | `fade` | **Class teaching / live presenting.** You control the pace; nothing moves until you click. |
| `flow` | click-free cascade | `fade` | Recorded walkthroughs, kiosk / auto-play, self-running demos |
| `static` | — | none | Handouts, reading copies, printing. Each page appears whole. |
| `dramatic` | one click per block | `zoom` | Launch-style reveal where emphasis is the point |

`--reveal auto` resolves from the delivery mode (`--mode`), so the common case needs no thought:

| `--mode` | resolves to | why |
|---|---|---|
| `instructional` | `lecture` | A lesson is presenter-paced by definition |
| `narrative` | `flow` | Story decks read well as a cascade |
| `showcase` | `dramatic` | Launch energy |
| `briefing` / `pyramid` | `static` | Reference material people read at their own pace |

```bash
# Teaching deck: click-paced, no per-flag fiddling
python3 scripts/svg_to_pptx.py <project> --reveal auto --mode instructional

# Explicit flags always beat the preset (mix and match)
python3 scripts/svg_to_pptx.py <project> --reveal lecture -a fade --animation-duration 0.9
```

> **Presets are deliberately restrained.** Only `dramatic` uses anything other than `fade`. An unsolicited flashy cascade (wheel / checkerboard / diamond) is the "AI deck" tell — for teaching, a calm fade keeps attention on the maths, not the motion. An unknown preset name is **rejected by the CLI** (with the valid list), so a typo can never silently ship the wrong pacing; internally the resolver also falls back to `static`, never to something flashy.

> **`lecture` + `--recorded-narration` conflict.** Narrated video needs click-free playback; the exporter rejects that combination. Use `--reveal flow` for narrated exports.

## Defaults

| Layer | Default | Why |
|---|---|---|
| Page transition | `fade`, 0.4s | Calm baseline that suits most decks |
| Per-element animation | **`none` (off)** | A page appears as a whole. Auto-firing element builds are an unsolicited "AI deck" tell, so element entrance is opt-in. Pass `--reveal lecture` (or `-a auto`) to turn it on: effects map from group id (chart→wipe, card-/step-/pillar-→fly, title/takeaway→fade); image-like ids (`hero` / `figure-` / `image` / `img-` / `kpi`) cycle a richer visual pool (zoom / dissolve / circle / box / diamond / wheel) so multiple images vary across the deck; unmatched ids cycle a small fade/wipe/fly/zoom pool |

To regenerate a deck with different settings, rerun `svg_to_pptx.py` against the same `svg_output/` (or `svg_final/`) — no need to rerun the LLM. To turn per-element animation on for the whole deck, pass `--reveal lecture` (or `-a auto`).

## Custom Object-Level Animation

Per-element animation is off by default. To enable it deck-wide, pass `-a auto` at export (no config needed). When a deck instead needs specific object timing — for example title first, chart second, annotation last — use the optional `animations.json` sidecar. The SVG remains static visual source; the sidecar only controls PPTX export behavior.

Run the standalone [`customize-animations`](../workflows/customize-animations.md) workflow when the user asks to tune animation order, effects, timing, or object-level reveals.

```bash
# Build an editable scaffold from real top-level <g id> anchors
python3 skills/ppt-master/scripts/animation_config.py scaffold <project>

# Validate references before export
python3 skills/ppt-master/scripts/animation_config.py validate <project>

# Export reads <project>/animations.json automatically when present
python3 skills/ppt-master/scripts/svg_to_pptx.py <project>
```

Minimal sidecar:

```json
{
  "version": 1,
  "slides": {
    "03_market": {
      "groups": {
        "title": { "effect": "fade", "order": 1 },
        "chart": { "effect": "wipe", "order": 2, "duration": 0.6 },
        "insight": { "effect": "fly", "order": 3, "delay": 0.2 },
        "footer": { "effect": "none" }
      }
    }
  }
}
```

Rules:

- `slides` keys match SVG stems (`03_market.svg` → `03_market`).
- `groups` keys match top-level `<g id="...">` anchors.
- `effect: none` removes that group from the entrance sequence.
- `order` changes animation order only; it does not change slide layering.
- `delay` is seconds before that group starts in `after-previous` mode.
- `duration` overrides the per-group entrance duration.
- `--animation none` overrides the sidecar and disables all per-element animation.

## Page Transitions

```bash
# Pick a different effect
python3 skills/ppt-master/scripts/svg_to_pptx.py <project> -t push --transition-duration 0.6

# Disable
python3 skills/ppt-master/scripts/svg_to_pptx.py <project> -t none

# Auto-advance every 5 seconds (kiosk-style playback)
python3 skills/ppt-master/scripts/svg_to_pptx.py <project> --auto-advance 5
```

Available effects: `fade`, `push`, `wipe`, `split`, `strips`, `cover`, `random`.

Flags:

- `-t/--transition` — effect name, or `none` to disable. Default: `fade`.
- `--transition-duration` — seconds, default `0.4`.
- `--auto-advance` — seconds; omit for presenter-controlled advance.

## Per-Element Animations

Off by default — enable deck-wide with `-a auto` (or another effect). Once enabled, three Start modes are available — these mirror PowerPoint's animation-pane "Start" dropdown:

- **`on-click`** — entering a slide → first click reveals the first semantic group; each subsequent click reveals the next group in z-order. Suits live presentations where the speaker paces reveals. Forbidden with `--recorded-narration` because video-ready exports need click-free playback.
- **`with-previous`** — all groups start together on slide entry, playing their entrance animation in parallel. Stagger ignored.
- **`after-previous`** (default) — first group fires on slide entry, subsequent groups cascade after the previous one finishes, with `--animation-stagger` extra spacing. Suits kiosk playback, recorded walkthroughs, or anyone who wants visual flow without clicking.

```bash
# Default behavior (no flags): page transitions only, no per-element builds
python3 skills/ppt-master/scripts/svg_to_pptx.py <project>

# Enable per-element animation deck-wide (auto effect + after-previous cascade)
python3 skills/ppt-master/scripts/svg_to_pptx.py <project> -a auto

# Enable with a single effect (cascades via the after-previous trigger)
python3 skills/ppt-master/scripts/svg_to_pptx.py <project> --animation fade

# Enable and switch to on-click for live presentations (presenter controls pacing)
python3 skills/ppt-master/scripts/svg_to_pptx.py <project> -a auto --animation-trigger on-click

# Custom pacing
python3 skills/ppt-master/scripts/svg_to_pptx.py <project> --animation mixed \
        --animation-stagger 0.7 --animation-duration 0.5

# All groups animate in unison on slide entry
python3 skills/ppt-master/scripts/svg_to_pptx.py <project> --animation-trigger with-previous
```

22 single effects: `appear`, `fade`, `fly`, `cut`, `zoom`, `wipe`, `split`, `blinds`, `checkerboard`, `dissolve`, `random_bars`, `peek`, `wheel`, `box`, `circle`, `diamond`, `plus`, `strips`, `wedge`, `stretch`, `expand`, `swivel`. Plus three auto-vary modes:

- `auto` (recommended when enabling) — map effect from the group's SVG id. Information-dense elements get a single stable effect: `chart` / `table` / `legend` / `timeline` / `track` → `wipe`; `card-*` / `pillar-*` / `item-*` / `step-*` / `stage-*` / `tier-*` / `principle-*` → `fly`; `title` / `chapter-*` / `section-*` / `cover-*` / `tagline` / `subtitle` → `fade`; `takeaway` / `callout` / `quote` / `source` / `conclusion` / `note` → `fade`. Image-like ids `hero` / `figure-*` / `image` / `img-*` / `kpi` instead cycle a richer visual pool (`zoom` / `dissolve` / `circle` / `box` / `diamond` / `wheel`) so multiple images vary across the deck. Unmatched ids cycle through `fade` / `wipe` / `fly` / `zoom`.
- `mixed` (legacy) — deterministic. The first animated group on each slide uses `fade`; later groups cycle through a 16-effect pool (`blinds` / `checkerboard` / `dissolve` / `fly` / `cut` / `random_bars` / `box` / `split` / `strips` / `wedge` / `wheel` / `wipe` / `expand` / `fade` / `swivel` / `zoom`) across the deck. Kept for backward compatibility.
- `random` — samples from the legacy 16-effect pool.

`appear` is excluded from every variation pool because it has no visible motion.

Flags:

- `-a/--animation` — effect name, `auto`, `mixed`, `random`, or `none`. Default: `none` (per-element animation off; pass `auto` to enable).
- `--animation-trigger` — Start mode (matches PowerPoint): `on-click`, `with-previous`, or `after-previous` (default).
- `--animation-duration` — per-element entrance seconds, default `0.4`.
- `--animation-stagger` — gap between elements in `after-previous` mode (seconds, default `0.5`). Ignored otherwise.
- `--animation-config` — sidecar path. Default: `<project>/animations.json` when present.

> Note: `--recorded-narration` rejects `on-click`; use `after-previous` or `with-previous` for video-ready narrated decks.

## Anchor Logic — Top-Level `<g id="...">`

Per-element animations are anchored on **top-level `<g id="...">` content groups** in the SVG (e.g. `<g id="cover-title">`, `<g id="card-1">`). One group = one click reveal.

Aim for **3–8 content groups per slide**. This is also the granularity PowerPoint uses for group-select / group-move, so it improves editing ergonomics regardless of animation.

### Granularity is decided while writing the SVG, not at export

**A group is the smallest unit the presenter can reveal.** If content that should appear one step at a time lives inside a single `<g>`, export cannot split it — the whole block lands in one click and the lesson loses its pacing. This cannot be fixed later without hand-editing PPTX XML.

So when generating SVG, **split any content the presenter will walk through step by step into its own top-level `<g id>`**:

| Content shape | Wrong | Right |
|---|---|---|
| Numbered procedure / 作法 steps | one `<g id="steps">` holding (1)(2)(3) | `<g id="step-1">`, `<g id="step-2">`, `<g id="step-3">` |
| Multi-line proof / derivation | one `<g id="proof">` with every line | `<g id="proof-1">` … one per line |
| Sequential cards / pillars | one wrapper `<g>` | `<g id="card-1">`, `<g id="card-2">`, … |
| Figure + its reading text | merged | `<g id="figure">` and `<g id="reading">` separately |

Keep genuinely atomic content together (a single card's heading + body + icon belongs in one group — revealing half a card looks broken). The test: **would the teacher want to pause between these two pieces?** If yes, they are separate groups.

### Name groups semantically — `-a auto` maps effects by id

The preset/`auto` effect mapping reads the group id, so a meaningful name gets a sensible effect for free, and keeps the deck maintainable:

- `title` / `takeaway` / `subtitle` / `cover-*` → `fade`
- `chart` / `table` / `timeline` / `legend` → `wipe`
- `card-*` / `step-*` / `pillar-*` / `item-*` / `stage-*` / `tier-*` → `fly`
- `hero` / `figure-*` / `image` / `img-*` / `kpi` → richer image pool (zoom / dissolve / circle / box / diamond / wheel)
- anything unmatched → cycles fade / wipe / fly / zoom

> **Keep ids in sync with page position.** Ids are page-scoped labels, not decoration: when a page is reordered or renamed, update its group ids too. A stale `p07-figure` sitting in `09_theorem.svg` still animates, but it is misleading to read and `-a auto` is guessing effects from it.

**Chrome groups skip the cascade automatically.** Top-level groups that look like page chrome (background, header/footer, decorations, watermark, page number, nav, logo, dividing rule) are excluded from the click sequence and appear together with the slide. Detection is done on the `id`: after splitting on `-` and `_`, if any token matches `background` / `bg` / `decoration` / `decorations` / `decor` / `header` / `footer` / `chrome` / `watermark` / `pagenumber` / `pagenum` / `nav` / `logo` / `rule`, the group is treated as chrome. Examples that auto-skip: `<g id="background">`, `<g id="bg-texture">`, `<g id="cover-footer">`, `<g id="p03-header">`, `<g id="bottom-decor">`, `<g id="watermark">`, `<g id="nav">`, `<g id="logo-area">`, `<g id="column-rule">`. Examples that still animate: `<g id="card-1">`, `<g id="cover-title">`, `<g id="step-discover">`, `<g id="timeline-track">`. Don't strip the `<g>` wrapper to avoid animation — keep it (PowerPoint group-select needs it) and just name it appropriately.

**Fallback for flat SVGs** (no top-level `<g>` wrappers, only raw `<rect>` / `<text>` / `<path>` at the root):

- ≤ 8 visible top-level primitives → each becomes one anchor (capped to avoid 70+ atom cascades on dense pages).
- > 8 → animation is skipped on that slide. The slide still renders, just without entrance animation.

Executors should wrap logical sections in `<g id>` regardless of whether you plan to animate. The Executor reference (`skills/ppt-master/references/shared-standards.md`) requires it.

## Limitations

- **Native shapes mode only.** Per-element animation needs editable shape anchors. `--only legacy` produces one image per slide and has no element granularity to animate; that mode is unaffected by `-a/--animation` and only honors `-t/--transition`.
- **Office version drift on element animations.** Effects use the `<p:animEffect filter=...>` path (vs. `presetID` lookup tables) to stay stable across Office versions. Most filters render identically in PowerPoint 2016+; older Office may downgrade some filters to plain Appear.
- **PNG fallback (compat mode) is for visual rendering only.** Transitions and animations live in the slide XML, not in the PNG, so disabling compat mode does not affect either layer.

## Quick Reference

| Goal | Command |
|---|---|
| **Class teaching (click-paced)** | `--reveal lecture` |
| **Let the mode decide** | `--reveal auto --mode instructional` |
| Handout / no builds | `--reveal static` |
| Recorded / self-running | `--reveal flow` |
| Disable transitions | `-t none` |
| Change transition effect | `-t push` (or any from the list above) |
| Slower transition | `--transition-duration 0.8` |
| Auto-play | `--auto-advance 5` |
| Disable element animation | `-a none` (or `--reveal static`) |
| Switch to on-click trigger | `--animation-trigger on-click` |
| Use a single effect instead of auto | `--animation fade` |
| All groups animate together | `--animation-trigger with-previous` |
| Slower per-element reveal | `--animation-duration 0.5` |
| Wider gap in after-previous | `--animation-stagger 0.7` |

See also: [`scripts/docs/svg-pipeline.md`](../scripts/docs/svg-pipeline.md) for the full `svg_to_pptx.py` reference.
