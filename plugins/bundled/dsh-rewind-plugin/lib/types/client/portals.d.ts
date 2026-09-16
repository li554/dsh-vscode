/**
 * dsh-rewind portal half: the per-user-message ↶ rewind button, rendered as a
 * React portal inside the message's `MessageIconActions` row.
 *
 * Why portals (aligned with the copy button's own rendering): the copy button
 * is a React child of the actions row, painted in the same commit as the
 * bubble. A pure-DOM `appendChild` (the earlier approach) lands one microtask
 * later and re-runs a full-transcript scan on EVERY mutation, which can push
 * the paint of a newly sent bubble — the "occasional hiccup before the bubble
 * shows". Portals let React own the button lifecycle (mount/unmount with the
 * row, no orphaned buttons, no manual re-attach after harness re-renders),
 * and the target collection is coalesced (one refresh per mutation batch) and
 * diffed (no setState churn when nothing changed).
 *
 * Mount point: the plugin registers a session-scoped bridge into the harness's
 * `conversation.session.header.actions` list slot. The bridge renders NO
 * header UI — it only portals buttons into the user rows of the session the
 * harness mounts it for. That slot is the harness-native way to get a
 * per-session React mount without touching any source; the registration is
 * typed structurally (see `SlotsLike`) so the plugin never imports the
 * conversation UI package's types and survives its version drift.
 *
 * COUPLING NOTE — HIGH. There is no harness interface for a per-user-message
 * action (see docs/compat/audit.md): `MessageIconActions.extraActions` and the
 * `conversation.chat.assistant-actions` slot are wired for assistant messages
 * only, and no per-user-message action slot exists. So this portal targets
 * undocumented internal structure — the `data-chat-flow-kind`,
 * `data-chat-anchor-key`, `data-composer-input`, `data-composer-card`,
 * `data-pending-steering` and `data-time-hover-root` attributes plus the
 * `anchorSeq` field read in `client/hidden.ts`. Those are harness-internal and
 * may change with the UI; this module (and `hidden.ts`) must be re-adapted to
 * follow, and is the migration target when a first-class user-action slot or
 * an official renderer hook surface appears. The coupling is accepted
 * deliberately because a standards-conformant alternative does not exist
 * today; it is not a defect to be removed while the DOM-portal approach stands.
 *
 * @module dsh-rewind/client/portals
 */
import { type ReactNode } from 'react';
import type { SessionFace } from '@deepseek-ai/dsh-api-session-controller/client';
import { type ChatOf, type ChatWatch, type HiddenChat } from './hidden.ts';
import type { RewindKey } from './locales.ts';
type Translate = (key: RewindKey, params?: Record<string, unknown>) => string;
/** One portal target: the actions row of a user/steering seat + its durable node. */
export type PortalTarget = {
    readonly kind: 'durable';
    /** The seat's chat node key (React reconciliation + diff identity). */
    readonly key: string;
    /** The row's actions container (React portal target). */
    readonly container: HTMLElement;
    readonly seq: number;
    readonly time: number;
    readonly preview: string;
} | {
    readonly kind: 'pending';
    /** `pending:${itemId}` — stable per inbox occurrence. */
    readonly key: string;
    /** The row's actions container (React portal target). */
    readonly container: HTMLElement;
    /** The host inbox occurrence the retract button addresses. */
    readonly itemId: string;
    /** Complete editable text; null when the message contains non-text blocks. */
    readonly text: string | null;
    readonly preview: string;
};
/** Capabilities the session-scoped bridge receives from the plugin apply(). */
export interface RewindBridgeDeps {
    readonly sessionOf: (sessionId: string) => SessionFace | undefined;
    /**
     * Chat reader on the 0.1.2-rc.1 `uiConversation` "chat" view: every chat
     * snapshot read goes through it. See `chatSnapshotOf` in hidden.ts.
     */
    readonly chatOf: ChatOf;
    /**
     * Subscribe to one session's live chat-update signal, so the composer refill
     * waiting on an executed rewind's chat node can be woken when the chat
     * snapshot changes. Passed through to `waitForCommand`.
     */
    readonly watchChat: ChatWatch;
    readonly currentSessionId: () => string | undefined;
    readonly t: Translate;
    readonly subscribeLocale: (cb: () => void) => () => void;
    /**
     * Session-aware composer writer (see `writeComposer`): the 0.1.2-rc.1
     * `conversation.input` facade `setDraft` when reachable, else the DOM fill.
     * Session-scoped so the refill only lands in the session that just rewound.
     */
    readonly setComposerText: (sessionId: string, text: string) => boolean;
}
/** Structural face of the runtime slot service (see the module doc). */
export interface SlotsLike {
    inject(key: string, install: () => () => void): () => void;
    register<P>(entry: {
        readonly name: string;
        readonly id?: string;
        readonly order?: number;
        readonly key?: string;
        readonly locale?: string;
        readonly inject?: () => P;
    }, component: (props: P) => ReactNode): () => void;
}
/** Join the text blocks of a user message into one plain preview. */
/**
 * The 0.1.2-rc.1 session input facade's write face (structural, so the plugin
 * never imports the conversation UI package). `setDraft` replaces the whole
 * composer draft through the harness's own Lexical editor — the correct way
 * to restore the withdrawn text.
 */
interface ComposerDraftWriter {
    setDraft(text: string): void;
}
/**
 * Fill the dsh composer with `text` through the 0.1.2-rc.1 `contenteditable`
 * DOM path. Used by `setComposerText` (the harness-facade-aware writer) as the
 * last-resort and by `runRewindAndFill` to put the withdrawn target message
 * back into the composer after a rewind. Best-effort — no composer match means
 * false, never a throw.
 */
export declare function fillComposer(text: string): boolean;
/**
 * Composer write: prefer the harness facade's `setDraft` (0.1.2-rc.1, correct
 * whole-draft replace), then degrade to the DOM `fillComposer` (0.1.2-rc.1
 * contenteditable). A facade that throws (session teardown) is treated as
 * absent so the DOM path still restores the text. Never throws.
 * @param text - the withdrawn target message text.
 * @param facade - the 0.1.2-rc.1 session input draft writer, when reachable.
 * @returns whether a channel applied the text.
 */
export declare function writeComposer(text: string, facade: ComposerDraftWriter | undefined): boolean;
/**
 * Execute one rewind from the popover and, when it settles successfully,
 * put the withdrawn target message's text back into the composer so the
 * user can edit and re-send.
 *
 * THE COMPOSER FILL IS EVENT-DRIVEN: it runs only when THIS page performed
 * the rewind (the user clicked confirm moments ago). It must NEVER scan
 * loaded history for rewind commands: a session window opens with only
 * the tail page and grows via loadOlder, so a "command already in the
 * snapshot" cannot be told apart from "command executed in this page" —
 * the old baseline heuristic refilled withdrawn text into the composer
 * after switching sessions or restarting dsh.
 */
export declare function runRewindAndFill(session: SessionFace, seq: number, mode: 'chat' | 'both', currentSessionId: () => string | undefined, chatOf: ChatOf, watchChat: ChatWatch, setComposerText: (sessionId: string, text: string) => boolean): Promise<void>;
/**
 * Locate the actions container of a user/steering seat row — the element the
 * ↶ button portals into (the copy/branch IconActions row).
 *
 * On the 0.1.2-rc.1 line the `data-time-hover-root` marker lives only on the
 * per-turn tail footer (`TurnTailNodeView`), and the user action row is
 * revealed via CSS `:has()`. The container is located structurally: the direct
 * holder of the copy `<button>` (the `MessageIconActions` container, which
 * mounts that button as a direct child — `MessageIconActions.tsx:83,86`).
 *
 * Returns undefined when no qualifying container is found; the caller refuses
 * to portal (never a crash, never a wrong attachment). Exported as a test seam
 * (see `collectTargets`) so the row-shape finder is exercised directly for
 * both durable and pending row shapes without a full React portal render.
 */
export declare function actionsContainerOf(row: HTMLElement | undefined): HTMLElement | undefined;
/**
 * Collect the portal targets of one session: user rows × snapshot nodes.
 * Exported as a test seam — the DOM→targets pairing that drives the ↶ button
 * is otherwise only reachable through a full React portal render.
 */
export declare function collectTargets(chat: HiddenChat, hiddenSeqs: ReadonlySet<number>): readonly PortalTarget[];
/**
 * The session-kind slice the durable-target gate reads — the session
 * snapshot's `subagent` cell, the Harness's own runtime signal for a
 * direct-subagent (child) session. Typed structurally so the plugin never
 * imports the session-controller snapshot contract.
 */
export interface SessionKindLike {
    /** Non-null exactly while this Session is addressed as a subagent child. */
    readonly subagent: unknown;
}
/**
 * Whether a session is rewind-inert: a direct-subagent (child) session.
 *
 * The Harness refuses every generic Session RPC for a subagent-owned identity
 * (`session/agent-busy`, "use subagent delivery for this child session"), so
 * `/rewind` can never execute there — the command's own admission is the
 * refusal, before any handler runs. A wired-up ↶ button in such a session is
 * therefore dead UI that closes its popover and does nothing
 * (SiriLee/dsh-rewind#26). This mirrors the Harness's own slash-command
 * directory (which returns no commands for an addressed child), the pending
 * path's `collectPendingTargets` gate, and the Host's `isSubagentSession`
 * skips: a child session gets no rewind surface and records no snapshot.
 */
export declare function isRewindInertSession(snapshot: SessionKindLike): boolean;
/**
 * Collect the durable (sent-message) rewind targets of one session: none at all
 * for a rewind-inert subagent session, otherwise `collectTargets`' DOM→target
 * pairing. Kept separate from `collectTargets` so the session-kind gate is a
 * pure, directly testable decision.
 * @param snapshot - the session snapshot carrying the `subagent` cell.
 * @param chat - the session's chat snapshot, or undefined while unavailable.
 * @param hiddenSeqs - anchor seqs withdrawn by previous rewinds.
 */
export declare function collectDurableTargets(snapshot: SessionKindLike, chat: HiddenChat | undefined, hiddenSeqs: ReadonlySet<number>): readonly PortalTarget[];
interface RewindPortalsProps extends RewindBridgeDeps {
    readonly sessionId: string;
}
/**
 * Session-scoped portal bridge: renders the ↶ button of every user message
 * row of the session the harness mounts it for. The refresh is coalesced
 * (one pass per mutation batch via queueMicrotask) and diffed (setState is
 * skipped when the target set is unchanged), so the plugin never runs a
 * synchronous full-transcript scan inside a commit microtask.
 */
export declare function RewindPortals({ sessionId, sessionOf, chatOf, currentSessionId, watchChat, t, subscribeLocale, setComposerText }: RewindPortalsProps): ReactNode;
/** The current composer draft: the 0.1.2-rc.1 contenteditable `textContent`.
 * Empty when the composer is absent. Exported as a test seam (the
 * empty-composer guard in `retractPending`). */
export declare function composerText(): string;
/**
 * Withdraw one pre-sent (pending steering) message and every steering message
 * after it (the rollback point's "future"), WITHOUT interrupting the run.
 *
 * The message is still in the agent's next-step inbox, so the loop has not
 * claimed it into any request: removing it cannot change what the model is
 * generating. Stopping the run first (the durable-rewind rule) would throw
 * away in-flight work — a long tool call, a partial answer — for an edit the
 * model can never observe (SiriLee/dsh-rewind#27). Only the durable rewind
 * needs a stop, because it cuts the model-visible surface.
 *
 * 1. Remove the target and its future (steering only; queued stays) through
 *    the session's own `updateQueue` channel, oldest first.
 * 2. Put the target's text back in the composer ONLY when the target was
 *    actually removed and the composer is empty (Claude Code's auto-restore
 *    guard, so a draft the user is typing is never clobbered).
 *
 * The realistic failure is `queue-item-not-found`: a step boundary claimed
 * the whole next-step batch a moment ago, so the message is now durable and
 * the durable row's regular rewind button takes over with no gap. Nothing is
 * removed then, and the composer is NOT refilled — refilling would invite a
 * duplicate send of a message the model has already received.
 */
export declare function retractPending(session: SessionFace, itemId: string, text: string | null, setComposerText: (sessionId: string, text: string) => boolean): Promise<void>;
/**
 * Build the slot-entry component for the plugin apply(): a tiny bridge that
 * injects the apply-time capabilities (session resolution, locale, rewind
 * runner) into the module-level `RewindPortals`.
 */
export declare function createRewindBridge(deps: RewindBridgeDeps): (props: {
    readonly sessionId: string;
}) => ReactNode;
export {};
