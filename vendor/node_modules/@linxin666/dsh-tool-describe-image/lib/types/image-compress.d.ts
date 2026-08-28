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
/**
 * Compress one loaded image before it reaches the vision endpoint: JPEG and PNG
 * inputs whose longest edge exceeds 2048 or whose bytes exceed 256 KiB are
 * downscaled to a 2048 long edge (bilinear) and re-encoded as a quality-85 JPEG
 * over a white background. GIF and WebP inputs, undecodable bytes, and re-encodes
 * that would grow the image are returned unchanged.
 * @param image - the loaded bytes and sniffed media type.
 * @returns the possibly recompressed bytes and their media type.
 */
export declare function compressIfNeeded(image: { bytes: Buffer, mimeType: string }): Promise<{ bytes: Buffer, mimeType: string }>;
