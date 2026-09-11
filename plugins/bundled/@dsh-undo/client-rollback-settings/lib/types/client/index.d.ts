/** Archived Session management registered into Web Settings. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type ArchiveSettingsKey } from './locales.ts';
export type { ArchiveSettingsInjected, ArchiveSettingsProps } from './ArchiveSettingsSection.tsx';
export type { ArchiveSettingsKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Archive Tasks copy. */
        'settings.archive': ArchiveSettingsKey;
    }
}
/** Dictionary namespace owned by this plugin. */
export declare const NS = "settings.archive";
/** Services required by the Settings registration; the Remote namespaces are mounted by this apply. */
export declare const inject: string[];
/** Mount the plugin Remotes and register the Archive Tasks section. */
export declare function apply(ctx: ClientContext): Promise<() => void>;
//# sourceMappingURL=index.d.ts.map