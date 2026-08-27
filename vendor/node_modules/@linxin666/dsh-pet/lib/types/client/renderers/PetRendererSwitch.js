import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
/**
 * Renderer switch — the client dispatch seam of the pet center (issue #623,
 * milestone M2 P5 / M3). The pet's manifest picks the renderer: sprite2d
 * hands straight through to the sprite; live2d injects its visual INTO the
 * sprite chrome (the dock, bubbles and panel belong to the pet center, not
 * the renderer); a renderer this build cannot serve renders a clear
 * diagnostic card instead of blanking.
 * @module @linxin666/dsh-pet/client/renderers/PetRendererSwitch
 */
import { cloneElement, isValidElement } from 'react';
import { defaultPetRendererRegistry } from "./registry.js";
import { Live2dVisualMount } from "./live2d/Live2dVisualMount.js";
/** Dispatch one pet definition to its renderer; unknown kinds get a card. */
export function PetRendererSwitch(props) {
    const renderer = props.definition.renderer ?? 'sprite2d';
    if (renderer === 'sprite2d')
        return _jsx(_Fragment, { children: props.children });
    if (renderer === 'live2d' && defaultPetRendererRegistry.has('live2d') && isValidElement(props.children)) {
        const visual = (_jsx(Live2dVisualMount, { definition: props.definition, phase: props.phase, onPet: props.onPet, t: props.t }));
        return cloneElement(props.children, { visual });
    }
    return (_jsx("span", { "data-dsh-pet-renderer-fallback": renderer, children: props.t('pet.renderer.unavailable', { renderer }) }));
}
