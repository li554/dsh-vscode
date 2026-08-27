/**
 * Browser half of the model probe: the settings card's connectivity check.
 * Posts the card's unsaved connection drafts to the host /describe-image/models
 * route; the host resolves the key through the credential seam (the key never
 * crosses into the browser), lists the endpoint's models, and returns only the
 * id list — a success doubles as the connectivity and credential check.
 * @module @linxin666/dsh-tool-describe-image/client/model-probe
 */
/** The host model-probe endpoint, same-origin with the web shell. */
export declare const MODELS_ENDPOINT = "/describe-image/models";
/** The host model-test endpoint: one minimal completion ping of the selected model. */
export declare const MODEL_TEST_ENDPOINT = "/describe-image/models/test";
/** The connection drafts one probe sends; empty strings fall back to the stored settings. */
export interface ModelProbeDraft {
    baseURL: string;
    apiStyle: string;
    apiKey: string;
}
/**
 * Ask the host to list the configured endpoint's models. The drafts ride the
 * body so an unsaved endpoint can be verified before saving; the host owns
 * validation, key resolution, and the upstream call.
 * @param draft - the card's current connection drafts.
 * @returns the served model ids, or a structured rejection.
 */
export declare function fetchEndpointModels(draft: ModelProbeDraft): Promise<{
    ok: true;
    models: string[];
} | {
    ok: false;
    message: string;
}>;
/**
 * Ping the selected model through the host test route: one minimal
 * completion call (`max_tokens` 1) whose round-trip latency is the model's
 * own first-response time — not the models listing's. The host owns key
 * resolution and the upstream call; the browser receives only the latency.
 * @param draft - the card's connection drafts plus the selected model id.
 * @returns the round-trip milliseconds, or a structured rejection.
 */
export declare function testEndpointModel(draft: ModelProbeDraft & {
    model: string;
}): Promise<{
    ok: true;
    latencyMs: number;
} | {
    ok: false;
    message: string;
}>;
//# sourceMappingURL=model-probe.d.ts.map