/** SHA-256 hex digest of a string or byte buffer. */
export declare function sha256Hex(data: string | Uint8Array): string;
/** Fixed-length prefix of the SHA-256 digest (default 8 hex chars). */
export declare function sha256Short(data: string | Uint8Array, length?: number): string;
/**
 * Canonical JSON: object keys sorted recursively, arrays in order, JSON-safe
 * primitives only. Values that are not JSON-representable (functions,
 * undefined, symbols) are omitted from objects and replaced by null in arrays.
 */
export declare function canonicalJson(value: unknown): string;
/** Stable JSON text of a value (sorted keys, two-space indent, trailing newline). */
export declare function prettyJson(value: unknown): string;
