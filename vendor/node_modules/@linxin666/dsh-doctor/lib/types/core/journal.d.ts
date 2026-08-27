import type { FsLike } from './fs.ts';
import type { JournalEntry } from './types.ts';
export interface JournalDeps {
    fs: FsLike;
    /** Absolute journal file path. */
    file: string;
    /** ISO timestamp provider. */
    now(): string;
}
export interface Journal {
    append(entry: {
        op: string;
        ok: boolean;
        detail?: Record<string, unknown>;
    }): Promise<JournalEntry>;
    /** Replay all entries; corrupted lines are skipped and counted. */
    replay(): Promise<{
        entries: JournalEntry[];
        corrupted: number;
    }>;
    /** Absolute journal path. */
    readonly path: string;
}
/** Create a journal rooted at a directory (journal.jsonl). */
export declare function createJournal(deps: JournalDeps): Journal;
/** Convenience default journal path builder. */
export declare function defaultJournalPath(home: string): string;
