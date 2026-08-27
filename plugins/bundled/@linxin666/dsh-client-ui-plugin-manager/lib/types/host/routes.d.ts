/**
 * The gateway HTTP surface: loopback-fenced routes serving the plugin
 * inventory, CLI-backed install/removal jobs, next-start enablement, the
 * (empty on this runtime) failure ring, and registry update checks. The
 * fence is the shared family loopback guard — same-origin local browsers
 * only, mirroring the official loopback authority the installer channels
 * would have enforced.
 * @module @linxin666/dsh-client-ui-plugin-manager/host
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import { type CliGateway } from './gateway.ts';
import { type ProfileFacts } from './profile.ts';
import { buildPluginRow } from './state.ts';
/** Route prefix the browser half mirrors. */
export declare const GATEWAY_PREFIX = "/api/plugin-manager";
/** Dependencies every route shares. */
export interface GatewayRouteDeps {
    facts: ProfileFacts;
    gateway: CliGateway;
    /** Resolve the dsh binary presence (the CLI is the write path). */
    cliAvailable: () => boolean;
    /** Registry fetch seam for update checks (test seam); the default reads the
     * `/<name>/latest` manifest including the `dsh` / `engines` metadata. */
    fetchManifest?: (name: string) => Promise<RegistryVersionManifest | undefined>;
    /** Running DSH host version seam (test seam); the default probes `dsh --version`. */
    dshVersion?: () => Promise<string | undefined>;
    /** Official-channel detection seam (test seam); defaults to the boot dump probe. */
    officialChannels?: () => Promise<boolean>;
}
/** The published `/latest` manifest: version plus the compat metadata fields. */
export interface RegistryVersionManifest {
    version: string;
    /** Untrusted package manifest `dsh` object (bundle / client / engines). */
    dsh?: unknown;
    /** Untrusted package manifest `engines` object (node / dsh). */
    engines?: unknown;
}
/**
 * Build the gateway routes.
 * @param deps - profile facts, the CLI gateway, and seams.
 * @returns the web-server routes to register.
 */
export declare function makeGatewayRoutes(deps: GatewayRouteDeps): WebRoute[];
/** Re-exported for host wiring: build a plugin row against the live snapshot. */
export { buildPluginRow };
