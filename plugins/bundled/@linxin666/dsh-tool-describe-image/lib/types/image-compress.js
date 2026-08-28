/**
 * Send-time image compression for the describe-image tool: mirrors the DSH native
 * attachment normalization (long edge capped at 2048, JPEG quality 85) so one
 * large image cannot blow the vision model's context window with an oversized
 * base64 payload. JPEG and PNG inputs whose longest edge exceeds 2048 or whose
 * encoded bytes exceed 256 KiB are decoded, proportionally downscaled with a
 * bilinear resampler, alpha-composited onto white, and re-encoded as a
 * quality-85 JPEG; anything the pipeline cannot improve — GIF, WebP, interlaced
 * or undecodable inputs, or a re-encode that grew the bytes — passes through
 * byte-identically. Only host-provided pure-JS modules do the heavy lifting
 * (jpeg-js for JPEG decoding and encoding, fflate for PNG's zlib stream), each
 * imported lazily so a missing host dependency degrades to pass-through, never
 * failure.
 * @module @linxin666/dsh-tool-describe-image/image-compress
 */
/** Longest-edge cap, matching the DSH native normalization. */
const MAX_EDGE = 2048;
/** Encoded bytes past this size compress even when the pixels are already small enough. */
const BYTE_TRIGGER = 262_144;
/** JPEG quality of the re-encode. */
const JPEG_QUALITY = 85;
/** Decode bound in megapixels, mirroring jpeg-js's own resolution guard. */
const MAX_MEGAPIXELS = 100;
/** Channel count of each supported PNG color type (palette stores one index per pixel). */
const PNG_CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
/** The eight-byte PNG signature. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/**
 * Compress one loaded image before it reaches the vision endpoint: JPEG and PNG
 * inputs whose longest edge exceeds 2048 or whose bytes exceed 256 KiB are
 * downscaled to a 2048 long edge (bilinear) and re-encoded as a quality-85 JPEG
 * over a white background. GIF and WebP inputs, undecodable bytes, and re-encodes
 * that would grow the image are returned unchanged.
 * @param image - the loaded bytes and sniffed media type.
 * @returns the possibly recompressed bytes and their media type.
 */
export async function compressIfNeeded(image) {
    const { bytes, mimeType } = image;
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png')
        return image;
    try {
        if (bytes.length <= BYTE_TRIGGER) {
            const size = mimeType === 'image/png' ? readPngHeader(bytes) : jpegSofSize(bytes);
            if (size === undefined || Math.max(size.width, size.height) <= MAX_EDGE)
                return image;
        }
        const decoded = mimeType === 'image/png' ? await decodePng(bytes) : await decodeJpeg(bytes);
        if (decoded === undefined)
            return image;
        flattenAlphaOntoWhite(decoded.data);
        let target = decoded;
        if (Math.max(decoded.width, decoded.height) > MAX_EDGE) {
            const scaled = scaledSize(decoded.width, decoded.height);
            target = {
                width: scaled.width,
                height: scaled.height,
                data: resizeBilinear(decoded.data, decoded.width, decoded.height, scaled.width, scaled.height),
            };
        }
        const { encode } = await import('jpeg-js');
        const encoded = encode({ data: target.data, width: target.width, height: target.height }, JPEG_QUALITY);
        if (encoded.data.length >= bytes.length)
            return image;
        return { bytes: Buffer.from(encoded.data), mimeType: 'image/jpeg' };
    }
    catch {
        return image;
    }
}
/** Read one PNG's IHDR, or undefined when the bytes are not a well-formed PNG start. */
function readPngHeader(bytes) {
    // signature(8) + length(4) + type(4) + IHDR payload(13) + CRC(4)
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE))
        return undefined;
    if (bytes.readUInt32BE(8) !== 13 || bytes.subarray(12, 16).toString('ascii') !== 'IHDR')
        return undefined;
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width === 0 || height === 0)
        return undefined;
    if (bytes[26] !== 0 || bytes[27] !== 0)
        return undefined;
    return { width, height, bitDepth: bytes[24], colorType: bytes[25], interlace: bytes[28] };
}
/**
 * Read one JPEG's frame dimensions by walking its markers to the first SOF
 * segment, or undefined when the bytes are not a well-formed JPEG start.
 */
function jpegSofSize(bytes) {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
        return undefined;
    let offset = 2;
    while (offset + 1 < bytes.length) {
        if (bytes[offset] !== 0xff)
            return undefined;
        const marker = bytes[offset + 1];
        if (marker === 0xff) {
            offset += 1;
            continue;
        }
        // SOI, EOI, TEM, and RSTn markers carry no length of their own.
        if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            offset += 2;
            continue;
        }
        if (offset + 4 > bytes.length)
            return undefined;
        const length = bytes.readUInt16BE(offset + 2);
        if (length < 2 || offset + 2 + length > bytes.length)
            return undefined;
        // SOF0..SOF15 carry the frame; DHT, JPG, and DAC occupy three gaps in that range.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            if (length < 8)
                return undefined;
            const height = bytes.readUInt16BE(offset + 5);
            const width = bytes.readUInt16BE(offset + 7);
            if (width === 0 || height === 0)
                return undefined;
            return { width, height };
        }
        if (marker === 0xda)
            return undefined;
        offset += 2 + length;
    }
    return undefined;
}
/** Decode one JPEG to RGBA via the host-provided jpeg-js. */
async function decodeJpeg(bytes) {
    try {
        const { decode } = await import('jpeg-js');
        const decoded = decode(bytes, { useTArray: true, formatAsRGBA: true });
        return { width: decoded.width, height: decoded.height, data: decoded.data };
    }
    catch {
        return undefined;
    }
}
/**
 * Minimal non-interlaced PNG decoder: IHDR/PLTE/tRNS/IDAT, color types
 * 0/2/3/4/6, bit depths 8 and 16 (16-bit samples keep their high byte), and
 * filters 0-4. Returns undefined for anything it does not fully understand —
 * interlacing, sub-byte depths, truncated chunks, bad zlib — so the caller
 * passes the original through instead of guessing.
 */
async function decodePng(bytes) {
    const header = readPngHeader(bytes);
    if (header === undefined)
        return undefined;
    const { width, height, bitDepth, colorType, interlace } = header;
    if (interlace !== 0)
        return undefined;
    const channels = PNG_CHANNELS[colorType];
    if (channels === undefined || (bitDepth !== 8 && bitDepth !== 16))
        return undefined;
    if (colorType === 3 && bitDepth !== 8)
        return undefined;
    if (width * height > MAX_MEGAPIXELS * 1_000_000)
        return undefined;
    const bytesPerSample = bitDepth === 16 ? 2 : 1;
    const bpp = channels * bytesPerSample;
    const rowBytes = width * bpp;
    let palette;
    let trns;
    const idat = [];
    let offset = 8;
    while (offset + 12 <= bytes.length) {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
        if (!/^[A-Za-z]{4}$/.test(type) || offset + 12 + length > bytes.length)
            return undefined;
        const data = bytes.subarray(offset + 8, offset + 8 + length);
        if (type === 'PLTE')
            palette = data;
        else if (type === 'tRNS')
            trns = data;
        else if (type === 'IDAT')
            idat.push(data);
        else if (type === 'IEND')
            break;
        offset += 12 + length;
    }
    if (idat.length === 0)
        return undefined;
    if (colorType === 3 && (palette === undefined || palette.length === 0 || palette.length % 3 !== 0))
        return undefined;
    let raw;
    try {
        const { unzlibSync } = await import('fflate');
        raw = unzlibSync(idat.length === 1 ? idat[0] : Buffer.concat(idat));
    }
    catch {
        return undefined;
    }
    if (raw.length !== height * (rowBytes + 1))
        return undefined;
    if (!unfilterPng(raw, height, rowBytes, bpp))
        return undefined;
    return rgbaFromPng(raw, width, height, channels, bytesPerSample, colorType, palette, trns);
}
/** Reverse one PNG's per-row filters (types 0-4) in place; false on an unknown filter. */
function unfilterPng(raw, height, rowBytes, bpp) {
    let previous = -1;
    for (let y = 0; y < height; y++) {
        const start = y * (rowBytes + 1);
        const filterType = raw[start];
        if (filterType > 4)
            return false;
        const row = start + 1;
        for (let i = 0; i < rowBytes; i++) {
            const left = i >= bpp ? raw[row + i - bpp] : 0;
            const above = previous >= 0 ? raw[previous + 1 + i] : 0;
            const upperLeft = i >= bpp && previous >= 0 ? raw[previous + 1 + i - bpp] : 0;
            let predictor = 0;
            if (filterType === 1)
                predictor = left;
            else if (filterType === 2)
                predictor = above;
            else if (filterType === 3)
                predictor = (left + above) >> 1;
            else if (filterType === 4)
                predictor = paethPredictor(left, above, upperLeft);
            raw[row + i] = raw[row + i] + predictor;
        }
        previous = start;
    }
    return true;
}
/** The PNG Paeth predictor: the nearest of left/above/upper-left to their plane estimate. */
function paethPredictor(left, above, upperLeft) {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const diagonalDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= aboveDistance && leftDistance <= diagonalDistance)
        return left;
    if (aboveDistance <= diagonalDistance)
        return above;
    return upperLeft;
}
/** Convert one unfiltered PNG bitmap to RGBA, applying the palette and tRNS transparency. */
function rgbaFromPng(raw, width, height, channels, bytesPerSample, colorType, palette, trns) {
    const bpp = channels * bytesPerSample;
    const rowBytes = width * bpp;
    const rgba = new Uint8Array(width * height * 4);
    // tRNS carries full-depth sample values of the fully transparent color.
    const grayKey = colorType === 0 && trns !== undefined && trns.length >= 2 ? trns[0] * 256 + trns[1] : undefined;
    const rgbKey = colorType === 2 && trns !== undefined && trns.length >= 6
        ? [trns[0] * 256 + trns[1], trns[2] * 256 + trns[3], trns[4] * 256 + trns[5]]
        : undefined;
    const paletteEntries = palette === undefined ? 0 : palette.length / 3;
    for (let y = 0; y < height; y++) {
        const row = y * (rowBytes + 1) + 1;
        for (let x = 0; x < width; x++) {
            const source = row + x * bpp;
            const target = (y * width + x) * 4;
            if (colorType === 6) {
                rgba[target] = raw[source];
                rgba[target + 1] = raw[source + bytesPerSample];
                rgba[target + 2] = raw[source + bytesPerSample * 2];
                rgba[target + 3] = raw[source + bytesPerSample * 3];
            }
            else if (colorType === 2) {
                rgba[target] = raw[source];
                rgba[target + 1] = raw[source + bytesPerSample];
                rgba[target + 2] = raw[source + bytesPerSample * 2];
                rgba[target + 3] = rgbKey !== undefined
                    && sampleAt(raw, source, bytesPerSample) === rgbKey[0]
                    && sampleAt(raw, source + bytesPerSample, bytesPerSample) === rgbKey[1]
                    && sampleAt(raw, source + bytesPerSample * 2, bytesPerSample) === rgbKey[2]
                    ? 0
                    : 255;
            }
            else if (colorType === 0) {
                const gray = raw[source];
                rgba[target] = gray;
                rgba[target + 1] = gray;
                rgba[target + 2] = gray;
                rgba[target + 3] = grayKey !== undefined && sampleAt(raw, source, bytesPerSample) === grayKey ? 0 : 255;
            }
            else if (colorType === 4) {
                const gray = raw[source];
                rgba[target] = gray;
                rgba[target + 1] = gray;
                rgba[target + 2] = gray;
                rgba[target + 3] = raw[source + bytesPerSample];
            }
            else if (palette !== undefined) {
                const index = raw[source];
                if (index >= paletteEntries)
                    return undefined;
                rgba[target] = palette[index * 3];
                rgba[target + 1] = palette[index * 3 + 1];
                rgba[target + 2] = palette[index * 3 + 2];
                rgba[target + 3] = trns !== undefined && index < trns.length ? trns[index] : 255;
            }
        }
    }
    return { width, height, data: rgba };
}
/** Read one full-depth sample: the 16-bit pair, or the single 8-bit byte. */
function sampleAt(raw, offset, bytesPerSample) {
    return bytesPerSample === 2 ? raw[offset] * 256 + raw[offset + 1] : raw[offset];
}
/** Composite alpha onto a white background, in place; opaque pixels are untouched. */
function flattenAlphaOntoWhite(rgba) {
    for (let i = 0; i < rgba.length; i += 4) {
        const alpha = rgba[i + 3];
        if (alpha === 255)
            continue;
        rgba[i] = blendOverWhite(rgba[i], alpha);
        rgba[i + 1] = blendOverWhite(rgba[i + 1], alpha);
        rgba[i + 2] = blendOverWhite(rgba[i + 2], alpha);
    }
}
/** One source-over-white blend of a single channel. */
function blendOverWhite(channel, alpha) {
    return (channel * alpha + 255 * (255 - alpha) + 127) / 255 | 0;
}
/** Proportional target size with the longest edge clamped to MAX_EDGE. */
function scaledSize(width, height) {
    const scale = MAX_EDGE / Math.max(width, height);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}
/** Bilinear resample of one RGBA bitmap to an exact target size. */
function resizeBilinear(source, width, height, targetWidth, targetHeight) {
    const target = new Uint8Array(targetWidth * targetHeight * 4);
    const xRatio = width / targetWidth;
    const yRatio = height / targetHeight;
    for (let ty = 0; ty < targetHeight; ty++) {
        const sy = Math.min(height - 1, Math.max(0, (ty + 0.5) * yRatio - 0.5));
        const y0 = Math.floor(sy);
        const y1 = Math.min(y0 + 1, height - 1);
        const fy = sy - y0;
        const topRow = y0 * width * 4;
        const bottomRow = y1 * width * 4;
        for (let tx = 0; tx < targetWidth; tx++) {
            const sx = Math.min(width - 1, Math.max(0, (tx + 0.5) * xRatio - 0.5));
            const x0 = Math.floor(sx);
            const x1 = Math.min(x0 + 1, width - 1);
            const fx = sx - x0;
            const topLeft = topRow + x0 * 4;
            const topRight = topRow + x1 * 4;
            const bottomLeft = bottomRow + x0 * 4;
            const bottomRight = bottomRow + x1 * 4;
            const targetOffset = (ty * targetWidth + tx) * 4;
            for (let c = 0; c < 4; c++) {
                const top = source[topLeft + c] + (source[topRight + c] - source[topLeft + c]) * fx;
                const bottom = source[bottomLeft + c] + (source[bottomRight + c] - source[bottomLeft + c]) * fx;
                target[targetOffset + c] = top + (bottom - top) * fy + 0.5 | 0;
            }
        }
    }
    return target;
}
