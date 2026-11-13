import { type MnemonKey } from 'dsh-mnemon/client';
import type labels from 'dsh-mnemon-source-memory-spaces/presentation/locales.json';
export type SourceKey = keyof typeof labels.zh;
export declare const css: Readonly<Record<string, string>>;
export declare const sidebarCss: Readonly<Record<string, string>>;
type Translate = (key: SourceKey | MnemonKey, params?: Record<string, unknown>) => string;
/** DSH's language service, as a client context carries it. */
export interface DshLocale {
    bind(namespace: 'mnemon'): (key: MnemonKey, params?: Record<string, unknown>) => string;
    getSnapshot?(): DshLocaleSnapshot;
    subscribe?(listener: () => void): () => void;
}
/** The part of DSH's locale snapshot a lookup chain needs. */
export interface DshLocaleSnapshot {
    active: string;
    locales: readonly {
        id: string;
        fallback?: string;
    }[];
}
export declare const SourceTranslation: import("react").Provider<Translate | undefined>;
export declare function useT(): Translate;
/** The languages DSH asks for a key: the active one, then each one's fallback. */
export declare function languageChain(snapshot: DshLocaleSnapshot): string[];
/**
 * Translate as dsh-mnemon drew these settings, through DSH's language chain
 * and the `mnemon` namespace it registers this copy in. This copy answers in
 * the first of zh and en the chain reaches; a language pack ahead of that one
 * is asked first, through the namespace, as dsh-mnemon asked it; a key this
 * copy lacks goes to the namespace too. Without DSH's chain the page's
 * language picks the copy, as the page frame does.
 */
export declare function settingsTranslate(locale: DshLocale, chain: readonly string[] | undefined, language: string): Translate;
export {};
