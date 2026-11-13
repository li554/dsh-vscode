import { MemoryJsonValue as JsonValue, MemoryReadGrant } from "dsh-mnemon/contracts";
//#region src/contracts.d.ts
type MemoryProviderId = string;
/**
 * The Mnemon Native Provider's id. Its package names its descriptor and driver
 * with it, the Starter installs it under it, and a stored space that names no
 * Provider belongs to it.
 */
declare const NATIVE_PROVIDER_ID = "mnemon-native";
/** Whether a Provider is Mnemon Native: by its implementation type, else by its id. */
declare function isNativeProvider(provider: {
  readonly id: MemoryProviderId;
  readonly typeId?: string | undefined;
}): boolean;
type MemoryProviderConnectionValue = string | number | boolean;
type MemoryProviderConnection = Record<string, MemoryProviderConnectionValue>;
interface MemoryProviderIcon {
  /** Bundled brand token, self-contained image data, or a short text glyph. */
  kind: 'brand' | 'data-url' | 'glyph';
  value: string;
}
interface MemoryProviderConfigOption {
  value: string;
  label: string;
  /** Optional Host-provided translation key; clients fall back to label. */
  i18nKey?: string;
}
interface MemoryProviderConfigField {
  key: string;
  label: string;
  /** Optional Host-provided translation key; clients fall back to label. */
  i18nKey?: string;
  /** Service fields are configured once on the dsh-mnemon page under Plugins; memory fields belong to each Memory Space. */
  scope: 'service' | 'memory';
  /** A reusable local data location presented with the same default/custom scope UI as Mnemon Native. */
  role?: 'global-location';
  input: 'text' | 'url' | 'secret' | 'number' | 'boolean' | 'select' | 'path';
  required: boolean;
  defaultValue?: MemoryProviderConnectionValue;
  placeholder?: string;
  help?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: string;
  normalize?: 'trim-trailing-slash';
  validationMessage?: string;
  /** Seed an empty service default from this field on the first discovered Memory Space. */
  discoveryDefaultFrom?: string;
  options?: MemoryProviderConfigOption[];
}
/** What a persistence strategy's rules can require of a Provider; the Starter's settings schema takes the same list. */
declare const MEMORY_PLACEMENT_CAPABILITIES: readonly ["graph", "entities", "related", "exact-write", "link", "forget"];
type MemoryPlacementCapability = (typeof MEMORY_PLACEMENT_CAPABILITIES)[number];
type MemoryPlacementPreference = 'balanced' | 'local-first' | 'shared-first';
interface MemoryPlacementRules {
  allowedProviderIds?: MemoryProviderId[];
  dataBoundary?: 'allow-remote' | 'local-only';
  requiredCapabilities?: MemoryPlacementCapability[];
  preference?: MemoryPlacementPreference;
}
/** Persistent policy for provider selection during Agent-supervised memory distillation. */
interface MemoryPersistenceStrategy {
  mode?: 'manual' | 'automatic';
  /** Fixed provider in manual mode. */
  providerId?: MemoryProviderId;
  /** User-authored guidance used only after hard rules have filtered automatic candidates. */
  prompt?: string;
  rules?: MemoryPlacementRules;
  /** Memory-level connection values for providers that may be selected by the policy. */
  providerConnections?: Partial<Record<MemoryProviderId, MemoryProviderConnection>>;
}
interface ResolvedMemoryPersistenceStrategy {
  mode: 'manual' | 'automatic';
  providerId: MemoryProviderId;
  /** Set when no provider was chosen; manual mode then uses whichever provider is ready. */
  providerDefaulted?: true;
  prompt: string;
  rules: {
    allowedProviderIds: MemoryProviderId[];
    dataBoundary: 'allow-remote' | 'local-only';
    requiredCapabilities: MemoryPlacementCapability[];
    preference: MemoryPlacementPreference;
  };
  providerConnections: Partial<Record<MemoryProviderId, MemoryProviderConnection>>;
}
interface AutomaticMemoryPlacementRequest {
  mode: 'automatic';
  /** User-authored routing guidance. Hard rules above always take precedence. */
  prompt?: string;
  rules?: MemoryPlacementRules;
}
interface MemoryPlacementDecision {
  mode: 'automatic';
  providerId: MemoryProviderId;
  decidedBy: 'rules' | 'llm';
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  candidateProviderIds: MemoryProviderId[];
  appliedRules: string[];
  decidedAt: string;
  runId?: string;
  subagentProvider?: string;
}
interface MemoryProviderCapabilities {
  search: boolean;
  browse: boolean;
  graph: boolean;
  entities: boolean;
  related: boolean;
  remember: boolean;
  link: boolean;
  forget: boolean;
  writeMode: 'exact' | 'async-extracting';
  deletionMode: 'soft' | 'hard' | 'unsupported';
}
interface MemoryProviderDescriptor {
  /** Provider implementation type; omitted when it is identical to id. */
  typeId?: string;
  id: MemoryProviderId;
  label: string;
  icon?: MemoryProviderIcon;
  kind: 'local' | 'remote';
  /** How the provider data scope reacts when DSH switches workspaces. */
  workspaceBinding: 'automatic' | 'optional-override' | 'provider-global';
  summary: string;
  /** Optional Host-provided translation key; clients fall back to summary. */
  summaryI18nKey?: string;
  origin: 'native' | 'third-party';
  capabilities: MemoryProviderCapabilities;
  fields: MemoryProviderConfigField[];
  /** Runtime projection: whether this scope has a usable saved service configuration. */
  serviceConfigured?: boolean;
}
interface MemoryProviderServiceView {
  providerId: MemoryProviderId;
  enabled: boolean;
  configured: boolean;
  settings: MemoryProviderConnection;
  configuredSecrets: string[];
  /** Present only on the settings RPC so its password inputs can use native reveal/hide behavior. */
  secretValues?: MemoryProviderConnection;
}
interface MemoryProviderServiceCatalog {
  providers: MemoryProviderDescriptor[];
  items: MemoryProviderServiceView[];
  generatedAt: string;
}
interface UpdateMemoryProviderServiceRequest {
  providerId: MemoryProviderId;
  settings: MemoryProviderConnection;
  enabled?: boolean;
  clearSecrets?: string[];
}
interface MemoryProviderRuntimeStatus {
  providerId: MemoryProviderId;
  label: string;
  icon?: MemoryProviderIcon;
  enabled: boolean;
  configured: boolean;
  status: 'disabled' | 'idle' | 'healthy' | 'unhealthy';
  memoryBodyCount: number;
  activeMemoryBodyCount: number;
  error?: string;
}
interface MemorySpaceProvider {
  id: MemoryProviderId;
  /** Implementation type; differs from id when one module has several child instances. */
  typeId?: string;
  label: string;
  icon?: MemoryProviderIcon;
  origin?: 'native' | 'third-party';
  kind: 'local' | 'remote';
  location: string;
  targetUri?: string;
  account?: string;
  user?: string;
  actorPeerId?: string;
  apiKeyConfigured: boolean;
  settings: MemoryProviderConnection;
  configuredSecrets: string[];
  capabilities: MemoryProviderCapabilities;
}
interface OpenVikingSpaceConnection {
  endpoint: string;
  targetUri: string;
  apiKey?: string;
  account?: string;
  user?: string;
  actorPeerId?: string;
}
interface MemorySpace {
  id: string;
  name: string;
  description: string;
  active: boolean;
  dbPath: string;
  provider: MemorySpaceProvider;
  placement?: MemoryPlacementDecision;
  createdAt: string;
  updatedAt: string;
}
interface CreateMemorySpaceRequest {
  name: string;
  description: string;
  active?: boolean;
  providerId?: MemoryProviderId;
  connection?: MemoryProviderConnection;
  /** Candidate-specific settings used only while resolving automatic placement. */
  providerConnections?: Partial<Record<MemoryProviderId, MemoryProviderConnection>>;
  openViking?: OpenVikingSpaceConnection;
  placement?: AutomaticMemoryPlacementRequest;
}
interface UpdateMemorySpaceRequest {
  name?: string;
  description?: string;
  active?: boolean;
  connection?: MemoryProviderConnection;
  clearSecrets?: string[];
  openViking?: Partial<OpenVikingSpaceConnection> & {
    clearApiKey?: boolean;
  };
}
interface MemorySpaceMetadataUpdate {
  memoryBodyId: string;
  title: string;
  description: string;
}
interface MemorySpaceMetadataMaintenanceResult {
  delegated: true;
  runId: string;
  provider: string;
  summary: string;
  updates: MemorySpaceMetadataUpdate[];
}
type Category = 'preference' | 'decision' | 'fact' | 'insight' | 'context' | 'general';
declare const CATEGORIES: readonly ["preference", "decision", "fact", "insight", "context", "general"];
type Source = 'user' | 'agent' | 'external';
declare const SOURCES: readonly ["user", "agent", "external"];
type EdgeType = 'temporal' | 'semantic' | 'causal' | 'entity';
declare const EDGE_TYPES: readonly ["temporal", "semantic", "causal", "entity"];
type Intent = 'WHY' | 'WHEN' | 'ENTITY' | 'GENERAL';
declare const INTENTS: readonly ["WHY", "WHEN", "ENTITY", "GENERAL"];
type RecallRelevanceTier = 'high' | 'medium' | 'ranked' | 'low' | 'unknown';
/**
 * One spelling-insensitive key per entity. The Host's entity index and the Client's graph
 * both count an entity's memories by it, so their numbers agree.
 */
declare function normalizeEntityKey(entity: string): string;
interface Insight {
  id: string;
  content: string;
  category?: string;
  importance?: number;
  tags?: string[];
  entities?: string[];
  source?: string;
  score?: number;
  /** Policy-normalized query relevance; absent for unknown Provider score scales. */
  normalizedScore?: number;
  /** Query relevance assigned by the active deterministic recall quality policy. */
  relevanceTier?: RecallRelevanceTier;
  /** Comparable rank score only when results were fused across providers. */
  federatedScore?: number;
  confidence?: string;
  intent?: string;
  matchedVia?: string;
  createdAt?: string;
  depth?: number;
  edgeType?: string;
  memoryBodyId?: string;
  memoryBodyName?: string;
  memoryProviderId?: MemoryProviderId;
  /** Provider label captured with the result so Client UI never needs an id catalog. */
  memoryProviderLabel?: string;
  /** Owning Provider capabilities at read time; safe to expose to clients. */
  memoryCapabilities?: MemoryProviderCapabilities;
  externalUri?: string;
}
interface SearchRequest {
  query: string;
  mode?: 'smart' | 'keyword' | 'basic';
  limit?: number;
  category?: Category;
  source?: Source;
  intent?: Intent;
  memoryBodyIds?: string[];
  /**
   * A look at the memory rather than a use of it, such as the Memory System's
   * own searches. Providers that record reads, as access counts or a query
   * log, leave it out, and may answer from a snapshot that lags a write still
   * in flight; a check that must see a write leaves the flag unset.
   */
  inspect?: boolean;
}
interface RememberRequest {
  content: string;
  category?: Category;
  /** Integer 1..5 when supplied. Omission uses the Provider's default. */
  importance?: number;
  tags?: string[];
  entities?: string[];
  source?: Source;
  memoryBodyId?: string;
}
interface MemorySpaceStats {
  totalInsights: number;
  deletedInsights: number;
  edgeCount: number;
  oplogCount: number;
  dbSizeBytes: number;
  byCategory: Record<string, number>;
  topEntities: Array<{
    entity: string;
    count: number;
  }>;
}
interface MemorySpaceView extends MemorySpace {
  /** True when Mnemon's persisted active-file selection points to this Store. */
  mnemonDefault: boolean;
  /** False when an external provider is disabled while its Memory Space registration remains preserved. */
  providerEnabled?: boolean;
  healthy: boolean;
  /** A fast directory response is visible while provider health resolves independently. */
  statusLoading?: boolean;
  error?: string;
  stats?: MemorySpaceStats;
}
/** Optional Host-only body-directory input; the Host binds the grant to its initiating View and exact Source. */
interface MemorySpaceWriteScopeRequest {
  viewId: string;
  grant: MemoryReadGrant;
}
/** Source-owned write authority, distinct from the active namespaces pinned for recall. */
interface MemorySpaceWriteScope {
  viewId: string;
  sourceInstanceKey: string;
  memoryBodyIds: string[];
}
interface MemorySpaceCatalog {
  items: MemorySpaceView[];
  providers: MemoryProviderDescriptor[];
  /** Sanitized policy exposed to memory workers; provider connection values are never included. */
  persistenceStrategy?: Omit<ResolvedMemoryPersistenceStrategy, 'providerConnections'>;
  total: number;
  activeCount: number;
  directory: string;
  generatedAt: string;
  /** Present only when body-directory receives a supported writeScope request. Older Sources omit it. */
  writeScope?: MemorySpaceWriteScope;
  /** Provider namespaces asked for again in this process: whether a pass is running, and the last one. Older Sources omit it. */
  rediscovery?: {
    running: boolean;
    last?: MemorySpaceRediscovery;
  };
}
/** What one Provider answered when its namespaces were asked for again. */
interface MemorySpaceRediscoveryResult {
  providerId: MemoryProviderId;
  label: string;
  /** Namespaces the Provider reported. */
  found: number;
  /** Spaces mounted for namespaces this directory had never held. They start inactive. */
  added: Array<{
    id: string;
    name: string;
  }>;
  /** Reported namespaces a person disconnected here; they stay disconnected. */
  disconnected: number;
  /** Why the Provider could not be asked, as it said. Its spaces stay as they were. */
  error?: string;
  /** The Provider said nothing within the time it was given. */
  timedOut?: boolean;
}
/** One pass over every enabled Provider service, when the Host starts or from the Memory Spaces page. */
interface MemorySpaceRediscovery {
  at: string;
  trigger: 'startup' | 'manual';
  results: MemorySpaceRediscoveryResult[];
}
interface MemoryGraphNode extends Insight {
  color: string;
  graphId?: string;
  kind?: 'memory' | 'entity' | 'space';
  memoryBodyIds?: string[];
  memoryBodyNames?: string[];
  occurrenceCount?: number;
}
interface MemoryGraphEdge {
  sourceId: string;
  targetId: string;
  label: string;
  color: string;
  type?: EdgeType | 'scope';
}
interface MemoryGraphSnapshot {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
  generatedAt: string;
  memoryBodies?: Array<Pick<MemorySpace, 'id' | 'name' | 'active'>>;
  /** Per-space observation state for capability-aware overview rendering. */
  sources?: MemoryReadSource[];
}
type MemoryReadMode = 'search' | 'graph' | 'projection' | 'enumerable' | 'query-only' | 'entities' | 'unsupported';
/** 'loading' is client-only: a page shows its spaces from the directory while the read runs. */
type MemoryReadStatus = 'ready' | 'empty' | 'query-required' | 'unsupported' | 'unavailable' | 'loading';
/**
 * One provider-backed Memory Space participating in a read surface.
 *
 * The mode describes what the provider can truthfully expose; status describes
 * the result of this particular read. Keeping those dimensions separate lets
 * the UI distinguish an empty graph from a flat projection, a query-only
 * engine, and an unavailable connection.
 */
interface MemoryReadSource {
  memoryBodyId: string;
  memoryBodyName: string;
  providerId: MemoryProviderId;
  providerLabel: string;
  mode: MemoryReadMode;
  status: MemoryReadStatus;
  itemCount: number;
  edgeCount?: number;
  /** Entity reads: the memories the entity index covers in this space. */
  memoryCount?: number;
  /** Entity reads: false when the Provider could not index every memory of this space. */
  complete?: boolean;
  hint?: string;
  quality?: RecallQualityStats;
}
interface RecallQualityStats {
  policyId: string;
  fallbackFrom?: string;
  fetched: number;
  retained: number;
  selected: number;
  droppedLowScore: number;
  droppedNonPositiveScore: number;
  droppedInvalidScore: number;
  unscored: number;
  unscaled: number;
  /** Finite native or out-of-range scores retained by Provider rank, not confidence. */
  ranked?: number;
  /** A normalized-relevance Provider returned a score above its declared maximum of 1. */
  outOfRange?: number;
}
interface MemoryListRequest {
  query?: string;
  category?: Category;
  limit?: number;
  memoryBodyIds?: string[];
}
interface MemoryListView {
  items: MemoryGraphNode[];
  total: number;
  generatedAt: string;
  /** Omitted only when talking to a pre-provider-aware Host. */
  sources?: MemoryReadSource[];
}
interface MemorySpaceMetadataSample {
  memoryBodyId: string;
  name: string;
  description: string;
  providerId: MemorySpace['provider']['id'];
  providerLabel: string;
  method: 'native-basic' | 'browse' | 'search';
  evidence: Array<Pick<Insight, 'content' | 'category' | 'entities'>>;
}
interface MemoryPlacementCandidate {
  id: MemoryProviderId;
  label: string;
  kind: 'local' | 'remote';
  configured: boolean;
  summary: string;
  capabilities: MemoryProviderCapabilities;
}
interface PreparedMemoryPlacement {
  prompt: string;
  candidates: MemoryPlacementCandidate[];
  appliedRules: string[];
  selectorBrief: string;
}
interface LlmMemoryPlacementSelection {
  providerId: string;
  reason: string;
  confidence: string;
}
declare const DEFAULT_EMBEDDING_ENDPOINT = "http://localhost:11434";
declare const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";
declare const EMBEDDING_PROTOCOL_AUTO = "auto";
declare const EMBEDDING_PROTOCOL_OLLAMA = "ollama";
declare const EMBEDDING_PROTOCOL_OPENAI = "openai";
/** Default protocol defers to Mnemon's /v1 auto-detection. */
declare const DEFAULT_EMBEDDING_PROTOCOL = "auto";
/** Wire protocols accepted by the embedding protocol override; single source for schema, resolver, and UI validation. */
declare const MNEMON_EMBEDDING_PROTOCOLS: readonly ["auto", "ollama", "openai"];
interface RecallQualityConfig {
  /** Registered deterministic policy id. */
  policy?: string;
  lowScoreThreshold?: number;
  highScoreThreshold?: number;
  /** Provider candidate expansion before quality filtering, from 1 through 5. */
  candidateMultiplier?: number;
  /** Maximum medium-relevance rows admitted by the strict policy. */
  maxMediumResults?: number;
  /** Maximum Provider-ranked rows without calibrated relevance admitted by the strict policy. */
  maxRankedResults?: number;
  /** Maximum undeclared-scale or unscored rows admitted by the strict policy. */
  maxUnknownResults?: number;
}
interface ResolvedRecallQualityConfig {
  policy: string;
  lowScoreThreshold: number;
  highScoreThreshold: number;
  candidateMultiplier: number;
  maxMediumResults: number;
  maxRankedResults: number;
  maxUnknownResults: number;
}
type MnemonEmbeddingProtocol = (typeof MNEMON_EMBEDDING_PROTOCOLS)[number];
interface MnemonEmbeddingConfig {
  /** When false or omitted, Mnemon keeps its inherited environment and built-in defaults. */
  enabled?: boolean;
  endpoint?: string;
  model?: string;
  /** Legacy inline key. New settings writes move it to the Host credentials store. */
  apiKey?: string;
  /** Host environment variable resolved just before launching the CLI. */
  apiKeyEnv?: string;
  /** Opaque reference to an endpoint-bound record in DSH's credentials store. */
  apiKeyRef?: string;
  /** Explicit wire-protocol override; 'auto' keeps Mnemon's /v1 auto-detection. */
  protocol?: MnemonEmbeddingProtocol;
}
interface ResolvedMnemonEmbeddingConfig {
  enabled: boolean;
  endpoint: string;
  model: string;
  apiKey: string;
  apiKeyEnv?: string;
  apiKeyRef?: string;
  protocol: MnemonEmbeddingProtocol;
}
/** Settings readback metadata only; never persisted as embedding configuration. */
interface MnemonEmbeddingSettingsView extends MnemonEmbeddingConfig {
  apiKeyStorage?: 'none' | 'legacy' | 'environment' | 'credentials';
  apiKeyConfigured?: boolean;
}
declare const EMBEDDING_CREDENTIAL_PREFIX = "dsh-mnemon/embedding-";
declare const EMBEDDING_CREDENTIAL_REFERENCE: RegExp;
declare const EMBEDDING_ENVIRONMENT_NAME: RegExp;
/** DSH owns persistence; this grant is private to Mnemon Native embedding. */
interface MnemonEmbeddingCredential {
  version: 1;
  endpoint: string;
  apiKey: string;
}
interface MnemonEmbeddingStatus {
  /** Whether Mnemon 0.2.13+ produced a nonempty probe vector with the selected model. */
  available: boolean;
  model: string;
  /** Protocol Mnemon resolved for the embedding endpoint; omitted when the CLI does not report one. */
  protocol?: string;
  /** Across the spaces in `spaces` that could be counted; 0 when no space has a database. */
  totalInsights: number;
  embedded: number;
  coverage: string;
  /** Each Mnemon Native space with a database, as `mnemon --store <id> embed --status` counts it (#392). */
  spaces?: MnemonEmbeddingSpaceStatus[];
}
/** One Mnemon Native space's vector coverage. */
interface MnemonEmbeddingSpaceStatus {
  memoryBodyId: string;
  name: string;
  active: boolean;
  totalInsights: number;
  embedded: number;
  coverage: string;
  /** Why the space could not be counted; its counts are then 0 and stay out of the total. */
  error?: string;
}
/** What one fill of a Mnemon Native space's missing vectors did (#392). */
interface MnemonEmbeddingFill {
  memoryBodyId: string;
  /** Vectors the fill wrote. */
  filled: number;
  /** Memories of the space still without a vector when it stopped. */
  remaining: number;
  /** The embedding model Mnemon used. */
  model: string;
  /**
   * Why it stopped while memories remain: its minute ran out (`time`), or a step wrote no vector,
   * so the embedding service returned none for the memories left (`refused`).
   */
  stopped?: 'time' | 'refused';
}
/** Domain status only; workbench/lifecycle status belongs to the default adapter. */
interface MemorySpacesStatus {
  healthy: boolean;
  error?: string;
  version?: string;
  cliPath: string;
  commandFound: boolean;
  dataDir: string;
  store: string;
  mnemonDefaultStore: string;
  dshActiveStores: string[];
  writeEnabled: boolean;
  timeoutMs: number;
  defaultRecallLimit: number;
  recallQuality: ResolvedRecallQualityConfig;
  /**
   * Whether DSH manages Mnemon Native's embedding settings (`embedding.enabled`). While it does
   * not, Mnemon keeps the Host environment and its own defaults. Memory Spaces 0.5.21 and earlier omit it.
   */
  embeddingManaged?: boolean;
  memoryBodyDirectory: string;
  memoryBodies: MemorySpaceView[];
  providerServices?: MemoryProviderRuntimeStatus[];
  stats?: MemorySpaceStats & {
    dbPath?: string;
  };
}
/**
 * The entities of the active spaces. Each count is the number of memories that
 * carry the entity, the same set entity-memories lists.
 */
interface EntityView {
  items: Array<{
    entity: string;
    count: number;
  }>;
  /** With a selected entity: the first page of entity-memories, kept for existing callers. */
  insights: Insight[];
  selected?: string;
  /** Omitted only when talking to a pre-provider-aware Host. */
  sources?: MemoryReadSource[];
  /** Distinct entities across the active spaces; items may be capped below it. Omitted by older Hosts. */
  total?: number;
  /** False when a space's Provider could not index every memory. Omitted by older Hosts. */
  complete?: boolean;
}
/** One page of the memories that carry an entity, by importance and then recency. */
interface EntityMemoriesView {
  /** The entity's most common spelling, or the requested name when no memory carries it. */
  entity: string;
  total: number;
  offset: number;
  items: Insight[];
  complete: boolean;
  sources: MemoryReadSource[];
}
/** Memories recall relates to an entity that do not carry it themselves. */
interface EntityRelatedView {
  entity: string;
  items: Insight[];
  sources: MemoryReadSource[];
}
/** The directory under a storage root that holds Mnemon's stores, one per Native space, and their registry. */
declare const MEMORY_SPACES_DIRECTORY = "data";
/** The registry of Native spaces. The published v1 name and its `bodies` key stay for existing stores and Packs. */
declare const MEMORY_SPACE_REGISTRY_FILE = ".dsh-memory-bodies.json";
/** A Native space's Mnemon store, in the directory its space id names. */
declare const MEMORY_SPACE_DATABASE_FILE = "mnemon.db";
/** A space id, which also names its store's directory. */
declare const MEMORY_SPACE_ID_PATTERN: RegExp;
/** The most characters a space's name holds. */
declare const MEMORY_SPACE_NAME_MAX_LENGTH = 100;
/** The most characters a space's routing description holds. */
declare const MEMORY_SPACE_DESCRIPTION_MAX_LENGTH = 1000;
/** Mnemon's own record of its default store, one space id, at the storage root. */
declare const MNEMON_ACTIVE_STORE_FILE = "active";
/** Third-party Provider services and the spaces they serve, in the storage root's `state` directory. No Pack carries it. */
declare const MEMORY_PROVIDER_REGISTRY_FILE = "memory-providers.json";
/** One Native space as a copy of the registry, such as a Mnemon Pack, carries it. */
interface MemorySpaceRegistryEntry {
  id: string;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
interface MemorySpaceRegistryFile {
  version: 1;
  bodies: MemorySpaceRegistryEntry[];
}
/**
 * Read a registry as a copy of it carries it: each id unique and usable as a directory name,
 * every name, description and time present, or the whole registry is refused. Only the fields of
 * the entry above are kept, so a copy holds nothing else, and a registry written back from one
 * no longer holds what else an entry recorded, such as a Native space's `placement` decision or
 * `metadataSource`.
 */
declare function parseMemorySpaceRegistry(value: unknown): MemorySpaceRegistryFile;
/** What a stored registry holds, counted without judging each space. */
interface MemorySpaceRegistrySummary {
  /** Whether it is the version 1 registry this Source writes; a legacy version 2 file, migrated when the Source next loads it, is not. */
  valid: boolean;
  /** Every listed space that is an object, whichever version lists it. */
  spaces: number;
  active: number;
}
/** Count the spaces of a parsed registry for a read-only inventory. It never throws. */
declare function summarizeMemorySpaceRegistry(value: unknown): MemorySpaceRegistrySummary;
/** What a stored Provider registry holds, counted without judging each entry. */
interface MemoryProviderRegistrySummary {
  /** Whether the file is an object at all. Without one, every count is 0. */
  valid: boolean;
  /** Provider services with saved settings, enabled or not. */
  services: number;
  /** Spaces a third-party Provider serves: every entry of the list, well-formed or not. */
  connections: number;
}
/** Count a parsed Provider registry for a read-only inventory. It never throws. */
declare function summarizeMemoryProviderRegistry(value: unknown): MemoryProviderRegistrySummary;
/** @deprecated Use CreateMemorySpaceRequest. The wire shape is unchanged. */
type CreateMemoryBodyRequest = CreateMemorySpaceRequest;
/** @deprecated Use UpdateMemorySpaceRequest. The wire shape is unchanged. */
type UpdateMemoryBodyRequest = UpdateMemorySpaceRequest;
/** @deprecated Use MemorySpace. The wire shape is unchanged. */
type MemoryBody = MemorySpace;
/** @deprecated Use MemorySpaceCatalog. The wire shape is unchanged. */
type MemoryBodyCatalog = MemorySpaceCatalog;
/** @deprecated Use MemorySpaceMetadataMaintenanceResult. The wire shape is unchanged. */
type MemoryBodyMetadataMaintenanceResult = MemorySpaceMetadataMaintenanceResult;
/** @deprecated Use MemorySpaceMetadataSample. The wire shape is unchanged. */
type MemoryBodyMetadataSample = MemorySpaceMetadataSample;
/** @deprecated Use MemorySpaceMetadataUpdate. The wire shape is unchanged. */
type MemoryBodyMetadataUpdate = MemorySpaceMetadataUpdate;
/** @deprecated Use MemorySpaceProvider. The wire shape is unchanged. */
type MemoryBodyProvider = MemorySpaceProvider;
/** @deprecated Use MemorySpaceStats. The wire shape is unchanged. */
type MemoryBodyStats = MemorySpaceStats;
/** @deprecated Use MemorySpaceView. The wire shape is unchanged. */
type MemoryBodyView = MemorySpaceView;
/** @deprecated Use OpenVikingSpaceConnection. The wire shape is unchanged. */
type OpenVikingBodyConnection = OpenVikingSpaceConnection;
//#endregion
export { AutomaticMemoryPlacementRequest, CATEGORIES, Category, CreateMemoryBodyRequest, CreateMemorySpaceRequest, DEFAULT_EMBEDDING_ENDPOINT, DEFAULT_EMBEDDING_MODEL, DEFAULT_EMBEDDING_PROTOCOL, EDGE_TYPES, EMBEDDING_CREDENTIAL_PREFIX, EMBEDDING_CREDENTIAL_REFERENCE, EMBEDDING_ENVIRONMENT_NAME, EMBEDDING_PROTOCOL_AUTO, EMBEDDING_PROTOCOL_OLLAMA, EMBEDDING_PROTOCOL_OPENAI, EdgeType, EntityMemoriesView, EntityRelatedView, EntityView, INTENTS, Insight, Intent, type JsonValue, LlmMemoryPlacementSelection, MEMORY_PLACEMENT_CAPABILITIES, MEMORY_PROVIDER_REGISTRY_FILE, MEMORY_SPACES_DIRECTORY, MEMORY_SPACE_DATABASE_FILE, MEMORY_SPACE_DESCRIPTION_MAX_LENGTH, MEMORY_SPACE_ID_PATTERN, MEMORY_SPACE_NAME_MAX_LENGTH, MEMORY_SPACE_REGISTRY_FILE, MNEMON_ACTIVE_STORE_FILE, MNEMON_EMBEDDING_PROTOCOLS, MemoryBody, MemoryBodyCatalog, MemoryBodyMetadataMaintenanceResult, MemoryBodyMetadataSample, MemoryBodyMetadataUpdate, MemoryBodyProvider, MemoryBodyStats, MemoryBodyView, MemoryGraphEdge, MemoryGraphNode, MemoryGraphSnapshot, MemoryListRequest, MemoryListView, MemoryPersistenceStrategy, MemoryPlacementCandidate, MemoryPlacementCapability, MemoryPlacementDecision, MemoryPlacementPreference, MemoryPlacementRules, MemoryProviderCapabilities, MemoryProviderConfigField, MemoryProviderConfigOption, MemoryProviderConnection, MemoryProviderConnectionValue, MemoryProviderDescriptor, MemoryProviderIcon, MemoryProviderId, MemoryProviderRegistrySummary, MemoryProviderRuntimeStatus, MemoryProviderServiceCatalog, MemoryProviderServiceView, MemoryReadMode, MemoryReadSource, MemoryReadStatus, MemorySpace, MemorySpaceCatalog, MemorySpaceMetadataMaintenanceResult, MemorySpaceMetadataSample, MemorySpaceMetadataUpdate, MemorySpaceProvider, MemorySpaceRediscovery, MemorySpaceRediscoveryResult, MemorySpaceRegistryEntry, MemorySpaceRegistryFile, MemorySpaceRegistrySummary, MemorySpaceStats, MemorySpaceView, MemorySpaceWriteScope, MemorySpaceWriteScopeRequest, MemorySpacesStatus, MnemonEmbeddingConfig, MnemonEmbeddingCredential, MnemonEmbeddingFill, MnemonEmbeddingProtocol, MnemonEmbeddingSettingsView, MnemonEmbeddingSpaceStatus, MnemonEmbeddingStatus, NATIVE_PROVIDER_ID, OpenVikingBodyConnection, OpenVikingSpaceConnection, PreparedMemoryPlacement, RecallQualityConfig, RecallQualityStats, RecallRelevanceTier, RememberRequest, ResolvedMemoryPersistenceStrategy, ResolvedMnemonEmbeddingConfig, ResolvedRecallQualityConfig, SOURCES, SearchRequest, Source, UpdateMemoryBodyRequest, UpdateMemoryProviderServiceRequest, UpdateMemorySpaceRequest, isNativeProvider, normalizeEntityKey, parseMemorySpaceRegistry, summarizeMemoryProviderRegistry, summarizeMemorySpaceRegistry };