import { type JSX } from 'react';
import type { SkillsLocation, SkillsPageContext } from './ui.tsx';
/** A score's tone: good from 80, poor under 50. */
export declare function scoreTone(score: number | undefined): 'good' | 'bad' | undefined;
/**
 * Every skill's tests in one place: the skills with cases first, each with
 * its last score against the version DSH loads, and the ones a suggestion
 * proposes after them; on the right, the chosen skill's cases and backtests.
 */
export declare function EvalsPage(props: {
    context: SkillsPageContext;
    location: SkillsLocation;
}): JSX.Element;
