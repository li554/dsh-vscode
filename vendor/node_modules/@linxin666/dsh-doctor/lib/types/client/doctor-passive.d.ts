/**
 * Passive browser failure probe for the dsh-doctor recovery console.
 *
 * Captures window error and unhandledrejection events into a bounded ring
 * buffer and notifies a consumer. Also serves as the single incident sink for
 * app-level signals the console itself produces (React boundary catches and
 * connection-rebuild boot signals), so everything appears in one probe list.
 *
 * Resilience contract: no method of this module ever throws. Event listeners
 * read event facts structurally because jsdom (tests) and browsers may hand us
 * differently shaped event objects; every read is guarded.
 * @module @linxin666/dsh-doctor/client
 */
/** Kinds of passive incident the probe can carry. */
export type PassiveKind = 'window-error' | 'unhandled-rejection' | 'react-boundary' | 'connection-reset' | 'plugin-startup-failure';
/** One captured passive incident. */
export interface PassiveIncident {
    /** Monotonic id inside this probe instance. */
    id: string;
    kind: PassiveKind;
    /** Human-readable message (never raw structured data). */
    message: string;
    /** Event source path, when the event carried one. */
    source?: string;
    /** 1-based line number, when available. */
    line?: number;
    /** 1-based column number, when available. */
    column?: number;
    /** Longer detail (stack excerpt or described reason), capped. */
    detail?: string;
    /** Epoch ms of capture. */
    at: number;
}
/** Options for PassiveProbe. */
export interface PassiveProbeOptions {
    /** Push each captured batch; the consumer merges it into its store. */
    notify: (incidents: readonly PassiveIncident[]) => void;
    /** Ring capacity (default 50). */
    max?: number;
    /** Clock seam (default Date.now). */
    now?: () => number;
}
/** Cap a string, appending an ellipsis when truncated. */
export declare function capText(text: string, limit: number): string;
/** Produce a safe, plain-text description of an unknown error value. */
export declare function safeDescribe(value: unknown): string;
/** Normalize one window error event into incident fields (never throws). */
export declare function normalizeWindowError(event: unknown): Pick<PassiveIncident, 'message' | 'source' | 'line' | 'column' | 'detail'>;
/** Normalize one unhandledrejection event into incident fields (never throws). */
export declare function normalizeRejection(event: unknown): Pick<PassiveIncident, 'message' | 'detail'>;
/**
 * Bounded, non-throwing capture of window failure events plus the app-level
 * signal sink. Start once per page; stop on plugin teardown.
 */
export declare class PassiveProbe {
    private readonly notify;
    private readonly max;
    private readonly now;
    private readonly incidents;
    private sequence;
    private started;
    private readonly onError;
    private readonly onRejection;
    constructor(options: PassiveProbeOptions);
    /** Install window listeners (no-op outside a browser window). */
    start(): void;
    /** Remove window listeners and stop capturing raw window events. */
    stop(): void;
    /** Current snapshot (copy; never throws). */
    snapshot(): readonly PassiveIncident[];
    /** Clear the ring and notify an empty batch. */
    clear(): void;
    /** Record an app-level signal (boundary catch or connection rebuild). */
    record(kind: 'react-boundary' | 'connection-reset', message: string, detail?: string): void;
    /** Record a Web UI plugin that was listed in the boot graph but never started. */
    recordPluginStartupFailure(pluginId: string, detail?: string): void;
    private push;
}
