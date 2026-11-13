export type RuntimeMemoryTarget = 'memory' | 'user';
export type RuntimeMemoryImportance = 'critical' | 'normal' | 'low';
export type RuntimeMemoryAction = 'add' | 'replace' | 'remove';
/** Provenance a DSH Host stamps when an entry crosses machines; absent for local writes. */
export interface RuntimeMemoryEntryOrigin {
    machine: string;
    label: string;
    at: string;
}
export interface RuntimeMemoryEntry {
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
export interface RuntimeMemoryUsage {
    used: number;
    limit: number;
}
export interface RuntimeMemoryTargetView extends RuntimeMemoryUsage {
    target: RuntimeMemoryTarget;
    entryCount: number;
    markdownPath: string;
    pinned?: {
        count: number;
        characters: number;
        limit: number;
    };
}
export interface RuntimeMemorySnapshot {
    directory: string;
    sourcePath: string;
    revision: string;
    generatedAt: string;
    entries: RuntimeMemoryEntry[];
    targets: Record<RuntimeMemoryTarget, RuntimeMemoryTargetView>;
}
export interface RuntimeMemoryCompactedEntry {
    content: string;
    importance: RuntimeMemoryImportance;
    pinned?: boolean;
    /** Branch scope carried through compaction; absent means the entry is visible on every branch. */
    branches?: string[];
}
export interface RuntimeMemoryMutation {
    action: RuntimeMemoryAction;
    target: RuntimeMemoryTarget;
    content?: string;
    oldText?: string;
    importance?: RuntimeMemoryImportance;
    /** Git branch names limiting where a target=memory entry is projected. Absent keeps the current scope on replace; an empty list clears it. */
    branches?: string[];
}
export type RuntimeMemoryMutationResult = {
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
export interface RuntimeMemoryMaintenancePlan {
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
export declare const RUNTIME_MEMORY_VERSION = 1;
export declare const RUNTIME_ENTRY_DELIMITER = "\n\u00A7\n";
/** Per target, including labels and annotations. Fits both targets in the default light View. */
export declare const RUNTIME_PINNED_PROJECTION_LIMIT = 1536;
export declare function runtimePinnedProjection(entries: readonly RuntimeMemoryEntry[], target: RuntimeMemoryTarget): string;
export declare function assertRuntimePinnedBudget(entries: readonly RuntimeMemoryEntry[]): void;
export interface RuntimeMemoryLimits {
    readonly memory: number;
    readonly user: number;
}
export declare const RUNTIME_MEMORY_LIMITS: RuntimeMemoryLimits;
/** The largest limit, in UTF-8 bytes, either target's file may be given. */
export declare const RUNTIME_MEMORY_LIMIT_MAX_BYTES: number;
/** The longest git branch name a scope may hold. */
export declare const RUNTIME_BRANCH_NAME_MAX = 128;
/** The characters a git branch name in a scope may use. */
export declare const RUNTIME_BRANCH_NAME_PATTERN: RegExp;
/**
 * Read a stored branch scope. Absent or malformed data reads as no scope, so an entry that
 * a hand edit or another installation left malformed is projected on every branch instead
 * of breaking the projection that reads it.
 */
export declare function parseRuntimeBranches(value: unknown): string[] | undefined;
/** The Runtime Source's directory under a storage root. */
export declare const RUNTIME_DIRECTORY = "runtime";
/** The entries themselves, the source of truth the projections are written from. */
export declare const RUNTIME_MEMORIES_FILE = "memories.json";
/** Each target's projection: its entries' plain content, the file a person reads. */
export declare const RUNTIME_PROJECTION_FILES: {
    readonly user: "USER.md";
    readonly memory: "MEMORY.md";
};
/** Created exclusively while the files above are read or written; whoever copies them takes it too. */
export declare const RUNTIME_LOCK_FILE = ".memories.lock";
/** A lock file older than this was left by a process that stopped, and may be taken over. */
export declare const RUNTIME_LOCK_STALE_MS = 30000;
/** The local archive of entries that left MEMORY.md while no Memory Space could take them (#336). */
export declare const RUNTIME_ARCHIVE_DIRECTORY = "archived";
/** The longest content one entry may hold, in UTF-8 bytes. */
export declare const RUNTIME_ENTRY_MAX_BYTES: number;
type RuntimeEntryText = Pick<RuntimeMemoryEntry, 'target' | 'content'>;
/** The UTF-8 bytes one target's entries take against its limit: their contents joined by the delimiter. */
export declare function runtimeBytes(entries: ReadonlyArray<RuntimeEntryText>, target: RuntimeMemoryTarget): number;
/** One target's projection file, USER.md or MEMORY.md, exactly as the Runtime Source writes it. */
export declare function runtimeProjection(entries: ReadonlyArray<RuntimeEntryText>, target: RuntimeMemoryTarget): string;
/** What a stored memories.json holds, counted without judging each entry. */
export interface RuntimeMemoriesSummary {
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
export declare function summarizeRuntimeMemories(value: unknown): RuntimeMemoriesSummary;
export {};
