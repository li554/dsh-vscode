import type { PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { RetrySupervisor } from '../core/retry-supervisor.ts';
import type { SubmitEditInput } from './wiring.ts';
/** Business face injected into the slot component by the plugin apply. */
export interface TurnActionsFace {
    supervisor: RetrySupervisor;
    submitEdit(input: SubmitEditInput): Promise<void>;
    manualRetry(sessionId: SessionId): void;
}
export type TurnActionsProps = PropsRuntime<'conversation.chat.turnTail'> & {
    matched: TurnTailOwnerProps;
    t: TranslateNS<'chat-recovery'>;
} & TurnActionsFace;
export declare const TurnActionsView: import("react").MemoExoticComponent<(props: TurnActionsProps) => import("react").JSX.Element | null>;
