/**
 * The /api/dsh-desktop-launcher/shutdown route: a loopback-only control
 * surface that asks the host process to exit. The response is written first
 * and the exit request is scheduled a short beat later so the browser
 * receives the acknowledgement before the process tears down.
 */
import type { IncomingMessage } from 'node:http';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import { isLoopbackRequest } from './loopback.ts';
/** How long the exit request waits after the response is flushed. */
export declare const EXIT_DELAY_MS = 500;
export { isLoopbackRequest };
/** Route-family dependencies (test seam). */
export interface ShutdownRouteDeps {
    /** Loopback-only fence: the control endpoint is host-surface only. */
    fence(request: IncomingMessage): boolean;
    /** Request the bounded process exit (ctx.appExit, process.exit fallback). */
    requestExit(code: number): void;
    /** Schedule the exit after the response; defaults to setTimeout. */
    schedule?: (fn: () => void, ms: number) => unknown;
}
/**
 * Build the shutdown route.
 * @param deps - fence + exit seam (and an optional schedule seam for tests).
 * @returns the exact route to register on webServer.
 */
export declare function makeShutdownRoute(deps: ShutdownRouteDeps): WebRoute;
