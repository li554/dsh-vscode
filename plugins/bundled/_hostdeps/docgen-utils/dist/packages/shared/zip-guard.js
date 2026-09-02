/**
 * Zip bomb protection for JSZip-based document processing.
 *
 * PPTX, DOCX (and XLSX) files are ZIP archives — this is how the Office Open
 * XML format works. When docgen calls JSZip.loadAsync() to read a PPTX or
 * DOCX, it decompresses the contents into memory. A "zip bomb" exploits this:
 * a malicious file that is tiny on disk (passes upload size checks) but
 * contains entries crafted from highly repetitive data that inflate to an
 * enormous size in memory, crashing the process.
 *
 * The signature of a zip bomb is an extreme compression ratio
 * (uncompressed / compressed). Legitimate Office documents compress 2–10:1;
 * a bomb is typically 1,000:1 or more.
 *
 * The ZIP format stores each entry's uncompressed size in the central-directory
 * header. JSZip reads this metadata during loadAsync WITHOUT decompressing any
 * data. This module uses that metadata to reject suspicious archives before any
 * inflation occurs.
 */
import JSZip from "jszip";
/**
 * Maximum compression ratio (total uncompressed / compressed input size).
 * Legitimate DOCX/PPTX files rarely exceed 10:1; 100:1 is a generous ceiling
 * that still catches all known zip-bomb payloads.
 *
 * This is the primary zip bomb signal — a tiny file that claims to expand
 * to an enormous amount of data.
 */
const MAX_COMPRESSION_RATIO = 100;
/**
 * Maximum number of entries (files + directories) inside the archive.
 * Protects against "zip of many files" attacks and limits iteration cost.
 * Real PPTX/DOCX files have fewer than 500 entries in practice.
 */
const MAX_ZIP_ENTRIES = 1000;
/**
 * Maximum total uncompressed size across all entries (500 MB).
 * This is a memory-protection ceiling, not a security check per se —
 * the compression ratio check above is what catches actual zip bombs.
 * Upstream callers (e.g. Picasso's FileTransferService) already enforce
 * a compressed-size limit, so we do not duplicate that check here.
 */
const MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
/**
 * Load a ZIP archive from an ArrayBuffer with zip bomb protections.
 *
 * Checks (in order):
 *  1. Compression ratio per entry  — primary zip bomb signal
 *  2. Overall compression ratio    — catches distributed bombs
 *  3. Entry count                  — zip-of-zips / resource limit
 *  4. Total uncompressed size      — memory ceiling
 *
 * Throws a descriptive Error if any limit is exceeded so callers can
 * surface a safe message (e.g. HTTP 400) without crashing.
 *
 * @param arrayBuffer - Raw bytes of the ZIP-based file (PPTX, DOCX, …).
 * @returns           - Parsed JSZip instance ready for file access.
 */
export async function loadZipSafely(arrayBuffer) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const entries = Object.values(zip.files);
    // ── 1 & 2. Compression-ratio gates (primary zip bomb detection) ──────────
    // Read uncompressed sizes from ZIP central-directory metadata.
    // JSZip populates this during loadAsync — no decompression required.
    let totalUncompressedBytes = 0;
    for (const file of entries) {
        if (file.dir)
            continue;
        const uncompressedSize = (file._data?.uncompressedSize) ?? 0;
        // Per-entry ratio: catches a single large-ratio entry even if it would
        // not skew the overall ratio (e.g. one bomb entry among many small ones).
        if (arrayBuffer.byteLength > 0) {
            const entryRatio = uncompressedSize / arrayBuffer.byteLength;
            if (entryRatio > MAX_COMPRESSION_RATIO) {
                throw new Error(`Zip bomb detected: entry "${file.name}" has a compression ratio of ` +
                    `${entryRatio.toFixed(1)}:1, which exceeds the limit of ${MAX_COMPRESSION_RATIO}:1.`);
            }
        }
        totalUncompressedBytes += uncompressedSize;
    }
    // Overall ratio: catches distributed bombs spread across many entries.
    if (arrayBuffer.byteLength > 0) {
        const overallRatio = totalUncompressedBytes / arrayBuffer.byteLength;
        if (overallRatio > MAX_COMPRESSION_RATIO) {
            throw new Error(`Zip bomb detected: overall compression ratio of ${overallRatio.toFixed(1)}:1 ` +
                `exceeds the limit of ${MAX_COMPRESSION_RATIO}:1.`);
        }
    }
    // ── 3. Entry-count gate ──────────────────────────────────────────────────
    if (entries.length > MAX_ZIP_ENTRIES) {
        throw new Error(`Archive contains too many entries: ${entries.length} exceeds ` +
            `the limit of ${MAX_ZIP_ENTRIES}.`);
    }
    // ── 4. Total uncompressed size gate (memory ceiling) ─────────────────────
    if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        throw new Error(`Archive total uncompressed size of ${totalUncompressedBytes} bytes exceeds ` +
            `the limit of ${MAX_TOTAL_UNCOMPRESSED_BYTES} bytes.`);
    }
    return zip;
}
//# sourceMappingURL=zip-guard.js.map