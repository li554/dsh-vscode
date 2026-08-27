import type { FsLike } from './fs.ts';
import type { ManifestFacts } from './types.ts';
export declare class ManifestError extends Error {
    readonly path: string;
    constructor(message: string, path: string);
}
/** Standard profile file names inside a profile directory. */
export declare const PROFILE_PATCH_FILENAME = "cordis.patch.yml";
export declare const PROFILE_ROOT_FILENAME = "cordis.yml";
export declare const PROFILE_WORKSPACE_FILENAME = "pnpm-workspace.yaml";
export declare const PROFILE_LOCKFILE_FILENAME = "pnpm-lock.yaml";
export declare const PROFILE_SETTINGS_FILENAME = "settings.yaml";
/** Parse and validate a profile manifest text. */
export declare function parseProfileManifest(text: string, path: string): {
    facts: ManifestFacts;
    error?: string;
};
/** Read and parse the manifest of one profile directory. */
export declare function readProfileManifest(fs: FsLike, dir: string): Promise<{
    facts: ManifestFacts;
    text: string;
    error?: string;
}>;
/** Serialize a manifest back in the DSH-writer format (2-space + newline). */
export declare function writeProfileManifestJson(manifest: Record<string, unknown>): string;
/**
 * Apply structured edits to a manifest JSON text without touching other
 * fields. Paths are dotted (dsh.profile.bundles). Returns the new text and
 * whether anything changed.
 */
export declare function editManifestJson(text: string, edits: {
    set?: Record<string, unknown>;
    remove?: string[];
}): {
    text: string;
    changed: boolean;
};
