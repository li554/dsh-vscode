/**
 * Browser half of the attach seam: the upload client for the host
 * /describe-image/attach route. The browser sends the picked image as base64
 * text; the host validates magic bytes, persists the bytes in the attachment
 * store, and returns both a durable `[image attachment ...]` note and
 * self-contained Markdown reference. Image bytes never enter the conversation
 * log — only durable reference text does.
 * @module @linxin666/dsh-tool-describe-image/client/attach
 */
/** The host attach endpoint, same-origin with the web shell. */
export declare const ATTACH_ENDPOINT = "/describe-image/attach";
/**
 * Read a picked file as base64 text (no data-URL prefix).
 * @param file - the file the user picked.
 * @returns the base64 payload, or a structured rejection.
 */
export declare function readFileAsBase64(file: File): Promise<{
    ok: true;
    base64: string;
} | {
    ok: false;
    message: string;
}>;
/**
 * Upload base64 image bytes to the host attach route.
 * @param base64 - the base64 image payload.
 * @param mediaType - the declared media type (verified against magic bytes on the host).
 * @param name - optional display name.
 * @returns durable note and Markdown reference text, or a structured rejection.
 */
export declare function uploadImageForDescribe(base64: string, mediaType: string, name?: string): Promise<{
    ok: true;
    note: string;
    markdown: string;
} | {
    ok: false;
    message: string;
}>;
//# sourceMappingURL=attach.d.ts.map