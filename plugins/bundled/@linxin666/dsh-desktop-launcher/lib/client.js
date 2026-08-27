window.__ModuleLoader__.load({
	id: "@linxin666/dsh-desktop-launcher",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react_dom_client = require("react-dom/client");
		let react_dom = require("react-dom");
		//#region src/protocol.ts
		/** Route family of the desktop-launcher host API. */
		const LAUNCHER_API = {
			/** Create (or refresh) the desktop icon. */
			create: "/api/dsh-desktop-launcher/create",
			/** Request the host process to exit gracefully. */
			shutdown: "/api/dsh-desktop-launcher/shutdown"
		};
		//#endregion
		//#region src/client/api.ts
		/**
		* Browser-side API client for /api/dsh-desktop-launcher — plain same-origin
		* fetch, the only data path the settings card uses.
		*/
		/** Error carrying the route's JSON error message. */
		var DesktopLauncherApiError = class extends Error {
			constructor(message) {
				super(message);
				this.name = "DesktopLauncherApiError";
			}
		};
		/** Create (or refresh) the desktop icon. */
		async function createDesktopShortcut() {
			const response = await fetch(LAUNCHER_API.create, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}"
			});
			const copy = response.clone();
			let body;
			try {
				body = await response.json();
			} catch {
				const detail = await copy.text().catch(() => "");
				throw new DesktopLauncherApiError(`HTTP ${response.status}${detail === "" ? ": invalid JSON response" : `: ${detail}`}`);
			}
			if (!response.ok) throw new DesktopLauncherApiError(typeof body === "object" && body !== null && typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
			const result = body.result;
			if (typeof result !== "object" || result === null || result.ok !== true) throw new DesktopLauncherApiError("desktop shortcut creation returned an invalid result");
			return result;
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-desktop-launcher/src/client/settings-card.module.css.mjs
		const css$2 = ".t1kTJG_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.t1kTJG_card:hover{border-color:var(--dsw-alias-label-dimmed)}.t1kTJG_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.t1kTJG_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.t1kTJG_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.t1kTJG_headerStatic{border-radius:12px;align-items:center;gap:12px;width:100%;padding:14px 16px;display:flex}.t1kTJG_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.t1kTJG_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.t1kTJG_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.t1kTJG_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.t1kTJG_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.t1kTJG_chevronOpen{transform:rotate(180deg)}.t1kTJG_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.t1kTJG_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}.t1kTJG_notExposed{color:var(--dsw-alias-state-warn-primary);margin:12px 0 0;font-size:12px;line-height:1.5}.t1kTJG_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.t1kTJG_failed{min-width:0;color:var(--dsw-alias-label-error);text-overflow:ellipsis;white-space:nowrap;flex:1;margin:0;font-size:12px;line-height:1.5;overflow:hidden}.t1kTJG_discard,.t1kTJG_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.t1kTJG_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.t1kTJG_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.t1kTJG_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.t1kTJG_discard:disabled,.t1kTJG_save:disabled{opacity:.4;cursor:default}.t1kTJG_discard:focus-visible,.t1kTJG_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.t1kTJG_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.t1kTJG_field+.t1kTJG_field{border-top:1px solid var(--dsw-alias-border-l2)}.t1kTJG_head{align-items:center;gap:8px;display:flex}.t1kTJG_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.t1kTJG_badges{align-items:center;gap:8px;display:inline-flex}.t1kTJG_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.t1kTJG_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.t1kTJG_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.t1kTJG_reset:disabled{cursor:default}.t1kTJG_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.t1kTJG_input,.t1kTJG_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.t1kTJG_input:focus-visible,.t1kTJG_select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.t1kTJG_input:disabled,.t1kTJG_select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.t1kTJG_inputInvalid{border:1px solid var(--dsw-alias-label-error);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.t1kTJG_inputInvalid:focus-visible{outline:2px solid var(--dsw-alias-label-error);outline-offset:1px;border-color:var(--dsw-alias-label-error)}.t1kTJG_selectWrap{position:relative}.t1kTJG_selectButton{appearance:none;text-align:left;cursor:pointer;justify-content:space-between;align-items:center;gap:8px;width:100%;display:flex}.t1kTJG_selectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.t1kTJG_selectChevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.t1kTJG_selectChevronOpen{transform:rotate(180deg)}.t1kTJG_selectPopup{z-index:40;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);max-height:240px;box-shadow:0 8px 24px var(--dsw-alias-bg-mask-2);opacity:0;border-radius:8px;flex-direction:column;padding:4px;transition:opacity .1s,transform .1s;display:flex;position:absolute;top:calc(100% + 4px);left:0;right:0;overflow-y:auto;transform:translateY(-4px)}.t1kTJG_selectPopupOpen{opacity:1;transform:none}.t1kTJG_selectPopupClose{opacity:0;pointer-events:none;transform:translateY(-4px)}.t1kTJG_selectOption{color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;text-overflow:ellipsis;border-radius:6px;flex-shrink:0;padding:6px 10px;font-size:13px;line-height:1.5;overflow:hidden}.t1kTJG_selectOption:hover,.t1kTJG_selectOptionActive{background:var(--dsw-alias-interactive-bg-hover)}.t1kTJG_selectOptionSelected{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 10%, transparent);font-weight:500}.t1kTJG_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.t1kTJG_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}@media (prefers-reduced-motion:reduce){.t1kTJG_card,.t1kTJG_header,.t1kTJG_chevron,.t1kTJG_chevronOpen,.t1kTJG_discard,.t1kTJG_save,.t1kTJG_selectChevron,.t1kTJG_selectChevronOpen,.t1kTJG_selectPopup{transition:none}}";
		const tagId$2 = "@linxin666/dsh-desktop-launcher/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-desktop-launcher";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"badge": "t1kTJG_badge",
			"badges": "t1kTJG_badges",
			"body": "t1kTJG_body",
			"card": "t1kTJG_card",
			"cardOpen": "t1kTJG_cardOpen",
			"chevron": "t1kTJG_chevron",
			"chevronOpen": "t1kTJG_chevronOpen",
			"description": "t1kTJG_description",
			"discard": "t1kTJG_discard",
			"failed": "t1kTJG_failed",
			"field": "t1kTJG_field",
			"footer": "t1kTJG_footer",
			"head": "t1kTJG_head",
			"headText": "t1kTJG_headText",
			"header": "t1kTJG_header",
			"headerStatic": "t1kTJG_headerStatic",
			"hint": "t1kTJG_hint",
			"input": "t1kTJG_input",
			"inputInvalid": "t1kTJG_inputInvalid",
			"invalid": "t1kTJG_invalid",
			"label": "t1kTJG_label",
			"name": "t1kTJG_name",
			"notExposed": "t1kTJG_notExposed",
			"pending": "t1kTJG_pending",
			"readOnly": "t1kTJG_readOnly",
			"reset": "t1kTJG_reset",
			"save": "t1kTJG_save",
			"select": "t1kTJG_select",
			"selectButton": "t1kTJG_selectButton",
			"selectChevron": "t1kTJG_selectChevron",
			"selectChevronOpen": "t1kTJG_selectChevronOpen",
			"selectLabel": "t1kTJG_selectLabel",
			"selectOption": "t1kTJG_selectOption",
			"selectOptionActive": "t1kTJG_selectOptionActive",
			"selectOptionSelected": "t1kTJG_selectOptionSelected",
			"selectPopup": "t1kTJG_selectPopup",
			"selectPopupClose": "t1kTJG_selectPopupClose",
			"selectPopupOpen": "t1kTJG_selectPopupOpen",
			"selectWrap": "t1kTJG_selectWrap"
		};
		//#endregion
		//#region src/client/PluginSettingsCard.tsx
		/**
		* Family-shared chrome for plugin settings cards: a disclosure header naming
		* the plugin and what its settings govern, the controls inside, and the save
		* that writes them. Renders nothing while the namespace is unavailable — a
		* deployment that does not compose the owning plugin should show no trace of
		* it. Inlined into each consumer's client bundle; mirrors the official
		* ui-plugin-config PluginCard in a self-contained slice.
		*/
		/**
		* Render one plugin settings card.
		* @param props - the plugin's copy keys, its form state, and its controls.
		* @returns the card, or nothing while the namespace is still loading.
		*/
		function PluginSettingsCard(props) {
			const [open, setOpen] = (0, react.useState)(props.defaultOpen ?? true);
			const { state, alwaysOpen } = props;
			if (!state.available) return null;
			const title = props.t(props.titleKey);
			const description = props.t(props.descriptionKey);
			const blocked = !state.dirty || state.invalid || state.saving;
			const expanded = alwaysOpen === true || open;
			const cardClass = expanded ? `${settings_card_module_css_default.cardOpen} ${settings_card_module_css_default.card}` : settings_card_module_css_default.card;
			const header = alwaysOpen === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.headerStatic,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: settings_card_module_css_default.headText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.name,
						title,
						children: title
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.description,
						title: description,
						children: description
					})]
				}), state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: settings_card_module_css_default.pending,
					title: props.t("settings.unsaved"),
					children: props.t("settings.unsaved")
				}) : null]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: settings_card_module_css_default.header,
				"aria-expanded": open,
				"aria-label": `${props.t(open ? "settings.collapse" : "settings.expand")}: ${title}`,
				onClick: () => {
					setOpen(!open);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: settings_card_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.name,
							title,
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.description,
							title: description,
							children: description
						})]
					}),
					state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.pending,
						title: props.t("settings.unsaved"),
						children: props.t("settings.unsaved")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.chevron} ${settings_card_module_css_default.chevronOpen}` : settings_card_module_css_default.chevron,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})
				]
			});
			if (!state.exposed) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.body,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.notExposed,
						role: "status",
						children: props.t("settings.notExposed")
					})
				}) : null]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_card_module_css_default.readOnly,
							role: "status",
							children: props.t("settings.readOnly")
						}) : null,
						props.children,
						props.hideFooter === true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.footer,
							children: [
								state.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: settings_card_module_css_default.failed,
									role: "status",
									children: [props.t("settings.saveFailed"), state.failedReason ? " - " + state.failedReason : ""]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.discard,
									disabled: !state.dirty || state.saving,
									onClick: props.onDiscard,
									children: props.t("settings.discard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.save,
									disabled: blocked,
									onClick: props.onSave,
									children: props.t(!state.saving ? "settings.save" : "settings.saving")
								})
							]
						})
					]
				}) : null]
			});
		}
		/** A staged value field. `numeric` only hints the keypad: which drafts a field accepts is decided by its spec. */
		function ValueField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: settings_card_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						id: props.id,
						className: props.invalid ? settings_card_module_css_default.inputInvalid : settings_card_module_css_default.input,
						type: "text",
						...props.numeric === true ? { inputMode: "numeric" } : {},
						...props.invalid ? { "aria-invalid": true } : {},
						value: props.text,
						placeholder: props.placeholder ?? "",
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: props.invalid ? settings_card_module_css_default.invalid : settings_card_module_css_default.hint,
						children: props.invalid ? props.invalidLabel : props.hint
					})
				]
			});
		}
		const NON_SKIN_BODY_MARKERS = /* @__PURE__ */ new Set(["dshSkinCenter", "dshSidebarCollapsed"]);
		function isSkinActive() {
			return Object.keys(document.body.dataset).some((key) => key.startsWith("dsh") && !NON_SKIN_BODY_MARKERS.has(key));
		}
		const SELECT_CLOSE_MS = 100;
		/**
		* The shared dual-mode select control. While an appearance skin is active it
		* renders the legacy native `<select>` untouched, so element-level skin
		* selectors keep working; under the default appearance it renders a
		* self-drawn `role="listbox"` popup whose open/close is transition-animated.
		* Staged cards reach it through BooleanField/ChoiceField; immediate-apply
		* editors (the side-card prefs) bind it directly through onEdit.
		* 双模式下拉框：皮肤激活时用原生 select，默认外观用自绘动画弹层。
		*/
		function SelectField(props) {
			const { id, options, value } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const [closing, setClosing] = (0, react.useState)(false);
			const [phase, setPhase] = (0, react.useState)("initial");
			const [activeIndex, setActiveIndex] = (0, react.useState)(0);
			const closeTimer = (0, react.useRef)(void 0);
			const wrapRef = (0, react.useRef)(null);
			const popupRef = (0, react.useRef)(null);
			const currentIndex = () => {
				const index = options.findIndex((option) => option.value === value);
				return index >= 0 ? index : 0;
			};
			const close = (0, react.useCallback)(() => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setClosing(true);
				closeTimer.current = setTimeout(() => {
					setClosing(false);
					setOpen(false);
				}, SELECT_CLOSE_MS);
			}, []);
			const openPopup = () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setActiveIndex(currentIndex());
				setPhase("initial");
				setClosing(false);
				setOpen(true);
			};
			const commit = (index) => {
				const option = options[index];
				if (option) props.onEdit(option.value);
				close();
			};
			const onTriggerClick = () => {
				if (props.disabled) return;
				if (open && !closing) close();
				else openPopup();
			};
			const onKeyDown = (event) => {
				if (props.disabled) return;
				const count = options.length;
				switch (event.key) {
					case "ArrowDown":
					case "ArrowUp":
					case "Enter":
					case " ":
						event.preventDefault();
						if (!open) openPopup();
						else if (!closing) if (event.key === "ArrowDown") setActiveIndex((index) => (index + 1) % count);
						else if (event.key === "ArrowUp") setActiveIndex((index) => (index - 1 + count) % count);
						else commit(activeIndex);
						break;
					case "Escape":
						if (open) {
							event.preventDefault();
							event.stopPropagation();
							close();
						}
						break;
					case "Tab":
						if (open) close();
						break;
				}
			};
			(0, react.useEffect)(() => () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
			}, []);
			(0, react.useLayoutEffect)(() => {
				if (open && !closing && phase === "initial") {
					popupRef.current?.offsetHeight;
					setPhase("open");
				}
			}, [
				open,
				closing,
				phase
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onPointerDown = (event) => {
					const target = event.target;
					if (target instanceof Node && !wrapRef.current?.contains(target)) close();
				};
				document.addEventListener("pointerdown", onPointerDown);
				return () => document.removeEventListener("pointerdown", onPointerDown);
			}, [open, close]);
			(0, react.useEffect)(() => {
				if (props.disabled && open) close();
			}, [
				props.disabled,
				open,
				close
			]);
			if (isSkinActive()) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
				id,
				className: settings_card_module_css_default.select,
				value,
				disabled: props.disabled,
				onChange: (event) => {
					props.onEdit(event.target.value);
				},
				children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: option.value,
					children: option.label
				}, option.value))
			});
			const label = options.find((option) => option.value === value)?.label ?? "";
			const popupClass = closing ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupClose}` : phase === "open" ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupOpen}` : settings_card_module_css_default.selectPopup;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.selectWrap,
				ref: wrapRef,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					id,
					className: `${settings_card_module_css_default.select} ${settings_card_module_css_default.selectButton}`,
					disabled: props.disabled,
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					"aria-activedescendant": open ? `${id}-o${activeIndex}` : void 0,
					"aria-invalid": props.invalid || void 0,
					onClick: onTriggerClick,
					onKeyDown,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.selectLabel,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.selectChevron} ${settings_card_module_css_default.selectChevronOpen}` : settings_card_module_css_default.selectChevron,
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: popupClass,
					role: "listbox",
					ref: popupRef,
					children: options.map((option, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						id: `${id}-o${index}`,
						role: "option",
						"aria-selected": option.value === value,
						className: `${settings_card_module_css_default.selectOption}${option.value === value ? ` ${settings_card_module_css_default.selectOptionSelected}` : ""}${index === activeIndex && !closing ? ` ${settings_card_module_css_default.selectOptionActive}` : ""}`,
						onClick: () => {
							commit(index);
						},
						children: option.label
					}, option.value))
				}) : null]
			});
		}
		/** A staged boolean field: 继承 / 开 / 关. */
		function BooleanField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: settings_card_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
						id: props.id,
						options: [
							{
								value: "",
								label: props.inheritLabel
							},
							{
								value: "true",
								label: props.onLabel
							},
							{
								value: "false",
								label: props.offLabel
							}
						],
						value: props.text,
						disabled: props.disabled,
						invalid: props.invalid,
						onEdit: props.onEdit
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: props.hint
					})
				]
			});
		}
		//#endregion
		//#region src/client/settings-form.ts
		/** A free-text field. An empty draft clears the field. */
		function textField(field) {
			return {
				field,
				format: (value) => typeof value === "string" ? value : "",
				parse: (text) => {
					const trimmed = text.trim();
					return trimmed === "" ? { kind: "clear" } : {
						kind: "set",
						value: trimmed
					};
				}
			};
		}
		/** A boolean field, edited through true/false draft text. */
		function booleanField(field) {
			return {
				field,
				format: (value) => typeof value === "boolean" ? String(value) : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					if (trimmed === "true") return {
						kind: "set",
						value: true
					};
					if (trimmed === "false") return {
						kind: "set",
						value: false
					};
				}
			};
		}
		/**
		* Stages one card's edits over one settings namespace and writes them on save.
		*
		* The Host is the only authority on whether a value was accepted — its
		* validators own the constraints no schema can express — so the outcome is
		* read back from the section rather than predicted here. A save that did not
		* land keeps its drafts, so the user can correct them instead of retyping.
		*/
		var CardForm = class {
			scope;
			specs;
			staged = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			/** The scope subscription installed in the constructor; released by dispose(). */
			disposeScope;
			disposed = false;
			saving = false;
			failed = false;
			failedReason;
			/** @param scope - the bound settings scope for this card's namespace. */
			constructor(scope, specs) {
				this.scope = scope;
				this.specs = new Map(specs.map((spec) => [spec.field, spec]));
				this.disposeScope = scope.subscribe(() => {
					this.publish();
				});
			}
			/**
			* Release the scope subscription and every bound store listener. The card
			* must call this on teardown; later calls are no-ops.
			*/
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				this.disposeScope();
				this.listeners.clear();
			}
			/** Publish a projection of this form, rebuilt whenever the scope or a draft changes. */
			bind(project) {
				const store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(project());
				this.listeners.add(() => {
					store.set(project());
				});
				return store;
			}
			/** Read the card-level state: what the Host serves, and what a save would do. */
			shell() {
				const snapshot = this.scope.getSnapshot();
				const plan = this.plan();
				return {
					available: snapshot.status !== "loading",
					exposed: snapshot.status === "ready",
					writable: snapshot.writable,
					dirty: plan.length > 0,
					invalid: plan.some((item) => item.run === void 0),
					saving: this.saving,
					failed: this.failed,
					...this.failedReason === void 0 ? {} : { failedReason: this.failedReason }
				};
			}
			/** Read one field's state from the effective section and its staged draft. */
			field(field) {
				const spec = this.specOf(field);
				const staged = this.staged.get(field);
				if (staged === void 0) return {
					text: spec.format(this.sectionValue(field)),
					overridden: this.stored(field),
					invalid: false
				};
				const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
				return {
					text: staged.text,
					overridden: write?.kind === "set",
					invalid: write === void 0
				};
			}
			/** The actions the card's slot registration injects. */
			actions() {
				return {
					edit: (field, text) => {
						this.stage(field, {
							text,
							clear: false
						});
					},
					resetField: (field) => {
						this.stage(field, {
							text: this.specOf(field).format(this.baseValue(field)),
							clear: true
						});
					},
					save: () => {
						this.save();
					},
					discard: () => {
						if (this.staged.size === 0 && !this.failed) return;
						this.staged.clear();
						this.failed = false;
						this.failedReason = void 0;
						this.publish();
					}
				};
			}
			/**
			* Write every staged edit, then re-seed from what the Host accepted.
			*
			* When the scope carries the optional batch surface (the dsh-web-ui
			* bridge scope), every planned write rides one mutation so cross-field
			* validate hooks (baseURL+model) judge the batch as a unit instead of
			* deadlocking on per-field writes. Otherwise the per-field loop runs.
			* A field lands only when the Host reports it held the staged value; a
			* landed field's draft is dropped, a failed one stays staged for the user.
			* @returns settlement after every write and the read-back.
			*/
			async save() {
				const plan = this.plan();
				const valid = plan.filter((item) => item.run !== void 0);
				if (plan.length === 0 || this.saving || valid.length !== plan.length) return;
				const plannedWrites = valid.map((item) => item.op);
				const pending = /* @__PURE__ */ new Map();
				for (const item of plan) pending.set(item.field, this.staged.get(item.field));
				this.saving = true;
				this.failed = false;
				this.failedReason = void 0;
				this.publish();
				const landed = /* @__PURE__ */ new Set();
				const batch = this.batchedScope();
				if (batch !== void 0) {
					const result = await batch.mutate(plannedWrites);
					if (result.ok) {
						for (const field of result.fields) if (field.landed) landed.add(field.field);
					} else this.failedReason = result.message;
				} else for (const item of valid) if (await item.run()) landed.add(item.field);
				for (const [field, before] of pending) if (landed.has(field) && this.staged.get(field) === before) this.staged.delete(field);
				this.saving = false;
				this.failed = landed.size !== pending.size;
				this.publish();
			}
			/** The scope's batch surface when it supports one; undefined conservatively otherwise. */
			batchedScope() {
				const candidate = this.scope;
				return typeof candidate?.mutate === "function" ? candidate : void 0;
			}
			/**
			* Every staged edit a save would write. An entry whose draft is not a value
			* its field accepts carries no write: the form is still dirty, and the save
			* refuses rather than dropping the edit. A staged edit that matches the
			* effective section is not a write at all.
			* @returns the planned writes, in the order the fields were staged.
			*/
			plan() {
				const plan = [];
				for (const [field, staged] of this.staged) {
					const spec = this.specOf(field);
					if (staged.clear) {
						if (this.stored(field)) plan.push({
							field,
							op: {
								field,
								op: "unset"
							},
							run: () => this.clear(field)
						});
						continue;
					}
					if (staged.text === spec.format(this.sectionValue(field))) continue;
					const write = spec.parse(staged.text);
					if (write === void 0) plan.push({
						field,
						op: {
							field,
							op: "unset"
						},
						run: void 0
					});
					else if (write.kind === "clear") plan.push({
						field,
						op: {
							field,
							op: "unset"
						},
						run: () => this.clear(field)
					});
					else plan.push({
						field,
						op: {
							field,
							op: "set",
							value: write.value
						},
						run: () => this.store(field, write.value)
					});
				}
				return plan;
			}
			async clear(field) {
				await this.scope.unset(field);
				return !this.stored(field);
			}
			async store(field, value) {
				await this.scope.set(field, value);
				if (this.specOf(field).secret) return true;
				return this.userLayer()?.[field] === value;
			}
			stage(field, edit) {
				this.staged.set(field, edit);
				this.failed = false;
				this.failedReason = void 0;
				this.publish();
			}
			specOf(field) {
				const spec = this.specs.get(field);
				if (spec === void 0) throw new Error(`settings card has no field ${field}`);
				return spec;
			}
			snapshotOf() {
				return this.scope.getSnapshot();
			}
			sectionValue(field) {
				return this.snapshotOf().value?.[field];
			}
			baseValue(field) {
				return this.snapshotOf().base?.[field];
			}
			userLayer() {
				return this.snapshotOf().user;
			}
			stored(field) {
				const user = this.userLayer();
				return user !== void 0 && Object.hasOwn(user, field);
			}
			publish() {
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region \0dsh-css:packages/dsh-desktop-launcher/src/client/launcher-card.module.css.mjs
		const css$1 = "._0LDxFq_actions{flex-direction:column;align-items:flex-start;gap:8px;padding:12px 0;display:flex}._0LDxFq_create{appearance:none;font:inherit;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border:1px solid #0000;border-radius:8px;padding:6px 16px;font-size:13px;line-height:1.5}._0LDxFq_create:disabled{opacity:.4;cursor:default}._0LDxFq_create:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}._0LDxFq_ok{color:var(--dsw-alias-label-secondary);word-break:break-all;margin:0;font-size:12px;line-height:1.5}._0LDxFq_error{color:var(--dsw-alias-label-error);word-break:break-all;margin:0;font-size:12px;line-height:1.5}._0LDxFq_off{color:var(--dsw-alias-label-secondary);word-break:break-all;margin:0;font-size:12px;line-height:1.5}";
		const tagId$1 = "@linxin666/dsh-desktop-launcher/launcher-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-desktop-launcher";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var launcher_card_module_css_default = {
			"actions": "_0LDxFq_actions",
			"create": "_0LDxFq_create",
			"error": "_0LDxFq_error",
			"off": "_0LDxFq_off",
			"ok": "_0LDxFq_ok"
		};
		//#endregion
		//#region \0dsh-css:packages/dsh-desktop-launcher/src/client/shutdown.module.css.mjs
		const css = ".RoH4jq_separator{border:none;border-top:1px solid var(--dsw-alias-border-l2);margin:16px 0 12px}.RoH4jq_sectionTitle{color:var(--dsw-alias-label-primary);margin:0 0 8px;font-size:14px;font-weight:600;line-height:20px}.RoH4jq_triggerFloating{z-index:900;background:var(--dsw-alias-bg-layer-2);width:46px;height:46px;color:var(--dsw-alias-label-secondary);box-shadow:var(--dsw-shadow-lv3);cursor:pointer;border:none;border-radius:50%;justify-content:center;align-items:center;padding:0;transition:background-color .12s,color .12s,box-shadow .12s;display:inline-flex;position:fixed;bottom:24px;right:24px}.RoH4jq_triggerFloating:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.RoH4jq_triggerFloating:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}.RoH4jq_triggerFloating:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);outline:none}.RoH4jq_triggerFloating:disabled{opacity:.5;cursor:default}.RoH4jq_trigger{width:36px;height:36px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;transition:background-color .12s,color .12s,box-shadow .12s;display:inline-flex}.RoH4jq_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.RoH4jq_trigger:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}.RoH4jq_trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);outline:none}.RoH4jq_trigger:disabled{opacity:.5;cursor:default}.RoH4jq_overlay{z-index:1000;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.RoH4jq_mask{background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);position:absolute;inset:0}.RoH4jq_dialog{z-index:1;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);width:400px;max-width:calc(100vw - 48px);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);border-radius:20px;font-size:14px;line-height:22px;position:relative}.RoH4jq_dialogBody{text-align:center;flex-direction:column;align-items:center;gap:12px;padding:28px 24px 24px;display:flex}.RoH4jq_dialogIcon{background:var(--dsw-alias-interactive-bg-hover);width:48px;height:48px;color:var(--dsw-alias-label-primary);border-radius:50%;justify-content:center;align-items:center;display:inline-flex}.RoH4jq_dialogTitle{margin:0;font-size:18px;font-weight:600;line-height:26px}.RoH4jq_dialogText,.RoH4jq_dialogStatus,.RoH4jq_dialogError{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px}.RoH4jq_dialogError{color:var(--dsw-alias-state-error-primary)}.RoH4jq_dialogActions{justify-content:center;gap:10px;margin-top:8px;display:flex}.RoH4jq_cancel,.RoH4jq_confirm{cursor:pointer;white-space:nowrap;border-radius:10px;justify-content:center;align-items:center;height:34px;padding:0 18px;font-size:13px;transition:background-color .12s,border-color .12s,box-shadow .12s;display:inline-flex}.RoH4jq_cancel{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.RoH4jq_cancel:hover:not(:disabled){border-color:var(--dsw-alias-label-dimmed);color:var(--dsw-alias-label-primary)}.RoH4jq_confirm{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-2);border:1px solid #0000}.RoH4jq_confirm:hover:not(:disabled){filter:brightness(1.08)}.RoH4jq_cancel:focus-visible,.RoH4jq_confirm:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);outline:none}.RoH4jq_cancel:disabled,.RoH4jq_confirm:disabled{opacity:.5;cursor:default}@media (prefers-reduced-motion:reduce){.RoH4jq_trigger,.RoH4jq_triggerFloating,.RoH4jq_cancel,.RoH4jq_confirm{transition:none}}";
		const tagId = "@linxin666/dsh-desktop-launcher/shutdown.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-desktop-launcher";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var shutdown_module_css_default = {
			"cancel": "RoH4jq_cancel",
			"confirm": "RoH4jq_confirm",
			"dialog": "RoH4jq_dialog",
			"dialogActions": "RoH4jq_dialogActions",
			"dialogBody": "RoH4jq_dialogBody",
			"dialogError": "RoH4jq_dialogError",
			"dialogIcon": "RoH4jq_dialogIcon",
			"dialogStatus": "RoH4jq_dialogStatus",
			"dialogText": "RoH4jq_dialogText",
			"dialogTitle": "RoH4jq_dialogTitle",
			"mask": "RoH4jq_mask",
			"overlay": "RoH4jq_overlay",
			"sectionTitle": "RoH4jq_sectionTitle",
			"separator": "RoH4jq_separator",
			"trigger": "RoH4jq_trigger",
			"triggerFloating": "RoH4jq_triggerFloating"
		};
		//#endregion
		//#region src/client/DesktopLauncherSettingsCard.tsx
		/**
		* The desktop-launcher settings card: launcher behavior fields plus the
		* "create desktop icon" action and the shutdown confirmation toggle.
		* Registers into the `web-ui.plugin.item` slot the Web UI plugin group
		* renders, bound to the `desktop-launcher` settings namespace.
		*/
		/** Bridges the `desktop-launcher` scope onto the card staged form. */
		var DesktopLauncherSettingsCardController = class {
			form;
			store;
			/** @param scope - the bound settings scope for the `desktop-launcher` namespace. */
			constructor(scope) {
				this.form = new CardForm(scope, [
					booleanField("enabled"),
					booleanField("announceToAgent"),
					textField("dshCommand"),
					textField("url"),
					textField("profile"),
					textField("iconPath"),
					booleanField("confirmShutdown")
				]);
				this.store = this.form.bind(() => this.projection());
			}
			projection() {
				return {
					...this.form.shell(),
					enabled: this.form.field("enabled"),
					announceToAgent: this.form.field("announceToAgent"),
					dshCommand: this.form.field("dshCommand"),
					url: this.form.field("url"),
					profile: this.form.field("profile"),
					iconPath: this.form.field("iconPath"),
					confirmShutdown: this.form.field("confirmShutdown")
				};
			}
			/**
			* Build the face the card slot registration injects.
			* @returns the card snapshot and its form actions.
			*/
			inject() {
				return {
					hooks: { desktopLauncherSettingsCard: this.store },
					...this.form.actions()
				};
			}
		};
		/**
		* Render the desktop-launcher card.
		* @param props - locale copy, the card snapshot, and its form actions.
		* @returns the card.
		*/
		function DesktopLauncherSettingsCard(props) {
			const { t } = props;
			const state = props.useDesktopLauncherSettingsCard((snapshot) => snapshot);
			const [creating, setCreating] = (0, react.useState)(false);
			const [created, setCreated] = (0, react.useState)();
			const [error, setError] = (0, react.useState)();
			const disabled = !state.writable;
			const createReady = state.enabled.text === "true" && !state.dirty && !state.saving;
			const fieldProps = {
				overriddenLabel: t("settings.overridden"),
				resetLabel: t("settings.reset"),
				invalidLabel: t("settings.invalidNumber"),
				disabled
			};
			const create = async () => {
				setCreating(true);
				setError(void 0);
				setCreated(void 0);
				try {
					setCreated(await createDesktopShortcut());
				} catch (createError) {
					setError(createError instanceof Error ? createError.message : String(createError));
				} finally {
					setCreating(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PluginSettingsCard, {
				t,
				titleKey: "settings.title",
				descriptionKey: "settings.description",
				defaultOpen: false,
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-desktop-launcher-enabled",
						label: t("settings.enabled"),
						hint: t("settings.enabledHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.enabled,
						onEdit: (text) => {
							props.edit("enabled", text);
						},
						onReset: () => {
							props.resetField("enabled");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-desktop-launcher-announce",
						label: t("settings.announceToAgent"),
						hint: t("settings.announceToAgentHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.announceToAgent,
						onEdit: (text) => {
							props.edit("announceToAgent", text);
						},
						onReset: () => {
							props.resetField("announceToAgent");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-desktop-launcher-command",
						label: t("settings.dshCommand"),
						hint: t("settings.dshCommandHint"),
						placeholder: "dsh",
						...fieldProps,
						...state.dshCommand,
						onEdit: (text) => {
							props.edit("dshCommand", text);
						},
						onReset: () => {
							props.resetField("dshCommand");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-desktop-launcher-url",
						label: t("settings.url"),
						hint: t("settings.urlHint"),
						placeholder: "http://127.0.0.1:3080",
						...fieldProps,
						...state.url,
						onEdit: (text) => {
							props.edit("url", text);
						},
						onReset: () => {
							props.resetField("url");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-desktop-launcher-profile",
						label: t("settings.profile"),
						hint: t("settings.profileHint"),
						...fieldProps,
						...state.profile,
						onEdit: (text) => {
							props.edit("profile", text);
						},
						onReset: () => {
							props.resetField("profile");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-desktop-launcher-icon",
						label: t("settings.iconPath"),
						hint: t("settings.iconPathHint"),
						placeholder: "",
						...fieldProps,
						...state.iconPath,
						onEdit: (text) => {
							props.edit("iconPath", text);
						},
						onReset: () => {
							props.resetField("iconPath");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: launcher_card_module_css_default.actions,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: launcher_card_module_css_default.create,
								disabled: creating || disabled || !createReady,
								onClick: () => {
									create();
								},
								children: t(creating ? "settings.creating" : "settings.create")
							}),
							!createReady && !disabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: launcher_card_module_css_default.off,
								role: "status",
								children: t("settings.requireEnabled")
							}) : null,
							created ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: launcher_card_module_css_default.ok,
								role: "status",
								children: [
									t("settings.created"),
									": ",
									created.path,
									created.warning ? ` (${t("settings.warning")}: ${created.warning})` : ""
								]
							}) : null,
							error ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: launcher_card_module_css_default.error,
								role: "status",
								children: [
									t("settings.createFailed"),
									": ",
									error
								]
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: shutdown_module_css_default.separator,
						role: "separator"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
						className: shutdown_module_css_default.sectionTitle,
						children: t("settings.shutdownSection")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-desktop-launcher-confirm",
						label: t("settings.confirmShutdown"),
						hint: t("settings.confirmShutdownHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.confirmShutdown,
						onEdit: (text) => {
							props.edit("confirmShutdown", text);
						},
						onReset: () => {
							props.resetField("confirmShutdown");
						}
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* The `desktop-launcher` namespace dictionaries: copy for the plugin
		* settings card (the `web-ui.plugin.item` seat) that edits the launcher
		* behavior and the shutdown behavior, and the floating shutdown button.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"settings.title": "桌面启动器",
			"settings.description": "桌面图标创建与一键关机。",
			"settings.enabled": "启用插件",
			"settings.enabledHint": "关闭后不再提供桌面图标创建与关机按钮。",
			"settings.announceToAgent": "向 Agent 公告",
			"settings.announceToAgentHint": "关闭后系统提示词不再介绍本插件。",
			"settings.dshCommand": "dsh 命令",
			"settings.dshCommandHint": "启动器调用的命令，需在 PATH 中（默认 dsh）。",
			"settings.url": "Web GUI 地址",
			"settings.urlHint": "启动后等待就绪并打开的地址（默认 http://127.0.0.1:3080）。",
			"settings.profile": "启动 profile（可选）",
			"settings.profileHint": "留空表示不带 --profile 参数启动 dsh web。",
			"settings.iconPath": "图标文件（可选）",
			"settings.iconPathHint": "桌面图标的 .ico/.png 路径；留空使用内置的 dsh 图标。",
			"settings.create": "创建桌面图标",
			"settings.creating": "创建中…",
			"settings.created": "桌面图标已创建",
			"settings.createFailed": "创建桌面图标失败",
			"settings.requireEnabled": "开启「启用插件」并保存后，此按钮可用。",
			"settings.warning": "注意",
			"settings.shutdownSection": "一键关机",
			"settings.confirmShutdown": "退出前确认",
			"settings.confirmShutdownHint": "关闭后点击按钮直接退出，不再弹出确认框。",
			"entry.label": "退出 DeepSeek Harness",
			"dialog.title": "确认退出",
			"dialog.description": "关闭 DeepSeek Harness 会结束 dsh web 进程，正在运行的会话、任务与未保存状态可能中断。确定要退出吗？",
			"dialog.confirm": "退出",
			"dialog.cancel": "取消",
			"dialog.shuttingDown": "正在退出…",
			"dialog.failed": "退出请求失败：{message}",
			"dialog.retry": "重试",
			"dialog.close": "关闭",
			"settings.overridden": "已覆盖",
			"settings.reset": "恢复默认",
			"settings.notExposed": "当前 DSH 版本未向设置页暴露本插件的配置命名空间，表单不可用。可编辑 $DSH_HOME/settings.yaml 直接配置，或为 dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES 白名单补充本命名空间后重启。",
			"settings.readOnly": "当前部署的设置只读。",
			"settings.inherit": "继承",
			"settings.on": "开",
			"settings.off": "关",
			"settings.expand": "展开设置",
			"settings.collapse": "收起设置",
			"settings.save": "保存",
			"settings.saving": "保存中…",
			"settings.discard": "放弃",
			"settings.unsaved": "未保存",
			"settings.saveFailed": "部署未接受这些值，已保留供你修改。",
			"settings.invalidNumber": "请输入数字，留空则使用默认值。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"settings.title": "Desktop launcher",
			"settings.description": "Create desktop icon and one-click shutdown.",
			"settings.enabled": "Enable plugin",
			"settings.enabledHint": "When off, desktop icon creation and the shutdown button stop.",
			"settings.announceToAgent": "Announce to agent",
			"settings.announceToAgentHint": "When off, the system prompt no longer introduces this plugin.",
			"settings.dshCommand": "dsh command",
			"settings.dshCommandHint": "Command the launcher calls; it must be on PATH (default dsh).",
			"settings.url": "Web GUI URL",
			"settings.urlHint": "Address the launcher waits for and opens (default http://127.0.0.1:3080).",
			"settings.profile": "Startup profile (optional)",
			"settings.profileHint": "Leave blank to start dsh web without a --profile argument.",
			"settings.iconPath": "Icon file (optional)",
			"settings.iconPathHint": "Path to a .ico/.png for the desktop icon; blank uses the bundled dsh icon.",
			"settings.create": "Create desktop icon",
			"settings.creating": "Creating…",
			"settings.created": "Desktop icon created",
			"settings.createFailed": "Failed to create desktop icon",
			"settings.requireEnabled": "Enable the plugin and save to use this button.",
			"settings.warning": "Note",
			"settings.shutdownSection": "One-click shutdown",
			"settings.confirmShutdown": "Confirm before exit",
			"settings.confirmShutdownHint": "When off, the button exits immediately without a confirm dialog.",
			"entry.label": "Exit DeepSeek Harness",
			"dialog.title": "Confirm exit",
			"dialog.description": "Closing DeepSeek Harness ends the dsh web process; running sessions, tasks and unsaved state may be interrupted. Are you sure you want to exit?",
			"dialog.confirm": "Exit",
			"dialog.cancel": "Cancel",
			"dialog.shuttingDown": "Exiting…",
			"dialog.failed": "Exit request failed: {message}",
			"dialog.retry": "Retry",
			"dialog.close": "Close",
			"settings.overridden": "Overridden",
			"settings.reset": "Reset to default",
			"settings.notExposed": "This DSH version does not expose this plugin's settings namespace to the configuration page, so the form is unavailable. Edit $DSH_HOME/settings.yaml directly, or add the namespace to dsh-host-apiproxy's WEB_SETTINGS_NAMESPACES allowlist and restart.",
			"settings.readOnly": "This deployment stores settings read-only.",
			"settings.inherit": "Inherit",
			"settings.on": "On",
			"settings.off": "Off",
			"settings.expand": "Show settings",
			"settings.collapse": "Hide settings",
			"settings.save": "Save",
			"settings.saving": "Saving…",
			"settings.discard": "Discard",
			"settings.unsaved": "Unsaved",
			"settings.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
			"settings.invalidNumber": "Enter a number, or leave blank to use the default."
		};
		//#endregion
		//#region src/client/shutdown-api.ts
		/**
		* Browser-side wire helper for the /api/dsh-desktop-launcher/shutdown surface.
		* Plain fetch over same-origin /api; the host half enforces the loopback-only
		* fence and owns the bounded exit request.
		*/
		/**
		* Ask the host process to exit. Resolves when the host acknowledges; the
		* process tears down shortly afterwards.
		* @returns settlement after the acknowledgement.
		*/
		async function requestShutdown() {
			const response = await fetch(LAUNCHER_API.shutdown, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}"
			});
			if (!response.ok) throw new Error("shutdown request failed (HTTP " + String(response.status) + ")");
		}
		/**
		* Close the current page before the host process exits. `window.close()`
		* only works for script-opened windows; for a regular tab the browser
		* ignores it, so the fallback replaces the page with a blank tab instead of
		* leaving the user staring at a dead-server connection error.
		*/
		function closeCurrentPage() {
			window.close();
			if (!window.closed) window.location.replace("about:blank");
		}
		//#endregion
		//#region src/client/ShutdownEntry.tsx
		/**
		* The floating power trigger: a Windows-style shutdown icon button at the
		* bottom-right of the page. Clicking it opens a confirm dialog; the confirmed
		* request POSTs to the loopback-only /api/dsh-desktop-launcher/shutdown route,
		* and the host process exits gracefully (ctx.appExit) a beat after the
		* response.
		*/
		/**
		* The Windows-style power icon (a circle with a vertical line at the top).
		* @param size - rendered side length.
		* @returns the icon element.
		*/
		function PowerIcon({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M6.9 6.4A8.6 8.6 0 1 0 17.1 6.4",
					stroke: "currentColor",
					strokeWidth: "2.2",
					strokeLinecap: "round"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M12 3.5v7.5",
					stroke: "currentColor",
					strokeWidth: "2.2",
					strokeLinecap: "round"
				})]
			});
		}
		/**
		* Render the shutdown trigger and the confirm dialog.
		* @param props - column state, locale copy, and the confirm gate.
		* @returns the entry element tree.
		*/
		function ShutdownEntry(props) {
			const { t, wide, floating = false } = props;
			const [view, setView] = (0, react.useState)("closed");
			const [error, setError] = (0, react.useState)(void 0);
			const close = (0, react.useCallback)(() => {
				setView((current) => current === "shutting-down" ? current : "closed");
			}, []);
			const performShutdown = (0, react.useCallback)(async () => {
				setError(void 0);
				setView("shutting-down");
				try {
					await requestShutdown();
					closeCurrentPage();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : String(caught));
					setView("error");
				}
			}, []);
			const handleTrigger = (0, react.useCallback)(() => {
				if (props.confirmShutdown()) setView("confirm");
				else performShutdown();
			}, [performShutdown, props.confirmShutdown]);
			(0, react.useEffect)(() => {
				if (view === "closed") return;
				const onKeyDown = (event) => {
					if (event.key === "Escape") close();
				};
				window.addEventListener("keydown", onKeyDown);
				return () => {
					window.removeEventListener("keydown", onKeyDown);
				};
			}, [view, close]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: floating ? shutdown_module_css_default.triggerFloating : shutdown_module_css_default.trigger,
				"aria-label": t("entry.label"),
				title: t("entry.label"),
				onClick: handleTrigger,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PowerIcon, { size: floating ? 20 : wide ? 16 : 18 })
			}), view !== "closed" && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: shutdown_module_css_default.overlay,
				role: "presentation",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: shutdown_module_css_default.mask,
					"aria-hidden": "true",
					onClick: close
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: shutdown_module_css_default.dialog,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("dialog.title"),
					children: [
						view === "confirm" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: shutdown_module_css_default.dialogBody,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: shutdown_module_css_default.dialogIcon,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PowerIcon, { size: 22 })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									className: shutdown_module_css_default.dialogTitle,
									children: t("dialog.title")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: shutdown_module_css_default.dialogText,
									children: t("dialog.description")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: shutdown_module_css_default.dialogActions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: shutdown_module_css_default.cancel,
										onClick: close,
										children: t("dialog.cancel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: shutdown_module_css_default.confirm,
										autoFocus: true,
										onClick: () => {
											performShutdown();
										},
										children: t("dialog.confirm")
									})]
								})
							]
						}),
						view === "shutting-down" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: shutdown_module_css_default.dialogBody,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: shutdown_module_css_default.dialogIcon,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PowerIcon, { size: 22 })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: shutdown_module_css_default.dialogStatus,
								role: "status",
								children: t("dialog.shuttingDown")
							})]
						}),
						view === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: shutdown_module_css_default.dialogBody,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: shutdown_module_css_default.dialogIcon,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PowerIcon, { size: 22 })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: shutdown_module_css_default.dialogError,
									role: "alert",
									children: t("dialog.failed", { message: error ?? "" })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: shutdown_module_css_default.dialogActions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: shutdown_module_css_default.cancel,
										onClick: close,
										children: t("dialog.close")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: shutdown_module_css_default.confirm,
										onClick: () => {
											performShutdown();
										},
										children: t("dialog.retry")
									})]
								})
							]
						})
					]
				})]
			}), document.body)] });
		}
		//#endregion
		//#region src/client/floating-mount.tsx
		/**
		* Floating mount for the shutdown power button: a fixed bottom-right trigger
		* that is independent of the sidebar layout, so the exit control is always
		* visible. The confirm dialog portals from the same component.
		*/
		/**
		* Mount the floating power button into document.body.
		* @param face - locale copy and the confirm gate.
		* @returns the disposer unmounting the button and removing the host element.
		*/
		function mountShutdownButton(face) {
			const host = document.createElement("div");
			host.dataset.dshShutdownFloat = "true";
			document.body.appendChild(host);
			const root = (0, react_dom_client.createRoot)(host);
			root.render((0, react.createElement)(ShutdownEntry, {
				wide: true,
				floating: true,
				t: face.t,
				confirmShutdown: face.confirmShutdown
			}));
			return () => {
				root.unmount();
				host.remove();
			};
		}
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "desktop-launcher";
		/** Settings namespace the desktop-launcher card edits (the Host plugin registers it). */
		const DESKTOP_LAUNCHER_NS = "desktop-launcher";
		/** Services required by this plugin. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsScope",
			"remote"
		];
		/**
		* Register the desktop-launcher surface: the plugin settings card over the
		* `desktop-launcher` namespace, contributed to the plugin-configuration
		* group, plus the floating shutdown button.
		* @param ctx - client root context.
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
			}, "desktop-launcher: dictionaries");
			const settingsScope = (ctx.get("webUiSettings") ?? ctx.settingsScope).bind({ namespace: DESKTOP_LAUNCHER_NS });
			const read = () => {
				const snapshot = settingsScope.getSnapshot();
				return snapshot.status === "ready" ? snapshot.value : void 0;
			};
			const enabled = () => {
				const snapshot = settingsScope.getSnapshot();
				return snapshot.status === "ready" ? snapshot.value?.enabled ?? false : snapshot.status === "unavailable";
			};
			const confirmShutdown = () => read()?.confirmShutdown ?? true;
			let disposeFloating;
			const syncFloating = () => {
				if (enabled() && disposeFloating === void 0) disposeFloating = mountShutdownButton({
					t: ctx.locale.bind(NS),
					confirmShutdown
				});
				else if (!enabled() && disposeFloating !== void 0) {
					disposeFloating();
					disposeFloating = void 0;
				}
			};
			settingsScope.subscribe(syncFloating);
			syncFloating();
			const controller = new DesktopLauncherSettingsCardController(settingsScope);
			ctx.slots.inject("web-ui.plugin.item", () => {
				try {
					return ctx.slots.register({
						name: "web-ui.plugin.item",
						id: "desktop-launcher",
						order: 130,
						locale: NS,
						inject: () => controller.inject()
					}, DesktopLauncherSettingsCard);
				} catch {
					return () => {};
				}
			});
		}
		//#endregion
		exports.DesktopLauncherSettingsCard = DesktopLauncherSettingsCard;
		exports.DesktopLauncherSettingsCardController = DesktopLauncherSettingsCardController;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map