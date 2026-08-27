import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type ControlChange } from '../core/conflict.ts';
import type { InstallProgressItem, InstalledPluginItem, PluginControlItem, PluginFailuresSnapshot, PluginUpdateItem } from '../core/protocol.ts';
/** Registration-side wire face used by the tab. */
export interface PluginManagerTabInjected {
    /** Whether this browser has loopback authority to use the host routes. */
    isLoopback: boolean;
    /** Read the installed snapshot. */
    list: () => Promise<InstalledPluginItem[]>;
    /** Install one plugin from an npm spec or git URL. */
    install: (spec: string) => Promise<InstalledPluginItem>;
    /** Re-install one plugin from its recorded source. */
    update: (id: string) => Promise<InstalledPluginItem>;
    /** Remove one plugin. */
    uninstall: (id: string) => Promise<InstalledPluginItem[]>;
    /** Persist one user plugin's next-start enablement. */
    setEnabled: (id: string, enabled: boolean) => Promise<InstalledPluginItem>;
    /** Compare installed versions against their sources. */
    checkUpdates: () => Promise<PluginUpdateItem[]>;
    /** Read the current install/update progress. */
    status: () => Promise<InstallProgressItem>;
    /** Read the recorded boot failures, plugin root, and safe-mode state. */
    failures: () => Promise<PluginFailuresSnapshot>;
    /** Persist the safe-mode marker (web: applied at the next manual restart). */
    setSafeMode: (enabled: boolean) => Promise<void>;
    /** Start a repair conversation over the plugin install root. */
    repairPlugin: (pluginRoot: string, message: string) => Promise<void>;
    /** Read the deployment-configured built-in product switches. */
    controlsList: () => Promise<PluginControlItem[]>;
    /** Persist one product's next-start enablement. */
    controlsSetEnabled: (pluginId: string, enabled: boolean) => Promise<PluginControlItem[]>;
    /** Conflicts the gateway host computed around the last install (gateway mode only). */
    lastInstallConflicts?: () => readonly ControlChange[];
}
/** Full component props assembled by the Settings slot renderer. */
export type PluginManagerTabProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'settings.pluginManager'> & InjectFace<PluginManagerTabInjected>;
/** The plugin-manager settings tab. */
export declare function PluginManagerTab(props: PluginManagerTabProps): import("react").JSX.Element;
