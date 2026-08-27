/**
 * Retry supervisor: a framework-free state machine that re-runs a failed
 * turn by forking one child session from the history prefix BEFORE the
 * failed turn and replaying the original user text there.
 *
 * Why fork: the host has no in-place "retry turn" RPC, so re-prompting the
 * source session would append a duplicate user message and the failed
 * turn's stream fragments would stay in the next request's history. Forking
 * from the prefix before the failed turn guarantees the original session
 * stays untouched.
 *
 * One child per cycle (issues #797, #880): the first attempt forks the
 * child; every later attempt of the same cycle — and any retry re-armed
 * inside that child — continues IN the child instead of forking another
 * session, so one failed turn never spawns more than one extra session.
 * The child therefore accumulates one replayed message per attempt, which
 * is the retry history the user sees; the source stays pristine.
 *
 * The supervisor only watches the CURRENT session; the client wiring feeds it
 * through review() on every session/list change and cancels on navigation,
 * user input, or the UI cancel button.
 */
import type { ConversationSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client';
export type SupervisorPhase = 'idle' | 'waiting' | 'running' | 'cancelled' | 'exhausted' | 'failed' | 'done';
export interface RetryState {
    phase: SupervisorPhase;
    /** auto = supervisor-driven, manual = user pressed the transcript button. */
    kind: 'auto' | 'manual' | null;
    /** 1-based number of the attempt that is waiting or running right now. */
    attempt: number;
    maxAttempts: number;
    /** Backoff delay of the current wait, in ms (0 for manual retries). */
    delayMs: number | null;
    /** The session the failed turn lives in. */
    sourceId: SessionId | null;
    /** The retry child (null before creation; retained during later backoff waits). */
    targetId: SessionId | null;
    /** Final failure reason (failed/exhausted states). */
    reason: string | null;
}
export interface PromptOutcome {
    ok: boolean;
    code?: string;
    message?: string;
}
/** Everything the supervisor needs from the runtime; the client wiring fills it. */
export interface RetryPorts {
    currentId(): SessionId | undefined;
    snapshot(id: SessionId): ConversationSnapshot | undefined;
    cwdOf(id: SessionId): string | undefined;
    fork(opts: {
        sessionId: SessionId;
        atSeq?: number;
        increaseTitle?: boolean;
    }): Promise<SessionId>;
    /** Connect (or create) a blank session in the same workspace as the source. */
    connectBlank(cwd: string | undefined): Promise<SessionId>;
    open(id: SessionId): void;
    prompt(id: SessionId, text: string): Promise<PromptOutcome>;
    schedule(fn: () => void, ms: number): () => void;
}
export interface RetrySupervisorOptions {
    /** Automatic replay is opt-in because it creates a visible retry child and repeated messages. */
    autoRetry?: boolean;
}
export declare class RetrySupervisor {
    private readonly ports;
    private readonly options;
    private state;
    private readonly listeners;
    private timer;
    private plan;
    /** User messages counted on the session that owns the current backoff wait. */
    private waitingUserBaseline;
    /** Last completed turn/end on the session that owns the current backoff wait. */
    private waitingEndBaseline;
    /** User messages the retry child is EXPECTED to carry (prefix + the replayed one). */
    private expectedUserCount;
    /** Last turn/end seq seen when the cycle reached a terminal phase (reset guard). */
    private settledEndSeq;
    /** Last failure explicitly handled per session; the same turn must never auto-arm twice. */
    private readonly suppressedFailureEnds;
    /** Monotonic owner for an in-flight fork/prompt continuation. */
    private operationGeneration;
    private attemptInFlight;
    private disposed;
    /** Last completed event inherited by the current retry child before its replayed turn. */
    private attemptStartEndSeq;
    /**
     * The retry child created by the current (or most recent) cycle. Later
     * attempts of the same cycle, and retries re-armed inside that child,
     * continue in this session instead of forking another one.
     */
    private cycleTargetId;
    constructor(ports: RetryPorts, options?: RetrySupervisorOptions);
    getSnapshot: () => RetryState;
    subscribe: (fn: () => void) => (() => void);
    /**
     * The client wiring calls this on every sessions.list or session-snapshot
     * change. Idle: arm auto-retry when the current session's last turn failed
     * recoverably. Waiting: cancel when the user navigated away or took over.
     * Running: settle the child — success, next attempt, or final failure.
     */
    review(): void;
    /** Manual one-shot retry from the transcript button (never auto-repeats). */
    manualRetry(sourceId: SessionId): void;
    /** User-initiated cancel: no further attempts, ever (until a new failure arms one). */
    cancel(): void;
    /** UI "retry now": skip the remaining backoff wait. */
    retryNow(): void;
    dispose(): void;
    /**
     * A new cycle reuses the previous cycle's retry child only when its source
     * IS that child (the user retried inside it); any other source means a
     * different failed turn and needs a fresh child.
     */
    private resolveCycleTarget;
    private startAuto;
    private scheduleNext;
    private runAttempt;
    private finish;
    private reset;
    /** Invalidate every late continuation owned by the previous attempt/cycle. */
    private invalidateAttempt;
    private ownsAttempt;
    private ownsRunningAttempt;
    private waitingOwnerIsValid;
    /** Record one terminal failure so ordinary subscription churn cannot re-arm it. */
    private suppressFailure;
    private clearTimer;
    private publish;
}
