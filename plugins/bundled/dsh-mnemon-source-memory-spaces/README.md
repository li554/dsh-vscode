# dsh-mnemon-source-memory-spaces

Memory Spaces owns its Provider contracts and private child-Fiber host. Provider authors depend on `dsh-mnemon-source-memory-spaces/provider-sdk`, never on the main repository's controllers or global registry.

The Source owns its storage registry, scoped native command transport, recall policy, routing, receipts and management operations. It imports **no Provider implementation** and defines no extra Context service. Each mount defaults to a separate data directory; set `dataDir` explicitly to select an existing authority.

A **memory space** (中文：**记忆空间**) is one named Provider-backed scope containing individual memories. Use the canonical `MemorySpace`, `MemorySpaceView`, `MemorySpaceCatalog`, and `CreateMemorySpaceRequest` types from `./contracts`; `MemoryBody*` exports remain deprecated aliases for existing consumers. The Provider SDK exposes `MemorySpace` and `ProviderSpaceStatus` while retaining its old type aliases. Provider factories can use `context.memorySpaces ?? context.memoryBodies` to support both new and existing Source hosts. Published wire fields, registry filenames, and stored user names remain unchanged. `./contracts` also exports the Mnemon Native Provider's id, `NATIVE_PROVIDER_ID`, with `isNativeProvider()`, and the limits on a space's name and routing description, `MEMORY_SPACE_NAME_MAX_LENGTH` and `MEMORY_SPACE_DESCRIPTION_MAX_LENGTH`.

Install the chosen Provider packages and configure them explicitly on the Source entry:

```yaml
name: dsh-mnemon-source-memory-spaces
config:
  dataDir: /absolute/path/to/memory
  providers:
    - use: dsh-mnemon-provider-holographic
      instanceId: local-facts
```

The host must already provide `ctx.mnemonMemory`; a Strategy decides how this Source enters the LLM View. For programmatic composition, import `installMemorySpaces` and pass explicit typed child modules. It returns `Promise<void>`; no private Host or Snapshot escapes. Omitting the child list is an error, not automatic dependency discovery. The default `dsh-mnemon` bundle supplies the existing nine Providers and existing storage settings separately.

Host archive workflows can read `body-directory` with `{ writeScope: { viewId, grant } }`, using `MemorySpaceWriteScopeRequest` from `./contracts`. The optional catalog `writeScope` returns the View id, exact Source instance and authorized `memoryBodyIds`; it shares `remember` authority for known namespaces and spaces created by that View. Empty scopes remain empty. The Host must bind the input to its initiating View and Source, validate the response identity, and recheck live capabilities before writing. Older Sources that omit the response require a conservative pinned-namespace fallback; read grants must never be interpreted as unlimited authority.

Run `pnpm install && pnpm verify` in this directory. Its own tests mount real Cordis Fibers and exercise Source isolation, scoped management, View actions/routes, persistence and failed-child cleanup. Provider authors use `mountMemorySpaceProvider(module, { instanceId, config })` from the public `/testing` entry to test actual child registration and obtain frozen metadata plus `createAdapter`/`dispose`. `createMemorySpaceProviderFixture` supplies scoped authority and validated connection data for driver tests. Dispose the mounted fixture to release its adapters and Fiber. Neither fixture exposes the private Host, Registry or Snapshot; test the full Source separately for View integration.

## Storage files

The `./contracts` entry names the Native layout under a storage root (`data/<space id>/mnemon.db`, the `data/.dsh-memory-bodies.json` registry, Mnemon's `active` store selection and `state/memory-providers.json`) and exports `parseMemorySpaceRegistry` and the counts a storage inventory shows. The Node-only `./space-identity` entry compares two copies of a Mnemon store by what they hold rather than by their bytes, and merges them. It reads stores with `node:sqlite`, which Node has from 22.13; on an older Node it compares bytes. The `dsh-mnemon` Starter's backup and sync use both, and its storage inventory uses the counts, instead of keeping copies.

## Configuration ownership

The public package entry exports `resolveEmbedding`, `resolvePersistenceStrategy`, and `resolveRecallQuality`. They validate and normalize this Source's settings without I/O or mounting a Fiber. The Starter uses the same rules and recall defaults; it still owns legacy setting keys, storage scope, and its Host timeout policy. Independent Source configuration retains its own instance defaults and timeout limits.

The `./contracts` entry exports `MEMORY_PLACEMENT_CAPABILITIES`, the capabilities a persistence strategy's rules may require of a Provider, from which the `MemoryPlacementCapability` type is derived. `resolvePersistenceStrategy` accepts exactly these, and the Starter's settings schema takes the same list.

## Source-owned Client

The optional `./client` entry owns the Source's pages, its settings on its page under Plugins (the Providers and the embedding Mnemon Native reads) and `presentation/` resources. It uses `dsh-mnemon/client` for the shared frame, scoped management and the configuration and Host operations dsh-mnemon lends its settings, without receiving raw RPC transport, credentials, a Host Context or an LLM grant. DSH mounts the same pages in the default Starter; cross-Source Agent workflows remain optional Host assistance. dsh-mnemon 0.5.31 and earlier draw these settings themselves, so with them the client registers none.

`pnpm verify` checks Host behavior, real Source-backed page interactions, and Host/browser artifacts. Client tests consume the installed Core's public testing entry.

[Plugin development](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/en/development/extensions.md) · [中文指南](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/development/extensions.md)
