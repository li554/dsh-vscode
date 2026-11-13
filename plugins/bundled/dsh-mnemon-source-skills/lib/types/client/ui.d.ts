import { type ReactNode } from 'react';
import { installMemorySourceUI, type MemorySourcePageProps } from 'dsh-mnemon/client';
import { type SkillsPageClient } from './api.ts';
export type SkillsTab = 'skills' | 'evolution' | 'evals' | 'market' | 'trash';
/** What 进化 lists: suggestions still waiting, those handled, or the conversations reviews read. */
export type EvolutionFilter = 'pending' | 'done' | 'evidence';
/** Where a link inside the page points: a tab, and what to select there. */
export interface SkillsLocation {
    tab: SkillsTab;
    skillKey?: string;
    /** A skill by name: the one DSH loads, its first waiting suggestion, or its tests. */
    skillName?: string;
    suggestionId?: string;
    draftId?: string;
    trajectoryId?: string;
    steps?: number[];
    filter?: EvolutionFilter;
    nonce?: number;
}
/** Self-evolution as the page knows it from its settings: on or off, and turning it on from here. */
export interface EvolutionState {
    on: boolean;
    enable?: () => Promise<void>;
}
export interface SkillsPageContext {
    client: SkillsPageClient;
    writable: boolean;
    /** Reload this page's data; every tab watches it. */
    revision: number;
    refresh(): void;
    navigate(location: SkillsLocation): void;
    notice(text: string): void;
    fail(error: unknown): void;
    /** Put `/name` into the conversation's input and go back to it. */
    useSkill(name: string): void;
    /** Unknown where the page has no settings to read. */
    evolution: EvolutionState | undefined;
    /** Open 技能管理's settings under Plugins. */
    openSettings?: () => void;
    sessionId?: string;
}
export declare function SkillsSourcePage(props: MemorySourcePageProps): ReactNode;
export declare function installSkillsMemoryUI(ctx: Parameters<typeof installMemorySourceUI>[0], locale?: string): () => void;
export declare const inject: string[];
/** The tab is named by the component's declaration; the page label is only a fallback. */
export declare function apply(ctx: Parameters<typeof installMemorySourceUI>[0]): void;
