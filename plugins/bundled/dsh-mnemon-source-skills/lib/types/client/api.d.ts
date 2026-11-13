import type { MnemonSourceManagementClient, TaskAgentModelCatalog } from 'dsh-mnemon/client';
import type { BacktestRun, CatalogView, DraftPreferencesView, DraftView, EvalCase, MarketPreview, MarketRegistry, MarketSearchResult, MarketView, EvidencePack, ModelRoute, ReviewLogEntry, ReviewRecordResult, RunTarget, SkillDocument, SkillDraft, SkillRootKind, SkillSuggestion, SkillSummary, SkillVersion, SkillsOverview, SuggestionStatus, SuggestionView, Trajectory, TrajectorySummary, TrashEntry, TrashRestoreInput, TrashRestorePreview } from '../contracts.ts';
export interface CaseDraft {
    id?: string;
    skillName: string;
    title: string;
    prompt: string;
    context?: string;
    requiresVision?: boolean;
    checks: Array<{
        id?: string;
        text: string;
        must: boolean;
    }>;
    enabled?: boolean;
}
/** Everything the Skills page asks of its Source and of the Host's assistance. */
export interface SkillsPageClient {
    overview(): Promise<SkillsOverview>;
    catalog(): Promise<CatalogView>;
    skill(key: string): Promise<SkillDocument & {
        versions: SkillVersion[];
    }>;
    version(key: string, id: string): Promise<{
        version: SkillVersion;
        content: string;
    }>;
    suggestions(status?: readonly SuggestionStatus[]): Promise<SkillSuggestion[]>;
    suggestion(id: string): Promise<SuggestionView>;
    trajectories(filter?: {
        skill?: string;
        signal?: string;
    }): Promise<TrajectorySummary[]>;
    trajectory(id: string): Promise<Trajectory>;
    cases(skill?: string): Promise<EvalCase[]>;
    runs(skill?: string): Promise<BacktestRun[]>;
    run(id: string): Promise<BacktestRun>;
    draft(id: string): Promise<DraftView>;
    reviews(filter?: {
        sessionId?: string;
        limit?: number;
    }): Promise<ReviewLogEntry[]>;
    evidencePack(input: {
        suggestionId?: string;
        draftId?: string;
        skill?: string;
    }): Promise<EvidencePack>;
    createSkill(input: {
        name: string;
        description: string;
        root?: SkillRootKind;
    }): Promise<SkillSummary>;
    saveSkill(key: string, content: string, expectedHash: string): Promise<SkillSummary>;
    setInvocation(key: string, invocation: {
        modelInvocable: boolean;
        userInvocable: boolean;
    }, expectedHash: string): Promise<SkillSummary>;
    deleteSkill(key: string, expectedHash: string): Promise<{
        trashedTo: string;
    }>;
    /** Removed skills waiting in the Trash, newest first. */
    trash(): Promise<TrashEntry[]>;
    /** Put a removed skill back; a new root moves it out of the one it came from. */
    previewTrashRestore(input: TrashRestoreInput): Promise<TrashRestorePreview>;
    restoreTrash(input: TrashRestoreInput): Promise<{
        key: string;
        path: string;
    }>;
    /** Delete a Trash entry for good. */
    purgeTrash(id: string): Promise<{
        purged: string;
    }>;
    /** Delete everything waiting in the Trash. */
    emptyTrash(): Promise<{
        purged: number;
    }>;
    restoreVersion(key: string, versionId: string, expectedHash: string): Promise<SkillSummary>;
    dismissSuggestion(id: string): Promise<SkillSuggestion>;
    /** Delete a waiting suggestion and any draft written for it. */
    deleteSuggestion(id: string): Promise<{
        deleted: string;
    }>;
    /** Delete a draft; its suggestion goes back to waiting. */
    deleteDraft(id: string): Promise<{
        deleted: string;
    }>;
    pinTrajectory(id: string, pinned: boolean): Promise<TrajectorySummary>;
    deleteTrajectory(id: string): Promise<{
        deleted: string;
    }>;
    saveCase(input: CaseDraft): Promise<EvalCase>;
    deleteCase(id: string): Promise<{
        deleted: string;
    }>;
    updateDraft(id: string, content: string): Promise<SkillDraft>;
    /** Adopt a draft; a new skill goes to `root` when given. */
    adoptDraft(id: string, root?: SkillRootKind): Promise<{
        skill: SkillSummary;
        version: SkillVersion;
    }>;
    discardDraft(id: string): Promise<SkillDraft>;
    /** Attach a baseline run to the draft it is compared with. */
    linkRun(draftId: string, runId: string): Promise<void>;
    cancelRun(id: string): Promise<BacktestRun>;
    /** The model each piece of model work follows: the two global picks and their per-item overrides. */
    draftPreferences(): Promise<DraftPreferencesView>;
    /** Pick the model for drafts, for backtests, or for one suggestion or skill; `null` follows the task Agent again. */
    saveDraftModel(model: ModelRoute | null): Promise<DraftPreferencesView>;
    saveSuggestionModel(id: string, model: ModelRoute | null): Promise<DraftPreferencesView>;
    saveRunModel(model: ModelRoute | null): Promise<DraftPreferencesView>;
    saveSkillRunModel(skillName: string, model: ModelRoute | null): Promise<DraftPreferencesView>;
    /**
     * The routes and model directory a page may offer. Rejects when the Host
     * offers none, which is also when the page hides its pickers.
     */
    models(): Promise<TaskAgentModelCatalog>;
    market(): Promise<MarketView>;
    marketPreview(registryId: string, name: string): Promise<MarketPreview>;
    /** Search the search sources; the page filters the listed ones itself. */
    searchMarket(query: string): Promise<MarketSearchResult>;
    refreshMarket(ids?: string[]): Promise<MarketRegistry[]>;
    installMarket(input: {
        registryId: string;
        name: string;
        root?: SkillRootKind;
        overwrite?: boolean;
    }): Promise<{
        skill: SkillSummary;
        updated: boolean;
    }>;
    addRegistry(location: string): Promise<MarketRegistry>;
    removeRegistry(id: string): Promise<{
        removed: string;
    }>;
    toggleRegistry(id: string, enabled: boolean): Promise<MarketRegistry>;
    /** Whether the Host offers a task Agent for this model work. */
    canAssist(operation: 'skill-draft' | 'skill-backtest' | 'skill-derive-cases' | 'skill-review-now'): boolean;
    generateDraft(input: {
        suggestionId?: string;
        draftId?: string;
        skill?: string;
        guidance?: string;
        targetRoot?: SkillRootKind;
        backtest?: boolean;
        provider?: string;
        model?: string;
    }): Promise<{
        started: true;
    }>;
    backtest(input: {
        skillName: string;
        target: RunTarget;
        caseIds?: string[];
        provider?: string;
        model?: string;
    }): Promise<{
        runId: string;
    }>;
    deriveCases(input: {
        trajectoryId: string;
        skillName: string;
        steps?: number[];
    }): Promise<{
        added: EvalCase[];
        skipped: number;
    }>;
    reviewNow(): Promise<ReviewRecordResult>;
}
/**
 * The Source's revision moves with every background review and run, so each
 * write fetches it first and tries once more if a background write slipped in
 * between. A conflict is refused before anything runs, and every write here
 * carries its own precondition, so retrying never applies one twice.
 */
export declare function skillsPageClient(management: MnemonSourceManagementClient): SkillsPageClient;
