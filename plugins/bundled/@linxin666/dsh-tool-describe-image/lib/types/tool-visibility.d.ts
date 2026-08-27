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
import type { Context } from '@deepseek-ai/cordis';
import type { RouteCapabilityResolver } from './model-capability.ts';
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
export declare function installToolVisibility(ctx: Context, resolveRoute: RouteCapabilityResolver): void;
//# sourceMappingURL=tool-visibility.d.ts.map