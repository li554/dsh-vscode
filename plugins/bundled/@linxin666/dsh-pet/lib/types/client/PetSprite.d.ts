/**
 * Pet sprite companion component — the browser half's centerpiece. Renders a
 * fixed-position floating sprite (React portal onto document.body), plays
 * the track matching the host animation snapshot, and exposes the
 * interaction surface: click to pet, hover panel with feed/rename/hide, drag
 * to reposition (persisted via setConfig). Everything visual comes from the
 * pet definition the host serves ('/api/pet/pets' + the state snapshot's
 * pet id), so one component renders every registry entry.
 * @module @linxin666/dsh-pet/client/PetSprite
 */
import type { ReactNode, ReactPortal } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { PetDisplayConfig } from '../persist.ts';
import type { PetStateView } from '../service.ts';
import type { PetDefinition } from '../registry.ts';
import type { PetFeedback } from './pet-store.ts';
import { NS } from './locales.ts';
/** Props injected by the plugin apply body (store actions + locale). */
export interface PetSpriteProps {
    /** Latest host snapshot; null while loading. */
    snapshot: PetStateView | null;
    /** The selected pet's registry definition (atlas URL + geometry + tracks). */
    definition: PetDefinition;
    /** Display configuration (persisted by the host). */
    display: PetDisplayConfig;
    /** Active reaction bubble, if any. */
    feedback: PetFeedback | null;
    /** Pet the sprite (click). */
    onPet: () => void;
    /** Feed the sprite (panel button). */
    onFeed: () => void;
    /** Hide the sprite (panel button). */
    onHide: () => void;
    /** Persist a drag position. */
    onDragEnd: (right: number, bottom: number) => void;
    /** Rename the selected pet (persisted by the host). */
    onRename: (name: string) => void;
    /** Navigate to the session one status bubble reports on. */
    onOpenSession: (sessionId: string) => void;
    /** Clear the reaction bubble (after its CSS animation). */
    onFeedbackDone: () => void;
    /**
     * Custom visual replacing the sprite2d atlas animation (pet-center M3).
     * The chrome (drag, bubbles, panel, tap economy) is untouched: the visual
     * renders inside the sprite box, and the atlas load + frame loop skip.
     */
    visual?: ReactNode;
    /** Locale translate seat (namespace-bound). */
    t: TranslateNS<typeof NS>;
}
/**
 * The floating pet. The spritesheet frame advances on requestAnimationFrame
 * with per-frame durations from the definition's tracks; the atlas image is
 * loaded once and the background position is written straight to the sprite
 * element (no per-frame React state).
 */
export declare function PetSprite(props: PetSpriteProps): ReactPortal;
//# sourceMappingURL=PetSprite.d.ts.map