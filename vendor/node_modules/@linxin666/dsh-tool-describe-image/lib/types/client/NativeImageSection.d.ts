/**
 * Native-image section of the describe-image card (rc.8 feature): reports
 * the current agent-default route's image-input state and toggles the
 * DeepSeek adapter catalog entry through the loopback host route. The
 * section is self-contained (its own fetch state) — it never rides the card
 * form, so a toggle settles immediately while the rest of the card keeps its
 * staged drafts. Unsupported hosts and failed writes render a hint; nothing
 * here throws.
 * @module @linxin666/dsh-tool-describe-image/client/NativeImageSection
 */
/**
 * Render the native-image request section.
 * @returns the section block.
 */
export declare function NativeImageSection(): import("react").JSX.Element;
//# sourceMappingURL=NativeImageSection.d.ts.map