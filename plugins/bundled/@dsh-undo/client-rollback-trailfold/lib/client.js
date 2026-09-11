window.__ModuleLoader__.load({
	id: "@dsh-undo/client-rollback-trailfold",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region lib/types/client/trailfold.js
		/**
		* Per-turn "reasoning and actions" fold for the dsh web conversation trail.
		*
		* dsh's chat flow publishes one stable contract per node: the flow container
		* `[data-chat-flow]` whose children carry `data-chat-flow-kind` (user / steering /
		* context / assistant-step / tool-call / turn-tail) and a stable
		* `data-chat-flow-key`. A turn therefore reads, in order: the user item, its
		* trail (context injections, Think steps, narration steps, tool calls), the
		* final visible item (a delivered assistant conclusion, or a terminal tool
		* result), and the turn tail itself (deliverables + stats).
		*
		* This patch gives every turn with a foldable trail one collapse bar, so the
		* affordance shows in ALL cases where there is anything to fold — including
		* think-only and text-only-with-reasoning turns, which is what the fork's
		* main-tree trail fold did and what plain per-tool rows cannot express.
		*
		* React safety rules (the navIconPatch lessons):
		*   - never remove or reorder React-owned nodes: hiding happens by setting
		*     `style.display` on flow items (they carry no React-managed style prop),
		*     and the collapse bar is a foreign node React never reconciles;
		*   - everything is idempotent and re-derived: a MutationObserver rescans on
		*     every mutation batch, so React re-renders, virtualization remounts, and
		*     locale/edits heal automatically (a dropped bar is simply re-inserted).
		*
		* Fold semantics (main-tree parity):
		*   - the terminal item (last assistant step or tool result before the tail)
		*     and the tail itself stay visible — only the earlier trail folds;
		*   - a running turn (no tail yet) renders the bar expanded with a running
		*     hint and never auto-collapses mid-stream;
		*   - a turn that closes while observed auto-collapses — but only when the
		*     conversation is pinned near the bottom (following), so a reader scrolled
		*     up into the trail is never cut off;
		*   - history that loads already-collapsed stays expanded on first sight;
		*   - manual clicks always win until the turn's next auto event (its close);
		*   - a terminal tool result stays outside the fold, so an error remains
		*     visible while the preceding Think/narration can still be collapsed.
		*/
		/** Marker on the foreign collapse-bar root, carrying the turn's flow key. */
		const BAR_MARK = "dshTrailfold";
		/** Flow-item kinds that belong to a turn's trail (never user, tail, or unknown kinds). */
		const TRAIL_KINDS = /* @__PURE__ */ new Set([
			"context",
			"assistant-step",
			"tool-call"
		]);
		/**
		* Group flow items into user-anchored turns and derive each turn's fold plan.
		* Unknown kinds are passed through untouched (never boundary, never trail).
		* @param items - Flow children in document order.
		* @returns One plan per user item, in order.
		*/
		function planTurns(items) {
			const raws = [];
			let current = null;
			for (const item of items) {
				if (item.kind === "user" || item.kind === "steering") {
					if (current !== null) current.closed = true;
					current = {
						key: item.key,
						userEl: item.el,
						trailAll: [],
						closed: false
					};
					raws.push(current);
					continue;
				}
				if (item.kind === "turn-tail") {
					if (current !== null) {
						current.closed = true;
						current = null;
					}
					continue;
				}
				if (current !== null && TRAIL_KINDS.has(item.kind)) current.trailAll.push(item);
			}
			const plans = [];
			for (const raw of raws) {
				const running = !raw.closed;
				const last = raw.trailAll[raw.trailAll.length - 1];
				const conclusion = raw.closed && last !== void 0 && (last.kind === "assistant-step" || last.kind === "tool-call") ? last.el : null;
				const trail = conclusion !== null ? raw.trailAll.slice(0, -1) : raw.trailAll;
				plans.push({
					key: raw.key,
					userEl: raw.userEl,
					trail: trail.map((i) => i.el),
					conclusion,
					closed: raw.closed,
					running,
					thinkCount: trail.filter((i) => i.kind === "assistant-step").length,
					toolCount: trail.filter((i) => i.kind === "tool-call").length
				});
			}
			return plans;
		}
		/** A fold gets a bar iff there is a trail to hide: running with items, or closed with a visible terminal item. */
		function foldable(plan) {
			if (plan.trail.length === 0) return false;
			return plan.running || plan.conclusion !== null;
		}
		const CHEVRON = "<svg viewBox=\"0 0 14 14\" width=\"12\" height=\"12\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3.5 5.25L7 8.75l3.5-3.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>";
		/**
		* Wire the fold into one live document.
		* @param doc - Document hosting the conversation (tests may pass a jsdom one).
		* @param classes - CSS-module class map for the bar chrome.
		* @param labels - Copy: bar title, running hint, and the count line builder.
		* @returns Disposer stopping the observer and dropping every foreign bar.
		*/
		function mountTrailFold(doc, classes, labels) {
			const states = /* @__PURE__ */ new Map();
			const bars = /* @__PURE__ */ new Map();
			const plans = /* @__PURE__ */ new Map();
			/** Conversation pinned near the bottom (following the stream)? Absent scroller counts as pinned. */
			const pinnedToBottom = () => {
				const scroller = doc.querySelector("[data-conversation-scroll]");
				if (scroller === null) return true;
				return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
			};
			const applyVisibility = (plan, collapsed) => {
				for (const el of plan.trail) el.style.display = collapsed ? "none" : "";
			};
			const buildBar = (plan) => {
				const bar = doc.createElement("div");
				bar.className = classes.bar ?? "";
				bar.dataset[BAR_MARK] = plan.key;
				bar.setAttribute("role", "button");
				bar.setAttribute("tabindex", "0");
				bar.innerHTML = `<span class="${classes.chevron ?? ""}" data-part="chevron">${CHEVRON}</span><span class="${classes.label ?? ""}" data-part="label">${labels.title}</span><span class="${classes.counts ?? ""}" data-part="counts"></span>`;
				const toggle = () => {
					const state = states.get(plan.key);
					const latest = plans.get(plan.key);
					if (state === void 0 || latest === void 0) return;
					state.collapsed = !state.collapsed;
					sync(latest, state);
				};
				bar.addEventListener("click", toggle);
				bar.addEventListener("keydown", (event) => {
					if (event.key !== "Enter" && event.key !== " ") return;
					event.preventDefault();
					toggle();
				});
				return bar;
			};
			/** Push state into one turn's bar + trail visibility. */
			const sync = (plan, state) => {
				const bar = bars.get(plan.key);
				if (bar !== void 0) {
					bar.setAttribute("aria-expanded", state.collapsed ? "false" : "true");
					const counts = bar.querySelector("[data-part=\"counts\"]");
					const nextCounts = plan.running ? labels.running : labels.counts(plan.thinkCount, plan.toolCount);
					if (counts !== null && counts.textContent !== nextCounts) counts.textContent = nextCounts;
					const chevron = bar.querySelector("[data-part=\"chevron\"]");
					const nextTransform = state.collapsed ? "rotate(-90deg)" : "";
					if (chevron !== null && chevron.style.transform !== nextTransform) chevron.style.transform = nextTransform;
				}
				applyVisibility(plan, state.collapsed);
			};
			const scan = () => {
				const flows = [...doc.querySelectorAll("[data-chat-flow]")];
				const seen = /* @__PURE__ */ new Set();
				for (const flow of flows) {
					const items = [];
					for (const el of [...flow.children]) {
						if (!(el instanceof HTMLElement)) continue;
						const kind = el.getAttribute("data-chat-flow-kind");
						if (kind === null) continue;
						items.push({
							el,
							kind,
							key: el.getAttribute("data-chat-flow-key") ?? ""
						});
					}
					for (const plan of planTurns(items)) {
						seen.add(plan.key);
						plans.set(plan.key, plan);
						if (!foldable(plan)) {
							const bar = bars.get(plan.key);
							if (bar !== void 0 && bar.isConnected) bar.remove();
							bars.delete(plan.key);
							states.delete(plan.key);
							plans.delete(plan.key);
							applyVisibility(plan, false);
							continue;
						}
						let state = states.get(plan.key);
						if (state === void 0) {
							state = {
								collapsed: false,
								wasRunning: plan.running
							};
							states.set(plan.key, state);
						} else if (state.wasRunning && plan.closed) {
							state.wasRunning = false;
							state.collapsed = pinnedToBottom();
						}
						let bar = bars.get(plan.key);
						if (bar === void 0 || !bar.isConnected) {
							if (bar !== void 0 && bar.isConnected === false) bars.delete(plan.key);
							bar = buildBar(plan);
							bars.set(plan.key, bar);
						}
						const anchor = plan.trail[0];
						if (anchor !== void 0 && anchor.previousSibling !== bar && anchor.parentElement === flow) flow.insertBefore(bar, anchor);
						sync(plan, state);
					}
				}
				for (const [key, bar] of [...bars]) {
					if (seen.has(key)) continue;
					bar.remove();
					bars.delete(key);
					states.delete(key);
					plans.delete(key);
				}
			};
			scan();
			const observer = new MutationObserver(scan);
			observer.observe(doc.body, {
				childList: true,
				subtree: true
			});
			return () => {
				observer.disconnect();
				for (const bar of bars.values()) bar.remove();
				bars.clear();
				states.clear();
				plans.clear();
			};
		}
		//#endregion
		//#region \0dsh-css:C:\Users\34293\Desktop\dsh-undo\packages\client-rollback-trailfold\src\client\trailfold.module.css.mjs
		const css = "._0P7aSa_bar{width:fit-content;height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;border-radius:6px;align-items:center;gap:6px;margin:2px 0 2px 4px;padding:0 6px;font-size:13px;line-height:18px;transition:background-color .12s,color .12s;display:inline-flex}._0P7aSa_bar:hover,._0P7aSa_bar:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);outline:none}._0P7aSa_chevron{color:var(--dsw-alias-label-tertiary);align-items:center;transition:transform .12s;display:inline-flex}._0P7aSa_chevron svg{display:block}._0P7aSa_label{white-space:nowrap}._0P7aSa_counts{white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px}";
		const tagId = "@dsh-undo/client-rollback-trailfold/trailfold.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-undo/client-rollback-trailfold";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var trailfold_module_css_default = {
			"bar": "_0P7aSa_bar",
			"label": "_0P7aSa_label",
			"counts": "_0P7aSa_counts",
			"chevron": "_0P7aSa_chevron"
		};
		//#endregion
		//#region lib/types/client/index.js
		/**
		* Browser half of the trailfold plugin: mount the per-turn fold into the live
		* document. No services are required — the fold reads the chat flow's stable
		* data attributes and never touches React-owned state.
		*/
		/** No services required: the fold is a self-contained DOM patch. */
		const inject = [];
		/**
		* Mount the conversation trail fold.
		* @returns Disposer removing the observer and every foreign bar.
		*/
		async function apply() {
			if (typeof document === "undefined") return () => {};
			return mountTrailFold(document, trailfold_module_css_default, {
				title: "推理与行动",
				running: "运行中…",
				counts: (think, tools) => {
					const parts = [];
					if (think > 0) parts.push(`${think} 思考`);
					if (tools > 0) parts.push(`${tools} 工具`);
					return parts.join(" · ");
				}
			});
		}
		//#endregion
		exports.apply = apply;
		exports.foldable = foldable;
		exports.inject = inject;
		exports.mountTrailFold = mountTrailFold;
		exports.planTurns = planTurns;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map