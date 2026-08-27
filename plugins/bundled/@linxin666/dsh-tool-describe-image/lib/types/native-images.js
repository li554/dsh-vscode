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
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { isLoopbackRequest } from "./loopback.js";
import { readJsonBody, writeJson } from "./http.js";
import { optionalService, UNKNOWN_CAPABILITY } from "./model-capability.js";
/** The DeepSeek adapter's settings namespace. */
export const LLM_DEEPSEEK_SETTINGS_NAMESPACE = settingsNamespace('llm-deepseek');
/** Resolve the adapter namespace descriptor (undefined when unregistered). */
function adapterDescriptor(settings) {
    if (settings === undefined)
        return undefined;
    const descriptor = settings.describe({ redactSecrets: true })
        .find((candidate) => String(candidate.ns) === String(LLM_DEEPSEEK_SETTINGS_NAMESPACE));
    if (descriptor === undefined)
        return undefined;
    if (settings.writable === false)
        return undefined;
    return { value: descriptor.value, revision: descriptor.revision };
}
/** The catalogued modalities of one model, or undefined when absent. */
function cataloguedModalities(descriptor, model) {
    const value = descriptor?.value;
    const models = Array.isArray(value?.models) ? value.models : [];
    const entry = models.find((candidate) => candidate.id === model);
    if (entry === undefined || !Array.isArray(entry.inputModalities))
        return undefined;
    return entry.inputModalities.filter((item) => typeof item === 'string');
}
/** The current agent-default route (absent when no selection exists). */
function currentRoute(ctx) {
    const selection = optionalService(ctx, 'agentDefaultModel')?.currentSelection();
    if (typeof selection?.provider !== 'string' || selection.provider === '' || typeof selection.model !== 'string' || selection.model === '') {
        return undefined;
    }
    return { provider: selection.provider, model: selection.model };
}
/**
 * Assemble the read-only state view the browser half renders.
 * @param ctx - registrant context.
 * @param resolver - shared exact-route resolver (same instance as the send hook).
 * @returns the state (async: the route verdict may probe the adapter).
 */
export async function readNativeImageState(ctx, resolver) {
    const route = currentRoute(ctx);
    const descriptor = adapterDescriptor(optionalService(ctx, 'settings'));
    const capability = route === undefined ? UNKNOWN_CAPABILITY : await resolver(route);
    return {
        ...(route === undefined ? {} : { provider: route.provider, model: route.model }),
        capability,
        ...(route === undefined ? {} : {
            inputModalities: cataloguedModalities(descriptor, route.model),
        }),
        supported: descriptor !== undefined && route !== undefined,
    };
}
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
export async function setNativeImageEnabled(ctx, enabled, resolver) {
    const route = currentRoute(ctx);
    if (route === undefined)
        throw new Error('native-images: no agent default model selection');
    const settings = optionalService(ctx, 'settings');
    const descriptor = adapterDescriptor(settings);
    if (descriptor === undefined || settings === undefined) {
        throw new Error('native-images: the llm-deepseek settings namespace is not available');
    }
    const value = descriptor.value;
    const models = Array.isArray(value?.models) ? value.models : [];
    const index = models.findIndex((entry) => entry.id === route.model);
    const modalities = enabled ? ['text', 'image'] : ['text'];
    const next = models.map((entry) => entry);
    if (index === -1) {
        next.push({ id: route.model, inputModalities: modalities });
    }
    else {
        next[index] = { ...next[index], inputModalities: modalities };
    }
    await settings.mutate(LLM_DEEPSEEK_SETTINGS_NAMESPACE, [
        { op: 'set', path: ['models'], value: next },
    ], descriptor.revision);
    // Drop the cached capability verdict so the next read (and the POST
    // envelope) reflects the catalog just written.
    resolver?.invalidate(route);
}
export function registerNativeImageRoutes(ctx, resolver) {
    const guard = (req, res) => {
        if (!isLoopbackRequest(req)) {
            writeJson(res, 403, { ok: false, code: 'forbidden', message: 'loopback only' });
            return false;
        }
        return true;
    };
    return [
        {
            kind: 'exact',
            path: '/describe-image/native-images',
            handler: async (req, res) => {
                if (!guard(req, res))
                    return;
                if (req.method !== 'GET' && req.method !== 'POST') {
                    writeJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'method not allowed: ' + (req.method ?? '') });
                    return;
                }
                if (req.method === 'GET') {
                    writeJson(res, 200, { ok: true, value: await readNativeImageState(ctx, resolver) });
                    return;
                }
                const body = await readJsonBody(req, { maxBytes: 4096 });
                if (body === null || typeof body !== 'object' || typeof body.enabled !== 'boolean') {
                    writeJson(res, 400, { ok: false, code: 'bad-request', message: 'native-images: expected { enabled: boolean }' });
                    return;
                }
                try {
                    await setNativeImageEnabled(ctx, body.enabled, resolver);
                    writeJson(res, 200, { ok: true, value: await readNativeImageState(ctx, resolver) });
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    writeJson(res, /revision|conflict/i.test(message) ? 409 : 400, { ok: false, code: 'settings-rejected', message });
                }
            },
        },
    ];
}
