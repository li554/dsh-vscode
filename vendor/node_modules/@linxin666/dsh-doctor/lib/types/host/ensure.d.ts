import type { DoctorPaths } from '../agent/paths.ts';
import type { SupervisorResponse } from '../core/protocol.ts';
/**
 * Lifecycle orchestration for the Doctor supervisor service.
 *
 * The host half (the dsh web process) owns deployment because it always runs
 * the current package: it redeploys the user-level supervisor service through
 * the same package's CLI (idempotent, restart-inclusive), waits for the
 * supervisor to answer, refreshes the rescue capsule when its pinned version
 * is stale, and (on uninstall) marks the supervisor state before removing the
 * service. Every external effect sits behind injectable seams so tests verify
 * the full sequence without touching launchctl or a real dsh.
 * @module @linxin666/dsh-doctor/host
 */
/** Result of one spawned command. */
export interface SpawnResult {
    code: number;
    stdout: string;
    stderr: string;
}
/** Spawn seam: default runs the real process. */
export type SpawnFn = (command: string, args: string[], opts: {
    timeoutMs: number;
    env?: NodeJS.ProcessEnv;
}) => Promise<SpawnResult>;
/** Supervisor IPC seam (throws while the supervisor is down). */
export type StatusFn = () => Promise<SupervisorResponse>;
/** Verdict of one lifecycle verb. */
export interface LifecycleReport {
    ok: boolean;
    code: string;
    message?: string;
    /** Human-readable steps that ran, in order. */
    steps: string[];
}
export interface DoctorLifecycleDeps {
    paths: DoctorPaths;
    /** Absolute path of the package CLI (lib/cli.mjs) driving the service. */
    cliPath: string;
    /** Version of the host half (package.json); capsule staleness compares against it. */
    version: string;
    status: StatusFn;
    /** Mark the supervisor state uninstalling before service removal. */
    markUninstall?: () => Promise<unknown>;
    spawn?: SpawnFn;
    /** Whether the supervisor state is provisioned (token file exists). */
    provisioned?: () => Promise<boolean>;
    /** Whether the rescue capsule is missing or pinned to another doctor/credentials version. */
    capsuleStale?: (currentVersion: string, source?: {
        home: string;
        profile: string;
    }) => Promise<boolean>;
    /** Source profile whose credentials mirror staleness is checked against. */
    source?: {
        home: string;
        profile: string;
    };
    pollAttempts?: number;
    pollDelayMs?: number;
}
/** In-flight dedupe face exposed to the routes. */
export interface DoctorLifecycle {
    ensure(): Promise<LifecycleReport>;
    uninstall(): Promise<LifecycleReport>;
}
/** True when the supervisor state directory holds the IPC token. */
export declare function defaultProvisioned(paths: DoctorPaths): Promise<boolean>;
/**
 * True when the capsule is absent, pinned to another doctor version, or its
 * mirrored credentials no longer match the current source files (the user
 * changed providers or keys since the last provision).
 */
export declare function defaultCapsuleStale(paths: DoctorPaths, currentVersion: string, source?: {
    home: string;
    profile: string;
}): Promise<boolean>;
/** Run one lifecycle verb; concurrent calls of the same verb share the run. */
export declare function createDoctorLifecycle(deps: DoctorLifecycleDeps): DoctorLifecycle;
/** Redeploy the service, wait for the supervisor, then refresh a stale capsule. */
export declare function ensureDoctor(deps: DoctorLifecycleDeps): Promise<LifecycleReport>;
/** Mark the supervisor state, then remove the user-level service. */
export declare function uninstallDoctor(deps: DoctorLifecycleDeps): Promise<LifecycleReport>;
