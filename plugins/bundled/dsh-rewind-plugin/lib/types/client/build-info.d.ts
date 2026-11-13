/**
 * dsh-rewind client build identity.
 *
 * Two constants are injected by `scripts/build.mjs` at esbuild time (see the
 * `define` block there) and are NOT present in the source. They answer the
 * "am I even running the fixed bundle?" question — the most common, cheapest
 * root cause to rule in/out when a report lands:
 *   - `__DSH_REWIND_VERSION__` — the plugin version from `package.json`.
 *   - `__DSH_REWIND_BUILD__`   — a short content hash of the client source.
 *
 * They are read once at module load and surfaced (behind the existing
 * `dsh-rewind.debug` switch, never a new key) by `apply` in `index.ts`.
 *
 * @module dsh-rewind/client/build-info
 */
/** Plugin version baked in at build time (from `package.json`). */
export declare const PLUGIN_VERSION: string;
/**
 * The bundle's package name — one identity for the client entry id, the
 * `plugins.bundle.config` key and the `<style data-plugin>` marker the
 * harness's owned-style fallback matches; a test pins it to `package.json`.
 */
export declare const PLUGIN_PACKAGE = "dsh-rewind-plugin";
/** Short content hash of the client source, for stale-bundle detection. */
export declare const BUILD_HASH: string;
