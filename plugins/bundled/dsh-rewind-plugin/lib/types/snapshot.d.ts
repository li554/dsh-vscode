/**
 * Checkpoint store — the file-rewind backing for dsh-rewind.
 *
 * Each user message gets one dense manifest (`Checkpoint.files`) describing
 * every tracked path's state when that message's step began. Content bytes
 * live in shared version files; the manifest only holds references. A rewind
 * reads the target message's manifest, takes the earliest later row for a path
 * first tracked after the target (the v1 fallback), reconciles it against the
 * live disk, and applies only the differences with a per-file atomic replace
 * or delete.
 *
 * All mutations run under a per-session promise lock. The newest 100 manifests
 * are retained; versions referenced by none of them are deleted after each new
 * checkpoint and on load. Old per-call snapshot layouts are never read: their
 * members are only counted by whole-session cleanup and removed with the
 * entire session directory.
 *
 * @module dsh-rewind/snapshot
 */
import { type ClearSessionReport, type FileImpact, type PruneStaleReport, type RestoreOutcome, type UncoveredPath } from './snapshot-format.ts';
export { CURRENT_STORE_VERSION, UnknownStoreVersionError, type Checkpoint, type ClearSessionReport, type FileImpact, type FileState, type PlannedAction, type PruneStaleReport, type RestoreOutcome, type SkippedPath, type UncoveredPath, } from './snapshot-format.ts';
/**
 * A regular file larger than this is NOT versioned. The cap keeps one oversized
 * file from dominating the store: an over-cap state produces no new version, and
 * a restore skips it while it stays over the cap. Exposed as the `maxFileBytes`
 * config field (`0` disables it).
 */
export declare const DEFAULT_MAX_FILE_BYTES: number;
/** Newest checkpoints kept per session (also the rewind candidate window). */
export declare const RETAINED_CHECKPOINTS = 100;
/** Test-only seams; the production constructor never sets them. */
export interface CheckpointStoreHooks {
    /** Runs after the restore temp file is complete, before its rename. */
    readonly beforeRestoreRename?: () => void | Promise<void>;
}
/** The session facts loading needs; kept structural so the store stays host-free. */
export interface StoreSession {
    readonly id: string;
    /** DSH session format (`session.header.version`). */
    readonly version: number;
    /** Every `user/message` id currently in the session log. */
    readonly messageIds: readonly string[];
}
/** Options for {@link SnapshotStore}. */
export interface SnapshotStoreOptions {
    readonly dshHome?: string;
    /** Per-file cap in bytes; `<= 0` disables it. */
    readonly maxFileBytes?: number;
    /** Test-only seams. */
    readonly testHooks?: CheckpointStoreHooks;
}
/** On-disk checkpoint store. Every write goes through `node:fs`. */
export declare class SnapshotStore {
    /** Resolved store root (absolute). */
    readonly root: string;
    private readonly maxFileBytes;
    private readonly hooks;
    private readonly sessions;
    private readonly legacyWarned;
    constructor(root?: string, opts?: SnapshotStoreOptions);
    /** Absolute path of one session's store directory. */
    sessionDir(sessionId: string): string;
    /** True when `size` is over the per-file cap. */
    isOverFileCap(size: number | undefined): boolean;
    /** The cap in force, for reporting (0 = unlimited). */
    get fileCapBytes(): number;
    /** Whether this store has already loaded `sessionId`. */
    isLoaded(sessionId: string): boolean;
    /** True when a path exists on disk. */
    exists(path: string): Promise<boolean>;
    /**
     * Load (or reload) one session: read meta, drop corrupt/orphan manifests,
     * retain the newest 100, and GC. Returns one-time warnings for the caller to
     * log. A newer store sets the session unavailable instead of throwing.
     */
    loadSession(session: StoreSession, opts?: {
        readonly force?: boolean;
    }): Promise<{
        warnings: string[];
    }>;
    /**
     * Create one dense checkpoint per user message in `messageIds`, all with the
     * same pre-step file states and increasing times; the last becomes current.
     * Returns per-file warnings; the caller logs them without blocking the step.
     */
    createCheckpoints(sessionId: string, sessionVersion: number, messageIds: readonly string[]): Promise<{
        warnings: string[];
    }>;
    /**
     * Drop the current checkpoint reference without touching disk. Used when a
     * step's batch could not be checkpointed: first touches in the rest of that
     * turn are skipped instead of landing in the previous message's manifest.
     */
    abandonCurrent(sessionId: string): Promise<void>;
    /**
     * Record the pre-touch state of a path the current step has not seen yet.
     * A missing current checkpoint means the plugin mounted mid-turn: skip, so
     * later rows can never migrate into the previous message's manifest.
     */
    captureFirstTouch(sessionId: string, path: string): Promise<{
        recorded: boolean;
        warnings: string[];
    }>;
    /**
     * Compute one target's preview in a single plan pass: the actions that would
     * change the disk and the tracked paths currently over the per-file cap.
     */
    preview(sessionId: string, messageId: string): Promise<{
        readonly files: readonly FileImpact[];
        readonly uncovered: readonly UncoveredPath[];
    }>;
    /** Restore the workspace to one message's checkpoint. */
    restoreAfter(sessionId: string, messageId: string): Promise<RestoreOutcome>;
    /** Read the store format marker, or `null` when absent/unreadable. */
    readStoreVersion(sessionId: string): Promise<number | null>;
    /** Remove one session's entire directory and reset its in-memory state. */
    clearSession(sessionId: string, opts?: {
        readonly dryRun?: boolean;
    }): Promise<ClearSessionReport>;
    /** Remove idle session directories, keeping the active one. */
    pruneStale(opts: {
        readonly keepActiveId?: string;
        readonly maxAgeDays: number;
        readonly dryRun?: boolean;
    }): Promise<PruneStaleReport>;
    /**
     * Number of snapshots in one session directory for the clear report: current
     * manifests plus legacy per-call entry JSONs (whole-session cleanup reports
     * everything it removes). Legacy members are counted by name only; their
     * contents are never read.
     */
    private countCheckpoints;
    /** Store directories for one session. */
    private checkpointsDir;
    private versionsDir;
    /** Create the per-session meta file at the first checkpoint. */
    private ensureMeta;
    /** Re-read every tracked path for one new message boundary. */
    private scanFiles;
    /** Reconcile one path's recorded row against the live disk. */
    private recheckRow;
    /** `(size, mtime)` fast path, then a streaming byte compare. */
    private contentUnchanged;
    /** Copy current bytes into a version file (temp + rename). */
    private writeVersion;
    /** Compute the restore plan while holding the session lock. */
    private planLocked;
    /** Earliest retained row containing `path` strictly after `time`. */
    private firstRowAfter;
    /** Atomically replace one target with a version file. */
    private applyRestore;
    /** Load one session's retained manifests and GC. */
    private loadLocked;
    /** True when a legacy per-call snapshot member is present. */
    private hasLegacyMembers;
    /** Delete only the new storage; legacy members are left untouched. */
    private discardNewStorage;
    /** Keep the newest {@link RETAINED_CHECKPOINTS} manifests in memory. */
    private trimRetained;
    /** Delete unreferenced versions and non-retained manifests. */
    private gc;
    /** Drop in-memory state after a clear or a removed directory. */
    private resetState;
    /** Drop state for sessions whose directory disappeared out of band. */
    private forgetMissingSessions;
    /** Throw the stored unavailable error, if any. */
    private assertUsable;
    /** Run `fn` after every earlier mutation of this session. */
    private withLock;
    private stateOf;
}
