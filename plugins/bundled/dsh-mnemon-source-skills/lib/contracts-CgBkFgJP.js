//#region src/auto-adoption.ts
/** Stable evaluation inputs, excluding presentation timestamps and provenance. Hash at the server boundary. */
function skillCaseSignature(cases) {
	return JSON.stringify([...cases].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map((entry) => [
		entry.id,
		entry.skillName,
		entry.title,
		entry.prompt,
		entry.context ?? "",
		entry.enabled,
		entry.requiresVision === true,
		entry.checks.map((check) => [
			check.id,
			check.text,
			check.must
		])
	]));
}
/** Automatic decisions require full matching coverage, not the UI's scored intersection. */
function compareAutomaticSkillRuns(cases, baseline, draft, casesHash) {
	const unmeasured = { outcome: "unmeasured" };
	if (cases.length === 0 || cases.some((entry) => !entry.enabled || entry.requiresVision === true || entry.checks.length === 0)) return unmeasured;
	const ids = new Set(cases.map((entry) => entry.id));
	if (ids.size !== cases.length || baseline === void 0 || draft === void 0 || baseline.model === void 0 || draft.model === void 0 || baseline.model.provider !== draft.model.provider || baseline.model.model !== draft.model.model || baseline.model.reasoningEffort !== draft.model.reasoningEffort) return unmeasured;
	const complete = (run) => {
		if (run.status !== "completed" || run.casesHash !== casesHash || run.errors || run.caseIds.length !== ids.size || new Set(run.caseIds).size !== ids.size || run.caseIds.some((id) => !ids.has(id)) || run.results.length !== ids.size || run.progress.done !== ids.size || run.progress.total !== ids.size) return;
		const results = new Map(run.results.map((result) => [result.caseId, result]));
		if (results.size !== ids.size) return;
		for (const entry of cases) {
			const result = results.get(entry.id);
			if (result === void 0 || result.fullyGraded !== true || result.verdict === "error" || result.unmeasuredReason !== void 0 || result.error !== void 0 || !Number.isFinite(result.score)) return;
			const checks = new Map(result.checks.map((check) => [check.checkId, check.pass]));
			if (checks.size !== entry.checks.length || result.checks.length !== checks.size || entry.checks.some((check) => typeof checks.get(check.id) !== "boolean")) return;
			const weight = entry.checks.reduce((sum, check) => sum + (check.must ? 2 : 1), 0);
			const score = entry.checks.reduce((sum, check) => sum + (checks.get(check.id) ? check.must ? 2 : 1 : 0), 0) / weight;
			const verdict = entry.checks.every((check) => !check.must || checks.get(check.id)) ? "pass" : "fail";
			if (Math.abs(result.score - score) > 1e-8 || result.verdict !== verdict) return;
		}
		return results;
	};
	const before = complete(baseline);
	const after = complete(draft);
	if (before === void 0 || after === void 0) return unmeasured;
	const baselineScore = cases.reduce((sum, entry) => sum + before.get(entry.id).score, 0) / cases.length;
	const draftScore = cases.reduce((sum, entry) => sum + after.get(entry.id).score, 0) / cases.length;
	return {
		outcome: cases.some((entry) => {
			const left = before.get(entry.id);
			const right = after.get(entry.id);
			const checks = new Map(right.checks.map((check) => [check.checkId, check.pass]));
			return right.score + 1e-8 < left.score || left.checks.some((check) => check.pass && !checks.get(check.checkId));
		}) ? "regressed" : "not-worse",
		baselineScore,
		draftScore
	};
}
//#endregion
//#region src/contracts.ts
const SKILL_ROOT_KINDS = [
	"project-dsh",
	"project-agents",
	"user-dsh",
	"user-agents"
];
const SKILL_ROOT_RANK = {
	"project-dsh": 100,
	"project-agents": 200,
	"user-dsh": 400,
	"user-agents": 500
};
const EVOLUTION_SIGNALS = [
	"correction",
	"directive",
	"tool-failure",
	"approach-change",
	"procedure",
	"skill-gap",
	"skill-misleading",
	"success"
];
const SUGGESTION_STATUSES = [
	"pending",
	"drafting",
	"review",
	"adopted",
	"dismissed",
	"expired",
	"invalidated"
];
const DEFAULT_SKILLS_POLICY = Object.freeze({
	allowCreate: true,
	allowUpdate: true,
	minConfidence: .6,
	expiryDays: 7,
	maxPendingPerSession: 5
});
const AUTO_ADOPTION_STAGES = [
	"queued",
	"drafting",
	"backtesting",
	"rewriting",
	"adopted",
	"paused",
	"review"
];
const AUTO_ADOPTION_REASONS = [
	"disabled",
	"no-cases",
	"case-limit",
	"unmeasured",
	"regressed",
	"changed",
	"failed",
	"queue-full",
	"model-unavailable",
	"interrupted",
	"daily-limit",
	"duplicate-skill"
];
//#endregion
export { SKILL_ROOT_KINDS as a, compareAutomaticSkillRuns as c, EVOLUTION_SIGNALS as i, skillCaseSignature as l, AUTO_ADOPTION_STAGES as n, SKILL_ROOT_RANK as o, DEFAULT_SKILLS_POLICY as r, SUGGESTION_STATUSES as s, AUTO_ADOPTION_REASONS as t };
