/**
 * dsh-ppt-master — PPT Master 的 DSH 原生封装。
 *
 * 本包做两件事，且都只在「选中 PPT Master 预设的会话」里生效：
 *
 *   1. **工具集**：把 skill 里 user-facing 的 Python 脚本包成 DSH 工具，
 *      模型可以直接调用（`ppt_project` / `ppt_export` / `ppt_render` …），
 *      不用先去读 SKILL.md 再拼命令行。
 *
 *   2. **skill provider**：同时把 SKILL.md 挂进 skill 目录，提供工具**无法**
 *      承载的部分 —— 强制八项确认、禁止脚本生成 SVG、逐页 spec_lock 复读等
 *      流程纪律。工具负责原子操作，skill 负责方法论。
 *
 * 关于 `${SKILL_DIR}`
 * -------------------
 * DSH 自带的 `@deepseek-ai/dsh-skill-filesystem` 解析 frontmatter 后**原样返回
 * 正文**，不做任何变量替换。而 PPT Master 的 SKILL.md 有 53 处 `${SKILL_DIR}`
 * （`${SKILL_DIR}/scripts/project_manager.py` 之类）。本 provider 在 `get()`
 * 阶段把它替换成装好之后的真实绝对路径，于是文档里的命令行可以直接复制执行。
 *
 * 只替换 `${SKILL_DIR}`，**不**替换 `${TEMPLATE_DIR}`：后者是运行时由用户/agent
 * 自己赋值的模板来源路径，不是本包能知道的值。
 *
 * 关于 rank
 * ---------
 * 默认 600 = `BUNDLED_SKILL_RANK`，低于用户级 `~/.agents/skills`（500）。本机那份
 * 手工调试的副本因此会继续优先 —— 这是刻意的：插件负责「别人机器上没有这个
 * skill」的场景，不该悄悄顶掉调试版。想让插件压过手工副本，把 config.rank 设为
 * 小于 500 的值。
 *
 * 关于依赖
 * --------
 * 本包**零运行时依赖**，不 import 任何 `@deepseek-ai/dsh-*`。原因见 README：
 * 一旦写进 `peerDependencies`，安装时会拿预发布运行时版本（0.1.6-alpha.1）去卡
 * 区间，在 0.2.0-rc.2 上必然判 `incompatible-version`。硬编码常量比引入 peer 稳。
 *
 * @module dsh-ppt-master
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createToolDefinitions } from './tools.js';

/** 本 provider 在 `ctx.skills` 里注册的名字。 */
const PROVIDER_NAME = 'ppt-master';

/** skill 载荷在包内的位置（`<pkg>/skills/`）。 */
const SKILLS_ROOT_URL = new URL('../skills/', import.meta.url);

/**
 * 随包提供的两个 skill。
 *
 * `ppt-master` 是上游原文（仅展开占位符），保留它的价值在于 `references/` 与
 * `workflows/` 里那套按需读取的详细规范 —— 那些是流程纪律的原始出处。
 *
 * `ppt-master-dsh` 是为本工具集写的精简入口：它把「调哪个工具、在哪一关卡住」
 * 直接讲清楚，并把细节指回上游文档。两个都注册，由模型按需选用。
 */
const SKILLS = [
	{ name: 'ppt-master', dir: 'ppt-master' },
	{ name: 'ppt-master-dsh', dir: 'ppt-master-dsh' },
];

/**
 * skill 根目录的绝对路径，统一成正斜杠。
 *
 * 正斜杠在 Windows 的 Python / Git Bash / cmd 里都能用，反斜杠在 Bash 里要转义；
 * 而文档里的示例全是 `python3 ${SKILL_DIR}/scripts/...` 这种拼法，统一成
 * 正斜杠才能保证拼出来的路径在两种 shell 下都直接可执行。
 *
 * @param dir skill 在包内的目录名。
 * @returns 该 skill 的根目录，末尾不带分隔符。
 */
function resolveSkillDir(dir = 'ppt-master') {
	return fileURLToPath(new URL(`${dir}/`, SKILLS_ROOT_URL))
		.replace(/[\\/]+$/, '')
		.replaceAll('\\', '/');
}

/** 上游 skill 载荷的绝对路径（`ppt-master-dsh` 里用它引用详细规范）。 */
function resolvePayloadDir() {
	return resolveSkillDir('ppt-master');
}

/**
 * 解析 YAML frontmatter 的**最小子集**。
 *
 * 刻意不依赖 `yaml` 包：本包声明零依赖，装到任何 profile 里都不会因为
 * 缺一个第三方模块而加载失败。SKILL.md 的 frontmatter 只用到 `key: value`、
 * 折叠块（`>`）与一层嵌套 map（`metadata:`），足够覆盖。
 *
 * @param text frontmatter 内部文本（不含 `---` 分隔行）。
 * @returns 解析出的键值对象。
 */
function parseYamlSubset(text) {
	const root = {};
	/** 缩进栈：每层一个 `{ indent, node }`。 */
	const stack = [{ indent: -1, node: root }];
	const lines = text.split(/\r?\n/);

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		if (line.trim() === '' || line.trimStart().startsWith('#')) continue;

		const indent = line.length - line.trimStart().length;
		const content = line.trim();
		while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
		const parent = stack[stack.length - 1].node;

		const colon = content.indexOf(':');
		if (colon < 0) continue;
		const key = content.slice(0, colon).trim();
		const rest = content.slice(colon + 1).trim();
		if (key === '') continue;

		// 折叠块 `>` / 字面块 `|`，可带 chomping 指示符。
		if (/^[>|][+-]?$/.test(rest)) {
			const folded = rest[0] === '>';
			const block = [];
			let blockIndent = -1;
			let j = i + 1;
			for (; j < lines.length; j += 1) {
				const raw = lines[j];
				if (raw.trim() === '') {
					block.push('');
					continue;
				}
				const rawIndent = raw.length - raw.trimStart().length;
				if (rawIndent <= indent) break;
				if (blockIndent < 0) blockIndent = rawIndent;
				block.push(raw.slice(Math.min(blockIndent, raw.length)));
			}
			i = j - 1;
			while (block.length > 0 && block[block.length - 1] === '') block.pop();
			parent[key] = folded ? foldBlock(block) : block.join('\n');
			continue;
		}

		// 空值 → 视为嵌套 map 的开头。
		if (rest === '') {
			const child = {};
			parent[key] = child;
			stack.push({ indent, node: child });
			continue;
		}

		parent[key] = stripQuotes(rest);
	}

	return root;
}

/**
 * 按 YAML 折叠规则合并块内容：同段内用空格连接，空行分段。
 *
 * @param block 块内各行（已去掉公共缩进）。
 * @returns 折叠后的字符串。
 */
function foldBlock(block) {
	const groups = [];
	let current = [];
	for (const line of block) {
		if (line.trim() === '') {
			if (current.length > 0) {
				groups.push(current);
				current = [];
			}
			continue;
		}
		current.push(line.trim());
	}
	if (current.length > 0) groups.push(current);
	return groups.map((group) => group.join(' ')).join('\n');
}

/**
 * 去掉 YAML 标量两侧的成对引号。
 *
 * @param value 原始标量文本。
 * @returns 去引号后的值。
 */
function stripQuotes(value) {
	if (value.length >= 2) {
		const first = value[0];
		const last = value[value.length - 1];
		if ((first === '"' && last === '"') || (first === "'" && last === "'")) return value.slice(1, -1);
	}
	return value;
}

/**
 * 拆出 frontmatter 与正文。
 *
 * @param raw SKILL.md 全文。
 * @returns `{ attributes, body }`；没有 frontmatter 时 attributes 为空对象。
 */
function splitFrontmatter(raw) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(raw);
	if (match === null) return { attributes: {}, body: raw };
	return { attributes: parseYamlSubset(match[1]), body: raw.slice(match[0].length) };
}

/** 官方 `BUNDLED_SKILL_RANK`；见文件头注释说明为何硬编码。 */
const BUNDLED_SKILL_RANK = 600;

/**
 * 把正文里的占位符展开成真实绝对路径。
 *
 * 两个占位符：
 *   - `${SKILL_DIR}`   → 本 skill 自己的根目录（上游 SKILL.md 用它指脚本）；
 *   - `${PAYLOAD_DIR}` → 上游 skill 载荷目录（精简版用它指回详细规范）。
 *
 * `replaceAll` 是有意为之：JS 的字符串替换会把 `$&`、`$1` 之类当特殊模式，
 * 而 Windows 路径里可能出现 `$`，用函数式替换可以完全绕开这个坑。
 *
 * @param body SKILL.md 正文。
 * @param skillDir 本 skill 根目录绝对路径（正斜杠）。
 * @param payloadDir 上游载荷根目录绝对路径（正斜杠）；省略时现场解析。
 * @returns 展开后的正文。
 */
function expandSkillDir(body, skillDir, payloadDir) {
	const payload = payloadDir ?? resolvePayloadDir();
	return body.replaceAll('${SKILL_DIR}', () => skillDir).replaceAll('${PAYLOAD_DIR}', () => payload);
}

/**
 * 读取并解析包内携带的某个 skill。
 *
 * 每次调用都重新读盘：与官方 filesystem provider 的语义一致 —— 目录条目与正文
 * 生命周期分离，编辑正文不需要重启。
 *
 * @param dir skill 在包内的目录名。
 * @returns `{ name, description, whenToUse, metadata, content, path, dir, resourceBase }`。
 */
async function loadSkill(dir) {
	const fileUrl = new URL(`${dir}/SKILL.md`, SKILLS_ROOT_URL);
	const raw = await readFile(fileUrl, 'utf8');
	const { attributes, body } = splitFrontmatter(raw);
	const skillDir = resolveSkillDir(dir);

	const name = typeof attributes.name === 'string' && attributes.name !== '' ? attributes.name : dir;
	const description = typeof attributes.description === 'string' ? attributes.description : '';

	return {
		dir,
		name,
		description,
		whenToUse: typeof attributes.whenToUse === 'string' ? attributes.whenToUse : undefined,
		metadata: typeof attributes.metadata === 'object' && attributes.metadata !== null ? attributes.metadata : undefined,
		content: expandSkillDir(body, skillDir),
		path: fileURLToPath(fileUrl),
		resourceBase: { kind: 'directory', path: skillDir },
		locator: fileUrl,
	};
}

/**
 * 构造 skill provider。
 *
 * 一个 provider 可以同时提供多个 skill：`list()` 返回全部候选，`get(name)`
 * 按名取正文。这里两个 skill 共用同一个 provider，因为它们同属一个包、
 * 同一个优先级，分开注册反而会让 rank 语义变复杂。
 *
 * @param providerName 注册到 `ctx.skills` 的 provider 名。
 * @param rank 优先级；数字小的赢。
 * @returns `{ name, list, get }`。
 */
function createProvider(providerName, rank) {
	/** 目录条目缓存：避免 `list()` 每次都把两份正文读进内存。 */
	let candidates = null;

	return {
		name: providerName,

		/** 返回全部候选；description 现读，保证与 SKILL.md 同步。 */
		async list() {
			const rows = await Promise.all(SKILLS.map((entry) => loadSkill(entry.dir)));
			candidates = new Map(rows.map((row) => [row.name, row]));
			return rows.map((row) => ({
				name: row.name,
				description: row.description,
				invocation: { modelInvocable: true, userInvocable: true },
				provider: providerName,
				source: 'bundled',
				resourceBase: row.resourceBase,
				rank,
				locator: row.locator,
				metadata: row.metadata,
			}));
		},

		/**
		 * 加载正文。
		 *
		 * ⚠ 调用约定：registry 传进来的第一个参数是**候选对象**（`list()` 返回的那条），
		 * 不是名字字符串 —— 见 `SkillRegistry.get()` 里的
		 * `match.provider.get(match.candidate, options)`。这里同时容忍字符串，
		 * 便于手工调用与测试。
		 *
		 * @param candidate `list()` 返回的候选对象，或 skill 名。
		 * @returns 完整 skill 定义，或 undefined（名字不存在）。
		 */
		async get(candidate) {
			const wanted =
				typeof candidate === 'string'
					? candidate
					: typeof candidate?.name === 'string' && candidate.name !== ''
						? candidate.name
						: SKILLS[0].name;

			// 先查缓存，未命中再整体加载一次（`get` 可能先于 `list` 被调用）。
			let row = candidates?.get(wanted);
			if (row === undefined) {
				const rows = await Promise.all(SKILLS.map((entry) => loadSkill(entry.dir)));
				candidates = new Map(rows.map((r) => [r.name, r]));
				row = candidates.get(wanted);
			}
			if (row === undefined) return undefined;

			return {
				name: row.name,
				description: row.description,
				whenToUse: row.whenToUse,
				metadata: row.metadata,
				invocation: { modelInvocable: true, userInvocable: true },
				provider: providerName,
				source: 'bundled',
				resourceBase: row.resourceBase,
				content: row.content,
				path: row.path,
			};
		},
	};
}

/** Cordis 插件名。 */
export const name = 'dsh-ppt-master';

/**
 * 依赖注入：工具注册表 + skill 注册表。
 *
 * 两者都由预设里的兄弟行提供（`skill-filesystem` / `tool-*` 已带起 `tools`），
 * 所以本插件不需要 `systemPrompt` 之类更前置的服务。
 */
export const inject = ['tools', 'skills'];

/**
 * 注册 PPT Master 的工具集与 skill provider。
 *
 * @param ctx Cordis 上下文。
 * @param config 可选配置。
 * @param config.providerName 覆盖 skill 注册名（默认 `ppt-master`）。
 * @param config.rank 覆盖 skill 优先级（默认 600 = `BUNDLED_SKILL_RANK`）。
 * @param config.tools 是否注册工具集（默认 true）。
 * @param config.skill 是否注册 skill provider（默认 true）。
 */
export function apply(ctx, config = {}) {
	const wantTools = config.tools !== false;
	const wantSkill = config.skill !== false;

	if (wantTools) {
		const skillDir = resolveSkillDir();
		for (const definition of createToolDefinitions({ skillDir })) {
			ctx.tools.register(definition);
		}
	}

	if (wantSkill) {
		const providerName =
			typeof config.providerName === 'string' && config.providerName !== '' ? config.providerName : PROVIDER_NAME;
		const rank = Number.isInteger(config.rank) && config.rank > 0 ? config.rank : BUNDLED_SKILL_RANK;
		ctx.skills.registerProvider(() => createProvider(providerName, rank));
	}
}

/** 供测试与自检使用。 */
export const __internals = {
	parseYamlSubset,
	splitFrontmatter,
	expandSkillDir,
	resolveSkillDir,
	loadSkill,
	createToolDefinitions,
	BUNDLED_SKILL_RANK,
};
