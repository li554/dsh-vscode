/**
 * Browser half of the capability seam: asks the host whether one session's
 * effective model accepts image input, so the send hook can hand raw image
 * blocks to vision-capable models instead of rewriting every image-bearing
 * send into describe-image references. Answers are cached briefly per session
 * (a mid-session model switch settles within the TTL), in-flight fetches are
 * deduped, and every failure answers false — the conservative value that
 * keeps the legacy rewrite for the text-only models this plugin serves.
 * @module @linxin666/dsh-tool-describe-image/client/capability
 */
/** The host capability endpoint, same-origin with the web shell. */
export declare const CAPABILITY_ENDPOINT = "/describe-image/capability";
/** Default per-session answer cache lifetime, in milliseconds. */
export declare const DEFAULT_CAPABILITY_TTL_MS: number;
/** Default probe fetch timeout, in milliseconds; a stalled host must not stall a send. */
export declare const DEFAULT_CAPABILITY_TIMEOUT_MS = 1500;
/** Tuning knobs for {@link createImageCapabilityChecker}. */
export interface ImageCapabilityCheckerOptions {
    /** Per-session cache lifetime (default {@link DEFAULT_CAPABILITY_TTL_MS}). */
    ttlMs?: number;
    /** Fetch timeout (default {@link DEFAULT_CAPABILITY_TIMEOUT_MS}). */
    timeoutMs?: number;
}
/**
 * Fetch one session's verdict from the host route. True only on an explicit
 * acceptsImages-true envelope; network failures, bad envelopes, and unknowns
 * all answer false (keep the legacy rewrite).
 * @param sessionId - the session whose model is probed.
 * @param timeoutMs - fetch timeout in milliseconds.
 * @returns whether the model accepts raw image blocks.
 */
export declare function fetchSessionAcceptsImages(sessionId: string, timeoutMs?: number): Promise<boolean>;
/**
 * Create the send-hook's capability checker: per-session cached, in-flight
 * deduped, fail-closed. Sessions without a readable id answer false.
 * @param options - cache and timeout tuning.
 * @returns an async predicate over the structural session face.
 */
export declare function createImageCapabilityChecker(options?: ImageCapabilityCheckerOptions): (session: unknown) => Promise<boolean>;
//# sourceMappingURL=capability.d.ts.map