//#region src/source-kind.d.ts
/**
 * The ways skills are published that the market reads, and what a pasted
 * string most likely names. Pure, so the page can say what it will add
 * before anything is fetched.
 */
/**
 * - `catalog`: this market's own JSON format, curated, with both languages
 * - `well-known`: a site's Agent Skills discovery index (`/.well-known/agent-skills/`)
 * - `github`: every `SKILL.md` in a GitHub repository, plugin marketplaces included
 * - `search`: an index searched as the user types; its entries are never listed whole
 */
type MarketSourceKind = 'catalog' | 'well-known' | 'github' | 'search';
interface DetectedSource {
  /** `json` until the file is read: a catalog, or a discovery index, or a plugin marketplace on GitHub. */
  kind: 'catalog' | 'well-known' | 'github' | 'json';
  /** What the Source stores: a canonical GitHub URL, a URL, or an absolute path. */
  location: string;
  /** How the page names it: `owner/repo`, a host, or a file name. */
  label: string;
}
//#endregion
//#region src/auto-adoption.d.ts
/** Stable evaluation inputs, excluding presentation timestamps and provenance. Hash at the server boundary. */
declare function skillCaseSignature(cases: readonly EvalCase[]): string;
/** Automatic decisions require full matching coverage, not the UI's scored intersection. */
declare function compareAutomaticSkillRuns(cases: readonly EvalCase[], baseline: BacktestRun | undefined, draft: BacktestRun | undefined, casesHash: string): {
  outcome: 'unmeasured' | 'regressed' | 'not-worse';
  baselineScore?: number;
  draftScore?: number;
};
//#endregion
//#region src/contracts.d.ts
/** The DSH skill roots this Source reads and writes, in DSH's precedence order. */
type SkillRootKind = 'project-dsh' | 'project-agents' | 'user-dsh' | 'user-agents';
declare const SKILL_ROOT_KINDS: readonly SkillRootKind[];
declare const SKILL_ROOT_RANK: Readonly<Record<SkillRootKind, number>>;
interface SkillRoot {
  kind: SkillRootKind;
  path: string;
  exists: boolean;
  readOnly?: boolean;
}
interface SkillInvocation {
  /** DSH's `disable-model-invocation` is absent or false. */
  modelInvocable: boolean;
  /** DSH's `user-invocable` is absent or true. */
  userInvocable: boolean;
}
interface SkillSummary {
  /** `<root kind>:<name>`; stable while the file stays in its root. */
  key: string;
  name: string;
  description: string;
  whenToUse?: string;
  root: SkillRootKind;
  rootPath: string;
  /** The SKILL.md of a bundle, or the flat Markdown file. */
  path: string;
  layout: 'bundle' | 'flat';
  /** The root, bundle or document is a symbolic link or junction. */
  linked?: boolean;
  /** Updating this skill is not permitted by the current Source configuration. */
  readOnly?: boolean;
  invocation: SkillInvocation;
  /** SHA-256 of the file's exact content. */
  hash: string;
  bytes: number;
  modifiedAt: string;
  /** DSH loads the lowest-rank skill of a name; the others are shadowed by it. */
  shadowedBy?: string;
  /** Files beside SKILL.md in a bundle, relative and bounded. */
  resources?: string[];
}
/** A file the Source found but DSH would skip, with the reason. */
interface SkillProblem {
  root: SkillRootKind;
  path: string;
  reason: string;
}
interface SkillCatalog {
  projectRoot?: string;
  roots: SkillRoot[];
  skills: SkillSummary[];
  problems: SkillProblem[];
}
interface SkillDocument extends SkillSummary {
  content: string;
  /** Frontmatter text between the fences, verbatim. */
  frontmatter: string;
  body: string;
}
type SkillVersionReason = 'original' | 'edit' | 'evolution' | 'restore' | 'invocation' | 'create' | 'install';
interface SkillVersion {
  id: string;
  skillKey: string;
  hash: string;
  bytes: number;
  reason: SkillVersionReason;
  createdAt: string;
  suggestionId?: string;
  draftId?: string;
  note?: string;
}
/** The strong signals a skill reviewer may cite as evidence. */
type EvolutionSignal = 'correction' | 'directive' | 'tool-failure' | 'approach-change' | 'procedure' | 'skill-gap' | 'skill-misleading' | 'success';
declare const EVOLUTION_SIGNALS: readonly EvolutionSignal[];
type TrajectoryStepKind = 'user' | 'assistant' | 'tool' | 'skill';
interface TrajectoryStep {
  /** One-based, unique within its trajectory. */
  index: number;
  turn: number;
  kind: TrajectoryStepKind;
  text: string;
  tool?: {
    name: string;
    ok: boolean;
    input?: string;
    error?: string;
  };
  /** The skill loaded at this step, by the model's `skill` tool or the user's `/name`. */
  skill?: {
    name: string;
    by: 'model' | 'user';
  };
  at?: string;
}
interface TrajectoryAnnotation {
  step: number;
  signal: EvolutionSignal;
  note: string;
  suggestionIds?: string[];
}
interface TrajectoryStats {
  turns: number;
  userCharacters: number;
  toolCalls: number;
  toolFailures: number;
  uniqueTools: number;
  skills: string[];
}
interface ReviewScore {
  score: number;
  threshold: number;
  textLengthScore: number;
  turnScore: number;
  toolCallScore: number;
  toolDiversityScore: number;
}
interface TrajectorySummary {
  id: string;
  sessionId: string;
  sessionTitle?: string;
  workspace?: string;
  startedAt: string;
  endedAt: string;
  stats: TrajectoryStats;
  score?: ReviewScore;
  annotationCount: number;
  signals: EvolutionSignal[];
  suggestionIds: string[];
  caseIds: string[];
  reviewId?: string;
  /** What the review made of it. */
  outcome: 'suggested' | 'nothing' | 'error' | 'captured';
  pinned: boolean;
  createdAt: string;
}
interface Trajectory extends TrajectorySummary {
  steps: TrajectoryStep[];
  annotations: TrajectoryAnnotation[];
  /** The reviewer's one-sentence reading of the window. */
  reviewSummary?: string;
}
interface EvidenceReference {
  trajectoryId: string;
  steps: number[];
}
type SuggestionStatus = 'pending' | 'drafting' | 'review' | 'adopted' | 'dismissed' | 'expired' | 'invalidated';
declare const SUGGESTION_STATUSES: readonly SuggestionStatus[];
/** A file selected by the Source catalog, independent of the page's storage scope. */
interface SkillOrigin {
  path: string;
  /** The owning project root; absent for user skills. */
  workspace?: string;
}
type SkillResolution = 'available' | 'missing' | 'origin-unavailable';
interface SkillSuggestion {
  id: string;
  skillName: string;
  action: 'create' | 'update';
  /** For new skills, the Host-resolved destination; absent on older suggestions. */
  targetRoot?: SkillRootKind;
  summary: string;
  rationale?: string;
  confidence: number;
  signals: EvolutionSignal[];
  evidence: EvidenceReference[];
  /** Deterministic display guidance; never an adoption or deletion permission. */
  triage?: SuggestionTriage;
  /** For `update`: the SKILL.md the reviewer read, so a later edit invalidates it. */
  skillKey?: string;
  skillFileHash?: string;
  /** Absent on legacy records; never supplied by the model. */
  origin?: SkillOrigin;
  sourceSessionId?: string;
  sourceSessionTitle?: string;
  reviewId?: string;
  status: SuggestionStatus;
  draftId?: string;
  lastError?: string;
  autoAdoption?: AutoAdoptionEvent[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}
type DraftStatus = 'ready' | 'adopted' | 'discarded';
interface SkillDraft {
  id: string;
  suggestionId?: string;
  skillName: string;
  action: 'create' | 'update';
  /** For `update`, the SKILL.md hash the draft was written against. */
  baseKey?: string;
  baseHash?: string;
  /** The file this update replaces; absent on legacy records. */
  origin?: SkillOrigin;
  /** For `create`, where adopting writes the new bundle. */
  targetRoot?: SkillRootKind;
  content: string;
  notes: string;
  changes: string[];
  guidance: string[];
  status: DraftStatus;
  /** Runs started for this draft and its baseline. */
  runIds: string[];
  createdAt: string;
  updatedAt: string;
}
interface EvalCheck {
  id: string;
  text: string;
  must: boolean;
}
interface EvalCase {
  id: string;
  skillName: string;
  title: string;
  prompt: string;
  context?: string;
  /** Explicitly depends on image input unavailable to the text-only simulator. */
  requiresVision?: boolean;
  checks: EvalCheck[];
  origin: {
    kind: 'review' | 'trajectory' | 'manual';
    trajectoryId?: string;
    steps?: number[];
    suggestionId?: string;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
type RunTargetKind = 'current' | 'draft' | 'version' | 'none';
interface RunTarget {
  kind: RunTargetKind;
  /** SHA-256 of the SKILL.md under test; absent for `none`. */
  hash?: string;
  skillKey?: string;
  draftId?: string;
  versionId?: string;
}
/** One Provider and model, as a user picked it; never carries a reasoning effort. */
interface ModelRoute {
  provider: string;
  model: string;
}
/**
 * The models the user picked for skill work, kept beside the ledger. Every
 * entry is optional: absent means "follow the task Agent's own route".
 * `suggestionModels` is keyed by suggestion id, `skillRunModels` by skill name.
 */
interface DraftPreferences {
  version: 1;
  draftModel?: ModelRoute;
  runModel?: ModelRoute;
  suggestionModels: Record<string, ModelRoute>;
  skillRunModels: Record<string, ModelRoute>;
}
/** What the pickers read: the stored picks, named the way the pages use them. */
interface DraftPreferencesView {
  model?: ModelRoute;
  runModel?: ModelRoute;
  suggestionModels: Record<string, ModelRoute>;
  skillRunModels: Record<string, ModelRoute>;
}
interface CaseResult {
  caseId: string;
  title: string;
  verdict: 'pass' | 'fail' | 'error';
  score: number;
  checks: Array<{
    checkId: string;
    pass: boolean;
    note: string;
  }>;
  steps: string[];
  answer: string;
  summary?: string;
  error?: string;
  /** Kept under verdict=error so older readers also exclude it from scores. */
  unmeasuredReason?: 'requires-vision';
  /** Every expected judge check was explicitly returned; absent on older runs. */
  fullyGraded?: boolean;
}
type RunStatus = 'running' | 'completed' | 'failed' | 'interrupted';
interface BacktestRun {
  id: string;
  skillName: string;
  target: RunTarget;
  status: RunStatus;
  progress: {
    done: number;
    total: number;
  };
  caseIds: string[];
  /** Source-verified case inputs at start; absent on older runs. */
  casesHash?: string;
  model?: ModelRoute & {
    reasoningEffort?: string;
  };
  results: CaseResult[];
  /** Over the graded cases; absent when none could be graded. */
  passRate?: number;
  score?: number;
  /** Cases that could not run; they are left out of the score. */
  errors?: number;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}
interface ReviewLogEntry {
  id: string;
  at: string;
  sessionId: string;
  sessionTitle?: string;
  trigger: 'automatic' | 'manual';
  score?: ReviewScore;
  durationMs: number;
  outcome: 'suggested' | 'nothing' | 'error';
  summary?: string;
  suggestions: number;
  cases: number;
  trajectoryId?: string;
  error?: string;
  /** The conversation turn the reviewed window ended with. */
  turn?: number;
  autoAdoptions?: Array<AutoAdoptionEvent & {
    suggestionId: string;
    skillName: string;
  }>;
  /** The suggestions this review created or strengthened. */
  suggestionIds?: string[];
}
/** How the Source admits a review's suggestions; the Host sends its settings with each review. */
interface SkillsPolicy {
  /** Whether a review may propose new skills; omitted by older Hosts, default true. */
  allowCreate?: boolean;
  /** Whether a review may improve existing skills; omitted by older Hosts, default true. */
  allowUpdate?: boolean;
  minConfidence: number;
  expiryDays: number;
  maxPendingPerSession: number;
}
declare const DEFAULT_SKILLS_POLICY: Readonly<SkillsPolicy>;
/** One removed skill waiting in the Trash, and where it came from. */
interface TrashEntry {
  /** The stored directory name: `<removal time>-<skill name>`. */
  id: string;
  name: string;
  /** A bundle directory, or a single flat `.md` file. */
  kind: 'bundle' | 'file';
  trashedAt: string;
  bytes: number;
  /** The root it was removed from; absent for entries removed before this was recorded. */
  root?: SkillRootKind;
  key?: string;
  /** Exact original file or bundle path; its parent must match the recorded root. */
  originalPath?: string;
  /** The project that owned a project-level skill, independent of the selected workspace. */
  workspace?: string;
}
interface TrashRestoreInput {
  id: string;
  root?: SkillRootKind;
  name?: string;
  replace?: boolean;
  expectedHash?: string;
}
interface TrashRestorePreview {
  name: string;
  roots: SkillRootKind[];
  needsRoot: boolean;
  path?: string;
  conflict?: {
    hash: string;
  };
}
interface SkillsOverview {
  counts: {
    skills: number;
    pending: number;
    /** Suggestions whose draft is being written. */
    drafting: number;
    drafts: number;
    trajectories: number;
    cases: number;
    runsRunning: number;
    /** Skills waiting in the Trash. */
    trash: number;
  };
  lastReviewAt?: string;
  /** Suggestions and drafts waiting for the user, newest first. */
  attention: Array<{
    kind: 'suggestion' | 'draft' | 'regression';
    id: string;
    skillName: string;
    title: string;
    at: string;
  }>;
  reviews: ReviewLogEntry[];
}
/** What the Host records after one skill review. */
interface ReviewRecordInput {
  review: Omit<ReviewLogEntry, 'id' | 'trajectoryId' | 'suggestions' | 'cases' | 'suggestionIds'>;
  /** The admission rules to apply; missing values fall back to the defaults. */
  policy?: Partial<SkillsPolicy>;
  trajectory: Omit<Trajectory, 'id' | 'createdAt' | 'pinned' | 'suggestionIds' | 'caseIds' | 'annotationCount' | 'signals' | 'outcome' | 'reviewId'>;
  annotations: TrajectoryAnnotation[];
  suggestions: Array<{
    skillName: string;
    action: 'create' | 'update';
    targetRoot?: SkillRootKind;
    summary: string;
    rationale?: string;
    confidence: number;
    signals: EvolutionSignal[];
    steps: number[];
  }>;
  cases: Array<{
    skillName: string;
    title: string;
    prompt: string;
    checks: Array<{
      text: string;
      must: boolean;
    }>;
    steps: number[];
  }>;
}
interface ReviewRecordResult {
  reviewId: string;
  trajectoryId?: string;
  suggestionIds: string[];
  /** Newly inserted ids only; older Sources omit this capability. */
  createdSuggestionIds?: string[];
  inserted: number;
  updated: number;
  casesAdded: number;
  skipped: Array<{
    skillName?: string;
    action?: string;
    reason: string;
  }>;
}
/** Everything a draft prompt needs, read once by the Host. */
interface EvidencePack {
  skillName: string;
  action: 'create' | 'update';
  suggestion?: SkillSuggestion;
  skill?: SkillDocument;
  excerpts: Array<{
    trajectoryId: string;
    sessionTitle?: string;
    steps: TrajectoryStep[];
    annotations: TrajectoryAnnotation[];
  }>;
  cases: EvalCase[];
  /** The newest finished run against the current file, when there is one. */
  lastRun?: BacktestRun;
  catalog: Array<{
    name: string;
    description: string;
    root: SkillRootKind;
  }>;
  drafts: SkillDraft[];
}
interface CatalogView extends SkillCatalog {
  /** Per skill name: open suggestions, cases and the newest finished run against the loaded file. */
  stats: Record<string, {
    open: number;
    cases: number;
    lastPassRate?: number;
    lastScore?: number;
    lastRunAt?: string;
  }>;
}
interface SuggestionView {
  suggestion: SkillSuggestion;
  /** The loaded file is still the one the reviewer read. */
  hashCurrent: boolean;
  skill?: SkillDocument;
  resolution?: SkillResolution;
  /** Whether the selected scope's catalog offers this same file for navigation. */
  skillInCatalog?: boolean;
  draft?: SkillDraft;
  trajectories: TrajectorySummary[];
}
interface DraftView {
  draft: SkillDraft;
  /** File changes need a new draft, never a retry with a newer revision. */
  conflict?: 'base-changed' | 'target-exists';
  /** The file the draft replaces, as it is now. */
  base?: SkillDocument;
  resolution?: SkillResolution;
  runs: BacktestRun[];
}
/** A string, or the same text per language. */
type LocalizedText = string | {
  en?: string;
  'zh-CN'?: string;
};
/** Where a market entry's files come from. */
type MarketSource = {
  type: 'github';
  repo: string;
  path: string;
  ref?: string;
} | {
  type: 'url';
  url: string;
} | {
  type: 'path';
  path: string;
} |
/** One artifact an Agent Skills discovery index publishes, checked against its digest. */
{
  type: 'artifact';
  url: string;
  format: 'skill-md' | 'archive';
  digest: string;
} |
/** An entry of a discovery index older than 0.2.0: its files, under `base`. */
{
  type: 'files';
  base: string;
  files: string[];
} |
/** A skill a search index found, by the index's own id (`owner/repo/skill`). */
{
  type: 'indexed';
  id: string;
};
interface MarketEntry {
  /** The SKILL.md name it installs as; unique within its registry. */
  name: string;
  title?: LocalizedText;
  description: LocalizedText;
  category?: string;
  tags?: string[];
  author?: string;
  license?: string;
  version?: string;
  homepage?: string;
  source: MarketSource;
  /** How often the index that found it counts it installed. */
  installs?: number;
  /** The repository or site it lives in, as the index names it. */
  origin?: string;
}
/** A skill registry as published: one JSON file anyone can host. */
interface MarketRegistryFile {
  version: 1;
  id?: string;
  name: LocalizedText;
  description?: LocalizedText;
  homepage?: string;
  categories?: Array<{
    id: string;
    label: LocalizedText;
  }>;
  skills: MarketEntry[];
}
/**
 * A source this Source knows: the built-in catalog and search index, or one
 * the user added — a GitHub repository, a site publishing a discovery index,
 * or a catalog by URL or path.
 */
interface MarketRegistry {
  id: string;
  kind: MarketSourceKind;
  /** A canonical GitHub URL, an http(s) URL or an absolute file path. */
  location: string;
  builtin: boolean;
  enabled: boolean;
  name?: LocalizedText;
  description?: LocalizedText;
  homepage?: string;
  fetchedAt?: string;
  entries: number;
  error?: string;
}
type MarketInstallState = 'available' | 'installed' | 'update' | 'modified' | 'conflict';
interface MarketItem extends MarketEntry {
  registryId: string;
  state: MarketInstallState;
  /** The installed skill, when one with this name exists. */
  skillKey?: string;
  installedVersion?: string;
}
interface MarketView {
  registries: MarketRegistry[];
  categories: Array<{
    id: string;
    label: LocalizedText;
  }>;
  items: MarketItem[];
  /** Registries whose copy is older than the refresh window, or missing. */
  stale: string[];
}
/** What a security reviewer said about a skill, as its index reports it. */
interface MarketAudit {
  provider: string;
  status: 'pass' | 'warn' | 'fail';
  summary?: string;
  risk?: string;
}
interface MarketPreview {
  registryId: string;
  name: string;
  content: string;
  files: Array<{
    path: string;
    bytes: number;
  }>;
  totalBytes: number;
  /** Reviews of the skill, when its index has them. */
  audits?: MarketAudit[];
  /** Where its files live, to read them there. */
  homepage?: string;
  /** The file list is the index's text snapshot; the install fetches every file. */
  partial?: boolean;
}
/** One search of the search sources, newest first by installs. */
interface MarketSearchResult {
  query: string;
  items: MarketItem[];
  /** Why a search source could not answer; the local sources still did. */
  error?: string;
}
/** Where an installed skill came from, so an update can be offered. */
interface MarketInstall {
  skillKey: string;
  registryId: string;
  name: string;
  version?: string;
  source: MarketSource;
  /** SKILL.md hash right after install; a different hash later means it was edited. */
  hash: string;
  files: number;
  installedAt: string;
}
declare const AUTO_ADOPTION_STAGES: readonly ["queued", "drafting", "backtesting", "rewriting", "adopted", "paused", "review"];
declare const AUTO_ADOPTION_REASONS: readonly ["disabled", "no-cases", "case-limit", "unmeasured", "regressed", "changed", "failed", "queue-full", "model-unavailable", "interrupted", "daily-limit", "duplicate-skill"];
interface AutoAdoptionEvent {
  at: string;
  stage: typeof AUTO_ADOPTION_STAGES[number];
  attempt: number;
  reason?: typeof AUTO_ADOPTION_REASONS[number];
  detail?: string;
  baselineScore?: number;
  draftScore?: number;
}
type DraftExpectation = {
  id: string;
  hash: string;
} | null;
interface AutomaticAdoption {
  /** Absent on older Hosts; the Source then applies its default quota at commit. */
  reservationId?: string;
  attempt: number;
  draftHash: string;
  baselineRunId: string;
  draftRunId: string;
  casesHash: string;
}
interface SuggestionTriage {
  version: 1;
  classification: 'durable' | 'one-off' | 'uncertain';
  windows: number;
  sessions: number;
  steps: number;
  confidence: number;
}
interface AutoAdoptionQuota {
  date: string;
  timeZone: string;
  used: number;
  limit: number;
}
type AutoAdoptionReservation = AutoAdoptionQuota & ({
  allowed: true;
  reservationId: string;
} | {
  allowed: false;
  reason: 'daily-limit' | 'duplicate-skill';
});
//#endregion
export { AUTO_ADOPTION_REASONS, AUTO_ADOPTION_STAGES, AutoAdoptionEvent, AutoAdoptionQuota, AutoAdoptionReservation, AutomaticAdoption, BacktestRun, CaseResult, CatalogView, DEFAULT_SKILLS_POLICY, type DetectedSource, DraftExpectation, DraftPreferences, DraftPreferencesView, DraftStatus, DraftView, EVOLUTION_SIGNALS, EvalCase, EvalCheck, EvidencePack, EvidenceReference, EvolutionSignal, LocalizedText, MarketAudit, MarketEntry, MarketInstall, MarketInstallState, MarketItem, MarketPreview, MarketRegistry, MarketRegistryFile, MarketSearchResult, MarketSource, type MarketSourceKind, MarketView, ModelRoute, ReviewLogEntry, ReviewRecordInput, ReviewRecordResult, ReviewScore, RunStatus, RunTarget, RunTargetKind, SKILL_ROOT_KINDS, SKILL_ROOT_RANK, SUGGESTION_STATUSES, SkillCatalog, SkillDocument, SkillDraft, SkillInvocation, SkillOrigin, SkillProblem, SkillResolution, SkillRoot, SkillRootKind, SkillSuggestion, SkillSummary, SkillVersion, SkillVersionReason, SkillsOverview, SkillsPolicy, SuggestionStatus, SuggestionTriage, SuggestionView, Trajectory, TrajectoryAnnotation, TrajectoryStats, TrajectoryStep, TrajectoryStepKind, TrajectorySummary, TrashEntry, TrashRestoreInput, TrashRestorePreview, compareAutomaticSkillRuns, skillCaseSignature };