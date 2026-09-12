/** `/undo` timeline picker: one visual entry to the same continuous rollback chain. */
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ConversationUndoLayerValue } from '@dsh-undo/rollback-undo/types';
export interface UndoTimelineInjected {
    layers: () => Promise<readonly ConversationUndoLayerValue[]>;
    openTrajectory: (prompt?: string) => boolean;
    open: (messageId: MessageId) => Promise<void>;
}
export type UndoTimelineProps = PropsRuntime<'conversation.input.dock'> & InjectFace<UndoTimelineInjected>;
/** Open the custom picker after the public slash-command pipeline claims `/undo`. */
export declare function requestUndoTimeline(sessionId: string): void;
export declare function timelinePreview(prompt: string): string;
/** The custom picker is mounted in the input dock so it can claim bare `/undo` before host submission. */
export declare function UndoTimeline({ sessionId, inputActions, layers: readLayers, openTrajectory, open }: UndoTimelineProps): import("react").JSX.Element | null;
//# sourceMappingURL=UndoTimeline.d.ts.map