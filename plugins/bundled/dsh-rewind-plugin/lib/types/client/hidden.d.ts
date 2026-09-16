/**
 * Pure computation of the chat rows a rewind hides from the rendered
 * transcript. Extracted from the client plugin (`src/client/index.ts`) so the
 * multi-rewind cut logic stays unit-testable without a DOM.
 *
 * @module dsh-rewind/client/hidden
 */
import type { CommandNode } from '@deepseek-ai/dsh-client-ui-conversation/client';
/** A chat-snapshot view node as the hiding / composer-refill logic reads it.
 * The harness's view node shape plus the `anchorSeq` the chat snapshot carries
 * (the plugin reads `anchorSeq` off each node; it is not declared on the
 * harness's `ConversationViewNode`). */
export interface ChatConversationViewNode {
    readonly key: string;
    readonly kind?: string;
    readonly data?: unknown;
    readonly anchorSeq: number;
}
/** Minimal chat snapshot reader the hiding logic needs. */
export interface HiddenChat {
    readonly order: readonly string[];
    readonly nodes: {
        get(key: string): ChatConversationViewNode | undefined;
    };
}
/**
 * Reader for one session's live chat snapshot. On the 0.1.2-rc.1 line (the
 * plugin's single baseline) the chat is served by the `uiConversation`
 * service's named "chat" view (contributed by dsh-client-ui-chat through the
 * uiSession slot hook).
 */
export type ChatOf = (session: {
    readonly sessionId: string;
} | undefined) => HiddenChat | undefined;
/**
 * Subscribe to one session's live chat-update signal, for waiting on a chat
 * snapshot change without polling. The 0.1.2-rc.1 `uiConversation` "chat"
 * view's own `subscribe` is the chat-update signal; `cb` fires whenever the
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
 * degrades to `undefined` (no targets, no hiding — never a crash).
 */
export declare function chatSnapshotOf(chatView: {
    getSnapshot(): unknown;
} | undefined): HiddenChat | undefined;
/**
 * The plain text of the human message at `seq` in the chat snapshot, for
 * filling the composer after a withdraw. Accepts BOTH `user` and `steering`
 * nodes: a plan-mode (`/plan <text>`) input is delivered through the agent
 * inbox next-step and claimed, so it renders as `steering`, and its text must
 * still return to the composer (`portals.tsx` `runRewindAndFill`) — the old
 * `user`-only read silently left it empty. State absent → undefined; a message
 * with no text blocks → ''. Same text-blocks join the candidate side uses.
 */
export declare function messageTextAt(chat: HiddenChat | undefined, seq: number): string | undefined;
/**
 * Extract the rewind target seq from a `/rewind` command's structured `args`
 * (e.g. `@5 chat`, `preview @5 both`). Locale-independent — never parses the
 * host's human outcome copy.
 */
export declare function targetSeqOfArgs(args: string | null | undefined): number | undefined;
/**
 * True when a `/rewind` command node is an EXECUTED rewind for `seq` — the
 * admission form the popover drives (`@<seq> chat` / `both`) that settled
 * with a marker-carrying success outcome. The composer refill waits for
 * exactly this node after the user confirms, so a history-loaded command can
 * never trigger a fill.
 */
export declare function isExecutedRewindCommand(node: CommandNode, seq: number): boolean;
/**
 * Whether a preview outcome reports tracked file changes — the availability
 * of the "rewind conversation and code" option (Claude Code hides the
 * code-restore options when the checkpoint has no tracked changes).
 *
 * Reads ONLY the machine-readable `impact=<n>` trailer the host appends to
 * preview text. Older host output without the trailer is treated as having no
 * changes (never guesses from human copy). Unknown/absent text degrades to
 * always-show so a working option is never hidden on a failed probe.
 */
export declare function hasFileImpact(text: string | undefined): boolean;
/**
 * True when a `/rewind` command node is the internal candidate-list probe
 * (`/rewind __candidates`) the popupSelect runs to fetch the FULL candidate
 * list from the host. Like previews, its flow node never surfaces in the
 * transcript — it only feeds the popup — so it is hidden in every state.
 */
export declare function isCandidateCommand(command: CommandNode): boolean;
/**
 * Anchor seqs that must be hidden from the rendered transcript so the user
 * sees the conversation as the agent sees it: every impact-preview flow node
 * (pending, succeeded, or errored — it only exists to feed the popover) and
 * every SUCCESSFUL executed `/rewind` command row, plus every message
 * withdrawn by a rewind — the target message itself, everything after it, and
 * the (unrendered) marker.
 *
 * Each executed rewind cuts ONE span `[target, marker]`: the target message
 * and everything after it, up to the marker appended at rewind time. Spans are
 * kept SEPARATE (never collapsed to a single `[min target, max marker]`)
 * because a later rewind to a LATER point leaves a visible gap of new traffic
 * between the earlier marker and the later target — collapsing the spans would
 * hide that still-on-surface gap. Endpoints come from the command nodes:
 * `sourceEventSeq` is the marker's log seq, and the outcome text carries the
 * target seq.
 */
export declare function hiddenSeqsOf(snap: HiddenChat): Set<number>;
