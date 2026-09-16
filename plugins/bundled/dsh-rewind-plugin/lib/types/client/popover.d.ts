/**
 * The rewind mode-selection popover (plain DOM, no React). Step two of the
 * interaction: the target is already fixed (the clicked message); the popover
 * offers the two modes. Choosing "both" first fetches the impact list through
 * the `/rewind preview @seq both` command and shows it before confirming.
 *
 * Keyboard: ↑/↓ move focus across the step's ACTION buttons only (the two
 * modes, or the confirm button on the impact step), Enter activates the
 * focused button (native), Esc is the keyboard twin of the ghost back/cancel
 * buttons — cancel on the modes step, back on the impact step; the ghosts are
 * never in the arrow cycle. The listener runs in the document capture phase
 * so the keys are stolen from the composer while the popover is open.
 *
 * @module dsh-rewind/client/popover
 */
import type { SessionFace } from '@deepseek-ai/dsh-api-session-controller/client';
import type { CommandNode } from '@deepseek-ai/dsh-client-ui-conversation/client';
import { type ChatOf, type ChatWatch } from './hidden.ts';
import type { RewindKey } from './locales.ts';
type Translate = (key: RewindKey, params?: Record<string, unknown>) => string;
export interface PopoverOptions {
    readonly session: SessionFace;
    /** Durable variant: the target message seq (mode-selection flow). */
    readonly seq?: number;
    /** Durable variant: the target message time. */
    readonly time?: number;
    /** Pending variant: retract a pre-sent steering message (single-confirm flow). */
    readonly retract?: {
        readonly itemId: string;
        readonly text: string | null;
    };
    /** Pending variant: executed after the retract confirm closes the popover. */
    readonly onRetract?: () => void;
    readonly preview: string;
    /**
     * Chat reader on the 0.1.2-rc.1 `uiConversation` "chat" view: the durable
     * variant's command probes scan the chat through it. Unused by the
     * pending-retract variant.
     */
    readonly chatOf: ChatOf;
    /**
     * Subscribe to one session's live chat-update signal, so a probe waiting on
     * a command's chat node can be woken when the chat snapshot changes. Passed
     * straight through to `waitForCommand`.
     */
    readonly watchChat: ChatWatch;
    /** The button that opened the popover (outside-click ignore target). */
    readonly anchor: HTMLElement;
    readonly t: Translate;
    /**
     * Execute one rewind in the given mode. The popover closes itself first;
     * the callback owns the command + composer-refill lifecycle (see
     * runRewindAndFill in index.ts).
     */
    readonly onRewind?: (mode: 'chat' | 'both') => void;
}
/** Close the current popover, if any. */
export declare function closePopover(): void;
/**
 * Seqs of the command nodes currently matching `match`. Sample BEFORE issuing
 * a new command of the same shape so the subsequent wait can exclude them: a
 * repeated preview/rewind of the same target must not settle on the previous
 * command's stale outcome (e.g. an older preview that found file changes,
 * after those changes were already restored).
 */
export declare function knownCommandSeqs(session: SessionFace, chatOf: ChatOf, match: (node: CommandNode) => boolean): Set<number>;
/**
 * Resolve the outcome of the newest matching rewind command by watching the
 * session snapshot (command/run + command/done land as one CommandNode).
 * @returns the outcome text-bearing node, or null on timeout.
 */
export declare function waitForCommand(session: SessionFace, chatOf: ChatOf, match: (node: CommandNode) => boolean, timeoutMs: number | undefined, watch: (cb: () => void) => () => void): Promise<{
    kind: 'success' | 'error';
    text?: string;
} | null>;
/** Open the mode-selection popover anchored near the given button. */
export declare function openPopover(opts: PopoverOptions): void;
export {};
