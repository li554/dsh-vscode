/**
 * Pet manifest v2 — parsing, fail-closed validation, and the v1 compat read
 * (issue #623, milestone M1/M2). This module is the single entry point every
 * manifest parse flows through: manifests without 'petManifestVersion' are
 * compat-read as v1 sprite2d pets (with a migration hint diagnostic), v2
 * manifests are validated fail-closed (unknown top-level keys, unknown
 * renderer kinds, missing conditional blocks and unsafe paths all reject the
 * manifest with human-readable diagnostics).
 *
 * Discipline split: STRUCTURE is fail-closed (types, key sets, paths,
 * required fields); CONTENT stays warn-and-drop (a bad sequence entry drops
 * the entry, never the pet) — matching the registry's long-standing
 * never-throw philosophy. Deep normalization of sequences/remarks stays with
 * the registry's existing normalizers; this module only gates structure.
 *
 * The JSON Schema twin lives at contracts/pet-manifest-v2.schema.json for
 * documentation, the CLI, and external tooling; the hand-rolled validator
 * here is authoritative (the repository ships no schema-validator runtime).
 *
 * This file is imported directly by scripts/ (dsh-pet-migrate-v2) under
 * node's strip-only TypeScript mode: keep it erasable-syntax-only (no
 * parameter properties, enums, or namespaces).
 * @module @linxin666/dsh-pet/manifest-v2
 */
import type { ActivityPhase, PetAnimation } from './state.ts';
/** Schema version this module validates. */
export declare const PET_MANIFEST_V2: 2;
/** Renderer kinds the pet center knows how to dispatch (M1 §2). */
export declare const PET_RENDERER_KINDS: readonly ["sprite2d", "live2d"];
export type PetRendererKind = (typeof PET_RENDERER_KINDS)[number];
/** The seven ActivityPhase semantics (pet-center owned; M1 §1). */
export declare const PET_ACTIVITY_PHASES: readonly ActivityPhase[];
/** sprite2d renderer block (v2 nested shape of the v1 atlas contract). */
export interface PetManifestSprite2d {
    /** Atlas path relative to the manifest directory (safe segments only). */
    spritesheetPath: string;
    /** Atlas cell size in px; defaults resolved by the registry. */
    cell?: {
        width?: number;
        height?: number;
    };
    /** Columns per row; defaults to 8. */
    columns?: number;
    /** Total atlas rows (9 classic; 11 for v2 look-row atlases). */
    atlasRows?: number;
    /** Per-row used frame counts. */
    frames?: number[];
    /** Per-track rhythm overrides (durations/loop/fallback), v1 shape. */
    tracks?: Record<string, unknown>;
}
/** live2d renderer block (Cubism Core is always user-supplied; M1 §0). */
export interface PetManifestLive2d {
    /** Path of the .model3.json relative to the manifest directory. */
    model: string;
    /** Model scale, (0, 10]; defaults to 1. */
    scale?: number;
    /** Model offset in canvas space. */
    translate?: {
        x?: number;
        y?: number;
    };
    /** ActivityPhase -> motion group name; idle is required, unmapped phases fall back to idle. */
    motions: Partial<Record<ActivityPhase, string>> & {
        idle: string;
    };
    /** Optional ActivityPhase -> expression name layered over the motion. */
    expressions?: Partial<Record<ActivityPhase, string>>;
    /** Hit area names triggering pet.interact; defaults to every model HitArea. */
    hitAreas?: string[];
    /** Whisper-paced lip sync (post-M3). */
    lipSync?: boolean;
}
/** Normalized v2 manifest the registry consumes. */
export interface PetManifestV2 {
    petManifestVersion: typeof PET_MANIFEST_V2;
    id: string;
    displayName: string;
    description?: string;
    version?: string;
    author?: string;
    /** Required by v2; v1 compat reads may lack it (warning, not rejection). */
    license?: string;
    homepage?: string;
    renderer: PetRendererKind;
    sprite2d?: PetManifestSprite2d;
    live2d?: PetManifestLive2d;
    sequences?: Partial<Record<ActivityPhase, PetAnimation[]>>;
    /** Pass-through for the registry's remarks normalizer (v1 shape). */
    remarks?: unknown;
}
/** One structured diagnostic emitted while parsing a manifest. */
export interface PetManifestDiagnostic {
    level: 'error' | 'warning';
    message: string;
}
/** Parse outcome: a usable manifest plus diagnostics, or rejection. */
export type PetManifestParse = {
    ok: true;
    manifest: PetManifestV2;
    migrated: 'v1-compat' | undefined;
    diagnostics: PetManifestDiagnostic[];
} | {
    ok: false;
    diagnostics: PetManifestDiagnostic[];
};
/**
 * Field allow-lists mirroring contracts/pet-manifest-v2.schema.json. Exported
 * so the drift test can lock the schema file and this validator together;
 * the CLI reuses parsePetManifest instead of these.
 */
export declare const KNOWN_TOP_LEVEL: Set<string>;
/** sprite2d block field allow-list (drift-locked to the schema file). */
export declare const KNOWN_SPRITE2D: Set<string>;
/** live2d block field allow-list (drift-locked to the schema file). */
export declare const KNOWN_LIVE2D: Set<string>;
/**
 * Validate a manifest-relative asset path: no absolute paths, no backslashes,
 * no traversal, plain safe segments only. Returns the normalized path.
 */
export declare function safeManifestPath(raw: unknown): string | undefined;
/**
 * Parse one pet manifest: v1 (no petManifestVersion) is compat-read as a
 * sprite2d pet with a migration hint; v2 is validated fail-closed. The parse
 * never throws — every failure comes back as structured diagnostics.
 * @param raw - the parsed pet.json value.
 * @param sourceLabel - human-readable origin for diagnostics (dir or file).
 */
export declare function parsePetManifest(raw: unknown, sourceLabel: string): PetManifestParse;
//# sourceMappingURL=manifest-v2.d.ts.map