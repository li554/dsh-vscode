window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-diff-review",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/types.ts
		async function fetchTurn(sessionId, turn) {
			const url = `/api/dsh-diff-review/turn?session=${encodeURIComponent(sessionId)}&turn=${encodeURIComponent(String(turn))}`;
			const response = await fetch(url);
			if (!response.ok) return [];
			const body = await response.json();
			return body.ok ? body.files ?? [] : [];
		}
		async function fetchSession(sessionId) {
			const url = `/api/dsh-diff-review/session?session=${encodeURIComponent(sessionId)}`;
			const response = await fetch(url);
			if (!response.ok) return [];
			const body = await response.json();
			return body.ok ? body.turns ?? [] : [];
		}
		function shortPath(path) {
			const parts = path.split(/[\\/]/);
			return parts[parts.length - 1] ?? path;
		}
		//#endregion
		//#region src/client/ReviewSidebarTab.tsx
		/**
		* ReviewSidebarTab — the dsh-better-sidebar "审阅" tab.
		*
		* Lists every turn that touched files in the current session. Clicking a file
		* expands the diff computed by the host (self-contained, git-free — works for
		* files outside the session repository and for untracked files too).
		*/
		function stripPatchHeader(diff) {
			return diff.replace(/^={3,}\n/, "");
		}
		/** Codex-style colored unified-diff viewer: green added lines, red removed lines. */
		function DiffView({ diff }) {
			const lines = stripPatchHeader(diff).split("\n");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: diffBoxStyle,
				children: lines.map((line, index) => {
					let lineStyle = diffLineStyle;
					if (line.startsWith("+") && !line.startsWith("+++")) lineStyle = diffAddLineStyle;
					else if (line.startsWith("-") && !line.startsWith("---")) lineStyle = diffDelLineStyle;
					else if (line.startsWith("@@")) lineStyle = diffHunkLineStyle;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: lineStyle,
						children: line === "" ? "\xA0" : line
					}, index);
				})
			});
		}
		/** Pending file key (`turn:path`) to auto-expand once the review tab is mounted/visible. */
		let pendingReviewFile = null;
		/** Unique expansion key for one file row across turns (same path may appear in several turns). */
		function fileKeyOf(turn, path) {
			return `${turn}:${path}`;
		}
		/**
		* Ask the review tab (wherever mounted) to expand a specific file's diff.
		* Called by the conversation card before opening the sidebar review tab.
		* The key is `turn:path` so same-named files in different turns stay distinct.
		*/
		function requestReviewFile(key) {
			pendingReviewFile = key;
			if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dsh-diff-review:open-file", { detail: key }));
		}
		function ReviewSidebarTab({ scope, visible }) {
			const sessionId = scope.sessionId;
			const [turns, setTurns] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(true);
			const [openFile, setOpenFile] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!visible) return void 0;
				let alive = true;
				const load = async () => {
					const next = await fetchSession(sessionId);
					if (alive) {
						setTurns([...next].sort((a, b) => a.turn - b.turn));
						setLoading(false);
					}
				};
				load();
				const timer = setInterval(() => void load(), 3e3);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, [visible, sessionId]);
			(0, react.useEffect)(() => {
				const onOpen = (event) => {
					const key = event.detail;
					if (typeof key === "string" && key !== "") setOpenFile(key);
				};
				window.addEventListener("dsh-diff-review:open-file", onOpen);
				return () => window.removeEventListener("dsh-diff-review:open-file", onOpen);
			}, []);
			(0, react.useEffect)(() => {
				if (visible && pendingReviewFile !== null) {
					setOpenFile(pendingReviewFile);
					pendingReviewFile = null;
				}
			}, [visible]);
			const toggle = (key) => {
				setOpenFile((current) => current === key ? null : key);
			};
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: emptyStyle,
				children: "正在读取文件改动…"
			});
			if (turns.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: emptyStyle,
				children: "本轮会话还没有文件改动记录。"
			});
			const totalFiles = turns.reduce((sum, turn) => sum + turn.files.length, 0);
			const totalPlus = turns.reduce((sum, turn) => sum + turn.files.reduce((s, f) => s + f.plus, 0), 0);
			const totalMinus = turns.reduce((sum, turn) => sum + turn.files.reduce((s, f) => s + f.minus, 0), 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rootStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: headStyle$1,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: titleStyle$1,
						children: "文件改动审阅"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: summaryStyle,
						children: [
							totalFiles,
							" 文件 · +",
							totalPlus,
							" −",
							totalMinus
						]
					})]
				}), turns.map((turn) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: turnStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						style: turnHeaderStyle,
						children: [
							"第 ",
							turn.turn,
							" 轮 · ",
							turn.files.length,
							" 个文件"
						]
					}), turn.files.map((file) => {
						const openKey = fileKeyOf(turn.turn, file.path);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: fileBlockStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								style: fileRowStyle$1,
								title: file.path,
								onClick: () => toggle(openKey),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: filePathStyle,
									children: file.path
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: fileStatStyle$1,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											style: plusStyle$1,
											children: ["+", file.plus]
										}),
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											style: minusStyle$1,
											children: ["−", file.minus]
										})
									]
								})]
							}), openFile === openKey && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffView, { diff: file.diff })]
						}, openKey);
					})]
				}, turn.turn))]
			});
		}
		const rootStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			padding: 12,
			overflowY: "auto",
			height: "100%",
			boxSizing: "border-box",
			fontFamily: "ui-monospace, \"Cascadia Mono\", \"SFMono-Regular\", Consolas, monospace",
			fontSize: 12,
			lineHeight: 1.5
		};
		const headStyle$1 = {
			display: "flex",
			alignItems: "baseline",
			gap: 10
		};
		const titleStyle$1 = {
			color: "var(--dsw-alias-label-primary, #f2f6fc)",
			fontSize: 14,
			fontWeight: 520
		};
		const summaryStyle = {
			color: "var(--dsw-alias-label-tertiary, #718096)",
			fontVariantNumeric: "tabular-nums"
		};
		const turnStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 6
		};
		const turnHeaderStyle = {
			color: "var(--dsw-alias-label-secondary, #9daabd)",
			fontSize: 12,
			fontWeight: 480
		};
		const fileBlockStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 0
		};
		const fileRowStyle$1 = {
			display: "flex",
			alignItems: "center",
			gap: 10,
			width: "100%",
			padding: "7px 9px",
			borderRadius: 8,
			border: "1px solid var(--dsw-alias-border-l2, rgba(196, 211, 232, 0.16))",
			background: "var(--dsw-alias-bg-layer-1, #171f2b)",
			color: "var(--dsw-alias-label-primary, #f2f6fc)",
			cursor: "pointer",
			fontFamily: "inherit",
			fontSize: 12,
			textAlign: "left"
		};
		const filePathStyle = {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			minWidth: 0
		};
		const fileStatStyle$1 = {
			marginLeft: "auto",
			flex: "none",
			display: "inline-flex",
			gap: 6,
			fontVariantNumeric: "tabular-nums"
		};
		const plusStyle$1 = { color: "var(--dsw-alias-state-success-primary, #78dda0)" };
		const minusStyle$1 = { color: "var(--dsw-alias-state-error-primary, #ff8592)" };
		const diffBoxStyle = {
			margin: "4px 0 0",
			borderRadius: 8,
			border: "1px solid var(--dsw-alias-border-l2, rgba(196, 211, 232, 0.16))",
			background: "var(--dsw-alias-bg-layer-2, #101722)",
			overflowX: "auto",
			padding: "6px 0"
		};
		const diffLineStyle = {
			padding: "0 10px",
			fontSize: 11,
			lineHeight: 1.6,
			whiteSpace: "pre",
			color: "var(--dsw-alias-label-secondary, #9daabd)",
			fontFamily: "inherit"
		};
		const diffAddLineStyle = {
			...diffLineStyle,
			background: "rgba(70, 200, 120, 0.16)",
			color: "var(--dsw-alias-state-success-primary, #78dda0)"
		};
		const diffDelLineStyle = {
			...diffLineStyle,
			background: "rgba(255, 100, 110, 0.16)",
			color: "var(--dsw-alias-state-error-primary, #ff8592)"
		};
		const diffHunkLineStyle = {
			...diffLineStyle,
			background: "rgba(142, 197, 255, 0.10)",
			color: "var(--dsw-alias-brand-primary, #8ec5ff)"
		};
		const emptyStyle = {
			padding: "24px 12px",
			color: "var(--dsw-alias-label-tertiary, #718096)",
			textAlign: "center"
		};
		//#endregion
		//#region src/client/TurnDiffCard.tsx
		/**
		* TurnDiffCard — Codex-style per-turn file-change card.
		*
		* Presentational component: receives a numeric turn and renders the card by
		* fetching that turn's change summary from the host API.
		*/
		const MAX_VISIBLE = 3;
		function FileIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "15",
				height: "15",
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M6 3h9l4 4v14H6V3Z",
					stroke: "currentColor",
					strokeWidth: "1.7",
					strokeLinejoin: "round"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M14 3v5h5M9 13h6M9 17h6",
					stroke: "currentColor",
					strokeWidth: "1.7",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})]
			});
		}
		function CopyIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "13",
				height: "13",
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "9",
					y: "9",
					width: "11",
					height: "11",
					rx: "2",
					stroke: "currentColor",
					strokeWidth: "1.7"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
					stroke: "currentColor",
					strokeWidth: "1.7",
					strokeLinecap: "round"
				})]
			});
		}
		function TurnDiffCard({ sessionId, turn, openReview }) {
			const [files, setFiles] = (0, react.useState)(null);
			const [expanded, setExpanded] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let alive = true;
				const load = async () => {
					const next = await fetchTurn(sessionId, turn);
					if (alive) setFiles(next);
				};
				load();
				const timer = setInterval(() => void load(), 1500);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, [sessionId, turn]);
			if (files === null || files.length === 0) return null;
			const plus = files.reduce((sum, file) => sum + file.plus, 0);
			const minus = files.reduce((sum, file) => sum + file.minus, 0);
			const visibleFiles = expanded ? files : files.slice(0, MAX_VISIBLE);
			const hiddenCount = files.length - visibleFiles.length;
			const copySummary = async () => {
				const text = files.map((file) => `${file.path} +${file.plus} -${file.minus}`).join("\n");
				try {
					await navigator.clipboard?.writeText(text);
				} catch {}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: cardStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: headStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: headIconStyle,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileIcon, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: titleStyle,
								children: [
									"已编辑 ",
									files.length,
									" 个文件"
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: totalStyle,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: plusStyle,
										children: ["+", plus]
									}),
									" ",
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: minusStyle,
										children: ["−", minus]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: headActionsStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: ghostButtonStyle,
									title: "复制文件改动摘要",
									onClick: () => void copySummary(),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CopyIcon, {})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: primaryButtonStyle,
									onClick: () => openReview(),
									children: "审核"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: listStyle,
						children: visibleFiles.map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							style: fileRowStyle,
							title: `在审阅视图中查看 ${file.path}`,
							onClick: () => openReview(`${turn}:${file.path}`),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: fileNameStyle,
								children: shortPath(file.path)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: fileStatStyle,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: plusStyle,
										children: ["+", file.plus]
									}),
									" ",
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: minusStyle,
										children: ["−", file.minus]
									})
								]
							})]
						}, file.path))
					}),
					hiddenCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						style: moreButtonStyle,
						onClick: () => setExpanded(true),
						children: [
							"再显示 ",
							hiddenCount,
							" 个文件"
						]
					})
				]
			});
		}
		const cardStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 8,
			width: "100%",
			maxWidth: "var(--dsh-composer-card-max-width, 780px)",
			margin: "10px auto 0",
			padding: "10px 12px 12px",
			borderRadius: 12,
			border: "1px solid var(--dsw-alias-border-l2, rgba(196, 211, 232, 0.16))",
			background: "var(--dsw-alias-bg-layer-1, #171f2b)",
			color: "var(--dsw-alias-label-primary, #f2f6fc)",
			fontFamily: "ui-monospace, \"Cascadia Mono\", \"SFMono-Regular\", Consolas, monospace",
			fontSize: 12,
			lineHeight: 1.5,
			boxSizing: "border-box"
		};
		const headStyle = {
			display: "flex",
			alignItems: "center",
			gap: 8
		};
		const headIconStyle = {
			display: "inline-flex",
			alignItems: "center",
			color: "var(--dsw-alias-brand-primary, #8ec5ff)"
		};
		const titleStyle = {
			color: "var(--dsw-alias-label-primary, #f2f6fc)",
			fontSize: 13,
			fontWeight: 520
		};
		const totalStyle = {
			display: "inline-flex",
			gap: 6,
			fontVariantNumeric: "tabular-nums",
			fontWeight: 480
		};
		const plusStyle = { color: "var(--dsw-alias-state-success-primary, #78dda0)" };
		const minusStyle = { color: "var(--dsw-alias-state-error-primary, #ff8592)" };
		const headActionsStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			marginLeft: "auto"
		};
		const ghostButtonStyle = {
			display: "inline-grid",
			placeItems: "center",
			width: 26,
			height: 26,
			padding: 0,
			borderRadius: 7,
			border: "1px solid var(--dsw-alias-border-l2, rgba(196, 211, 232, 0.16))",
			background: "transparent",
			color: "var(--dsw-alias-label-secondary, #9daabd)",
			cursor: "pointer"
		};
		const primaryButtonStyle = {
			height: 26,
			padding: "0 12px",
			borderRadius: 7,
			border: "1px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #8ec5ff) 55%, transparent)",
			background: "color-mix(in srgb, var(--dsw-alias-brand-primary, #8ec5ff) 12%, transparent)",
			color: "var(--dsw-alias-brand-primary, #8ec5ff)",
			cursor: "pointer",
			fontFamily: "inherit",
			fontSize: 12,
			fontWeight: 520
		};
		const listStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 4
		};
		const fileRowStyle = {
			display: "flex",
			alignItems: "center",
			gap: 10,
			width: "100%",
			padding: "6px 9px",
			borderRadius: 8,
			border: "1px solid var(--dsw-alias-border-l2, rgba(196, 211, 232, 0.16))",
			background: "var(--dsw-alias-bg-layer-2, #101722)",
			color: "var(--dsw-alias-label-primary, #f2f6fc)",
			cursor: "pointer",
			fontFamily: "inherit",
			fontSize: 12,
			textAlign: "left"
		};
		const fileNameStyle = {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			minWidth: 0
		};
		const fileStatStyle = {
			marginLeft: "auto",
			flex: "none",
			display: "inline-flex",
			gap: 6,
			fontVariantNumeric: "tabular-nums"
		};
		const moreButtonStyle = {
			alignSelf: "flex-start",
			padding: "2px 6px",
			borderRadius: 6,
			border: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary, #718096)",
			cursor: "pointer",
			fontFamily: "inherit",
			fontSize: 12
		};
		//#endregion
		//#region src/client/DiffReviewTailNode.tsx
		function DiffReviewTailNode({ node, sessionId, openReview }) {
			const turn = node?.data?.turn;
			if (typeof turn !== "number") return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TurnDiffCard, {
				sessionId,
				turn,
				openReview
			});
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* @dsh-external/dsh-diff-review — browser half.
		*
		* - Own conversation node kind `diff-review-tail`: built at every `turn/end`,
		*   rendered through the keyed `conversation.chat.node` slot as a Codex-style
		*   file-change card at the tail of the turn that touched files.
		* - `dsh-better-sidebar` review tab: session-wide review list; clicking a
		*   file expands the host-computed diff inline (git-free). Optional service.
		*/
		/** Required services for this browser plugin (sidebar is optional). */
		const inject = ["slots"];
		const TAIL_KIND = "diff-review-tail";
		function apply(ctx) {
		// dsh-better-sidebar publishes its service at its own apply time; plugins
		// load alphabetically (@dsh-external/... comes first), so capturing the
		// service once here would forever hold `undefined` and silently swallow
		// every card click. Resolve it lazily per click instead.
		const openReview = (fileKey) => {
			const betterSidebar = ctx.get("betterSidebar");
			if (betterSidebar === void 0) return;
			if (fileKey !== void 0) requestReviewFile(fileKey);
			betterSidebar.openTab({ type: "@dsh-external/dsh-diff-review:review" });
		};
			const face = { openReview };
			try {
				ctx.slots.register({
					name: "conversation.chat.node",
					key: TAIL_KIND,
					inject: () => face
				}, DiffReviewTailNode);
			} catch (error) {
				console.error("dsh-diff-review: failed to register diff-review-tail node renderer", error);
			}
			const conversationEvents = ctx.get("conversationEvents");
			if (conversationEvents !== void 0) try {
				const dispose = conversationEvents.register({
					kind: TAIL_KIND,
					target: "chat",
					match: (event) => {
						if (event.type === "turn/end" && typeof event.data?.turn === "number") return {
							id: String(event.data.turn),
							role: "start"
						};
						return null;
					},
					start: (_context, match) => {
						if (match.event.type !== "turn/end") throw new Error("diff-review-tail start requires turn/end");
						return { end: match };
					},
					buildViewNode: (context) => {
						const end = context.state?.end;
						const turn = end?.event?.data?.turn;
						if (end?.event?.seq === void 0 || typeof turn !== "number") return null;
						return {
							key: context.key,
							kind: TAIL_KIND,
							id: context.id,
							target: "chat",
							anchorSeq: end.event.seq + .5,
							location: { kind: "unresolved" },
							visibility: "visible",
							data: {
								turn,
								seq: end.event.seq,
								time: end.event.time ?? 0
							}
						};
					},
					publication: (match) => match.event.type === "turn/end" ? "immediate" : "none"
				});
				ctx.effect(() => dispose, "dsh-diff-review conversation definition");
			} catch (error) {
				console.error("dsh-diff-review: failed to register diff-review-tail conversation definition", error);
			}
			// Register the review tab as soon as (and each time) the sidebar service
		// becomes available — ctx.inject defers until the provider is published.
		ctx.inject(["betterSidebar"], () => {
			ctx.betterSidebar.registerTab({
				id: "@dsh-external/dsh-diff-review:review",
				title: "审阅",
				order: 90,
				single: true,
				icon: (size) => (0, react.createElement)("svg", {
					width: size,
					height: size,
					viewBox: "0 0 24 24",
					fill: "none",
					"aria-hidden": true
				}, (0, react.createElement)("path", {
					d: "M5 4h14v16H5V4Z",
					stroke: "currentColor",
					strokeWidth: 1.7,
					strokeLinejoin: "round"
				}), (0, react.createElement)("path", {
					d: "M9 9h6M9 13h6",
					stroke: "currentColor",
					strokeWidth: 1.7,
					strokeLinecap: "round"
				})),
				component: ReviewSidebarTab
			});
			return () => {};
		});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map