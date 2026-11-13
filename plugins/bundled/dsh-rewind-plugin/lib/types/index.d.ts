/**
 * dsh-rewind host half: the `/rewind` command and the Claude-Code-style
 * checkpoint store, composed as one dual-face bundle row (the browser half
 * lives in `src/client/`).
 *
 * Rewind mechanism: planning is pure (`src/rewind.ts`); execution appends a
 * marker `user/message` whose `surfaceOp` replaces the target and every surface
 * node after it with itself, cutting only the model-visible surface
 * (`docs/architecture.md`).
 *
 * File restore (mode `both`) follows the checkpoint model: one dense
 * `path → FileState` manifest per user message is captured at
 * `agent/pre-step` after the step is admitted, before any model call or tool
 * runs. A file first touched by `write`/`edit` after that point gets a v1 row
 * in the current manifest at the `tools/execute` around-dispatch stage (after
 * approval, before the body), so the row always holds the pre-touch state and
 * a denied call records nothing. Versions live as shared raw byte files; a
 * rewind reconciles the target manifest against the live disk and applies
 * per-file atomic replaces/deletes. The store keeps the newest 100 manifests
 * per session and survives a host restart. See `src/snapshot.ts`.
 *
 * @module dsh-rewind
 */
import type { Context, Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type CleanupSettings } from './snapshot-cleanup.ts';
export { SnapshotStore } from './snapshot.ts';
export type { Checkpoint, ClearSessionReport, FileImpact, FileState, PruneStaleReport, RestoreOutcome, SkippedPath, StoreSession, UncoveredPath } from './snapshot.ts';
export declare const name = "dsh-rewind";
export declare const inject: string[];
/**
 * The internal engine channel the client drives, so the rewind surface never
 * depends on a name a third-party plugin can take. Mirrored by `ENGINE_COMMAND`
 * in `src/client/hidden.ts` — the two bundles share no module.
 */
export declare const ENGINE_COMMAND = "rewind-plugin";
/** Plugin config. */
export interface RewindConfig {
    /** Checkpoint store root (exact path; beats the harness-home default). */
    readonly snapshotDir?: string;
    /** Harness home override (`config.dshHome` > `$DSH_HOME` > `~/.dsh`); feeds the default snapshot/cleanup paths. */
    readonly dshHome?: string;
    /** Per-file checkpoint cap in bytes; `0` disables the cap. Default {@link DEFAULT_MAX_FILE_BYTES}. */
    readonly maxFileBytes?: number;
    /** Automatic snapshot-sweep cadence in ms. Default {@link AUTO_SWEEP_INTERVAL_MS}. */
    readonly autoSweepIntervalMs?: number;
}
/** The default for {@link FileCheckpointingSettings.fileCheckpointingEnabled}. */
export declare const DEFAULT_FILE_CHECKPOINTING_ENABLED = true;
/**
 * The live file-checkpointing switch (Claude Code's
 * `fileCheckpointingEnabled`): whether NEW checkpoints may be recorded.
 */
export interface FileCheckpointingSettings {
    readonly fileCheckpointingEnabled: Volatile<boolean>;
}
/**
 * The plugin's full configuration: store options plus the three user-editable
 * policy fields. `.volatile()` resolves them into live references for the
 * Plugins page; the names say what they gate, because a bare `enabled` would
 * read like the entry's own `disabled:` flag.
 */
export interface Config extends RewindConfig, CleanupSettings, FileCheckpointingSettings {
}
/** The `Config` schema the host resolves and projects as this entry's form. */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    snapshotDir: z<string, string, "plain">;
    dshHome: z<string, string, "plain">;
    maxFileBytes: z<number, number, "defined">;
    autoSweepIntervalMs: z<number, number, "defined">;
    fileCheckpointingEnabled: z<boolean, boolean, "volatile-defined">;
    autoCleanupEnabled: z<boolean, boolean, "volatile-defined">;
    autoCleanupMaxAgeDays: z<number, number, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    snapshotDir: z<string, string, "plain">;
    dshHome: z<string, string, "plain">;
    maxFileBytes: z<number, number, "defined">;
    autoSweepIntervalMs: z<number, number, "defined">;
    fileCheckpointingEnabled: z<boolean, boolean, "volatile-defined">;
    autoCleanupEnabled: z<boolean, boolean, "volatile-defined">;
    autoCleanupMaxAgeDays: z<number, number, "volatile-defined">;
}>>, "plain">;
/**
 * The settings entry id this plugin's configuration is addressed by: the PROFILE
 * ROW id from the bundle's patch, not this fiber's nested include id. The loader
 * mounts a bundle's rows under an `include:` scope, so the fiber id carries that
 * prefix while the configuration editor keys entries and profile patches by the
 * bare row id.
 * @param entryId - this fiber's Loader entry id, when it has one.
 * @returns the configuration key, or undefined without an entry.
 */
export declare function profileEntryKey(entryId: string | undefined): string | undefined;
/**
 * Register the `/rewind` command and the checkpoint pipeline: dense manifests
 * at `agent/pre-step` and first-touch rows at `tools/execute`.
 *
 * The command is fs-independent and registers immediately. The checkpoint
 * pipeline mounts through a dynamic `ctx.inject(['fs', 'workingDirectory'])`:
 * it takes effect whenever those services become available and never fails the
 * plugin's load in a deployment without them (without fs, no checkpoints are
 * recorded and `both` restores report no checkpoint).
 *
 * The pre-step listener is prepended so it observes the final decision after
 * every other listener, then `await next()`; a rejected step creates nothing.
 * Capture runs in `tools/execute` (the around-dispatch stage), NOT in
 * `tools/pre-execute`: a pre-execute `{ kind: 'ask' }` short-circuit from
 * another plugin (e.g. dsh-edit-approval) skips later pre-execute listeners,
 * and a denied call never dispatches — so approved calls are still captured,
 * denied calls record nothing.
 *
 * @param ctx - context carrying `commands`, `tools`, and an optional `fs`.
 * @param config - resolved plugin config: the store options (`snapshotDir`,
 *  `dshHome`, `maxFileBytes`) plus the live policy
 *  (`fileCheckpointingEnabled`, cleanup `enabled`/`maxAgeDays`).
 */
export declare function apply(ctx: Context, config?: Config): void;
