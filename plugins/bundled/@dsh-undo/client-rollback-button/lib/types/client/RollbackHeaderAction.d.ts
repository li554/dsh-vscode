/** Session-header action that starts a reversible rollback of the latest completed message. */
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ConversationAdmissionFailureValue } from '@dsh-undo/rollback-undo/types';
import type { ConversationUndoController } from './controller.ts';
/** Injected callbacks and observable source for the header action. */
export interface RollbackActionInjected {
    hooks: {
        undo: ConversationUndoController;
    };
    refresh: () => void;
    /** Read and clear one refused-admission failure for this Session. */
    checkAdmissionFailure: () => Promise<ConversationAdmissionFailureValue | undefined>;
    /** Roll back the latest approved message and open the replacement Session. */
    undo: () => Promise<void>;
}
/** Full action props, derived from the declared header-actions slot. */
export type RollbackActionProps = PropsRuntime<'conversation.session.header.actions'> & InjectFace<RollbackActionInjected>;
/** Compose the non-durable draft restored after snapshot admission fails.
 * @param prompt - Original rejected text.
 * @param detail - Redacted Host failure detail.
 * @returns Composer draft recovery text.
 */
export declare function formatAdmissionFailureDraft(prompt: string, detail: string): string;
/** Render while the Host holds a rollback point for this Session's latest eligible message. */
export declare function RollbackHeaderAction({ useSession, inputActions, useUndo, refresh, checkAdmissionFailure, undo, }: RollbackActionProps): import("react").JSX.Element | null;
/** Re-export the session identity type for the apply closure. */
export type { SessionId };
//# sourceMappingURL=RollbackHeaderAction.d.ts.map