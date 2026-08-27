import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
/** What the floating mount needs from the plugin apply. */
export interface FloatingButtonFace {
    /** Locale reader bound to the `desktop-launcher` namespace. */
    t: TranslateNS<'desktop-launcher'>;
    /** Whether the confirm dialog is required before exiting (settings-backed). */
    confirmShutdown: () => boolean;
}
/**
 * Mount the floating power button into document.body.
 * @param face - locale copy and the confirm gate.
 * @returns the disposer unmounting the button and removing the host element.
 */
export declare function mountShutdownButton(face: FloatingButtonFace): () => void;
