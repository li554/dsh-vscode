/**
 * Snapshot cleanup policy: the config-backed policy, its validation, the
 * `/snapshot-auto-cleanup` command's argument grammar, and the auto-sweep
 * throttle. Kept free of host wiring so the policy and the parser are
 * unit-testable in isolation; `src/index.ts` is the only consumer.
 *
 * Semantics (the "cleanup" vocabulary deliberately avoids "retention"):
 * - `enabled` toggles the AUTOMATIC (24h) sweep. `false` (the default) keeps
 *   every snapshot — the pre-feature behavior — and never persists a policy.
 * - `maxAgeDays` is the only "keep" knob: a finished session dir whose newest
 *   member stamp is older than this many days of idle is removed by a sweep.
 *   `0`/negative/non-integer are rejected, so a broken value can never steer
 *   the sweep into deleting everything.
 * - The policy is this plugin entry's live configuration (`autoCleanupEnabled` /
 *   `autoCleanupMaxAgeDays` — named for what they gate, because the entry's own
 *   `disabled:` flag sits beside them in the same document); an absent value is
 *   the safe default (off), and an invalid one fail-closes a sweep (deletes
 *   nothing) instead of guessing.
 *
 * @module dsh-rewind/snapshot-cleanup
 */
import type { Volatile } from '@deepseek-ai/cordis';
/** The cleanup policy, as resolved from this plugin entry's configuration. */
export interface CleanupConfig {
    readonly enabled: boolean;
    readonly maxAgeDays: number;
}
/** The default keep threshold: finished sessions idle > 30 days are pruned. */
export declare const DEFAULT_MAX_AGE_DAYS = 30;
/** The safe default policy (off) — a missing/corrupt value behaves like this. */
export declare const DEFAULT_CLEANUP_CONFIG: CleanupConfig;
/**
 * The live configuration slice the cleanup policy reads: the two schema fields
 * the host resolves into stable references before `apply` runs. The host's
 * `Config` schema (see `src/index.ts`) declares both as `.volatile()`, which is
 * what makes them user-editable in the Plugins page and live-updated without a
 * restart. These are the DOCUMENT's field names; the resolved policy keeps its
 * own ({@link CleanupConfig}), and the adapter below is the one place that maps
 * between the two.
 */
export interface CleanupSettings {
    readonly autoCleanupEnabled: Volatile<boolean>;
    readonly autoCleanupMaxAgeDays: Volatile<number>;
}
/**
 * The host settings service's entry write port. A write is a revision-fenced
 * document mutation, so clearing a field is what lets it re-inherit the schema
 * default instead of pinning a copy of it.
 */
export interface CleanupConfigWriter {
    /** Entry id the write addresses (this plugin's profile entry). */
    readonly entryId: string;
    /** Merge field values into the entry's user layer. */
    update(entryId: string, patch: {
        autoCleanupEnabled?: boolean;
        autoCleanupMaxAgeDays?: number;
    }): Promise<void>;
    /** Remove fields from the entry's user layer, restoring the inherited value. */
    clear(entryId: string, fields: readonly string[]): Promise<void>;
}
/** A validated policy read/write port the command + auto-sweep use. */
export interface CleanupConfigStore {
    /** The resolved policy (always schema-valid, fail-closes when unavailable). */
    load(): CleanupConfig;
    /** Persist a validated policy, throwing when invalid or unavailable. */
    save(next: CleanupConfig): Promise<void>;
}
/**
 * Adapter over the live {@link CleanupSettings} references and the host's entry
 * write port, mapping the document's field names onto the resolved policy's own.
 * Reads re-read the references, so a settings write is visible without a
 * remount; writes validate via `parseCleanupConfig` first, so a bad value can
 * never reach the document (defense-in-depth below the schema), and a defaulted
 * field is cleared rather than pinned.
 */
export declare function volatileCleanupStore(settings: CleanupSettings, writer: CleanupConfigWriter): CleanupConfigStore;
/** Default auto-sweep cadence (once a day); `autoSweepIntervalMs` overrides it. */
export declare const AUTO_SWEEP_INTERVAL_MS: number;
/** The state file that records the last automatic-sweep wall-clock time. */
export declare const STATE_FILENAME = "snapshot-cleanup-last-sweep.json";
/**
 * Resolve the last-sweep state path. It sits under the harness home so the
 * 24h cadence SURVIVES a host restart (a real deployment is rarely up 24/7,
 * so an in-memory timestamp would reset on every boot and re-sweep too often).
 */
export declare function resolveCleanupStatePath(dshHome?: string): string;
/**
 * Read the persisted last-sweep time (epoch ms). A missing or corrupt file
 * reads as `0` ("never swept"), so the next activity runs the sweep — which is
 * safe because the sweep is idempotent and never deletes the active session.
 */
export declare function loadLastSweepAt(path: string): Promise<number>;
/** Persist the last-sweep time, atomically (temp + rename). */
export declare function saveLastSweepAt(path: string, ms: number): Promise<void>;
/** The slice of a store `runAutoCleanupCheck` needs (pruneStale). */
export interface AutoCleanupPruner {
    pruneStale(opts: {
        keepActiveId?: string;
        maxAgeDays: number;
        dryRun?: boolean;
    }): Promise<unknown>;
}
/**
 * The one-shot auto-cleanup check. Loads the policy + persisted last-sweep time
 * and, only when enabled AND >=24h since the last sweep, runs the sweep and
 * re-anchors the window on disk. Dependencies (store, paths, logger) are
 * injected so the composition is unit-testable without a host. Never rejects:
 * a corrupt config fail-closes (no deletion) and logs, a prune failure logs.
 *
 * `sessionId` is the active session directory that must never be pruned.
 * `signal` is the caller's mount lifecycle: an abort before the prune or before
 * the re-anchor stops the sweep (a live plugin unload must not keep deleting
 * under a disposed owner).
 */
export declare function runAutoCleanupCheck(deps: {
    pruner: AutoCleanupPruner;
    readConfig: () => Promise<{
        ok: true;
        config: CleanupConfig;
    } | {
        ok: false;
        error: string;
    }>;
    statePath: string;
    log: (msg: string) => void;
    /** Sweep cadence in ms; defaults to {@link AUTO_SWEEP_INTERVAL_MS}. */
    intervalMs?: number;
    /** Optional mount lifecycle signal; absent means "never cancelled". */
    signal?: AbortSignal;
}, sessionId: string | undefined): Promise<void>;
/**
 * Validate one parsed JSON value into a {@link CleanupConfig}. Tolerates
 * unknown extra keys; rejects a present-but-wrong-typed known key. Missing
 * known keys fall back to the safe default.
 */
export declare function parseCleanupConfig(raw: unknown): {
    ok: true;
    config: CleanupConfig;
} | {
    ok: false;
    error: string;
};
/** A parsed `/snapshot-auto-cleanup` command (excludes the error branch). */
export type CleanupCommand = {
    action: 'status' | 'on' | 'off';
} | {
    action: 'max-age';
    value: number;
} | {
    action: 'run';
    target: 'rules' | 'current';
    apply: boolean;
};
/**
 * Parse the free-form text after `/snapshot-auto-cleanup`. Pure so it is
 * unit-testable; `src/index.ts` maps the resolved action onto the store / the
 * config file. `max-age` returns the validated positive day count.
 *
 * The `run` verb is the single manual-cleanup action. `--apply` is the ONLY
 * execute-vs-dry-run switch (position-independent): without it the action is a
 * dry-run preview. `--current` re-targets the action to the ACTIVE session's
 * snapshots (the manual "clear this session now"); without it, `run` keeps its
 * age-based stale-session sweep semantics. The old `run-apply` abbreviation is
 * gone — use `run --apply`.
 */
export declare function parseCleanupCommand(rawInput: string): CleanupCommand | {
    error: string;
};
/**
 * The auto-sweep throttle: `lastAtMs` of `0` means "never ran" (a fresh
 * process), so the first call always sweeps; after that a call within
 * `intervalMs` is a no-op. `autoSweepIntervalMs` sets the cadence.
 */
export declare function shouldRunAutoSweep(lastAtMs: number, nowMs: number, intervalMs?: number): boolean;
