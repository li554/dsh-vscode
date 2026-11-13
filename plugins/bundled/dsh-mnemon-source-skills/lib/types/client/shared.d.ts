import { type JSX, type ReactNode } from 'react';
import type { EvolutionSignal, RunStatus, SuggestionStatus, TrajectoryAnnotation, TrajectoryStep } from '../contracts.ts';
import { type SkillsTranslate } from './presentation.ts';
export declare function SignalTag(props: {
    signal: EvolutionSignal;
}): JSX.Element;
export declare function StatusTag(props: {
    status: SuggestionStatus;
}): JSX.Element;
/** New skill or improvement, the first thing a suggestion says about itself. */
export declare function ActionTag(props: {
    action: 'create' | 'update';
}): JSX.Element;
export declare function RunStatusDot(props: {
    status: RunStatus;
}): JSX.Element;
/**
 * Follows each link the page is given once, as soon as what it points into
 * has loaded. A link is known by its nonce, so reloading the page's data
 * leaves whatever the reader chose since alone.
 */
export declare function useLink(nonce: number | undefined, ready: boolean, follow: () => void): void;
export declare function Busy(props: {
    label: string;
}): JSX.Element;
export declare function Empty(props: {
    glyph: string;
    title: string;
    children: string;
    action?: ReactNode;
}): JSX.Element;
export declare function Confirm(props: {
    title: string;
    body: string;
    confirmLabel: string;
    busy?: boolean;
    danger?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}): JSX.Element;
/**
 * A section that stays closed until asked for: its title and a short summary
 * on one row, the content below it once open.
 */
export declare function Fold(props: {
    title: string;
    meta?: ReactNode;
    defaultOpen?: boolean;
    actions?: ReactNode;
    children: ReactNode;
}): JSX.Element;
/** A row among the folds that leads elsewhere instead of opening in place. */
export declare function FoldLink(props: {
    title: string;
    meta?: ReactNode;
    onOpen: () => void;
}): JSX.Element;
/**
 * A paragraph that shows its first lines and opens to the rest, so a long
 * reason or note never pushes what follows out of view.
 */
export declare function Clamp(props: {
    text: string;
    lines?: number;
}): JSX.Element;
/** A list that shows its first items and opens to the rest. */
export declare function MoreList(props: {
    items: readonly string[];
    shown: number;
}): JSX.Element;
export interface MoreItem {
    id: string;
    label: string;
    danger?: boolean;
    disabled?: boolean;
}
/** The less frequent actions behind one quiet button. */
export declare function MoreMenu(props: {
    label: string;
    items: readonly MoreItem[];
    disabled?: boolean;
    onSelect: (id: string) => void;
}): JSX.Element | null;
/**
 * A conversation's steps as a numbered timeline. Annotated steps carry their
 * signal and note; selectable steps get a checkbox, for making test cases.
 */
export declare function StepTimeline(props: {
    steps: readonly TrajectoryStep[];
    annotations?: readonly TrajectoryAnnotation[];
    highlight?: ReadonlySet<number>;
    selected?: ReadonlySet<number>;
    onToggle?: (index: number) => void;
    compact?: boolean;
}): JSX.Element;
/** A labelled form control with an optional hint, associated for assistive technology. */
export declare function Field(props: {
    label: string;
    hint?: string;
    children: (control: {
        id: string;
        'aria-describedby'?: string;
    }) => ReactNode;
}): JSX.Element;
export declare function diffLabels(t: SkillsTranslate): {
    codeLabel: string;
    wrapLabel: string;
    unwrapLabel: string;
    copy: string;
    copied: string;
    collapseAria: string;
    expandAria: (hidden: number) => string;
    collapse: string;
    expand: (hidden: number) => string;
};
/** The SKILL.md body as Markdown, without its frontmatter. */
export declare function SkillMarkdown(props: {
    body: string;
}): JSX.Element;
/** A square with the category's glyph, or the skill's initial. */
export declare function SkillIcon(props: {
    name: string;
    category?: string | undefined;
}): JSX.Element;
