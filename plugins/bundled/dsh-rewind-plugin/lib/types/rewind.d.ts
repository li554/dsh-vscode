/**
 * Pure rewind planning: target resolution and surface-range computation.
 * No I/O and no `Session` dependency — everything derives from the event log
 * and the ordered surface, so this module stays unit-testable.
 *
 * Rewind semantics: rewinding to a user message appends a marker node into the
 * session log whose `surfaceOp` replaces the target and every surface node
 * after it with itself. The log (audit trail, rendered transcript) is
 * untouched; only the model-visible surface is cut, so the next request
 * derives its context from before the target message. The marker is a `user/message` carrying a
 * replace `surfaceOp` and the producer-owned source `{ kind: 'dsh-rewind' }`
 * (see `marker.ts`); the shape's invariants and history are documented in
 * `docs/architecture.md`.
 *
 * @module dsh-rewind/rewind
 */
import type { SessionEvent, UserMessage } from '@deepseek-ai/dsh-session';
export { REWIND_MARKER_SOURCE } from './marker.ts';
/** Which of the two rewind modes a rewind executes. */
export type RewindMode = 'chat' | 'both';
/**
 * Parse-level rewind target. The command line accepts both forms:
 * - `@<seq>` — an absolute log seq (what the UI button always sends);
 * - `<index>` — a 1-based recency index into the listed candidates
 *   (1 = most recent user message; the step-by-step command flow uses this).
 */
export type RewindTarget = {
    kind: 'seq';
    seq: number;
} | {
    kind: 'index';
    index: number;
};
/** Expected failure codes; each maps to a concise human outcome. */
export type RewindErrorCode = 'no-user-messages' | 'invalid-index' | 'not-a-user-message' | 'not-on-surface';
/** A typed rewind failure. The host renders `code` into user-facing copy. */
export declare class RewindError extends Error {
    readonly code: RewindErrorCode;
    constructor(code: RewindErrorCode, message: string);
}
/** One selectable rewind candidate: a user message currently on the surface. */
export interface RewindCandidate {
    /** Absolute log seq of the `user/message` event. */
    readonly seq: number;
    /** Unix epoch ms of the event. */
    readonly time: number;
    /** Truncated plain-text preview of the message content. */
    readonly preview: string;
    /** 1-based recency index in the candidate list (1 = most recent). */
    readonly index: number;
}
/** A validated rewind: the target plus the exact surface range to shadow. */
export interface RewindPlan {
    /** Target user message seq (withdrawn with the surface range). */
    readonly targetSeq: number;
    /** The target's ordered position in the surface. */
    readonly targetIndex: number;
    /** Ordered surface node seqs the rewind shadows (the target and everything after it). */
    readonly shadowedSeqs: readonly number[];
    /** The target — the replace range start (inclusive). */
    readonly surfaceStart: number;
    /** Last surface node — the replace range end (inclusive). */
    readonly surfaceEnd: number;
}
/** Preview length cap for candidate listings. */
export declare const CANDIDATE_PREVIEW_CHARS = 80;
/**
 * Default cap on how many user messages a candidate listing returns (newest
 * kept). Matches the checkpoint store's retention window (100), so every
 * message that can still have a file checkpoint is listed; callers can still
 * pass an explicit `limit`.
 */
export declare const DEFAULT_CANDIDATE_LIMIT = 100;
/** Narrow an event to a user message. */
export declare function isUserMessageEvent(event: SessionEvent): event is SessionEvent<'user/message'>;
/**
 * True for a HUMAN user message event — one whose `source.kind` is `'user'`.
 *
 * The surface can carry `user/message` events whose source is NOT the user:
 * plugin/system context injection (including compaction checkpoints) and
 * tool-result backfill all arrive as `user/message` with a non-`'user'`
 * source, and the client renders those as `context` nodes, never as a user
 * bubble. Only genuine user messages (and user steering during a running
 * turn, which keeps `source.kind: 'user'`) are valid rewind targets — a
 * rewind boundary must land on a human prompt, not on injected context.
 */
export declare function isHumanUserMessageEvent(event: SessionEvent): event is SessionEvent<'user/message'>;
/** Join the text blocks of a message into one plain string. */
export declare function messagePreview(message: UserMessage): string;
/**
 * Parse a raw command token into a rewind target. Both forms must be plain
 * decimal integers: a bare `Number()` would also accept `@1e3`, `@0x10` and
 * `@+5`, and would read a bare `@` as seq 0.
 * @param raw - one token: `@123` (absolute seq) or `12` (recency index).
 * @returns the parsed target, or undefined when the token is malformed.
 */
export declare function parseRewindTarget(raw: string): RewindTarget | undefined;
/**
 * List the selectable rewind candidates: user messages currently on the
 * surface, most recent first. Shadowed (compacted-away) user messages are
 * intentionally excluded — the rewind boundary cannot be placed where the
 * model context no longer reaches.
 * @param events - the full session event log.
 * @param surface - the ordered surface node seqs (`session.surface.nodes`).
 * @param limit - maximum number of candidates to return.
 * @returns candidates numbered 1..N by recency.
 */
export declare function listRewindCandidates(events: readonly SessionEvent[], surface: readonly number[], limit?: number): RewindCandidate[];
/**
 * Resolve a target against the session log and surface into a validated plan.
 * @param events - the full session event log.
 * @param surface - the ordered surface node seqs.
 * @param target - the parsed target.
 * @returns the validated rewind plan.
 * @throws {RewindError} with a typed code when the target is unusable.
 */
export declare function planRewind(events: readonly SessionEvent[], surface: readonly number[], target: RewindTarget): RewindPlan;
/** Human rendering of a candidate list line (`/rewind` step 1). */
export declare function formatCandidate(candidate: RewindCandidate): string;
