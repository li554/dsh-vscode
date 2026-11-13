import { MemoryAvailableSource, MemoryJsonValue, MemoryStrategyContribution, MemoryStrategyExtensionDefinition, MemoryViewExtensionSlot, MemoryViewExtensionValues, MemoryViewRequest } from "dsh-mnemon/contracts";
//#region src/extension-sdk.d.ts
/** The three-tier slots are Core's standard View extension slots. */
type ThreeTierExtensionValues = MemoryViewExtensionValues;
type ThreeTierExtensionSlot = MemoryViewExtensionSlot;
/**
 * Pure default-product policy. The Host executes it through public Source protocols.
 * @deprecated The Host runs the workflows a Strategy declares in its manifest's `workflows`.
 */
declare function threeTierActionWorkflow(strategyTypeId: string, sourceTypeId: string, actionId: string): 'runtime-capacity' | undefined;
declare function validateThreeTierExtension<K extends ThreeTierExtensionSlot>(slot: K, value: MemoryJsonValue): ThreeTierExtensionValues[K];
/** An extension only for this Strategy; `defineMemoryViewExtension` also follows other Strategies. */
declare function defineThreeTierExtension<K extends ThreeTierExtensionSlot>(definition: {
  typeId: string;
  packageName: string;
  slot: K;
  contribute(request: MemoryViewRequest, sources: readonly MemoryAvailableSource[]): ThreeTierExtensionValues[K];
}): MemoryStrategyExtensionDefinition;
declare function threeTierContributions(values: readonly MemoryStrategyContribution[]): Partial<ThreeTierExtensionValues>;
//#endregion
export { ThreeTierExtensionSlot, ThreeTierExtensionValues, defineThreeTierExtension, threeTierActionWorkflow, threeTierContributions, validateThreeTierExtension };