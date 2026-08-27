/**
 * Runtime wiring: fills the framework-free supervisor ports and the edit
 * submission path with the real client services (ctx.sessions / ctx.workspaces).
 */
import type { ISessions, IWorkspaces, SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { RetryPorts } from '../core/retry-supervisor.ts';
/**
 * Connect (or create) a blank session in the workspace the source session
 * belongs to. Used as the first-turn fallback when forking cannot cut history
 * before the message (no earlier turn/end exists).
 * @param workspaces - the workspaces service.
 * @param cwd - the source session's workspace directory.
 */
export declare function connectBlank(workspaces: IWorkspaces, cwd: string | undefined): Promise<SessionId>;
/**
 * Fill the supervisor ports from the live services.
 * @param sessions - the sessions service.
 * @param workspaces - the workspaces service.
 */
export declare function createRetryPorts(sessions: ISessions, workspaces: IWorkspaces): RetryPorts;
/** Edit submission input (all durable facts; the text is the edited draft). */
export interface SubmitEditInput {
    sessionId: SessionId;
    /** Fork anchor: null falls back to a fresh blank session in the workspace. */
    forkAtSeq: number | null;
    editedText: string;
}
/**
 * Edit submission: fork a child from the history prefix before the edited
 * message (or connect a blank sibling for first-turn edits), open it, and
 * send the edited text. The original session is never touched: a fork or
 * resubmit failure leaves it exactly as it was.
 * @param sessions - the sessions service.
 * @param workspaces - the workspaces service.
 */
export declare function createSubmitEdit(sessions: ISessions, workspaces: IWorkspaces): (input: SubmitEditInput) => Promise<void>;
