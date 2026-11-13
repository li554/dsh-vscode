import { type JSX, type ReactNode } from 'react';
import { type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives';
/** One transient announcement, shown as DSH's own toast. */
export interface MnemonToast {
    text: string;
    /** `success` carries DSH's check, `warning` a warning glyph, `info` no glyph. */
    tone: 'success' | 'warning' | 'info';
    /** Inline actions continuing the sentence, such as Undo or Show. */
    actions?: ReadonlyArray<{
        label: string;
        run: () => void;
    }>;
}
/** One toast at a time: a newer announcement replaces the one on screen. */
export declare function useToast(): {
    show: (toast: MnemonToast) => void;
    element: ReactNode;
};
/**
 * Content that slides open when it appears and closed when it goes, so a note
 * never pushes the page at once. Closing content stays readable while it
 * leaves but is hidden from assistive technology and the pointer.
 */
export declare function Reveal({ children, className }: {
    children: ReactNode;
    className?: string | undefined;
}): JSX.Element | null;
/** The attribute marking what a change touched, so the page can point at it. */
export declare const TARGET = "data-mnemon-target";
/**
 * Point at what a change touched: briefly tint the matching elements, and
 * scroll the first into view when asked to.
 * @param root the element to search within.
 * @param targets values of {@link TARGET}.
 */
export declare function locate(root: HTMLElement | null, targets: readonly string[], options?: {
    scroll?: boolean;
}): void;
/** How a state reads at a glance: DSH's state dots. */
export type MnemonTone = StateDotState;
/**
 * A state the user should notice, with the actions that resolve it: a state
 * dot, a short title, one line of detail and the buttons.
 */
export declare function Callout(props: {
    tone: MnemonTone;
    title: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
    className?: string | undefined;
    live?: boolean;
}): JSX.Element;
/**
 * A button whose own label says when its write is running, so the result of
 * a press shows where the press happened.
 */
export declare function ActionButton(props: {
    label: string;
    pendingLabel?: string;
    pending?: boolean;
    disabled?: boolean;
    primary?: boolean;
    ariaLabel?: string;
    onClick: () => void;
}): JSX.Element;
