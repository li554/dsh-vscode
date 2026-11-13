import { type Volatile } from '@deepseek-ai/cosmokit';
import z from '@deepseek-ai/schemastery';
import { type Config } from './config.ts';
/** DSH keeps these references stable while committing live profile edits. */
export type LiveHostConfig = {
    [Key in keyof Config]-?: Key extends 'remoteAccess' ? Config[Key] : Volatile<Config[Key]>;
};
/** Read a detached snapshot of the live profile configuration. */
export declare function plainHostConfig(value?: unknown): Config;
/** Profile Config for live forms; transport authority retains normal remounts. */
export declare const LiveConfig: z<import("./protocol.ts").Config, LiveHostConfig>;
