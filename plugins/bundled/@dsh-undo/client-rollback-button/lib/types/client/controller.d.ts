/** Per-session browser controller for the conversationUndo Remote. */
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client';
import type { ObservableSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { ConversationAdmissionFailureValue, ConversationRevokePairValue, ConversationUndoLayerInspectionValue, ConversationUndoLayerValue, ConversationUndoResult, ConversationUndoValue } from '@dsh-undo/rollback-undo/types';
/** The mounted Remote methods used by this browser package. */
export interface ConversationUndoRemote {
    current: (request: {
        sessionId: SessionId;
    }) => Promise<RemoteResult<ConversationUndoResult>>;
    undoLatest: (request: {
        sessionId: SessionId;
        userMessageId: MessageId;
    }) => Promise<RemoteResult<ConversationUndoResult>>;
    layers: (request: {
        sessionId: SessionId;
    }) => Promise<RemoteResult<readonly ConversationUndoLayerValue[]>>;
    inspectLayer: (request: {
        sessionId: SessionId;
        userMessageId: MessageId;
    }) => Promise<RemoteResult<ConversationUndoLayerInspectionValue>>;
    undoThrough: (request: {
        sessionId: SessionId;
        userMessageId: MessageId;
    }) => Promise<RemoteResult<ConversationUndoResult>>;
    admissionFailure: (request: {
        sessionId: SessionId;
    }) => Promise<RemoteResult<ConversationAdmissionFailureValue | undefined>>;
    rollbackChild: (request: {
        sessionId: SessionId;
    }) => Promise<RemoteResult<{
        rollbackSessionId: SessionId;
    } | undefined>>;
    revokePair: (request: {
        sessionId: SessionId;
    }) => Promise<RemoteResult<ConversationRevokePairValue | undefined>>;
    revoke: (request: {
        sessionId: SessionId;
    }) => Promise<RemoteResult<ConversationUndoResult>>;
}
/** Immutable controller projection consumed through the injected hooks compartment. */
export interface ConversationUndoView {
    readonly status: 'cold' | 'loading' | 'ready' | 'error';
    readonly value: ConversationUndoValue | undefined;
    /** Completed rollback pair this Session may still revoke, while the Host retains it. */
    readonly revokePair: ConversationRevokePairValue | undefined;
    readonly error: string | null;
}
/** One Session-scoped observable that serializes Remote calls and publishes rollback state. */
export declare class ConversationUndoController implements ObservableSnapshot<ConversationUndoView> {
    private readonly remote;
    private readonly sessionId;
    private view;
    private readonly listeners;
    private load;
    private tail;
    /** @param remote - mounted conversationUndo Remote. @param sessionId - current physical branch id. */
    constructor(remote: ConversationUndoRemote, sessionId: SessionId);
    getSnapshot(): ConversationUndoView;
    /** @param listener - Observer notified after a published controller state change. @returns Disposer for the observer. */
    subscribe(listener: () => void): () => void;
    /** Load this physical Session's latest rollback point once. */
    ensure(): Promise<void>;
    /** Re-read the latest point and the revocable pair after a transcript event or transport reconnect. */
    refresh(): Promise<void>;
    /** Request rollback for one latest approved user message.
     * @param messageId - Latest approved user message to remove.
     * @returns The opened child Session value, if rollback succeeds.
     */
    undo(messageId: MessageId): Promise<ConversationUndoValue | undefined>;
    /** Read every layer that the active Session can reach by repeated rollback. */
    layers(): Promise<readonly ConversationUndoLayerValue[]>;
    /** Read the selected prompt's workspace changes and recorded executable commands. */
    inspectLayer(messageId: MessageId): Promise<ConversationUndoLayerInspectionValue>;
    /** Roll back continuously through the selected timeline point. */
    undoThrough(messageId: MessageId): Promise<ConversationUndoValue | undefined>;
    /** Revoke the completed rollback that published this Session.
     * @returns The restored Session value, if the revoke succeeds.
     */
    revoke(): Promise<ConversationUndoValue | undefined>;
    /** Read and clear the last refused-admission failure, if any.
     * @returns The redacted failure material, or undefined when none was cached.
     */
    admissionFailure(): Promise<ConversationAdmissionFailureValue | undefined>;
    /** Release browser observers held by this Session-scoped controller. */
    dispose(): void;
    private apply;
    private publish;
}
//# sourceMappingURL=controller.d.ts.map