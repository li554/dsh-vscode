window.__ModuleLoader__.load({
	id: "@linxin666/dsh-client-ui-aionui-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region \0dsh-css:packages/dsh-aionui-panel/src/client/settings-card.module.css.mjs
		const css$3 = ".bpnj3G_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.bpnj3G_card:hover{border-color:var(--dsw-alias-label-dimmed)}.bpnj3G_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.bpnj3G_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.bpnj3G_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.bpnj3G_headerStatic{border-radius:12px;align-items:center;gap:12px;width:100%;padding:14px 16px;display:flex}.bpnj3G_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.bpnj3G_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.bpnj3G_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.bpnj3G_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.bpnj3G_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.bpnj3G_chevronOpen{transform:rotate(180deg)}.bpnj3G_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.bpnj3G_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}.bpnj3G_notExposed{color:var(--dsw-alias-state-warn-primary);margin:12px 0 0;font-size:12px;line-height:1.5}.bpnj3G_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.bpnj3G_failed{min-width:0;color:var(--dsw-alias-label-error);text-overflow:ellipsis;white-space:nowrap;flex:1;margin:0;font-size:12px;line-height:1.5;overflow:hidden}.bpnj3G_discard,.bpnj3G_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.bpnj3G_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.bpnj3G_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.bpnj3G_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.bpnj3G_discard:disabled,.bpnj3G_save:disabled{opacity:.4;cursor:default}.bpnj3G_discard:focus-visible,.bpnj3G_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.bpnj3G_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.bpnj3G_field+.bpnj3G_field{border-top:1px solid var(--dsw-alias-border-l2)}.bpnj3G_head{align-items:center;gap:8px;display:flex}.bpnj3G_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.bpnj3G_badges{align-items:center;gap:8px;display:inline-flex}.bpnj3G_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.bpnj3G_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.bpnj3G_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.bpnj3G_reset:disabled{cursor:default}.bpnj3G_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.bpnj3G_input,.bpnj3G_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.bpnj3G_input:focus-visible,.bpnj3G_select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.bpnj3G_input:disabled,.bpnj3G_select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.bpnj3G_inputInvalid{border:1px solid var(--dsw-alias-label-error);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.bpnj3G_inputInvalid:focus-visible{outline:2px solid var(--dsw-alias-label-error);outline-offset:1px;border-color:var(--dsw-alias-label-error)}.bpnj3G_selectWrap{position:relative}.bpnj3G_selectButton{appearance:none;text-align:left;cursor:pointer;justify-content:space-between;align-items:center;gap:8px;width:100%;display:flex}.bpnj3G_selectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.bpnj3G_selectChevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.bpnj3G_selectChevronOpen{transform:rotate(180deg)}.bpnj3G_selectPopup{z-index:40;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);max-height:240px;box-shadow:0 8px 24px var(--dsw-alias-bg-mask-2);opacity:0;border-radius:8px;flex-direction:column;padding:4px;transition:opacity .1s,transform .1s;display:flex;position:absolute;top:calc(100% + 4px);left:0;right:0;overflow-y:auto;transform:translateY(-4px)}.bpnj3G_selectPopupOpen{opacity:1;transform:none}.bpnj3G_selectPopupClose{opacity:0;pointer-events:none;transform:translateY(-4px)}.bpnj3G_selectOption{color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;text-overflow:ellipsis;border-radius:6px;flex-shrink:0;padding:6px 10px;font-size:13px;line-height:1.5;overflow:hidden}.bpnj3G_selectOption:hover,.bpnj3G_selectOptionActive{background:var(--dsw-alias-interactive-bg-hover)}.bpnj3G_selectOptionSelected{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 10%, transparent);font-weight:500}.bpnj3G_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.bpnj3G_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}@media (prefers-reduced-motion:reduce){.bpnj3G_card,.bpnj3G_header,.bpnj3G_chevron,.bpnj3G_chevronOpen,.bpnj3G_discard,.bpnj3G_save,.bpnj3G_selectChevron,.bpnj3G_selectChevronOpen,.bpnj3G_selectPopup{transition:none}}";
		const tagId$3 = "@linxin666/dsh-client-ui-aionui-panel/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-aionui-panel";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"badge": "bpnj3G_badge",
			"badges": "bpnj3G_badges",
			"body": "bpnj3G_body",
			"card": "bpnj3G_card",
			"cardOpen": "bpnj3G_cardOpen",
			"chevron": "bpnj3G_chevron",
			"chevronOpen": "bpnj3G_chevronOpen",
			"description": "bpnj3G_description",
			"discard": "bpnj3G_discard",
			"failed": "bpnj3G_failed",
			"field": "bpnj3G_field",
			"footer": "bpnj3G_footer",
			"head": "bpnj3G_head",
			"headText": "bpnj3G_headText",
			"header": "bpnj3G_header",
			"headerStatic": "bpnj3G_headerStatic",
			"hint": "bpnj3G_hint",
			"input": "bpnj3G_input",
			"inputInvalid": "bpnj3G_inputInvalid",
			"invalid": "bpnj3G_invalid",
			"label": "bpnj3G_label",
			"name": "bpnj3G_name",
			"notExposed": "bpnj3G_notExposed",
			"pending": "bpnj3G_pending",
			"readOnly": "bpnj3G_readOnly",
			"reset": "bpnj3G_reset",
			"save": "bpnj3G_save",
			"select": "bpnj3G_select",
			"selectButton": "bpnj3G_selectButton",
			"selectChevron": "bpnj3G_selectChevron",
			"selectChevronOpen": "bpnj3G_selectChevronOpen",
			"selectLabel": "bpnj3G_selectLabel",
			"selectOption": "bpnj3G_selectOption",
			"selectOptionActive": "bpnj3G_selectOptionActive",
			"selectOptionSelected": "bpnj3G_selectOptionSelected",
			"selectPopup": "bpnj3G_selectPopup",
			"selectPopupClose": "bpnj3G_selectPopupClose",
			"selectPopupOpen": "bpnj3G_selectPopupOpen",
			"selectWrap": "bpnj3G_selectWrap"
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
		//#endregion
		//#region src/client/settings-form.ts
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
		//#region \0dsh-css:packages/dsh-aionui-panel/src/client/AionUiSettingsCard.module.css.mjs
		const css$2 = "[data-dsh-better-sidebar-settings-nav]{display:none}.w-gdTG_embeddedSection{border-top:1px solid var(--dsw-alias-border-l1);margin-top:12px;padding-top:4px}.w-gdTG_groupTitle{color:var(--dsw-alias-label-secondary);margin:14px 0 6px;font-size:12px;font-weight:600}";
		const tagId$2 = "@linxin666/dsh-client-ui-aionui-panel/AionUiSettingsCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-aionui-panel";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var AionUiSettingsCard_module_css_default = {
			"embeddedSection": "w-gdTG_embeddedSection",
			"groupTitle": "w-gdTG_groupTitle"
		};
		//#endregion
		//#region src/client/SideCardPrefs.tsx
		/**
		* The embedded side-card preferences editor. The external dsh-better-sidebar
		* plugin keeps its user preferences behind its own fenced /sidebar/api
		* settings routes (its settings namespace is not allowlisted on the official
		* settings RPC), so this editor reads and writes through the same transport
		* its own settings section uses: POST /sidebar/api/settings.get for the
		* initial document and revision, POST /sidebar/api/settings.update with a
		* revision-guarded merge patch per change. Changes apply immediately, the
		* same optimistic-then-settle behavior as the plugin's own section.
		*
		* Coverage is the everyday surface of the section page: the general group
		* (open by default, width, chat file opens, position compat) plus the
		* sidebar tab and file viewer enable switches, enumerated live from the
		* plugin's registry service. Niche per-feature settings (terminal font,
		* sandbox switches, strip height) stay in the 'dsh-better-sidebar'
		* namespace of ~/.dsh/settings.yaml.
		* @module @linxin666/dsh-client-ui-aionui-panel/client/SideCardPrefs
		*/
		/** Display fallbacks while a field is absent from the settings document (mirrors the plugin's schema defaults). */
		const PREFS_DEFAULTS = {
			openByDefault: false,
			defaultWidthPercent: 35,
			interceptOpenPath: true,
			titleBarCompat: false,
			tabsEnabled: {},
			viewersEnabled: {}
		};
		const WIDTH_MIN = 20;
		const WIDTH_MAX = 60;
		/** Validate one raw resolved document into the fields this editor renders; malformed fields fall back to defaults. */
		function parsePrefs(value) {
			if (value === null || typeof value !== "object") return { ...PREFS_DEFAULTS };
			const record = value;
			const bool = (key) => typeof record[key] === "boolean" ? record[key] : PREFS_DEFAULTS[key];
			const map = (key) => {
				const raw = record[key];
				if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
				const out = {};
				for (const [id, flag] of Object.entries(raw)) if (typeof flag === "boolean") out[id] = flag;
				return out;
			};
			const width = typeof record.defaultWidthPercent === "number" && Number.isFinite(record.defaultWidthPercent) ? Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(record.defaultWidthPercent))) : PREFS_DEFAULTS.defaultWidthPercent;
			return {
				openByDefault: bool("openByDefault"),
				defaultWidthPercent: width,
				interceptOpenPath: bool("interceptOpenPath"),
				titleBarCompat: bool("titleBarCompat"),
				tabsEnabled: map("tabsEnabled"),
				viewersEnabled: map("viewersEnabled")
			};
		}
		/** POST one settings wire call and unwrap the envelope, mirroring the plugin's own api.call. */
		async function call(method, payload) {
			const response = await fetch("/sidebar/api/" + method, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});
			const parsed = await response.json().catch(() => null);
			if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === void 0) throw new Error(parsed?.error?.message ?? "HTTP " + response.status);
			return parsed.value;
		}
		/** One immediate-apply boolean row. */
		function ToggleRow(props) {
			const id = (0, react.useId)();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.head,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: id,
							children: props.label
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
						id,
						options: [{
							value: "true",
							label: props.onLabel
						}, {
							value: "false",
							label: props.offLabel
						}],
						value: props.value ? "true" : "false",
						disabled: false,
						invalid: false,
						onEdit: (text) => {
							props.onFlip(text === "true");
						}
					}),
					props.hint !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: props.hint
					}) : null
				]
			});
		}
		/** The width row: a number input committing on blur or Enter, clamped to the contract range. */
		function WidthRow(props) {
			const [draft, setDraft] = (0, react.useState)(String(props.value));
			(0, react.useEffect)(() => {
				setDraft(String(props.value));
			}, [props.value]);
			const commit = () => {
				const parsed = Number(draft);
				if (!Number.isFinite(parsed)) {
					setDraft(String(props.value));
					return;
				}
				const clamped = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(parsed)));
				setDraft(String(clamped));
				if (clamped !== props.value) props.onCommit(clamped);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.head,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.label,
							children: props.label
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: settings_card_module_css_default.input,
						type: "text",
						inputMode: "numeric",
						"aria-label": props.label,
						value: draft,
						onChange: (event) => {
							setDraft(event.target.value);
						},
						onBlur: commit,
						onKeyDown: (event) => {
							if (event.key === "Enter") commit();
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: props.hint
					})
				]
			});
		}
		/** A descriptor's display title (a plain string or its localized thunk), id as the fallback. */
		function descriptorTitle(descriptor) {
			const title = typeof descriptor.title === "function" ? descriptor.title() : descriptor.title;
			return title !== void 0 && title !== "" ? title : descriptor.id;
		}
		function SideCardPrefs(props) {
			const { t } = props;
			const [prefs, setPrefs] = (0, react.useState)(null);
			const [failed, setFailed] = (0, react.useState)(false);
			const revisionRef = (0, react.useRef)(void 0);
			const inFlightRef = (0, react.useRef)(Promise.resolve());
			const [, setRegistryVersion] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				let cancelled = false;
				call("settings.get", {}).then((view) => {
					if (cancelled) return;
					revisionRef.current = view.revision;
					setPrefs(parsePrefs(view.value));
				}).catch(() => {
					if (!cancelled) setFailed(true);
				});
				return () => {
					cancelled = true;
				};
			}, []);
			(0, react.useEffect)(() => {
				if (props.sidebar === void 0) return void 0;
				return props.sidebar.subscribe(() => {
					setRegistryVersion((version) => version + 1);
				});
			}, [props.sidebar]);
			/** Optimistically apply one merge patch, then commit; a failed commit refetches the authoritative document. */
			const applyPref = (patch) => {
				const run = inFlightRef.current.then(async () => {
					const view = await call("settings.update", {
						patch: { ...patch },
						...revisionRef.current !== void 0 ? { expectedRevision: revisionRef.current } : {}
					});
					revisionRef.current = view.revision;
					setPrefs(parsePrefs(view.value));
				}).catch(async () => {
					const view = await call("settings.get", {}).catch(() => null);
					if (view !== null) {
						revisionRef.current = view.revision;
						setPrefs(parsePrefs(view.value));
					}
				});
				inFlightRef.current = run.then(() => void 0, () => void 0);
				run.catch(() => void 0);
				setPrefs((previous) => previous === null ? previous : {
					...previous,
					...patch
				});
			};
			if (failed) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: settings_card_module_css_default.hint,
				role: "status",
				children: t("settings.prefsUnavailable")
			});
			if (prefs === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: settings_card_module_css_default.hint,
				role: "status",
				children: t("settings.prefsLoading")
			});
			const onLabel = t("settings.on");
			const offLabel = t("settings.off");
			const tabs = props.sidebar?.getTabs() ?? [];
			const viewers = props.sidebar?.getFileViewers() ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AionUiSettingsCard_module_css_default.groupTitle,
					children: t("settings.generalTitle")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
					label: t("settings.openByDefault"),
					hint: t("settings.openByDefaultHint"),
					value: prefs.openByDefault,
					onLabel,
					offLabel,
					onFlip: (next) => {
						applyPref({ openByDefault: next });
					}
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WidthRow, {
					label: t("settings.width"),
					hint: t("settings.widthHint"),
					value: prefs.defaultWidthPercent,
					onCommit: (next) => {
						applyPref({ defaultWidthPercent: next });
					}
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
					label: t("settings.openPath"),
					hint: t("settings.openPathHint"),
					value: prefs.interceptOpenPath,
					onLabel,
					offLabel,
					onFlip: (next) => {
						applyPref({ interceptOpenPath: next });
					}
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
					label: t("settings.titleBar"),
					hint: t("settings.titleBarHint"),
					value: prefs.titleBarCompat,
					onLabel,
					offLabel,
					onFlip: (next) => {
						applyPref({ titleBarCompat: next });
					}
				}),
				tabs.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AionUiSettingsCard_module_css_default.groupTitle,
					children: t("settings.tabsTitle")
				}), tabs.map((tab) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
					label: descriptorTitle(tab),
					value: prefs.tabsEnabled[tab.id] !== false,
					onLabel,
					offLabel,
					onFlip: (next) => {
						applyPref({ tabsEnabled: {
							...prefs.tabsEnabled,
							[tab.id]: next
						} });
					}
				}, tab.id))] }) : null,
				viewers.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AionUiSettingsCard_module_css_default.groupTitle,
					children: t("settings.viewersTitle")
				}), viewers.map((viewer) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
					label: descriptorTitle(viewer),
					hint: viewer.exts.length > 0 ? viewer.exts.join(" · ") : void 0,
					value: prefs.viewersEnabled[viewer.id] !== false,
					onLabel,
					offLabel,
					onFlip: (next) => {
						applyPref({ viewersEnabled: {
							...prefs.viewersEnabled,
							[viewer.id]: next
						} });
					}
				}, viewer.id))] }) : null
			] });
		}
		//#endregion
		//#region src/client/AionUiSettingsCard.tsx
		/** The external plugin the side card (right panel) comes from. */
		const SIDE_CARD_SOURCE_URL = "https://github.com/omdsh-dev/DSH-better-sidebar";
		/** Bridges the 'aionui-panel' scope onto the card's availability anchor. */
		var AionUiSettingsCardController = class {
			form;
			store;
			/** @param scope - the bound settings scope for the 'aionui-panel' namespace. */
			constructor(scope) {
				this.form = new CardForm(scope, []);
				this.store = this.form.bind(() => this.form.shell());
			}
			/**
			* Build the face the card's slot registration injects.
			* @returns the card's snapshot and its form actions.
			*/
			inject() {
				return {
					hooks: { aionUiSettingsCard: this.store },
					...this.form.actions()
				};
			}
			/**
			* Release the card's scope subscription and bound stores; the slot
			* disposer calls this on teardown.
			*/
			dispose() {
				this.form.dispose();
			}
		};
		/**
		* Render the side-card card: the attribution line plus the embedded side
		* card preferences editor.
		* @param props - locale copy, the card snapshot, its form actions, and the
		*   external registry face.
		* @returns the card.
		*/
		function AionUiSettingsCard(props) {
			const { t } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PluginSettingsCard, {
				t,
				titleKey: "settings.title",
				descriptionKey: "settings.description",
				defaultOpen: false,
				hideFooter: true,
				state: props.useAionUiSettingsCard((snapshot) => snapshot),
				onSave: props.save,
				onDiscard: props.discard,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: settings_card_module_css_default.hint,
					children: [
						t("settings.sourcePrefix"),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							href: SIDE_CARD_SOURCE_URL,
							target: "_blank",
							rel: "noreferrer",
							children: "github.com/omdsh-dev/DSH-better-sidebar"
						}),
						t("settings.sourceSuffix")
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AionUiSettingsCard_module_css_default.embeddedSection,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SideCardPrefs, {
						t,
						sidebar: props.sidebar
					})
				})]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Locale strings for the panel surfaces (zh/en). The client registers the
		* dictionary through the locale service like the sibling plugins; copy is
		* deliberately short and technical.
		* @module dsh-aionui-panel/client/locales
		*/
		const zh = {
			"explorer.tabs.files": "文件",
			"explorer.tabs.changes": "变更",
			"explorer.search.placeholder": "按文件名搜索",
			"explorer.search.searching": "搜索中…",
			"explorer.search.empty": "没有匹配的文件",
			"explorer.search.error": "搜索失败",
			"explorer.search.truncated": "结果过多，仅显示前 {count} 条",
			"explorer.tree.empty": "项目为空",
			"explorer.collapse": "收起面板",
			"explorer.expand": "展开面板",
			"explorer.maximize": "最大化文件面板",
			"explorer.restore": "还原面板",
			"explorer.openPreview": "打开预览",
			"explorer.drag.dropHint": "松手插入文件路径",
			"scm.repositories": "存储库",
			"scm.changes": "变更",
			"scm.staged": "已暂存",
			"scm.unstaged": "变更",
			"scm.untracked": "未跟踪",
			"scm.conflicted": "冲突",
			"scm.stage": "暂存",
			"scm.unstage": "取消暂存",
			"scm.discard": "放弃更改",
			"scm.stageAll": "全部暂存",
			"scm.discardAll": "全部放弃",
			"scm.empty": "没有更改",
			"scm.notRepo": "当前目录不是 git 仓库",
			"scm.gitMissing": "未检测到 git，请先安装 git 后重试",
			"scm.loading": "读取状态中…",
			"scm.failed": "操作失败",
			"scm.viewList": "列表视图",
			"scm.viewTree": "树视图",
			"scm.discardConfirmTracked": "放弃对 {count} 个文件的更改？此操作不可恢复。",
			"scm.discardConfirmUntracked": "删除 {count} 个未跟踪文件？此操作不可恢复。",
			"preview.noTabs": "没有打开的预览",
			"preview.newUrlTab": "新建 URL 预览",
			"preview.collapsePanel": "收起预览面板",
			"preview.maximize": "最大化预览面板",
			"preview.restore": "还原面板",
			"preview.source": "源码",
			"preview.preview": "预览",
			"preview.editor": "编辑器",
			"preview.split": "分屏",
			"preview.refresh": "刷新",
			"preview.refresh.updated": "文件已在磁盘更新",
			"preview.save": "保存",
			"preview.download": "下载",
			"preview.copyCode": "复制代码",
			"preview.copyCodeDone": "已复制",
			"preview.openExternal": "在系统应用中打开",
			"preview.dirty": "未保存的更改",
			"preview.closeLeft": "关闭左侧",
			"preview.closeRight": "关闭右侧",
			"preview.closeOthers": "关闭其他",
			"preview.closeAll": "关闭全部",
			"preview.closeConfirmTitle": "关闭未保存的标签页",
			"preview.closeConfirmBody": "{count} 个标签页有未保存的更改，关闭将丢失这些更改。",
			"preview.saved": "已保存",
			"preview.saveConflict": "文件已在磁盘上被修改，保存冲突：请刷新后重试",
			"preview.errorOversized": "文件过大，仅加载前 80,000 字符",
			"preview.unsupported": "此格式暂不支持预览",
			"preview.downloadHint": "可在系统应用中打开或下载查看",
			"preview.url.placeholder": "输入网址，回车打开",
			"preview.url.hint": "按 Esc 还原",
			"common.cancel": "取消",
			"common.confirm": "确定",
			"common.close": "关闭",
			"common.delete": "删除",
			"common.copyPath": "复制路径",
			"common.copied": "已复制",
			"explorer.menu.copyPath": "复制路径",
			"explorer.menu.copyName": "复制名称",
			"explorer.menu.reveal": "在文件管理器中显示",
			"explorer.menu.openWithDefault": "用默认应用打开",
			"explorer.menu.rename": "重命名",
			"explorer.menu.newFile": "新建文件",
			"explorer.menu.newFolder": "新建文件夹",
			"explorer.menu.delete": "删除",
			"explorer.rename.title": "重命名",
			"explorer.newFile.title": "新建文件",
			"explorer.newFolder.title": "新建文件夹",
			"explorer.deleteConfirmTitle": "删除确认",
			"explorer.deleteConfirmBody": "确定要删除「{name}」吗？此操作不可恢复。",
			"explorer.opFailed": "操作失败",
			"settings.title": "侧边卡片",
			"settings.description": "右侧面板由侧边卡片提供，来自 DSH-better-sidebar（github.com/omdsh-dev/DSH-better-sidebar）。",
			"settings.sourcePrefix": "侧边卡片（右侧面板）由外部插件 DSH-better-sidebar 提供，来自 ",
			"settings.sourceSuffix": "。以下为常用设置，改动即时生效。",
			"settings.generalTitle": "常规",
			"settings.openByDefault": "新会话默认打开",
			"settings.openByDefaultHint": "新建会话时自动展开侧边卡片；已存在的会话保持各自布局",
			"settings.width": "默认宽度占比",
			"settings.widthHint": "新建会话时侧边卡片占窗口宽度的百分比 (20–60)",
			"settings.openPath": "聊天区文件在侧边栏打开",
			"settings.openPathHint": "在聊天里点击文件链接（工具行、产物列表、文件提及）时，在侧边栏编辑器中打开，不再调用系统默认应用",
			"settings.titleBar": "位置兼容模式",
			"settings.titleBarHint": "为 Windows 右上角的原生标题栏预留空间：侧边栏按钮与侧边栏内容整体下移，避免被标题栏遮挡",
			"settings.tabsTitle": "侧边栏内容",
			"settings.viewersTitle": "文件预览",
			"settings.prefsLoading": "设置加载中…",
			"settings.prefsUnavailable": "侧边卡片设置不可用：未安装 dsh-better-sidebar 或其设置路由不可达。",
			"settings.overridden": "已覆盖",
			"settings.reset": "恢复默认",
			"settings.notExposed": "当前 DSH 版本未向设置页暴露本插件的配置命名空间，表单不可用。可编辑 ~/.dsh/settings.yaml 直接配置，或为 dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES 白名单补充本命名空间后重启。",
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
		const en = {
			"explorer.tabs.files": "Files",
			"explorer.tabs.changes": "Changes",
			"explorer.search.placeholder": "Search file names",
			"explorer.search.searching": "Searching…",
			"explorer.search.empty": "No matching files",
			"explorer.search.error": "Search failed",
			"explorer.search.truncated": "Too many results, showing first {count}",
			"explorer.tree.empty": "The project is empty",
			"explorer.collapse": "Collapse panel",
			"explorer.expand": "Expand panel",
			"explorer.maximize": "Maximize files panel",
			"explorer.restore": "Restore panel",
			"explorer.openPreview": "Open preview",
			"explorer.drag.dropHint": "Release to insert the file path",
			"scm.repositories": "Repositories",
			"scm.changes": "Changes",
			"scm.staged": "Staged",
			"scm.unstaged": "Changes",
			"scm.untracked": "Untracked",
			"scm.conflicted": "Conflict",
			"scm.stage": "Stage",
			"scm.unstage": "Unstage",
			"scm.discard": "Discard",
			"scm.stageAll": "Stage all",
			"scm.discardAll": "Discard all",
			"scm.empty": "No changes",
			"scm.notRepo": "Not a git repository",
			"scm.gitMissing": "Git is not installed. Install git and reload to use the changes panel",
			"scm.loading": "Loading status…",
			"scm.failed": "Operation failed",
			"scm.viewList": "List view",
			"scm.viewTree": "Tree view",
			"scm.discardConfirmTracked": "Discard changes in {count} files? This cannot be undone.",
			"scm.discardConfirmUntracked": "Delete {count} untracked files? This cannot be undone.",
			"preview.noTabs": "No open previews",
			"preview.newUrlTab": "New URL preview",
			"preview.collapsePanel": "Collapse preview panel",
			"preview.maximize": "Maximize preview panel",
			"preview.restore": "Restore panel",
			"preview.source": "Source",
			"preview.preview": "Preview",
			"preview.editor": "Editor",
			"preview.split": "Split",
			"preview.refresh": "Refresh",
			"preview.refresh.updated": "File updated on disk",
			"preview.save": "Save",
			"preview.download": "Download",
			"preview.copyCode": "Copy code",
			"preview.copyCodeDone": "Copied",
			"preview.openExternal": "Open in system app",
			"preview.dirty": "Unsaved changes",
			"preview.closeLeft": "Close left",
			"preview.closeRight": "Close right",
			"preview.closeOthers": "Close others",
			"preview.closeAll": "Close all",
			"preview.closeConfirmTitle": "Close unsaved tabs",
			"preview.closeConfirmBody": "{count} tabs have unsaved changes. Closing will lose them.",
			"preview.saved": "Saved",
			"preview.saveConflict": "File changed on disk. Save conflict: refresh and retry",
			"preview.errorOversized": "File too large, only the first 80,000 characters loaded",
			"preview.unsupported": "Preview not supported for this format",
			"preview.downloadHint": "Open in a system app or download to view",
			"preview.url.placeholder": "Enter a URL and press Enter",
			"preview.url.hint": "Press Esc to revert",
			"common.cancel": "Cancel",
			"common.confirm": "OK",
			"common.close": "Close",
			"common.delete": "Delete",
			"common.copyPath": "Copy path",
			"common.copied": "Copied",
			"explorer.menu.copyPath": "Copy path",
			"explorer.menu.copyName": "Copy name",
			"explorer.menu.reveal": "Reveal in file manager",
			"explorer.menu.openWithDefault": "Open with default app",
			"explorer.menu.rename": "Rename",
			"explorer.menu.newFile": "New file",
			"explorer.menu.newFolder": "New folder",
			"explorer.menu.delete": "Delete",
			"explorer.rename.title": "Rename",
			"explorer.newFile.title": "New file",
			"explorer.newFolder.title": "New folder",
			"explorer.deleteConfirmTitle": "Confirm delete",
			"explorer.deleteConfirmBody": "Delete \"{name}\"? This cannot be undone.",
			"explorer.opFailed": "Operation failed",
			"settings.title": "Side Card",
			"settings.description": "The right panel is the side card from DSH-better-sidebar (github.com/omdsh-dev/DSH-better-sidebar).",
			"settings.sourcePrefix": "The side card (right panel) is provided by the external DSH-better-sidebar plugin, from ",
			"settings.sourceSuffix": ". Its everyday settings follow below and apply immediately.",
			"settings.generalTitle": "General",
			"settings.openByDefault": "Open for new conversations",
			"settings.openByDefaultHint": "New conversations expand the side card automatically; existing conversations keep their own layout",
			"settings.width": "Default width percent",
			"settings.widthHint": "The percentage of the window width the side card occupies in new conversations (20-60)",
			"settings.openPath": "Open chat files in the side card",
			"settings.openPathHint": "File links in chat (tool rows, produced lists, file mentions) open in the side card editor instead of the system default app",
			"settings.titleBar": "Position compatibility mode",
			"settings.titleBarHint": "Reserves space for the native Windows title bar at the top right: the sidebar buttons and content shift down to clear it",
			"settings.tabsTitle": "Sidebar content",
			"settings.viewersTitle": "File previews",
			"settings.prefsLoading": "Loading settings…",
			"settings.prefsUnavailable": "Side card settings unavailable: dsh-better-sidebar is not installed or its settings route is unreachable.",
			"settings.overridden": "Overridden",
			"settings.reset": "Reset",
			"settings.notExposed": "This DSH version does not expose this plugin's settings namespace; the form is unavailable. Edit ~/.dsh/settings.yaml directly, or add the namespace to the WEB_SETTINGS_NAMESPACES allowlist of dsh-host-apiproxy and restart.",
			"settings.readOnly": "Settings are read-only in this deployment.",
			"settings.inherit": "Inherit",
			"settings.on": "On",
			"settings.off": "Off",
			"settings.expand": "Expand settings",
			"settings.collapse": "Collapse settings",
			"settings.save": "Save",
			"settings.saving": "Saving…",
			"settings.discard": "Discard",
			"settings.unsaved": "Unsaved",
			"settings.saveFailed": "The deployment rejected these values; your edits are kept.",
			"settings.invalidNumber": "Enter a number, or leave it empty to use the default."
		};
		/** The dictionary namespace this plugin owns. */
		const NS = "aionui-panel";
		/** Format one copy string with {name} placeholders. */
		function format(template, params) {
			return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
		}
		/** Simple dictionary access (zh/en by a global flag the client sets). */
		const dictionaries = {
			zh,
			en
		};
		let currentLanguage = "zh";
		/** Translate one key with optional params. */
		function t(key, params) {
			const template = (dictionaries[currentLanguage] ?? zh)[key] ?? zh[key];
			return params === void 0 ? template : format(template, params);
		}
		/**
		* Whether a drag event carries our file payload.
		* @param types - the live `dataTransfer.types` list (read-only during drag).
		* @returns true when our MIME is present.
		*/
		function hasFileDrag(types) {
			return types !== void 0 && types.includes("application/x-dsh-file");
		}
		/**
		* Whether a drop payload is a plausible workspace-relative path. The custom
		* MIME only proves the drag carries *some* string — a foreign page can set it
		* too, so the payload itself is validated before it reaches the draft:
		* relative POSIX shape only; no absolute paths, no '..' segments, no
		* backslashes, no control characters, and a sane length.
		* @param path - the raw payload from dataTransfer.
		* @returns true when the payload is safe to splice into the draft.
		*/
		function isValidFileDragPayload(path) {
			if (path === "" || path.length > 512) return false;
			if (path.startsWith("/") || path.includes("\\")) return false;
			if (/[\x00-\x1f\x7f]/.test(path)) return false;
			if (path.split("/").some((segment) => segment === "..")) return false;
			return true;
		}
		/**
		* Splice a workspace-relative path into a composer draft at the caret.
		*
		* Separator rule: one space is added before the path unless the caret sits
		* at the start of the draft or right after whitespace; one space is added
		* after the path unless the caret sits at the end of the draft or right
		* before whitespace. Empty path or an out-of-range caret are no-ops.
		*
		* @param draft - the current draft text.
		* @param path - the relative path to insert.
		* @param caret - insertion offset (default: the end of the draft).
		* @returns the next draft; the caller owns writing it through the input
		* facade.
		*/
		function insertPathIntoDraft(draft, path, caret) {
			if (path === "") return draft;
			const at = caret === void 0 ? draft.length : Math.min(Math.max(caret, 0), draft.length);
			const before = draft.slice(0, at);
			const after = draft.slice(at);
			const needBefore = before !== "" && !/\s$/.test(before);
			const needAfter = after !== "" && !/^\s/.test(after);
			return before + (needBefore ? " " : "") + path + (needAfter ? " " : "") + after;
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-aionui-panel/src/client/styles/drag.module.css.mjs
		const css$1 = ".YLsg1q_strip{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width,720px);border:1px dashed var(--aion-primary);color:var(--aion-text-primary);background-color:color-mix(in srgb, var(--aion-primary) 10%, transparent);border-radius:8px;justify-content:center;align-items:center;margin:0 auto;display:none}.YLsg1q_stripActive{height:26px;display:flex}.YLsg1q_stripText{font-size:12px;line-height:18px}";
		const tagId$1 = "@linxin666/dsh-client-ui-aionui-panel/drag.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-aionui-panel";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var drag_module_css_default = {
			"strip": "YLsg1q_strip",
			"stripActive": "YLsg1q_stripActive",
			"stripText": "YLsg1q_stripText"
		};
		//#endregion
		//#region src/client/drag/DragFileInlay.tsx
		/**
		* Composer dock inlay: the drop target for explorer file drags. It mounts
		* in the official `conversation.input.dock` band (a session-scoped list
		* slot declared by the shipped ui-conversation rc.6 shell), so it stacks
		* with the git-graph chip above the composer card. While a file row is
		* dragged over the page it shows a hint strip; on drop it splices the
		* workspace-relative path into the active session's draft through the
		* conversation input facade.
		*
		* The document-level listeners only claim drags carrying our custom MIME —
		* the composer host's own drop handling (OS image files) is untouched. The
		* host's `dragover` refuses every drop it does not claim, so this inlay
		* must `preventDefault` its own drags to make the drop land.
		* @module dsh-aionui-panel/client/drag/DragFileInlay
		*/
		/**
		* The composer dock entry: a zero-height anchor that shows a hint strip
		* while a file row is dragged over the page and inserts the path on drop.
		* @param props - the composed dock entry props.
		*/
		function DragFileInlay(props) {
			const [active, setActive] = (0, react.useState)(false);
			const depth = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				const reset = () => {
					depth.current = 0;
					setActive(false);
				};
				const onDragOver = (event) => {
					if (!hasFileDrag(event.dataTransfer?.types)) return;
					event.preventDefault();
					depth.current += 1;
					setActive(true);
				};
				const onDragLeave = (event) => {
					if (!hasFileDrag(event.dataTransfer?.types)) return;
					depth.current = Math.max(0, depth.current - 1);
					if (depth.current === 0) setActive(false);
				};
				const onDrop = (event) => {
					if (!hasFileDrag(event.dataTransfer?.types)) return;
					event.preventDefault();
					const path = event.dataTransfer?.getData("application/x-dsh-file") ?? "";
					reset();
					if (isValidFileDragPayload(path)) props.insertPath(path);
				};
				const onDragEnd = () => reset();
				document.addEventListener("dragover", onDragOver);
				document.addEventListener("dragleave", onDragLeave);
				document.addEventListener("drop", onDrop);
				window.addEventListener("dragend", onDragEnd);
				return () => {
					document.removeEventListener("dragover", onDragOver);
					document.removeEventListener("dragleave", onDragLeave);
					document.removeEventListener("drop", onDrop);
					window.removeEventListener("dragend", onDragEnd);
				};
			}, [props.insertPath]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: active ? `${drag_module_css_default.strip} ${drag_module_css_default.stripActive}` : drag_module_css_default.strip,
				"data-testid": "aionui-drag-inlay",
				"aria-live": "polite",
				children: active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: drag_module_css_default.stripText,
					children: t("explorer.drag.dropHint")
				}) : null
			});
		}
		//#endregion
		//#region src/client/preview/mermaid.ts
		/** Host-served mermaid IIFE bundle (lib/assets/mermaid.min.js behind the route). */
		const MERMAID_VENDOR_URL = "/aionui-panel/vendor/mermaid.js";
		/** Lifecycle state stamped on diagram containers (`pending`/`rendering`/`done`). */
		const DATA_STATE = "data-mermaid-state";
		/** State stamped on a code block once its container exists (`claimed`). */
		const DATA_CLAIMED = "data-mermaid-claimed";
		/** The verbatim diagram source kept on the container for theme re-renders. */
		const DATA_SOURCE = "data-mermaid-source";
		/** Marker the preview viewer stamps on its own subtree (chat enhancement skips it). */
		const DATA_MD_SCOPE = "data-aionui-md-scope";
		let loadPromise;
		/**
		* Resolve the mermaid global left by the vendor IIFE bundle, or null while
		* absent. Narrow and defensive: the bundle is a third-party artifact.
		*/
		function mermaidGlobal() {
			const candidate = globalThis.mermaid;
			if (typeof candidate !== "object" || candidate === null) return null;
			const checked = candidate;
			if (typeof checked.initialize !== "function" || typeof checked.render !== "function") return null;
			return checked;
		}
		/**
		* Load the mermaid runtime once per page: injects a <script> for the host
		* vendor route and resolves with the runtime. Concurrent callers share one
		* injection; a failure clears the cache so a later surface can retry.
		*/
		function loadMermaidLibrary() {
			const existing = mermaidGlobal();
			if (existing !== null) return Promise.resolve(existing);
			if (loadPromise !== void 0) return loadPromise;
			loadPromise = new Promise((resolve, reject) => {
				const script = document.createElement("script");
				script.src = MERMAID_VENDOR_URL;
				script.async = true;
				script.onload = () => {
					const runtime = mermaidGlobal();
					if (runtime === null) {
						loadPromise = void 0;
						reject(/* @__PURE__ */ new Error("mermaid vendor script loaded but window.mermaid is missing"));
						return;
					}
					resolve(runtime);
				};
				script.onerror = () => {
					loadPromise = void 0;
					reject(/* @__PURE__ */ new Error(`failed to load ${MERMAID_VENDOR_URL}`));
				};
				document.head.appendChild(script);
			});
			return loadPromise;
		}
		/** Mermaid theme name for the shell theme marker (`default` or `dark`). */
		function mermaidTheme(isDark) {
			return isDark ? "dark" : "default";
		}
		/** Whether the shell currently carries the dark marker attribute. */
		function shellIsDark() {
			return document.body.hasAttribute("data-ds-dark-theme");
		}
		/** Monotonic id source for render calls (mermaid keys its <svg> by id). */
		let renderSeq = 0;
		/**
		* Configure the mermaid runtime for the current theme. Called once per
		* render batch (enhance or retheme), not per diagram, so a surface with
		* many diagrams initializes the runtime a single time.
		*/
		function initializeRuntime(runtime, theme) {
			runtime.initialize({
				startOnLoad: false,
				theme,
				securityLevel: "strict",
				fontFamily: "\"trebuchet ms\", verdana, arial, sans-serif"
			});
		}
		/** Render one diagram source to SVG with the already-initialized runtime. */
		async function renderSvg(runtime, source) {
			const { svg } = await runtime.render(`aionui-mermaid-${renderSeq += 1}`, source);
			return svg;
		}
		/** Disallowed elements removed from mermaid SVG output before innerHTML. */
		const DISALLOWED_ELEMENTS = [
			"script",
			"foreignObject",
			"iframe",
			"object",
			"embed"
		];
		/** Whether an attribute name is an { on* } event-handler (case-insensitive). */
		function isEventHandler(name) {
			return /^on/i.test(name);
		}
		/** Whether an href/xlink:href value carries an executable javascript: URL. */
		function isDangerousHref(value) {
			return /^javascript:/i.test(value.trim());
		}
		/**
		* Application-level defense-in-depth on top of mermaid's own strict-mode
		* escaping: parse the rendered SVG in a detached container, remove disallowed
		* elements and dangerous attributes, and return the serialized cleaned markup.
		* Throws when the input cannot be parsed as markup or still carries dangerous
		* raw tokens, so callers fall back to their failure path.
		*/
		function sanitizeSvg(svg) {
			const template = document.createElement("template");
			template.innerHTML = svg;
			const root = template.content;
			for (let found = true; found;) {
				found = false;
				for (const el of Array.from(root.querySelectorAll("*"))) if (DISALLOWED_ELEMENTS.some((tag) => el.tagName.toLowerCase() === tag.toLowerCase())) {
					el.remove();
					found = true;
				}
			}
			for (const el of Array.from(root.querySelectorAll("*"))) for (const attr of Array.from(el.attributes)) if (isEventHandler(attr.name) || isDangerousHref(attr.value)) el.removeAttribute(attr.name);
			const cleaned = template.innerHTML;
			const lower = cleaned.toLowerCase();
			if (lower.includes("<script") || lower.includes("javascript:")) throw new Error("mermaid SVG still contains dangerous tokens after sanitization");
			return cleaned;
		}
		/**
		* Collect the still-unclaimed fenced mermaid code blocks under one scope.
		* Three shapes are found:
		* - the panel renderer's `pre.language-mermaid`;
		* - `pre > code.language-mermaid` (kept for older shells);
		* - the shell chat renderer's `div.md-code-block`: its `<pre>` carries
		*   no language class, so the banner infostring (`[class*="_infostring_"]`,
		*   text exactly `mermaid`) is the only anchor. Mid-stream fences render
		*   with an empty infostring and are skipped until the fence closes.
		* The claim always targets the <pre>. Empty blocks and blocks another
		* driver already claimed are skipped. Pure (DOM-read only) so tests can
		* drive it in jsdom.
		*/
		function findMermaidCodeBlocks(scope) {
			const found = [];
			const seen = /* @__PURE__ */ new Set();
			const push = (pre) => {
				if (pre === null || !(pre instanceof HTMLPreElement)) return;
				if (seen.has(pre)) return;
				seen.add(pre);
				if (pre.hasAttribute(DATA_CLAIMED)) return;
				if ((pre.textContent ?? "").trim() === "") return;
				found.push(pre);
			};
			for (const el of Array.from(scope.querySelectorAll("pre.language-mermaid, code.language-mermaid"))) push(el instanceof HTMLPreElement ? el : el.parentElement);
			const shellBlocks = [];
			if (scope instanceof Element && scope.matches("div.md-code-block")) shellBlocks.push(scope);
			shellBlocks.push(...Array.from(scope.querySelectorAll("div.md-code-block")));
			for (const block of shellBlocks) {
				if ((block.querySelector("[class*=\"_infostring_\"]")?.textContent ?? "").trim() !== "mermaid") continue;
				push(block.querySelector("pre"));
			}
			return found;
		}
		/**
		* Swap one code block for a diagram container. The original <pre> stays in
		* the tree (hidden once the render lands) so a failure can restore it
		* verbatim; the container carries the source for theme re-renders.
		*/
		function claimBlock(pre, className) {
			pre.setAttribute(DATA_CLAIMED, "1");
			const container = document.createElement("div");
			container.className = className;
			container.setAttribute(DATA_STATE, "pending");
			container.setAttribute(DATA_SOURCE, pre.textContent ?? "");
			pre.insertAdjacentElement("afterend", container);
			return container;
		}
		/**
		* Render every unclaimed ```mermaid block under `scope` into an inline SVG
		* diagram. Idempotent per block across drivers (claimed blocks are skipped);
		* failures restore the original code block. Never rejects.
		*/
		async function enhanceMermaidBlocks(scope, options) {
			let runtime;
			try {
				runtime = await loadMermaidLibrary();
			} catch {
				return;
			}
			initializeRuntime(runtime, options.theme);
			const jobs = [];
			for (const pre of findMermaidCodeBlocks(scope)) {
				if (options.skip?.(pre) === true) continue;
				const container = claimBlock(pre, options.className);
				jobs.push((async () => {
					try {
						container.setAttribute(DATA_STATE, "rendering");
						const source = container.getAttribute(DATA_SOURCE) ?? "";
						const svg = await renderSvg(runtime, source);
						container.innerHTML = sanitizeSvg(svg);
						container.setAttribute(DATA_STATE, "done");
						pre.style.display = "none";
					} catch {
						container.remove();
						pre.removeAttribute(DATA_CLAIMED);
					}
				})());
			}
			await Promise.all(jobs);
		}
		/**
		* Re-render every completed diagram container under `scope` after a theme
		* flip (stored sources re-render with the new theme). Containers not in the
		* `done` state are skipped; a failure keeps the previous render.
		*/
		async function rethemeMermaidBlocks(scope, options) {
			const runtime = mermaidGlobal();
			if (runtime === null) return;
			initializeRuntime(runtime, options.theme);
			const containers = Array.from(scope.querySelectorAll("[data-mermaid-state=\"done\"]"));
			await Promise.all(containers.map(async (container) => {
				const source = container.getAttribute(DATA_SOURCE) ?? "";
				try {
					container.innerHTML = sanitizeSvg(await renderSvg(runtime, source));
				} catch {}
			}));
		}
		/**
		* One dark-marker watcher per surface: fires on body attribute flips so the
		* caller can retheme. Returns the disposer.
		*/
		function watchShellTheme(onChange) {
			const observer = new MutationObserver(() => {
				onChange(shellIsDark());
			});
			observer.observe(document.body, {
				attributes: true,
				attributeFilter: ["data-ds-dark-theme"]
			});
			return () => {
				observer.disconnect();
			};
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-aionui-panel/src/client/styles/preview.module.css.mjs
		const css = ".YElu8a_panel{background:var(--aion-bg-1);flex-direction:column;height:100%;min-height:0;display:flex}.YElu8a_tabBar{z-index:30;background:var(--aion-bg-2);border-bottom:1px solid var(--aion-bg-3);flex-shrink:0;align-items:stretch;height:36px;display:flex;position:relative}.YElu8a_tabScroll{scrollbar-width:none;flex:1;align-items:stretch;min-width:0;display:flex;overflow:auto hidden}.YElu8a_tabScroll::-webkit-scrollbar{display:none}.YElu8a_tab{cursor:pointer;user-select:none;border-right:1px solid #0000;flex-shrink:0;align-items:center;gap:6px;max-width:180px;height:100%;padding:0 10px;transition:background-color .15s cubic-bezier(.4,0,.2,1);display:flex}.YElu8a_tabActive{background:var(--aion-bg-1);color:var(--aion-text-primary)}.YElu8a_tabInactive{color:var(--aion-text-secondary)}.YElu8a_tabInactive:hover{background:var(--aion-bg-3)}.YElu8a_tab:active{background:var(--aion-bg-active)}.YElu8a_tab:focus-visible{box-shadow:inset 0 0 0 2px var(--aion-primary)}.YElu8a_tabTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:12px;overflow:hidden}.YElu8a_tabFavicon{object-fit:contain;border-radius:2px;flex-shrink:0;width:12px;height:12px}.YElu8a_tabDot{border-radius:9999px;flex-shrink:0;width:6px;height:6px}.YElu8a_tabDotDirty{background:var(--aion-primary);border-radius:9999px;flex-shrink:0;width:6px;height:6px}.YElu8a_tabDotAgent{background:var(--aion-success);border-radius:9999px;flex-shrink:0;width:6px;height:6px;animation:1.6s ease-in-out infinite YElu8a_aionui-pulse}@keyframes YElu8a_aionui-pulse{0%,to{opacity:1}50%{opacity:.4}}.YElu8a_tabClose{width:16px;height:16px;color:var(--aion-text-secondary);border-radius:4px;flex-shrink:0;justify-content:center;align-items:center;transition:background-color .15s cubic-bezier(.4,0,.2,1);display:flex}.YElu8a_tabClose:hover{background:var(--aion-bg-3);color:var(--aion-text-primary)}.YElu8a_tabClose:active{background:var(--aion-bg-active)}.YElu8a_tabClose:focus-visible{box-shadow:inset 0 0 0 2px var(--aion-primary)}.YElu8a_tabPlus{width:24px;height:24px;color:var(--aion-text-secondary);cursor:pointer;border-radius:4px;flex-shrink:0;justify-content:center;align-self:center;align-items:center;margin:0 4px;transition:background-color .15s cubic-bezier(.4,0,.2,1);display:flex}.YElu8a_tabPlus:hover{background:var(--aion-bg-3);color:var(--aion-text-primary)}.YElu8a_tabPlus:active{background:var(--aion-bg-active)}.YElu8a_tabPlus:focus-visible{box-shadow:inset 0 0 0 2px var(--aion-primary)}.YElu8a_tabBarRight{flex-shrink:0;align-items:center;gap:6px;padding:0 10px;display:flex}.YElu8a_panelCollapse,.YElu8a_panelMaximize{width:20px;height:20px;color:var(--aion-text-secondary);cursor:pointer;border-radius:4px;justify-content:center;align-items:center;transition:background-color .15s cubic-bezier(.4,0,.2,1);display:flex}.YElu8a_panelCollapse:hover,.YElu8a_panelMaximize:hover{background:var(--aion-bg-3);color:var(--aion-text-primary)}.YElu8a_panelCollapse:active,.YElu8a_panelMaximize:active{background:var(--aion-bg-active)}.YElu8a_panelCollapse:focus-visible,.YElu8a_panelMaximize:focus-visible{box-shadow:inset 0 0 0 2px var(--aion-primary)}.YElu8a_tabFade{pointer-events:none;z-index:2;width:32px;position:absolute;top:0;bottom:0}.YElu8a_tabFadeLeft{pointer-events:none;z-index:2;background:linear-gradient(90deg, var(--aion-bg-2) 0%, transparent 100%);width:32px;position:absolute;top:0;bottom:0;left:0}.YElu8a_tabFadeRight{pointer-events:none;z-index:2;background:linear-gradient(270deg, var(--aion-bg-2) 0%, transparent 100%);width:32px;position:absolute;top:0;bottom:0;right:0}.YElu8a_noTabs{color:var(--aion-text-tertiary);flex:1;align-items:center;padding:0 10px;font-size:12px;display:flex}.YElu8a_toolbar{background:var(--aion-bg-2);border-bottom:1px solid var(--aion-bg-3);scrollbar-width:none;flex-shrink:0;align-items:center;gap:2px;height:32px;padding:0 10px;display:flex;overflow-x:auto}.YElu8a_toolbar::-webkit-scrollbar{display:none}.YElu8a_toolbarSpacer{flex:1}.YElu8a_toolbarBtn{height:24px;color:var(--aion-text-secondary);font-size:12px;font-family:var(--aion-font-sans);cursor:pointer;white-space:nowrap;background:0 0;border:none;border-radius:4px;flex-shrink:0;align-items:center;gap:4px;padding:0 8px;transition:background-color .15s cubic-bezier(.4,0,.2,1),color .15s cubic-bezier(.4,0,.2,1);display:flex}.YElu8a_toolbarBtn:hover{background:var(--aion-bg-3);color:var(--aion-text-primary)}.YElu8a_toolbarBtn:active{background:var(--aion-bg-active);color:var(--aion-text-primary)}.YElu8a_toolbarBtn:focus-visible{outline:2px solid var(--aion-primary);outline-offset:2px}.YElu8a_toolbarBtn:disabled{opacity:.4;cursor:default}.YElu8a_toolbarBtn:disabled:hover{color:var(--aion-text-secondary);background:0 0}.YElu8a_toolbarBtnActive{color:var(--aion-brand);background:var(--aion-aou-2);border-bottom:4px solid var(--aion-brand)}.YElu8a_toolbarBtnWarn{color:var(--aion-warning)}.YElu8a_content{flex-direction:column;flex:1;min-height:0;display:flex;position:relative}.YElu8a_mdViewer{min-height:0;color:var(--aion-text-primary);word-wrap:break-word;flex:1;padding:16px 20px 32px;font-size:15px;line-height:1.7;overflow:hidden auto}.YElu8a_mdViewer h1{border-bottom:1px solid var(--aion-bg-3);margin:24px 0 12px;padding-bottom:8px;font-size:24px;font-weight:600;line-height:1.3}.YElu8a_mdViewer h1:first-child{margin-top:4px}.YElu8a_mdViewer h2{margin:22px 0 10px;font-size:20px;font-weight:600;line-height:1.3}.YElu8a_mdViewer h3{margin:18px 0 8px;font-size:17px;font-weight:600;line-height:1.3}.YElu8a_mdViewer h4,.YElu8a_mdViewer h5,.YElu8a_mdViewer h6{margin:14px 0 6px;font-size:15px;font-weight:600;line-height:1.3}.YElu8a_mdViewer p{margin:8px 0}.YElu8a_mdViewer ul,.YElu8a_mdViewer ol{margin:8px 0;padding-left:24px}.YElu8a_mdViewer li{margin:3px 0}.YElu8a_mdViewer code{font-family:var(--aion-font-mono);background:var(--aion-bg-2);color:var(--aion-text-primary);border-radius:3px;padding:1px 5px;font-size:.9em}.YElu8a_mdViewer pre{background:var(--aion-bg-2);border-radius:6px;margin:10px 0;padding:12px 14px;line-height:1.5;overflow-x:auto}.YElu8a_mdViewer pre code{color:var(--aion-text-primary);background:0 0;padding:0;font-size:13px}.YElu8a_mermaidBlock{background:var(--aion-bg-2);border:1px solid var(--aion-bg-3);text-align:center;border-radius:6px;margin:10px 0;padding:12px 14px;overflow-x:auto}.YElu8a_mermaidBlock svg{max-width:100%;height:auto}.YElu8a_mermaidBlock[data-mermaid-state=pending],.YElu8a_mermaidBlock[data-mermaid-state=rendering]{opacity:.6;min-height:40px}.YElu8a_mdViewer blockquote{border-left:3px solid var(--aion-bg-3);color:var(--aion-text-secondary);margin:10px 0;padding:4px 14px}.YElu8a_mdViewer blockquote p{margin:4px 0}.YElu8a_mdViewer a{color:var(--aion-primary);text-decoration:none}.YElu8a_mdViewer a:hover{text-decoration:underline}.YElu8a_mdViewer hr{border:none;border-top:1px solid var(--aion-bg-3);margin:20px 0}.YElu8a_mdViewer table{border-collapse:collapse;width:100%;margin:10px 0;font-size:14px}.YElu8a_mdViewer th,.YElu8a_mdViewer td{border:1px solid var(--aion-bg-3);text-align:left;padding:6px 10px}.YElu8a_mdViewer th{background:var(--aion-bg-2);font-weight:600}.YElu8a_mdViewer img{border-radius:4px;max-width:100%}.YElu8a_codeViewer{flex:1;min-height:0;padding:0;overflow:auto}.YElu8a_diffViewer{min-height:0;font-family:var(--aion-font-mono);flex:1;padding:4px 0 16px;font-size:12.5px;line-height:1.55;overflow:auto}.YElu8a_diffLine{white-space:pre;min-height:20px;padding:0 12px;display:flex}.YElu8a_diffLineAdd{background:color-mix(in srgb, var(--aion-success) 12%, transparent);color:var(--aion-text-primary)}.YElu8a_diffLineDel{background:color-mix(in srgb, var(--aion-danger) 12%, transparent);color:var(--aion-text-primary)}.YElu8a_diffLineHunk{background:color-mix(in srgb, var(--aion-primary) 10%, transparent);color:var(--aion-text-secondary)}.YElu8a_diffLineMeta{color:var(--aion-text-tertiary)}.YElu8a_csvViewer{flex:1;min-height:0;padding:12px;overflow:auto}.YElu8a_csvTable{border-collapse:collapse;font-size:13px;font-family:var(--aion-font-mono)}.YElu8a_csvTable th,.YElu8a_csvTable td{border:1px solid var(--aion-bg-3);white-space:nowrap;text-overflow:ellipsis;max-width:480px;padding:4px 10px;overflow:hidden}.YElu8a_csvTable th{background:var(--aion-bg-2);font-weight:600;position:sticky;top:0}.YElu8a_imageViewer{background:var(--aion-bg-base);flex:1;justify-content:center;align-items:center;min-height:0;padding:16px;display:flex;overflow:auto}.YElu8a_imageViewer img{object-fit:contain;border-radius:2px;max-width:100%;max-height:100%}.YElu8a_imageMeta{color:var(--aion-text-tertiary);background:var(--aion-bg-2);border-radius:9999px;padding:2px 10px;font-size:11px;position:absolute;bottom:12px;left:50%;transform:translate(-50%)}.YElu8a_pdfViewer{background:var(--aion-bg-base);border:none;flex:1;min-height:0}.YElu8a_urlBar{background:var(--aion-bg-2);border-bottom:1px solid var(--aion-bg-3);flex-shrink:0;align-items:center;gap:6px;height:32px;padding:0 10px;display:flex}.YElu8a_urlInput{background:var(--aion-bg-base);min-width:0;height:24px;color:var(--aion-text-primary);font-size:12px;font-family:var(--aion-font-sans);border:none;border-radius:4px;outline:none;flex:1;padding:0 8px}.YElu8a_urlInput:focus-visible{box-shadow:inset 0 0 0 2px var(--aion-primary)}.YElu8a_urlFrame{background:var(--aion-bg-base);border:none;flex:1;width:100%;min-height:0}.YElu8a_placeholder{min-height:0;color:var(--aion-text-secondary);text-align:center;flex-direction:column;flex:1;justify-content:center;align-items:center;gap:8px;padding:24px;font-size:13px;display:flex}.YElu8a_placeholderTitle{color:var(--aion-text-primary);font-size:14px;font-weight:500}.YElu8a_placeholderMeta{color:var(--aion-text-tertiary);font-size:12px}.YElu8a_placeholderError{color:var(--aion-danger);font-size:12px}.YElu8a_splitPane{flex:1;min-height:0;display:flex;position:relative;overflow:hidden}.YElu8a_splitPaneLeft,.YElu8a_splitPaneRight{flex-direction:column;min-width:0;height:100%;display:flex}.YElu8a_splitHeader{background:var(--aion-bg-2);height:40px;color:var(--aion-text-secondary);border-bottom:1px solid var(--aion-bg-3);flex-shrink:0;align-items:center;padding:0 12px;font-size:12px;display:flex}.YElu8a_splitBody{flex:1;min-height:0;overflow:hidden}.YElu8a_splitHandle{z-index:20;cursor:col-resize;touch-action:none;width:12px;position:absolute;top:0;bottom:0}.YElu8a_splitHandle:after{content:\"\";background:var(--aion-bg-3);opacity:.9;pointer-events:none;border-radius:9999px;width:2px;transition:width .15s cubic-bezier(.4,0,.2,1),background-color .15s cubic-bezier(.4,0,.2,1);position:absolute;top:0;bottom:0;left:50%;transform:translate(-50%)}.YElu8a_splitHandle:hover:after,.YElu8a_splitHandle:active:after{background:var(--aion-brand);width:6px}.YElu8a_textEditor{resize:none;background:var(--aion-bg-base);width:100%;height:100%;color:var(--aion-text-primary);font-family:var(--aion-font-mono);tab-size:2;border:none;outline:none;padding:12px 14px;font-size:13px;line-height:1.6}.YElu8a_textEditor:focus-visible{box-shadow:inset 0 0 0 2px var(--aion-primary)}.YElu8a_saveBanner{z-index:5;background:var(--aion-bg-2);border:1px solid var(--aion-bg-3);color:var(--aion-text-secondary);text-overflow:ellipsis;white-space:nowrap;border-radius:4px;max-width:60%;padding:4px 10px;font-size:12px;position:absolute;top:8px;right:12px;overflow:hidden}.YElu8a_saveBannerError{color:var(--aion-danger);border-color:var(--aion-danger)}.YElu8a_truncatedNote{color:var(--aion-warning);background:color-mix(in srgb, var(--aion-warning) 10%, transparent);flex-shrink:0;padding:6px 20px;font-size:12px}";
		const tagId = "@linxin666/dsh-client-ui-aionui-panel/preview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-aionui-panel";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var preview_module_css_default = {
			"aionui-pulse": "YElu8a_aionui-pulse",
			"codeViewer": "YElu8a_codeViewer",
			"content": "YElu8a_content",
			"csvTable": "YElu8a_csvTable",
			"csvViewer": "YElu8a_csvViewer",
			"diffLine": "YElu8a_diffLine",
			"diffLineAdd": "YElu8a_diffLineAdd",
			"diffLineDel": "YElu8a_diffLineDel",
			"diffLineHunk": "YElu8a_diffLineHunk",
			"diffLineMeta": "YElu8a_diffLineMeta",
			"diffViewer": "YElu8a_diffViewer",
			"imageMeta": "YElu8a_imageMeta",
			"imageViewer": "YElu8a_imageViewer",
			"mdViewer": "YElu8a_mdViewer",
			"mermaidBlock": "YElu8a_mermaidBlock",
			"noTabs": "YElu8a_noTabs",
			"panel": "YElu8a_panel",
			"panelCollapse": "YElu8a_panelCollapse",
			"panelMaximize": "YElu8a_panelMaximize",
			"pdfViewer": "YElu8a_pdfViewer",
			"placeholder": "YElu8a_placeholder",
			"placeholderError": "YElu8a_placeholderError",
			"placeholderMeta": "YElu8a_placeholderMeta",
			"placeholderTitle": "YElu8a_placeholderTitle",
			"saveBanner": "YElu8a_saveBanner",
			"saveBannerError": "YElu8a_saveBannerError",
			"splitBody": "YElu8a_splitBody",
			"splitHandle": "YElu8a_splitHandle",
			"splitHeader": "YElu8a_splitHeader",
			"splitPane": "YElu8a_splitPane",
			"splitPaneLeft": "YElu8a_splitPaneLeft",
			"splitPaneRight": "YElu8a_splitPaneRight",
			"tab": "YElu8a_tab",
			"tabActive": "YElu8a_tabActive",
			"tabBar": "YElu8a_tabBar",
			"tabBarRight": "YElu8a_tabBarRight",
			"tabClose": "YElu8a_tabClose",
			"tabDot": "YElu8a_tabDot",
			"tabDotAgent": "YElu8a_tabDotAgent",
			"tabDotDirty": "YElu8a_tabDotDirty",
			"tabFade": "YElu8a_tabFade",
			"tabFadeLeft": "YElu8a_tabFadeLeft",
			"tabFadeRight": "YElu8a_tabFadeRight",
			"tabFavicon": "YElu8a_tabFavicon",
			"tabInactive": "YElu8a_tabInactive",
			"tabPlus": "YElu8a_tabPlus",
			"tabScroll": "YElu8a_tabScroll",
			"tabTitle": "YElu8a_tabTitle",
			"textEditor": "YElu8a_textEditor",
			"toolbar": "YElu8a_toolbar",
			"toolbarBtn": "YElu8a_toolbarBtn",
			"toolbarBtnActive": "YElu8a_toolbarBtnActive",
			"toolbarBtnWarn": "YElu8a_toolbarBtnWarn",
			"toolbarSpacer": "YElu8a_toolbarSpacer",
			"truncatedNote": "YElu8a_truncatedNote",
			"urlBar": "YElu8a_urlBar",
			"urlFrame": "YElu8a_urlFrame",
			"urlInput": "YElu8a_urlInput"
		};
		//#endregion
		//#region src/client/chat/mermaid-chat.tsx
		/**
		* Chat-transcript mermaid enhancement: the shell conversation renderer
		* emits fenced code as `div.md-code-block` with the language in a banner
		* infostring element (no language class on pre/code), and the shell has no
		* slot for message-body post-processing — so this component rides the
		* conversation input dock as a zero-render sentinel and observes the
		* document for mermaid blocks the transcript mounts. Blocks inside the
		* preview panel's own subtree are excluded (each surface owns its blocks).
		*
		* Streaming awareness: an assistant message re-renders continuously, so a
		* diagram fence is often incomplete mid-stream. Renders that fail restore
		* the block and the next mutation retries it — once the fence closes the
		* diagram lands. Mutations are debounced to one rAF so long transcripts do
		* not re-scan the whole document: each batch is mapped to the minimal
		* mutated subtrees and scoped per-frame while the first scheduled pass scans
		* the body once. The observer is disconnected on unmount.
		* @module dsh-aionui-panel/client/chat/mermaid-chat
		*/
		/**
		* Map a mutation batch to the minimal scan scopes that may contain new
		* mermaid fences. Each record contributes its target and its added nodes
		* (an added element directly; otherwise that node's parentElement), promoted
		* to the owning `.md-code-block` when present and deduped by identity.
		* Disconnected nodes and removed-only records yield nothing — removal never
		* introduces a fence. Pure (DOM-read only) so tests can drive it in jsdom.
		*/
		function enhanceScopesFor(records) {
			const scopes = /* @__PURE__ */ new Set();
			for (const record of records) {
				if (record.addedNodes.length === 0) continue;
				if (record.target instanceof Element && record.target.isConnected) scopes.add(record.target.closest(".md-code-block") ?? record.target);
				for (const node of record.addedNodes) {
					const element = node instanceof Element ? node : node.parentElement;
					if (element !== null && element.isConnected) scopes.add(element.closest(".md-code-block") ?? element);
				}
			}
			return Array.from(scopes);
		}
		/**
		* Chat-side ownership guard: blocks inside the preview panel's own subtrees
		* (the markdown viewer scope marker, or the preview column hosting the code
		* viewers) belong to the panel drivers, never to the transcript enhancer.
		*/
		function isPanelOwnedPre(pre) {
			return pre.closest(`[${DATA_MD_SCOPE}], [data-aionui-preview-col]`) !== null;
		}
		/**
		* Claim the buffered observer batch for one run. The buffer is drained
		* unconditionally: while the panel is absent, streaming mutations would
		* otherwise keep appending to pendingRecords without bound and pin DOM
		* nodes. The claimed batch is returned for scanning while the panel is
		* mounted, and discarded while it is absent — the next panel mount re-runs
		* the first full-document pass. Pure, so tests can drive it with plain
		* arrays.
		*/
		function drainObserverBatch(pendingRecords, panelMounted) {
			const batch = pendingRecords.splice(0);
			return panelMounted ? batch : [];
		}
		/** Hidden sentinel: renders nothing, owns the transcript observer. */
		function MermaidChatEnhancer() {
			(0, react.useEffect)(() => {
				let scheduled = false;
				let pendingFrame = 0;
				let firstPass = true;
				let pendingRecords = [];
				const run = () => {
					scheduled = false;
					const panelMounted = document.querySelector("[data-aionui-preview-col]") !== null;
					const records = drainObserverBatch(pendingRecords, panelMounted);
					if (!panelMounted) return;
					const scopes = enhanceScopesFor(records);
					if (firstPass) {
						firstPass = false;
						enhanceMermaidBlocks(document.body, {
							className: preview_module_css_default.mermaidBlock,
							theme: mermaidTheme(shellIsDark()),
							skip: isPanelOwnedPre
						});
						return;
					}
					for (const scope of scopes) enhanceMermaidBlocks(scope, {
						className: preview_module_css_default.mermaidBlock,
						theme: mermaidTheme(shellIsDark()),
						skip: isPanelOwnedPre
					});
				};
				const schedule = () => {
					if (scheduled) return;
					scheduled = true;
					pendingFrame = requestAnimationFrame(run);
				};
				const observer = new MutationObserver((records) => {
					pendingRecords = pendingRecords.concat(records);
					schedule();
				});
				observer.observe(document.body, {
					childList: true,
					subtree: true
				});
				schedule();
				const disposeTheme = watchShellTheme((isDark) => {
					rethemeMermaidBlocks(document.body, { theme: mermaidTheme(isDark) });
				});
				return () => {
					observer.disconnect();
					disposeTheme();
					cancelAnimationFrame(pendingFrame);
				};
			}, []);
			return null;
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services: sessions for the project root, locale for the copy, and the settings scope for the provider choice. */
		const inject = [
			"sessions",
			"locale",
			"settingsScope"
		];
		/** Apply the browser half. */
		function apply(ctx) {
			ctx.effect(() => {
				try {
					return ctx.locale.register(NS, dictionaries);
				} catch {
					return () => {};
				}
			}, "dsh-aionui-panel: dictionaries");
			ctx.inject([
				"slots",
				"conversation",
				"sessions"
			], (scope) => {
				const sessions = scope.sessions;
				const conversation = scope.conversation;
				scope.slots.inject("conversation.input.dock", () => {
					try {
						return scope.slots.register({
							name: "conversation.input.dock",
							id: "aionui-drag-file",
							order: 90,
							locale: NS,
							inject: (sessionId) => ({ insertPath: (path) => {
								if (sessionId === void 0) return false;
								const actx = sessions.scope(sessionId);
								if (actx === void 0) return false;
								const input = conversation.input;
								if (input === void 0) return false;
								const shell = input.for(actx);
								const draft = shell.state.getSnapshot().draft;
								shell.setDraft(insertPathIntoDraft(draft, path));
								return true;
							} })
						}, DragFileInlay);
					} catch {
						return () => {};
					}
				});
			});
			ctx.inject(["slots"], (scope) => {
				scope.slots.inject("conversation.input.dock", () => {
					try {
						return scope.slots.register({
							name: "conversation.input.dock",
							id: "aionui-mermaid-chat",
							order: 91
						}, MermaidChatEnhancer);
					} catch {
						return () => {};
					}
				});
			});
			ctx.inject(["slots", "settingsScope"], (settingsCtx) => {
				const settingsCard = new AionUiSettingsCardController((settingsCtx.get("webUiSettings") ?? settingsCtx.settingsScope).bind({ namespace: NS }));
				settingsCtx.slots.inject("web-ui.plugin.item", () => {
					try {
						const unregister = settingsCtx.slots.register({
							name: "web-ui.plugin.item",
							id: "aionui-panel",
							order: 110,
							locale: NS,
							inject: () => ({
								...settingsCard.inject(),
								sidebar: settingsCtx.get("betterSidebar")
							})
						}, AionUiSettingsCard);
						return () => {
							settingsCard.dispose();
							unregister();
						};
					} catch {
						return () => {};
					}
				});
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map