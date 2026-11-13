import copy from '../../presentation/locales.json';
export type SkillsKey = keyof typeof copy.zh;
export type SkillsTranslate = (key: SkillsKey, params?: Record<string, unknown>) => string;
export declare const css: Readonly<Record<string, string>>;
export declare const sidebarCss: Readonly<Record<string, string>>;
export declare function translate(locale: string): SkillsTranslate;
export declare function useT(): SkillsTranslate;
export declare function percent(value: number | undefined): string;
/** A large count the way the language says it short: 21.4万, 214K. */
export declare function compactCount(count: number, language: string): string;
export declare function points(value: number | undefined): string;
/** "3 min ago" in the page's language; older than a week shows the date. */
export declare function relative(t: SkillsTranslate, iso: string | undefined, now?: number): string;
export declare function stamp(iso: string | undefined): string;
export declare function errorText(error: unknown): string;
