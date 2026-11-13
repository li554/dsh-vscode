import { join } from "node:path";
import { pathToFileURL } from "node:url";
//#region package.json
var name = "dsh-mnemon";
var dependencies = {
	"@deepseek-ai/cosmokit": "^1.8.5",
	"@deepseek-ai/schemastery": "^3.18.4",
	"dsh-mnemon-provider-byterover": "0.5.7",
	"dsh-mnemon-provider-hindsight": "0.5.7",
	"dsh-mnemon-provider-holographic": "0.5.7",
	"dsh-mnemon-provider-honcho": "0.5.5",
	"dsh-mnemon-provider-mem0": "0.5.5",
	"dsh-mnemon-provider-mnemon-native": "0.5.11",
	"dsh-mnemon-provider-openviking": "0.5.10",
	"dsh-mnemon-provider-retaindb": "0.5.6",
	"dsh-mnemon-provider-supermemory": "0.5.5",
	"dsh-mnemon-source-documents": "0.6.0",
	"dsh-mnemon-source-memory-spaces": "0.5.27",
	"dsh-mnemon-source-runtime": "0.5.19",
	"dsh-mnemon-source-skills": "0.5.12",
	"dsh-mnemon-strategy-auto-capture": "0.5.5",
	"dsh-mnemon-strategy-default-three-tier": "0.5.13",
	"dsh-mnemon-strategy-general": "0.5.2",
	"dsh-mnemon-strategy-light-context": "0.5.6",
	"dsh-mnemon-strategy-scoped": "0.5.5",
	"fflate": "^0.8.3",
	"yaml": "^2.9.0",
	"zod": "^4.4.3"
};
//#endregion
//#region src/starter-resolution.ts
/** Make the selected Starter's dependency closure visible before its child Entries import. */
function prepareStarterResolution(ctx) {
	const packages = ctx.get("pluginPackages");
	const profile = ctx.get("profileContext");
	if (profile === void 0 || typeof packages?.replace !== "function") return;
	const parent = pathToFileURL(join(profile.dir, "package.json")).href;
	if (Object.keys(dependencies).filter((name) => name.startsWith("dsh-mnemon-")).every((name) => packages.packageOf(name, parent) !== void 0)) return;
	return import("@deepseek-ai/dsh-app-boot").then(async ({ createRuntimeResolution, loadProfileDirectory, resolveBundleDir }) => {
		const selected = loadProfileDirectory("dsh-mnemon", profile.dir, profile.installAnchor);
		if (!selected.layers.some((layer) => layer.packageName === name)) return;
		const layers = [...profile.startedBundles.map((packageName) => ({
			packageName,
			packageDir: resolveBundleDir("dsh-mnemon", packageName, profile.installAnchor, profile.dir),
			patchPaths: [],
			patches: []
		})), ...selected.layers.filter((layer) => !profile.startedBundles.includes(layer.packageName))];
		packages.replace(await createRuntimeResolution({
			installAnchor: profile.installAnchor,
			profile: {
				...selected,
				layers
			},
			home: profile.home
		}));
	});
}
//#endregion
export { prepareStarterResolution as t };
