import { t as prepareStarterResolution } from "./starter-resolution-xKydRhqf.js";
//#region src/bundle.ts
const groupKey = Symbol.for("cordis.group");
const init = Symbol.for("cordis.init");
/**
* The Starter's component group (`mnemon-bundle`). It makes the Starter's
* dependency closure visible, then mounts the children with the Loader's own
* `cordis:group`, so a component enabled without a restart resolves and no
* separate readiness Entry can be turned off while the group waits for it.
*/
var MnemonBundle = class {
	ctx;
	config;
	static inject = ["loader"];
	static [groupKey] = true;
	constructor(ctx, config) {
		this.ctx = ctx;
		this.config = config;
	}
	async *[init]() {
		await prepareStarterResolution(this.ctx);
		const Group = this.ctx.loader?.builtins?.group;
		if (typeof Group !== "function") throw new Error("dsh-mnemon/bundle needs the Loader's cordis:group builtin");
		const group = new Group(this.ctx, this.config);
		yield () => group.stop();
		await group.update(this.config);
	}
};
//#endregion
export { MnemonBundle as default };
