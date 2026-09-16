/**
 * Pure rewind planning: target resolution and surface-range computation.
 * No I/O and no `Session` dependency — everything derives from the event log
 * and the ordered surface, so this module stays unit-testable.
 *
 * Rewind semantics (see README): rewinding to a user message appends a marker
 * node into the session log whose `surfaceOp` replaces every surface node
 * AFTER the target with itself. The log (the audit trail and the rendered
 * transcript) is untouched; only the model-visible surface is cut, so the
 * next request derives its context from the target message onward.
 *
 * Marker shape (v0.1.5/v3): the marker is a `user/message` carrying a replace
 * `surfaceOp` — a single event:
 *
 *   user/message (marker content) → { surfaceOp {replace, startSeq, endSeq} }
 *
 * v2 reserves surface `replace` to a node that cites every shadowed seq via
 * `sourceEventSeqs`, and `assistant/message` can no longer carry
 * `sourceEventSeqs` (it now embeds its provider stream instead) — so the
 * replacement node must be a `user/message`, exactly as /compact's checkpoint
 * is. No ghost `step/start`…`step/end` frame is needed: the token-meter's
 * step state machine ignores `user/message`, and the session invariant
 * (`invariant.ts`) imposes no open-turn requirement on it, so the marker is
 * appended while idle, outside any turn. It sits at the surface tail as the
 * model-visible "cut point" — a present user turn in derived history.
 *
 * @module dsh-rewind/rewind
 */
import type { MessageSource } from '@deepseek-ai/dsh-llm/message';
import type { SessionEvent, UserMessage } from '@deepseek-ai/dsh-session';
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
    /** Target user message seq (stays on the surface). */
    readonly targetSeq: number;
    /** The target's ordered position in the surface. */
    readonly targetIndex: number;
    /** Ordered surface node seqs the rewind shadows (everything after the target). */
    readonly shadowedSeqs: readonly number[];
    /** First surface node after the target — the replace range start (inclusive). */
    readonly surfaceStart: number;
    /** Last surface node — the replace range end (inclusive). */
    readonly surfaceEnd: number;
}
/**
 * The rewind-marker source: the backend-independent identity carried by every
 * marker the plugin appends. It is the plain third-party plugin source shape
 * `{ kind: 'plugin', plugin: 'dsh-rewind' }` — no extra fields, because a
 * plugin source is a CLOSED shape in the harness (only `kind`/`plugin`, plus
 * the context-injection `form`/`sections`/`summary`; see `MessageSourceMap` and
 * the released-format source validator). A plugin extends the source map by
 * adding a new `kind`, never by hanging private fields off `plugin`.
 */
export declare const REWIND_MARKER_SOURCE: Readonly<{
    readonly kind: 'plugin';
    readonly plugin: 'dsh-rewind';
}>;
/**
 * Test whether a persisted message source identifies a rewind marker.
 * @param source - source restored from a surface user message.
 * @returns whether the source carries the backend-independent rewind brand.
 */
export declare function isRewindMarker(source: MessageSource): boolean;
/** Preview length cap for candidate listings. */
export declare const CANDIDATE_PREVIEW_CHARS = 80;
/**
 * Default cap on how many user messages a candidate listing returns (newest
 * kept). Matches the snapshot store's MAX_ANCHOR_GROUPS (100), so every
 * anchor group that still has restorable file backups is listed; callers can
 * still pass an explicit `limit`.
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
 * Parse a raw command token into a rewind target.
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
/** Header line of the machine-readable candidate list (locale-independent). */
export declare const CANDIDATE_LIST_HEADER = "candidates=";
/**
 * Encode a candidate list as the host→client machine channel (the same
 * trailer pattern `formatPlan` uses for `impact=`). The client popupSelect
 * parses this instead of reading the windowed chat snapshot, so the candidate
 * list reflects the FULL host surface — not just the already-loaded history.
 *
 * Lines (each preview is already whitespace-collapsed and tab-free by
 * `messagePreview`):
 *   candidates=<n>
 *   <seq>\t<time>\t<preview>
 *   … (one line per candidate, newest first, matching `listRewindCandidates`)
 *
 * A list with no candidates is just `candidates=0`.
 */
export declare function formatCandidateList(candidates: readonly RewindCandidate[]): string;
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
