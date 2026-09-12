import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
/**
 * Activate dsh's own trajectory tab for the current conversation.
 *
 * The view store deliberately remains owned by ui-conversation.  Its public
 * extension surface does not expose a cross-seat `setView` action, while the
 * visible tab is the canonical action (and already carries the localized
 * label and accessibility semantics).  Reuse that action instead of keeping
 * a competing inspection viewer in this plugin.
 */
export declare function openNativeTrajectory(prompt?: string): boolean;
/** Minimal session-list surface needed to keep a freshly created rollback child selected. */
export interface RollbackSessionNavigation {
    open(sessionId: SessionId): void;
    list: {
        getSnapshot(): {
            current: SessionId | undefined;
            byId: Readonly<Record<string, unknown>>;
        };
        subscribe(listener: () => void): () => void;
    };
}
/**
 * Open a rollback child and keep following it while delayed archive projections
 * clear the current selection. Multi-step timeline rollback can publish several
 * archive updates after the Remote response, so one eager `open` is not enough.
 */
export declare function keepRollbackChildOpen(sessions: RollbackSessionNavigation, sessionId: SessionId, holdMilliseconds?: number): () => void;
//# sourceMappingURL=navigation.d.ts.map