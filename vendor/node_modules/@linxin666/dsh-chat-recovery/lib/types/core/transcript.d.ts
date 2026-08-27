/**
 * Pure transcript helpers over the client ConversationSnapshot. Both halves
 * of the plugin compile this module; it imports only types from the official
 * NPM SDK and never touches a DSH source checkout.
 */
import type { AssistantMessageNode, ConversationSnapshot, TurnErrorNode, UserMessageNode } from '@deepseek-ai/dsh-client-runtime/client';
import type { ContentBlock } from '@deepseek-ai/dsh-client-connection/client';
/**
 * The last completed user message of a session, plus everything the edit
 * flow needs to re-submit it from the position BEFORE that message.
 */
export interface EditTarget {
    /** Verbatim joined text of the message (all blocks are text blocks). */
    text: string;
    /** Seq of the user message being edited. */
    seq: number;
    /** The turn that contains the message (its turn/end exists and is > seq). */
    turn: number;
    /** Seq of that turn's turn/end event. */
    turnEndSeq: number;
    /**
     * Fork anchor: the latest completed turn/end strictly before the message.
     * Forking at this anchor yields a child whose history ends before the
     * message, so the edited branch never duplicates it. Null when the message
     * opens the first turn (no earlier turn/end exists): the edit flow then
     * falls back to a fresh blank session in the same workspace instead.
     */
    forkAtSeq: number | null;
}
/**
 * Extract verbatim text from a user message. Returns null unless EVERY block
 * is a text block: image/attachment messages cannot be safely copied into a
 * re-submitted prompt and are therefore not editable.
 * @param content - the durable user message blocks.
 * @returns the joined text, or null when any block is non-text.
 */
export declare function userText(content: readonly ContentBlock[]): string | null;
/**
 * Resolve the edit target: the LAST user message, provided the session is not
 * running/removed and the message's turn has ended. Steering, context and
 * system nodes are never considered.
 * @param snapshot - the live conversation snapshot.
 * @returns the edit target, or null when nothing is editable right now.
 */
export declare function lastCompletedUserTarget(snapshot: ConversationSnapshot): EditTarget | null;
/**
 * The seq of the event right before the given turn started: the latest
 * turn/end of any earlier turn, or 0 for the first turn.
 * @param snapshot - the live conversation snapshot.
 * @param turn - the turn number.
 * @returns the boundary seq (exclusive start of the turn).
 */
export declare function turnStartSeq(snapshot: ConversationSnapshot, turn: number): number;
/**
 * The last user message inside one turn (the turn opener).
 * @param snapshot - the live conversation snapshot.
 * @param turn - the turn number.
 * @returns the message node, or null when the turn has none in-window.
 */
export declare function lastUserInTurn(snapshot: ConversationSnapshot, turn: number): UserMessageNode | null;
/**
 * Whether the turn ran any tool call or slash command. Re-running such a turn
 * would repeat side effects, so the retry policy treats tool-involved turns
 * as manual-only (never auto-retried).
 * @param snapshot - the live conversation snapshot.
 * @param turn - the turn number.
 */
export declare function turnHasToolActivity(snapshot: ConversationSnapshot, turn: number): boolean;
/** The interruption-frozen assistant partial of one turn, when present. */
export declare function interruptedAssistantInTurn(snapshot: ConversationSnapshot, turn: number): AssistantMessageNode | null;
/** The durable terminal error node of one turn, when present. */
export declare function turnErrorInTurn(snapshot: ConversationSnapshot, turn: number): TurnErrorNode | null;
/** Whether the turn hit the per-request output-token cap. */
export declare function maxTokensInTurn(snapshot: ConversationSnapshot, turn: number): boolean;
/**
 * Whether the HOST already owns a pending retry for this turn (llm/retry
 * chain scheduled or started). While the host is retrying, the client
 * supervisor must stand down: acting would double the retry traffic.
 */
export declare function hostRetryPending(snapshot: ConversationSnapshot, turn: number): boolean;
/** Whether the turn settled with a finalized (messageId-bearing) assistant message. */
export declare function assistantFinalizedInTurn(snapshot: ConversationSnapshot, turn: number): boolean;
/** Count of durable user messages in the window (duplicate-message guard). */
export declare function userNodeCount(snapshot: ConversationSnapshot): number;
/**
 * User messages with seq at or below the given boundary (the history prefix a
 * fork keeps). Used to compute how many user messages a retry child is
 * EXPECTED to carry: prefix count plus the one replayed message.
 */
export declare function userNodeCountBefore(snapshot: ConversationSnapshot, boundarySeq: number): number;
/** The latest completed turn number, or null when none exists in-window. */
export declare function lastTurnOf(snapshot: ConversationSnapshot): number | null;
