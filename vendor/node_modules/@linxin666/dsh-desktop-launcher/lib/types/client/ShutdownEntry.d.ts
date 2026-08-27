import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
/** The inject face the footer registration provides. */
export interface ShutdownEntryFace {
    /** Whether the confirm dialog is required before exiting (settings-backed). */
    confirmShutdown: () => boolean;
}
/** Entry props: the column state + the locale seat + the face. */
export type ShutdownEntryProps = PropsLocale<'desktop-launcher'> & {
    wide: boolean;
    floating?: boolean;
} & InjectFace<ShutdownEntryFace>;
/**
 * Render the shutdown trigger and the confirm dialog.
 * @param props - column state, locale copy, and the confirm gate.
 * @returns the entry element tree.
 */
export declare function ShutdownEntry(props: ShutdownEntryProps): import("react").JSX.Element;
