/**
 * Per-session visibility of the describe_image tool. The plugin serves
 * text-only models: a model whose adapter declares image input sees its
 * images natively, so the describe_image tool must not appear in its
 * toolset — the model neither sees nor can call it (a nested run_code SDK
 * dispatch is denied as UNKNOWN_TOOL too). Text-only and not-yet-known
 * sessions keep the global registration untouched.
 *
 * The verdict rides the same route chain the capability probe uses — the
 * session's logged request route, then the agentDefaultModel selection — so
 * the two seams can never disagree (raw image blocks always pair with a
 * hidden tool, the rewrite always pairs with a visible one). The verdict is
 * applied through the tools service's per-agent restriction mask:
 * `agent.ctx.tools.restrict({ deny: ['describe_image'] })`. Each request
 * re-resolves the exact route and corrects the mask, and a change to the
 * agent-default-model settings (the wire's session.selectModel persists
 * there) re-runs the resting evaluation for every live agent, so a model
 * picked for a fresh session hides the tool from its very first turn.
 * @module @linxin666/dsh-tool-describe-image/tool-visibility
 */
import { optionalService } from "./model-capability.js";
/** The model-facing tool name this controller masks. */
const DESCRIBE_IMAGE_TOOL = 'describe_image';
/** The settings namespace the wire's session.selectModel persists into. */
const AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE = 'agent-default-model';
/** The session's resting route: its logged request config, else the default selection. */
function restingRoute(ctx, agent) {
    const logged = agent.session?.requestHeader?.()?.config;
    if (typeof logged?.provider === 'string' && logged.provider !== '' && typeof logged.model === 'string' && logged.model !== '') {
        return { provider: logged.provider, model: logged.model };
    }
    const fallback = optionalService(ctx, 'agentDefaultModel')?.currentSelection();
    if (typeof fallback?.provider === 'string' && fallback.provider !== '' && typeof fallback.model === 'string' && fallback.model !== '') {
        return { provider: fallback.provider, model: fallback.model };
    }
    return undefined;
}
/**
 * Install the per-session tool-visibility controller. Multimodal sessions
 * have describe_image masked from their toolset; every other session keeps
 * the tool. The mask follows the shared route verdict: applied at
 * agent/created (so a fresh or resumed session is right from its first
 * request), re-applied on every agent/request (the exact route of the
 * running request), and re-evaluated on agent-default-model changes (a model
 * picked for a fresh session must hide the tool from turn one). All
 * wiring failures are contained — visibility is advisory, and the send hook
 * independently guards image delivery.
 * @param ctx - registrant context; the listeners unwind with the plugin.
 * @param resolveRoute - shared exact-route resolver (same instance as the capability probe).
 */
export function installToolVisibility(ctx, resolveRoute) {
    /** Per-agent verdict: true = session model accepts image input (tool masked). */
    const verdicts = new Map();
    /** Per-agent restriction disposers: lift the mask when the verdict flips. */
    const restrictions = new Map();
    const applyVerdict = (agent, acceptsImages) => {
        if (verdicts.get(agent.id) === acceptsImages)
            return;
        verdicts.set(agent.id, acceptsImages);
        const previous = restrictions.get(agent.id);
        previous?.();
        restrictions.delete(agent.id);
        if (!acceptsImages)
            return;
        const tools = agent.ctx.tools;
        if (tools?.restrict === undefined)
            return;
        try {
            restrictions.set(agent.id, tools.restrict({ deny: [DESCRIBE_IMAGE_TOOL] }));
        }
        catch {
            // The tool is not visible in the global layer (another plugin removed
            // it): there is nothing to mask, and the deny would only have hidden
            // the rewrite path's reader. Leave the session unrestricted.
        }
    };
    const clearVerdict = (agentId) => {
        verdicts.delete(agentId);
        restrictions.get(agentId)?.();
        restrictions.delete(agentId);
    };
    const evaluateResting = (agent) => {
        const route = restingRoute(ctx, agent);
        if (route === undefined)
            return;
        void resolveRoute(route).then((capability) => applyVerdict(agent, capability.acceptsImages));
    };
    ctx.on('agent/created', ({ agent }) => {
        evaluateResting(agent);
    });
    ctx.on('agent/disposed', ({ agent }) => {
        clearVerdict(agent.id);
    });
    ctx.on('agent/request', async (payload, next) => {
        const resolved = await next();
        // The exact route of the running request; the mask flips for the next
        // request's toolset (the current one was assembled before the waterfall).
        void resolveRoute({ provider: resolved.provider, model: resolved.model })
            .then((capability) => applyVerdict(payload.agent, capability.acceptsImages));
        return resolved;
    });
    ctx.on('settings/updated', (namespace) => {
        if (namespace !== AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE)
            return;
        // A model selection moved somewhere: fresh sessions (no logged route)
        // re-derive their verdict from the new default, so a model picked before
        // the first message hides the tool from turn one. Sessions with a logged
        // route keep it until the next request records the exact route.
        const agents = optionalService(ctx, 'agents');
        for (const agent of agents?.list() ?? [])
            evaluateResting(agent);
    });
}
