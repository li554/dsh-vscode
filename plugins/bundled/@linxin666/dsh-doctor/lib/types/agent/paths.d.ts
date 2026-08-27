export interface DoctorPaths {
    root: string;
    state: string;
    registry: string;
    incidents: string;
    snapshots: string;
    candidates: string;
    quarantine: string;
    capsule: string;
    logs: string;
    socket: string;
    token: string;
}
export declare function doctorPaths(env?: NodeJS.ProcessEnv, home?: string): DoctorPaths;
