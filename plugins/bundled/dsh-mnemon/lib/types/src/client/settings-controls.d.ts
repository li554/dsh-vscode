import { type JSX, type ReactNode } from 'react';
/**
 * The configuration's class names that Memory Spaces' own settings use, so they
 * draw as the shipped settings do. They are API: an installed Memory Spaces,
 * older or newer than this Starter, looks its classes up by these names, so
 * renaming or removing one unstyles it.
 */
export declare const MEMORY_SETTINGS_CLASS_NAMES: readonly ["configFeedback", "editor", "editorHeading", "editorNote", "embeddingFillOutcome", "embeddingSpaceCount", "embeddingSpaceName", "embeddingSpaceState", "embeddingSpaces", "embeddingTest", "error", "fieldGrid", "groupCallout", "memoryConfigFooter", "packSuccess", "panelHeading", "panelNote", "panelSection", "providerBoolean", "providerChevron", "providerDisclosure", "providerEnableControl", "providerFieldControl", "providerIdentity", "providerInlineBody", "providerList", "providerLoadError", "providerLocationField", "providerMark", "providerRow", "providerRowHeader", "providerScopeTag", "providerSecretInput", "providerSecretVisibility", "providerServiceFooter", "providerServiceForm", "providerServiceLocation", "providerServicePrompt", "providerSettingsGrid", "providerState", "providerTarget", "providerToggle", "providerToggleError", "scopeChanging", "visuallyHidden"];
export type MemorySettingsClass = typeof MEMORY_SETTINGS_CLASS_NAMES[number];
/** The configuration's class map, by the names in MEMORY_SETTINGS_CLASS_NAMES. */
export declare const memorySettingsStyles: Readonly<Record<MemorySettingsClass, string>>;
/** One option of a settings selector; the detail explains it in the menu and under the row title. */
export interface SettingOption<T extends string> {
    value: T;
    label: string;
    detail?: string;
    disabled?: boolean;
}
/**
 * A DSH preference row: title and hint on the left, one control on the right.
 * Shared by Mnemon Settings and the Plugins page composition.
 */
export declare function SettingRow(props: {
    title: string;
    titleId?: string | undefined;
    hint?: ReactNode;
    htmlFor?: string | undefined;
    children?: ReactNode;
    stacked?: boolean | undefined;
    target?: string | undefined;
}): JSX.Element;
/** The DSH settings selector: a gray button that opens a Menu of the options. */
export declare function SettingSelect<T extends string>(props: {
    labelledBy: string;
    value: T;
    options: readonly SettingOption<T>[];
    disabled?: boolean | undefined;
    onChange: (value: T) => void;
}): JSX.Element;
/** A row whose control is a selector; the chosen option's detail doubles as the hint. */
export declare function SelectRow<T extends string>(props: {
    id: string;
    label: string;
    hint?: string | undefined;
    value: T;
    options: readonly SettingOption<T>[];
    disabled?: boolean | undefined;
    target?: string | undefined;
    onChange: (value: T) => void;
}): JSX.Element;
/**
 * A row whose control is the DSH Switch. A note under the hint states what the
 * switch depends on and offers what resolves it; it slides in and out.
 */
export declare function ToggleRow(props: {
    id: string;
    label: string;
    titleId?: string | undefined;
    hint: string;
    checked: boolean;
    disabled: boolean;
    ariaLabel?: string | undefined;
    note?: ReactNode;
    target?: string | undefined;
    onChange: (value: boolean) => void;
}): JSX.Element;
