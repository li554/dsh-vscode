/**
 * Live2D visual mount (pet-center M3) — the React bridge between the pet
 * center chrome and the imperative live2d renderer. The bridge owns the
 * contract context (asset base, phase stream, interaction write-back,
 * activation cleanups), feeds the polled phase into the stream, forwards
 * sub-4px taps as hit-test coordinates, and renders the localized error
 * card when the renderer reports a fatal boot failure.
 * @module @linxin666/dsh-pet/client/renderers/live2d/Live2dVisualMount
 */
import { type ReactElement } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { PetDefinition } from '../../../registry.ts';
import type { ActivityPhase } from '../../../state.ts';
import type { NS } from '../../locales.ts';
/** Mount the live2d renderer as the sprite's visual (inside the chrome). */
export declare function Live2dVisualMount(props: {
    definition: PetDefinition;
    phase: ActivityPhase;
    onPet: () => void;
    t: PropsLocale<typeof NS>['t'];
}): ReactElement;
//# sourceMappingURL=Live2dVisualMount.d.ts.map