import type { DoctorPolicy, IncidentRecord, ProfileIdentity, ProfileRuntime, SupervisorSnapshot } from '../core/protocol.ts';
export interface PersistedState {
    phase: SupervisorSnapshot['phase'];
    profiles: Record<string, ProfileRuntime>;
    incidents: Record<string, IncidentRecord>;
    recentFailures: Record<string, string[]>;
    paused: boolean;
    policy: DoctorPolicy;
    capsuleVersion?: string;
    degradedReason?: string;
}
export declare function emptyState(): PersistedState;
export declare function snapshotOf(state: PersistedState, version: string, now?: string): SupervisorSnapshot;
export declare function upsertProfile(state: PersistedState, identity: ProfileIdentity): ProfileRuntime;
export declare function openIncident(state: PersistedState, profileId: string, kind: IncidentRecord['kind'], summary: string, evidence: string[], now: string): IncidentRecord;
export declare function recordFailure(state: PersistedState, profileId: string, at: string, windowMs?: number): number;
