import { a as memoryConfigurationDigest, c as record, d as truncate, f as canonicalWorkspacePath, i as integer, l as stringArray, m as withMemoryStorageLock, o as migrationLineage, p as workspaceStorageId, s as receipt, t as defineMemoryStrategyConfiguration, u as text } from "./strategy-configuration-CKP2kRss.js";
import { COMPOSABLE_MEMORY_API_VERSION, MEMORY_VIEW_EXTENSION_SLOTS } from "./contracts.js";
import { a as defineMemoryStrategy, i as defineMemorySource, o as defineMemoryStrategyExtension, r as defineMemoryPlugin } from "./definitions-DU7MLBhu.js";
//#region src/sdk/projection-reservation.ts
/** Reserve complete Source-declared resident data inside the existing View ceiling. */
function reserveMemoryProjection(spec, sources, budget) {
	const minimums = spec.sources.map((selected) => {
		const source = sources.find((item) => item.sourceInstanceKey === selected.sourceInstanceKey);
		const hints = source?.hints;
		const value = source?.capabilities.includes("project") && hints !== null && typeof hints === "object" && !Array.isArray(hints) ? hints?.minimumProjectionCharacters : void 0;
		if (value === void 0) return 0;
		if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid minimum projection hint");
		return value;
	});
	if (minimums.every((value) => value === 0)) return spec;
	const minimum = minimums.reduce((sum, value) => sum + value, 0);
	if (minimum > budget) throw new Error(`Pinned memory requires ${minimum} projection characters but the View budget is ${budget}. Unpin entries or increase the View budget.`);
	const allocation = spec.sources.map((selected, index) => Math.max(minimums[index], selected.projection?.maxCharacters ?? 0));
	let excess = allocation.reduce((sum, value) => sum + value, 0) - budget;
	for (let index = allocation.length - 1; index >= 0 && excess > 0; index--) {
		const reclaimed = Math.min(excess, allocation[index] - minimums[index]);
		allocation[index] -= reclaimed;
		excess -= reclaimed;
	}
	return {
		...spec,
		sources: spec.sources.map((selected, index) => {
			const { projection, ...rest } = selected;
			const characters = allocation[index];
			return {
				...rest,
				...minimums[index] > 0 ? { required: true } : {},
				...characters === 0 ? {} : { projection: {
					mode: projection?.mode ?? "eager",
					maxCharacters: characters
				} }
			};
		})
	};
}
//#endregion
//#region src/sdk/install.ts
function locatedEntryId(ctx) {
	const located = ctx.get("loader", false)?.locate(ctx.fiber)?.trim();
	return located === "" ? void 0 : located;
}
function stableEntryId(ctx, explicit) {
	const configured = explicit?.trim();
	if (configured !== void 0 && configured !== "") return configured;
	const located = locatedEntryId(ctx);
	if (located !== void 0) return located;
	throw new Error("installMemory requires a stable Loader Entry id; pass options.instanceId for direct ctx.plugin() mounts");
}
/**
* dshmarket mounts `mkt-client-<package>` for a profile dependency that
* declares `dsh.client` without `dsh.bundle`, meant to run no host code. A
* Source installed on its own in a profile matches that rule although the
* Starter composes it, and dshmarket 1.66 imports the real module there, so
* the Source would register a second instance (#359). Nothing installs under
* such a mount, whatever identity the plugin passes. The Loader prefixes an
* Entry id with its parents' ids, as in `include:dsh-market:mkt-client-<package>`,
* so the last segment names it.
*/
const MARKET_CLIENT_SHIM = /(?:^|:)mkt-client-[^:]*$/u;
/**
* Register a plugin's Source and/or Strategy definitions as one Fiber-owned batch.
* Contribution roles do not dictate package or repository boundaries.
*/
function installMemory(ctx, contribution, options = {}) {
	if (MARKET_CLIENT_SHIM.test(locatedEntryId(ctx) ?? "")) return;
	const entryId = stableEntryId(ctx, options.instanceId);
	ctx.effect(() => ctx.mnemonMemory.installContributions(contribution, {
		...options,
		instanceId: entryId
	}), `dsh-mnemon: install ${entryId}`);
}
//#endregion
//#region src/sdk/view-extensions.ts
const SOURCE_KEY = /^source:[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,292}$/u;
const ACTION_ID = /^[a-z][a-z0-9-]{0,127}$/u;
const FIELDS = {
	selection: ["sourceKeys", "writableSourceKeys"],
	projection: ["maxProjectionCharacters"],
	capture: [
		"instruction",
		"actionIds",
		"sourceKeys"
	]
};
function sourceKeys(value, label) {
	if (!Array.isArray(value) || value.length > 32 || value.some((key) => typeof key !== "string" || !SOURCE_KEY.test(key))) throw new Error(`${label} must contain at most 32 exact Source instance keys`);
	if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicate Source keys`);
	return [...value];
}
/** Validate one standard View extension value; a Strategy validates again before interpreting it. */
function validateMemoryViewExtension(slot, value) {
	if (!MEMORY_VIEW_EXTENSION_SLOTS.includes(slot)) throw new Error(`unsupported View extension slot: ${String(slot)}`);
	const input = record(value, `View ${slot} contribution`);
	for (const key of Object.keys(input)) if (!FIELDS[slot].includes(key)) throw new Error(`unsupported View ${slot} field: ${key}`);
	let result;
	if (slot === "selection") {
		const selected = sourceKeys(input.sourceKeys, "sourceKeys");
		const writable = input.writableSourceKeys === void 0 ? void 0 : sourceKeys(input.writableSourceKeys, "writableSourceKeys");
		if (writable?.some((key) => !selected.includes(key))) throw new Error("writableSourceKeys must be within selected sourceKeys");
		result = {
			sourceKeys: selected,
			...writable === void 0 ? {} : { writableSourceKeys: writable }
		};
	} else if (slot === "projection") {
		if (input.maxProjectionCharacters === void 0) throw new Error("maxProjectionCharacters is required");
		result = { maxProjectionCharacters: integer(input.maxProjectionCharacters, 4096, 1, 1e7) };
	} else {
		const actionIds = input.actionIds;
		if (!Array.isArray(actionIds) || actionIds.length === 0 || actionIds.length > 32 || actionIds.some((id) => typeof id !== "string" || !ACTION_ID.test(id)) || new Set(actionIds).size !== actionIds.length) throw new Error("capture actionIds must name 1..32 distinct Source-local recording actions");
		result = {
			instruction: text(input.instruction, "capture instruction", 4e3),
			actionIds: [...actionIds],
			...input.sourceKeys === void 0 ? {} : { sourceKeys: sourceKeys(input.sourceKeys, "capture sourceKeys") }
		};
	}
	return result;
}
/** Standard values contributed to one composition; each slot has at most one owner. */
function memoryViewExtensionValues(contributions) {
	const output = {};
	for (const contribution of contributions) {
		const slot = contribution.slot;
		if (Object.hasOwn(output, slot)) throw new Error(`duplicate View extension slot: ${slot}`);
		Object.assign(output, { [slot]: validateMemoryViewExtension(slot, contribution.value) });
	}
	return output;
}
/** An extension for whichever selected Strategy declares its standard slot. */
function defineMemoryViewExtension(definition) {
	return defineMemoryStrategyExtension({
		manifest: {
			apiVersion: COMPOSABLE_MEMORY_API_VERSION,
			kind: "strategy-extension",
			typeId: definition.typeId,
			packageName: definition.packageName,
			strategyTypeId: "*",
			slot: definition.slot,
			deterministic: true
		},
		contribute: (request, sources) => validateMemoryViewExtension(definition.slot, definition.contribute(request, sources))
	});
}
//#endregion
export { canonicalWorkspacePath, receipt as createMemoryMutationReceipt, defineMemoryPlugin, defineMemorySource, defineMemoryStrategy, defineMemoryStrategyConfiguration, defineMemoryStrategyExtension, defineMemoryViewExtension, installMemory, memoryConfigurationDigest, integer as memoryInputInteger, migrationLineage as memoryInputMigrationLineage, record as memoryInputRecord, stringArray as memoryInputStringArray, text as memoryInputText, memoryViewExtensionValues, reserveMemoryProjection, truncate as truncateMemoryText, validateMemoryViewExtension, withMemoryStorageLock, workspaceStorageId };
