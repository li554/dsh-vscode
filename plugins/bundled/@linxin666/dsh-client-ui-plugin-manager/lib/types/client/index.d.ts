/**
 * Plugin-manager browser half: contributes the family plugin-manager tab to
 * the official Plugins settings section (`settings.plugins.tab` slot) and
 * provides the same dual-channel face as the `'pluginManager'` cordis
 * service for sibling client plugins. It is dual-channel: on runtimes with
 * the official installer services (DSHCode, the 1.0.4 checkout web) every
 * operation rides the official `/plugin-installer` and `/plugin-control`
 * loopback RPC channels (the single writer); on the npm-published web runtime
 * those channels do not exist, so the same face falls back to this package's
 * own loopback HTTP gateway, which spawns the official CLI for writes.
 * Neither the tab nor service consumers know which mode the face runs in.
 * @module @linxin666/dsh-client-ui-plugin-manager/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type PluginManagerTabInjected } from './PluginManagerTab.tsx';
import { type PluginManagerKey } from './locales.ts';
import { type PluginManagerService } from '../core/service.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Copy for the family plugin-manager tab. */
        'settings.pluginManager': PluginManagerKey;
    }
}
/** Services required by the slot registration and both channels. */
export declare const inject: string[];
/**
 * The face the Plugin manager tab and the `'pluginManager'` cordis service
 * share: the full tab surface plus the cross-plugin service contract.
 */
export type PluginManagerFace = PluginManagerTabInjected & PluginManagerService;
/**
 * Build the dual-channel face once: official-channel and gateway-channel
 * implementations, the mode detection that picks between them, the repair
 * handoff, and the change-notification listener set. The returned face is
 * both the tab's injected props and the value provided as the
 * `'pluginManager'` cordis service.
 * @param ctx - the client context (connection, workspaces, sessions).
 * @returns the shared face.
 */
export declare function createPluginManagerFace(ctx: ClientContext): PluginManagerFace;
/** Contribute the family plugin-manager tab and provide the shared face. */
export declare function apply(ctx: ClientContext): void;
