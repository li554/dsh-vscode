//#region src/contracts.d.ts
type RuntimeMemoryTarget = 'memory' | 'user';
type RuntimeMemoryImportance = 'critical' | 'normal' | 'low';
type RuntimeMemoryAction = 'add' | 'replace' | 'remove';
/** Provenance a DSH Host stamps when an entry crosses machines; absent for local writes. */
interface RuntimeMemoryEntryOrigin {
  machine: string;
  label: string;
  at: string;
}
interface RuntimeMemoryEntry {
  content: string;
  created_at: string;
  updated_at: string;
  target: RuntimeMemoryTarget;
  importance: RuntimeMemoryImportance;
  /** Explicit human pin state; absent is the legacy unpinned state. */
  pinned?: boolean;
  /** Optional git branch names that limit where this entry is projected. Absent means every branch. */
  branches?: string[];
  /** Which installation wrote this entry, so a merge can tell two machines apart. */
  origin?: RuntimeMemoryEntryOrigin;
}
interface RuntimeMemoryUsage {
  used: number;
  limit: number;
}
interface RuntimeMemoryTargetView extends RuntimeMemoryUsage {
  target: RuntimeMemoryTarget;
  entryCount: number;
  markdownPath: string;
  pinned?: {
    count: number;
    characters: number;
    limit: number;
  };
}
interface RuntimeMemorySnapshot {
  directory: string;
  sourcePath: string;
  revision: string;
  generatedAt: string;
  entries: RuntimeMemoryEntry[];
  targets: Record<RuntimeMemoryTarget, RuntimeMemoryTargetView>;
}
interface RuntimeMemoryCompactedEntry {
  content: string;
  importance: RuntimeMemoryImportance;
  pinned?: boolean;
  /** Branch scope carried through compaction; absent means the entry is visible on every branch. */
  branches?: string[];
}
interface RuntimeMemoryMutation {
  action: RuntimeMemoryAction;
  target: RuntimeMemoryTarget;
  content?: string;
  oldText?: string;
  importance?: RuntimeMemoryImportance;
  /** Git branch names limiting where a target=memory entry is projected. Absent keeps the current scope on replace; an empty list clears it. */
  branches?: string[];
}
type RuntimeMemoryMutationResult = {
  success: true;
  message: string;
  target: RuntimeMemoryTarget;
  entryCount: number;
  usage: RuntimeMemoryUsage;
  added?: string;
  replaced?: {
    from: string;
    to: string;
  };
  removed?: string;
  /** MEMORY.md entries a compaction moved to the local archive, when it ran with `archive: 'local'`. */
  archived?: {
    entries: number;
    path: string;
  };
  maintenance?: {
    kind: 'local-compaction' | 'mnemon-archive' | 'local-archive';
    runId: string;
    provider: string;
    summary: string;
    memoryBodyIds: string[];
  };
};
interface RuntimeMemoryMaintenancePlan {
  revision: string;
  action: RuntimeMemoryAction;
  target: RuntimeMemoryTarget;
  entries: RuntimeMemoryEntry[];
  pending?: RuntimeMemoryCompactedEntry;
  excluded?: RuntimeMemoryEntry;
  used: number;
  projected: number;
  limit: number;
  requiresMaintenance: boolean;
  /** This Runtime Source moves the entries compaction leaves out to its local archive when asked (#336). */
  localArchive?: true;
}
declare const RUNTIME_MEMORY_VERSION = 1;
declare const RUNTIME_ENTRY_DELIMITER = "\n§\n";
/** Per target, including labels and annotations. Fits both targets in the default light View. */
declare const RUNTIME_PINNED_PROJECTION_LIMIT = 1536;
declare function runtimePinnedProjection(entries: readonly RuntimeMemoryEntry[], target: RuntimeMemoryTarget): string;
declare function assertRuntimePinnedBudget(entries: readonly RuntimeMemoryEntry[]): void;
interface RuntimeMemoryLimits {
  readonly memory: number;
  readonly user: number;
}
declare const RUNTIME_MEMORY_LIMITS: RuntimeMemoryLimits;
/** The largest limit, in UTF-8 bytes, either target's file may be given. */
declare const RUNTIME_MEMORY_LIMIT_MAX_BYTES: number;
/** The longest git branch name a scope may hold. */
declare const RUNTIME_BRANCH_NAME_MAX = 128;
/** The characters a git branch name in a scope may use. */
declare const RUNTIME_BRANCH_NAME_PATTERN: RegExp;
/**
 * Read a stored branch scope. Absent or malformed data reads as no scope, so an entry that
 * a hand edit or another installation left malformed is projected on every branch instead
 * of breaking the projection that reads it.
 */
declare function parseRuntimeBranches(value: unknown): string[] | undefined;
/** The Runtime Source's directory under a storage root. */
declare const RUNTIME_DIRECTORY = "runtime";
/** The entries themselves, the source of truth the projections are written from. */
declare const RUNTIME_MEMORIES_FILE = "memories.json";
/** Each target's projection: its entries' plain content, the file a person reads. */
declare const RUNTIME_PROJECTION_FILES: {
  readonly user: "USER.md";
  readonly memory: "MEMORY.md";
};
/** Created exclusively while the files above are read or written; whoever copies them takes it too. */
declare const RUNTIME_LOCK_FILE = ".memories.lock";
/** A lock file older than this was left by a process that stopped, and may be taken over. */
declare const RUNTIME_LOCK_STALE_MS = 30000;
/** The local archive of entries that left MEMORY.md while no Memory Space could take them (#336). */
declare const RUNTIME_ARCHIVE_DIRECTORY = "archived";
/** The longest content one entry may hold, in UTF-8 bytes. */
declare const RUNTIME_ENTRY_MAX_BYTES: number;
type RuntimeEntryText = Pick<RuntimeMemoryEntry, 'target' | 'content'>;
/** The UTF-8 bytes one target's entries take against its limit: their contents joined by the delimiter. */
declare function runtimeBytes(entries: ReadonlyArray<RuntimeEntryText>, target: RuntimeMemoryTarget): number;
/** One target's projection file, USER.md or MEMORY.md, exactly as the Runtime Source writes it. */
declare function runtimeProjection(entries: ReadonlyArray<RuntimeEntryText>, target: RuntimeMemoryTarget): string;
/** What a stored memories.json holds, counted without judging each entry. */
interface RuntimeMemoriesSummary {
  /** Whether the file has an entry list at all. Without one, every count is 0. */
  valid: boolean;
  /** Every entry that is an object, whatever its target. */
  entries: number;
  user: number;
  memory: number;
}
/**
 * Count the entries of a parsed memories.json for a read-only inventory. It never throws: a file
 * without an entry list is not `valid`, and a malformed entry is counted or skipped, never refused.
 */
declare function summarizeRuntimeMemories(value: unknown): RuntimeMemoriesSummary;
//#endregion
export { RUNTIME_ARCHIVE_DIRECTORY, RUNTIME_BRANCH_NAME_MAX, RUNTIME_BRANCH_NAME_PATTERN, RUNTIME_DIRECTORY, RUNTIME_ENTRY_DELIMITER, RUNTIME_ENTRY_MAX_BYTES, RUNTIME_LOCK_FILE, RUNTIME_LOCK_STALE_MS, RUNTIME_MEMORIES_FILE, RUNTIME_MEMORY_LIMITS, RUNTIME_MEMORY_LIMIT_MAX_BYTES, RUNTIME_MEMORY_VERSION, RUNTIME_PINNED_PROJECTION_LIMIT, RUNTIME_PROJECTION_FILES, RuntimeMemoriesSummary, RuntimeMemoryAction, RuntimeMemoryCompactedEntry, RuntimeMemoryEntry, RuntimeMemoryEntryOrigin, RuntimeMemoryImportance, RuntimeMemoryLimits, RuntimeMemoryMaintenancePlan, RuntimeMemoryMutation, RuntimeMemoryMutationResult, RuntimeMemorySnapshot, RuntimeMemoryTarget, RuntimeMemoryTargetView, RuntimeMemoryUsage, assertRuntimePinnedBudget, parseRuntimeBranches, runtimeBytes, runtimePinnedProjection, runtimeProjection, summarizeRuntimeMemories };