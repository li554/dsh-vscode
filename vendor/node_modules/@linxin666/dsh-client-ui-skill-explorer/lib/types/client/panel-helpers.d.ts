/**
 * Shared panel helpers: the active-dictionary pick (document-language based)
 * and the tiny {name} interpolator. All copy stays in locales.ts.
 */
import { type SkillExplorerKey } from './locales.ts';
/** Template values accepted by the interpolator. */
export type TranslateValues = Record<string, string | number>;
/** Active dictionary, picked by the document language at call time. */
export declare function dictionary(): Record<string, string>;
/** Translate a key with optional {name} template params (current language). */
export declare function tt(key: SkillExplorerKey, values?: TranslateValues): string;
