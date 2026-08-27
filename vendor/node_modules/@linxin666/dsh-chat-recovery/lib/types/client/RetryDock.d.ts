import type { PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { RetrySupervisor } from '../core/retry-supervisor.ts';
/** Business face injected into the slot component by the plugin apply. */
export interface RetryDockFace {
    supervisor: RetrySupervisor;
    manualRetry(sessionId: SessionId): void;
}
export type RetryDockProps = PropsRuntime<'conversation.input.dock'> & {
    t: TranslateNS<'chat-recovery'>;
} & RetryDockFace;
export declare const RetryDockView: import("react").MemoExoticComponent<(props: RetryDockProps) => import("react").JSX.Element | null>;
