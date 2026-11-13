window.__ModuleLoader__.load({
	id: "dsh-mnemon-source-skills",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let dsh_mnemon_client = require("dsh-mnemon/client");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/api.ts
		function json(value) {
			return JSON.parse(JSON.stringify(value ?? null));
		}
		const CONFLICT = /revision conflict|Skills Source changed since it was read; reload/u;
		/**
		* The Source's revision moves with every background review and run, so each
		* write fetches it first and tries once more if a background write slipped in
		* between. A conflict is refused before anything runs, and every write here
		* carries its own precondition, so retrying never applies one twice.
		*/
		function skillsPageClient(management) {
			const read = async (operation, input = null, coalesce = false) => (await management.read(operation, json(input), { coalesce })).value;
			const fresh = async () => (await management.read("revision", null)).revision;
			const retry = async (attempt) => {
				for (let count = 1;; count++) try {
					return (await attempt(await fresh())).value;
				} catch (error) {
					if (count >= 3 || !CONFLICT.test(error instanceof Error ? error.message : String(error))) throw error;
				}
			};
			const mutate = (operation, input) => retry((revision) => management.mutate(operation, json(input), {
				confirmed: true,
				expectedRevision: revision
			}));
			const assist = (operation, input) => {
				if (management.assistance?.operations.includes(operation) !== true) return Promise.reject(/* @__PURE__ */ new Error("a task Agent is not available for this action"));
				return retry((revision) => management.assistance.execute(operation, json(input), {
					expectedRevision: revision,
					confirmed: true
				}));
			};
			const savedModel = async (slot, input) => {
				if (input.provider !== void 0 || input.model !== void 0) return void 0;
				const preferences = await read("draft-preferences");
				const overrides = slot === "draft" ? preferences.suggestionModels : preferences.skillRunModels;
				const key = slot === "draft" ? input.suggestionId : input.skillName;
				return key !== void 0 && Object.hasOwn(overrides, key) ? overrides[key] : slot === "draft" ? preferences.model : preferences.runModel;
			};
			return {
				overview: () => read("overview", null, true),
				catalog: () => read("catalog", null, true),
				skill: (key) => read("skill", { key }),
				version: (key, id) => read("version", {
					key,
					id
				}),
				suggestions: (status) => read("suggestions", status === void 0 ? {} : { status }, true),
				suggestion: (id) => read("suggestion", { id }),
				trajectories: (filter) => read("trajectories", filter ?? {}, true),
				trajectory: (id) => read("trajectory", { id }),
				cases: (skill) => read("cases", skill === void 0 ? {} : { skill }, true),
				runs: (skill) => read("runs", skill === void 0 ? {} : { skill }, true),
				run: (id) => read("run", { id }),
				draft: (id) => read("draft", { id }),
				reviews: (filter) => read("reviews", filter ?? {}, true),
				evidencePack: (input) => read("evidence-pack", input),
				createSkill: (input) => mutate("skill-create", input),
				saveSkill: (key, content, expectedHash) => mutate("skill-save", {
					key,
					content,
					expectedHash
				}),
				setInvocation: (key, invocation, expectedHash) => mutate("skill-invocation", {
					key,
					...invocation,
					expectedHash
				}),
				deleteSkill: (key, expectedHash) => mutate("skill-delete", {
					key,
					expectedHash
				}),
				trash: () => read("trash-list"),
				previewTrashRestore: (input) => read("trash-restore-preview", input),
				restoreTrash: (input) => mutate("trash-restore", input),
				purgeTrash: (id) => mutate("trash-purge", { id }),
				emptyTrash: () => mutate("trash-empty", {}),
				restoreVersion: (key, versionId, expectedHash) => mutate("version-restore", {
					key,
					versionId,
					expectedHash
				}),
				dismissSuggestion: (id) => mutate("suggestion-dismiss", { id }),
				deleteSuggestion: (id) => mutate("suggestion-delete", { id }),
				deleteDraft: (id) => mutate("draft-delete", { id }),
				pinTrajectory: (id, pinned) => mutate("trajectory-pin", {
					id,
					pinned
				}),
				deleteTrajectory: (id) => mutate("trajectory-delete", { id }),
				saveCase: (input) => mutate("case-save", { case: input }),
				deleteCase: (id) => mutate("case-delete", { id }),
				updateDraft: (id, content) => mutate("draft-update", {
					id,
					content
				}),
				cancelRun: (id) => mutate("run-cancel", { id }),
				adoptDraft: (id, root) => mutate("draft-adopt", root === void 0 ? { id } : {
					id,
					root
				}),
				discardDraft: (id) => mutate("draft-discard", { id }),
				linkRun: (draftId, runId) => mutate("run-link", {
					draftId,
					runId
				}),
				draftPreferences: () => read("draft-preferences"),
				saveDraftModel: (model) => mutate("draft-preference", { model }),
				saveSuggestionModel: (id, model) => mutate("draft-preference", {
					suggestionId: id,
					model
				}),
				saveRunModel: (model) => mutate("draft-preference", {
					slot: "run",
					model
				}),
				saveSkillRunModel: (skillName, model) => mutate("draft-preference", {
					slot: "run",
					skillName,
					model
				}),
				models: () => management.models === void 0 ? Promise.reject(/* @__PURE__ */ new Error("model catalog is unavailable")) : management.models(),
				market: () => read("market"),
				marketPreview: (registryId, name) => read("market-preview", {
					registryId,
					name
				}),
				searchMarket: (query) => read("market-search", { query }),
				refreshMarket: (ids) => mutate("market-refresh", ids === void 0 ? {} : { ids }),
				installMarket: (input) => mutate("market-install", input),
				addRegistry: (location) => mutate("registry-add", { location }),
				removeRegistry: (id) => mutate("registry-remove", { id }),
				toggleRegistry: (id, enabled) => mutate("registry-toggle", {
					id,
					enabled
				}),
				canAssist: (operation) => management.assistance?.operations.includes(operation) === true,
				generateDraft: async (input) => assist("skill-draft", {
					...await savedModel("draft", input),
					...input
				}),
				backtest: async (input) => assist("skill-backtest", {
					...await savedModel("run", input),
					...input
				}),
				deriveCases: (input) => assist("skill-derive-cases", input),
				reviewNow: () => assist("skill-review-now", {})
			};
		}
		//#endregion
		//#region presentation/locales.json
		var zh = {
			"page.title": "技能管理",
			"page.description": "DSH 技能的管理与自进化",
			"page.readOnly": "只读",
			"tabs.aria": "技能管理分页",
			"tabs.waiting": "{count} 项待处理",
			"tabs.trash": "{count} 项待清理",
			"tab.skills": "技能",
			"tab.evolution": "进化",
			"tab.evals": "评测",
			"tab.market": "市场",
			"tab.trash": "回收站",
			"common.loading": "加载中",
			"common.retry": "重试",
			"common.cancel": "取消",
			"common.close": "关闭",
			"common.delete": "删除",
			"common.edit": "编辑",
			"common.save": "保存",
			"common.saving": "保存中",
			"common.more": "更多",
			"common.view": "查看",
			"common.settings": "设置",
			"time.justNow": "刚刚",
			"time.minutes": "{count} 分钟前",
			"time.hours": "{count} 小时前",
			"time.days": "{count} 天前",
			"root.project-dsh": "项目",
			"root.project-agents": "项目 · .agents",
			"root.user-dsh": "用户",
			"root.user-agents": "用户 · .agents",
			"skills.search": "搜索技能",
			"skills.new": "新建",
			"skills.noMatch": "没有匹配的技能",
			"skills.problems": "{count} 个文件无法加载",
			"skills.empty": "还没有技能",
			"skills.emptyBody": "新建一个，或从市场安装。",
			"skills.browseMarket": "去市场",
			"skills.select": "选择一个技能",
			"skills.selectBody": "在左侧选择后查看内容。",
			"skills.use": "使用",
			"skills.useHint": "在对话中使用 /{name}",
			"skills.used": "已放入输入框：/{name}",
			"skills.noConversation": "打开一个对话后再使用技能",
			"skills.toggle": "启用 {name}",
			"skills.linked": "链接 · 只读",
			"skills.linkedReadOnly": "此链接技能默认只读。如需更新原始文件，可在技能设置中对可信目标开启“允许更新链接技能”，或改用本地副本。",
			"skills.shadowed": "被覆盖",
			"skills.shadowedBy": "DSH 加载的是同名的 {key}，这个文件不会生效。",
			"skills.waitingCount": "{count} 条改进建议待处理",
			"skills.files": "文件",
			"skills.improve": "生成改进草案",
			"skills.improveTitle": "改进 {name}",
			"skills.improveNote": "想改什么（可选）",
			"skills.improvePlaceholder": "例如：发布说明按模块分组",
			"skills.improveStart": "生成草案",
			"skills.improveStarted": "正在生成草案，完成后在「进化」中查看",
			"skills.remove": "移除",
			"skills.removeTitle": "移除 {name}？",
			"skills.removeBody": "技能会移到「回收站」页，可以随时恢复，也可以在那里彻底删除。",
			"skills.removed": "已移除 {name}",
			"skills.deleted": "已删除 {name}",
			"invocation.label": "调用",
			"invocation.both": "自动与 / 命令",
			"invocation.slash": "仅 / 命令",
			"invocation.model": "仅自动加载",
			"invocation.off": "关闭",
			"invocation.slashShort": "仅 /",
			"invocation.modelShort": "仅自动",
			"editor.title": "编辑 {name}",
			"create.title": "新建技能",
			"create.name": "名称",
			"create.nameHint": "小写字母、数字和连字符",
			"create.description": "描述",
			"create.descriptionHint": "做什么、什么时候用；DSH 据此决定是否加载",
			"create.root": "位置",
			"create.submit": "创建",
			"versions.title": "版本",
			"versions.empty": "还没有版本",
			"versions.current": "当前",
			"versions.compare": "对比",
			"versions.compareTitle": "与 {time} 的版本对比",
			"versions.restore": "恢复",
			"tests.title": "测试",
			"tests.count": "{count} 个用例",
			"tests.lastScore": "上次 {score} 分",
			"tests.run": "运行回测",
			"tests.running": "回测中",
			"tests.add": "添加用例",
			"tests.empty": "还没有用例。复盘时会自动沉淀，也可以手动添加。",
			"tests.checks": "{count} 项检查",
			"tests.must": "必须",
			"tests.should": "建议",
			"tests.origin": "来源对话",
			"tests.enabled": "启用用例 {title}",
			"tests.progress": "回测中 {done}/{total}",
			"tests.score": "{score} 分",
			"tests.errors": "{count} 个未能运行",
			"tests.unmeasured": "{count} 个未测",
			"tests.withoutSkill": "无技能",
			"tests.deleteTitle": "删除这个用例？",
			"tests.newTitle": "添加用例",
			"tests.editTitle": "编辑用例",
			"tests.case": "用例",
			"tests.caseTitle": "标题",
			"tests.prompt": "任务",
			"tests.promptHint": "用户会怎么说",
			"tests.context": "背景（可选）",
			"tests.requiresVision": "依赖图片输入",
			"tests.requiresVisionHint": "纯文本回测无法接收图片。勾选后，此用例标为未测，不调用模型，也不计入评分和基线比较。",
			"tests.checksLabel": "检查项",
			"tests.checkPlaceholder": "结果应当……",
			"tests.addCheck": "添加检查项",
			"run.steps": "执行步骤",
			"run.answer": "回答",
			"evolution.pending": "待处理",
			"evolution.pendingCount": "待处理 {count}",
			"evolution.done": "已处理",
			"evolution.reviewNow": "复盘本会话",
			"evolution.reviewFound": "复盘完成：{count} 条建议",
			"evolution.reviewNothing": "复盘完成：没有新的建议",
			"evolution.off": "自进化未开启",
			"evolution.offBody": "开启后，对话结束会在后台复盘，提出技能建议。",
			"evolution.turnOn": "开启",
			"evolution.empty.pending": "暂无待处理",
			"evolution.emptyBody.pending": "有新的建议时会出现在这里。",
			"evolution.empty.done": "暂无记录",
			"evolution.emptyBody.done": "采纳或忽略的建议会留在这里。",
			"evolution.empty.evidence": "暂无证据",
			"evolution.emptyBody.evidence": "复盘读过的对话会留在这里。",
			"evolution.from": "来自「{session}」",
			"evolution.confidence": "置信度 {value}%",
			"evolution.draft": "生成草案",
			"evolution.dismiss": "忽略",
			"evolution.dismissed": "已忽略",
			"evolution.noAgent": "当前没有可用的任务 Agent",
			"evolution.drafting": "正在生成草案",
			"evolution.draftFailed": "草案生成失败：{error}",
			"evolution.skillGone": "原技能文件已删除、移动或无法读取。请恢复文件，或在新位置打开技能并重新生成草案。",
			"evolution.originUnavailable": "旧记录未可靠保存原工作区。请切换到原工作区，在技能页打开该技能并重新生成草案；现有草案和证据会保留。",
			"evolution.currentSkill": "当前技能文件",
			"evolution.skillChanged": "技能在建议之后被改过，生成草案前会以当前版本为准。",
			"evolution.adopted": "已采纳",
			"evolution.openSkill": "查看技能",
			"evolution.evidence": "证据",
			"evolution.evidenceMeta": "{conversations} 段对话 · {steps} 步",
			"evolution.evidenceGone": "这段对话记录已删除。",
			"evolution.openRecord": "完整记录",
			"draft.title": "草案",
			"evolution.targetRoot": "建议位置：{root}",
			"draft.writeTo": "写入",
			"draft.adopt": "采纳",
			"draft.discard": "放弃",
			"draft.edit": "编辑草案",
			"draft.redraft": "按要求重写",
			"draft.redraftNote": "要怎么改",
			"draft.redraftPlaceholder": "例如：破坏性变更放在最前面",
			"draft.redraftStart": "重写",
			"draft.adopted": "已采纳，{name} 已更新",
			"draft.backtest": "回测",
			"draft.current": "当前",
			"draft.withoutSkill": "无技能",
			"draft.candidate": "草案",
			"draft.same": "持平",
			"draft.backtesting": "回测中 {done}/{total}",
			"draft.noTests": "没有测试用例，未回测",
			"draft.notTested": "还没有回测",
			"draft.notComparable": "回测结果无法比较",
			"draft.runBacktest": "运行回测",
			"draft.rerun": "重新回测",
			"draft.excluded": "{count} 个用例未能运行，未计入比较",
			"draft.runDetail": "草案的回测详情",
			"draft.adoptAnyway": "仍然采纳？",
			"draft.regressed": "草案的回测分数低于当前版本。",
			"records.stats": "{turns} 回合 · {tools} 次工具调用",
			"records.failures": "{count} 次失败",
			"records.pinned": "置顶",
			"records.pin": "置顶",
			"records.unpin": "取消置顶",
			"records.suggested": "{count} 条建议",
			"records.suggestion": "建议 {index}",
			"records.deriveAll": "从整段对话生成测试用例",
			"records.deriveChosen": "从选中的 {count} 步生成测试用例",
			"records.deriveFor": "用于技能",
			"records.derive": "生成",
			"records.derived": "已为 {name} 添加 {count} 个用例",
			"records.deleteTitle": "删除这段记录？",
			"records.deleteBody": "引用它的建议和用例会失去这段依据。",
			"evidence.skill": "技能",
			"evidence.allSkills": "全部技能",
			"evals.empty": "还没有技能",
			"evals.emptyBody": "创建或安装技能后，在这里为它写测试用例、跑回测。",
			"evals.tested": "有用例",
			"evals.untested": "无用例",
			"evals.off": "{count} 个已停用",
			"evals.notCreated": "未创建",
			"evals.notCreatedBody": "技能尚未创建，回测衡量的是没有它时的表现。",
			"evals.openSuggestion": "查看建议",
			"timeline.turn": "第 {turn} 轮",
			"timeline.user": "用户",
			"timeline.assistant": "回复",
			"timeline.tool": "工具",
			"timeline.skill": "技能",
			"timeline.failed": "失败",
			"market.search": "搜索技能",
			"market.category": "分类",
			"market.allCategories": "全部分类",
			"market.refresh": "刷新",
			"market.empty": "没有找到技能",
			"market.emptyBody": "换个关键词，或在「来源」里添加仓库、网站。",
			"market.preview": "查看 {name}",
			"market.install": "安装",
			"market.installing": "安装中",
			"market.update": "更新",
			"market.overwrite": "覆盖安装",
			"market.installTo": "安装到",
			"market.open": "查看技能",
			"market.installed": "已安装 {name}",
			"market.updated": "已更新 {name}",
			"market.state.installed": "已安装",
			"market.state.update": "可更新",
			"market.state.modified": "本地已修改",
			"market.state.conflict": "同名已存在",
			"market.state.available": "可安装",
			"market.version": "v{version}",
			"market.installedVersion": "已装 v{version}",
			"market.upstreamLicense": "上游许可",
			"market.trust": "技能会被 Agent 按其内容执行，可能包含脚本。安装前请确认来源可信，并看一遍 SKILL.md。",
			"market.overwriteHint": "这个技能在本地改过，更新会覆盖改动（旧版本移入回收区）。",
			"market.files": "{count} 个文件 · {size}",
			"market.searchPlaceholder": "搜索技能，或粘贴 GitHub 仓库 / 网址",
			"market.sources": "来源 · {count}",
			"market.addAsSource": "{kind} · {label}",
			"market.listed": "已添加的来源 · {count}",
			"market.indexed": "skills.sh · {count}",
			"market.searching": "正在搜索 skills.sh",
			"market.searchFailed": "skills.sh 暂时无法搜索：{error}",
			"market.indexEmpty": "skills.sh 上没有匹配的技能。",
			"market.installs": "{count} 次安装",
			"market.audits": "安全审核",
			"market.audit.pass": "通过",
			"market.audit.warn": "需留意",
			"market.audit.fail": "未通过",
			"market.viewSource": "查看源文件",
			"market.partial": "GitHub 暂时无法访问，这是 skills.sh 保存的文本副本；安装时会从 GitHub 取回全部文件。",
			"sources.title": "来源",
			"sources.builtin": "内置",
			"sources.featured": "精选",
			"sources.kind.catalog": "技能目录",
			"sources.kind.well-known": "网站",
			"sources.kind.github": "GitHub 仓库",
			"sources.kind.search": "搜索",
			"sources.detected.catalog": "本地技能目录",
			"sources.detected.json": "JSON 文件",
			"sources.detected.github": "GitHub 仓库",
			"sources.detected.well-known": "网站",
			"sources.entries": "{count} 个技能",
			"sources.updated": "{time}更新",
			"sources.searchMeta": "开放技能目录，输入关键词时搜索",
			"sources.refresh": "刷新",
			"sources.remove": "移除",
			"sources.enabled": "启用 {name}",
			"sources.addTitle": "添加来源",
			"sources.placeholder": "owner/repo、网址或 JSON 地址",
			"sources.hint": "支持 GitHub 仓库、发布 Agent Skills 的网站，以及技能目录 JSON。",
			"sources.unknown": "无法识别，请输入 owner/repo、网址或 JSON 文件地址",
			"sources.duplicate": "这个来源已经添加过了",
			"sources.add": "添加",
			"sources.addAs": "添加为来源",
			"sources.adding": "添加中",
			"sources.added": "已添加 {name}，共 {count} 个技能",
			"sources.done": "完成",
			"sources.formats": "支持哪些来源",
			"sources.format.github": "owner/repo 或仓库链接，收录其中每个 SKILL.md，Claude 插件市场也可以。",
			"sources.format.well-known": "按 Agent Skills 发现协议（/.well-known/agent-skills/）发布技能的网站，如 developers.cloudflare.com。",
			"sources.format.catalog": "本格式的 JSON 文件（网址或本地路径），可带中英文介绍与分类。",
			"signal.correction": "用户纠正",
			"signal.directive": "以后都这样",
			"signal.tool-failure": "工具失败",
			"signal.approach-change": "中途换方法",
			"signal.procedure": "可复用流程",
			"signal.skill-gap": "技能缺口",
			"signal.skill-misleading": "描述不准",
			"signal.success": "被认可的做法",
			"status.pending": "待处理",
			"status.drafting": "生成中",
			"status.review": "草案待审",
			"status.adopted": "已采纳",
			"status.dismissed": "已忽略",
			"status.expired": "已过期",
			"status.invalidated": "已失效",
			"action.create": "新建",
			"action.update": "改进",
			"versions.reason.original": "初始",
			"versions.reason.edit": "编辑",
			"versions.reason.evolution": "进化",
			"versions.reason.restore": "恢复",
			"versions.reason.invocation": "开关",
			"versions.reason.create": "新建",
			"run.status.running": "进行中",
			"run.status.completed": "完成",
			"run.status.failed": "失败",
			"run.status.interrupted": "中断",
			"run.verdict.pass": "通过",
			"run.verdict.fail": "未通过",
			"run.verdict.error": "出错",
			"run.verdict.unmeasured": "未测",
			"run.requiresVision": "此用例依赖图片输入，纯文本回测无法判定。未调用模型，不计入评分和基线比较。",
			"versions.reason.install": "安装",
			"diff.copy": "复制",
			"diff.copied": "已复制",
			"diff.collapse": "收起",
			"diff.expand": "展开其余 {count} 行",
			"diff.code": "SKILL.md",
			"diff.wrap": "自动换行",
			"diff.unwrap": "不换行",
			"common.less": "收起",
			"common.moreCount": "另 {count} 条",
			"tests.history": "回测记录",
			"trash.title": "回收站",
			"trash.body": "移除的技能还在磁盘上：可以恢复，也可以在这里彻底删除。",
			"trash.emptyTitle": "回收站是空的",
			"trash.emptyBody": "在「技能」页把技能「移除」后，它会先到这里。",
			"trash.meta": "{time} · {size}",
			"trash.restore": "恢复",
			"trash.restoreHint": "放回它原来所在的目录",
			"trash.restored": "已恢复 {name}",
			"trash.purge": "彻底删除",
			"trash.purgeTitle": "彻底删除 {name}？",
			"trash.purgeBody": "文件会从磁盘上删除，无法恢复。",
			"trash.purged": "已彻底删除 {name}",
			"trash.empty": "清空回收站",
			"trash.clearTitle": "清空回收站里的 {count} 项？",
			"trash.clearBody": "这些文件会从磁盘上删除，无法恢复。",
			"trash.emptied": "已清空 {count} 项",
			"trash.file": "单个 Markdown 文件",
			"trash.bundle": "技能目录",
			"trash.restoreTitle": "恢复 {name}",
			"trash.chooseRoot": "请选择恢复位置",
			"trash.original": "原位置",
			"trash.chooseHint": "可选择恢复位置或改名。同名替换需要明确确认，现有技能会保留在回收站。",
			"trash.replace": "替换同名技能，并将现有版本保留在回收站",
			"trash.confirmName": "输入 {name} 确认彻底删除",
			"evolution.model": "全局模型",
			"evolution.modelCard": "所选草案模型",
			"evolution.modelAuto": "跟随默认",
			"evolution.modelAutoHint": "使用当前任务 Agent 的模型",
			"evolution.deleteTitle": "删除这条建议？",
			"evolution.deleteBody": "它生成的草案和证据引用会一起删掉，无法恢复。",
			"evolution.deleted": "已删除",
			"evolution.missing": "该建议已删除",
			"evolution.missingBody": "可以在左侧选择其他建议，或返回记录查看原始内容。",
			"evolution.loadFailed": "无法加载这条建议",
			"evolution.loadFailedBody": "请重试，或在左侧选择其他建议。",
			"tests.model": "全局模型",
			"tests.modelCard": "所选回测模型",
			"tests.modelAuto": "跟随默认",
			"draft.baseChanged": "原技能已变更，此草案已过期。请基于当前文件重新生成并回测。",
			"draft.targetExists": "同名技能已存在。请重新生成为改进草案并回测，再确认采纳。",
			"draft.refreshGuidance": "基于当前技能文件重新生成，保留最近的修改，并重新运行回测。",
			"draft.regenerate": "重新生成并回测",
			"draft.cancelBacktest": "取消回测",
			"draft.interrupted": "回测已中断。可以重新回测，或在检查草案后手动采纳。",
			"evolution.auto.title": "自动采纳",
			"evolution.auto.history": "自动采纳活动记录",
			"evolution.auto.attempt": "第 {count} 轮",
			"evolution.auto.scores": "基线 {baseline} / 草案 {draft}",
			"evolution.auto.stage.queued": "等待处理",
			"evolution.auto.stage.drafting": "正在起草",
			"evolution.auto.stage.backtesting": "正在对比回测",
			"evolution.auto.stage.rewriting": "依据退步结果重写",
			"evolution.auto.stage.adopted": "已自动采纳",
			"evolution.auto.stage.paused": "已停止自动处理",
			"evolution.auto.stage.review": "需要人工审查",
			"evolution.auto.reason.disabled": "自动采纳或所需权限已关闭",
			"evolution.auto.reason.no-cases": "没有启用的回测用例",
			"evolution.auto.reason.case-limit": "启用的用例超过每轮上限；调整用例或上限后手动处理本建议",
			"evolution.auto.reason.unmeasured": "回测未完整测出所有检查项，或存在图片依赖、错误、中断",
			"evolution.auto.reason.regressed": "至少一个用例或原先通过的检查项出现退步",
			"evolution.auto.reason.changed": "建议、草案或用例已变动",
			"evolution.auto.reason.failed": "自动处理失败，保留人工处理入口",
			"evolution.auto.reason.queue-full": "自动处理队列已满",
			"evolution.auto.reason.model-unavailable": "无法确定起草或回测模型",
			"evolution.auto.reason.interrupted": "Host 已停止，不自动重启此建议",
			"evolution.auto.reason.daily-limit": "今日候选额度已用完，请手动处理或等待下一天的新建议",
			"evolution.auto.reason.duplicate-skill": "今日已自动处理过同一技能目标，请手动处理",
			"triage.title": "复用价值参考",
			"triage.durable": "可复用流程",
			"triage.one-off": "一次性候选",
			"triage.uncertain": "需要判断",
			"triage.fold": "一次性候选（{count}）",
			"triage.choose": "展开一次性候选以查看建议",
			"triage.facts": "{windows} 段证据 · {sessions} 个会话 · {steps} 个引用步骤",
			"triage.rules": "确定性规则：至少 3 段证据、20 个引用步骤且置信度不低于 0.8 时标为可复用；仅 1 段且不足 20 步时标为一次性，其余保留为需要判断。",
			"triage.soft": "分类仅用于排序与折叠，不删除建议，也不限制手动处理；不确定的建议仍然显示。",
			"skills.linkedWritable": "更新会写回链接技能的原始文件，影响所有共享它的 Agent。可在技能设置中关闭。",
			"skills.linkedEditable": "链接"
		};
		var en = {
			"page.title": "Skills",
			"page.description": "Your DSH skills and how they evolve",
			"page.readOnly": "Read-only",
			"tabs.aria": "Skills pages",
			"tabs.waiting": "{count} waiting",
			"tabs.trash": "{count:item|items} removed",
			"tab.skills": "Skills",
			"tab.evolution": "Evolution",
			"tab.evals": "Evals",
			"tab.market": "Market",
			"tab.trash": "Trash",
			"common.loading": "Loading",
			"common.retry": "Retry",
			"common.cancel": "Cancel",
			"common.close": "Close",
			"common.delete": "Delete",
			"common.edit": "Edit",
			"common.save": "Save",
			"common.saving": "Saving",
			"common.more": "More",
			"common.view": "View",
			"common.settings": "Settings",
			"time.justNow": "just now",
			"time.minutes": "{count} min ago",
			"time.hours": "{count} h ago",
			"time.days": "{count} d ago",
			"root.project-dsh": "Project",
			"root.project-agents": "Project · .agents",
			"root.user-dsh": "User",
			"root.user-agents": "User · .agents",
			"skills.search": "Search skills",
			"skills.new": "New",
			"skills.noMatch": "No matching skill",
			"skills.problems": "{count} {count:file|files} cannot load",
			"skills.empty": "No skills yet",
			"skills.emptyBody": "Create one, or install one from the market.",
			"skills.browseMarket": "Open market",
			"skills.select": "Choose a skill",
			"skills.selectBody": "Pick one on the left to see it.",
			"skills.use": "Use",
			"skills.useHint": "Use /{name} in the conversation",
			"skills.used": "Put /{name} in the input",
			"skills.noConversation": "Open a conversation to use a skill",
			"skills.toggle": "Turn on {name}",
			"skills.linked": "Linked · read-only",
			"skills.linkedReadOnly": "This linked skill is read-only. To update its original file, enable Allow linked skill updates in Skills settings for trusted targets, or use a local copy.",
			"skills.shadowed": "Shadowed",
			"skills.shadowedBy": "DSH loads {key} of the same name; this file has no effect.",
			"skills.waitingCount": "{count} {count:improvement|improvements} waiting",
			"skills.files": "Files",
			"skills.improve": "Draft an improvement",
			"skills.improveTitle": "Improve {name}",
			"skills.improveNote": "What to change (optional)",
			"skills.improvePlaceholder": "For example: group release notes by module",
			"skills.improveStart": "Draft",
			"skills.improveStarted": "Drafting; it shows under Evolution when ready",
			"skills.remove": "Remove",
			"skills.removeTitle": "Remove {name}?",
			"skills.removeBody": "The skill moves to the Trash tab, where you can restore it or delete it for good.",
			"skills.removed": "Removed {name}",
			"skills.deleted": "Deleted {name}",
			"invocation.label": "Invocation",
			"invocation.both": "Auto and / command",
			"invocation.slash": "/ command only",
			"invocation.model": "Auto-load only",
			"invocation.off": "Off",
			"invocation.slashShort": "/ only",
			"invocation.modelShort": "Auto only",
			"editor.title": "Edit {name}",
			"create.title": "New skill",
			"create.name": "Name",
			"create.nameHint": "Lowercase letters, digits and hyphens",
			"create.description": "Description",
			"create.descriptionHint": "What it does and when to use it; DSH loads it by this",
			"create.root": "Location",
			"create.submit": "Create",
			"versions.title": "Versions",
			"versions.empty": "No versions yet",
			"versions.current": "Current",
			"versions.compare": "Compare",
			"versions.compareTitle": "Compared with {time}",
			"versions.restore": "Restore",
			"tests.title": "Tests",
			"tests.count": "{count} {count:case|cases}",
			"tests.lastScore": "last {score}",
			"tests.run": "Backtest",
			"tests.running": "Backtesting",
			"tests.add": "Add case",
			"tests.empty": "No cases yet. Reviews add them as you work; you can add your own.",
			"tests.checks": "{count} {count:check|checks}",
			"tests.must": "Must",
			"tests.should": "Should",
			"tests.origin": "Source conversation",
			"tests.enabled": "Use case {title}",
			"tests.progress": "Backtesting {done}/{total}",
			"tests.score": "score {score}",
			"tests.errors": "{count} could not run",
			"tests.unmeasured": "{count} not measured",
			"tests.withoutSkill": "No skill",
			"tests.deleteTitle": "Delete this case?",
			"tests.newTitle": "Add case",
			"tests.editTitle": "Edit case",
			"tests.case": "Case",
			"tests.caseTitle": "Title",
			"tests.prompt": "Task",
			"tests.promptHint": "What the user would say",
			"tests.context": "Context (optional)",
			"tests.requiresVision": "Requires image input",
			"tests.requiresVisionHint": "Text-only backtests cannot receive images. Marked cases are not measured: no model calls, scores, or baseline comparisons.",
			"tests.checksLabel": "Checks",
			"tests.checkPlaceholder": "The result should…",
			"tests.addCheck": "Add check",
			"run.steps": "Steps",
			"run.answer": "Answer",
			"evolution.pending": "Pending",
			"evolution.pendingCount": "Pending {count}",
			"evolution.done": "Done",
			"evolution.reviewNow": "Review this conversation",
			"evolution.reviewFound": "Reviewed: {count} {count:suggestion|suggestions}",
			"evolution.reviewNothing": "Reviewed: nothing new",
			"evolution.off": "Self-evolution is off",
			"evolution.offBody": "Once on, finished conversations are reviewed in the background for skill suggestions.",
			"evolution.turnOn": "Turn on",
			"evolution.empty.pending": "Nothing pending",
			"evolution.emptyBody.pending": "New suggestions show up here.",
			"evolution.empty.done": "Nothing yet",
			"evolution.emptyBody.done": "Adopted and dismissed suggestions stay here.",
			"evolution.empty.evidence": "No evidence yet",
			"evolution.emptyBody.evidence": "Conversations a review read stay here.",
			"evolution.from": "From “{session}”",
			"evolution.confidence": "confidence {value}%",
			"evolution.draft": "Draft",
			"evolution.dismiss": "Dismiss",
			"evolution.dismissed": "Dismissed",
			"evolution.noAgent": "No task Agent is available",
			"evolution.drafting": "Drafting",
			"evolution.draftFailed": "Drafting failed: {error}",
			"evolution.skillGone": "The original skill file was deleted, moved, or cannot be read. Restore it or open the skill at its new location and generate a new draft.",
			"evolution.originUnavailable": "The original workspace was not recorded reliably. Select its original workspace, open the skill on the Skills page and generate a new draft; the existing draft and evidence are kept.",
			"evolution.currentSkill": "Current skill file",
			"evolution.skillChanged": "The skill changed after this suggestion; the draft starts from its current version.",
			"evolution.adopted": "Adopted",
			"evolution.openSkill": "Open skill",
			"evolution.evidence": "Evidence",
			"evolution.evidenceMeta": "{conversations} {conversations:conversation|conversations} · {steps} {steps:step|steps}",
			"evolution.evidenceGone": "This conversation record was deleted.",
			"evolution.openRecord": "Full record",
			"draft.title": "Draft",
			"evolution.targetRoot": "Suggested destination: {root}",
			"draft.writeTo": "Write to",
			"draft.adopt": "Adopt",
			"draft.discard": "Discard",
			"draft.edit": "Edit draft",
			"draft.redraft": "Redraft with a note",
			"draft.redraftNote": "What to change",
			"draft.redraftPlaceholder": "For example: put breaking changes first",
			"draft.redraftStart": "Redraft",
			"draft.adopted": "Adopted; {name} is updated",
			"draft.backtest": "Backtest",
			"draft.current": "Current",
			"draft.withoutSkill": "No skill",
			"draft.candidate": "Draft",
			"draft.same": "Even",
			"draft.backtesting": "Backtesting {done}/{total}",
			"draft.noTests": "No test cases; not backtested",
			"draft.notTested": "Not backtested yet",
			"draft.notComparable": "The backtests cannot be compared",
			"draft.runBacktest": "Backtest",
			"draft.rerun": "Backtest again",
			"draft.excluded": "{count} {count:case|cases} could not run and {count:is|are} left out",
			"draft.runDetail": "The draft's backtest",
			"draft.adoptAnyway": "Adopt anyway?",
			"draft.regressed": "The draft scores below the current version.",
			"records.stats": "{turns} {turns:turn|turns} · {tools} {tools:tool call|tool calls}",
			"records.failures": "{count} failed",
			"records.pinned": "Pinned",
			"records.pin": "Pin",
			"records.unpin": "Unpin",
			"records.suggested": "{count} {count:suggestion|suggestions}",
			"records.suggestion": "Suggestion {index}",
			"records.deriveAll": "Make test cases from the conversation",
			"records.deriveChosen": "Make test cases from {count} chosen {count:step|steps}",
			"records.deriveFor": "For skill",
			"records.derive": "Make",
			"records.derived": "Added {count} {count:case|cases} to {name}",
			"records.deleteTitle": "Delete this record?",
			"records.deleteBody": "Suggestions and cases that cite it lose this evidence.",
			"evidence.skill": "Skill",
			"evidence.allSkills": "All skills",
			"evals.empty": "No skills yet",
			"evals.emptyBody": "Once you have skills, write their test cases and backtest them here.",
			"evals.tested": "With cases",
			"evals.untested": "No cases",
			"evals.off": "{count} turned off",
			"evals.notCreated": "Not created",
			"evals.notCreatedBody": "Not created yet: a backtest measures how things go without it.",
			"evals.openSuggestion": "Open the suggestion",
			"timeline.turn": "Turn {turn}",
			"timeline.user": "User",
			"timeline.assistant": "Reply",
			"timeline.tool": "Tool",
			"timeline.skill": "Skill",
			"timeline.failed": "Failed",
			"market.search": "Search skills",
			"market.category": "Category",
			"market.allCategories": "All categories",
			"market.refresh": "Refresh",
			"market.empty": "No skills found",
			"market.emptyBody": "Try other words, or add a repository or site under Sources.",
			"market.preview": "Open {name}",
			"market.install": "Install",
			"market.installing": "Installing",
			"market.update": "Update",
			"market.overwrite": "Overwrite",
			"market.installTo": "Install to",
			"market.open": "Open skill",
			"market.installed": "Installed {name}",
			"market.updated": "Updated {name}",
			"market.state.installed": "Installed",
			"market.state.update": "Update",
			"market.state.modified": "Edited locally",
			"market.state.conflict": "Name taken",
			"market.state.available": "Available",
			"market.version": "v{version}",
			"market.installedVersion": "Installed v{version}",
			"market.upstreamLicense": "Upstream license",
			"market.trust": "An Agent follows a skill as written, and a skill may carry scripts. Install only from sources you trust, and read the SKILL.md first.",
			"market.overwriteHint": "This skill was edited locally; updating replaces the edits (the old version goes to the trash).",
			"market.files": "{count} {count:file|files} · {size}",
			"market.searchPlaceholder": "Search skills, or paste a GitHub repo / URL",
			"market.sources": "Sources · {count}",
			"market.addAsSource": "{kind} · {label}",
			"market.listed": "Your sources · {count}",
			"market.indexed": "skills.sh · {count}",
			"market.searching": "Searching skills.sh",
			"market.searchFailed": "skills.sh can't search right now: {error}",
			"market.indexEmpty": "No matching skills on skills.sh.",
			"market.installs": "{count} {count:install|installs}",
			"market.audits": "Security review",
			"market.audit.pass": "Pass",
			"market.audit.warn": "Warning",
			"market.audit.fail": "Fail",
			"market.viewSource": "View source",
			"market.partial": "GitHub can't be reached right now, so this is the text copy skills.sh keeps; installing fetches every file from GitHub.",
			"sources.title": "Sources",
			"sources.builtin": "Built-in",
			"sources.featured": "Featured",
			"sources.kind.catalog": "Catalog",
			"sources.kind.well-known": "Website",
			"sources.kind.github": "GitHub repo",
			"sources.kind.search": "Search",
			"sources.detected.catalog": "Local catalog",
			"sources.detected.json": "JSON file",
			"sources.detected.github": "GitHub repo",
			"sources.detected.well-known": "Website",
			"sources.entries": "{count} {count:skill|skills}",
			"sources.updated": "updated {time}",
			"sources.searchMeta": "Open skills directory, searched as you type",
			"sources.refresh": "Refresh",
			"sources.remove": "Remove",
			"sources.enabled": "Use {name}",
			"sources.addTitle": "Add a source",
			"sources.placeholder": "owner/repo, a URL or a JSON file",
			"sources.hint": "GitHub repos, sites publishing Agent Skills, and catalog JSON files.",
			"sources.unknown": "Not recognized: enter owner/repo, a URL or a JSON file",
			"sources.duplicate": "This source is already added",
			"sources.add": "Add",
			"sources.addAs": "Add as source",
			"sources.adding": "Adding",
			"sources.added": "Added {name} with {count} {count:skill|skills}",
			"sources.done": "Done",
			"sources.formats": "What can be a source",
			"sources.format.github": "owner/repo or a repository link: every SKILL.md in it, Claude plugin marketplaces included.",
			"sources.format.well-known": "A site publishing skills in an Agent Skills discovery index (/.well-known/agent-skills/), such as developers.cloudflare.com.",
			"sources.format.catalog": "A JSON file in this market's format (URL or local path), with descriptions in both languages and categories.",
			"signal.correction": "Correction",
			"signal.directive": "From now on",
			"signal.tool-failure": "Tool failure",
			"signal.approach-change": "Changed approach",
			"signal.procedure": "Reusable procedure",
			"signal.skill-gap": "Skill gap",
			"signal.skill-misleading": "Misleading description",
			"signal.success": "Accepted approach",
			"status.pending": "Pending",
			"status.drafting": "Drafting",
			"status.review": "Draft to review",
			"status.adopted": "Adopted",
			"status.dismissed": "Dismissed",
			"status.expired": "Expired",
			"status.invalidated": "Invalidated",
			"action.create": "New",
			"action.update": "Improve",
			"versions.reason.original": "Original",
			"versions.reason.edit": "Edit",
			"versions.reason.evolution": "Evolution",
			"versions.reason.restore": "Restore",
			"versions.reason.invocation": "Switch",
			"versions.reason.create": "Created",
			"run.status.running": "Running",
			"run.status.completed": "Done",
			"run.status.failed": "Failed",
			"run.status.interrupted": "Interrupted",
			"run.verdict.pass": "Pass",
			"run.verdict.fail": "Fail",
			"run.verdict.error": "Error",
			"run.verdict.unmeasured": "Not measured",
			"run.requiresVision": "This case requires image input that text-only backtests cannot receive. No model was called; this case is excluded from scores and baseline comparisons.",
			"versions.reason.install": "Install",
			"diff.copy": "Copy",
			"diff.copied": "Copied",
			"diff.collapse": "Collapse",
			"diff.expand": "Show {count} more {count:line|lines}",
			"diff.code": "SKILL.md",
			"diff.wrap": "Wrap lines",
			"diff.unwrap": "Don't wrap",
			"common.less": "Less",
			"common.moreCount": "{count} more",
			"tests.history": "Backtests",
			"trash.title": "Trash",
			"trash.body": "Removed skills stay on disk here: restore one, or delete it for good.",
			"trash.emptyTitle": "The Trash is empty",
			"trash.emptyBody": "Removing a skill from the Skills tab puts it here first.",
			"trash.meta": "{time} · {size}",
			"trash.restore": "Restore",
			"trash.restoreHint": "Put it back where it came from",
			"trash.restored": "Restored {name}",
			"trash.purge": "Delete for good",
			"trash.purgeTitle": "Delete {name} for good?",
			"trash.purgeBody": "The files are deleted from disk and cannot be brought back.",
			"trash.purged": "Deleted {name} for good",
			"trash.empty": "Empty the Trash",
			"trash.clearTitle": "Empty the Trash of {count:item|items}?",
			"trash.clearBody": "These files are deleted from disk and cannot be brought back.",
			"trash.emptied": "Emptied {count:item|items}",
			"trash.file": "Markdown file",
			"trash.bundle": "Skill bundle",
			"trash.restoreTitle": "Restore {name}",
			"trash.chooseRoot": "Choose a restore location",
			"trash.original": "Original location",
			"trash.chooseHint": "Choose a location or a different name. Replacing a skill requires confirmation and keeps its current version in the Trash.",
			"trash.replace": "Replace the existing skill and keep its current version in the Trash",
			"trash.confirmName": "Type {name} to confirm permanent deletion",
			"evolution.model": "Global model",
			"evolution.modelCard": "Selected model",
			"evolution.modelAuto": "Follow default",
			"evolution.modelAutoHint": "Use the model of the current task Agent",
			"evolution.deleteTitle": "Delete this suggestion?",
			"evolution.deleteBody": "Its draft and the evidence references it cites go with it, and this cannot be undone.",
			"evolution.deleted": "Deleted",
			"evolution.missing": "This suggestion has been deleted",
			"evolution.missingBody": "Select another suggestion on the left, or return to Evidence to read the original record.",
			"evolution.loadFailed": "Could not load this suggestion",
			"evolution.loadFailedBody": "Retry, or select another suggestion on the left.",
			"tests.model": "Global model",
			"tests.modelCard": "Selected model",
			"tests.modelAuto": "Follow default",
			"draft.baseChanged": "The original skill changed. This draft is out of date; regenerate it against the current file and backtest it.",
			"draft.targetExists": "A skill with this name now exists. Regenerate an update and backtest it before adopting.",
			"draft.refreshGuidance": "Regenerate against the current skill file, preserving its latest changes, then run backtests.",
			"draft.regenerate": "Regenerate and backtest",
			"draft.cancelBacktest": "Cancel backtests",
			"draft.interrupted": "Backtests were interrupted. Run them again, or review the draft before adopting manually.",
			"evolution.auto.title": "Automatic adoption",
			"evolution.auto.history": "Automatic adoption activity",
			"evolution.auto.attempt": "Attempt {count}",
			"evolution.auto.scores": "Baseline {baseline} / draft {draft}",
			"evolution.auto.stage.queued": "Queued",
			"evolution.auto.stage.drafting": "Drafting",
			"evolution.auto.stage.backtesting": "Backtesting a pair",
			"evolution.auto.stage.rewriting": "Rewriting after regression",
			"evolution.auto.stage.adopted": "Automatically adopted",
			"evolution.auto.stage.paused": "Automatic work stopped",
			"evolution.auto.stage.review": "Manual review required",
			"evolution.auto.reason.disabled": "Automatic adoption or its required permissions were disabled",
			"evolution.auto.reason.no-cases": "No enabled evaluation cases",
			"evolution.auto.reason.case-limit": "Enabled cases exceed the per-run limit; adjust cases or the limit and review this suggestion manually",
			"evolution.auto.reason.unmeasured": "Some checks were not fully measured, or a case needs images, failed or was interrupted",
			"evolution.auto.reason.regressed": "At least one case or previously passing check regressed",
			"evolution.auto.reason.changed": "The suggestion, draft or evaluation cases changed",
			"evolution.auto.reason.failed": "Automatic work failed; manual review remains available",
			"evolution.auto.reason.queue-full": "Automatic queue is full",
			"evolution.auto.reason.model-unavailable": "No resolved draft or backtest model",
			"evolution.auto.reason.interrupted": "Host stopped; this suggestion will not restart automatically",
			"evolution.auto.reason.daily-limit": "Daily candidate quota reached; review manually or wait for new suggestions on another day",
			"evolution.auto.reason.duplicate-skill": "This skill target was already processed today; review manually",
			"triage.title": "Reuse guidance",
			"triage.durable": "Reusable workflow",
			"triage.one-off": "One-off candidate",
			"triage.uncertain": "Needs judgment",
			"triage.fold": "One-off candidates ({count})",
			"triage.choose": "Expand one-off candidates to review suggestions",
			"triage.facts": "{windows} evidence windows · {sessions} sessions · {steps} cited steps",
			"triage.rules": "Deterministic rules: reusable at 3+ windows, 20+ cited steps and confidence 0.8+; one-off with 1 window and fewer than 20 steps. Everything else needs judgment.",
			"triage.soft": "Grouping only changes ordering and folding. Suggestions and manual actions remain available, and uncertain suggestions stay visible.",
			"skills.linkedWritable": "Updates write to the original linked skill and affect every Agent sharing it. You can turn this off in Skills settings.",
			"skills.linkedEditable": "Linked"
		};
		//#endregion
		//#region \0source-css:/home/runner/work/dsh-mnemon/dsh-mnemon/plugins/dsh-mnemon-source-skills/presentation/page.module.css.mjs
		const css$1 = ".IIa07q_skPage{flex-direction:column;gap:12px;min-width:0;animation:.22s cubic-bezier(.2,0,0,1) IIa07q_sk-arrive;display:flex}@keyframes IIa07q_sk-arrive{0%{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}@keyframes IIa07q_sk-pop{0%{opacity:0;transform:scale(.6)}70%{transform:scale(1.08)}to{opacity:1;transform:none}}@keyframes IIa07q_sk-spin{to{transform:rotate(360deg)}}@keyframes IIa07q_sk-breathe{50%{opacity:.35}}.IIa07q_skMuted{color:var(--mn-faint);margin:0;font-size:12px;line-height:18px}.IIa07q_skProse{color:var(--mn-muted);white-space:pre-wrap;overflow-wrap:anywhere;margin:0;font-size:13px;line-height:21px}.IIa07q_skBusy{color:var(--mn-muted);align-items:center;gap:8px;padding:6px 0;font-size:12px;line-height:18px;display:inline-flex}.IIa07q_skLink{border-radius:var(--dsw-radius-xs,4px);color:var(--dsw-alias-link,var(--mn-accent));font:inherit;cursor:pointer;background:0 0;border:0;padding:0 2px;font-size:12px;line-height:18px;text-decoration:none;transition:color .12s,background-color .12s}.IIa07q_skLink:hover{background:color-mix(in srgb, var(--mn-accent) 8%, transparent)}.IIa07q_skAlert,.IIa07q_skNotice{border-radius:var(--dsw-radius-md);color:var(--mn-text);align-items:center;gap:8px;margin-bottom:12px;padding:8px 10px 8px 12px;font-size:12px;line-height:18px;display:flex}.IIa07q_skAlert{background:color-mix(in srgb, var(--mn-danger) 9%, transparent)}.IIa07q_skNotice{background:color-mix(in srgb, var(--mn-success) 9%, transparent)}.IIa07q_skAlert>span,.IIa07q_skNotice>span{overflow-wrap:anywhere;flex:1;min-width:0}.IIa07q_skDismiss{border-radius:var(--dsw-radius-xs,4px);width:20px;height:20px;color:inherit;opacity:.55;cursor:pointer;background:0 0;border:0;flex:none;place-items:center;padding:0;font-size:15px;line-height:1;transition:opacity .12s,background-color .12s;display:grid}.IIa07q_skDismiss:hover{background:var(--mn-hover);opacity:1}.IIa07q_skWarn,.IIa07q_skSuccess{border-radius:var(--dsw-radius-md);color:var(--mn-text);margin:0;padding:8px 12px;font-size:12px;line-height:18px}.IIa07q_skWarn{background:color-mix(in srgb, var(--mn-warn) 11%, transparent)}.IIa07q_skSuccess{background:color-mix(in srgb, var(--mn-success) 9%, transparent)}.IIa07q_skDangerButton{background:var(--mn-danger)!important}.IIa07q_skClamp{justify-items:start;gap:2px;display:grid}.IIa07q_skClamp>.IIa07q_skProse[data-clamped]{-webkit-line-clamp:var(--sk-lines,3);-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.IIa07q_skClamp>.IIa07q_skChanges{width:100%}.IIa07q_skCaption{color:var(--mn-faint);letter-spacing:.02em;margin:4px 0 0;font-size:11px;font-weight:500;line-height:16px}.IIa07q_skCallout{border-radius:var(--dsw-radius-md);width:100%;color:var(--mn-text);background:color-mix(in srgb, var(--mn-accent) 8%, transparent);font:inherit;text-align:left;cursor:pointer;border:0;justify-content:space-between;align-items:center;gap:12px;padding:8px 12px;font-size:12px;line-height:18px;transition:background-color .14s;display:flex}.IIa07q_skCallout:hover{background:color-mix(in srgb, var(--mn-accent) 13%, transparent)}.IIa07q_skCallout>b{color:var(--dsw-alias-link,var(--mn-accent));flex:none;font-weight:500;transition:transform .16s cubic-bezier(.2,0,0,1)}.IIa07q_skCallout:hover>b{transform:translate(2px)}.IIa07q_skTabBadge{min-width:16px;color:var(--dsw-alias-label-inverse,#fff);background:var(--mn-accent);text-align:center;font-variant-numeric:tabular-nums;border-radius:999px;margin-left:6px;padding:0 5px;font-size:11px;font-weight:500;line-height:16px;animation:.26s cubic-bezier(.2,0,0,1) IIa07q_sk-pop;display:inline-block}.IIa07q_skIconButton{border-radius:var(--dsw-radius-sm);width:28px;height:28px;color:var(--mn-muted);cursor:pointer;background:0 0;border:0;flex:none;place-items:center;padding:0;transition:color .12s,background-color .12s;display:grid}.IIa07q_skIconButton:hover:not(:disabled),.IIa07q_skIconButton[aria-expanded=true]{color:var(--mn-text);background:var(--mn-hover)}.IIa07q_skIconButton:disabled{cursor:default;opacity:.45}.IIa07q_skIconButton[data-busy]>svg{animation:.9s linear infinite IIa07q_sk-spin}.IIa07q_skIconButton[data-pulse]>svg{color:var(--mn-accent);animation:1.2s ease-in-out infinite IIa07q_sk-breathe}.IIa07q_skIconButton:focus-visible,.IIa07q_skCallout:focus-visible,.IIa07q_skLink:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--mn-accent));outline:none}.IIa07q_skEmpty{place-content:center;justify-items:center;gap:4px;min-height:280px;animation:.26s cubic-bezier(.2,0,0,1) IIa07q_sk-arrive;display:grid}.IIa07q_skEmptyActions{flex-wrap:wrap;justify-content:center;gap:8px;display:flex}.IIa07q_skSplit{grid-template-columns:minmax(268px,340px) minmax(0,1fr);gap:12px;min-height:560px;display:grid}.IIa07q_skList,.IIa07q_skPane{border:.5px solid var(--mn-card-line);border-radius:var(--dsw-radius-lg);min-width:0}.IIa07q_skList{flex-direction:column;padding-bottom:6px;display:flex;overflow:hidden}.IIa07q_skPane{padding:clamp(16px,2vw,24px);overflow:hidden}.IIa07q_skSkillsSplit,.IIa07q_skEvolutionSplit{height:max(320px,100dvh - 320px);min-height:0}.IIa07q_skSkillsSplit>.IIa07q_skList,.IIa07q_skSkillsSplit>.IIa07q_skPane,.IIa07q_skEvolutionSplit>.IIa07q_skList,.IIa07q_skEvolutionSplit>.IIa07q_skPane{overscroll-behavior-y:contain;min-height:0;overflow-y:auto}.IIa07q_skSkillsSplit>.IIa07q_skList>*,.IIa07q_skEvolutionSplit>.IIa07q_skList>*{flex-shrink:0}.IIa07q_skSkillsSplit>.IIa07q_skList{box-sizing:border-box;height:100%}.IIa07q_skListBar{border-bottom:.5px solid var(--mn-line);align-items:center;gap:8px;padding:10px;display:flex}.IIa07q_skListBar>:first-child{flex:1;min-width:0}.IIa07q_skListNote{color:var(--mn-faint);text-align:center;margin:0;padding:18px 16px;font-size:12px;line-height:18px}.IIa07q_skListFilter{padding:8px 10px 2px}.IIa07q_skListGroup h5{color:var(--mn-faint);letter-spacing:.02em;text-overflow:ellipsis;white-space:nowrap;margin:14px 16px 4px;font-size:11px;font-weight:500;line-height:16px;overflow:hidden}.IIa07q_skGroupToggle{width:100%;color:inherit;text-align:start;font:inherit;cursor:pointer;background:0 0;border:0;align-items:center;gap:8px;padding:4px 0;display:flex}.IIa07q_skGroupToggle>:nth-child(2){text-overflow:ellipsis;flex:1;min-width:0;overflow:hidden}.IIa07q_skGroupToggle small{text-overflow:ellipsis;font-size:10px;font-weight:400;display:block;overflow:hidden}.IIa07q_skGroupToggle:focus-visible{outline:2px solid var(--mn-accent);outline-offset:-2px}.IIa07q_skListItem{border-radius:var(--dsw-radius-md);width:calc(100% - 12px);color:var(--mn-text);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;margin:4px 6px 0;padding:9px 10px;transition:background-color .14s;display:block}.IIa07q_skListItem:hover{background:var(--mn-hover)}.IIa07q_skListItem[data-selected]{background:var(--mn-fill)}.IIa07q_skListItem>div{align-items:center;gap:6px;min-width:0;display:flex}.IIa07q_skListItem>div strong{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.IIa07q_skListItem p{color:var(--mn-muted);-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:3px 0 4px;font-size:12px;line-height:18px;display:-webkit-box;overflow:hidden}.IIa07q_skListItem footer{min-width:0;color:var(--mn-faint);align-items:center;gap:8px;font-size:11px;line-height:16px;display:flex}.IIa07q_skListItem footer time{font-variant-numeric:tabular-nums;flex:none}.IIa07q_skListItem footer span{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.IIa07q_skIcon{border-radius:var(--dsw-radius-md);width:30px;height:30px;color:var(--mn-muted);background:var(--mn-fill);flex:none;place-items:center;font-size:13px;font-weight:600;line-height:1;transition:color .14s,background-color .14s;display:grid}.IIa07q_skRow{border-radius:var(--dsw-radius-md);align-items:center;gap:6px;margin:2px 6px 0;padding-right:8px;transition:background-color .14s;display:flex;position:relative}.IIa07q_skRow:hover{background:var(--mn-hover)}.IIa07q_skRow[data-selected]{background:var(--mn-fill)}.IIa07q_skRow[data-selected] .IIa07q_skIcon{color:var(--mn-text);background:var(--mn-layer-1,var(--mn-hover))}.IIa07q_skRow[data-off] .IIa07q_skRowText,.IIa07q_skRow[data-shadowed] .IIa07q_skRowText{opacity:.55}.IIa07q_skRowMain{min-width:0;color:var(--mn-text);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;flex:1;align-items:center;gap:10px;padding:8px 0 8px 8px;display:flex}.IIa07q_skRowMain:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-focus-ring-color,var(--mn-accent));border-radius:var(--dsw-radius-md);outline:none}.IIa07q_skRowText{gap:1px;min-width:0;transition:opacity .14s;display:grid}.IIa07q_skRowText strong{white-space:nowrap;align-items:center;gap:6px;min-width:0;font-size:13px;font-weight:500;line-height:20px;display:flex}.IIa07q_skRowText strong>span{text-overflow:ellipsis;min-width:0;overflow:hidden}.IIa07q_skRowText small{color:var(--mn-faint);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;overflow:hidden}.IIa07q_skScore{min-width:24px;color:var(--mn-muted);font-variant-numeric:tabular-nums;text-align:right;flex:none;font-size:13px;font-weight:500;line-height:20px;animation:.26s cubic-bezier(.2,0,0,1) IIa07q_sk-pop}.IIa07q_skScore[data-tone=good]{color:var(--mn-success)}.IIa07q_skScore[data-tone=bad]{color:var(--mn-danger)}.IIa07q_skDot{background:var(--mn-accent);border-radius:999px;flex:none;width:6px;height:6px;animation:.26s cubic-bezier(.2,0,0,1) IIa07q_sk-pop}.IIa07q_skRowActions{flex:none;align-items:center;gap:8px;display:flex}.IIa07q_skUse{opacity:0;pointer-events:none;transition:opacity .14s,transform .18s cubic-bezier(.2,0,0,1);transform:translate(4px)}.IIa07q_skRow:hover .IIa07q_skUse,.IIa07q_skRow:focus-within .IIa07q_skUse{opacity:1;pointer-events:auto;transform:none}@media (hover:none){.IIa07q_skUse{opacity:1;pointer-events:auto;transform:none}}.IIa07q_skProblems{color:var(--mn-faint);margin:12px 12px 4px;font-size:12px;line-height:18px}.IIa07q_skProblems summary{border-radius:var(--dsw-radius-xs,4px);cursor:pointer;width:fit-content;padding:0 2px}.IIa07q_skProblems summary:hover{color:var(--mn-muted)}.IIa07q_skProblems ul{gap:6px;margin:8px 0 0;padding:0;list-style:none;display:grid}.IIa07q_skProblems li{gap:2px;display:grid}.IIa07q_skProblems code{color:var(--mn-muted);font:11px/16px var(--mn-code)}.IIa07q_skDetail{grid-template-columns:minmax(0,1fr);gap:14px;min-width:0;animation:.2s cubic-bezier(.2,0,0,1) IIa07q_sk-arrive;display:grid}.IIa07q_skDetailHead{justify-content:space-between;align-items:flex-start;gap:16px;display:flex}.IIa07q_skDetailHead>div:first-child{gap:4px;min-width:0;display:grid}.IIa07q_skDetailHead h3{overflow-wrap:anywhere;margin:0;font-size:17px;font-weight:600;line-height:26px}.IIa07q_skDetailHead p{color:var(--mn-muted);margin:0;font-size:13px;line-height:20px}.IIa07q_skDetailActions{flex-wrap:wrap;flex:none;justify-content:flex-end;align-items:center;gap:6px;display:flex}.IIa07q_skKicker{flex-wrap:wrap;align-items:center;gap:6px;display:inline-flex}.IIa07q_skTitleLink{color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;padding:0}.IIa07q_skTitleLink:hover{color:var(--dsw-alias-link,var(--mn-accent))}.IIa07q_skMeta{min-width:0;color:var(--mn-faint);flex-wrap:wrap;align-items:center;gap:0 6px;font-size:12px;line-height:18px;display:flex}.IIa07q_skMeta>*+:before{content:\"·\";color:var(--mn-line-strong,var(--mn-faint));margin-right:6px}.IIa07q_skMeta code{min-width:0;max-width:100%;font:11px/18px var(--mn-code);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.IIa07q_skInvocation{align-items:center;gap:8px;display:flex}.IIa07q_skWhen{color:var(--mn-muted);margin:0;font-size:12px;line-height:18px}.IIa07q_skDoc{overflow-wrap:anywhere;min-width:0;color:var(--mn-text);font-size:13px;line-height:1.75}.IIa07q_skDoc>:first-child{margin-top:0}.IIa07q_skDoc>:last-child{margin-bottom:0}.IIa07q_skDoc h1,.IIa07q_skDoc h2,.IIa07q_skDoc h3,.IIa07q_skDoc h4{color:var(--mn-text);margin:1.4em 0 .5em;font-weight:600;line-height:1.4}.IIa07q_skDoc h1{font-size:1.25em}.IIa07q_skDoc h2{font-size:1.1em}.IIa07q_skDoc h3,.IIa07q_skDoc h4{font-size:1em}.IIa07q_skDoc p,.IIa07q_skDoc ul,.IIa07q_skDoc ol,.IIa07q_skDoc blockquote,.IIa07q_skDoc table,.IIa07q_skDoc pre{margin:.7em 0}.IIa07q_skDoc ul,.IIa07q_skDoc ol{padding-left:1.5em}.IIa07q_skDoc li+li{margin-top:.25em}.IIa07q_skDoc li::marker{color:var(--mn-faint)}.IIa07q_skDoc blockquote{border-left:2px solid var(--mn-line-strong,var(--mn-line));color:var(--mn-muted);margin-inline:0;padding:.1em 1em}.IIa07q_skDoc code{border-radius:var(--dsw-radius-xs,4px);color:var(--mn-text);background:var(--dsw-alias-markdown-inline-code,var(--mn-fill));font:.9em/1.55 var(--mn-code);padding:.12em .38em}.IIa07q_skDoc pre{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-markdown-code-block,var(--mn-fill));max-width:100%;padding:10px 14px;overflow:auto}.IIa07q_skDoc pre code{background:0 0;padding:0;font-size:12px}.IIa07q_skDoc a{color:var(--dsw-alias-link,var(--mn-accent));text-underline-offset:3px;text-decoration-thickness:1px}.IIa07q_skDoc hr{border:0;border-top:.5px solid var(--mn-line);margin:1.6em 0}.IIa07q_skDoc table{border-collapse:collapse;max-width:100%;font-size:12px;display:block;overflow-x:auto}.IIa07q_skDoc th,.IIa07q_skDoc td{border:.5px solid var(--mn-line);text-align:left;vertical-align:top;padding:6px 10px}.IIa07q_skDoc th{background:var(--mn-fill);font-weight:500}.IIa07q_skDoc img{border-radius:var(--dsw-radius-sm);max-width:100%;height:auto}.IIa07q_skFolds{border-top:.5px solid var(--mn-line);grid-template-columns:minmax(0,1fr);min-width:0;margin-top:4px;display:grid}.IIa07q_skFold{border-bottom:.5px solid var(--mn-line);min-width:0}.IIa07q_skFold>header{justify-content:space-between;align-items:center;gap:12px;min-height:40px;display:flex}.IIa07q_skFold>header>button{border-radius:var(--dsw-radius-sm);min-width:0;color:var(--mn-text);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;flex:1;align-items:center;gap:8px;margin-left:-4px;padding:8px 4px;font-size:13px;font-weight:500;line-height:20px;display:flex}.IIa07q_skFold>header>button>svg{color:var(--mn-faint);flex:none;transition:transform .18s cubic-bezier(.2,0,0,1),color .12s;transform:rotate(-90deg)}.IIa07q_skFold[data-open]>header>button>svg{transform:none}.IIa07q_skFold>header>button:hover>svg{color:var(--mn-text)}.IIa07q_skFold>header>button>small{min-width:0;color:var(--mn-faint);text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:400;overflow:hidden}.IIa07q_skFold>header>button:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--mn-accent));outline:none}.IIa07q_skFold>header>div{align-items:center;gap:6px;display:flex}.IIa07q_skFoldBody{grid-template-columns:minmax(0,1fr);gap:10px;min-width:0;padding:2px 0 14px;display:grid}.IIa07q_skFold[data-link]>header>button{padding-left:24px}.IIa07q_skFold[data-link]>header>button>b{color:var(--mn-faint);margin-left:auto;font-weight:400;transition:transform .16s cubic-bezier(.2,0,0,1),color .12s}.IIa07q_skFold[data-link]>header>button:hover>b{color:var(--dsw-alias-link,var(--mn-accent));transform:translate(2px)}.IIa07q_skVersions{grid-template-columns:minmax(0,1fr);gap:1px;margin:0;padding:0;list-style:none;display:grid}.IIa07q_skVersions li{border-radius:var(--dsw-radius-md);align-items:center;gap:10px;min-height:34px;padding:3px 6px;transition:background-color .12s;display:flex}.IIa07q_skVersions li:hover{background:var(--mn-hover)}.IIa07q_skVersions time{color:var(--mn-muted);font-variant-numeric:tabular-nums;font-size:12px}.IIa07q_skVersions li>span{flex:1}.IIa07q_skTrashList li{flex-wrap:wrap;padding-block:10px}.IIa07q_skTrashList li>span{flex:none}.IIa07q_skTrashList li>.IIa07q_skRowText{flex:220px}.IIa07q_skTrashTags{flex-wrap:wrap;gap:6px;display:flex}.IIa07q_skTrashList li>.IIa07q_skTrashActions{flex:none;gap:6px;margin-left:auto;display:flex}.IIa07q_skResources{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.IIa07q_skResources code{color:var(--mn-muted);background:var(--mn-fill);font:11px/17px var(--mn-code);border-radius:999px;padding:1px 8px}.IIa07q_skEditor{resize:vertical;border:.5px solid var(--mn-field-line);border-radius:var(--dsw-radius-md);width:100%;min-height:420px;color:var(--mn-text);background:var(--mn-input);font:12px/1.6 var(--mn-code);tab-size:2;outline:0;padding:10px 12px;transition:border-color .12s}.IIa07q_skEditor:focus{border-color:var(--mn-accent)}.IIa07q_skTimeline{grid-template-columns:minmax(0,1fr);gap:0;min-width:0;margin:0;padding:0;list-style:none;display:grid}.IIa07q_skTimeline>li{min-width:0}.IIa07q_skTurn{color:var(--mn-faint);letter-spacing:.02em;margin:12px 0 4px;font-size:11px;font-weight:500;line-height:16px}.IIa07q_skTimeline>li:first-child>.IIa07q_skTurn{margin-top:0}.IIa07q_skStep{border-radius:0 var(--dsw-radius-sm) var(--dsw-radius-sm) 0;border-left:2px solid #0000;align-items:flex-start;gap:8px;padding:5px 8px;transition:background-color .14s;display:flex}.IIa07q_skTimeline>li[data-annotated] .IIa07q_skStep{border-left-color:color-mix(in srgb, var(--mn-warn) 70%, transparent);background:color-mix(in srgb, var(--mn-warn) 5%, transparent)}.IIa07q_skTimeline>li[data-highlight] .IIa07q_skStep{border-left-color:var(--mn-accent);background:color-mix(in srgb, var(--mn-accent) 6%, transparent)}.IIa07q_skStepIndex{width:22px;color:var(--mn-faint);text-align:right;font-variant-numeric:tabular-nums;flex:none;font-size:11px;line-height:20px}.IIa07q_skStepGlyph{width:14px;color:var(--mn-faint);text-align:center;flex:none;font-size:12px;line-height:20px}.IIa07q_skTimeline>li[data-kind=skill] .IIa07q_skStepGlyph{color:var(--mn-accent)}.IIa07q_skTimeline>li[data-failed] .IIa07q_skStepGlyph{color:var(--mn-danger)}.IIa07q_skStepBody{flex:1;min-width:0}.IIa07q_skStepHead{flex-wrap:wrap;align-items:center;gap:6px;min-width:0;display:flex}.IIa07q_skStepHead strong{font-size:12px;font-weight:500;line-height:20px}.IIa07q_skStepHead code{min-width:0;max-width:100%;color:var(--mn-faint);font:11px/18px var(--mn-code);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.IIa07q_skStepBody>p{overflow-wrap:anywhere;color:var(--mn-muted);white-space:pre-wrap;margin:1px 0 0;font-size:12px;line-height:18px}.IIa07q_skTimeline[data-compact] .IIa07q_skStepBody>p{-webkit-line-clamp:3;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.IIa07q_skAnnotation{color:var(--mn-text);align-items:flex-start;gap:6px;margin-top:6px;font-size:12px;line-height:18px;display:flex}.IIa07q_skEvidence+.IIa07q_skEvidence{margin-top:14px}.IIa07q_skEvidence>header{align-items:center;gap:8px;min-width:0;margin-bottom:6px;display:flex}.IIa07q_skEvidence>header strong{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:12px;font-weight:500;overflow:hidden}.IIa07q_skEvidence>header span{color:var(--mn-faint);flex:none;font-size:11px}.IIa07q_skEvidence>header button{margin-left:auto}.IIa07q_skChips{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.IIa07q_skDeriveBar{border-radius:var(--dsw-radius-md);background:var(--mn-fill);color:var(--mn-muted);flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px;font-size:12px;line-height:18px;display:flex}.IIa07q_skDeriveBar>span{min-width:0;margin-right:auto}.IIa07q_skDraft{border-top:.5px solid var(--mn-line);grid-template-columns:minmax(0,1fr);gap:12px;min-width:0;padding-top:14px;display:grid}.IIa07q_skSectionHead{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px 12px;display:flex}.IIa07q_skSectionHead h4{align-items:baseline;gap:8px;margin:0;font-size:14px;font-weight:600;line-height:22px;display:flex}.IIa07q_skSectionHead h4 small{color:var(--mn-faint);font-size:12px;font-weight:400}.IIa07q_skSectionHead>div{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.IIa07q_skChanges{color:var(--mn-muted);gap:3px;margin:0;padding-left:18px;font-size:12px;line-height:18px;display:grid}.IIa07q_skChanges li::marker{color:var(--mn-faint)}.IIa07q_skGuidance{color:var(--mn-faint);gap:2px;margin:0;padding-left:18px;font-size:12px;line-height:18px;display:grid}.IIa07q_skBacktest{border-radius:var(--dsw-radius-md);background:var(--mn-fill);flex-wrap:wrap;align-items:center;gap:6px 10px;min-height:36px;padding:4px 6px 4px 12px;display:flex}.IIa07q_skBacktestLine{min-width:0;color:var(--mn-text);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;flex:1;align-items:center;gap:10px;padding:4px 0;font-size:12px;line-height:18px;display:flex}.IIa07q_skBacktestLine>span{color:var(--mn-faint);flex:none}.IIa07q_skBacktestLine>strong{text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums;min-width:0;font-weight:500;overflow:hidden}.IIa07q_skBacktestLine>em{color:var(--mn-muted);background:var(--mn-hover);font-variant-numeric:tabular-nums;border-radius:999px;flex:none;padding:0 7px;font-style:normal;font-weight:600}.IIa07q_skBacktest[data-tone=good] .IIa07q_skBacktestLine>em{color:var(--mn-success);background:color-mix(in srgb, var(--mn-success) 12%, transparent)}.IIa07q_skBacktest[data-tone=bad] .IIa07q_skBacktestLine>em{color:var(--mn-danger);background:color-mix(in srgb, var(--mn-danger) 12%, transparent)}.IIa07q_skBacktestLine:hover>strong{text-underline-offset:3px;text-decoration:underline;text-decoration-color:var(--mn-line-strong,var(--mn-faint))}.IIa07q_skTable{border-collapse:collapse;width:100%;font-size:12px;line-height:18px;animation:.18s cubic-bezier(.2,0,0,1) IIa07q_sk-arrive}.IIa07q_skTable th{border-bottom:.5px solid var(--mn-line);color:var(--mn-faint);text-align:left;padding:6px 8px;font-weight:500}.IIa07q_skTable td{border-bottom:.5px solid var(--mn-line);vertical-align:top;padding:7px 8px}.IIa07q_skTable td small{color:var(--mn-faint);margin-top:3px;display:block}.IIa07q_skComposer{border-radius:var(--dsw-radius-lg);background:var(--mn-fill);grid-template-columns:minmax(0,1fr);gap:8px;padding:12px;animation:.18s cubic-bezier(.2,0,0,1) IIa07q_sk-arrive;display:grid}.IIa07q_skComposer label{color:var(--mn-muted);gap:6px;font-size:12px;font-weight:500;line-height:18px;display:grid}.IIa07q_skComposer textarea{resize:vertical;border:.5px solid var(--mn-field-line);border-radius:var(--dsw-radius-md);width:100%;color:var(--mn-text);background:var(--mn-input);font:inherit;outline:0;padding:6px 10px;font-size:13px;line-height:20px;transition:border-color .12s}.IIa07q_skComposer textarea:focus{border-color:var(--mn-accent)}.IIa07q_skComposer>footer{flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:8px;display:flex}.IIa07q_skTests{grid-template-columns:minmax(0,1fr);gap:10px;min-width:0;display:grid}.IIa07q_skTestsBar{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.IIa07q_skCases{grid-template-columns:minmax(0,1fr);gap:1px;margin:0;padding:0;list-style:none;display:grid}.IIa07q_skCases>li{border-radius:var(--dsw-radius-md);align-items:flex-start;gap:8px;padding:2px 4px 2px 0;transition:background-color .12s,opacity .14s;display:flex}.IIa07q_skCases>li:hover{background:var(--mn-hover)}.IIa07q_skCases>li[data-off]>details{opacity:.5}.IIa07q_skCases>li>details{flex:1;min-width:0}.IIa07q_skCases>li>:not(details){margin-top:6px}.IIa07q_skCases summary{border-radius:var(--dsw-radius-md);cursor:pointer;align-items:baseline;gap:8px;min-width:0;padding:7px 8px;list-style:none;display:flex}.IIa07q_skCases summary::-webkit-details-marker{display:none}.IIa07q_skCases summary strong{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.IIa07q_skCases summary small{color:var(--mn-faint);flex:none;font-size:11px}.IIa07q_skCases details[open] summary strong{white-space:normal}.IIa07q_skCases details>p{color:var(--mn-muted);white-space:pre-wrap;overflow-wrap:anywhere;margin:0 8px 8px;font-size:12px;line-height:18px}.IIa07q_skCases details>ul{gap:4px;margin:0 8px 8px;padding:0;list-style:none;display:grid}.IIa07q_skCases details>ul li{color:var(--mn-text);align-items:flex-start;gap:6px;font-size:12px;line-height:18px;display:flex}.IIa07q_skCases details>.IIa07q_skLink{margin:0 6px 8px}.IIa07q_skRuns{grid-template-columns:minmax(0,1fr);gap:1px;margin:0;padding:0;list-style:none;display:grid}.IIa07q_skRuns>li>button{border-radius:var(--dsw-radius-md);width:100%;min-width:0;color:var(--mn-text);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:8px;padding:7px 8px;font-size:12px;line-height:18px;transition:background-color .12s;display:flex}.IIa07q_skRuns>li>button:hover,.IIa07q_skRuns>li>button[aria-expanded=true]{background:var(--mn-hover)}.IIa07q_skRuns>li>button>:first-child{flex:none}.IIa07q_skRuns>li>button span{min-width:0;color:var(--mn-muted);text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums;flex:1;overflow:hidden}.IIa07q_skRuns>li>button time{color:var(--mn-faint);flex:none;font-size:11px}.IIa07q_skRunDetail{border-left:.5px solid var(--mn-line);grid-template-columns:minmax(0,1fr);gap:2px;margin:4px 0 8px 12px;padding-left:10px;animation:.18s cubic-bezier(.2,0,0,1) IIa07q_sk-arrive;display:grid}.IIa07q_skRunDetail details{padding:4px 0}.IIa07q_skRunDetail summary{cursor:pointer;align-items:center;gap:8px;min-width:0;font-size:12px;line-height:18px;display:flex}.IIa07q_skRunDetail summary strong{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-weight:500;overflow:hidden}.IIa07q_skRunDetail summary span{color:var(--mn-faint);font-variant-numeric:tabular-nums}.IIa07q_skRunDetail h6{color:var(--mn-faint);margin:8px 0 4px;font-size:11px;font-weight:500}.IIa07q_skVerdicts{grid-template-columns:minmax(0,1fr);gap:2px;margin:6px 0;padding:0;font-size:12px;line-height:18px;list-style:none;display:grid}.IIa07q_skVerdicts li{color:var(--mn-muted);gap:6px;display:flex}.IIa07q_skVerdicts li b{color:var(--mn-danger)}.IIa07q_skVerdicts li[data-pass] b{color:var(--mn-success)}.IIa07q_skRunSteps{color:var(--mn-muted);margin:0;padding-left:18px;font-size:12px;line-height:18px}.IIa07q_skAnswer{border-radius:var(--dsw-radius-md);max-height:240px;color:var(--mn-text);background:var(--mn-fill);font:12px/1.55 var(--mn-code);white-space:pre-wrap;overflow-wrap:anywhere;margin:0;padding:8px 10px;overflow:auto}.IIa07q_skForm{gap:14px;display:grid}.IIa07q_skField{gap:6px;display:grid}.IIa07q_skField>label{color:var(--mn-muted);font-size:12px;font-weight:500;line-height:18px}.IIa07q_skForm input:not([type=checkbox]):not([type=radio]),.IIa07q_skForm textarea{border:.5px solid var(--mn-field-line);border-radius:var(--dsw-radius-md);width:100%;color:var(--mn-text);background:var(--mn-input);font:inherit;outline:0;padding:7px 10px;font-size:13px;line-height:20px;transition:border-color .12s}.IIa07q_skForm input:not([type=checkbox]):not([type=radio]):focus,.IIa07q_skForm textarea:focus{border-color:var(--mn-accent)}.IIa07q_skForm textarea{resize:vertical}.IIa07q_skForm small{color:var(--mn-faint);font-size:11px;line-height:16px}.IIa07q_skFormRow{display:flex}.IIa07q_skFormError{color:var(--mn-danger);margin-right:auto;font-size:12px}.IIa07q_skChecks{border:0;gap:6px;margin:0;padding:0;display:grid}.IIa07q_skChecks legend{color:var(--mn-muted);margin-bottom:6px;font-size:12px;font-weight:500}.IIa07q_skChecks>div{align-items:center;gap:10px;display:flex}.IIa07q_skChecks>div>input{flex:1;min-width:0}.IIa07q_skMust{color:var(--mn-muted);white-space:nowrap;flex:none;font-size:12px}.IIa07q_skChecks>button{justify-self:start}.IIa07q_skMarket{gap:14px;display:grid}.IIa07q_skMarketBar{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.IIa07q_skMarketBar>:first-child{flex:1;min-width:220px}.IIa07q_skMarketGrid{grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;display:grid}.IIa07q_skMarketCard{border:.5px solid var(--mn-card-line);border-radius:var(--dsw-radius-lg);background:0 0;flex-direction:column;min-width:0;transition:border-color .16s,box-shadow .2s,transform .2s cubic-bezier(.2,0,0,1);animation:.24s cubic-bezier(.2,0,0,1) backwards IIa07q_sk-arrive;display:flex}.IIa07q_skMarketCard:hover{border-color:var(--mn-line-strong,var(--mn-card-line));box-shadow:var(--dsw-elevation-soft,0 4px 16px #0000000f);transform:translateY(-1px)}.IIa07q_skMarketCard:hover .IIa07q_skIcon{color:var(--mn-text)}.IIa07q_skMarketOpen{color:var(--mn-text);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;flex:1;align-content:start;gap:10px;padding:14px 14px 6px;display:grid}.IIa07q_skMarketOpen:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-focus-ring-color,var(--mn-accent));border-radius:var(--dsw-radius-lg);outline:none}.IIa07q_skMarketOpen>header{align-items:center;gap:10px;min-width:0;display:flex}.IIa07q_skMarketOpen>header>div{min-width:0;display:grid}.IIa07q_skMarketOpen strong{text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.IIa07q_skMarketOpen code{color:var(--mn-faint);font:11px/16px var(--mn-code);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.IIa07q_skMarketOpen p{color:var(--mn-muted);-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:0;font-size:12px;line-height:18px;display:-webkit-box;overflow:hidden}.IIa07q_skMarketCard>footer{justify-content:space-between;align-items:center;gap:8px;min-height:42px;padding:0 12px 10px 14px;display:flex}.IIa07q_skMarketCard>footer>span{min-width:0;color:var(--mn-faint);text-overflow:ellipsis;white-space:nowrap;font-size:11px;overflow:hidden}.IIa07q_skMarketDetail{gap:12px;display:grid}.IIa07q_skInline{align-items:center;gap:8px;display:flex}.IIa07q_skInline>:first-child{flex:1;min-width:0}.IIa07q_skMarketSection{gap:8px;animation:.2s cubic-bezier(.2,0,0,1) IIa07q_sk-arrive;display:grid}.IIa07q_skMarketGrid{transition:opacity .16s}.IIa07q_skMarketGrid[data-busy]{opacity:.55}.IIa07q_skMarketAdd{border-radius:var(--dsw-radius-md);background:color-mix(in srgb, var(--mn-accent) 7%, transparent);align-items:center;gap:10px;min-width:0;padding:6px 6px 6px 8px;font-size:12px;line-height:18px;animation:.2s cubic-bezier(.2,0,0,1) IIa07q_sk-arrive;display:flex}.IIa07q_skMarketAdd>span:nth-child(2){min-width:0;color:var(--mn-text);text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.IIa07q_skMarketAdd .IIa07q_skSourceIcon{background:var(--mn-layer-1,var(--mn-fill));width:26px;height:26px}.IIa07q_skMarketStat{font-variant-numeric:tabular-nums;align-items:center;gap:4px;display:inline-flex}.IIa07q_skMarketCard[data-indexed] .IIa07q_skMarketOpen{padding-bottom:4px}.IIa07q_skMarketMeta{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 12px;display:flex}.IIa07q_skAudits{gap:6px;display:grid}.IIa07q_skAudits>div{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.IIa07q_skAuditsLabel{color:var(--mn-faint);margin-right:2px;font-size:12px;line-height:18px}.IIa07q_skAudit{color:var(--mn-text);background:var(--mn-fill);border-radius:999px;align-items:center;gap:6px;padding:2px 9px 2px 8px;font-size:12px;line-height:18px;animation:.26s cubic-bezier(.2,0,0,1) IIa07q_sk-pop;display:inline-flex}.IIa07q_skAudit:before{content:\"\";background:var(--mn-success);border-radius:999px;flex:none;width:6px;height:6px}.IIa07q_skAudit[data-status=warn]:before{background:var(--mn-warn)}.IIa07q_skAudit[data-status=fail]:before{background:var(--mn-danger)}.IIa07q_skAudit small{color:var(--mn-faint);font-size:11px}.IIa07q_skSources{gap:18px;display:grid}.IIa07q_skSourceList{gap:2px;margin:0 -6px;padding:0;list-style:none;display:grid}.IIa07q_skSourceList>li{border-radius:var(--dsw-radius-md);align-items:center;gap:12px;min-width:0;padding:8px 8px 8px 6px;transition:background-color .14s;animation:.2s cubic-bezier(.2,0,0,1) IIa07q_sk-arrive;display:flex}.IIa07q_skSourceList>li:hover{background:var(--mn-hover)}.IIa07q_skSourceIcon{border-radius:var(--dsw-radius-md);width:32px;height:32px;color:var(--mn-muted);background:var(--mn-fill);flex:none;place-items:center;transition:opacity .14s;display:grid}.IIa07q_skSourceText{flex:1;gap:1px;min-width:0;transition:opacity .14s;display:grid}.IIa07q_skSourceText>strong{align-items:center;gap:6px;min-width:0;font-size:13px;font-weight:500;line-height:20px;display:flex}.IIa07q_skSourceText>strong>span{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.IIa07q_skSourceText>small,.IIa07q_skSourceText>em{text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-style:normal;line-height:18px;overflow:hidden}.IIa07q_skSourceText>small{color:var(--mn-faint)}.IIa07q_skSourceText>em{color:var(--mn-danger)}.IIa07q_skSourceList>li[data-off] .IIa07q_skSourceText,.IIa07q_skSourceList>li[data-off] .IIa07q_skSourceIcon{opacity:.5}.IIa07q_skSourceActions{flex:none;align-items:center;gap:6px;display:flex}.IIa07q_skSourceAdd{border-top:.5px solid var(--mn-line);gap:6px;padding-top:16px;display:grid}.IIa07q_skSourceAdd>label{font-size:13px;font-weight:500;line-height:20px}.IIa07q_skSourceHint{min-height:18px;color:var(--mn-faint);text-overflow:ellipsis;white-space:nowrap;margin:0;font-size:12px;line-height:18px;transition:color .14s;overflow:hidden}.IIa07q_skSourceHint[data-state=ok]{color:var(--mn-muted)}.IIa07q_skSourceHint[data-state=warn]{color:var(--mn-warn)}.IIa07q_skFormat summary{border-radius:var(--dsw-radius-xs,4px);width:fit-content;color:var(--mn-muted);cursor:pointer;padding:0 2px;font-size:12px;line-height:18px}.IIa07q_skFormat summary:hover{color:var(--mn-text)}.IIa07q_skFormat ul{gap:12px;margin:12px 0 0;padding:0;list-style:none;display:grid}.IIa07q_skFormat li{align-items:flex-start;gap:10px;display:flex}.IIa07q_skFormat li .IIa07q_skSourceIcon{width:26px;height:26px}.IIa07q_skFormat li>div{gap:1px;font-size:12px;line-height:18px;display:grid}.IIa07q_skFormat li strong{font-weight:500}.IIa07q_skFormat li span{color:var(--mn-muted)}@media (width<=860px){.IIa07q_skSplit{grid-template-columns:minmax(0,1fr)}.IIa07q_skList{max-height:360px;overflow-y:auto}.IIa07q_skSkillsSplit,.IIa07q_skEvolutionSplit,.IIa07q_skSkillsSplit>.IIa07q_skList{height:auto}.IIa07q_skSkillsSplit>.IIa07q_skPane,.IIa07q_skEvolutionSplit>.IIa07q_skPane{overscroll-behavior-y:auto;overflow:visible}}@media (width<=560px){.IIa07q_skDetailHead{flex-direction:column}.IIa07q_skDetailActions{justify-content:flex-start}}@media (prefers-reduced-motion:reduce){.IIa07q_skPage,.IIa07q_skDetail,.IIa07q_skEmpty,.IIa07q_skTable,.IIa07q_skComposer,.IIa07q_skRunDetail,.IIa07q_skMarketCard,.IIa07q_skMarketSection,.IIa07q_skMarketAdd,.IIa07q_skAudit,.IIa07q_skSourceList>li,.IIa07q_skTabBadge,.IIa07q_skDot,.IIa07q_skScore{animation:none}.IIa07q_skUse,.IIa07q_skFold>header>button>svg,.IIa07q_skFold[data-link]>header>button>b,.IIa07q_skCallout>b,.IIa07q_skMarketCard{transition:none}.IIa07q_skIconButton[data-busy]>svg,.IIa07q_skIconButton[data-pulse]>svg{animation:none}}";
		const id = "dsh-mnemon-source-skills/presentation/page.module.css";
		if (typeof document !== "undefined") {
			let tag = document.querySelector("style[data-plugin-css=" + JSON.stringify(id) + "]");
			if (!tag) {
				tag = document.createElement("style");
				tag.dataset.pluginCss = id;
				document.head.appendChild(tag);
			}
			if (tag.textContent !== css$1) tag.textContent = css$1;
		}
		var page_module_css_default = {
			"sk-arrive": "IIa07q_sk-arrive",
			"sk-breathe": "IIa07q_sk-breathe",
			"sk-pop": "IIa07q_sk-pop",
			"sk-spin": "IIa07q_sk-spin",
			"skAlert": "IIa07q_skAlert",
			"skAnnotation": "IIa07q_skAnnotation",
			"skAnswer": "IIa07q_skAnswer",
			"skAudit": "IIa07q_skAudit",
			"skAudits": "IIa07q_skAudits",
			"skAuditsLabel": "IIa07q_skAuditsLabel",
			"skBacktest": "IIa07q_skBacktest",
			"skBacktestLine": "IIa07q_skBacktestLine",
			"skBusy": "IIa07q_skBusy",
			"skCallout": "IIa07q_skCallout",
			"skCaption": "IIa07q_skCaption",
			"skCases": "IIa07q_skCases",
			"skChanges": "IIa07q_skChanges",
			"skChecks": "IIa07q_skChecks",
			"skChips": "IIa07q_skChips",
			"skClamp": "IIa07q_skClamp",
			"skComposer": "IIa07q_skComposer",
			"skDangerButton": "IIa07q_skDangerButton",
			"skDeriveBar": "IIa07q_skDeriveBar",
			"skDetail": "IIa07q_skDetail",
			"skDetailActions": "IIa07q_skDetailActions",
			"skDetailHead": "IIa07q_skDetailHead",
			"skDismiss": "IIa07q_skDismiss",
			"skDoc": "IIa07q_skDoc",
			"skDot": "IIa07q_skDot",
			"skDraft": "IIa07q_skDraft",
			"skEditor": "IIa07q_skEditor",
			"skEmpty": "IIa07q_skEmpty",
			"skEmptyActions": "IIa07q_skEmptyActions",
			"skEvidence": "IIa07q_skEvidence",
			"skEvolutionSplit": "IIa07q_skEvolutionSplit",
			"skField": "IIa07q_skField",
			"skFold": "IIa07q_skFold",
			"skFoldBody": "IIa07q_skFoldBody",
			"skFolds": "IIa07q_skFolds",
			"skForm": "IIa07q_skForm",
			"skFormError": "IIa07q_skFormError",
			"skFormRow": "IIa07q_skFormRow",
			"skFormat": "IIa07q_skFormat",
			"skGroupToggle": "IIa07q_skGroupToggle",
			"skGuidance": "IIa07q_skGuidance",
			"skIcon": "IIa07q_skIcon",
			"skIconButton": "IIa07q_skIconButton",
			"skInline": "IIa07q_skInline",
			"skInvocation": "IIa07q_skInvocation",
			"skKicker": "IIa07q_skKicker",
			"skLink": "IIa07q_skLink",
			"skList": "IIa07q_skList",
			"skListBar": "IIa07q_skListBar",
			"skListFilter": "IIa07q_skListFilter",
			"skListGroup": "IIa07q_skListGroup",
			"skListItem": "IIa07q_skListItem",
			"skListNote": "IIa07q_skListNote",
			"skMarket": "IIa07q_skMarket",
			"skMarketAdd": "IIa07q_skMarketAdd",
			"skMarketBar": "IIa07q_skMarketBar",
			"skMarketCard": "IIa07q_skMarketCard",
			"skMarketDetail": "IIa07q_skMarketDetail",
			"skMarketGrid": "IIa07q_skMarketGrid",
			"skMarketMeta": "IIa07q_skMarketMeta",
			"skMarketOpen": "IIa07q_skMarketOpen",
			"skMarketSection": "IIa07q_skMarketSection",
			"skMarketStat": "IIa07q_skMarketStat",
			"skMeta": "IIa07q_skMeta",
			"skMust": "IIa07q_skMust",
			"skMuted": "IIa07q_skMuted",
			"skNotice": "IIa07q_skNotice",
			"skPage": "IIa07q_skPage",
			"skPane": "IIa07q_skPane",
			"skProblems": "IIa07q_skProblems",
			"skProse": "IIa07q_skProse",
			"skResources": "IIa07q_skResources",
			"skRow": "IIa07q_skRow",
			"skRowActions": "IIa07q_skRowActions",
			"skRowMain": "IIa07q_skRowMain",
			"skRowText": "IIa07q_skRowText",
			"skRunDetail": "IIa07q_skRunDetail",
			"skRunSteps": "IIa07q_skRunSteps",
			"skRuns": "IIa07q_skRuns",
			"skScore": "IIa07q_skScore",
			"skSectionHead": "IIa07q_skSectionHead",
			"skSkillsSplit": "IIa07q_skSkillsSplit",
			"skSourceActions": "IIa07q_skSourceActions",
			"skSourceAdd": "IIa07q_skSourceAdd",
			"skSourceHint": "IIa07q_skSourceHint",
			"skSourceIcon": "IIa07q_skSourceIcon",
			"skSourceList": "IIa07q_skSourceList",
			"skSourceText": "IIa07q_skSourceText",
			"skSources": "IIa07q_skSources",
			"skSplit": "IIa07q_skSplit",
			"skStep": "IIa07q_skStep",
			"skStepBody": "IIa07q_skStepBody",
			"skStepGlyph": "IIa07q_skStepGlyph",
			"skStepHead": "IIa07q_skStepHead",
			"skStepIndex": "IIa07q_skStepIndex",
			"skSuccess": "IIa07q_skSuccess",
			"skTabBadge": "IIa07q_skTabBadge",
			"skTable": "IIa07q_skTable",
			"skTests": "IIa07q_skTests",
			"skTestsBar": "IIa07q_skTestsBar",
			"skTimeline": "IIa07q_skTimeline",
			"skTitleLink": "IIa07q_skTitleLink",
			"skTrashActions": "IIa07q_skTrashActions",
			"skTrashList": "IIa07q_skTrashList",
			"skTrashTags": "IIa07q_skTrashTags",
			"skTurn": "IIa07q_skTurn",
			"skUse": "IIa07q_skUse",
			"skVerdicts": "IIa07q_skVerdicts",
			"skVersions": "IIa07q_skVersions",
			"skWarn": "IIa07q_skWarn",
			"skWhen": "IIa07q_skWhen"
		};
		//#endregion
		//#region src/client/presentation.ts
		const css = {
			...dsh_mnemon_client.memoryPageStyles,
			...page_module_css_default
		};
		const sidebarCss = dsh_mnemon_client.memorySidebarStyles;
		function translate(locale) {
			const dictionary = locale.startsWith("en") ? en : zh;
			return (key, params) => {
				const text = dictionary[key] ?? zh[key] ?? key;
				if (params === void 0) return text;
				return text.replace(/\{(\w+):([^|{}]*)\|([^{}]*)\}/gu, (match, name, one, other) => name in params ? Number(params[name]) === 1 ? one : other : match).replace(/\{(\w+)\}/gu, (match, name) => name in params ? String(params[name]) : match);
			};
		}
		function useT() {
			const locale = (0, dsh_mnemon_client.useLocale)();
			return (0, react.useMemo)(() => translate(locale), [locale]);
		}
		/** A large count the way the language says it short: 21.4万, 214K. */
		function compactCount(count, language) {
			return new Intl.NumberFormat(language.startsWith("zh") ? "zh-CN" : "en", {
				notation: "compact",
				maximumSignificantDigits: 3
			}).format(count);
		}
		function points(value) {
			return value === void 0 ? "—" : String(Math.round(value * 100));
		}
		/** "3 min ago" in the page's language; older than a week shows the date. */
		function relative(t, iso, now = Date.now()) {
			if (iso === void 0) return "—";
			const time = Date.parse(iso);
			if (!Number.isFinite(time)) return "—";
			const seconds = Math.max(0, Math.round((now - time) / 1e3));
			if (seconds < 60) return t("time.justNow");
			if (seconds < 3600) return t("time.minutes", { count: Math.floor(seconds / 60) });
			if (seconds < 86400) return t("time.hours", { count: Math.floor(seconds / 3600) });
			if (seconds < 604800) return t("time.days", { count: Math.floor(seconds / 86400) });
			return new Date(time).toLocaleDateString();
		}
		function stamp(iso) {
			if (iso === void 0) return "";
			const date = new Date(iso);
			return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(void 0, {
				month: "numeric",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit"
			});
		}
		function errorText(error) {
			return error instanceof Error ? error.message : String(error);
		}
		//#endregion
		//#region src/client/model-choice.tsx
		/**
		* The model pickers the Evolution and Evaluation pages share: which model
		* drafts and backtests run on, globally and per item, offered from the same
		* directory the task Agent resolves its own route against.
		*
		* A pick is stored as `provider|model`, so one menu value names one route, and
		* an absent pick is `auto`: the page follows the task Agent, as it did before
		* the user picked anything.
		*/
		/** The menu value of a pick; `auto` asks for no pick at all. */
		function modelOptionValue(model) {
			if (model === null || model === void 0) return "auto";
			return `${model.provider}|${model.model}`;
		}
		/** The pick a menu value names; `auto` and a malformed value both pick nothing. */
		function modelOptionPick(value) {
			const at = value.indexOf("|");
			if (at <= 0) return null;
			return {
				provider: value.slice(0, at),
				model: value.slice(at + 1)
			};
		}
		/**
		* Follow-default first, then every Provider's models. The first entry exists
		* before the directory arrives, so the toolbar holds its place instead of
		* appearing a round trip later than the rest of the page.
		*/
		function modelOptionsFrom(models, t, autoKey) {
			const options = [{
				value: "auto",
				label: models?.effective?.model ?? models?.inherited?.model ?? models?.defaultSelection?.model ?? t(autoKey),
				detail: t("evolution.modelAutoHint")
			}];
			if (models === null) return options;
			for (const group of models.groups) for (const entry of group.models) options.push({
				value: `${group.id}|${entry.id}`,
				label: entry.name,
				detail: group.name
			});
			return options;
		}
		/** The same list for one card: follow-default, then the directory without its own default entry. */
		function modelCardOptionsFrom(modelOptions, t, autoKey) {
			return [{
				value: "auto",
				label: t(autoKey)
			}, ...modelOptions.slice(1)];
		}
		const NO_PREFERENCES = {
			suggestionModels: {},
			skillRunModels: {}
		};
		/**
		* Read the directory and the stored picks alongside the page's own data, and
		* write one pick at a time. A write shows locally first so the menu answers at
		* once, then takes the Host's answer, which is also what a second window sees.
		*/
		function useModelChoice(context, autoKey) {
			const t = useT();
			const [models, setModels] = (0, react.useState)(null);
			const [preferences, setPreferences] = (0, react.useState)(NO_PREFERENCES);
			(0, react.useEffect)(() => {
				let active = true;
				context.client.models().then((value) => {
					if (active) setModels(value);
				}).catch(() => void 0);
				return () => {
					active = false;
				};
			}, [context.client]);
			(0, react.useEffect)(() => {
				let active = true;
				context.client.draftPreferences().then((value) => {
					if (active) setPreferences(value);
				}).catch(() => void 0);
				return () => {
					active = false;
				};
			}, [context.client, context.revision]);
			/** Show the pick now, then let the Host's answer replace it; a failure shows through and reverts. */
			const write = (0, react.useCallback)((apply, operation) => {
				setPreferences((current) => apply(current));
				operation().then((next) => {
					setPreferences(next);
					context.refresh();
				}).catch((error) => {
					context.fail(error);
					context.refresh();
				});
			}, [context, context.client]);
			const options = (0, react.useMemo)(() => modelOptionsFrom(models, t, autoKey), [
				models,
				t,
				autoKey
			]);
			return {
				models,
				preferences,
				options,
				cardOptions: (0, react.useMemo)(() => modelCardOptionsFrom(options, t, autoKey), [
					options,
					t,
					autoKey
				]),
				saveDraftModel: (model) => write((current) => model === null ? omit(current, "model") : {
					...current,
					model
				}, () => context.client.saveDraftModel(model)),
				saveSuggestionModel: (id, model) => write((current) => {
					const suggestionModels = { ...current.suggestionModels };
					if (model === null) delete suggestionModels[id];
					else suggestionModels[id] = model;
					return {
						...current,
						suggestionModels
					};
				}, () => context.client.saveSuggestionModel(id, model)),
				saveRunModel: (model) => write((current) => model === null ? omit(current, "runModel") : {
					...current,
					runModel: model
				}, () => context.client.saveRunModel(model)),
				saveSkillRunModel: (skillName, model) => write((current) => {
					const skillRunModels = { ...current.skillRunModels };
					if (model === null) delete skillRunModels[skillName];
					else skillRunModels[skillName] = model;
					return {
						...current,
						skillRunModels
					};
				}, () => context.client.saveSkillRunModel(skillName, model))
			};
		}
		/** The preferences without one optional pick, for the case a pick was cleared. */
		function omit(preferences, key) {
			if (preferences[key] === void 0) return preferences;
			const next = { ...preferences };
			delete next[key];
			return next;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/markdown-to-jsx@7.7.17_react@18.3.1/node_modules/markdown-to-jsx/dist/index.module.js
		function n() {
			return n = Object.assign ? Object.assign.bind() : function(r) {
				for (var n = 1; n < arguments.length; n++) {
					var e = arguments[n];
					for (var t in e) Object.prototype.hasOwnProperty.call(e, t) && (r[t] = e[t]);
				}
				return r;
			}, n.apply(this, arguments);
		}
		var e = ["children", "options"];
		var u = [
			"allowFullScreen",
			"allowTransparency",
			"autoComplete",
			"autoFocus",
			"autoPlay",
			"cellPadding",
			"cellSpacing",
			"charSet",
			"classId",
			"colSpan",
			"contentEditable",
			"contextMenu",
			"crossOrigin",
			"encType",
			"formAction",
			"formEncType",
			"formMethod",
			"formNoValidate",
			"formTarget",
			"frameBorder",
			"hrefLang",
			"inputMode",
			"keyParams",
			"keyType",
			"marginHeight",
			"marginWidth",
			"maxLength",
			"mediaGroup",
			"minLength",
			"noValidate",
			"radioGroup",
			"readOnly",
			"rowSpan",
			"spellCheck",
			"srcDoc",
			"srcLang",
			"srcSet",
			"tabIndex",
			"useMap"
		].reduce(function(r, n) {
			return r[n.toLowerCase()] = n, r;
		}, {
			class: "className",
			for: "htmlFor"
		});
		var a = {
			amp: "&",
			apos: "'",
			gt: ">",
			lt: "<",
			nbsp: "\xA0",
			quot: "“"
		};
		var i = [
			"style",
			"script",
			"pre"
		];
		var o = [
			"src",
			"href",
			"data",
			"formAction",
			"srcDoc",
			"action"
		];
		var c = /([-A-Z0-9_:]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|(?:\{((?:\\.|{[^}]*?}|[^}])*)\})))?/gi;
		var f = /\n{2,}$/;
		var l = /^(\s*>[\s\S]*?)(?=\n\n|$)/;
		var _ = /^ *> ?/gm;
		var d = /^(?:\[!([^\]]*)\]\n)?([\s\S]*)/;
		var s = /^ {2,}\n/;
		var v = /^(?:([-*_])( *\1){2,}) *(?:\n *)+\n/;
		var p = /^(?: {1,3})?(`{3,}|~{3,}) *(\S+)? *([^\n]*?)?\n([\s\S]*?)(?:\1\n?|$)/;
		var y = /^(?: {4}[^\n]+\n*)+(?:\n *)+\n?/;
		var h = /^(`+)((?:\\`|(?!\1)`|[^`])+)\1/;
		var g = /^(?:\n *)*\n/;
		var m = /\r\n?/g;
		var k = /^\[\^([^\]]+)](:(.*)((\n+ {4,}.*)|(\n(?!\[\^).+))*)/;
		var x = /^\[\^([^\]]+)]/;
		var q = /\f/g;
		var b = /^---[ \t]*\n(.|\n)*\n---[ \t]*\n/;
		var S = /^\s*?\[(x|\s)\]/;
		var z = /^ *(#{1,6}) *([^\n]+?)(?: +#*)?(?:\n *)*(?:\n|$)/;
		var $ = /^ *(#{1,6}) +([^\n]+?)(?: +#*)?(?:\n *)*(?:\n|$)/;
		var E = /^([^\n]+)\n *(=|-)\2{2,} *\n/;
		var A = /^ *(?!<[a-z][^ >/]* ?\/>)<([a-z][^ >/]*) ?((?:[^>]*[^/])?)>\n?(\s*(?:<\1[^>]*?>[\s\S]*?<\/\1>|(?!<\1\b)[\s\S])*?)<\/\1>(?!<\/\1>)\n*/i;
		var R = /&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});/gi;
		var B = /^<!--[\s\S]*?(?:-->)/;
		var L = /^(data|aria|x)-[a-z_][a-z\d_.-]*$/;
		var O = /^ *<([a-z][a-z0-9:]*)(?:\s+((?:<.*?>|[^>])*))?\/?>(?!<\/\1>)(\s*\n)?/i;
		var j = /^\{.*\}$/;
		var C = /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/;
		var I = /^<([^ >]+[:@\/][^ >]+)>/;
		var T = /-([a-z])?/gi;
		var M = /^(\|.*)\n(?: *(\|? *[-:]+ *\|[-| :]*)\n((?:.*\|.*\n)*))?\n?/;
		var w = /^[^\n]+(?:  \n|\n{2,})/;
		var D = /^\[([^\]]*)\]:\s+<?([^\s>]+)>?\s*("([^"]*)")?/;
		var F = /^!\[([^\]]*)\] ?\[([^\]]*)\]/;
		var P = /^\[([^\]]*)\] ?\[([^\]]*)\]/;
		var Z = /(\n|^[-*]\s|^#|^ {2,}|^-{2,}|^>\s)/;
		var N = /\t/g;
		var G = /(^ *\||\| *$)/g;
		var U = /^ *:-+: *$/;
		var V = /^ *:-+ *$/;
		var H = /^ *-+: *$/;
		var Q = function(r) {
			return "(?=[\\s\\S]+?\\1" + (r ? "\\1" : "") + ")";
		};
		var W = "((?:\\[.*?\\][([].*?[)\\]]|<.*?>(?:.*?<.*?>)?|`.*?`|\\\\\\1|[\\s\\S])+?)";
		var J = RegExp("^([*_])\\1" + Q(1) + W + "\\1\\1(?!\\1)");
		var K = RegExp("^([*_])" + Q(0) + W + "\\1(?!\\1)");
		var X = RegExp("^(==)" + Q(0) + W + "\\1");
		var Y = RegExp("^(~~)" + Q(0) + W + "\\1");
		var rr = /^(:[a-zA-Z0-9-_]+:)/;
		var nr = /^\\([^0-9A-Za-z\s])/;
		var er = /\\([^0-9A-Za-z\s])/g;
		var tr = /^[\s\S](?:(?!  \n|[0-9]\.|http)[^=*_~\-\n:<`\\\[!])*/;
		var ur = /^\n+/;
		var ar = /^([ \t]*)/;
		var ir = /(?:^|\n)( *)$/;
		var or = "(?:\\d+\\.)";
		var cr = "(?:[*+-])";
		function fr(r) {
			return "( *)(" + (1 === r ? or : cr) + ") +";
		}
		var lr = fr(1);
		var _r = fr(2);
		function dr(r) {
			return RegExp("^" + (1 === r ? lr : _r));
		}
		var sr = dr(1);
		var vr = dr(2);
		function pr(r) {
			return RegExp("^" + (1 === r ? lr : _r) + "[^\\n]*(?:\\n(?!\\1" + (1 === r ? or : cr) + " )[^\\n]*)*(\\n|$)", "gm");
		}
		var yr = pr(1);
		var hr = pr(2);
		function gr(r) {
			var n = 1 === r ? or : cr;
			return RegExp("^( *)(" + n + ") [\\s\\S]+?(?:\\n{2,}(?! )(?!\\1" + n + " (?!" + n + " ))\\n*|\\s*\\n*$)");
		}
		var mr = gr(1);
		var kr = gr(2);
		function xr(r, n) {
			var e = 1 === n, t = e ? mr : kr, u = e ? yr : hr, a = e ? sr : vr;
			return {
				t: function(r) {
					return a.test(r);
				},
				u: jr(function(r, n) {
					var e = ir.exec(n.prevCapture);
					return e && (n.list || !n.inline && !n.simple) ? t.exec(r = e[1] + r) : null;
				}),
				i: 1,
				o: function(r, n, t) {
					var i = e ? +r[2] : void 0, o = r[0].replace(f, "\n").match(u), c = !1;
					return {
						items: o.map(function(r, e) {
							var u = a.exec(r)[0].length, i = RegExp("^ {1," + u + "}", "gm"), f = r.replace(i, "").replace(a, ""), l = e === o.length - 1, _ = -1 !== f.indexOf("\n\n") || l && c;
							c = _;
							var d, s = t.inline, v = t.list;
							t.list = !0, _ ? (t.inline = !1, d = zr(f) + "\n\n") : (t.inline = !0, d = zr(f));
							var p = n(d, t);
							return t.inline = s, t.list = v, p;
						}),
						ordered: e,
						start: i
					};
				},
				l: function(n, e, t) {
					return r(n.ordered ? "ol" : "ul", {
						key: t.key,
						start: "20" === n.type ? n.start : void 0
					}, n.items.map(function(n, u) {
						return r("li", { key: u }, e(n, t));
					}));
				}
			};
		}
		var qr = RegExp("^\\[((?:\\[[^\\[\\]]*(?:\\[[^\\[\\]]*\\][^\\[\\]]*)*\\]|[^\\[\\]])*)\\]\\(\\s*<?((?:\\([^)]*\\)|[^\\s\\\\]|\\\\.)*?)>?(?:\\s+['\"]([\\s\\S]*?)['\"])?\\s*\\)");
		var br = /^!\[(.*?)\]\( *((?:\([^)]*\)|[^() ])*) *"?([^)"]*)?"?\)/;
		function Sr(r) {
			return "string" == typeof r;
		}
		function zr(r) {
			for (var n = r.length; n > 0 && r[n - 1] <= " ";) n--;
			return r.slice(0, n);
		}
		function $r(r, n) {
			return r.startsWith(n);
		}
		function Er(r, n, e) {
			if (Array.isArray(e)) {
				for (var t = 0; t < e.length; t++) if ($r(r, e[t])) return !0;
				return !1;
			}
			return e(r, n);
		}
		function Ar(r) {
			return r.replace(/[ÀÁÂÃÄÅàáâãäåæÆ]/g, "a").replace(/[çÇ]/g, "c").replace(/[ðÐ]/g, "d").replace(/[ÈÉÊËéèêë]/g, "e").replace(/[ÏïÎîÍíÌì]/g, "i").replace(/[Ññ]/g, "n").replace(/[øØœŒÕõÔôÓóÒò]/g, "o").replace(/[ÜüÛûÚúÙù]/g, "u").replace(/[ŸÿÝý]/g, "y").replace(/[^a-z0-9- ]/gi, "").replace(/ /gi, "-").toLowerCase();
		}
		function Rr(r) {
			return H.test(r) ? "right" : U.test(r) ? "center" : V.test(r) ? "left" : null;
		}
		function Br(r, n, e, t) {
			var u = e.inTable;
			e.inTable = !0;
			var a = [[]], i = "";
			function o() {
				if (i) {
					var r = a[a.length - 1];
					r.push.apply(r, n(i, e)), i = "";
				}
			}
			return r.trim().split(/(`[^`]*`|\\\||\|)/).filter(Boolean).forEach(function(r, n, e) {
				"|" === r.trim() && (o(), t) ? 0 !== n && n !== e.length - 1 && a.push([]) : i += r;
			}), o(), e.inTable = u, a;
		}
		function Lr(r, n, e) {
			e.inline = !0;
			var t = r[2] ? r[2].replace(G, "").split("|").map(Rr) : [], u = r[3] ? function(r, n, e) {
				return r.trim().split("\n").map(function(r) {
					return Br(r, n, e, !0);
				});
			}(r[3], n, e) : [], a = Br(r[1], n, e, !!u.length);
			return e.inline = !1, u.length ? {
				align: t,
				cells: u,
				header: a,
				type: "25"
			} : {
				children: a,
				type: "21"
			};
		}
		function Or(r, n) {
			return null == r.align[n] ? {} : { textAlign: r.align[n] };
		}
		function jr(r) {
			return r.inline = 1, r;
		}
		function Cr(r) {
			return jr(function(n, e) {
				return e.inline ? r.exec(n) : null;
			});
		}
		function Ir(r) {
			return jr(function(n, e) {
				return e.inline || e.simple ? r.exec(n) : null;
			});
		}
		function Tr(r) {
			return function(n, e) {
				return e.inline || e.simple ? null : r.exec(n);
			};
		}
		function Mr(r) {
			return jr(function(n) {
				return r.exec(n);
			});
		}
		var wr = /(javascript|vbscript|data(?!:image)):/i;
		function Dr(r) {
			try {
				var n = decodeURIComponent(r).replace(/[^A-Za-z0-9/:]/g, "");
				if (wr.test(n)) return null;
			} catch (r) {
				return null;
			}
			return r;
		}
		function Fr(r) {
			return r ? r.replace(er, "$1") : r;
		}
		function Pr(r, n, e) {
			var t = e.inline || !1, u = e.simple || !1;
			e.inline = !0, e.simple = !0;
			var a = r(n, e);
			return e.inline = t, e.simple = u, a;
		}
		function Zr(r, n, e) {
			var t = e.inline || !1, u = e.simple || !1;
			e.inline = !1, e.simple = !0;
			var a = r(n, e);
			return e.inline = t, e.simple = u, a;
		}
		function Nr(r, n, e) {
			var t = e.inline || !1;
			e.inline = !1;
			var u = r(n, e);
			return e.inline = t, u;
		}
		var Gr = function(r, n, e) {
			return { children: Pr(n, r[2], e) };
		};
		function Ur() {
			return {};
		}
		function Vr() {
			return null;
		}
		function Hr() {
			return [].slice.call(arguments).filter(Boolean).join(" ");
		}
		function Qr(r, n, e) {
			for (var t = r, u = n.split("."); u.length && void 0 !== (t = t[u[0]]);) u.shift();
			return t || e;
		}
		function Wr(r, n) {
			var e = Qr(n, r);
			return e ? "function" == typeof e || "object" == typeof e && "render" in e ? e : Qr(n, r + ".component", r) : r;
		}
		function Jr(e, t) {
			var f;
			void 0 === e && (e = ""), void 0 === t && (t = {}), t.overrides = t.overrides || {}, t.namedCodesToUnicode = t.namedCodesToUnicode ? n({}, a, t.namedCodesToUnicode) : a;
			var G = t.slugify || Ar, U = t.sanitizer || Dr, V = t.createElement || react.createElement, H = [
				l,
				p,
				y,
				t.enforceAtxHeadings ? $ : z,
				E,
				M,
				mr,
				kr
			], Q = [].concat(H, [
				w,
				A,
				B,
				O
			]);
			function W(r, n) {
				for (var e = 0; e < r.length; e++) if (r[e].test(n)) return !0;
				return !1;
			}
			function er(r, e) {
				var u = Qr(t.overrides, r + ".props", {});
				return V.apply(void 0, [Wr(r, t.overrides), n({}, e, u, { className: Hr(null == e ? void 0 : e.className, u.className) || void 0 })].concat([].slice.call(arguments, 2)));
			}
			function ir(r) {
				r = r.replace(b, "");
				var n = !1;
				t.forceInline ? n = !0 : t.forceBlock || (n = !1 === Z.test(r));
				for (var e = dr(_r(n ? r : zr(r).replace(ur, "") + "\n\n", { inline: n })); Sr(e[e.length - 1]) && !e[e.length - 1].trim();) e.pop();
				if (null === t.wrapper) return e;
				var u, a = t.wrapper || (n ? "span" : "div");
				if (e.length > 1 || t.forceWrapper) u = e;
				else {
					if (1 === e.length) return "string" == typeof (u = e[0]) ? er("span", { key: "outer" }, u) : u;
					u = null;
				}
				return V(a, { key: "outer" }, u);
			}
			function or(r, n) {
				if (!n || !n.trim()) return null;
				var e = n.match(c);
				return e ? e.reduce(function(n, e) {
					var t = e.indexOf("=");
					if (-1 !== t) {
						var a = function(r) {
							return -1 !== r.indexOf("-") && null === r.match(L) && (r = r.replace(T, function(r, n) {
								return n.toUpperCase();
							})), r;
						}(e.slice(0, t)).trim(), i = function(r) {
							var n = r[0];
							return ("\"" === n || "'" === n) && r.length >= 2 && r[r.length - 1] === n ? r.slice(1, -1) : r;
						}(e.slice(t + 1).trim()), c = u[a] || a;
						if ("ref" === c) return n;
						var f = n[c] = function(r, n, e, t) {
							return "style" === n ? function(r) {
								var n = [], e = "", t = !1, u = !1, a = "";
								if (!r) return n;
								for (var i = 0; i < r.length; i++) {
									var o = r[i];
									if ("\"" !== o && "'" !== o || t || (u ? o === a && (u = !1, a = "") : (u = !0, a = o)), "(" === o && e.endsWith("url") ? t = !0 : ")" === o && t && (t = !1), ";" !== o || u || t) e += o;
									else {
										var c = e.trim();
										if (c) {
											var f = c.indexOf(":");
											if (f > 0) {
												var l = c.slice(0, f).trim(), _ = c.slice(f + 1).trim();
												n.push([l, _]);
											}
										}
										e = "";
									}
								}
								var d = e.trim();
								if (d) {
									var s = d.indexOf(":");
									if (s > 0) {
										var v = d.slice(0, s).trim(), p = d.slice(s + 1).trim();
										n.push([v, p]);
									}
								}
								return n;
							}(e).reduce(function(n, e) {
								var u = e[0], a = e[1];
								return n[u.replace(/(-[a-z])/g, function(r) {
									return r[1].toUpperCase();
								})] = t(a, r, u), n;
							}, {}) : -1 !== o.indexOf(n) ? t(Fr(e), r, n) : (e.match(j) && (e = Fr(e.slice(1, e.length - 1))), "true" === e || "false" !== e && e);
						}(r, a, i, U);
						"string" == typeof f && (A.test(f) || O.test(f)) && (n[c] = ir(f.trim()));
					} else "style" !== e && (n[u[e] || e] = !0);
					return n;
				}, {}) : null;
			}
			var cr = [], fr = {}, lr = ((f = {})[0] = {
				t: [">"],
				u: Tr(l),
				i: 1,
				o: function(r, n, e) {
					var t = r[0].replace(_, "").match(d);
					return {
						alert: t[1],
						children: n(t[2], e)
					};
				},
				l: function(r, n, e) {
					var t = { key: e.key };
					return r.alert && (t.className = "markdown-alert-" + G(r.alert.toLowerCase(), Ar), r.children.unshift({
						attrs: {},
						children: [{
							type: "27",
							text: r.alert
						}],
						noInnerParse: !0,
						type: "11",
						tag: "header"
					})), er("blockquote", t, n(r.children, e));
				}
			}, f[1] = {
				t: ["  "],
				u: Mr(s),
				i: 1,
				o: Ur,
				l: function(r, n, e) {
					return er("br", { key: e.key });
				}
			}, f[2] = {
				t: [
					"--",
					"__",
					"**",
					"- ",
					"* ",
					"_ "
				],
				u: Tr(v),
				i: 1,
				o: Ur,
				l: function(r, n, e) {
					return er("hr", { key: e.key });
				}
			}, f[3] = {
				t: ["    "],
				u: Tr(y),
				i: 0,
				o: function(r) {
					return {
						lang: void 0,
						text: Fr(zr(r[0].replace(/^ {4}/gm, "")))
					};
				},
				l: function(r, e, t) {
					return er("pre", { key: t.key }, er("code", n({}, r.attrs, { className: r.lang ? "lang-" + r.lang : "" }), r.text));
				}
			}, f[4] = {
				t: ["```", "~~~"],
				u: Tr(p),
				i: 0,
				o: function(r) {
					return {
						attrs: or("code", r[3] || ""),
						lang: r[2] || void 0,
						text: r[4],
						type: "3"
					};
				}
			}, f[5] = {
				t: ["`"],
				u: Ir(h),
				i: 3,
				o: function(r) {
					return { text: Fr(r[2]) };
				},
				l: function(r, n, e) {
					return er("code", { key: e.key }, r.text);
				}
			}, f[6] = {
				t: ["[^"],
				u: Tr(k),
				i: 0,
				o: function(r) {
					return cr.push({
						footnote: r[2],
						identifier: r[1]
					}), {};
				},
				l: Vr
			}, f[7] = {
				t: ["[^"],
				u: Cr(x),
				i: 1,
				o: function(r) {
					return {
						target: "#" + G(r[1], Ar),
						text: r[1]
					};
				},
				l: function(r, n, e) {
					return er("a", {
						key: e.key,
						href: U(r.target, "a", "href")
					}, er("sup", { key: e.key }, r.text));
				}
			}, f[8] = {
				t: ["[ ]", "[x]"],
				u: Cr(S),
				i: 1,
				o: function(r) {
					return { completed: "x" === r[1].toLowerCase() };
				},
				l: function(r, n, e) {
					return er("input", {
						checked: r.completed,
						key: e.key,
						readOnly: !0,
						type: "checkbox"
					});
				}
			}, f[9] = {
				t: ["#"],
				u: Tr(t.enforceAtxHeadings ? $ : z),
				i: 1,
				o: function(r, n, e) {
					return {
						children: Pr(n, r[2], e),
						id: G(r[2], Ar),
						level: r[1].length
					};
				},
				l: function(r, n, e) {
					return er("h" + r.level, {
						id: r.id,
						key: e.key
					}, n(r.children, e));
				}
			}, f[10] = {
				t: function(r) {
					var n = r.indexOf("\n");
					return n > 0 && n < r.length - 1 && ("=" === r[n + 1] || "-" === r[n + 1]);
				},
				u: Tr(E),
				i: 1,
				o: function(r, n, e) {
					return {
						children: Pr(n, r[1], e),
						level: "=" === r[2] ? 1 : 2,
						type: "9"
					};
				}
			}, f[11] = {
				t: ["<"],
				u: Mr(A),
				i: 1,
				o: function(r, n, e) {
					var t = r[3].match(ar), u = RegExp("^" + t[1], "gm"), a = r[3].replace(u, ""), o = W(Q, a) ? Nr : Pr, c = r[1].toLowerCase(), f = -1 !== i.indexOf(c), l = (f ? c : r[1]).trim(), _ = {
						attrs: or(l, r[2]),
						noInnerParse: f,
						tag: l
					};
					if (e.inAnchor = e.inAnchor || "a" === c, f) _.text = r[3];
					else {
						var d = e.inHTML;
						e.inHTML = !0, _.children = o(n, a, e), e.inHTML = d;
					}
					return e.inAnchor = !1, _;
				},
				l: function(r, e, t) {
					return er(r.tag, n({ key: t.key }, r.attrs), r.text || (r.children ? e(r.children, t) : ""));
				}
			}, f[13] = {
				t: ["<"],
				u: Mr(O),
				i: 1,
				o: function(r) {
					var n = r[1].trim();
					return {
						attrs: or(n, r[2] || ""),
						tag: n
					};
				},
				l: function(r, e, t) {
					return er(r.tag, n({}, r.attrs, { key: t.key }));
				}
			}, f[12] = {
				t: ["<!--"],
				u: Mr(B),
				i: 1,
				o: function() {
					return {};
				},
				l: Vr
			}, f[14] = {
				t: ["!["],
				u: Ir(br),
				i: 1,
				o: function(r) {
					return {
						alt: Fr(r[1]),
						target: Fr(r[2]),
						title: Fr(r[3])
					};
				},
				l: function(r, n, e) {
					return er("img", {
						key: e.key,
						alt: r.alt || void 0,
						title: r.title || void 0,
						src: U(r.target, "img", "src")
					});
				}
			}, f[15] = {
				t: ["["],
				u: Cr(qr),
				i: 3,
				o: function(r, n, e) {
					return {
						children: Zr(n, r[1], e),
						target: Fr(r[2]),
						title: Fr(r[3])
					};
				},
				l: function(r, n, e) {
					return er("a", {
						key: e.key,
						href: U(r.target, "a", "href"),
						title: r.title
					}, n(r.children, e));
				}
			}, f[16] = {
				t: ["<"],
				u: Cr(I),
				i: 0,
				o: function(r) {
					var n = r[1], e = !1;
					return -1 !== n.indexOf("@") && -1 === n.indexOf("//") && (e = !0, n = n.replace("mailto:", "")), {
						children: [{
							text: n,
							type: "27"
						}],
						target: e ? "mailto:" + n : n,
						type: "15"
					};
				}
			}, f[17] = {
				t: function(r, n) {
					return !n.inAnchor && !t.disableAutoLink && ($r(r, "http://") || $r(r, "https://"));
				},
				u: Cr(C),
				i: 0,
				o: function(r) {
					return {
						children: [{
							text: r[1],
							type: "27"
						}],
						target: r[1],
						title: void 0,
						type: "15"
					};
				}
			}, f[20] = xr(er, 1), f[33] = xr(er, 2), f[19] = {
				t: ["\n"],
				u: Tr(g),
				i: 3,
				o: Ur,
				l: function() {
					return "\n";
				}
			}, f[21] = {
				u: jr(function(r, n) {
					if (n.inline || n.simple || n.inHTML && -1 === r.indexOf("\n\n") && -1 === n.prevCapture.indexOf("\n\n")) return null;
					for (var e = "", t = 0;;) {
						var u = r.indexOf("\n", t), a = r.slice(t, -1 === u ? void 0 : u + 1);
						if (W(H, a)) break;
						if (e += a, -1 === u || !a.trim()) break;
						t = u + 1;
					}
					var i = zr(e);
					return "" === i ? null : [
						e,
						,
						i
					];
				}),
				i: 3,
				o: Gr,
				l: function(r, n, e) {
					return er("p", { key: e.key }, n(r.children, e));
				}
			}, f[22] = {
				t: ["["],
				u: Cr(D),
				i: 0,
				o: function(r) {
					return fr[r[1]] = {
						target: r[2],
						title: r[4]
					}, {};
				},
				l: Vr
			}, f[23] = {
				t: ["!["],
				u: Ir(F),
				i: 0,
				o: function(r) {
					return {
						alt: r[1] ? Fr(r[1]) : void 0,
						ref: r[2]
					};
				},
				l: function(r, n, e) {
					return fr[r.ref] ? er("img", {
						key: e.key,
						alt: r.alt,
						src: U(fr[r.ref].target, "img", "src"),
						title: fr[r.ref].title
					}) : null;
				}
			}, f[24] = {
				t: function(r) {
					return "[" === r[0] && -1 === r.indexOf("](");
				},
				u: Cr(P),
				i: 0,
				o: function(r, n, e) {
					return {
						children: n(r[1], e),
						fallbackChildren: r[0],
						ref: r[2]
					};
				},
				l: function(r, n, e) {
					return fr[r.ref] ? er("a", {
						key: e.key,
						href: U(fr[r.ref].target, "a", "href"),
						title: fr[r.ref].title
					}, n(r.children, e)) : er("span", { key: e.key }, r.fallbackChildren);
				}
			}, f[25] = {
				t: ["|"],
				u: Tr(M),
				i: 1,
				o: Lr,
				l: function(r, n, e) {
					var t = r;
					return er("table", { key: e.key }, er("thead", null, er("tr", null, t.header.map(function(r, u) {
						return er("th", {
							key: u,
							style: Or(t, u)
						}, n(r, e));
					}))), er("tbody", null, t.cells.map(function(r, u) {
						return er("tr", { key: u }, r.map(function(r, u) {
							return er("td", {
								key: u,
								style: Or(t, u)
							}, n(r, e));
						}));
					})));
				}
			}, f[27] = {
				u: jr(function(r, n) {
					var e;
					return $r(r, ":") && (e = rr.exec(r)), e || tr.exec(r);
				}),
				i: 4,
				o: function(r) {
					var n = r[0];
					return { text: -1 === n.indexOf("&") ? n : n.replace(R, function(r, n) {
						return t.namedCodesToUnicode[n] || r;
					}) };
				},
				l: function(r) {
					return r.text;
				}
			}, f[28] = {
				t: ["**", "__"],
				u: Ir(J),
				i: 2,
				o: function(r, n, e) {
					return { children: n(r[2], e) };
				},
				l: function(r, n, e) {
					return er("strong", { key: e.key }, n(r.children, e));
				}
			}, f[29] = {
				t: function(r) {
					var n = r[0];
					return ("*" === n || "_" === n) && r[1] !== n;
				},
				u: Ir(K),
				i: 3,
				o: function(r, n, e) {
					return { children: n(r[2], e) };
				},
				l: function(r, n, e) {
					return er("em", { key: e.key }, n(r.children, e));
				}
			}, f[30] = {
				t: ["\\"],
				u: Ir(nr),
				i: 1,
				o: function(r) {
					return {
						text: r[1],
						type: "27"
					};
				}
			}, f[31] = {
				t: ["=="],
				u: Ir(X),
				i: 3,
				o: Gr,
				l: function(r, n, e) {
					return er("mark", { key: e.key }, n(r.children, e));
				}
			}, f[32] = {
				t: ["~~"],
				u: Ir(Y),
				i: 3,
				o: Gr,
				l: function(r, n, e) {
					return er("del", { key: e.key }, n(r.children, e));
				}
			}, f);
			!0 === t.disableParsingRawHTML && (delete lr[11], delete lr[13]);
			var _r = function(r) {
				var n = Object.keys(r);
				function e(t, u) {
					var a = [];
					if (u.prevCapture = u.prevCapture || "", t.trim()) for (; t;) for (var i = 0; i < n.length;) {
						var o = n[i], c = r[o];
						if (!c.t || Er(t, u, c.t)) {
							var f = c.u(t, u);
							if (f && f[0]) {
								t = t.substring(f[0].length);
								var l = c.o(f, e, u);
								u.prevCapture += f[0], l.type || (l.type = o), a.push(l);
								break;
							}
							i++;
						} else i++;
					}
					return u.prevCapture = "", a;
				}
				return n.sort(function(n, e) {
					return r[n].i - r[e].i || (n < e ? -1 : 1);
				}), function(r, n) {
					return e(function(r) {
						return r.replace(m, "\n").replace(q, "").replace(N, "    ");
					}(r), n);
				};
			}(lr), dr = function(r, n) {
				return function e(t, u) {
					if (void 0 === u && (u = {}), Array.isArray(t)) {
						for (var a = u.key, i = [], o = !1, c = 0; c < t.length; c++) {
							u.key = c;
							var f = e(t[c], u), l = Sr(f);
							l && o ? i[i.length - 1] += f : null !== f && i.push(f), o = l;
						}
						return u.key = a, i;
					}
					return function(e, t, u) {
						var a = r[e.type].l;
						return n ? n(function() {
							return a(e, t, u);
						}, e, t, u) : a(e, t, u);
					}(t, e, u);
				};
			}(lr, t.renderRule), sr = ir(e);
			return cr.length ? er("div", null, sr, er("footer", { key: "footer" }, cr.map(function(r) {
				return er("div", {
					id: G(r.identifier, Ar),
					key: r.identifier
				}, r.identifier, dr(_r(r.footnote, { inline: !0 })));
			}))) : sr;
		}
		function index_module_default(n) {
			var t = n.children, u = n.options, a = function(r, n) {
				if (null == r) return {};
				var e, t, u = {}, a = Object.keys(r);
				for (t = 0; t < a.length; t++) n.indexOf(e = a[t]) >= 0 || (u[e] = r[e]);
				return u;
			}(n, e);
			return react.cloneElement(Jr(null == t ? "" : t, u), a);
		}
		//#endregion
		//#region src/client/shared.tsx
		const SIGNAL_TONE = {
			correction: "warning",
			directive: "info",
			"tool-failure": "danger",
			"approach-change": "warning",
			procedure: "info",
			"skill-gap": "warning",
			"skill-misleading": "warning",
			success: "success"
		};
		function SignalTag(props) {
			const t = useT();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
				tone: SIGNAL_TONE[props.signal],
				children: t(`signal.${props.signal}`)
			});
		}
		const STATUS_TONE = {
			pending: "info",
			drafting: "info",
			review: "warning",
			adopted: "success",
			dismissed: "quiet",
			expired: "quiet",
			invalidated: "quiet"
		};
		function StatusTag(props) {
			const t = useT();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
				tone: STATUS_TONE[props.status],
				children: t(`status.${props.status}`)
			});
		}
		/** New skill or improvement, the first thing a suggestion says about itself. */
		function ActionTag(props) {
			const t = useT();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
				tone: props.action === "create" ? "success" : "info",
				children: t(`action.${props.action}`)
			});
		}
		function RunStatusDot(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: {
				running: "ongoing",
				completed: "done",
				failed: "error",
				interrupted: "warning"
			}[props.status] });
		}
		/**
		* Follows each link the page is given once, as soon as what it points into
		* has loaded. A link is known by its nonce, so reloading the page's data
		* leaves whatever the reader chose since alone.
		*/
		function useLink(nonce, ready, follow) {
			const followed = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				if (nonce === void 0 || followed.current === nonce || !ready) return;
				followed.current = nonce;
				follow();
			});
		}
		function Busy(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: css.skBusy,
				role: "status",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, {
					active: true,
					children: props.label
				})]
			});
		}
		function Empty(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.skEmpty,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.EmptyState, {
					glyph: props.glyph,
					title: props.title,
					children: props.children
				}), props.action !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: css.skEmptyActions,
					children: props.action
				})]
			});
		}
		function Confirm(props) {
			const t = useT();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SidebarModal, {
				title: props.title,
				description: props.body,
				...props.busy === void 0 ? {} : { busy: props.busy },
				onClose: props.onClose,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					onClick: props.onClose,
					children: t("common.cancel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					className: props.danger === true ? css.skDangerButton : void 0,
					disabled: props.busy === true,
					onClick: props.onConfirm,
					children: props.confirmLabel
				})] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
			});
		}
		/**
		* A section that stays closed until asked for: its title and a short summary
		* on one row, the content below it once open.
		*/
		function Fold(props) {
			const [open, setOpen] = (0, react.useState)(props.defaultOpen === true);
			const id = (0, react.useId)();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: css.skFold,
				"data-open": open ? "" : void 0,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-expanded": open,
					"aria-controls": id,
					onClick: () => setOpen((value) => !value),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 12 }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.title }),
						props.meta !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: props.meta })
					]
				}), open && props.actions !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: props.actions })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.Reveal, { children: open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					id,
					className: css.skFoldBody,
					children: props.children
				}) : null })]
			});
		}
		/** A row among the folds that leads elsewhere instead of opening in place. */
		function FoldLink(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				className: css.skFold,
				"data-link": "",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: props.onOpen,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.title }),
						props.meta !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: props.meta }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
							"aria-hidden": "true",
							children: "›"
						})
					]
				}) })
			});
		}
		/**
		* A paragraph that shows its first lines and opens to the rest, so a long
		* reason or note never pushes what follows out of view.
		*/
		function Clamp(props) {
			const t = useT();
			const [open, setOpen] = (0, react.useState)(false);
			const lines = props.lines ?? 3;
			const long = props.text.length > lines * 60 || props.text.split("\n").length > lines;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.skClamp,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: css.skProse,
					"data-clamped": long && !open ? "" : void 0,
					style: { ["--sk-lines"]: lines },
					children: props.text
				}), long && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: css.skLink,
					onClick: () => setOpen((value) => !value),
					children: open ? t("common.less") : t("common.more")
				})]
			});
		}
		/** A list that shows its first items and opens to the rest. */
		function MoreList(props) {
			const t = useT();
			const [open, setOpen] = (0, react.useState)(false);
			const hidden = props.items.length - props.shown;
			const items = open || hidden <= 0 ? props.items : props.items.slice(0, props.shown);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.skClamp,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: css.skChanges,
					children: items.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: item }, index))
				}), hidden > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: css.skLink,
					onClick: () => setOpen((value) => !value),
					children: open ? t("common.less") : t("common.moreCount", { count: hidden })
				})]
			});
		}
		/** The less frequent actions behind one quiet button. */
		function MoreMenu(props) {
			const [open, setOpen] = (0, react.useState)(false);
			if (props.items.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				onClose: () => setOpen(false),
				align: "end",
				portal: true,
				items: props.items.map((item) => ({
					id: item.id,
					label: item.label,
					...item.danger === true ? { danger: true } : {},
					...item.disabled === true ? { disabled: true } : {}
				})),
				onSelect: (id) => {
					setOpen(false);
					props.onSelect(id);
				},
				anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: css.skIconButton,
					"aria-label": props.label,
					title: props.label,
					"aria-haspopup": "menu",
					"aria-expanded": open,
					disabled: props.disabled,
					onClick: () => setOpen((value) => !value),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, { size: 16 })
				})
			});
		}
		const STEP_GLYPH = {
			user: "›",
			assistant: "‹",
			tool: "⚙",
			skill: "✦"
		};
		/**
		* A conversation's steps as a numbered timeline. Annotated steps carry their
		* signal and note; selectable steps get a checkbox, for making test cases.
		*/
		function StepTimeline(props) {
			const t = useT();
			const notes = /* @__PURE__ */ new Map();
			for (const annotation of props.annotations ?? []) notes.set(annotation.step, [...notes.get(annotation.step) ?? [], annotation]);
			let lastTurn;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
				className: css.skTimeline,
				"data-compact": props.compact === true ? "" : void 0,
				children: props.steps.map((step) => {
					const annotated = notes.get(step.index) ?? [];
					const turnLabel = step.turn !== lastTurn ? t("timeline.turn", { turn: step.turn }) : void 0;
					lastTurn = step.turn;
					const failed = step.kind === "tool" && step.tool?.ok === false;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						"data-kind": step.kind,
						"data-failed": failed ? "" : void 0,
						"data-annotated": annotated.length > 0 ? "" : void 0,
						"data-highlight": props.highlight?.has(step.index) === true ? "" : void 0,
						children: [turnLabel !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: css.skTurn,
							children: turnLabel
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.skStep,
							children: [
								props.onToggle !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
									checked: props.selected?.has(step.index) === true,
									label: `#${step.index}`,
									onChange: () => props.onToggle(step.index)
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: css.skStepIndex,
									children: step.index
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: css.skStepGlyph,
									"aria-hidden": "true",
									children: STEP_GLYPH[step.kind]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: css.skStepBody,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: css.skStepHead,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: step.kind === "tool" ? step.tool?.name ?? t("timeline.tool") : t(`timeline.${step.kind}`) }),
												step.kind === "skill" && step.skill !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: step.skill.by === "user" ? `/${step.skill.name}` : step.skill.name }),
												step.kind === "tool" && step.tool?.input !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
													title: step.tool.input,
													children: step.tool.input
												}),
												failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
													tone: "danger",
													children: t("timeline.failed")
												})
											]
										}),
										step.kind !== "skill" && step.text !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: step.text }),
										annotated.map((annotation, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: css.skAnnotation,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SignalTag, { signal: annotation.signal }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: annotation.note })]
										}, index))
									]
								})
							]
						})]
					}, step.index);
				})
			});
		}
		/** A labelled form control with an optional hint, associated for assistive technology. */
		function Field(props) {
			const id = (0, react.useId)();
			const hintId = (0, react.useId)();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.skField,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
						htmlFor: id,
						children: props.label
					}),
					props.children({
						id,
						...props.hint === void 0 ? {} : { "aria-describedby": hintId }
					}),
					props.hint !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
						id: hintId,
						children: props.hint
					})
				]
			});
		}
		function diffLabels(t) {
			return {
				codeLabel: t("diff.code"),
				wrapLabel: t("diff.wrap"),
				unwrapLabel: t("diff.unwrap"),
				copy: t("diff.copy"),
				copied: t("diff.copied"),
				collapseAria: t("diff.collapse"),
				expandAria: (hidden) => t("diff.expand", { count: hidden }),
				collapse: t("diff.collapse"),
				expand: (hidden) => t("diff.expand", { count: hidden })
			};
		}
		/** The SKILL.md body as Markdown, without its frontmatter. */
		function SkillMarkdown(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: css.skDoc,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(index_module_default, {
					options: {
						disableParsingRawHTML: true,
						forceBlock: true
					},
					children: props.body
				})
			});
		}
		const CATEGORY_GLYPH = {
			"docs-writing": "✎",
			"content-creation": "✦",
			"design-ui": "◐",
			development: "⌘",
			devops: "⇪",
			"research-analysis": "⌕",
			productivity: "✓",
			marketing: "◎"
		};
		/** A square with the category's glyph, or the skill's initial. */
		function SkillIcon(props) {
			const glyph = props.category === void 0 ? void 0 : CATEGORY_GLYPH[props.category];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: css.skIcon,
				"aria-hidden": "true",
				children: glyph ?? props.name.slice(0, 1).toUpperCase()
			});
		}
		//#endregion
		//#region src/client/skill-tests.tsx
		/** How many earlier backtests the history keeps on screen. */
		const HISTORY = 6;
		function completedRunSummary(run, t) {
			const unmeasured = run.results.filter((result) => result.unmeasuredReason === "requires-vision").length;
			const errors = run.results.filter((result) => result.verdict === "error" && result.unmeasuredReason === void 0).length;
			return [
				...run.score === void 0 && unmeasured > 0 ? [] : [t("tests.score", { score: points(run.score) })],
				...unmeasured > 0 ? [t("tests.unmeasured", { count: unmeasured })] : [],
				...errors > 0 ? [t("tests.errors", { count: errors })] : []
			].join(" · ");
		}
		/**
		* A skill's test cases and its backtests: the cases with a switch each, one
		* button that backtests the current version, and the runs, newest first, each
		* opening to its per-case verdicts. A draft is backtested from its review.
		*/
		function SkillTests(props) {
			const t = useT();
			const { context, skillName } = props;
			const runModel = props.runModel ?? null;
			const [cases, setCases] = (0, react.useState)(null);
			const [runs, setRuns] = (0, react.useState)([]);
			const [hasFile, setHasFile] = (0, react.useState)(true);
			const [editing, setEditing] = (0, react.useState)(null);
			const [deleting, setDeleting] = (0, react.useState)(null);
			const [openRun, setOpenRun] = (0, react.useState)();
			const [busy, setBusy] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let active = true;
				Promise.all([
					context.client.cases(skillName),
					context.client.runs(skillName),
					context.client.evidencePack({ skill: skillName })
				]).then(([list, history, pack]) => {
					if (!active) return;
					setCases(list);
					setRuns(history.filter((run) => run.target.kind !== "draft"));
					setHasFile(pack.skill !== void 0);
				}).catch(context.fail);
				return () => {
					active = false;
				};
			}, [
				context.client,
				skillName,
				context.revision
			]);
			if (cases === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") });
			const enabled = cases.filter((entry) => entry.enabled);
			const running = runs.some((entry) => entry.status === "running");
			const run = async () => {
				setBusy(true);
				try {
					const started = await context.client.backtest({
						skillName,
						target: { kind: hasFile ? "current" : "none" },
						...runModel === null ? {} : {
							provider: runModel.provider,
							model: runModel.model
						}
					});
					setOpenRun(started.runId);
					context.refresh();
				} catch (error) {
					context.fail(error);
				} finally {
					setBusy(false);
				}
			};
			const save = async (input) => {
				setBusy(true);
				try {
					await context.client.saveCase(input);
					setEditing(null);
					context.refresh();
				} catch (error) {
					context.fail(error);
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.skTests,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.skTestsBar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							size: "sm",
							disabled: !context.writable || busy || running || enabled.length === 0 || !context.client.canAssist("skill-backtest"),
							onClick: () => void run(),
							children: running ? t("tests.running") : t("tests.run")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							disabled: !context.writable,
							onClick: () => setEditing({
								skillName,
								title: "",
								prompt: "",
								checks: [{
									text: "",
									must: true
								}]
							}),
							children: t("tests.add")
						})]
					}),
					cases.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.skMuted,
						children: t("tests.empty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: css.skCases,
						children: cases.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							"data-off": entry.enabled ? void 0 : "",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: entry.title }),
										entry.requiresVision === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
											tone: "quiet",
											children: t("tests.requiresVision")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("tests.checks", { count: entry.checks.length }) })
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: entry.prompt }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: entry.checks.map((check) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
										tone: check.must ? "neutral" : "quiet",
										children: check.must ? t("tests.must") : t("tests.should")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: check.text })] }, check.id)) }),
									entry.origin.trajectoryId !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: css.skLink,
										onClick: () => context.navigate({
											tab: "evolution",
											filter: "evidence",
											trajectoryId: entry.origin.trajectoryId,
											...entry.origin.steps === void 0 ? {} : { steps: entry.origin.steps }
										}),
										children: [t("tests.origin"), " ›"]
									})
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
									checked: entry.enabled,
									label: t("tests.enabled", { title: entry.title }),
									disabled: !context.writable || busy,
									onChange: (next) => void save({
										...entry,
										enabled: next
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MoreMenu, {
									label: t("common.more"),
									disabled: !context.writable,
									onSelect: (id) => id === "edit" ? setEditing({ ...entry }) : setDeleting(entry),
									items: [{
										id: "edit",
										label: t("common.edit")
									}, {
										id: "delete",
										label: t("common.delete"),
										danger: true
									}]
								})
							]
						}, entry.id))
					}),
					runs.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h6", {
						className: css.skCaption,
						children: t("tests.history")
					}),
					runs.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: css.skRuns,
						children: runs.slice(0, HISTORY).map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							"aria-expanded": openRun === entry.id,
							onClick: () => setOpenRun(openRun === entry.id ? void 0 : entry.id),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RunStatusDot, { status: entry.status }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: entry.status === "running" ? t("tests.progress", {
									done: entry.progress.done,
									total: entry.progress.total
								}) : entry.status === "completed" ? completedRunSummary(entry, t) : t(`run.status.${entry.status}`) }),
								entry.target.kind === "none" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
									tone: "quiet",
									children: t("tests.withoutSkill")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", { children: relative(t, entry.startedAt) })
							]
						}), openRun === entry.id && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RunDetail, { run: entry })] }, entry.id))
					}),
					editing !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CaseEditor, {
						initial: editing,
						busy,
						onClose: () => setEditing(null),
						onSave: (input) => void save(input)
					}),
					deleting !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Confirm, {
						danger: true,
						title: t("tests.deleteTitle"),
						body: deleting.title,
						confirmLabel: t("common.delete"),
						busy,
						onClose: () => setDeleting(null),
						onConfirm: () => void (async () => {
							setBusy(true);
							try {
								await context.client.deleteCase(deleting.id);
								setDeleting(null);
								context.refresh();
							} catch (error) {
								context.fail(error);
							} finally {
								setBusy(false);
							}
						})()
					})
				]
			});
		}
		/** One run's cases: the verdict, each check with the judge's note, and what the simulated run did and answered. */
		function RunDetail(props) {
			const t = useT();
			if (props.run.error !== void 0 && props.run.results.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: css.inlineError,
				children: props.run.error
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: css.skRunDetail,
				children: props.run.results.map((result) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							tone: result.unmeasuredReason === "requires-vision" ? "quiet" : result.verdict === "pass" ? "success" : result.verdict === "error" ? "danger" : "warning",
							children: t(`run.verdict.${result.unmeasuredReason === "requires-vision" ? "unmeasured" : result.verdict}`)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: result.title }),
						result.verdict !== "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: points(result.score) })
					] }),
					result.unmeasuredReason === "requires-vision" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.skMuted,
						children: t("run.requiresVision")
					}) : result.error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.inlineError,
						children: result.error
					}),
					result.checks.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: css.skVerdicts,
						children: result.checks.map((check) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							"data-pass": check.pass ? "" : void 0,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
								"aria-hidden": "true",
								children: check.pass ? "✓" : "✕"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: check.note })]
						}, check.checkId))
					}),
					result.steps.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h6", { children: t("run.steps") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
						className: css.skRunSteps,
						children: result.steps.map((step, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: step }, index))
					})] }),
					result.answer !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h6", { children: t("run.answer") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: css.skAnswer,
						children: result.answer
					})] })
				] }, result.caseId))
			});
		}
		function CaseEditor(props) {
			const t = useT();
			const [value, setValue] = (0, react.useState)(props.initial);
			const [error, setError] = (0, react.useState)(null);
			const checks = value.checks.filter((check) => check.text.trim() !== "");
			const valid = value.title.trim() !== "" && value.prompt.trim() !== "" && checks.length > 0;
			const setCheck = (index, patch) => setValue((current) => ({
				...current,
				checks: current.checks.map((check, position) => position === index ? {
					...check,
					...patch
				} : check)
			}));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SidebarModal, {
				wide: true,
				title: props.initial.id === void 0 ? t("tests.newTitle") : t("tests.editTitle"),
				busy: props.busy,
				onClose: props.onClose,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.skFormError,
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						onClick: props.onClose,
						children: t("common.cancel")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						disabled: !valid || props.busy,
						onClick: () => {
							try {
								props.onSave({
									...value,
									checks
								});
							} catch (reason) {
								setError(errorText(reason));
							}
						},
						children: t("common.save")
					})
				] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.skForm,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: t("tests.caseTitle"),
							children: (control) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								...control,
								value: value.title,
								onChange: (event) => setValue({
									...value,
									title: event.target.value
								})
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: t("tests.prompt"),
							hint: t("tests.promptHint"),
							children: (control) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								...control,
								rows: 4,
								value: value.prompt,
								onChange: (event) => setValue({
									...value,
									prompt: event.target.value
								})
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: t("tests.context"),
							children: (control) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								...control,
								rows: 3,
								value: value.context ?? "",
								onChange: (event) => setValue({
									...value,
									context: event.target.value
								})
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
							checked: value.requiresVision ?? false,
							label: t("tests.requiresVision"),
							disabled: props.busy,
							onChange: (requiresVision) => setValue({
								...value,
								requiresVision
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.skMuted,
							children: t("tests.requiresVisionHint")
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
							className: css.skChecks,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: t("tests.checksLabel") }),
								value.checks.map((check, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
										className: css.skMust,
										checked: check.must,
										label: t("tests.must"),
										onChange: (must) => setCheck(index, { must })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										value: check.text,
										placeholder: t("tests.checkPlaceholder"),
										onChange: (event) => setCheck(index, { text: event.target.value })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: css.skDismiss,
										"aria-label": t("common.delete"),
										onClick: () => setValue((current) => ({
											...current,
											checks: current.checks.filter((_, position) => position !== index)
										})),
										children: "×"
									})
								] }, index)),
								value.checks.length < 8 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									size: "sm",
									onClick: () => setValue((current) => ({
										...current,
										checks: [...current.checks, {
											text: "",
											must: false
										}]
									})),
									children: t("tests.addCheck")
								})
							]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/evals-page.tsx
		/** A score's tone: good from 80, poor under 50. */
		function scoreTone(score) {
			return score === void 0 ? void 0 : score >= .8 ? "good" : score < .5 ? "bad" : void 0;
		}
		/**
		* Every skill's tests in one place: the skills with cases first, each with
		* its last score against the version DSH loads, and the ones a suggestion
		* proposes after them; on the right, the chosen skill's cases and backtests.
		*/
		function EvalsPage(props) {
			const t = useT();
			const { context, location } = props;
			const [catalog, setCatalog] = (0, react.useState)(null);
			const [cases, setCases] = (0, react.useState)([]);
			/** Skills a waiting suggestion proposes to create. */
			const [proposed, setProposed] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [query, setQuery] = (0, react.useState)("");
			const [selected, setSelected] = (0, react.useState)(location.skillName);
			const choice = useModelChoice(context, "tests.modelAuto");
			(0, react.useEffect)(() => {
				if (location.skillName !== void 0) setSelected(location.skillName);
			}, [location.skillName, location.nonce]);
			(0, react.useEffect)(() => {
				let active = true;
				Promise.all([
					context.client.catalog(),
					context.client.cases(),
					context.client.suggestions([
						"pending",
						"drafting",
						"review"
					])
				]).then(([view, list, waiting]) => {
					if (!active) return;
					setCatalog(view);
					setCases(list);
					setProposed(new Set(waiting.filter((entry) => entry.action === "create").map((entry) => entry.skillName)));
				}).catch(context.fail);
				return () => {
					active = false;
				};
			}, [context.client, context.revision]);
			const rows = (0, react.useMemo)(() => {
				if (catalog === null) return [];
				const loaded = new Map(catalog.skills.filter((skill) => skill.shadowedBy === void 0).map((skill) => [skill.name, skill.description]));
				return [.../* @__PURE__ */ new Set([...loaded.keys(), ...cases.map((entry) => entry.skillName)])].map((name) => {
					const stats = catalog.stats[name];
					const own = cases.filter((entry) => entry.skillName === name);
					const description = loaded.get(name);
					return {
						name,
						exists: loaded.has(name),
						cases: own.filter((entry) => entry.enabled).length,
						off: own.filter((entry) => !entry.enabled).length,
						...description === void 0 ? {} : { description },
						...stats?.lastScore === void 0 ? {} : { lastScore: stats.lastScore },
						...stats?.lastRunAt === void 0 ? {} : { lastRunAt: stats.lastRunAt }
					};
				}).sort((a, b) => Number(b.exists) - Number(a.exists) || a.name.localeCompare(b.name));
			}, [catalog, cases]);
			if (catalog === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") });
			if (rows.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
				glyph: "✓",
				title: t("evals.empty"),
				children: t("evals.emptyBody")
			});
			const needle = query.trim().toLowerCase();
			const visible = rows.filter((row) => needle === "" || row.name.includes(needle));
			const groups = [{
				key: "tested",
				title: t("evals.tested"),
				rows: visible.filter((row) => row.cases > 0)
			}, {
				key: "untested",
				title: t("evals.untested"),
				rows: visible.filter((row) => row.cases === 0)
			}].filter((group) => group.rows.length > 0);
			const current = rows.find((row) => row.name === selected) ?? groups[0]?.rows[0] ?? rows[0];
			const runOverride = Object.hasOwn(choice.preferences.skillRunModels, current.name) ? choice.preferences.skillRunModels[current.name] : null;
			const effectiveRunModel = runOverride ?? choice.preferences.runModel ?? null;
			const saveRun = (value) => choice.saveRunModel(modelOptionPick(value));
			const saveSkillRun = (value) => choice.saveSkillRunModel(current.name, modelOptionPick(value));
			const modelBar = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: css.skListBar,
				style: {
					borderBottom: "none",
					padding: "0 0 10px"
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.skSplit,
					style: {
						minHeight: 0,
						alignItems: "center",
						width: "100%"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
						label: t("tests.model"),
						triggerDetail: true,
						inline: true,
						size: "sm",
						value: modelOptionValue(choice.preferences.runModel),
						disabled: !context.writable || choice.models === null,
						onChange: saveRun,
						options: choice.options
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
						label: t("tests.modelCard"),
						triggerDetail: true,
						inline: true,
						size: "sm",
						value: modelOptionValue(runOverride),
						disabled: !context.writable || choice.models === null,
						onChange: saveSkillRun,
						options: choice.cardOptions
					})]
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [modelBar, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.skSplit,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
					className: css.skList,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", {
							className: css.skListBar,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SearchField, {
								label: t("skills.search"),
								placeholder: t("skills.search"),
								value: query,
								onChange: (event) => setQuery(event.target.value)
							})
						}),
						visible.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.skListNote,
							children: t("skills.noMatch")
						}),
						groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: css.skListGroup,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h5", { children: group.title }), group.rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: css.skRow,
								"data-selected": row.name === current.name ? "" : void 0,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: css.skRowMain,
									onClick: () => setSelected(row.name),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillIcon, { name: row.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: css.skRowText,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: row.name }), !row.exists && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
											tone: "quiet",
											children: t("evals.notCreated")
										})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: row.cases > 0 ? [t("tests.count", { count: row.cases }), ...row.lastRunAt === void 0 ? [] : [relative(t, row.lastRunAt)]].join(" · ") : row.off > 0 ? t("evals.off", { count: row.off }) : row.description })]
									})]
								}), row.lastScore !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
									className: css.skScore,
									"data-tone": scoreTone(row.lastScore),
									title: t("tests.lastScore", { score: points(row.lastScore) }),
									children: points(row.lastScore)
								})]
							}, row.name))]
						}, group.key))
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: css.skPane,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
						className: css.skDetail,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", {
							className: css.skDetailHead,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: current.exists ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: css.skTitleLink,
								onClick: () => context.navigate({
									tab: "skills",
									skillName: current.name
								}),
								children: current.name
							}) : current.name }), !current.exists && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [t("evals.notCreatedBody"), proposed.has(current.name) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [" ", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: css.skLink,
								onClick: () => context.navigate({
									tab: "evolution",
									skillName: current.name
								}),
								children: [t("evals.openSuggestion"), " ›"]
							})] })] })] })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillTests, {
							context,
							skillName: current.name,
							runModel: effectiveRunModel
						})]
					}, current.name)
				})]
			})] });
		}
		//#endregion
		//#region src/client/evidence-page.tsx
		/**
		* 进化's third view: the conversations reviews read, the evidence every
		* suggestion and case cites. Pinned and newest first, narrowed to a skill
		* they used; each opens to its steps as the review numbered and marked them.
		* `bar` is 进化's own list header, so switching views keeps it in place.
		*/
		function EvidenceView(props) {
			const t = useT();
			const { context, location } = props;
			const [records, setRecords] = (0, react.useState)(null);
			const [skill, setSkill] = (0, react.useState)(location.filter === "evidence" && location.trajectoryId === void 0 ? location.skillName ?? "" : "");
			const [selected, setSelected] = (0, react.useState)(location.trajectoryId);
			(0, react.useEffect)(() => {
				if (location.trajectoryId !== void 0) setSelected(location.trajectoryId);
			}, [location.trajectoryId, location.nonce]);
			(0, react.useEffect)(() => {
				let active = true;
				context.client.trajectories().then((list) => {
					if (active) setRecords(list);
				}).catch(context.fail);
				return () => {
					active = false;
				};
			}, [context.client, context.revision]);
			const skills = (0, react.useMemo)(() => [...new Set((records ?? []).flatMap((record) => record.stats.skills))].sort(), [records]);
			if (records === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") });
			const shown = records.filter((record) => skill === "" || record.stats.skills.includes(skill)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
			const current = shown.find((record) => record.id === selected) ?? shown[0];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.skSplit,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
					className: css.skList,
					children: [
						props.bar,
						(skills.length > 1 || skill !== "") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: css.skListFilter,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
								size: "sm",
								hideLabel: true,
								label: t("evidence.skill"),
								value: skill,
								onChange: (value) => {
									setSkill(value);
									setSelected(void 0);
								},
								options: [{
									value: "",
									label: t("evidence.allSkills")
								}, ...skills.map((name) => ({
									value: name,
									label: name
								}))]
							})
						}),
						shown.map((record) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: css.skListItem,
							"data-selected": current?.id === record.id ? "" : void 0,
							onClick: () => setSelected(record.id),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: record.sessionTitle ?? record.sessionId.slice(0, 8) }), record.pinned && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
									tone: "neutral",
									children: t("records.pinned")
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [t("records.stats", {
									turns: record.stats.turns,
									tools: record.stats.toolCalls
								}), record.stats.skills.length > 0 ? ` · ${record.stats.skills.join(", ")}` : ""] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", { children: relative(t, record.createdAt) }), record.suggestionIds.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("records.suggested", { count: record.suggestionIds.length }) })] })
							]
						}, record.id))
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: css.skPane,
					children: current === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
						glyph: "✧",
						title: t("evolution.empty.evidence"),
						children: t("evolution.emptyBody.evidence")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordDetail, {
						context,
						id: current.id,
						focus: current.id === location.trajectoryId ? location.steps : void 0,
						onDeleted: () => setSelected(void 0)
					}, current.id)
				})]
			});
		}
		/**
		* One recorded conversation: the steps the review read, with what it marked,
		* and making test cases from chosen steps.
		*/
		function RecordDetail(props) {
			const t = useT();
			const { context } = props;
			const [trajectory, setTrajectory] = (0, react.useState)(null);
			const [chosen, setChosen] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [target, setTarget] = (0, react.useState)("");
			const [names, setNames] = (0, react.useState)([]);
			const [busy, setBusy] = (0, react.useState)(false);
			const [deleting, setDeleting] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let active = true;
				context.client.trajectory(props.id).then((value) => {
					if (!active) return;
					setTrajectory(value);
					setTarget((current) => current !== "" ? current : value.stats.skills[0] ?? "");
				}).catch(context.fail);
				context.client.catalog().then((catalog) => {
					if (active) setNames([...new Set(catalog.skills.map((skill) => skill.name))]);
				}).catch(() => void 0);
				return () => {
					active = false;
				};
			}, [
				context.client,
				props.id,
				context.revision
			]);
			if (trajectory === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") });
			const targets = [.../* @__PURE__ */ new Set([...trajectory.stats.skills, ...names])];
			const skillName = target !== "" ? target : targets[0] ?? "";
			const toggle = (index) => setChosen((current) => {
				const next = new Set(current);
				if (next.has(index)) next.delete(index);
				else next.add(index);
				return next;
			});
			const act = async (operation) => {
				setBusy(true);
				try {
					await operation();
					context.refresh();
				} catch (error) {
					context.fail(error);
				} finally {
					setBusy(false);
				}
			};
			const derive = () => act(async () => {
				const result = await context.client.deriveCases({
					trajectoryId: trajectory.id,
					skillName,
					...chosen.size === 0 ? {} : { steps: [...chosen].sort((a, b) => a - b) }
				});
				context.notice(t("records.derived", {
					count: result.added.length,
					name: skillName
				}));
				setChosen(/* @__PURE__ */ new Set());
			});
			const meta = [
				stamp(trajectory.createdAt),
				t("records.stats", {
					turns: trajectory.stats.turns,
					tools: trajectory.stats.toolCalls
				}),
				...trajectory.stats.toolFailures > 0 ? [t("records.failures", { count: trajectory.stats.toolFailures })] : []
			];
			const canDerive = context.client.canAssist("skill-derive-cases") && context.writable;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: css.skDetail,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: css.skDetailHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: trajectory.sessionTitle ?? trajectory.sessionId }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: css.skMeta,
							children: meta.map((part) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: part }, part))
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.skDetailActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								disabled: !context.writable || busy,
								onClick: () => void act(() => context.client.pinTrajectory(trajectory.id, !trajectory.pinned)),
								children: trajectory.pinned ? t("records.unpin") : t("records.pin")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MoreMenu, {
								label: t("common.more"),
								disabled: !context.writable,
								items: [{
									id: "delete",
									label: t("common.delete"),
									danger: true
								}],
								onSelect: () => setDeleting(true)
							})]
						})]
					}),
					trajectory.reviewSummary !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Clamp, { text: trajectory.reviewSummary }),
					trajectory.signals.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: css.skChips,
						children: trajectory.signals.map((signal) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SignalTag, { signal }, signal))
					}),
					trajectory.suggestionIds.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: css.skChips,
						children: trajectory.suggestionIds.map((id, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: css.skLink,
							onClick: () => context.navigate({
								tab: "evolution",
								suggestionId: id
							}),
							children: [t("records.suggestion", { index: index + 1 }), " ›"]
						}, id))
					}),
					canDerive && targets.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.skDeriveBar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: chosen.size === 0 ? t("records.deriveAll") : t("records.deriveChosen", { count: chosen.size }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
								size: "sm",
								inline: true,
								hideLabel: true,
								label: t("records.deriveFor"),
								value: skillName,
								onChange: setTarget,
								options: targets.map((name) => ({
									value: name,
									label: name
								}))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								disabled: busy || skillName === "",
								onClick: () => void derive(),
								children: t("records.derive")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StepTimeline, {
						steps: trajectory.steps,
						annotations: trajectory.annotations,
						highlight: new Set(props.focus ?? []),
						selected: chosen,
						...canDerive ? { onToggle: toggle } : {}
					}),
					deleting && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Confirm, {
						danger: true,
						title: t("records.deleteTitle"),
						body: t("records.deleteBody"),
						confirmLabel: t("common.delete"),
						busy,
						onClose: () => setDeleting(false),
						onConfirm: () => void (async () => {
							setBusy(true);
							try {
								await context.client.deleteTrajectory(trajectory.id);
								setDeleting(false);
								props.onDeleted();
								context.refresh();
							} catch (error) {
								context.fail(error);
							} finally {
								setBusy(false);
							}
						})()
					})
				]
			});
		}
		//#endregion
		//#region src/client/evolution-page.tsx
		const PENDING = [
			"pending",
			"drafting",
			"review"
		];
		const DONE = [
			"adopted",
			"dismissed",
			"expired",
			"invalidated"
		];
		function EvolutionPage(props) {
			const t = useT();
			const { context, location } = props;
			const [filter, setFilter] = (0, react.useState)(location.filter ?? "pending");
			const [suggestions, setSuggestions] = (0, react.useState)(null);
			const [drafts, setDrafts] = (0, react.useState)([]);
			const [selected, setSelected] = (0, react.useState)(location.suggestionId ?? location.draftId);
			const [reviewing, setReviewing] = (0, react.useState)(false);
			const [deleting, setDeleting] = (0, react.useState)(void 0);
			const choice = useModelChoice(context, "evolution.modelAuto");
			(0, react.useEffect)(() => {
				let active = true;
				context.client.suggestions().then((list) => {
					if (active) setSuggestions(list);
				}).catch(context.fail);
				context.client.overview().then(async (overview) => {
					const ids = overview.attention.filter((item) => item.kind === "draft").map((item) => item.id);
					const views = await Promise.all(ids.map((id) => context.client.draft(id).then((view) => view.draft).catch(() => void 0)));
					if (active) setDrafts(views.filter((draft) => draft !== void 0 && draft.suggestionId === void 0));
				}).catch(() => void 0);
				return () => {
					active = false;
				};
			}, [context.client, context.revision]);
			useLink(location.nonce, location.filter === "evidence" || suggestions !== null, () => {
				if (location.filter === "evidence" || suggestions === null) {
					setFilter("evidence");
					return;
				}
				const target = location.suggestionId !== void 0 ? suggestions.find((entry) => entry.id === location.suggestionId) : location.draftId !== void 0 ? suggestions.find((entry) => entry.draftId === location.draftId) : location.skillName !== void 0 ? suggestions.find((entry) => entry.skillName === location.skillName && PENDING.includes(entry.status)) : void 0;
				if (target !== void 0) {
					setFilter(PENDING.includes(target.status) ? "pending" : "done");
					setSelected(target.id);
					return;
				}
				if (location.draftId !== void 0) {
					setFilter("pending");
					setSelected(location.draftId);
					return;
				}
				if (location.filter !== void 0) setFilter(location.filter);
			});
			const items = (0, react.useMemo)(() => {
				const statuses = filter === "pending" ? PENDING : DONE;
				return [...filter === "pending" ? drafts.map((draft) => ({
					kind: "draft",
					id: draft.id,
					draft
				})) : [], ...(suggestions ?? []).filter((entry) => statuses.includes(entry.status)).map((suggestion) => ({
					kind: "suggestion",
					id: suggestion.id,
					suggestion
				}))];
			}, [
				filter,
				suggestions,
				drafts
			]);
			if (suggestions === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") });
			const pendingCount = suggestions.filter((entry) => PENDING.includes(entry.status)).length + drafts.length;
			const oneOff = filter === "pending" ? items.filter((item) => item.kind === "suggestion" && item.suggestion.status === "pending" && item.suggestion.triage?.classification === "one-off") : [];
			const folded = new Set(oneOff.map((item) => item.id));
			const prominent = items.filter((item) => !folded.has(item.id)).sort((a, b) => Number(b.kind === "suggestion" && b.suggestion.triage?.classification === "durable") - Number(a.kind === "suggestion" && a.suggestion.triage?.classification === "durable"));
			const current = items.find((item) => item.id === selected) ?? prominent[0];
			const selectedOneOff = selected !== void 0 && folded.has(selected);
			const canReview = context.sessionId !== void 0 && context.client.canAssist("skill-review-now");
			const reviewNow = async () => {
				setReviewing(true);
				try {
					const result = await context.client.reviewNow();
					const found = result.inserted + result.updated;
					context.notice(found > 0 ? t("evolution.reviewFound", { count: found }) : t("evolution.reviewNothing"));
					if (result.suggestionIds[0] !== void 0) {
						setFilter("pending");
						setSelected(result.suggestionIds[0]);
					}
					context.refresh();
				} catch (error) {
					context.fail(error);
				} finally {
					setReviewing(false);
				}
			};
			const evolutionOff = context.evolution !== void 0 && !context.evolution.on;
			const bar = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
				className: css.skListBar,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SegmentedControl, {
					id: "skill-evolution-filter",
					label: t("tab.evolution"),
					value: filter,
					onChange: (value) => {
						setFilter(value);
						setSelected(void 0);
					},
					options: [
						{
							value: "pending",
							label: pendingCount > 0 ? t("evolution.pendingCount", { count: pendingCount }) : t("evolution.pending")
						},
						{
							value: "done",
							label: t("evolution.done")
						},
						{
							value: "evidence",
							label: t("evolution.evidence")
						}
					]
				}), canReview && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: css.skIconButton,
					disabled: reviewing || !context.writable,
					onClick: () => void reviewNow(),
					"aria-label": t("evolution.reviewNow"),
					title: t("evolution.reviewNow"),
					"data-pulse": reviewing ? "" : void 0,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkleRegular, { size: 16 })
				})]
			});
			if (filter === "evidence") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EvidenceView, {
				context,
				location,
				bar
			});
			const currentId = current?.kind === "suggestion" ? current.id : void 0;
			const canOverride = currentId !== void 0 && current?.kind === "suggestion" && PENDING.includes(current.suggestion.status);
			const currentOverride = currentId === void 0 ? null : Object.hasOwn(choice.preferences.suggestionModels, currentId) ? choice.preferences.suggestionModels[currentId] : null;
			const currentModel = currentOverride ?? choice.preferences.model ?? null;
			const saveDraftModel = (value) => choice.saveDraftModel(modelOptionPick(value));
			const saveSuggestionModel = (value) => {
				if (canOverride && currentId !== void 0) choice.saveSuggestionModel(currentId, modelOptionPick(value));
			};
			const removeItem = async (item) => {
				try {
					if (item.kind === "draft") await context.client.deleteDraft(item.id);
					else await context.client.deleteSuggestion(item.id);
					setDeleting(void 0);
					if (selected === item.id) setSelected(void 0);
					context.notice(t("evolution.deleted"));
					context.refresh();
				} catch (error) {
					context.fail(error);
				}
			};
			const modelBar = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: css.skListBar,
				style: {
					borderBottom: "none",
					padding: "0 0 10px"
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.skSplit,
					style: {
						minHeight: 0,
						alignItems: "center",
						width: "100%"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
						label: t("evolution.model"),
						triggerDetail: true,
						inline: true,
						size: "sm",
						value: modelOptionValue(choice.preferences.model),
						disabled: !context.writable || choice.models === null,
						onChange: saveDraftModel,
						options: choice.options
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
						label: t("evolution.modelCard"),
						triggerDetail: true,
						inline: true,
						size: "sm",
						value: modelOptionValue(currentOverride),
						disabled: !context.writable || !canOverride || choice.models === null,
						onChange: saveSuggestionModel,
						options: choice.cardOptions
					})]
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [modelBar, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: (0, dsh_mnemon_client.appearanceClass)(css.skSplit, css.skEvolutionSplit),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
					className: css.skList,
					children: [
						bar,
						prominent.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ListItem, {
							item,
							selected: current?.id === item.id,
							onSelect: () => setSelected(item.id)
						}, item.id)),
						oneOff.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Fold, {
							defaultOpen: selectedOneOff,
							title: t("triage.fold", { count: oneOff.length }),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: css.skMuted,
								children: t("triage.soft")
							}), oneOff.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ListItem, {
								item,
								selected: current?.id === item.id,
								onSelect: () => setSelected(item.id)
							}, item.id))]
						}, selectedOneOff ? selected : "one-off")
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: css.skPane,
					children: current === void 0 ? filter === "pending" && evolutionOff ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
						glyph: "✧",
						title: t("evolution.off"),
						action: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [context.evolution?.enable !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							size: "sm",
							disabled: !context.writable,
							onClick: () => void context.evolution.enable().then(context.refresh, context.fail),
							children: t("evolution.turnOn")
						}), context.openSettings !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							onClick: context.openSettings,
							children: t("common.settings")
						})] }),
						children: t("evolution.offBody")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
						glyph: "✧",
						title: t(oneOff.length > 0 ? "triage.choose" : `evolution.empty.${filter}`),
						children: t(oneOff.length > 0 ? "triage.soft" : `evolution.emptyBody.${filter}`)
					}) : current.kind === "suggestion" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SuggestionDetail, {
						context,
						id: current.id,
						model: currentModel
					}, current.id) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
						className: css.skDetail,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
								className: css.skDetailHead,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: css.skKicker,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionTag, { action: "update" })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: current.draft.skillName })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: css.skDetailActions,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										size: "sm",
										disabled: !context.writable,
										onClick: () => setDeleting(current.id),
										children: t("common.delete")
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DraftReview, {
								context,
								draftId: current.id,
								model: currentModel
							}, current.id),
							deleting === current.id && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Confirm, {
								danger: true,
								title: t("evolution.deleteTitle"),
								body: t("evolution.deleteBody"),
								confirmLabel: t("common.delete"),
								onClose: () => setDeleting(void 0),
								onConfirm: () => void removeItem(current)
							})
						]
					})
				}, current?.id ?? filter)]
			})] });
		}
		function ListItem(props) {
			const t = useT();
			const { item } = props;
			const common = {
				type: "button",
				className: css.skListItem,
				"data-selected": props.selected ? "" : void 0,
				onClick: props.onSelect
			};
			if (item.kind === "draft") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				...common,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionTag, { action: "update" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: item.draft.skillName }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							tone: "warning",
							children: t("status.review")
						})
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: item.draft.notes }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("footer", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", { children: relative(t, item.draft.updatedAt) }) })
				]
			});
			const { suggestion } = item;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				...common,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionTag, { action: suggestion.action }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: suggestion.skillName }),
						suggestion.status !== "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusTag, { status: suggestion.status })
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: suggestion.summary }),
					suggestion.triage !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
						t(`triage.${suggestion.triage.classification}`),
						" · ",
						t("triage.facts", suggestion.triage)
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", { children: relative(t, suggestion.updatedAt) }), suggestion.sourceSessionTitle !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						title: suggestion.sourceSessionTitle,
						children: suggestion.sourceSessionTitle
					})] })
				]
			});
		}
		function SuggestionDetail(props) {
			const t = useT();
			const { context } = props;
			const route = props.model === null || props.model === void 0 ? {} : {
				provider: props.model.provider,
				model: props.model.model
			};
			const [view, setView] = (0, react.useState)(null);
			const [loadError, setLoadError] = (0, react.useState)(null);
			const [reload, setReload] = (0, react.useState)(0);
			const [trajectories, setTrajectories] = (0, react.useState)(/* @__PURE__ */ new Map());
			const [busy, setBusy] = (0, react.useState)(false);
			const [deleting, setDeleting] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let active = true;
				setLoadError(null);
				context.client.suggestion(props.id).then(async (value) => {
					if (!active) return;
					setView(value);
					const loaded = /* @__PURE__ */ new Map();
					for (const reference of value.suggestion.evidence.slice(-4)) {
						if (loaded.has(reference.trajectoryId)) continue;
						loaded.set(reference.trajectoryId, await context.client.trajectory(reference.trajectoryId).catch(() => null));
					}
					if (active) setTrajectories(loaded);
				}).catch((error) => {
					if (!active) return;
					setView(null);
					if ((error instanceof Error ? error.message : String(error)) === "suggestion not found: " + props.id) setLoadError("missing");
					else {
						setLoadError("failed");
						context.fail(error);
					}
				});
				return () => {
					active = false;
				};
			}, [
				context.client,
				props.id,
				context.revision,
				reload
			]);
			if (loadError !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
				glyph: "?",
				title: t(loadError === "missing" ? "evolution.missing" : "evolution.loadFailed"),
				action: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					onClick: () => setReload((value) => value + 1),
					children: t("common.retry")
				}),
				children: t(loadError === "missing" ? "evolution.missingBody" : "evolution.loadFailedBody")
			});
			if (view === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") });
			const { suggestion } = view;
			const canDraft = context.client.canAssist("skill-draft") && !(suggestion.action === "update" && view.skill === void 0);
			const act = async (operation) => {
				setBusy(true);
				try {
					await operation();
					context.refresh();
				} catch (error) {
					context.fail(error);
					context.refresh();
				} finally {
					setBusy(false);
				}
			};
			const references = suggestion.evidence.slice(-4);
			const cited = references.reduce((sum, reference) => sum + reference.steps.length, 0);
			const meta = [
				...suggestion.sourceSessionTitle === void 0 ? [] : [t("evolution.from", { session: suggestion.sourceSessionTitle })],
				relative(t, suggestion.createdAt),
				t("evolution.confidence", { value: Math.round(suggestion.confidence * 100) }),
				...suggestion.action === "create" && suggestion.targetRoot !== void 0 ? [t("evolution.targetRoot", { root: t(`root.${suggestion.targetRoot}`) })] : []
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: css.skDetail,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: css.skDetailHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: css.skKicker,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionTag, { action: suggestion.action }), suggestion.status !== "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusTag, { status: suggestion.status })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: view.skill === void 0 || view.skillInCatalog === false ? suggestion.skillName : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: css.skTitleLink,
								onClick: () => context.navigate({
									tab: "skills",
									skillKey: view.skill.key
								}),
								children: suggestion.skillName
							}) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: suggestion.summary }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.skMeta,
								children: meta.map((part) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: part }, part))
							})
						] }), suggestion.status === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.skDetailActions,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									size: "sm",
									disabled: !context.writable || busy || !canDraft || view.skill?.readOnly === true,
									title: canDraft ? void 0 : t("evolution.noAgent"),
									onClick: () => void act(() => context.client.generateDraft({
										suggestionId: suggestion.id,
										...route
									})),
									children: t("evolution.draft")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									size: "sm",
									disabled: !context.writable || busy,
									onClick: () => void act(async () => {
										await context.client.dismissSuggestion(suggestion.id);
										context.notice(t("evolution.dismissed"));
									}),
									children: t("evolution.dismiss")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									size: "sm",
									disabled: !context.writable || busy,
									onClick: () => setDeleting(true),
									children: t("common.delete")
								})
							]
						})]
					}),
					deleting && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Confirm, {
						danger: true,
						title: t("evolution.deleteTitle"),
						body: t("evolution.deleteBody"),
						confirmLabel: t("common.delete"),
						onClose: () => setDeleting(false),
						onConfirm: () => void act(async () => {
							await context.client.deleteSuggestion(suggestion.id);
							setDeleting(false);
							context.notice(t("evolution.deleted"));
						})
					}),
					suggestion.triage !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						"aria-label": t("triage.title"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(`triage.${suggestion.triage.classification}`) }),
							" · ",
							t("triage.facts", suggestion.triage)
						] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: css.skMuted,
							children: [
								t("triage.rules"),
								" ",
								t("triage.soft")
							]
						})]
					}),
					suggestion.rationale !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Clamp, { text: suggestion.rationale }),
					view.skill?.readOnly && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.skWarn,
						children: t("skills.linkedReadOnly")
					}),
					suggestion.action === "update" && view.skill === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.skWarn,
						children: t(view.resolution === "origin-unavailable" ? "evolution.originUnavailable" : "evolution.skillGone")
					}),
					suggestion.action === "update" && view.skill !== void 0 && !view.hashCurrent && suggestion.status === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.skWarn,
						children: t("evolution.skillChanged")
					}),
					suggestion.autoAdoption !== void 0 && suggestion.autoAdoption.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AutoAdoptionHistory, { events: suggestion.autoAdoption }),
					suggestion.status === "drafting" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("evolution.drafting") }),
					suggestion.lastError !== void 0 && suggestion.status === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.inlineError,
						children: t("evolution.draftFailed", { error: suggestion.lastError })
					}),
					suggestion.status === "review" && suggestion.draftId !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DraftReview, {
						context,
						draftId: suggestion.draftId,
						model: props.model ?? null
					}),
					suggestion.status === "adopted" && view.skill !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: css.skSuccess,
						children: [
							t("evolution.adopted"),
							" ",
							view.skillInCatalog !== false && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: css.skLink,
								onClick: () => context.navigate({
									tab: "skills",
									skillKey: view.skill.key
								}),
								children: [t("evolution.openSkill"), " ›"]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.skFolds,
						children: [view.skill !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Fold, {
							title: t("evolution.currentSkill"),
							meta: t(`root.${view.skill.root}`),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: css.skMuted,
								children: view.skill.path
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillMarkdown, { body: view.skill.body })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fold, {
							title: t("evolution.evidence"),
							meta: t("evolution.evidenceMeta", {
								conversations: references.length,
								steps: cited
							}),
							children: references.map((reference, index) => {
								const trajectory = trajectories.get(reference.trajectoryId);
								if (trajectory === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") }, index);
								if (trajectory === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: css.skMuted,
									children: t("evolution.evidenceGone")
								}, index);
								const marked = new Set(reference.steps);
								const steps = trajectory.steps.filter((step) => [...marked].some((value) => Math.abs(value - step.index) <= 1));
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: css.skEvidence,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: trajectory.sessionTitle ?? trajectory.sessionId.slice(0, 8) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: relative(t, trajectory.createdAt) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: css.skLink,
											onClick: () => context.navigate({
												tab: "evolution",
												filter: "evidence",
												trajectoryId: trajectory.id,
												steps: reference.steps
											}),
											children: [t("evolution.openRecord"), " ›"]
										})
									] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StepTimeline, {
										compact: true,
										steps,
										annotations: trajectory.annotations,
										highlight: marked
									})]
								}, index);
							})
						})]
					})
				]
			});
		}
		/**
		* Average scores of a draft and its baseline over the cases both graded: a
		* case that could not run on either side says nothing about the change.
		*/
		function compareRuns(baseline, candidate) {
			if (baseline?.status !== "completed" || candidate?.status !== "completed") return { excluded: 0 };
			const graded = (run) => new Map(run.results.filter((result) => result.verdict !== "error").map((result) => [result.caseId, result.score]));
			const base = graded(baseline);
			const next = graded(candidate);
			const shared = [...next.keys()].filter((id) => base.has(id));
			const excluded = new Set([...baseline.results, ...candidate.results].map((result) => result.caseId)).size - shared.length;
			if (shared.length === 0) return { excluded };
			const mean = (scores) => shared.reduce((sum, id) => sum + scores.get(id), 0) / shared.length;
			return {
				baseline: mean(base),
				candidate: mean(next),
				excluded
			};
		}
		/** Where adopting may write a new skill: the user's own DSH skills, or the project's. */
		const NEW_SKILL_ROOTS = ["user-dsh", "project-dsh"];
		/**
		* A draft under review: what changed and why, the backtest as one line that
		* opens to its cases, and the diff. Adopt and discard sit with its title;
		* editing and redrafting with a note wait behind its menu.
		*/
		function DraftReview(props) {
			const t = useT();
			const { context } = props;
			const route = props.model === null || props.model === void 0 ? {} : {
				provider: props.model.provider,
				model: props.model.model
			};
			const [view, setView] = (0, react.useState)(null);
			const [cases, setCases] = (0, react.useState)(void 0);
			const [editing, setEditing] = (0, react.useState)(null);
			const [redrafting, setRedrafting] = (0, react.useState)(null);
			const [root, setRoot] = (0, react.useState)("user-dsh");
			const [roots, setRoots] = (0, react.useState)(["user-dsh"]);
			const [details, setDetails] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [confirmAdopt, setConfirmAdopt] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let active = true;
				context.client.draft(props.draftId).then((value) => {
					if (!active) return;
					setView(value);
					if (value.draft.targetRoot !== void 0) setRoot(value.draft.targetRoot);
					if (value.draft.action === "create") context.client.catalog().then((catalog) => {
						if (active) setRoots(NEW_SKILL_ROOTS.filter((kind) => catalog.roots.some((entry) => entry.kind === kind)));
					}).catch(() => void 0);
					context.client.cases(value.draft.skillName).then((list) => {
						if (active) setCases(list.filter((entry) => entry.enabled).length);
					}).catch(() => void 0);
				}).catch(context.fail);
				return () => {
					active = false;
				};
			}, [
				context.client,
				props.draftId,
				context.revision
			]);
			if (view === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") });
			const { draft } = view;
			const latest = [...view.runs].reverse();
			const candidate = latest.find((run) => run.target.kind === "draft" && run.target.draftId === draft.id);
			const baseline = latest.find((run) => run.target.kind !== "draft");
			const { baseline: baselineScore, candidate: candidateScore, excluded } = compareRuns(baseline, candidate);
			const regressed = candidateScore !== void 0 && baselineScore !== void 0 && candidateScore < baselineScore;
			const running = view.runs.some((run) => run.status === "running");
			const act = async (operation, after) => {
				setBusy(true);
				try {
					await operation();
					after?.();
					context.refresh();
				} catch (error) {
					context.fail(error);
					context.refresh();
				} finally {
					setBusy(false);
				}
			};
			const adopt = () => act(async () => {
				const result = await context.client.adoptDraft(draft.id, draft.action === "create" ? root : void 0);
				context.notice(t("draft.adopted", { name: result.skill.name }));
			}, () => setConfirmAdopt(false));
			const backtest = () => act(async () => {
				await context.client.backtest({
					skillName: draft.skillName,
					target: {
						kind: "draft",
						draftId: draft.id
					}
				});
				const started = await context.client.backtest({
					skillName: draft.skillName,
					target: {
						kind: draft.action === "update" ? "current" : "none",
						...draft.action === "update" ? { draftId: draft.id } : {}
					}
				});
				await context.client.linkRun(draft.id, started.runId);
			});
			const redraft = (note, backtest = false) => act(() => context.client.generateDraft({
				...backtest ? { backtest: true } : {},
				draftId: draft.id,
				...draft.suggestionId === void 0 ? {} : { suggestionId: draft.suggestionId },
				guidance: note,
				...route
			}), () => setRedrafting(null));
			const ready = draft.status === "ready";
			const originalAvailable = draft.action !== "update" || view.base !== void 0;
			const progress = (run) => run === void 0 ? 0 : run.progress.done;
			const total = (candidate?.progress.total ?? 0) + (baseline?.progress.total ?? 0);
			const results = /* @__PURE__ */ new Map();
			for (const result of baseline?.results ?? []) results.set(result.caseId, {
				title: result.title,
				base: result
			});
			for (const result of candidate?.results ?? []) results.set(result.caseId, {
				...results.get(result.caseId),
				title: result.title,
				next: result
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: css.skDraft,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: css.skSectionHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h4", { children: [t("draft.title"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: stamp(draft.updatedAt) })] }), ready && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							draft.action === "create" && roots.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
								inline: true,
								size: "sm",
								label: t("draft.writeTo"),
								value: root,
								disabled: busy,
								onChange: setRoot,
								options: roots.map((kind) => ({
									value: kind,
									label: t(`root.${kind}`)
								}))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								disabled: !context.writable || busy || editing !== null || running || view.conflict !== void 0 || !originalAvailable || view.base?.readOnly === true,
								onClick: () => regressed ? setConfirmAdopt(true) : void adopt(),
								children: t("draft.adopt")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								disabled: !context.writable || busy,
								onClick: () => void act(() => context.client.discardDraft(draft.id)),
								children: t("draft.discard")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MoreMenu, {
								label: t("common.more"),
								disabled: !context.writable || busy,
								onSelect: (id) => id === "edit" ? setEditing(draft.content) : setRedrafting(""),
								items: [{
									id: "edit",
									label: t("draft.edit")
								}, ...originalAvailable && !view.base?.readOnly && context.client.canAssist("skill-draft") ? [{
									id: "redraft",
									label: t("draft.redraft")
								}] : []]
							})
						] })]
					}),
					view.base?.readOnly && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.skWarn,
						children: t("skills.linkedReadOnly")
					}),
					!originalAvailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.skWarn,
						children: t(view.resolution === "origin-unavailable" ? "evolution.originUnavailable" : "evolution.skillGone")
					}),
					view.conflict !== void 0 && ready && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.skWarn,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t(view.conflict === "target-exists" ? "draft.targetExists" : "draft.baseChanged") }), originalAvailable && !view.base?.readOnly && context.client.canAssist("skill-draft") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							disabled: !context.writable || busy || running,
							onClick: () => void redraft(t("draft.refreshGuidance"), true),
							children: t("draft.regenerate")
						})]
					}),
					draft.notes !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Clamp, { text: draft.notes }),
					draft.changes.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MoreList, {
						items: draft.changes,
						shown: 3
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.skBacktest,
						"data-tone": regressed ? "bad" : candidateScore !== void 0 && baselineScore !== void 0 && candidateScore > baselineScore ? "good" : void 0,
						children: [
							running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("draft.backtesting", {
								done: progress(candidate) + progress(baseline),
								total
							}) }) : candidateScore !== void 0 && baselineScore !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: css.skBacktestLine,
								"aria-expanded": details,
								onClick: () => setDetails((value) => !value),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("draft.backtest") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
										baseline?.target.kind === "none" ? t("draft.withoutSkill") : t("draft.current"),
										" ",
										points(baselineScore),
										" → ",
										t("draft.candidate"),
										" ",
										points(candidateScore)
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: candidateScore === baselineScore ? t("draft.same") : `${candidateScore > baselineScore ? "+" : "−"}${Math.round(Math.abs(candidateScore - baselineScore) * 100)}` })
								]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.skMuted,
								children: cases === 0 ? t("draft.noTests") : view.runs.length === 0 ? t("draft.notTested") : t("draft.notComparable")
							}),
							running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								disabled: !context.writable || busy,
								onClick: () => void act(async () => {
									for (const run of view.runs.filter((item) => item.status === "running")) await context.client.cancelRun(run.id);
								}),
								children: t("draft.cancelBacktest")
							}),
							!running && (candidate?.status === "interrupted" || baseline?.status === "interrupted") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								role: "status",
								children: t("draft.interrupted")
							}),
							!running && (cases ?? 0) > 0 && context.client.canAssist("skill-backtest") && ready && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								disabled: !context.writable || busy || !originalAvailable,
								onClick: () => void backtest(),
								children: view.runs.length === 0 ? t("draft.runBacktest") : t("draft.rerun")
							})
						]
					}),
					excluded > 0 && !running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.skMuted,
						children: t("draft.excluded", { count: excluded })
					}),
					details && results.size > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						className: css.skTable,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("tests.case") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: baseline?.target.kind === "none" ? t("draft.withoutSkill") : t("draft.current") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("draft.candidate") })
						] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: [...results.entries()].map(([id, row]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: row.title }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: row.base === void 0 ? "—" : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
								tone: row.base.verdict === "pass" ? "success" : row.base.verdict === "error" ? "danger" : "warning",
								children: t(`run.verdict.${row.base.verdict}`)
							}) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [row.next === void 0 ? "—" : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
								tone: row.next.verdict === "pass" ? "success" : row.next.verdict === "error" ? "danger" : "warning",
								children: t(`run.verdict.${row.next.verdict}`)
							}), row.next?.checks.filter((check) => !check.pass).slice(0, 1).map((check) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: check.note }, check.checkId))] })
						] }, id)) })]
					}),
					details && candidate !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fold, {
						title: t("draft.runDetail"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RunDetail, { run: candidate })
					}),
					redrafting !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.skComposer,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("draft.redraftNote") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								rows: 2,
								value: redrafting,
								autoFocus: true,
								placeholder: t("draft.redraftPlaceholder"),
								onChange: (event) => setRedrafting(event.target.value)
							})] }),
							draft.guidance.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: css.skGuidance,
								children: draft.guidance.map((text, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: text }, index))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								onClick: () => setRedrafting(null),
								children: t("common.cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								disabled: busy || redrafting.trim() === "",
								onClick: () => void redraft(redrafting.trim()),
								children: t("draft.redraftStart")
							})] })
						]
					}),
					editing === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DiffBlock, {
						maxLines: 40,
						labels: diffLabels(t),
						diffs: [{
							path: `${draft.skillName}/SKILL.md`,
							oldText: view.base?.content ?? null,
							newText: draft.content
						}]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.skComposer,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							className: css.skEditor,
							spellCheck: false,
							value: editing,
							onChange: (event) => setEditing(event.target.value),
							"aria-label": "SKILL.md"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => setEditing(null),
							children: t("common.cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							size: "sm",
							disabled: busy || editing === draft.content,
							onClick: () => void act(() => context.client.updateDraft(draft.id, editing), () => setEditing(null)),
							children: t("common.save")
						})] })]
					}),
					confirmAdopt && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Confirm, {
						title: t("draft.adoptAnyway"),
						body: t("draft.regressed"),
						confirmLabel: t("draft.adopt"),
						busy,
						onClose: () => setConfirmAdopt(false),
						onConfirm: () => void adopt()
					})
				]
			});
		}
		function AutoAdoptionHistory(props) {
			const t = useT();
			const latest = props.events[props.events.length - 1];
			const describe = (event) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				t(`evolution.auto.stage.${event.stage}`),
				event.attempt > 0 ? ` · ${t("evolution.auto.attempt", { count: event.attempt })}` : "",
				event.reason === void 0 ? "" : ` · ${t(`evolution.auto.reason.${event.reason}`)}`,
				event.baselineScore === void 0 || event.draftScore === void 0 ? "" : ` · ${t("evolution.auto.scores", {
					baseline: points(event.baselineScore),
					draft: points(event.draftScore)
				})}`,
				event.detail === void 0 ? "" : ` · ${event.detail}`
			] });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				"aria-label": t("evolution.auto.title"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("evolution.auto.title") }),
					" · ",
					describe(latest)
				] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fold, {
					title: t("evolution.auto.history"),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", { children: props.events.map((event, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
						stamp(event.at),
						" · ",
						describe(event)
					] }, index)) })
				})]
			});
		}
		//#endregion
		//#region src/contracts.ts
		const SKILL_ROOT_KINDS = [
			"project-dsh",
			"project-agents",
			"user-dsh",
			"user-agents"
		];
		Object.freeze({
			allowCreate: true,
			allowUpdate: true,
			minConfidence: .6,
			expiryDays: 7,
			maxPendingPerSession: 5
		});
		//#endregion
		//#region src/fence.ts
		/** The same fence rules as `dsh-skill-filesystem`: `---` on the first line and on a later line of its own. */
		function splitFrontmatter(raw) {
			const firstLineEnd = raw.indexOf("\n");
			if (firstLineEnd < 0 || raw.slice(0, firstLineEnd).replace(/\r$/u, "") !== "---") return void 0;
			const start = firstLineEnd + 1;
			let lineStart = start;
			while (lineStart <= raw.length) {
				const next = raw.indexOf("\n", lineStart);
				const lineEnd = next < 0 ? raw.length : next;
				if (raw.slice(lineStart, lineEnd).replace(/\r$/u, "") === "---") return {
					frontmatter: raw.slice(start, lineStart),
					body: raw.slice(next < 0 ? raw.length : next + 1),
					frontmatterStart: start,
					frontmatterEnd: lineStart
				};
				if (next < 0) return void 0;
				lineStart = next + 1;
			}
		}
		//#endregion
		//#region src/source-kind.ts
		/** A GitHub account: letters, digits and single hyphens, never a dot, so `example.com/skills` stays a website. */
		const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u;
		const NAME = /^[A-Za-z0-9_.-]+$/u;
		const REF = /^[A-Za-z0-9_./-]{1,200}$/u;
		function githubUrl(location) {
			const base = `https://github.com/${location.repo}`;
			if (location.ref === void 0 && location.path === "") return base;
			return `${base}/tree/${location.ref ?? "HEAD"}${location.path === "" ? "" : "/" + location.path}`;
		}
		/** Read a GitHub location back from what {@link githubUrl} stored, or from what a user pasted. */
		function parseGithub(input) {
			const text = input.trim().replace(/\.git$/u, "").replace(/\/+$/u, "");
			const short = /^([^/\s]+)\/([^/\s]+)$/u.exec(text);
			if (short !== null && !/^https?:/iu.test(text)) return OWNER.test(short[1]) && NAME.test(short[2]) && !/\.json$/iu.test(short[2]) ? {
				repo: `${short[1]}/${short[2]}`,
				path: ""
			} : void 0;
			let url;
			try {
				url = new URL(text);
			} catch {
				return;
			}
			if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return void 0;
			const [owner, repo, mode, ref, ...rest] = url.pathname.split("/").filter(Boolean);
			if (owner === void 0 || repo === void 0 || !OWNER.test(owner) || !NAME.test(repo)) return void 0;
			if (mode === void 0) return {
				repo: `${owner}/${repo}`,
				path: ""
			};
			if (mode !== "tree" && mode !== "blob" || ref === void 0 || !REF.test(ref)) return {
				repo: `${owner}/${repo}`,
				path: ""
			};
			const parts = mode === "blob" ? rest.slice(0, -1) : rest;
			if (parts.some((part) => part === ".." || part === ".")) return void 0;
			return {
				repo: `${owner}/${repo}`,
				ref,
				path: parts.join("/")
			};
		}
		function isAbsolutePath(text) {
			return text.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(text) || text.startsWith("file://");
		}
		/**
		* What a pasted string names, without fetching it: a GitHub repository
		* (`owner/repo`, a github.com URL, or a skills.sh page of one), a JSON file
		* by URL, a website that may publish an Agent Skills index, or an absolute
		* path to a local catalog. Undefined when it is none of these.
		*/
		function detectSource(input) {
			const text = input.trim();
			if (text === "") return void 0;
			if (isAbsolutePath(text)) return /\.json$/iu.test(text) ? {
				kind: "catalog",
				location: text,
				label: text.split(/[\\/]/u).at(-1)
			} : void 0;
			const github = parseGithub(text);
			if (github !== void 0) return {
				kind: "github",
				location: githubUrl(github),
				label: github.path === "" ? github.repo : `${github.repo}/${github.path}`
			};
			let url;
			try {
				url = new URL(/^https?:\/\//iu.test(text) ? text : `https://${text}`);
			} catch {
				return;
			}
			if (url.protocol !== "https:" && url.protocol !== "http:") return void 0;
			if (!url.hostname.includes(".")) return void 0;
			if (url.hostname === "skills.sh" || url.hostname === "www.skills.sh") {
				const [owner, repo] = url.pathname.split("/").filter(Boolean);
				if (owner !== void 0 && repo !== void 0 && OWNER.test(owner) && NAME.test(repo)) return {
					kind: "github",
					location: `https://github.com/${owner}/${repo}`,
					label: `${owner}/${repo}`
				};
				return;
			}
			const location = url.toString().replace(/\/$/u, "");
			if (/\.json$/iu.test(url.pathname)) return {
				kind: "json",
				location,
				label: url.pathname.split("/").at(-1)
			};
			return {
				kind: "well-known",
				location,
				label: url.host + url.pathname.replace(/\/$/u, "")
			};
		}
		//#endregion
		//#region src/client/market-page.tsx
		function text(value, language) {
			if (value === void 0) return "";
			if (typeof value === "string") return value;
			return (language.startsWith("zh") ? value["zh-CN"] ?? value.en : value.en ?? value["zh-CN"]) ?? "";
		}
		function size$1(bytes) {
			return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
		}
		/** One field of a `SKILL.md` frontmatter, plain or folded, without a YAML parser in the page. */
		function frontmatterField(content, key) {
			const split = splitFrontmatter(content);
			if (split === void 0) return void 0;
			const lines = split.frontmatter.split(/\r?\n/u);
			const index = lines.findIndex((line) => line.startsWith(`${key}:`));
			if (index === -1) return void 0;
			const first = lines[index].slice(key.length + 1).trim();
			if (/^[>|][+-]?$/u.test(first)) {
				const block = [];
				for (const line of lines.slice(index + 1)) {
					if (!/^\s/u.test(line)) break;
					block.push(line.trim());
				}
				return block.join(" ").trim() || void 0;
			}
			return first.replace(/^(['"])(.*)\1$/u, "$2").trim() || void 0;
		}
		const STATE_TONE = {
			installed: "success",
			update: "info",
			modified: "warning",
			conflict: "quiet",
			available: "outline"
		};
		const SEARCH_DELAY_MS = 300;
		/** The id a market skill is previewed and installed by: its index id when a search found it. */
		function itemKey(item) {
			return item.source.type === "indexed" ? item.source.id : item.name;
		}
		function MarketPage(props) {
			const t = useT();
			const language = (0, dsh_mnemon_client.useLocale)();
			const { context } = props;
			const [view, setView] = (0, react.useState)(null);
			const [query, setQuery] = (0, react.useState)("");
			const [category, setCategory] = (0, react.useState)("");
			const [refreshing, setRefreshing] = (0, react.useState)(false);
			const [sourcesOpen, setSourcesOpen] = (0, react.useState)(false);
			const [open, setOpen] = (0, react.useState)(null);
			const [remote, setRemote] = (0, react.useState)({
				query: "",
				loading: false
			});
			const [adding, setAdding] = (0, react.useState)(false);
			const refreshed = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				let active = true;
				context.client.market().then((value) => {
					if (!active) return;
					setView(value);
					if (!refreshed.current && value.stale.length > 0 && context.writable) {
						refreshed.current = true;
						setRefreshing(true);
						context.client.refreshMarket(value.stale).then(() => context.client.market()).then((next) => {
							if (active) setView(next);
						}).catch(() => void 0).finally(() => {
							if (active) setRefreshing(false);
						});
					}
				}).catch(context.fail);
				return () => {
					active = false;
				};
			}, [context.client, context.revision]);
			const needle = query.trim();
			const index = view?.registries.find((registry) => registry.kind === "search" && registry.enabled);
			(0, react.useEffect)(() => {
				if (needle.length < 2 || index === void 0) {
					setRemote({
						query: "",
						loading: false
					});
					return;
				}
				let active = true;
				setRemote((current) => ({
					...current,
					loading: true
				}));
				const timer = setTimeout(() => {
					context.client.searchMarket(needle).then((result) => {
						if (active) setRemote({
							query: needle,
							result,
							loading: false
						});
					}).catch((reason) => {
						if (active) setRemote({
							query: needle,
							result: {
								query: needle,
								items: [],
								error: errorText(reason)
							},
							loading: false
						});
					});
				}, SEARCH_DELAY_MS);
				return () => {
					active = false;
					clearTimeout(timer);
				};
			}, [
				needle,
				index?.id,
				context.client,
				context.revision
			]);
			const items = (0, react.useMemo)(() => {
				const lower = needle.toLowerCase();
				return (view?.items ?? []).filter((item) => (category === "" || item.category === category) && (lower === "" || [
					item.name,
					text(item.title, language),
					text(item.description, language),
					item.author ?? ""
				].some((value) => value.toLowerCase().includes(lower))));
			}, [
				view,
				needle,
				category,
				language
			]);
			const detected = (0, react.useMemo)(() => {
				const found = detectSource(query);
				if (found === void 0 || found.kind !== "github" && !/^(?:https?:\/\/|\/|[A-Za-z]:[\\/])/u.test(needle)) return void 0;
				return view?.registries.some((registry) => registry.location === found.location) === true ? void 0 : found;
			}, [
				query,
				needle,
				view
			]);
			if (view === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") });
			const registryName = (id) => sourceName(view.registries.find((registry) => registry.id === id), language, t) || id;
			const refresh = async () => {
				setRefreshing(true);
				try {
					await context.client.refreshMarket();
					context.refresh();
				} catch (error) {
					context.fail(error);
				} finally {
					setRefreshing(false);
				}
			};
			const addDetected = async (source) => {
				setAdding(true);
				try {
					const added = await context.client.addRegistry(source.location);
					context.notice(t("sources.added", {
						name: sourceName(added, language, t),
						count: added.entries
					}));
					setQuery("");
					context.refresh();
				} catch (error) {
					context.fail(error);
				} finally {
					setAdding(false);
				}
			};
			const searching = needle.length >= 2 && index !== void 0;
			const remoteItems = remote.result?.items ?? [];
			const card = (item, position) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarketCard, {
				item,
				position,
				language,
				writable: context.writable,
				footnote: item.source.type === "indexed" ? void 0 : item.author ?? registryName(item.registryId),
				onOpen: () => setOpen(item)
			}, `${item.registryId}/${itemKey(item)}`);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.skMarket,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: css.skMarketBar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SearchField, {
								label: t("market.search"),
								placeholder: t("market.searchPlaceholder"),
								value: query,
								onChange: (event) => setQuery(event.target.value)
							}),
							view.categories.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
								size: "sm",
								hideLabel: true,
								label: t("market.category"),
								value: category,
								onChange: setCategory,
								options: [{
									value: "",
									label: t("market.allCategories")
								}, ...view.categories.map((entry) => ({
									value: entry.id,
									label: text(entry.label, language)
								}))]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								onClick: () => setSourcesOpen(true),
								children: t("market.sources", { count: view.registries.filter((registry) => registry.enabled).length })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: css.skIconButton,
								disabled: refreshing || !context.writable,
								"data-busy": refreshing ? "" : void 0,
								onClick: () => void refresh(),
								"aria-label": t("market.refresh"),
								title: t("market.refresh"),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 16 })
							})
						]
					}),
					detected !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.skMarketAdd,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, { kind: detected.kind }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("market.addAsSource", {
								kind: t(`sources.detected.${detected.kind}`),
								label: detected.label
							}) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								disabled: adding || !context.writable,
								onClick: () => void addDetected(detected),
								children: adding ? t("sources.adding") : t("sources.addAs")
							})
						]
					}),
					searching ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [items.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: css.skMarketSection,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h6", {
							className: css.skCaption,
							children: t("market.listed", { count: items.length })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: css.skMarketGrid,
							children: items.map(card)
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: css.skMarketSection,
						"aria-busy": remote.loading || void 0,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h6", {
							className: css.skCaption,
							children: t("market.indexed", { count: remoteItems.length })
						}), remote.result === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("market.searching") }) : remote.result.error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.skMuted,
							children: t("market.searchFailed", { error: remote.result.error })
						}) : remoteItems.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.skMuted,
							children: t("market.indexEmpty")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: css.skMarketGrid,
							"data-busy": remote.loading ? "" : void 0,
							children: remoteItems.map(card)
						})]
					})] }) : items.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
						glyph: "⌕",
						title: t("market.empty"),
						children: t("market.emptyBody")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: css.skMarketGrid,
						children: items.map(card)
					}),
					open !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarketDetail, {
						context,
						item: open,
						registryName: registryName(open.registryId),
						onClose: () => setOpen(null)
					}),
					sourcesOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourcesDialog, {
						context,
						view,
						onClose: () => setSourcesOpen(false)
					})
				]
			});
		}
		/** One skill of the market: what it is, where it comes from, and installing it or its state. */
		function MarketCard(props) {
			const t = useT();
			const { item } = props;
			const indexed = item.source.type === "indexed";
			const title = text(item.title, props.language) || item.name;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: css.skMarketCard,
				"data-state": item.state,
				"data-indexed": indexed ? "" : void 0,
				style: { animationDelay: `${Math.min(props.position, 12) * 18}ms` },
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: css.skMarketOpen,
					onClick: props.onOpen,
					"aria-label": t("market.preview", { name: item.name }),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillIcon, {
						name: item.name,
						category: item.category
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: indexed ? item.origin : item.name })] })] }), !indexed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: text(item.description, props.language) })]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", { children: [indexed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: css.skMarketStat,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutlineRegular, { size: 12 }), t("market.installs", { count: compactCount(item.installs ?? 0, props.language) })]
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.footnote }), item.state === "available" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					disabled: !props.writable,
					onClick: props.onOpen,
					children: t("market.install")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
					tone: STATE_TONE[item.state],
					children: t(`market.state.${item.state}`)
				})] })]
			});
		}
		/** Reviewers' verdicts on a skill, worst first, each a dot and the reviewer's name. */
		function Audits(props) {
			const t = useT();
			if (props.audits.length === 0) return null;
			const rank = {
				fail: 0,
				warn: 1,
				pass: 2
			};
			const sorted = [...props.audits].sort((a, b) => rank[a.status] - rank[b.status]);
			const concern = sorted.find((audit) => audit.status !== "pass" && audit.summary !== void 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.skAudits,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: css.skAuditsLabel,
					children: t("market.audits")
				}), sorted.map((audit) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: css.skAudit,
					"data-status": audit.status,
					title: audit.summary,
					children: [t(`market.audit.${audit.status}`), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: audit.provider })]
				}, audit.provider))] }), concern?.summary !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Clamp, {
					text: concern.summary,
					lines: 2
				})]
			});
		}
		function MarketDetail(props) {
			const t = useT();
			const language = (0, dsh_mnemon_client.useLocale)();
			const { context, item } = props;
			const indexed = item.source.type === "indexed";
			const [preview, setPreview] = (0, react.useState)(null);
			const [previewError, setPreviewError] = (0, react.useState)(null);
			const [root, setRoot] = (0, react.useState)("user-dsh");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let active = true;
				context.client.marketPreview(item.registryId, itemKey(item)).then((value) => {
					if (active) setPreview(value);
				}).catch((reason) => {
					if (active) setPreviewError(errorText(reason));
				});
				return () => {
					active = false;
				};
			}, [
				context.client,
				item.registryId,
				item.name
			]);
			const install = async () => {
				setBusy(true);
				setError(null);
				try {
					const result = await context.client.installMarket({
						registryId: item.registryId,
						name: itemKey(item),
						root,
						...item.state === "modified" ? { overwrite: true } : {}
					});
					context.notice(t(result.updated ? "market.updated" : "market.installed", { name: result.skill.name }));
					context.refresh();
					props.onClose();
				} catch (reason) {
					setError(errorText(reason));
				} finally {
					setBusy(false);
				}
			};
			const canInstall = item.state === "available" || item.state === "update" || item.state === "modified";
			const body = preview === null ? void 0 : splitFrontmatter(preview.content)?.body ?? preview.content;
			const description = text(item.description, language) || (preview === null ? "" : frontmatterField(preview.content, "description") ?? "");
			const license = item.license ?? (preview === null ? void 0 : frontmatterField(preview.content, "license"));
			const meta = [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: indexed ? item.origin : props.registryName }, "from"),
				...item.version === void 0 ? [] : [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("market.version", { version: item.version }) }, "version")],
				...item.installedVersion === void 0 ? [] : [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("market.installedVersion", { version: item.installedVersion }) }, "installed")],
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: license ?? t("market.upstreamLicense") }, "license"),
				...item.installs === void 0 ? [] : [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("market.installs", { count: compactCount(item.installs, language) }) }, "installs")]
			];
			const homepage = preview?.homepage ?? item.homepage;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SidebarModal, {
				wide: true,
				title: text(item.title, language) || item.name,
				description,
				busy,
				onClose: props.onClose,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.skFormError,
						children: error
					}),
					item.state === "available" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
						size: "sm",
						inline: true,
						label: t("market.installTo"),
						value: root,
						onChange: setRoot,
						options: SKILL_ROOT_KINDS.map((kind) => ({
							value: kind,
							label: t(`root.${kind}`)
						}))
					}),
					item.skillKey !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						onClick: () => {
							props.onClose();
							context.navigate({
								tab: "skills",
								skillKey: item.skillKey
							});
						},
						children: t("market.open")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						onClick: props.onClose,
						children: t("common.close")
					}),
					canInstall && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						disabled: busy || !context.writable || preview === null && previewError === null,
						onClick: () => void install(),
						children: busy ? t("market.installing") : t(item.state === "modified" ? "market.overwrite" : item.state === "update" ? "market.update" : "market.install")
					})
				] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.skMarketDetail,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.skMarketMeta,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.skMeta,
								children: meta
							}), homepage !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
								className: css.skLink,
								href: homepage,
								target: "_blank",
								rel: "noreferrer",
								children: [t("market.viewSource"), " ↗"]
							})]
						}),
						preview?.audits !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Audits, { audits: preview.audits }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.skWarn,
							children: item.state === "modified" ? t("market.overwriteHint") : t("market.trust")
						}),
						previewError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.inlineError,
							children: previewError
						}),
						preview === null && previewError === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") }),
						preview !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							preview.partial === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: css.skMuted,
								children: t("market.partial")
							}),
							preview.files.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
								className: css.skProblems,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("market.files", {
									count: preview.files.length,
									size: size$1(preview.totalBytes)
								}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: css.skResources,
									children: preview.files.slice(0, 40).map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: file.path }, file.path))
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillMarkdown, { body: body ?? "" })
						] })
					]
				})
			});
		}
		const KIND_ICON = {
			catalog: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutlineRegular, { size }),
			json: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size }),
			github: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size }),
			"well-known": (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineRegular, { size }),
			search: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size })
		};
		function SourceIcon(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: css.skSourceIcon,
				"aria-hidden": "true",
				children: KIND_ICON[props.kind](16)
			});
		}
		/** How the page names a source: the built-in ones by role, the rest by what they call themselves, else where they live. */
		function sourceName(registry, language, t) {
			if (registry === void 0) return "";
			if (registry.kind === "search") return "skills.sh";
			if (registry.builtin) return t("sources.featured");
			return text(registry.name, language) || registry.location.replace(/^https?:\/\/(?:github\.com\/)?/u, "");
		}
		/** One line on a source: what kind it is, how many skills, how fresh; or why it failed. */
		function sourceMeta(t, registry) {
			if (registry.kind === "search") return t("sources.searchMeta");
			return [
				t(`sources.kind.${registry.kind}`),
				t("sources.entries", { count: registry.entries }),
				...registry.fetchedAt === void 0 ? [] : [t("sources.updated", { time: relative(t, registry.fetchedAt) })]
			].join(" · ");
		}
		/**
		* The market's sources: the built-in catalog and search index, and the ones
		* added — each with a switch, refreshed or removed from its menu — and one
		* field that adds a repository, a site or a JSON file, saying what it read.
		*/
		function SourcesDialog(props) {
			const t = useT();
			const language = (0, dsh_mnemon_client.useLocale)();
			const { context } = props;
			const [input, setInput] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const detected = (0, react.useMemo)(() => detectSource(input), [input]);
			const duplicate = detected !== void 0 && props.view.registries.some((registry) => registry.location === detected.location);
			const act = async (key, operation, after) => {
				setBusy(key);
				setError(null);
				try {
					await operation();
					after?.();
					context.refresh();
				} catch (reason) {
					setError(errorText(reason));
				} finally {
					setBusy(null);
				}
			};
			const add = (event) => {
				event.preventDefault();
				if (detected === void 0 || duplicate) return;
				act("add", async () => {
					const added = await context.client.addRegistry(detected.location);
					context.notice(t("sources.added", {
						name: sourceName(added, language, t),
						count: added.entries
					}));
				}, () => setInput(""));
			};
			const hint = input.trim() === "" ? t("sources.hint") : detected === void 0 ? t("sources.unknown") : duplicate ? t("sources.duplicate") : `${t(`sources.detected.${detected.kind}`)} · ${detected.label}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SidebarModal, {
				wide: true,
				title: t("sources.title"),
				busy: busy !== null,
				onClose: props.onClose,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: css.skFormError,
					children: error
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					onClick: props.onClose,
					children: t("sources.done")
				})] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.skSources,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: css.skSourceList,
							children: props.view.registries.map((registry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								"data-off": registry.enabled ? void 0 : "",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, { kind: registry.kind }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: css.skSourceText,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", {
											title: registry.location,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: sourceName(registry, language, t) }), registry.builtin && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
												tone: "quiet",
												children: t("sources.builtin")
											})]
										}), registry.error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", {
											title: registry.error,
											children: registry.error
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: sourceMeta(t, registry) })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: css.skSourceActions,
										children: [registry.kind !== "search" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MoreMenu, {
											label: t("common.more"),
											disabled: busy !== null || !context.writable,
											items: [{
												id: "refresh",
												label: t("sources.refresh")
											}, ...registry.builtin ? [] : [{
												id: "remove",
												label: t("sources.remove"),
												danger: true
											}]],
											onSelect: (id) => void act(registry.id, () => id === "refresh" ? context.client.refreshMarket([registry.id]) : context.client.removeRegistry(registry.id))
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
											checked: registry.enabled,
											label: t("sources.enabled", { name: sourceName(registry, language, t) }),
											disabled: busy !== null || !context.writable,
											onChange: (next) => void act(registry.id, () => context.client.toggleRegistry(registry.id, next))
										})]
									})
								]
							}, registry.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
							className: css.skSourceAdd,
							onSubmit: add,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									htmlFor: "skills-source-input",
									children: t("sources.addTitle")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: css.skInline,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
										id: "skills-source-input",
										value: input,
										placeholder: t("sources.placeholder"),
										autoComplete: "off",
										spellCheck: false,
										disabled: !context.writable,
										...detected === void 0 ? {} : { icon: KIND_ICON[detected.kind](16) },
										onChange: (event) => setInput(event.target.value)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										type: "submit",
										variant: "primary",
										size: "sm",
										disabled: detected === void 0 || duplicate || busy !== null || !context.writable,
										children: busy === "add" ? t("sources.adding") : t("sources.add")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: css.skSourceHint,
									"data-state": input.trim() === "" ? void 0 : detected === void 0 || duplicate ? "warn" : "ok",
									"aria-live": "polite",
									children: hint
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: css.skFormat,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("sources.formats") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: [
								"github",
								"well-known",
								"catalog"
							].map((kind) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, { kind }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(`sources.kind.${kind}`) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(`sources.format.${kind}`) })] })] }, kind)) })]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/skills-page.tsx
		function SkillsPage(props) {
			const t = useT();
			const { context, location } = props;
			const [catalog, setCatalog] = (0, react.useState)(null);
			const [query, setQuery] = (0, react.useState)("");
			const [selected, setSelected] = (0, react.useState)(location.skillKey);
			const [creating, setCreating] = (0, react.useState)(false);
			const [collapsed, setCollapsed] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			(0, react.useEffect)(() => {
				const root = catalog?.skills.find((skill) => skill.key === selected)?.root;
				if (root !== void 0) setCollapsed((current) => {
					if (!current.has(root)) return current;
					const next = new Set(current);
					next.delete(root);
					return next;
				});
			}, [
				catalog,
				selected,
				location.nonce
			]);
			(0, react.useEffect)(() => {
				let active = true;
				context.client.catalog().then((value) => {
					if (!active) return;
					setCatalog(value);
					setSelected((current) => current !== void 0 && value.skills.some((skill) => skill.key === current) ? current : value.skills.find((skill) => skill.shadowedBy === void 0)?.key);
				}).catch(context.fail);
				return () => {
					active = false;
				};
			}, [context.client, context.revision]);
			useLink(location.nonce, catalog !== null, () => {
				if (location.skillKey !== void 0) setSelected(location.skillKey);
				else if (location.skillName !== void 0) {
					const named = catalog?.skills.find((skill) => skill.name === location.skillName && skill.shadowedBy === void 0);
					if (named !== void 0) setSelected(named.key);
				}
			});
			const visible = (0, react.useMemo)(() => {
				const needle = query.trim().toLowerCase();
				return (catalog?.skills ?? []).filter((skill) => needle === "" || skill.name.includes(needle) || skill.description.toLowerCase().includes(needle));
			}, [catalog, query]);
			if (catalog === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") });
			const groups = catalog.roots.map((root) => ({
				root,
				skills: visible.filter((skill) => skill.root === root.kind)
			}));
			const current = catalog.skills.find((skill) => skill.key === selected);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${css.skSplit} ${css.skSkillsSplit}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
						className: css.skList,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
								className: css.skListBar,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SearchField, {
									label: t("skills.search"),
									placeholder: t("skills.search"),
									value: query,
									onChange: (event) => setQuery(event.target.value)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									disabled: !context.writable,
									onClick: () => setCreating(true),
									children: t("skills.new")
								})]
							}),
							catalog.skills.length > 0 && visible.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: css.skListNote,
								children: t("skills.noMatch")
							}),
							groups.filter((group) => group.skills.length > 0).map((group) => {
								const expanded = query.trim() !== "" || !collapsed.has(group.root.kind);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: css.skListGroup,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h5", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: css.skGroupToggle,
										"aria-expanded": expanded,
										disabled: query.trim() !== "",
										title: group.root.path,
										onClick: () => setCollapsed((current) => {
											const next = new Set(current);
											if (next.has(group.root.kind)) next.delete(group.root.kind);
											else next.add(group.root.kind);
											return next;
										}),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												children: expanded ? "▾" : "▸"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [t(`root.${group.root.kind}`), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: group.root.path })] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: group.skills.length })
										]
									}) }), expanded && group.skills.map((skill) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillRow, {
										context,
										skill,
										stats: catalog.stats[skill.name],
										selected: selected === skill.key,
										onSelect: () => setSelected(skill.key)
									}, skill.key))]
								}, group.root.kind);
							}),
							catalog.problems.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
								className: css.skProblems,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("skills.problems", { count: catalog.problems.length }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: catalog.problems.map((problem) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
									title: problem.path,
									children: problem.path.split(/[\\/]/u).slice(-2).join("/")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: problem.reason })] }, problem.path)) })]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: css.skPane,
						children: catalog.skills.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
							glyph: "✦",
							title: t("skills.empty"),
							action: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								disabled: !context.writable,
								onClick: () => setCreating(true),
								children: t("skills.new")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								onClick: () => context.navigate({ tab: "market" }),
								children: t("skills.browseMarket")
							})] }),
							children: t("skills.emptyBody")
						}) : current === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
							glyph: "✦",
							title: t("skills.select"),
							children: t("skills.selectBody")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillDetail, {
							context,
							skillKey: current.key,
							stats: catalog.stats[current.name],
							onDeleted: () => setSelected(void 0)
						}, current.key)
					}, current?.key ?? "empty"),
					creating && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreateDialog, {
						context,
						roots: catalog.roots.map((root) => root.kind),
						onClose: () => setCreating(false),
						onCreated: (skill) => {
							setCreating(false);
							setSelected(skill.key);
							context.refresh();
						}
					})
				]
			});
		}
		function invocationOf(value) {
			return value.modelInvocable && value.userInvocable ? "both" : value.userInvocable ? "slash" : value.modelInvocable ? "model" : "off";
		}
		function switchesOf(value) {
			return {
				modelInvocable: value === "both" || value === "model",
				userInvocable: value === "both" || value === "slash"
			};
		}
		/**
		* One skill: its icon, name and description open it; "Use" (on hover or
		* focus) brings it into the conversation; the switch turns it on or off for
		* both the model and the / menu.
		*/
		function SkillRow(props) {
			const t = useT();
			const { skill, stats, context } = props;
			const [busy, setBusy] = (0, react.useState)(false);
			const invocation = invocationOf(skill.invocation);
			const on = invocation !== "off";
			const toggle = async (next) => {
				setBusy(true);
				try {
					await context.client.setInvocation(skill.key, switchesOf(next ? "both" : "off"), skill.hash);
					context.refresh();
				} catch (error) {
					context.fail(error);
				} finally {
					setBusy(false);
				}
			};
			const usable = on && skill.shadowedBy === void 0 && skill.invocation.userInvocable;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.skRow,
				"data-selected": props.selected ? "" : void 0,
				"data-shadowed": skill.shadowedBy === void 0 ? void 0 : "",
				"data-off": on ? void 0 : "",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: css.skRowMain,
					onClick: props.onSelect,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillIcon, { name: skill.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: css.skRowText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: skill.name }),
							skill.shadowedBy === void 0 && (stats?.open ?? 0) > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
								className: css.skDot,
								title: t("skills.waitingCount", { count: stats.open })
							}),
							(skill.linked || skill.readOnly) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
								tone: "quiet",
								children: t(skill.readOnly ? "skills.linked" : "skills.linkedEditable")
							}),
							skill.shadowedBy !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
								tone: "quiet",
								children: t("skills.shadowed")
							}) : on && invocation !== "both" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
								tone: "outline",
								children: t(`invocation.${invocation}Short`)
							})
						] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: skill.description })]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.skRowActions,
					children: [usable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						size: "sm",
						className: css.skUse,
						title: t("skills.useHint", { name: skill.name }),
						onClick: () => context.useSkill(skill.name),
						children: t("skills.use")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
						checked: on,
						label: t("skills.toggle", { name: skill.name }),
						disabled: busy || !context.writable || skill.readOnly === true,
						onChange: (next) => void toggle(next)
					})]
				})]
			});
		}
		function SkillDetail(props) {
			const t = useT();
			const { context, stats } = props;
			const [skill, setSkill] = (0, react.useState)(null);
			const [editing, setEditing] = (0, react.useState)(null);
			const [improving, setImproving] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const [comparing, setComparing] = (0, react.useState)(null);
			const [reload, setReload] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				let active = true;
				context.client.skill(props.skillKey).then((value) => {
					if (active) setSkill(value);
				}).catch(context.fail);
				return () => {
					active = false;
				};
			}, [
				context.client,
				props.skillKey,
				context.revision,
				reload
			]);
			if (skill === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") });
			const write = async (operation) => {
				setBusy(true);
				try {
					await operation();
					setReload((value) => value + 1);
					context.refresh();
				} catch (error) {
					context.fail(error);
				} finally {
					setBusy(false);
				}
			};
			const invocation = invocationOf(skill.invocation);
			const usable = invocation !== "off" && skill.shadowedBy === void 0 && skill.invocation.userInvocable;
			const testsMeta = [t("tests.count", { count: stats?.cases ?? 0 }), ...stats?.lastScore === void 0 ? [] : [t("tests.lastScore", { score: points(stats.lastScore) })]].join(" · ");
			const more = [...context.client.canAssist("skill-draft") ? [{
				id: "improve",
				label: t("skills.improve"),
				disabled: !context.writable || skill.readOnly === true
			}] : [], {
				id: "remove",
				label: t("skills.remove"),
				danger: true,
				disabled: !context.writable
			}];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: css.skDetail,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: css.skDetailHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: skill.name }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: skill.description }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: css.skMeta,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(`root.${skill.root}`) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
									title: skill.path,
									children: skill.path
								})]
							})
						] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.skDetailActions,
							children: [
								usable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									onClick: () => context.useSkill(skill.name),
									children: t("skills.use")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									disabled: !context.writable || busy || skill.readOnly === true,
									onClick: () => setEditing(skill.content),
									children: t("common.edit")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MoreMenu, {
									label: t("common.more"),
									items: more,
									onSelect: (id) => id === "improve" ? setImproving(true) : setDeleting(true)
								})
							]
						})]
					}),
					(skill.linked || skill.readOnly) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.skWarn,
						children: t(skill.readOnly ? "skills.linkedReadOnly" : "skills.linkedWritable")
					}),
					skill.shadowedBy === void 0 && (stats?.open ?? 0) > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: css.skCallout,
						onClick: () => context.navigate({
							tab: "evolution",
							filter: "pending",
							skillName: skill.name
						}),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("skills.waitingCount", { count: stats.open }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", { children: [t("common.view"), " ›"] })]
					}),
					skill.shadowedBy !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.skWarn,
						children: t("skills.shadowedBy", { key: skill.shadowedBy })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: css.skInvocation,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
							inline: true,
							size: "sm",
							label: t("invocation.label"),
							value: invocation,
							disabled: !context.writable || busy || skill.readOnly === true,
							options: [
								"both",
								"slash",
								"model",
								"off"
							].map((value) => ({
								value,
								label: t(`invocation.${value}`)
							})),
							onChange: (value) => void write(() => context.client.setInvocation(skill.key, switchesOf(value), skill.hash))
						})
					}),
					skill.whenToUse !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.skWhen,
						children: skill.whenToUse
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillMarkdown, { body: skill.body }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.skFolds,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FoldLink, {
								title: t("tests.title"),
								meta: testsMeta,
								onOpen: () => context.navigate({
									tab: "evals",
									skillName: skill.name
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fold, {
								title: t("versions.title"),
								meta: String(skill.versions.length),
								children: skill.versions.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: css.skMuted,
									children: t("versions.empty")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: css.skVersions,
									children: skill.versions.map((version) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
											tone: version.reason === "evolution" ? "success" : "outline",
											children: t(`versions.reason.${version.reason}`)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", {
											title: version.createdAt,
											children: stamp(version.createdAt)
										}),
										version.hash === skill.hash && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
											tone: "neutral",
											children: t("versions.current")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}),
										version.hash !== skill.hash && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "ghost",
											size: "sm",
											onClick: () => void context.client.version(skill.key, version.id).then(setComparing).catch(context.fail),
											children: t("versions.compare")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "ghost",
											size: "sm",
											disabled: !context.writable || busy || skill.readOnly === true,
											onClick: () => void write(() => context.client.restoreVersion(skill.key, version.id, skill.hash)),
											children: t("versions.restore")
										})] })
									] }, version.id))
								})
							}),
							(skill.resources?.length ?? 0) > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fold, {
								title: t("skills.files"),
								meta: String(skill.resources.length),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: css.skResources,
									children: skill.resources.map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: file }, file))
								})
							})
						]
					}),
					editing !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SidebarModal, {
						wide: true,
						title: t("editor.title", { name: skill.name }),
						busy,
						onClose: () => setEditing(null),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							onClick: () => setEditing(null),
							children: t("common.cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: busy || editing === skill.content,
							onClick: () => void write(async () => {
								await context.client.saveSkill(skill.key, editing, skill.hash);
								setEditing(null);
							}),
							children: busy ? t("common.saving") : t("common.save")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							className: css.skEditor,
							spellCheck: false,
							value: editing,
							onChange: (event) => setEditing(event.target.value),
							"aria-label": "SKILL.md"
						})
					}),
					improving && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ImproveDialog, {
						context,
						name: skill.name,
						onClose: () => setImproving(false)
					}),
					comparing !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SidebarModal, {
						wide: true,
						title: t("versions.compareTitle", { time: stamp(comparing.version.createdAt) }),
						onClose: () => setComparing(null),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DiffBlock, {
							maxLines: 400,
							labels: diffLabels(t),
							diffs: [{
								path: `${skill.name}/SKILL.md`,
								oldText: comparing.content,
								newText: skill.content
							}]
						})
					}),
					deleting && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Confirm, {
						danger: true,
						title: t("skills.removeTitle", { name: skill.name }),
						body: t("skills.removeBody"),
						confirmLabel: t("skills.remove"),
						busy,
						onClose: () => setDeleting(false),
						onConfirm: () => void (async () => {
							setBusy(true);
							try {
								await context.client.deleteSkill(skill.key, skill.hash);
								context.notice(t("skills.removed", { name: skill.name }));
								setDeleting(false);
								props.onDeleted();
								context.refresh();
							} catch (error) {
								context.fail(error);
							} finally {
								setBusy(false);
							}
						})()
					})
				]
			});
		}
		/** Ask for an improvement draft of a skill, with an optional note on what to change. */
		function ImproveDialog(props) {
			const t = useT();
			const [note, setNote] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const start = async () => {
				setBusy(true);
				setError(null);
				try {
					await props.context.client.generateDraft({
						skill: props.name,
						...note.trim() === "" ? {} : { guidance: note.trim() }
					});
					props.context.notice(t("skills.improveStarted"));
					props.onClose();
					props.context.refresh();
				} catch (reason) {
					setError(errorText(reason));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SidebarModal, {
				title: t("skills.improveTitle", { name: props.name }),
				busy,
				onClose: props.onClose,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.skFormError,
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						onClick: props.onClose,
						children: t("common.cancel")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						disabled: busy,
						onClick: () => void start(),
						children: t("skills.improveStart")
					})
				] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: css.skForm,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("skills.improveNote"),
						children: (control) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							...control,
							rows: 3,
							value: note,
							placeholder: t("skills.improvePlaceholder"),
							onChange: (event) => setNote(event.target.value)
						})
					})
				})
			});
		}
		function CreateDialog(props) {
			const t = useT();
			const [name, setName] = (0, react.useState)("");
			const [description, setDescription] = (0, react.useState)("");
			const [root, setRoot] = (0, react.useState)(props.roots.includes("user-dsh") ? "user-dsh" : props.roots[0] ?? "user-dsh");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const valid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name) && name.length <= 64 && description.trim() !== "";
			const submit = async () => {
				setBusy(true);
				setError(null);
				try {
					props.onCreated(await props.context.client.createSkill({
						name,
						description: description.trim(),
						root
					}));
				} catch (reason) {
					setError(errorText(reason));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SidebarModal, {
				title: t("create.title"),
				busy,
				onClose: props.onClose,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.skFormError,
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						onClick: props.onClose,
						children: t("common.cancel")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						disabled: !valid || busy,
						onClick: () => void submit(),
						children: t("create.submit")
					})
				] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.skForm,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: t("create.name"),
							hint: t("create.nameHint"),
							children: (control) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								...control,
								value: name,
								placeholder: "release-notes",
								onChange: (event) => setName(event.target.value.trim().toLowerCase())
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: t("create.description"),
							hint: t("create.descriptionHint"),
							children: (control) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								...control,
								rows: 3,
								value: description,
								onChange: (event) => setDescription(event.target.value)
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: css.skFormRow,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
								label: t("create.root"),
								value: root,
								options: SKILL_ROOT_KINDS.filter((kind) => props.roots.includes(kind)).map((kind) => ({
									value: kind,
									label: t(`root.${kind}`)
								})),
								onChange: setRoot
							})
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/trash-page.tsx
		/** A size the eye can compare: bytes under a kilobyte, else whole KiB or MiB. */
		function size(bytes) {
			if (bytes < 1024) return `${bytes} B`;
			return bytes < 1048576 ? `${Math.round(bytes / 1024)} KiB` : `${(bytes / 1048576).toFixed(1)} MiB`;
		}
		/**
		* Skills taken out of DSH's reach: every removal still sits on disk under the
		* Source's `trash` directory, so it can be put back, and only here can it be
		* deleted for good.
		*/
		function TrashPage(props) {
			const t = useT();
			const { context } = props;
			const [entries, setEntries] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [purging, setPurging] = (0, react.useState)(null);
			const [restoring, setRestoring] = (0, react.useState)(null);
			const [emptying, setEmptying] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let active = true;
				context.client.trash().then((value) => {
					if (active) setEntries(value);
				}).catch((error) => {
					if (active) context.fail(error);
				});
				return () => {
					active = false;
				};
			}, [context.client, context.revision]);
			if (entries === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Busy, { label: t("common.loading") });
			const run = async (operation, done) => {
				setBusy(true);
				try {
					await operation();
					done();
					setEntries(await context.client.trash());
					context.refresh();
				} catch (error) {
					context.fail(error);
				} finally {
					setBusy(false);
				}
			};
			const restore = async (entry) => {
				setBusy(true);
				try {
					const preview = await context.client.previewTrashRestore({ id: entry.id });
					if (preview.needsRoot || preview.conflict !== void 0) setRestoring({
						entry,
						preview
					});
					else await run(() => context.client.restoreTrash({ id: entry.id }), () => context.notice(t("trash.restored", { name: entry.name })));
				} catch {
					setRestoring({
						entry,
						preview: null
					});
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: css.skDetail,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: css.skDetailHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("trash.title") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("trash.body") }),
							entries.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.skMeta,
								children: t("tabs.trash", { count: entries.length })
							})
						] }), entries.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: css.skDetailActions,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								disabled: !context.writable || busy,
								onClick: () => setEmptying(true),
								children: t("trash.empty")
							})
						})]
					}),
					entries.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
						glyph: "×",
						title: t("trash.emptyTitle"),
						children: t("trash.emptyBody")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: `${css.skVersions} ${css.skTrashList}`,
						children: entries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillIcon, { name: entry.name }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: css.skRowText,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: entry.name }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("trash.meta", {
										time: stamp(entry.trashedAt),
										size: size(entry.bytes)
									}) }),
									entry.originalPath !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
										title: entry.originalPath,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: entry.originalPath })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: css.skTrashTags,
										children: [entry.root !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
											tone: "quiet",
											children: t(`root.${entry.root}`)
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
											tone: "quiet",
											children: t(entry.kind === "file" ? "trash.file" : "trash.bundle")
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: css.skTrashActions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									disabled: !context.writable || busy,
									title: t("trash.restoreHint"),
									onClick: () => void restore(entry),
									children: t("trash.restore")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									size: "sm",
									disabled: !context.writable || busy,
									onClick: () => setPurging(entry),
									children: t("trash.purge")
								})]
							})
						] }, entry.id))
					}),
					restoring !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RestoreDialog, {
						context,
						entry: restoring.entry,
						initial: restoring.preview,
						onClose: () => setRestoring(null),
						onRestored: () => {
							setRestoring(null);
							context.client.trash().then(setEntries).catch(context.fail);
							context.refresh();
						}
					}),
					purging !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PurgeDialog, {
						entry: purging,
						busy,
						writable: context.writable,
						onClose: () => setPurging(null),
						onConfirm: () => void run(() => context.client.purgeTrash(purging.id), () => {
							context.notice(t("trash.purged", { name: purging.name }));
							setPurging(null);
						})
					}),
					emptying && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Confirm, {
						danger: true,
						title: t("trash.clearTitle", { count: entries.length }),
						body: t("trash.clearBody"),
						confirmLabel: t("trash.empty"),
						busy,
						onClose: () => setEmptying(false),
						onConfirm: () => void run(() => context.client.emptyTrash(), () => {
							context.notice(t("trash.emptied", { count: entries.length }));
							setEmptying(false);
						})
					})
				]
			});
		}
		function RestoreDialog(props) {
			const t = useT();
			const [name, setName] = (0, react.useState)(props.entry.name);
			const [root, setRoot] = (0, react.useState)(props.initial?.needsRoot === true ? "" : "original");
			const [preview, setPreview] = (0, react.useState)(props.initial);
			const [roots, setRoots] = (0, react.useState)(props.initial?.roots ?? []);
			const [replace, setReplace] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const validName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name) && name.length <= 64;
			(0, react.useEffect)(() => {
				let active = true;
				props.context.client.catalog().then((catalog) => {
					if (active) setRoots(catalog.roots.map((item) => item.kind));
				}).catch(props.context.fail);
				return () => {
					active = false;
				};
			}, [props.context.client]);
			(0, react.useEffect)(() => {
				let active = true;
				setPreview(null);
				setReplace(false);
				setError(null);
				if (!validName || root === "") return () => {
					active = false;
				};
				const input = {
					id: props.entry.id,
					name,
					...root === "original" ? {} : { root }
				};
				props.context.client.previewTrashRestore(input).then((value) => {
					if (active) setPreview(value);
				}).catch((reason) => {
					if (active) setError(errorText(reason));
				});
				return () => {
					active = false;
				};
			}, [
				props.context.client,
				props.entry.id,
				root,
				name,
				validName
			]);
			const submit = async () => {
				if (preview === null || preview.needsRoot || !props.context.writable) return;
				setBusy(true);
				setError(null);
				const input = {
					id: props.entry.id,
					name,
					...root === "original" ? {} : { root },
					...preview.conflict === void 0 ? {} : {
						replace,
						expectedHash: preview.conflict.hash
					}
				};
				try {
					await props.context.client.restoreTrash(input);
					props.context.notice(t("trash.restored", { name }));
					props.onRestored();
				} catch (reason) {
					setError(errorText(reason));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SidebarModal, {
				title: t("trash.restoreTitle", { name: props.entry.name }),
				busy,
				onClose: props.onClose,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					disabled: busy,
					onClick: props.onClose,
					children: t("common.cancel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					disabled: busy || !props.context.writable || !validName || preview === null || preview.needsRoot || preview.conflict !== void 0 && !replace,
					onClick: () => void submit(),
					children: t("trash.restore")
				})] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.skForm,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("trash.chooseHint") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SelectField, {
							label: t("create.root"),
							value: root,
							onChange: setRoot,
							options: [
								{
									value: "",
									label: t("trash.chooseRoot")
								},
								...props.initial?.needsRoot === true ? [] : [{
									value: "original",
									label: t("trash.original")
								}],
								...roots.map((kind) => ({
									value: kind,
									label: t(`root.${kind}`)
								}))
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: t("create.name"),
							hint: t("create.nameHint"),
							children: (control) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								...control,
								value: name,
								disabled: busy,
								onChange: (event) => setName(event.target.value.trim().toLowerCase())
							})
						}),
						preview?.path !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: preview.path }),
						preview?.conflict !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: replace,
								disabled: busy,
								onChange: (event) => setReplace(event.target.checked)
							}),
							" ",
							t("trash.replace")
						] }),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							className: css.skFormError,
							children: error
						})
					]
				})
			});
		}
		function PurgeDialog(props) {
			const t = useT();
			const [name, setName] = (0, react.useState)("");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.SidebarModal, {
				title: t("trash.purgeTitle", { name: props.entry.name }),
				description: t("trash.purgeBody"),
				busy: props.busy,
				onClose: props.onClose,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					disabled: props.busy,
					onClick: props.onClose,
					children: t("common.cancel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					className: css.skDangerButton,
					disabled: props.busy || !props.writable || name !== props.entry.name,
					onClick: props.onConfirm,
					children: t("trash.purge")
				})] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: t("trash.confirmName", { name: props.entry.name }),
					children: (control) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						...control,
						value: name,
						onChange: (event) => setName(event.target.value)
					})
				})
			});
		}
		//#endregion
		//#region src/client/use-skill.tsx
		/**
		* "Use" puts `/name ` into the conversation's input, where DSH's own gesture
		* loads the skill when the message is sent. The page and the composer meet
		* through one window event; the composer side answers by marking it handled.
		*/
		const SKILL_USE_EVENT = "dsh-mnemon:skill-use";
		/** A request no composer has taken yet: the next composer of its session to mount takes it. */
		let pending;
		const PENDING_MS = 1e4;
		/**
		* Ask the open composer to take `/name`. When the conversation is not on
		* screen yet, the request waits briefly for its composer to mount.
		* @returns whether a composer took it at once.
		*/
		function requestSkillUse(name, sessionId) {
			const detail = {
				name,
				...sessionId === void 0 ? {} : { sessionId },
				handled: false
			};
			window.dispatchEvent(new CustomEvent(SKILL_USE_EVENT, { detail }));
			pending = detail.handled ? void 0 : {
				detail,
				at: Date.now()
			};
			return detail.handled;
		}
		/** Where `/name` goes in a draft: first, once, ahead of what is already typed. */
		function draftWithSkill(draft, name) {
			const token = `/${name}`;
			if (new RegExp(`(^|\\s)${token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(\\s|$)`, "u").test(draft)) return draft;
			const rest = draft.trimStart();
			return rest === "" ? `${token} ` : `${token} ${rest}`;
		}
		const noDraft = (selector) => selector({ draft: "" });
		/** Mounted in the composer row; renders nothing and answers "Use" for its own session. */
		function SkillUseBridge(props) {
			const draft = (props.useInput ?? noDraft)((state) => state.draft);
			const latest = (0, react.useRef)(draft);
			latest.current = draft;
			(0, react.useEffect)(() => {
				const take = (detail) => {
					if (detail === void 0 || detail.handled || props.inputActions === void 0) return;
					if (detail.sessionId !== void 0 && props.sessionId !== void 0 && detail.sessionId !== props.sessionId) return;
					props.inputActions.setDraft(draftWithSkill(latest.current ?? "", detail.name));
					detail.handled = true;
					if (pending?.detail === detail) pending = void 0;
				};
				if (pending !== void 0 && Date.now() - pending.at < PENDING_MS) take(pending.detail);
				const listener = (event) => take(event.detail);
				window.addEventListener(SKILL_USE_EVENT, listener);
				return () => window.removeEventListener(SKILL_USE_EVENT, listener);
			}, [props.inputActions, props.sessionId]);
			return null;
		}
		const SKILL_USE_SLOT = "conversation.input.left";
		/**
		* Register the bridge in the composer's tool row once the conversation
		* declares that row; a host without it leaves "Use" untaken.
		*/
		function installSkillUseBridge(ctx) {
			const slots = ctx.slots;
			try {
				return slots.inject(SKILL_USE_SLOT, () => slots.register({
					name: SKILL_USE_SLOT,
					id: "dsh-mnemon-skills/use",
					order: 1e3
				}, SkillUseBridge));
			} catch {
				return () => void 0;
			}
		}
		//#endregion
		//#region src/client/ui.tsx
		const TABS = [
			"skills",
			"evolution",
			"evals",
			"market",
			"trash"
		];
		const POLL_MS = 3e3;
		const NOTICE_MS = 5e3;
		const FILTERS = [
			"pending",
			"done",
			"evidence"
		];
		/**
		* `skill:<key>`, `name:<skill>`, `suggestion:<id>`, `draft:<id>`,
		* `trajectory:<id>`, `evals:<skill>` or `evolution:<filter>` from a link
		* elsewhere, such as the skills line under a turn.
		*/
		function seedLocation(input) {
			if (typeof input !== "object" || input === null || Array.isArray(input) || typeof input.seed !== "string") return void 0;
			const nonce = typeof input.nonce === "number" ? input.nonce : Date.now();
			const [kind, ...rest] = input.seed.split(":");
			const value = rest.join(":");
			if (kind === "evolution") return {
				tab: "evolution",
				filter: FILTERS.includes(value) ? value : "pending",
				nonce
			};
			if (kind === "evals") return {
				tab: "evals",
				...value === "" ? {} : { skillName: value },
				nonce
			};
			if (value === "") return void 0;
			if (kind === "skill") return {
				tab: "skills",
				skillKey: value,
				nonce
			};
			if (kind === "name") return {
				tab: "skills",
				skillName: value,
				nonce
			};
			if (kind === "suggestion") return {
				tab: "evolution",
				suggestionId: value,
				nonce
			};
			if (kind === "draft") return {
				tab: "evolution",
				draftId: value,
				nonce
			};
			if (kind === "trajectory") return {
				tab: "evolution",
				filter: "evidence",
				trajectoryId: value,
				nonce
			};
		}
		/** The tab the page showed last, while the client runs: reopening the page lands there again. */
		let rememberedTab = "skills";
		function SkillsView(props) {
			const t = useT();
			const client = (0, react.useMemo)(() => skillsPageClient(props.management), [props.management]);
			const [location, setLocation] = (0, react.useState)(() => seedLocation(props.navigationInput) ?? { tab: rememberedTab });
			const [revision, setRevision] = (0, react.useState)(0);
			const [overview, setOverview] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			const refresh = (0, react.useCallback)(() => setRevision((value) => value + 1), []);
			const refreshKey = (0, react.useRef)(props.refreshKey);
			(0, react.useEffect)(() => {
				if (refreshKey.current === props.refreshKey) return;
				refreshKey.current = props.refreshKey;
				refresh();
			}, [props.refreshKey, refresh]);
			(0, react.useEffect)(() => {
				const seeded = seedLocation(props.navigationInput);
				if (seeded !== void 0) setLocation(seeded);
			}, [props.navigationInput]);
			(0, react.useEffect)(() => {
				rememberedTab = location.tab;
			}, [location.tab]);
			(0, react.useLayoutEffect)(() => {
				props.onResetScroll?.();
			}, [location.tab, props.onResetScroll]);
			(0, react.useEffect)(() => {
				let active = true;
				client.overview().then((value) => {
					if (active) setOverview(value);
				}).catch((reason) => {
					if (active) setError(errorText(reason));
				});
				return () => {
					active = false;
				};
			}, [client, revision]);
			const busy = overview !== null && (overview.counts.runsRunning > 0 || overview.counts.drafting > 0);
			const wasBusy = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (props.active === false) return;
				if (wasBusy.current && !busy) refresh();
				wasBusy.current = busy;
				if (!busy) return;
				const timer = setInterval(refresh, POLL_MS);
				return () => clearInterval(timer);
			}, [
				busy,
				refresh,
				props.active
			]);
			(0, react.useEffect)(() => {
				if (props.active === false) return;
				const resume = () => {
					if (document.visibilityState !== "hidden") refresh();
				};
				window.addEventListener("focus", resume);
				document.addEventListener("visibilitychange", resume);
				return () => {
					window.removeEventListener("focus", resume);
					document.removeEventListener("visibilitychange", resume);
				};
			}, [refresh, props.active]);
			(0, react.useEffect)(() => {
				if (notice === null) return;
				const timer = setTimeout(() => setNotice(null), NOTICE_MS);
				return () => clearTimeout(timer);
			}, [notice]);
			const preferences = props.preferences;
			const evolution = (0, react.useMemo)(() => {
				const value = preferences?.value;
				if (typeof value !== "object" || value === null || Array.isArray(value) || typeof value.evolution !== "boolean") return void 0;
				return {
					on: value.evolution,
					...preferences.writable ? { enable: () => preferences.replace({ evolution: true }) } : {}
				};
			}, [preferences]);
			const context = {
				client,
				writable: props.writable !== false,
				revision,
				refresh,
				navigate: (next) => setLocation({
					...next,
					nonce: Date.now()
				}),
				notice: (text) => {
					setNotice(text);
					setError(null);
				},
				fail: (reason) => {
					setError(errorText(reason));
					setNotice(null);
				},
				useSkill: (name) => {
					const taken = requestSkillUse(name, props.sessionId);
					if (props.onReturnToConversation !== void 0) props.onReturnToConversation();
					else if (taken) {
						setNotice(t("skills.used", { name }));
						setError(null);
					} else {
						setError(t("skills.noConversation"));
						setNotice(null);
					}
				},
				evolution,
				...props.onOpenSettings === void 0 ? {} : { openSettings: props.onOpenSettings },
				...props.sessionId === void 0 ? {} : { sessionId: props.sessionId }
			};
			const waiting = overview === null ? 0 : overview.counts.pending + overview.counts.drafts;
			const trashed = overview === null ? 0 : overview.counts.trash;
			const tabs = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: sidebarCss.memoryNavigation,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidebarCss.memoryTabs,
					role: "tablist",
					"aria-label": t("tabs.aria"),
					children: TABS.map((tab) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						role: "tab",
						"aria-selected": location.tab === tab,
						"data-active": location.tab === tab ? "" : void 0,
						onClick: () => setLocation({ tab }),
						children: [
							t(`tab.${tab}`),
							tab === "evolution" && waiting > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
								className: css.skTabBadge,
								"aria-label": t("tabs.waiting", { count: waiting }),
								children: waiting
							}),
							tab === "trash" && trashed > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
								className: css.skTabBadge,
								"aria-label": t("tabs.trash", { count: trashed }),
								children: trashed
							})
						]
					}, tab))
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: sidebarCss.memoryWorkspace,
					children: [props.standalone !== true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.PageHeader, {
						title: t("page.title"),
						description: t("page.description"),
						...context.writable ? {} : { meta: t("page.readOnly") }
					}), tabs]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.Reveal, { children: error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.skAlert,
					role: "alert",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: error }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: css.skDismiss,
						onClick: () => setError(null),
						"aria-label": t("common.close"),
						children: "×"
					})]
				}) }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.Reveal, { children: notice === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.skNotice,
					role: "status",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: notice }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: css.skDismiss,
						onClick: () => setNotice(null),
						"aria-label": t("common.close"),
						children: "×"
					})]
				}) }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.skPage,
					children: [
						location.tab === "skills" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillsPage, {
							context,
							location
						}),
						location.tab === "evolution" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EvolutionPage, {
							context,
							location
						}),
						location.tab === "evals" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EvalsPage, {
							context,
							location
						}),
						location.tab === "market" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarketPage, {
							context,
							location
						}),
						location.tab === "trash" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrashPage, {
							context,
							location
						})
					]
				}, location.tab)
			] });
		}
		function SkillsSourcePage(props) {
			if (props.management === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(dsh_mnemon_client.MemorySourcePageFrame, {
				locale: props.locale,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillsView, {
					...props,
					management: props.management
				}, props.sourceInstanceKey)
			});
		}
		function installSkillsMemoryUI(ctx, locale = "zh") {
			const t = translate(locale);
			return (0, dsh_mnemon_client.installMemorySourceUI)(ctx, {
				sourceTypeId: "skills",
				pages: [{
					id: "library",
					order: 800,
					label: () => t("page.title"),
					navigation: {
						stickyHeader: false,
						group: "tools",
						glyph: "✦"
					},
					component: SkillsSourcePage
				}]
			});
		}
		const inject = ["slots"];
		/** The tab is named by the component's declaration; the page label is only a fallback. */
		function apply(ctx) {
			installSkillsMemoryUI(ctx);
			installSkillUseBridge(ctx);
		}
		//#endregion
		exports.SkillsSourcePage = SkillsSourcePage;
		exports.apply = apply;
		exports.inject = inject;
		exports.installSkillsMemoryUI = installSkillsMemoryUI;
		return module.exports;
	}
});
