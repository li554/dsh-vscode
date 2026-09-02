/**
 * Convert parsed slide data into PptxGenJS slide elements.
 *
 * This is a faithful TypeScript port of the `addBackground()`, `addElements()`,
 * and `fetchImageAsDataUrl()` functions from `dist/html2pptx.js`.
 *
 * It consumes the intermediate representation defined in `./common.ts` and calls
 * the PptxGenJS Slide API to render backgrounds, images, shapes, text, and lists.
 */
import { getAltFont } from './fonts.js';
// ---------------------------------------------------------------------------
// Font fallback helper
// ---------------------------------------------------------------------------
/**
 * Enrich text runs with `altFont` for OOXML fallback.
 *
 * PptxGenJS writes each text run's `fontFace` to `<a:latin typeface="..."/>`.
 * By also setting `altFont`, we populate the OOXML `altFont` attribute so
 * PowerPoint / LibreOffice can fall back to a universally-installed font
 * (e.g. Arial, Georgia) when the primary font is missing.
 */
function addAltFonts(runs) {
    for (const run of runs) {
        if (run.options?.fontFace && !run.options.altFont) {
            const alt = getAltFont(run.options.fontFace);
            if (alt)
                run.options.altFont = alt;
        }
    }
    return runs;
}
// ---------------------------------------------------------------------------
// Cover crop helper
// ---------------------------------------------------------------------------
/**
 * Calculate object-fit:cover crop sizing for PptxGenJS.
 *
 * PptxGenJS's built-in cover sizing is broken: it uses the display box
 * dimensions as both imgSize and boxDim, resulting in no crop. This function
 * manually calculates the crop rectangle from the intrinsic image dimensions,
 * display box, and optional object-position anchor.
 *
 * @param naturalWidth  - Intrinsic image width (pixels).
 * @param naturalHeight - Intrinsic image height (pixels).
 * @param boxW          - Display box width (inches).
 * @param boxH          - Display box height (inches).
 * @param objectPosition - Crop anchor as [xFrac, yFrac] (0鈥?). Defaults to [0.5, 0.5].
 * @returns PptxGenJS-compatible sizing object with crop coordinates, plus
 *          effective image dimensions (effW, effH) to set on ImageOptions.
 */
function computeCoverCrop(naturalWidth, naturalHeight, boxW, boxH, objectPosition) {
    const imgRatio = naturalHeight / naturalWidth;
    const boxRatio = boxH / boxW;
    const isBoxBased = boxRatio > imgRatio;
    // Effective size if we scale the image to cover the box
    const effW = isBoxBased ? boxH / imgRatio : boxW;
    const effH = isBoxBased ? boxH : boxW * imgRatio;
    // Crop rectangle: position the box within the effective image area
    // using the object-position anchor (default: center = 0.5, 0.5)
    const [anchorX, anchorY] = objectPosition ?? [0.5, 0.5];
    const excessW = effW - boxW;
    const excessH = effH - boxH;
    const cropX = excessW * anchorX;
    const cropY = excessH * anchorY;
    return {
        effW,
        effH,
        sizing: {
            type: 'crop',
            x: cropX,
            y: cropY,
            w: boxW,
            h: boxH,
        },
    };
}
// ---------------------------------------------------------------------------
// fetchImageAsDataUrl
// ---------------------------------------------------------------------------
/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Download an external image and convert it to a base64 data URL using fetch.
 *
 * Includes retry logic with exponential backoff for transient failures
 * (rate limiting, network errors, etc.).
 *
 * Throws on network errors or non-OK responses after all retries are exhausted.
 */
export async function fetchImageAsDataUrl(url, maxRetries = 3, initialDelayMs = 500) {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, { mode: 'cors' });
            // Handle rate limiting (429) and server errors (5xx) with retry
            if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
                if (attempt < maxRetries) {
                    const delay = initialDelayMs * Math.pow(2, attempt);
                    console.warn(`Image fetch returned ${response.status}, retrying in ${delay}ms... (${url})`);
                    await sleep(delay);
                    continue;
                }
            }
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
            }
            const blob = await response.blob();
            // Node/extension runtime (export runs in the host, not a browser): no
            // FileReader — convert the blob directly to a base64 data URL.
            if (typeof FileReader === 'undefined') {
                const buf = Buffer.from(await blob.arrayBuffer());
                const mime = blob.type || 'image/png';
                return `data:${mime};base64,${buf.toString('base64')}`;
            }
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Retry on network errors
            if (attempt < maxRetries) {
                const delay = initialDelayMs * Math.pow(2, attempt);
                console.warn(`Image fetch failed, retrying in ${delay}ms... (${url}): ${lastError.message}`);
                await sleep(delay);
                continue;
            }
        }
    }
    const message = lastError?.message ?? 'Unknown error';
    throw new Error(`Failed to fetch image ${url}: ${message}`);
}
// ---------------------------------------------------------------------------
// applyBackground
// ---------------------------------------------------------------------------
/**
 * Apply a slide background (color, gradient, or image) to a PptxGenJS Slide.
 */
export async function applyBackground(background, slide) {
    if (background.type === 'image' && background.path) {
        // Fetch the image and convert to data URL
        try {
            const dataUrl = await fetchImageAsDataUrl(background.path);
            slide.background = { data: dataUrl };
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.warn('Could not load background image:', message);
        }
    }
    else if (background.type === 'gradient' && background.gradient) {
        slide.background = {
            type: 'gradient',
            gradient: background.gradient,
        };
    }
    else if (background.type === 'color' && background.value) {
        slide.background = { color: background.value };
    }
}
// ---------------------------------------------------------------------------
// Slide boundary clipping
// ---------------------------------------------------------------------------
/**
 * Slide dimensions in inches for clipping (defaults to LAYOUT_16x9 = 10" x 5.625").
 * p2h-bridge calls `setSlideSize()` before rendering to match the source deck's canvas.
 */
let SLIDE_W = 10; // 960 / 96 = 10 inches
let SLIDE_H = 5.625; // 540 / 96 = 5.625 inches
/**
 * Override the slide canvas size (inches) used for boundary clipping.
 * Call once before `addElementsToSlide` when exporting to a non-default canvas.
 */
export function setSlideSize(w, h) {
    if (typeof w === 'number' && w > 0)
        SLIDE_W = w;
    if (typeof h === 'number' && h > 0)
        SLIDE_H = h;
}
/** Element types that carry text 鈥?must NOT be clipped (clipping re-wraps/truncates text). */
const TEXT_ELEMENT_TYPES = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'list']);
/**
 * Clip an element's position to the slide boundary.
 *
 * HTML slides use `overflow: hidden` on the body, so elements positioned
 * partially off-screen are visually clipped. PowerPoint renders shapes
 * outside the slide boundary, creating visible overflow. This function
 * trims the position/size so the visible portion matches the HTML output.
 *
 * Returns `null` if the element is entirely off-slide (should be skipped).
 */
function clipToSlide(pos) {
    let { x, y, w, h } = pos;
    // Clip left edge
    if (x < 0) {
        w += x; // reduce width by the overflow amount
        x = 0;
    }
    // Clip top edge
    if (y < 0) {
        h += y;
        y = 0;
    }
    // Clip right edge
    if (x + w > SLIDE_W) {
        w = SLIDE_W - x;
    }
    // Clip bottom edge
    if (y + h > SLIDE_H) {
        h = SLIDE_H - y;
    }
    // If nothing visible remains, skip the element
    if (w <= 0 || h <= 0)
        return null;
    return { x, y, w, h };
}
// ---------------------------------------------------------------------------
// addElementsToSlide
// ---------------------------------------------------------------------------
/**
 * Add all slide elements to a PptxGenJS Slide.
 *
 * Performs TWO passes over the elements array:
 *   1. First pass  - adds `slideBackgroundImage` elements (rendered behind everything).
 *   2. Second pass - adds all other element types (image, backgroundImage, line, shape, list, text).
 *
 * Images are prefetched in parallel at the start for better performance.
 *
 * @param elements - The parsed slide elements array.
 * @param slide    - The target PptxGenJS Slide instance.
 * @param pres     - The PptxGenJS presentation instance (needed for `pres.ShapeType`).
 *                   Typed as `any` because `ShapeType` is a runtime property.
 */
export async function addElementsToSlide(elements, slide, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
pres) {
    // ---- Prefetch all images in parallel ----
    const imageUrls = new Set();
    for (const el of elements) {
        if (el.type === 'image' || el.type === 'backgroundImage' || el.type === 'slideBackgroundImage') {
            if (el.src && !el.src.startsWith('data:')) {
                imageUrls.add(el.src);
            }
        }
    }
    const imageCache = new Map();
    if (imageUrls.size > 0) {
        const fetchPromises = Array.from(imageUrls).map(async (url) => {
            try {
                const dataUrl = await fetchImageAsDataUrl(url);
                imageCache.set(url, { data: dataUrl });
            }
            catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                console.warn(`Could not fetch image ${url}: ${message}`);
                imageCache.set(url, null);
            }
        });
        await Promise.all(fetchPromises);
    }
    // Helper to get image from cache or return data URI directly
    const getCachedImageSource = (src) => {
        if (src.startsWith('data:')) {
            return { data: src };
        }
        return imageCache.get(src) ?? null;
    };
    // ---- First pass: slide background images ----
    for (const el of elements) {
        if (el.type === 'slideBackgroundImage') {
            const imgSrc = getCachedImageSource(el.src);
            if (!imgSrc) {
                console.warn(`Skipping slide background image (fetch failed): ${el.src}`);
                continue;
            }
            const imageOptions = {
                ...imgSrc,
                x: el.position.x,
                y: el.position.y,
                w: el.position.w,
                h: el.position.h,
            };
            if (el.sizing && el.sizing.type === 'cover' && el.naturalWidth && el.naturalHeight) {
                // Use manual cover crop calculation 鈥?PptxGenJS's built-in cover is broken.
                const crop = computeCoverCrop(el.naturalWidth, el.naturalHeight, el.position.w, el.position.h, el.objectPosition);
                imageOptions.w = crop.effW;
                imageOptions.h = crop.effH;
                imageOptions.sizing = crop.sizing;
            }
            else if (el.sizing && el.sizing.type) {
                imageOptions.sizing = { type: el.sizing.type, w: el.position.w, h: el.position.h };
            }
            // Apply CSS filter effects (brightness, contrast)
            if (el.brightness !== undefined)
                imageOptions.brightness = el.brightness;
            if (el.contrast !== undefined)
                imageOptions.contrast = el.contrast;
            if (el.saturation !== undefined)
                imageOptions.saturation = el.saturation;
            // Apply CSS opacity as image transparency
            if (el.transparency !== undefined)
                imageOptions.transparency = el.transparency;
            slide.addImage(imageOptions);
        }
    }
    // ---- Second pass: all other elements ----
    for (const el of elements) {
        if (el.type === 'slideBackgroundImage') {
            continue;
        }
        // Clip non-text elements to the slide boundary.
        // HTML slides use overflow:hidden on the viewport, so elements positioned
        // partially off-screen are visually clipped. PowerPoint renders shapes
        // outside the slide boundary, creating visible overflow.
        //
        // Only clip visual-only elements (image, backgroundImage, shape without
        // text). Text-bearing elements (shape with text, list, text) are left
        // unclipped because shrinking their box would re-wrap or truncate text,
        // producing a worse result than a small overflow. Lines have separate
        // coordinate fields and are also left unclipped.
        // custGeom shapes (clip-path polygons, often rotated wedges/triangles) are
        // also left unclipped: shrinking the box without re-clipping the path points
        // cuts the polygon against the new (smaller) path coordinate space, so the
        // triangle gets mangled. The path points already encode the visible shape;
        // PowerPoint only draws the polygon, so an oversized frame box is harmless.
        const isTextBearing = TEXT_ELEMENT_TYPES.has(el.type) ||
            (el.type === 'shape' && (!!el.text || (el.textRuns && el.textRuns.length > 0)));
        const isCustGeom = el.type === 'shape' && Array.isArray(el.shape?.customGeometry) && el.shape.customGeometry.length > 0;
        if (el.type !== 'line' && !isTextBearing && !isCustGeom) {
            const clipped = clipToSlide(el.position);
            if (!clipped)
                continue; // entirely off-slide
            el.position.x = clipped.x;
            el.position.y = clipped.y;
            el.position.w = clipped.w;
            el.position.h = clipped.h;
        }
        if (el.type === 'image') {
            const imgSrc = getCachedImageSource(el.src);
            if (!imgSrc) {
                console.warn(`Skipping image (fetch failed): ${el.src}`);
                continue;
            }
            const imageOptions = {
                ...imgSrc,
                x: el.position.x,
                y: el.position.y,
                w: el.position.w,
                h: el.position.h,
            };
            if (el.sizing && el.sizing.type === 'crop' && el.effW && el.effH) {
                // srcRect-cropped image (import-pptx wrapper + offset inner img): the
                // full image spans effW x effH and the visible box is sizing.x/y/w/h.
                imageOptions.w = el.effW;
                imageOptions.h = el.effH;
                imageOptions.sizing = el.sizing;
            }
            else if (el.sizing && el.sizing.type === 'cover' && el.naturalWidth && el.naturalHeight) {
                // Calculate object-fit:cover crop rect from intrinsic image dimensions.
                // PptxGenJS's built-in cover sizing is broken: it uses the display box
                // dimensions as both imgSize and boxDim, resulting in no crop.
                const crop = computeCoverCrop(el.naturalWidth, el.naturalHeight, el.position.w, el.position.h, el.objectPosition);
                imageOptions.w = crop.effW;
                imageOptions.h = crop.effH;
                imageOptions.sizing = crop.sizing;
            }
            else if (el.sizing && el.sizing.type) {
                imageOptions.sizing = { type: el.sizing.type, w: el.position.w, h: el.position.h };
            }
            if (el.rectRadius) {
                imageOptions.rectRadius = el.rectRadius;
            }
            // Apply CSS filter effects (brightness, contrast)
            if (el.brightness !== undefined)
                imageOptions.brightness = el.brightness;
            if (el.contrast !== undefined)
                imageOptions.contrast = el.contrast;
            if (el.saturation !== undefined)
                imageOptions.saturation = el.saturation;
            // Apply CSS opacity as image transparency
            if (el.transparency !== undefined)
                imageOptions.transparency = el.transparency;
            slide.addImage(imageOptions);
        }
        else if (el.type === 'backgroundImage') {
            const imgSrc = getCachedImageSource(el.src);
            if (!imgSrc) {
                console.warn(`Skipping background image (fetch failed): ${el.src}`);
                continue;
            }
            const imageOptions = {
                ...imgSrc,
                x: el.position.x,
                y: el.position.y,
                w: el.position.w,
                h: el.position.h,
            };
            if (el.sizing && el.sizing.type === 'crop' && el.effW && el.effH) {
                imageOptions.w = el.effW;
                imageOptions.h = el.effH;
                imageOptions.sizing = el.sizing;
            }
            else if (el.sizing && el.sizing.type) {
                imageOptions.sizing = { type: el.sizing.type, w: el.position.w, h: el.position.h };
            }
            slide.addImage(imageOptions);
        }
        else if (el.type === 'line') {
            const lineOpts = {
                color: el.color,
                width: el.width,
            };
            if (el.transparency != null)
                lineOpts.transparency = el.transparency;
            slide.addShape(pres.ShapeType.line, {
                x: el.x1,
                y: el.y1,
                w: el.x2 - el.x1,
                h: el.y2 - el.y1,
                line: lineOpts,
            });
        }
        else if (el.type === 'shape') {
            // Determine shape type: ellipse, roundRect, rect, custGeom, or triangle
            let shapeType = pres.ShapeType.rect;
            let customGeometryPoints;
            // Track additional rotation needed for CSS triangles (beyond any CSS rotation)
            let triangleRotation = null;
            if (el.shape.cssTriangle) {
                // CSS triangles created with border trick 鈫?use isosceles triangle shape
                shapeType = pres.ShapeType.triangle;
                // The PptxGenJS triangle points UP by default.
                // We need to rotate it based on the direction:
                // - 'up': no additional rotation (0掳)
                // - 'down': 180掳 rotation
                // - 'left': -90掳 rotation (or 270掳)
                // - 'right': 90掳 rotation
                switch (el.shape.cssTriangle.direction) {
                    case 'up':
                        triangleRotation = 0;
                        break;
                    case 'down':
                        triangleRotation = 180;
                        break;
                    case 'left':
                        triangleRotation = 270;
                        break;
                    case 'right':
                        triangleRotation = 90;
                        break;
                }
            }
            else if (el.shape.customGeometry && el.shape.customGeometry.length > 0) {
                shapeType = pres.ShapeType.custGeom;
                customGeometryPoints = el.shape.customGeometry;
            }
            else if (el.shape.isEllipse) {
                shapeType = pres.ShapeType.ellipse;
            }
            else if (el.shape.rectRadius > 0) {
                shapeType = pres.ShapeType.roundRect;
            }
            // Detect single-line text in shapes to disable wrapping
            const lineHeightPt = el.style?.lineSpacing || ((el.style?.fontSize ?? 12) * 1.2);
            // Convert height from inches to points for comparison (1 inch = 72 points)
            // Subtract vertical padding from the height to get the actual text area height
            const verticalPaddingPt = el.style?.margin
                ? (el.style.margin[2] || 0) + (el.style.margin[3] || 0) // bottom + top
                : 0;
            const heightPt = el.position.h * 72 - verticalPaddingPt;
            const hasText = el.text || (el.textRuns && el.textRuns.length > 0);
            // Prefer the exact fontkit measurement (attached by dialect-parse) for
            // single-line detection — the box-height heuristic mislabels text whose
            // box is taller than one line but whose content is only one line.
            const measured = el.measured && hasText ? el.measured : null;
            const isSingleLine = measured
                ? measured.lineCount === 1
                : heightPt <= lineHeightPt * 1.5;
            // Add width buffer for single-line shapes with text to account for font metric
            // differences between browser rendering and PowerPoint/LibreOffice rendering.
            // Larger fonts need proportionally larger buffers due to greater absolute
            // differences in character widths between font families.
            let adjustedX = el.position.x;
            let adjustedW = el.position.w;
            let adjustedH = el.position.h;
            if (measured && measured.lineCount === 1) {
                // Exact single-line fit: widen the box to the measured text width when
                // the text overflows it (the heuristic % buffer never grows enough for
                // wide unbreakable strings), preserving alignment anchor.
                const textWidthIn = measured.singleWidthPt / 72;
                if (textWidthIn > el.position.w) {
                    const widthIncrease = textWidthIn - el.position.w;
                    const align = el.style?.align;
                    if (align === 'center') {
                        adjustedX = el.position.x - (widthIncrease / 2);
                        adjustedW = textWidthIn;
                    }
                    else if (align === 'right') {
                        adjustedX = el.position.x - widthIncrease;
                        adjustedW = textWidthIn;
                    }
                    else {
                        adjustedW = textWidthIn;
                    }
                }
            }
            else if (isSingleLine && hasText) {
                const fontSize = el.style?.fontSize ?? 12;
                // Base 2% buffer, scaling up to 5% for large fonts (>36pt)
                const bufferPercent = fontSize > 36 ? 0.05 : fontSize > 24 ? 0.04 : fontSize > 16 ? 0.03 : 0.02;
                const widthIncrease = el.position.w * bufferPercent;
                const align = el.style?.align;
                if (align === 'center') {
                    adjustedX = el.position.x - (widthIncrease / 2);
                    adjustedW = el.position.w + widthIncrease;
                }
                else if (align === 'right') {
                    adjustedX = el.position.x - widthIncrease;
                    adjustedW = el.position.w + widthIncrease;
                }
                else {
                    adjustedW = el.position.w + widthIncrease;
                }
            }
            else if (hasText && !isSingleLine) {
                // For multi-line text in shapes, add height buffer to prevent truncation.
                // Font metric differences can cause text to wrap differently, requiring more space.
                // Shapes with internal padding (margin/inset) already have built-in spacing,
                // so use a smaller buffer to avoid inflating container-like shapes.
                if (measured) {
                    // Exact wrap height from fontkit: ensure the box fits the measured
                    // line count (plus the vertical inset), instead of guessing a % buffer.
                    const insetPt = el.style?.margin
                        ? (el.style.margin[0] || 0) + (el.style.margin[2] || 0) // top + bottom
                        : 0;
                    const neededH = (measured.heightPt + insetPt) / 72;
                    adjustedH = Math.max(el.position.h, neededH);
                }
                else {
                    const hasInternalPadding = el.style?.margin && el.style.margin.some(m => m > 3);
                    const heightBufferPercent = hasInternalPadding ? 0.03 : 0.10;
                    const heightIncrease = el.position.h * heightBufferPercent;
                    adjustedH = el.position.h + heightIncrease;
                }
            }
            const shapeOptions = {
                x: adjustedX,
                y: el.position.y,
                w: adjustedW,
                h: adjustedH,
                shape: shapeType,
                // Disable text wrapping for single-line shapes to prevent unwanted line breaks
                // Also respect explicit wrap: false from parse.ts (for small badges/labels)
                wrap: el.style?.wrap === false ? false : !isSingleLine,
            };
            // Add custom geometry points for clip-path: polygon() shapes
            if (customGeometryPoints) {
                shapeOptions.points = customGeometryPoints;
            }
            // Compute effective fill transparency: combine rgba alpha with element opacity
            let fillTransparency = el.shape.transparency;
            const elementOpacity = el.shape.opacity !== null && el.shape.opacity < 1 ? el.shape.opacity : 1;
            if (elementOpacity < 1) {
                const opacityTransparency = Math.round((1 - elementOpacity) * 100);
                if (fillTransparency !== null) {
                    // Combine: both have transparency, multiply the opaque fractions
                    const rgbaOpaque = (100 - fillTransparency) / 100;
                    fillTransparency = Math.round((1 - rgbaOpaque * elementOpacity) * 100);
                }
                else {
                    fillTransparency = opacityTransparency;
                }
            }
            if (el.shape.gradient) {
                // For gradients with opacity, multiply each stop's transparency by
                // the element opacity.  This preserves correct alpha compositing so
                // semi-transparent overlays (e.g. ::after glass highlights) don't
                // become fully-opaque dark layers on top of underlying shapes.
                //
                // The previous approach blended the gradient colors with the slide
                // background, which only works when the gradient sits directly on
                // the slide bg.  For overlays on other shapes it produces incorrect
                // (too dark) results.
                if (elementOpacity < 1) {
                    const scaledGradient = {
                        ...el.shape.gradient,
                        stops: el.shape.gradient.stops.map(stop => {
                            // Existing stop transparency is 0-100 where 0=opaque, 100=fully transparent
                            const stopOpaque = stop.transparency !== undefined
                                ? (100 - stop.transparency) / 100
                                : 1;
                            const effectiveOpaque = stopOpaque * elementOpacity;
                            return {
                                ...stop,
                                transparency: Math.round((1 - effectiveOpaque) * 100),
                            };
                        }),
                    };
                    shapeOptions.fill = { type: 'gradient', gradient: scaledGradient };
                }
                else {
                    shapeOptions.fill = { type: 'gradient', gradient: el.shape.gradient };
                }
            }
            else if (el.shape.fill) {
                shapeOptions.fill = { color: el.shape.fill };
                if (fillTransparency != null)
                    shapeOptions.fill.transparency = fillTransparency;
            }
            if (el.shape.line) {
                const lineOpts = {
                    color: el.shape.line.color,
                    width: el.shape.line.width,
                };
                if (el.shape.line.transparency != null)
                    lineOpts.transparency = el.shape.line.transparency;
                if (el.shape.line.dashType)
                    lineOpts.dashType = el.shape.line.dashType;
                shapeOptions.line = lineOpts;
            }
            if (el.shape.rectRadius > 0)
                shapeOptions.rectRadius = el.shape.rectRadius;
            if (el.shape.shadow)
                shapeOptions.shadow = el.shape.shadow;
            if (el.shape.softEdge)
                shapeOptions.softEdgeRad = el.shape.softEdge;
            // Combine CSS rotation with triangle shape rotation
            const cssRotation = el.shape.rotate ?? 0;
            const totalRotation = cssRotation + (triangleRotation ?? 0);
            if (totalRotation !== 0)
                shapeOptions.rotate = totalRotation;
            if (el.style) {
                if (el.style.fontSize)
                    shapeOptions.fontSize = el.style.fontSize;
                // Align the exported fontFace with the font that was actually
                // measured (font-metrics): when the CSS-declared family is missing,
                // measurement falls back to a system sans, and the PPTX must reference
                // THAT family so "measured == rendered". Otherwise PowerPoint would
                // substitute unpredictably and the exact-fit logic above would drift.
                const resolvedShapeFace = (measured && measured.fontFamily) || el.style.fontFace;
                if (resolvedShapeFace) {
                    shapeOptions.fontFace = resolvedShapeFace;
                    const alt = getAltFont(resolvedShapeFace);
                    if (alt)
                        shapeOptions.altFont = alt;
                }
                if (el.style.color)
                    shapeOptions.color = el.style.color;
                if (el.style.bold)
                    shapeOptions.bold = el.style.bold;
                if (el.style.align)
                    shapeOptions.align = el.style.align;
                if (el.style.valign)
                    shapeOptions.valign = el.style.valign;
                if (el.style.fontFill) {
                    shapeOptions.fontFill = el.style.fontFill;
                    delete shapeOptions.color;
                }
                // Zero out OOXML default insets (~7pt horizontal, ~3.6pt vertical)
                // so text positioning matches CSS box model exactly.
                // Explicit margin/inset from parsed styles will override this default.
                shapeOptions.inset = 0;
                if (el.style.margin)
                    shapeOptions.margin = el.style.margin;
                if (el.style.inset !== undefined)
                    shapeOptions.inset = el.style.inset;
                // Note: wrap is already set based on single-line detection above
                if (el.style.charSpacing)
                    shapeOptions.charSpacing = el.style.charSpacing;
                if (el.style.lineSpacing)
                    shapeOptions.lineSpacing = el.style.lineSpacing;
                // Apply text transparency from rgba font colors
                if (el.style.transparency !== null && el.style.transparency !== undefined) {
                    shapeOptions.transparency = el.style.transparency;
                }
                if (el.style.glow) {
                    shapeOptions.glow = {
                        size: el.style.glow.size,
                        color: el.style.glow.color,
                        opacity: el.style.glow.opacity,
                    };
                }
                if (el.style.textShadow && !el.shape.shadow) {
                    // Only apply text-shadow if shape doesn't already have a box-shadow
                    shapeOptions.shadow = el.style.textShadow;
                }
            }
            if (el.textRuns && el.textRuns.length > 0) {
                slide.addText(addAltFonts(el.textRuns), shapeOptions);
            }
            else {
                slide.addText(el.text || '', shapeOptions);
            }
        }
        else if (el.type === 'list') {
            // Add height buffer for list elements to prevent truncation.
            // Font metric differences can cause text to wrap differently, requiring more space.
            const heightIncrease = el.position.h * 0.15;
            const adjustedH = el.position.h + heightIncrease;
            // Add width buffer for list elements, similar to text elements
            // LibreOffice typically renders text 5-10% wider than Chromium
            const fontSize = el.style.fontSize ?? 12;
            const bufferPercent = fontSize < 14 ? 0.10 : fontSize < 24 ? 0.07 : 0.05;
            const widthIncrease = el.position.w * bufferPercent;
            const adjustedW = el.position.w + widthIncrease;
            const listOptions = {
                x: el.position.x,
                y: el.position.y,
                w: adjustedW,
                h: adjustedH,
                fontSize: el.style.fontSize,
                fontFace: el.style.fontFace,
                altFont: el.style.fontFace ? getAltFont(el.style.fontFace) : undefined,
                color: el.style.color ?? undefined,
                align: el.style.align,
                valign: 'top',
                lineSpacing: el.style.lineSpacing,
                paraSpaceBefore: el.style.paraSpaceBefore,
                paraSpaceAfter: el.style.paraSpaceAfter,
                margin: el.style.margin,
                inset: 0,
            };
            if (el.style.transparency !== null && el.style.transparency !== undefined) {
                listOptions.transparency = el.style.transparency;
            }
            slide.addText(addAltFonts(el.items), listOptions);
        }
        else {
            // Text elements: p, h1-h6, li
            const lineHeightPt = el.style.lineSpacing || ((el.style.fontSize ?? 0) * 1.2);
            // Convert height from inches to points for comparison (1 inch = 72 points)
            const heightPt = el.position.h * 72;
            // Determine if text content has newlines (multi-line text from HTML structure)
            const textContent = typeof el.text === 'string' ? el.text :
                (Array.isArray(el.text) ? el.text.map((r) => r.text).join('') : '');
            const hasNewlines = textContent.includes('\n');
            // Prefer the exact fontkit measurement for single-line detection (the
            // box-height heuristic mislabels short content in a tall box as multi-line,
            // which forces wrap on and re-flows the text). Explicit newlines still win.
            const measured = el.measured || null;
            const isSingleLine = !hasNewlines && (measured
                ? measured.lineCount === 1
                : heightPt <= lineHeightPt * 1.5);
            let adjustedX = el.position.x;
            let adjustedW = el.position.w;
            let adjustedH = el.position.h;
            if (measured && measured.lineCount === 1) {
                // Exact single-line fit: widen the box to the measured text width when
                // it overflows, preserving alignment anchor (the % buffer under-covers
                // wide unbreakable runs and over-covers narrow ones).
                const textWidthIn = measured.singleWidthPt / 72;
                if (textWidthIn > el.position.w) {
                    const widthIncrease = textWidthIn - el.position.w;
                    const align = el.style.align;
                    if (align === 'center') {
                        adjustedX = el.position.x - (widthIncrease / 2);
                        adjustedW = textWidthIn;
                    }
                    else if (align === 'right') {
                        adjustedX = el.position.x - widthIncrease;
                        adjustedW = textWidthIn;
                    }
                    else {
                        adjustedW = textWidthIn;
                    }
                }
            }
            else if (isSingleLine) {
                // Add width buffer for single-line text to account for font metric
                // differences between browser rendering and PowerPoint/LibreOffice rendering.
                // LibreOffice typically renders text 5-10% wider than Chromium for the same
                // font, especially for longer text strings. Without wrapping enabled, text
                // gets truncated if the box is too narrow.
                const fontSize = el.style.fontSize ?? 12;
                // Base 5% buffer, scaling up to 10% for smaller fonts which have more variance
                // Smaller fonts (< 14pt) need more buffer due to hinting differences
                const bufferPercent = fontSize < 14 ? 0.10 : fontSize < 24 ? 0.07 : 0.05;
                const widthIncrease = el.position.w * bufferPercent;
                const align = el.style.align;
                if (align === 'center') {
                    adjustedX = el.position.x - (widthIncrease / 2);
                    adjustedW = el.position.w + widthIncrease;
                }
                else if (align === 'right') {
                    adjustedX = el.position.x - widthIncrease;
                    adjustedW = el.position.w + widthIncrease;
                }
                else {
                    adjustedW = el.position.w + widthIncrease;
                }
            }
            else {
                // For multi-line text, add a small width buffer to help with line-break consistency
                // across different renderers (Chromium vs LibreOffice). Even with the same font,
                // rendering engines have slightly different text metrics (~1-2% variance).
                const widthIncrease = el.position.w * 0.02;
                const align = el.style.align;
                if (align === 'center') {
                    adjustedX = el.position.x - (widthIncrease / 2);
                    adjustedW = el.position.w + widthIncrease;
                }
                else if (align === 'right') {
                    adjustedX = el.position.x - widthIncrease;
                    adjustedW = el.position.w + widthIncrease;
                }
                else {
                    adjustedW = el.position.w + widthIncrease;
                }
                // Add height buffer for multi-line text to prevent truncation.
                // If the text has newlines, we need significantly more height because
                // the element height in HTML is based on wrapped text, but each "line"
                // in the HTML might need multiple lines when displayed in PPTX.
                // For text with explicit newlines, double the height to ensure all text fits.
                if (measured) {
                    // Exact wrap height from fontkit: grow the box to fit the measured
                    // line count instead of guessing a % buffer (text with explicit
                    // newlines gets measured the same way — each '\n' is a line break).
                    const neededH = measured.heightPt / 72;
                    adjustedH = Math.max(el.position.h, neededH);
                }
                else {
                    const heightIncrease = hasNewlines ? el.position.h * 1.0 : el.position.h * 0.05;
                    adjustedH = el.position.h + heightIncrease;
                }
            }
            // Align the exported fontFace with the font actually measured by
            // font-metrics (see the shape branch above for the reasoning): the
            // PPTX must reference the resolved system family so measurement and
            // PowerPoint rendering stay in lock-step.
            const resolvedTextFace = (measured && measured.fontFamily) || el.style.fontFace;
            const textOptions = {
                x: adjustedX,
                y: el.position.y,
                w: adjustedW,
                h: adjustedH,
                fontSize: el.style.fontSize,
                fontFace: resolvedTextFace,
                altFont: resolvedTextFace ? getAltFont(resolvedTextFace) : undefined,
                color: el.style.color ?? undefined,
                bold: el.style.bold,
                italic: el.style.italic,
                underline: el.style.underline,
                valign: el.style.valign || 'top',
                lineSpacing: el.style.lineSpacing,
                paraSpaceBefore: el.style.paraSpaceBefore,
                paraSpaceAfter: el.style.paraSpaceAfter,
                inset: 0,
                // Disable text wrapping for single-line text to prevent unwanted line breaks
                wrap: !isSingleLine,
            };
            if (el.style.align)
                textOptions.align = el.style.align;
            if (el.style.margin)
                textOptions.margin = el.style.margin;
            if (el.style.rotate !== undefined)
                textOptions.rotate = el.style.rotate;
            if (el.style.transparency !== null && el.style.transparency !== undefined) {
                textOptions.transparency = el.style.transparency;
            }
            if (el.style.charSpacing)
                textOptions.charSpacing = el.style.charSpacing;
            if (el.style.fontFill) {
                textOptions.fontFill = el.style.fontFill;
                delete textOptions.color;
            }
            if (el.style.glow) {
                textOptions.glow = {
                    size: el.style.glow.size,
                    color: el.style.glow.color,
                    opacity: el.style.glow.opacity,
                };
            }
            if (el.style.textShadow) {
                textOptions.shadow = el.style.textShadow;
            }
            // Enrich text runs with altFont for fallback
            const text = Array.isArray(el.text) ? addAltFonts(el.text) : el.text;
            slide.addText(text, textOptions);
        }
    }
}
//# sourceMappingURL=convert.js.map