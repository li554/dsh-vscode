/**
 * AionUI right-panel system — browser half. The panel itself is retired: the
 * provider choice was removed and the right panel is always the external
 * dsh-better-sidebar side card, so the explorer/preview columns never mount.
 * What remains active here: the composer drop target and transcript mermaid
 * sentinels (both inert without the panel columns), and the side-card
 * settings card in the Web UI Plugins group, which embeds the side card's
 * own settings section inline.
 *
 * Failure policy: every DOM/runtime wiring failure is logged, never thrown —
 * the web shell fails the whole boot when a plugin apply throws.
 *
 * AionUi right-panel design (Apache-2.0, iOfficeAI/AionUi) — re-implemented
 * from measured behavior and architecture, not copied code.
 * @module dsh-aionui-panel/client
 */
import type { ClientContext, SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-runtime/client';
import type { SideCardRegistry } from './SideCardPrefs.tsx';
import { type AionUiPanelKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Panel surface copy. */
        'aionui-panel': AionUiPanelKey;
    }
    interface SlotMap {
        /**
         * One family plugin card inside the Web UI Plugins group. Spelled here
         * with the same shape so this package can register without depending on
         * the sibling web-ui-settings package.
         */
        'web-ui.plugin.item': {
            kind: 'list';
            scope: 'root';
            owner: SettingsPluginItemOwnerProps;
        };
    }
}
/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
    /** Marker field: card owner props are intentionally empty. */
    children?: never;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /**
         * Optional rc.6 compatibility binder provided by dsh-web-ui-settings;
         * absent when that group plugin is not installed, so callers fall back to
         * the official settings scope.
         */
        webUiSettings?: {
            bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S>;
        };
        /**
         * The external dsh-better-sidebar plugin's registry service, published
         * while that plugin is loaded; the settings card enumerates its tab and
         * viewer descriptors for the enable switches.
         */
        betterSidebar?: SideCardRegistry;
    }
}
/** Required services: sessions for the project root, locale for the copy, and the settings scope for the provider choice. */
export declare const inject: string[];
/** Apply the browser half. */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map