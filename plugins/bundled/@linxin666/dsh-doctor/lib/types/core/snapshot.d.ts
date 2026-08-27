import type { FsLike } from './fs.ts';
import type { RedactionResult, SnapshotDump, SnapshotManifest } from './types.ts';
export interface SnapshotDeps {
    fs: FsLike;
    /** Resolved harness home of the captured profile. */
    home: string;
    profile: string;
    /** Profile directory to capture. */
    profileDir: string;
    /** Destination snapshot directory. */
    snapshotDir: string;
    /** ISO timestamp provider. */
    now(): string;
    /** Redact text for file copies and fingerprints. */
    redactTexts(text: string): RedactionResult;
    /** Optional dsh version tag recorded in the manifest. */
    dshVersion?: string;
    /** Optional engine state captured alongside (inventory, gate reports). */
    state?: unknown;
    /** Optional config dumps captured by the caller. */
    dumps?: SnapshotDump[];
    /** Directory names excluded at any depth (default node_modules, .git, .pnpm). */
    excludeDirs?: string[];
    /** Files larger than this are recorded but not stored (default 1 MiB). */
    maxFileBytes?: number;
}
/** Recursively list files under dir, sorted by path, skipping exclude dirs. */
export declare function listProfileFiles(fs: FsLike, dir: string, excludeDirs: string[]): Promise<{
    path: string;
    rel: string;
}[]>;
/** Capture one profile snapshot and write the manifest. */
export declare function captureSnapshot(deps: SnapshotDeps): Promise<SnapshotManifest>;
export interface SnapshotVerifyResult {
    ok: boolean;
    snapshotId?: string;
    mismatches: {
        path: string;
        expected: string;
        actual: string;
    }[];
    missing: string[];
}
/** Re-hash every stored file and compare against the manifest. */
export declare function verifySnapshot(fs: FsLike, snapshotDir: string): Promise<SnapshotVerifyResult>;
/** Restore stored files into a target directory (never escapes it). */
export declare function restoreSnapshot(fs: FsLike, snapshotDir: string, targetDir: string): Promise<{
    restored: number;
    skipped: string[];
}>;
