export interface ServiceSpec {
    platform: NodeJS.Platform;
    label: string;
    executable: string;
    args: string[];
    doctorHome: string;
}
export interface ServicePlan {
    files: Array<{
        path: string;
        content: string;
        mode?: number;
    }>;
    install: string[];
    uninstall: string[];
    restart: string[];
}
export declare function servicePlan(spec: ServiceSpec, env?: NodeJS.ProcessEnv): ServicePlan;
export declare function writeServiceFiles(plan: ServicePlan): Promise<void>;
export declare function removeServiceFiles(plan: ServicePlan): Promise<void>;
export type ServiceRunner = (command: string[]) => Promise<void>;
/**
 * Idempotent service redeploy: drop any previous registration (a first
 * install fails harmlessly), write the definition, bootstrap it, then restart
 * it so the running process picks up the current package code.
 */
export declare function ensureServiceInstalled(plan: ServicePlan, run?: ServiceRunner): Promise<void>;
/** Unregister the service and remove its definition files (tolerates absence). */
export declare function removeService(plan: ServicePlan, run?: ServiceRunner): Promise<void>;
export declare function runCommand(command: string[], timeoutMs?: number): Promise<void>;
