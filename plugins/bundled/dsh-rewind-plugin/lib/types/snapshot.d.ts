/**
 * Checkpoint store — the Claude Code style file-rewind backing for dsh-rewind.
 *
 * Claude Code's checkpointing (see README) works like this: it creates a
 * BACKUP of a file BEFORE every tracked modification, groups those backups by
 * the user message they belong to (a "checkpoint"), and rewinding to a
 * checkpoint restores every backup recorded at or after it — modified files
 * are written back to their pre-edit content, files created after the target
 * are deleted. This module is the same design, persisted on disk:
 *
 * - `tools/execute` captures the BEFORE state of each tracked write/edit call
 *   (or "created" when the file did not exist) — the capture happens at the
 *   around-dispatch stage, so an approval `ask` short-circuit cannot skip it
 *   and a denied call never records.
 * - The entry is committed to disk at `tools/post-execute` under the turn's
 *   anchor seq: `<root>/<sessionId>/<anchorSeq>/<callId>.json` carries the
 *   metadata, and the before content lives beside it as a RAW BYTE sidecar
 *   (`<callId>.before`, copied with `copyFile`). Content never travels through
 *   a JS string, so binary and non-UTF-8 files round-trip byte-exactly.
 * - Because entries live on disk under the dsh data directory, they survive a
 *   host restart, are bounded (the newest 100 anchor groups per session are
 *   kept), and restores read/write the real file system with plain `node:fs`
 *   — independent of the fs service.
 *
 * Security note: this `node:fs` authority is the DSH host authority every host
 * plugin holds — the model-facing fences constrain the model's tools, not this
 * code. The store stays bounded to the model-touched paths, so excluding a
 * file (e.g. `.env`) is a model-permission concern (see `SECURITY.md`).
 *
 * Crash safety (this module's own engineering asset):
 *  - Checkpoint commits are ATOMIC: the sidecar is fully written first, then
 *    the entry JSON is written to a sibling temp file and renamed over the
 *    target, so a host crash mid-write can never leave a readable entry
 *    without its bytes — at worst an unreferenced orphan sidecar, or an inert
 *    `.tmp` leftover that the next commit of the same file overwrites and that
 *    no reader ever picks up.
 *  - Every restore pass is JOURNALED. Before mutating anything the store
 *    captures the pre-restore ("rescue") state of each planned path as a raw
 *    byte copy and persists an intent journal (`journal-<op>.json` in the
 *    session dir) holding only references, then marks each action done as it
 *    is applied. A crash at any point leaves the journal on disk; after a host
 *    restart `reconcileRestores(sessionId)` re-derives from the REAL disk which
 *    paths already match the target and which are still pending (reporting
 *    "restored up to where, what changed"), auto-heals journals whose goal is
 *    already reached, and `continueRestore` / `rollbackRestore` finish the
 *    interrupted op or undo it back to the exact pre-restore state.
 *  - Journal IO is best-effort and never fails a restore: if the journal
 *    cannot be written the restore proceeds exactly like the pre-journal code
 *    (crash safety degrades, behavior does not).
 *
 * Restore semantics (identical to Claude Code): for every path with entries
 * anchored at or after the target message, apply the EARLIEST entry — write
 * the before content back, or delete the file when that entry recorded a
 * creation. Symlinked and hard-linked paths are skipped and reported, never
 * written through.
 *
 * Format compatibility: entries written before this module stored bytes
 * (released v1: `{callId, anchorSeq, path, before: string | null}` plus the
 * `restore-journal-` prefix) are still READ — their string content is the
 * exact UTF-8 bytes it always was, except for records that were decoded
 * lossily (they contain U+FFFD: comparable, but never written back). New
 * writes are always the byte format; the marker contract that keeps a
 * downgraded v1 build from touching the workspace lives in
 * `tests/downgrade-safety.test.ts`.
 *
 * @module dsh-rewind/snapshot
 */
/**
 * Default store root: `<harness home>/rewind-snapshots`. Resolved through
 * {@link resolveDshHome} so the plugin follows `$DSH_HOME` (or a configured
 * harness home) rather than hardcoding `~/.dsh` — matching the other
 * first-party DSH packages. See `SECURITY.md` "Sensitive files".
 */
export declare const DEFAULT_SNAPSHOT_ROOT: string;
/** Environment variable overriding the store root (tests, exotic homes). */
export declare const SNAPSHOT_ROOT_ENV = "DSH_REWIND_SNAPSHOT_DIR";
/** Number of newest anchor groups (user messages) kept per session. */
export declare const MAX_ANCHOR_GROUPS = 100;
/**
 * Current on-disk store format version (the session's `store` marker value and
 * the `store` field of every entry this build writes). A value ABOVE this one
 * means the snapshots were written by a NEWER build: readers must then fail
 * closed (no file restore, nothing changed) instead of guessing what the extra
 * fields mean. A missing marker (or `1`) means the released v1 string format,
 * which is still read.
 */
export declare const CURRENT_STORE_VERSION = 2;
/**
 * Thrown when snapshots carry a store format newer than this build understands
 * (ADR-10: whole-operation fail-closed — never a partial restore, never a
 * clear). The session rewind itself does not depend on snapshots and still
 * works.
 */
export declare class UnknownStoreVersionError extends Error {
    /** The version found on disk. */
    readonly version: number;
    /** Where it was found (a marker or an entry file). */
    readonly source: string;
    constructor(
    /** The version found on disk. */
    version: number, 
    /** Where it was found (a marker or an entry file). */
    source: string);
}
/**
 * Recorded before-content — always bytes, never a decoded string:
 *
 * - `blob`: a raw byte copy inside the store (the format every new write uses).
 * - `text`: the exact UTF-8 bytes of a released-v1 string record (a v1 record
 *   that was decoded from valid UTF-8 is byte-exact, so restoring it is safe).
 * - `lossyText`: a released-v1 string record that contains U+FFFD, i.e. one
 *   the v1 build produced by a LOSSY decode of non-UTF-8 bytes. The original
 *   bytes are unknowable, so it can be compared against the disk but must
 *   never be written back as a restore target (that would destroy live data).
 */
export type ByteSource = {
    readonly kind: 'blob';
    readonly path: string;
} | {
    readonly kind: 'text';
    readonly bytes: Buffer;
} | {
    readonly kind: 'lossyText';
    readonly text: string;
};
/** A staged raw byte copy waiting to be committed (`recordBackup`). */
export interface PendingBackup {
    /** Absolute path of the staged file (inside the session's `.pending/`). */
    readonly file: string;
    /** Byte size of the staged content. */
    readonly size: number;
    /**
     * Permission bits of the source file (`stat().mode & 0o7777`), captured
     * best-effort. Restored alongside the content — never on its own, and never
     * as part of the change decision (ADR-9).
     */
    readonly mode?: number;
}
/** One committed before-backup, keyed by tool call. */
export interface CheckpointEntry {
    readonly callId: string;
    /** Seq of the user message anchoring the turn in which the change happened. */
    readonly anchorSeq: number;
    /** Resolved display path (absolute) of the tracked file. */
    readonly path: string;
    /** Byte source of the content before the change; null when the file was created. */
    readonly before: ByteSource | null;
    /** Byte size of `before` (0 when the file was created). */
    readonly size: number;
    /**
     * Checkpoint-time location pin: the `realpath` of `dirname(path)` at the
     * moment the entry was committed. A restore refuses the path when its parent
     * directory no longer resolves there, because a repointed or moved ancestor
     * would otherwise redirect the write (or the unlink) outside the recorded
     * location — only the path's FINAL component is link-checked. Absent means
     * "no pin": a released-v1 entry, a v2 entry written before this field
     * existed, or a commit whose parent could not be resolved; the restore then
     * falls back to the final-component check alone.
     */
    readonly parent?: string;
    /**
     * Permission bits recorded at capture time, when known. Applied only when
     * the CONTENT is restored (a mode-only difference is never a reason to plan
     * a restore); a missing value means "leave the live mode alone".
     */
    readonly mode?: number;
    /**
     * Set when this entry's sidecar holds re-encoded LOSSY text (a released-v1
     * record that was decoded with replacement characters, e.g. after `prune`
     * materialized its link). The bytes are comparable but must never be written
     * back: a reader turns such an entry into a `lossyText` source again.
     */
    readonly lossy?: boolean;
    /** Epoch ms the entry was committed (stable ordering within a group). */
    readonly time: number;
    /**
     * Absolute file this entry was READ from (in-memory only, never serialized):
     * a dedup reference must name the file that actually exists, which for an
     * entry written by an older build is not necessarily the name the current
     * naming function would produce.
     */
    readonly file?: string;
}
/**
 * One in-place dedup link, keyed by tool call. When a tracked file is
 * recorded with a `before` content identical to the immediately-prior entry
 * for that path, the entry is stored as a LINK instead of a full copy: it
 * carries no content, only a `ref` naming the prior entry file
 * (`<anchorSeq>/<callId>.json`). The linear (predecessor-chained) ref makes
 * restore resolution and prune materialization rewrite-free.
 */
export interface LinkEntry {
    readonly callId: string;
    readonly anchorSeq: number;
    readonly path: string;
    /** `<anchorSeq>/<callId>.json` of the immediately-prior entry for the path. */
    readonly ref: string;
    /**
     * Checkpoint-time location pin (see {@link CheckpointEntry.parent}); a link
     * records its own, so a materialized or resolved entry never loses the
     * location the path was committed under.
     */
    readonly parent?: string;
    readonly time: number;
    /** Absolute file this link was read from (in-memory only, never serialized). */
    readonly file?: string;
}
/** Any on-disk entry: a full before-backup or an in-place dedup link. */
export type StoredEntry = CheckpointEntry | LinkEntry;
/** True when an entry is a dedup link (carries `ref`, not `before`). */
export declare function isLinkEntry(entry: StoredEntry): entry is LinkEntry;
/** Per-file restore impact preview (`/rewind preview @seq both`). */
export interface FileImpact {
    readonly path: string;
    /** `restore` = write the before content back; `delete` = remove the file. */
    readonly action: 'restore' | 'delete';
}
/** Outcome of one restore pass. */
export interface RestoreOutcome {
    readonly restored: readonly string[];
    readonly deleted: readonly string[];
    /** Symlinked or hard-linked paths left untouched. */
    readonly skipped: readonly string[];
    readonly failed: readonly {
        path: string;
        message: string;
    }[];
}
/** Deletes one file by its real path (node:fs, bypassing the fs service). */
export type DeleteFile = (path: string) => Promise<void>;
/**
 * Test-only fault injection: a crash point inside the write/restore paths.
 * The hook THROWS to simulate a host crash at the exact point; the throw
 * propagates out of the store method, leaving the journal on disk in its
 * current state. Production callers never pass it (undefined = no-op).
 */
export type CrashPoint = 'before-action' | 'after-action' | 'after-temp-write';
/** Options for the journaled restore paths; `crash` is the test-only seam. */
export interface RestoreRunOptions {
    /**
     * Throws at the given point to simulate a host crash: `before-action`
     * (before an action's fs op), `after-action` (right after the fs op,
     * before its done-mark is persisted), `after-temp-write` (inside an atomic
     * commit, between the temp write and the rename). `index` is the action
     * index for the restore loops.
     */
    readonly crash?: (point: CrashPoint, index?: number) => void;
}
/**
 * Lifecycle of one restore operation journal. Terminal states are kept on
 * disk as a tiny audit trail and skipped by reconciliation.
 */
export type RestoreJournalState = 'running' | 'rollback-running' | 'completed' | 'rolled-back' | 'recovery-required';
/**
 * One journaled restore action — a mutable working record that the restore
 * loop updates (done/failed) as it applies the pass.
 */
export interface RestoreJournalAction {
    readonly path: string;
    readonly action: 'restore' | 'delete';
    /** Target content for a restore; null for a delete. */
    readonly before: ByteSource | null;
    /**
     * Pre-restore disk state ("rescue"): a raw byte copy of what the file had
     * right before the restore started, or null when it was absent. Rollback
     * writes this back, so the pre-restore state is recoverable exactly.
     */
    readonly rescue: ByteSource | null;
    /** Set when the rescue capture failed: rollback then skips this path. */
    rescueError?: string;
    /** Permission bits the restored content should end up with, when recorded. */
    readonly mode?: number;
    /**
     * Checkpoint-time location pin copied from the entry the action was planned
     * from (see {@link CheckpointEntry.parent}): a continue or rollback after a
     * restart re-checks it before touching the path.
     */
    readonly parent?: string;
    /** Permission bits the file had BEFORE the restore, for a faithful rollback. */
    readonly rescueMode?: number;
    /** True once the action's fs op completed and was marked. */
    done: boolean;
    /** Per-action failure message; the restore pass never aborts. */
    failed?: string;
}
/** Durable journal for one attempted restore (written atomically). */
export interface RestoreJournal {
    /** On-disk schema version: 2 = byte references, 1 = inline legacy strings. */
    readonly version: 1 | 2;
    readonly id: string;
    readonly sessionId: string;
    readonly targetSeq: number;
    readonly startedAt: number;
    finishedAt?: number;
    state: RestoreJournalState;
    readonly actions: RestoreJournalAction[];
    /** Set when a rollback pass failed partway (state becomes `recovery-required`). */
    rollbackError?: string;
    /**
     * Absolute file this journal was read from (in-memory only, never
     * serialized): a legacy `restore-journal-` file is updated IN PLACE so an
     * op that was interrupted before the upgrade never ends up with two
     * divergent versions on disk.
     */
    sourceFile?: string;
}
/**
 * Result of reconciling one interrupted restore journal against the real
 * disk. Path status is relative to the op's current goal: the restore target
 * for `running` journals, the pre-restore (rescue) state for
 * `rollback-running` / `recovery-required` journals — disambiguate with
 * {@link RestoreReconcileReport.journalState}.
 */
export interface RestoreReconcileReport {
    readonly opId: string;
    /** `interrupted` = a crash left the op unfinished; `recovery-required` = a rollback could not complete. */
    readonly state: 'interrupted' | 'recovery-required';
    /** Raw journal state (`running` | `rollback-running` | `recovery-required`). */
    readonly journalState: RestoreJournalState;
    readonly targetSeq: number;
    readonly startedAt: number;
    /** Paths whose disk already matches the op's goal. */
    readonly restored: readonly string[];
    /** Paths still short of the op's goal (not yet applied / not yet rolled back). */
    readonly pending: readonly string[];
    /** Actions that failed during the pass (kept failed until a redo succeeds). */
    readonly failed: readonly {
        path: string;
        message: string;
    }[];
    readonly rollbackError?: string;
    /** Set when the journal file itself is corrupt: it cannot be reconciled. */
    readonly corrupt?: string;
}
/**
 * Current-on-disk state probe used by restore planning and reconciliation.
 * Injected so the logic runs against a fake FS in tests; the production
 * default reads the real file system with plain `node:fs` (see
 * {@link defaultProbe}) and compares byte streams, never whole files in memory.
 */
export interface DiskProbe {
    /**
     * Compare the recorded content with the file currently at `path`.
     *
     * - `true`  = the disk matches the record byte-for-byte (for a `null`
     *   source: the path is absent).
     * - `false` = it differs — including "the record says the file did not
     *   exist but it does" and "the record has content but the file is gone".
     * - `undefined` = the comparison could not be decided (IO/permission
     *   failure). Callers stay conservative: a restore is still attempted and a
     *   delete still attempted, so an unreadable file is never silently skipped.
     *
     * A `lossyText` source is compared with the same lossy decode the released
     * v1 build used (its original bytes cannot be recovered).
     */
    matches(source: ByteSource | null, path: string): Promise<boolean | undefined>;
    /**
     * Stage a raw byte copy of the file at `path` into `dest` (the store's
     * rescue area) without loading it into memory.
     */
    copy(path: string, dest: string): Promise<CopyOutcome>;
    /** True when the path is a symlink or a hard link (never planned/restored). */
    isLink(path: string): Promise<boolean>;
}
/** Result of staging one on-disk byte copy. */
export type CopyOutcome = {
    readonly kind: 'copied';
    readonly size: number;
} | {
    readonly kind: 'absent';
} | {
    readonly kind: 'failed';
    readonly message: string;
};
/** One restore action the planner derived from record + disk reconciliation. */
export type PlannedAction = {
    readonly path: string;
    readonly action: 'restore';
    readonly before: ByteSource;
    readonly mode?: number;
    readonly parent?: string;
} | {
    readonly path: string;
    readonly action: 'delete';
    readonly parent?: string;
};
/** Production probe: real byte comparisons via node:fs, links via lstat + nlink. */
export declare const defaultProbe: DiskProbe;
/**
 * Result of a stale-session cleanup sweep ({@link SnapshotStore.pruneStale}).
 *
 * The sweep is ANTI-DELETE: it only ever removes WHOLE session directories
 * that have been idle past `maxAgeDays`. `scanned` counts every session dir
 * evaluated; `kept` + `skippedActive` + `deleted` sum to it. `remainingBytes`
 * is the total of directories that SURVIVE the policy (when `dryRun` it is the
 * would-be total, not the current on-disk total), so it is comparable across
 * dry and real runs.
 */
export interface PruneStaleReport {
    /** Number of session directories evaluated. */
    readonly scanned: number;
    /** Session directories removed (would-be count when `dryRun`). */
    readonly deleted: number;
    /** Bytes reclaimed (would-be bytes when `dryRun`). */
    readonly freedBytes: number;
    /** Session directories retained (not past the cutoff, not the active one). */
    readonly kept: number;
    /** Bytes across the retained + skipped-active directories. */
    readonly remainingBytes: number;
    /** Directories skipped because they are the active session. */
    readonly skippedActive: number;
    /** Whether nothing was really removed (the sweep only reported). */
    readonly dryRun: boolean;
}
/**
 * Result of a manual whole-session clear ({@link SnapshotStore.clearSession}).
 *
 * Unlike the age-based sweep, a clear removes EVERY snapshot of ONE session
 * (all anchor groups, all checkpoint entries, all restore journals) on demand —
 * the active session the user is driving, to drop the rewind overhead or to
 * archive a conversation immediately. `dryRun` reports what would be removed
 * without touching disk or memory.
 */
export interface ClearSessionReport {
    /** The session whose records were (or would be) cleared. */
    readonly sessionId: string;
    /** Number of anchor-group (user-message) directories present. */
    readonly anchorGroups: number;
    /** Number of committed checkpoint entries (full backups + dedup links). */
    readonly entries: number;
    /** Number of restore-journal files (terminal + pending). */
    readonly journals: number;
    /** Bytes occupied by the session directory (the amount freed). */
    readonly bytes: number;
    /** Whether nothing was really removed (the clear only reported). */
    readonly dryRun: boolean;
}
/**
 * On-disk checkpoint store. Every write goes straight through `node:fs`, so a
 * restore reliably lands on the real file system.
 */
export declare class SnapshotStore {
    /** Debounce window for the per-commit prune (keeps the readdir+sort off the hot path). */
    private static readonly PRUNE_INTERVAL_MS;
    /** Session-format-version marker file inside the session dir. Non-`.json`, so it never counts as a checkpoint entry. */
    private static readonly FORMAT_FILE;
    /** Plugin STORE-format marker file inside the session dir (non-`.json`, same reasoning). */
    private static readonly STORE_FILE;
    private lastPruneAt;
    /**
     * Monotonic entry clock. Date.now() has 1ms precision, so back-to-back
     * commits in the same millisecond would TIE on the entry `time` field and
     * entriesAfter's (anchorSeq, time) sort would fall back to the readdir
     * order — filesystem-dependent, so a re-read could pick the WRONG "earliest"
     * version for a path. Bumping past the previous commit keeps the capture
     * order reproducible after a re-read. The read-modify-write below is
     * synchronous (before the first await), so concurrent commits can never
     * observe the same value. Across restarts wall-clock monotonicity holds
     * (restart gaps dwarf 1ms); a backwards NTP step is the only way to break
     * it, and even then the in-process order still holds.
     */
    private lastEntryTime;
    /** Store options; `dedup` toggles in-place content dedup (default on). */
    private readonly dedup;
    /** Resolved checkpoint store root (absolute); see the constructor's fallback. */
    readonly root: string;
    /**
     * In-memory per-path "most recent entry" for content dedup, keyed by
     * `<sessionId>\0<path>`. Each value holds the entry's effective byte source
     * (a handle, not a copy) and its own file ref, so a new record with the same
     * content links to the immediately-prior entry (linear chain). Seeded lazily
     * per session from the bounded on-disk window, so dedup survives a host
     * restart. A handle whose bytes vanished (pruned out of band) is treated as
     * "never recorded" — dedup then stores MORE, never less.
     */
    private readonly lastEntry;
    /** Sessions whose dedup state has been seeded from disk this process. */
    private readonly seededSessions;
    /** Sessions whose store-format marker this process has already stamped. */
    private readonly storeStamped;
    /**
     * Session-format version snapshots are anchored under, stamped into each
     * session's `format` marker when an entry is recorded. `null` until the host
     * sets it (from `agent/session-start`), so a session that never records is
     * never materialized and a marker is only written where snapshots exist.
     */
    private formatVersion;
    constructor(root?: string, opts?: {
        readonly dedup?: boolean;
        readonly dshHome?: string;
    });
    /** Absolute path of one session's snapshot directory (id sanitized). */
    sessionDir(sessionId: string): string;
    /** Absolute path of one anchor group directory. */
    anchorDir(sessionId: string, anchorSeq: number): string;
    /** Absolute file ref (relative to the session dir) of an entry. */
    private entryRefOf;
    /**
     * The session-relative ref of an entry READ from disk: the file that really
     * holds it. A v1 entry keeps its released name, so recomputing the name from
     * the call id would produce a dangling reference.
     */
    private refOfRead;
    /** Drop every in-memory trace of one session (its directory is gone). */
    private forgetSession;
    /**
     * Forget in-memory state for sessions whose directory no longer exists —
     * after a sweep, or after the user removed a session dir out of band. A
     * stale handle is SAFE (dedup and the boundary both fail toward storing
     * more), but keeping it means the store holds state for a session it deleted
     * and skips re-stamping that session's `format`/`store` markers.
     */
    private forgetMissingSessions;
    /**
     * Stage a capture slot for one tool call: create the session's `.pending/`
     * area and return the absolute path the caller copies the before-bytes into
     * (never through memory). The slot lives inside the session dir so the
     * commit can `rename` it into the anchor group atomically; a slot that is
     * never committed is either unlinked by its caller or collected by `prune`.
     */
    stageCapture(sessionId: string, key: string): Promise<string>;
    /**
     * Seed a session's dedup state from the existing (bounded) on-disk window:
     * scan entries newest-first and record the most recent entry per path. This
     * makes content dedup survive a host restart within the session window. A
     * no-op after the first seed (or when `dedup` is disabled).
     */
    private ensureDedupSeeded;
    /**
     * Resolve an entry's effective `before` content, following a link chain to
     * its terminal real snapshot. Refs are strictly backward in
     * `(anchorSeq, time)`, so the chain is acyclic and finite. A dangling or
     * cyclic link throws — callers fail per-file (never silently dropping the
     * path from a restore).
     */
    private resolveBefore;
    /**
     * Validate a real entry's byte source against the store's own files: a
     * sidecar that is missing, not a regular file, or a different size than the
     * metadata records is an INTEGRITY failure (thrown), never a silent skip and
     * never a fallback to "the file was created" — a restore must not delete a
     * file whose backup it cannot read.
     */
    private validatedSource;
    /**
     * True when two recorded byte sources are the same content. Comparison is
     * STREAMING (size first, then chunks) so large files never enter memory.
     * Any unreadable handle — or any legacy lossy source, whose original bytes
     * are unknowable — answers `false`: dedup must fail toward storing more,
     * never toward claiming "unchanged".
     */
    private sourcesMatch;
    /**
     * Write raw bytes to a sidecar path atomically (temp + rename): a crash
     * between the steps leaves only a `.tmp` that no reader picks up.
     */
    private writeSidecar;
    /**
     * Place one entry's sidecar next to its entry file: MOVE a staged capture
     * (same filesystem, atomic) or write the bytes from a source. Returns the
     * blob source and its size, or null for a created file. The sidecar is
     * always complete before the entry JSON is written.
     */
    private placeSidecar;
    /**
     * Commit one entry (a full before-backup or an in-place dedup link) under
     * its anchor group.
     */
    private commit;
    /**
     * Commit one before-backup whose content the caller already holds as raw
     * text (the boundary-friendly API: tests, synthetic records). The bytes are
     * encoded UTF-8, exactly as the released v1 build did for text content.
     */
    recordEntry(sessionId: string, entry: {
        readonly callId: string;
        readonly anchorSeq: number;
        readonly path: string;
        readonly before: string | null;
    }, opts?: {
        readonly dedup?: boolean;
        readonly crash?: (point: CrashPoint) => void;
    }): Promise<void>;
    /**
     * Commit one before-backup whose content is an existing byte file (the
     * capture and boundary paths): `backup.file` is MOVED into the anchor group
     * (same filesystem, so this is atomic), or `null` when the file did not
     * exist — a creation.
     */
    recordBackup(sessionId: string, entry: {
        readonly callId: string;
        readonly anchorSeq: number;
        readonly path: string;
    }, backup: PendingBackup | null, opts?: {
        readonly dedup?: boolean;
        readonly crash?: (point: CrashPoint) => void;
    }): Promise<void>;
    /**
     * The byte source recorded by the path's MOST RECENT entry, or undefined
     * when the path has never been recorded (a fresh tracking sight). This is
     * the single in-memory "last known state" the boundary compares the disk
     * against — the same source `recordEntry` dedups against, so there is one
     * handle and one comparison per decision, not two. Seeding is idempotent
     * (once per session from disk).
     */
    lastKnownContent(sessionId: string, path: string): Promise<ByteSource | null | undefined>;
    /**
     * All committed entries anchored at or after `targetSeq`, newest first (for
     * preview ordering). The boundary is inclusive: rewinding to a message also
     * reverts the changes its own turn caused (the rewind cut removes that
     * turn's assistant response and tool calls), so only entries anchored at
     * earlier messages survive.
     */
    entriesAfter(sessionId: string, targetSeq: number): Promise<StoredEntry[]>;
    /**
     * Per-path EARLIEST committed entry anchored at or after the target — the
     * single source of truth for both restore and impact preview.
     */
    private earliestEntries;
    /**
     * The single source of truth for BOTH the impact preview and the restore
     * pass: reconcile the earliest recorded entry per path (at/after the
     * target) against the CURRENT on-disk state, and plan only the actions
     * that would actually change the disk. This is the Claude Code model —
     * `fileHistoryGetDiffStats` / `applySnapshot` both compare against the
     * live filesystem (`checkOriginFileChanged`) and count only real
     * differences, so a rewind whose target state already matches the disk is
     * a no-op with zero impact.
     *
     * - `before === null` (the file did not exist at the target) plans a
     *   `delete` ONLY when the file currently exists; an already-absent file
     *   is a no-op — this kills the "ghost impact" of replaying an entry a
     *   previous rewind already consumed.
     * - a recorded byte source plans a `restore` ONLY when the current bytes
     *   differ from it (or the file is missing); identical bytes are a no-op —
     *   this keeps repeated rewinds idempotent.
     * - A released-v1 record that lost bytes to a lossy decode (`lossyText`) is
     *   compared with the same lossy decode but NEVER written back: a skip is
     *   reported instead of destroying live bytes with U+FFFD content.
     * - An unreadable / unresolvable record is a per-file FAILURE, never a
     *   delete: planning a delete for a file we cannot restore is the one
     *   mistake that loses data.
     * - Symlinked / hard-linked paths are never planned (they are reported as
     *   skipped by the restore pass, never written through).
     * - A probe failure (e.g. a permission error reading the file) plans the
     *   action conservatively as if the file differed, so an unreadable file
     *   is never silently dropped from the restore.
     *
     * @param sessionId - session whose snapshot store to plan against.
     * @param targetSeq - rewind target; entries anchored at/after it apply.
     * @param probe - current-disk state probe (defaults to the real FS).
     * @returns the planned actions, the link paths skipped, and per-file failures.
     */
    private planRestore;
    /** Per-file restore impact: only actions that would actually change the disk. */
    impactsAfter(sessionId: string, targetSeq: number, probe?: DiskProbe): Promise<FileImpact[]>;
    /**
     * Restore the workspace to the target message's checkpoint: execute exactly
     * the actions {@link planRestore} derived from the record + current disk
     * reconciliation — write the before content back, or delete the file when
     * it was created after the target and still exists. Symlinked and
     * hard-linked paths are skipped (reported, never written through); a
     * restored file's parent directory is created when it was deleted after
     * the backup; a delete whose file is ALREADY absent is a silent no-op (not
     * a failure — the target state is already reached). Failures are per-file
     * and never abort the pass.
     *
     * The pass is journaled for crash safety: the pre-restore ("rescue") state
     * of every planned path is captured and an intent journal persisted BEFORE
     * any mutation, then each action is marked done as it is applied. A host
     * crash at any point leaves the journal on disk; after a restart
     * {@link reconcileRestores} reports where the restore stopped,
     * {@link continueRestore} finishes it and {@link rollbackRestore} undoes it
     * back to the exact pre-restore state. Journal IO itself never fails the
     * restore (it degrades to a journal-less pass).
     */
    restoreAfter(sessionId: string, targetSeq: number, deleteFile: DeleteFile, probe?: DiskProbe, opts?: RestoreRunOptions): Promise<RestoreOutcome>;
    /** Absolute path of one restore-op journal file (the current prefix). */
    private journalPath;
    /**
     * Locate an existing journal file for an op: the current prefix first, then
     * the prefix the released v1 build wrote (a restore interrupted before the
     * upgrade must still be continuable / rollbackable).
     */
    private findJournalFile;
    /**
     * Best-effort journal persist: journal IO failures are non-fatal by design —
     * a restore must never fail because its audit journal could not be written.
     * reconcileRestores() re-derives the true state from the disk, so a missing
     * or stale journal only loses the trail, never the recovery ability.
     *
     * A journal read back from a legacy file is rewritten IN PLACE (same file),
     * so a redo / rollback of a pre-upgrade op never leaves two divergent
     * versions of the same op on disk.
     */
    private saveJournal;
    /**
     * Journal one restore pass before mutating anything: capture the rescue
     * (pre-restore) state of every planned path as a raw byte copy and persist
     * the intent (references only) atomically. Returns the in-memory journal; a
     * persist failure degrades to a journal-less restore (non-fatal, see
     * {@link saveJournal}).
     */
    private beginRestore;
    /**
     * Read one journal by op id; undefined when it does not exist. A corrupt
     * journal THROWS (fail-loud): unlike checkpoint entries, silently dropping
     * a journal would silently erase the interrupted restore's recovery record.
     */
    private readJournal;
    /**
     * Every journal file of a session (both prefixes) — valid ones plus corrupt
     * ones with their error — so reconciliation can report corruption instead of
     * dropping it.
     */
    private listJournals;
    /**
     * Execute ONE fs mutation with exactly the pre-journal semantics: a delete
     * runs through the injected deleteFile (ENOENT tolerated — the file is
     * already absent, i.e. the target state is reached), a restore copies the
     * recorded bytes back over the file (creating the parent if needed).
     *
     * This is the only place the store writes restored content to the real FS,
     * and it is deliberately raw `copyFile`/`writeFile`/`unlink` rather than the
     * fs service: the caller only ever hands it a path from `planRestore` — one
     * the session's own write-class tool call recorded and resolved (never a
     * symlink/hard link) and only when it differs from the live disk. So no
     * arbitrary path, no model input, never automatic.
     *
     * The write is IN PLACE (no temp + rename): it keeps the file's inode and
     * thus its xattrs/ACL, and crash safety is provided by the journal plus disk
     * reconciliation instead (a half-written file simply does not match the
     * goal, so a redo rewrites it).
     *
     * Permissions are best-effort (ADR-9/R3): the mode is only ever applied as
     * part of a CONTENT restore (never as a reason to plan one), and a chmod
     * failure never fails the restore.
     */
    private applyActionToDisk;
    /**
     * Reconcile the session's restore journals against the real disk — the
     * "host restart" account: for every interrupted op, report which paths
     * already match its goal (restored) and which are still pending, and expose
     * any recorded failures. Journals whose goal is already fully reached on
     * disk (e.g. a later rewind completed the work) are auto-healed to their
     * terminal state and not reported. A corrupt journal is reported
     * `recovery-required` — never silently dropped.
     *
     * Deliberately NOT gated on the session's `store` marker: a journal is fully
     * self-describing (`version` plus byte references), and refusing to finish an
     * interrupted op merely because the SESSION marker looks newer would strand a
     * half-restored workspace — the outcome the legacy-journal support exists to
     * prevent. A reference the newer build moved shows up as a per-file failure,
     * never as a silent write.
     *
     * @param sessionId - session whose journals to reconcile.
     * @param probe - current-disk state probe (defaults to the real FS).
     * @returns one report per non-terminal journal still needing attention.
     */
    reconcileRestores(sessionId: string, probe?: DiskProbe): Promise<RestoreReconcileReport[]>;
    /**
     * Reconcile ONE non-terminal journal against the real disk. Returns
     * undefined when the op's goal is already fully reached (auto-heals to the
     * terminal state); otherwise a report of restored/pending/failed paths.
     * For `running` journals the goal is the restore target; for
     * `rollback-running` / `recovery-required` journals it is the rescue
     * (pre-restore) state.
     */
    private reconcileJournal;
    /**
     * Continue (redo) an interrupted restore: finish the op by applying every action
     * whose disk state does not yet match its goal — the restore target for
     * `running` journals. Actions are decided by the REAL disk (the same "disk
     * is truth" rule as reconciliation), so a crash between an fs op and its
     * done-mark is completed deterministically and a path the user already
     * fixed is marked done without being rewritten. Failed actions are retried;
     * a re-failure re-records the failure. The journal becomes `completed` once
     * every action reaches the target.
     */
    continueRestore(sessionId: string, opId: string, deleteFile: DeleteFile, probe?: DiskProbe, opts?: RestoreRunOptions): Promise<RestoreOutcome>;
    /**
     * Roll back an interrupted restore: undo every action whose disk
     * state does not match its rescue (pre-restore) record, returning the
     * workspace to the exact state it had before the restore started. Decided
     * by the REAL disk, so actions the crash left applied-but-unmarked are
     * undone too, and a path already back at its rescue state is skipped —
     * the pass is idempotent across crashes (a retry finishes the remaining
     * actions). The journal moves `running` → `rollback-running` → `rolled-back`;
     * a failed undo leaves it `recovery-required` (retryable), and paths whose
     * rescue capture failed are reported and left untouched.
     */
    rollbackRestore(sessionId: string, opId: string, deleteFile: DeleteFile, probe?: DiskProbe, opts?: RestoreRunOptions): Promise<RestoreOutcome>;
    /**
     * Drop the session's oldest anchor groups beyond `keep` (default
     * {@link MAX_ANCHOR_GROUPS}), deleting their whole directories. Also
     * recycles terminal restore journals (see {@link pruneTerminalJournals}),
     * so the per-commit cap bounds BOTH the checkpoint entries and the journal
     * accumulation.
     *
     * Because dedup links reference prior entries, eviction is LINK-AWARE: before
     * deleting the oldest groups, any SURVIVING (kept-group) link whose `ref`
     * lands on a real snapshot inside a doomed group is MATERIALIZED (rewritten
     * as a real snapshot carrying the resolved content), so no kept link is left
     * dangling. Links form a linear predecessor chain, so materializing the first
     * link after each doomed real is enough — later links already point at that
     * materialized entry (or at other kept links), requiring no rewrite.
     *
     * `opts.crash` is the test-only seam: a crash fired inside a materialization
     * write (between its temp write and rename) leaves ONLY a `.tmp` — the doomed
     * real is still on disk and the kept link still resolves, so nothing dangles
     * and a later prune simply re-materializes.
     */
    prune(sessionId: string, keep?: number, opts?: {
        readonly crash?: (point: CrashPoint) => void;
    }): Promise<void>;
    /**
     * Collect staged captures that were never committed and are older than
     * {@link PENDING_MAX_AGE_MS}: a crash between `tools/execute` and
     * `tools/post-execute` can leak one, and the process that would have
     * unlinked it is gone.
     */
    private prunePendingCaptures;
    /**
     * Anchor groups a NON-TERMINAL journal still depends on — the groups holding
     * the sidecars its actions restore from. `prune` must not evict them while
     * the op can still be finished. Rescue copies live under `rescue/`, never in
     * an anchor group, so only `before` references matter; a group is pinned only
     * for a well-formed, safe reference (a corrupt journal pins nothing).
     */
    private pinnedAnchors;
    /**
     * Recycle terminal restore journals (`completed` / `rolled-back`): once an
     * op finished, its journal and its rescue bytes are dead weight that would
     * otherwise accumulate without bound (one journal per both-mode rewind).
     * Non-terminal journals (crashed ops awaiting reconcile / continue /
     * rollback) and unclassifiable (corrupt) ones are ALWAYS kept — a recovery
     * record that cannot be classified is never destroyed.
     */
    private pruneTerminalJournals;
    /** True when a path exists on disk (used by tests and diagnostics). */
    exists(path: string): Promise<boolean>;
    /**
     * Cross-session retention sweep: remove WHOLE session directories whose
     * newest member stamp is older than `maxAgeDays` days of idle, keeping the
     * active session (`keepActiveId`) untouched. This is the anti-growth policy
     * for finished sessions (rewind only ever reads the active session, so a
     * finished session's backups are provably dead weight).
     *
     * SAFETY:
     *  - Only whole session directories are removed (dedup refs are
     *    session-relative, so there is no cross-session dangling to materialize);
     *  - the active session is never targeted (`keepActiveId`), and everything
     *    else is protected by its own mtime — a session that is still written to
     *    keeps scrolling its newest member stamp forward, so it is never old
     *    enough to be pruned;
     *  - a non-positive `maxAgeDays` throws instead of degenerating into a
     *    mass-destructive `cutoff` in the far future;
     *  - the walk uses `lstat` (no symlink following) and skips dot-prefixed
     *    temp left overs — except the real `.pending/` area, whose staged bytes
     *    are content and whose freshness is activity — so measurement stays
     *    inside the store root.
     *
     * `dryRun` computes and reports exactly what would be removed without
     * deleting anything — the `/snapshot-auto-cleanup run` preview.
     */
    pruneStale(opts: {
        readonly keepActiveId?: string;
        readonly maxAgeDays: number;
        readonly dryRun?: boolean;
    }): Promise<PruneStaleReport>;
    /**
     * All distinct paths ever recorded for a session — the "tracked files"
     * set. Mirrors Claude Code's global `trackedFiles` collection (files stay
     * tracked once a write-class tool touched them), derived from the disk
     * entries so no extra persistence is needed.
     */
    trackedPaths(sessionId: string): Promise<Set<string>>;
    /**
     * Summarize a session's on-disk footprint for a clear dry-run: anchor-group
     * count, committed checkpoint-entry count (one per `.json` in an anchor
     * group), restore-journal count (both journal prefixes), and the total bytes
     * the session dir occupies — entry JSONs, raw byte sidecars, `rescue/**` and
     * the staged `.pending/**` copies alike, so the number matches what a `du` of
     * that directory reports.
     *
     * Walks with `lstat` (never follows a symlink, so a hostile symlink cannot
     * escape the store root or inflate the measurement) and skips dot-prefixed
     * temp leftovers (the one exception is `.pending/`, whose staged bytes are
     * real store content).
     */
    private sessionStats;
    /**
     * Remove a session's ENTIRE snapshot directory — every anchor group, every
     * checkpoint entry, and every restore journal — and reset the store's
     * in-memory dedup state so the session starts recording fresh from the
     * current workspace state. This is the manual "get rid of this session's
     * records NOW" action on the ACTIVE session the user is driving (it is never
     * targetable by id; that is a directory-manipulation concern the user can do
     * directly).
     *
     * SEMANTICS — clearing is an explicit abandonment: issuing the command means
     * the user accepts that this session's snapshot archive goes away. It is
     * therefore NOT gated on the state of any restore journal. A clear and a
     * restore are both slash commands the host runs to completion for an agent,
     * so they never interleave — any non-terminal journal present on disk is a
     * stale orphan from a previous (crashed) process, and discarding it is the
     * correct, safe resolution of that abandoned restore.
     *
     * SAFETY (this module's real concern is the plugin's ongoing BEHAVIOR, not
     * losing snapshots):
     *  - Only the session dir is removed; dedup refs are session-relative, so
     *    there is no cross-session dangling to materialize (the same rationale as
     *    {@link pruneStale}'s whole-dir removal).
     *  - The in-memory dedup state (`lastEntry` / `seededSessions`) is ALWAYS
     *    reset on an apply — even when the dir was already empty. A stale
     *    in-memory entry (e.g. a session whose dir was removed out-of-band) would
     *    otherwise link a later `recordEntry` to a deleted prior entry, leaving a
     *    dangling ref that breaks restore resolution. This is the primary
     *    correctness guarantee.
     *
     * `dryRun` computes the report without touching disk or memory.
     */
    clearSession(sessionId: string, opts?: {
        readonly dryRun?: boolean;
    }): Promise<ClearSessionReport>;
    /**
     * Read the session-format version marker recorded for a session, or `null`
     * when there is no marker — a pre-marker, legacy snapshot dir, or a session
     * that never materialized a dir.
     */
    private readFormatVersion;
    /**
     * Record the session-format version a session's snapshots are anchored under
     * (`session.header.version`: 2 for the v2 format, 3 for the v3 format). The
     * marker is a tiny non-`.json` file, so it never counts as a checkpoint
     * entry in `sessionStats`/`clearSession`. Written atomically (temp + rename)
     * like every other persisted marker, so a crash mid-write can only leave an
     * inert `format.tmp` — never a partial marker that a later reconcile could
     * misread as a version mismatch and wrongly clear.
     */
    markFormatVersion(sessionId: string, sessionVersion: number): Promise<void>;
    /**
     * Set the session-format version the store stamps onto every snapshot it
     * records. The host sets this once per process from `agent/session-start`
     * (`agent.session.header.version`), so a marker is only materialized for a
     * session that actually records a snapshot.
     */
    setFormatVersion(sessionVersion: number): void;
    /**
     * Read the plugin's STORE-format marker for a session, or null when there is
     * none (a released-v1 dir, or a session that never recorded a snapshot). The
     * marker is a quick session-level signal; every entry and journal is also
     * self-describing (`store` / `version`), so a missing marker never changes
     * how an entry is read.
     */
    readStoreVersion(sessionId: string): Promise<number | null>;
    /**
     * Stamp the store-format marker (atomically, like `format`). Written
     * alongside every byte-format entry, so a session that only ever holds the
     * released string format keeps no marker and is read as v1.
     */
    markStoreVersion(sessionId: string, storeVersion: number): Promise<void>;
    /**
     * Refuse to plan against (or write into) a session whose store format is
     * NEWER than this build understands (ADR-10): the caller reports it and
     * changes nothing — no partial restore, no clear, no v2 entry written into a
     * v3 store. Checked before any entry is read, so the marker alone is enough
     * to fail closed.
     */
    assertKnownStoreVersion(sessionId: string): Promise<void>;
    /**
     * Session-format-version guard: clear a session's snapshot dir when the
     * format its snapshots were anchored under differs from the current session
     * format, so seq-anchored references can never survive a format migration
     * mis-mapped. Runs at `agent/session-start` — after DSH has migrated/loaded
     * the session, so `sessionVersion` is the post-migration value.
     *
     * Conservative rule (per the "delete stale snapshots" policy): a session
     * with no recorded marker but with snapshot content is treated as legacy and
     * cleared; a session whose marker differs from `sessionVersion` is cleared.
     * A matching version — or an untouched session with nothing to protect — is
     * left alone. The marker is re-stamped to the current version afterward so a
     * FUTURE format change is detected on the next start.
     *
     * @returns whether a session snapshot dir was cleared.
     */
    reconcileFormatVersion(sessionId: string, sessionVersion: number): Promise<{
        cleared: boolean;
    }>;
}
/**
 * Re-check every tracked file at a user-message boundary and record the
 * current on-disk state for any file whose state changed since it was last
 * seen — Claude Code's `fileHistoryMakeSnapshot` re-stats every tracked file
 * at each user message and snapshots the new state (changed files get a new
 * backup version, deleted files a null marker). Here the "new version" is a
 * plain before-backup entry anchored at the boundary message, so an EXTERNAL
 * edit or deletion (never seen by the write-class tool capture) enters the
 * record and can be restored by a later rewind.
 *
 * Semantics: the recorded `before` is the file's state at the boundary —
 * the state the boundary message's turn starts from, exactly like the
 * tool-captured entries. An entry is written only when the state differs
 * from the path's most-recent recorded content (`lastKnownContent`); a fresh
 * sighting (never recorded) always records. The state is compared against the
 * SAME single in-memory source `recordEntry` dedups against, so there is one
 * content copy and one comparison — not the two (a boundary map plus the
 * dedup map) the previous model held. Only CHANGED files are recorded, and
 * each is a full snapshot (`dedup: false`): a changed state always differs
 * from the recent record, so the link decision would never apply there.
 *
 * Symlinked / hard-linked paths are never re-checked (restores skip them).
 * A probe failure skips the file with a warning-level no-op; it never aborts
 * the boundary pass, and it never records the path as absent.
 *
 * @param store - the session's snapshot store.
 * @param sessionId - session whose tracked files to re-check.
 * @param anchorSeq - the boundary user-message seq (entry anchor).
 * @param tracked - the session's tracked path set (read-only here).
 * @param probe - current-disk state probe (defaults to the real FS).
 * @returns the number of entries recorded.
 */
export declare function reconcileTracked(store: SnapshotStore, sessionId: string, anchorSeq: number, tracked: ReadonlySet<string>, probe?: DiskProbe): Promise<number>;
