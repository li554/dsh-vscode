//#region src/remarks.ts
/** Every remark slot, in a stable order. */
const REMARK_KINDS = [
	"pet",
	"petCooldown",
	"feed",
	"feedCooldown",
	"noTreats"
];
/** Longest accepted reaction line (characters, trimmed before slicing). */
const REMARK_LINE_MAX = 120;
/** Longest accepted pool per slot. */
const REMARK_LINES_MAX = 64;
/**
* Built-in default remark library. Every pool is plain zh copy in the
* whale-girl voice; the first line of each pool is the legacy reaction the
* plugin has always spoken, so existing installs and tests keep their
* wording while the pool adds variety. No emoji characters anywhere (the
* repo bans them); ～ is the whale-girl's signature.
*/
const BUILTIN_REMARKS = {
	pet: [
		"咕噜咕噜～被摸摸好舒服！",
		"再摸摸这里，痒痒的～",
		"头顶温度刚刚好，安心～",
		"被摸到耳朵啦，扑通扑通！",
		"你的手掌好温暖，舍不得你走～",
		"呼噜呼噜～就靠在这里不走了！",
		"今天的摸头也收货成功！",
		"蹭蹭你的手心，这是回礼～",
		"多摸摸我，亲密度会涨哦！",
		"闭眼享受中，请勿打扰～",
		"头再低一点，够不着了～",
		"呼噜呼噜，声音都冒出来了",
		"这手感，比小鱼干还上瘾",
		"摸到第三下，满意",
		"耳朵后面，别漏了……啊，舒服",
		"被摸得尾巴都卷起来了"
	],
	petCooldown: [
		"摸过头啦，让鲸鱼娘歇口气～",
		"羽毛都快被摸秃啦，缓一缓～",
		"呼……先让我喘口气嘛！",
		"再摸就要睡着了哦～",
		"稍微休息一下，待会儿再摸～",
		"头顶要冒烟啦，停一停！",
		"我知道你喜欢我，但也要节制呀～",
		"歇一歇，摸摸的手感会更好哦～",
		"咕……等我回个蓝～",
		"让我先消化一下刚才的爱！",
		"痒痒的，先让我缓一下……",
		"再摸就掉线了，真的",
		"库存的呼噜声用完了",
		"手歇会儿，我也要补个蓝",
		"舒服归舒服，得缓缓呀",
		"再摸下去，我就要融化了"
	],
	feed: [
		"呜哇！小鱼干好好吃！",
		"咔嚓咔嚓，美味到尾巴打结～",
		"这条小鱼干是刚晒好的，好香！",
		"谢谢你，胃里暖暖的～",
		"囤粮 +1，今天也有好好被爱！",
		"好吃到想转圈圈～",
		"小鱼干最好吃了，再来亿条！",
		"饱餐一顿，马上满血复活～",
		"这个味道，是幸福的味道！",
		"吃完了还不忘舔舔爪子～",
		"这小鱼干，是今天的顶配",
		"一口下去，精神头全回来了",
		"脆！香！就是这个味儿",
		"边吃边摇尾巴，形象不要了",
		"好吃到眼睛都眯起来了",
		"这块鱼干我记住了，懂我的"
	],
	feedCooldown: [
		"吃饱啦，晚点再喂～",
		"肚子圆滚滚的，装不下啦～",
		"再喂就要变成球啦！",
		"让我慢慢消化这份心意～",
		"小鱼干的香气还没散呢～",
		"呼……满足得动不了了～",
		"先散步一圈再吃下一顿！",
		"肚皮已经鼓鼓的啦～",
		"好吃是好吃，可也得节制呀～",
		"等我饿了会告诉你哦～",
		"胃说它满了，脑子说还能吃",
		"这条得留着慢慢品",
		"先消消食，待会儿再战",
		"塞不下了，真塞不下了",
		"闻着香，可惜没地方放了",
		"嗝……这顿值了"
	],
	noTreats: [
		"没有小鱼干了，多陪我工作一会儿吧～",
		"粮仓空空，陪我完成几轮任务就会有小鱼干啦～",
		"小鱼干在路上啦，先一起加油工作！",
		"嘴巴寂寞了……快去完成一轮任务！",
		"陪我多工作一会儿，鱼干自动到账～",
		"现在喂我也只会饿着肚子说谢谢哦～",
		"粮仓见底啦，用几轮任务换一条鱼干吧～",
		"饿着肚子等你完成下一轮任务～",
		"小鱼干藏在你的工作里，去找找看！",
		"先工作后干饭，我们的约定哦～",
		"粮仓见底，全靠感情撑着了",
		"饿是真饿，活也是真得干",
		"画饼充饥……不对，画鱼干充饥",
		"没鱼干的日子，靠意志力过",
		"下一轮任务，我闻到了鱼干味",
		"先记账上，欠我两条，记住啦"
	]
};
/** The legacy first line of one kind (direct callers' fallback copy). */
function builtinRemark(kind) {
	return BUILTIN_REMARKS[kind][0];
}
/**
* Normalize a manifest 'remarks' block into per-kind line pools. Unknown
* slots and non-string entries are skipped with a warning; empty pools are
* dropped so the built-in library takes the slot. Returns undefined when no
* usable slot remains.
*/
function normalizePetRemarks(raw, onWarning = () => {}) {
	if (raw === void 0) return void 0;
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		onWarning("remarks must be an object with pet/petCooldown/feed/feedCooldown/noTreats slots");
		return;
	}
	const remarks = {};
	for (const [key, value] of Object.entries(raw)) {
		if (!REMARK_KINDS.includes(key)) {
			onWarning("unknown remarks slot " + JSON.stringify(key));
			continue;
		}
		const lines = (Array.isArray(value) ? value : [value]).filter((line) => typeof line === "string").map((line) => line.trim()).filter((line) => line !== "").slice(0, 64).map((line) => line.slice(0, 120));
		if (lines.length === 0) {
			onWarning("remarks slot " + key + " carries no usable lines");
			continue;
		}
		remarks[key] = lines;
	}
	return Object.keys(remarks).length === 0 ? void 0 : remarks;
}
/**
* Round-robin reaction picker over the effective pools (per-pet custom lines
* override the built-in pool per slot). Counters are per slot, so each slot
* cycles its own list independently and picks stay deterministic for tests.
*/
var RemarkPicker = class {
	counters = /* @__PURE__ */ new Map();
	pools;
	constructor(overrides) {
		this.pools = {};
		for (const kind of REMARK_KINDS) {
			const custom = overrides?.[kind];
			this.pools[kind] = custom !== void 0 && custom.length > 0 ? custom : BUILTIN_REMARKS[kind];
		}
	}
	/** The effective pool for one slot (custom override or built-in). */
	pool(kind) {
		return this.pools[kind];
	}
	/** The next line for one slot (round-robin within its pool). */
	pick(kind) {
		const pool = this.pools[kind];
		const index = (this.counters.get(kind) ?? 0) % pool.length;
		this.counters.set(kind, index + 1);
		return pool[index];
	}
	/** Select a line from a stable external counter without changing local picker state. */
	pickAt(kind, count) {
		const pool = this.pools[kind];
		return pool[Math.max(0, Math.floor(count)) % pool.length];
	}
};
//#endregion
//#region src/affinity.ts
/**
* Affinity score — pure, clock-injected. The pet grows closer the more you
* work together and care for it: every completed turn earns a small reward,
* petting earns a tiny one (cooldown-gated), feeding earns the most.
* Persistence lives in the service; this module only computes transitions.
* Reaction copy resolves from the shared remark library (first line of each
* built-in pool); the ledger layers per-pet custom remarks on top.
* @module @linxin666/dsh-pet/affinity
*/
/**
* Affinity points cap. Historically 100; removed so long-term companions
* keep growing — the default limit is now the full 999,999,999 range.
*/
const AFFINITY_MAX = 999999999;
/** Affinity ranks by points; the pet visibly grows with its rank.
*  The original four tiers (0/25/50/80) are unchanged; higher tiers reach
*  into the extended cap so the ladder stays meaningful for veteran
*  companions. Marker glyphs are plain ASCII (the repo bans all emoji
*  characters); they read as a growing star trail alongside the rank name. */
const AFFINITY_RANKS = [
	{
		min: 0,
		name: "幼鲸",
		emoji: "*"
	},
	{
		min: 25,
		name: "伙伴",
		emoji: "**"
	},
	{
		min: 50,
		name: "挚友",
		emoji: "***"
	},
	{
		min: 80,
		name: "深海羁绊",
		emoji: "****"
	},
	{
		min: 200,
		name: "心有灵犀",
		emoji: "*****"
	},
	{
		min: 500,
		name: "传说羁绊",
		emoji: "******"
	},
	{
		min: 2e3,
		name: "神话羁绊",
		emoji: "*******"
	},
	{
		min: 1e4,
		name: "永恒之契",
		emoji: "********"
	},
	{
		min: 1e5,
		name: "鲸生共渡",
		emoji: "*********"
	}
];
const defaultAffinityConfig = {
	turnReward: 1,
	petReward: 1,
	petCooldownMs: 1e4,
	feedReward: 5,
	feedCooldownMs: 3e4
};
function emptyAffinity() {
	return {
		points: 0,
		lastPetAt: 0,
		lastFeedAt: 0,
		pets: 0,
		feeds: 0,
		petRejects: 0,
		feedRejects: 0,
		turns: 0
	};
}
/** Rank for a point total. */
function rankOf(points) {
	let rank = AFFINITY_RANKS[0];
	for (const candidate of AFFINITY_RANKS) if (points >= candidate.min) rank = candidate;
	return rank;
}
/** Derive the read-only view of one affinity state at a wall-clock instant. */
function affinityViewOf(state, nowMs, config = defaultAffinityConfig) {
	const rank = rankOf(state.points);
	return {
		points: state.points,
		rank: rank.name,
		rankEmoji: rank.emoji,
		pets: state.pets,
		feeds: state.feeds,
		turns: state.turns,
		petCooldown: nowMs - state.lastPetAt < config.petCooldownMs,
		feedCooldown: nowMs - state.lastFeedAt < config.feedCooldownMs
	};
}
function clamp(points) {
	return Math.min(AFFINITY_MAX, Math.max(0, points));
}
/** Built-in reaction selected deterministically from a persisted counter. */
function countedRemark(kind, count) {
	const pool = BUILTIN_REMARKS[kind];
	return pool[Math.max(0, Math.floor(count)) % pool.length] ?? builtinRemark(kind);
}
/**
* Apply one interaction to a copy of the state (immutable style: returns a
* new object; the caller replaces the persisted state). Cooldowns only
* apply once the pet has been interacted with at least once (last*At === 0
* means "never", so the first pet/feed always lands).
*/
function applyInteraction(state, kind, nowMs, config = defaultAffinityConfig) {
	const next = { ...state };
	if (kind === "pet") {
		if (state.lastPetAt !== 0 && nowMs - state.lastPetAt < config.petCooldownMs) {
			next.petRejects += 1;
			return {
				affinity: next,
				delta: 0,
				reaction: countedRemark("petCooldown", state.petRejects),
				accepted: false
			};
		}
		next.lastPetAt = nowMs;
		next.pets += 1;
		next.points = clamp(state.points + config.petReward);
		return {
			affinity: next,
			delta: config.petReward,
			reaction: countedRemark("pet", state.pets),
			accepted: true
		};
	}
	if (kind === "feed") {
		if (state.lastFeedAt !== 0 && nowMs - state.lastFeedAt < config.feedCooldownMs) {
			next.feedRejects += 1;
			return {
				affinity: next,
				delta: 0,
				reaction: countedRemark("feedCooldown", state.feedRejects),
				accepted: false
			};
		}
		next.lastFeedAt = nowMs;
		next.feeds += 1;
		next.points = clamp(state.points + config.feedReward);
		return {
			affinity: next,
			delta: config.feedReward,
			reaction: countedRemark("feed", state.feeds),
			accepted: true
		};
	}
	return {
		affinity: state,
		delta: 0,
		reaction: "",
		accepted: false
	};
}
/** Reward one completed turn (called by the host on `done`). */
function applyTurnReward(state, config = defaultAffinityConfig) {
	const next = { ...state };
	next.turns += 1;
	next.points = clamp(state.points + config.turnReward);
	return next;
}
//#endregion
//#region src/state.ts
const defaultPetStateConfig = {
	celebrateMs: 2400,
	failureMs: 2400
};
/**
* Map one activity phase onto the animation contract.
* - thinking → `running` and tool → `running-right` (focused work).
* - review → `review` while answer text is streaming.
* - waiting → `waiting` (expectant pose, needs user input).
* - done → `jumping` (celebration), then back to `idle` after the window.
* - failed → `failed` briefly, then back to `idle`.
* - idle → `idle` (calm breathing loop).
*/
function animationForPhase(phase) {
	switch (phase) {
		case "thinking": return "running";
		case "tool": return "running-right";
		case "review": return "review";
		case "waiting": return "waiting";
		case "done": return "jumping";
		case "failed": return "failed";
		case "idle": return "idle";
	}
}
/** The spritesheet row index for one animation track. */
function rowOf(animation) {
	return {
		"idle": 0,
		"running-right": 1,
		"running-left": 2,
		"waving": 3,
		"jumping": 4,
		"failed": 5,
		"waiting": 6,
		"running": 7,
		"review": 8
	}[animation];
}
/**
* PetStateMachine — one instance per host process. Holds only the latest
* input snapshot and terminal-state timing; no storage, no side effects.
*/
var PetStateMachine = class {
	now;
	phase = "idle";
	line;
	phrase;
	sessionActive = false;
	doneAt;
	failedAt;
	config;
	constructor(config = defaultPetStateConfig, now = Date.now) {
		this.now = now;
		this.config = {
			...defaultPetStateConfig,
			...config
		};
	}
	/** Consume one projected activity update. */
	onActivityStatus(input) {
		this.phase = input.phase;
		this.line = input.line;
		this.phrase = input.phrase;
		this.doneAt = input.phase === "done" ? this.now() : void 0;
		this.failedAt = input.phase === "failed" ? this.now() : void 0;
	}
	/** A session became the active one (or a fresh session started). */
	onSessionActive() {
		this.sessionActive = true;
	}
	/** The active session was disposed (or none left). */
	onSessionDisposed() {
		this.sessionActive = false;
		this.phase = "idle";
		this.line = void 0;
		this.phrase = void 0;
		this.doneAt = void 0;
		this.failedAt = void 0;
	}
	/** Render the current animation decision. */
	render() {
		const nowMs = this.now();
		let animation = animationForPhase(this.phase);
		const doneSettled = this.phase === "done" && this.doneAt !== void 0 && nowMs - this.doneAt >= this.config.celebrateMs;
		const failedSettled = this.phase === "failed" && this.failedAt !== void 0 && nowMs - this.failedAt >= this.config.failureMs;
		if (doneSettled || failedSettled) animation = "idle";
		const bubble = this.phase === "idle" || doneSettled || failedSettled ? void 0 : this.phrase ?? this.line;
		return {
			animation,
			...bubble === void 0 ? {} : { bubble },
			animationStartedAt: nowMs,
			phase: this.phase,
			sessionActive: this.sessionActive
		};
	}
};
//#endregion
export { RemarkPicker as _, AFFINITY_MAX as a, applyInteraction as c, emptyAffinity as d, rankOf as f, REMARK_LINE_MAX as g, REMARK_LINES_MAX as h, rowOf as i, applyTurnReward as l, REMARK_KINDS as m, animationForPhase as n, AFFINITY_RANKS as o, BUILTIN_REMARKS as p, defaultPetStateConfig as r, affinityViewOf as s, PetStateMachine as t, defaultAffinityConfig as u, builtinRemark as v, normalizePetRemarks as y };
