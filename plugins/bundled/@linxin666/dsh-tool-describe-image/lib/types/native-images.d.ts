/**
 * Native-image-request configuration for the DeepSeek adapter (rc.8 feature).
 *
 * The DeepSeek chat-completions adapter accepts image blocks in user
 * messages when the catalogued model's `inputModalities` includes
 * "image"; the official model settings UI does not expose that field, so
 * this plugin (the family's image seam) hosts a loopback route pair that
 * reports the current agent-default route's image-input state and toggles
 * the `llm-deepseek` settings namespace's `models[]` entry for the
 * current model. Writes ride the official settings seam (schema validation,
 * revision fencing, persistence and event emission stay with the host) and
 * are guarded by the same loopback + same-origin fence as the attach
 * routes; the browser never sees or supplies credentials.
 *
 * Fail-closed: a host without the `llm-deepseek` namespace (adapter not
 * mounted), a missing settings seam, or a missing agentDefaultModel service
 * answers `supported: false` and rejects every write.
 * @module @linxin666/dsh-tool-describe-image/native-images
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import { type SettingsNamespace } from '@deepseek-ai/dsh-settings';
import { type InvalidatableRouteResolver, type ModelImageCapability, type RouteCapabilityResolver } from './model-capability.ts';
/** The DeepSeek adapter's settings namespace. */
export declare const LLM_DEEPSEEK_SETTINGS_NAMESPACE: SettingsNamespace;
/** Native-image wire state for the browser half. */
export interface NativeImageState {
    /** The route the toggle operates on (absent when no default selection exists). */
    provider?: string;
    model?: string;
    /** Resolved image-input verdict for the route (same resolver as the send hook). */
    capability: ModelImageCapability;
    /** The catalogued model's inputModalities; absent when not catalogued. */
    inputModalities?: readonly string[];
    /** The adapter namespace is registered and the settings seam is writable. */
    supported: boolean;
}
/**
 * Assemble the read-only state view the browser half renders.
 * @param ctx - registrant context.
 * @param resolver - shared exact-route resolver (same instance as the send hook).
 * @returns the state (async: the route verdict may probe the adapter).
 */
export declare function readNativeImageState(ctx: Context, resolver: RouteCapabilityResolver): Promise<NativeImageState>;
/**
 * Toggle native image input for the current agent-default model: rewrite
 * the adapter catalog entry's `inputModalities` to ["text","image"] (or
 * back to ["text"]) through the official settings seam, fenced by the
 * descriptor's revision so a concurrent edit fails with a conflict instead
 * of clobbering it.
 * @param ctx - registrant context.
 * @param enabled - whether the model should accept image input natively.
 * @throws on an unsupported host, a missing route, or a revision conflict.
 */
export declare function setNativeImageEnabled(ctx: Context, enabled: boolean, resolver?: {
    invalidate(route: {
        provider: string;
        model: string;
    }): void;
}): Promise<void>;
/**
 * Register the native-image route pair. Both routes are loopback-fenced
 * with the same-origin browser markers; failures answer the official-shaped
 * envelope instead of leaking host internals.
 * @param ctx - registrant context.
 * @param resolver - shared exact-route resolver.
 * @returns the exact-path route registrations.
 */
/** Structural shape of one exact-path route (the package types the webserver seam without importing it). */
interface NativeImageRoute {
    kind: 'exact';
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
}
export declare function registerNativeImageRoutes(ctx: Context, resolver: InvalidatableRouteResolver): NativeImageRoute[];
export {};
//# sourceMappingURL=native-images.d.ts.map