import type { SupervisorRequest, SupervisorResponse } from '../core/protocol.ts';
export interface WireEnvelope {
    token: string;
    request: SupervisorRequest;
}
export declare function createSupervisorToken(): string;
export declare function tokensEqual(actual: string, expected: string): boolean;
export declare function ensureToken(path: string): Promise<string>;
export declare function callSupervisor(endpoint: string, token: string, request: SupervisorRequest, timeoutMs?: number): Promise<SupervisorResponse>;
