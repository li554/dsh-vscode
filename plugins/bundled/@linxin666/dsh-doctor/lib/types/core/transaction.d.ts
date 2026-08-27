/**
 * Candidate transaction: stage, promote, rollback, commit.
 *
 * Promotion moves the live profile aside into quarantine, then moves the
 * staged candidate into place. Both moves use the same-filesystem-friendly
 * movePath (rename, with EXDEV copy fallback), and every step is journaled
 * so a crash can be replayed: nothing is ever deleted without its evidence.
 */
import type { FsLike } from './fs.ts';
import type { CandidatePhase, CandidateRecord } from './types.ts';
export interface CandidateTransactionDeps {
    fs: FsLike;
    home: string;
    profile: string;
    /** ISO timestamp provider for the record. */
    now(): string;
    /** Closure for deterministic ids: txn = profile + '-' + nowCompact. */
    txnId?(profile: string): string;
    /** Optional journal to record every step. */
    journal?: {
        append(entry: {
            op: string;
            ok: boolean;
            detail?: Record<string, unknown>;
        }): Promise<unknown>;
    };
    /** Restore a previously staged transaction for explicit confirmation. */
    initialRecord?: CandidateRecord;
    /** Optional same-device assertion; when provided and false, promote refuses. */
    sameDevice?(a: string, b: string): Promise<boolean>;
    /** Persist recovery intent while the candidate is still staged. */
    beforePromote?(record: CandidateRecord): Promise<void>;
    /** Revalidate the caller's ownership before any compensating live move. */
    beforeCompensation?(): Promise<void>;
}
export interface CandidateTransaction {
    readonly txnId: string;
    readonly record: CandidateRecord;
    phase(): CandidatePhase;
    /** Copy the live profile files into staging (never touches live). */
    stage(): Promise<void>;
    /** Swap staged candidate into the live location, quarantining the original. */
    promote(): Promise<void>;
    /** Undo a promote, restoring the quarantined original. */
    rollback(): Promise<void>;
    /** Abort a staged (not promoted) transaction, discarding staging. */
    abort(): Promise<void>;
    /** Mark the promotion final and keep the quarantine as evidence. */
    commit(): Promise<void>;
}
/** Create a candidate transaction for one profile. */
export declare function createCandidateTransaction(deps: CandidateTransactionDeps): CandidateTransaction;
