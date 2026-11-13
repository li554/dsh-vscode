import { EdgeType, Insight, JsonValue, MemoryGraphSnapshot, MemoryListRequest, MemoryProviderCapabilities, MemoryProviderConfigField, MemoryProviderConnection, MemoryProviderDescriptor, MemoryProviderIcon, MemorySpace, MemorySpaceStats, RememberRequest, SearchRequest } from "./contracts.js";
import { Context, Plugin } from "@deepseek-ai/cordis";
//#region src/providers/adapter.d.ts
/** Minimum parent authority a Provider needs; no private controller class. */
interface MemorySpaceAuthority {
  readonly runner: {
    effectiveDataDir(): string;
  };
  list(): MemorySpace[];
  providerConnection(id: string, expectedProviderId?: string): MemoryProviderConnection;
}
/** Per-call options of the Native command transport. */
interface MemorySpaceNativeRunOptions {
  signal?: AbortSignal;
  store?: string;
  /**
   * Output cap for this call, in bytes (default 2 MiB). Raise it only for reads
   * whose size the Store itself bounds, such as a whole-Store dump; Source
   * hosts older than 0.5.14 ignore it and keep the default.
   */
  maxOutputBytes?: number;
}
/** Scoped command transport consumed by the Native Provider. */
interface MemorySpaceNativeRunner {
  runJson(args: readonly string[], options?: MemorySpaceNativeRunOptions): Promise<JsonValue>;
  runText(args: readonly string[], options?: MemorySpaceNativeRunOptions): Promise<string>;
}
interface MemoryProviderAdapterFactoryContext {
  /** Canonical name; optional while older Source hosts remain supported. */
  memorySpaces?: MemorySpaceAuthority;
  /** @deprecated Use memorySpaces when present; retained for existing Provider factories. */
  memoryBodies: MemorySpaceAuthority;
  config: {
    timeoutMs: number;
    defaultRecallLimit?: number;
  };
  nativeRunner?: MemorySpaceNativeRunner;
}
interface ProviderSpaceStatus {
  healthy: boolean;
  error?: string;
  stats?: MemorySpaceStats;
}
interface ProviderSearchResult {
  results: Insight[];
  hint?: string;
}
interface ProviderScoreSemantics {
  /** Normalized relevance is calibrated in 0..1; native scores only carry Provider ordering. */
  kind: 'normalized-relevance' | 'provider-native';
}
type MemoryProviderScoreSemantics = 'normalized-relevance' | 'provider-native' | 'none';
declare const NORMALIZED_RELEVANCE_SCORE: ProviderScoreSemantics;
/** The memories of one Memory Space that carry entities, as the Provider's own index has them. */
interface ProviderEntityIndex {
  /** Each memory with at least one entity, listing its entities. */
  memories: Insight[];
  /** False when the Provider could not include every memory of the space. */
  complete: boolean;
}
/** One provider-owned namespace projected into DSH as a Memory Space. */
interface ProviderMemorySpace {
  /** Stable identifier owned by the provider, never a DSH-generated title. */
  externalId: string;
  name: string;
  description: string;
  connection: MemoryProviderConnection;
}
/**
 * Third-layer memory data plane. DSH owns routing and lifecycle; adapters own
 * only one memory space's persistence and retrieval semantics.
 */
interface MemoryProviderAdapter {
  readonly id: MemorySpace['provider']['id'];
  readonly scoreSemantics?: ProviderScoreSemantics;
  /** Enumerate the complete set of namespaces visible to this service connection. */
  discover?(connection: MemoryProviderConnection, signal?: AbortSignal): Promise<ProviderMemorySpace[]>;
  /** Drop a short-lived health result before an explicit user reconnect. */
  invalidateStatus?(memoryBodyId?: string): void;
  status(body: MemorySpace, signal?: AbortSignal): Promise<ProviderSpaceStatus>;
  search(body: MemorySpace, request: SearchRequest, signal?: AbortSignal): Promise<ProviderSearchResult>;
  graph(body: MemorySpace, signal?: AbortSignal): Promise<MemoryGraphSnapshot>;
  list(body: MemorySpace, request: MemoryListRequest, signal?: AbortSignal): Promise<Insight[]>;
  remember(body: MemorySpace, request: RememberRequest, signal?: AbortSignal): Promise<JsonValue>;
  /** Optional cheap bounded metadata sampling, without a graph projection. */
  metadataSample?(body: MemorySpace, limit: number, signal?: AbortSignal): Promise<Insight[]>;
  /**
   * Optional entity index for the Entities page. Without it the Source builds
   * the index from list(), so a Provider whose list() stops short of every
   * memory, or that cannot list, implements this to keep entity counts whole.
   */
  entityIndex?(body: MemorySpace, signal?: AbortSignal): Promise<ProviderEntityIndex>;
  /** Persist an ordered host-authorized batch and return one receipt per request. */
  rememberMany?(body: MemorySpace, requests: readonly RememberRequest[], signal?: AbortSignal): Promise<JsonValue[]>;
  /**
   * Optional exact read: the memory this space holds under `id`, or undefined
   * when it holds none. With it an action can name a memory by id that the
   * current View has not returned, such as an Agent forgetting what it wrote.
   */
  get?(body: MemorySpace, id: string, signal?: AbortSignal): Promise<Insight | undefined>;
  related?(body: MemorySpace, id: string, depth: number, edge?: EdgeType, signal?: AbortSignal): Promise<Insight[]>;
  link?(body: MemorySpace, sourceId: string, targetId: string, type: EdgeType, weight: number, reason?: string, signal?: AbortSignal): Promise<JsonValue>;
  forget?(body: MemorySpace, id: string, signal?: AbortSignal): Promise<JsonValue>;
  /** Release generation-owned clients, timers, pools, or subprocess handles. */
  dispose?(): void | Promise<void>;
}
/** @deprecated Use ProviderSpaceStatus. */
type ProviderBodyStatus = ProviderSpaceStatus;
//#endregion
//#region src/providers/definitions.d.ts
declare const MEMORY_SPACE_PROVIDER_API_VERSION: "dsh-mnemon.memory-space-provider/v1";
type MemorySpaceProviderScoreSemantics = 'normalized-relevance' | 'provider-native' | 'none';
/**
 * Complete, JSON-safe definition metadata owned by the Memory Spaces Source.
 * It is deliberately not a Mnemon-wide contribution manifest.
 */
interface MemorySpaceProviderManifest {
  apiVersion: typeof MEMORY_SPACE_PROVIDER_API_VERSION;
  kind: 'provider';
  typeId: string;
  packageName: string;
  version: string;
  label: string;
  icon?: MemoryProviderIcon | undefined;
  summary: string;
  summaryI18nKey?: string;
  origin: 'native' | 'third-party';
  locality: 'local' | 'remote';
  workspaceBinding: MemoryProviderDescriptor['workspaceBinding'];
  capabilities: MemoryProviderCapabilities;
  fields: MemoryProviderConfigField[];
  secrets: string[];
  scoreSemantics: MemorySpaceProviderScoreSemantics;
}
interface MemorySpaceProviderRuntimeContext extends MemoryProviderAdapterFactoryContext {
  /** Stable identity of this child mount inside one Memory Spaces Source. */
  providerInstanceId: string;
  manifest: MemorySpaceProviderManifest;
}
interface MemorySpaceProviderDefinition {
  manifest: MemorySpaceProviderManifest;
  create(context: MemorySpaceProviderRuntimeContext): MemoryProviderAdapter;
}
type MemorySpaceProviderDisposer = () => void | Promise<void>;
/** Capability handed directly to one child Fiber through a lexical closure. */
interface MemorySpaceProviderHost {
  install(owner: Context, definition: MemorySpaceProviderDefinition): MemorySpaceProviderDisposer;
}
/** Typed child module mounted only by a Memory Spaces parent Fiber. */
interface MemorySpaceProviderModule<Config = undefined> {
  readonly id: string;
  /** Optional Cordis-compatible Standard Schema used for this child config. */
  readonly Config?: Plugin.Base<Config>['Config'];
  apply(ctx: Context, host: MemorySpaceProviderHost, config: Config): void | Promise<void>;
}
interface MemorySpaceProviderEntry<Config = unknown> {
  instanceId: string;
  module: MemorySpaceProviderModule<Config>;
  config: Config;
}
declare function defineMemorySpaceProvider<Config>(module: MemorySpaceProviderModule<Config>): MemorySpaceProviderModule<Config>;
declare function defineMemorySpaceProviderDefinition(definition: MemorySpaceProviderDefinition): MemorySpaceProviderDefinition;
//#endregion
export { ProviderSearchResult as C, ProviderScoreSemantics as S, MemorySpaceNativeRunner as _, MemorySpaceProviderHost as a, ProviderEntityIndex as b, MemorySpaceProviderRuntimeContext as c, defineMemorySpaceProviderDefinition as d, MemoryProviderAdapter as f, MemorySpaceNativeRunOptions as g, MemorySpaceAuthority as h, MemorySpaceProviderEntry as i, MemorySpaceProviderScoreSemantics as l, MemoryProviderScoreSemantics as m, MemorySpaceProviderDefinition as n, MemorySpaceProviderManifest as o, MemoryProviderAdapterFactoryContext as p, MemorySpaceProviderDisposer as r, MemorySpaceProviderModule as s, MEMORY_SPACE_PROVIDER_API_VERSION as t, defineMemorySpaceProvider as u, NORMALIZED_RELEVANCE_SCORE as v, ProviderSpaceStatus as w, ProviderMemorySpace as x, ProviderBodyStatus as y };