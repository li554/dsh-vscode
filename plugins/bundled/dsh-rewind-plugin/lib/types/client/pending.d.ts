/**
 * Pending steering input: the agent's unclaimed `next-step` inbox rows and the
 * contract that pairs them with the rendered pre-admission bubbles.
 *
 * The visible bubble is the harness's own projection of the same inbox row, so
 * the pending retract layer (see `pending-mount.tsx`) has no React seat to take
 * over; it matches rendered rows to inbox rows instead. Matching is index-primary
 * (both sides follow host FIFO order) and verified per row, so one bad row only
 * loses its own button.
 *
 * @module dsh-rewind/client/pending
 */
import type { SessionFace } from '@deepseek-ai/dsh-api-session-controller/client';
import { type ImageBlockLike, type MessageImageRef } from './hidden.ts';
/** One wire content block of an inbox row. */
export interface InboxBlockLike extends ImageBlockLike {
    /** Wire block type (`text` | `image` | `file` | …). */
    readonly type: string;
    /** The block's text, on a `text` block. */
    readonly text?: string;
}
/** One pending-inbox row (the `inbox` projection element). */
export interface InboxMessageLike {
    /** Agent-owned inbox occurrence identity; the harness brands it as `MessageId`. */
    readonly id: string;
    /** Wire content blocks, in prompt order. */
    readonly content: readonly InboxBlockLike[];
    /** Message origin; only `kind: 'user'` rows are retractable. */
    readonly source?: {
        readonly kind?: string;
    } | undefined;
}
/** The `inbox` projection value: the agent's pending input folded per target. */
export interface InboxLike {
    /** Messages claimed at the next turn boundary. */
    readonly 'next-turn': readonly InboxMessageLike[];
    /** Messages injected at the next step boundary (user or plugin/command). */
    readonly 'next-step': readonly InboxMessageLike[];
}
/** One rendered pending-steering bubble row (only the fields matching reads). */
export interface PendingRow {
    /** The bubble's message text, excluding the actions container. */
    readonly text: string;
    /** Message-attachment blocks the row renders; compared against the item's count. */
    readonly attachments: number;
}
/** One steering occurrence derived from the session's inbox projection. */
export interface PendingSteeringItem {
    readonly id: string;
    /** Complete editable text; null when the message carries no text block at all. */
    readonly text: string | null;
    /** Non-text blocks the message carries, in prompt order. */
    readonly attachments: number;
    /** Image references the message carries, in prompt order. */
    readonly images: readonly MessageImageRef[];
}
/**
 * The session's `inbox` projection value, or undefined before the fold state
 * exists (a session with no agent loop has no `inbox` key). Never throws: an
 * unregistered projection means "no pending rows".
 * @param session - the session face to read.
 */
export declare function inboxOf(session: SessionFace): InboxLike | undefined;
/**
 * Project the inbox `next-step` rows into the fields the retract path needs.
 *
 * ONLY user-sourced rows are steering: a `next-step` row with another source is
 * injected context, never retracted. Because a retract removes the target AND
 * its future, a non-user row must not enter the list either — it would also
 * shift the positional match and cost every later row its button.
 * @param nextStep - the inbox projection's `next-step` list.
 * @returns one item per user steering row, in host (FIFO) order.
 */
export declare function steeringItemsOf(nextStep: readonly InboxMessageLike[] | undefined): readonly PendingSteeringItem[];
/**
 * Pair rendered rows to steering items by index, verifying the match key per
 * row: the visible text for a text-only message, otherwise the attachment count
 * (the rendered attachment block contributes text no inbox row reproduces).
 * @param rows - pending bubble rows in DOM order (== render order).
 * @param steering - steering items in host order (== render order).
 * @returns the item id for each row, or null for a row that cannot be matched.
 */
export declare function matchPendingRows(rows: readonly PendingRow[], steering: readonly PendingSteeringItem[]): readonly (string | null)[];
/**
 * The steering ids a retract removes: the target occurrence and every steering
 * message after it, in inbox (FIFO) order. Queued (`next-turn`) messages are
 * deliberately excluded — the harness QueueDock already offers per-item
 * edit/remove, and a rewind must not silently drop messages the user may still
 * want to send.
 * @param steering - steering items in host order (== render order).
 * @param targetId - the retract target's inbox occurrence id.
 * @returns the ids to remove, oldest-first; empty when the target is no longer pending.
 */
export declare function retractSpan(steering: readonly {
    readonly id: string;
}[], targetId: string): readonly string[];
