/**
 * Model image-input capability probe. The describe-image send hook rewrites
 * image-bearing sends into attachment references for text-only models; a
 * model whose adapter declares the image input modality must receive the raw
 * image blocks instead, or its native vision is bypassed and every pasted
 * image forces a redundant describe_image call. The browser half cannot see
 * model metadata, so the host answers per session through the
 * /describe-image/capability route.
 *
 * The session's effective model is resolved from, in order: the session's own
 * logged request route (the exact config the loop assembled, so resumed
 * sessions keep their model), then the agentDefaultModel service (what a
 * fresh session with no requests yet will run). Seeded agent options are
 * deliberately NOT consulted: they are a creation-time snapshot that stops
 * matching the selection once the user picks a different model, and a wrong
 * "accepts images" guess hands raw image blocks to a model the host then
 * rejects (MODEL_DOES_NOT_SUPPORT_IMAGES) — the very failure this plugin
 * exists to route around. Modalities come from the owning adapter's exact
 * model metadata; an adapter that reports none is "unknown" and every
 * failure resolves conservative — acceptsImages false keeps the legacy
 * rewrite, so a probe failure can never strip images from a text-only
 * model's reach.
 * @module @linxin666/dsh-tool-describe-image/model-capability
 */
import type { Context } from '@deepseek-ai/cordis';
/** One session's image-input verdict. */
export interface ModelImageCapability {
    /** True only when the adapter positively declares image input for the route. */
    acceptsImages: boolean;
    /** False when the route or its modalities could not be determined. */
    known: boolean;
}
/** The conservative answer: unknown means "keep the legacy rewrite". */
export declare const UNKNOWN_CAPABILITY: ModelImageCapability;
/** Provider/model pair one session's requests run under. */
export interface ModelRoute {
    provider: string;
    model: string;
}
/** Resolve one exact route's image-input capability; every failure fails closed to {@link UNKNOWN_CAPABILITY}. */
export type RouteCapabilityResolver = (route: ModelRoute) => Promise<ModelImageCapability>;
/** A resolver that can also drop its cached verdict (the native-image toggle uses it). */
export type InvalidatableRouteResolver = RouteCapabilityResolver & {
    invalidate(route: ModelRoute): void;
};
/** Read an optional, possibly untyped cordis service by name. */
export declare function optionalService<T>(ctx: Context, name: string): T | undefined;
/**
 * Create the shared exact-route resolver: model-metadata resolutions cached
 * per route (successes for ten minutes, failures for thirty seconds,
 * in-flight calls deduped). Both the capability probe and the tool-visibility
 * controller resolve through one instance so a session's verdict is
 * consistent across the two seams.
 * @param ctx - registrant context carrying the optional llm service.
 * @returns the route-keyed resolver.
 */
export declare function createRouteResolver(ctx: Context): InvalidatableRouteResolver;
/** Probe one session's image-input capability; every failure fails closed to {@link UNKNOWN_CAPABILITY}. */
export type CapabilityProbe = (sessionId: string) => Promise<ModelImageCapability>;
/**
 * Create the per-mount probe. The session's model comes from its own logged
 * request route (the exact config the loop assembled, so a session resumed
 * with a history keeps the model it was running), then the agentDefaultModel
 * service (a fresh session with no requests yet runs the current default
 * selection). A session that resolves no route at all answers unknown,
 * keeping the always-safe rewrite.
 * @param ctx - registrant context carrying the optional agents and agentDefaultModel services.
 * @param resolver - shared exact-route resolver (defaults to a private one).
 * @returns the session-id-keyed probe.
 */
export declare function createCapabilityProbe(ctx: Context, resolver?: RouteCapabilityResolver): CapabilityProbe;
//# sourceMappingURL=model-capability.d.ts.map