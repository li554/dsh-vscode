import { type JSX, type ReactNode } from 'react';
import type { SkillsLocation, SkillsPageContext } from './ui.tsx';
/**
 * 进化's third view: the conversations reviews read, the evidence every
 * suggestion and case cites. Pinned and newest first, narrowed to a skill
 * they used; each opens to its steps as the review numbered and marked them.
 * `bar` is 进化's own list header, so switching views keeps it in place.
 */
export declare function EvidenceView(props: {
    context: SkillsPageContext;
    location: SkillsLocation;
    bar: ReactNode;
}): JSX.Element;
