/**
 * The pending-steering retract layer: the pre-admission counterpart of the A2
 * action, attached through the DOM.
 *
 * An unclaimed steering bubble is not a slot entry — `ChatFlow` constructs it
 * from the owner's `pendingInputs` — so there is no component identity to take
 * over. While the session's inbox holds user steering rows this layer finds their
 * bubbles inside the session's own content region and portals one retract button
 * into each matched actions row; when the inbox holds none it removes the
 * buttons and disconnects the observer. Outside that window there is no observer
 * and no DOM query — only the inbox subscription, which fires on inbox changes.
 *
 * @module dsh-rewind/client/pending-mount
 */
import { type ReactNode } from 'react';
import type { SessionFace } from '@deepseek-ai/dsh-api-session-controller/client';
import type { MessageImageRef } from './hidden.ts';
import type { RewindKey } from './locales.ts';
type Translate = (key: RewindKey, params?: Record<string, unknown>) => string;
/** The capability inputs the bridge closes over (all identity-stable). */
export interface PendingBridgeDeps {
    sessionOf(sessionId: string): SessionFace | undefined;
    setComposerText(sessionId: string, text: string): boolean;
    restoreImages?(sessionId: string, images: readonly MessageImageRef[]): Promise<void>;
    t: Translate;
    subscribeLocale(cb: () => void): () => void;
}
/**
 * Build the session-scoped slot entry that runs the pending layer. It renders
 * portals only — never header UI.
 * @param deps - session resolution, composer write, image restore, copy and locale.
 */
export declare function createPendingBridge(deps: PendingBridgeDeps): (props: {
    readonly sessionId: string;
}) => ReactNode;
export {};
