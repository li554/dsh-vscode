/**
 * Durable image-attachment reference parsing and Markdown serialization shared by
 * the host attach route and the vision loader. Generated Markdown carries the
 * complete immutable reference, so it survives process restarts and PTC Mode
 * nested tool dispatch without relying on the short-lived id registry.
 * @module @linxin666/dsh-tool-describe-image/attachment-reference
 */
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
/** Error text shown when a model-supplied attachment reference does not validate. */
export declare const ATTACHMENT_REF_GUIDANCE = "describe-image: image is not a valid attachment reference; pass the complete [image attachment ...] note or generated Markdown reference";
/** One attachment reference found in the plugin's Markdown image syntax. */
export interface MarkdownAttachmentReference {
    /** Attachment id carried by the raw-image route path. */
    attachmentId: string;
    /** Complete durable reference when the Markdown came from the current attach route. */
    ref?: ImageAttachmentRef;
}
/**
 * Validate and narrow a model-supplied attachment reference into its typed storage
 * form. It accepts either the raw JSON reference or its complete note carrier.
 * @param raw - JSON or `[image attachment ...]` content from a session message.
 * @returns the narrowed, typed reference.
 */
export declare function parseImageAttachmentRef(raw: string): ImageAttachmentRef;
/**
 * Parse the plugin's Markdown image form. Legacy id-only Markdown yields no `ref`;
 * current Markdown embeds the full immutable reference in its query string.
 * @param raw - a complete Markdown image reference.
 * @returns the parsed route id and optional durable reference, or undefined when not this syntax.
 */
export declare function parseMarkdownAttachmentReference(raw: string): MarkdownAttachmentReference | undefined;
/** Render a Markdown image reference for either a durable reference or a legacy id. */
export declare function attachmentMarkdown(ref: ImageAttachmentRef): string;
/** Render the legacy id-only Markdown form for callers that have no metadata. */
export declare function attachmentMarkdown(attachmentId: string): string;
//# sourceMappingURL=attachment-reference.d.ts.map