import { t as prepareStarterResolution } from "./starter-resolution-xKydRhqf.js";
//#region src/starter.ts
const name = "dsh-mnemon-starter";
const provide = ["mnemonStarterReady"];
/**
* The separate readiness Entry of 0.5.18 and 0.5.19, kept for compositions that
* still insert it; the Starter's own group (`dsh-mnemon/bundle`) now prepares itself.
*/
async function apply(ctx) {
	await prepareStarterResolution(ctx);
	ctx.provide("mnemonStarterReady", true);
}
//#endregion
export { apply, name, provide };
