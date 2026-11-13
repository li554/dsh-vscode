import { type JSX } from 'react';
import type { MnemonTranslate } from './locales.ts';
/**
 * The two ways a group of settings saves. A choice (switch or selector)
 * applies when it is made; edits that need checking, or that move data, wait
 * for their group's Apply. No group joins another group's save.
 */
export declare function useScope<S>(scope: {
    getSnapshot(): S;
    subscribe(listener: () => void): () => void;
}): S;
/**
 * One group's staged edits, applied together with its own button. Edits that
 * come back to the saved values leave nothing to apply.
 */
export declare function useStaged<D>(value: D, write: (draft: D) => Promise<void>): {
    draft: D;
    dirty: boolean;
    saving: boolean;
    failed: string | null;
    applied: boolean;
    edit: (next: Partial<D>) => void;
    discard: () => void;
    apply: () => Promise<void>;
};
/**
 * A choice that saves when it is made: it shows the chosen value at once, and
 * the saved one again if the write fails.
 */
export declare function useLive<T>(saved: T, write: (value: T) => Promise<void>): {
    value: T;
    failed: string | null;
    set: (value: T) => void;
};
/**
 * A failed write, beside the controls that made it. `t` is the translation the
 * settings use: the configuration page sets none around a component's settings.
 */
export declare function WriteFailure(props: {
    error: string | null;
    t: MnemonTranslate;
}): JSX.Element | null;
/**
 * Discard and Apply for one group, shown while it has edits; `note` says what
 * applying does. `t` is the translation the settings use, as for WriteFailure.
 */
export declare function PanelActions(props: {
    dirty: boolean;
    saving: boolean;
    invalid: string | null;
    failed: string | null;
    applied: boolean;
    disabled: boolean;
    note?: string;
    t: MnemonTranslate;
    onDiscard: () => void;
    onApply: () => void;
}): JSX.Element | null;
