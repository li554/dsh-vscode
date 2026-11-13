import { type JSX } from 'react';
import type { BacktestRun, ModelRoute } from '../contracts.ts';
import type { SkillsPageContext } from './ui.tsx';
/**
 * A skill's test cases and its backtests: the cases with a switch each, one
 * button that backtests the current version, and the runs, newest first, each
 * opening to its per-case verdicts. A draft is backtested from its review.
 */
export declare function SkillTests(props: {
    context: SkillsPageContext;
    skillName: string;
    runModel?: ModelRoute | null;
}): JSX.Element;
/** One run's cases: the verdict, each check with the judge's note, and what the simulated run did and answered. */
export declare function RunDetail(props: {
    run: BacktestRun;
}): JSX.Element;
