import type { GateReport, HttpResult, ProcessResult, RedactionResult } from './types.ts';
import type { YamlEngine } from './yaml.ts';
export interface SpawnHandle {
    onStdout(cb: (chunk: string) => void): void;
    onStderr(cb: (chunk: string) => void): void;
    onExit(cb: (code: number | null, signal: string | null) => void): void;
    kill(signal?: string): void;
}
export interface ProcessClient {
    spawn(cmd: string[], opts: {
        cwd?: string;
        env?: Record<string, string | undefined>;
    }): SpawnHandle;
}
export interface HttpClient {
    get(url: string, opts: {
        timeoutMs: number;
    }): Promise<HttpResult>;
}
export interface GateDeps {
    client: ProcessClient;
    http: HttpClient;
    engine: YamlEngine;
    redactText(text: string): RedactionResult;
    /** Milliseconds clock for duration reporting. */
    clock(): number;
}
export interface GateOptions {
    dshPath: string;
    /** Isolated home the profile copy lives in; must never be the live home. */
    isolatedHome: string;
    profile: string;
    /** Extra environment; DSH_HOME and the telemetry switch are forced. */
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
    /** Gate 2 probe target path (default '/'), expected status, and marker. */
    probePath?: string;
    probeStatus?: number;
    probeMarker?: string;
    /** Grace window after SIGTERM for a successful exit. */
    stopGraceMs?: number;
}
/** Parse the printed server URL from gate-2 stdout. */
export declare function parseServerUrl(stdout: string): string | undefined;
/** Merge an environment for an isolated gate run. */
export declare function gateEnvironment(base: Record<string, string | undefined>, isolatedHome: string): Record<string, string | undefined>;
/** Run gate 1: bundle-layer dump under a broken-user-layer escape hatch. */
export declare function runDumpDefaultGate(deps: GateDeps, options: GateOptions, env: Record<string, string | undefined>): Promise<GateReport>;
/** Run gate 2: isolated boot with HTTP probe and graceful termination. */
export declare function runStartGate(deps: GateDeps, options: GateOptions, env: Record<string, string | undefined>): Promise<GateReport>;
/** Run a process to exit with output capture and timeout. */
export declare function runToExit(client: ProcessClient, spec: {
    cmd: string[];
    cwd?: string;
    env?: Record<string, string | undefined>;
    timeoutMs: number;
}): Promise<ProcessResult>;
export declare function countOccurrences(text: string, needle: string): number;
/** Fingerprint helper shared by gate reports: canonical JSON then digest. */
export declare function reportFingerprint(value: unknown): string;
