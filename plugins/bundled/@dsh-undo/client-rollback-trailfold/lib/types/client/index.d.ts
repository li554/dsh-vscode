/**
 * Browser half of the trailfold plugin: mount the per-turn fold into the live
 * document. No services are required — the fold reads the chat flow's stable
 * data attributes and never touches React-owned state.
 */
/** No services required: the fold is a self-contained DOM patch. */
export declare const inject: readonly string[];
export { mountTrailFold, planTurns, foldable } from './trailfold.ts';
export type { FlowItem, TurnPlan } from './trailfold.ts';
/**
 * Mount the conversation trail fold.
 * @returns Disposer removing the observer and every foreign bar.
 */
export declare function apply(): Promise<() => void>;
//# sourceMappingURL=index.d.ts.map