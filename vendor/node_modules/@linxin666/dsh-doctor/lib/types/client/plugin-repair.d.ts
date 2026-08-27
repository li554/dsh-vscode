/**
 * Plugin-repair port for the dsh-doctor recovery console.
 *
 * Wraps the optional `'pluginManager'` cordis service (provided by the
 * dsh-plugin-manager client half) into the narrow seam the console needs: the
 * recorded plugin boot-failure ring and the next-start disable verb. The
 * service is resolved structurally (no value import, no inject dependency),
 * so a shell without the plugin manager degrades the row actions instead of
 * failing apply.
 * @module @linxin666/dsh-doctor/client
 */
/** One recorded plugin boot failure (the service's failure-ring slice). */
export interface PluginsFailureItem {
    pluginId: string;
    message: string;
    stack?: string;
}
/** Settled disable outcome. */
export type PluginDisableResult = {
    ok: true;
} | {
    ok: false;
    message: string;
};
/** The narrow face the console drives. */
export interface PluginRepairPort {
    /** Read the recorded boot-failure ring (empty when the runtime keeps none). */
    failures(): Promise<PluginsFailureItem[]>;
    /** Flip one plugin's next-start enablement (takes effect after restart). */
    disable(pluginId: string): Promise<PluginDisableResult>;
}
/**
 * Build the port over the raw `ctx.get('pluginManager')` value. Returns
 * undefined when the service is absent.
 * @param pluginManager - the raw service value (unknown by design).
 */
export declare function createPluginRepairPort(pluginManager: unknown): PluginRepairPort | undefined;
