/** Collapsible revoke strip above the composer, shown only by a rollback child Session. */
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ConversationUndoController } from './controller.ts';
/** Injected callbacks and observable source for the composer fold strip. */
export interface RollbackFoldInjected {
    hooks: {
        undo: ConversationUndoController;
    };
    refresh: () => void;
    /** Revoke the rollback that published this Session and open the restored Session. */
    revoke: () => Promise<void>;
}
/** Full fold props, derived from the declared input-dock slot. */
export type RollbackFoldProps = PropsRuntime<'conversation.input.dock'> & InjectFace<RollbackFoldInjected>;
/** Truncate one prompt to a one-line preview without splitting surrogate pairs. */
export declare function previewLine(prompt: string, max: number): string;
/** Render the revoke strip while this Session retains the completed rollback pair that published it. */
export declare function RollbackFold({ useSession, useUndo, refresh, revoke, }: RollbackFoldProps): import("react").JSX.Element | null;
//# sourceMappingURL=RollbackFold.d.ts.map