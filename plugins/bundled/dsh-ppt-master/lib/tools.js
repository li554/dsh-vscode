/**
 * PPT Master 工具集：把 skill 里 user-facing 的 Python 脚本逐个包成 DSH 工具。
 *
 * 设计取舍
 * --------
 * 1. **细粒度、一个脚本一个工具**。每个工具的参数直接映射该脚本的真实 CLI，
 *    并在 `extra_args` 里留了逃生口 —— 凡是这里没建模的旗标都能原样透传，
 *    所以脚本的任何能力都不会因为封装而丢失。
 *
 * 2. **不重写脚本逻辑**。这层只做「参数 → argv」的翻译与执行，脚本仍然是唯一
 *    事实来源。skill 更新脚本时，这里通常无需同步改动。
 *
 * 3. **不做流程编排**。PPT Master 的核心价值之一是流程纪律（强制八项确认、
 *    禁止脚本生成 SVG、逐页 spec_lock 复读），那部分留在 SKILL.md 里由模型
 *    遵守 —— 把流水线硬编码成工具反而会绕开这些闸门。工具只负责"把这一步做掉"。
 *
 * @module dsh-ppt-master/tools
 */

import { resolve } from 'node:path';
import { runScript, runPythonCode, environmentReport, renderWithRsvg } from './runner.js';

/**
 * 把「作者向」schema 编译成 `ctx.tools.register` 要求的**原生 JSON Schema**。
 *
 * 为什么需要这一步：`defineTool`（官方包）接受 `{ type, required: true }` 这种
 * 作者向写法并替你编译，但那要先 `import '@deepseek-ai/dsh-tools'`。本包刻意保持
 * 零依赖 —— 一个未声明的运行时 import 在别人的 profile 里可能解析不到，会让整个
 * 预设装载失败。所以这里自己实现等价的一小段翻译。
 *
 * 两条硬规则（原生 schema 比作者向写法严格）：
 *   1. `required` 必须是**对象级字符串数组**，不能写在单个属性上；
 *   2. `additionalProperties` 出现时必须是显式布尔值。
 *
 * @param node 作者向 schema 节点。
 * @returns 原生 JSON Schema 节点。
 */
function toRawSchema(node) {
	const out = {};
	if (typeof node.description === 'string') out.description = node.description;
	if (typeof node.title === 'string') out.title = node.title;

	if (Array.isArray(node.enum)) out.enum = [...node.enum];
	if (Object.hasOwn(node, 'const')) out.const = node.const;

	if (node.type === 'object' || node.properties !== undefined) {
		out.type = 'object';
		out.additionalProperties = false;
		const properties = {};
		const required = [];
		for (const [key, child] of Object.entries(node.properties ?? {})) {
			properties[key] = toRawSchema(child);
			if (child.required === true) required.push(key);
		}
		out.properties = properties;
		if (required.length > 0) out.required = required;
		return out;
	}

	if (node.type === 'array') {
		out.type = 'array';
		if (node.items !== undefined) out.items = toRawSchema(node.items);
		return out;
	}

	out.type = node.type ?? 'string';
	return out;
}

/** 把参数字典编译成原生对象 schema（不封口，与 `defineTool` 的默认行为一致）。 */
function toRawParameters(params) {
	const properties = {};
	const required = [];
	for (const [key, child] of Object.entries(params)) {
		properties[key] = toRawSchema(child);
		if (child.required === true) required.push(key);
	}
	const schema = { type: 'object', properties };
	if (required.length > 0) schema.required = required;
	return schema;
}

/** 所有工具共用的输出 schema：执行结论 + 原文输出。 */
const OUTPUT_SCHEMA = toRawSchema({
	type: 'object',
	additionalProperties: false,
	properties: {
		ok: { type: 'boolean', required: true, description: '脚本是否正常结束（退出码为 0 且未超时）。' },
		exitCode: { type: 'integer', required: true, description: '退出码；-1 表示未能启动。' },
		timedOut: { type: 'boolean', required: true, description: '是否因超时被终止。' },
		output: { type: 'string', required: true, description: '脚本的 stdout/stderr 原文。' },
	},
});

/** 全部工具共用的工作目录参数。 */
const CWD_PARAM = {
	type: 'string',
	description: '执行时的工作目录（默认会话工作目录）。相对路径按会话工作目录解析。',
};

/** 全部工具共用的透传参数。 */
const EXTRA_PARAM = {
	type: 'array',
	items: { type: 'string' },
	description: '原样追加到命令行末尾的额外参数。用于本工具未建模的旗标，例如 ["--dry-run","--pages","01","02"]。',
};

/**
 * 把一个值推入 argv（跳过 undefined / null / false）。
 *
 * @param argv 目标数组。
 * @param flag 旗标名；空串表示位置参数。
 * @param value 参数值。
 */
function push(argv, flag, value) {
	if (value === undefined || value === null || value === false) return;
	if (flag === '') argv.push(String(value));
	else argv.push(flag, String(value));
}

/** 布尔旗标：真值才出现。 */
function pushFlag(argv, flag, value) {
	if (value === true) argv.push(flag);
}

/** 追加 extra_args。 */
function pushExtra(argv, args) {
	if (Array.isArray(args.extra_args)) for (const item of args.extra_args) argv.push(String(item));
}

/**
 * 构造一个「跑脚本」的工具定义。
 *
 * @param spec 工具规格。
 * @param spec.name 工具名。
 * @param spec.summary 一句话说明（会拼进 description）。
 * @param spec.detail 补充说明：参数顺序、输出位置、注意事项。
 * @param spec.script skill 内的脚本相对路径（正斜杠）。与 `spec.resolveScript` 二选一。
 * @param spec.resolveScript `(args) => string`，按参数动态决定脚本路径。
 * @param spec.params 额外参数定义（作者向 schema），会与 cwd/extra_args 合并。
 * @param spec.build `(argv, args) => void`，把参数翻译成命令行。
 * @param spec.timeoutMs 默认超时。
 * @returns DSH 工具定义。
 */
function scriptTool(spec) {
	const params = { ...(spec.params ?? {}), extra_args: EXTRA_PARAM, cwd: CWD_PARAM };
	return {
		name: spec.name,
		description: `${spec.summary}\n\n${spec.detail ?? ''}\n\n未列出的旗标可用 extra_args 原样透传。`,
		parameters: toRawParameters(params),
		timeoutMs: spec.timeoutMs ?? 600000,
		output: {
			schema: OUTPUT_SCHEMA,
			render: (_args, value) => [{ type: 'text', text: value.output }],
		},
		async execute(args, exec) {
			// 批量路径：把 N 次单值调用压成一次进程（见 ppt_svg_metrics 的 texts）。
			if (typeof spec.batch === 'function') {
				const handled = await spec.batch(args, exec);
				if (handled !== null && handled !== undefined) return { timedOut: false, ...handled };
			}

			const argv = [];
			spec.build(argv, args);
			pushExtra(argv, args);
			const rel = typeof spec.resolveScript === 'function' ? spec.resolveScript(args) : spec.script;
			const timeoutMs = spec.timeoutMs ?? 600000;
			const result = await runScript(
				{ script: `${spec.skillDir}/${rel}`, timeoutMs },
				argv,
				{ cwd: args.cwd, signal: exec?.signal, timeoutMs },
			);
			if (result.ok === false && typeof spec.onFailure === 'function') {
				// 个别工具在脚本失败时还能换个后端救回来（如 ppt_render 的 rsvg 回退）。
				// 返回 null 表示「不接管」，照常返回原始失败结果。
				const recovered = await spec.onFailure(args, result);
				if (recovered !== null && recovered !== undefined) {
					return { timedOut: false, ...recovered };
				}
			}
			return { ok: result.ok, exitCode: result.exitCode, timedOut: result.timedOut, output: result.output };
		},
	};
}

/**
 * 批量文字度量用的内联 Python。
 *
 * 直接 import 上游 `svg_text_metrics.py` 复用它的 `text_width()`，而不是重算 ——
 * 度量必须与单条路径**完全一致**，否则批量与非批量会给出不同答案，那比慢更糟。
 *
 * `__CFG__` 会被替换成 `json.dumps(...)` 之后的配置字符串；`__SCRIPT__` 是脚本
 * 绝对路径。用 JSON 传值可以彻底避免中文/引号/反斜杠的转义问题。
 */
const BATCH_METRICS_PY = [
	'import importlib.util, json, sys, base64',
	'# 必须把 stdout 切成 UTF-8：Windows 上 Python 默认按本地代码页（cp936）编码，',
	'# 回显中文会被写成 GBK 字节，父进程按 UTF-8 解出来就是乱码。',
	'try:',
	'    sys.stdout.reconfigure(encoding="utf-8", errors="replace")',
	'except Exception:',
	'    pass',
	'cfg = json.loads(base64.b64decode("__CFG_B64__").decode("utf-8"))',
	'spec = importlib.util.spec_from_file_location("svg_text_metrics", "__SCRIPT__")',
	'mod = importlib.util.module_from_spec(spec)',
	'spec.loader.exec_module(mod)',
	'texts = cfg["texts"]',
	'size = cfg["size"]',
	'family = cfg.get("family") or "Microsoft YaHei"',
	'bold = bool(cfg.get("bold"))',
	'mode = cfg["mode"]',
	'out = []',
	'for t in texts:',
	'    w = float(mod.text_width(t, size, family, bold))',
	'    if mode == "width":',
	'        out.append({"text": t, "width": round(w, 1)})',
	'    else:',
	'        x = cfg.get("x")',
	'        right = cfg.get("right", 1220.0)',
	'        left = cfg.get("left", 60.0)',
	'        anchor = cfg.get("anchor") or "start"',
	'        if anchor == "middle":',
	'            x1, x2 = x - w / 2, x + w / 2',
	'        elif anchor == "end":',
	'            x1, x2 = x - w, x',
	'        else:',
	'            x1, x2 = x, x + w',
	'        over_right = max(0.0, x2 - right)',
	'        over_left = max(0.0, left - x1)',
	'        out.append({"text": t, "width": round(w, 1), "extent": [round(x1, 1), round(x2, 1)],',
	'                    "fits": bool(over_right <= 0.5 and over_left <= 0.5),',
	'                    "over_by": round(max(over_right, over_left))})',
	'print(json.dumps(out, ensure_ascii=False))',
	'',
	'if mode == "fit" and any(not r["fits"] for r in out):',
	'    sys.exit(1)',
].join('\n');

/**
 * 构造全部工具定义。
 *
 * @param options 选项。
 * @param options.skillDir skill 根目录绝对路径（正斜杠，末尾无分隔符）。
 * @returns 工具定义数组。
 */
export function createToolDefinitions({ skillDir }) {
	/** 每个脚本的工具规格。`build` 显式写出 argv 顺序 —— 脚本的 CLI 不规则，显式最可靠。 */
	const SPECS = [
		// ── 体检 ────────────────────────────────────────────────────────────
		{
			name: 'ppt_env',
			kind: 'env',
			summary: '体检 PPT Master 的 Python 环境：报告选中的解释器、版本，以及各功能组缺哪些依赖，并给出补齐命令。',
			detail:
				'本插件不会替你 pip install。第一次使用、或脚本报 ModuleNotFoundError 时先跑这个。\n' +
				'**Android / Termux 上它会把补齐命令分成 apt 与 pip 两条，照它给的顺序跑。**\n' +
				'⚠️ 原生扩展（Pillow / lxml / numpy / PyMuPDF）在 Android 上必须用 apt 装：\n' +
				'  PyPI 没有 android_arm64 轮子，`pip install lxml` 会退回源码构建并失败\n' +
				'  （缺 libxml2 头文件），而且要先下完整组才报错 —— 看到这个错别重试，改用 apt。\n' +
				'⚠️ apt 命令里的 `--no-install-recommends` 不要去掉：python-pip 的 Recommends 里有\n' +
				'  clang/make，默认会拖进整个 LLVM，实测同一条命令慢 8 倍以上（139s → 16s）。\n' +
				'⚠️ curl_cffi 在 Android 上装不上（依赖 cffi，需 clang 工具链源码构建），\n' +
				'  不要装它、也不要为它装 clang：它会让同一条 pip 命令里所有包都装不上。\n' +
				'⚠️ 视觉质检（ppt_render）首选 playwright，但它在 Android 上没有发行版：\n' +
				'  装不上不用慌，ppt_render 会自动回退 rsvg-convert，闸门照常可用。\n' +
				'可用环境变量 DSH_PPT_PYTHON 指定一个已装齐依赖的解释器绝对路径。',
		},

		// ── 素材转换 ────────────────────────────────────────────────────────
		{
			name: 'ppt_convert',
			kind: 'script',
			timeoutMs: 900000,
			resolveScript: (a) =>
				({
					pdf: 'scripts/source_to_md/pdf_to_md.py',
					doc: 'scripts/source_to_md/doc_to_md.py',
					excel: 'scripts/source_to_md/excel_to_md.py',
					ppt: 'scripts/source_to_md/ppt_to_md.py',
					web: 'scripts/source_to_md/web_to_md.py',
				})[a.kind] ?? 'scripts/source_to_md/doc_to_md.py',
			summary: '把素材转成 Markdown：PDF / Word / Excel / PowerPoint / 网页。',
			detail:
				'kind 决定用哪个转换器：pdf=PDF、doc=Word 等文档、excel=Excel 工作簿、ppt=PowerPoint、web=网页 URL。\n' +
				'PDF 需要 PyMuPDF；web 需要 requests（微信等站点建议再装 curl_cffi）。',
			params: {
				kind: {
					type: 'string',
					required: true,
					enum: ['pdf', 'doc', 'excel', 'ppt', 'web'],
					description: '素材类型，决定使用的转换器。',
				},
				source: { type: 'string', required: true, description: '源文件路径，或 web 时的 URL。' },
			},
			build(argv, a) {
				argv.push(a.source);
			},
		},
		{
			name: 'ppt_intake',
			kind: 'script',
			script: 'scripts/pptx_intake.py',
			summary: '标准 PPTX 吸取：把画布、母版身份、页几何、表格与原生图表数据写进项目 analysis/。',
			detail: 'source 是 .pptx/.pptm/.ppsx/.ppsm/.potx/.potm；-o 指项目 analysis 目录。',
			params: {
				source: { type: 'string', required: true, description: '源 PPTX 文件。' },
				output_dir: { type: 'string', required: true, description: '输出的项目 analysis 目录。' },
			},
			build(argv, a) {
				argv.push(a.source, '-o', a.output_dir);
			},
		},
		{
			name: 'ppt_pptx_to_svg',
			kind: 'script',
			script: 'scripts/pptx_to_svg.py',
			summary: '把 PPTX 反解成 SVG，用于参考/导入既有版式。',
			params: {
				pptx_file: { type: 'string', required: true, description: '源 PPTX。' },
				output: { type: 'string', description: '输出目录（-o）。' },
				media_subdir: { type: 'string', description: '媒体子目录名。' },
				embed_images: { type: 'boolean', description: '是否内嵌图片。' },
				inheritance_mode: { type: 'string', description: '版式继承模式。' },
			},
			build(argv, a) {
				argv.push(a.pptx_file);
				push(argv, '-o', a.output);
				push(argv, '--media-subdir', a.media_subdir);
				pushFlag(argv, '--embed-images', a.embed_images);
				push(argv, '--inheritance-mode', a.inheritance_mode);
			},
		},

		// ── 项目管理 ────────────────────────────────────────────────────────
		{
			name: 'ppt_project',
			kind: 'script',
			script: 'scripts/project_manager.py',
			summary: 'PPT 项目生命周期：init 建项目、import-sources 汇入素材、validate 校验、info 查看。',
			detail:
				'init: 只需 project_name，可选 --format（默认 ppt169）与 --dir。\n' +
				'import-sources: 需要 project_path 与一个以上 sources，可选 --move / --copy。\n' +
				'validate / info: 只需 project_path。',
			params: {
				action: {
					type: 'string',
					required: true,
					enum: ['init', 'import-sources', 'validate', 'info'],
					description: '要执行的动作。',
				},
				project: { type: 'string', description: 'init 时是项目名；其余动作时是项目路径。' },
				sources: {
					type: 'array',
					items: { type: 'string' },
					description: 'import-sources 时的素材文件或 URL 列表。',
				},
				format: { type: 'string', description: 'init 的画布格式，默认 ppt169。' },
				base_dir: { type: 'string', description: 'init 的项目基目录（--dir）。' },
				move: { type: 'boolean', description: 'import-sources 时移动而非复制本地素材（--move）。' },
			},
			build(argv, a) {
				argv.push(a.action);
				if (a.project !== undefined && a.project !== null) argv.push(String(a.project));
				if (Array.isArray(a.sources)) for (const s of a.sources) argv.push(String(s));
				push(argv, '--format', a.format);
				push(argv, '--dir', a.base_dir);
				pushFlag(argv, '--move', a.move);
			},
		},
		{
			name: 'ppt_icons',
			kind: 'script',
			script: 'scripts/icon_sync.py',
			summary: '把选定的图标库图标复制进 <project>/icons/。',
			detail: 'icons 用「库名/图标名」形式，例如 chunk-filled/home。漏掉的图标会列出并以非零码退出（重新挑选的闸门）。',
			params: {
				project_path: { type: 'string', required: true, description: '项目目录。' },
				icons: {
					type: 'array',
					items: { type: 'string' },
					required: true,
					description: '要复制的图标名，例如 ["chunk-filled/home","chunk-filled/user"]。',
				},
			},
			build(argv, a) {
				argv.push(a.project_path);
				if (Array.isArray(a.icons)) for (const i of a.icons) argv.push(String(i));
			},
		},
		{
			name: 'ppt_batch_validate',
			kind: 'script',
			script: 'scripts/batch_validate.py',
			summary: '批量校验项目/示例的规范性。',
			params: {
				directories: {
					type: 'array',
					items: { type: 'string' },
					description: '要扫描的目录列表，省略配合 all=true 使用。',
				},
				all: { type: 'boolean', description: '校验示例与项目（--all）。' },
				export: { type: 'boolean', description: '写校验报告（--export）。' },
				output: { type: 'string', description: '报告路径，配合 export 使用。' },
			},
			build(argv, a) {
				if (Array.isArray(a.directories)) for (const d of a.directories) argv.push(String(d));
				pushFlag(argv, '--all', a.all);
				pushFlag(argv, '--export', a.export);
				push(argv, '--output', a.output);
			},
		},

		// ── 模板 ────────────────────────────────────────────────────────────
		{
			name: 'ppt_template_import',
			kind: 'script',
			script: 'scripts/pptx_template_import.py',
			summary: '从既有 PPTX 提取可复用模板/版式。',
			params: {
				pptx_file: { type: 'string', required: true, description: '模板 PPTX。' },
				output: { type: 'string', description: '输出目录（-o）。' },
				manifest_only: { type: 'boolean', description: '只生成清单（--manifest-only）。' },
				embed_images: { type: 'boolean', description: '内嵌图片。' },
				inheritance_mode: { type: 'string', description: '继承模式，如 both。' },
			},
			build(argv, a) {
				argv.push(a.pptx_file);
				push(argv, '-o', a.output);
				pushFlag(argv, '--manifest-only', a.manifest_only);
				pushFlag(argv, '--embed-images', a.embed_images);
				push(argv, '--inheritance-mode', a.inheritance_mode);
			},
		},
		{
			name: 'ppt_template_register',
			kind: 'script',
			script: 'scripts/register_template.py',
			summary: '把模板注册进模板索引（layer 模板库）。',
			detail: '省略 template_id 时列出已注册模板；--rebuild-all 重建索引；--dry-run 只预览。',
			params: {
				template_id: { type: 'string', description: '要注册的模板 id，省略则列出。' },
				kind: { type: 'string', description: '模板种类，默认 deck。' },
				rebuild_all: { type: 'boolean', description: '重建全部索引。' },
				dry_run: { type: 'boolean', description: '只预览不写入。' },
			},
			build(argv, a) {
				push(argv, '', a.template_id);
				push(argv, '--kind', a.kind);
				pushFlag(argv, '--rebuild-all', a.rebuild_all);
				pushFlag(argv, '--dry-run', a.dry_run);
			},
		},
		{
			name: 'ppt_fill',
			kind: 'script',
			script: 'scripts/template_fill_pptx.py',
			summary: '直接填 PPTX 模板（不经过 SVG）：analyze 提取槽位、scaffold 生成填表骨架、check-plan 校验、apply 出片。',
			detail:
				'analyze: 需 pptx_file 与 output。\n' +
				'scaffold: 需 library_json 与 output，可选 slides。\n' +
				'check-plan: 需 library_json 与 plan_json，可选 output。\n' +
				'apply: 需 pptx_file 与 plan_json，可选 output 与 transition。',
			params: {
				action: {
					type: 'string',
					required: true,
					enum: ['analyze', 'scaffold', 'check-plan', 'apply'],
					description: '要执行的动作。',
				},
				pptx_file: { type: 'string', description: 'analyze / apply 的源 PPTX。' },
				library_json: { type: 'string', description: 'scaffold / check-plan 用的 slide_library.json。' },
				plan_json: { type: 'string', description: 'check-plan / apply 用的 fill_plan.json。' },
				output: { type: 'string', description: '输出路径（-o）。' },
				slides: { type: 'string', description: 'scaffold 时选页，如 "1,3,4"。' },
				transition: { type: 'string', description: 'apply 的切页效果，none 移除、keep 保留。' },
			},
			build(argv, a) {
				argv.push(a.action);
				if (a.action === 'analyze') {
					push(argv, '', a.pptx_file);
					push(argv, '-o', a.output);
				} else if (a.action === 'scaffold') {
					push(argv, '', a.library_json);
					push(argv, '-o', a.output);
					push(argv, '--slides', a.slides);
				} else if (a.action === 'check-plan') {
					push(argv, '', a.library_json);
					push(argv, '', a.plan_json);
					push(argv, '-o', a.output);
				} else {
					push(argv, '', a.pptx_file);
					push(argv, '', a.plan_json);
					push(argv, '-o', a.output);
					push(argv, '--transition', a.transition);
				}
			},
		},
		{
			name: 'ppt_spec_update',
			kind: 'script',
			script: 'scripts/update_spec.py',
			summary: '改 spec_lock.md 里的颜色/字体，并把变更传播到所有已生成的 SVG。',
			detail: 'assignment 形如 colors.primary=#0066AA；--dry-run 只预览会改动哪些文件。',
			params: {
				project_path: { type: 'string', required: true, description: '含 spec_lock.md 与 svg_output/ 的项目目录。' },
				assignment: { type: 'string', required: true, description: '形如 section.key=value 的赋值。' },
				dry_run: { type: 'boolean', description: '只预览不写入。' },
			},
			build(argv, a) {
				argv.push(a.project_path, a.assignment);
				pushFlag(argv, '--dry-run', a.dry_run);
			},
		},

		// ── 图片 ────────────────────────────────────────────────────────────
		{
			name: 'ppt_images_analyze',
			kind: 'script',
			script: 'scripts/analyze_images.py',
			summary: '分析项目 images/ 目录，产出 analysis/image_analysis.csv（真实尺寸等事实）。',
			detail: '图片事实必须"用时重算"，不要依赖陈旧结果。',
			params: {
				images_dir: { type: 'string', required: true, description: '图片目录，通常是 <project>/images。' },
				canvas: { type: 'string', description: '画布尺寸，如 1280x720。' },
			},
			build(argv, a) {
				argv.push(a.images_dir);
				push(argv, '--canvas', a.canvas);
			},
		},
		{
			name: 'ppt_image_gen',
			kind: 'script',
			script: 'scripts/image_gen.py',
			summary: 'AI 生图（多后端）：单张 prompt，或按 image_prompts.json 批量。',
			detail:
				'单张：给 prompt，可选 aspect_ratio / image_size / output / filename / model / backend。\n' +
				'批量：给 manifest 指向 image_prompts.json。\n' +
				'list_backends=true 可列出可用后端。',
			params: {
				prompt: { type: 'string', description: '生图提示词。' },
				aspect_ratio: { type: 'string', description: '宽高比，如 16:9 / 1:1。' },
				image_size: { type: 'string', description: '尺寸档位，如 1K / 2K。' },
				output: { type: 'string', description: '输出目录。' },
				filename: { type: 'string', description: '输出文件名（不含扩展名）。' },
				model: { type: 'string', description: '模型名。' },
				backend: { type: 'string', description: '后端名，覆盖 IMAGE_BACKEND。' },
				manifest: { type: 'string', description: '批量用的 image_prompts.json 路径。' },
				concurrency: { type: 'integer', description: '批量并发数。' },
				list_backends: { type: 'boolean', description: '列出可用后端后退出。' },
			},
			build(argv, a) {
				pushFlag(argv, '--list-backends', a.list_backends);
				if (a.list_backends === true) return;
				if (a.manifest !== undefined && a.manifest !== null) push(argv, '--manifest', a.manifest);
				else push(argv, '', a.prompt);
				push(argv, '--aspect_ratio', a.aspect_ratio);
				push(argv, '--image_size', a.image_size);
				push(argv, '-o', a.output);
				push(argv, '-f', a.filename);
				push(argv, '-m', a.model);
				push(argv, '-b', a.backend);
				push(argv, '--concurrency', a.concurrency);
			},
		},
		{
			name: 'ppt_image_search',
			kind: 'script',
			script: 'scripts/image_search.py',
			summary: '按关键词搜图并下载到项目里，同时写 image_sources.json 记录来源。',
			detail: 'strict_no_attribution=true 会拒绝需要署名的 CC BY 结果。',
			params: {
				query: { type: 'string', description: '搜索词（2-5 个关键词效果最好）。' },
				filename: { type: 'string', description: '落盘文件名，如 cover_bg.jpg。' },
				output: { type: 'string', description: '输出目录。' },
				provider: { type: 'string', description: '固定某个图源。' },
				orientation: { type: 'string', description: '偏好朝向。' },
				purpose: { type: 'string', description: '用途标签。' },
				slide: { type: 'string', description: '所属页标识，如 01_cover。' },
				strict_no_attribution: { type: 'boolean', description: '拒绝需要署名的结果。' },
				min_width: { type: 'integer', description: '最小宽度，默认 1200。' },
				min_height: { type: 'integer', description: '最小高度，默认 800。' },
				batch: { type: 'string', description: '批量查询 JSON 路径。' },
			},
			build(argv, a) {
				push(argv, '', a.query);
				push(argv, '--filename', a.filename);
				push(argv, '-o', a.output);
				push(argv, '--provider', a.provider);
				push(argv, '--orientation', a.orientation);
				push(argv, '--purpose', a.purpose);
				push(argv, '--slide', a.slide);
				pushFlag(argv, '--strict-no-attribution', a.strict_no_attribution);
				push(argv, '--min-width', a.min_width);
				push(argv, '--min-height', a.min_height);
				push(argv, '--batch', a.batch);
			},
		},
		{
			name: 'ppt_latex',
			kind: 'script',
			script: 'scripts/latex_render.py',
			summary: '按清单渲染 LaTeX 公式为 PNG 素材。',
			params: {
				project_path: { type: 'string', required: true, description: '项目目录。' },
				manifest: { type: 'string', description: '公式清单路径。' },
				dpi: { type: 'integer', description: '默认渲染 DPI。' },
				providers: { type: 'string', description: '逗号分隔的 provider 回退链。' },
				dry_run: { type: 'boolean', description: '只校验与列出，不渲染。' },
			},
			build(argv, a) {
				argv.push(a.project_path);
				push(argv, '--manifest', a.manifest);
				push(argv, '--dpi', a.dpi);
				push(argv, '--providers', a.providers);
				pushFlag(argv, '--dry-run', a.dry_run);
			},
		},
		{
			name: 'ppt_images_rotate',
			kind: 'script',
			script: 'scripts/rotate_images.py',
			summary: '按修正清单批量旋转图片。',
			params: {
				images_directory: { type: 'string', required: true, description: '图片目录。' },
				fixes_json: { type: 'string', required: true, description: '旋转修正清单 JSON。' },
			},
			build(argv, a) {
				argv.push(a.images_directory, a.fixes_json);
			},
		},
		{
			name: 'ppt_watermark_remove',
			kind: 'script',
			script: 'scripts/gemini_watermark_remover.py',
			summary: '去除 Gemini 生成图的水印。',
			params: {
				input: { type: 'string', required: true, description: '输入图片或目录。' },
				output: { type: 'string', description: '输出路径（-o）。' },
				quiet: { type: 'boolean', description: '安静模式。' },
			},
			build(argv, a) {
				argv.push(a.input);
				push(argv, '-o', a.output);
				pushFlag(argv, '-q', a.quiet);
			},
		},

		// ── SVG 流水线 ──────────────────────────────────────────────────────
		{
			name: 'ppt_svg_quality',
			kind: 'script',
			script: 'scripts/svg_quality_checker.py',
			summary: 'SVG 质量闸门：检查生成页面的规范符合性。',
			detail: 'target 传项目目录；也可配合 extra_args 使用 --all 等旗标。',
			params: {
				target: { type: 'string', required: true, description: '项目目录或 SVG 路径。' },
			},
			build(argv, a) {
				argv.push(a.target);
			},
		},
		{
			name: 'ppt_svg_metrics',
			kind: 'script',
			script: 'scripts/svg_text_metrics.py',
			summary: '真实字体度量：算文字精确宽度、判断是否溢出、给换行与安全底边审计。',
			detail:
				'action=width: 需要 text、size，可选 family / bold。\n' +
				'action=fit: 需要 text、size、x，可选 right / left / family / bold / anchor。\n' +
				'action=budget: 需要 size、width，可选 family / bold / sample。\n' +
				'action=wrap: 需要 text、size、width，可选 family / bold。\n' +
				'action=audit: 需要 target，可选 canvas / margin / quiet_margin / safe_bottom / json。\n' +
				'action=fonts: 列出解析到的字体文件。\n' +
				'\n' +
				'**批量用法（强烈推荐）**：要量多段文字时不要反复调用本工具 —— 用 texts 一次传完，\n' +
				'例如 texts=["标题一","标题二","副标题"]（配合 size）。一次进程内量完，比逐条快几十倍。',
			params: {
				action: {
					type: 'string',
					required: true,
					enum: ['width', 'fit', 'budget', 'wrap', 'audit', 'fonts'],
					description: '子命令。',
				},
				text: { type: 'string', description: '要度量的文本。' },
				texts: {
					type: 'array',
					items: { type: 'string' },
					description:
						'批量度量：一次量多段文字（与 text 二选一）。action=width 时逐条给出精确宽度；' +
						'action=fit 时逐条给出是否溢出。强烈建议用它代替 N 次单条调用。',
				},
				size: { type: 'number', description: '字号。' },
				family: { type: 'string', description: '字体族，默认 Microsoft YaHei。' },
				bold: { type: 'boolean', description: '粗体。' },
				x: { type: 'number', description: 'fit 的起点 x。' },
				right: { type: 'number', description: 'fit 的右边界。' },
				left: { type: 'number', description: 'fit 的左边界。' },
				anchor: { type: 'string', description: 'fit 的锚点 start/middle/end。' },
				width: { type: 'number', description: 'budget/wrap 的列宽。' },
				target: { type: 'string', description: 'audit 的目标 SVG 文件或目录。' },
				canvas: { type: 'string', description: 'audit 的画布，默认 1280x720。' },
				margin: { type: 'number', description: 'audit 的边距。' },
				quiet_margin: { type: 'boolean', description: 'audit 时只报重大问题。' },
				safe_bottom: { type: 'number', description: 'audit 的安全底边 y。' },
			},
			/**
			 * 批量文字度量：把 N 次「单条 text」调用合并成 **一次** Python 进程。
			 *
			 * 为什么值得单独做：实测一次真实会话里 `ppt_svg_metrics` 被调了 22 次，
			 * 每次只量一条文字（平均输出才 31 字符）。上游脚本的 `width` 子命令
			 * `--text` 是必填单项，没有批量入口，于是每条都是「一次进程启动 + 一次
			 * 模型往返」。而脚本里的 `text_width()` 是普通函数，直接 import 后循环
			 * 调用即可 —— 同样的字度量，22 次往返压成 1 次。
			 *
			 * 只在 `texts` 给出且 action 是 width/fit 时接管；其余情况返回 null，
			 * 走原本的 CLI 路径。
			 */
			async batch(args) {
				const list = Array.isArray(args.texts) ? args.texts.filter((t) => typeof t === 'string') : null;
				if (list === null || list.length === 0) return null;
				if (args.action !== 'width' && args.action !== 'fit') return null;

				const size = Number(args.size);
				if (!Number.isFinite(size)) {
					return {
						ok: false,
						exitCode: 2,
						output: 'action=width / fit 的批量度量需要 size（字号）；请补上 size 再调用。',
					};
				}

				const cfg = {
					texts: list,
					size,
					family: typeof args.family === 'string' ? args.family : undefined,
					bold: args.bold === true,
					mode: args.action,
					x: Number.isFinite(args.x) ? args.x : undefined,
					right: Number.isFinite(args.right) ? args.right : undefined,
					left: Number.isFinite(args.left) ? args.left : undefined,
					anchor: typeof args.anchor === 'string' ? args.anchor : undefined,
				};
				const code = BATCH_METRICS_PY.replace(
					'__CFG_B64__',
					Buffer.from(JSON.stringify(cfg), 'utf8').toString('base64'),
				).replace('__SCRIPT__', `${skillDir}/scripts/svg_text_metrics.py`);
				const result = await runPythonCode(code, { cwd: args.cwd, timeoutMs: 120000 });
				return { ok: result.ok, exitCode: result.exitCode, output: result.output };
			},
			build(argv, a) {
				argv.push(a.action);
				switch (a.action) {
					case 'width':
						push(argv, '--text', a.text);
						push(argv, '--size', a.size);
						push(argv, '--family', a.family);
						pushFlag(argv, '--bold', a.bold);
						break;
					case 'fit':
						push(argv, '--text', a.text);
						push(argv, '--size', a.size);
						push(argv, '--x', a.x);
						push(argv, '--right', a.right);
						push(argv, '--left', a.left);
						push(argv, '--family', a.family);
						pushFlag(argv, '--bold', a.bold);
						push(argv, '--anchor', a.anchor);
						break;
					case 'budget':
						push(argv, '--size', a.size);
						push(argv, '--width', a.width);
						push(argv, '--family', a.family);
						pushFlag(argv, '--bold', a.bold);
						break;
					case 'wrap':
						push(argv, '--text', a.text);
						push(argv, '--size', a.size);
						push(argv, '--width', a.width);
						push(argv, '--family', a.family);
						pushFlag(argv, '--bold', a.bold);
						break;
					case 'audit':
						push(argv, '', a.target);
						push(argv, '--canvas', a.canvas);
						push(argv, '--margin', a.margin);
						pushFlag(argv, '--quiet-margin', a.quiet_margin);
						push(argv, '--safe-bottom', a.safe_bottom);
						break;
					default:
						break;
				}
			},
		},
		{
			name: 'ppt_svg_finalize',
			kind: 'script',
			script: 'scripts/finalize_svg.py',
			summary: 'SVG 后处理统一入口：整理 svg_output → svg_final。',
			params: {
				project_dir: { type: 'string', required: true, description: '项目目录。' },
				dry_run: { type: 'boolean', description: '只预览不写入。' },
				quiet: { type: 'boolean', description: '安静模式。' },
				compress: { type: 'boolean', description: '压缩输出。' },
				max_dimension: { type: 'integer', description: '最大尺寸限制。' },
			},
			build(argv, a) {
				argv.push(a.project_dir);
				pushFlag(argv, '--dry-run', a.dry_run);
				pushFlag(argv, '-q', a.quiet);
				pushFlag(argv, '--compress', a.compress);
				push(argv, '--max-dimension', a.max_dimension);
			},
		},
		{
			name: 'ppt_svg_extract_assets',
			kind: 'script',
			script: 'scripts/extract_svg_assets.py',
			summary: '从导入/参考 SVG 里抽出矢量素材与图标，缩小文件体积。',
			params: {
				svg_dir: { type: 'string', required: true, description: '工作 SVG 目录。' },
				icons_dir: { type: 'string', description: '项目图标目录。' },
				id_prefix: { type: 'string', description: '生成素材 id 的前缀。' },
				inplace: { type: 'boolean', description: '原地重写而不是另写目录。' },
				clean_stale: { type: 'boolean', description: '清掉陈旧素材。' },
			},
			build(argv, a) {
				argv.push(a.svg_dir);
				push(argv, '--icons-dir', a.icons_dir);
				push(argv, '--id-prefix', a.id_prefix);
				pushFlag(argv, '--inplace', a.inplace);
				pushFlag(argv, '--clean-stale', a.clean_stale);
			},
		},
		{
			name: 'ppt_notes_split',
			kind: 'script',
			script: 'scripts/total_md_split.py',
			summary: '把总 Markdown 拆成逐页讲稿/旁白。',
			params: {
				project_path: { type: 'string', required: true, description: '项目目录。' },
				output: { type: 'string', description: '输出目录，默认项目下 notes。' },
				quiet: { type: 'boolean', description: '安静模式。' },
			},
			build(argv, a) {
				argv.push(a.project_path);
				push(argv, '-o', a.output);
				pushFlag(argv, '-q', a.quiet);
			},
		},
		{
			name: 'ppt_render',
			kind: 'script',
			script: 'scripts/render_inspection.py',
			summary: '强制视觉闸门：把 svg_final/ 渲染成 PNG，供逐页肉眼检查。',
			detail:
				'首选 playwright（装完库还要 `playwright install chromium`）。\n' +
				'**playwright 不可用时自动回退到 rsvg-convert**（librsvg）—— Android / Termux 上\n' +
				'playwright 没有可用的发行版，此时照样能把闸门跑完，**不要**为此手写渲染循环。\n' +
				'回退时复杂 CSS 的还原度略低于 Chromium，但查「重叠 / 溢出 / 被裁 / 碰撞」足够。\n' +
				'改过的页用 pages 只重渲那几页。',
			params: {
				project: { type: 'string', required: true, description: '项目路径。' },
				scale: { type: 'number', description: '设备缩放，默认 1.5。' },
				out: { type: 'string', description: '项目下的输出子目录名，默认 inspection。' },
				pages: {
					type: 'array',
					items: { type: 'string' },
					description: '只重渲指定页（--pages 01 02）。',
				},
			},
			build(argv, a) {
				argv.push(a.project);
				push(argv, '--scale', a.scale);
				push(argv, '--out', a.out);
				if (Array.isArray(a.pages) && a.pages.length > 0) {
					argv.push('--pages');
					for (const p of a.pages) argv.push(String(p));
				}
			},
			/** 见 `scriptTool` 的 `onFailure`：playwright 不可用时用 rsvg-convert 补跑。 */
			async onFailure(args, result) {
				/**
				 * 判定是否需要回退。
				 *
				 * `render_inspection.py` 的契约：退出码 3 = playwright 未安装；
				 * 127 = 找不到 Python（脚本根本没跑起来，但 rsvg-convert 不依赖 Python，
				 * 所以回退反而能救回来）。此外「库装了但没装浏览器」会抛异常，
				 * 输出里带 playwright 的安装提示，也一并接住。
				 */
				const playwrightMissing =
					result.exitCode === 3 ||
					result.exitCode === 127 ||
					(/playwright/i.test(result.output) &&
						/No module named|Executable doesn't exist|playwright install|Host system is missing|BrowserType\.launch/i.test(
							result.output,
						));
				if (!playwrightMissing) return null;

				const projectDir = resolve(args.cwd ?? process.cwd(), String(args.project));
				const fallback = await renderWithRsvg(projectDir, {
					scale: args.scale,
					out: args.out,
					pages: Array.isArray(args.pages) ? args.pages : undefined,
				});
				const note =
					`[回退] playwright 路径不可用（脚本退出码 ${result.exitCode}），` +
					'已自动改用 rsvg-convert 渲染。\n' +
					'无需再手动调用 rsvg-convert，也不要写渲染循环。\n\n';
				return { ok: fallback.ok, exitCode: fallback.exitCode, output: note + fallback.output };
			},
		},
		{
			name: 'ppt_contact_sheet',
			kind: 'script',
			script: 'scripts/build_contact_sheet.py',
			summary: '把渲染出的页面拼成一张总览图 —— 一次读图代替读 N 张。',
			params: {
				project_path: { type: 'string', required: true, description: '项目目录。' },
				dir: { type: 'string', description: '存放渲染 PNG 的子目录，默认 inspection。' },
				out: { type: 'string', description: '输出 PNG 路径。' },
				cols: { type: 'integer', description: '列数。' },
				width: { type: 'integer', description: '单格宽度。' },
				no_label: { type: 'boolean', description: '不标注文件名。' },
				rows: { type: 'boolean', description: '额外输出每行的长条图。' },
			},
			build(argv, a) {
				argv.push(a.project_path);
				push(argv, '--dir', a.dir);
				push(argv, '--out', a.out);
				push(argv, '--cols', a.cols);
				push(argv, '--width', a.width);
				pushFlag(argv, '--no-label', a.no_label);
				pushFlag(argv, '--rows', a.rows);
			},
		},
		{
			name: 'ppt_visual_review',
			kind: 'script',
			script: 'scripts/visual_review.py',
			summary: '可视化复核：汇总/呈现逐页渲染结果，辅助人工确认。',
			params: {
				project_path: { type: 'string', required: true, description: '含 svg_output/ 的项目目录。' },
			},
			build(argv, a) {
				argv.push(a.project_path);
			},
		},
		{
			name: 'ppt_check_annotations',
			kind: 'script',
			script: 'scripts/check_annotations.py',
			summary: '检查 SVG 上的人工标注指令是否已全部落地。',
			params: {
				path: { type: 'string', required: true, description: '项目目录或单个 SVG 文件。' },
			},
			build(argv, a) {
				argv.push(a.path);
			},
		},
		{
			name: 'ppt_animation',
			kind: 'script',
			script: 'scripts/animation_config.py',
			summary: '对象级动画配置：scaffold 生成骨架、list-groups 列出分组、validate 校验。',
			params: {
				action: {
					type: 'string',
					required: true,
					enum: ['scaffold', 'list-groups', 'validate'],
					description: '子命令。',
				},
				project_path: { type: 'string', required: true, description: '项目目录。' },
				force: { type: 'boolean', description: 'scaffold 时覆盖已有配置。' },
			},
			build(argv, a) {
				argv.push(a.action, a.project_path);
				pushFlag(argv, '--force', a.force);
			},
		},
		{
			name: 'ppt_narration',
			kind: 'script',
			script: 'scripts/notes_to_audio.py',
			summary: '把逐页讲稿合成为旁白音频（edge / elevenlabs / minimax / qwen / cosyvoice）。',
			params: {
				project_path: { type: 'string', description: '项目目录。' },
				output: { type: 'string', description: '输出目录（-o）。' },
				provider: { type: 'string', description: 'TTS 提供方，默认 edge。' },
				voice: { type: 'string', description: '音色名。' },
				rate: { type: 'string', description: '语速，如 "+10%"。' },
			},
			build(argv, a) {
				push(argv, '', a.project_path);
				push(argv, '-o', a.output);
				push(argv, '--provider', a.provider);
				push(argv, '--voice', a.voice);
				push(argv, '--rate', a.rate);
			},
		},

		// ── 导出 ────────────────────────────────────────────────────────────
		{
			name: 'ppt_export',
			kind: 'script',
			script: 'scripts/svg_to_pptx.py',
			summary: '导出为可编辑 PPTX（SVG → 原生形状）。',
			detail: 'source 默认用 svg_final；reveal / mode 控制动画与模式；-o 指定输出文件。',
			params: {
				project_path: { type: 'string', required: true, description: '项目目录。' },
				output: { type: 'string', description: '输出 PPTX 路径（-o）。' },
				source: { type: 'string', description: '取哪套 SVG，默认 final。' },
				format: { type: 'string', description: '输出格式（-f）。' },
				reveal: { type: 'string', description: '动画预设（--reveal）。' },
				mode: { type: 'string', description: '转换模式（--mode）。' },
				transition: { type: 'string', description: '切页效果。' },
				no_compat: { type: 'boolean', description: '关闭 Office 兼容模式。' },
				quiet: { type: 'boolean', description: '安静模式。' },
			},
			build(argv, a) {
				argv.push(a.project_path);
				push(argv, '-o', a.output);
				push(argv, '-s', a.source);
				push(argv, '-f', a.format);
				push(argv, '--reveal', a.reveal);
				push(argv, '--mode', a.mode);
				push(argv, '--transition', a.transition);
				pushFlag(argv, '--no-compat', a.no_compat);
				pushFlag(argv, '-q', a.quiet);
			},
			timeoutMs: 900000,
		},

		// ── 美化既有 PPTX ───────────────────────────────────────────────────
		{
			name: 'ppt_beautify_identity',
			kind: 'script',
			script: 'scripts/beautify_identity.py',
			summary: '美化工作流第一步：从既有 PPTX 提取视觉身份（配色/字体）。',
			params: {
				source: { type: 'string', required: true, description: '源 PPTX。' },
				output: { type: 'string', description: '输出路径（-o）。' },
			},
			build(argv, a) {
				argv.push(a.source);
				push(argv, '-o', a.output);
			},
		},
		{
			name: 'ppt_beautify_inventory',
			kind: 'script',
			script: 'scripts/beautify_inventory.py',
			summary: '美化工作流第二步：清点每页版式与素材，产出改造清单。',
			params: {
				slide_library: { type: 'string', required: true, description: 'slide_library.json。' },
				images: { type: 'string', description: '图片目录。' },
				output: { type: 'string', description: '输出路径（-o）。' },
			},
			build(argv, a) {
				argv.push(a.slide_library);
				push(argv, '--images', a.images);
				push(argv, '-o', a.output);
			},
		},
		{
			name: 'ppt_svg_position',
			kind: 'script',
			script: 'scripts/svg_position_calculator.py',
			summary: '版面定位计算器：按数据算柱宽、角度、半径等几何量，供手写 SVG 时取准坐标。',
			params: {
				data: { type: 'string', description: '数据（--data）。' },
				canvas: { type: 'string', description: '画布尺寸（--canvas）。' },
				area: { type: 'string', description: '绘制区域（--area）。' },
				horizontal: { type: 'boolean', description: '横向布局。' },
				value_range: { type: 'string', description: '数值范围。' },
				radius: { type: 'number', description: '外半径。' },
				inner_radius: { type: 'number', description: '内半径。' },
				start_angle: { type: 'number', description: '起始角。' },
			},
			build(argv, a) {
				push(argv, '--data', a.data);
				push(argv, '--canvas', a.canvas);
				push(argv, '--area', a.area);
				pushFlag(argv, '--horizontal', a.horizontal);
				push(argv, '--value-range', a.value_range);
				push(argv, '--radius', a.radius);
				push(argv, '--inner-radius', a.inner_radius);
				push(argv, '--start-angle', a.start_angle);
			},
		},
	];

	const tools = [];

	for (const spec of SPECS) {
		if (spec.kind === 'env') {
			tools.push({
				name: spec.name,
				description: `${spec.summary}\n\n${spec.detail ?? ''}`,
				parameters: toRawParameters({}),
				timeoutMs: 120000,
				output: {
					schema: toRawSchema({
						type: 'object',
						additionalProperties: false,
						properties: {
							ok: { type: 'boolean', required: true },
							report: { type: 'string', required: true },
						},
					}),
					render: (_args, value) => [{ type: 'text', text: value.report }],
				},
				async execute() {
					const info = await environmentReport();
					const lines = [];
					if (info.bin === null) {
						lines.push(`❌ ${info.hint}`);
						if (Array.isArray(info.tried) && info.tried.length > 0) {
							lines.push('', '已尝试：');
							for (const t of info.tried) lines.push(`  - ${t.bin}：${t.error}`);
						}
						return { ok: false, report: lines.join('\n') };
					}
					lines.push(`解释器：${info.bin}`);
					lines.push(`版本：${info.version}`);
					lines.push('');
					const missingRows = info.groups.filter((g) => g.missing.length > 0);
					if (missingRows.length === 0) {
						lines.push('依赖齐全，所有工具可用。');
					} else {
						lines.push('缺失依赖（按功能分组）：');
						for (const row of info.groups) {
							const mark = row.missing.length === 0 ? 'OK  ' : '缺  ';
							lines.push(`  [${mark}] ${row.name}${row.missing.length > 0 ? ` → ${row.missing.join(', ')}` : ''}`);
						}
						/**
						 * Android 上**必须**把 apt 与 pip 分成两条命令。
						 *
						 * 实测：`pip install lxml` 在 Termux 上必然失败（PyPI 没有
						 * android_arm64 轮子，源码构建又缺 libxml2 头文件），而 pip 会
						 * 先把整组下完再报错 —— 模型看到的是「装了十几分钟然后失败」，
						 * 再照着同一条命令重试，陷入死循环。
						 *
						 * 所以这里给的是：apt 一条（装原生扩展的预编译包），
						 * pip 一条（装纯 Python 包）。顺序不能反 —— 原生扩展装好后，
						 * 依赖它们的包（如 svglib → reportlab）才有意义。
						 */
						if (info.android) {
							lines.push('', '补齐命令（Android/Termux，**两条都要跑，先 apt 后 pip**）：');
							if (info.aptCommand !== '') {
								/**
								 * `--no-install-recommends` 是**实测必需**的，不是洁癖。
								 *
								 * Termux 的 `python-pip` 把 clang / make / pkg-config 写在
								 * Recommends 里，而 apt 默认装 Recommends —— 于是整个 LLVM
								 * （llvm / lld / libllvm）被拖进来。真机实测同一条命令
								 * **139 秒 → 16 秒**（10 个包 → 2 个包），而那堆编译器对
								 * 「装预编译包」这件事毫无用处。
								 *
								 * 其余 apt 组（python-pillow / lxml / numpy / pymupdf / librsvg）
								 * 实测带不带这个 flag 包数完全相同，所以加上它是纯收益。
								 */
								lines.push(`  1) apt-get install -y --no-install-recommends ${info.aptCommand}`);
								lines.push('     ↑ 原生扩展（Pillow/lxml/numpy/PyMuPDF）在 Termux 仓库里有预编译包。');
								lines.push('       这些包**不要**用 pip 装：PyPI 没有 android 轮子，会退回源码构建并失败。');
								lines.push('       `--no-install-recommends` 别去掉：python-pip 的 Recommends 里有 clang/make，');
								lines.push('       默认会拖进整个 LLVM，实测慢 8 倍以上（139s → 16s）。');
							} else {
								lines.push('  1) （无需 apt：原生扩展已就绪）');
							}
							if (info.pipCommand !== '') {
								lines.push(`  2) ${info.bin} -m pip install ${info.pipCommand}`);
							} else {
								lines.push('  2) （无需 pip：其余依赖已就绪）');
							}
						} else {
							lines.push('', '补齐命令（用上面这个解释器执行）：');
							lines.push(`  ${info.bin} -m pip install ${info.pipCommand}`);
						}
						/** playwright 装完还要下浏览器，这是独立的第二步命令。 */
						for (const step of info.postInstall ?? []) {
							lines.push(`  ${info.bin} -m ${step}`);
						}
						/**
						 * playwright 在 Android 上没有可发行版，硬装十几次是白费。
						 * 明确告诉模型「缺它不等于闸门废了」，免得它自己去绕路。
						 */
						if (info.groups.some((g) => g.missing.includes('playwright'))) {
							lines.push('');
							lines.push('关于视觉闸门（playwright 缺失时）：');
							lines.push('  若 playwright 在本平台装不上（Android/Termux 常见），**不用强行装**：');
							lines.push('  ppt_render 会自动回退到 rsvg-convert（librsvg），闸门照常可用。');
							lines.push('  直接跑 ppt_render 即可，不要自己手写渲染循环。');
						}
						/**
						 * `rsvg-convert` 缺失必须单独说，因为它是 Android 上**唯一**能用的渲染后端。
						 *
						 * 真机实测缺口（2026-10-10）：全新环境里 playwright 装不上、librsvg 也没装，
						 * 于是「回退」路径同样不可用 —— 视觉闸门整条断掉，而提示只说
						 * 「会自动回退 rsvg-convert」，模型据此以为不必管。
						 */
						if (info.groups.some((g) => g.missing.includes('rsvg-convert'))) {
							lines.push('');
							lines.push('⚠️ 渲染后端 rsvg-convert 也缺失 —— 它是 Android 上**唯一**可用的后端');
							lines.push('   （playwright 在 Android 上没有发行版）。上面的 apt 命令已含 librsvg；');
							lines.push('   若你刚才没跑 apt，请务必先跑：apt-get install -y --no-install-recommends librsvg');
							lines.push('   否则 ppt_render 的视觉闸门会完全不可用（两个后端都缺）。');
						}
						/**
						 * `curl_cffi` 缺了必须显式说「别装」。
						 *
						 * 真机实测：它在 Android 上要源码构建 cffi，而构建需要
						 * `aarch64-linux-android-clang`（只有装了 clang 的 Termux 才有），
						 * 跑 117 秒后失败。**pytest 式的原子性**让同一条 pip 命令里
						 * 一个包都不落地，模型却只看到 `Failed building wheel for cffi`。
						 *
						 * 所以这里不但要说不装，还要说清「装它会把别的包一起拖下水」——
						 * 否则模型很可能换个顺序再试一次。
						 */
						if (info.groups.some((g) => g.missing.includes('curl_cffi'))) {
							lines.push('');
							lines.push('关于 curl_cffi（Android 上装不上）：');
							lines.push('  它依赖 cffi，cffi 在 Android 上只能源码构建，需要 aarch64-linux-android-clang');
							lines.push('  （即 clang 工具链），实测跑 117 秒后失败。**不要尝试安装它**，也不要为它装 clang。');
							lines.push('  只在抓强反爬站点时才用到；requests 是主路径，不影响正常流程。');
						}
						/**
						 * 其余「Android 上必然构建失败」的包，统一提示。
						 *
						 * 它们的共同点是拖进 Rust 扩展（rpds-py / cryptography），
						 * 而 PyPI 没有 android 轮子。pip 的原子性会让它们**废掉整条命令**，
						 * 所以必须让模型知道「缺这些是正常的、别去装、也别重试」。
						 */
						const androidBlocked = [
							['nbconvert', 'rpds-py', '只用于 .ipynb 笔记本转幻灯片'],
							['google.genai', 'cryptography', '只用于 Gemini 生成配图'],
						].filter(([mod]) =>
							info.groups.some((g) => g.missing.includes(mod)),
						);
						if (androidBlocked.length > 0) {
							lines.push('');
							lines.push('以下包在 Android 上**装不上，属正常**（不要尝试，也不要为此装编译工具链）：');
							for (const [mod, dep, note] of androidBlocked) {
								lines.push(`  ${mod} → 依赖 ${dep}（Rust 扩展，PyPI 无 android 轮子，源码构建失败）；${note}。`);
							}
							lines.push('  ⚠️ 它们会让**同一条 pip 命令里所有包**都装不上（pip 是原子的），');
							lines.push('     所以上面的 pip 命令已经把它们排除了，照抄即可。');
						}
					}
					return { ok: info.ok, report: lines.join('\n') };
				},
			});
			continue;
		}

		if (spec.kind === 'convert') {
			// 五个转换器脚本形态完全一致（<script> <source>），用一个工具按 kind 分派。
			continue;
		}

		tools.push(scriptTool({ ...spec, skillDir }));
	}

	return tools;
}
