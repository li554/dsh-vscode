//#region src/core/contracts/plugin.ts
/** Declarative identity and graph relations shared by every Mnemon plugin. */
const MEMORY_PLUGIN_API_VERSION = "dsh-mnemon/plugin/v1";
//#endregion
//#region src/core/contracts/view.ts
const COMPOSABLE_MEMORY_API_VERSION = "dsh-mnemon/v1";
/** Background work a Host runs for the turns of a Strategy that declares it. */
const MEMORY_STRATEGY_WORKFLOWS = ["idle-review", "runtime-capacity"];
/** Extension target for every selected Strategy that declares the extension's standard slot. */
const ANY_MEMORY_STRATEGY = "*";
/** Strategy role list entry for a role-agnostic Strategy that may select any Source. */
const ANY_MEMORY_SOURCE_ROLE = "*";
/** Standard View extension slots, each with one public value contract any Strategy may accept. */
const MEMORY_VIEW_EXTENSION_SLOTS = [
	"selection",
	"projection",
	"capture"
];
const DEFAULT_MEMORY_VIEW_BUDGET = Object.freeze({
	maxProjectionCharacters: 65536,
	maxRoutes: 16,
	maxActions: 16,
	maxEvidenceResults: 16,
	maxEvidenceCharacters: 16384
});
//#endregion
//#region src/core/contracts/index.ts
const MEMORY_CAPABILITIES = [
	"status",
	"project",
	"recall",
	"search",
	"read",
	"browse",
	"write",
	"archive",
	"graph",
	"related",
	"link",
	"forget",
	"maintain",
	"export",
	"import"
];
const MEMORY_SOURCE_MODES = ["eager", "routed"];
//#endregion
export { ANY_MEMORY_SOURCE_ROLE, ANY_MEMORY_STRATEGY, COMPOSABLE_MEMORY_API_VERSION, DEFAULT_MEMORY_VIEW_BUDGET, MEMORY_CAPABILITIES, MEMORY_PLUGIN_API_VERSION, MEMORY_SOURCE_MODES, MEMORY_STRATEGY_WORKFLOWS, MEMORY_VIEW_EXTENSION_SLOTS };
