/**
 * Message-actions rollback button for the dsh web conversation (main-tree
 * parity): one icon button in the qualified user message's actions row, right
 * after Copy, carrying the composer's enter-key glyph verbatim.
 *
 * rc.7 has no user-message actions slot (only the turn-tail assistant-actions
 * strip), so this is the navIconPatch pattern applied to the chat flow:
 *
 *   - rc.7's chat flow publishes one stable contract per node —
 *     `[data-chat-flow-kind]` plus a `data-chat-flow-key` whose
 *     `input-message<uuid>` tail IS the durable message id (verified against
 *     the rollback journal's messageId). The armed rollback point therefore
 *     matches exactly one user row: `key.endsWith(messageId)`.
 *   - The button is a FOREIGN node React never reconciles; a MutationObserver
 *     re-inserts after any remount the diff discards (virtualization, session
 *     switch), and subscriptions (sessions list + controller view) drive the
 *     same idempotent rescan.
 *   - The icon is the composer send key's own inline SVG path (ui-conversation
 *     carries a private copy whose coordinates differ from the primitives
 *     export in the third decimal), inlined verbatim so the glyph the user
 *     sees is byte-identical to the enter key.
 */
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client';
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { ConversationUndoView } from './controller.ts';
/** Minimal list-store face this patch consumes (structural, like WorkspacesPort). */
export interface SessionsListPort {
    getSnapshot(): {
        readonly current: SessionId | undefined;
        readonly byId: Readonly<Record<string, {
            readonly running: boolean;
        }>>;
    };
    subscribe(fn: () => void): () => void;
}
/** Minimal controller face this patch consumes. */
export interface UndoControllerPort {
    getSnapshot(): ConversationUndoView;
    subscribe(fn: () => void): () => void;
}
/** Wiring the patch needs from the owning apply. */
export interface MessageActionsPatchDeps {
    /** Sessions list store: current selection plus per-row running state. */
    readonly list: SessionsListPort;
    /** Per-session controller lookup (the shared rollback-point view). */
    readonly controllerFor: (sessionId: SessionId) => UndoControllerPort;
    /** Roll back one message: undo and open the replacement session. */
    readonly undo: (sessionId: SessionId, messageId: MessageId) => Promise<void>;
}
/**
 * Mount the message-actions rollback button for the lifetime of the plugin.
 * @param deps - list store, controller lookup, and the undo verb.
 * @returns Disposer removing the observer, subscriptions, and every button.
 */
export declare function mountMessageActionsPatch(deps: MessageActionsPatchDeps): () => void;
//# sourceMappingURL=messageActionsPatch.d.ts.map