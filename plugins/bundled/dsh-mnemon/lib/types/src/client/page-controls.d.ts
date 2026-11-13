import { type InputHTMLAttributes, type JSX } from 'react';
import type { MnemonTranslate } from './locales.ts';
/**
 * Controls every memory page shares, so a search, a choice or a write receipt
 * looks and behaves the same on each page: the DSH input and its search icon,
 * the DSH selector and its menu, and one receipt for a task Agent's write.
 */
/** A search box: the DSH input with its search icon. */
export declare function SearchField({ label, className, ...input }: {
    label: string;
    className?: string | undefined;
} & InputHTMLAttributes<HTMLInputElement>): JSX.Element;
/** One choice of a {@link SelectField}; the detail explains it in the menu. */
export interface FieldOption<T extends string> {
    value: T;
    label: string;
    detail?: string | undefined;
    disabled?: boolean | undefined;
}
/** A labelled choice: the DSH selector, opening a menu of the options. */
export declare function SelectField<T extends string>(props: {
    label: string;
    value: T;
    options: readonly FieldOption<T>[];
    disabled?: boolean | undefined;
    /** Keep the label for assistive technology only, when the row already says it. */
    hideLabel?: boolean | undefined;
    /** `sm` for compact toolbars and headers, as the DSH small button. */
    size?: 'md' | 'sm' | undefined;
    /** Label beside the selector instead of above it. */
    inline?: boolean | undefined;
    /** A fuller name for assistive technology than the visible label. */
    ariaLabel?: string | undefined;
    className?: string | undefined;
    /**
     * Repeat the chosen option's detail under its name in the selector itself, as
     * the menu shows it. Off by default: most fields have no room for a second line.
     */
    triggerDetail?: boolean | undefined;
    onChange: (value: T) => void;
}): JSX.Element;
/** How a task Agent's write ended, as the receipt names it. */
export type WriteOutcome = 'written' | 'updated' | 'pending' | 'skipped' | 'partial' | 'unfinished';
/** Map a write action from a receipt to what the user reads. */
export declare function writeOutcome(action: string): WriteOutcome;
/**
 * What a task Agent did with a candidate: the outcome, the Agent's own
 * summary, and, when something was written, a way to see it. A memory saved
 * without a vector says so on a line of its own (#388).
 */
export declare function WriteReceipt(props: {
    action?: string | undefined;
    summary?: string | undefined;
    error?: string | undefined;
    unembedded?: boolean | undefined;
    /**
     * Whether DSH manages the Mnemon Native embedding settings. Left at their
     * default (`false`), they set up no embedding service, so a memory without a
     * vector gets a neutral note; managed, or when this is omitted, it gets the
     * caution that embedding did not succeed.
     */
    embeddingManaged?: boolean | undefined;
    t?: MnemonTranslate | undefined;
    onView?: (() => void) | undefined;
    viewLabel?: string | undefined;
}): JSX.Element;
/** Whether a task Agent can take a write now. */
export declare function TaskAgentTag(props: {
    available: boolean;
    t?: MnemonTranslate | undefined;
}): JSX.Element;
