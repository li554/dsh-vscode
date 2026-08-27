/**
 * Vision HTTP client for the describe-image tool: loads one image (local path,
 * http(s) URL, or a stored attachment reference), builds the endpoint request that
 * matches the configured protocol style (chat-completions or responses), and reads
 * back the single text answer — with a short-lifetime, capacity-capped semantic
 * cache so repeat calls for the same image and prompt avoid a second round trip.
 * Response bodies and error excerpts are capped before any bytes are trusted.
 * @module @linxin666/dsh-tool-describe-image/vision
 */
import type { Context } from '@deepseek-ai/cordis';
import { type ImageMimeType } from './media.ts';
import type { ResolvedConfig } from './config-resolve.ts';
export { parseImageAttachmentRef } from './attachment-reference.ts';
/** One loaded image: its bytes and the sniffed media type. */
export interface LoadedImage {
    bytes: Buffer;
    mimeType: ImageMimeType;
}
/**
 * Validate a model-supplied attachment reference and read its verified bytes.
 * @param ctx - registrant context carrying the optional attachment service.
 * @param raw - the raw JSON the model copied from an `[image attachment …]` note.
 * @param signal - caller cancellation.
 * @returns the verified stored bytes.
 */
export declare function readAttachment(ctx: Context, raw: string, signal: AbortSignal): Promise<Buffer>;
/**
 * Load one image from a local absolute path, an http(s) URL, a complete durable attachment
 * reference, or the plugin's self-contained Markdown attachment reference, enforcing the byte
 * bound before any bytes reach the vision model. Non-http(s) URL schemes are rejected.
 * @param ctx - registrant context; supplies the optional attachment service.
 * @param input - the model-supplied image reference.
 * @param signal - caller cancellation.
 * @param maxBytes - image byte bound.
 * @param workspace - absolute session workspace root; local file paths must resolve inside it.
 * @returns the loaded bytes and sniffed media type.
 */
export declare function loadImage(ctx: Context, input: string, signal: AbortSignal, maxBytes: number, workspace?: string): Promise<LoadedImage>;
export declare function readBoundedBody(response: Response, cap: number): Promise<Buffer>;
/**
 * Read a response body as text, truncated to a character cap (error excerpts only).
 * @param response - the response to drain.
 * @param cap - the character cap.
 * @returns the decoded text, never longer than `cap` characters.
 */
export declare function readBoundedText(response: Response, cap: number): Promise<string>;
/**
 * Extract the single text answer from an OpenAI-compatible chat-completions
 * payload. Reasoning models (Kimi K2.x and friends) can spend the whole
 * max_tokens budget on the thinking chain and leave `content` empty while the
 * answer lives in `reasoning_content` (issue #637) — fall back to it instead
 * of failing the call outright.
 */
export declare function extractChatCompletionsContent(payload: unknown): string;
/** Extract the text answer from an OpenAI Responses payload: every `output_text` part of assistant messages. */
export declare function extractResponsesContent(payload: unknown): string;
/** Extract the text answer from an Anthropic Messages payload: every `text` content block of the top-level `content` array, skipping `thinking` and other non-text blocks. */
export declare function extractAnthropicMessagesContent(payload: unknown): string;
/**
 * Build the request the configured style sends: its path and JSON body. When the model id carried
 * a thinking suffix, Chat Completions maps it to `thinking.type` (`off` -> `disabled`, every
 * other level -> `enabled`) and Responses forwards it as `reasoning.effort` (`off` ->
 * `none`, levels pass through); without a suffix no thinking control is sent, so the endpoint
 * keeps its own default. The `anthropic-messages` style accepts a provider root, a `/v1` API root,
 * or a complete `/v1/messages` endpoint and posts an Anthropic-style body (`max_tokens`, `messages[0].content` = base64 image block + text).
 */
export declare function buildVisionRequest(spec: ResolvedConfig, prompt: string, image: LoadedImage): {
    path: string;
    body: string;
};
/** Default semantic-cache lifetime for a successful vision answer, in milliseconds. */
export declare const DEFAULT_CACHE_TTL_MS = 10000;
/** Default upper bound on cached vision answers. */
export declare const DEFAULT_CACHE_MAX_ENTRIES = 32;
/** A bounded, TTL-expiring cache of successful vision answers. */
export interface VisionCache {
    /** Look up a cached answer, honoring the TTL. */
    get(key: string): string | undefined;
    /** Store an answer with a fresh TTL, evicting expired and then oldest entries. */
    set(key: string, text: string): void;
    /** Number of live cached answers. */
    readonly size: number;
    /** Running cache hits, for observability and tests. */
    readonly hits: number;
    /** Running cache misses, for observability and tests. */
    readonly misses: number;
    /** Drop every entry. */
    clear(): void;
}
/** Create a TTL-expiring, capacity-capped vision answer cache. */
export declare function createVisionCache(options?: {
    ttlMs?: number;
    maxEntries?: number;
}): VisionCache;
/** The semantic identity of one vision request: endpoint fields plus the same image bytes and prompt. */
export declare function semanticRequestKey(spec: ResolvedConfig, prompt: string, image: LoadedImage): string;
/** Call the configured vision endpoint and return its text answer, with short-lifetime caching for repeats. */
export declare function callVision(spec: ResolvedConfig, apiKey: string, prompt: string, image: LoadedImage, signal: AbortSignal, cache?: VisionCache): Promise<string>;
//# sourceMappingURL=vision-client.d.ts.map