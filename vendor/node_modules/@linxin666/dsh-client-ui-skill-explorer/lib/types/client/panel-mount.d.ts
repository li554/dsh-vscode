import type { SkillApi } from './api.ts';
/** Mounted panel controller: toggle/open/close plus the disposer. */
export interface SkillPanelMount {
    toggle: () => void;
    open: () => void;
    close: () => void;
    dispose: () => void;
}
/**
 * Mount the skill center overlay panel.
 * @param api - the skill center API client.
 * @returns controller (toggle/open/close) and the disposer.
 */
export declare function mountPanel(api: SkillApi): SkillPanelMount;
