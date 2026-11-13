# dsh-mnemon-source-runtime

Owns USER / MEMORY records, exact revisions, branch filtering, bounded projection and local capacity maintenance.

## Use

The `dsh-mnemon` Starter installs and mounts this Source by default. The package alone does not activate an instance or select a Strategy.

For a custom Profile, mount an explicit Entry after the Host's `ctx.mnemonMemory` service is available:

```yaml
- id: personal-runtime
  name: dsh-mnemon-source-runtime
  config:
    dataDir: /absolute/path/to/personal-memory
```

Choose an existing data authority deliberately. Without `dataDir`, each stable Source instance uses an isolated directory under `~/.mnemon/sources/`; the default Starter supplies the existing product paths. Replacing the default Source or adding a second instance requires an explicit selection Strategy, not a second implicit default role.

Disabling participation does not delete stored entries. Source data remains separate from the current turn's projection and access grants.

Model projections omit default `importance=normal` and whole-day ages of `0d`; they annotate entries only when non-default fields remain, for example `[importance=critical; created=14d; updated=2d]`, followed by the exact content. Future timestamps show `future`; unparseable ones show `unknown`. Ages are captured once per projection and remain fixed for that turn. Annotations count toward the Strategy's projection budget, but do not change stored JSON/Markdown, content matching or storage capacity. For replacement/removal, use only the entry content. Current instructions retain priority. Model-facing text omits revision hashes and quota/count statistics, while the Source protocol and management/UI retain them. File boundaries and all visible content remain; no low-importance entry is automatically hidden.

## Storage files

The `./contracts` entry names this Source's files under a storage root (`runtime/memories.json`, `USER.md`, `MEMORY.md`, the `.memories.lock` lock and the `archived/` local archive) and exports the rules a copy of them follows: `runtimeProjection` and `runtimeBytes` write and count USER.md and MEMORY.md exactly as the controller does, and `summarizeRuntimeMemories` counts a stored file for an inventory. They are pure and browser-safe. The `dsh-mnemon` Starter's backup, sync and storage inventory use them instead of keeping copies.

The same entry exports the size limits the configuration and the controller apply: `RUNTIME_MEMORY_LIMITS`, the default limit of USER.md and of MEMORY.md, and `RUNTIME_MEMORY_LIMIT_MAX_BYTES`, the largest limit either may be given. The Starter's settings take their defaults and bounds from them.

## Source-owned UI and tests

The optional `./client` entry is an ordinary DSH Client plugin. This package owns its pages and `presentation/` resources and uses `dsh-mnemon/client` for the shared frame and scoped management client. It never receives a Host Context, credentials or another Source's controller.

From a source checkout, install the declared dependencies and run `pnpm verify` to check Host behavior, Source-backed page interactions and Host/browser artifacts. Unreleased SDK work consumes a packed `dsh-mnemon` peer, not repository aliases or copied root tests.

[Plugin development](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/en/development/extensions.md) · [中文指南](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/development/extensions.md)
