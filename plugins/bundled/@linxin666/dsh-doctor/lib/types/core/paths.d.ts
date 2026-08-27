import type { FsLike } from './fs.ts';
/** Error for unsafe relative paths and engine segments. */
export declare class PathError extends Error {
    readonly value: string;
    constructor(value: string, reason: string);
}
/** The profiles directory under a harness home. */
export declare function profilesDir(home: string): string;
/** Resolve one profile directory (validates the name). */
export declare function resolveProfileDir(home: string, name: string): string;
/** The DSH-managed flat module fallback directory (symlink closure). */
export declare function profilesNodeModulesDir(home: string): string;
/** Resolve the capsule root under a harness home. */
export declare function doctorRoot(home: string): string;
/** Resolve the quarantine root under a harness home. */
export declare function quarantineDir(home: string): string;
/** Resolve the staging root (same filesystem as profiles, rename(2)-safe). */
export declare function stagingDir(home: string): string;
/** Resolve the capsule work root under a harness home. */
export declare function workDir(home: string): string;
/** Resolve the capsule logs root under a harness home. */
export declare function logsDir(home: string): string;
/** Resolve the capsule lock root under a harness home. */
export declare function locksDir(home: string): string;
/** Resolve the capsule snapshots root under a harness home. */
export declare function snapshotsDir(home: string): string;
/** Resolve the capsule journal file under a harness home. */
export declare function journalPath(home: string): string;
/**
 * Validate a profile-relative file path: no absolute paths, no backslashes,
 * no '..' segments. Returns the normalized relative path.
 */
export declare function safeRelativePath(value: string, label?: string): string;
/** Whether a child path stays strictly inside a parent path. */
export declare function isInside(child: string, parent: string): boolean;
/** Directory segment every snapshot/transaction id must satisfy. */
export declare const TXN_SEGMENT_RE: RegExp;
/** Validate an engine-generated directory segment (txn id, snapshot id). */
export declare function validateSegment(value: string, label: string): string;
/** Build a deterministic snapshot id from a profile name, timestamp, digest. */
export declare function makeSnapshotId(profile: string, tsCompact: string, content: string): string;
/**
 * Enumerate profile directories under a home.
 *
 * Only real directories are reported; every other entry (files, symlinks,
 * invalid names, the module-fallback node_modules dir) is collected in
 * `ignored` with a stable reason so discovery never silently drops state.
 */
export declare function discoverProfiles(fs: FsLike, home: string): Promise<{
    profiles: string[];
    ignored: {
        name: string;
        reason: string;
    }[];
}>;
