import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
export declare const name = "doctor";
export declare const inject: string[];
export interface Config {
    enabled?: boolean;
    fullProtection?: boolean;
    autoRepair?: boolean;
    heartbeatIntervalMs?: number;
}
export declare const Config: z<Config>;
export declare const DOCTOR_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
export declare function effectiveConfig(config?: Config): Required<Config>;
export declare const apply: (ctx: Context, config?: Config) => void;
