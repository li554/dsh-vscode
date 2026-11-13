/**
 * Filesystem primitives for the checkpoint store.
 *
 * Every operation that can touch the real filesystem lives here: atomic JSON
 * writes (temp + rename), streaming byte comparisons (never a whole file in
 * memory), the location pin that keeps a restore inside the directory it
 * recorded, and the rejection of links and non-regular targets. Nothing here
 * holds state; the store passes in what it needs.
 *
 * @module dsh-rewind/snapshot-fs
 */
/** Streaming byte equality of two files (never loads either one whole). */
export declare function sameFileBytes(aPath: string, bPath: string): Promise<boolean>;
/** True when the error means "the path does not exist". */
export declare function isEnoent(error: unknown): boolean;
/**
 * Atomic JSON write: serialize to a sibling temp file, then rename over the
 * target. A crash between the two steps leaves only an inert temp — never a
 * readable half-written target — and rename is atomic, so readers always see
 * the old file or the complete new one. The temp name is deterministic
 * (`<target>.tmp`): a crash leftover is overwritten by the next write and is
 * never picked up by readers. `afterTempWrite` is a test-only seam between the
 * steps.
 */
export declare function writeJsonAtomic(file: string, data: unknown, afterTempWrite?: () => void): Promise<void>;
/** Recursive byte total of a directory tree (never follows symlinks). */
export declare function dirBytes(dir: string): Promise<number>;
/**
 * True when the path is not a single regular file: a symlink, a hard link
 * (`nlink > 1`), a directory, a FIFO or a device. None is ever written,
 * created or read through on restore — a symlink redirects the operation, a
 * hard link clobbers every other name of the inode (e.g. pnpm-installed
 * files), and a FIFO or device either blocks the read or streams forever.
 */
export declare function isUnsafeTarget(path: string): Promise<boolean>;
/**
 * Where `path`'s directory resolved when the row was captured — the location
 * pin. A directory that does not exist (or does not exist any more) pins where
 * it WOULD resolve: the `realpath` of its nearest surviving ancestor plus the
 * missing segments. A link created there later therefore cannot pass as the
 * same location. Undefined only when nothing at all resolves.
 */
export declare function locationPin(path: string): Promise<string | undefined>;
/**
 * True when `path`'s parent directory still resolves where it did at capture
 * time (`recorded`, the location pin). Only the path's FINAL component is
 * checked for links and non-regular files (see {@link isUnsafeTarget});
 * without this a repointed ancestor directory would redirect a restore — or,
 * worse, an unlink — outside the recorded location.
 *
 * `undefined` means "no pin": this build never writes such a row, so the
 * caller must treat it as untrusted and skip the path.
 *
 * - the parent resolves to the pinned location → true. A STABLE symlinked
 *   ancestor resolves identically on both sides (the pin is a `realpath`), so
 *   a symlinked workspace root is never a false skip;
 * - the parent resolves elsewhere → false;
 * - the parent chain is gone → true only while the nearest surviving ancestor
 *   still resolves INSIDE the pinned location, which keeps "recreate a deleted
 *   parent directory" working without following a repointed ancestor;
 * - anything undecidable (a link loop, an unreadable component) → false:
 *   refuse rather than write into a location that cannot be verified.
 */
export declare function parentStillMatches(path: string, recorded: string | undefined): Promise<boolean>;
/**
 * Walk one directory tree and compute the total size (regular files only) and
 * the newest stamp (max `lstat.mtimeMs` over every member, directories
 * included). `lstat` never follows a symlink, so a hostile symlink inside the
 * store cannot escape the root or inflate the measurement; a symlink is
 * counted as one file's own metadata and not descended into. Atomic-write
 * temp leftovers are skipped; every other member (including legacy snapshot
 * members) counts toward the session's footprint and activity.
 */
export declare function dirSizeAndLastActive(dir: string): Promise<{
    size: number;
    lastActiveMs: number;
}>;
