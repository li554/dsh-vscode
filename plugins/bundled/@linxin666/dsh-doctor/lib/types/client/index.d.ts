/**
 * Browser-half entry for the dsh-doctor plugin.
 *
 * Registers the doctor card into the Web UI plugin group
 * (settings → Web UI plugins → Doctor), registers the doctor locale
 * namespace, wires the passive failure probe (window error and
 * unhandledrejection capture, React boundary reports, connection-rebuild boot
 * signals) into the card's recovery console, and starts the loopback
 * /api/doctor poll loop.
 *
 * Resilience contract: apply() never throws. Every mount step is guarded so a
 * missing service, a duplicate injection or a hostile scope degrades to an
 * empty-but-alive plugin instead of taking the GUI down.
 * @module @linxin666/dsh-doctor/client
 */
import type { ClientContext, SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-runtime/client';
import { type DoctorKey } from './locales.ts';
/** Locale namespace owned by this plugin. */
export declare const NS = "doctor";
/** Semantic plugin short name used on the console root container. */
export declare const PLUGIN_SHORT_NAME = "doctor";
/** Owner share of a family plugin card (the group supplies nothing). */
export interface SettingsPluginItemOwnerProps {
    /** Marker field: card owner props are intentionally empty. */
    children?: never;
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Doctor recovery console and settings card copy. */
        'doctor': DoctorKey;
    }
    interface SlotMap {
        /** The child slot the Web UI plugin group declares; this card registers into the group. */
        'web-ui.plugin.item': {
            kind: 'list';
            scope: 'root';
            owner: SettingsPluginItemOwnerProps;
        };
    }
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Optional rc.6 compatibility binder provided by dsh-web-ui-settings. */
        webUiSettings?: {
            bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S>;
        };
    }
}
/** Services required by the browser half. */
export declare const inject: string[];
/** Apply the browser half; never throws. */
export declare function apply(ctx: ClientContext): void;
