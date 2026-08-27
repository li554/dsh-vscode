/**
 * Browser-half entry for the dsh-chat-recovery plugin.
 *
 * Mounts two conversation surfaces:
 * - a turn-tail entry (conversation.chat.turnTail) with the Edit affordance
 *   for the last completed user message and the manual Retry affordance for
 *   failed turns;
 * - a composer dock entry (conversation.input.dock) showing the retry
 *   supervisor's attempt count, wait state, cancel / retry-now controls and
 *   the final failure reason.
 *
 * Failure policy: nothing here throws at apply time - an external plugin
 * must never take the GUI down.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type ChatRecoveryKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** chat-recovery surface copy. */
        'chat-recovery': ChatRecoveryKey;
    }
}
/** Services required by this plugin. */
export declare const inject: string[];
/**
 * Register the chat-recovery surface and start the retry supervisor.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
