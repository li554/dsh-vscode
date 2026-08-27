/**
 * Host half of the dsh-plugin-manager plugin — runs in the DSH host process.
 *
 * Dual-channel design: on runtimes with the official installer services
 * (DSHCode and the 1.0.4 checkout web), the browser half uses the official
 * `/plugin-installer` and `/plugin-control` RPC channels and this half does
 * nothing. On the npm-published web runtime (rc.6/rc.7), those channels do
 * not exist, so this half mounts a loopback-fenced HTTP gateway: the
 * inventory reads the profile files, installs and removals spawn the
 * official CLI (the single writer), and enablement writes bare `disabled`
 * override rows into the profile patch.
 * @module @linxin666/dsh-client-ui-plugin-manager
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export declare const name = "ui-plugin-manager";
/** Services the gateway needs — the web server seam. */
export declare const inject: string[];
/** Apply the host half (once per process). */
export declare const apply: typeof applyImpl;
declare function applyImpl(ctx: Context): void;
export {};
