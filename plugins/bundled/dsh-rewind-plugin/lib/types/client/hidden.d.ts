/**
 * Pure Chat-snapshot readers and executed-rewind cut derivation.
 *
 * @module dsh-rewind/client/hidden
 */
import type { CommandNode } from '@deepseek-ai/dsh-client-ui-conversation/client';
/**
 * The internal engine channel every client call is sent to. Mirrored by
 * `ENGINE_COMMAND` in `src/index.ts` — the two bundles share no module.
 */
export declare const ENGINE_COMMAND = "rewind-plugin";
/** Legacy engine command name. */
export declare const LEGACY_ENGINE_COMMAND = "rewind";
/** Engine command names the client recognizes. */
export declare const ENGINE_COMMANDS: ReadonlySet<string>;
/** A Chat-snapshot view node as the client readers see it. */
export interface ChatConversationViewNode {
    readonly key: string;
    readonly kind?: string;
    readonly data?: unknown;
    readonly anchorSeq: number;
    /** Owning Turn, when the node has one (used by the visibility summary pass). */
    readonly location?: {
        readonly turn?: {
            readonly turn?: unknown;
            readonly start?: unknown;
        };
    };
    /** Chat-only row visibility; absent on older test doubles. */
    readonly visibility?: 'visible' | 'hidden';
}
/** Minimal Chat-snapshot reader the client helpers need. */
export interface HiddenChat {
    readonly order: readonly string[];
    readonly nodes: {
        get(key: string): ChatConversationViewNode | undefined;
        /** Every materialized node, including hidden ones. Absent on older snapshots. */
        values?(): readonly ChatConversationViewNode[];
    };
}
/**
 * Every materialized Chat node, preferring the store's own values (which also
 * includes rows the visibility layer hid) and falling back to the visible
 * order for older snapshots / test doubles.
 * @param chat - the live chat snapshot, when available.
 * @returns all nodes in store insertion order.
 */
export declare function chatNodesOf(chat: HiddenChat | undefined): readonly ChatConversationViewNode[];
/**
 * Reader for one session's live chat snapshot: the chat is served by the
 * `uiConversation` service's named "chat" view (contributed by
 * dsh-client-ui-chat through the uiSession slot hook).
 */
export type ChatOf = (session: {
    readonly sessionId: string;
} | undefined) => HiddenChat | undefined;
/**
 * Subscribe to one session's live chat-update signal, for waiting on a chat
 * snapshot change without polling. The `uiConversation` "chat" view's own
 * `subscribe` is the chat-update signal; `cb` fires whenever the
 * chat snapshot invalidates.
 */
export type ChatWatch = (sessionId: string, cb: () => void) => () => void;
/**
 * Choose the chat-update subscription for `waitForCommand`: the
 * `uiConversation` "chat" view's own `subscribe`. Extracted as a pure
 * channel-selection step so the resolver is unit-testable; the resolver is
 * injected by the caller (see `watchChat` in index.ts). Never throws.
 */
export declare function resolveChatWatch(resolveView: (sessionId: string) => {
    subscribe?(cb: () => void): () => void;
} | undefined, sessionId: string, cb: () => void): () => void;
/**
 * Resolve the chat snapshot from the `uiConversation` "chat" view. The view's
 * `getSnapshot()` returns undefined until the named view is registered, which
 * degrades to `undefined` (no targets — never a crash).
 */
export declare function chatSnapshotOf(chatView: {
    getSnapshot(): unknown;
} | undefined): HiddenChat | undefined;
/**
 * The plain text of the human message at `seq` in the chat snapshot, for
 * filling the composer after a withdraw. Accepts BOTH `user` and `steering`
 * nodes: a plan-mode (`/plan <text>`) input is delivered through the agent
 * inbox next-step and claimed, so it renders as `steering`, and its text must
 * still return to the composer (`rewind-flow.ts` `runRewindAndFill`). State absent
 * → undefined; a message with no text blocks → ''. Same text-blocks join the
 * candidate side uses.
 */
export declare function messageTextAt(chat: HiddenChat | undefined, seq: number): string | undefined;
/**
 * A durable image reference carried by an `image` content block in the chat
 * snapshot, read structurally (the harness's `ImageAttachmentRef` from
 * dsh-attachment, without importing it, so the plugin survives harness
 * drift). The fields are optional here so the reader tolerates older or
 * partial snapshots; the image read only runs for a complete reference.
 */
export interface MessageImageRef {
    readonly attachmentId: string;
    readonly mediaType: string;
    readonly bytes?: number;
    readonly width?: number;
    readonly height?: number;
    readonly name?: string;
}
/** One wire content block that may carry a durable image reference. */
export interface ImageBlockLike {
    readonly type?: string;
    readonly attachment?: {
        readonly attachmentId?: unknown;
        readonly mediaType?: unknown;
        readonly bytes?: unknown;
        readonly width?: unknown;
        readonly height?: unknown;
        readonly name?: unknown;
    };
}
/**
 * Image references carried by a message's content blocks, in order.
 * Malformed and non-image blocks are skipped; `file` blocks are not restorable.
 * @param content - one message's content blocks.
 * @returns the image references, in message order.
 */
export declare function imageRefsOf(content: readonly ImageBlockLike[] | undefined): readonly MessageImageRef[];
/**
 * The durable image references of the human message at `seq` in the chat
 * snapshot, in message order. The composer-refill counterpart of
 * `messageTextAt` (see `rewind-flow.ts` `runRewindAndFill`): rewinding an
 * image-bearing message restores its pictures into the composer so the
 * withdraw does not silently drop them.
 *
 * Reads the same node kinds as `messageTextAt` (`user` and `steering`).
 * Blocks tolerate malformed or missing references (skipped, never a throw),
 * and `image/offload` projections leave the durable reference in place —
 * which is all the host image read needs. `file` blocks are intentionally
 * excluded: the harness exposes no client-side file-bytes loader (file
 * uploads go one-way), so a file is not restorable.
 * State absent → undefined; a message without images → [].
 */
export declare function messageAttachmentsAt(chat: HiddenChat | undefined, seq: number): readonly MessageImageRef[] | undefined;
/**
 * Extract the rewind target seq from a `/rewind` command's structured `args`
 * (e.g. `@5 chat`). Locale-independent — never parses the
 * host's human outcome copy.
 */
export declare function targetSeqOfArgs(args: string | null | undefined): number | undefined;
/**
 * True when one of this plugin's engine command nodes is an EXECUTED rewind for
 * `seq` — the admission form the popover drives (`@<seq> chat` / `both`) that
 * settled with a marker-carrying success outcome. The composer refill waits for
 * exactly this node after the user confirms, so a history-loaded command can
 * never trigger a fill.
 */
export declare function isExecutedRewindCommand(node: CommandNode, seq: number): boolean;
/** One executed rewind's cut: the target seq through the marker's seq, inclusive. */
export interface RewindCut {
    /** First withdrawn anchor seq. */
    readonly target: number;
    /** Marker log seq, the last withdrawn anchor seq. */
    readonly marker: number;
}
/**
 * Read every executed rewind cut from a node set. Internal probes never
 * contribute; a success without a marker rewound nothing; a command whose
 * args carry no `@<seq>` target has no recoverable span.
 * @param nodes - every materialized Chat node.
 * @returns one cut per marker-carrying successful engine command, in input order.
 */
export declare function rewindCutsOf(nodes: Iterable<ChatConversationViewNode>): RewindCut[];
