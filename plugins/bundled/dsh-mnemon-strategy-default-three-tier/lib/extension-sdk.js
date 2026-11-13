import { defineMemoryStrategyExtension, memoryViewExtensionValues, validateMemoryViewExtension } from "dsh-mnemon/extension-sdk";
import { COMPOSABLE_MEMORY_API_VERSION } from "dsh-mnemon/contracts";
//#region src/extension-sdk.ts
/**
* Pure default-product policy. The Host executes it through public Source protocols.
* @deprecated The Host runs the workflows a Strategy declares in its manifest's `workflows`.
*/
function threeTierActionWorkflow(strategyTypeId, sourceTypeId, actionId) {
	return strategyTypeId === "default-three-tier" && sourceTypeId === "runtime" && actionId === "mutate" ? "runtime-capacity" : void 0;
}
function validateThreeTierExtension(slot, value) {
	return validateMemoryViewExtension(slot, value);
}
/** An extension only for this Strategy; `defineMemoryViewExtension` also follows other Strategies. */
function defineThreeTierExtension(definition) {
	return defineMemoryStrategyExtension({
		manifest: {
			apiVersion: COMPOSABLE_MEMORY_API_VERSION,
			kind: "strategy-extension",
			typeId: definition.typeId,
			packageName: definition.packageName,
			strategyTypeId: "default-three-tier",
			slot: definition.slot,
			deterministic: true
		},
		contribute: (request, sources) => validateMemoryViewExtension(definition.slot, definition.contribute(request, sources))
	});
}
function threeTierContributions(values) {
	return memoryViewExtensionValues(values);
}
//#endregion
export { defineThreeTierExtension, threeTierActionWorkflow, threeTierContributions, validateThreeTierExtension };
