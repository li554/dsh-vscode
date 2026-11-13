import { type MemoryAvailableSource, type MemoryJsonValue, type MemoryStrategyContribution, type MemoryStrategyExtensionDefinition, type MemoryViewExtensionSlot, type MemoryViewExtensionValues, type MemoryViewRequest } from '../core/contracts/index.ts';
/** Validate one standard View extension value; a Strategy validates again before interpreting it. */
export declare function validateMemoryViewExtension<K extends MemoryViewExtensionSlot>(slot: K, value: MemoryJsonValue): MemoryViewExtensionValues[K];
/** Standard values contributed to one composition; each slot has at most one owner. */
export declare function memoryViewExtensionValues(contributions: readonly MemoryStrategyContribution[]): Partial<MemoryViewExtensionValues>;
/** An extension for whichever selected Strategy declares its standard slot. */
export declare function defineMemoryViewExtension<K extends MemoryViewExtensionSlot>(definition: {
    typeId: string;
    packageName: string;
    slot: K;
    contribute(request: MemoryViewRequest, sources: readonly MemoryAvailableSource[]): MemoryViewExtensionValues[K];
}): MemoryStrategyExtensionDefinition;
