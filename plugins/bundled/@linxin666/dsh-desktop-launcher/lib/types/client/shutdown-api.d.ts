/**
 * Browser-side wire helper for the /api/dsh-desktop-launcher/shutdown surface.
 * Plain fetch over same-origin /api; the host half enforces the loopback-only
 * fence and owns the bounded exit request.
 */
/**
 * Ask the host process to exit. Resolves when the host acknowledges; the
 * process tears down shortly afterwards.
 * @returns settlement after the acknowledgement.
 */
export declare function requestShutdown(): Promise<void>;
/**
 * Close the current page before the host process exits. `window.close()`
 * only works for script-opened windows; for a regular tab the browser
 * ignores it, so the fallback replaces the page with a blank tab instead of
 * leaving the user staring at a dead-server connection error.
 */
export declare function closeCurrentPage(): void;
