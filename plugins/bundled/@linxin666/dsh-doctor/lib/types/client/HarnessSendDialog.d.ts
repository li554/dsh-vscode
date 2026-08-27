/**
 * Send-to-Harness dialog for the dsh-doctor recovery console.
 *
 * Shows the composed troubleshooting prompt (failure summary plus error stack)
 * in an editable textarea, offers copy-to-clipboard, and queues the prompt
 * into the CURRENT DSH session when one is open. The dialog never touches the
 * supervisor state; a missing current session simply disables sending and
 * explains why.
 * @module @linxin666/dsh-doctor/client
 */
import { type ReactNode } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { HarnessTarget } from './harness-send.ts';
/** Props of the send-to-Harness dialog. */
export interface HarnessSendDialogProps {
    t: TranslateNS<'doctor'>;
    /** Whether the dialog is shown. */
    open: boolean;
    /** Initial prompt text; re-seeded whenever the dialog opens. */
    initialText: string;
    /** Current session target, undefined when none is open. */
    target: HarnessTarget | undefined;
    /** Whether a send is possible right now (target present and not busy). */
    canSend: boolean;
    /** A send is crossing the wire. */
    busy: boolean;
    /** Last send failure reason, when any. */
    error: string | undefined;
    onClose: () => void;
    onSend: (text: string) => void;
}
/**
 * Render the dialog; returns null when closed. Text is local state seeded on
 * open, so edits survive re-renders but never leak into later openings.
 */
export declare function HarnessSendDialog(props: HarnessSendDialogProps): ReactNode;
