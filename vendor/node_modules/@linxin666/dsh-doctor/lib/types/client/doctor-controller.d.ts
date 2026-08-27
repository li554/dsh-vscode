/**
 * Browser-half state controller for the dsh-doctor recovery console.
 *
 * Owns one immutable snapshot (a small external store for useSyncExternalStore),
 * the refresh/action/report verbs over the loopback API, the passive probe
 * merge, and the poll loop. Resilience contract: every public method resolves
 * or no-ops, never throws; the host being absent, a fetch failure or a broken
 * response only degrades the snapshot.
 * @module @linxin666/dsh-doctor/client
 */
import { DoctorApi, type DoctorApiFail } from './doctor-api.ts';
import type { DoctorIncident, DoctorProfileRuntime, DoctorSnapshot } from './doctor-types.ts';
import { PassiveProbe, type PassiveIncident } from './doctor-passive.ts';
import { type PluginModulesSeam } from './plugin-failures.ts';
import type { HarnessPort, HarnessTarget } from './harness-send.ts';
import type { PluginRepairPort, PluginsFailureItem } from './plugin-repair.ts';
/** Settled outcome of one send-to-Harness call. */
export type HarnessSendOutcome = {
    ok: true;
} | {
    ok: false;
    message: string;
};
/** Settled outcome of one plugin-disable call. */
export type PluginDisableOutcome = {
    ok: true;
} | {
    ok: false;
    message: string;
};
/** Console load phase. */
export type DoctorPhase = 'idle' | 'loading' | 'ready';
/** Host availability as last observed by the browser half. */
export type DoctorHostState = 'unknown' | 'available' | 'unavailable';
/** One boot/reconnect signal observed by the browser half. */
export interface DoctorBootSignal {
    kind: 'connection-reset';
    at: number;
}
/** Settled outcome of one console action. */
export type DoctorActionOutcome = {
    ok: true;
    kind: 'reported' | 'completed' | 'sent' | 'disabled';
    id?: string;
} | {
    ok: false;
    message: string;
};
/** Immutable snapshot consumed by the console. */
export interface DoctorView {
    phase: DoctorPhase;
    host: DoctorHostState;
    snapshot: DoctorSnapshot | undefined;
    profiles: DoctorProfileRuntime[];
    incidents: DoctorIncident[];
    /** Browser-side passive incidents (window errors, rejections, local signals). */
    probe: readonly PassiveIncident[];
    /** Recorded plugin boot failures from the plugin-manager service, when present. */
    pluginFailures: readonly PluginsFailureItem[];
    bootSignals: DoctorBootSignal[];
    lastCheckedAt: number | undefined;
    lastError: string | undefined;
    /** Machine code of the last offline failure (SUPERVISOR_UNPROVISIONED etc.). */
    lastErrorCode: string | undefined;
    /** Version of the host half, when the last status response carried it. */
    hostVersion: string | undefined;
    actionRunning: boolean;
    action: DoctorActionOutcome | undefined;
}
/** Initial (pre-connect) snapshot. */
export declare function initialDoctorView(): DoctorView;
/** Minimal external store: immutable snapshots, never-throwing notify. */
export declare class DoctorStore {
    private view;
    private readonly listeners;
    getSnapshot(): DoctorView;
    subscribe(listener: () => void): () => void;
    set(patch: Partial<DoctorView>): void;
}
/** Injectable timer pair (defaults to the window globals). */
export interface DoctorTimers {
    set(callback: () => void, ms: number): unknown;
    clear(handle: unknown): void;
}
/** Options for DoctorController. */
export interface DoctorControllerOptions {
    api?: DoctorApi;
    passive: PassiveProbe;
    /** Poll interval while the tab is visible (default 15000 ms). */
    intervalMs?: number;
    /** Clock seam (default Date.now). */
    now?: () => number;
    /** Timer seam (default window.globalThis-based). */
    timers?: DoctorTimers;
    /**
     * The web shell module system (ctx.modules), structurally. When present, the
     * controller reconciles the boot graph against the materialized registry and
     * records plugins that were enabled but never started.
     */
    modules?: PluginModulesSeam | undefined;
    /**
     * Send-to-Harness port. When absent (no sessions service), the console
     * explains the gap instead of offering a dead send button.
     */
    harness?: HarnessPort | undefined;
    /**
     * Plugin-repair port (the `pluginManager` service wrapper). When absent,
     * failed-plugin rows keep only their copy affordance.
     */
    pluginRepair?: PluginRepairPort | undefined;
    /** How long an unresolved plugin must stay missing before it is recorded (default 8000 ms). */
    failureGraceMs?: number;
}
/** Default poll interval in ms. */
export declare const DEFAULT_POLL_INTERVAL_MS = 15000;
/** One-line summary of an API failure (never throws). */
export declare function describeApiFailure(failure: DoctorApiFail): string;
/**
 * Owns the console snapshot and its refresh loop. Construct with a PassiveProbe
 * whose notify callback routes to syncProbe; start() kicks the poll loop and
 * the visibility guard; dispose() stops everything.
 */
export declare class DoctorController {
    /** Read-only external store face. */
    readonly store: DoctorStore;
    /** Bound subscribe for useSyncExternalStore. */
    readonly subscribe: (listener: () => void) => () => void;
    /** Bound snapshot for useSyncExternalStore. */
    readonly getSnapshot: () => DoctorView;
    private readonly api;
    private readonly passive;
    private readonly intervalMs;
    private readonly now;
    private readonly timers;
    private readonly modules;
    private readonly harness;
    private readonly pluginRepair;
    private readonly failureGraceMs;
    /** Plugin ids seen missing so far; a steady config lets failures be confirmed across a poll. */
    private readonly pendingPluginFailures;
    /** Plugin ids already recorded as startup failures. */
    private readonly recordedPluginFailures;
    private timer;
    private visibilityListener;
    private disposed;
    constructor(options: DoctorControllerOptions);
    /** Merge the passive probe's current ring into the snapshot. */
    syncProbe(): void;
    /**
     * Reconcile the boot graph against the module registry and record plugins
     * that were enabled but never started. A plugin must stay missing across the
     * grace window before it is recorded, so entries that materialize slightly
     * after this console's own apply are never misreported.
     */
    scanPluginFailures(): void;
    /** Record a plugin startup failure observed by an external signal (loader event). */
    notePluginStartupFailure(pluginId: string): void;
    /** Resolve the current session the console would send into. */
    harnessTarget(): HarnessTarget | undefined;
    /** Refresh the plugin-manager failure ring (best effort). */
    refreshPluginFailures(): Promise<void>;
    /**
     * Disable one failed plugin for the next host restart through the
     * plugin-manager port.
     */
    disablePlugin(pluginId: string): Promise<PluginDisableOutcome>;
    /**
     * Queue the composed prompt into the current session; the outcome lands in
     * the snapshot's action line ('sent' on success).
     */
    sendToHarness(text: string): Promise<HarnessSendOutcome>;
    /** One refresh cycle: the supervisor snapshot over the loopback API. */
    refresh(): Promise<void>;
    /** Run the diagnose action and merge the resulting snapshot. */
    runDiagnose(): Promise<void>;
    /** One-click lifecycle install/repair: deploy the service and refresh the capsule. */
    runProvision(): Promise<void>;
    /** Remove the user-level supervisor service (state data is kept). */
    runUninstall(): Promise<void>;
    /** Run the repair action against the first repairable incident. */
    runRepair(): Promise<void>;
    /** Confirm the first isolated candidate waiting for promotion. */
    runConfirm(): Promise<void>;
    /** Report the newest passive incident to the supervisor (best effort). */
    reportProbe(): Promise<void>;
    /** Clear the passive probe ring (local only). */
    clearProbe(): void;
    /** Report a React boundary catch into the probe list. */
    recordBoundary(error: unknown): void;
    /** Record a boot/reconnect signal and trigger a refresh. */
    noteConnectionReset(): void;
    /** First incident that is repairable and not already settled. */
    firstRepairableIncident(): DoctorIncident | undefined;
    private invokeAction;
    /**
     * Start the poll loop plus the visibility guard. Polling pauses while the
     * tab is hidden. Returns the disposer.
     */
    start(): () => void;
    /** Stop the poll loop; the passive probe keeps its ring but listeners stay. */
    dispose(): void;
}
