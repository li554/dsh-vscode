/**
 * Status-decoration manifest v1 — fail-closed structure + warn-and-drop
 * content, mirroring the pet manifest-v2 discipline (issue #623 M5,
 * protocol #567). Unknown top-level fields, unsafe entry paths, out-of-
 * range geometry and unknown renderer content reject the descriptor with
 * human-readable diagnostics; per-phase binding issues drop that binding
 * only. The JSON Schema twin lives at
 * contracts/status-decoration-v1.schema.json; this hand-rolled parser is
 * authoritative. Keep this file erasable-syntax-only (scripts/ import it
 * under node's strip-only mode).
 * @module @linxin666/dsh-pet/decoration
 */
import type { DecorationManifestParse } from './contracts/status-decoration.ts';
/** Geometry and content caps (the adopted PNG/WebP sprite-strip bounds). */
export declare const DECORATION_CELL_MAX = 256;
export declare const DECORATION_COLUMNS_MAX = 16;
export declare const DECORATION_DURATION_MAX_MS = 2000;
export declare const DECORATION_ENTRY_EXTENSIONS: readonly [".webp", ".png"];
export declare const DECORATION_DISPLAY_NAME_MAX = 64;
/** Field allow-list (drift-locked to the schema twin in tests). */
export declare const KNOWN_DECORATION_TOP_LEVEL: Set<string>;
/**
 * Validate a descriptor-relative entry path: no absolute paths, no
 * backslashes, no traversal, plain safe segments only, and an exact
 * lowercase PNG/WebP extension (the adopted entry discipline — SVG/CSS are
 * not accepted). The extension match is case-sensitive on purpose: the
 * asset route serves the declared path verbatim, so a case-mismatched
 * suffix (frames.PNG vs frames.png) would pass a lenient check but 403 on
 * case-sensitive filesystems.
 * Returns the normalized path or undefined.
 */
export declare function safeDecorationEntry(raw: unknown): string | undefined;
/**
 * Parse and validate one decoration.json document. Fail-closed over the
 * structure (types, key sets, paths, ranges); phase-binding content issues
 * drop that binding only (warn-and-drop, the registry never-throw rule).
 */
export declare function parseDecorationManifest(raw: unknown, source?: string): DecorationManifestParse;
//# sourceMappingURL=decoration.d.ts.map