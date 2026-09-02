/**
 * PPTX Import: Parses a PPTX file (ArrayBuffer) into an array of HTML slide strings.
 * Ported from user-content-sandbox/src/sandbox/handlers/pptx-import-handler.ts
 *
 * Usage: const slides = await importPptx(arrayBuffer);
 */
import { cssFontFamily } from "./fonts.js";
import { loadZipSafely } from "../shared/zip-guard.js";
// ============================================================================
// Constants
// ============================================================================
// Target dimensions to match the canvas viewer
const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 720;
// EMU (English Metric Units) to pixels: 1 inch = 914400 EMU, 96 DPI
const EMU_PER_PX = 914400 / 96;
// ============================================================================
// Utility Functions
// ============================================================================
function emuToPx(emu) {
    return emu / EMU_PER_PX;
}
// Hundred-point to px: OOXML font sizes are in hundredths of a point
function hptToPx(hpt) {
    return (hpt / 100) * (96 / 72);
}
function findChild(parent, localName) {
    for (let i = 0; i < parent.children.length; i++) {
        if (parent.children[i].localName === localName) {
            return parent.children[i];
        }
    }
    return null;
}
function findChildren(parent, localName) {
    const result = [];
    for (let i = 0; i < parent.children.length; i++) {
        if (parent.children[i].localName === localName) {
            result.push(parent.children[i]);
        }
    }
    return result;
}
function hexToRgba(hex, alpha100k) {
    if (alpha100k === undefined || alpha100k >= 100000)
        return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = Math.round((alpha100k / 100000) * 100) / 100;
    return `rgba(${r},${g},${b},${a})`;
}
/**
 * Apply tint modifier: mix the color toward white.
 * tintVal is 0-100000 (e.g. 65000 = 65% tint means 65% of original + 35% white)
 */
function applyTint(hex, tintVal) {
    const factor = tintVal / 100000;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const nr = Math.round(r + (255 - r) * (1 - factor));
    const ng = Math.round(g + (255 - g) * (1 - factor));
    const nb = Math.round(b + (255 - b) * (1 - factor));
    return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}
/**
 * Apply shade modifier: mix the color toward black.
 * shadeVal is 0-100000 (e.g. 50000 = 50% shade means darken by 50%)
 */
function applyShade(hex, shadeVal) {
    const factor = shadeVal / 100000;
    const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
    const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
    const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
/**
 * Apply luminance (lumMod/lumOff) modifiers: l' = clamp(l * mod + off).
 * Implemented as a channel-wise shift of the HSL lightness, close enough for
 * the common "make this accent very light" template idiom.
 */
function applyLuminance(hex, mod, off) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const nl = Math.min(1, Math.max(0, l * mod + off));
    const d = nl - l;
    const scale = (c) => Math.round(255 * Math.min(1, Math.max(0, c + d)));
    return `#${scale(r).toString(16).padStart(2, "0")}${scale(g).toString(16).padStart(2, "0")}${scale(b).toString(16).padStart(2, "0")}`;
}
/**
 * Apply color modifiers (tint, shade, alpha) to a color element.
 * Returns the modified hex color and optional alpha value.
 */
function applyColorModifiers(colorEl, hex) {
    let color = hex;
    let alphaVal;
    const lumModEl = findChild(colorEl, "lumMod");
    const lumOffEl = findChild(colorEl, "lumOff");
    if (lumModEl || lumOffEl) {
        const mod = lumModEl ? parseInt(lumModEl.getAttribute("val") ?? "100000", 10) / 100000 : 1;
        const off = lumOffEl ? parseInt(lumOffEl.getAttribute("val") ?? "100000", 10) / 100000 : 0;
        color = applyLuminance(color, mod, off);
    }
    const tintEl = findChild(colorEl, "tint");
    if (tintEl) {
        const val = parseInt(tintEl.getAttribute("val") ?? "100000", 10);
        color = applyTint(color, val);
    }
    const shadeEl = findChild(colorEl, "shade");
    if (shadeEl) {
        const val = parseInt(shadeEl.getAttribute("val") ?? "100000", 10);
        color = applyShade(color, val);
    }
    const alphaEl = findChild(colorEl, "alpha");
    if (alphaEl) {
        alphaVal = parseInt(alphaEl.getAttribute("val") ?? "100000", 10);
    }
    return { color, alpha: alphaVal };
}
/** Preset (prstClr) colors — the 16 X11/PPTX presets most commonly used in decks. */
const PREST_COLORS = {
    white: "#FFFFFF", black: "#000000", red: "#FF0000", yellow: "#FFFF00",
    lime: "#00FF00", green: "#008000", blue: "#0000FF", aqua: "#00FFFF",
    cyan: "#00FFFF", fuchsia: "#FF00FF", magenta: "#FF00FF", silver: "#C0C0C0",
    gray: "#808080", grey: "#808080", maroon: "#800000", olive: "#808000",
    purple: "#800080", teal: "#008080", navy: "#000080", orange: "#FFA500",
    gold: "#FFD700", darkgray: "#A9A9A9", lightgray: "#D3D3D3", darkblue: "#00008B",
    darkgreen: "#006400", darkred: "#8B0000", darkcyan: "#008B8B", darkmagenta: "#8B008B",
    darkyellow: "#B8860B", lightblue: "#ADD8E6", lightgreen: "#90EE90", lightyellow: "#FFFFE0",
};
function resolveColor(parent, themeColors) {
    const prstClr = findChild(parent, "prstClr");
    if (prstClr) {
        const name = (prstClr.getAttribute("val") ?? "").toLowerCase();
        const hex = PREST_COLORS[name];
        if (hex) {
            const { color, alpha } = applyColorModifiers(prstClr, hex);
            if (alpha !== undefined && alpha < 100000) {
                return hexToRgba(color, alpha);
            }
            return color;
        }
        return undefined;
    }
    const srgbClr = findChild(parent, "srgbClr");
    if (srgbClr) {
        const hex = "#" + (srgbClr.getAttribute("val") ?? "000000");
        const { color, alpha } = applyColorModifiers(srgbClr, hex);
        if (alpha !== undefined && alpha < 100000) {
            return hexToRgba(color, alpha);
        }
        return color;
    }
    const schemeClr = findChild(parent, "schemeClr");
    if (schemeClr) {
        const val = schemeClr.getAttribute("val");
        if (val && themeColors.has(val)) {
            const hex = themeColors.get(val);
            const { color, alpha } = applyColorModifiers(schemeClr, hex);
            if (alpha !== undefined && alpha < 100000) {
                return hexToRgba(color, alpha);
            }
            return color;
        }
    }
    return undefined;
}
function ooxmlAngleToCss(ang) {
    return (ang / 60000 + 90) % 360;
}
function extractGradientFill(parent, themeColors) {
    const gradFill = findChild(parent, "gradFill");
    if (!gradFill)
        return undefined;
    const gsLst = findChild(gradFill, "gsLst");
    if (!gsLst)
        return undefined;
    const stops = [];
    const gsEls = findChildren(gsLst, "gs");
    for (const gs of gsEls) {
        const pos = parseInt(gs.getAttribute("pos") ?? "0", 10) / 1000;
        const color = resolveColor(gs, themeColors);
        if (color)
            stops.push({ pos, color });
    }
    if (stops.length === 0)
        return undefined;
    // Check for radial gradient (path element with path="circle")
    const pathEl = findChild(gradFill, "path");
    if (pathEl && pathEl.getAttribute("path") === "circle") {
        // Extract center position from fillToRect
        const fillToRect = findChild(pathEl, "fillToRect");
        let centerX = 50;
        let centerY = 50;
        if (fillToRect) {
            // OOXML uses l/t/r/b as percentages * 1000 from edges
            // l=50000, t=50000 means center is at 50%, 50%
            const l = parseInt(fillToRect.getAttribute("l") ?? "50000", 10) / 1000;
            const t = parseInt(fillToRect.getAttribute("t") ?? "50000", 10) / 1000;
            centerX = l;
            centerY = t;
        }
        const stopStr = stops.map((s) => `${s.color} ${s.pos}%`).join(",");
        return `radial-gradient(ellipse at ${centerX}% ${centerY}%,${stopStr})`;
    }
    // Linear gradient
    const lin = findChild(gradFill, "lin");
    const angAttr = lin?.getAttribute("ang");
    const cssDeg = angAttr ? ooxmlAngleToCss(parseInt(angAttr, 10)) : 180;
    const stopStr = stops.map((s) => `${s.color} ${s.pos}%`).join(",");
    return `linear-gradient(${cssDeg}deg,${stopStr})`;
}
function extractFill(spPr, themeColors, imageMap) {
    const solidFill = findChild(spPr, "solidFill");
    if (solidFill)
        return resolveColor(solidFill, themeColors);
    const gradFill = findChild(spPr, "gradFill");
    if (gradFill)
        return extractGradientFill(spPr, themeColors);
    // Pattern fills (pattFill, e.g. prst="wdUpDiag" — diagonal hatching with
    // fgClr/bgClr). Emitted as a CSS background layer pair: base color + a
    // repeating-linear-gradient hatch (dot-like presets degrade to a dot grid).
    const pattFill = findChild(spPr, "pattFill");
    if (pattFill) {
        const prst = pattFill.getAttribute("prst") ?? "";
        const fgClr = findChild(pattFill, "fgClr");
        const bgClr = findChild(pattFill, "bgClr");
        const fg = fgClr ? resolveColor(fgClr, themeColors) : undefined;
        const bg = bgClr ? resolveColor(bgClr, themeColors) : undefined;
        const line = fg ?? "#000000";
        const base = bg ?? "#FFFFFF";
        if (!/diag/i.test(prst)) {
            // Dot/small-grid patterns: subtle dot grid.
            return `${base} radial-gradient(${line} 1px, transparent 1.4px)`;
        }
        const deg = /DnDiag|dnDiag/i.test(prst) ? "135deg" : "45deg";
        return `${base} repeating-linear-gradient(${deg},${line} 0 2px,transparent 2px 9px)`;
    }
    // Picture backgrounds (p:bg > bgPr > blipFill) — resolve the rId through
    // the caller-provided image map into a data URI.
    const blipFill = findChild(spPr, "blipFill");
    if (blipFill && imageMap) {
        const blip = findChild(blipFill, "blip");
        const rid = blip && (blip.getAttribute("r:embed") ?? blip.getAttribute("embed"));
        const src = rid ? imageMap.get(rid) : undefined;
        if (src) {
            return { image: src };
        }
    }
    return undefined;
}
/**
 * Resolve a bgRef element to a background color/gradient.
 * bgRef idx=1001-1003 references bgFillStyleLst entries (idx - 1000 = 1-based position).
 * The bgRef's child color element provides the "placeholder color" (phClr) for the fill style.
 */
function resolveBgRef(bgRef, bgFillStyles, themeColors) {
    const idx = parseInt(bgRef.getAttribute("idx") ?? "0", 10);
    if (idx < 1001 || bgFillStyles.length === 0)
        return undefined;
    const styleIdx = idx - 1001; // 0-based index into bgFillStyleLst
    if (styleIdx >= bgFillStyles.length)
        return undefined;
    const fillStyle = bgFillStyles[styleIdx];
    // Resolve the placeholder color (phClr) from bgRef's child element
    const phColor = resolveColor(bgRef, themeColors);
    // Check what type of fill the style defines
    if (fillStyle.localName === "solidFill") {
        // If the fill uses phClr, substitute with bgRef's color
        const phClr = findChild(fillStyle, "schemeClr");
        if (phClr?.getAttribute("val") === "phClr" && phColor) {
            return phColor;
        }
        return resolveColor(fillStyle, themeColors) ?? phColor;
    }
    if (fillStyle.localName === "gradFill") {
        // Extract gradient, substituting phClr with bgRef's color
        return extractGradientFill(
        // Wrap in a parent element for extractGradientFill
        { children: [fillStyle] }, themeColors);
    }
    // For blipFill or other complex fills, return the placeholder color as fallback
    return phColor;
}
/**
 * Extract background fill from a bg element, handling both bgPr and bgRef.
 */
function extractBgFill(bgEl, bgFillStyles, themeColors, imageMap) {
    const bgPr = findChild(bgEl, "bgPr");
    if (bgPr) {
        return extractFill(bgPr, themeColors, imageMap);
    }
    const bgRef = findChild(bgEl, "bgRef");
    if (bgRef) {
        return resolveBgRef(bgRef, bgFillStyles, themeColors);
    }
    return undefined;
}
/**
 * Extract a CSS clip-path polygon from a custGeom element.
 * Only supports simple paths (moveTo + lineTo, no curves).
 * Returns undefined if the geometry is too complex.
 */
function extractCustGeomClipPath(custGeom) {
    const pathLst = findChild(custGeom, "pathLst");
    if (!pathLst)
        return undefined;
    const pathEl = findChild(pathLst, "path");
    if (!pathEl)
        return undefined;
    const pathW = parseInt(pathEl.getAttribute("w") ?? "0", 10);
    const pathH = parseInt(pathEl.getAttribute("h") ?? "0", 10);
    if (pathW <= 0 || pathH <= 0)
        return undefined;
    const points = [];
    for (let i = 0; i < pathEl.children.length; i++) {
        const cmd = pathEl.children[i];
        const localName = cmd.localName;
        if (localName === "moveTo" || localName === "lnTo") {
            const pt = findChild(cmd, "pt");
            if (pt) {
                const x = parseInt(pt.getAttribute("x") ?? "0", 10);
                const y = parseInt(pt.getAttribute("y") ?? "0", 10);
                points.push({ x, y });
            }
        }
        else if (localName === "close") {
            // close path 鈥?don't need to add anything
        }
        else {
            // Unsupported command (cubicBezTo, quadBezTo, arcTo, etc.)
            // Can't represent as a simple polygon
            return undefined;
        }
    }
    if (points.length < 3)
        return undefined;
    // Convert points to percentage-based polygon
    const polygonPoints = points.map(p => {
        const xPct = Math.round((p.x / pathW) * 10000) / 100;
        const yPct = Math.round((p.y / pathH) * 10000) / 100;
        return `${xPct}% ${yPct}%`;
    }).join(", ");
    return `polygon(${polygonPoints})`;
}
/**
 * Mirror a percentage-based polygon clip-path horizontally/vertically,
 * matching OOXML xfrm flipH/flipV semantics (geometry mirrored within its box).
 */
function mirrorPolygonClip(clipPath, flipH, flipV) {
    const m = String(clipPath).match(/^polygon\((.*)\)$/s);
    if (!m)
        return clipPath;
    const pts = m[1].split(",").map(pt => pt.trim().split(/\s+/).map(v => parseFloat(v)));
    const mirrored = pts.map(([x, y]) => {
        const nx = flipH ? Math.round((100 - x) * 100) / 100 : x;
        const ny = flipV ? Math.round((100 - y) * 100) / 100 : y;
        return `${nx}% ${ny}%`;
    });
    return `polygon(${mirrored.join(", ")})`;
}
/**
 * Convert a custGeom path to SVG path data so complex freeforms (curves, arcs)
 * can still be rendered faithfully instead of degrading to a plain rectangle.
 * Returns { d, w, h } in the path's local coordinate space, or null when the
 * path contains unsupported commands or has a degenerate coordinate space.
 */
function custGeomToSvgPath(custGeom) {
    const pathLst = findChild(custGeom, "pathLst");
    if (!pathLst)
        return null;
    const pathEl = findChild(pathLst, "path");
    if (!pathEl)
        return null;
    const pathW = parseInt(pathEl.getAttribute("w") ?? "0", 10);
    const pathH = parseInt(pathEl.getAttribute("h") ?? "0", 10);
    if (pathW <= 0 || pathH <= 0)
        return null;
    let d = "";
    let started = false;
    for (let i = 0; i < pathEl.children.length; i++) {
        const cmd = pathEl.children[i];
        const name = cmd.localName;
        const pts = findChildren(cmd, "pt");
        const coord = (pt) => `${parseInt(pt?.getAttribute("x") ?? "0", 10)} ${parseInt(pt?.getAttribute("y") ?? "0", 10)}`;
        if (name === "moveTo") {
            d += `M${coord(pts[0])}`;
            started = true;
        }
        else if (name === "lnTo") {
            d += ` L${coord(pts[0])}`;
        }
        else if (name === "close") {
            d += " Z";
        }
        else if (name === "cubicBezTo") {
            if (pts.length !== 3)
                return null;
            d += ` C${coord(pts[0])} ${coord(pts[1])} ${coord(pts[2])}`;
        }
        else if (name === "quadBezTo") {
            if (pts.length !== 2)
                return null;
            d += ` Q${coord(pts[0])} ${coord(pts[1])}`;
        }
        else if (name === "arcTo") {
            // OOXML arcTo (wR/hR/stAng/swAng) has no direct SVG equivalent;
            // approximate the segment endpoint with a straight line.
            d += ` L${coord(pts[0])}`;
        }
        else {
            return null;
        }
    }
    if (!started)
        return null;
    return { d: d.trim(), w: pathW, h: pathH };
}
/**
 * Parse non-placeholder shapes from a spTree element (layout or master).
 * Returns SlideElement[] for decorative shapes that should appear behind slide content.
 */
function parseDecorativeShapes(spTree, scale, themeColors, imageMap, themeFonts, lineStyles) {
    const elements = [];
    for (let i = 0; i < spTree.children.length; i++) {
        const child = spTree.children[i];
        if (child.localName === "sp" || child.localName === "cxnSp") {
            // Skip placeholder shapes 鈥?they are content containers, not decorative
            const nvSpPr = findChild(child, "nvSpPr");
            if (nvSpPr) {
                const phEl = findChild(findChild(nvSpPr, "nvPr") ?? nvSpPr, "ph");
                if (phEl)
                    continue;
            }
            // parseShape handles custom geometry itself: simple polygons become
            // clip-paths, complex freeforms degrade to inline SVG (never a plain
            // rectangle), so custGeom shapes no longer need special-casing here.
            const shape = parseShape(child, scale, themeColors, themeFonts, lineStyles);
            if (shape)
                elements.push({ kind: "shape", data: shape });
        }
        else if (child.localName === "pic") {
            const img = parsePicture(child, scale, imageMap);
            if (img)
                elements.push({ kind: "image", data: img });
        }
        else if (child.localName === "grpSp") {
            // Recursively parse group shapes for their decorative children
            const grpElements = parseGroupShape(child, scale, themeColors, imageMap, themeFonts, lineStyles);
            elements.push(...grpElements);
        }
    }
    return elements;
}
/**
 * Parse shapes inside a group shape element.
 * Group shapes have their own coordinate space defined by grpSpPr.
 * Children use coordinates in the child space (chOff/chExt) which must be
 * mapped to the group's actual position/size on the slide (off/ext).
 */
function parseGroupShape(grpSp, scale, themeColors, imageMap, themeFonts, lineStyles) {
    const elements = [];
    // Extract group coordinate transform from grpSpPr
    const grpSpPr = findChild(grpSp, "grpSpPr");
    const xfrm = grpSpPr ? findChild(grpSpPr, "xfrm") : null;
    const grpOff = xfrm ? findChild(xfrm, "off") : null;
    const grpExt = xfrm ? findChild(xfrm, "ext") : null;
    const chOff = xfrm ? findChild(xfrm, "chOff") : null;
    const chExt = xfrm ? findChild(xfrm, "chExt") : null;
    const hasTransform = !!(grpOff && grpExt && chOff && chExt);
    const grpOffX = parseInt(grpOff?.getAttribute("x") ?? "0", 10);
    const grpOffY = parseInt(grpOff?.getAttribute("y") ?? "0", 10);
    const grpExtCx = parseInt(grpExt?.getAttribute("cx") ?? "0", 10);
    const grpExtCy = parseInt(grpExt?.getAttribute("cy") ?? "0", 10);
    const chOffX = parseInt(chOff?.getAttribute("x") ?? "0", 10);
    const chOffY = parseInt(chOff?.getAttribute("y") ?? "0", 10);
    const chExtCx = parseInt(chExt?.getAttribute("cx") ?? "1", 10);
    const chExtCy = parseInt(chExt?.getAttribute("cy") ?? "1", 10);
    const scaleX = grpExtCx / chExtCx;
    const scaleY = grpExtCy / chExtCy;
    // Remap an element's x/y/w/h from child space to slide space
    function remapCoords(el) {
        if (!hasTransform)
            return;
        // Convert px back to EMU, apply transform, convert back to px
        const childXEmu = el.x / scale * EMU_PER_PX;
        const childYEmu = el.y / scale * EMU_PER_PX;
        const childWEmu = el.w / scale * EMU_PER_PX;
        const childHEmu = el.h / scale * EMU_PER_PX;
        el.x = Math.round(emuToPx(grpOffX + (childXEmu - chOffX) * scaleX) * scale);
        el.y = Math.round(emuToPx(grpOffY + (childYEmu - chOffY) * scaleY) * scale);
        el.w = Math.round(emuToPx(childWEmu * scaleX) * scale);
        el.h = Math.round(emuToPx(childHEmu * scaleY) * scale);
    }
    for (let i = 0; i < grpSp.children.length; i++) {
        const child = grpSp.children[i];
        if (child.localName === "sp" || child.localName === "cxnSp") {
            const nvSpPr = findChild(child, "nvSpPr");
            if (nvSpPr) {
                const phEl = findChild(findChild(nvSpPr, "nvPr") ?? nvSpPr, "ph");
                if (phEl)
                    continue;
            }
            // parseShape resolves custGeom (clip-path or SVG fallback) itself
            const shape = parseShape(child, scale, themeColors, themeFonts, lineStyles);
            if (shape) {
                remapCoords(shape);
                elements.push({ kind: "shape", data: shape });
            }
        }
        else if (child.localName === "pic") {
            const img = parsePicture(child, scale, imageMap);
            if (img) {
                remapCoords(img);
                elements.push({ kind: "image", data: img });
            }
        }
        else if (child.localName === "grpSp") {
            const nested = parseGroupShape(child, scale, themeColors, imageMap, themeFonts, lineStyles);
            elements.push(...nested);
        }
    }
    return elements;
}
function extractRunProps(rPr, scale, themeColors, themeFonts) {
    if (!rPr)
        return {};
    const result = {};
    const sz = rPr.getAttribute("sz");
    if (sz)
        result.fontSize = Math.round(hptToPx(parseInt(sz, 10)) * scale);
    const b = rPr.getAttribute("b");
    if (b === "1" || b === "true")
        result.bold = true;
    const i = rPr.getAttribute("i");
    if (i === "1" || i === "true")
        result.italic = true;
    const u = rPr.getAttribute("u");
    if (u && u !== "none")
        result.underline = true;
    const solidFill = findChild(rPr, "solidFill");
    if (solidFill) {
        const color = resolveColor(solidFill, themeColors);
        if (color)
            result.color = color;
    }
    // Handle gradient fill for text - use CSS background-clip:text technique
    if (!result.color) {
        const gradFill = findChild(rPr, "gradFill");
        if (gradFill) {
            const gsLst = findChild(gradFill, "gsLst");
            if (gsLst) {
                const gsEls = findChildren(gsLst, "gs");
                if (gsEls.length > 0) {
                    // Extract gradient stops
                    const stops = [];
                    for (const gs of gsEls) {
                        const pos = parseInt(gs.getAttribute("pos") ?? "0", 10) / 1000;
                        const color = resolveColor(gs, themeColors);
                        if (color)
                            stops.push({ pos, color });
                    }
                    if (stops.length >= 2) {
                        // Extract angle from lin element
                        const lin = findChild(gradFill, "lin");
                        const angAttr = lin?.getAttribute("ang");
                        const cssDeg = angAttr ? ooxmlAngleToCss(parseInt(angAttr, 10)) : 135;
                        const stopStr = stops.map((s) => `${s.color} ${s.pos}%`).join(",");
                        result.gradientFill = `linear-gradient(${cssDeg}deg,${stopStr})`;
                    }
                    // Also set color as fallback (first gradient stop)
                    const firstColor = resolveColor(gsEls[0], themeColors);
                    if (firstColor)
                        result.color = firstColor;
                }
            }
        }
    }
    const latin = findChild(rPr, "latin");
    if (latin) {
        let typeface = latin.getAttribute("typeface");
        if (typeface && themeFonts) {
            // Resolve theme font references
            if (typeface === "+mn-lt")
                typeface = themeFonts.minorLatin;
            else if (typeface === "+mj-lt")
                typeface = themeFonts.majorLatin;
        }
        if (typeface && !typeface.startsWith("+"))
            result.fontFamily = typeface;
    }
    // Fallback: check East Asian font
    if (!result.fontFamily) {
        const ea = findChild(rPr, "ea");
        if (ea) {
            let typeface = ea.getAttribute("typeface");
            if (typeface && themeFonts) {
                if (typeface === "+mn-ea")
                    typeface = themeFonts.minorEastAsian ?? themeFonts.minorLatin;
                else if (typeface === "+mj-ea")
                    typeface = themeFonts.majorEastAsian ?? themeFonts.majorLatin;
            }
            if (typeface && !typeface.startsWith("+"))
                result.fontFamily = typeface;
        }
    }
    // Extract glow effect from effectLst
    const effectLst = findChild(rPr, "effectLst");
    if (effectLst) {
        const glow = findChild(effectLst, "glow");
        if (glow) {
            // rad is in EMUs (English Metric Units)
            const radAttr = glow.getAttribute("rad");
            const radiusEmu = radAttr ? parseInt(radAttr, 10) : 0;
            // Convert EMU to pixels: 914400 EMU = 1 inch = 96 pixels
            const radiusPx = Math.round(emuToPx(radiusEmu) * scale);
            // Get glow color
            const glowColor = resolveColor(glow, themeColors);
            if (glowColor && radiusPx > 0) {
                // During export, CSS text-shadow is scaled for OOXML visual equivalence:
                // - Size scaled by 2.5x (CSS blur spreads wider than OOXML glow)
                // - Opacity scaled by 0.3x (OOXML glow appears more intense)
                //
                // During import, apply inverse scaling to restore CSS-like values:
                const INVERSE_GLOW_SIZE_SCALE = 0.4; // 1/2.5
                const INVERSE_GLOW_OPACITY_SCALE = 3.33; // 1/0.3
                const cssRadius = Math.round(radiusPx * INVERSE_GLOW_SIZE_SCALE);
                // Extract and scale opacity from rgba color
                const rgbaMatch = glowColor.match(/rgba?\((\d+),(\d+),(\d+)(?:,([0-9.]+))?\)/);
                if (rgbaMatch) {
                    const r = rgbaMatch[1];
                    const g = rgbaMatch[2];
                    const b = rgbaMatch[3];
                    const originalAlpha = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
                    const scaledAlpha = Math.min(originalAlpha * INVERSE_GLOW_OPACITY_SCALE, 1.0);
                    result.textShadow = `0 0 ${cssRadius}px rgba(${r},${g},${b},${scaledAlpha.toFixed(2)})`;
                }
                else if (glowColor.startsWith('#')) {
                    // Hex color - assume full opacity, apply scaling
                    const r = parseInt(glowColor.slice(1, 3), 16);
                    const g = parseInt(glowColor.slice(3, 5), 16);
                    const b = parseInt(glowColor.slice(5, 7), 16);
                    result.textShadow = `0 0 ${cssRadius}px rgba(${r},${g},${b},1)`;
                }
                else {
                    result.textShadow = `0 0 ${cssRadius}px ${glowColor}`;
                }
            }
        }
    }
    return result;
}
// ============================================================================
// Parsing Functions
// ============================================================================
function parseShape(sp, scale, themeColors, themeFonts, lineStyles, fallbackSp) {
    let spPr = findChild(sp, "spPr") ?? (fallbackSp ? findChild(fallbackSp, "spPr") : null);
    if (!spPr)
        return null;
    // Slide placeholder shapes often carry an empty <p:spPr/> (their position and
    // fill live on the layout's matching placeholder). Fall back to the layout
    // shape's spPr so the slot (xfrm/fill) still comes through while the text
    // keeps coming from the slide shape itself.
    if (!findChild(spPr, "xfrm")) {
        const fallbackPr = fallbackSp ? findChild(fallbackSp, "spPr") : null;
        if (fallbackPr && findChild(fallbackPr, "xfrm")) {
            spPr = fallbackPr;
        }
    }
    const xfrm = findChild(spPr, "xfrm");
    if (!xfrm)
        return null;
    const off = findChild(xfrm, "off");
    const ext = findChild(xfrm, "ext");
    if (!off || !ext)
        return null;
    const wEmu = parseInt(ext.getAttribute("cx") ?? "0", 10);
    const hEmu = parseInt(ext.getAttribute("cy") ?? "0", 10);
    // Resolve fill: direct spPr fill > p:style fillRef fallback
    // Only fall back to p:style if spPr has no explicit <a:noFill/>
    let fill = extractFill(spPr, themeColors);
    if (!fill && !findChild(spPr, "noFill")) {
        const styleEl = findChild(sp, "style");
        if (styleEl) {
            const fillRef = findChild(styleEl, "fillRef");
            if (fillRef) {
                const fillIdx = parseInt(fillRef.getAttribute("idx") ?? "0", 10);
                if (fillIdx > 0) {
                    fill = resolveColor(fillRef, themeColors) ?? undefined;
                }
            }
        }
    }
    const shape = {
        x: Math.round(emuToPx(parseInt(off.getAttribute("x") ?? "0", 10)) * scale),
        y: Math.round(emuToPx(parseInt(off.getAttribute("y") ?? "0", 10)) * scale),
        w: Math.round(emuToPx(wEmu) * scale),
        h: Math.round(emuToPx(hEmu) * scale),
        fill,
        paragraphs: [],
    };
    // Extract rotation from xfrm (OOXML uses 60,000ths of a degree)
    const rotAttr = xfrm.getAttribute("rot");
    if (rotAttr) {
        const rotDeg = parseInt(rotAttr, 10) / 60000;
        if (rotDeg !== 0)
            shape.rotation = rotDeg;
    }
    // Flips mirror the geometry within its bounding box (OOXML flipH/flipV).
    // Applied to polygon clip-paths after preset/custom geometry resolution below.
    const flipH = xfrm.getAttribute("flipH") === "1";
    const flipV = xfrm.getAttribute("flipV") === "1";
    // Border radius from prstGeom roundRect or ellipse
    const prstGeom = findChild(spPr, "prstGeom");
    const prstType = prstGeom?.getAttribute("prst");
    if (prstType === "roundRect" && prstGeom) {
        const avLst = findChild(prstGeom, "avLst");
        const gd = avLst ? findChild(avLst, "gd") : null;
        const adjVal = gd
            ? parseInt(gd.getAttribute("fmla")?.replace("val ", "") ?? "16667", 10)
            : 16667;
        const minDim = Math.min(wEmu, hEmu);
        const radiusEmu = (minDim * Math.min(adjVal, 50000)) / 100000;
        shape.borderRadius = Math.round(emuToPx(radiusEmu) * scale);
    }
    else if (prstType === "ellipse") {
        // Ellipse shapes should have border-radius: 50% to render as circles
        shape.isEllipse = true;
    }
    else if (prstType === "line" || prstType === "straightConnector1") {
        // A `line` preset is a real connector/divider shape whose stroke lives in a:ln.
        // Its bounding box is often degenerate (h=0 horizontal or w=0 vertical), which
        // must NOT be treated as an empty shape by the zero-dimension skip in rendering.
        // straightConnector1 is the standard cxnSp connector preset with the same
        // degenerate-box semantics.
        shape.isLine = true;
    }
    else if (prstType === "rtTriangle") {
        // OOXML rtTriangle preset path is (0,h)→(w,h)→(0,0): right angle at the
        // BOTTOM-LEFT corner, hypotenuse from top-left (0,0) to bottom-right (w,h).
        // Renders as ◺ before rotation. The previously emitted polygon
        // (0 0, 100% 0, 0 100%) had the right angle at the top-left, which is the
        // mirrored triangle and does not match the preset.
        shape.clipPath = "polygon(0 0, 100% 100%, 0 100%)";
    }
    else if (prstType === "triangle" || prstType === "isoTriangle") {
        // Isosceles triangle: point at top center
        shape.clipPath = "polygon(50% 0, 0 100%, 100% 100%)";
    }
    // Custom geometry: simple polygons become clip-paths; complex freeforms
    // (curves/arcs, e.g. icon shapes) fall back to inline SVG so they still
    // render with their true silhouette instead of degrading to a plain box.
    const custGeomEl = findChild(spPr, "custGeom");
    if (custGeomEl) {
        const polygonClip = extractCustGeomClipPath(custGeomEl);
        if (polygonClip) {
            shape.clipPath = polygonClip;
        }
        else {
            shape.custGeomSvg = custGeomToSvgPath(custGeomEl) ?? undefined;
        }
    }
    // Apply flipH/flipV mirroring to the resolved polygon clip-path
    if (shape.clipPath && (flipH || flipV)) {
        shape.clipPath = mirrorPolygonClip(shape.clipPath, flipH, flipV);
    }
    // Border from a:ln
    const ln = findChild(spPr, "ln");
    if (ln) {
        const lnFill = findChild(ln, "solidFill");
        if (lnFill) {
            shape.borderColor = resolveColor(lnFill, themeColors);
        }
        const lnWidth = ln.getAttribute("w");
        if (lnWidth) {
            shape.borderWidth = Math.max(1, Math.round(emuToPx(parseInt(lnWidth, 10)) * scale));
            // Extract dash type from prstDash
            const prstDash = findChild(ln, "prstDash");
            if (prstDash) {
                const dashVal = prstDash.getAttribute("val");
                if (dashVal && dashVal !== "solid") {
                    shape.borderDashType = dashVal;
                }
            }
        }
        else if (shape.borderColor) {
            // OOXML default line width when w is absent is 9525 EMU (0.75pt)
            shape.borderWidth = Math.max(1, Math.round(emuToPx(9525) * scale));
        }
    }
    else if (lineStyles && lineStyles.length > 0) {
        // No explicit a:ln: fall back to the p:style lnRef → theme line style chain.
        // WPS/Office text boxes commonly carry only a style reference (e.g.
        // lnRef idx=2 → 1pt line in phClr, with the ref's schemeClr supplying the
        // color); skipping this loses visible borders on shapes like text frames.
        const styleEl = findChild(sp, "style");
        const lnRef = styleEl ? findChild(styleEl, "lnRef") : null;
        const lnIdx = lnRef ? parseInt(lnRef.getAttribute("idx") ?? "0", 10) : 0;
        if (lnRef && lnIdx >= 1 && lnIdx <= lineStyles.length) {
            const lnStyle = lineStyles[lnIdx - 1];
            const lnStyleWidth = lnStyle.getAttribute("w");
            if (lnStyleWidth) {
                const borderColor = resolveColor(lnRef, themeColors);
                if (borderColor) {
                    shape.borderWidth = Math.max(1, Math.round(emuToPx(parseInt(lnStyleWidth, 10)) * scale));
                    shape.borderColor = borderColor;
                }
            }
        }
    }
    // Extract outer shadow from effectLst
    const effectLst = findChild(spPr, "effectLst");
    if (effectLst) {
        const outerShdw = findChild(effectLst, "outerShdw");
        if (outerShdw) {
            const blurRad = parseInt(outerShdw.getAttribute("blurRad") ?? "0", 10);
            const blurPx = Math.round(emuToPx(blurRad) * scale);
            // Extract shadow color and alpha
            let shadowColor = "rgba(0,0,0,0.3)";
            const prstClr = findChild(outerShdw, "prstClr");
            const srgbClr = findChild(outerShdw, "srgbClr");
            if (prstClr || srgbClr) {
                const colorEl = prstClr ?? srgbClr;
                const alphaEl = colorEl ? findChild(colorEl, "alpha") : null;
                const alphaVal = alphaEl ? parseInt(alphaEl.getAttribute("val") ?? "100000", 10) / 100000 : 1;
                const baseColor = prstClr?.getAttribute("val") === "black" ? "0,0,0"
                    : prstClr?.getAttribute("val") === "white" ? "255,255,255"
                        : "0,0,0";
                shadowColor = `rgba(${baseColor},${alphaVal})`;
            }
            if (blurPx > 0) {
                shape.boxShadow = `0 0 ${blurPx}px ${shadowColor}`;
            }
        }
    }
    // Body properties: vertical alignment and padding
    const txBody = findChild(sp, "txBody");
    if (txBody) {
        const bodyPr = findChild(txBody, "bodyPr");
        if (bodyPr) {
            const anchor = bodyPr.getAttribute("anchor");
            if (anchor === "ctr")
                shape.verticalAlign = "center";
            else if (anchor === "b")
                shape.verticalAlign = "bottom";
            const lIns = bodyPr.getAttribute("lIns");
            const tIns = bodyPr.getAttribute("tIns");
            const rIns = bodyPr.getAttribute("rIns");
            const bIns = bodyPr.getAttribute("bIns");
            if (lIns !== null || tIns !== null || rIns !== null || bIns !== null) {
                shape.padding = {
                    left: Math.round(emuToPx(parseInt(lIns ?? "91440", 10)) * scale),
                    top: Math.round(emuToPx(parseInt(tIns ?? "45720", 10)) * scale),
                    right: Math.round(emuToPx(parseInt(rIns ?? "91440", 10)) * scale),
                    bottom: Math.round(emuToPx(parseInt(bIns ?? "45720", 10)) * scale),
                };
            }
        }
        const paragraphs = findChildren(txBody, "p");
        for (const p of paragraphs) {
            const para = { runs: [] };
            const pPr = findChild(p, "pPr");
            let defaults = undefined;
            if (pPr) {
                const algn = pPr.getAttribute("algn");
                if (algn) {
                    para.align =
                        algn === "ctr"
                            ? "center"
                            : algn === "r"
                                ? "right"
                                : algn === "just"
                                    ? "justify"
                                    : "left";
                }
                const marL = pPr.getAttribute("marL");
                if (marL)
                    para.marginLeftPx = Math.round(emuToPx(parseInt(marL, 10)) * scale);
                const indent = pPr.getAttribute("indent");
                if (indent)
                    para.indentPx = Math.round(emuToPx(parseInt(indent, 10)) * scale);
                const defRPr = findChild(pPr, "defRPr");
                if (defRPr) {
                    defaults = extractRunProps(defRPr, scale, themeColors, themeFonts);
                }
                const lnSpc = findChild(pPr, "lnSpc");
                if (lnSpc) {
                    const spcPct = findChild(lnSpc, "spcPct");
                    if (spcPct) {
                        const pctVal = parseInt(spcPct.getAttribute("val") ?? "100000", 10);
                        // PPTX spcPct 100000 = 100% = "single" spacing.
                        // In CSS, line-height:100% is actually tighter than normal (~120%),
                        // so we only emit lineSpacingPercent when it differs from the default.
                        // This avoids both the tighter-than-intended 100% and the text-overflow
                        // issues caused by large values like 160% inside fixed-height boxes.
                        const pct = pctVal / 1000;
                        if (pct !== 100) {
                            para.lineSpacingPercent = pct;
                        }
                    }
                    const spcPts = findChild(lnSpc, "spcPts");
                    if (spcPts) {
                        para.lineSpacingPt =
                            parseInt(spcPts.getAttribute("val") ?? "0", 10) / 100;
                    }
                }
                const spcAft = findChild(pPr, "spcAft");
                if (spcAft) {
                    const spcPts = findChild(spcAft, "spcPts");
                    if (spcPts) {
                        para.spacingAfterPt =
                            parseInt(spcPts.getAttribute("val") ?? "0", 10) / 100;
                    }
                }
                const spcBef = findChild(pPr, "spcBef");
                if (spcBef) {
                    const spcPts = findChild(spcBef, "spcPts");
                    if (spcPts) {
                        para.spacingBeforePt =
                            parseInt(spcPts.getAttribute("val") ?? "0", 10) / 100;
                    }
                }
                const buChar = findChild(pPr, "buChar");
                if (buChar) {
                    para.bulletChar = buChar.getAttribute("char") ?? undefined;
                }
                // Bullet font (e.g. Wingdings, Symbol)
                const buFont = findChild(pPr, "buFont");
                if (buFont) {
                    para.bulletFont = buFont.getAttribute("typeface") ?? undefined;
                }
                // Bullet color
                const buClr = findChild(pPr, "buClr");
                if (buClr) {
                    para.bulletColor = resolveColor(buClr, themeColors);
                }
            }
            // Iterate over all children to handle both text runs (<a:r>) and line breaks (<a:br>)
            // This ensures proper spacing when text spans multiple lines
            for (const child of Array.from(p.childNodes)) {
                if (child.nodeType !== 1)
                    continue; // ELEMENT_NODE = 1
                const el = child;
                const localName = el.localName || el.nodeName.split(':').pop();
                if (localName === 'r') {
                    // Text run
                    const rPr = findChild(el, "rPr");
                    const props = extractRunProps(rPr, scale, themeColors, themeFonts);
                    const tEls = findChildren(el, "t");
                    const text = tEls.map((t) => t.textContent ?? "").join("");
                    if (text) {
                        para.runs.push({
                            text,
                            bold: props.bold ?? defaults?.bold,
                            italic: props.italic ?? defaults?.italic,
                            underline: props.underline ?? defaults?.underline,
                            fontSize: props.fontSize ?? defaults?.fontSize ?? Math.round(hptToPx(1800) * scale),
                            color: props.color ?? defaults?.color,
                            fontFamily: props.fontFamily ?? defaults?.fontFamily,
                            textShadow: props.textShadow ?? defaults?.textShadow,
                            gradientFill: props.gradientFill ?? defaults?.gradientFill,
                        });
                    }
                }
                else if (localName === 'br') {
                    // Line break - add a newline to the previous run or create a new run with just newline
                    if (para.runs.length > 0) {
                        // Append newline to the last run's text
                        para.runs[para.runs.length - 1].text += '\n';
                    }
                    else {
                        // No previous run, create a new one with just newline
                        para.runs.push({ text: '\n' });
                    }
                }
            }
            if (para.runs.length === 0) {
                // Empty paragraphs produce real blank lines in PPT text boxes;
                // keep them so vertical rhythm matches the source. Their height
                // follows endParaRPr when present, else the 18pt default.
                const endRPr = findChild(p, "endParaRPr");
                const endProps = extractRunProps(endRPr, scale, themeColors, themeFonts);
                para.emptyFontSize = endProps.fontSize ?? Math.round(hptToPx(1800) * scale);
            }
            shape.paragraphs.push(para);
        }
    }
    return shape;
}
function parsePicture(pic, scale, imageMap) {
    const spPr = findChild(pic, "spPr");
    if (!spPr)
        return null;
    const xfrm = findChild(spPr, "xfrm");
    if (!xfrm)
        return null;
    const off = findChild(xfrm, "off");
    const ext = findChild(xfrm, "ext");
    if (!off || !ext)
        return null;
    const blipFill = findChild(pic, "blipFill");
    if (!blipFill)
        return null;
    const blip = findChild(blipFill, "blip");
    if (!blip)
        return null;
    // First, try to get SVG from asvg:svgBlip (higher quality)
    let rEmbed = null;
    const extLst = findChild(blip, "extLst");
    if (extLst) {
        for (let i = 0; i < extLst.children.length; i++) {
            const ext = extLst.children[i];
            if (ext.localName === "ext") {
                // Look for svgBlip in extension
                for (let j = 0; j < ext.children.length; j++) {
                    const child = ext.children[j];
                    if (child.localName === "svgBlip") {
                        rEmbed =
                            child.getAttribute("r:embed") ??
                                child.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
                        break;
                    }
                }
                if (rEmbed)
                    break;
            }
        }
    }
    // Fallback to regular blip if no SVG found
    if (!rEmbed) {
        rEmbed =
            blip.getAttribute("r:embed") ??
                blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
    }
    if (!rEmbed)
        return null;
    const dataUri = imageMap.get(rEmbed);
    if (!dataUri)
        return null;
    const nvPicPr = findChild(pic, "nvPicPr");
    const cNvPr = nvPicPr ? findChild(nvPicPr, "cNvPr") : null;
    const alt = cNvPr?.getAttribute("descr") ?? undefined;
    // Check for srcRect cropping
    const srcRect = findChild(blipFill, "srcRect");
    let hasCrop = false;
    let cropLeft = 0;
    let cropTop = 0;
    let cropRight = 0;
    let cropBottom = 0;
    if (srcRect) {
        // srcRect values are in 1/1000th of a percent (e.g., 49710 = 49.71%)
        cropLeft = parseInt(srcRect.getAttribute("l") ?? "0", 10) / 1000;
        cropRight = parseInt(srcRect.getAttribute("r") ?? "0", 10) / 1000;
        cropTop = parseInt(srcRect.getAttribute("t") ?? "0", 10) / 1000;
        cropBottom = parseInt(srcRect.getAttribute("b") ?? "0", 10) / 1000;
        // If any cropping is applied, record the crop values
        hasCrop = cropLeft > 0 || cropRight > 0 || cropTop > 0 || cropBottom > 0;
    }
    // Extract border-radius from roundRect preset geometry
    let borderRadius;
    const prstGeom = findChild(spPr, "prstGeom");
    if (prstGeom?.getAttribute("prst") === "roundRect") {
        const avLst = findChild(prstGeom, "avLst");
        const gd = avLst ? findChild(avLst, "gd") : null;
        // Default adj value for roundRect is 16667 (1/6 of 100000)
        const adjVal = gd
            ? parseInt(gd.getAttribute("fmla")?.replace("val ", "") ?? "16667", 10)
            : 16667;
        const wEmu = parseInt(ext.getAttribute("cx") ?? "0", 10);
        const hEmu = parseInt(ext.getAttribute("cy") ?? "0", 10);
        const minDim = Math.min(wEmu, hEmu);
        // The adjustment value is a percentage where 50000 = 50% = max possible radius
        const radiusEmu = (minDim * Math.min(adjVal, 50000)) / 100000;
        borderRadius = Math.round(emuToPx(radiusEmu) * scale);
    }
    // Extract rotation from xfrm
    let rotation;
    const rotAttr = xfrm.getAttribute("rot");
    if (rotAttr) {
        const rotDeg = parseInt(rotAttr, 10) / 60000;
        if (rotDeg !== 0)
            rotation = rotDeg;
    }
    // Custom geometry on pictures clips the photo to a freeform silhouette
    // (e.g. a right-triangle mask). Only simple polygons can be represented.
    let clipPath;
    const picCustGeom = findChild(spPr, "custGeom");
    if (picCustGeom) {
        clipPath = extractCustGeomClipPath(picCustGeom) ?? undefined;
    }
    return {
        x: Math.round(emuToPx(parseInt(off.getAttribute("x") ?? "0", 10)) * scale),
        y: Math.round(emuToPx(parseInt(off.getAttribute("y") ?? "0", 10)) * scale),
        w: Math.round(emuToPx(parseInt(ext.getAttribute("cx") ?? "0", 10)) * scale),
        h: Math.round(emuToPx(parseInt(ext.getAttribute("cy") ?? "0", 10)) * scale),
        dataUri,
        alt,
        borderRadius,
        hasCrop,
        cropLeft: hasCrop ? cropLeft : undefined,
        cropTop: hasCrop ? cropTop : undefined,
        cropRight: hasCrop ? cropRight : undefined,
        cropBottom: hasCrop ? cropBottom : undefined,
        rotation,
        clipPath,
    };
}
// ============================================================================
// Table Style Parsing
// ============================================================================
/**
 * Parse ppt/tableStyles.xml and return a map from style GUID to TableStyleInfo.
 * Table styles define default fills for wholeTbl, banded rows, header row, etc.
 * Cells without explicit fills inherit colors from their table style.
 */
async function parseTableStyles(zip, parser, themeColors) {
    const map = new Map();
    const xml = await zip.file("ppt/tableStyles.xml")?.async("text");
    if (!xml)
        return map;
    const doc = parser.parseFromString(xml, "application/xml");
    // Each <a:tblStyle styleId="{GUID}"> defines one table style
    const styleEls = doc.getElementsByTagName("a:tblStyle");
    for (let i = 0; i < styleEls.length; i++) {
        const styleEl = styleEls[i];
        const styleId = styleEl.getAttribute("styleId");
        if (!styleId)
            continue;
        const info = {};
        // Helper: extract solid fill color from a tcStyle element
        const extractTcStyleFill = (sectionEl) => {
            const tcStyle = findChild(sectionEl, "tcStyle");
            if (!tcStyle)
                return undefined;
            const fill = findChild(tcStyle, "fill");
            if (!fill)
                return undefined;
            const solidFill = findChild(fill, "solidFill");
            if (!solidFill)
                return undefined;
            return resolveColor(solidFill, themeColors);
        };
        // wholeTbl 鈥?default fill for all cells
        const wholeTbl = findChild(styleEl, "wholeTbl");
        if (wholeTbl) {
            info.wholeTblFill = extractTcStyleFill(wholeTbl);
        }
        // band1H 鈥?odd-row banding fill
        const band1H = findChild(styleEl, "band1H");
        if (band1H) {
            info.band1Fill = extractTcStyleFill(band1H);
        }
        // band2H 鈥?even-row banding fill (if absent, inherits wholeTblFill)
        const band2H = findChild(styleEl, "band2H");
        if (band2H) {
            info.band2Fill = extractTcStyleFill(band2H);
        }
        // firstRow 鈥?header-row fill
        const firstRow = findChild(styleEl, "firstRow");
        if (firstRow) {
            info.firstRowFill = extractTcStyleFill(firstRow);
        }
        map.set(styleId, info);
    }
    return map;
}
// ============================================================================
// Table Parsing Functions
// ============================================================================
function parseCellBorder(tcPr, borderName, scale, themeColors) {
    const borderEl = findChild(tcPr, borderName);
    if (!borderEl)
        return undefined;
    // Check for noFill (no border)
    const noFill = findChild(borderEl, "noFill");
    if (noFill)
        return undefined;
    const wAttr = borderEl.getAttribute("w");
    const width = wAttr
        ? Math.max(1, Math.round(emuToPx(parseInt(wAttr, 10)) * scale))
        : 1;
    const solidFill = findChild(borderEl, "solidFill");
    const color = solidFill ? resolveColor(solidFill, themeColors) ?? "#000000" : "#000000";
    // Borders with fully-transparent color (alpha=0) are effectively invisible;
    // treat them as no border to avoid layout artifacts in the HTML output.
    if (color.startsWith("rgba(") && color.endsWith(",0)"))
        return undefined;
    // Parse dash type
    let style = "solid";
    const prstDash = findChild(borderEl, "prstDash");
    if (prstDash) {
        const dashVal = prstDash.getAttribute("val");
        if (dashVal === "dash" || dashVal === "lgDash" || dashVal === "sysDash") {
            style = "dashed";
        }
        else if (dashVal === "dot" || dashVal === "sysDot") {
            style = "dotted";
        }
    }
    return { width, color, style };
}
function parseParagraphsFromTxBody(txBody, scale, themeColors, themeFonts) {
    const paragraphs = [];
    const pEls = findChildren(txBody, "p");
    for (const p of pEls) {
        const para = { runs: [] };
        const pPr = findChild(p, "pPr");
        let defaults = undefined;
        if (pPr) {
            const algn = pPr.getAttribute("algn");
            if (algn) {
                para.align =
                    algn === "ctr"
                        ? "center"
                        : algn === "r"
                            ? "right"
                            : algn === "just"
                                ? "justify"
                                : "left";
            }
            const marL = pPr.getAttribute("marL");
            if (marL)
                para.marginLeftPx = Math.round(emuToPx(parseInt(marL, 10)) * scale);
            const indent = pPr.getAttribute("indent");
            if (indent)
                para.indentPx = Math.round(emuToPx(parseInt(indent, 10)) * scale);
            const defRPr = findChild(pPr, "defRPr");
            if (defRPr) {
                defaults = extractRunProps(defRPr, scale, themeColors, themeFonts);
            }
            const lnSpc = findChild(pPr, "lnSpc");
            if (lnSpc) {
                const spcPct = findChild(lnSpc, "spcPct");
                if (spcPct) {
                    const pctVal = parseInt(spcPct.getAttribute("val") ?? "100000", 10);
                    // spcPct val is percentage * 1000, e.g. 150000 = 150%
                    // Skip 100% (default single spacing) 鈥?CSS line-height:100% is tighter than intended
                    const pct = pctVal / 1000;
                    if (pct !== 100) {
                        para.lineSpacingPercent = pct;
                    }
                }
                const spcPts = findChild(lnSpc, "spcPts");
                if (spcPts) {
                    para.lineSpacingPt =
                        parseInt(spcPts.getAttribute("val") ?? "0", 10) / 100;
                }
            }
            const spcAft = findChild(pPr, "spcAft");
            if (spcAft) {
                const spcPts = findChild(spcAft, "spcPts");
                if (spcPts) {
                    para.spacingAfterPt =
                        parseInt(spcPts.getAttribute("val") ?? "0", 10) / 100;
                }
            }
            const spcBef = findChild(pPr, "spcBef");
            if (spcBef) {
                const spcPts = findChild(spcBef, "spcPts");
                if (spcPts) {
                    para.spacingBeforePt =
                        parseInt(spcPts.getAttribute("val") ?? "0", 10) / 100;
                }
            }
            const buChar = findChild(pPr, "buChar");
            if (buChar) {
                para.bulletChar = buChar.getAttribute("char") ?? undefined;
            }
            // Bullet font (e.g. Wingdings, Symbol)
            const buFont = findChild(pPr, "buFont");
            if (buFont) {
                para.bulletFont = buFont.getAttribute("typeface") ?? undefined;
            }
            // Bullet color
            const buClr = findChild(pPr, "buClr");
            if (buClr) {
                para.bulletColor = resolveColor(buClr, themeColors);
            }
        }
        for (const child of Array.from(p.childNodes)) {
            if (child.nodeType !== 1)
                continue;
            const el = child;
            const localName = el.localName || el.nodeName.split(':').pop();
            if (localName === 'r') {
                const rPr = findChild(el, "rPr");
                const props = extractRunProps(rPr, scale, themeColors, themeFonts);
                const tEls = findChildren(el, "t");
                const text = tEls.map((t) => t.textContent ?? "").join("");
                if (text) {
                    para.runs.push({
                        text,
                        bold: props.bold ?? defaults?.bold,
                        italic: props.italic ?? defaults?.italic,
                        underline: props.underline ?? defaults?.underline,
                        fontSize: props.fontSize ?? defaults?.fontSize,
                        color: props.color ?? defaults?.color,
                        fontFamily: props.fontFamily ?? defaults?.fontFamily,
                        textShadow: props.textShadow ?? defaults?.textShadow,
                        gradientFill: props.gradientFill ?? defaults?.gradientFill,
                    });
                }
            }
            else if (localName === 'br') {
                if (para.runs.length > 0) {
                    para.runs[para.runs.length - 1].text += '\n';
                }
                else {
                    para.runs.push({ text: '\n' });
                }
            }
        }
        if (para.runs.length > 0) {
            paragraphs.push(para);
        }
    }
    return paragraphs;
}
function parseTable(graphicFrame, scale, themeColors, themeFonts, tableStyleMap) {
    // Extract position from xfrm
    const xfrm = findChild(graphicFrame, "xfrm");
    if (!xfrm)
        return null;
    const off = findChild(xfrm, "off");
    const ext = findChild(xfrm, "ext");
    if (!off || !ext)
        return null;
    // Find the table element: graphicFrame > graphic > graphicData > tbl
    const graphic = findChild(graphicFrame, "graphic");
    if (!graphic)
        return null;
    const graphicData = findChild(graphic, "graphicData");
    if (!graphicData)
        return null;
    // Check if it's a table (URI should contain "table")
    const uri = graphicData.getAttribute("uri") ?? "";
    if (!uri.includes("table"))
        return null;
    const tbl = findChild(graphicData, "tbl");
    if (!tbl)
        return null;
    // Read table properties for style flags
    const tblPr = findChild(tbl, "tblPr");
    const hasFirstRow = tblPr?.getAttribute("firstRow") === "1";
    const hasBandRow = tblPr?.getAttribute("bandRow") === "1";
    // Look up table style for fill defaults
    let styleInfo;
    if (tblPr && tableStyleMap) {
        const styleIdEl = findChild(tblPr, "tableStyleId");
        if (styleIdEl) {
            const styleId = styleIdEl.textContent?.trim();
            if (styleId)
                styleInfo = tableStyleMap.get(styleId);
        }
    }
    const table = {
        x: Math.round(emuToPx(parseInt(off.getAttribute("x") ?? "0", 10)) * scale),
        y: Math.round(emuToPx(parseInt(off.getAttribute("y") ?? "0", 10)) * scale),
        w: Math.round(emuToPx(parseInt(ext.getAttribute("cx") ?? "0", 10)) * scale),
        h: Math.round(emuToPx(parseInt(ext.getAttribute("cy") ?? "0", 10)) * scale),
        rows: [],
        colWidths: [],
    };
    // Parse column widths from tblGrid
    const tblGrid = findChild(tbl, "tblGrid");
    if (tblGrid) {
        const gridCols = findChildren(tblGrid, "gridCol");
        for (const col of gridCols) {
            const w = parseInt(col.getAttribute("w") ?? "0", 10);
            table.colWidths.push(Math.round(emuToPx(w) * scale));
        }
    }
    // Parse rows
    const trEls = findChildren(tbl, "tr");
    let rowIndex = 0;
    for (const tr of trEls) {
        const rowHeight = tr.getAttribute("h");
        const row = {
            cells: [],
            height: rowHeight
                ? Math.round(emuToPx(parseInt(rowHeight, 10)) * scale)
                : undefined,
        };
        const tcEls = findChildren(tr, "tc");
        for (const tc of tcEls) {
            const cell = {
                paragraphs: [],
            };
            // Parse cell text content
            const txBody = findChild(tc, "txBody");
            if (txBody) {
                cell.paragraphs = parseParagraphsFromTxBody(txBody, scale, themeColors, themeFonts);
            }
            // Parse cell properties
            const tcPr = findChild(tc, "tcPr");
            if (tcPr) {
                // Cell fill 鈥?use explicit fill from tcPr first, then fall back to
                // the table style fill based on row position and style flags.
                const explicitFill = extractFill(tcPr, themeColors);
                let styleFill;
                if (styleInfo) {
                    if (hasFirstRow && rowIndex === 0) {
                        // Header row: use firstRowFill from the table style
                        styleFill = styleInfo.firstRowFill;
                    }
                    else if (hasBandRow) {
                        // Body rows with banding enabled: alternate between band fills.
                        // The "data row index" starts after the header (if present).
                        const dataRowIdx = hasFirstRow ? rowIndex - 1 : rowIndex;
                        styleFill =
                            dataRowIdx % 2 === 0
                                ? styleInfo.band1Fill ?? styleInfo.wholeTblFill
                                : styleInfo.band2Fill ?? styleInfo.wholeTblFill;
                    }
                    else {
                        styleFill = styleInfo.wholeTblFill;
                    }
                }
                cell.fill = explicitFill ?? styleFill;
                // Vertical alignment
                const anchor = tcPr.getAttribute("anchor");
                if (anchor === "ctr")
                    cell.verticalAlign = "center";
                else if (anchor === "b")
                    cell.verticalAlign = "bottom";
                else
                    cell.verticalAlign = "top";
                // Cell margins (PPTX defaults: L/R=91440 EMU ~9.6px, T/B=45720 EMU ~4.8px)
                const marL = tcPr.getAttribute("marL");
                const marR = tcPr.getAttribute("marR");
                const marT = tcPr.getAttribute("marT");
                const marB = tcPr.getAttribute("marB");
                cell.padding = {
                    left: Math.round(emuToPx(parseInt(marL ?? "91440", 10)) * scale),
                    right: Math.round(emuToPx(parseInt(marR ?? "91440", 10)) * scale),
                    top: Math.round(emuToPx(parseInt(marT ?? "45720", 10)) * scale),
                    bottom: Math.round(emuToPx(parseInt(marB ?? "45720", 10)) * scale),
                };
                // Cell borders
                cell.borderLeft = parseCellBorder(tcPr, "lnL", scale, themeColors);
                cell.borderRight = parseCellBorder(tcPr, "lnR", scale, themeColors);
                cell.borderTop = parseCellBorder(tcPr, "lnT", scale, themeColors);
                cell.borderBottom = parseCellBorder(tcPr, "lnB", scale, themeColors);
            }
            else {
                // No tcPr: use PPTX default margins
                cell.padding = {
                    left: Math.round(emuToPx(91440) * scale),
                    right: Math.round(emuToPx(91440) * scale),
                    top: Math.round(emuToPx(45720) * scale),
                    bottom: Math.round(emuToPx(45720) * scale),
                };
            }
            // Column span
            const gridSpan = tc.getAttribute("gridSpan");
            if (gridSpan) {
                const span = parseInt(gridSpan, 10);
                if (span > 1)
                    cell.colSpan = span;
            }
            // Row span
            const rowSpan = tc.getAttribute("rowSpan");
            if (rowSpan) {
                const span = parseInt(rowSpan, 10);
                if (span > 1)
                    cell.rowSpan = span;
            }
            // Skip merged cells (vMerge = vertically merged continuation)
            const vMerge = tc.getAttribute("vMerge");
            if (vMerge === "1" || vMerge === "true") {
                // This cell is a continuation of a vertical merge - still add it but mark it
                // We'll skip rendering it in the HTML
                continue;
            }
            // Skip horizontally merged continuation cells
            const hMerge = tc.getAttribute("hMerge");
            if (hMerge === "1" || hMerge === "true") {
                continue;
            }
            row.cells.push(cell);
        }
        table.rows.push(row);
        rowIndex++;
    }
    return table;
}
// ============================================================================
// Chart Parsing
// ============================================================================
/**
 * Resolve a color from a chart fill element (handles srgbClr and schemeClr).
 * Chart XML uses DrawingML (a:) namespace, same as shapes.
 */
function resolveChartColor(parent, themeColors) {
    const solidFill = findChild(parent, "solidFill");
    if (!solidFill)
        return undefined;
    return resolveColor(solidFill, themeColors);
}
/**
 * Extract text from a rich text element (c:rich) commonly used for chart/axis titles.
 * Returns the concatenated text and optional font/color/size from the first run.
 */
function parseChartRichText(richEl) {
    const paragraphs = findChildren(richEl, "p");
    let text = "";
    let font;
    let color;
    let size;
    for (const p of paragraphs) {
        const runs = findChildren(p, "r");
        for (const r of runs) {
            const tEl = findChild(r, "t");
            if (tEl?.textContent)
                text += tEl.textContent;
            // Extract formatting from first run only
            if (font === undefined) {
                const rPr = findChild(r, "rPr");
                if (rPr) {
                    const szAttr = rPr.getAttribute("sz");
                    if (szAttr)
                        size = hptToPx(parseInt(szAttr, 10));
                    const latin = findChild(rPr, "latin");
                    if (latin)
                        font = latin.getAttribute("typeface") ?? undefined;
                    const fill = findChild(rPr, "solidFill");
                    if (fill) {
                        const srgb = findChild(fill, "srgbClr");
                        if (srgb)
                            color = "#" + (srgb.getAttribute("val") ?? "000000");
                    }
                }
            }
        }
    }
    return { text, font, color, size };
}
/**
 * Extract axis title and label formatting from a chart axis element (c:catAx or c:valAx).
 */
function parseChartAxis(axEl) {
    const axis = {
        position: "b",
    };
    // Axis position
    const axPos = findChild(axEl, "axPos");
    if (axPos) {
        const val = axPos.getAttribute("val");
        if (val === "b" || val === "l" || val === "r" || val === "t") {
            axis.position = val;
        }
    }
    // Axis title
    const titleEl = findChild(axEl, "title");
    if (titleEl) {
        const tx = findChild(titleEl, "tx");
        if (tx) {
            const rich = findChild(tx, "rich");
            if (rich) {
                const parsed = parseChartRichText(rich);
                axis.title = parsed.text;
            }
        }
    }
    // Number format
    const numFmt = findChild(axEl, "numFmt");
    if (numFmt) {
        const fmt = numFmt.getAttribute("formatCode");
        if (fmt)
            axis.numFormat = fmt;
    }
    // Label formatting from txPr
    const txPr = findChild(axEl, "txPr");
    if (txPr) {
        const pEls = findChildren(txPr, "p");
        for (const p of pEls) {
            const pPr = findChild(p, "pPr");
            if (pPr) {
                const defRPr = findChild(pPr, "defRPr");
                if (defRPr) {
                    const szAttr = defRPr.getAttribute("sz");
                    if (szAttr)
                        axis.labelSize = hptToPx(parseInt(szAttr, 10));
                    const latin = findChild(defRPr, "latin");
                    if (latin)
                        axis.labelFont = latin.getAttribute("typeface") ?? undefined;
                    const fill = findChild(defRPr, "solidFill");
                    if (fill) {
                        const srgb = findChild(fill, "srgbClr");
                        if (srgb)
                            axis.labelColor = "#" + (srgb.getAttribute("val") ?? "000000");
                    }
                }
            }
        }
    }
    // Gridlines
    const gridlines = findChild(axEl, "majorGridlines");
    if (gridlines) {
        const spPr = findChild(gridlines, "spPr");
        if (spPr) {
            const ln = findChild(spPr, "ln");
            if (ln) {
                const fill = findChild(ln, "solidFill");
                if (fill) {
                    const srgb = findChild(fill, "srgbClr");
                    if (srgb) {
                        axis.gridlineColor = "#" + (srgb.getAttribute("val") ?? "CCCCCC");
                        const alphaEl = findChild(srgb, "alpha");
                        if (alphaEl) {
                            axis.gridlineAlpha = parseInt(alphaEl.getAttribute("val") ?? "100000", 10) / 1000;
                        }
                    }
                }
            }
        }
    }
    // Min value from scaling
    const scaling = findChild(axEl, "scaling");
    if (scaling) {
        const minEl = findChild(scaling, "min");
        if (minEl) {
            const val = minEl.getAttribute("val");
            if (val)
                axis.min = parseFloat(val);
        }
    }
    return axis;
}
/**
 * Parse a chart XML file and extract chart data for rendering.
 * Handles bar/column charts (c:barChart).
 */
async function parseChart(graphicFrame, scale, themeColors, zip, slideRelsDoc, parser) {
    // Extract position from xfrm (same pattern as parseTable)
    const xfrm = findChild(graphicFrame, "xfrm");
    if (!xfrm)
        return null;
    const off = findChild(xfrm, "off");
    const ext = findChild(xfrm, "ext");
    if (!off || !ext)
        return null;
    // Navigate to graphicData and check URI
    const graphic = findChild(graphicFrame, "graphic");
    if (!graphic)
        return null;
    const graphicData = findChild(graphic, "graphicData");
    if (!graphicData)
        return null;
    const uri = graphicData.getAttribute("uri") ?? "";
    if (!uri.includes("chart"))
        return null;
    // Find the c:chart reference element inside graphicData
    let chartRId;
    for (let i = 0; i < graphicData.children.length; i++) {
        const child = graphicData.children[i];
        if (child.localName === "chart") {
            // r:id attribute - try both with and without namespace prefix
            chartRId = child.getAttribute("r:id")
                ?? child.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
                ?? undefined;
            break;
        }
    }
    if (!chartRId)
        return null;
    // Resolve the rId via slide rels to get chart XML path
    let chartTarget;
    const rels = slideRelsDoc.getElementsByTagName("Relationship");
    for (let ri = 0; ri < rels.length; ri++) {
        const rel = rels[ri];
        if (rel.getAttribute("Id") === chartRId) {
            chartTarget = rel.getAttribute("Target") ?? undefined;
            break;
        }
    }
    if (!chartTarget)
        return null;
    // Resolve relative path (e.g., ../charts/chart1.xml 鈫?ppt/charts/chart1.xml)
    const chartPath = chartTarget.startsWith("../")
        ? "ppt/" + chartTarget.slice(3)
        : chartTarget;
    // Load chart XML from ZIP
    const chartXml = await zip.file(chartPath)?.async("text");
    if (!chartXml)
        return null;
    const chartDoc = parser.parseFromString(chartXml, "application/xml");
    const chartSpace = chartDoc.documentElement; // c:chartSpace
    // Position
    const x = Math.round(emuToPx(parseInt(off.getAttribute("x") ?? "0", 10)) * scale);
    const y = Math.round(emuToPx(parseInt(off.getAttribute("y") ?? "0", 10)) * scale);
    const w = Math.round(emuToPx(parseInt(ext.getAttribute("cx") ?? "0", 10)) * scale);
    const h = Math.round(emuToPx(parseInt(ext.getAttribute("cy") ?? "0", 10)) * scale);
    // Navigate to c:chart element
    const chartEl = findChild(chartSpace, "chart");
    if (!chartEl)
        return null;
    // Parse chart title
    let title;
    let titleFont;
    let titleColor;
    let titleSize;
    const titleEl = findChild(chartEl, "title");
    if (titleEl) {
        const tx = findChild(titleEl, "tx");
        if (tx) {
            const rich = findChild(tx, "rich");
            if (rich) {
                const parsed = parseChartRichText(rich);
                title = parsed.text;
                titleFont = parsed.font;
                titleColor = parsed.color;
                titleSize = parsed.size;
            }
        }
    }
    // Parse plot area
    const plotArea = findChild(chartEl, "plotArea");
    if (!plotArea)
        return null;
    // Look for barChart
    const barChart = findChild(plotArea, "barChart");
    if (!barChart)
        return null; // Only bar charts supported for now
    // Determine chart direction
    const barDirEl = findChild(barChart, "barDir");
    const barDir = barDirEl?.getAttribute("val") ?? "col";
    const chartType = barDir === "bar" ? "bar" : "column";
    // Gap width
    const gapWidthEl = findChild(barChart, "gapWidth");
    const gapWidth = gapWidthEl
        ? parseInt(gapWidthEl.getAttribute("val") ?? "150", 10)
        : 150;
    // Rounded corners
    const roundedCornersEl = findChild(chartSpace, "roundedCorners");
    const roundedCorners = roundedCornersEl?.getAttribute("val") === "1";
    // Parse series
    const series = [];
    const serEls = findChildren(barChart, "ser");
    for (const ser of serEls) {
        const seriesData = {
            categories: [],
            values: [],
            fillColors: [],
        };
        // Series name
        const txEl = findChild(ser, "tx");
        if (txEl) {
            const strRef = findChild(txEl, "strRef");
            if (strRef) {
                const strCache = findChild(strRef, "strCache");
                if (strCache) {
                    const pt = findChild(strCache, "pt");
                    if (pt) {
                        const v = findChild(pt, "v");
                        if (v?.textContent)
                            seriesData.name = v.textContent;
                    }
                }
            }
        }
        // Series-level color
        const serSpPr = findChild(ser, "spPr");
        if (serSpPr) {
            const color = resolveChartColor(serSpPr, themeColors);
            if (color)
                seriesData.seriesColor = color;
        }
        // Per-data-point colors from c:dPt
        const dPtMap = new Map();
        const dPtEls = findChildren(ser, "dPt");
        for (const dPt of dPtEls) {
            const idxEl = findChild(dPt, "idx");
            const idx = idxEl ? parseInt(idxEl.getAttribute("val") ?? "0", 10) : 0;
            const spPr = findChild(dPt, "spPr");
            if (spPr) {
                const color = resolveChartColor(spPr, themeColors);
                if (color)
                    dPtMap.set(idx, color);
            }
        }
        // Categories from c:cat
        const catEl = findChild(ser, "cat");
        if (catEl) {
            const strRef = findChild(catEl, "strRef");
            if (strRef) {
                const strCache = findChild(strRef, "strCache");
                if (strCache) {
                    const pts = findChildren(strCache, "pt");
                    for (const pt of pts) {
                        const v = findChild(pt, "v");
                        seriesData.categories.push(v?.textContent ?? "");
                    }
                }
            }
        }
        // Values from c:val
        const valEl = findChild(ser, "val");
        if (valEl) {
            const numRef = findChild(valEl, "numRef");
            if (numRef) {
                const numCache = findChild(numRef, "numCache");
                if (numCache) {
                    const pts = findChildren(numCache, "pt");
                    for (const pt of pts) {
                        const v = findChild(pt, "v");
                        seriesData.values.push(parseFloat(v?.textContent ?? "0"));
                    }
                }
            }
        }
        // Build per-point fill colors array
        for (let i = 0; i < seriesData.values.length; i++) {
            seriesData.fillColors.push(dPtMap.get(i) ?? undefined);
        }
        series.push(seriesData);
    }
    if (series.length === 0)
        return null;
    // Parse axes
    let categoryAxis;
    let valueAxis;
    const catAx = findChild(plotArea, "catAx");
    if (catAx) {
        categoryAxis = parseChartAxis(catAx);
    }
    const valAx = findChild(plotArea, "valAx");
    if (valAx) {
        valueAxis = parseChartAxis(valAx);
    }
    return {
        x, y, w, h,
        chartType,
        title,
        titleFont,
        titleColor,
        titleSize,
        series,
        categoryAxis,
        valueAxis,
        gapWidth,
        roundedCorners,
    };
}
// ============================================================================
// Rendering Functions
// ============================================================================
/**
 * Format a numeric value using an OOXML number format string.
 * Handles common patterns like "$"#,##0 鈫?$150, #,##0.0 鈫?150.0, General 鈫?raw
 */
function formatChartValue(value, numFormat) {
    if (!numFormat || numFormat === "General") {
        // Smart default: if the value is a whole number, show no decimals
        return Number.isInteger(value) ? value.toString() : value.toFixed(1);
    }
    // Extract prefix (e.g., "$" or text in quotes)
    let prefix = "";
    let suffix = "";
    let fmt = numFormat;
    // Handle quoted prefix like "$" or "鈧?
    const prefixMatch = fmt.match(/^"([^"]*)"(.*)$/);
    if (prefixMatch) {
        prefix = prefixMatch[1];
        fmt = prefixMatch[2];
    }
    // Handle quoted suffix
    const suffixMatch = fmt.match(/^(.*)"([^"]*)"$/);
    if (suffixMatch) {
        fmt = suffixMatch[1];
        suffix = suffixMatch[2];
    }
    // Determine decimal places from format
    const decimalMatch = fmt.match(/\.(0+)/);
    const decimals = decimalMatch ? decimalMatch[1].length : 0;
    // Format the number
    const absVal = Math.abs(value);
    let formatted;
    if (fmt.includes(",")) {
        // Thousands separator
        const parts = absVal.toFixed(decimals).split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        formatted = parts.join(".");
    }
    else {
        formatted = absVal.toFixed(decimals);
    }
    const sign = value < 0 ? "-" : "";
    return sign + prefix + formatted + suffix;
}
/**
 * Escape text for safe embedding inside SVG <text> elements.
 */
function escSvg(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
/**
 * Render a chart as an inline SVG inside a positioned div.
 */
function renderChartSvg(chart, elId) {
    const { x, y, w, h } = chart;
    // Layout constants (in px, relative to chart dimensions)
    const titleHeight = chart.title ? Math.max(24, (chart.titleSize ?? 16) + 12) : 0;
    const axisLabelHeight = 16; // space for category labels at bottom
    const axisTitleHeight = chart.categoryAxis?.title ? 18 : 0;
    const valAxisTitleWidth = chart.valueAxis?.title ? 20 : 0;
    // Calculate value axis label width based on max formatted value
    const allValues = chart.series.flatMap(s => s.values);
    const maxValue = Math.max(...allValues, 0);
    const valNumFormat = chart.valueAxis?.numFormat;
    const maxFormattedLabel = formatChartValue(maxValue, valNumFormat);
    const valLabelCharWidth = (chart.valueAxis?.labelSize ?? 11) * 0.6;
    const valLabelWidth = Math.max(30, maxFormattedLabel.length * valLabelCharWidth + 8);
    // Margins
    const marginTop = 8 + titleHeight;
    const marginBottom = 8 + axisLabelHeight + axisTitleHeight + 4;
    const marginLeft = 4 + valAxisTitleWidth + valLabelWidth;
    const marginRight = 12;
    // Plot area
    const plotX = marginLeft;
    const plotY = marginTop;
    const plotW = w - marginLeft - marginRight;
    const plotH = h - marginTop - marginBottom;
    if (plotW <= 0 || plotH <= 0)
        return "";
    // Determine value range
    const minValue = chart.valueAxis?.min ?? 0;
    const valueRange = maxValue - minValue;
    if (valueRange <= 0)
        return "";
    // Calculate nice tick intervals for gridlines
    const rawInterval = valueRange / 5;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
    const normalized = rawInterval / magnitude;
    let niceInterval;
    if (normalized <= 1)
        niceInterval = 1 * magnitude;
    else if (normalized <= 2)
        niceInterval = 2 * magnitude;
    else if (normalized <= 5)
        niceInterval = 5 * magnitude;
    else
        niceInterval = 10 * magnitude;
    // Generate tick values
    const ticks = [];
    let tickVal = Math.ceil(minValue / niceInterval) * niceInterval;
    while (tickVal <= maxValue) {
        ticks.push(tickVal);
        tickVal += niceInterval;
    }
    // Always include 0 if in range
    if (minValue <= 0 && !ticks.includes(0)) {
        ticks.unshift(0);
        ticks.sort((a, b) => a - b);
    }
    // Font settings
    const labelFont = chart.categoryAxis?.labelFont ?? chart.titleFont ?? "sans-serif";
    const labelColor = chart.categoryAxis?.labelColor ?? "#333";
    const labelSize = chart.categoryAxis?.labelSize ?? 11;
    const valLabelColor = chart.valueAxis?.labelColor ?? labelColor;
    const valLabelSize = chart.valueAxis?.labelSize ?? 11;
    // SVG building
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">`;
    // Chart title
    if (chart.title) {
        const tFont = chart.titleFont ? `font-family:${cssFontFamily(chart.titleFont)};` : `font-family:${cssFontFamily(labelFont)};`;
        const tColor = chart.titleColor ?? "#000";
        const tSize = chart.titleSize ?? 16;
        svg += `<text x="${w / 2}" y="${8 + tSize}" text-anchor="middle" `
            + `style="${tFont}font-size:${tSize}px;font-weight:bold;fill:${tColor}">`
            + `${escSvg(chart.title)}</text>`;
    }
    // Gridlines
    if (chart.valueAxis) {
        const gColor = chart.valueAxis.gridlineColor ?? "#e0e0e0";
        const gAlpha = chart.valueAxis.gridlineAlpha !== undefined
            ? chart.valueAxis.gridlineAlpha / 100
            : 0.3;
        for (const tick of ticks) {
            const tickY = plotY + plotH - ((tick - minValue) / valueRange) * plotH;
            svg += `<line x1="${plotX}" y1="${tickY}" x2="${plotX + plotW}" y2="${tickY}" `
                + `stroke="${gColor}" stroke-opacity="${gAlpha}" stroke-width="1"/>`;
        }
    }
    // Bars (column chart: vertical bars)
    const numCategories = chart.series[0]?.categories.length ?? 0;
    const numSeries = chart.series.length;
    if (numCategories > 0) {
        const gapFraction = (chart.gapWidth ?? 150) / 100;
        const categoryWidth = plotW / numCategories;
        const barGroupWidth = categoryWidth / (1 + gapFraction);
        const gapSpace = categoryWidth - barGroupWidth;
        const barWidth = barGroupWidth / numSeries;
        const cornerRadius = chart.roundedCorners ? Math.min(barWidth * 0.15, 4) : 0;
        for (let si = 0; si < numSeries; si++) {
            const s = chart.series[si];
            for (let ci = 0; ci < s.values.length; ci++) {
                const val = s.values[ci];
                const barH = ((val - minValue) / valueRange) * plotH;
                const barX = plotX + ci * categoryWidth + gapSpace / 2 + si * barWidth;
                const barY = plotY + plotH - barH;
                // Color: per-data-point > series-level > default
                const fillColor = s.fillColors[ci] ?? s.seriesColor ?? "#4472C4";
                if (cornerRadius > 0) {
                    // Rounded top corners only
                    const r = Math.min(cornerRadius, barH / 2, barWidth / 2);
                    svg += `<path d="M${barX},${barY + barH} `
                        + `L${barX},${barY + r} `
                        + `Q${barX},${barY} ${barX + r},${barY} `
                        + `L${barX + barWidth - r},${barY} `
                        + `Q${barX + barWidth},${barY} ${barX + barWidth},${barY + r} `
                        + `L${barX + barWidth},${barY + barH} Z" `
                        + `fill="${fillColor}"/>`;
                }
                else {
                    svg += `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" `
                        + `fill="${fillColor}"/>`;
                }
            }
        }
    }
    // Axis lines
    // Bottom axis (x)
    svg += `<line x1="${plotX}" y1="${plotY + plotH}" x2="${plotX + plotW}" y2="${plotY + plotH}" `
        + `stroke="${labelColor}" stroke-width="1"/>`;
    // Left axis (y)
    svg += `<line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotH}" `
        + `stroke="${valLabelColor}" stroke-width="1"/>`;
    // Category labels (bottom)
    if (numCategories > 0) {
        const categoryWidth = plotW / numCategories;
        const cats = chart.series[0]?.categories ?? [];
        for (let ci = 0; ci < cats.length; ci++) {
            const labelX = plotX + ci * categoryWidth + categoryWidth / 2;
            const labelY = plotY + plotH + 4;
            const catText = cats[ci];
            // Handle multi-line labels (split by newline)
            const lines = catText.split("\n");
            const lineH = labelSize + 2;
            for (let li = 0; li < lines.length; li++) {
                svg += `<text x="${labelX}" y="${labelY + labelSize + li * lineH}" `
                    + `text-anchor="middle" `
                    + `style="font-family:${cssFontFamily(labelFont)};font-size:${labelSize}px;fill:${labelColor}">`
                    + `${escSvg(lines[li])}</text>`;
            }
        }
    }
    // Value axis labels (left)
    for (const tick of ticks) {
        const tickY = plotY + plotH - ((tick - minValue) / valueRange) * plotH;
        const label = formatChartValue(tick, valNumFormat);
        svg += `<text x="${plotX - 6}" y="${tickY + valLabelSize * 0.35}" `
            + `text-anchor="end" `
            + `style="font-family:${cssFontFamily(labelFont)};font-size:${valLabelSize}px;fill:${valLabelColor}">`
            + `${escSvg(label)}</text>`;
    }
    // Category axis title (bottom)
    if (chart.categoryAxis?.title) {
        const axTitleY = plotY + plotH + axisLabelHeight + axisTitleHeight + 2;
        svg += `<text x="${plotX + plotW / 2}" y="${axTitleY}" `
            + `text-anchor="middle" `
            + `style="font-family:${cssFontFamily(labelFont)};font-size:${labelSize}px;fill:${labelColor}">`
            + `${escSvg(chart.categoryAxis.title)}</text>`;
    }
    // Value axis title (left, rotated)
    if (chart.valueAxis?.title) {
        const axTitleX = 4 + (chart.titleSize ?? 12) * 0.5;
        const axTitleY = plotY + plotH / 2;
        svg += `<text x="${axTitleX}" y="${axTitleY}" `
            + `text-anchor="middle" `
            + `transform="rotate(-90, ${axTitleX}, ${axTitleY})" `
            + `style="font-family:${cssFontFamily(labelFont)};font-size:${labelSize}px;fill:${valLabelColor}">`
            + `${escSvg(chart.valueAxis.title)}</text>`;
    }
    svg += `</svg>`;
    // Wrap in positioned div
    const wrapperStyles = [
        "position:absolute",
        `left:${x}px`,
        `top:${y}px`,
        `width:${w}px`,
        `height:${h}px`,
    ];
    return `<div id="${elId}" data-elementType="chart" style="${wrapperStyles.join(";")}">${svg}</div>\n`;
}
function renderSlideHtml(elements, bgColor, contentOffsetX = 0, slideWEmu = 0, slideHEmu = 0) {
    let inner = "";
    let elementIndex = 0;
    for (const el of elements) {
        const elId = `el-${elementIndex++}`;
        if (el.kind === "image") {
            const img = el.data;
            const altAttr = img.alt
                ? ` alt="${img.alt.replace(/"/g, "&quot;")}"`
                : "";
            // Detect fullbleed images (covering entire slide)
            const isFullbleed = img.x <= 10 && img.y <= 10 &&
                img.w >= TARGET_WIDTH - 20 && img.h >= TARGET_HEIGHT - 20;
            // Images with srcRect cropping: use div wrapper + overflow:hidden approach
            // This correctly reproduces PPTX srcRect behavior by:
            // 1. Computing the visible fraction of the source image
            // 2. Scaling the image so the visible region fills the element
            // 3. Offsetting to align the crop region
            // 4. Clipping with overflow:hidden
            if (img.hasCrop && img.cropLeft !== undefined && img.cropTop !== undefined &&
                img.cropRight !== undefined && img.cropBottom !== undefined) {
                const visW = (100 - img.cropLeft - img.cropRight) / 100;
                const visH = (100 - img.cropTop - img.cropBottom) / 100;
                // Guard against zero/negative visible fractions
                if (visW > 0 && visH > 0) {
                    // Scale image so visible region fills the element dimensions
                    const displayW = img.w / visW;
                    const displayH = img.h / visH;
                    // Offset to position the visible region at the element origin
                    const offsetX = -(img.cropLeft / 100) * displayW;
                    const offsetY = -(img.cropTop / 100) * displayH;
                    // Build wrapper div styles
                    const wrapperStyles = [
                        "position:absolute",
                        `left:${img.x}px`,
                        `top:${img.y}px`,
                        `width:${img.w}px`,
                        `height:${img.h}px`,
                        "overflow:hidden",
                    ];
                    // Apply rotation to wrapper if present (PPTX rotation around element center)
                    if (img.rotation) {
                        wrapperStyles.push(`transform:rotate(${img.rotation}deg)`);
                        wrapperStyles.push("transform-origin:center center");
                    }
                    // Custom geometry silhouette (freeform photo mask)
                    if (img.clipPath) {
                        wrapperStyles.push(`clip-path:${img.clipPath}`);
                    }
                    // Add border-radius to wrapper if present
                    if (img.borderRadius && img.borderRadius > 0) {
                        wrapperStyles.push(`border-radius:${img.borderRadius}px`);
                    }
                    const imgStyle = `position:absolute;width:${Math.round(displayW)}px;height:${Math.round(displayH)}px;left:${Math.round(offsetX)}px;top:${Math.round(offsetY)}px`;
                    inner += `<div id="${elId}" data-elementType="image" style="${wrapperStyles.join(";")}">`;
                    inner += `<img src="${img.dataUri}"${altAttr} style="${imgStyle}" />`;
                    inner += `</div>\n`;
                    continue;
                }
            }
            // Non-cropped images (or fallback): use simple img with object-fit
            const objectFit = isFullbleed ? "cover" : "contain";
            const stylesList = [
                "position:absolute",
                `left:${img.x}px`,
                `top:${img.y}px`,
                `width:${img.w}px`,
                `height:${img.h}px`,
                `object-fit:${objectFit}`,
            ];
            // Apply rotation if present (PPTX rotation around element center)
            if (img.rotation) {
                stylesList.push(`transform:rotate(${img.rotation}deg)`);
                stylesList.push("transform-origin:center center");
            }
            // Custom geometry silhouette (freeform photo mask)
            if (img.clipPath) {
                stylesList.push(`clip-path:${img.clipPath}`);
            }
            // Add border-radius if present
            if (img.borderRadius && img.borderRadius > 0) {
                stylesList.push(`border-radius:${img.borderRadius}px`);
            }
            const styles = stylesList.join(";");
            inner += `<img id="${elId}" data-elementType="image" src="${img.dataUri}"${altAttr} style="${styles}" />\n`;
            continue;
        }
        if (el.kind === "table") {
            const table = el.data;
            const tableStyles = [
                "position:absolute",
                `left:${table.x}px`,
                `top:${table.y}px`,
                `width:${table.w}px`,
                `height:${table.h}px`,
            ];
            let tableHtml = `<table style="border-collapse:collapse;width:100%;height:100%;table-layout:fixed">`;
            // Column widths via colgroup
            if (table.colWidths.length > 0) {
                tableHtml += `<colgroup>`;
                for (const cw of table.colWidths) {
                    tableHtml += `<col style="width:${cw}px">`;
                }
                tableHtml += `</colgroup>`;
            }
            for (const row of table.rows) {
                const rowStyle = row.height ? ` style="height:${row.height}px"` : "";
                tableHtml += `<tr${rowStyle}>`;
                for (const cell of row.cells) {
                    const cellPad = cell.padding ?? { top: 5, right: 10, bottom: 5, left: 10 };
                    const tdStyles = [
                        "box-sizing:border-box",
                        "overflow:hidden",
                        `padding:${cellPad.top}px ${cellPad.right}px ${cellPad.bottom}px ${cellPad.left}px`,
                    ];
                    if (cell.fill) {
                        tdStyles.push(`background:${cell.fill}`);
                    }
                    if (cell.verticalAlign === "center") {
                        tdStyles.push("vertical-align:middle");
                    }
                    else if (cell.verticalAlign === "bottom") {
                        tdStyles.push("vertical-align:bottom");
                    }
                    else {
                        tdStyles.push("vertical-align:top");
                    }
                    // Cell borders
                    if (cell.borderTop) {
                        tdStyles.push(`border-top:${cell.borderTop.width}px ${cell.borderTop.style} ${cell.borderTop.color}`);
                    }
                    if (cell.borderBottom) {
                        tdStyles.push(`border-bottom:${cell.borderBottom.width}px ${cell.borderBottom.style} ${cell.borderBottom.color}`);
                    }
                    if (cell.borderLeft) {
                        tdStyles.push(`border-left:${cell.borderLeft.width}px ${cell.borderLeft.style} ${cell.borderLeft.color}`);
                    }
                    if (cell.borderRight) {
                        tdStyles.push(`border-right:${cell.borderRight.width}px ${cell.borderRight.style} ${cell.borderRight.color}`);
                    }
                    const spanAttrs = [];
                    if (cell.colSpan && cell.colSpan > 1)
                        spanAttrs.push(` colspan="${cell.colSpan}"`);
                    if (cell.rowSpan && cell.rowSpan > 1)
                        spanAttrs.push(` rowspan="${cell.rowSpan}"`);
                    tableHtml += `<td style="${tdStyles.join(";")}"${spanAttrs.join("")}>`;
                    // Render cell paragraphs
                    for (const para of cell.paragraphs) {
                        const pStyles = ["margin:0"];
                        if (para.align)
                            pStyles.push(`text-align:${para.align}`);
                        if (para.spacingAfterPt)
                            pStyles.push(`margin-bottom:${para.spacingAfterPt}pt`);
                        if (para.spacingBeforePt)
                            pStyles.push(`margin-top:${para.spacingBeforePt}pt`);
                        if (para.lineSpacingPt)
                            pStyles.push(`line-height:${para.lineSpacingPt}pt`);
                        else if (para.lineSpacingPercent)
                            pStyles.push(`line-height:${para.lineSpacingPercent}%`);
                        let runHtml = "";
                        for (const run of para.runs) {
                            const rStyles = [];
                            if (run.fontSize)
                                rStyles.push(`font-size:${run.fontSize}px`);
                            if (run.gradientFill) {
                                rStyles.push(`background:${run.gradientFill}`);
                                rStyles.push("-webkit-background-clip:text");
                                rStyles.push("-webkit-text-fill-color:transparent");
                                rStyles.push("background-clip:text");
                            }
                            else if (run.color) {
                                rStyles.push(`color:${run.color}`);
                            }
                            if (run.bold)
                                rStyles.push("font-weight:bold");
                            if (run.italic)
                                rStyles.push("font-style:italic");
                            if (run.underline)
                                rStyles.push("text-decoration:underline");
                            if (run.fontFamily)
                                rStyles.push(`font-family:${cssFontFamily(run.fontFamily)}`);
                            if (run.textShadow)
                                rStyles.push(`text-shadow:${run.textShadow}`);
                            const escapedText = run.text
                                .replace(/&/g, "&amp;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;");
                            if (rStyles.length > 0) {
                                runHtml += `<span style="${rStyles.join(";")}">${escapedText}</span>`;
                            }
                            else {
                                runHtml += escapedText;
                            }
                        }
                        tableHtml += `<p style="${pStyles.join(";")}">${runHtml}</p>`;
                    }
                    tableHtml += `</td>`;
                }
                tableHtml += `</tr>`;
            }
            tableHtml += `</table>`;
            inner += `<div id="${elId}" data-elementType="table" style="${tableStyles.join(";")}">${tableHtml}</div>\n`;
            continue;
        }
        if (el.kind === "chart") {
            const chart = el.data;
            inner += renderChartSvg(chart, elId);
            continue;
        }
        const shape = el.data;
        // PPT text boxes do NOT clip overflowing text — only clip via clip-path or
        // explicit geometry. overflow:hidden on text shapes silently drops lines
        // whose metrics differ from PowerPoint's, so restrict it to non-text shapes.
        const hasVisibleRuns = shape.paragraphs.some(p => p.runs.length > 0);
        const styles = [
            "position:absolute",
            `left:${shape.x}px`,
            `top:${shape.y}px`,
            `width:${shape.w}px`,
            `height:${shape.h}px`,
        ];
        if (!hasVisibleRuns) {
            styles.push("overflow:hidden");
        }
        // The SVG path carries its own fill; a box background would paint over
        // the freeform silhouette and turn it back into a plain rectangle.
        if (shape.fill && !shape.custGeomSvg) {
            styles.push(`background:${shape.fill}`);
        }
        if (shape.clipPath) {
            styles.push(`clip-path:${shape.clipPath}`);
        }
        if (shape.rotation) {
            styles.push(`transform:rotate(${shape.rotation}deg)`);
        }
        if (shape.borderRadius) {
            styles.push(`border-radius:${shape.borderRadius}px`);
        }
        else if (shape.isEllipse) {
            // Ellipse shapes render as circles/ovals with 50% border-radius
            styles.push(`border-radius:50%`);
        }
        if (shape.isLine) {
            // `line` preset: the stroke is the visual, living on one edge of a usually
            // degenerate box (h=0 horizontal / w=0 vertical). Draw it explicitly so the
            // zero-dimension skip below doesn't drop the shape.
            const strokeW = Math.max(shape.borderWidth ?? 1, 1);
            const strokeColor = shape.borderColor ?? "#000000";
            let borderStyle = "solid";
            if (shape.borderDashType) {
                switch (shape.borderDashType) {
                    case "dash":
                    case "lgDash":
                    case "sysDash":
                        borderStyle = "dashed";
                        break;
                    case "sysDot":
                    case "dot":
                        borderStyle = "dotted";
                        break;
                }
            }
            const side = shape.h <= 0 ? "top" : shape.w <= 0 ? "left" : "top";
            styles.push(`border-${side}:${strokeW}px ${borderStyle} ${strokeColor}`);
            styles.push("box-sizing:border-box");
        }
        else if (shape.borderWidth && shape.borderColor) {
            // Convert PPTX dashType to CSS border-style
            let borderStyle = "solid";
            if (shape.borderDashType) {
                switch (shape.borderDashType) {
                    case "dash":
                    case "lgDash":
                    case "sysDash":
                        borderStyle = "dashed";
                        break;
                    case "sysDot":
                    case "dot":
                        borderStyle = "dotted";
                        break;
                }
            }
            styles.push(`border:${shape.borderWidth}px ${borderStyle} ${shape.borderColor}`);
            styles.push("box-sizing:border-box");
        }
        if (shape.boxShadow) {
            styles.push(`box-shadow:${shape.boxShadow}`);
        }
        if (shape.padding) {
            styles.push(`padding:${shape.padding.top}px ${shape.padding.right}px ${shape.padding.bottom}px ${shape.padding.left}px`);
        }
        if (shape.verticalAlign && shape.paragraphs.length > 0) {
            styles.push("display:flex", "flex-direction:column");
            if (shape.verticalAlign === "center")
                styles.push("justify-content:center");
            else if (shape.verticalAlign === "bottom")
                styles.push("justify-content:flex-end");
        }
        // Skip zero-dimension shapes (e.g. geometry-driven shapes like right triangles
        // where the visible area comes from path data, not bounding box).
        // Line shapes are exempt: their stroke is drawn on the degenerate edge.
        if ((shape.w <= 0 || shape.h <= 0) && !shape.isLine) {
            continue;
        }
        if (!hasVisibleRuns && !shape.fill && !shape.borderWidth && !shape.isEllipse && !shape.isLine) {
            continue;
        }
        const hasText = hasVisibleRuns || !!shape.custGeomSvg;
        const idAttr = hasText ? ` id="${elId}" data-elementType="text"` : "";
        let content = "";
        if (shape.custGeomSvg) {
            // Complex freeform geometry: inline SVG scaled to the element box.
            const g = shape.custGeomSvg;
            const svgFill = shape.fill && shape.fill.startsWith("#") ? shape.fill : "currentColor";
            content = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${g.w} ${g.h}" preserveAspectRatio="none"><path d="${g.d}" fill="${svgFill}"/></svg>`;
        }
        for (const para of shape.paragraphs) {
            if (para.runs.length === 0) {
                // Blank line (empty paragraph in the source text box)
                const emptyFs = para.emptyFontSize;
                content += emptyFs
                    ? `<p style="margin:0;font-size:${emptyFs}px">&nbsp;</p>`
                    : `<p style="margin:0">&nbsp;</p>`;
                continue;
            }
            const pStyles = ["margin:0"];
            if (para.align)
                pStyles.push(`text-align:${para.align}`);
            if (para.spacingAfterPt)
                pStyles.push(`margin-bottom:${para.spacingAfterPt}pt`);
            if (para.spacingBeforePt)
                pStyles.push(`margin-top:${para.spacingBeforePt}pt`);
            if (para.lineSpacingPt)
                pStyles.push(`line-height:${para.lineSpacingPt}pt`);
            // Note: lineSpacingPercent is intentionally NOT emitted for shapes.
            // Applying percentage-based line-height to fixed-height text boxes
            // often causes visual regressions (overlaps, clipping). It works
            // reliably only for tables where cell height auto-adjusts.
            if (para.marginLeftPx)
                pStyles.push(`padding-left:${para.marginLeftPx}px`);
            if (para.indentPx)
                pStyles.push(`text-indent:${para.indentPx}px`);
            let runHtml = "";
            if (para.bulletChar) {
                const bulletStyleParts = ["margin-right:4px"];
                if (para.bulletColor)
                    bulletStyleParts.push(`color:${para.bulletColor}`);
                if (para.bulletFont)
                    bulletStyleParts.push(`font-family:${cssFontFamily(para.bulletFont)}`);
                // Inherit font size from the first text run so bullet matches text size
                const firstRunFontSize = para.runs[0]?.fontSize;
                if (firstRunFontSize)
                    bulletStyleParts.push(`font-size:${firstRunFontSize}px`);
                runHtml += `<span style="${bulletStyleParts.join(";")}">${para.bulletChar}</span>`;
            }
            for (const run of para.runs) {
                const rStyles = [];
                if (run.fontSize)
                    rStyles.push(`font-size:${run.fontSize}px`);
                if (run.gradientFill) {
                    // CSS gradient text using background-clip technique
                    rStyles.push(`background:${run.gradientFill}`);
                    rStyles.push("-webkit-background-clip:text");
                    rStyles.push("-webkit-text-fill-color:transparent");
                    rStyles.push("background-clip:text");
                }
                else if (run.color) {
                    rStyles.push(`color:${run.color}`);
                }
                if (run.bold)
                    rStyles.push("font-weight:bold");
                if (run.italic)
                    rStyles.push("font-style:italic");
                if (run.underline)
                    rStyles.push("text-decoration:underline");
                if (run.fontFamily)
                    rStyles.push(`font-family:${cssFontFamily(run.fontFamily)}`);
                if (run.textShadow)
                    rStyles.push(`text-shadow:${run.textShadow}`);
                const escapedText = run.text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                if (rStyles.length > 0) {
                    runHtml += `<span style="${rStyles.join(";")}">${escapedText}</span>`;
                }
                else {
                    runHtml += escapedText;
                }
            }
            content += `<p style="${pStyles.join(";")}">${runHtml}</p>`;
        }
        inner += `<div${idAttr} style="${styles.join(";")}">${content}</div>\n`;
    }
    const bg = bgColor ?? "#fff";
    // Picture background (p:bg > blipFill): lay the data URI as a full-bleed <img>
    // behind the content (OOXML stretch/fillRect — full artwork, no cropping).
    // CSS background:url() with a multi-MB data URI is unreliable in some renderers.
    let bgCss = `background:${bg}`;
    let bgImgHtml = "";
    if (bg && typeof bg === "object" && typeof bg.image === "string") {
        bgCss = "background:#1e1e1e";
        bgImgHtml = `<img src="${bg.image}" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:fill" />`;
    }
    // For non-16:9 slides, horizontally center the content within the target container
    const offsetPx = Math.round(contentOffsetX);
    const innerWrapStyle = offsetPx > 0 ? ` style="position:absolute;left:${offsetPx}px;top:0"` : "";
    const sizeAttrs = slideWEmu > 0 && slideHEmu > 0 ? ` data-slide-w-emu="${slideWEmu}" data-slide-h-emu="${slideHEmu}"` : "";
    return `<div${sizeAttrs} style="position:relative;width:${TARGET_WIDTH}px;height:${TARGET_HEIGHT}px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;${bgCss}">\n${bgImgHtml}<div${innerWrapStyle}>\n${inner}</div>\n</div>`;
}
// ============================================================================
// Main Export Function
// ============================================================================
/**
 * Build a data URI for an embedded image, rasterizing vector EMF/WMF media to PNG
 * (browsers cannot render EMF/WMF inline — they show up as broken images).
 * Rasterization shells out to Windows GDI+ via PowerShell; on any failure the
 * original data URI is returned unchanged.
 */
async function buildImageDataUri(mediaPath, imgDataBase64) {
    const ext = mediaPath.split(".").pop()?.toLowerCase() ?? "png";
    const isVector = ext === "emf" || ext === "wmf";
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    const dataUri = `data:${mime};base64,${imgDataBase64}`;
    if (!isVector)
        return dataUri;
    try {
        const { execFile } = await import("node:child_process");
        const fsPromises = await import("node:fs/promises");
        const os = await import("node:os");
        const path = await import("node:path");
        const dir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "pptx-vector-"));
        try {
            const srcPath = path.join(dir, `input.${ext}`);
            const dstPath = path.join(dir, "output.png");
            await fsPromises.writeFile(srcPath, Buffer.from(imgDataBase64, "base64"));
            const ps = [
                "Add-Type -AssemblyName System.Drawing",
                `$img = [System.Drawing.Image]::FromFile('${srcPath.replace(/'/g, "''")}')`,
                "$w = [Math]::Max(1, [int][Math]::Ceiling($img.Width * 3))",
                "$h = [Math]::Max(1, [int][Math]::Ceiling($img.Height * 3))",
                "$bmp = New-Object System.Drawing.Bitmap($w, $h)",
                "$g = [System.Drawing.Graphics]::FromImage($bmp)",
                "$g.Clear([System.Drawing.Color]::Transparent)",
                "$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic",
                "$g.DrawImage($img, 0, 0, $w, $h)",
                `$bmp.Save('${dstPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)`,
                "$g.Dispose()",
                "$bmp.Dispose()",
                "$img.Dispose()",
            ].join("; ");
            const encoded = Buffer.from(ps, "utf16le").toString("base64");
            await new Promise((resolve, reject) => {
                execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], { timeout: 20000, windowsHide: true }, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve(undefined);
                });
            });
            const png = await fsPromises.readFile(dstPath);
            return `data:image/png;base64,${png.toString("base64")}`;
        }
        finally {
            await fsPromises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
        }
    }
    catch {
        // Vector rasterization unavailable (non-Windows / sandboxed runtime):
        // keep the original data URI so geometry and alt text still survive.
        return dataUri;
    }
}
/**
 * Imports a PPTX file and returns an array of HTML slide strings.
 * @param arrayBuffer - The PPTX file as an ArrayBuffer
 * @returns Array of HTML strings, one per slide
 */
export default async function importPptx(arrayBuffer) {
    const zip = await loadZipSafely(arrayBuffer);
    const presXml = await zip.file("ppt/presentation.xml")?.async("text");
    if (!presXml)
        throw new Error("Invalid PPTX: no presentation.xml");
    const parser = new DOMParser();
    const presDoc = parser.parseFromString(presXml, "application/xml");
    const sldSz = presDoc.getElementsByTagName("p:sldSz")[0];
    const slideWEmu = parseInt(sldSz?.getAttribute("cx") ?? "12192000", 10);
    const slideHEmu = parseInt(sldSz?.getAttribute("cy") ?? "6858000", 10);
    const slideWPx = emuToPx(slideWEmu);
    const slideHPx = emuToPx(slideHEmu);
    const scale = Math.min(TARGET_WIDTH / slideWPx, TARGET_HEIGHT / slideHPx);
    // For non-16:9 slides, calculate horizontal offset to center content
    const scaledContentW = slideWPx * scale;
    const contentOffsetX = (TARGET_WIDTH - scaledContentW) / 2;
    // Get visible slides from sldIdLst in presentation.xml
    // This determines which slides are actually included in the presentation
    const sldIdLst = presDoc.getElementsByTagName("p:sldIdLst")[0];
    const visibleSlideRIds = [];
    if (sldIdLst) {
        const sldIdEls = sldIdLst.getElementsByTagName("p:sldId");
        for (let i = 0; i < sldIdEls.length; i++) {
            const rId = sldIdEls[i].getAttribute("r:id") ??
                sldIdEls[i].getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
            if (rId)
                visibleSlideRIds.push(rId);
        }
    }
    // Parse presentation.xml.rels to map relationship IDs to slide file paths
    const presRelsXml = await zip
        .file("ppt/_rels/presentation.xml.rels")
        ?.async("text");
    const slideRIdToPath = new Map();
    if (presRelsXml) {
        const relsDoc = parser.parseFromString(presRelsXml, "application/xml");
        const rels = relsDoc.getElementsByTagName("Relationship");
        for (let i = 0; i < rels.length; i++) {
            const rel = rels[i];
            const type = rel.getAttribute("Type") ?? "";
            if (!type.includes("/slide"))
                continue;
            const rId = rel.getAttribute("Id");
            const target = rel.getAttribute("Target");
            if (rId && target) {
                // Target is relative to ppt/, e.g., "slides/slide4.xml"
                slideRIdToPath.set(rId, "ppt/" + target);
            }
        }
    }
    // Build ordered list of visible slide files based on sldIdLst order
    const slideFiles = [];
    if (visibleSlideRIds.length > 0) {
        // Use the order from sldIdLst (respects presentation order)
        for (const rId of visibleSlideRIds) {
            const path = slideRIdToPath.get(rId);
            if (path)
                slideFiles.push(path);
        }
    }
    else {
        // Fallback: if no sldIdLst, use all slide files (legacy behavior)
        zip.folder("ppt/slides")?.forEach((relativePath) => {
            if (/^slide\d+\.xml$/.test(relativePath)) {
                slideFiles.push("ppt/slides/" + relativePath);
            }
        });
        slideFiles.sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0", 10);
            const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0", 10);
            return numA - numB;
        });
    }
    // ---- Parse theme parts (per theme file, cached) ----
    // Each slide resolves its own theme via the chain slide → layout → master → theme,
    // so decks with multiple masters/themes get the correct accent colors per page.
    const themeCache = new Map();
    async function loadThemeParts(themePath) {
        if (themeCache.has(themePath)) {
            return themeCache.get(themePath);
        }
        const parts = {
            themeColors: new Map(),
            bgFillStyles: [],
            themeLineStyles: [],
            themeFonts: undefined,
        };
        const themeXml = await zip.file(themePath)?.async("text");
        if (themeXml) {
            const themeDoc = parser.parseFromString(themeXml, "application/xml");
            const clrScheme = themeDoc.getElementsByTagName("a:clrScheme")[0];
            if (clrScheme) {
                const schemeMap = {
                    dk1: "dk1",
                    dk2: "dk2",
                    lt1: "lt1",
                    lt2: "lt2",
                    accent1: "accent1",
                    accent2: "accent2",
                    accent3: "accent3",
                    accent4: "accent4",
                    accent5: "accent5",
                    accent6: "accent6",
                    hlink: "hlink",
                    folHlink: "folHlink",
                };
                for (const [tagName, schemeKey] of Object.entries(schemeMap)) {
                    const el = findChild(clrScheme, tagName);
                    if (!el)
                        continue;
                    const srgb = findChild(el, "srgbClr");
                    if (srgb) {
                        parts.themeColors.set(schemeKey, "#" + (srgb.getAttribute("val") ?? "000000"));
                        continue;
                    }
                    const sys = findChild(el, "sysClr");
                    if (sys) {
                        parts.themeColors.set(schemeKey, "#" + (sys.getAttribute("lastClr") ?? "000000"));
                    }
                }
            }
            // Add OOXML aliases: tx1/tx2 map to dk1/dk2, bg1/bg2 map to lt1/lt2
            const dk1Color = parts.themeColors.get("dk1");
            if (dk1Color)
                parts.themeColors.set("tx1", dk1Color);
            const dk2Color = parts.themeColors.get("dk2");
            if (dk2Color)
                parts.themeColors.set("tx2", dk2Color);
            const lt1Color = parts.themeColors.get("lt1");
            if (lt1Color)
                parts.themeColors.set("bg1", lt1Color);
            const lt2Color = parts.themeColors.get("lt2");
            if (lt2Color)
                parts.themeColors.set("bg2", lt2Color);
            // Parse bgFillStyleLst for resolving bgRef elements
            const bgFillStyleLst = themeDoc.getElementsByTagName("a:bgFillStyleLst")[0];
            if (bgFillStyleLst) {
                for (let i = 0; i < bgFillStyleLst.children.length; i++) {
                    parts.bgFillStyles.push(bgFillStyleLst.children[i]);
                }
            }
            // Parse lnStyleLst for resolving p:style lnRef theme references
            const lnStyleLst = themeDoc.getElementsByTagName("a:lnStyleLst")[0];
            if (lnStyleLst) {
                for (let i = 0; i < lnStyleLst.children.length; i++) {
                    parts.themeLineStyles.push(lnStyleLst.children[i]);
                }
            }
            // Parse theme fonts
            const majorFont = themeDoc.getElementsByTagName("a:majorFont")[0];
            const minorFont = themeDoc.getElementsByTagName("a:minorFont")[0];
            if (majorFont || minorFont) {
                const majorLatin = majorFont ? findChild(majorFont, "latin")?.getAttribute("typeface") : null;
                const minorLatin = minorFont ? findChild(minorFont, "latin")?.getAttribute("typeface") : null;
                const majorEa = majorFont ? findChild(majorFont, "ea")?.getAttribute("typeface") : null;
                const minorEa = minorFont ? findChild(minorFont, "ea")?.getAttribute("typeface") : null;
                parts.themeFonts = {
                    majorLatin: majorLatin ?? "Calibri",
                    minorLatin: minorLatin ?? "Calibri",
                    majorEastAsian: majorEa ?? undefined,
                    minorEastAsian: minorEa ?? undefined,
                };
            }
        }
        themeCache.set(themePath, parts);
        return parts;
    }
    // ---- Map layout→master→theme by scanning relationship files ----
    const layoutMasterPath = new Map(); // ppt/slideLayouts/slideLayoutN.xml -> ppt/slideMasters/slideMasterN.xml
    const masterThemePath = new Map(); // ppt/slideMasters/slideMasterN.xml -> ppt/theme/themeN.xml
    function normalizeTarget(target) {
        if (!target)
            return "";
        if (target.startsWith("../")) {
            return "ppt/" + target.slice(3);
        }
        return "ppt/" + target;
    }
    for (const entryName of Object.keys(zip.files)) {
        const layoutRelsMatch = entryName.match(/^ppt\/slideLayouts\/_rels\/(slideLayout\d+)\.xml\.rels$/);
        if (layoutRelsMatch) {
            const text = await zip.file(entryName)?.async("text");
            if (text) {
                const relsDoc = parser.parseFromString(text, "application/xml");
                const rels = relsDoc.getElementsByTagName("Relationship");
                for (let ri = 0; ri < rels.length; ri++) {
                    const rel = rels[ri];
                    if ((rel.getAttribute("Type") ?? "").includes("/slideMaster")) {
                        layoutMasterPath.set(`ppt/slideLayouts/${layoutRelsMatch[1]}.xml`, normalizeTarget(rel.getAttribute("Target")));
                        break;
                    }
                }
            }
            continue;
        }
        const masterRelsMatch = entryName.match(/^ppt\/slideMasters\/_rels\/(slideMaster\d+)\.xml\.rels$/);
        if (masterRelsMatch) {
            const text = await zip.file(entryName)?.async("text");
            if (text) {
                const relsDoc = parser.parseFromString(text, "application/xml");
                const rels = relsDoc.getElementsByTagName("Relationship");
                for (let ri = 0; ri < rels.length; ri++) {
                    const rel = rels[ri];
                    if ((rel.getAttribute("Type") ?? "").includes("/theme")) {
                        masterThemePath.set(`ppt/slideMasters/${masterRelsMatch[1]}.xml`, normalizeTarget(rel.getAttribute("Target")));
                        break;
                    }
                }
            }
        }
    }
    const fallbackTheme = "ppt/theme/theme1.xml";
    async function themePathForSlide(slideFile) {
        const slideBaseName = slideFile.split("/").pop();
        const relsText = await zip.file(slideFile.replace(slideBaseName, `_rels/${slideBaseName}.rels`))?.async("text");
        if (relsText) {
            const relsDoc = parser.parseFromString(relsText, "application/xml");
            const rels = relsDoc.getElementsByTagName("Relationship");
            for (let ri = 0; ri < rels.length; ri++) {
                const rel = rels[ri];
                if ((rel.getAttribute("Type") ?? "").includes("/slideLayout")) {
                    const layoutPath = normalizeTarget(rel.getAttribute("Target"));
                    const masterPath = layoutMasterPath.get(layoutPath);
                    return (masterPath && masterThemePath.get(masterPath)) || fallbackTheme;
                }
            }
        }
        return fallbackTheme;
    }
    // Fallback theme parts (theme1) — kept for the global table style parse and
    // any code path that still references the flat variables below.
    const fallbackParts = await loadThemeParts(fallbackTheme);
    const themeColors = fallbackParts.themeColors;
    const themeLineStyles = fallbackParts.themeLineStyles;
    const bgFillStyles = fallbackParts.bgFillStyles;
    const themeFonts = fallbackParts.themeFonts;
    // Parse table styles from ppt/tableStyles.xml
    const tableStyleMap = await parseTableStyles(zip, parser, themeColors);
    // Parse embedded fonts from presentation.xml
    // PPTX files can embed TrueType fonts in ppt/fonts/ as .fntdata (EOT format)
    const embeddedFontNames = new Set();
    const embeddedFontEls = presDoc.getElementsByTagName("p:embeddedFont");
    for (let i = 0; i < embeddedFontEls.length; i++) {
        const fontEl = embeddedFontEls[i].getElementsByTagName("p:font")[0];
        if (fontEl) {
            const typeface = fontEl.getAttribute("typeface");
            if (typeface)
                embeddedFontNames.add(typeface);
        }
    }
    // Build Google Fonts link for embedded font families
    // EOT files in PPTX are compressed and not usable in modern browsers,
    // so we load them via Google Fonts CDN if available.
    let fontStyleBlock = "";
    if (embeddedFontNames.size > 0) {
        const fontFamilies = Array.from(embeddedFontNames)
            .map((name) => name.replace(/ /g, "+") + ":ital,wght@0,400;0,700;1,400;1,700")
            .join("&family=");
        fontStyleBlock = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap">`;
    }
    const slides = [];
    // ---- Parse slide masters (per master, cached) ----
    // Master shapes appear behind slide content when the layout has showMasterSp != "0"
    const masterPartsCache = new Map(); // masterPath -> { bg, decorativeElements }
    async function loadMasterParts(masterPath, tp) {
        if (masterPartsCache.has(masterPath)) {
            return masterPartsCache.get(masterPath);
        }
        const out = { bg: undefined, decorativeElements: [] };
        const masterXml = await zip.file(masterPath)?.async("text");
        if (masterXml) {
            const masterDoc = parser.parseFromString(masterXml, "application/xml");
            // Master background
            const masterBgEl = masterDoc.getElementsByTagName("p:bg")[0];
            if (masterBgEl) {
                out.bg = extractBgFill(masterBgEl, tp.bgFillStyles, tp.themeColors);
            }
            // Master decorative shapes (build image map from master rels)
            const masterImageMap = new Map();
            const masterBaseName = masterPath.split("/").pop();
            const masterRelsXml = await zip.file(masterPath.replace(masterBaseName, `_rels/${masterBaseName}.rels`))?.async("text");
            if (masterRelsXml) {
                const relsDoc = parser.parseFromString(masterRelsXml, "application/xml");
                const rels = relsDoc.getElementsByTagName("Relationship");
                for (let ri = 0; ri < rels.length; ri++) {
                    const rel = rels[ri];
                    const type = rel.getAttribute("Type") ?? "";
                    if (!type.includes("/image"))
                        continue;
                    const rId = rel.getAttribute("Id");
                    const target = rel.getAttribute("Target");
                    if (!rId || !target)
                        continue;
                    const mediaPath = target.startsWith("../") ? "ppt/" + target.slice(3) : target;
                    const imgFile = zip.file(mediaPath);
                    if (!imgFile)
                        continue;
                    const imgData = await imgFile.async("base64");
                    masterImageMap.set(rId, await buildImageDataUri(mediaPath, imgData));
                }
            }
            const masterSpTree = masterDoc.getElementsByTagName("p:spTree")[0];
            if (masterSpTree) {
                out.decorativeElements = parseDecorativeShapes(masterSpTree, scale, tp.themeColors, masterImageMap, tp.themeFonts, tp.themeLineStyles);
            }
        }
        masterPartsCache.set(masterPath, out);
        return out;
    }
    // ---- Cache parsed slide layouts ----
    // Maps layout file path to { bg, showMasterSp, decorativeElements }
    const layoutCache = new Map();
    async function getLayoutInfo(layoutPath) {
        if (layoutCache.has(layoutPath))
            return layoutCache.get(layoutPath);
        const masterPath = layoutMasterPath.get(layoutPath) ?? "ppt/slideMasters/slideMaster1.xml";
        const tp = await loadThemeParts((masterPath && masterThemePath.get(masterPath)) || fallbackTheme);
        const result = { bg: undefined, showMasterSp: true, decorativeElements: [], themeParts: tp, masterBg: undefined, masterDecorativeElements: [], layoutPlaceholders: new Map() };
        const layoutXml = await zip.file(layoutPath)?.async("text");
        if (layoutXml) {
            const layoutDoc = parser.parseFromString(layoutXml, "application/xml");
            // Check showMasterSp attribute on cSld
            // showMasterSp is on the root element of the layout
            const rootEl = layoutDoc.documentElement;
            const showMasterSpAttr = rootEl.getAttribute("showMasterSp");
            if (showMasterSpAttr === "0") {
                result.showMasterSp = false;
            }
            // Layout decorative shapes (build image map from layout rels)
            const layoutImageMap = new Map();
            const layoutBaseName = layoutPath.split("/").pop();
            const layoutRelsPath = layoutPath.replace(layoutBaseName, `_rels/${layoutBaseName}.rels`);
            const layoutRelsXml = await zip.file(layoutRelsPath)?.async("text");
            if (layoutRelsXml) {
                const relsDoc = parser.parseFromString(layoutRelsXml, "application/xml");
                const rels = relsDoc.getElementsByTagName("Relationship");
                for (let ri = 0; ri < rels.length; ri++) {
                    const rel = rels[ri];
                    const type = rel.getAttribute("Type") ?? "";
                    if (!type.includes("/image"))
                        continue;
                    const rId = rel.getAttribute("Id");
                    const target = rel.getAttribute("Target");
                    if (!rId || !target)
                        continue;
                    const mediaPath = target.startsWith("../") ? "ppt/" + target.slice(3) : target;
                    const imgFile = zip.file(mediaPath);
                    if (!imgFile)
                        continue;
                    const imgData = await imgFile.async("base64");
                    layoutImageMap.set(rId, await buildImageDataUri(mediaPath, imgData));
                }
            }
            // Layout background (image map available now for blipFill backgrounds)
            const layoutBgEl = layoutDoc.getElementsByTagName("p:bg")[0];
            if (layoutBgEl) {
                result.bg = extractBgFill(layoutBgEl, tp.bgFillStyles, tp.themeColors, layoutImageMap);
            }
            const layoutSpTree = layoutDoc.getElementsByTagName("p:spTree")[0];
            if (layoutSpTree) {
                result.decorativeElements = parseDecorativeShapes(layoutSpTree, scale, tp.themeColors, layoutImageMap, tp.themeFonts, tp.themeLineStyles);
                // Collect placeholder slots (type:idx -> shape element) so slide
                // placeholders without their own xfrm can inherit position/fill.
                for (let i = 0; i < layoutSpTree.children.length; i++) {
                    const c = layoutSpTree.children[i];
                    if (c.localName !== "sp") {
                        continue;
                    }
                    const nvSpPr = findChild(c, "nvSpPr");
                    const phEl = findChild(findChild(nvSpPr, "nvPr") ?? nvSpPr, "ph");
                    if (!phEl) {
                        continue;
                    }
                    const phKey = `${phEl.getAttribute("type") ?? "body"}:${phEl.getAttribute("idx") ?? "1"}`;
                    result.layoutPlaceholders.set(phKey, c);
                }
            }
        }
        // Master parts for this layout's own master (background + decorative shapes)
        const masterParts = await loadMasterParts(masterPath, tp);
        result.masterBg = masterParts.bg;
        result.masterDecorativeElements = masterParts.decorativeElements;
        layoutCache.set(layoutPath, result);
        return result;
    }
    for (const slideFile of slideFiles) {
        const slideXml = await zip.file(slideFile)?.async("text");
        if (!slideXml)
            continue;
        const slideDoc = parser.parseFromString(slideXml, "application/xml");
        const spTree = slideDoc.getElementsByTagName("p:spTree")[0];
        // Determine which layout this slide uses (from slide rels)
        const slideBaseName = slideFile.split("/").pop();
        const relsPath = slideFile.replace(slideBaseName, `_rels/${slideBaseName}.rels`);
        const relsXml = await zip.file(relsPath)?.async("text");
        let layoutPath;
        if (relsXml) {
            const relsDoc = parser.parseFromString(relsXml, "application/xml");
            const rels = relsDoc.getElementsByTagName("Relationship");
            for (let ri = 0; ri < rels.length; ri++) {
                const rel = rels[ri];
                const type = rel.getAttribute("Type") ?? "";
                if (type.includes("/slideLayout")) {
                    const target = rel.getAttribute("Target");
                    if (target) {
                        layoutPath = target.startsWith("../")
                            ? "ppt/" + target.slice(3)
                            : "ppt/slides/" + target;
                    }
                    break;
                }
            }
        }
        // Get layout info for background and shape inheritance
        let layoutInfo;
        if (layoutPath) {
            layoutInfo = await getLayoutInfo(layoutPath);
        }
        const tp = layoutInfo?.themeParts ?? fallbackParts;
        // Build image map from slide rels (reuse relsXml parsed above for layout lookup)
        const imageMap = new Map();
        // Parse rels document once for both image map and chart resolution
        const slideRelsDoc = relsXml ? parser.parseFromString(relsXml, "application/xml") : null;
        if (slideRelsDoc) {
            const rels = slideRelsDoc.getElementsByTagName("Relationship");
            for (let ri = 0; ri < rels.length; ri++) {
                const rel = rels[ri];
                const type = rel.getAttribute("Type") ?? "";
                if (!type.includes("/image"))
                    continue;
                const rId = rel.getAttribute("Id");
                const target = rel.getAttribute("Target");
                if (!rId || !target)
                    continue;
                const mediaPath = target.startsWith("../")
                    ? "ppt/" + target.slice(3)
                    : target;
                const imgFile = zip.file(mediaPath);
                if (!imgFile)
                    continue;
                const imgData = await imgFile.async("base64");
                imageMap.set(rId, await buildImageDataUri(mediaPath, imgData));
            }
        }
        // ---- Resolve background with inheritance chain: slide → layout → master ----
        let slideBg = undefined;
        const bgEl = slideDoc.getElementsByTagName("p:bg")[0];
        if (bgEl) {
            slideBg = extractBgFill(bgEl, tp.bgFillStyles, tp.themeColors, imageMap);
        }
        if (!slideBg && layoutInfo?.bg) {
            slideBg = layoutInfo.bg;
        }
        if (!slideBg && layoutInfo?.masterBg) {
            slideBg = layoutInfo.masterBg;
        }
        if (!spTree) {
            slides.push(renderSlideHtml([], slideBg, contentOffsetX, slideWEmu, slideHEmu));
            continue;
        }
        // Parse all elements
        const elements = [];
        if (layoutInfo?.showMasterSp !== false) {
            // Master shapes are shown unless layout explicitly hides them
            elements.push(...(layoutInfo?.masterDecorativeElements ?? []));
        }
        // Layout decorative shapes appear after master shapes, before slide content
        if (layoutInfo?.decorativeElements) {
            elements.push(...layoutInfo.decorativeElements);
        }
        // Parse slide's own elements
        for (let i = 0; i < spTree.children.length; i++) {
            const child = spTree.children[i];
            if (child.localName === "sp" || child.localName === "cxnSp") {
                let shape = parseShape(child, scale, tp.themeColors, tp.themeFonts, tp.themeLineStyles);
                if (!shape) {
                    // Placeholder without its own geometry: retry with the layout's
                    // matching placeholder slot (position/fill), keeping slide text.
                    const nvSpPr = findChild(child, "nvSpPr");
                    const phEl = findChild(findChild(nvSpPr, "nvPr") ?? nvSpPr, "ph");
                    if (phEl) {
                        const phKey = `${phEl.getAttribute("type") ?? "body"}:${phEl.getAttribute("idx") ?? "1"}`;
                        const layoutPh = layoutInfo?.layoutPlaceholders?.get(phKey);
                        if (layoutPh) {
                            shape = parseShape(child, scale, tp.themeColors, tp.themeFonts, tp.themeLineStyles, layoutPh);
                        }
                    }
                }
                if (shape)
                    elements.push({ kind: "shape", data: shape });
            }
            else if (child.localName === "pic") {
                const img = parsePicture(child, scale, imageMap);
                if (img)
                    elements.push({ kind: "image", data: img });
            }
            else if (child.localName === "grpSp") {
                const grpElements = parseGroupShape(child, scale, tp.themeColors, imageMap, tp.themeFonts, tp.themeLineStyles);
                elements.push(...grpElements);
            }
            else if (child.localName === "graphicFrame") {
                const table = parseTable(child, scale, tp.themeColors, tp.themeFonts, tableStyleMap);
                if (table) {
                    elements.push({ kind: "table", data: table });
                }
                else if (slideRelsDoc) {
                    const chart = await parseChart(child, scale, tp.themeColors, zip, slideRelsDoc, parser);
                    if (chart)
                        elements.push({ kind: "chart", data: chart });
                }
            }
        }
        slides.push(renderSlideHtml(elements, slideBg, contentOffsetX, slideWEmu, slideHEmu));
    }
    // Prepend font style block to first slide so embedded fonts load via Google Fonts
    if (fontStyleBlock && slides.length > 0) {
        slides[0] = fontStyleBlock + slides[0];
    }
    return slides;
}
//# sourceMappingURL=import-pptx.js.map