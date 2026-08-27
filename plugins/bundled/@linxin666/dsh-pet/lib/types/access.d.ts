/**
 * Pet trust fence: loopback (the desktop) always passes; a live paired-device
 * cookie is an additional allow path when remote-web-ui is loaded. The pet
 * never depends on that plugin — without the service the fence stays
 * loopback-only (same pattern as skill-explorer / aionui-panel).
 */
import type { IncomingMessage } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
/**
 * Whether this request may enter any /api/pet or /pet asset route.
 * @param ctx - host context; may expose remoteWebUiPairing.
 * @param request - the incoming HTTP request.
 * @returns true for loopback, or a live paired-device cookie.
 */
export declare function isPetAllowed(ctx: Context, request: IncomingMessage): boolean;
//# sourceMappingURL=access.d.ts.map