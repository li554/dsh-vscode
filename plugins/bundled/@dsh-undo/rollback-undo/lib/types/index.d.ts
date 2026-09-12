/**
 * One-generation user-message rollback with a private Git snapshot journal
 * (standalone plugin edition). The original dsh-internal seam version relied
 * on unpublished core APIs – agent termination, archive restoration, and
 * permanent deletion. This standalone build uses only published dsh APIs:
 * cancellation plus quiescence waiting replaces forced termination, tombstone
 * hiding replaces permanent deletion, and unarchive-based undo restoration is
 * dropped entirely.
 * @module @dsh-undo/rollback-undo
 */
import { Context, Service } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionForkCut } from '@dsh-undo/rollback-fork';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ConversationAdmissionFailureRequest, ConversationAdmissionFailureValue, ConversationArchiveActionRequest, ConversationArchiveActionValue, ConversationCurrentRequest, ConversationRevokePairRequest, ConversationRevokePairValue, ConversationRevokeRequest, ConversationRollbackChildRequest, ConversationUndoJournal, ConversationUndoLatestRequest, ConversationUndoLayerInspectionRequest, ConversationUndoLayerInspectionValue, ConversationUndoLayersRequest, ConversationUndoLayerValue, ConversationUndoResult, ConversationUndoThroughRequest } from './types.ts';
export type * from './types.ts';
/** Deployment-owned directory for private Shadow Git repositories and journals. */
export interface Config {
    /** Absolute application-data root owned exclusively by this plugin. */
    readonly root: string;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** User-message rollback journal capability. */
        conversationUndo: ConversationUndoService;
    }
}
/** Select how revoke reconstructs the source transcript.
 * Interrupted turns are cut before their user message so the same prompt can
 * be submitted as fresh work; completed turns remain an immutable prefix.
 */
export declare function revokeForkCut(journal: Pick<ConversationUndoJournal, 'messageId' | 'replayPromptOnRevoke'>): SessionForkCut;
/** Recreate interrupted user input with a new identity for one fresh turn. */
export declare function replayPromptMessage(journal: Pick<ConversationUndoJournal, 'prompt' | 'replayPromptOnRevoke'>): UserMessage | undefined;
/** Count newer layers that must be removed while retaining the selected node.
 * Layers are newest-first, so the selected index is exactly the rollback count.
 */
export declare function rollbackCountToRetainLayer(layers: readonly Pick<ConversationUndoLayerValue, 'messageId'>[], messageId: ConversationUndoLayerValue['messageId']): number | undefined;
/** Find the completed-turn fork boundary that retains one selected prompt. */
export declare function retainedLayerForkCut(events: readonly {
    readonly type: string;
    readonly seq: number;
    readonly data: unknown;
}[], messageId: ConversationUndoLayerValue['messageId']): SessionForkCut | undefined;
/** Host owner of an append-only rollback lineage and its private snapshots. */
export declare class ConversationUndoService extends TypertRemoteService {
    private readonly config;
    static inject: string[];
    static Config: s<Config>;
    private readonly operationTails;
    private readonly rollbackSessions;
    private readonly rollbackWorkspaces;
    private readonly admissionFailures;
    private readonly statWarmers;
    private readonly prearms;
    private readonly workspaceChecks;
    /** @param ctx - Host context with top-level agents and archive/fork capabilities. @param config - journal directory. */
    constructor(ctx: Context, config: Config);
    /** Create the journal root, recover durable work, and install admission listeners. */
    protected [Service.init](): Promise<void>;
    /** Execute `/update`: pull, install, and rebuild this plugin's own workspace.
     * @param invocation - command invocation; no arguments are accepted.
     * @returns A human-facing summary or failure.
     */
    private updateCommand;
    /** Execute `/undo` for the receiving agent's latest completed message.
     * @param invocation - command invocation naming the receiving agent.
     * @returns A human-facing success or refusal.
     */
    private rollbackCommand;
    /** Read the latest rollback point directly owned by one physical Session.
     * @param request - Physical Session to inspect.
     * @returns Its latest Host-approved rollback point, when available.
     */
    current(request: ConversationCurrentRequest): Promise<ConversationUndoResult>;
    /** Read and clear the last refused-admission failure for one physical Session.
     * @param request - Physical Session that refused a prompt.
     * @returns The redacted failure once; an absent cache entry means no refusal.
     */
    admissionFailure(request: ConversationAdmissionFailureRequest): Promise<ConversationAdmissionFailureValue | undefined>;
    /** Resolve the child Session a completed rollback published for a source Session.
     * @param request - Physical source Session.
     * @returns The published rollback child, when the source journal completed.
     */
    rollbackChild(request: ConversationRollbackChildRequest): Promise<{
        rollbackSessionId: SessionId;
    } | undefined>;
    /** Read the completed rollback pair one child Session may still revoke.
     * @param request - Physical rollback child Session to inspect.
     * @returns The archived source and rolled-back prompt while the pair is retained.
     */
    revokePair(request: ConversationRevokePairRequest): Promise<ConversationRevokePairValue | undefined>;
    /** Read the timeline points reachable by repeatedly rolling back the current last message. */
    layers(request: ConversationUndoLayersRequest): Promise<readonly ConversationUndoLayerValue[]>;
    /** Read the files and executable tool commands produced by one timeline point. */
    inspectLayer(request: ConversationUndoLayerInspectionRequest): Promise<ConversationUndoLayerInspectionValue>;
    /** Remove only layers newer than the selected node, retaining that node as the resulting tip. */
    undoThrough(request: ConversationUndoThroughRequest): Promise<ConversationUndoResult>;
    /** Jump to a retained historical layer using one fork and one Git restore. */
    private undoToRetainedLayer;
    /** Restore the archived source's full conversation and its redo tree, then archive the child.
     * @param request - Physical rollback child Session holding the completed pair.
     * @returns The restored replacement Session or a business refusal.
     */
    revoke(request: ConversationRevokeRequest): Promise<ConversationUndoResult>;
    /** Select the recovery state the Archive Tasks page may surface for one archived Session.
     * @param request - Archived physical Session to inspect.
     * @returns The journal-derived archive-page action.
     */
    archiveAction(request: ConversationArchiveActionRequest): Promise<ConversationArchiveActionValue>;
    /** Fork before the selected message, restore its before-tree, and archive the source.
     * @param request - Source Session and latest approved message to roll back.
     * @returns Replacement Session or a business refusal.
     */
    undoLatest(request: ConversationUndoLatestRequest): Promise<ConversationUndoResult>;
    /** Capture an eligible prompt's before-tree before delegating model admission. */
    private arm;
    /** Cache one refused admission for the browser composer to poll once. */
    private recordAdmissionFailure;
    /** Mark an admitted prompt ready after its turn closes. */
    private markReady;
    /** Expire old revoke actions after a new branch prompt without deleting archived Sessions. */
    private expireRevokePairsForBranch;
    /** Recover or surface every durable operation interrupted before Host shutdown. */
    private recoverJournals;
    /** Retry one deferred tombstone without preventing unrelated Host startup. */
    private recoverDeferredCleanup;
    /** Complete only an independently verified restoring transaction; otherwise preserve an explicit recovery state. */
    private recoverRestoring;
    /** Determine whether a rollback child is present in either live or durable session ownership. */
    private sessionExists;
    /** Hide an unpublished rollback child; without a termination API it stays on disk but out of every UI. */
    private hideUnpublishedChild;
    /** Complete only an independently verified revoke transaction; otherwise preserve an explicit recovery state. */
    private recoverRevoking;
    /** Preserve a recovery-required manifest instead of claiming an ambiguous transaction succeeded. */
    private requireRecovery;
    /** Detect live child work that makes a file restoration unsafe. */
    private hasRunningDescendant;
    /** Request cooperative stop and force-stop registered work before touching tracked files. */
    private quiesce;
    /** Check whether registered job or terminal providers still own work for the Agent tree. */
    private hasControlledActivity;
    /** Force-stop registered jobs and PTYs only after the cooperative grace period elapses. */
    private forceStopControlledActivity;
    /** Resolve the source and all transitive runtime-owned descendants. */
    private ownedAgentTree;
    /** Give Agents, registered jobs, and PTYs a short chance to stop cooperatively. */
    private waitForQuiescence;
    /** Poll one Agent until idle or the deadline passes. */
    private waitForAgentIdle;
    /** Assert workspace support once per workspace per Host run.
     * The worktree and submodule facts a passing check establishes cannot
     * regress while this Host owns the workspace, and the check's
     * `ls-files --stage` output scales with the whole tracked tree, so every
     * prompt admission re-running it dominates the arm cost. A failing check
     * is not cached.
     * @param workspace - Candidate worktree root.
     * @returns Resolution only for a supported non-bare, submodule-free worktree.
     */
    private assertWorkspace;
    /** Select the newest durable record by lineage generation. */
    private selectLatest;
    /** Allocate a never-reused record generation inside one logical lineage. */
    private nextGeneration;
    /** Read the physical Session's currently actionable latest point. */
    private readActiveJournal;
    /** Find the newest journal matching an arbitrary durable predicate. */
    private findLatestJournal;
    /** Resolve one immutable point reference in a logical rollback path. */
    private findJournalByGeneration;
    /** Publish the retained layer for a direct jump, or the usual predecessor for one-edge rollback. */
    private publishRetainedLayerToChild;
    /** Give a completed one-edge rollback child the point immediately before the removed message. */
    private publishPredecessorToChild;
    /** Copy exactly one ready historical point into a newly published child Session. */
    private publishJournalToChild;
    /** Resolve one direct-jump plan and the exact retained workspace tree. */
    private retainedLayerPlan;
    /** Read events from a live Session when possible, otherwise its immutable persisted copy. */
    private eventsForSession;
    /** Enumerate the active point followed by each reachable predecessor. */
    private layersFor;
    /** Resolve the retained journal belonging to one selectable timeline point. */
    private journalForLayer;
    /** Find the one topmost completed rollback that the current branch may revoke. */
    private findCurrentRevokePair;
    /** Read every durable journal; an absent private directory is empty state. */
    private readJournals;
    /** Convert one journal into the message-action response. */
    private viewFor;
    /** Create a stable success response. */
    private success;
    /** Create a stable business refusal. */
    private failure;
    /** One private journal path, partitioned by workspace, lineage, and generation. */
    private journalDirectory;
    /** Private lineage directory shared by every durable point in a conversation. */
    private lineageDirectory;
    /** Private Shadow Git repository; new lineages share one object store across all points. */
    private shadowDirectory;
    /** Persist one journal phase transition. */
    private writeJournal;
    /** Serialize all journal mutations for one physical source Session. */
    private enqueue;
}
export default ConversationUndoService;
//# sourceMappingURL=index.d.ts.map