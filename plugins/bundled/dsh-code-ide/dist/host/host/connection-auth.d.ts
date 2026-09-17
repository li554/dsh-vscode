import type { IncomingMessage } from 'node:http';
import type { HostPluginContext } from './contracts.js';
/**
 * Use the newer Host's browser-auth fence when available. Older Harness
 * versions do not provide Connection, so retain the original loopback fence.
 */
export declare function requestRejection(ctx: Pick<HostPluginContext, 'get'>, request: IncomingMessage): 401 | 403 | undefined;
/** Project an authentication rejection without exposing host-auth details. */
export declare function rejectionMessage(status: 401 | 403): string;
