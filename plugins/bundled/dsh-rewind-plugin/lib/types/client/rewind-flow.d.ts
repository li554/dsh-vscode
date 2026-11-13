/**
 * dsh-rewind flow half: the executed rewind command and its composer refill.
 *
 * This is the BEHAVIOR layer, deliberately free of any mounting decision. Both
 * the `/rewind` text flow (command decoration → mode popover) and, in A2, the
 * per-message action call {@link runRewindAndFill}; nothing here portals,
 * observes rows, or knows where the trigger sits.
 *
 * The refill is event-driven: it runs only when THIS page performed the
 * rewind (the user confirmed moments ago). It must NEVER scan loaded history
 * for rewind commands — a session window opens with only the tail page, so
 * "a command already in the snapshot" cannot be told apart from "executed in
 * this page", and the old baseline heuristic refilled withdrawn text into the
 * composer after switching sessions or restarting dsh.
 *
 * @module dsh-rewind/client/rewind-flow
 */
import type { SessionFace } from '@deepseek-ai/dsh-api-session-controller/client';
import { type ChatOf, type ChatWatch, type MessageImageRef } from './hidden.ts';
/**
 * The session input facade's write face (structural, so the plugin
 * never imports the conversation UI package). `setDraft` replaces the whole
 * composer draft through the harness's own Lexical editor — the correct way
 * to restore the withdrawn text.
 */
interface ComposerDraftWriter {
    setDraft(text: string): void;
    /**
     * Return the keyboard to the composer with the caret it last held (the
     * facade's own `focus`). Optional so the DOM fallback and older faces still
     * restore the text.
     */
    focus?(): void;
}
/**
 * Fill the dsh composer with `text` through the `contenteditable`
 * DOM path. Used by `setComposerText` (the harness-facade-aware writer) as the
 * last-resort and by `runRewindAndFill` to put the withdrawn target message
 * back into the composer after a rewind. Best-effort — no composer match means
 * false, never a throw.
 */
export declare function fillComposer(text: string): boolean;
/**
 * Composer write: prefer the harness facade's `setDraft` (correct whole-draft
 * replace), then degrade to the DOM `fillComposer` (contenteditable). A facade
 * that throws (session teardown) is treated as absent so the DOM path still
 * restores the text. Never throws.
 * @param text - the withdrawn target message text.
 * @param facade - the session input draft writer, when reachable.
 * @returns whether a channel applied the text.
 */
export declare function writeComposer(text: string, facade: ComposerDraftWriter | undefined): boolean;
/**
 * Execute one rewind and, when it settles successfully, put the withdrawn
 * target message's text back into the composer so the user can edit and
 * re-send.
 */
export declare function runRewindAndFill(session: SessionFace, seq: number, mode: 'chat' | 'both', isMainViewSession: (sessionId: string) => boolean, chatOf: ChatOf, watchChat: ChatWatch, setComposerText: (sessionId: string, text: string) => boolean, restoreImages?: (sessionId: string, images: readonly MessageImageRef[]) => Promise<void>): Promise<void>;
/** The current composer draft: the contenteditable `textContent`.
 * Empty when the composer is absent. Exported as a test seam (the
 * empty-composer guard in `runRewindAndFill`). */
export declare function composerText(): string;
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
 * refusal, before any handler runs. A wired-up action in such a session would
 * therefore be dead UI (SiriLee/dsh-rewind#26). This mirrors the Harness's own
 * slash-command directory (which returns no commands for an addressed child)
 * and the Host's `isSubagentSession` skips: a child session gets no rewind
 * surface and records no snapshot.
 */
export declare function isRewindInertSession(snapshot: SessionKindLike): boolean;
export {};
