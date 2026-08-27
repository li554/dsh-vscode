window.__ModuleLoader__.load({
	id: "@linxin666/dsh-client-ui-skill-explorer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_dom_client = require("react-dom/client");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/api.ts
		/**
		* Skill center API client (browser half). Talks to the host route family over
		* same-origin fetch; the host enforces the trust fence on its side.
		*/
		/** Route paths mirrored from the host (src/routes.ts ROUTES). */
		const API = {
			list: "/api/dsh-skill-explorer/list",
			setEnabled: "/api/dsh-skill-explorer/set-enabled",
			create: "/api/dsh-skill-explorer/create",
			delete: "/api/dsh-skill-explorer/delete"
		};
		/** One thrown API error with the host-provided message. */
		var ApiError = class extends Error {};
		/** Skill center API client. */
		var SkillApi = class {
			/** Fetch the grouped skill list. */
			async list() {
				return this.request(API.list);
			}
			/** Enable or disable a skill (rewrites disable-model-invocation). */
			async setEnabled(name, path, enabled) {
				return this.request(API.setEnabled, {
					method: "POST",
					body: {
						name,
						path,
						enabled
					}
				});
			}
			/** Create a skill file under the user or project root. */
			async create(payload) {
				return this.request(API.create, {
					method: "POST",
					body: payload
				});
			}
			/** Delete a skill (moves it into .trash). */
			async remove(name, path) {
				return this.request(API.delete, {
					method: "POST",
					body: {
						name,
						path
					}
				});
			}
			async request(path, options = {}) {
				const response = await fetch(path, {
					method: options.method ?? "GET",
					headers: options.body === void 0 ? void 0 : { "content-type": "application/json" },
					body: options.body === void 0 ? void 0 : JSON.stringify(options.body)
				});
				let body;
				try {
					body = await response.json();
				} catch {
					body = void 0;
				}
				if (!response.ok) throw new ApiError(typeof body === "object" && body !== null && typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
				return body;
			}
		};
		//#endregion
		//#region src/client/locales.ts
		/**
		* skill-explorer surface copy: zh is the key source, en mirrors every key.
		*/
		const zh = {
			"entry.label": "技能中心",
			"entry.tooltip": "技能中心：浏览与管理已加载的 skill",
			"panel.title": "技能中心",
			"tab.list": "技能",
			"tab.create": "创建",
			"group.bundled": "系统内置",
			"group.project-dsh": "项目技能（.dsh/skills）",
			"group.project-agents": "项目技能（.agents/skills）",
			"group.custom": "自定义目录",
			"group.user-dsh": "用户技能（~/.dsh/skills）",
			"group.user-agents": "用户技能（~/.agents/skills）",
			"group.runtime": "运行时注册",
			"groupHint.bundled": "DSH 随附与插件提供的技能",
			"groupHint.project-dsh": "仅当前项目",
			"groupHint.project-agents": "仅当前项目",
			"groupHint.custom": "customSkillDirs 配置",
			"groupHint.user-dsh": "本机所有项目",
			"groupHint.user-agents": "本机所有项目",
			"groupHint.runtime": "插件代码内嵌注册",
			"list.loading": "加载中…",
			"list.loadFailed": "加载失败：{error}",
			"list.empty": "当前没有已加载的 skill。",
			"list.count": "{count} 个",
			"list.when": "适用：{when}",
			"list.invokable": "可调用：{marks}",
			"list.linked": "软链接",
			"list.mark.model": "模型",
			"list.mark.user": "用户",
			"list.enabled": "已启用：模型可调用（点击禁用）",
			"list.disabled": "已禁用：模型不可调用（点击启用）",
			"list.toggleFailed": "操作失败：{error}",
			"list.delete": "删除",
			"list.deleteConfirm": "删除技能「{name}」？将移入 .trash。",
			"list.deleteFailed": "删除失败：{error}",
			"create.root": "创建位置",
			"create.root.user": "用户技能（~/.dsh/skills，所有项目可用）",
			"create.root.project": "项目技能（当前项目 .dsh/skills）",
			"create.name": "技能名（kebab-case，与文件目录同名）",
			"create.namePlaceholder": "如 my-workflow",
			"create.description": "描述（模型判断触发条件的依据）",
			"create.whenToUse": "适用场景（可选）",
			"create.content": "指令内容（SKILL.md 正文，Markdown）",
			"create.submit": "创建技能",
			"create.empty": "技能名/描述/内容不能为空",
			"create.created": "已创建：{path}",
			"create.failed": "创建失败：{error}",
			"create.note": "创建后立即生效（skill-filesystem 会热扫描）。内容会作为指令注入模型上下文——不要写入敏感信息。",
			"refresh": "刷新",
			"close": "关闭",
			"cwd": "cwd: {cwd}"
		};
		const en = {
			"entry.label": "Skill Center",
			"entry.tooltip": "Skill center: browse and manage loaded skills",
			"panel.title": "Skill Center",
			"tab.list": "Skills",
			"tab.create": "Create",
			"group.bundled": "System bundled",
			"group.project-dsh": "Project skills (.dsh/skills)",
			"group.project-agents": "Project skills (.agents/skills)",
			"group.custom": "Custom directories",
			"group.user-dsh": "User skills (~/.dsh/skills)",
			"group.user-agents": "User skills (~/.agents/skills)",
			"group.runtime": "Runtime registered",
			"groupHint.bundled": "Skills shipped with DSH and its plugins",
			"groupHint.project-dsh": "Current project only",
			"groupHint.project-agents": "Current project only",
			"groupHint.custom": "customSkillDirs config",
			"groupHint.user-dsh": "All projects on this machine",
			"groupHint.user-agents": "All projects on this machine",
			"groupHint.runtime": "Registered in plugin code",
			"list.loading": "Loading…",
			"list.loadFailed": "Failed to load: {error}",
			"list.empty": "No skills loaded yet.",
			"list.count": "{count}",
			"list.when": "When: {when}",
			"list.invokable": "Invokable: {marks}",
			"list.linked": "symlinked",
			"list.mark.model": "model",
			"list.mark.user": "user",
			"list.enabled": "Enabled: invokable by the model (click to disable)",
			"list.disabled": "Disabled: not invokable by the model (click to enable)",
			"list.toggleFailed": "Operation failed: {error}",
			"list.delete": "Delete",
			"list.deleteConfirm": "Delete skill \"{name}\"? It moves into .trash.",
			"list.deleteFailed": "Delete failed: {error}",
			"create.root": "Location",
			"create.root.user": "User skills (~/.dsh/skills, available to all projects)",
			"create.root.project": "Project skills (current project .dsh/skills)",
			"create.name": "Skill name (kebab-case, same as the directory name)",
			"create.namePlaceholder": "e.g. my-workflow",
			"create.description": "Description (how the model decides when to trigger)",
			"create.whenToUse": "When to use (optional)",
			"create.content": "Instructions (SKILL.md body, Markdown)",
			"create.submit": "Create skill",
			"create.empty": "Skill name/description/content must not be empty",
			"create.created": "Created: {path}",
			"create.failed": "Create failed: {error}",
			"create.note": "The skill takes effect immediately (skill-filesystem hot-scans). Its content is injected into the model context as instructions — do not put sensitive information in it.",
			"refresh": "Refresh",
			"close": "Close",
			"cwd": "cwd: {cwd}"
		};
		//#endregion
		//#region src/client/panel-helpers.ts
		/**
		* Shared panel helpers: the active-dictionary pick (document-language based)
		* and the tiny {name} interpolator. All copy stays in locales.ts.
		*/
		/** Active dictionary, picked by the document language at call time. */
		function dictionary() {
			return (typeof document !== "undefined" ? document.documentElement.lang : "zh").toLowerCase().startsWith("en") ? { ...en } : { ...zh };
		}
		/** Translate a key with optional {name} template params (current language). */
		function tt(key, values) {
			let text = dictionary()[key] ?? key;
			if (values !== void 0) for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value));
			return text;
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-skill-explorer/src/client/skill-panel.module.css.mjs
		const css = ".cBrkua_entry{box-sizing:border-box;width:100%;height:36px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:0 10px;font-size:13px;display:flex}.cBrkua_entry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.cBrkua_entryIcon{flex:none;justify-content:center;align-items:center;width:24px;height:24px;display:inline-flex}.cBrkua_entryIcon svg{width:18px;height:18px;display:block}.cBrkua_entryLabel{text-overflow:ellipsis;overflow:hidden}[data-dsh-frame][data-sidebar-collapsed] .cBrkua_entry{border-radius:50%;justify-content:center;width:36px;height:36px;margin:0 auto 12px;padding:0}[data-dsh-frame][data-sidebar-collapsed] .cBrkua_entryLabel{display:none}.cBrkua_overlay{background:var(--dsw-alias-bg-mask-2,#080a1073);z-index:9999;justify-content:center;align-items:center;font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;position:fixed;inset:0}.cBrkua_card{background:var(--dsw-alias-bg-overlay,#fdfdfd);width:min(780px,92vw);max-height:84vh;color:var(--dsw-alias-label-primary,#1c1e26);border-radius:12px;flex-direction:column;display:flex;overflow:hidden;box-shadow:0 18px 60px #00000059}.cBrkua_head{background:var(--dsw-alias-bg-base,#fff);align-items:center;gap:10px;padding:12px 16px;display:flex}.cBrkua_headTitle{margin:0;font-size:15px;font-weight:600}.cBrkua_headCwd{color:var(--dsw-alias-label-secondary,#8a8f9c);text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:11px;overflow:hidden}.cBrkua_headButton{color:var(--dsw-alias-label-primary,#3a3f4b);cursor:pointer;background:#f2f3f5;border:none;border-radius:6px;padding:4px 10px;font-size:12px}.cBrkua_headButton:hover{background:#e7e8ea}.cBrkua_tabs{background:var(--dsw-alias-bg-layer-1,#f7f8fa);gap:4px;padding:8px 16px 0;display:flex}.cBrkua_tab{border:1px solid var(--dsw-alias-border-l1,#d7dae0);color:var(--dsw-alias-label-secondary,#8a8f9c);cursor:pointer;background:0 0;border-bottom:none;border-radius:8px 8px 0 0;padding:6px 14px;font-size:12px}.cBrkua_tabActive{background:var(--dsw-alias-bg-base,#fdfdfd);color:var(--dsw-alias-label-primary,#1c1e26);font-weight:600}.cBrkua_body{padding:12px 16px;overflow:auto}.cBrkua_status{color:var(--dsw-alias-label-secondary,#6b7280);text-align:center;padding:18px;font-size:13px}.cBrkua_group{margin-bottom:18px}.cBrkua_groupTitle{color:var(--dsw-alias-label-primary,#2f3542);margin:0 0 2px;font-size:13px;font-weight:600}.cBrkua_groupHint{color:var(--dsw-alias-label-secondary,#8a8f9c);margin:0 0 8px;font-size:11px}.cBrkua_count{color:var(--dsw-alias-label-secondary,#8a8f9c);margin-left:6px;font-weight:400}.cBrkua_skill{border:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-base,#fff);border-radius:8px;margin-bottom:8px;padding:10px 12px}.cBrkua_skillHeader{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.cBrkua_skillName{color:var(--dsw-alias-label-primary,#111827);font-family:ui-monospace,Consolas,monospace;font-size:13px;font-weight:600}.cBrkua_badge{background:var(--dsw-alias-state-business-secondary,#eef2ff);color:var(--dsw-alias-state-business-primary,#4353a3);border:1px solid var(--dsw-alias-state-business-tertiary,#dde3f8);border-radius:99px;padding:1px 6px;font-size:10px}.cBrkua_badgeInvokable{background:var(--dsw-alias-state-success-secondary,#ecfdf5);color:var(--dsw-alias-state-success-primary,#0f7a50);border-color:var(--dsw-alias-state-success-tertiary,#c9f0dd)}.cBrkua_switch{cursor:pointer;background:0 0;border:none;border-radius:99px;align-items:center;margin-left:auto;padding:2px;display:inline-flex}.cBrkua_switchTrack{background:var(--dsw-alias-border-l2,#d1d5db);border-radius:99px;flex:none;width:30px;height:16px;transition:background .18s;position:relative}.cBrkua_switchThumb{background:var(--dsw-alias-bg-base,#fff);border-radius:50%;width:12px;height:12px;transition:left .18s;position:absolute;top:2px;left:2px;box-shadow:0 1px 2px #00000040}.cBrkua_switch[aria-checked=true] .cBrkua_switchTrack{background:var(--dsw-alias-state-success-primary,#10b981)}.cBrkua_switch[aria-checked=true] .cBrkua_switchThumb{left:16px}.cBrkua_deleteButton{color:#d92d20;cursor:pointer;background:#feeceb;border:none;border-radius:6px;padding:3px 9px;font-size:11px}.cBrkua_deleteButton:hover{background:#fbdcd9}.cBrkua_skillDesc{color:var(--dsw-alias-label-primary,#3a3f4b);margin:6px 0 0;font-size:12px;line-height:1.5}.cBrkua_skillWhen{color:var(--dsw-alias-label-secondary,#8a8f9c);margin:4px 0 0;font-size:11px}.cBrkua_skillPath{color:var(--dsw-alias-label-tertiary,#a2a7b3);word-break:break-all;margin:6px 0 0;font-family:ui-monospace,Consolas,monospace;font-size:10px}.cBrkua_feedback{color:var(--dsw-alias-state-error-primary,#b42318);font-size:11px}.cBrkua_feedbackOk{color:var(--dsw-alias-state-success-primary,#0f9d6e)}.cBrkua_form{flex-direction:column;gap:8px;max-width:640px;display:flex}.cBrkua_formLabel{color:var(--dsw-alias-label-secondary,#5f6672);flex-direction:column;gap:4px;font-size:12px;display:flex}.cBrkua_formInput{box-sizing:border-box;background:var(--dsw-alias-bg-layer-1,#f7f8fa);width:100%;color:var(--dsw-alias-label-primary,#1c1e26);border:1px solid #0000;border-radius:6px;padding:6px 8px;font-size:12px}select.cBrkua_formInput{height:30px;padding:0 8px}.cBrkua_formTextarea{resize:vertical;min-height:120px;font-family:ui-monospace,monospace}.cBrkua_formButton{color:#fff;cursor:pointer;background:#111;border:1px solid #0000;border-radius:6px;align-self:flex-start;padding:6px 14px;font-size:12px}.cBrkua_formButton:hover{background:#2a2a2c}body[data-ds-dark-theme] .cBrkua_formButton{color:#111827;background:#e5e5ea}body[data-ds-dark-theme] .cBrkua_formButton:hover{background:#d1d5db}.cBrkua_note{color:var(--dsw-alias-label-tertiary,#a0a5b1);margin-top:10px;font-size:11px;line-height:1.7}body[data-ds-dark-theme] .cBrkua_card,body[data-ds-dark-theme] .cBrkua_head{background:#2c2c2e}body[data-ds-dark-theme] .cBrkua_tabs{background:#1e1e1e}body[data-ds-dark-theme] .cBrkua_skill{background:#48484a;border-color:#ffffff14}body[data-ds-dark-theme] .cBrkua_badge{color:#a5b4fc;background:#6378dc38;border-color:#6378dc66}body[data-ds-dark-theme] .cBrkua_badgeInvokable{color:#30d158;background:#30d15826;border-color:#30d1584d}body[data-ds-dark-theme] .cBrkua_switchThumb{background:#fff}body[data-ds-dark-theme] .cBrkua_tab{color:#ffffff80}body[data-ds-dark-theme] .cBrkua_tabActive{color:#fff;background:#3a3a3c;border:.5px solid #ffffff14;box-shadow:0 1px 3px #0000004d}body[data-ds-dark-theme] .cBrkua_formInput{background:#1c1c1e;border-color:#ffffff0f}body[data-ds-dark-theme] .cBrkua_headButton{color:#ffffffd9;background:#ffffff1a;border-color:#0000}body[data-ds-dark-theme] .cBrkua_headButton:hover{background:#ffffff26}body[data-ds-dark-theme] .cBrkua_headButton:active{background:#ffffff0d}body[data-ds-dark-theme] .cBrkua_deleteButton{color:#ff6b61;background:#ff3b3029;border-color:#0000}body[data-ds-dark-theme] .cBrkua_deleteButton:hover{background:#ff3b3042}";
		const tagId = "@linxin666/dsh-client-ui-skill-explorer/skill-panel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-skill-explorer";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var skill_panel_module_css_default = {
			"badge": "cBrkua_badge",
			"badgeInvokable": "cBrkua_badgeInvokable",
			"body": "cBrkua_body",
			"card": "cBrkua_card",
			"count": "cBrkua_count",
			"deleteButton": "cBrkua_deleteButton",
			"entry": "cBrkua_entry",
			"entryIcon": "cBrkua_entryIcon",
			"entryLabel": "cBrkua_entryLabel",
			"feedback": "cBrkua_feedback",
			"feedbackOk": "cBrkua_feedbackOk",
			"form": "cBrkua_form",
			"formButton": "cBrkua_formButton",
			"formInput": "cBrkua_formInput",
			"formLabel": "cBrkua_formLabel",
			"formTextarea": "cBrkua_formTextarea",
			"group": "cBrkua_group",
			"groupHint": "cBrkua_groupHint",
			"groupTitle": "cBrkua_groupTitle",
			"head": "cBrkua_head",
			"headButton": "cBrkua_headButton",
			"headCwd": "cBrkua_headCwd",
			"headTitle": "cBrkua_headTitle",
			"note": "cBrkua_note",
			"overlay": "cBrkua_overlay",
			"skill": "cBrkua_skill",
			"skillDesc": "cBrkua_skillDesc",
			"skillHeader": "cBrkua_skillHeader",
			"skillName": "cBrkua_skillName",
			"skillPath": "cBrkua_skillPath",
			"skillWhen": "cBrkua_skillWhen",
			"status": "cBrkua_status",
			"switch": "cBrkua_switch",
			"switchThumb": "cBrkua_switchThumb",
			"switchTrack": "cBrkua_switchTrack",
			"tab": "cBrkua_tab",
			"tabActive": "cBrkua_tabActive",
			"tabs": "cBrkua_tabs"
		};
		//#endregion
		//#region src/client/SkillPanel.tsx
		/**
		* Skill center panel (browser half): an overlay modal with two tabs — the
		* grouped skill list (enable/disable switch, delete) and a create form.
		* Talks to the host route family through SkillApi.
		*/
		/** Marks shown next to a skill (model/user invocable). */
		function invokableMarks(skill) {
			const marks = [];
			if (skill.modelInvocable) marks.push(tt("list.mark.model"));
			if (skill.userInvocable) marks.push(tt("list.mark.user"));
			return marks.join(" / ");
		}
		/** One skill card: name, badges, toggle switch, delete button. */
		function SkillCard({ skill, api, onChanged }) {
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(void 0);
			const busyRef = (0, react.useRef)(false);
			const toggle = async () => {
				if (busyRef.current) return;
				const path = skill.path;
				if (path === void 0) return;
				busyRef.current = true;
				setBusy(true);
				setError(void 0);
				try {
					await api.setEnabled(skill.name, path, !skill.modelInvocable);
					onChanged();
				} catch (err) {
					setError(tt("list.toggleFailed", { error: err instanceof Error ? err.message : String(err) }));
				} finally {
					busyRef.current = false;
					setBusy(false);
				}
			};
			const remove = async () => {
				const path = skill.path;
				if (path === void 0) return;
				if (!window.confirm(tt("list.deleteConfirm", { name: skill.name }))) return;
				if (busyRef.current) return;
				busyRef.current = true;
				setBusy(true);
				setError(void 0);
				try {
					await api.remove(skill.name, path);
					onChanged();
				} catch (err) {
					setError(tt("list.deleteFailed", { error: err instanceof Error ? err.message : String(err) }));
				} finally {
					busyRef.current = false;
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: skill_panel_module_css_default.skill,
				"data-dsh-part": "skill-row",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: skill_panel_module_css_default.skillHeader,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: skill_panel_module_css_default.skillName,
								children: skill.name
							}),
							skill.provider !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: skill_panel_module_css_default.badge,
								children: skill.provider
							}),
							skill.linked === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: skill_panel_module_css_default.badge,
								children: tt("list.linked")
							}),
							(skill.modelInvocable || skill.userInvocable) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `${skill_panel_module_css_default.badge} ${skill_panel_module_css_default.badgeInvokable}`,
								children: tt("list.invokable", { marks: invokableMarks(skill) })
							}),
							skill.path !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: skill_panel_module_css_default.switch,
								role: "switch",
								"aria-checked": skill.modelInvocable,
								title: skill.modelInvocable ? tt("list.enabled") : tt("list.disabled"),
								disabled: busy,
								onClick: () => {
									toggle();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: skill_panel_module_css_default.switchTrack,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: skill_panel_module_css_default.switchThumb })
								})
							}),
							skill.path !== void 0 && skill.linked !== true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: skill_panel_module_css_default.deleteButton,
								disabled: busy,
								onClick: () => {
									remove();
								},
								children: tt("list.delete")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: skill_panel_module_css_default.skillDesc,
						children: skill.description
					}),
					skill.whenToUse !== void 0 && skill.whenToUse !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: skill_panel_module_css_default.skillWhen,
						children: tt("list.when", { when: skill.whenToUse })
					}),
					skill.path !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: skill_panel_module_css_default.skillPath,
						children: skill.path
					}),
					error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: skill_panel_module_css_default.feedback,
						children: error
					})
				]
			});
		}
		/** The grouped skill list tab. */
		function ListTab({ api, refreshTick, onCwd }) {
			const [payload, setPayload] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)(void 0);
			const loadSeq = (0, react.useRef)(0);
			const load = async () => {
				const seq = ++loadSeq.current;
				try {
					const next = await api.list();
					if (seq !== loadSeq.current) return;
					setPayload(next);
					onCwd(next.cwd);
					setError(void 0);
				} catch (err) {
					if (seq !== loadSeq.current) return;
					setError(tt("list.loadFailed", { error: err instanceof Error ? err.message : String(err) }));
				}
			};
			(0, react.useEffect)(() => {
				load();
			}, [api, refreshTick]);
			if (error !== void 0 && payload === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: skill_panel_module_css_default.status,
				children: error
			});
			if (payload === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: skill_panel_module_css_default.status,
				children: tt("list.loading")
			});
			if (payload.groups.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: skill_panel_module_css_default.status,
				children: tt("list.empty")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: skill_panel_module_css_default.feedback,
				children: error
			}), payload.groups.map((group) => {
				const groupKey = `group.${group.key}`;
				const hintKey = `groupHint.${group.key}`;
				const title = groupKey in zh ? tt(groupKey) : group.title;
				const hint = hintKey in zh ? tt(hintKey) : group.hint;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: skill_panel_module_css_default.group,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
							className: skill_panel_module_css_default.groupTitle,
							children: [title, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: skill_panel_module_css_default.count,
								children: tt("list.count", { count: String(group.skills.length) })
							})]
						}),
						hint !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: skill_panel_module_css_default.groupHint,
							children: hint
						}),
						group.skills.map((skill) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillCard, {
							skill,
							api,
							onChanged: () => {
								load();
							}
						}, skill.name))
					]
				}, group.key);
			})] });
		}
		/** The create form tab. */
		function CreateTab({ api, cwd }) {
			const [root, setRoot] = (0, react.useState)("user");
			const [name, setName] = (0, react.useState)("");
			const [description, setDescription] = (0, react.useState)("");
			const [whenToUse, setWhenToUse] = (0, react.useState)("");
			const [content, setContent] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [feedback, setFeedback] = (0, react.useState)(void 0);
			const submit = async (event) => {
				event.preventDefault();
				if (name.trim() === "" || description.trim() === "" || content.trim() === "") {
					setFeedback({
						text: tt("create.empty"),
						ok: false
					});
					return;
				}
				setBusy(true);
				try {
					const result = await api.create({
						root,
						name: name.trim(),
						description: description.trim(),
						whenToUse: whenToUse.trim() || void 0,
						content,
						cwd: cwd ?? ""
					});
					setFeedback({
						text: tt("create.created", { path: result.path }),
						ok: true
					});
					setName("");
					setDescription("");
					setWhenToUse("");
					setContent("");
				} catch (err) {
					setFeedback({
						text: tt("create.failed", { error: err instanceof Error ? err.message : String(err) }),
						ok: false
					});
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				className: skill_panel_module_css_default.form,
				onSubmit: (event) => {
					submit(event);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: skill_panel_module_css_default.formLabel,
						children: [tt("create.root"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							className: skill_panel_module_css_default.formInput,
							value: root,
							onChange: (event) => {
								setRoot(event.target.value);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "user",
								children: tt("create.root.user")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "project",
								children: tt("create.root.project")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: skill_panel_module_css_default.formLabel,
						children: [tt("create.name"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: skill_panel_module_css_default.formInput,
							value: name,
							placeholder: tt("create.namePlaceholder"),
							onChange: (event) => {
								setName(event.target.value);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: skill_panel_module_css_default.formLabel,
						children: [tt("create.description"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: skill_panel_module_css_default.formInput,
							value: description,
							onChange: (event) => {
								setDescription(event.target.value);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: skill_panel_module_css_default.formLabel,
						children: [tt("create.whenToUse"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: skill_panel_module_css_default.formInput,
							value: whenToUse,
							onChange: (event) => {
								setWhenToUse(event.target.value);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: skill_panel_module_css_default.formLabel,
						children: [tt("create.content"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							className: `${skill_panel_module_css_default.formInput} ${skill_panel_module_css_default.formTextarea}`,
							value: content,
							onChange: (event) => {
								setContent(event.target.value);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "submit",
						className: skill_panel_module_css_default.formButton,
						disabled: busy,
						children: tt("create.submit")
					}),
					feedback !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: feedback.ok ? `${skill_panel_module_css_default.feedback} ${skill_panel_module_css_default.feedbackOk}` : skill_panel_module_css_default.feedback,
						children: feedback.text
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: skill_panel_module_css_default.note,
						children: tt("create.note")
					})
				]
			});
		}
		/** The skill center overlay modal. */
		function SkillPanel({ api, onClose }) {
			const [tab, setTab] = (0, react.useState)("list");
			const [cwd, setCwd] = (0, react.useState)(void 0);
			const [refreshTick, setRefreshTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key !== "Escape") return;
					const target = event.target;
					if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
					onClose();
				};
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [onClose]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: skill_panel_module_css_default.overlay,
				onClick: (event) => {
					if (event.target === event.currentTarget) onClose();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: skill_panel_module_css_default.card,
					"data-dsh-part": "card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: skill_panel_module_css_default.head,
							"data-dsh-part": "head",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									className: skill_panel_module_css_default.headTitle,
									children: tt("panel.title")
								}),
								cwd !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: skill_panel_module_css_default.headCwd,
									children: tt("cwd", { cwd })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: skill_panel_module_css_default.headButton,
									onClick: () => {
										setRefreshTick((tick) => tick + 1);
									},
									children: tt("refresh")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: skill_panel_module_css_default.headButton,
									onClick: onClose,
									children: tt("close")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: skill_panel_module_css_default.tabs,
							"data-dsh-part": "tab-bar",
							role: "tablist",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								className: `${skill_panel_module_css_default.tab} ${tab === "list" ? skill_panel_module_css_default.tabActive : ""}`,
								"data-dsh-part": "tab",
								"aria-selected": tab === "list",
								"data-active": tab === "list" ? "" : void 0,
								onClick: () => {
									setTab("list");
								},
								children: tt("tab.list")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								className: `${skill_panel_module_css_default.tab} ${tab === "create" ? skill_panel_module_css_default.tabActive : ""}`,
								"data-dsh-part": "tab",
								"aria-selected": tab === "create",
								"data-active": tab === "create" ? "" : void 0,
								onClick: () => {
									setTab("create");
								},
								children: tt("tab.create")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: skill_panel_module_css_default.body,
							children: tab === "list" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ListTab, {
								api,
								refreshTick,
								onCwd: setCwd
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreateTab, {
								api,
								cwd
							})
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/panel-mount.tsx
		/**
		* Skill center panel mounting (browser half).
		*
		* The panel is an overlay modal rendered with its own React root appended to
		* document.body (no slot exists for external plugins). Opening mounts the
		* tree; closing unmounts and removes the container. The entry row toggles it
		* through the returned controller.
		*/
		/**
		* Mount the skill center overlay panel.
		* @param api - the skill center API client.
		* @returns controller (toggle/open/close) and the disposer.
		*/
		function mountPanel(api) {
			let root;
			let container;
			const close = () => {
				if (root === void 0) return;
				root.unmount();
				root = void 0;
				container?.remove();
				container = void 0;
			};
			const open = () => {
				if (root !== void 0) return;
				container = document.createElement("div");
				container.dataset.dshSkillExplorerView = "";
				container.dataset.dshPlugin = "skill-explorer";
				document.body.appendChild(container);
				root = (0, react_dom_client.createRoot)(container);
				root.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillPanel, {
					api,
					onClose: close
				}));
			};
			const toggle = () => {
				if (root !== void 0) close();
				else open();
			};
			return {
				toggle,
				open,
				close,
				dispose: close
			};
		}
		//#endregion
		//#region src/client/sidebar-entry-core.ts
		/** Find the sidebar shell root element, or undefined while not yet mounted. */
		function sidebarRoot() {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return void 0;
			return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild;
		}
		/** The New Session button: nested in the logo row on current shells, a direct child on legacy shells. */
		function newSessionButton(root) {
			const nested = root.querySelector("button[class*=\"newSession\"]");
			if (nested !== null) return nested;
			for (const child of root.children) if (child.tagName === "BUTTON") return child;
		}
		/** Build the entry row (a detached button; insert once the shell is up). */
		function createEntry(options) {
			const entry = document.createElement("button");
			entry.type = "button";
			entry.setAttribute(options.rowAttribute, "");
			if (options.plugin !== void 0) {
				entry.setAttribute("data-dsh-plugin", options.plugin);
				entry.setAttribute("data-dsh-part", "sidebar-entry");
			}
			entry.className = options.css["entry"] ?? "";
			entry.setAttribute("aria-label", options.label());
			if (options.tooltip !== void 0) entry.setAttribute("title", options.tooltip());
			entry.innerHTML = "<span class=\"" + (options.css["entryIcon"] ?? "") + "\">" + options.icon + "</span><span class=\"" + (options.css["entryLabel"] ?? "") + "\">" + options.label() + "</span>";
			entry.addEventListener("click", options.onToggle);
			return entry;
		}
		/** Re-insert the entry after the New Session row (before the browser region). */
		function placeEntry(root, entry, options) {
			const button = newSessionButton(root);
			if (button === void 0) return false;
			if (entry.parentElement !== root) {
				const row = button.closest("[class*=\"logoRow\"]");
				const base = row !== null && row.parentElement === root ? row : button;
				const family = Array.from(root.children).filter((el) => el instanceof HTMLElement && el.matches(options.familySelectors.join(", ")));
				const anchor = options.position === "before" ? family.length > 0 ? family[0] : base.nextElementSibling : family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling;
				root.insertBefore(entry, anchor);
			}
			return true;
		}
		/**
		* Mount the sidebar entry, waiting for the shell to render and self-healing
		* on later React re-renders.
		* @param options - the row's attribute/icon/copy/action/ordering configuration.
		* @returns disposer removing the entry and its observers.
		*/
		function mountSidebarEntry$1(options) {
			if (typeof document !== "undefined" && document.querySelector(options.rowSelector) !== null) return () => {};
			const entry = createEntry(options);
			let root;
			let placed = false;
			const tryPlace = () => {
				if (root !== void 0 && !root.isConnected) {
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				if (placed) {
					if (document.body.contains(entry)) return;
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				root ??= sidebarRoot();
				if (root === void 0) return;
				placed = placeEntry(root, entry, options);
				if (placed) rootObserver.observe(root, {
					childList: true,
					subtree: true
				});
			};
			const waitObserver = new MutationObserver(() => {
				tryPlace();
			});
			waitObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
			const rootObserver = new MutationObserver(() => {
				if (root === void 0 || !root.isConnected) {
					placed = false;
					tryPlace();
					return;
				}
				if (!root.contains(entry)) placed = placeEntry(root, entry, options);
			});
			const unsubscribeActive = options.active === void 0 ? void 0 : (() => {
				const syncActive = () => {
					if (options.active.isOpen()) entry.dataset.active = "true";
					else delete entry.dataset.active;
				};
				const unsubscribe = options.active.subscribe(syncActive);
				syncActive();
				return unsubscribe;
			})();
			tryPlace();
			return () => {
				waitObserver.disconnect();
				rootObserver.disconnect();
				unsubscribeActive?.();
				entry.remove();
			};
		}
		//#endregion
		//#region src/client/sidebar-entry.ts
		/**
		* Sidebar entry injection — package-specific wiring over the shared core.
		*
		* dsh's sidebar shell exposes no slot an external plugin can register into,
		* so — following the task-board / dsh-ssh precedent of DOM-level extension —
		* the entry row is injected between the shell's New Session button and the
		* workspace browser. The DOM injection / self-healing / idempotency logic
		* lives exactly once in shared/client/sidebar-entry-core.ts (synced copy);
		* this wrapper supplies the skill-explorer icon, copy, CSS module, and the
		* overlay toggle. The row is plain DOM (no React tree); clicking it toggles
		* the skill center overlay (see SkillPanel.tsx).
		*/
		/** Stable data attribute identifying the injected entry row. */
		const ENTRY_SELECTOR = "[data-dsh-skill-explorer-entry]";
		/** Inline book icon normalized to the shell's 18px navigation glyph size. */
		const ICON = "<svg viewBox=\"0 0 16 16\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 3.2C6.6 2 4.5 2 3 2v10.5c1.5 0 3.6 0 5 1.3 1.4-1.3 3.5-1.3 5-1.3V2c-1.5 0-3.6 0-5 1.2z\"/><path d=\"M8 3.2v10.6\"/></svg>";
		/**
		* Mount the sidebar entry, waiting for the shell to render and self-healing
		* on later React re-renders.
		* @param onClick - opens the skill center overlay.
		* @returns disposer removing the entry and its observers.
		*/
		function mountSidebarEntry(onClick) {
			return mountSidebarEntry$1({
				rowAttribute: "data-dsh-skill-explorer-entry",
				rowSelector: ENTRY_SELECTOR,
				plugin: "skill-explorer",
				icon: ICON,
				css: skill_panel_module_css_default,
				label: () => tt("entry.label"),
				tooltip: () => tt("entry.tooltip"),
				onToggle: onClick,
				position: "after",
				familySelectors: [
					"[data-dsh-taskboard-entry]",
					"[data-dsh-ssh-entry]",
					"[data-dsh-skill-explorer-entry]"
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace this plugin owns. */
		const NS = "dsh-skill-explorer";
		/** Required services (fiber inject waiting — the runtime must be up first). */
		const inject = ["slots", "locale"];
		/**
		* Mount the skill center surfaces.
		* @param ctx - client root context (locale service).
		*/
		function apply(ctx) {
			ctx.effect(() => {
				try {
					return ctx.locale.register(NS, {
						zh,
						en
					});
				} catch {
					return () => {};
				}
			}, "skill-explorer: dictionaries");
			const panel = mountPanel(new SkillApi());
			const disposers = [];
			try {
				disposers.push(mountSidebarEntry(() => panel.toggle()));
				disposers.push(() => panel.dispose());
			} catch (error) {
				console.warn("[skill-explorer] mount failed:", error);
			}
			ctx.effect(() => () => {
				for (const dispose of disposers.splice(0)) dispose();
			}, "skill-explorer: ui mounts");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map