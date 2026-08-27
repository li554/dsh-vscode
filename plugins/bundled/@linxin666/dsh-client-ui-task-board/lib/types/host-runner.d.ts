import type { ApiProxy } from '@deepseek-ai/dsh-host-apiproxy';
import type { CommandResult } from '@deepseek-ai/dsh-commands/types';
import type { TaskRecord } from './core/tasks.ts';
/** One session-list row, extracted from the sessions.list RPC result. */
export type SessionSummary = Extract<Awaited<ReturnType<ApiProxy['sessions']['list']>>['result'], {
    ok: true;
}>['value']['items'][number];
type ExecutionSessionId = Extract<Awaited<ReturnType<ApiProxy['sessions']['create']>>['result'], {
    ok: true;
}>['value']['sessionId'];
export interface SessionCommandDispatcher {
    execute(sessionId: ExecutionSessionId, line: string, signal: AbortSignal): Promise<CommandResult | undefined>;
}
export type ExecutionInspection = {
    outcome: 'pending';
} | {
    outcome: 'succeeded';
} | {
    outcome: 'failed';
    error: string;
} | {
    outcome: 'cancelled';
    error: string;
};
/** A post-create launch failure that still identifies the session to the ledger. */
export declare class SessionLaunchError extends Error {
    readonly sessionId: string;
    constructor(sessionId: string, cause: unknown);
}
export declare class HostExecutionRunner {
    private readonly api;
    private readonly commands?;
    constructor(api: ApiProxy, commands?: SessionCommandDispatcher | undefined);
    launch(task: TaskRecord): Promise<string>;
    listRunning(): Promise<{
        known: true;
        count: number;
        items: SessionSummary[];
    } | {
        known: false;
    }>;
    /**
     * Resolve one execution's outcome. The caller may pass the session list it
     * already fetched this poll tick; otherwise inspect lists sessions itself.
     * Sharing the list keeps a poll with E open executions at one list RPC
     * instead of 1 + E.
     */
    inspect(sessionId: string, startedAt?: number, sessions?: readonly SessionSummary[]): Promise<ExecutionInspection>;
}
export {};
