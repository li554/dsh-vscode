/**
 * Skill center panel (browser half): an overlay modal with two tabs — the
 * grouped skill list (enable/disable switch, delete) and a create form.
 * Talks to the host route family through SkillApi.
 */
import { SkillApi } from './api.ts';
/** Panel props: the API client and the close callback. */
export interface SkillPanelProps {
    api: SkillApi;
    onClose: () => void;
}
/** The skill center overlay modal. */
export declare function SkillPanel({ api, onClose }: SkillPanelProps): React.JSX.Element;
