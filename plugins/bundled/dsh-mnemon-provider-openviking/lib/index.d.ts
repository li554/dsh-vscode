import { descriptor } from "./descriptor.js";
import { Insight, JsonValue, MemoryBody, MemoryGraphSnapshot, MemoryListRequest, MemoryProviderAdapter, MemoryProviderConnection, MemorySpaceAuthority, ProviderBodyStatus, ProviderMemorySpace, ProviderSearchResult, RememberRequest, SearchRequest } from "dsh-mnemon-source-memory-spaces/provider-sdk";
//#region src/driver.d.ts
interface OpenVikingProviderOptions {
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
}
declare class OpenVikingProvider implements MemoryProviderAdapter {
  private readonly memorySpaces;
  readonly id: "openviking";
  readonly scoreSemantics: Readonly<{
    kind: "provider-native";
  }>;
  private readonly requestFetch;
  private readonly requestTimeoutMs;
  constructor(memorySpaces: MemorySpaceAuthority, options?: OpenVikingProviderOptions);
  discover(connection: MemoryProviderConnection, signal?: AbortSignal): Promise<ProviderMemorySpace[]>;
  status(body: MemoryBody, signal?: AbortSignal): Promise<ProviderBodyStatus>;
  search(body: MemoryBody, request: SearchRequest, signal?: AbortSignal): Promise<ProviderSearchResult>;
  graph(body: MemoryBody, signal?: AbortSignal): Promise<MemoryGraphSnapshot>;
  list(body: MemoryBody, request: MemoryListRequest, signal?: AbortSignal): Promise<Insight[]>;
  /**
   * Each listed memory with its full content, leaving out one the server cannot read: its index
   * can still list a file it no longer holds. When none can be read, the first failure is the
   * answer, so a server that cannot be reached is never shown as an empty space, and a cancelled
   * turn stops at once.
   */
  private readAll;
  remember(body: MemoryBody, request: RememberRequest, signal?: AbortSignal): Promise<JsonValue>;
  /**
   * Label a verified memory. Tags only describe it - its category is in the URI too - so a server
   * without the endpoint, one that refuses or does not confirm the call, or one that is slow to
   * answer leaves an exact memory that is just untagged. The wait is short, as for `/health`:
   * the receipt is already true.
   */
  private tag;
  forget(body: MemoryBody, id: string, signal?: AbortSignal): Promise<JsonValue>;
  private connection;
  private validateUserNamespace;
  private memoryRoot;
  private readContent;
  private request;
  private requestConnection;
}
//#endregion
//#region src/index.d.ts
declare const definition: import("dsh-mnemon-source-memory-spaces/provider-sdk").MemorySpaceProviderDefinition;
declare const _default: import("dsh-mnemon-source-memory-spaces/provider-sdk").MemorySpaceProviderModule<undefined>;
//#endregion
export { OpenVikingProvider, _default as default, definition, descriptor };