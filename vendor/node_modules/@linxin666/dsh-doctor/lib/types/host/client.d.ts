import { type SupervisorRequest, type SupervisorResponse } from '../core/protocol.ts';
import type { DoctorPaths } from '../agent/paths.ts';
export declare class SupervisorClient {
    private readonly paths;
    private readonly endpoint;
    private readonly explicitToken;
    constructor(paths: DoctorPaths, endpoint?: string, explicitToken?: string | undefined);
    private token;
    call(request: SupervisorRequest): Promise<SupervisorResponse>;
    status(): Promise<SupervisorResponse>;
}
