/**
 * Endpoint model probe for the describe-image tool: lists the models a
 * configured vision endpoint serves, doubling as the connectivity and
 * credential check the settings card's probe button runs. A successful list
 * proves the endpoint is reachable and the key authenticates; no completion
 * call is made, so the probe never spends tokens. The key stays on the host —
 * the browser half only reads the returned id list.
 * @module @linxin666/dsh-tool-describe-image/model-probe
 */
import { type ApiStyle, type Config, type ResolvedConfig } from './config-resolve.ts';
/** Probe request timeout: model listings are light, far shorter than a vision call. */
export declare const PROBE_TIMEOUT_MS = 15000;
/** Response-body byte cap for one model listing. */
export declare const PROBE_MAX_BODY_BYTES: number;
/** Model ids returned to the card; beyond this the tail of the listing is dropped. */
export declare const PROBE_MAX_MODELS = 256;
/**
 * Placeholder model id pinned when none is configured yet: the probe lists
 * models precisely so the user can pick one, so an absent model must not
 * block it. The listing request never sends a model id anywhere (the probe
 * makes no completion call); vision calls keep the strict non-empty check.
 */
export declare const PROBE_MODEL_PLACEHOLDER = "probe";
/**
 * The models-listing URL one style hits. The `anthropic-messages` style
 * mirrors the completion-path rule: a provider root gains `/v1/models`, a
 * `/v1` API root gains `/models`, and a complete `/v1/messages` endpoint is
 * rewritten to its sibling. The OpenAI-compatible styles append `/models` to
 * the configured root.
 * @param baseURL - the resolved endpoint root (no trailing slash).
 * @param apiStyle - the protocol style the card is configured for.
 * @returns the absolute listing URL.
 */
export declare function buildModelsUrl(baseURL: string, apiStyle: ApiStyle): string;
/**
 * Extract the model ids from one listing payload. Both the OpenAI shape
 * (`data[].id`) and the Anthropic shape (`data[].id` under a `/v1/models`
 * envelope) carry the id the same way; entries without a non-empty string id
 * are skipped rather than surfaced as blanks.
 * @param payload - the parsed listing body.
 * @returns the ids in listing order, capped at {@link PROBE_MAX_MODELS}.
 */
export declare function extractModelIds(payload: unknown): string[];
/**
 * List the models one resolved configuration's endpoint serves. Throws with a
 * prefixed message on every failure, so the route envelopes one reason the
 * card can surface verbatim.
 * @param spec - the resolved configuration to probe.
 * @param apiKey - the credential the listing authenticates with.
 * @param signal - caller cancellation.
 * @returns the served model ids; an empty list is its own failure.
 */
export declare function probeModels(spec: ResolvedConfig, apiKey: string, signal?: AbortSignal): Promise<string[]>;
/** A caller-supplied key resolver (the route wires the credential seam). */
export type ProbeKeyResolver = (spec: ResolvedConfig) => Promise<string>;
/**
 * The request one model ping sends: the style's completion path with a
 * minimal body (`max_tokens` 1, one short text message), so the round trip
 * exercises the configured model itself — not just the models listing —
 * while spending a single token of output.
 * @param spec - the resolved configuration under test.
 * @returns the absolute ping URL and its JSON body.
 */
export declare function buildModelPingRequest(spec: ResolvedConfig): {
    path: string;
    body: string;
};
/**
 * Ping the configured model once and return the round-trip milliseconds.
 * The completion reply is drained, never parsed: a 2xx proves the endpoint
 * routed the model and answered; every failure throws with a prefixed
 * message the route envelopes.
 * @param spec - the resolved configuration under test.
 * @param apiKey - the credential the ping authenticates with.
 * @param signal - caller cancellation.
 * @returns the ping's round-trip milliseconds.
 */
export declare function testModelConnection(spec: ResolvedConfig, apiKey: string, signal?: AbortSignal): Promise<number>;
/** The model test's outcome: a round-trip latency or one envelope-ready error. */
export type ModelTestOutcome = {
    ok: true;
    latencyMs: number;
} | {
    ok: false;
    error: {
        code: 'rejected' | 'internal';
        message: string;
    };
};
/**
 * Ping the model named by the merged configuration. Unlike the listing, the
 * test requires a model: the overrides carry the card's model draft along
 * with the connection fields, and an absent model is a rejection the card
 * surfaces instead of a silent no-op.
 * @param stored - the settings currently in effect.
 * @param overrides - unsaved drafts from the card (non-string values ignored).
 * @param resolveKey - the credential resolver for the final configuration.
 * @param signal - caller cancellation.
 * @returns the latency, or the structured failure.
 */
export declare function handleModelTest(stored: Config, overrides: Record<string, unknown>, resolveKey: ProbeKeyResolver, signal?: AbortSignal): Promise<ModelTestOutcome>;
/** The probe handler's outcome: a model list or one envelope-ready error. */
export type ModelProbeOutcome = {
    ok: true;
    models: string[];
} | {
    ok: false;
    error: {
        code: 'rejected' | 'internal';
        message: string;
    };
};
/**
 * Run one model probe against a candidate configuration. The overrides carry
 * the settings card's unsaved drafts so the user can verify an endpoint
 * before saving; absent fields fall back to the stored settings. An empty
 * draft key means "keep the current key": the stored inline key is dropped
 * so the credential seam re-resolves, matching how a vision call resolves
 * its key. Only the connection fields a probe can change are honored; every
 * other draft stays with the stored settings.
 * @param stored - the settings currently in effect.
 * @param overrides - unsaved drafts from the card (non-string values ignored).
 * @param resolveKey - the credential resolver for the final configuration.
 * @param signal - caller cancellation.
 * @returns the listing, or the structured failure.
 */
export declare function handleModelProbe(stored: Config, overrides: Record<string, unknown>, resolveKey: ProbeKeyResolver, signal?: AbortSignal): Promise<ModelProbeOutcome>;
//# sourceMappingURL=model-probe.d.ts.map