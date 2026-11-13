import type { BacktestRun, EvalCase } from './contracts.ts';
/** Stable evaluation inputs, excluding presentation timestamps and provenance. Hash at the server boundary. */
export declare function skillCaseSignature(cases: readonly EvalCase[]): string;
/** Automatic decisions require full matching coverage, not the UI's scored intersection. */
export declare function compareAutomaticSkillRuns(cases: readonly EvalCase[], baseline: BacktestRun | undefined, draft: BacktestRun | undefined, casesHash: string): {
    outcome: 'unmeasured' | 'regressed' | 'not-worse';
    baselineScore?: number;
    draftScore?: number;
};
