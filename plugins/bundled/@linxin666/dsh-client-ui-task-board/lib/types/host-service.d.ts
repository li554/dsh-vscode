import type { ApiProxy } from '@deepseek-ai/dsh-host-apiproxy';
import { HostTaskLedger } from './host-ledger.ts';
import { HostExecutionRunner, type SessionCommandDispatcher } from './host-runner.ts';
import { PowerInhibitor } from './power-inhibitor.ts';
import type { TaskBoardAction, TaskBoardEventPayload, TaskBoardSnapshot } from './protocol.ts';
export declare class TaskBoardHostService {
    readonly ledger: HostTaskLedger;
    readonly runner: HostExecutionRunner;
    readonly power: PowerInhibitor;
    private readonly listeners;
    private timers;
    private lastScheduleTick;
    private disposed;
    private pollInFlight;
    private tickInFlight;
    private active;
    private preventIdleSleep;
    private lastPowerJson;
    private readonly now;
    constructor(api: ApiProxy, options?: {
        ledger?: HostTaskLedger;
        power?: PowerInhibitor;
        now?: () => number;
        commandDispatcher?: SessionCommandDispatcher;
    });
    start(): void;
    setConfiguration(active: boolean, preventIdleSleep: boolean): void;
    snapshot(): TaskBoardSnapshot;
    /** SSE frame payload; deliberately skips the tasks deep-clone of {@link snapshot}. */
    eventPayload(): TaskBoardEventPayload;
    subscribe(listener: () => void): () => void;
    apply(requestId: string, action: TaskBoardAction): TaskBoardSnapshot;
    dispose(): void;
    private launch;
    private pollSessions;
    /** Reuse the session list this poll already fetched: one list RPC per tick, not 1 + E. */
    private reconcileExecutions;
    private tickSchedule;
    private armedSchedules;
    private scheduleLaunch;
    private schedulePoll;
    private scheduleTick;
    private syncPowerReasons;
    private emit;
}
