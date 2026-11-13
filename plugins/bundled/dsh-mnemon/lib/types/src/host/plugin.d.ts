import { type Config as MnemonConfig } from './config.ts';
import { type LiveHostConfig } from './live-config.ts';
export declare const name = "dsh-mnemon";
export declare const provide: string[];
export declare const inject: string[];
export { LiveConfig as Config } from './live-config.ts';
export type { MnemonConfig };
/** DSH owns assembly; this Host only wires scope, phases and user preferences. */
export declare function apply(rawContext: unknown, rawConfig?: MnemonConfig | LiveHostConfig): void;
