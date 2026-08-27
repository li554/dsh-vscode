import { type YamlEngine } from './yaml.ts';
import { type FsLike } from './fs.ts';
import type { GateDeps as GateDepsAlias } from './gates.ts';
import type { Diagnostic, GateReport, PlanAction } from './types.ts';
export interface RecoveryRequest {
    /** The harness home (DSH_HOME) holding the profile. */
    home: string;
    /** Safe profile name under profiles/. */
    profile: string;
    /** Absolute path of the dsh executable used by the gates. */
    dshPath: string;
    /** Injected filesystem (default nodeFs). */
    fs?: FsLike;
    /** Injected gate dependencies (process, http, yaml, redaction, clock). */
    gate?: GateDepsAlias;
    /** ISO timestamp provider (default now). */
    now?: () => string;
    /** Milliseconds clock for locks and gate duration (default Date.now). */
    clock?: () => number;
    /** Process id for lock tokens (default process.pid). */
    pid?: number;
    /** Alive probe for stale-lock detection (default: pid 0 dead, others alive). */
    pidAlive?: (pid: number) => boolean;
    /**
     * Promote only when truthy. The supervisor passes whether the profile is
     * currently running; the CLI defaults to blocked (fail-closed).
     */
    allowLive?: boolean;
    /** Promote immediately after gates. False leaves a durable staged candidate for confirmRepair. */
    autoPromote?: boolean;
}
export interface RecoveryOutcome {
    ok: boolean;
    phase: 'blocked' | 'diagnosed' | 'noop' | 'planned' | 'staged' | 'verified' | 'promoted' | 'rolled-back' | 'aborted' | 'failed';
    diagnostics: Diagnostic[];
    actions: PlanAction[];
    /** Actions that touch files outside the profile dir (home-level patch). Never auto-applied. */
    manualActions: PlanAction[];
    snapshotId?: string;
    gates?: GateReport[];
    txnId?: string;
    message?: string;
}
/** Inputs needed to restore an existing transaction; no DSH process is run. */
export type RollbackRequest = Pick<RecoveryRequest, 'home' | 'profile' | 'fs' | 'now' | 'clock' | 'pid' | 'pidAlive'>;
export interface RealGateOptions {
    /** Extra env for the gate runs (default process.env). */
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
}
/** Build real process/http gate dependencies for a repair run. */
export declare function realGateDeps(options?: {
    clock?: () => number;
    engine?: YamlEngine;
}): GateDepsAlias;
/** Snapshot one profile (read-only aside from the snapshot store). */
export declare function snapshotProfile(request: RecoveryRequest): Promise<RecoveryOutcome>;
/** Diagnose and plan one profile without mutating it. */
export declare function diagnoseAndPlan(request: RecoveryRequest): Promise<RecoveryOutcome>;
/** Run the full repair transaction (stage, apply, gates, promote, verify, commit). */
export declare function repairProfile(request: RecoveryRequest, gateOptions?: RealGateOptions): Promise<RecoveryOutcome>;
/** Promote a durable staged candidate after explicit confirmation. */
export declare function confirmRepair(request: RecoveryRequest, txnId: string, gateOptions?: RealGateOptions): Promise<RecoveryOutcome>;
/** Restore a promoted transaction by moving the quarantine back. */
export declare function rollbackTransaction(request: RollbackRequest, txnId: string): Promise<RecoveryOutcome>;
/** Read and validate the profile identity needed by `rollback <txnId>`. */
export declare function discoverRollbackProfile(home: string, txnId: string, fs?: FsLike): Promise<string>;
