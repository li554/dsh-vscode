import type { FieldOption, TaskAgentModelCatalog } from 'dsh-mnemon/client';
import type { DraftPreferencesView, ModelRoute } from '../contracts.ts';
import { type SkillsTranslate } from './presentation.ts';
import type { SkillsPageContext } from './ui.tsx';
/**
 * The model pickers the Evolution and Evaluation pages share: which model
 * drafts and backtests run on, globally and per item, offered from the same
 * directory the task Agent resolves its own route against.
 *
 * A pick is stored as `provider|model`, so one menu value names one route, and
 * an absent pick is `auto`: the page follows the task Agent, as it did before
 * the user picked anything.
 */
/** The menu value of a pick; `auto` asks for no pick at all. */
export declare function modelOptionValue(model: ModelRoute | null | undefined): string;
/** The pick a menu value names; `auto` and a malformed value both pick nothing. */
export declare function modelOptionPick(value: string): ModelRoute | null;
/**
 * Follow-default first, then every Provider's models. The first entry exists
 * before the directory arrives, so the toolbar holds its place instead of
 * appearing a round trip later than the rest of the page.
 */
export declare function modelOptionsFrom(models: TaskAgentModelCatalog | null, t: SkillsTranslate, autoKey: 'tests.modelAuto' | 'evolution.modelAuto'): FieldOption<string>[];
/** The same list for one card: follow-default, then the directory without its own default entry. */
export declare function modelCardOptionsFrom(modelOptions: readonly FieldOption<string>[], t: SkillsTranslate, autoKey: 'tests.modelAuto' | 'evolution.modelAuto'): FieldOption<string>[];
/** What the pickers read and write, and the directory behind them. */
export interface ModelChoice {
    /** `null` until the directory arrives; the pickers are disabled meanwhile. */
    models: TaskAgentModelCatalog | null;
    preferences: DraftPreferencesView;
    /** Every routable model, follow-default first. */
    options: FieldOption<string>[];
    /** The same for one card's own pick. */
    cardOptions: FieldOption<string>[];
    saveDraftModel(model: ModelRoute | null): void;
    saveSuggestionModel(id: string, model: ModelRoute | null): void;
    saveRunModel(model: ModelRoute | null): void;
    saveSkillRunModel(skillName: string, model: ModelRoute | null): void;
}
/**
 * Read the directory and the stored picks alongside the page's own data, and
 * write one pick at a time. A write shows locally first so the menu answers at
 * once, then takes the Host's answer, which is also what a second window sees.
 */
export declare function useModelChoice(context: SkillsPageContext, autoKey: 'tests.modelAuto' | 'evolution.modelAuto'): ModelChoice;
