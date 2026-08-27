/**
 * Renderer switch — the client dispatch seam of the pet center (issue #623,
 * milestone M2 P5 / M3). The pet's manifest picks the renderer: sprite2d
 * hands straight through to the sprite; live2d injects its visual INTO the
 * sprite chrome (the dock, bubbles and panel belong to the pet center, not
 * the renderer); a renderer this build cannot serve renders a clear
 * diagnostic card instead of blanking.
 * @module @linxin666/dsh-pet/client/renderers/PetRendererSwitch
 */
import { type ReactElement, type ReactNode } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { PetDefinition } from '../../registry.ts';
import type { ActivityPhase } from '../../state.ts';
import type { NS } from '../locales.ts';
/** Dispatch one pet definition to its renderer; unknown kinds get a card. */
export declare function PetRendererSwitch(props: {
    definition: PetDefinition;
    /** Current activity phase (fed to renderer visuals). */
    phase: ActivityPhase;
    /** The chrome's pet interaction (affinity write-back owner). */
    onPet: () => void;
    t: PropsLocale<typeof NS>['t'];
    children?: ReactNode;
}): ReactElement;
//# sourceMappingURL=PetRendererSwitch.d.ts.map