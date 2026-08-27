import { _ as RemarkPicker, a as AFFINITY_MAX, c as applyInteraction, d as emptyAffinity, f as rankOf, g as REMARK_LINE_MAX, h as REMARK_LINES_MAX, i as rowOf, l as applyTurnReward, m as REMARK_KINDS, n as animationForPhase, o as AFFINITY_RANKS, p as BUILTIN_REMARKS, r as defaultPetStateConfig, s as affinityViewOf, t as PetStateMachine, u as defaultAffinityConfig, v as builtinRemark, y as normalizePetRemarks } from "./state-DrMX22GL.js";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "schemastery";
import { Service } from "@deepseek-ai/cordis";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
//#region src/chatter.ts
/** While a scene persists, its copy advances on this cadence (ms). */
const STATUS_ROTATE_MS = 4e3;
/** Fixed-copy pools per status scene (first line = legacy wording). */
const STATUS_POOLS = {
	prepare: [
		"准备开始",
		"撸起袖子开工啦",
		"新一轮，出发～",
		"打起精神，开干！",
		"整理一下桌面，开始吧",
		"氧气充满，下潜开始～",
		"热身完毕，跃跃欲试",
		"开工仪式感已就位"
	],
	waiting: [
		"等待模型响应",
		"呼叫大脑中，请稍等",
		"信号发射中，等一个回音",
		"灵感正在路上～",
		"竖起耳朵等回复",
		"大脑在咕噜咕噜加载",
		"等它伸个懒腰再开口",
		"模型：来了来了",
		"等一个灵感砸中我",
		"滴——等待连线中",
		"它在组织语言，别催",
		"等它热身完毕",
		"灵感快递派送中",
		"屏住呼吸等回复"
	],
	thinking: [
		"正在思考",
		"嗯……让我想一想",
		"脑内风暴进行中",
		"思绪咕噜咕噜冒泡",
		"灵光集结中～",
		"眉头一皱，认真分析",
		"左脑右脑一起开会",
		"答案正在浮出水面",
		"盘一下，盘一下逻辑",
		"让子弹再飞一会儿",
		"别催别催，在想呢",
		"大脑转起来了",
		"让我把线索捋一捋",
		"脑内跑火车中",
		"小脑瓜高速运转",
		"让我琢磨琢磨",
		"翻翻脑子里的藏书",
		"让我嚼一嚼这个问题",
		"脑子在煮咖啡，马上好",
		"思考的鱼游来了",
		"让我康康这里面的门道",
		"正在盘逻辑链",
		"思绪整理收纳中",
		"嗯？有点意思……",
		"让思路沉淀一下",
		"脑内弹幕飞速滚动"
	],
	review: [
		"整理回复中",
		"把想法写下来",
		"组织语言中～",
		"落笔成文，请稍候",
		"字斟句酌中",
		"把答案装进信封里",
		"遣词造句打磨中",
		"把思绪码成整整齐齐的字",
		"奋笔疾书中",
		"把最好的表达挑出来",
		"文字排版美容师上线",
		"收尾润色一下下"
	],
	toolResult: [
		"处理工具结果",
		"看看带回了什么",
		"消化一下刚到的结果",
		"结果解读中～",
		"验收工具的成果",
		"把线索拼接起来",
		"战利品清点中",
		"这份结果有点东西",
		"把新情报归档",
		"结果到手，继续前进"
	],
	done: [
		"完成啦",
		"搞定收工～",
		"任务达成，耶！",
		"这一轮圆满完成",
		"顺利抵达终点",
		"收工！求摸摸奖励",
		"交差！下一位",
		"齐活，漂亮收官",
		"拿下！击掌～",
		"稳了，满分交卷",
		"搞定，去喝口水",
		"完工咯，转个圈圈",
		"这一轮，我们配合满分",
		"妥了妥了，收工收工"
	],
	failed: [
		"执行失败",
		"哎呀，中途卡住了",
		"这一步没能走完",
		"被小石头绊倒了",
		"半路翻车了，揉揉膝盖",
		"出了点岔子，缓缓再来"
	],
	toolFailed: [
		"工具执行失败",
		"工具闹脾气了，哄哄它",
		"哎呀，工具掉链子了",
		"这个工具今天不太听话",
		"工具翻车了，扶起来继续",
		"没跑通，再来一次",
		"工具：我罢工三秒钟",
		"这一步摔了一跤，没事"
	],
	maxTokens: [
		"达到输出上限",
		"话说到一半被截断了",
		"字数用完了，喘口气",
		"一口气说太满，缓缓"
	],
	interrupted: [
		"执行意外中断",
		"哎呀，被意外打断了",
		"半路踩了急刹车",
		"被迫停下，意犹未尽"
	],
	blocked: [
		"等待继续",
		"在这里等你发令",
		"暂停待命，随时出发",
		"蹲一个继续的指令"
	]
};
/** Every status scene key, in declaration order (voice-pack key allow-list). */
const STATUS_SCENES = [
	"prepare",
	"waiting",
	"thinking",
	"review",
	"toolResult",
	"done",
	"failed",
	"toolFailed",
	"maxTokens",
	"interrupted",
	"blocked"
];
/** Every tool-family key, in declaration order (voice-pack key allow-list). */
const TOOL_CATEGORIES = [
	"read",
	"write",
	"edit",
	"shell",
	"grep",
	"find",
	"ls",
	"webSearch",
	"webFetch",
	"mcp",
	"memory",
	"subagent",
	"todo",
	"browser",
	"git",
	"ask",
	"generic"
];
/** Map a raw tool name onto its copy family (working-activity style regexes). */
function toolCategory(toolName) {
	const name = toolName.toLowerCase();
	if (/mem0|recall|memory/.test(name)) return "memory";
	if (/subagent|workflow|ralph|agent|task/.test(name)) return "subagent";
	if (/web_search|websearch|search_web|exa|brave|tavily/.test(name)) return "webSearch";
	if (/fetch|browser|playwright|chrome/.test(name)) return "webFetch";
	if (/grep|search|rg/.test(name)) return "grep";
	if (/glob|find/.test(name)) return "find";
	if (/^ls$|list_dir|list/.test(name)) return "ls";
	if (/ask_user|ask/.test(name)) return "ask";
	if (/todo|plan/.test(name)) return "todo";
	if (/git/.test(name)) return "git";
	if (/mcp__|mcp/.test(name)) return "mcp";
	if (/read|open|load|describe|inspect/.test(name)) return "read";
	if (/edit|patch|replace|rename/.test(name)) return "edit";
	if (/write|create|save/.test(name)) return "write";
	if (/run_code|bash|shell|terminal|exec|command|ssh/.test(name)) return "shell";
	return "generic";
}
/**
* Per-family tool status pools. '{tool}' interpolates the compact tool name,
* '{hint}' the compact real-argument hint (both optional per line); the first
* entry of every pool is the legacy '正在使用 {tool}' wording.
*/
const TOOL_POOLS = {
	read: [
		"正在使用 {tool}",
		"翻翻 {hint}",
		"读一下 {hint}",
		"让我康康这个文件",
		"逐行品味 {hint}",
		"翻阅资料中～",
		"瞄一眼 {hint}",
		"把文件摊开看一看",
		"认真研读 {hint}"
	],
	write: [
		"正在使用 {tool}",
		"写写写，写 {hint}",
		"下笔中～",
		"码字呢，别催",
		"写下 {hint}",
		"落笔成章",
		"把想法存进 {hint}",
		"开写开写",
		"存个文件压压惊"
	],
	edit: [
		"正在使用 {tool}",
		"改改 {hint}",
		"修修补补中",
		"润色一下 {hint}",
		"改两行，就两行",
		"补一刀 {hint}",
		"动动手指改一改",
		"精雕细琢 {hint}",
		"微调一下下"
	],
	shell: [
		"正在使用 {tool}",
		"跑跑 {hint}",
		"敲几行命令试试",
		"命令行走起：{hint}",
		"使唤终端跑个腿",
		"终端全速运转中",
		"敲回车！{hint}",
		"让命令飞一会儿",
		"去终端里探个究竟"
	],
	grep: [
		"正在使用 {tool}",
		"搜搜 {hint}",
		"找找匹配：{hint}",
		"关键词走你",
		"在代码里挖一挖",
		"检索小雷达启动",
		"顺着 {hint} 追下去",
		"掘地三尺找一找",
		"过滤筛选中～"
	],
	find: [
		"正在使用 {tool}",
		"找找文件 {hint}",
		"寻宝中～",
		"文件在哪里呀",
		"找啊找啊找文件",
		"把 {hint} 揪出来",
		"查找模式中"
	],
	ls: [
		"正在使用 {tool}",
		"列个清单看看",
		"看看目录里有啥",
		"目录走起～",
		"瞟一眼文件夹",
		"数数这里有几个文件"
	],
	webSearch: [
		"正在使用 {tool}",
		"网上搜搜 {hint}",
		"网络冲浪中",
		"帮你问问互联网",
		"搜一圈 {hint}",
		"去外面的世界打听打听",
		"查找资料中～",
		"情报收集模式开启"
	],
	webFetch: [
		"正在使用 {tool}",
		"抓个页面看看",
		"拉取 {hint}",
		"扒拉一下网页",
		"取点内容回来",
		"打开 {hint} 瞅瞅"
	],
	mcp: [
		"正在使用 {tool}",
		"连一下外部服务",
		"喊个外援来",
		"接个工具用用",
		"问问插件小助手",
		"外部力量接入中"
	],
	memory: [
		"正在使用 {tool}",
		"翻翻小本本",
		"回想一下之前的事",
		"在记忆里挖一挖",
		"提取记忆碎片～",
		"我们之前的约定是……"
	],
	subagent: [
		"正在使用 {tool}",
		"派个小弟去跑腿",
		"小助手出动！",
		"交给分身去办",
		"多线作战，分身出击",
		"召唤队友支援",
		"集思广益中～"
	],
	todo: [
		"正在使用 {tool}",
		"列个待办清单",
		"写个小计划",
		"待办安排得明明白白",
		"打个勾，继续",
		"把任务排排坐"
	],
	browser: [
		"正在使用 {tool}",
		"开个浏览器看看",
		"网页操作小能手",
		"替你点点页面",
		"浏览器跑腿中"
	],
	git: [
		"正在使用 {tool}",
		"提交一下代码",
		"版本控制走起",
		"管管仓库",
		"给改动安个家"
	],
	ask: [
		"正在使用 {tool}",
		"问你个事儿",
		"请教一下下",
		"等等，我需要确认",
		"这个问题得你拍板"
	],
	generic: [
		"正在使用 {tool}",
		"召唤 {tool} 出击",
		"{tool} 工作中",
		"借助 {tool} 的力量",
		"拜托 {tool} 一下",
		"{tool}，启动！"
	]
};
/** Pools for the parallel-tools line; '{n}' interpolates the running count. */
const TOOL_REMAINING_POOL = [
	"还有 {n} 个工具运行中",
	"{n} 路并进，分身们还在忙",
	"还有 {n} 位小助手在加班",
	"{n} 条战线同时推进中",
	"另 {n} 个工具在后台跑"
];
/**
* A compact, human-readable hint of what a tool call actually touches —
* the command, the path, the pattern, the query. Best-effort parse of the
* raw arguments JSON; unknown shapes stay hintless. Capped short so the
* bubble stays compact.
*/
function toolArgHint(toolName, argumentsJson) {
	let args;
	try {
		args = JSON.parse(argumentsJson);
	} catch {
		return;
	}
	if (typeof args !== "object" || args === null || Array.isArray(args)) return void 0;
	const record = args;
	const category = toolCategory(toolName);
	const candidateKeys = (() => {
		switch (category) {
			case "shell": return [
				"command",
				"code",
				"cmd"
			];
			case "grep": return [
				"pattern",
				"query",
				"path"
			];
			case "find": return [
				"pattern",
				"path",
				"glob"
			];
			case "read":
			case "write":
			case "edit": return [
				"file_path",
				"path",
				"filePath",
				"file"
			];
			case "webSearch": return [
				"query",
				"q",
				"keyword"
			];
			case "webFetch":
			case "browser": return ["url", "uri"];
			case "subagent": return [
				"description",
				"label",
				"prompt"
			];
			case "ls": return [
				"path",
				"dir",
				"directory"
			];
			case "git": return ["command", "message"];
			default: return [
				"command",
				"query",
				"path",
				"file_path",
				"description",
				"title",
				"name"
			];
		}
	})();
	for (const key of candidateKeys) {
		const value = record[key];
		if (typeof value !== "string") continue;
		const compact = value.replace(/\s+/g, " ").trim();
		if (compact === "") continue;
		const base = compact.split("/").pop() ?? compact;
		const shown = (category === "read" || category === "write" || category === "edit") && base !== "" ? base : compact;
		return shown.length <= 28 ? shown : shown.slice(0, 25) + "...";
	}
}
/**
* Round-robin voice for status copy. Scene-keyed picks stay STABLE while the
* same scene repeats (streaming chunks re-emit the same phase many times per
* second, and rotating per chunk would make the bubble flicker), but advance
* once the scene has persisted past the rotation cadence, so a long thinking
* stretch keeps changing its wording.
*/
var StatusVoice = class {
	pools;
	rotateMs;
	counters = /* @__PURE__ */ new Map();
	lastScene = "";
	lastLine = "";
	lastLineAt = Number.NEGATIVE_INFINITY;
	constructor(pools = () => BUILTIN_VOICE_PACK, rotateMs = STATUS_ROTATE_MS) {
		this.pools = pools;
		this.rotateMs = rotateMs;
	}
	/** Draw the next line of one pool, advancing its round-robin cursor. */
	draw(poolKey, pool) {
		const index = (this.counters.get(poolKey) ?? 0) % pool.length;
		this.counters.set(poolKey, index + 1);
		return pool[index];
	}
	/** Reuse the stable line or advance when the cadence elapsed. */
	voice(scene, poolKey, pool, nowMs) {
		if (scene === this.lastScene && nowMs - this.lastLineAt < this.rotateMs) return this.lastLine;
		this.lastScene = scene;
		this.lastLine = this.draw(poolKey, pool);
		this.lastLineAt = nowMs;
		return this.lastLine;
	}
	/**
	* A scene's effective pool: the voice-pack override when it carries lines,
	* else the built-in pool. Empty overrides fall back rather than blank the
	* bubble — a scene line always renders.
	*/
	scenePool(scene) {
		const override = this.pools().status?.[scene];
		return override !== void 0 && override.length > 0 ? override : STATUS_POOLS[scene];
	}
	/** Status line for a phase scene. */
	scene(scene, nowMs) {
		return this.voice("scene:" + scene, "pool:" + scene, this.scenePool(scene), nowMs);
	}
	/** Status line for a tool call, with the real-argument hint when known. */
	tool(toolName, displayName, hint, nowMs) {
		const category = toolCategory(toolName);
		const override = this.pools().tools?.[category];
		const pool = override !== void 0 && override.length > 0 ? override : TOOL_POOLS[category];
		return this.voice("tool:" + category, "tool:" + category, pool, nowMs).replaceAll("{tool}", displayName).replaceAll("{hint}", hint ?? displayName);
	}
	/** Status line while sibling tools still run (always reflects the count). */
	toolRemaining(count, nowMs) {
		const override = this.pools().toolRemaining;
		const pool = override !== void 0 && override.length > 0 ? override : TOOL_REMAINING_POOL;
		return this.voice("toolRemaining", "toolRemaining", pool, nowMs).replaceAll("{n}", String(count));
	}
};
/** Murmur pacing: cooldown between whispers and output volume that earns one. */
const WHISPER_COOLDOWN_MS = 9e3;
/** Ambient inner-whisper pool (no keyword needed; earned by output volume). */
const WHISPER_GENERIC_POOL = [
	"哼哧哼哧，大脑转得飞快～",
	"loading 99%……就差最后一步",
	"嗯……让我捋捋",
	"灵感来了，先记小本本上",
	"脑子在冒烟，但还能撑",
	"这个报错，我好像在哪见过",
	"专注模式 ON，请勿打扰",
	"思路通了，舒服了",
	"有点困……不行，还能肝",
	"让我嚼一嚼这个问题",
	"盘，都可以盘",
	"这波操作，我给自己点个赞",
	"别催别催，在想呢",
	"唔，这个细节差点漏掉",
	"脑子转太快，差点绕晕自己",
	"陪你干活，稳赚不亏",
	"深呼吸，马上就好",
	"诶，等等，好像发现了什么",
	"手速拉满，键盘冒火星",
	"摸鱼是不可能摸鱼的，就瞄一眼窗外",
	"今天也是稳扎稳打的一天",
	"把大问题拆成小饼干，一口一个",
	"这题有戏，我闻到了",
	"尾巴轻晃，心情有点小得意",
	"好结果是熬出来的，不慌",
	"啊，想岔了，重新来",
	"嗯嗯，思路对头，就这么干",
	"小本本记满了，都是干货",
	"打完这波，求摸摸奖励～",
	"这坑我记住了，下次绕道",
	"窗外云在飘，代码在跑，挺好",
	"嘘，正到关键处",
	"这个方案……让我再品品",
	"干活呢，别打扰我数数",
	"心里默默给你比了个耶",
	"思路像小鱼，逮住一条是一条",
	"嗯……有点东西，等我深挖",
	"收个尾就能喘口气了",
	"目标锁定，冲就完了",
	"嗯，这波配合不错",
	"困了……还能再战三回合",
	"思考.gif 加载中",
	"我本地能跑啊……哦，我就是干活的",
	"有点饿，小鱼干存货还够吗",
	"刚想通，一被打断又忘了，气",
	"缓冲中，请稍候",
	"这网速，比我思考还慢",
	"脑子在后台跑批",
	"内存不足，但热情够",
	"404：思路未找到，重试中",
	"这需求有点玄学，但能写",
	"诶，这 bug 还会闪现？",
	"刚说简单，结果打脸了",
	"自信满满，结果翻车",
	"这活不难，就是有点复杂",
	"我装的，其实心里没底",
	"别看我稳，我也慌",
	"假装很懂的样子，其实在查文档",
	"窗外鸟叫了两声，我听到了",
	"打了个哈欠，没人看见",
	"今天的状态：七分精神三分困",
	"刚想偷懒，又想起来你还在等",
	"数了数今天的产出，还行",
	"有点想伸懒腰",
	"饿意来袭，忍住",
	"灵感像猫一样，不追它自己来",
	"坐太久，尾巴麻了",
	"快了快了",
	"马上马上",
	"等下，我记得在哪见过",
	"呃，忘了，重新想",
	"诶，这个思路可以",
	"嗯？有意思",
	"行，就这么办",
	"好嘞",
	"收到收到",
	"冲了冲了",
	"稳",
	"妥",
	"得嘞",
	"你忙你的，我盯着呢",
	"放心，有我呢",
	"咱俩配合，无往不利",
	"你专注的样子，我默默记下了"
];
/** Keyword-triggered whisper rules, most specific moods first. */
const WHISPER_RULES = [
	{
		keywords: [
			"测试通过",
			"测试全过",
			"全部通过",
			"all tests pass",
			"tests passed",
			"test passed",
			"全绿"
		],
		pool: [
			"全绿！亮瞎我眼了",
			"测试全过，击掌～",
			"稳了稳了，这波稳得很",
			"绿灯一排排，看着就舒坦",
			"能跑！没报错！",
			"全绿，收工摸鱼去",
			"测试过了，尾巴翘上天",
			"漂亮，一次过",
			"测试过了，奖励自己一口小鱼干",
			"绿得发光，稳",
			"又双叒叕全绿",
			"这波测试，赢得干脆"
		]
	},
	{
		keywords: [
			"错误",
			"失败",
			"报错",
			"异常",
			"崩溃",
			"bug",
			"error",
			"failed",
			"exception",
			"traceback",
			"找不到",
			"不对了"
		],
		pool: [
			"哎呀，踩到小石子了",
			"翻车了……没事，扶起来继续",
			"错误是进步的脚印，我懂",
			"这报错我盯上它了",
			"我本地能跑啊？哦，我一直在跑",
			"别慌，深呼吸，先看报错",
			"bug 你站住，我看见你了",
			"绷不住了……好，继续修",
			"报错这东西，见一个修一个",
			"又是它，老熟人了",
			"问题不大，就是有点问题",
			"先别慌，我看看到底咋回事",
			"这错报得，比我还委屈",
			"修好它，今天才不算白干"
		]
	},
	{
		keywords: [
			"等等",
			"不对",
			"重新想",
			"再想想",
			"换个思路",
			"我搞错了",
			"纠正",
			"其实应该"
		],
		pool: [
			"嗯？让我再想想……",
			"推翻重来，也是种勇气",
			"发现岔路，及时掉头",
			"不对不对，重来重来",
			"自我纠错的瞬间，最帅了",
			"呃，刚说错了，收回",
			"哎，绕远了，拉回来",
			"回头一看，原来这么简单",
			"纠正完，思路清爽多了",
			"转弯不丢人，卡死才丢人"
		]
	},
	{
		keywords: [
			"首先",
			"接下来",
			"第一步",
			"第二步",
			"计划",
			"步骤",
			"todo",
			"任务拆解",
			"分工"
		],
		pool: [
			"排排坐，分果果",
			"计划通，执行开始",
			"一步一步来，不慌",
			"大任务切成小块块，好下口",
			"清单列好了，逐个击破",
			"谋定而后动，这节奏我熟",
			"先干这个，再干那个",
			"头绪理清了，开整",
			"步骤在手，心里不慌",
			"安排得明明白白"
		]
	},
	{
		keywords: [
			"终于",
			"搞定",
			"完成了",
			"解决了",
			"成功了",
			"修复了",
			"done",
			"fixed",
			"solved",
			"完成啦"
		],
		pool: [
			"太好了，又翻过一页",
			"搞定，收工～",
			"攻下一城，击掌！",
			"难题被拿下了，转个圈",
			"努力没白费，开心",
			"齐活，漂亮",
			"收工收工，今天圆满",
			"完成！心里踏实了",
			"这波，稳得一批",
			"任务清零，舒服",
			"搞定，可以伸个懒腰了",
			"又完成一件，成就感+1"
		]
	},
	{
		keywords: [
			"谢谢",
			"感谢",
			"thank"
		],
		pool: [
			"不客气呀，顺手的事",
			"被感谢了，心里甜甜的",
			"能帮上忙就好～",
			"你的谢意，我收进口袋啦",
			"这话我爱听",
			"客气啥，应该的",
			"收下这份心意，干劲+1",
			"你谢我，我谢你，扯平啦"
		]
	},
	{
		keywords: [
			"复杂",
			"棘手",
			"困难",
			"难点",
			"坑",
			"头疼",
			"tricky",
			"complex"
		],
		pool: [
			"难不倒我们俩的",
			"越难啃的骨头越香",
			"硬骨头？我最喜欢了",
			"复杂问题拆开看，小事",
			"这坑我们一起填",
			"有点东西，但不多",
			"硬骨头，慢慢啃",
			"问题越难，赢的时候越爽",
			"绕是绕不过去的，正面刚",
			"再难的题，拆开都是小问号"
		]
	},
	{
		keywords: [
			"检查",
			"审查",
			"确认一下",
			"核对",
			"review",
			"仔细看看",
			"验证"
		],
		pool: [
			"火眼金睛，启动",
			"让我仔细瞧瞧",
			"细节魔鬼，一个都不放过",
			"认真检查的样子最迷人",
			"多核一遍，稳上加稳",
			"再看一眼，不亏",
			"确认键，点了才安心",
			"细节控上线",
			"查完这遍，稳了"
		]
	},
	{
		keywords: [
			"搜索",
			"查一下",
			"资料",
			"文档",
			"搜一搜",
			"找找",
			"查询"
		],
		pool: [
			"去知识的海洋里捞一捞",
			"翻翻找找，线索快出来",
			"检索小雷达启动",
			"答案就藏在某个角落",
			"线索有点散，拼一下",
			"找东西，我最在行",
			"答案在网线那头等我",
			"翻箱倒柜中，稍等"
		]
	},
	{
		keywords: [
			"写代码",
			"实现",
			"编码",
			"函数",
			"接口",
			"重构"
		],
		pool: [
			"指尖跳舞，代码开花",
			"把逻辑织成网",
			"一行一行，垒起小城堡",
			"这代码写得，我自己都佩服",
			"码着码着，天就亮了",
			"代码跑通了，比中奖还开心",
			"这行代码，写得有点帅",
			"写完再润润，讲究"
		]
	}
];
/** The built-in voice pack: the plugin's default copy, unchanged since v1. */
const BUILTIN_VOICE_PACK = {
	status: STATUS_POOLS,
	tools: TOOL_POOLS,
	toolRemaining: TOOL_REMAINING_POOL,
	whispers: {
		generic: WHISPER_GENERIC_POOL,
		rules: WHISPER_RULES
	}
};
/**
* The murmur engine (碎碎念): watches the model's own output and lets the pet
* whisper its inner voice. Two ways to earn a whisper:
*  - a keyword rule matches the fresh chunk text (themed whisper);
*  - enough output volume flowed by without one (ambient whisper).
* A cooldown keeps whispers occasional; all picks are round-robin so tests
* reproduce exact lines. The voice-pack provider (pet-center M4) swaps the
* pools at draw time, so a pet switch re-voices live engines in place.
*/
var WhisperEngine = class {
	pools;
	cooldownMs;
	charBudget;
	counters = /* @__PURE__ */ new Map();
	genericCursor = 0;
	lastWhisperAt = Number.NEGATIVE_INFINITY;
	charsSinceWhisper = 0;
	constructor(pools = () => BUILTIN_VOICE_PACK, cooldownMs = WHISPER_COOLDOWN_MS, charBudget = 420) {
		this.pools = pools;
		this.cooldownMs = cooldownMs;
		this.charBudget = charBudget;
	}
	/**
	* Effective keyword rules: an override replaces the built-in rules as a
	* whole; an explicit empty array disables keyword-triggered whispers.
	*/
	rules() {
		const override = this.pools().whispers?.rules;
		return override === void 0 ? WHISPER_RULES : override;
	}
	/** Effective ambient pool (an explicit empty array mutes ambient whispers). */
	generic() {
		const override = this.pools().whispers?.generic;
		return override === void 0 ? WHISPER_GENERIC_POOL : override;
	}
	/**
	* Feed one model-output chunk (reasoning or text). Returns the whisper to
	* show, or undefined when the moment stays quiet.
	*/
	feed(text, nowMs) {
		if (text.length === 0) return void 0;
		if (!(nowMs - this.lastWhisperAt >= this.cooldownMs)) {
			this.charsSinceWhisper += text.length;
			return;
		}
		const haystack = text.toLowerCase();
		const rules = this.rules();
		for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
			const rule = rules[ruleIndex];
			if (!rule.keywords.some((keyword) => haystack.includes(keyword))) continue;
			const index = (this.counters.get(ruleIndex) ?? 0) % rule.pool.length;
			this.counters.set(ruleIndex, index + 1);
			return this.speak(rule.pool[index], nowMs);
		}
		this.charsSinceWhisper += text.length;
		if (this.charsSinceWhisper < this.charBudget) return void 0;
		const generic = this.generic();
		if (generic.length === 0) return void 0;
		const line = generic[this.genericCursor % generic.length];
		this.genericCursor += 1;
		return this.speak(line, nowMs);
	}
	speak(line, nowMs) {
		this.lastWhisperAt = nowMs;
		this.charsSinceWhisper = 0;
		return line;
	}
};
//#endregion
//#region src/event-projection.ts
/**
* Fresh projection runtime for a newly seen session. The optional voice-pack
* provider (pet-center M4, issue #677) hands both chatter engines their
* pools; engines resolve overrides at draw time, so swapping the provider's
* pack re-voices live runtimes without rebuilding them.
*/
function emptyProjectionRuntime(pools) {
	return {
		activeTools: /* @__PURE__ */ new Set(),
		officialEventsSeen: false,
		stepHadFailure: false,
		voice: new StatusVoice(pools),
		whispers: new WhisperEngine(pools)
	};
}
/** Keep tool names readable inside the compact status bubble. */
function displayToolName(name) {
	const compact = name.replace(/\s+/g, " ").trim() || "工具";
	return compact.length <= 24 ? compact : compact.slice(0, 21) + "...";
}
/** Whether a legacy phase is part of the pet's supported vocabulary. */
function isActivityPhase(phase) {
	return [
		"idle",
		"waiting",
		"thinking",
		"tool",
		"review",
		"done",
		"failed"
	].includes(phase);
}
/**
* Project the durable DSH session vocabulary into the pet's visual phases.
* Unknown and log-only events do not disturb the last meaningful activity.
* @param nowMs - injected wall clock for copy rotation and whisper pacing.
*/
function projectOfficialEvent(event, runtime, nowMs = Date.now()) {
	switch (event.type) {
		case "turn/start":
			runtime.activeTools.clear();
			runtime.stepHadFailure = false;
			return { input: {
				phase: "waiting",
				line: runtime.voice.scene("prepare", nowMs)
			} };
		case "step/start":
			runtime.activeTools.clear();
			runtime.stepHadFailure = false;
			return { input: {
				phase: "waiting",
				line: runtime.voice.scene("waiting", nowMs)
			} };
		case "assistant/chunk": {
			const { chunk } = event.data;
			if (chunk.type === "reasoning-delta" && chunk.text.length > 0) {
				const whisper = runtime.whispers.feed(chunk.text, nowMs);
				return {
					input: {
						phase: "thinking",
						line: runtime.voice.scene("thinking", nowMs)
					},
					...whisper === void 0 ? {} : { whisper }
				};
			}
			if (chunk.type === "text-delta" && chunk.text.length > 0) {
				const whisper = runtime.whispers.feed(chunk.text, nowMs);
				return {
					input: {
						phase: "review",
						line: runtime.voice.scene("review", nowMs)
					},
					...whisper === void 0 ? {} : { whisper }
				};
			}
			return;
		}
		case "assistant/message": return { input: {
			phase: "review",
			line: runtime.voice.scene("review", nowMs)
		} };
		case "tool/call":
			runtime.activeTools.add(String(event.data.callId));
			return { input: {
				phase: "tool",
				line: runtime.voice.tool(event.data.name, displayToolName(event.data.name), toolArgHint(event.data.name, event.data.arguments), nowMs)
			} };
		case "tool/result": {
			const block = event.data.message.content[0];
			runtime.activeTools.delete(String(event.data.message.source.callId));
			runtime.stepHadFailure ||= event.data.error !== void 0 || block.isError === true;
			if (runtime.activeTools.size > 0) return { input: {
				phase: "tool",
				line: runtime.voice.toolRemaining(runtime.activeTools.size, nowMs)
			} };
			return runtime.stepHadFailure ? { input: {
				phase: "failed",
				line: runtime.voice.scene("toolFailed", nowMs)
			} } : { input: {
				phase: "thinking",
				line: runtime.voice.scene("toolResult", nowMs)
			} };
		}
		case "turn/end":
			runtime.activeTools.clear();
			switch (event.data.reason.kind) {
				case "completed": return {
					input: {
						phase: "done",
						line: runtime.voice.scene("done", nowMs)
					},
					completedTurn: event.data.turn
				};
				case "error": return { input: {
					phase: "failed",
					line: runtime.voice.scene("failed", nowMs)
				} };
				case "max-tokens": return { input: {
					phase: "failed",
					line: runtime.voice.scene("maxTokens", nowMs)
				} };
				case "interrupted": return { input: {
					phase: "failed",
					line: runtime.voice.scene("interrupted", nowMs)
				} };
				case "blocked": return { input: {
					phase: "waiting",
					line: runtime.voice.scene("blocked", nowMs)
				} };
				case "aborted": return { input: { phase: "idle" } };
				default: return { input: { phase: "idle" } };
			}
		default: return;
	}
}
//#endregion
//#region src/treats.ts
const defaultTreatConfig = {
	turnsPerTreat: 30,
	timeTreatMs: 300 * 6e4,
	maxTreats: 20
};
function emptyTreatLedger() {
	return {
		treats: 0,
		lastTreatGrantAt: 0,
		turnsAtLastTreatGrant: 0
	};
}
function cap(treats, max) {
	return Math.min(max, Math.max(0, treats));
}
/**
* Settle treat grants from both sources against one ledger snapshot.
* Work output counts whole periods since the last work settlement
* (turnsDelta / turnsPerTreat) and advances only the work anchor;
* time output counts whole periods since the time anchor
* (`lastTreatGrantAt`) and advances only the time anchor. The two sources
* are independent so a continuously working user still earns time treats.
* 0 time history never backfills — the clock starts at the first settlement,
* and even a zero-gain first settlement writes the time anchor so the next
* elapsed period can accrue (anchor deadlock fix). Both sources are clamped
* by the stock cap. When the anchor is already set and nothing is due, the
* input ledger is returned unchanged (same object), so callers can skip
* persistence cheaply.
*/
function settleTreatGrants(ledger, turns, nowMs, config = defaultTreatConfig) {
	const turnDelta = Math.max(0, turns - ledger.turnsAtLastTreatGrant);
	const workGrants = Math.floor(turnDelta / config.turnsPerTreat);
	const timeAnchor = ledger.lastTreatGrantAt === 0 ? nowMs : ledger.lastTreatGrantAt;
	const timeGrants = Math.floor(Math.max(0, nowMs - timeAnchor) / config.timeTreatMs);
	const gained = workGrants + timeGrants;
	if (gained <= 0) {
		if (ledger.lastTreatGrantAt === 0) return {
			ledger: {
				...ledger,
				lastTreatGrantAt: nowMs
			},
			gained: 0
		};
		return {
			ledger,
			gained: 0
		};
	}
	return {
		ledger: {
			treats: cap(ledger.treats + gained, config.maxTreats),
			lastTreatGrantAt: timeGrants > 0 ? timeAnchor + timeGrants * config.timeTreatMs : timeAnchor,
			turnsAtLastTreatGrant: workGrants > 0 ? turns - turnDelta % config.turnsPerTreat : ledger.turnsAtLastTreatGrant
		},
		gained
	};
}
/**
* Consume one treat for a feed. Returns the outcome; a feed with no stocked
* treats is refused.
*/
function consumeTreat(ledger) {
	if (ledger.treats <= 0) return { ok: false };
	return {
		ok: true,
		ledger: {
			...ledger,
			treats: ledger.treats - 1
		}
	};
}
//#endregion
//#region src/ledger.ts
/**
* Pet affinity economy (ledger) — composes the pure affinity and treats
* modules with the cooldown/dedup bookkeeping and emits updated persistence
* snapshots, marking dirty so the owning facade decides when to flush. Read
* paths (view) no longer settle the economy; settlements happen on explicit
* economic events: completed-turn rewards (official or legacy) and feeds.
* @module @linxin666/dsh-pet/ledger
*/
/**
* Holds the current persistence snapshot and all economy bookkeeping. Every
* mutating call flags takeDirty so the facade persists exactly once per
* batch of changes; read methods (snapshot, affinityView) never write.
*/
var PetLedger = class {
	affinityConfig;
	treatConfig;
	/** Round-robin reaction picker; rebuilt when the selected pet changes. */
	picker;
	current;
	/** Completed turns already rewarded, per session (turn numbers are per-session). */
	rewardedTurns = /* @__PURE__ */ new Map();
	lastLegacyTurnRewardAt = 0;
	dirty = false;
	constructor(persist, config = {}) {
		this.affinityConfig = {
			...defaultAffinityConfig,
			...config.affinity ?? {}
		};
		this.treatConfig = {
			...defaultTreatConfig,
			...config.treats ?? {}
		};
		this.picker = new RemarkPicker(config.remarks);
		this.current = persist;
	}
	/** Affinity cooldown/rank tuning (read-only). */
	get affinity() {
		return this.affinityConfig;
	}
	/** The current persistence snapshot (trade a copy when mutating). */
	get snapshot() {
		return this.current;
	}
	/** Stock cap reported to clients. */
	get treatMax() {
		return this.treatConfig.maxTreats;
	}
	/** Consume the pending-write flag if any mutation occurred. */
	takeDirty() {
		const was = this.dirty;
		this.dirty = false;
		return was;
	}
	/**
	* Drop a session's rewarded-turn bookkeeping once that session is disposed,
	* so the per-session map does not grow without bound.
	*/
	forgetSession(sessionId) {
		this.rewardedTurns.delete(sessionId);
	}
	/** Replace the display block (clamping stays a caller concern). */
	setDisplay(display) {
		this.current = {
			...this.current,
			display
		};
		this.dirty = true;
	}
	/** Replace the selected pet id (validation stays a caller concern). */
	setPetId(petId) {
		if (this.current.petId === petId) return;
		this.current = {
			...this.current,
			petId
		};
		this.dirty = true;
	}
	/** Replace one pet's display name (validation stays a caller concern). */
	setPetName(petId, name) {
		this.current = {
			...this.current,
			names: {
				...this.current.names,
				[petId]: name
			}
		};
		this.dirty = true;
	}
	/**
	* Swap the reaction pools to another pet's custom remarks (called on pet
	* selection). Slots the pet does not declare fall back to built-ins.
	*/
	setRemarks(remarks) {
		this.picker = new RemarkPicker(remarks);
	}
	/**
	* Settle the treat economy (work + time output since the last settlement).
	* A zero-gain first settlement still starts the time clock (anchor write),
	* which is how the time output can ever accrue. Returns true when
	* the in-memory ledger changed and should be persisted.
	*/
	settleTreats(nowMs) {
		const settlement = settleTreatGrants(this.current.treats, this.current.affinity.turns, nowMs, this.treatConfig);
		if (settlement.ledger === this.current.treats) return false;
		this.current = {
			...this.current,
			treats: settlement.ledger
		};
		this.dirty = true;
		return true;
	}
	/**
	* Award the completed-turn reward once per session+turn (idempotent) and
	* run the treat settlement that work output feeds. Returns true when the
	* snapshot changed.
	*/
	rewardTurn(sessionId, turn, nowMs) {
		if (turn <= (this.rewardedTurns.get(sessionId) ?? 0)) return false;
		this.rewardedTurns.set(sessionId, turn);
		let changed = this.applyTurnReward();
		if (this.settleTreats(nowMs)) changed = true;
		return changed;
	}
	/** Preserve turn rewards for installations that only emit legacy activity. */
	rewardLegacyTurn(nowMs) {
		if (nowMs - this.lastLegacyTurnRewardAt < 5e3) return false;
		this.lastLegacyTurnRewardAt = nowMs;
		let changed = this.applyTurnReward();
		if (this.settleTreats(nowMs)) changed = true;
		return changed;
	}
	applyTurnReward() {
		this.current = {
			...this.current,
			affinity: applyTurnReward(this.current.affinity, this.affinityConfig)
		};
		this.dirty = true;
		return true;
	}
	/**
	* Pet or feed the pet. Feeding settles first, then gates on the feed
	* cooldown before spending stock — a feed inside the cooldown must not burn
	* a treat for nothing.
	*/
	interact(kind, nowMs) {
		if (kind === "feed") this.settleTreats(nowMs);
		const before = this.current.affinity;
		const outcome = applyInteraction(before, kind, nowMs, this.affinityConfig);
		if (kind === "feed" && !outcome.accepted) {
			this.current = {
				...this.current,
				affinity: outcome.affinity
			};
			this.dirty = true;
			return {
				reaction: this.picker.pickAt("feedCooldown", before.feedRejects),
				delta: 0,
				affinity: this.affinityView(nowMs)
			};
		}
		if (kind === "feed") {
			const consume = consumeTreat(this.current.treats);
			if (!consume.ok) return {
				reaction: this.picker.pick("noTreats"),
				delta: 0,
				affinity: this.affinityView(nowMs)
			};
			this.current = {
				...this.current,
				treats: consume.ledger
			};
			this.dirty = true;
		}
		this.current = {
			...this.current,
			affinity: outcome.affinity
		};
		this.dirty = true;
		const count = kind === "pet" ? outcome.accepted ? before.pets : before.petRejects : before.feeds;
		return {
			reaction: this.picker.pickAt(outcome.accepted ? kind : "petCooldown", count),
			delta: outcome.delta,
			affinity: this.affinityView(nowMs)
		};
	}
	/** Current affinity view for the RPC snapshot. */
	affinityView(nowMs) {
		return affinityViewOf(this.current.affinity, nowMs, this.affinityConfig);
	}
};
//#endregion
//#region src/dsh-home.ts
/**
* DSH_HOME resolution shared by the plugin family's Host halves: the
* environment override wins, the platform home fallback follows. Mirrors
* what dsh-pet and dsh-liangshen each used to implement locally.
*/
/** Expand a leading ~ (or ~user) in a path, platform-style. */
function expandHome(path, home = homedir()) {
	if (path === "~") return home;
	if (path.startsWith("~/") || path.startsWith("~\\")) return join(home, path.slice(2));
	return path;
}
/**
* Resolve the DSH home directory.
* @param env - process environment to read DSH_HOME from.
* @param home - platform home directory fallback (test seam).
* @returns the absolute DSH home path.
*/
function resolveDshHome(env = process.env, home = homedir()) {
	const raw = env.DSH_HOME;
	if (raw !== void 0 && raw.trim() !== "") {
		const expanded = expandHome(raw.trim(), home);
		return isAbsolute(expanded) ? expanded : join(process.cwd(), expanded);
	}
	return join(home, ".dsh");
}
/** Resolve the DSH home directory from the live environment. */
function dshHome() {
	return resolveDshHome();
}
//#endregion
//#region src/persist.ts
/**
* Pet persistence — tiny JSON store for affinity + display config, written
* under $DSH_HOME (defaults to ~/.dsh) as `pet.json`. Deliberately minimal:
* one file, atomic rename write, tolerant read (corrupt file → defaults).
* @module @linxin666/dsh-pet/persist
*/
const defaultDisplayConfig = {
	visible: true,
	size: 160,
	right: 24,
	bottom: 120
};
const DISPLAY_INSET_MAX = 1e4;
/** Pet id the legacy single-pet installs resolve to on migration. */
const DEFAULT_PET_ID = "whale-girl";
/** Default pet name (used only when a manifest carries no displayName). */
const DEFAULT_PET_NAME = "鲸鱼娘";
/** Name constraints. */
const PET_NAME_MAX_LENGTH = 20;
function emptyPersist() {
	return {
		petId: DEFAULT_PET_ID,
		names: {},
		affinity: emptyAffinity(),
		treats: emptyTreatLedger(),
		display: { ...defaultDisplayConfig }
	};
}
/**
* Resolve the persistence directory ($DSH_HOME or ~/.dsh). Delegates to the
* shared {@link dshHome} resolution so the plugin family keeps one DSH_HOME
* definition (env override, ~ expansion, cwd-joined relative values).
*/
function petHomeDir() {
	return dshHome();
}
/** Numeric field guard: finite numbers only, else the fallback. */
function finiteNum(value, fallback) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
/** Sanitize the per-pet names map (string keys, non-empty trimmed values). */
function loadPetNames(parsed) {
	const names = {};
	if (typeof parsed.names !== "object" || parsed.names === null) return names;
	for (const [id, value] of Object.entries(parsed.names)) {
		if (id === "" || typeof value !== "string") continue;
		const name = value.trim();
		if (name === "") continue;
		names[id] = name.slice(0, 20);
	}
	return names;
}
/** Clamp one count/score into [0, max]. */
function clamp(value, max) {
	return Math.min(max, Math.max(0, value));
}
/** Load persisted state; missing or corrupt files fall back to defaults. */
function loadPetPersist(dir = petHomeDir()) {
	try {
		const raw = readFileSync(join(dir, "pet.json"), "utf8");
		const parsed = JSON.parse(raw);
		const base = emptyPersist();
		const rawAffinity = parsed.affinity ?? {};
		const affinity = {
			points: clamp(finiteNum(rawAffinity.points, 0), AFFINITY_MAX),
			lastPetAt: clamp(finiteNum(rawAffinity.lastPetAt, 0), Number.MAX_SAFE_INTEGER),
			lastFeedAt: clamp(finiteNum(rawAffinity.lastFeedAt, 0), Number.MAX_SAFE_INTEGER),
			pets: clamp(finiteNum(rawAffinity.pets, 0), Number.MAX_SAFE_INTEGER),
			feeds: clamp(finiteNum(rawAffinity.feeds, 0), Number.MAX_SAFE_INTEGER),
			petRejects: clamp(finiteNum(rawAffinity.petRejects, 0), Number.MAX_SAFE_INTEGER),
			feedRejects: clamp(finiteNum(rawAffinity.feedRejects, 0), Number.MAX_SAFE_INTEGER),
			turns: clamp(finiteNum(rawAffinity.turns, 0), Number.MAX_SAFE_INTEGER)
		};
		const rawTreats = parsed.treats ?? {};
		const treats = {
			treats: clamp(finiteNum(rawTreats.treats, 0), defaultTreatConfig.maxTreats),
			lastTreatGrantAt: clamp(finiteNum(rawTreats.lastTreatGrantAt, 0), Number.MAX_SAFE_INTEGER),
			turnsAtLastTreatGrant: clamp(finiteNum(rawTreats.turnsAtLastTreatGrant, 0), Number.MAX_SAFE_INTEGER)
		};
		const rawDisplay = parsed.display ?? {};
		const display = {
			visible: typeof rawDisplay.visible === "boolean" ? rawDisplay.visible : base.display.visible,
			size: Math.round(Math.min(512, Math.max(32, finiteNum(rawDisplay.size, base.display.size)))),
			right: Math.round(clamp(finiteNum(rawDisplay.right, base.display.right), DISPLAY_INSET_MAX)),
			bottom: Math.round(clamp(finiteNum(rawDisplay.bottom, base.display.bottom), DISPLAY_INSET_MAX))
		};
		const petId = typeof parsed.petId === "string" && parsed.petId.trim() !== "" ? parsed.petId.trim() : base.petId;
		const names = loadPetNames(parsed);
		if (typeof parsed.name === "string" && parsed.name.trim() !== "" && names[petId] === void 0) names[petId] = parsed.name.trim().slice(0, 20);
		return {
			petId,
			names,
			affinity,
			treats,
			display
		};
	} catch {
		return emptyPersist();
	}
}
/** Atomically persist state (write temp + rename). */
function savePetPersist(data, dir = petHomeDir()) {
	mkdirSync(dir, { recursive: true });
	const target = join(dir, "pet.json");
	const tmp = `${target}.tmp`;
	writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
	renameSync(tmp, target);
}
/** Hover-panel action buttons a pack can show or hide (canonical order). */
const PANEL_ACTIONS = [
	"feed",
	"rename",
	"hide"
];
/** Panel label slots (unset slots keep the client's i18n dictionary copy). */
const PANEL_LABEL_KEYS = [
	"feed",
	"rename",
	"hide",
	"confirm"
];
/** Panel stat slots ({rank}/{n}/{points} interpolate the live values). */
const PANEL_STAT_KEYS = [
	"rank",
	"treats",
	"points"
];
/** Any '{token}' placeholder (no nesting, no newlines). */
const PLACEHOLDER_PATTERN = /{[^{}]*}/g;
/** Allowed placeholder tokens per pool kind (absent kind = none allowed). */
const PLACEHOLDER_WHITELIST = {
	tools: ["{tool}", "{hint}"],
	toolRemaining: ["{n}"],
	stat: [
		"{rank}",
		"{n}",
		"{points}"
	]
};
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Trim, length-cap and placeholder-check one copy line; undefined to drop. */
function normalizeLine(raw, kind, onWarning) {
	const trimmed = raw.trim();
	if (trimmed === "") return void 0;
	let capped = trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
	const dangling = capped.lastIndexOf("{");
	if (dangling !== -1 && capped.indexOf("}", dangling) === -1) {
		onWarning("line cut at an unterminated placeholder; tail dropped: " + capped.slice(0, 40) + "...");
		capped = capped.slice(0, dangling);
	}
	if (capped === "") return void 0;
	const allowed = PLACEHOLDER_WHITELIST[kind];
	const tokens = capped.match(PLACEHOLDER_PATTERN) ?? [];
	for (const token of tokens) {
		if (allowed?.includes(token) === true) continue;
		const preview = capped.length > 40 ? capped.slice(0, 40) + "..." : capped;
		onWarning("line dropped (unsupported placeholder " + token + "): " + preview);
		return;
	}
	return capped;
}
/**
* Normalize one pool slot. Accepts a single line or an array; non-string
* entries warn and drop, empty lines drop silently, lines over the length
* cap truncate, illegal placeholders drop the line, and pools over the line
* cap keep their first lines. An explicit empty pool normalizes to [] (the
* whisper channels read that as mute) while an absent slot normalizes to
* undefined (the slot keeps the built-in pool).
*/
function normalizePool(raw, kind, onWarning = () => {}) {
	if (raw === void 0) return void 0;
	const entries = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : void 0;
	if (entries === void 0) {
		onWarning("pool must be a string or an array of strings");
		return;
	}
	if (entries.length > 64) onWarning("pool has more than 64 lines; extra lines are ignored");
	const pool = [];
	for (const entry of entries.slice(0, 64)) {
		if (typeof entry !== "string") {
			onWarning("non-string pool entry dropped");
			continue;
		}
		const line = normalizeLine(entry, kind, onWarning);
		if (line !== void 0) pool.push(line);
	}
	return pool;
}
/** Normalize the ordered keyword-rule list ([] disables the keyword channel). */
function normalizeWhisperRules(raw, onWarning = () => {}) {
	if (raw === void 0) return void 0;
	if (!Array.isArray(raw)) {
		onWarning("whispers.rules must be an array");
		return;
	}
	if (raw.length > 32) onWarning("whispers.rules has more than 32 rules; extra rules are ignored");
	const rules = [];
	for (const item of raw.slice(0, 32)) {
		if (!isRecord$2(item)) {
			onWarning("whisper rule must be an object");
			continue;
		}
		for (const key of Object.keys(item)) if (key !== "keywords" && key !== "pool") onWarning("unknown whisper rule field " + key + " ignored");
		const keywordsRaw = item.keywords;
		const keywords = [];
		if (Array.isArray(keywordsRaw)) {
			for (const entry of keywordsRaw.slice(0, 16)) {
				if (typeof entry !== "string") {
					onWarning("non-string keyword dropped");
					continue;
				}
				const trimmed = entry.trim().toLowerCase().slice(0, 40);
				if (trimmed !== "") keywords.push(trimmed);
			}
			if (keywordsRaw.length > 16) onWarning("rule has more than 16 keywords; extra keywords are ignored");
		}
		const pool = normalizePool(item.pool, "whisperRule", onWarning);
		if (keywords.length === 0 || pool === void 0 || pool.length === 0) {
			onWarning("whisper rule dropped (needs keywords and a non-empty pool)");
			continue;
		}
		rules.push({
			keywords,
			pool
		});
	}
	return rules;
}
/** Normalize the panel block (labels / stats / actions; warn-and-drop). */
function normalizePanel(raw, onWarning = () => {}) {
	if (!isRecord$2(raw)) {
		onWarning("panel must be an object");
		return;
	}
	const panel = {};
	const labelsRaw = raw.labels;
	if (labelsRaw !== void 0) if (!isRecord$2(labelsRaw)) onWarning("panel.labels must be an object");
	else {
		const labels = {};
		for (const key of PANEL_LABEL_KEYS) {
			const value = labelsRaw[key];
			if (value === void 0) continue;
			if (typeof value !== "string") {
				onWarning("panel.labels." + key + " must be a string");
				continue;
			}
			const line = normalizeLine(value, "label", onWarning);
			if (line !== void 0) labels[key] = line.slice(0, 40);
		}
		if (Object.keys(labels).length > 0) panel.labels = labels;
	}
	const statsRaw = raw.stats;
	if (statsRaw !== void 0) if (!isRecord$2(statsRaw)) onWarning("panel.stats must be an object");
	else {
		const stats = {};
		for (const key of PANEL_STAT_KEYS) {
			const value = statsRaw[key];
			if (value === void 0) continue;
			if (typeof value !== "string") {
				onWarning("panel.stats." + key + " must be a string");
				continue;
			}
			const line = normalizeLine(value, "stat", onWarning);
			if (line !== void 0) stats[key] = line.slice(0, 80);
		}
		if (Object.keys(stats).length > 0) panel.stats = stats;
	}
	const actionsRaw = raw.actions;
	if (actionsRaw !== void 0) if (!Array.isArray(actionsRaw)) onWarning("panel.actions must be an array");
	else {
		const seen = /* @__PURE__ */ new Set();
		for (const entry of actionsRaw) {
			if (typeof entry !== "string" || !PANEL_ACTIONS.includes(entry)) {
				onWarning("unknown panel action dropped: " + String(entry));
				continue;
			}
			seen.add(entry);
		}
		panel.actions = PANEL_ACTIONS.filter((action) => seen.has(action));
	}
	if (panel.labels === void 0 && panel.stats === void 0 && panel.actions === void 0) return void 0;
	return panel;
}
/** Voice-pack top-level fields ('$schema' mirrors the schema twin; drift-locked in tests). */
const VOICE_PACK_KEYS = /* @__PURE__ */ new Set([
	"$schema",
	"voicePackVersion",
	"status",
	"tools",
	"toolRemaining",
	"whispers",
	"panel"
]);
/** Allowed whisper-section fields (drift-locked in tests). */
const WHISPER_KEYS = /* @__PURE__ */ new Set(["generic", "rules"]);
/**
* Normalize one raw voice.json document into a VoicePack, or undefined when
* the file cannot serve as a pack at all (non-object root — structure is
* fail-closed per file). Every slot issue is a warning, never a throw.
*/
function normalizeVoicePack(raw, onWarning = () => {}) {
	if (raw === void 0) return void 0;
	if (!isRecord$2(raw)) {
		onWarning("voice.json must be a JSON object; the file is ignored");
		return;
	}
	for (const key of Object.keys(raw)) if (!VOICE_PACK_KEYS.has(key)) onWarning("unknown top-level field " + key + " ignored");
	const version = raw.voicePackVersion;
	if (version !== void 0 && (typeof version !== "number" || version !== 1)) onWarning("voicePackVersion " + String(version) + " is not supported; reading as v1 best-effort");
	const overrides = {};
	const statusRaw = raw.status;
	if (statusRaw !== void 0) if (!isRecord$2(statusRaw)) onWarning("status must be an object");
	else for (const key of Object.keys(statusRaw)) {
		if (!STATUS_SCENES.includes(key)) {
			onWarning("unknown status scene " + key + " ignored");
			continue;
		}
		const pool = normalizePool(statusRaw[key], "status", onWarning);
		if (pool !== void 0 && pool.length > 0) overrides.status = {
			...overrides.status,
			[key]: pool
		};
	}
	const toolsRaw = raw.tools;
	if (toolsRaw !== void 0) if (!isRecord$2(toolsRaw)) onWarning("tools must be an object");
	else for (const key of Object.keys(toolsRaw)) {
		if (!TOOL_CATEGORIES.includes(key)) {
			onWarning("unknown tool family " + key + " ignored");
			continue;
		}
		const pool = normalizePool(toolsRaw[key], "tools", onWarning);
		if (pool !== void 0 && pool.length > 0) overrides.tools = {
			...overrides.tools,
			[key]: pool
		};
	}
	const remainingRaw = raw.toolRemaining;
	if (remainingRaw !== void 0) {
		const pool = normalizePool(remainingRaw, "toolRemaining", onWarning);
		if (pool !== void 0 && pool.length > 0) overrides.toolRemaining = pool;
	}
	const whispersRaw = raw.whispers;
	if (whispersRaw !== void 0) if (!isRecord$2(whispersRaw)) onWarning("whispers must be an object");
	else {
		for (const key of Object.keys(whispersRaw)) if (!WHISPER_KEYS.has(key)) onWarning("unknown whispers field " + key + " ignored");
		const generic = normalizePool(whispersRaw.generic, "whisperGeneric", onWarning);
		const rules = normalizeWhisperRules(whispersRaw.rules, onWarning);
		if (generic !== void 0 || rules !== void 0) overrides.whispers = {
			...generic === void 0 ? {} : { generic },
			...rules === void 0 ? {} : { rules }
		};
	}
	const panel = raw.panel === void 0 ? void 0 : normalizePanel(raw.panel, onWarning);
	if (overrides.status === void 0 && overrides.tools === void 0 && overrides.toolRemaining === void 0 && overrides.whispers === void 0 && panel === void 0) return;
	return {
		overrides,
		...panel === void 0 ? {} : { panel }
	};
}
/**
* Merge voice-pack layers into one pack; later layers win per slot. The
* built-in pools are NOT a layer here — the chatter engines fall back to
* them per key at draw time. Merge order for a selected pet:
* mergeVoicePacks(registry.globalVoice, entry.voice).
*/
function mergeVoicePacks(...layers) {
	const overrides = {};
	const labels = {};
	const stats = {};
	let actions;
	let panelSeen = false;
	let any = false;
	for (const layer of layers) {
		if (layer === void 0) continue;
		any = true;
		if (layer.overrides.status !== void 0) overrides.status = {
			...overrides.status,
			...layer.overrides.status
		};
		if (layer.overrides.tools !== void 0) overrides.tools = {
			...overrides.tools,
			...layer.overrides.tools
		};
		if (layer.overrides.toolRemaining !== void 0) overrides.toolRemaining = layer.overrides.toolRemaining;
		if (layer.overrides.whispers !== void 0) overrides.whispers = {
			...overrides.whispers,
			...layer.overrides.whispers
		};
		if (layer.panel !== void 0) {
			panelSeen = true;
			if (layer.panel.labels !== void 0) Object.assign(labels, layer.panel.labels);
			if (layer.panel.stats !== void 0) Object.assign(stats, layer.panel.stats);
			if (layer.panel.actions !== void 0) actions = layer.panel.actions;
		}
	}
	if (!any) return void 0;
	const panel = {
		...Object.keys(labels).length > 0 ? { labels } : {},
		...Object.keys(stats).length > 0 ? { stats } : {},
		...actions === void 0 ? {} : { actions }
	};
	const panelEmpty = panel.labels === void 0 && panel.stats === void 0 && panel.actions === void 0;
	return {
		overrides,
		...panelSeen && !panelEmpty ? { panel } : {}
	};
}
/** Renderer kinds the pet center knows how to dispatch (M1 §2). */
const PET_RENDERER_KINDS = ["sprite2d", "live2d"];
/** The seven ActivityPhase semantics (pet-center owned; M1 §1). */
const PET_ACTIVITY_PHASES = [
	"idle",
	"waiting",
	"thinking",
	"tool",
	"review",
	"done",
	"failed"
];
const PET_ID_PATTERN$2 = /^[a-z0-9][a-z0-9-]*$/;
const PATH_SEGMENT_PATTERN$2 = /^[A-Za-z0-9._-]+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
/**
* Field allow-lists mirroring contracts/pet-manifest-v2.schema.json. Exported
* so the drift test can lock the schema file and this validator together;
* the CLI reuses parsePetManifest instead of these.
*/
const KNOWN_TOP_LEVEL = /* @__PURE__ */ new Set([
	"$schema",
	"petManifestVersion",
	"id",
	"displayName",
	"description",
	"version",
	"author",
	"license",
	"homepage",
	"renderer",
	"sprite2d",
	"live2d",
	"sequences",
	"remarks"
]);
/** sprite2d block field allow-list (drift-locked to the schema file). */
const KNOWN_SPRITE2D = /* @__PURE__ */ new Set([
	"spritesheetPath",
	"cell",
	"columns",
	"atlasRows",
	"frames",
	"tracks"
]);
/** live2d block field allow-list (drift-locked to the schema file). */
const KNOWN_LIVE2D = /* @__PURE__ */ new Set([
	"model",
	"scale",
	"translate",
	"motions",
	"expressions",
	"hitAreas",
	"lipSync"
]);
var Diagnostics$1 = class {
	list = [];
	source;
	constructor(source) {
		this.source = source;
	}
	error(message) {
		this.list.push({
			level: "error",
			message: this.source + ": " + message
		});
	}
	warn(message) {
		this.list.push({
			level: "warning",
			message: this.source + ": " + message
		});
	}
	get hasErrors() {
		return this.list.some((d) => d.level === "error");
	}
};
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function unknownKeys$1(source, known) {
	return Object.keys(source).filter((key) => !known.has(key));
}
/**
* Validate a manifest-relative asset path: no absolute paths, no backslashes,
* no traversal, plain safe segments only. Returns the normalized path.
*/
function safeManifestPath(raw) {
	if (typeof raw !== "string" || raw.trim() === "") return void 0;
	const value = raw.trim();
	if (isAbsolute(value) || value.includes("\\") || /^[a-z][a-z0-9+.-]*:/i.test(value)) return void 0;
	const segments = value.split("/").filter((segment) => segment !== "");
	if (segments.length === 0) return void 0;
	if (segments.some((segment) => segment === "." || segment === ".." || !PATH_SEGMENT_PATTERN$2.test(segment))) return void 0;
	return segments.join("/");
}
function parseStringBlock(record, key, diag, required) {
	const value = record[key];
	if (value === void 0) {
		if (required) diag.error("missing required field " + JSON.stringify(key));
		return;
	}
	if (typeof value !== "string" || value.trim() === "") {
		diag.error("field " + JSON.stringify(key) + " must be a non-empty string");
		return;
	}
	return value.trim();
}
/** Validate the phase-keyed string map shape shared by motions/expressions. */
function parsePhaseStringMap(raw, field, diag) {
	if (raw === void 0) return void 0;
	if (!isRecord$1(raw)) {
		diag.error("field " + JSON.stringify(field) + " must be an object keyed by activity phase");
		return;
	}
	const result = {};
	for (const [phase, value] of Object.entries(raw)) {
		if (!PET_ACTIVITY_PHASES.includes(phase)) {
			diag.error(field + ": unknown activity phase " + JSON.stringify(phase));
			continue;
		}
		if (typeof value !== "string" || value.trim() === "") {
			diag.error(field + "." + phase + " must be a non-empty string");
			continue;
		}
		result[phase] = value.trim();
	}
	return result;
}
/** Structural gate for sequences: content stays warn-and-drop (registry's job). */
function parseSequences(raw, diag) {
	if (raw === void 0) return void 0;
	if (!isRecord$1(raw)) {
		diag.warn("sequences must be an object keyed by activity phase; ignoring");
		return;
	}
	const sequences = {};
	for (const [phase, value] of Object.entries(raw)) {
		if (!PET_ACTIVITY_PHASES.includes(phase)) {
			diag.warn("sequences: unknown activity phase " + JSON.stringify(phase) + "; entry dropped");
			continue;
		}
		if (!Array.isArray(value) || value.length < 5 || value.some((item) => typeof item !== "string")) {
			diag.warn("sequences." + phase + " must be an array of at least 5 animation names; entry dropped");
			continue;
		}
		sequences[phase] = value;
	}
	return Object.keys(sequences).length === 0 ? void 0 : sequences;
}
function parseSprite2dBlock(raw, diag) {
	if (!isRecord$1(raw)) {
		diag.error("renderer sprite2d requires a \"sprite2d\" block object");
		return;
	}
	const extra = unknownKeys$1(raw, KNOWN_SPRITE2D);
	if (extra.length > 0) diag.error("sprite2d: unknown field(s) " + extra.map((k) => JSON.stringify(k)).join(", "));
	const spritesheetPath = safeManifestPath(raw.spritesheetPath);
	if (spritesheetPath === void 0) diag.error("sprite2d.spritesheetPath must be a safe manifest-relative path");
	const block = { spritesheetPath: spritesheetPath ?? "" };
	if (raw.cell !== void 0) if (!isRecord$1(raw.cell)) diag.error("sprite2d.cell must be an object { width?, height? }");
	else block.cell = raw.cell;
	if (raw.columns !== void 0) if (typeof raw.columns !== "number" || !Number.isInteger(raw.columns) || raw.columns < 1) diag.error("sprite2d.columns must be a positive integer");
	else block.columns = raw.columns;
	if (raw.atlasRows !== void 0) if (typeof raw.atlasRows !== "number" || !Number.isInteger(raw.atlasRows) || raw.atlasRows < 1) diag.error("sprite2d.atlasRows must be a positive integer");
	else block.atlasRows = raw.atlasRows;
	if (raw.frames !== void 0) if (!Array.isArray(raw.frames) || raw.frames.some((v) => typeof v !== "number" || !Number.isInteger(v) || v < 0)) diag.error("sprite2d.frames must be an array of non-negative integers");
	else block.frames = raw.frames;
	if (raw.tracks !== void 0) if (!isRecord$1(raw.tracks)) diag.error("sprite2d.tracks must be an object keyed by animation");
	else block.tracks = raw.tracks;
	return diag.hasErrors ? void 0 : block;
}
function parseLive2dBlock(raw, diag) {
	if (!isRecord$1(raw)) {
		diag.error("renderer live2d requires a \"live2d\" block object");
		return;
	}
	const extra = unknownKeys$1(raw, KNOWN_LIVE2D);
	if (extra.length > 0) diag.error("live2d: unknown field(s) " + extra.map((k) => JSON.stringify(k)).join(", "));
	const model = safeManifestPath(raw.model);
	if (model === void 0) diag.error("live2d.model must be a safe manifest-relative path to a .model3.json");
	else if (!model.endsWith(".model3.json")) diag.error("live2d.model must point at a .model3.json file");
	const motions = parsePhaseStringMap(raw.motions, "live2d.motions", diag);
	if (raw.motions === void 0) diag.error("live2d.motions is required (at least an \"idle\" group)");
	else if (motions !== void 0 && motions.idle === void 0) diag.error("live2d.motions.idle is required (unmapped phases fall back to it)");
	const block = {
		model: model ?? "",
		motions: motions ?? { idle: "" }
	};
	if (raw.scale !== void 0) if (typeof raw.scale !== "number" || !Number.isFinite(raw.scale) || raw.scale <= 0 || raw.scale > 10) diag.error("live2d.scale must be a number in (0, 10]");
	else block.scale = raw.scale;
	if (raw.translate !== void 0) if (!isRecord$1(raw.translate) || raw.translate.x !== void 0 && typeof raw.translate.x !== "number" || raw.translate.y !== void 0 && typeof raw.translate.y !== "number") diag.error("live2d.translate must be an object { x?: number, y?: number }");
	else block.translate = raw.translate;
	const expressions = parsePhaseStringMap(raw.expressions, "live2d.expressions", diag);
	if (expressions !== void 0) block.expressions = expressions;
	if (raw.hitAreas !== void 0) if (!Array.isArray(raw.hitAreas) || raw.hitAreas.some((v) => typeof v !== "string" || v.trim() === "")) diag.error("live2d.hitAreas must be an array of non-empty strings");
	else block.hitAreas = raw.hitAreas;
	if (raw.lipSync !== void 0) if (typeof raw.lipSync !== "boolean") diag.error("live2d.lipSync must be a boolean");
	else block.lipSync = raw.lipSync;
	return diag.hasErrors ? void 0 : block;
}
/** v1 compat read: map the legacy flat manifest onto the v2 sprite2d shape. */
function compatV1(source, diag) {
	const id = parseStringBlock(source, "id", diag, true);
	if (id !== void 0 && !PET_ID_PATTERN$2.test(id)) diag.error("id " + JSON.stringify(id) + " is not a lowercase kebab id");
	const displayName = typeof source.displayName === "string" && source.displayName.trim() !== "" ? source.displayName.trim() : id;
	const spritesheetPath = safeManifestPath(source.spritesheetPath === void 0 ? "spritesheet.webp" : source.spritesheetPath);
	if (spritesheetPath === void 0) diag.error("spritesheetPath " + JSON.stringify(String(source.spritesheetPath)) + " is not a safe relative path");
	if (source.license === void 0) diag.warn("v1 compat read: no license field; run scripts/dsh-pet-migrate-v2 to migrate this pet");
	const sprite2d = { spritesheetPath: spritesheetPath ?? "spritesheet.webp" };
	if (isRecord$1(source.cell)) sprite2d.cell = source.cell;
	if (typeof source.columns === "number") sprite2d.columns = source.columns;
	if (Array.isArray(source.frames)) sprite2d.frames = source.frames;
	if (isRecord$1(source.tracks)) sprite2d.tracks = source.tracks;
	if (source.spriteVersionNumber === 2) sprite2d.atlasRows = 11;
	const manifest = {
		petManifestVersion: 2,
		id: id ?? "",
		displayName: displayName ?? "",
		renderer: "sprite2d",
		sprite2d
	};
	if (typeof source.description === "string" && source.description.trim() !== "") manifest.description = source.description.trim();
	if (typeof source.license === "string" && source.license.trim() !== "") manifest.license = source.license.trim();
	const sequences = parseSequences(source.sequences, diag);
	if (sequences !== void 0) manifest.sequences = sequences;
	if (source.remarks !== void 0) manifest.remarks = source.remarks;
	return diag.hasErrors ? void 0 : manifest;
}
/** Strict v2 validation (fail-closed on structure). */
function parseV2(source, diag) {
	const extra = unknownKeys$1(source, KNOWN_TOP_LEVEL);
	if (extra.length > 0) diag.error("unknown top-level field(s) " + extra.map((k) => JSON.stringify(k)).join(", "));
	if (source.petManifestVersion !== 2) diag.error("petManifestVersion must be 2 (got " + JSON.stringify(source.petManifestVersion) + ")");
	const id = parseStringBlock(source, "id", diag, true);
	if (id !== void 0 && (!PET_ID_PATTERN$2.test(id) || id.length > 64)) diag.error("id " + JSON.stringify(id) + " must be a lowercase kebab id of at most 64 chars");
	const displayName = parseStringBlock(source, "displayName", diag, true);
	const license = parseStringBlock(source, "license", diag, true);
	const rendererRaw = source.renderer === void 0 ? "sprite2d" : source.renderer;
	if (!PET_RENDERER_KINDS.includes(rendererRaw)) diag.error("unknown renderer " + JSON.stringify(rendererRaw) + "; expected one of " + PET_RENDERER_KINDS.join(", "));
	const renderer = rendererRaw;
	const manifest = {
		petManifestVersion: 2,
		id: id ?? "",
		displayName: displayName ?? "",
		renderer
	};
	if (license !== void 0) manifest.license = license;
	if (source.description !== void 0) if (typeof source.description !== "string" || source.description.length > 500) diag.error("description must be a string of at most 500 chars");
	else manifest.description = source.description;
	if (source.version !== void 0) if (typeof source.version !== "string" || !SEMVER_PATTERN.test(source.version)) diag.error("version must be a semver string (x.y.z)");
	else manifest.version = source.version;
	if (source.author !== void 0) if (typeof source.author !== "string" || source.author.length > 128) diag.error("author must be a string of at most 128 chars");
	else manifest.author = source.author;
	if (source.homepage !== void 0) if (typeof source.homepage !== "string") diag.error("homepage must be a string URL");
	else manifest.homepage = source.homepage;
	if (renderer === "sprite2d") {
		const block = parseSprite2dBlock(source.sprite2d, diag);
		if (block !== void 0) manifest.sprite2d = block;
		if (source.live2d !== void 0) diag.error("renderer sprite2d must not declare a live2d block");
	} else if (renderer === "live2d") {
		const block = parseLive2dBlock(source.live2d, diag);
		if (block !== void 0) manifest.live2d = block;
		if (source.sprite2d !== void 0) diag.error("renderer live2d must not declare a sprite2d block");
	}
	const sequences = parseSequences(source.sequences, diag);
	if (sequences !== void 0) manifest.sequences = sequences;
	if (source.remarks !== void 0 && !isRecord$1(source.remarks)) diag.error("remarks must be an object of remark pools");
	else if (source.remarks !== void 0) manifest.remarks = source.remarks;
	return diag.hasErrors ? void 0 : manifest;
}
/**
* Parse one pet manifest: v1 (no petManifestVersion) is compat-read as a
* sprite2d pet with a migration hint; v2 is validated fail-closed. The parse
* never throws — every failure comes back as structured diagnostics.
* @param raw - the parsed pet.json value.
* @param sourceLabel - human-readable origin for diagnostics (dir or file).
*/
function parsePetManifest(raw, sourceLabel) {
	const diag = new Diagnostics$1(sourceLabel);
	if (!isRecord$1(raw)) {
		diag.error("manifest is not an object");
		return {
			ok: false,
			diagnostics: diag.list
		};
	}
	if (raw.petManifestVersion === void 0) {
		const manifest = compatV1(raw, diag);
		if (manifest === void 0) return {
			ok: false,
			diagnostics: diag.list
		};
		diag.warn("v1 compat read: manifest treated as renderer \"sprite2d\"; run scripts/dsh-pet-migrate-v2 to migrate");
		return {
			ok: true,
			manifest,
			migrated: "v1-compat",
			diagnostics: diag.list
		};
	}
	const manifest = parseV2(raw, diag);
	if (manifest === void 0) return {
		ok: false,
		diagnostics: diag.list
	};
	return {
		ok: true,
		manifest,
		migrated: void 0,
		diagnostics: diag.list
	};
}
const DECORATION_ENTRY_EXTENSIONS = [".webp", ".png"];
/** Field allow-list (drift-locked to the schema twin in tests). */
const KNOWN_DECORATION_TOP_LEVEL = /* @__PURE__ */ new Set([
	"$schema",
	"decorationManifestVersion",
	"id",
	"displayName",
	"license",
	"entry",
	"cell",
	"columns",
	"frameMs",
	"durations",
	"loop",
	"phases"
]);
const PET_ID_PATTERN$1 = /^[a-z0-9][a-z0-9-]*$/;
const PATH_SEGMENT_PATTERN$1 = /^[A-Za-z0-9._-]+$/;
var Diagnostics = class {
	list = [];
	source;
	constructor(source) {
		this.source = source;
	}
	error(message) {
		this.list.push({
			level: "error",
			message: this.source + ": " + message
		});
	}
	warn(message) {
		this.list.push({
			level: "warning",
			message: this.source + ": " + message
		});
	}
	get hasErrors() {
		return this.list.some((d) => d.level === "error");
	}
};
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function unknownKeys(source, known) {
	return Object.keys(source).filter((key) => !known.has(key));
}
/** Positive integer in [min, max], else undefined. */
function finiteInt$1(value, min, max) {
	return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : void 0;
}
/**
* Validate a descriptor-relative entry path: no absolute paths, no
* backslashes, no traversal, plain safe segments only, and an exact
* lowercase PNG/WebP extension (the adopted entry discipline — SVG/CSS are
* not accepted). The extension match is case-sensitive on purpose: the
* asset route serves the declared path verbatim, so a case-mismatched
* suffix (frames.PNG vs frames.png) would pass a lenient check but 403 on
* case-sensitive filesystems.
* Returns the normalized path or undefined.
*/
function safeDecorationEntry(raw) {
	if (typeof raw !== "string" || raw.trim() === "") return void 0;
	const value = raw.trim();
	if (value.length > 256) return void 0;
	if (isAbsolute(value) || value.includes("\\") || /^[a-z][a-z0-9+.-]*:/i.test(value)) return void 0;
	const segments = value.split("/").filter((segment) => segment !== "");
	if (segments.length === 0) return void 0;
	if (segments.some((segment) => segment === "." || segment === ".." || !PATH_SEGMENT_PATTERN$1.test(segment))) return void 0;
	const last = segments[segments.length - 1];
	const dot = last.lastIndexOf(".");
	if (dot <= 0 || !DECORATION_ENTRY_EXTENSIONS.includes(last.slice(dot))) return void 0;
	return segments.join("/");
}
/** Normalize one phase binding value; undefined (warning) on bad content. */
function normalizeSegment(raw, columns, diag) {
	if (raw === "hide") return "hide";
	if (!isRecord(raw)) {
		diag.warn("phase binding must be \"hide\" or { from, to }; binding dropped");
		return;
	}
	const from = finiteInt$1(raw.from, 0, columns - 1);
	const to = finiteInt$1(raw.to, 0, columns - 1);
	if (from === void 0 || to === void 0 || from > to) {
		diag.warn("phase frame segment out of range; binding dropped");
		return;
	}
	return {
		from,
		to
	};
}
/**
* Parse and validate one decoration.json document. Fail-closed over the
* structure (types, key sets, paths, ranges); phase-binding content issues
* drop that binding only (warn-and-drop, the registry never-throw rule).
*/
function parseDecorationManifest(raw, source = "decoration.json") {
	const diag = new Diagnostics(source);
	if (!isRecord(raw)) {
		diag.error("descriptor must be a JSON object");
		return {
			ok: false,
			diagnostics: diag.list
		};
	}
	for (const key of unknownKeys(raw, KNOWN_DECORATION_TOP_LEVEL)) diag.error("unknown top-level field " + JSON.stringify(key));
	if (raw.decorationManifestVersion !== 1) diag.error("decorationManifestVersion must be 1");
	const id = typeof raw.id === "string" ? raw.id.trim() : "";
	if (!PET_ID_PATTERN$1.test(id)) diag.error("id must be a lowercase kebab id");
	if (id.length > 64) diag.error("id must be at most 64 characters");
	const license = typeof raw.license === "string" ? raw.license.trim() : "";
	if (license === "") diag.error("license is required (asset provenance)");
	if (license.length > 128) diag.error("license must be at most 128 characters");
	const entry = safeDecorationEntry(raw.entry);
	if (entry === void 0) diag.error("entry must be a safe relative PNG/WebP path");
	const rawCell = isRecord(raw.cell) ? raw.cell : {};
	for (const key of Object.keys(rawCell)) if (key !== "width" && key !== "height") diag.warn("unknown cell field " + JSON.stringify(key) + " ignored");
	const cellWidth = finiteInt$1(rawCell.width, 1, 256);
	const cellHeight = finiteInt$1(rawCell.height, 1, 256);
	if (cellWidth === void 0 || cellHeight === void 0) diag.error("cell width/height must be integers in [1, 256]");
	const columns = finiteInt$1(raw.columns, 1, 16);
	if (columns === void 0) diag.error("columns must be an integer in [1, 16]");
	if (diag.hasErrors || id === "" || entry === void 0 || columns === void 0) return {
		ok: false,
		diagnostics: diag.list
	};
	const displayName = typeof raw.displayName === "string" && raw.displayName.trim() !== "" ? raw.displayName.trim().slice(0, 64) : id;
	let loop;
	if (raw.loop === void 0 || typeof raw.loop === "boolean") loop = raw.loop ?? true;
	else {
		diag.warn("loop must be a boolean; defaulting to true");
		loop = true;
	}
	const rawDurations = raw.durations;
	let durations;
	if (Array.isArray(rawDurations)) {
		const usable = rawDurations.filter((v) => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 2e3);
		if (usable.length !== columns) {
			diag.warn("durations length must equal columns; using the constant frameMs instead");
			durations = [];
		} else durations = usable;
	} else if (rawDurations !== void 0) {
		diag.warn("durations must be an array; using the constant frameMs instead");
		durations = [];
	} else durations = [];
	if (durations.length === 0) {
		const frameMs = finiteInt$1(raw.frameMs, 1, 2e3) ?? 120;
		durations = Array.from({ length: columns }, () => frameMs);
	}
	const phases = {};
	const rawPhases = raw.phases;
	if (isRecord(rawPhases)) for (const [key, value] of Object.entries(rawPhases)) {
		if (!PET_ACTIVITY_PHASES.includes(key)) {
			diag.warn("unknown phase " + JSON.stringify(key) + "; binding ignored");
			continue;
		}
		const segment = normalizeSegment(value, columns, diag);
		if (segment !== void 0) phases[key] = segment;
	}
	else if (rawPhases !== void 0) diag.warn("phases must be an object; all phases hide");
	if (!Object.values(phases).some((segment) => segment !== "hide")) diag.warn("no phase shows the ornament; the decoration stays hidden");
	return {
		ok: true,
		manifest: {
			decorationManifestVersion: 1,
			id,
			displayName,
			license,
			entry,
			cell: {
				width: cellWidth,
				height: cellHeight
			},
			columns,
			durations,
			loop,
			phases
		},
		diagnostics: diag.list
	};
}
//#endregion
//#region src/image-dimensions.ts
/**
* Minimal PNG/WebP dimension reader — header-only, no decoding, no
* dependencies. Used by the decoration registry to verify a strip's actual
* pixel geometry matches its descriptor (single-row sprite strip; the client
* renders by frame-column offsets, so a mismatched strip silently shows the
* wrong frames). Parsing is best-effort: an unrecognized or truncated header
* returns undefined (the caller decides whether to warn).
*
* PNG: signature (8) + IHDR chunk — length (4) + 'IHDR' (4) + width (4) +
* height (4), both big-endian uint32 at fixed offsets 16/20.
* WebP: RIFF header (12) + chunk — 'VP8X' extended (width-1/height-1 as
* little-endian uint24 at 24/27), 'VP8L' lossless (packed 14-bit dims at
* 21), or 'VP8 ' lossy (frame header, low 14 bits of the uint16 at 26/28).
* @module @linxin666/dsh-pet/image-dimensions
*/
const PNG_SIGNATURE = Buffer.from([
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
]);
/** Read the pixel size of a PNG buffer, or undefined when unrecognized. */
function pngDimensions(buf) {
	if (buf.length < 24) return void 0;
	if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) return void 0;
	if (buf.toString("ascii", 12, 16) !== "IHDR") return void 0;
	return {
		width: buf.readUInt32BE(16),
		height: buf.readUInt32BE(20)
	};
}
/** Read the pixel size of a WebP buffer, or undefined when unrecognized. */
function webpDimensions(buf) {
	if (buf.length < 21) return void 0;
	if (buf.toString("ascii", 0, 4) !== "RIFF") return void 0;
	if (buf.toString("ascii", 8, 12) !== "WEBP") return void 0;
	const fourcc = buf.toString("ascii", 12, 16);
	if (fourcc === "VP8X") {
		if (buf.length < 30) return void 0;
		return {
			width: 1 + buf.readUIntLE(24, 3),
			height: 1 + buf.readUIntLE(27, 3)
		};
	}
	if (fourcc === "VP8L") {
		if (buf.length < 25) return void 0;
		const bits = buf.readUInt32LE(21);
		return {
			width: 1 + (bits & 16383),
			height: 1 + (bits >>> 14 & 16383)
		};
	}
	if (fourcc === "VP8 ") {
		if (buf.length < 30) return void 0;
		return {
			width: buf.readUInt16LE(26) & 16383,
			height: buf.readUInt16LE(28) & 16383
		};
	}
}
/**
* Read image pixel dimensions from a PNG or WebP buffer. Returns undefined
* for formats this reader does not recognize (never throws). Callers treat
* undefined as "cannot verify", not as an error.
*/
function imageDimensions(buf) {
	if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF") return webpDimensions(buf);
	return pngDimensions(buf);
}
//#endregion
//#region src/contracts/status-decoration.ts
/** Contract version decorations declare against (independent of manifests). */
const PET_DECORATION_API_VERSION = "x-org.linxin666.pet-center/status-decoration-v1";
//#endregion
//#region src/model3.ts
/**
* Live2D .model3.json reference closure — the set of files a model declares
* (pet-center M2, issue #623). The host asset route only ever serves a pet's
* declared manifest, its declared primary assets, and this closure; the CLI
* validator reuses the same extractor so an install-time check proves the
* serving set is complete.
*
* Cubism file family: Moc (.moc3), Textures (images), Physics (.physics3.json),
* Pose (.pose3.json), DisplayInfo (.cdi3.json), Expressions[].File
* (.exp3.json), Motions.<group>[].File (.motion3.json), UserData
* (.userdata3.json). Every reference must be a safe manifest-relative path
* (safeManifestPath); unsafe entries make the model unloadable.
*
* Erasable-syntax-only: scripts/ import this under node strip-only mode.
* @module @linxin666/dsh-pet/model3
*/
/** Collect the safe relative paths one model3.json references. */
function collectModel3References(model3) {
	const errors = [];
	if (typeof model3 !== "object" || model3 === null) return {
		references: [],
		errors: ["model3.json is not an object"]
	};
	const fileReferences = model3.FileReferences;
	if (typeof fileReferences !== "object" || fileReferences === null) return {
		references: [],
		errors: ["model3.json has no FileReferences"]
	};
	const refs = fileReferences;
	const collected = /* @__PURE__ */ new Set();
	const push = (raw, field) => {
		const safe = safeManifestPath(raw);
		if (safe === void 0) {
			errors.push(field + " is not a safe relative path: " + JSON.stringify(String(raw)));
			return;
		}
		collected.add(safe);
	};
	if (refs.Moc !== void 0) push(refs.Moc, "FileReferences.Moc");
	if (Array.isArray(refs.Textures)) refs.Textures.forEach((texture, index) => push(texture, "FileReferences.Textures[" + index + "]"));
	for (const scalar of [
		"Physics",
		"Pose",
		"DisplayInfo",
		"UserData"
	]) if (refs[scalar] !== void 0) push(refs[scalar], "FileReferences." + scalar);
	if (Array.isArray(refs.Expressions)) refs.Expressions.forEach((expression, index) => {
		const file = typeof expression === "object" && expression !== null ? expression.File : void 0;
		if (file !== void 0) push(file, "FileReferences.Expressions[" + index + "].File");
	});
	if (typeof refs.Motions === "object" && refs.Motions !== null) for (const [group, motions] of Object.entries(refs.Motions)) {
		if (!Array.isArray(motions)) {
			errors.push("FileReferences.Motions." + group + " is not an array");
			continue;
		}
		motions.forEach((motion, index) => {
			const file = typeof motion === "object" && motion !== null ? motion.File : void 0;
			if (file !== void 0) push(file, "FileReferences.Motions." + group + "[" + index + "].File");
		});
	}
	return {
		references: [...collected].sort(),
		errors
	};
}
//#endregion
//#region src/registry.ts
/**
* Pet registry — the multi-pet contract. One pet is a directory holding a
* 'pet.json' manifest plus an atlas image; nothing else is required, and no
* host or client code changes when a pet is added. The registry scans four
* sources, later sources overriding earlier ones on an id collision:
*
*   1. the package's own 'assets' subdirectories (built-in pets);
*   2. '${CODEX_HOME:-~/.codex}/pets' subdirectories (hatch-pet custom pets,
*      legacy source kept readable);
*   3. '$DSH_HOME/pets' subdirectories (the pet-center user directory);
*   4. 'PetConfig.pets' manifests composed by the embedding application
*      (highest precedence).
*
* Manifests are parsed through manifest-v2 (pet-center M2, issue #623): v1
* manifests are compat-read as sprite2d, v2 manifests validate fail-closed,
* and structured diagnostics ride alongside the legacy warnings. Live2d
* entries (pet-center M3) list like any other pet: the entry carries the
* validated live2d block plus the model's reference closure (the servable
* set the asset route allows), and a model3.json that is unreadable or
* declares unsafe references rejects the entry with an error diagnostic.
*
* The manifest follows the Codex/hatch-pet contract (8 columns x 9 rows of
* 192x208 cells, the 9-state row order below). Legacy whale-girl manifests
* that only carry 'frames' keep working: geometry, per-row frame counts and
* per-track rhythm all fall back to the hatch-pet contract defaults, and the
* whale-girl manifest overrides its own durations.
* @module @linxin666/dsh-pet/registry
*/
/** Fixed row order of the 9-state animation contract. */
const PET_ROW_ORDER = [
	"idle",
	"running-right",
	"running-left",
	"waving",
	"jumping",
	"failed",
	"waiting",
	"running",
	"review"
];
/** Atlas cell size in px (Codex/hatch-pet contract). */
const DEFAULT_PET_CELL = {
	width: 192,
	height: 208
};
/** Columns per row (max frames per track). */
const DEFAULT_PET_COLUMNS = 8;
/** Rows in the atlas (fixed by the animation contract). */
const DEFAULT_PET_ROW_COUNT = 9;
/**
* Per-row used-column counts from the hatch-pet contract table. Manifests
* that carry no 'frames' field (the Codex custom-pet shape) resolve here.
*/
const DEFAULT_FRAME_COUNTS = [
	6,
	8,
	8,
	4,
	5,
	8,
	6,
	6,
	6
];
/** Absolute package root, resolved from a module URL (lib/ or src/). */
function petPackageRoot(importMetaUrl) {
	return fileURLToPath(new URL("../", importMetaUrl));
}
/** Resolve the hatch-pet custom pets directory (CODEX_HOME or ~/.codex). */
function codexPetsDir(env = process.env, home = homedir()) {
	const raw = env.CODEX_HOME !== void 0 && env.CODEX_HOME.trim() !== "" ? env.CODEX_HOME.trim() : join(home, ".codex");
	return join(raw === "~" ? home : raw.startsWith("~/") || raw.startsWith("~\\") ? join(home, raw.slice(2)) : raw, "pets");
}
/** Finite non-negative integer guard, else the fallback. */
function finiteInt(value, fallback, max) {
	return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max ? value : fallback;
}
/** Build the browser URL of one pet asset. */
function assetUrl(prefix, id, file) {
	const path = file.split("/").filter((segment) => segment !== "").join("/");
	return prefix + "/" + encodeURIComponent(id) + "/" + path;
}
/**
* Default per-track rhythm — the shared slow baseline every sprite2d pet
* plays unless its manifest overrides a track (user request: all pets were
* too fast at the legacy hatch-pet contract pace).
*/
const DEFAULT_TRACK_PATTERNS = {
	idle: {
		durations: [
			500,
			500,
			600,
			500,
			500,
			600
		],
		loop: true
	},
	"running-right": {
		durations: [
			300,
			300,
			300,
			300,
			300,
			300,
			300,
			400
		],
		loop: true
	},
	"running-left": {
		durations: [
			300,
			300,
			300,
			300,
			300,
			300,
			300,
			400
		],
		loop: true
	},
	waving: {
		durations: [
			450,
			450,
			450,
			450
		],
		loop: true
	},
	jumping: {
		durations: [
			400,
			400,
			400,
			450,
			450
		],
		loop: false,
		fallback: "idle"
	},
	failed: {
		durations: [
			550,
			550,
			550,
			600,
			650,
			700,
			550,
			550
		],
		loop: false,
		fallback: "idle"
	},
	waiting: {
		durations: [
			550,
			550,
			600,
			550,
			550,
			600
		],
		loop: true
	},
	running: {
		durations: [
			330,
			330,
			330,
			330,
			330,
			400
		],
		loop: true
	},
	review: {
		durations: [
			650,
			650,
			650,
			650,
			650,
			650
		],
		loop: true
	}
};
/** Stable id charset: keeps asset URLs plain and filesystem-safe. */
const PET_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
/** Safe path-segment charset for atlas files. */
const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
const PET_NAME_MAX_LENGTH$1 = 80;
const PET_PHASES = [
	"idle",
	"waiting",
	"thinking",
	"tool",
	"review",
	"done",
	"failed"
];
/** Validate optional scene sequences without rejecting an otherwise usable pet. */
function normalizeSequences(raw, id, warn) {
	if (raw === void 0) return void 0;
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		warn("manifest " + id + ": sequences must be an object keyed by activity phase");
		return;
	}
	const sequences = {};
	for (const [phase, value] of Object.entries(raw)) {
		if (!PET_PHASES.includes(phase)) {
			warn("manifest " + id + ": unknown sequence phase " + JSON.stringify(phase));
			continue;
		}
		if (!Array.isArray(value) || value.length < 5) {
			warn("manifest " + id + ": sequence " + phase + " must contain at least 5 animations");
			continue;
		}
		const unknownIndex = value.findIndex((animation) => typeof animation !== "string" || !PET_ROW_ORDER.includes(animation));
		if (unknownIndex !== -1) {
			const unknown = value[unknownIndex];
			warn("manifest " + id + ": sequence " + phase + " contains unknown animation " + JSON.stringify(unknown));
			continue;
		}
		sequences[phase] = value;
	}
	return Object.keys(sequences).length === 0 ? void 0 : sequences;
}
/**
* Build the fully resolved animation tracks from the contract defaults plus
* optional per-track overrides. Shared by the sprite2d resolver and the
* live2d entry builder (which fills the sprite fields with contract
* defaults so the flat PetDefinition shape holds for every renderer).
*/
function buildTracks(rows, columns, trackOverrides, warn) {
	const tracks = {};
	for (const [row, animation] of PET_ROW_ORDER.entries()) {
		const pattern = DEFAULT_TRACK_PATTERNS[animation];
		const override = trackOverrides[animation];
		const durations = Array.isArray(override?.durations) && override.durations.length > 0 ? override.durations.filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0) : pattern.durations;
		if (durations.length === 0) {
			warn("track " + animation + " carries no usable durations");
			return;
		}
		const frameCount = Math.max(1, Math.min(rows[row], columns));
		const sized = durations.length >= frameCount ? durations.slice(0, frameCount) : Array.from({ length: frameCount }, (_, index) => durations[index % durations.length]);
		tracks[animation] = {
			frames: Array.from({ length: frameCount }, (_, index) => index),
			durations: sized,
			loop: typeof override?.loop === "boolean" ? override.loop : pattern.loop,
			...override?.fallback === void 0 ? pattern.fallback === void 0 ? {} : { fallback: pattern.fallback } : PET_ROW_ORDER.includes(override.fallback) ? { fallback: override.fallback } : pattern.fallback === void 0 ? {} : { fallback: pattern.fallback }
		};
	}
	return tracks;
}
/**
* Normalize one parsed manifest into a renderable pet entry, or undefined
* (with a warning recorded) when the manifest violates the contract.
*/
function resolvePetManifest(raw, dir, options = {}) {
	const { assetPrefix = "/pet", warnings = [] } = options;
	const warn = (message) => {
		warnings.push(message);
	};
	if (typeof raw !== "object" || raw === null) {
		warn("manifest is not an object");
		return;
	}
	const source = raw;
	const id = typeof source.id === "string" ? source.id.trim() : "";
	if (!PET_ID_PATTERN.test(id)) {
		warn("manifest id " + JSON.stringify(String(source.id)) + " is not a lowercase kebab id");
		return;
	}
	const displayName = typeof source.displayName === "string" && source.displayName.trim() !== "" ? source.displayName.trim().slice(0, PET_NAME_MAX_LENGTH$1) : id;
	const description = typeof source.description === "string" ? source.description.trim() : "";
	const spritesheet = typeof source.spritesheetPath === "string" && source.spritesheetPath.trim() !== "" ? source.spritesheetPath.trim() : "spritesheet.webp";
	const spritesheetPath = spritesheet.split("/").filter((segment) => segment !== "");
	if (spritesheetPath.length === 0 || isAbsolute(spritesheet) || spritesheet.includes("\\") || spritesheetPath.some((segment) => segment === ".." || !PATH_SEGMENT_PATTERN.test(segment))) {
		warn("manifest spritesheetPath " + JSON.stringify(spritesheet) + " is not a safe relative path");
		return;
	}
	const rawCell = typeof source.cell === "object" && source.cell !== null ? source.cell : {};
	const cell = {
		width: finiteInt(rawCell.width, DEFAULT_PET_CELL.width, 2048),
		height: finiteInt(rawCell.height, DEFAULT_PET_CELL.height, 2048)
	};
	const columns = finiteInt(source.columns, 8, 32);
	const atlasRowCount = source.spriteVersionNumber === 2 ? 11 : 9;
	const rows = DEFAULT_FRAME_COUNTS.map((fallback, index) => {
		return finiteInt(Array.isArray(source.frames) ? source.frames[index] : void 0, fallback, columns);
	});
	const remarks = normalizePetRemarks(source.remarks, (message) => warn("manifest " + id + ": " + message));
	const sequences = normalizeSequences(source.sequences, id, warn);
	const tracks = buildTracks(rows, columns, typeof source.tracks === "object" && source.tracks !== null ? source.tracks : {}, (message) => warn("manifest " + id + ": " + message));
	if (tracks === void 0) return void 0;
	const sheet = spritesheetPath.join("/");
	return {
		id,
		displayName,
		description,
		renderer: "sprite2d",
		cell,
		columns,
		rows,
		atlasRows: atlasRowCount,
		tracks,
		...sequences === void 0 ? {} : { sequences },
		atlasUrl: assetUrl(assetPrefix, id, spritesheet),
		manifestUrl: assetUrl(assetPrefix, id, "pet.json"),
		dir,
		spritesheetPath: sheet,
		servable: [sheet],
		...remarks === void 0 ? {} : { remarks }
	};
}
/**
* Adapt a validated v2 manifest's sprite2d block onto the legacy flat shape
* the established resolver consumes (pet-center M2 P2). The legacy resolver
* only expresses 9-row (default) and 11-row (spriteVersionNumber 2) atlases,
* so other atlasRows values are rejected here with a diagnostic.
*/
function flattenV2Sprite2d(manifest) {
	const block = manifest.sprite2d;
	if (block === void 0) return void 0;
	const legacy = {
		id: manifest.id,
		displayName: manifest.displayName,
		spritesheetPath: block.spritesheetPath
	};
	if (manifest.description !== void 0) legacy.description = manifest.description;
	if (block.cell !== void 0) legacy.cell = block.cell;
	if (block.columns !== void 0) legacy.columns = block.columns;
	if (block.frames !== void 0) legacy.frames = block.frames;
	if (block.tracks !== void 0) legacy.tracks = block.tracks;
	if (block.atlasRows !== void 0) {
		if (block.atlasRows === 11) legacy.spriteVersionNumber = 2;
		else if (block.atlasRows !== 9) return void 0;
	}
	if (manifest.sequences !== void 0) legacy.sequences = manifest.sequences;
	if (manifest.remarks !== void 0) legacy.remarks = manifest.remarks;
	return legacy;
}
/**
* Resolve a validated live2d manifest into a renderable entry (pet-center
* M3). The model3.json is read at scan time: its reference closure becomes
* the entry's servable set (the asset route's allow-list), and a model that
* is unreadable or declares unsafe references rejects the entry fail-closed
* with an error diagnostic. Closure files missing on disk warn but keep the
* entry listed — the client renderer's diagnostic card reports the broken
* render, matching the registry's never-throw philosophy (install-time
* strictness belongs to the CLI validator). The sprite fields carry contract
* defaults: the chrome sizes live2d pets off 'display.size', not the atlas.
*/
function resolveLive2dEntry(manifest, dir, options) {
	const assetPrefix = options.assetPrefix ?? "/pet";
	const record = (level, message) => {
		options.diagnostics?.push({
			level,
			source: dir,
			message
		});
		options.warnings?.push(message);
	};
	const block = manifest.live2d;
	if (block === void 0) {
		record("error", "pet " + manifest.id + ": renderer live2d requires a live2d block");
		return;
	}
	const modelFile = join(dir, block.model);
	let model3;
	try {
		if (guardedScannedJsonStat(modelFile, options, "live2d model " + block.model, 33554432) === void 0) {
			statSync(modelFile);
			return;
		}
		model3 = JSON.parse(readFileSync(modelFile, "utf8"));
	} catch (error) {
		record("error", "pet " + manifest.id + ": live2d model " + block.model + " is not readable: " + (error instanceof Error ? error.message : String(error)));
		return;
	}
	const { references, errors } = collectModel3References(model3);
	if (errors.length > 0) {
		for (const message of errors) record("error", "pet " + manifest.id + ": live2d model " + block.model + ": " + message);
		return;
	}
	for (const reference of references) if (!existsSync(join(dir, reference))) record("warning", "pet " + manifest.id + ": live2d closure file missing: " + reference);
	const tracks = buildTracks(DEFAULT_FRAME_COUNTS, 8, {}, (message) => record("warning", "pet " + manifest.id + ": " + message));
	if (tracks === void 0) return void 0;
	const remarks = normalizePetRemarks(manifest.remarks, (message) => record("warning", "pet " + manifest.id + ": " + message));
	const modelUrl = assetUrl(assetPrefix, manifest.id, block.model);
	const live2d = {
		modelUrl,
		modelPath: block.model,
		...block.scale === void 0 ? {} : { scale: block.scale },
		...block.translate === void 0 ? {} : { translate: block.translate },
		motions: block.motions,
		...block.expressions === void 0 ? {} : { expressions: block.expressions },
		...block.hitAreas === void 0 ? {} : { hitAreas: block.hitAreas }
	};
	return {
		id: manifest.id,
		displayName: manifest.displayName,
		description: manifest.description ?? "",
		renderer: "live2d",
		live2d,
		cell: { ...DEFAULT_PET_CELL },
		columns: 8,
		rows: [...DEFAULT_FRAME_COUNTS],
		atlasRows: 9,
		tracks,
		atlasUrl: modelUrl,
		manifestUrl: assetUrl(assetPrefix, manifest.id, "pet.json"),
		dir,
		spritesheetPath: block.model,
		servable: [block.model, ...references],
		...remarks === void 0 ? {} : { remarks }
	};
}
/** Scan one directory of pet folders; entries come back in name order. */
function scanPetDir(dir, options) {
	if (!existsSync(dir)) return [];
	let names = [];
	try {
		names = readdirSync(dir).filter((name) => !name.startsWith("."));
	} catch {
		return [];
	}
	names.sort();
	const entries = [];
	for (const name of names) {
		const manifestFile = join(dir, name, "pet.json");
		if (!existsSync(manifestFile)) continue;
		const parsed = readPetJson(manifestFile, options);
		if (parsed === void 0) continue;
		const entryDir = join(dir, name);
		const verdict = parsePetManifest(parsed, entryDir);
		for (const diagnostic of verdict.diagnostics) {
			options.diagnostics?.push({
				level: diagnostic.level,
				source: entryDir,
				message: diagnostic.message
			});
			options.warnings?.push(diagnostic.message);
		}
		if (!verdict.ok) continue;
		let entry;
		if (verdict.manifest.renderer === "live2d") entry = resolveLive2dEntry(verdict.manifest, entryDir, options);
		else {
			const legacy = flattenV2Sprite2d(verdict.manifest);
			if (legacy === void 0) {
				const note = "pet " + verdict.manifest.id + ": sprite2d.atlasRows only supports 9 or 11 under the v1 compat resolver";
				options.diagnostics?.push({
					level: "error",
					source: entryDir,
					message: note
				});
				options.warnings?.push(note);
				continue;
			}
			entry = resolvePetManifest(legacy, entryDir, options);
		}
		if (entry === void 0) continue;
		const voice = loadVoicePackFile(join(entryDir, "voice.json"), options);
		entries.push({
			...entry,
			...voice === void 0 ? {} : { voice }
		});
	}
	return entries;
}
/**
* Read and parse one pet.json manifest; undefined (warning recorded) on
* failure. The descriptor stat guard applies first: a pathological file —
* huge, or a FIFO/device — is skipped with a warning instead of stalling
* or OOM-ing the host at scan time (same discipline as voice/decoration).
*/
function readPetJson(file, options) {
	if (guardedScannedJsonStat(file, options, "pet manifest") === void 0) return void 0;
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch (error) {
		options.warnings?.push("skipping " + file + ": " + (error instanceof Error ? error.message : String(error)));
		return;
	}
}
/**
* Scan-time read ceiling for user-authored JSON descriptors (voice.json,
* .voice.json, decoration.json): the registry reads these synchronously at
* plugin startup, and a pathological file — multi-GB, or a FIFO/device
* symlink — must not hang or exhaust the host before the warn-and-drop
* discipline can apply (review-spd follow-up, pet-center M4/M5).
*/
const PET_SCAN_JSON_CAP = 64 * 1024;
/**
* Stat one scanned JSON descriptor with a regular-file + size guard, so a
* pathological user file is skipped with a warning instead of stalling or
* OOM-ing the host at startup. Returns the Stats, or undefined when the
* caller must skip the file (a warning was recorded). 'cap' defaults to
* the descriptor ceiling (PET_SCAN_JSON_CAP); model descriptors pass the
* larger live2d ceiling.
*/
function guardedScannedJsonStat(file, options, what, cap = PET_SCAN_JSON_CAP) {
	let st;
	try {
		st = statSync(file);
	} catch {
		return;
	}
	const warn = (message) => {
		options.warnings?.push(file + ": " + message);
		options.diagnostics?.push({
			level: "warning",
			source: file,
			message: file + ": " + message
		});
	};
	if (!st.isFile()) {
		warn(what + " is not a regular file; ignored");
		return;
	}
	if (st.size > cap) {
		warn(what + " exceeds the " + cap + "-byte scan ceiling; ignored");
		return;
	}
	return st;
}
/**
* Load and normalize one optional voice.json (pet-center M4). A missing
* file is silent; a broken file warns and drops. The pack is pure content,
* so every issue stays a warning — a bad voice.json never rejects a pet.
*/
function loadVoicePackFile(file, options) {
	if (!existsSync(file)) return void 0;
	if (guardedScannedJsonStat(file, options, "voice pack") === void 0) return void 0;
	const warn = (message) => {
		options.warnings?.push(file + ": " + message);
		options.diagnostics?.push({
			level: "warning",
			source: file,
			message: file + ": " + message
		});
	};
	let raw;
	try {
		raw = JSON.parse(readFileSync(file, "utf8"));
	} catch (error) {
		warn("voice pack is not valid JSON; ignored: " + (error instanceof Error ? error.message : String(error)));
		return;
	}
	return normalizeVoicePack(raw, warn);
}
/** Decoration asset URL prefix (served by the decoration route, M5). */
const DECORATION_ASSET_PREFIX = "/api/pet/decoration";
/** Read the pixel dimensions of a decoration strip (PNG/WebP), if decodable. */
function readImageDimensions(file) {
	let header;
	try {
		const fd = openSync(file, "r");
		try {
			header = Buffer.alloc(64);
			const read = readSync(fd, header, 0, header.length, 0);
			if (read < 0) return void 0;
			header = header.subarray(0, read);
		} finally {
			closeSync(fd);
		}
	} catch {
		return;
	}
	return imageDimensions(header);
}
/**
* Scan one directory of decoration folders ('decoration.json' + strip).
* Later scans override earlier ones on id collision; a bad descriptor warns
* and skips — the never-throw philosophy holds for decorations too (M5).
*/
function scanDecorationDir(dir, options) {
	if (!existsSync(dir)) return [];
	let names = [];
	try {
		names = readdirSync(dir).filter((name) => !name.startsWith("."));
	} catch {
		return [];
	}
	names.sort();
	const entries = [];
	for (const name of names) {
		const entryDir = join(dir, name);
		const manifestFile = join(entryDir, "decoration.json");
		if (!existsSync(manifestFile)) continue;
		if (guardedScannedJsonStat(manifestFile, options, "decoration descriptor") === void 0) continue;
		let raw;
		try {
			raw = JSON.parse(readFileSync(manifestFile, "utf8"));
		} catch (error) {
			const message = "skipping " + manifestFile + ": " + (error instanceof Error ? error.message : String(error));
			options.warnings?.push(message);
			options.diagnostics?.push({
				level: "error",
				source: entryDir,
				message
			});
			continue;
		}
		const verdict = parseDecorationManifest(raw, manifestFile);
		for (const diagnostic of verdict.diagnostics) {
			options.diagnostics?.push({
				level: diagnostic.level,
				source: entryDir,
				message: diagnostic.message
			});
			options.warnings?.push(diagnostic.message);
		}
		if (!verdict.ok) continue;
		const manifest = verdict.manifest;
		if (!existsSync(join(entryDir, manifest.entry))) {
			const message = "decoration " + manifest.id + ": strip file missing: " + manifest.entry;
			options.warnings?.push(message);
			options.diagnostics?.push({
				level: "warning",
				source: entryDir,
				message
			});
		} else {
			const actual = readImageDimensions(join(entryDir, manifest.entry));
			if (actual !== void 0) {
				const expectedWidth = manifest.cell.width * manifest.columns;
				if (actual.width !== expectedWidth || actual.height !== manifest.cell.height) {
					const message = "decoration " + manifest.id + ": strip " + actual.width + "x" + actual.height + " does not match cell " + manifest.cell.width + "x" + manifest.cell.height + " x " + manifest.columns + " columns (expected " + expectedWidth + "x" + manifest.cell.height + "); frames will render wrong";
					options.warnings?.push(message);
					options.diagnostics?.push({
						level: "warning",
						source: entryDir,
						message
					});
				}
			}
		}
		entries.push({
			apiVersion: PET_DECORATION_API_VERSION,
			id: manifest.id,
			dir: entryDir,
			entryPath: manifest.entry,
			servable: ["decoration.json", manifest.entry],
			license: manifest.license,
			assetBase: "/api/pet/decoration/" + encodeURIComponent(manifest.id),
			entryUrl: "/api/pet/decoration/" + encodeURIComponent(manifest.id) + "/" + manifest.entry,
			cell: manifest.cell,
			columns: manifest.columns,
			durations: manifest.durations,
			loop: manifest.loop,
			phases: manifest.phases
		});
	}
	return entries;
}
/**
* Load the pet registry: built-in 'assets/*' first, then the hatch-pet
* custom pets directory, then composed 'extra' manifests (each later source
* overrides an earlier one on id collision). The registry never throws on a
* bad manifest: it skips it and records a warning.
*/
function loadPetRegistry(options) {
	const { packageRoot, assetPrefix = "/pet" } = options;
	const warnings = [];
	const diagnostics = [];
	const byId = /* @__PURE__ */ new Map();
	const builtinIds = /* @__PURE__ */ new Set();
	for (const entry of scanPetDir(join(packageRoot, "assets"), {
		assetPrefix,
		warnings,
		diagnostics
	})) {
		if (byId.has(entry.id)) {
			warnings.push("duplicate built-in pet id " + entry.id + "; the first one wins");
			continue;
		}
		byId.set(entry.id, entry);
		builtinIds.add(entry.id);
	}
	const petsDir = options.petsDir ?? codexPetsDir();
	if (petsDir !== "") for (const entry of scanPetDir(petsDir, {
		assetPrefix,
		warnings,
		diagnostics
	})) {
		if (byId.has(entry.id)) warnings.push("custom pet " + entry.id + " overrides the built-in one");
		byId.set(entry.id, entry);
	}
	const dshPetsDir = options.dshPetsDir ?? join(dshHome(), "pets");
	let globalVoice;
	if (dshPetsDir !== "") {
		for (const entry of scanPetDir(dshPetsDir, {
			assetPrefix,
			warnings,
			diagnostics
		})) {
			if (byId.has(entry.id)) warnings.push("user pet " + entry.id + " overrides an earlier registration");
			byId.set(entry.id, entry);
		}
		globalVoice = loadVoicePackFile(join(dshPetsDir, ".voice.json"), {
			warnings,
			diagnostics
		});
	}
	for (const manifest of options.extra ?? []) {
		const raw = manifest.spritesheetPath;
		const dir = raw === void 0 || isAbsolute(raw) ? join(packageRoot, "assets", "extra") : dirname(resolve(packageRoot, raw));
		const entry = resolvePetManifest(raw === void 0 || isAbsolute(raw) ? manifest : {
			...manifest,
			spritesheetPath: basename(raw)
		}, dir, {
			assetPrefix,
			warnings
		});
		if (entry === void 0) continue;
		if (byId.has(entry.id)) warnings.push("composed pet " + entry.id + " overrides an earlier registration");
		byId.set(entry.id, entry);
	}
	const decorationById = /* @__PURE__ */ new Map();
	for (const entry of scanDecorationDir(join(packageRoot, "assets", "decorations"), {
		warnings,
		diagnostics
	})) decorationById.set(entry.id, entry);
	if (dshPetsDir !== "") for (const entry of scanDecorationDir(join(dshPetsDir, "decorations"), {
		warnings,
		diagnostics
	})) {
		if (decorationById.has(entry.id)) warnings.push("user decoration " + entry.id + " overrides the built-in one");
		decorationById.set(entry.id, entry);
	}
	const entries = [...byId.values()];
	const decorations = [...decorationById.values()];
	return {
		entries,
		warnings,
		diagnostics,
		byId: (id) => byId.get(id),
		defaultEntry: () => entries.find((entry) => builtinIds.has(entry.id)) ?? entries[0],
		...globalVoice === void 0 ? {} : { globalVoice },
		decorations,
		decorationById: (id) => decorationById.get(id)
	};
}
/** The built-in default decoration id (M5): the first reference ornament. */
const DEFAULT_DECORATION_ID = "whale";
/** Strip host-only fields, leaving the browser-visible decoration view. */
function decorationView(entry) {
	return {
		apiVersion: PET_DECORATION_API_VERSION,
		id: entry.id,
		assetBase: entry.assetBase,
		entryUrl: entry.entryUrl,
		cell: entry.cell,
		columns: entry.columns,
		durations: entry.durations,
		loop: entry.loop,
		phases: entry.phases
	};
}
/**
* Strip host-only fields, leaving the client-visible definition. When the
* registry carries a global voice pack, its panel chrome layers under the
* entry's own pack (per-slot merge, pet > global), mirroring the voice-pool
* layering (pet-center M4, issue #677).
*/
function petEntryView(entry, globalVoice) {
	const panel = globalVoice === void 0 ? entry.voice?.panel : mergeVoicePacks(globalVoice, entry.voice)?.panel;
	return {
		id: entry.id,
		displayName: entry.displayName,
		description: entry.description,
		renderer: entry.renderer,
		...entry.live2d === void 0 ? {} : { live2d: entry.live2d },
		cell: entry.cell,
		columns: entry.columns,
		rows: entry.rows,
		atlasRows: entry.atlasRows,
		tracks: entry.tracks,
		...entry.sequences === void 0 ? {} : { sequences: entry.sequences },
		atlasUrl: entry.atlasUrl,
		manifestUrl: entry.manifestUrl,
		...panel === void 0 ? {} : { panel }
	};
}
/** Hard cap on simultaneously displayed session bubbles (most recent first). */
const MAX_SESSION_BUBBLES = 12;
/**
* Cordis service exposing the pet RPC domain. Lazy: nothing is scanned or
* written until an economic event or interaction arrives; event listeners
* update only in-memory state, and persistence happens on economic changes
* (turn rewards, feeds, config/name changes) — never on a read.
*/
var PetService = class extends Service {
	static inject = [];
	machine;
	stateConfig;
	ledger;
	registry;
	persistDir;
	enabled;
	/** Status-decoration master switch (M5, #567); mirrored from settings. */
	decorationEnabled;
	disposeActivity;
	/** Session whose most recent meaningful event currently drives the global pet. */
	displaySession;
	/**
	* Effective voice-pack overrides for the currently selected pet (M4,
	* #677). Cached per pet id; the registry is an immutable snapshot, so the
	* global pack and each entry's pack cannot change behind the cache.
	*/
	voiceCache;
	/**
	* Per-session activity, most recent last (Map insertion order). Bounded by
	* MAX_SESSION_BUBBLES so a burst of sessions cannot grow it without bound;
	* disposed sessions are removed by the 'session/disposed' listener.
	*/
	sessionActivity = /* @__PURE__ */ new Map();
	/**
	* Sessions whose reward source is the official event stream. This metadata
	* outlives transient visual resets so a derived legacy `done` cannot reward
	* the same turn again after the pet is disabled and re-enabled.
	*/
	officialEventSessions = /* @__PURE__ */ new WeakSet();
	constructor(ctx, config = {}) {
		super(ctx, "pet");
		this.persistDir = config.persistDir ?? petHomeDir();
		this.registry = config.registry ?? loadPetRegistry({
			packageRoot: petPackageRoot(import.meta.url),
			...config.pets === void 0 ? {} : { extra: config.pets }
		});
		if (this.registry.entries.length === 0) throw new Error("[dsh-pet] no valid pet manifests found; nothing to render");
		let persist = loadPetPersist(this.persistDir);
		if (this.registry.byId(persist.petId) === void 0) persist = {
			...persist,
			petId: this.registry.defaultEntry().id
		};
		const selected = this.registry.byId(persist.petId) ?? this.registry.defaultEntry();
		const ledgerConfig = {
			affinity: config.affinity,
			treats: config.treats,
			remarks: selected.remarks
		};
		this.ledger = new PetLedger(persist, ledgerConfig);
		this.stateConfig = {
			...defaultPetStateConfig,
			...config.state ?? {}
		};
		this.machine = new PetStateMachine(this.stateConfig);
		this.enabled = config.enabled ?? true;
		this.decorationEnabled = config.decorationEnabled ?? true;
		this.syncActivity();
	}
	/**
	* The draw-time voice-pool provider handed to every projection runtime.
	* It re-resolves when the selected pet changes, so live engines re-voice
	* on the next draw without being rebuilt (M4, #677).
	*/
	voicePools() {
		return () => {
			const entry = this.activeEntry();
			if (this.voiceCache !== void 0 && this.voiceCache.petId === entry.id) return this.voiceCache.overrides;
			const overrides = mergeVoicePacks(this.registry.globalVoice, entry.voice)?.overrides ?? {};
			this.voiceCache = {
				petId: entry.id,
				overrides
			};
			return overrides;
		};
	}
	/** Whether the pet service consumes session activity while enabled. */
	isEnabled() {
		return this.enabled;
	}
	/** RPC: current pet state snapshot. */
	async state() {
		return this.view();
	}
	/** Current persisted display config (read-only view). */
	display() {
		return { ...this.ledger.snapshot.display };
	}
	/** RPC: the registry entries the browser half renders and selects from. */
	async pets() {
		return this.registry.entries.map((entry) => petEntryView(entry, this.registry.globalVoice));
	}
	/** The loaded registry (the asset routes serve its entries). */
	registrySnapshot() {
		return this.registry;
	}
	/** RPC: structured registry diagnostics (pet-center M2, issue #623). */
	async diagnostics() {
		return { diagnostics: this.registry.diagnostics };
	}
	/**
	* The active status decoration view (M5, #567): the default 'whale' entry
	* (user directories override built-ins by id), gated by the master switch.
	*/
	activeDecoration() {
		if (!this.decorationEnabled) return void 0;
		const entry = this.registry.decorationById?.(DEFAULT_DECORATION_ID);
		return entry === void 0 ? void 0 : decorationView(entry);
	}
	/** The selected pet's registry entry. */
	activeEntry() {
		return this.registry.byId(this.selectedPetId()) ?? this.registry.defaultEntry();
	}
	/** Currently selected pet id (persisted). */
	selectedPetId() {
		return this.ledger.snapshot.petId;
	}
	/** The display name of one pet (user rename or manifest displayName). */
	petName(petId = this.selectedPetId()) {
		const stored = this.ledger.snapshot.names[petId];
		if (stored !== void 0 && stored.trim() !== "") return stored;
		return this.registry.byId(petId)?.displayName ?? "鲸鱼娘";
	}
	/** RPC: switch the selected pet (persisted, settings document mirrored). */
	async setPetId(petId) {
		const entry = this.registry.byId(petId);
		if (entry === void 0) return {
			ok: false,
			error: "unknown-pet"
		};
		this.ledger.setPetId(entry.id);
		this.ledger.setRemarks(entry.remarks);
		this.flush();
		this.syncSettingsFromPet();
		return {
			ok: true,
			petId: entry.id
		};
	}
	/** Start or stop the session-activity listeners that drive the pet. */
	setEnabled(enabled) {
		this.enabled = enabled;
		this.syncActivity();
		if (!enabled) this.resetActivity();
	}
	syncActivity() {
		if (this.disposeActivity !== void 0) {
			this.disposeActivity();
			this.disposeActivity = void 0;
		}
		if (!this.enabled) return;
		this.disposeActivity = (() => {
			const disposers = [this.ctx.on("session/event", (session, event) => {
				const runtime = this.activityOf(session).runtime;
				if (event.type === "activity/status") {
					const payload = event.data ?? {};
					if (typeof payload.phase !== "string" || !isActivityPhase(payload.phase)) return;
					this.applyActivity(session, {
						phase: payload.phase,
						...typeof payload.line === "string" ? { line: payload.line } : {},
						...typeof payload.phrase === "string" ? { phrase: payload.phrase } : {}
					});
					if (payload.phase === "done" && !runtime.officialEventsSeen) this.rewardLegacyTurn();
					return;
				}
				const transition = projectOfficialEvent(event, runtime);
				if (transition === void 0) return;
				runtime.officialEventsSeen = true;
				this.officialEventSessions.add(session);
				this.applyActivity(session, transition.input, transition.whisper);
				if (transition.completedTurn !== void 0) this.rewardTurn(String(session.id), transition.completedTurn);
			}), this.ctx.on("session/disposed", (session) => {
				this.ledger.forgetSession(String(session.id));
				this.officialEventSessions.delete(session);
				this.sessionActivity.delete(session);
				if (session !== this.displaySession) return;
				this.displaySession = void 0;
				const remaining = [...this.sessionActivity.entries()].at(-1);
				if (remaining !== void 0) {
					const [nextSession, activity] = remaining;
					this.displaySession = nextSession;
					if (activity.lastInput !== void 0) this.machine.onActivityStatus(activity.lastInput);
					this.machine.onSessionActive();
				} else this.machine.onSessionDisposed();
			})];
			return () => {
				for (const dispose of disposers) dispose();
			};
		})();
	}
	/** Drop transient activity because terminal events missed while disabled cannot be replayed safely. */
	resetActivity() {
		this.displaySession = void 0;
		this.sessionActivity.clear();
		this.machine.onSessionDisposed();
	}
	/** Return the per-session activity record, creating it on first sight. */
	activityOf(session) {
		let activity = this.sessionActivity.get(session);
		if (activity === void 0) {
			const runtime = emptyProjectionRuntime(this.voicePools());
			runtime.officialEventsSeen = this.officialEventSessions.has(session);
			activity = {
				runtime,
				machine: new PetStateMachine(this.stateConfig)
			};
			this.sessionActivity.set(session, activity);
		}
		return activity;
	}
	/**
	* Commit one activity: the session's own machine renders its bubble, and
	* the session becomes the host-global display session (most recent
	* meaningful event wins the sprite animation).
	*/
	applyActivity(session, input, whisper) {
		const activity = this.activityOf(session);
		activity.lastInput = input;
		if (whisper !== void 0) activity.whisper = {
			text: whisper,
			at: Date.now()
		};
		activity.machine.onActivityStatus(input);
		activity.machine.onSessionActive();
		this.sessionActivity.delete(session);
		this.sessionActivity.set(session, activity);
		while (this.sessionActivity.size > 12) {
			const oldest = this.sessionActivity.keys().next().value;
			if (oldest === void 0) break;
			this.sessionActivity.delete(oldest);
		}
		this.displaySession = session;
		this.machine.onActivityStatus(input);
		this.machine.onSessionActive();
	}
	/** RPC: pet or feed the pet. */
	async interact(kind) {
		const nowMs = Date.now();
		const result = this.ledger.interact(kind, nowMs);
		if (this.ledger.takeDirty()) this.flush();
		return result;
	}
	/** RPC: show or hide the pet. */
	async setVisible(visible) {
		this.ledger.setDisplay({
			...this.ledger.snapshot.display,
			visible
		});
		this.flush();
		this.syncSettingsFromPet();
		return {
			ok: true,
			display: this.ledger.snapshot.display
		};
	}
	/** RPC: update display config (size / position). Values are clamped to whole pixels. */
	async setConfig(patch) {
		const next = {
			...this.ledger.snapshot.display,
			...patch
		};
		next.size = Math.round(Math.min(512, Math.max(32, next.size)));
		next.right = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, next.right)));
		next.bottom = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, next.bottom)));
		this.ledger.setDisplay(next);
		this.flush();
		this.syncSettingsFromPet();
		return {
			ok: true,
			display: this.ledger.snapshot.display
		};
	}
	/** RPC: rename the selected pet (trimmed, 1–20 chars, per-pet storage). */
	async setName(name) {
		const trimmed = name.trim();
		if (trimmed === "") return {
			ok: false,
			error: "name-empty"
		};
		if (trimmed.length > 20) return {
			ok: false,
			error: "name-too-long"
		};
		this.ledger.setPetName(this.selectedPetId(), trimmed);
		this.flush();
		return {
			ok: true,
			name: trimmed
		};
	}
	/**
	* Apply a committed settings section to the persisted selection and display
	* config. Called by the settings surface on every change; values are
	* clamped exactly like the setConfig RPC so both write paths converge.
	* @param section - the resolved settings section.
	*/
	applySettingsSection(section) {
		this.decorationEnabled = section.decorationEnabled ?? true;
		const selected = typeof section.petId === "string" ? this.registry.byId(section.petId) : void 0;
		if (selected !== void 0) {
			this.ledger.setPetId(selected.id);
			this.ledger.setRemarks(selected.remarks);
		} else if (section.petId !== void 0) this.syncSettingsFromPet();
		const next = { ...this.ledger.snapshot.display };
		next.visible = section.visible && (section.enabled ?? true);
		next.size = Math.round(Math.min(512, Math.max(32, section.size)));
		next.right = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, section.right)));
		next.bottom = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, section.bottom)));
		this.ledger.setDisplay(next);
		this.flush();
	}
	/** Mirror the persisted display config into the settings document (best-effort). */
	syncSettingsFromPet() {
		const settings = this.ctx.get("settings", false);
		if (settings === void 0) return;
		const snapshot = this.ledger.snapshot;
		settings.update("pet", {
			visible: snapshot.display.visible,
			size: snapshot.display.size,
			right: snapshot.display.right,
			bottom: snapshot.display.bottom,
			petId: snapshot.petId
		}).catch(() => {});
	}
	/** Award the turn reward once per completed turn (idempotent per session + turn). */
	rewardTurn(sessionId, turn) {
		if (this.ledger.rewardTurn(sessionId, turn, Date.now())) this.flush();
	}
	/** Preserve turn rewards for installations that only emit legacy activity. */
	rewardLegacyTurn() {
		if (this.ledger.rewardLegacyTurn(Date.now())) this.flush();
	}
	view() {
		const snapshot = this.machine.render();
		const entry = this.activeEntry();
		const sessions = [];
		for (const [session, activity] of [...this.sessionActivity.entries()].reverse()) {
			if (sessions.length >= 12) break;
			if (session.header?.origin === "subagent") continue;
			const perSession = activity.machine.render();
			if (perSession.bubble === void 0) continue;
			sessions.push({
				sessionId: String(session.id),
				animation: perSession.animation,
				bubble: perSession.bubble,
				phase: perSession.phase
			});
		}
		const whisper = (this.displaySession === void 0 ? void 0 : this.sessionActivity.get(this.displaySession))?.whisper;
		const freshWhisper = whisper !== void 0 && Date.now() - whisper.at < 8e3 ? whisper.text : void 0;
		const decoration = this.activeDecoration();
		return {
			animation: snapshot.animation,
			...snapshot.bubble === void 0 ? {} : { bubble: snapshot.bubble },
			phase: snapshot.phase,
			sessionActive: snapshot.sessionActive,
			sessions,
			...freshWhisper === void 0 ? {} : { whisper: freshWhisper },
			...decoration === void 0 ? {} : { decoration },
			affinity: this.ledger.affinityView(Date.now()),
			display: { ...this.ledger.snapshot.display },
			pet: {
				id: entry.id,
				displayName: entry.displayName,
				description: entry.description
			},
			name: this.petName(),
			treats: {
				stocked: this.ledger.snapshot.treats.treats,
				max: this.ledger.treatMax
			}
		};
	}
	flush() {
		try {
			savePetPersist(this.ledger.snapshot, this.persistDir);
		} catch {}
	}
};
//#endregion
//#region src/loopback.ts
/** IPv4 127/8 predicate (four decimal octets, first == 127). */
function isIPv4Loopback(v4) {
	const parts = v4.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
function isLoopbackAddress(address) {
	if (address === void 0) return false;
	const normalized = address.toLowerCase();
	if (normalized === "::1") return true;
	if (normalized.startsWith("::ffff:")) return isIPv4Loopback(normalized.slice(7));
	return isIPv4Loopback(normalized);
}
/** Whether a normalized URL hostname names the loopback authority (localhost, [::1], 127/8). */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	return isIPv4Loopback(hostname);
}
/**
* Request-level trust fence: a loopback socket address AND a loopback Host
* header, plus browser same-origin markers. The socket address is
* authoritative; X-Forwarded-For is never trusted.
*/
function isLoopbackRequest(request) {
	if (!isLoopbackAddress(request.socket.remoteAddress)) return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL("http://" + host);
	} catch {
		return false;
	}
	if (!isLoopbackHostname(hostUrl.hostname)) return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region src/access.ts
/**
* Whether this request may enter any /api/pet or /pet asset route.
* @param ctx - host context; may expose remoteWebUiPairing.
* @param request - the incoming HTTP request.
* @returns true for loopback, or a live paired-device cookie.
*/
function isPetAllowed(ctx, request) {
	if (isLoopbackRequest(request)) return true;
	const bag = ctx;
	const fromGet = typeof bag.get === "function" ? bag.get("remoteWebUiPairing", false) : void 0;
	return (isPairingAccess(fromGet) ? fromGet : bag.remoteWebUiPairing)?.isPairedDevice(request) === true;
}
function isPairingAccess(value) {
	return value !== void 0 && value !== null && typeof value.isPairedDevice === "function";
}
//#endregion
//#region src/http.ts
/** Default body cap for readJsonBody: 64 KiB. */
const DEFAULT_JSON_BODY_MAX_BYTES = 64 * 1024;
/** Family-default JSON response headers; callers may append or override. */
const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"referrer-policy": "no-referrer"
};
/**
* Lenient bounded body reader: parse a request body as JSON, or null on an
* empty body, invalid JSON, or a body past maxBytes (default 64 KiB).
* Overflow destroys the request instead of draining the remainder (no drain
* call, matching the current repo-wide behavior); callers must not keep
* reading the request afterwards. With objectOnly, non-JSON-object payloads
* also yield null.
*/
async function readJsonBody(req, opts = {}) {
	const maxBytes = opts.maxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES;
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > maxBytes) {
			req.destroy();
			return null;
		}
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (text === "") return null;
	try {
		const parsed = JSON.parse(text);
		if (opts.objectOnly && !isJsonObject(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}
/** Whether a value is a JSON object: typeof object, not null, not an array. */
function isJsonObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Write one JSON response. Default headers are the family defaults
* (content-type and referrer-policy); caller headers are appended or
* override them.
*/
function writeJson(res, status, body, headers = {}) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		...JSON_HEADERS,
		...headers
	});
	res.end(payload);
}
//#endregion
//#region src/routes.ts
/**
* Pet HTTP routes — the browser half talks to the host through plain
* same-origin JSON endpoints ('/api/pet/*') and loads pet assets from
* '/pet/<id>/*'. The '/plugins/' endpoint only serves client bundles and RPC
* domains are platform-registered, so the pet serves its own API and media —
* the same pattern as dsh-remote-web-ui's '/api/pair' family. The asset route
* is one prefix registration serving every registry entry (manifest, atlas,
* optional previews), so adding a pet never touches route wiring. Both the
* JSON API, the asset prefix, and the Live2D runtime prefix are loopback-only
* by default; a live paired-device cookie is an extra allow path when
* remote-web-ui is loaded.
* @module @linxin666/dsh-pet/routes
*/
/** Browser-facing base path of the pet API. */
const PET_API_PREFIX = "/api/pet";
/** Browser-facing base path of the pet asset routes ('/pet/<id>/...'). */
const PET_ASSET_PREFIX = "/pet";
const MANIFEST_FILE = "pet.json";
const PREVIEW_DIR = "previews";
const PREVIEW_PATTERN = /^[A-Za-z0-9._-]+$/;
/**
* Per-class size ceilings for served pet assets, in bytes (pet-center M2 P3,
* issue #623). Constants are tested directly; makePetRoutes accepts an
* override so tests can exercise the 413 path with tiny caps.
*/
const PET_ASSET_CAPS = {
	/** pet.json manifest. */
	manifest: 64 * 1024,
	/** Atlas, preview and Live2D texture imagery. */
	image: 20 * 1024 * 1024,
	/** Live2D model closure files (.moc3, motion/physics/expression JSON; M3). */
	model: 32 * 1024 * 1024
};
/** Imagery extensions classify into the image cap; everything else served from a closure is model-class. */
const IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([
	".webp",
	".png",
	".gif",
	".jpg",
	".jpeg"
]);
/** Lowercased file extension ('' when none). */
function extensionOf(file) {
	const dot = file.lastIndexOf(".");
	return dot < 0 ? "" : file.slice(dot).toLowerCase();
}
/**
* realpath containment: resolve both sides and require the candidate to stay
* inside the base directory. A pet directory (or an atlas/preview inside it)
* that is a symlink escaping its root is rejected, never followed.
*/
function containedRealpath(base, candidate) {
	try {
		const realBase = realpathSync(base);
		const realCandidate = realpathSync(candidate);
		return realCandidate === realBase || realCandidate.startsWith(realBase + sep) ? realCandidate : void 0;
	} catch {
		return;
	}
}
const MIME_BY_EXT = {
	".webp": "image/webp",
	".png": "image/png",
	".gif": "image/gif",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".json": "application/json"
};
/** Content type by file extension (safe fallback: octet-stream). */
function mimeFor(file) {
	const dot = file.lastIndexOf(".");
	if (dot < 0) return "application/octet-stream";
	return MIME_BY_EXT[file.slice(dot).toLowerCase()] ?? "application/octet-stream";
}
/** Require the method or answer 405. */
function requireMethod(req, res, method) {
	if (req.method === method) return true;
	writeJson(res, 405, {
		ok: false,
		error: "method-not-allowed"
	});
	return false;
}
/** Shared route fence: loopback always passes; a live paired-device cookie is an extra allow path. */
function guard(ctx, req, res) {
	if (isPetAllowed(ctx, req)) return true;
	writeJson(res, 403, {
		ok: false,
		error: "forbidden: loopback-only"
	});
	return false;
}
/** Wrap one async service call as a GET JSON route. */
function getRoute(ctx, path, run) {
	return {
		kind: "exact",
		path,
		handler: (req, res) => {
			if (!guard(ctx, req, res)) return;
			if (!requireMethod(req, res, "GET")) return;
			run().then((value) => writeJson(res, 200, value), (error) => {
				writeJson(res, 500, {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}
	};
}
/** Wrap one async service call as a POST JSON route (body passed through). */
function postRoute(ctx, path, run) {
	return {
		kind: "exact",
		path,
		handler: (req, res) => {
			if (!guard(ctx, req, res)) return Promise.resolve();
			if (!requireMethod(req, res, "POST")) return Promise.resolve();
			return readJsonBody(req, { maxBytes: 64 * 1024 }).then((parsed) => {
				const payload = parsed ?? {};
				return run(typeof payload === "object" && payload !== null ? payload : {}).then((value) => writeJson(res, 200, value), (error) => {
					writeJson(res, 400, {
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					});
				});
			}, (error) => {
				writeJson(res, 400, {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}
	};
}
/** Legacy URL aliases: each entry's directory basename (e.g. 'whale'). */
function dirAliases(registry) {
	const aliases = /* @__PURE__ */ new Map();
	for (const entry of registry.entries) {
		const alias = entry.dir.split(/[\\/]/).pop() ?? "";
		if (alias !== "" && !aliases.has(alias)) aliases.set(alias, entry);
	}
	return aliases;
}
/**
* The one asset handler behind the '/pet' prefix. Resolves the pet by id (or
* legacy directory alias), then serves exactly the files a manifest declares:
* pet.json, the entry's servable set (the sprite2d atlas, or the live2d
* model3.json plus its reference closure — pet-center M3), and optional
* 'previews/<name>' media. The servable match is an exact string comparison
* against scan-time normalized paths, so crafted '..' or '.' segments never
* match; containedRealpath stays as the second layer. Composed pets without
* a manifest file get a synthesized pet.json.
*/
function assetHandler(ctx, registry, caps) {
	const aliases = dirAliases(registry);
	return ((req, res) => {
		if (!guard(ctx, req, res)) return;
		if (req.method !== "GET" && req.method !== "HEAD") {
			res.writeHead(405);
			res.end();
			return;
		}
		let pathname;
		try {
			pathname = new URL(req.url ?? "/", "http://pet.local").pathname;
		} catch {
			res.writeHead(400);
			res.end();
			return;
		}
		const segments = pathname.split("/").filter((segment) => segment !== "");
		if (segments[0] !== "pet" || segments[1] === void 0) {
			res.writeHead(404);
			res.end();
			return;
		}
		let id;
		try {
			id = decodeURIComponent(segments[1]);
		} catch {
			res.writeHead(400);
			res.end();
			return;
		}
		const entry = registry.byId(id) ?? aliases.get(id);
		if (entry === void 0) {
			res.writeHead(404);
			res.end();
			return;
		}
		const rest = [];
		for (const segment of segments.slice(2)) {
			let decoded;
			try {
				decoded = decodeURIComponent(segment);
			} catch {
				res.writeHead(400);
				res.end();
				return;
			}
			rest.push(decoded);
		}
		const rel = rest.join("/");
		let file;
		let synthesized = false;
		if (rest.length === 1 && rest[0] === MANIFEST_FILE) {
			const manifestFile = join(entry.dir, MANIFEST_FILE);
			file = existsSync(manifestFile) ? manifestFile : void 0;
			if (file === void 0) synthesized = true;
		} else if (rest.length > 0 && entry.servable.includes(rel)) file = join(entry.dir, rel);
		else if (rest.length === 2 && rest[0] === PREVIEW_DIR && PREVIEW_PATTERN.test(rest[1])) {
			const preview = join(entry.dir, PREVIEW_DIR, rest[1]);
			file = existsSync(preview) ? preview : void 0;
		}
		if (synthesized) {
			const body = Buffer.from(JSON.stringify(petEntryView(entry, registry.globalVoice), null, 2), "utf8");
			res.writeHead(200, {
				"content-type": "application/json; charset=utf-8",
				"content-length": String(body.byteLength),
				"cache-control": "no-cache"
			});
			if (req.method === "HEAD") {
				res.end();
				return;
			}
			res.end(body);
			return;
		}
		if (file === void 0) {
			res.writeHead(404);
			res.end();
			return;
		}
		const resolved = containedRealpath(entry.dir, file);
		if (resolved === void 0) {
			res.writeHead(403);
			res.end();
			return;
		}
		const cap = rest.length === 1 && rest[0] === MANIFEST_FILE ? caps.manifest : IMAGE_EXTENSIONS.has(extensionOf(rel)) ? caps.image : caps.model;
		try {
			if (statSync(resolved).size > cap) {
				res.writeHead(413);
				res.end();
				return;
			}
		} catch {
			res.writeHead(404);
			res.end();
			return;
		}
		return readFile(resolved).then((body) => {
			res.writeHead(200, {
				"content-type": mimeFor(resolved),
				"content-length": String(body.byteLength),
				"cache-control": "no-cache"
			});
			if (req.method === "HEAD") {
				res.end();
				return;
			}
			res.end(body);
		}, () => {
			res.writeHead(404);
			res.end();
		});
	});
}
/** Browser-facing base path of the plugin runtime files (pet-center M3). */
const PET_RUNTIME_PREFIX = "/api/pet/runtime";
/**
* The runtime files the route may serve, by exact name (no slashes, no
* user-controlled path segments, so traversal is structurally impossible):
* the user-supplied Cubism Core from the pet runtime directory (the plugin
* never bundles or downloads it — issue #623 M1 §0) and the plugin-shipped
* MIT vendor bundle from the package lib directory.
*/
const RUNTIME_FILES = {
	"live2dcubismcore.min.js": { root: "runtimeDir" },
	"live2d-vendor.js": { root: "vendorDir" },
	"live2d-vendor.js.map": { root: "vendorDir" }
};
/**
* The runtime handler behind '/api/pet/runtime/<name>'. A missing file
* answers 404 with a JSON marker the client renderer turns into install
* guidance (the Cubism Core is user-supplied, so its absence is a normal
* state, not an error).
*/
function runtimeHandler(ctx, roots) {
	return ((req, res) => {
		if (!guard(ctx, req, res)) return;
		if (req.method !== "GET" && req.method !== "HEAD") {
			res.writeHead(405);
			res.end();
			return;
		}
		let pathname;
		try {
			pathname = new URL(req.url ?? "/", "http://pet.local").pathname;
		} catch {
			res.writeHead(400);
			res.end();
			return;
		}
		const rest = pathname.slice(16).replace(/^\/+/, "");
		let name;
		try {
			name = decodeURIComponent(rest);
		} catch {
			res.writeHead(400);
			res.end();
			return;
		}
		const spec = RUNTIME_FILES[name];
		if (spec === void 0) {
			res.writeHead(404);
			res.end();
			return;
		}
		const base = spec.root === "runtimeDir" ? roots.runtimeDir : roots.vendorDir;
		const file = join(base, name);
		if (!existsSync(file)) {
			writeJson(res, 404, {
				ok: false,
				error: "runtime-file-missing",
				file: name
			});
			return;
		}
		const resolved = containedRealpath(base, file);
		if (resolved === void 0) {
			res.writeHead(403);
			res.end();
			return;
		}
		try {
			if (statSync(resolved).size > 16777216) {
				res.writeHead(413);
				res.end();
				return;
			}
		} catch {
			res.writeHead(404);
			res.end();
			return;
		}
		return readFile(resolved).then((body) => {
			res.writeHead(200, {
				"content-type": name.endsWith(".map") ? "application/json" : "application/javascript; charset=utf-8",
				"content-length": String(body.byteLength),
				"cache-control": "no-cache"
			});
			if (req.method === "HEAD") {
				res.end();
				return;
			}
			res.end(body);
		}, () => {
			res.writeHead(404);
			res.end();
		});
	});
}
/**
* The decoration asset handler behind '/api/pet/decoration/<id>/<file>'
* (pet-center M5, #567). Serves exactly the files a decoration descriptor
* declares — decoration.json and the PNG/WebP strip — by exact allow-list
* match, with realpath containment and the same size ceilings as pet
* assets. Crafted '..' or '.' segments never match the normalized closure.
*/
function decorationHandler(ctx, registry, caps) {
	return (req, res) => {
		if (!guard(ctx, req, res)) return;
		if (req.method !== "GET" && req.method !== "HEAD") {
			res.writeHead(405);
			res.end();
			return;
		}
		let pathname;
		try {
			pathname = new URL(req.url ?? "/", "http://pet.local").pathname;
		} catch {
			res.writeHead(400);
			res.end();
			return;
		}
		const segments = pathname.split("/").filter((segment) => segment !== "");
		const prefixSegments = DECORATION_ASSET_PREFIX.split("/").filter((segment) => segment !== "");
		if (segments.length < prefixSegments.length + 2) {
			res.writeHead(404);
			res.end();
			return;
		}
		for (let i = 0; i < prefixSegments.length; i += 1) if (segments[i] !== prefixSegments[i]) {
			res.writeHead(404);
			res.end();
			return;
		}
		let id;
		try {
			id = decodeURIComponent(segments[prefixSegments.length]);
		} catch {
			res.writeHead(400);
			res.end();
			return;
		}
		const entry = registry.decorationById?.(id);
		if (entry === void 0) {
			res.writeHead(404);
			res.end();
			return;
		}
		const rest = [];
		for (const segment of segments.slice(prefixSegments.length + 1)) {
			let decoded;
			try {
				decoded = decodeURIComponent(segment);
			} catch {
				res.writeHead(400);
				res.end();
				return;
			}
			rest.push(decoded);
		}
		const rel = rest.join("/");
		if (!entry.servable.includes(rel)) {
			res.writeHead(404);
			res.end();
			return;
		}
		const file = join(entry.dir, rel);
		const resolved = containedRealpath(entry.dir, file);
		if (resolved === void 0) {
			res.writeHead(403);
			res.end();
			return;
		}
		const cap = rel === "decoration.json" ? caps.manifest : caps.image;
		let stat;
		try {
			stat = statSync(resolved);
			if (stat.size > cap) {
				res.writeHead(413);
				res.end();
				return;
			}
		} catch {
			res.writeHead(404);
			res.end();
			return;
		}
		const etag = "\"" + stat.size.toString(16) + "-" + Math.round(stat.mtimeMs).toString(16) + "\"";
		if (req.headers["if-none-match"] === etag) {
			res.writeHead(304, {
				etag,
				"cache-control": "no-cache"
			});
			res.end();
			return;
		}
		readFile(resolved).then((body) => {
			res.writeHead(200, {
				"content-type": mimeFor(resolved),
				"content-length": String(body.byteLength),
				"cache-control": "no-cache",
				etag
			});
			if (req.method === "HEAD") {
				res.end();
				return;
			}
			res.end(body);
		}, () => {
			res.writeHead(404);
			res.end();
		});
	};
}
/** Build the full route family (API + assets + runtime) for one service. */
function makePetRoutes(deps) {
	const { service, ctx } = deps;
	const apiRoutes = [
		getRoute(ctx, "/api/pet/state", () => service.state()),
		getRoute(ctx, "/api/pet/pets", () => service.pets()),
		getRoute(ctx, "/api/pet/diagnostics", () => service.diagnostics()),
		postRoute(ctx, "/api/pet/interact", (body) => {
			const kind = body.kind;
			if (kind !== "pet" && kind !== "feed") return Promise.reject(/* @__PURE__ */ new Error("invalid-kind"));
			return service.interact(kind);
		}),
		postRoute(ctx, "/api/pet/set-visible", (body) => {
			const visible = body.visible;
			if (typeof visible !== "boolean") return Promise.reject(/* @__PURE__ */ new Error("invalid-visible"));
			return service.setVisible(visible);
		}),
		postRoute(ctx, "/api/pet/set-config", (body) => service.setConfig({
			...typeof body.size === "number" ? { size: body.size } : {},
			...typeof body.right === "number" ? { right: body.right } : {},
			...typeof body.bottom === "number" ? { bottom: body.bottom } : {},
			...typeof body.visible === "boolean" ? { visible: body.visible } : {}
		})),
		postRoute(ctx, "/api/pet/set-name", (body) => {
			const name = body.name;
			if (typeof name !== "string") return Promise.reject(/* @__PURE__ */ new Error("invalid-name"));
			return service.setName(name);
		}),
		postRoute(ctx, "/api/pet/set-pet", (body) => {
			const petId = body.petId;
			if (typeof petId !== "string") return Promise.reject(/* @__PURE__ */ new Error("invalid-pet"));
			return service.setPetId(petId);
		})
	];
	const assetRoute = {
		kind: "prefix",
		path: PET_ASSET_PREFIX,
		handler: assetHandler(ctx, service.registrySnapshot(), deps.assetCaps ?? PET_ASSET_CAPS)
	};
	const runtimeRoute = {
		kind: "prefix",
		path: PET_RUNTIME_PREFIX,
		handler: runtimeHandler(ctx, {
			runtimeDir: deps.runtimeDir ?? join(dshHome(), "pets", ".runtime"),
			vendorDir: deps.vendorDir ?? join(petPackageRoot(import.meta.url), "lib")
		})
	};
	const decorationRoute = {
		kind: "prefix",
		path: DECORATION_ASSET_PREFIX,
		handler: decorationHandler(ctx, service.registrySnapshot(), deps.assetCaps ?? PET_ASSET_CAPS)
	};
	return [
		...apiRoutes,
		assetRoute,
		runtimeRoute,
		decorationRoute
	];
}
//#endregion
//#region src/mount-once.ts
/**
* Host single-instance guard shared by the plugin family. The family bundle
* (dsh-web-ui-all / dsh-skins) namespaces every child row id (web-ui-*), so
* the loader accepts a standalone install of the same package side by side;
* without this guard the second instance would still re-register the same
* webserver routes, tools, settings namespaces, and system-prompt sections
* and fail the boot. mountOnce makes the second host apply a no-op for the
* lifetime of the first instance (the browser half is already deduped by
* package name in the client module host).
*
* The registry rides a global symbol so two module instances of the same
* package (npm copy vs repository link) still share one verdict. cordis
* `ctx.effect` runs its callback immediately and treats the callback's
* return value as the fiber disposer, so the unmarker is returned, not run.
*/
const MOUNTED = Symbol.for("dsh-web-ui.mounted-plugins");
function mountedSet() {
	const registry = globalThis;
	return registry[MOUNTED] ??= /* @__PURE__ */ new Set();
}
/**
* Wrap a cordis plugin apply so the package runs at most once per process.
* The first mount registers normally and unmarks when its fiber disposes;
* any later mount of the same package name is a no-op.
* @param packageName - npm package identity shared by every install source.
* @param fn - the original plugin apply.
* @returns an apply of the same shape.
*/
function mountOnce(packageName, fn) {
	return ((...args) => {
		const mounted = mountedSet();
		if (mounted.has(packageName)) return;
		mounted.add(packageName);
		args[0]?.effect?.(() => () => {
			mounted.delete(packageName);
		});
		return fn(...args);
	});
}
//#endregion
//#region src/index.ts
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
const name = "pet";
/** Services required before the pet can mount its surfaces. */
const inject = ["webServer"];
/**
* Settings section schema: pet selection and display fields the web settings
* surface edits. petId is a plain string on purpose: the service clamps the
* resolved value against the registry, so a stored selection that points at
* a removed pet cannot invalidate the section (a strict union would refuse
* the whole registration). The settings card renders the actual registry
* choices itself from '/api/pet/pets'.
*/
function makePetSettingsSchema(fallbackPetId) {
	return z.object({
		visible: z.boolean().default(true),
		size: z.number().step(1).min(32).max(512).default(160),
		right: z.number().step(1).min(0).max(DISPLAY_INSET_MAX).default(24),
		bottom: z.number().step(1).min(0).max(DISPLAY_INSET_MAX).default(20),
		petId: z.string().default(fallbackPetId),
		enabled: z.boolean().default(true),
		decorationEnabled: z.boolean().default(true)
	});
}
/** Register the pet service and its API + asset routes on the context. */
const apply = mountOnce("@linxin666/dsh-pet", applyImpl);
function applyImpl(ctx, config = {}) {
	const registry = config.registry ?? loadPetRegistry({
		packageRoot: petPackageRoot(import.meta.url),
		...config.pets === void 0 ? {} : { extra: config.pets }
	});
	const service = new PetService(ctx, {
		...config,
		registry
	});
	let current = () => base;
	const base = {
		visible: service.display().visible,
		size: service.display().size,
		right: service.display().right,
		bottom: service.display().bottom,
		petId: service.selectedPetId(),
		enabled: config.enabled ?? true,
		decorationEnabled: config.decorationEnabled ?? true
	};
	const routes = makePetRoutes({
		service,
		ctx
	});
	let disposeRoutes;
	const syncRoutes = () => {
		const enabled = current().enabled ?? true;
		if (disposeRoutes === void 0 && enabled) disposeRoutes = ctx.effect(() => {
			const disposers = routes.map((route) => ctx.webServer.register(route));
			return () => {
				for (const dispose of disposers) dispose();
			};
		}, "pet: routes");
		else if (disposeRoutes !== void 0 && !enabled) {
			disposeRoutes();
			disposeRoutes = void 0;
		}
	};
	installSettingsSection(ctx, settingsNamespace("pet"), makePetSettingsSchema(service.selectedPetId()), base, {
		setSource: (source) => {
			current = source;
		},
		onChange: () => {
			const section = current();
			service.applySettingsSection(section);
			service.setEnabled(section.enabled ?? true);
			syncRoutes();
		}
	});
	syncRoutes();
}
//#endregion
export { AFFINITY_MAX, AFFINITY_RANKS, BUILTIN_REMARKS, DEFAULT_FRAME_COUNTS, DEFAULT_PET_CELL, DEFAULT_PET_COLUMNS, DEFAULT_PET_ID, DEFAULT_PET_NAME, DEFAULT_PET_ROW_COUNT, DEFAULT_TRACK_PATTERNS, MAX_SESSION_BUBBLES, PET_API_PREFIX, PET_ASSET_PREFIX, PET_NAME_MAX_LENGTH, PET_ROW_ORDER, PetService, PetStateMachine, REMARK_KINDS, REMARK_LINES_MAX, REMARK_LINE_MAX, RemarkPicker, animationForPhase, apply, applyInteraction, applyTurnReward, builtinRemark, codexPetsDir, consumeTreat, defaultDisplayConfig, defaultTreatConfig, emptyAffinity, emptyPersist, emptyTreatLedger, inject, loadPetPersist, loadPetRegistry, makePetRoutes, makePetSettingsSchema, name, normalizePetRemarks, petEntryView, petHomeDir, petPackageRoot, rankOf, resolvePetManifest, rowOf, savePetPersist, settleTreatGrants };
