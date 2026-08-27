import { a as AFFINITY_MAX, n as animationForPhase, o as AFFINITY_RANKS, u as defaultAffinityConfig } from "./state-DrMX22GL.js";
//#region src/invariant.ts
/**
* Package invariants — cheap structural checks run at import time on the
* host side. Mirrors the pattern used by other dsh plugin packages.
* @module @linxin666/dsh-pet/invariant
*/
/** Assert a condition; throws a descriptive Error when violated. */
function invariant(condition, message) {
	if (!condition) throw new Error(`[dsh-pet] ${message}`);
}
/** Run every package invariant once; throws on the first violation. */
function runPetInvariants() {
	invariant(AFFINITY_MAX > 0, "AFFINITY_MAX must be positive");
	invariant(AFFINITY_RANKS.length > 0 && AFFINITY_RANKS[0].min === 0, "AFFINITY_RANKS must start at 0");
	invariant(defaultAffinityConfig.turnReward > 0, "turnReward must be positive");
	invariant(defaultAffinityConfig.feedCooldownMs > defaultAffinityConfig.petCooldownMs, "feed cooldown must exceed pet cooldown");
	for (const phase of [
		"idle",
		"waiting",
		"thinking",
		"tool",
		"done"
	]) invariant([
		"idle",
		"running",
		"running-right",
		"waiting",
		"jumping"
	].includes(animationForPhase(phase)), `phase ${phase} maps outside the animation contract`);
}
runPetInvariants();
//#endregion
export { invariant, runPetInvariants };
