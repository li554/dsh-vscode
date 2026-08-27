import { type SupervisorRequest, type SupervisorResponse } from '../core/protocol.ts';
import { type DoctorPaths } from './paths.ts';
export interface SupervisorOptions {
    paths?: DoctorPaths;
    version?: string;
    now?: () => string;
    heartbeatTimeoutMs?: number;
    /** Capsule provisioning seam; tests inject a fake and skip real dsh runs. */
    provisioner?: (paths: DoctorPaths) => Promise<void>;
}
export declare class DoctorSupervisor {
    readonly paths: DoctorPaths;
    private state;
    private token;
    private server?;
    private sweep?;
    private readonly version;
    private readonly now;
    private readonly heartbeatTimeoutMs;
    private readonly provisioner;
    private provisioning;
    constructor(options?: SupervisorOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    handleWire(body: string): Promise<SupervisorResponse>;
    handle(request: SupervisorRequest): Promise<SupervisorResponse>;
    /**
     * Run the deterministic recovery workflow for one incident; records the outcome on the incident.
     */
    private runRecovery;
    /**
     * Enter the provisioning phase and refresh the rescue capsule in the
     * background. The IPC response returns immediately with the provisioning
     * snapshot; the outcome (armed or degraded) is persisted when the capsule
     * run settles. Concurrent provision requests are coalesced.
     */
    startProvision(): Promise<void>;
    private finishProvision;
    private runCapsuleProvision;
    private cleanupCapsuleCredentials;
    private locateDsh;
    private persistQueue;
    /** Serialized persist: concurrent handle/sweep writes queue instead of racing on the temp file. */
    private persist;
    private sweepHeartbeats;
}
export declare function runSupervisor(): Promise<void>;
