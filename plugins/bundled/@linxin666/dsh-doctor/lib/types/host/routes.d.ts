import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { SupervisorClient } from './client.ts';
import type { DoctorLifecycle } from './ensure.ts';
export interface DoctorRouteOptions {
    /** Version of the host half (package.json), surfaced for console comparisons. */
    hostVersion: string;
    /** Lifecycle verbs (service install/uninstall + capsule refresh). */
    lifecycle: DoctorLifecycle;
    /** Whether the supervisor state is provisioned; drives the offline error code. */
    provisioned?: () => Promise<boolean>;
}
export declare function makeDoctorRoutes(client: SupervisorClient, profileId: string, options: DoctorRouteOptions): WebRoute[];
