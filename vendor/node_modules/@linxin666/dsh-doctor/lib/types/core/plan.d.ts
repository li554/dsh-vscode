import type { Diagnostic, PlanAction, PlanResult } from './types.ts';
export interface PlanInput {
    profile: string;
    diagnostics: Diagnostic[];
    /** Content of files a fix may rewrite, keyed by the diagnostic's path. */
    files: Record<string, string>;
    /** Overrides for the paths the D-040/D-050 fixes target (profile vs home patch). */
    patchPathByCode: Record<string, string>;
}
/** Build the repair plan for a diagnostic list. Same inputs always produce the same actions. */
export declare function planRepair(input: PlanInput): PlanResult;
/** Deterministic hash of an action list. */
export declare function planHash(actions: PlanAction[]): string;
/** Whether two plans carry the same actionable content. */
export declare function samePlan(a: PlanResult, b: PlanResult): boolean;
