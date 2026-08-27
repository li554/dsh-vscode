/**
 * Pet persistence — tiny JSON store for affinity + display config, written
 * under $DSH_HOME (defaults to ~/.dsh) as `pet.json`. Deliberately minimal:
 * one file, atomic rename write, tolerant read (corrupt file → defaults).
 * @module @linxin666/dsh-pet/persist
 */
import { type AffinityState } from './affinity.ts';
import { type TreatLedger } from './treats.ts';
/** Display configuration the user can tweak. */
export interface PetDisplayConfig {
    /** Master switch. */
    visible: boolean;
    /** Scale of the rendered pet in px (sprite cell height). */
    size: number;
    /** Horizontal inset from the viewport right edge, px. */
    right: number;
    /** Vertical inset from the viewport bottom edge, px. */
    bottom: number;
}
export declare const defaultDisplayConfig: PetDisplayConfig;
/** Display value bounds (shared by load-time validation and setConfig). */
export declare const DISPLAY_SIZE_MIN = 32;
export declare const DISPLAY_SIZE_MAX = 512;
export declare const DISPLAY_INSET_MAX = 10000;
/** Everything persisted for the pet. */
export interface PetPersist {
    /** Selected pet id (a registry entry; clamped at service startup). */
    petId: string;
    /**
     * Per-pet display names keyed by pet id. A pet without an entry falls back
     * to its manifest displayName, so only user renames are stored here.
     */
    names: Record<string, string>;
    affinity: AffinityState;
    /** Treat (小鱼干) stock ledger. */
    treats: TreatLedger;
    display: PetDisplayConfig;
}
/** Pet id the legacy single-pet installs resolve to on migration. */
export declare const DEFAULT_PET_ID = "whale-girl";
/** Default pet name (used only when a manifest carries no displayName). */
export declare const DEFAULT_PET_NAME = "\u9CB8\u9C7C\u5A18";
/** Name constraints. */
export declare const PET_NAME_MAX_LENGTH = 20;
export declare function emptyPersist(): PetPersist;
/**
 * Resolve the persistence directory ($DSH_HOME or ~/.dsh). Delegates to the
 * shared {@link dshHome} resolution so the plugin family keeps one DSH_HOME
 * definition (env override, ~ expansion, cwd-joined relative values).
 */
export declare function petHomeDir(): string;
/** Load persisted state; missing or corrupt files fall back to defaults. */
export declare function loadPetPersist(dir?: string): PetPersist;
/** Atomically persist state (write temp + rename). */
export declare function savePetPersist(data: PetPersist, dir?: string): void;
//# sourceMappingURL=persist.d.ts.map