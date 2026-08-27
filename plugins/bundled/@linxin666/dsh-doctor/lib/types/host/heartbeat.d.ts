import type { SupervisorClient } from './client.ts';
export interface HeartbeatOptions {
    client: SupervisorClient;
    profileId: string;
    runId: string;
    pid?: number;
    intervalMs?: number;
    phase?: () => 'booting' | 'ready' | 'degraded';
    webUrl?: () => string | undefined;
}
export declare function startHeartbeat(options: HeartbeatOptions): () => void;
