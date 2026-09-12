/**
 * Session fork capability: construct an Agent from an exact, completed Session prefix (standalone rollback plugin fork).
 * @module @dsh-undo/rollback-fork
 */
import { Context, Service } from '@deepseek-ai/cordis';
import type { AgentHandle, AgentOptions } from '@deepseek-ai/dsh-agent';
import type { MessageId } from '@deepseek-ai/dsh-llm/brand';
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session';
/** The explicit source boundary requested for one child Session. */
export type SessionForkCut = 
/** Keep a complete turn and any following between-turn events. */
{
    readonly kind: 'completed-turn';
    readonly atSeq?: number;
}
/** Exclude the target user's complete turn, including its injected context. */
 | {
    readonly kind: 'before-user-message';
    readonly messageId: MessageId;
};
/** One request to fork a source Session into a newly created Agent. */
export interface SessionForkRequest {
    /** Live or persisted source Session identity. */
    readonly sourceSessionId: SessionId;
    /** Exact boundary to retain in the child Session seed. */
    readonly cut: SessionForkCut;
    /** Caller-selected child identity; omitted uses a generated Session id. */
    readonly childSessionId?: SessionId;
    /** Source options retained before a caller deliberately quiesces a live Agent. */
    readonly retainedAgentOptions?: AgentOptions;
}
/** One forked Agent and the exact retained source prefix. */
export interface SessionForkResult {
    /** Capability that owns and can dispose the new Agent. */
    readonly handle: AgentHandle;
    /** Session events supplied to the child as its immutable seed. */
    readonly seed: readonly SessionEvent[];
}
/** A request could not produce a valid child prefix. */
export declare class SessionForkUnavailableError extends Error {
    /** Stable machine-readable refusal code. */
    readonly code = "fork-unavailable";
    /** @param message - Stable human-readable refusal. */
    constructor(message: string);
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Provider-owned Session fork capability. */
        sessionFork: SessionForkService;
    }
}
/** Service Definition for exact Session branches. */
export declare abstract class SessionForkService extends Service {
    constructor(ctx: Context);
    /**
     * Create one child Agent from a completed source prefix and attach it to the source Workspace.
     * @param request - Source identity, explicit cut, and optional child id.
     * @returns an owned child Agent handle and retained prefix.
     * @throws {@link SessionForkUnavailableError} when the requested cut is invalid or incomplete.
     */
    abstract fork(request: SessionForkRequest): Promise<SessionForkResult>;
}
/** A Host Provider that owns fork Agent creation, composition, and Workspace attachment. */
export declare class DefaultSessionForkService extends SessionForkService {
    static inject: string[];
    /** Resolve, cut, create, and attach one child transactionally. */
    fork(request: SessionForkRequest): Promise<SessionForkResult>;
    /** Resolve a live Session first, then an immutable persisted inspection. */
    private readSource;
    /** Select the exact balanced prefix requested by the caller. */
    private cut;
    /** Keep the requested completed turn, matching the former session.fork behavior. */
    private completedTurnPrefix;
    /** Exclude the target prompt, preserving a completed prefix before ordinary or steering input. */
    private beforeUserMessagePrefix;
    /** Resolve direct Workspace membership, then a subagent ancestor's membership. */
    private workspaceFor;
    /** Resolve the source composition before the child Session header is snapshotted. */
    private compose;
    /** Read the Host default only for a cold source that has no live Agent options. */
    private defaultOptions;
}
export default DefaultSessionForkService;
//# sourceMappingURL=index.d.ts.map