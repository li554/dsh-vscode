/**
 * Browser half of the native-image configuration seam (rc.8 feature): reads
 * the current agent-default route's image-input state from the host route
 * and toggles the DeepSeek adapter catalog entry. Every failure answers a
 * conservative envelope — the section renders an unsupported hint instead of
 * throwing, and a failed toggle never pretends the state changed.
 * @module @linxin666/dsh-tool-describe-image/client/native-images
 */
/** The host native-image endpoint, same-origin with the web shell. */
export declare const NATIVE_IMAGES_ENDPOINT = "/describe-image/native-images";
/** Wire state mirrored from the host route. */
export interface NativeImageClientState {
    provider?: string;
    model?: string;
    capability: {
        acceptsImages: boolean;
        known: boolean;
    };
    inputModalities?: readonly string[];
    supported: boolean;
}
/** Toggle result: the refreshed state on success, a message on failure. */
export interface NativeImageToggleResult {
    ok: boolean;
    value?: NativeImageClientState;
    message?: string;
}
/** Default fetch timeouts: reads are quick, writes ride the settings seam. */
export declare const DEFAULT_NATIVE_STATE_TIMEOUT_MS = 4000;
export declare const DEFAULT_NATIVE_TOGGLE_TIMEOUT_MS = 8000;
/** Read the current native-image state; null when the host route is unreachable. */
export declare function fetchNativeImageState(timeoutMs?: number): Promise<NativeImageClientState | null>;
/** Toggle native image input; the envelope carries the refreshed state or the refusal. */
export declare function setNativeImageEnabled(enabled: boolean, timeoutMs?: number): Promise<NativeImageToggleResult>;
//# sourceMappingURL=native-images.d.ts.map