/**
 * Minimal filesystem abstraction used by every dsh-doctor core module.
 *
 * The interface deliberately covers only the operations the repair engine
 * needs, so that:
 * - the real implementation (nodeFs) is a thin wrapper over node:fs/promises,
 * - tests can run against an in-memory tree (memoryFs) with equivalent error
 *   semantics (ENOENT, EEXIST, ENOTDIR, EISDIR, ENOTEMPTY, EINVAL, ELOOP),
 * - every stateful module takes an injected FsLike and never touches
 *   node:fs directly.
 */
export interface StatInfo {
    kind: 'file' | 'dir' | 'link' | 'other';
    size: number;
    mtimeMs: number;
    dev: number;
    ino: number;
}
export interface DirEntryInfo {
    name: string;
    kind: 'file' | 'dir' | 'link' | 'other';
}
export interface FsLike {
    readText(path: string): Promise<string>;
    readBytes(path: string): Promise<Uint8Array>;
    writeText(path: string, text: string): Promise<void>;
    writeBytes(path: string, data: Uint8Array): Promise<void>;
    exists(path: string): Promise<boolean>;
    /** Follow symlinks in every path component, including the final one. */
    stat(path: string): Promise<StatInfo>;
    /** Do not follow a final symlink; intermediate components are still followed. */
    lstat(path: string): Promise<StatInfo>;
    readlink(path: string): Promise<string>;
    symlink(target: string, path: string): Promise<void>;
    mkdir(path: string, opts?: {
        recursive?: boolean;
    }): Promise<void>;
    /** Entries are returned sorted by name for deterministic iteration. */
    readdir(path: string): Promise<DirEntryInfo[]>;
    rename(from: string, to: string): Promise<void>;
    unlink(path: string): Promise<void>;
    /** Remove a file, symlink, or (with recursive) a directory tree. */
    remove(path: string, opts?: {
        recursive?: boolean;
    }): Promise<void>;
}
/** Error carrying a stable filesystem error code (ENOENT, EEXIST, ...). */
export declare class FsError extends Error {
    readonly code: string;
    readonly path: string;
    constructor(code: string, path: string, detail?: string);
}
/** Real filesystem backed by node:fs/promises. */
export declare const nodeFs: FsLike;
/**
 * In-memory FsLike for tests and for dry-run candidate staging.
 *
 * Paths are POSIX-style absolute strings. Directory entries are sorted by
 * name on readdir. Symlinks store their raw target; relative targets are
 * resolved against the link's parent directory. Intermediate path components
 * are followed, and a final component is followed only by stat (mirroring
 * node semantics closely enough for the engine's needs).
 */
export declare function createMemoryFs(): FsLike;
/** Type guard: whether a FsLike is the in-memory implementation. */
export declare function isMemoryFs(fs: FsLike): boolean;
export declare function parentDir(path: string): string;
/** Recursively copy a directory tree without following symlinks. */
export declare function copyTree(fs: FsLike, from: string, to: string): Promise<void>;
/**
 * Move a path across possibly different devices: rename first, then
 * copy+remove when the rename fails with EXDEV (works with both FsError and
 * raw node errors).
 */
export declare function movePath(fs: FsLike, from: string, to: string): Promise<{
    copied: boolean;
}>;
