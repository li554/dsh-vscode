/**
 * Minimal PNG/WebP dimension reader — header-only, no decoding, no
 * dependencies. Used by the decoration registry to verify a strip's actual
 * pixel geometry matches its descriptor (single-row sprite strip; the client
 * renders by frame-column offsets, so a mismatched strip silently shows the
 * wrong frames). Parsing is best-effort: an unrecognized or truncated header
 * returns undefined (the caller decides whether to warn).
 *
 * PNG: signature (8) + IHDR chunk — length (4) + 'IHDR' (4) + width (4) +
 * height (4), both big-endian uint32 at fixed offsets 16/20.
 * WebP: RIFF header (12) + chunk — 'VP8X' extended (width-1/height-1 as
 * little-endian uint24 at 24/27), 'VP8L' lossless (packed 14-bit dims at
 * 21), or 'VP8 ' lossy (frame header, low 14 bits of the uint16 at 26/28).
 * @module @linxin666/dsh-pet/image-dimensions
 */
export interface ImageDimensions {
    width: number;
    height: number;
}
/**
 * Read image pixel dimensions from a PNG or WebP buffer. Returns undefined
 * for formats this reader does not recognize (never throws). Callers treat
 * undefined as "cannot verify", not as an error.
 */
export declare function imageDimensions(buf: Buffer): ImageDimensions | undefined;
//# sourceMappingURL=image-dimensions.d.ts.map