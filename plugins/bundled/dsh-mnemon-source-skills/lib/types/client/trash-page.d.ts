import { type JSX } from 'react';
import type { SkillsLocation, SkillsPageContext } from './ui.tsx';
/**
 * Skills taken out of DSH's reach: every removal still sits on disk under the
 * Source's `trash` directory, so it can be put back, and only here can it be
 * deleted for good.
 */
export declare function TrashPage(props: {
    context: SkillsPageContext;
    location: SkillsLocation;
}): JSX.Element;
