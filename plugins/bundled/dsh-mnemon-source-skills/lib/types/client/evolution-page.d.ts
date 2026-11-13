import { type JSX } from 'react';
import type { BacktestRun } from '../contracts.ts';
import type { SkillsLocation, SkillsPageContext } from './ui.tsx';
export declare function EvolutionPage(props: {
    context: SkillsPageContext;
    location: SkillsLocation;
}): JSX.Element;
/**
 * Average scores of a draft and its baseline over the cases both graded: a
 * case that could not run on either side says nothing about the change.
 */
export declare function compareRuns(baseline: BacktestRun | undefined, candidate: BacktestRun | undefined): {
    baseline?: number;
    candidate?: number;
    excluded: number;
};
