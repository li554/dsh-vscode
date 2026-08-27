/**
 * Send interception: text-only models reject image blocks at submit, so a
 * send that carries draft images is rewritten into a plain-text prompt that
 * carries durable describe-image references instead. The images are uploaded
 * through the host attach route (so bytes stay out of the conversation log),
 * the draft images are released, and the model analyzes them through the
 * describe_image tool rather than receiving the bytes it cannot read.
 *
 * The hook wraps the conversation service's sendSession method in place. It
 * is structural (no dependency on the conversation package's internal
 * types) and idempotent (a module marker guards against double install).
 * @module @linxin666/dsh-tool-describe-image/client/send-hook
 */
/**
 * Wrap the conversation service so image-bearing sends route through the
 * describe-image attach seam. No-op when the service surface is unavailable
 * (older shell) or already wrapped. When `isEnabled` is given it is read on
 * every send: a send that reports the interception disabled passes straight
 * through to the original `sendSession`, so other vision plugins keep the
 * raw image blocks (issue #301). When `acceptsImages` is given it is
 * consulted per image-bearing send: a session whose model accepts image
 * input passes straight through with the raw image blocks — rewriting them
 * into references would hide the images behind a redundant describe_image
 * call the model never needed. A checker failure answers false and the
 * legacy rewrite proceeds, so text-only models never lose the feature.
 * @param conversation - the `conversation` service instance.
 * @param isEnabled - live switch; consulted per send (default: always on).
 * @param acceptsImages - per-session capability predicate (default: always false).
 */
export declare function installSendHook(conversation: unknown, isEnabled?: () => boolean, acceptsImages?: (session: unknown) => Promise<boolean>): void;
//# sourceMappingURL=send-hook.d.ts.map