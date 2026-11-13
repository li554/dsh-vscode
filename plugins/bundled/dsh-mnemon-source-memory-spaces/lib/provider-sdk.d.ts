import { CATEGORIES, Category, EDGE_TYPES, EdgeType, INTENTS, Insight, Intent, JsonValue, MemoryBody, MemoryBodyProvider, MemoryBodyStats, MemoryGraphEdge, MemoryGraphNode, MemoryGraphSnapshot, MemoryListRequest, MemoryProviderCapabilities, MemoryProviderConfigField, MemoryProviderConfigOption, MemoryProviderConnection, MemoryProviderConnectionValue, MemoryProviderDescriptor, MemoryProviderIcon, MemoryProviderId, MemorySpace, MemorySpaceProvider, MemorySpaceStats, OpenVikingBodyConnection, OpenVikingSpaceConnection, RememberRequest, SOURCES, SearchRequest, Source } from "./contracts.js";
import { C as ProviderSearchResult, S as ProviderScoreSemantics, _ as MemorySpaceNativeRunner, a as MemorySpaceProviderHost, b as ProviderEntityIndex, c as MemorySpaceProviderRuntimeContext, d as defineMemorySpaceProviderDefinition, f as MemoryProviderAdapter, g as MemorySpaceNativeRunOptions, h as MemorySpaceAuthority, i as MemorySpaceProviderEntry, l as MemorySpaceProviderScoreSemantics, m as MemoryProviderScoreSemantics, n as MemorySpaceProviderDefinition, o as MemorySpaceProviderManifest, p as MemoryProviderAdapterFactoryContext, r as MemorySpaceProviderDisposer, s as MemorySpaceProviderModule, t as MEMORY_SPACE_PROVIDER_API_VERSION, u as defineMemorySpaceProvider, v as NORMALIZED_RELEVANCE_SCORE, w as ProviderSpaceStatus, x as ProviderMemorySpace, y as ProviderBodyStatus } from "./definitions-BNmfQoWk.js";
//#region src/providers/http.d.ts
interface HttpProviderOptions {
  label?: string;
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
}
interface JsonRequestOptions {
  method?: string;
  headers?: HeadersInit;
  json?: JsonValue;
  signal?: AbortSignal | undefined;
  timeoutMs?: number;
}
declare function jsonObject(value: unknown): Record<string, unknown> | undefined;
declare function jsonString(value: unknown): string | undefined;
declare function jsonNumber(value: unknown): number | undefined;
declare function jsonArray(value: unknown): unknown[];
declare function firstArray(value: unknown, ...keys: string[]): unknown[];
/** Shared timeout, cancellation, error, and projection behavior for HTTP providers. */
declare abstract class HttpMemoryProvider {
  protected readonly memorySpaces: MemorySpaceAuthority;
  abstract readonly id: MemoryProviderId;
  protected readonly label: string | undefined;
  protected readonly requestFetch: typeof fetch;
  protected readonly requestTimeoutMs: number;
  /** @deprecated Use memorySpaces. */
  protected readonly memoryBodies: MemorySpaceAuthority;
  constructor(memorySpaces: MemorySpaceAuthority, options?: HttpProviderOptions);
  abstract list(body: MemorySpace, request: MemoryListRequest, signal?: AbortSignal): Promise<Insight[]>;
  graph(body: MemorySpace, signal?: AbortSignal): Promise<MemoryGraphSnapshot>;
  protected connection(body: MemorySpace): MemoryProviderConnection;
  protected request(body: MemorySpace, path: string, options?: JsonRequestOptions): Promise<unknown>;
  protected requestConnection(connection: MemoryProviderConnection, path: string, options?: JsonRequestOptions): Promise<unknown>;
}
//#endregion
//#region src/providers/process.d.ts
interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
interface ProcessOptions {
  signal?: AbortSignal | undefined;
  timeoutMs: number;
  maxOutputBytes?: number;
  cwd?: string | undefined;
  env?: NodeJS.ProcessEnv | undefined;
  label?: string | undefined;
}
type ProcessRunner = (command: string, args: readonly string[], options: ProcessOptions) => Promise<ProcessResult>;
/** Why a process did not produce a result, so callers can explain each case differently. */
type ProcessFailureReason = 'launch' | 'timeout' | 'aborted' | 'output-limit';
declare class ProcessError extends Error {
  readonly reason: ProcessFailureReason;
  constructor(message: string, reason: ProcessFailureReason);
}
declare const DEFAULT_MAX_OUTPUT_BYTES: number;
/** Spawn without a shell, with bounded output and cooperative cancellation. */
declare const runProcess: ProcessRunner;
//#endregion
export { CATEGORIES, type Category, DEFAULT_MAX_OUTPUT_BYTES, EDGE_TYPES, type EdgeType, HttpMemoryProvider, HttpProviderOptions, INTENTS, type Insight, type Intent, JsonRequestOptions, type JsonValue, MEMORY_SPACE_PROVIDER_API_VERSION, type MemoryBody, type MemoryBodyProvider, type MemoryBodyStats, type MemoryGraphEdge, type MemoryGraphNode, type MemoryGraphSnapshot, type MemoryListRequest, MemoryProviderAdapter, MemoryProviderAdapterFactoryContext, type MemoryProviderCapabilities, type MemoryProviderConfigField, type MemoryProviderConfigOption, type MemoryProviderConnection, type MemoryProviderConnectionValue, type MemoryProviderDescriptor, type MemoryProviderIcon, type MemoryProviderId, MemoryProviderScoreSemantics, type MemorySpace, MemorySpaceAuthority, MemorySpaceNativeRunOptions, MemorySpaceNativeRunner, type MemorySpaceProvider, type MemorySpaceProviderDefinition, type MemorySpaceProviderDisposer, type MemorySpaceProviderEntry, type MemorySpaceProviderHost, type MemorySpaceProviderManifest, type MemorySpaceProviderModule, type MemorySpaceProviderRuntimeContext, type MemorySpaceProviderScoreSemantics, type MemorySpaceStats, NORMALIZED_RELEVANCE_SCORE, type OpenVikingBodyConnection, type OpenVikingSpaceConnection, ProcessError, ProcessFailureReason, ProcessOptions, ProcessResult, ProcessRunner, ProviderBodyStatus, ProviderEntityIndex, ProviderMemorySpace, ProviderScoreSemantics, ProviderSearchResult, ProviderSpaceStatus, type RememberRequest, SOURCES, type SearchRequest, type Source, defineMemorySpaceProvider, defineMemorySpaceProviderDefinition, firstArray, jsonArray, jsonNumber, jsonObject, jsonString, runProcess };