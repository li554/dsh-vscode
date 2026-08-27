/**
 * The /describe-image/attach route: a browser-to-host upload seam that turns a
 * picked image into a durable attachment reference and returns both its
 * `[image attachment ...]` note and self-contained Markdown reference. The
 * Markdown carries immutable metadata, so a text-only model can pass it intact
 * to describe_image after a restart or from a PTC nested tool call; image bytes
 * never cross into the conversation log and remain in the attachment store.
 *
 * The route works without any plugin configuration (the family aggregate mounts
 * this way): the byte bound falls back to the default and the attachment store
 * is resolved per call, failing with a clear message when it is absent.
 * @module @linxin666/dsh-tool-describe-image/attach
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { attachmentMarkdown as renderAttachmentMarkdown } from './attachment-reference.ts';
import { type ImageMimeType } from './media.ts';
import { type CapabilityProbe } from './model-capability.ts';
import { type ProbeKeyResolver } from './model-probe.ts';
import type { Config } from './config-resolve.ts';
export { renderAttachmentMarkdown as attachmentMarkdown };
/** Request-body byte cap for the default image bound (kept for docs/tests). */
export declare const MAX_ATTACH_BODY_BYTES: number;
/**
 * JSON request-body cap for one attach: base64 of a `maxBytes` image
 * inflates to ~4/3 its byte length, plus JSON envelope slack. Scaling it with
 * the configured image bound (not a fixed 16 MiB) keeps a higher configured
 * maxBytes usable — a fixed cap silently rejected any image whose base64
 * exceeded it.
 */
export declare function attachBodyCap(maxBytes: number): number;
/** Stable error codes the browser half surfaces without leaking internals. */
export interface AttachError {
    /** `rejected`: the image or payload fails validation; `internal`: the route or store failed. */
    code: 'rejected' | 'internal';
    message: string;
}
/** Validated upload payload. */
export interface AttachPayload {
    /** Base64-encoded image bytes (standard alphabet). */
    data: string;
    /** Media type the sender declares; verified against magic bytes. */
    mediaType: ImageMimeType;
    /** Optional display name; never interpreted as a path. */
    name?: string;
}
/** Outcome of one attach attempt. */
export type AttachOutcome = {
    ok: true;
    ref: ImageAttachmentRef;
    note: string;
    markdown: string;
} | {
    ok: false;
    error: AttachError;
};
/** The failure envelope used when a non-POST request hits the route. */
export declare const METHOD_NOT_ALLOWED: AttachError;
/** Remember one persisted reference by its attachment id. */
export declare function registerAttachmentRef(ref: ImageAttachmentRef): void;
/** Look up a persisted reference by its bare attachment id, if still in the registry. */
/** decodeURIComponent that returns null instead of throwing on malformed input. */
export declare function safeDecodeUriComponent(value: string): string | null;
export declare function attachmentRefById(id: string): ImageAttachmentRef | undefined;
/** Build the `[image attachment …]` note text for one reference. */
export declare function attachmentNote(ref: ImageAttachmentRef): string;
/**
 * Validate an unknown upload payload and decode its bytes. Pure: no context,
 * no I/O — every rejection reason is spelled in the error message.
 * @param payload - the parsed request body.
 * @param maxBytes - the image byte bound.
 * @returns the validated payload and decoded bytes, or the rejection.
 */
export declare function validateAttachPayload(payload: unknown, maxBytes: number): {
    payload: AttachPayload;
    bytes: Buffer;
} | {
    error: AttachError;
};
/**
 * Validate and persist one upload. The declared media type is checked against
 * magic bytes before any store write; the store's own validation runs before
 * the reference is published.
 * @param ctx - registrant context carrying the optional attachment service.
 * @param maxBytes - the image byte bound.
 * @param payload - the parsed request body.
 * @returns the stored reference and its note text, or a structured rejection.
 */
export declare function handleAttach(ctx: Context, maxBytes: number, payload: unknown): Promise<AttachOutcome>;
/**
 * Register the /describe-image/attach POST route on the shared webserver. The
 * byte bound is read per request so the Settings card's maxBytes change lands
 * immediately; the attachment service is resolved per call.
 * @param ctx - registrant context; webServer is required.
 * @param readMaxBytes - per-request byte-bound reader (defaults to the constant).
 * @param probe - per-session image-input capability probe for the GET capability route.
 */
export declare function registerAttachRoute(ctx: Context, readMaxBytes?: () => number, probe?: CapabilityProbe): void;
/** Request-body byte cap for the model probe: three short connection-field drafts. */
export declare const MAX_MODEL_PROBE_BODY_BYTES = 4096;
/**
 * Register the /describe-image/models POST routes on the shared webserver.
 * Two actions share the prefix: the bare path lists the configured
 * endpoint's models (the settings card's fetch control — a success doubles
 * as the endpoint connectivity and credential check), and the /test suffix
 * pings the selected model with a minimal completion so the card reports
 * the model's own round-trip latency. The stored settings and the key
 * resolver are read per request, so the card's unsaved drafts can override
 * the connection fields before any save, while the key itself never crosses
 * into the browser (only the id list or the latency comes back).
 * @param ctx - registrant context; webServer is required.
 * @param readConfig - per-request reader of the settings currently in effect.
 * @param resolveKey - the credential resolver for the final configuration.
 */
export declare function registerModelRoutes(ctx: Context, readConfig: () => Config, resolveKey: ProbeKeyResolver): void;
//# sourceMappingURL=attach-routes.d.ts.map