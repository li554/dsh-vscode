/**
 * The ↶ action button: the one message-action control this plugin renders.
 *
 * The A2 mount injects it as a React child of a durable row's actions row; the
 * pending layer (`pending-mount.tsx`) portals the same button, with the retract
 * copy and a marker, into an unclaimed steering bubble.
 *
 * The action only records intent: a click opens the popover variant, which
 * confirms and runs the host command / queue mutation (see `popover.ts`,
 * `rewind-flow.ts`, `retract.ts`); the host's admission stays the authority.
 *
 * @module dsh-rewind/client/action
 */
import type { ReactNode } from 'react';
import type { RewindKey } from './locales.ts';
import type { RowAction, RowActionRenderer } from './mount.tsx';
type Translate = (key: RewindKey, params?: Record<string, unknown>) => string;
/** The shared button's inputs. */
export interface RewindActionButtonProps {
    readonly t: Translate;
    /** Dictionary keys of the tooltip and the aria label. */
    readonly titleKey: RewindKey;
    readonly ariaKey: RewindKey;
    /** Mark the pre-admission variant: the pending layer uses it to skip its own button. */
    readonly pending?: boolean;
    /** Open the action's popover variant, anchored at the button. */
    readonly onOpen: (anchor: HTMLElement) => void;
}
/** The row's action chrome, matching the official Copy/branch buttons. */
export declare function RewindActionButton({ t, titleKey, ariaKey, pending, onOpen }: RewindActionButtonProps): ReactNode;
/**
 * Build the A2 mount's action renderer: one button per eligible row, nothing for
 * the rest.
 * @param t - the plugin's own translate function (the action's copy).
 * @param eligible - render-time gate: whether a row's session may offer a rewind at all.
 * @param open - opens the mode popover for one row, anchored at the button.
 * @returns the renderer the mount calls for every user/steering row.
 */
export declare function rewindActionRenderer(t: Translate, eligible: (sessionId: string) => boolean, open: (row: RowAction, anchor: HTMLElement) => void): RowActionRenderer;
export {};
