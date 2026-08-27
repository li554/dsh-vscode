/**
 * Retry policy: failure detection, recoverability classification and retry
 * planning over a ConversationSnapshot. Pure and framework-free so both the
 * transcript UI and the supervisor share one decision source.
 */
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client';
/** Additional retries after the first (failed) attempt, per the issue contract. */
export declare const MAX_EXTRA_RETRIES = 5;
/** Exponential backoff delays for attempts 1..5 (1s, 2s, 4s, 8s, 16s). */
export declare const BACKOFF_DELAYS_MS: readonly [1000, 2000, 4000, 8000, 16000];
/** One terminal failure of a completed turn. */
export interface TurnFailure {
    kind: 'turn-error' | 'interrupted' | 'max-tokens';
    turn: number;
    turnEndSeq: number;
    message: string | null;
    code: string | null;
    hasTools: boolean;
}
/** What re-running the failed turn needs: the original text and the fork anchor. */
export interface RetryPlan {
    /** Verbatim user text of the failed turn (text-only; images are never replayed). */
    text: string;
    /**
     * Fork anchor: the latest completed turn/end before the failed turn. Null
     * when the failed turn was the first turn: the supervisor then falls back
     * to a fresh blank session in the same workspace.
     */
    forkAtSeq: number | null;
    /** Seq of the user message that opened the failed turn. */
    messageSeq: number;
}
export type RetryVerdict = {
    action: 'none';
} | {
    action: 'auto';
    failure: TurnFailure;
    plan: RetryPlan;
} | {
    action: 'manual';
    failure: TurnFailure;
};
/**
 * The terminal failure of the LAST completed turn, when one exists. Running
 * sessions never produce a failure: a turn that is still going is not failed.
 * @param snapshot - the live conversation snapshot.
 * @returns the failure descriptor, or null when the last turn did not fail.
 */
export declare function failureOfLastTurn(snapshot: ConversationSnapshot): TurnFailure | null;
/**
 * Recoverable-error classification. Only model/API-level transient failures
 * count as auto-retryable: timeouts, network errors, server errors, rate
 * limits and empty responses. Auth failures, permission errors, invalid
 * arguments, quotas and cancellations are NEVER auto-retried.
 * @param code - machine-routing error code, when present.
 * @param message - human-readable failure text, when present.
 */
export declare function isRetryableError(code: string | null | undefined, message: string | null | undefined): boolean;
/**
 * Build the re-run plan for one failed turn: its original user text plus the
 * fork anchor that cuts history right before it, so a retry branch never
 * repeats the old message and the failed stream fragments never enter the
 * next model request.
 * @param snapshot - the live conversation snapshot.
 * @param turn - the failed turn number.
 * @returns the plan, or null when the turn has no safely-replayable user message.
 */
export declare function planForTurn(snapshot: ConversationSnapshot, turn: number): RetryPlan | null;
/**
 * The full retry decision for the current state of a session. The host's own
 * pending llm/retry chain stands the supervisor down; everything else that is
 * failed but not auto-retryable lands on the manual path (transcript button).
 * @param snapshot - the live conversation snapshot.
 */
export declare function verdictFor(snapshot: ConversationSnapshot): RetryVerdict;
