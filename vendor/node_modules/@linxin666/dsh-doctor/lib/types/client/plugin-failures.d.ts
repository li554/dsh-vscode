/**
 * Failed-plugin reconciliation for the dsh-doctor recovery console.
 *
 * The web shell's module system (ctx.modules) composes one entry row per
 * enabled client plugin from the Host boot graph and materializes each bundle
 * when its entry applies. A plugin whose script failed to load, whose factory
 * threw, or whose apply never settled stays out of the materialized registry
 * even though its row is still listed in the manifest. Comparing the manifest
 * rows against the registry therefore exposes the plugins that failed to
 * start, without any event plumbing and without touching the shell.
 *
 * The consumer only needs the two structural reads this module defines; the
 * official shape is used structurally (no value import), so a missing or
 * foreign module system degrades to an empty result instead of breaking the
 * console.
 * @module @linxin666/dsh-doctor/client
 */
/** The structural slice of ctx.modules this scanner reads. */
export interface PluginModulesSeam {
    /** Host-composed entry graph (WebBootGraph shape). */
    manifest?: {
        plugins?: {
            id?: unknown;
        }[];
    };
    /** Materialized-module registry: id -> record. */
    loadCache?: {
        has(id: string): boolean;
    };
}
/** Failed-plugin ids that were listed but never materialized. */
export declare function detectFailedPluginIds(modules: PluginModulesSeam | undefined | null): string[];
