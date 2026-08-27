import type { SupervisorResponse } from '../core/protocol.ts';
import type { DoctorLifecycle, LifecycleReport } from './ensure.ts';
export interface DeploymentMarker {
    version: string;
    cliPath: string;
    profileId: string;
    ok: boolean;
    at: string;
    uninstalled?: boolean;
    error?: string;
}
export interface AutoEnsureState {
    phase: 'idle' | 'checking' | 'installing' | 'ready' | 'failed' | 'suppressed';
    lastAt?: string;
    lastError?: string;
}
export interface AutoEnsureDeps {
    stateDir: string;
    version: string;
    cliPath: string;
    profileId: string;
    lifecycle: DoctorLifecycle;
    status(): Promise<SupervisorResponse>;
    enabled(): boolean;
    now?: () => string;
}
export interface AutoEnsureController {
    kick(force?: boolean): Promise<void>;
    suppress(): void;
    markUninstalled(): Promise<void>;
    record(report: LifecycleReport): Promise<void>;
    state(): AutoEnsureState;
}
/** Reconcile one user-level Doctor deployment without blocking host startup. */
export declare function createAutoEnsure(deps: AutoEnsureDeps): AutoEnsureController;
export declare function serializeDoctorLifecycle(lifecycle: DoctorLifecycle): DoctorLifecycle;
export declare function lifecycleWithUninstallMarker(lifecycle: DoctorLifecycle, marker: Pick<AutoEnsureController, 'markUninstalled' | 'record'>): DoctorLifecycle;
