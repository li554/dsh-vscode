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
/** The conservative answer: unknown means "keep the legacy rewrite". */
export const UNKNOWN_CAPABILITY = { acceptsImages: false, known: false };
/** Per-route metadata cache TTL: adapter model facts do not drift mid-process. */
const ROUTE_OK_TTL_MS = 10 * 60 * 1000;
/** Failed resolutions retry sooner: a cold adapter may come up later. */
const ROUTE_ERR_TTL_MS = 30 * 1000;
/** A hung adapter interrogation must never stall a send. */
const RESOLVE_TIMEOUT_MS = 3000;
/** Read an optional, possibly untyped cordis service by name. */
export function optionalService(ctx, name) {
    return ctx.get.call(ctx, name);
}
/**
 * Create the shared exact-route resolver: model-metadata resolutions cached
 * per route (successes for ten minutes, failures for thirty seconds,
 * in-flight calls deduped). Both the capability probe and the tool-visibility
 * controller resolve through one instance so a session's verdict is
 * consistent across the two seams.
 * @param ctx - registrant context carrying the optional llm service.
 * @returns the route-keyed resolver.
 */
export function createRouteResolver(ctx) {
    const routeCache = new Map();
    const routeInflight = new Map();
    const resolver = (async (route) => {
        const key = route.provider + '/' + route.model;
        const hit = routeCache.get(key);
        if (hit !== undefined && Date.now() - hit.at < (hit.cap.known ? ROUTE_OK_TTL_MS : ROUTE_ERR_TTL_MS))
            return hit.cap;
        const pending = routeInflight.get(key);
        if (pending !== undefined)
            return pending;
        const task = (async () => {
            const llm = optionalService(ctx, 'llm');
            if (llm === undefined || typeof llm.resolveModelInfo !== 'function')
                return UNKNOWN_CAPABILITY;
            let timer;
            try {
                const info = await Promise.race([
                    llm.resolveModelInfo(route.provider, route.model),
                    new Promise((_, reject) => {
                        timer = setTimeout(() => reject(new Error('resolveModelInfo timed out')), RESOLVE_TIMEOUT_MS);
                    }),
                ]);
                const modalities = info.inputModalities;
                // Absent modalities mean the adapter disclosed nothing; only an
                // explicit 'image' entry is positive capability.
                if (modalities === undefined)
                    return UNKNOWN_CAPABILITY;
                return { acceptsImages: modalities.includes('image'), known: true };
            }
            catch {
                return UNKNOWN_CAPABILITY;
            }
            finally {
                clearTimeout(timer);
            }
        })();
        routeInflight.set(key, task);
        try {
            const cap = await task;
            routeCache.set(key, { at: Date.now(), cap });
            return cap;
        }
        finally {
            routeInflight.delete(key);
        }
    });
    // The native-image toggle rewrites the adapter catalog: a cached verdict
    // must not survive the write, or the UI (and the send hook) keep the old
    // capability for up to the success TTL after every toggle.
    resolver.invalidate = (route) => {
        routeCache.delete(route.provider + '/' + route.model);
    };
    return resolver;
}
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
export function createCapabilityProbe(ctx, resolver = createRouteResolver(ctx)) {
    return async (sessionId) => {
        const logged = optionalService(ctx, 'agents')?.get(sessionId)?.session?.requestHeader?.()?.config;
        if (typeof logged?.provider === 'string' && logged.provider !== '' && typeof logged.model === 'string' && logged.model !== '') {
            return resolver({ provider: logged.provider, model: logged.model });
        }
        const fallback = optionalService(ctx, 'agentDefaultModel')?.currentSelection();
        if (typeof fallback?.provider === 'string' && fallback.provider !== '' && typeof fallback.model === 'string' && fallback.model !== '') {
            return resolver({ provider: fallback.provider, model: fallback.model });
        }
        return UNKNOWN_CAPABILITY;
    };
}
