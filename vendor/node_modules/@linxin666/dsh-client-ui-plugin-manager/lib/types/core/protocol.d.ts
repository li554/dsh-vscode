/**
 * Wire parsing for the official plugin-installer / plugin-control RPC
 * channels. This package is a browser-side consumer of those channels: every
 * response is decoded but untrusted, so each parser validates the shape it
 * needs and throws a typed error on mismatch. Callers treat a parse failure
 * as "channel unavailable or drifted" and degrade to command hints.
 *
 * The shapes mirror the official web installer tab's wire protocol (see the
 * DSH checkout's packages/client/ui-settings-plugin-installer/src/client/
 * protocol.ts); they are a contract observation, not an import.
 * @module @linxin666/dsh-client-ui-plugin-manager/core
 */
/** One installed user-plugin row served by `/plugin-installer list`. */
export interface InstalledPluginItem {
    id: string;
    name: string;
    version: string;
    source: {
        kind: 'npm' | 'git';
        spec: string;
    };
    installedAt: string;
    /** Saved next-start enablement from the managed profile patch row. */
    enabled: boolean;
    commit?: string;
}
/** Point-in-time install/update progress reported by the host. */
export interface InstallProgressItem {
    kind: 'idle' | 'install' | 'update';
    stage: 'fetch' | 'download' | 'extract' | 'write';
    percent?: number;
}
/** One plugin with a newer version available. */
export interface PluginUpdateItem {
    id: string;
    current: string;
    latest: string;
    /** Declared DSH minimum the update needs (package manifest's `dsh.engines.dsh`). */
    requiresDsh?: string;
    /** Whether the running DSH host satisfies requiresDsh; absent when unknown. */
    compatible?: boolean;
}
/** One recorded plugin boot failure served by the host. */
export interface PluginFailureItem {
    /** Installed plugin id (package name); empty for unattributable failures. */
    pluginId: string;
    kind: 'load-failure' | 'hang' | 'late-rejection';
    message: string;
    stack: string;
    installPath: string;
    at: string;
}
/** Recovery facts served by the host: the failure ring, the plugin root, and safe mode. */
export interface PluginFailuresSnapshot {
    items: PluginFailureItem[];
    /** Absolute plugin install root — the repair conversation's workspace. */
    pluginRoot: string;
    /** Whether the host is running in safe mode (user plugins skipped). */
    safeMode: boolean;
}
/** One deployment-configured logical product switch. */
export interface PluginControlItem {
    id: string;
    name: string;
    repository: string;
    state: 'enabled' | 'disabled' | 'mixed' | 'unavailable' | 'uninstalled';
}
/**
 * Validate and normalize a `list` / `uninstall` response value.
 * @param value - decoded but untrusted response value.
 * @returns typed installed-plugin rows.
 */
export declare function parsePluginList(value: unknown): InstalledPluginItem[];
/**
 * Validate and normalize an `install` / `update` / `set-enabled` response value.
 * @param value - decoded but untrusted response value.
 * @returns the typed installed-plugin row.
 */
export declare function parseInstalledPlugin(value: unknown): InstalledPluginItem;
/**
 * Validate and normalize a plugin-control `list` / `set-enabled` response value.
 * @param value - decoded but untrusted response value.
 * @returns the typed control items.
 */
export declare function parsePluginControlSnapshot(value: unknown): PluginControlItem[];
/**
 * Validate and normalize a `status` response value.
 * @param value - decoded but untrusted response value.
 * @returns the typed progress state.
 */
export declare function parseInstallStatus(value: unknown): InstallProgressItem;
/**
 * Validate and normalize a `check-updates` response value.
 * @param value - decoded but untrusted response value.
 * @returns typed update rows.
 */
export declare function parseUpdateList(value: unknown): PluginUpdateItem[];
/**
 * Validate and normalize a `failures` response value.
 * @param value - decoded but untrusted response value.
 * @returns the typed failures snapshot.
 */
export declare function parseFailuresSnapshot(value: unknown): PluginFailuresSnapshot;
