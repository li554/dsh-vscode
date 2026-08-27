window.__ModuleLoader__.load({
	id: "@linxin666/dsh-client-ui-plugin-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/core/conflict.ts
		/**
		* Diff two plugin-control snapshots by id. Only entries present in both
		* snapshots with a changed state are reported; entries appearing or
		* disappearing are ordinary install/uninstall outcomes, not conflicts.
		* @param before - snapshot taken before the install.
		* @param after - snapshot taken after the install.
		* @returns one change per id whose state moved, in id order.
		*/
		function diffControls(before, after) {
			const afterById = new Map(after.map((item) => [item.id, item]));
			const changes = [];
			for (const item of before) {
				const current = afterById.get(item.id);
				if (current === void 0 || current.state === item.state) continue;
				changes.push({
					id: item.id,
					name: item.name,
					from: item.state,
					to: current.state
				});
			}
			return changes;
		}
		/**
		* Classify one control-state change for messaging. A change into `disabled`
		* is the conflict rule's action (reversible by re-enabling); a change out of
		* `disabled` is a manual undo; anything else is reported neutrally.
		* @param change - one diff entry.
		* @returns the message kind.
		*/
		function classifyChange(change) {
			if (change.to === "disabled") return "rule-disabled";
			if (change.from === "disabled") return "rule-enabled";
			return "state-change";
		}
		//#endregion
		//#region src/core/repair.ts
		/** Default copy (zh): the package's zh dictionary keys map onto these strings. */
		const DEFAULT_REPAIR_COPY = {
			installTitle: "正在修复插件安装失败",
			installSpecLabel: "安装目标",
			installErrorLabel: "安装错误",
			installAsk: "请在插件安装根目录内检查插件包或依赖并修复，然后重试安装。",
			failureTitle: "正在修复插件启动失败",
			failurePluginLabel: "插件",
			failureKindLabel: "失败类型",
			failureAtLabel: "时间",
			failureMessageLabel: "错误信息",
			failureStackLabel: "堆栈",
			failurePathLabel: "安装路径",
			failureAsk: "请修复插件后重新启用并重启 dsh web。",
			conflictTitle: "正在处理插件安装冲突",
			conflictPluginLabel: "冲突条目",
			conflictChangeLabel: "状态变化",
			conflictAsk: "请检查冲突双方的入口行 id 与挂载方式，消除重复挂载后告诉我如何重新启用。",
			kindNames: {
				"load-failure": "加载失败",
				hang: "启动挂起",
				"late-rejection": "迟到拒绝"
			},
			stateNames: {
				enabled: "已开启",
				disabled: "已关闭",
				uninstalled: "已卸载"
			}
		};
		/**
		* Seed text for a failed install: the target and the rendered error,
		* self-contained for the agent.
		* @param spec - the install target (npm spec or git URL) that failed.
		* @param error - the rendered install error text.
		* @param copy - localized fragments.
		* @returns the repair prompt text.
		*/
		function installRepairMessage(spec, error, copy = DEFAULT_REPAIR_COPY) {
			return [
				copy.installTitle,
				`${copy.installSpecLabel}: ${spec}`,
				`${copy.installErrorLabel}:\n${error}`,
				copy.installAsk
			].join("\n\n");
		}
		/**
		* Seed text for one boot-failure ring row: the failure record, so the agent
		* can attribute and fix it in place.
		* @param failure - the recorded failure row.
		* @param copy - localized fragments.
		* @returns the repair prompt text.
		*/
		function failureRepairMessage(failure, copy = DEFAULT_REPAIR_COPY) {
			const parts = [
				copy.failureTitle,
				`${copy.failurePluginLabel}: ${failure.pluginId || "-"}`,
				`${copy.failureKindLabel}: ${copy.kindNames[failure.kind] ?? failure.kind}`,
				`${copy.failureAtLabel}: ${failure.at}`,
				`${copy.failureMessageLabel}:\n${failure.message}`
			];
			if (failure.stack !== "") parts.push(`${copy.failureStackLabel}:\n${failure.stack}`);
			if (failure.installPath !== "") parts.push(`${copy.failurePathLabel}: ${failure.installPath}`);
			parts.push(copy.failureAsk);
			return parts.join("\n\n");
		}
		/**
		* Seed text for one install-conflict notice: the entry and its state change,
		* so the agent can attribute the conflict and resolve the double mount.
		* @param change - the conflict change (id, display name, from/to states).
		* @param copy - localized fragments.
		* @returns the repair prompt text.
		*/
		function conflictRepairMessage(change, copy = DEFAULT_REPAIR_COPY) {
			return [
				copy.conflictTitle,
				`${copy.conflictPluginLabel}: ${change.name} (${change.id})`,
				`${copy.conflictChangeLabel}: ${copy.stateNames[change.from] ?? change.from} -> ${copy.stateNames[change.to] ?? change.to}`,
				copy.conflictAsk
			].join("\n\n");
		}
		//#endregion
		//#region src/core/version.ts
		const MINIMUM_RANGE_PATTERN = /^>=\s*(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
		/**
		* The bare minimum version for display: strips the `>=` operator (and an
		* optional leading `v`) from a declared requirement so UI copy that already
		* contains the comparison operator renders `0.1.1-rc.1` instead of
		* `>= >=0.1.1-rc.1`. Unsupported range forms render unchanged.
		* @param minimum - the declared minimum range.
		* @returns the version portion for display.
		*/
		function displayMinimumVersion(minimum) {
			const match = MINIMUM_RANGE_PATTERN.exec(minimum.trim());
			return match === null ? minimum.trim() : match[1].replace(/^v/, "");
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-plugin-manager/src/client/plugin-manager.module.css.mjs
		const css = ".ZsMDKq_section{flex-direction:column;gap:12px;display:flex}.ZsMDKq_notice{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:8px;flex-direction:column;gap:8px;padding:16px;display:flex}.ZsMDKq_notice p{color:var(--dsw-alias-label-secondary);margin:0}.ZsMDKq_state{color:var(--dsw-alias-label-secondary);padding:16px 0}.ZsMDKq_installRow{gap:8px;display:flex}.ZsMDKq_spec{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0;color:var(--dsw-alias-label-primary);border-radius:6px;flex:1;padding:6px 10px}.ZsMDKq_spec:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary)}.ZsMDKq_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px}.ZsMDKq_progressRow{flex-direction:column;gap:6px;display:flex}.ZsMDKq_progressTrack{background:var(--dsw-alias-bg-layer-2);border-radius:3px;height:6px;overflow:hidden}.ZsMDKq_progressBar{background:var(--dsw-alias-state-business-primary);height:100%;transition:width .2s}.ZsMDKq_progressBar[data-indeterminate=true]{width:40%;animation:1.2s ease-in-out infinite ZsMDKq_pluginManagerIndeterminate}@keyframes ZsMDKq_pluginManagerIndeterminate{0%{transform:translate(-100%)}to{transform:translate(250%)}}.ZsMDKq_progressLabel{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px}@media (prefers-reduced-motion:reduce){.ZsMDKq_progressBar[data-indeterminate=true]{width:40%;animation:none}}.ZsMDKq_errorRow{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-danger);border-radius:8px;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;display:flex}.ZsMDKq_error{min-width:200px;color:var(--dsw-alias-label-danger);word-break:break-all;flex:1}.ZsMDKq_group{flex-direction:column;gap:8px;display:flex}.ZsMDKq_sectionTitle{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;font-weight:600}.ZsMDKq_list{flex-direction:column;gap:8px;margin:0;padding:0;list-style:none;display:flex}.ZsMDKq_row{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:8px;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 12px;display:flex}.ZsMDKq_meta{flex-direction:column;gap:4px;min-width:0;display:flex}.ZsMDKq_name{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-weight:600;overflow:hidden}.ZsMDKq_sub{color:var(--dsw-alias-label-tertiary);flex-wrap:wrap;align-items:center;gap:6px;min-width:0;font-size:12px;display:flex}.ZsMDKq_version{white-space:nowrap}.ZsMDKq_sourceBadge{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);border-radius:4px;padding:0 4px;font-size:11px}.ZsMDKq_specText{text-overflow:ellipsis;white-space:nowrap;max-width:320px;overflow:hidden}.ZsMDKq_latest{color:var(--dsw-alias-state-business-primary);font-size:12px}.ZsMDKq_compatHint{color:var(--dsw-alias-label-tertiary);font-size:12px}.ZsMDKq_compatBlocked{color:var(--dsw-alias-label-danger);font-size:12px}.ZsMDKq_actions{flex-shrink:0;align-items:center;gap:8px;display:flex}.ZsMDKq_empty{color:var(--dsw-alias-label-tertiary);margin:0}.ZsMDKq_link{color:var(--dsw-alias-state-business-primary)}.ZsMDKq_stateLabel{color:var(--dsw-alias-label-secondary);font-size:12px}.ZsMDKq_stateLabel[data-state=enabled]{color:var(--dsw-alias-state-success-primary)}.ZsMDKq_stateLabel[data-state=disabled]{color:var(--dsw-alias-label-tertiary)}.ZsMDKq_switch{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;border-radius:10px;width:34px;height:20px;padding:0;transition:background .2s;position:relative}.ZsMDKq_switch:after{content:\"\";background:var(--dsw-alias-label-on-danger,#fff);border-radius:50%;width:14px;height:14px;transition:transform .2s;position:absolute;top:2px;left:2px}.ZsMDKq_switch[aria-checked=true]{background:var(--dsw-alias-state-success-primary)}.ZsMDKq_switch[aria-checked=true]:after{transform:translate(14px)}.ZsMDKq_switch:disabled{opacity:.5;cursor:not-allowed}.ZsMDKq_switch:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary)}@media (prefers-reduced-motion:reduce){.ZsMDKq_switch,.ZsMDKq_switch:after{transition:none}}.ZsMDKq_failure{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-danger);border-radius:6px;flex-direction:column;gap:6px;margin-top:4px;padding:8px;display:flex}.ZsMDKq_badge{background:var(--dsw-alias-label-danger);color:var(--dsw-alias-label-on-danger);border-radius:10px;align-self:flex-start;padding:2px 8px;font-size:11px}.ZsMDKq_failureMessage{color:var(--dsw-alias-label-danger);word-break:break-all;font-size:12px}.ZsMDKq_failureActions{flex-wrap:wrap;gap:8px;display:flex}.ZsMDKq_conflicts{flex-direction:column;gap:8px;display:flex}.ZsMDKq_actionsRow{align-items:center;gap:12px;display:flex}.ZsMDKq_ok{color:var(--dsw-alias-state-success-primary);margin:0;font-size:12px}.ZsMDKq_applying{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px}.ZsMDKq_restartRow{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-brand);border-radius:8px;padding:10px 12px}.ZsMDKq_restartRow p{color:var(--dsw-alias-brand-primary);margin:0}.ZsMDKq_safeModeBanner{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-warning);border-radius:8px;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;display:flex}.ZsMDKq_safeModeBanner p{color:var(--dsw-alias-label-primary);margin:0}.ZsMDKq_confirmBody{color:var(--dsw-alias-label-secondary);margin:0 0 12px}.ZsMDKq_modalActions{justify-content:flex-end;gap:8px;display:flex}.ZsMDKq_dangerButton{background:var(--dsw-alias-label-danger)!important;color:var(--dsw-alias-label-on-danger)!important}";
		const tagId = "@linxin666/dsh-client-ui-plugin-manager/plugin-manager.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plugin-manager";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var plugin_manager_module_css_default = {
			"actions": "ZsMDKq_actions",
			"actionsRow": "ZsMDKq_actionsRow",
			"applying": "ZsMDKq_applying",
			"badge": "ZsMDKq_badge",
			"compatBlocked": "ZsMDKq_compatBlocked",
			"compatHint": "ZsMDKq_compatHint",
			"confirmBody": "ZsMDKq_confirmBody",
			"conflicts": "ZsMDKq_conflicts",
			"dangerButton": "ZsMDKq_dangerButton",
			"empty": "ZsMDKq_empty",
			"error": "ZsMDKq_error",
			"errorRow": "ZsMDKq_errorRow",
			"failure": "ZsMDKq_failure",
			"failureActions": "ZsMDKq_failureActions",
			"failureMessage": "ZsMDKq_failureMessage",
			"group": "ZsMDKq_group",
			"hint": "ZsMDKq_hint",
			"installRow": "ZsMDKq_installRow",
			"latest": "ZsMDKq_latest",
			"link": "ZsMDKq_link",
			"list": "ZsMDKq_list",
			"meta": "ZsMDKq_meta",
			"modalActions": "ZsMDKq_modalActions",
			"name": "ZsMDKq_name",
			"notice": "ZsMDKq_notice",
			"ok": "ZsMDKq_ok",
			"pluginManagerIndeterminate": "ZsMDKq_pluginManagerIndeterminate",
			"progressBar": "ZsMDKq_progressBar",
			"progressLabel": "ZsMDKq_progressLabel",
			"progressRow": "ZsMDKq_progressRow",
			"progressTrack": "ZsMDKq_progressTrack",
			"restartRow": "ZsMDKq_restartRow",
			"row": "ZsMDKq_row",
			"safeModeBanner": "ZsMDKq_safeModeBanner",
			"section": "ZsMDKq_section",
			"sectionTitle": "ZsMDKq_sectionTitle",
			"sourceBadge": "ZsMDKq_sourceBadge",
			"spec": "ZsMDKq_spec",
			"specText": "ZsMDKq_specText",
			"state": "ZsMDKq_state",
			"stateLabel": "ZsMDKq_stateLabel",
			"sub": "ZsMDKq_sub",
			"switch": "ZsMDKq_switch",
			"version": "ZsMDKq_version"
		};
		//#endregion
		//#region src/client/PluginManagerTab.tsx
		/**
		* The plugin-manager tab: an install box, one row per installed user plugin
		* (next-start enablement switch, source badge, update availability, update and
		* uninstall actions, per-plugin boot-failure block), the built-in product
		* switches, an install-conflict notice (the diff of the plugin-control
		* snapshot around each install, reversible through the product switch), and
		* the failure-repair affordances. Enablement switches and installs persist
		* through the official host channels and apply at the next restart; the web
		* build shows a restart hint instead of an in-place restart.
		*
		* This tab registers into the official Plugins settings section
		* (`settings.plugins.tab` slot) next to the official installer tab; its added
		* value over that tab is the conflict ledger, the bilingual repair seeds, and
		* the family card vocabulary.
		*/
		/** Error text for a caught request or lifecycle failure. */
		function messageOf(error) {
			if (error instanceof AggregateError) {
				const details = error.errors.map(messageOf).join("; ");
				return details === "" ? error.message : `${error.message}: ${details}`;
			}
			return error instanceof Error ? error.message : String(error);
		}
		/** Localized fragments for the repair seed builders, read from the tab's dictionaries. */
		function repairCopy(t) {
			return {
				installTitle: t("repairInstallTitle"),
				installSpecLabel: t("repairInstallSpecLabel"),
				installErrorLabel: t("repairInstallErrorLabel"),
				installAsk: t("repairInstallAsk"),
				failureTitle: t("repairFailureTitle"),
				failurePluginLabel: t("repairFailurePluginLabel"),
				failureKindLabel: t("repairFailureKindLabel"),
				failureAtLabel: t("repairFailureAtLabel"),
				failureMessageLabel: t("repairFailureMessageLabel"),
				failureStackLabel: t("repairFailureStackLabel"),
				failurePathLabel: t("repairFailurePathLabel"),
				failureAsk: t("repairFailureAsk"),
				kindNames: {
					"load-failure": t("repairKindLoad"),
					hang: t("repairKindHang"),
					"late-rejection": t("repairKindLate")
				},
				conflictTitle: t("repairConflictTitle"),
				conflictPluginLabel: t("repairConflictPluginLabel"),
				conflictChangeLabel: t("repairConflictChangeLabel"),
				conflictAsk: t("repairConflictAsk"),
				stateNames: {
					enabled: t("repairStateEnabled"),
					disabled: t("repairStateDisabled"),
					uninstalled: t("repairStateUninstalled")
				}
			};
		}
		/** Localized label for one install phase, with percent when the download has one. */
		function progressLabel(progress, t) {
			if (progress.stage === "fetch") return t("fetching");
			if (progress.stage === "extract") return t("extracting");
			if (progress.stage === "write") return t("writing");
			return progress.percent === void 0 ? t("downloading") : t("downloadingPercent", { percent: String(progress.percent) });
		}
		/** The plugin-manager settings tab. */
		function PluginManagerTab(props) {
			const { t, isLoopback, list, install, update, uninstall, setEnabled, checkUpdates, status, failures, setSafeMode, repairPlugin, controlsList, controlsSetEnabled, lastInstallConflicts } = props;
			const [view, setView] = (0, react.useState)({ status: "loading" });
			const [busy, setBusy] = (0, react.useState)(void 0);
			const [toggleBusy, setToggleBusy] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)(void 0);
			const [failedSpec, setFailedSpec] = (0, react.useState)(void 0);
			const [installError, setInstallError] = (0, react.useState)(void 0);
			const [spec, setSpec] = (0, react.useState)("");
			const [dirty, setDirty] = (0, react.useState)(false);
			const [repairing, setRepairing] = (0, react.useState)(void 0);
			const [copied, setCopied] = (0, react.useState)(void 0);
			const [updates, setUpdates] = (0, react.useState)(/* @__PURE__ */ new Map());
			const [uninstallTarget, setUninstallTarget] = (0, react.useState)(void 0);
			const [conflicts, setConflicts] = (0, react.useState)([]);
			const [progress, setProgress] = (0, react.useState)({
				kind: "idle",
				stage: "fetch"
			});
			/** Synchronous in-flight mirror of `busy`: the render-time guard alone lets a
			* click and an Enter land in the same frame and double-fire. */
			const busyRef = (0, react.useRef)(false);
			/** Reload every snapshot into the ready view. */
			const reload = async () => {
				const [plugins, controls, failureSnapshot] = await Promise.all([
					list(),
					controlsList(),
					failures()
				]);
				setView({
					status: "ready",
					plugins,
					controls,
					failures: failureSnapshot
				});
			};
			(0, react.useEffect)(() => {
				let cancelled = false;
				reload().catch(() => {
					if (!cancelled) setView({ status: "error" });
				});
				return () => {
					cancelled = true;
				};
			}, []);
			/** One row/form operation: busy state, error row, dirty flag on success. */
			const run = async (action, body) => {
				if (busyRef.current) return;
				busyRef.current = true;
				setBusy(action);
				setError(void 0);
				try {
					await body();
					setDirty(true);
				} catch (reason) {
					setError(t("failed", { reason: messageOf(reason) }));
				} finally {
					busyRef.current = false;
					setBusy(void 0);
				}
			};
			/** Install one spec, then diff the product snapshot into a conflict notice. */
			const onInstall = () => {
				const target = spec.trim();
				if (target === "" || busy !== void 0 || busyRef.current) return;
				(async () => {
					busyRef.current = true;
					const before = view.status === "ready" ? view.controls : await controlsList().catch(() => []);
					setBusy({ kind: "install" });
					setError(void 0);
					setFailedSpec(void 0);
					setInstallError(void 0);
					try {
						await install(target);
						setSpec("");
						setDirty(true);
						const after = await controlsList().catch(() => []);
						setConflicts(lastInstallConflicts !== void 0 ? lastInstallConflicts() : diffControls(before, after));
						await reload();
					} catch (reason) {
						const reasonText = messageOf(reason);
						setFailedSpec(target);
						setInstallError(reasonText);
						setError(t("failed", { reason: reasonText }));
					} finally {
						busyRef.current = false;
						setBusy(void 0);
					}
				})();
			};
			/** Poll install/update progress while such an operation is in flight. */
			(0, react.useEffect)(() => {
				if (busy === void 0 || busy.kind !== "install" && busy.kind !== "update") {
					setProgress({
						kind: "idle",
						stage: "fetch"
					});
					return;
				}
				let stopped = false;
				let timer;
				const tick = (delay) => {
					timer = setTimeout(() => {
						status().then((next) => {
							if (!stopped && next !== void 0) {
								setProgress(next);
								tick(400);
							}
						}).catch(() => {});
					}, delay);
				};
				tick(100);
				return () => {
					stopped = true;
					if (timer !== void 0) clearTimeout(timer);
				};
			}, [busy, status]);
			const toggleDisabled = busy !== void 0 || toggleBusy !== void 0 || view.status === "ready" && view.failures.safeMode;
			const onUserToggle = (id, enabled) => {
				setToggleBusy({
					kind: "user",
					id
				});
				setError(void 0);
				setEnabled(id, enabled).then((plugin) => {
					setView((current) => current.status === "ready" ? {
						...current,
						plugins: current.plugins.map((item) => item.id === id ? plugin : item)
					} : current);
					setDirty(true);
					setToggleBusy(void 0);
				}).catch((reason) => {
					setError(t("failed", { reason: messageOf(reason) }));
					setToggleBusy(void 0);
				});
			};
			const onProductToggle = (id, enabled) => {
				setToggleBusy({
					kind: "product",
					id
				});
				setError(void 0);
				controlsSetEnabled(id, enabled).then((controls) => {
					setView((current) => current.status === "ready" ? {
						...current,
						controls
					} : current);
					setConflicts((previous) => previous.filter((change) => change.id !== id));
					setDirty(true);
					setToggleBusy(void 0);
				}).catch((reason) => {
					setError(t("failed", { reason: messageOf(reason) }));
					setToggleBusy(void 0);
				});
			};
			const onCheck = () => {
				run({ kind: "check" }, async () => {
					const found = await checkUpdates();
					setUpdates(new Map(found.map((item) => [item.id, item])));
				});
			};
			const onUpdate = (id) => {
				run({
					kind: "update",
					id
				}, async () => {
					await update(id);
					setUpdates((previous) => {
						const next = new Map(previous);
						next.delete(id);
						return next;
					});
					await reload();
				});
			};
			const onUninstall = () => {
				const target = uninstallTarget;
				if (target === void 0) return;
				run({
					kind: "uninstall",
					id: target.id
				}, async () => {
					await uninstall(target.id);
					setUninstallTarget(void 0);
					await reload();
				});
			};
			/** Open a repair conversation seeded with one boot-failure record. `token`
			* identifies the row for the in-flight label (plugin id, or a row key for
			* unattributable failures). */
			const onRepair = (failure, token) => {
				if (view.status !== "ready" || busy !== void 0 || repairing !== void 0) return;
				setError(void 0);
				setRepairing(token);
				repairPlugin(view.failures.pluginRoot, failureRepairMessage(failure, repairCopy(t))).then(() => {
					setRepairing(void 0);
				}).catch((reason) => {
					setError(t("failed", { reason: messageOf(reason) }));
					setRepairing(void 0);
				});
			};
			/** Hand the latest failed install off to a repair conversation over the
			* install root. The seed carries the install's own error (installError), not
			* whatever error the row currently shows. */
			const onRepairInstall = () => {
				if (view.status !== "ready" || repairing !== void 0) return;
				setError(void 0);
				setRepairing("install");
				repairPlugin(view.failures.pluginRoot, installRepairMessage(failedSpec ?? "", installError ?? "", repairCopy(t))).then(() => {
					setError(void 0);
					setFailedSpec(void 0);
					setInstallError(void 0);
					setRepairing(void 0);
				}).catch((reason) => {
					setError(t("failed", { reason: messageOf(reason) }));
					setRepairing(void 0);
				});
			};
			/** Copy a boot failure's message and stack for a manual repair conversation. */
			const onCopy = (failure, token) => {
				navigator.clipboard.writeText(`${failure.message}\n\n${failure.stack}`).then(() => {
					setCopied(token);
				}).catch(() => {
					setError(t("failed", { reason: "clipboard unavailable" }));
				});
			};
			const onExitSafeMode = () => {
				if (busy !== void 0) return;
				setError(void 0);
				setSafeMode(false).then(() => {
					setDirty(true);
					reload().catch((reason) => {
						setError(t("failed", { reason: messageOf(reason) }));
					});
				}).catch((reason) => {
					setError(t("failed", { reason: messageOf(reason) }));
				});
			};
			/** Undo one conflict action by flipping the product switch back. */
			const onUndoConflict = (change) => {
				if (change.to !== "disabled") return;
				onProductToggle(change.id, true);
			};
			/** Hand one conflict notice off to a repair conversation over the plugin root. */
			const onRepairConflict = (change) => {
				if (view.status !== "ready" || busy !== void 0 || repairing !== void 0) return;
				setError(void 0);
				const token = `conflict:${change.id}`;
				setRepairing(token);
				repairPlugin(view.failures.pluginRoot, conflictRepairMessage({
					id: change.id,
					name: change.name,
					from: change.from === "enabled" || change.from === "disabled" ? change.from : "uninstalled",
					to: change.to === "enabled" || change.to === "disabled" ? change.to : "uninstalled"
				}, repairCopy(t))).then(() => {
					setRepairing(void 0);
				}).catch((reason) => {
					setError(t("failed", { reason: messageOf(reason) }));
					setRepairing(void 0);
				});
			};
			if (!isLoopback) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: plugin_manager_module_css_default.notice,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("localOnlyTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("localOnlyBody") })]
			});
			if (view.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: plugin_manager_module_css_default.state,
				children: t("loading")
			});
			if (view.status === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: plugin_manager_module_css_default.state,
				children: t("failed", { reason: "load" })
			});
			const attributable = new Map(view.failures.items.filter((item) => item.pluginId !== "").map((item) => [item.pluginId, item]));
			const unattributable = view.failures.items.filter((item) => item.pluginId === "");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: plugin_manager_module_css_default.section,
				"aria-busy": busy !== void 0 || toggleBusy !== void 0,
				children: [
					view.failures.safeMode && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: plugin_manager_module_css_default.safeModeBanner,
						"data-safe-mode": true,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("safeModeBanner") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: busy !== void 0,
							onClick: onExitSafeMode,
							children: t("exitSafeMode")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: plugin_manager_module_css_default.installRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: plugin_manager_module_css_default.spec,
							type: "text",
							value: spec,
							placeholder: t("installPlaceholder"),
							disabled: busy !== void 0,
							onChange: (event) => {
								setSpec(event.target.value);
							},
							onKeyDown: (event) => {
								if (event.key === "Enter" && spec.trim() !== "" && busy === void 0) onInstall();
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: spec.trim() === "" || busy !== void 0,
							onClick: onInstall,
							children: busy !== void 0 && busy.kind === "install" ? t("installing") : t("install")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: plugin_manager_module_css_default.hint,
						children: t("installHint")
					}),
					(busy?.kind === "install" || busy?.kind === "update") && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: plugin_manager_module_css_default.progressRow,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: plugin_manager_module_css_default.progressTrack,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: plugin_manager_module_css_default.progressBar,
								style: progress.percent === void 0 ? void 0 : { width: `${progress.percent}%` },
								"data-indeterminate": progress.percent === void 0 ? "true" : void 0
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: plugin_manager_module_css_default.progressLabel,
							children: progressLabel(progress, t)
						})]
					}),
					error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: plugin_manager_module_css_default.errorRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: plugin_manager_module_css_default.error,
							children: error
						}), failedSpec !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: repairing !== void 0,
							onClick: onRepairInstall,
							children: repairing === "install" ? t("repairing") : t("repair")
						})]
					}),
					conflicts.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: plugin_manager_module_css_default.conflicts,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: plugin_manager_module_css_default.sectionTitle,
								children: t("conflictTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: plugin_manager_module_css_default.list,
								children: conflicts.map((change) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
									className: plugin_manager_module_css_default.row,
									"data-conflict": change.id,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: plugin_manager_module_css_default.meta,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: plugin_manager_module_css_default.name,
											children: change.name
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: plugin_manager_module_css_default.sub,
											children: classifyChange(change) === "rule-disabled" ? t("conflictDisabled", { name: change.name }) : classifyChange(change) === "rule-enabled" ? t("conflictEnabled", { name: change.name }) : t("conflictChanged", { name: change.name })
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: plugin_manager_module_css_default.actions,
										children: [change.to === "disabled" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											disabled: toggleDisabled,
											onClick: () => {
												onUndoConflict(change);
											},
											children: t("undoConflict")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											disabled: busy !== void 0 || repairing !== void 0,
											onClick: () => {
												onRepairConflict(change);
											},
											children: repairing === `conflict:${change.id}` ? t("repairing") : t("repair")
										})]
									})]
								}, change.id))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: plugin_manager_module_css_default.hint,
								children: t("conflictHint")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: plugin_manager_module_css_default.group,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: plugin_manager_module_css_default.sectionTitle,
							children: t("userPlugins")
						}), view.plugins.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: plugin_manager_module_css_default.empty,
							children: t("empty")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: plugin_manager_module_css_default.list,
							children: view.plugins.map((plugin) => {
								const updateItem = updates.get(plugin.id);
								const latest = updateItem?.latest;
								const dshRequirement = updateItem?.requiresDsh;
								const failure = attributable.get(plugin.id);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
									className: plugin_manager_module_css_default.row,
									"data-plugin-id": plugin.id,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: plugin_manager_module_css_default.meta,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: plugin_manager_module_css_default.name,
												children: plugin.name
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: plugin_manager_module_css_default.sub,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: plugin_manager_module_css_default.version,
														children: t("version", { version: plugin.version })
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: plugin_manager_module_css_default.sourceBadge,
														"data-source": plugin.source.kind,
														children: plugin.source.kind === "npm" ? t("npmSource") : t("gitSource")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: plugin_manager_module_css_default.specText,
														title: plugin.source.spec,
														children: plugin.source.spec
													})
												]
											}),
											latest !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: plugin_manager_module_css_default.latest,
												children: t("latest", { version: latest })
											}),
											updateItem !== void 0 && dshRequirement !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: updateItem.compatible === false ? plugin_manager_module_css_default.compatBlocked : plugin_manager_module_css_default.compatHint,
												children: updateItem.compatible === false ? t("updateBlockedDsh", { min: displayMinimumVersion(dshRequirement) }) : t("updateRequiresDsh", { min: displayMinimumVersion(dshRequirement) })
											}),
											failure !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: plugin_manager_module_css_default.failure,
												"data-plugin-failure": plugin.id,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: plugin_manager_module_css_default.badge,
														children: t("failureBadge")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: plugin_manager_module_css_default.failureMessage,
														title: failure.message,
														children: failure.message
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: plugin_manager_module_css_default.failureActions,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
															variant: "primary",
															disabled: busy !== void 0 || repairing !== void 0,
															onClick: () => {
																onRepair(failure, plugin.id);
															},
															children: repairing === plugin.id ? t("repairing") : t("repair")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
															variant: "outline",
															disabled: busy !== void 0,
															onClick: () => {
																onCopy(failure, plugin.id);
															},
															children: copied === plugin.id ? t("copied") : t("copyError")
														})]
													})
												]
											})
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: plugin_manager_module_css_default.actions,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: plugin_manager_module_css_default.stateLabel,
												"data-state": plugin.enabled ? "enabled" : "disabled",
												children: plugin.enabled ? t("enabled") : t("disabled")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												role: "switch",
												"aria-checked": plugin.enabled,
												"aria-label": plugin.enabled ? t("disableSwitch", { name: plugin.name }) : t("enableSwitch", { name: plugin.name }),
												className: plugin_manager_module_css_default.switch,
												disabled: toggleDisabled,
												onClick: () => {
													onUserToggle(plugin.id, !plugin.enabled);
												}
											}),
											latest !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												variant: "outline",
												disabled: busy !== void 0 || updateItem?.compatible === false,
												onClick: () => {
													onUpdate(plugin.id);
												},
												children: busy?.kind === "update" && busy.id === plugin.id ? t("updating") : t("update")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												variant: "outline",
												disabled: busy !== void 0,
												onClick: () => {
													setUninstallTarget({
														id: plugin.id,
														name: plugin.name
													});
												},
												children: t("uninstall")
											})
										]
									})]
								}, plugin.id);
							})
						})]
					}),
					view.controls.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: plugin_manager_module_css_default.group,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: plugin_manager_module_css_default.sectionTitle,
							children: t("products")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: plugin_manager_module_css_default.list,
							children: view.controls.map((control) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: plugin_manager_module_css_default.row,
								"data-product-id": control.id,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: plugin_manager_module_css_default.meta,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: plugin_manager_module_css_default.name,
										children: control.name
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: plugin_manager_module_css_default.sub,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
											className: plugin_manager_module_css_default.link,
											href: control.repository,
											target: "_blank",
											rel: "noreferrer",
											children: t("source")
										})
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: plugin_manager_module_css_default.actions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: plugin_manager_module_css_default.stateLabel,
										"data-state": control.state,
										children: t(control.state)
									}), control.state === "enabled" || control.state === "disabled" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										role: "switch",
										"aria-checked": control.state === "enabled",
										"aria-label": control.state === "enabled" ? t("disableSwitch", { name: control.name }) : t("enableSwitch", { name: control.name }),
										className: plugin_manager_module_css_default.switch,
										disabled: toggleDisabled,
										onClick: () => {
											onProductToggle(control.id, control.state !== "enabled");
										}
									}) : null]
								})]
							}, control.id))
						})]
					}),
					unattributable.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: plugin_manager_module_css_default.group,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: plugin_manager_module_css_default.sectionTitle,
							children: t("failureGroupTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: plugin_manager_module_css_default.list,
							children: unattributable.map((failure, index) => {
								const token = `other:${index}`;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
									className: plugin_manager_module_css_default.row,
									"data-plugin-failure": "other",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: plugin_manager_module_css_default.meta,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: plugin_manager_module_css_default.badge,
												children: t("failureBadge")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: plugin_manager_module_css_default.failureMessage,
												title: failure.message,
												children: failure.message
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: plugin_manager_module_css_default.failureActions,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
													variant: "primary",
													disabled: busy !== void 0 || repairing !== void 0,
													onClick: () => {
														onRepair(failure, token);
													},
													children: repairing === token ? t("repairing") : t("repair")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
													variant: "outline",
													disabled: busy !== void 0,
													onClick: () => {
														onCopy(failure, token);
													},
													children: copied === token ? t("copied") : t("copyError")
												})]
											})
										]
									})
								}, `${failure.at}-${index}`);
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: plugin_manager_module_css_default.actionsRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: busy !== void 0,
							onClick: onCheck,
							children: busy?.kind === "check" ? t("checking") : t("checkUpdates")
						}), updates.size === 0 && busy === void 0 && view.plugins.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: plugin_manager_module_css_default.ok,
							children: t("noUpdates")
						})]
					}),
					toggleBusy !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: plugin_manager_module_css_default.applying,
						"aria-live": "polite",
						children: t("applying")
					}),
					dirty && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: plugin_manager_module_css_default.restartRow,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("restartHint") })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						title: t("uninstallConfirmTitle"),
						open: uninstallTarget !== void 0,
						onClose: () => {
							setUninstallTarget(void 0);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: plugin_manager_module_css_default.confirmBody,
							children: t("uninstallConfirmBody", { name: uninstallTarget?.name ?? "" })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: plugin_manager_module_css_default.modalActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								disabled: busy !== void 0,
								onClick: () => {
									setUninstallTarget(void 0);
								},
								children: t("cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								className: plugin_manager_module_css_default.dangerButton,
								disabled: busy !== void 0,
								onClick: onUninstall,
								children: t("confirm")
							})]
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Locale dictionaries for the plugin-manager tab. The zh dictionary is the
		* key source; the en dictionary mirrors the exact key set.
		* @module @linxin666/dsh-client-ui-plugin-manager/client
		*/
		/** Simplified Chinese copy (the key-set source of truth). */
		const STATIC_ZH = {
			tab: "插件管理",
			loading: "正在读取插件…",
			empty: "尚未安装任何用户插件。",
			userPlugins: "用户插件",
			products: "内置产品",
			conflictTitle: "安装冲突",
			conflictDisabled: "已自动禁用 {name}，避免重复挂载。",
			conflictEnabled: "已重新启用 {name}。",
			conflictChanged: "{name} 的状态已变更。",
			undoConflict: "撤销",
			conflictHint: "冲突动作在安装时自动执行，撤销会写回开关并在重启后生效。",
			installPlaceholder: "npm 包名（如 @scope/name）或 git 仓库 URL",
			install: "安装",
			installing: "安装中…",
			installHint: "在 GitHub 或 npm 找到插件后，粘贴其 npm 包名或仓库地址安装；应用重启后插件生效。",
			version: "已安装 {version}",
			latest: "最新 {version}",
			update: "更新",
			updating: "更新中…",
			checkUpdates: "检查更新",
			checking: "检查中…",
			noUpdates: "所有插件都是最新版本。",
			updateRequiresDsh: "需要 DSH ≥ {min}",
			updateBlockedDsh: "需要 DSH ≥ {min}，请先升级 DSH 再更新",
			uninstall: "卸载",
			uninstallConfirmTitle: "卸载插件",
			uninstallConfirmBody: "将删除 {name} 的安装目录与配置行，并在重启后生效。",
			confirm: "确认卸载",
			cancel: "取消",
			restartHint: "插件变更将在重启应用后生效。",
			failed: "操作失败：{reason}",
			enabled: "已开启",
			disabled: "已关闭",
			mixed: "部分开启",
			unavailable: "不可用",
			uninstalled: "已卸载",
			source: "查看源码",
			applying: "正在应用更改…",
			fetching: "正在获取插件信息…",
			downloading: "正在下载…",
			downloadingPercent: "正在下载 {percent}%",
			extracting: "正在解压…",
			writing: "正在写入配置…",
			localOnlyTitle: "仅限本机操作",
			localOnlyBody: "为了保护主机配置，插件管理只能从本机打开。",
			failureBadge: "启动失败",
			failureGroupTitle: "其他启动失败",
			repair: "让 Agent 修复",
			repairing: "正在创建修复对话…",
			copyError: "复制错误",
			copied: "已复制",
			safeModeBanner: "安全模式：用户插件配置已跳过，插件开关不可用。",
			exitSafeMode: "恢复正常模式并重启",
			npmSource: "npm",
			gitSource: "git",
			enableSwitch: "开启 {name}",
			disableSwitch: "关闭 {name}",
			repairInstallTitle: "插件安装失败，请帮我诊断并修复。",
			repairInstallSpecLabel: "安装目标",
			repairInstallErrorLabel: "错误信息",
			repairInstallAsk: "请检查该插件并重新安装；完成后告诉我结果。",
			repairFailureTitle: "插件上次启动失败。请修复它。",
			repairFailurePluginLabel: "插件",
			repairFailureKindLabel: "失败类型",
			repairFailureAtLabel: "时间",
			repairFailureMessageLabel: "失败详情",
			repairFailureStackLabel: "原始堆栈",
			repairFailurePathLabel: "插件安装目录",
			repairFailureAsk: "请检查并修复该插件；修复完成后告诉我如何重新启用。",
			repairKindLoad: "加载失败",
			repairKindHang: "启动挂起",
			repairKindLate: "迟到拒绝",
			repairConflictTitle: "正在处理插件安装冲突",
			repairConflictPluginLabel: "冲突条目",
			repairConflictChangeLabel: "状态变化",
			repairConflictAsk: "请检查冲突双方的入口行 id 与挂载方式，消除重复挂载后告诉我如何重新启用。",
			repairStateEnabled: "已开启",
			repairStateDisabled: "已关闭",
			repairStateUninstalled: "已卸载"
		};
		/** English copy, checked complete against the zh key set. */
		const STATIC_EN = {
			tab: "Plugin manager",
			loading: "Reading plugins…",
			empty: "No user plugins installed yet.",
			userPlugins: "User plugins",
			products: "Built-in products",
			conflictTitle: "Install conflicts",
			conflictDisabled: "Automatically disabled {name} to avoid double mounting.",
			conflictEnabled: "Re-enabled {name}.",
			conflictChanged: "The state of {name} changed.",
			undoConflict: "Undo",
			conflictHint: "Conflict actions run automatically at install time; undoing writes the switch back and applies after a restart.",
			installPlaceholder: "npm package (e.g. @scope/name) or git repository URL",
			install: "Install",
			installing: "Installing…",
			installHint: "Find a plugin on GitHub or npm, then paste its npm package name or repository URL; plugins load after a restart.",
			version: "Installed {version}",
			latest: "Latest {version}",
			update: "Update",
			updating: "Updating…",
			checkUpdates: "Check for updates",
			checking: "Checking…",
			noUpdates: "All plugins are up to date.",
			updateRequiresDsh: "Requires DSH >= {min}",
			updateBlockedDsh: "Requires DSH >= {min}; upgrade DSH before updating",
			uninstall: "Uninstall",
			uninstallConfirmTitle: "Uninstall plugin",
			uninstallConfirmBody: "{name} and its configuration row will be removed; the change applies after a restart.",
			confirm: "Uninstall",
			cancel: "Cancel",
			restartHint: "Plugin changes take effect after restarting the application.",
			failed: "Operation failed: {reason}",
			enabled: "On",
			disabled: "Off",
			mixed: "Partially on",
			unavailable: "Unavailable",
			uninstalled: "Uninstalled",
			source: "View source",
			applying: "Applying change…",
			fetching: "Fetching plugin metadata…",
			downloading: "Downloading…",
			downloadingPercent: "Downloading {percent}%",
			extracting: "Extracting…",
			writing: "Writing configuration…",
			localOnlyTitle: "Available on this computer only",
			localOnlyBody: "To protect host configuration, plugin management is only available from a local browser.",
			failureBadge: "Startup failure",
			failureGroupTitle: "Other startup failures",
			repair: "Ask the agent to fix",
			repairing: "Opening repair conversation…",
			copyError: "Copy error",
			copied: "Copied",
			safeModeBanner: "Safe mode: user plugin configuration is skipped; plugin switches are disabled.",
			exitSafeMode: "Restore normal mode and restart",
			npmSource: "npm",
			gitSource: "git",
			enableSwitch: "Turn on {name}",
			disableSwitch: "Turn off {name}",
			repairInstallTitle: "The plugin installation failed. Please diagnose and fix it.",
			repairInstallSpecLabel: "Install target",
			repairInstallErrorLabel: "Error message",
			repairInstallAsk: "Please inspect the plugin and reinstall it; tell me when it is done.",
			repairFailureTitle: "A plugin failed to start last time. Please fix it.",
			repairFailurePluginLabel: "Plugin",
			repairFailureKindLabel: "Failure kind",
			repairFailureAtLabel: "At",
			repairFailureMessageLabel: "Failure details",
			repairFailureStackLabel: "Original stack",
			repairFailurePathLabel: "Plugin install directory",
			repairFailureAsk: "Please inspect and fix the plugin; tell me how to re-enable it afterwards.",
			repairKindLoad: "Load failure",
			repairKindHang: "Startup hang",
			repairKindLate: "Late rejection",
			repairConflictTitle: "Handling a plugin install conflict",
			repairConflictPluginLabel: "Conflicting entry",
			repairConflictChangeLabel: "State change",
			repairConflictAsk: "Inspect the entry ids and mounting of both sides, resolve the double mount, and tell me how to re-enable.",
			repairStateEnabled: "On",
			repairStateDisabled: "Off",
			repairStateUninstalled: "Uninstalled"
		};
		const zh = STATIC_ZH;
		const en = STATIC_EN;
		//#endregion
		//#region src/core/protocol.ts
		/** Whether a decoded value is a non-array object. */
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/** Whether a decoded value is a string. */
		function isString(value) {
			return typeof value === "string";
		}
		/** Validate one installed-plugin row. */
		function parsePlugin(value, index) {
			if (!isRecord(value) || !isString(value.id) || !isString(value.name) || !isString(value.version) || !isString(value.installedAt) || typeof value.enabled !== "boolean" || !isRecord(value.source) || value.source.kind !== "npm" && value.source.kind !== "git" || !isString(value.source.spec)) throw new Error(`plugin-manager: plugin row ${String(index)} is invalid`);
			return {
				id: value.id,
				name: value.name,
				version: value.version,
				source: {
					kind: value.source.kind,
					spec: value.source.spec
				},
				installedAt: value.installedAt,
				enabled: value.enabled,
				...isString(value.commit) ? { commit: value.commit } : {}
			};
		}
		/**
		* Validate and normalize a `list` / `uninstall` response value.
		* @param value - decoded but untrusted response value.
		* @returns typed installed-plugin rows.
		*/
		function parsePluginList(value) {
			if (!isRecord(value) || !Array.isArray(value.plugins)) throw new Error("plugin-manager: response must contain a plugins array");
			return value.plugins.map((plugin, index) => parsePlugin(plugin, index));
		}
		/**
		* Validate and normalize an `install` / `update` / `set-enabled` response value.
		* @param value - decoded but untrusted response value.
		* @returns the typed installed-plugin row.
		*/
		function parseInstalledPlugin(value) {
			if (!isRecord(value) || value.plugin === void 0) throw new Error("plugin-manager: response must contain a plugin row");
			return parsePlugin(value.plugin, 0);
		}
		/**
		* Validate and normalize a plugin-control `list` / `set-enabled` response value.
		* @param value - decoded but untrusted response value.
		* @returns the typed control items.
		*/
		function parsePluginControlSnapshot(value) {
			if (!isRecord(value) || !Array.isArray(value.controls)) throw new Error("plugin-manager: response must contain a controls array");
			return value.controls.map((control, index) => {
				if (!isRecord(control) || !isString(control.id) || !isString(control.name) || !isString(control.repository) || control.state !== "enabled" && control.state !== "disabled" && control.state !== "mixed" && control.state !== "unavailable" && control.state !== "uninstalled") throw new Error(`plugin-manager: control row ${String(index)} is invalid`);
				return {
					id: control.id,
					name: control.name,
					repository: control.repository,
					state: control.state
				};
			});
		}
		/**
		* Validate and normalize a `status` response value.
		* @param value - decoded but untrusted response value.
		* @returns the typed progress state.
		*/
		function parseInstallStatus(value) {
			if (!isRecord(value) || !isRecord(value.progress) || value.progress.kind !== "idle" && value.progress.kind !== "install" && value.progress.kind !== "update" || value.progress.stage !== "fetch" && value.progress.stage !== "download" && value.progress.stage !== "extract" && value.progress.stage !== "write" || value.progress.percent !== void 0 && (typeof value.progress.percent !== "number" || !Number.isFinite(value.progress.percent))) throw new Error("plugin-manager: response must contain a valid progress state");
			return {
				kind: value.progress.kind,
				stage: value.progress.stage,
				...typeof value.progress.percent === "number" ? { percent: value.progress.percent } : {}
			};
		}
		/**
		* Validate and normalize a `check-updates` response value.
		* @param value - decoded but untrusted response value.
		* @returns typed update rows.
		*/
		function parseUpdateList(value) {
			if (!isRecord(value) || !Array.isArray(value.updates)) throw new Error("plugin-manager: response must contain an updates array");
			return value.updates.map((update, index) => {
				if (!isRecord(update) || !isString(update.id) || !isString(update.current) || !isString(update.latest)) throw new Error(`plugin-manager: update row ${String(index)} is invalid`);
				const row = {
					id: update.id,
					current: update.current,
					latest: update.latest
				};
				if (update.requiresDsh !== void 0) {
					if (!isString(update.requiresDsh)) throw new Error(`plugin-manager: update row ${String(index)} is invalid`);
					row.requiresDsh = update.requiresDsh;
				}
				if (update.compatible !== void 0) {
					if (typeof update.compatible !== "boolean") throw new Error(`plugin-manager: update row ${String(index)} is invalid`);
					row.compatible = update.compatible;
				}
				return row;
			});
		}
		/**
		* Validate and normalize a `failures` response value.
		* @param value - decoded but untrusted response value.
		* @returns the typed failures snapshot.
		*/
		function parseFailuresSnapshot(value) {
			if (!isRecord(value) || !Array.isArray(value.items) || !isString(value.pluginRoot) || typeof value.safeMode !== "boolean") throw new Error("plugin-manager: response must contain a failures snapshot");
			return {
				items: value.items.map((item, index) => {
					if (!isRecord(item) || !isString(item.pluginId) || item.kind !== "load-failure" && item.kind !== "hang" && item.kind !== "late-rejection" || !isString(item.message) || !isString(item.stack) || !isString(item.installPath) || !isString(item.at)) throw new Error(`plugin-manager: failure row ${String(index)} is invalid`);
					return {
						pluginId: item.pluginId,
						kind: item.kind,
						message: item.message,
						stack: item.stack,
						installPath: item.installPath,
						at: item.at
					};
				}),
				pluginRoot: value.pluginRoot,
				safeMode: value.safeMode
			};
		}
		//#endregion
		//#region src/core/service.ts
		/** The cordis service name the browser half provides the face under. */
		const PLUGIN_MANAGER_SERVICE = "pluginManager";
		//#endregion
		//#region src/client/index.ts
		const NS = "settings.pluginManager";
		const CHANNEL = "/plugin-installer";
		const CONTROL_CHANNEL = "/plugin-control";
		const LIST_ENDPOINT = "list";
		const INSTALL_ENDPOINT = "install";
		const UPDATE_ENDPOINT = "update";
		const UNINSTALL_ENDPOINT = "uninstall";
		const SET_ENABLED_ENDPOINT = "set-enabled";
		const CHECK_UPDATES_ENDPOINT = "check-updates";
		const STATUS_ENDPOINT = "status";
		const FAILURES_ENDPOINT = "failures";
		const SET_SAFE_MODE_ENDPOINT = "set-safe-mode";
		const GATEWAY_PREFIX = "/api/plugin-manager";
		/** Gateway job polling cadence. */
		const JOB_POLL_MS = 500;
		/** Gateway job wait ceiling (the host add deadline is six minutes). */
		const JOB_WAIT_MS = 7 * 6e4;
		/** Services required by the slot registration and both channels. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"workspaces",
			"sessions"
		];
		/**
		* Build the dual-channel face once: official-channel and gateway-channel
		* implementations, the mode detection that picks between them, the repair
		* handoff, and the change-notification listener set. The returned face is
		* both the tab's injected props and the value provided as the
		* `'pluginManager'` cordis service.
		* @param ctx - the client context (connection, workspaces, sessions).
		* @returns the shared face.
		*/
		function createPluginManagerFace(ctx) {
			const connection = ctx.get("connection");
			const call = async (endpoint, payload) => {
				const result = await connection.rpc.call(CHANNEL, endpoint, payload);
				if (!result.ok) throw new Error(`plugin-installer ${endpoint} failed: ${result.error.code}: ${result.error.message}`);
				return result.value;
			};
			const official = {
				list: async () => parsePluginList(await call(LIST_ENDPOINT, {})),
				install: async (spec) => parseInstalledPlugin(await call(INSTALL_ENDPOINT, { spec })),
				update: async (id) => parseInstalledPlugin(await call(UPDATE_ENDPOINT, { id })),
				uninstall: async (id) => parsePluginList(await call(UNINSTALL_ENDPOINT, { id })),
				setEnabled: async (id, enabled) => parseInstalledPlugin(await call(SET_ENABLED_ENDPOINT, {
					id,
					enabled
				})),
				checkUpdates: async () => parseUpdateList(await call(CHECK_UPDATES_ENDPOINT, {})),
				status: async () => parseInstallStatus(await call(STATUS_ENDPOINT, {})),
				failures: async () => parseFailuresSnapshot(await call(FAILURES_ENDPOINT, {})),
				setSafeMode: async (enabled) => {
					await call(SET_SAFE_MODE_ENDPOINT, { enabled });
				},
				controlsList: async () => parsePluginControlSnapshot(await connection.rpc.call(CONTROL_CHANNEL, "list", {}).then((result) => {
					if (!result.ok) throw new Error(`plugin-control list failed: ${result.error.code}: ${result.error.message}`);
					return result.value;
				})),
				controlsSetEnabled: async (pluginId, enabled) => parsePluginControlSnapshot(await connection.rpc.call(CONTROL_CHANNEL, "set-enabled", {
					pluginId,
					enabled
				}).then((result) => {
					if (!result.ok) throw new Error(`plugin-control set-enabled failed: ${result.error.code}: ${result.error.message}`);
					return result.value;
				}))
			};
			const gatewayJson = async (path, init) => {
				const response = await fetch(path, {
					...init,
					headers: {
						"content-type": "application/json",
						...init?.headers
					}
				});
				if (response.status === 403) throw new Error("plugin-manager: plugin management is only available from a local browser");
				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					throw new Error(body.error ?? `plugin-manager: gateway ${path} failed: HTTP ${String(response.status)}`);
				}
				return response.json();
			};
			/** Wait for one gateway job to settle, returning its wire state. */
			const waitJob = async (jobId) => {
				const deadline = Date.now() + JOB_WAIT_MS;
				for (;;) {
					const job = (await gatewayJson(`${GATEWAY_PREFIX}/status?job=${encodeURIComponent(jobId)}`)).job;
					if (job === void 0) throw new Error("plugin-manager: gateway job vanished");
					if (job.phase === "done") return job;
					if (job.phase === "error") throw new Error(job.error ?? "plugin-manager: gateway job failed");
					if (Date.now() > deadline) throw new Error("plugin-manager: gateway job timed out");
					await new Promise((resolve) => {
						setTimeout(resolve, JOB_POLL_MS);
					});
				}
			};
			/** The conflict ledger of the last settled gateway install. */
			let lastInstallConflicts = [];
			/** Whether a gateway install/remove is in flight (drives the progress row). */
			let gatewayInflight = false;
			const gateway = {
				list: async () => parsePluginList(await gatewayJson(`${GATEWAY_PREFIX}/list`)),
				install: async (spec) => {
					gatewayInflight = true;
					try {
						const started = await gatewayJson(`${GATEWAY_PREFIX}/install`, {
							method: "POST",
							body: JSON.stringify({ spec })
						});
						if (started.jobId === void 0) throw new Error("plugin-manager: gateway install returned no job");
						const job = await waitJob(started.jobId);
						lastInstallConflicts = Array.isArray(job.conflicts) ? job.conflicts : [];
						return parseInstalledPlugin({ plugin: job.plugin });
					} finally {
						gatewayInflight = false;
					}
				},
				update: async (id) => {
					gatewayInflight = true;
					try {
						const started = await gatewayJson(`${GATEWAY_PREFIX}/update`, {
							method: "POST",
							body: JSON.stringify({ id })
						});
						if (started.jobId === void 0) throw new Error("plugin-manager: gateway update returned no job");
						const job = await waitJob(started.jobId);
						lastInstallConflicts = Array.isArray(job.conflicts) ? job.conflicts : [];
						return parseInstalledPlugin({ plugin: job.plugin });
					} finally {
						gatewayInflight = false;
					}
				},
				uninstall: async (id) => {
					gatewayInflight = true;
					try {
						const started = await gatewayJson(`${GATEWAY_PREFIX}/remove`, {
							method: "POST",
							body: JSON.stringify({ id })
						});
						if (started.jobId === void 0) throw new Error("plugin-manager: gateway remove returned no job");
						await waitJob(started.jobId);
						return gateway.list();
					} finally {
						gatewayInflight = false;
					}
				},
				setEnabled: async (id, enabled) => parseInstalledPlugin(await gatewayJson(`${GATEWAY_PREFIX}/set-enabled`, {
					method: "POST",
					body: JSON.stringify({
						id,
						enabled
					})
				})),
				checkUpdates: async () => parseUpdateList(await gatewayJson(`${GATEWAY_PREFIX}/check-updates`)),
				status: async () => gatewayInflight ? {
					kind: "install",
					stage: "download"
				} : {
					kind: "idle",
					stage: "fetch"
				},
				failures: async () => parseFailuresSnapshot(await gatewayJson(`${GATEWAY_PREFIX}/failures`)),
				setSafeMode: async () => {
					throw new Error("plugin-manager: safe mode is unavailable in this runtime");
				},
				controlsList: async () => [],
				controlsSetEnabled: async (pluginId, enabled) => {
					await gateway.setEnabled(pluginId, enabled);
					return [];
				}
			};
			let modePromise;
			const ensureMode = () => {
				if (modePromise === void 0) modePromise = (async () => {
					try {
						const mode = await gatewayJson(`${GATEWAY_PREFIX}/mode`);
						if (mode.official === true) return "official";
						if (mode.official === false) return "gateway";
					} catch {}
					try {
						return (await connection.rpc.call(CHANNEL, LIST_ENDPOINT, {})).ok ? "official" : "gateway";
					} catch {
						return "gateway";
					}
				})();
				return modePromise;
			};
			/**
			* Start a repair conversation for a failed plugin: resolve a workspace over
			* the plugin install root (created once, reused after), open a fresh
			* session there, and seed its first prompt with the failure details. The
			* session's workspace is the plugin home so the agent's file tools reach
			* the plugin code without leaving the workspace boundary.
			* @param pluginRoot - absolute plugin install root.
			* @param message - the seeded first user message.
			* @returns resolution after the prompt is accepted and the session opens.
			*/
			const repairPlugin = async (pluginRoot, message) => {
				const workspace = await ctx.workspaces.create({ path: pluginRoot });
				const sessionId = await ctx.workspaces.connectWorkspace(workspace.workspaceId);
				const binding = ctx.sessions.binding(sessionId);
				if (binding === void 0) throw new Error(`plugin-manager: repair session ${sessionId} is unavailable`);
				const result = await binding.session.prompt([{
					type: "text",
					text: message
				}], "queue");
				if (!result.ok) throw new Error(`plugin-manager: repair prompt failed: ${result.error.code}: ${result.error.message}`);
				ctx.sessions.open(sessionId);
			};
			/** Listeners subscribed through onChange; fired after successful mutations. */
			const listeners = /* @__PURE__ */ new Set();
			/** Notify every listener; one listener throwing never breaks the others. */
			const notifyChange = () => {
				for (const listener of [...listeners]) try {
					listener();
				} catch {}
			};
			return {
				isLoopback: connection.isLoopback,
				list: async () => await ensureMode() === "official" ? official.list() : gateway.list(),
				install: async (spec) => {
					const item = await (await ensureMode() === "official" ? official.install(spec) : gateway.install(spec));
					notifyChange();
					return item;
				},
				update: async (id) => {
					const item = await (await ensureMode() === "official" ? official.update(id) : gateway.update(id));
					notifyChange();
					return item;
				},
				uninstall: async (id) => {
					const rows = await (await ensureMode() === "official" ? official.uninstall(id) : gateway.uninstall(id));
					notifyChange();
					return rows;
				},
				setEnabled: async (id, enabled) => {
					const item = await (await ensureMode() === "official" ? official.setEnabled(id, enabled) : gateway.setEnabled(id, enabled));
					notifyChange();
					return item;
				},
				checkUpdates: async () => await ensureMode() === "official" ? official.checkUpdates() : gateway.checkUpdates(),
				status: async () => await ensureMode() === "official" ? official.status() : gateway.status(),
				failures: async () => await ensureMode() === "official" ? official.failures() : gateway.failures(),
				setSafeMode: async (enabled) => await ensureMode() === "official" ? official.setSafeMode(enabled) : gateway.setSafeMode(),
				repairPlugin,
				controlsList: async () => await ensureMode() === "official" ? official.controlsList() : gateway.controlsList(),
				controlsSetEnabled: async (id, enabled) => await ensureMode() === "official" ? official.controlsSetEnabled(id, enabled) : gateway.controlsSetEnabled(id, enabled),
				lastInstallConflicts: () => lastInstallConflicts,
				onChange: (cb) => {
					listeners.add(cb);
					return () => {
						listeners.delete(cb);
					};
				}
			};
		}
		/** Contribute the family plugin-manager tab and provide the shared face. */
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
			}, "plugin-manager: dictionaries");
			const face = createPluginManagerFace(ctx);
			try {
				if (!ctx.get("pluginManager")) ctx.provide(PLUGIN_MANAGER_SERVICE, face);
			} catch {}
			ctx.slots.inject("settings.plugins.tab", () => {
				try {
					return ctx.slots.register({
						name: "settings.plugins.tab",
						id: "family-plugins",
						order: 20,
						label: () => ctx.locale.bind(NS)("tab"),
						locale: NS,
						inject: () => face
					}, PluginManagerTab);
				} catch {
					return () => {};
				}
			});
		}
		//#endregion
		exports.apply = apply;
		exports.createPluginManagerFace = createPluginManagerFace;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map