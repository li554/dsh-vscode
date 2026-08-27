/**
 * Browser-side API client for /api/dsh-desktop-launcher — plain same-origin
 * fetch, the only data path the settings card uses.
 */
import { type CreateResult } from '../protocol.ts';
/** Error carrying the route's JSON error message. */
export declare class DesktopLauncherApiError extends Error {
    constructor(message: string);
}
/** Create (or refresh) the desktop icon. */
export declare function createDesktopShortcut(): Promise<CreateResult>;
