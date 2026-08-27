/**
 * Pet registry — the multi-pet contract. One pet is a directory holding a
 * 'pet.json' manifest plus an atlas image; nothing else is required, and no
 * host or client code changes when a pet is added. The registry scans four
 * sources, later sources overriding earlier ones on an id collision:
 *
 *   1. the package's own 'assets' subdirectories (built-in pets);
 *   2. '${CODEX_HOME:-~/.codex}/pets' subdirectories (hatch-pet custom pets,
 *      legacy source kept readable);
 *   3. '$DSH_HOME/pets' subdirectories (the pet-center user directory);
 *   4. 'PetConfig.pets' manifests composed by the embedding application
 *      (highest precedence).
 *
 * Manifests are parsed through manifest-v2 (pet-center M2, issue #623): v1
 * manifests are compat-read as sprite2d, v2 manifests validate fail-closed,
 * and structured diagnostics ride alongside the legacy warnings. Live2d
 * entries (pet-center M3) list like any other pet: the entry carries the
 * validated live2d block plus the model's reference closure (the servable
 * set the asset route allows), and a model3.json that is unreadable or
 * declares unsafe references rejects the entry with an error diagnostic.
 *
 * The manifest follows the Codex/hatch-pet contract (8 columns x 9 rows of
 * 192x208 cells, the 9-state row order below). Legacy whale-girl manifests
 * that only carry 'frames' keep working: geometry, per-row frame counts and
 * per-track rhythm all fall back to the hatch-pet contract defaults, and the
 * whale-girl manifest overrides its own durations.
 * @module @linxin666/dsh-pet/registry
 */
import type { ActivityPhase, PetAnimation } from './state.ts';
import { type PetRemarks, type PetRemarksManifest } from './remarks.ts';
import { type PetPanelView, type VoicePack } from './voice-pack.ts';
import { type DecorationView } from './contracts/status-decoration.ts';
import { type PetRendererKind } from './manifest-v2.ts';
/** Fixed row order of the 9-state animation contract. */
export declare const PET_ROW_ORDER: readonly PetAnimation[];
/** Atlas cell size in px. */
export interface PetCell {
    width: number;
    height: number;
}
/** Atlas cell size in px (Codex/hatch-pet contract). */
export declare const DEFAULT_PET_CELL: PetCell;
/** Columns per row (max frames per track). */
export declare const DEFAULT_PET_COLUMNS = 8;
/** Rows in the atlas (fixed by the animation contract). */
export declare const DEFAULT_PET_ROW_COUNT = 9;
/**
 * Per-row used-column counts from the hatch-pet contract table. Manifests
 * that carry no 'frames' field (the Codex custom-pet shape) resolve here.
 */
export declare const DEFAULT_FRAME_COUNTS: readonly number[];
/** Absolute package root, resolved from a module URL (lib/ or src/). */
export declare function petPackageRoot(importMetaUrl: string): string;
/** Resolve the hatch-pet custom pets directory (CODEX_HOME or ~/.codex). */
export declare function codexPetsDir(env?: NodeJS.ProcessEnv, home?: string): string;
/** One animation track as served to the browser half. */
export interface PetTrackDef {
    /** Frame indices (columns) played in order. */
    frames: number[];
    /** Per-frame duration in ms; same length as frames. */
    durations: number[];
    /** Whether the track loops; a non-looping track holds its last frame. */
    loop: boolean;
    /** Track to switch to after a non-looping track finishes. */
    fallback?: PetAnimation;
}
/**
 * Default per-track rhythm — the shared slow baseline every sprite2d pet
 * plays unless its manifest overrides a track (user request: all pets were
 * too fast at the legacy hatch-pet contract pace).
 */
export declare const DEFAULT_TRACK_PATTERNS: Record<PetAnimation, {
    durations: number[];
    loop: boolean;
    fallback?: PetAnimation;
}>;
/** Manifest shape a pet directory (or 'PetConfig.pets' entry) declares. */
export interface PetManifest {
    /** Unique pet id, lowercase kebab-case. */
    id: string;
    /** Human-readable display name (settings selector, panel header). */
    displayName: string;
    /** One-line description. */
    description?: string;
    /** Atlas path relative to the manifest's directory. */
    spritesheetPath: string;
    /** Atlas cell size; defaults to the Codex contract 192x208. */
    cell?: {
        width?: number;
        height?: number;
    };
    /** Columns per row; defaults to 8. */
    columns?: number;
    /**
     * Per-row frame counts (9 entries, row order above). Manifests that omit
     * it resolve the hatch-pet contract table.
     */
    frames?: number[];
    /** Optional per-track rhythm overrides; omitted tracks use the defaults. */
    tracks?: Partial<Record<PetAnimation, PetTrackOverride>>;
    /** Optional per-scene track sequences; every declared sequence has at least 5 items. */
    sequences?: Partial<Record<ActivityPhase, PetAnimation[]>>;
    /**
     * Optional witty-remark overrides the pet speaks on interactions
     * (community contributions use this to give their pet its own voice).
     * Each slot accepts one line or a pool of lines; a slot replaces the
     * built-in default pool for that slot only.
     */
    remarks?: PetRemarksManifest;
}
/** Per-track rhythm overrides a manifest may carry. */
export interface PetTrackOverride {
    /** Per-frame durations in ms (cycled to the row's frame count). */
    durations?: number[];
    /** Whether the track loops. */
    loop?: boolean;
    /** Track to switch to after a non-looping track finishes. */
    fallback?: PetAnimation;
}
/** The live2d renderer block as served to the browser half (pet-center M3). */
export interface PetLive2dDefinition {
    /** Browser URL of the .model3.json (served by the host asset route). */
    modelUrl: string;
    /** Manifest-relative model path (host route allow-list key). */
    modelPath: string;
    /** Scale multiplier over the canvas auto-fit, (0, 10]. */
    scale?: number;
    /** Model offset in canvas px from the center-bottom anchor. */
    translate?: {
        x?: number;
        y?: number;
    };
    /** ActivityPhase -> motion group; unmapped phases fall back to idle. */
    motions: Partial<Record<ActivityPhase, string>> & {
        idle: string;
    };
    /** Optional ActivityPhase -> expression name layered over the motion. */
    expressions?: Partial<Record<ActivityPhase, string>>;
    /** Hit area names triggering the tap motion; defaults to every model HitArea. */
    hitAreas?: string[];
}
/** A normalized pet as served to the browser half. */
export interface PetDefinition {
    id: string;
    displayName: string;
    description: string;
    /** The renderer this entry mounts with (pet-center M2). */
    renderer: PetRendererKind;
    /** Live2d render block; present exactly when renderer is 'live2d' (M3). */
    live2d?: PetLive2dDefinition;
    /** Atlas cell size in px. */
    cell: PetCell;
    /** Columns per row. */
    columns: number;
    /** Per-row frame counts (length 9, row order above). */
    rows: number[];
    /** Total atlas rows (9 for v1, 11 for v2 look-row atlases). */
    atlasRows: number;
    /** Fully resolved animation tracks (frames + durations + loop/fallback). */
    tracks: Record<PetAnimation, PetTrackDef>;
    /** Validated per-scene track sequences; omitted scenes keep single-track playback. */
    sequences?: Partial<Record<ActivityPhase, PetAnimation[]>>;
    /** Browser URL of the atlas (served by the host asset route). */
    atlasUrl: string;
    /** Browser URL of the manifest (served by the host asset route). */
    manifestUrl: string;
    /** Hover-panel chrome overrides (voice.json 'panel'; pet-center M4). */
    panel?: PetPanelView;
}
/** A resolved pet plus its host-side file location. */
export interface PetEntry extends PetDefinition {
    /** Absolute directory holding the manifest and atlas. */
    dir: string;
    /** Atlas path relative to 'dir' (declared by the manifest). */
    spritesheetPath: string;
    /**
     * Manifest-relative files the asset route may serve beyond pet.json and
     * 'previews/*' (pet-center M3): the sprite2d atlas, or the live2d model
     * plus its model3.json reference closure.
     */
    servable: readonly string[];
    /** Normalized per-pet remark pools (manifest 'remarks'), when declared. */
    remarks?: PetRemarks;
    /**
     * Normalized per-pet voice pack (the directory's voice.json; pet-center
     * M4). Host-side only — the browser half receives its 'panel' slice.
     */
    voice?: VoicePack;
}
/** Registry load result: resolved entries plus load warnings. */
export interface PetRegistry {
    entries: PetEntry[];
    warnings: string[];
    /** Structured diagnostics from the manifest-v2 parse (superset detail of warnings). */
    diagnostics: PetRegistryDiagnostic[];
    byId(id: string): PetEntry | undefined;
    /** The pet an installation falls back to when the selection is unknown. */
    defaultEntry(): PetEntry;
    /**
     * The global voice override ('$DSH_HOME/pets/.voice.json'), when present —
     * layers under every per-pet pack and over the built-in pools (M4, #677).
     */
    globalVoice?: VoicePack;
    /**
     * Status decorations (pet-center M5, #567): built-in 'assets/decorations'
     * entries overridden by same-id user entries under
     * '$DSH_HOME/pets/decorations'. Independent of the pet entries. Optional
     * so prebuilt test registries without decorations keep compiling.
     */
    decorations?: DecorationEntry[];
    /** Look up one decoration by id. */
    decorationById?(id: string): DecorationEntry | undefined;
}
/** One resolved status decoration plus its host-side file location. */
export interface DecorationEntry extends DecorationView {
    /** Absolute directory holding the descriptor and strip. */
    dir: string;
    /** Strip path relative to 'dir' (declared by the descriptor). */
    entryPath: string;
    /** Descriptor-relative files the decoration asset route may serve. */
    servable: readonly string[];
    /** Asset license identifier (required by the descriptor). */
    license: string;
}
/** One structured registry diagnostic (manifest-v2 era). */
export interface PetRegistryDiagnostic {
    level: 'error' | 'warning';
    /** Where the diagnostic originates (directory or file). */
    source: string;
    message: string;
}
/** Registry sources. */
export interface PetRegistryOptions {
    /** Absolute package root whose 'assets/*' hold built-in pets. */
    packageRoot: string;
    /** Asset route prefix the browser URLs are built under. */
    assetPrefix?: string;
    /** Custom pet directory (defaults to '${CODEX_HOME:-~/.codex}/pets'). */
    petsDir?: string;
    /** Pet-center user directory (defaults to '$DSH_HOME/pets'; '' disables). */
    dshPetsDir?: string;
    /** Extra manifest entries composed by the embedding application. */
    extra?: readonly PetManifest[];
}
/**
 * Normalize one parsed manifest into a renderable pet entry, or undefined
 * (with a warning recorded) when the manifest violates the contract.
 */
export declare function resolvePetManifest(raw: unknown, dir: string, options?: {
    assetPrefix?: string;
    warnings?: string[];
}): PetEntry | undefined;
/**
 * Scan-time read ceiling for user-authored JSON descriptors (voice.json,
 * .voice.json, decoration.json): the registry reads these synchronously at
 * plugin startup, and a pathological file — multi-GB, or a FIFO/device
 * symlink — must not hang or exhaust the host before the warn-and-drop
 * discipline can apply (review-spd follow-up, pet-center M4/M5).
 */
export declare const PET_SCAN_JSON_CAP: number;
/**
 * Scan-time read ceiling for a live2d model3.json, matching the asset
 * route's model cap (PET_ASSET_CAPS.model). Model descriptors are far
 * larger than the other scanned JSON, but a pathological file — huge, or a
 * FIFO/device — must still be skipped with a warning instead of stalling
 * or OOM-ing the host at plugin startup (same review-spd follow-up).
 */
export declare const PET_SCAN_LIVE2D_MODEL_CAP: number;
/** Decoration asset URL prefix (served by the decoration route, M5). */
export declare const DECORATION_ASSET_PREFIX = "/api/pet/decoration";
/**
 * Load the pet registry: built-in 'assets/*' first, then the hatch-pet
 * custom pets directory, then composed 'extra' manifests (each later source
 * overrides an earlier one on id collision). The registry never throws on a
 * bad manifest: it skips it and records a warning.
 */
export declare function loadPetRegistry(options: PetRegistryOptions): PetRegistry;
/** The built-in default decoration id (M5): the first reference ornament. */
export declare const DEFAULT_DECORATION_ID = "whale";
/** Strip host-only fields, leaving the browser-visible decoration view. */
export declare function decorationView(entry: DecorationEntry): DecorationView;
/**
 * Strip host-only fields, leaving the client-visible definition. When the
 * registry carries a global voice pack, its panel chrome layers under the
 * entry's own pack (per-slot merge, pet > global), mirroring the voice-pool
 * layering (pet-center M4, issue #677).
 */
export declare function petEntryView(entry: PetEntry, globalVoice?: VoicePack): PetDefinition;
/** The absolute file a pet's atlas resolves to (host asset route). */
export declare function petAtlasFile(entry: PetEntry): string;
//# sourceMappingURL=registry.d.ts.map