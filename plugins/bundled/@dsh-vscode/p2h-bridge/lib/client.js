/**
 * p2h-bridge — client half: the「PPT」manager tab in the better-sidebar tab strip.
 *
 * Management model (user request 2026-08-31): a full deck manager over .ppt/<deck>/
 * folders — one card per uploaded PPT (source + html-slides/ + exports), a deck list
 * with per-deck actions (preview / export / re-import / reference / delete), an
 * active-deck inline preview that COLLAPSES, and preview HISTORY with a back button.
 *
 * Interaction model (2026-08-30): the composer-dock capsule is GONE; everything lives
 * in this sidebar tab — the same surface mechanism web-review uses (ctx.get("betterSidebar")
 * + registerTab, internal/status watcher covering plugin-load ordering).
 *
 * ① UI on the platform DSW design tokens (--dsw-alias-*) — one-shot injected stylesheet
 *    with hover/active states, concentric radii, ellipsis truncation.
 * ② 「打开预览」 opens the web-review preview TAB (service.openTab) so the isolated-
 *    preview bridge (element picking, annotations) is active; window.open fallback.
 *
 * Shape follows the git-graph/web-review client bundles (window.__ModuleLoader__.load +
 * factory(require)), hand-written — no build step. Talks to /p2h-bridge/api/* (v2
 * storage model: state/upload/import/export/setActive/remove over .ppt/<deck>/).
 */
window.__ModuleLoader__.load({
	id: "@dsh-vscode/p2h-bridge",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		const e = react.createElement;
		const useEffect = react.useEffect;
		const useMemo = react.useMemo;
		const useRef = react.useRef;
		const useState = react.useState;

		//#region better-sidebar engagement (web-review watchBetterSidebar pattern)
		function watchBetterSidebar(ctx, onEngage, onDisengage) {
			let current = null;
			let disposed = false;
			const probe = () => {
				if (disposed) return;
				const service = typeof ctx.get === "function" ? ctx.get("betterSidebar") : undefined;
				if (service !== undefined && service !== null && typeof service.registerTab === "function") {
					if (current === null) {
						current = service;
						onEngage(service);
					}
				} else if (current !== null) {
					current = null;
					onDisengage();
				}
			};
			probe();
			const listener = () => probe();
			try {
				ctx.on("internal/status", listener);
			} catch {
				/* ctx.on unavailable — the immediate probe is all we get */
			}
			return {
				dispose() {
					disposed = true;
					current = null;
				},
			};
		}
		//#endregion

		//#region api helpers
		const API = "/p2h-bridge/api";

		async function apiJson(path, options) {
			const response = await fetch(path, options);
			const payload = await response.json().catch(() => null);
			if (!response.ok || payload?.ok !== true) {
				throw new Error(payload?.error ?? `HTTP ${response.status}`);
			}
			return payload;
		}

		function bufferToBase64(buffer) {
			const bytes = new Uint8Array(buffer);
			let binary = "";
			const CHUNK = 0x8000;
			for (let i = 0; i < bytes.length; i += CHUNK) {
				binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
			}
			return btoa(binary);
		}

		function formatBytes(bytes) {
			if (!(bytes >= 0)) return "";
			if (bytes < 1024) return `${bytes} B`;
			if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
			return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		}
		//#endregion

		//#region preview opening (web-review preview tab, browser fallback)
		function openPreviewUrl(ctx, url) {
			if (!url) return false;
			try {
				const service = ctx && typeof ctx.get === "function" ? ctx.get("betterSidebar") : null;
				if (
					service &&
					typeof service.isTabEnabled === "function" &&
					typeof service.openTab === "function" &&
					service.isTabEnabled("dsh-web-review:preview")
				) {
					service.openTab({ type: "dsh-web-review:preview", url });
					return true;
				}
			} catch {
				/* integration probe failed — fall through to window.open */
			}
			window.open(url, "_blank", "noopener");
			return false;
		}
		//#endregion

		//#region stylesheet (one-shot injected; DSW tokens with local fallbacks)
		let styleInjected = false;
		function injectStyles(doc) {
			if (styleInjected) return;
			const target = (doc && doc.head) || null;
			if (!target) return;
			const style = doc.createElement("style");
			style.textContent = `
.p2h-root{display:flex;flex-direction:column;height:100%;overflow-y:auto;overflow-x:hidden;padding:12px 12px 20px;box-sizing:border-box;color:var(--dsw-alias-label-primary,#d4d4d4);font-family:inherit;font-size:13px;line-height:1.5}
.p2h-sec{margin-top:20px}
.p2h-sec--first{margin-top:2px}
.p2h-label{font-size:11px;line-height:16px;letter-spacing:.08em;font-weight:600;color:var(--dsw-alias-label-tertiary,#8b8b8b);margin:0 0 8px}
.p2h-drop{border:1.5px dashed var(--dsw-alias-hairline,rgba(128,128,128,.4));border-radius:10px;padding:16px 12px;text-align:center;cursor:pointer;color:var(--dsw-alias-label-secondary,#b4b4b4);background:transparent;transition:color .15s ease-out,border-color .15s ease-out,background-color .15s ease-out}
.p2h-drop:hover{border-color:var(--dsw-alias-accent,#3b82f6);background-color:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05));color:var(--dsw-alias-label-primary,#e8e8e8)}
.p2h-drop--busy{opacity:.6;cursor:default}
.p2h-card{background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-hairline,rgba(128,128,128,.22));border-radius:10px;padding:10px}
.p2h-btn{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:8px;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-accent,#2f6feb));color:var(--dsw-alias-label-primary-inverted,#fff);font:inherit;font-size:12px;line-height:26px;padding:0 14px;cursor:pointer;transition:filter .15s ease-out,transform .1s ease-out,opacity .15s ease-out}
.p2h-btn:hover{filter:brightness(1.12)}
.p2h-btn:active{transform:scale(.96)}
.p2h-btn--ghost{background:transparent;color:var(--dsw-alias-label-secondary,#bcbcbc);box-shadow:inset 0 0 0 1px var(--dsw-alias-hairline,rgba(128,128,128,.35))}
.p2h-btn--ghost:hover{background-color:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05));color:var(--dsw-alias-label-primary,#e8e8e8);filter:none}
.p2h-btn[aria-disabled="true"]{opacity:.5;cursor:default;transform:none;filter:none}
.p2h-mini{display:inline-flex;align-items:center;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#b0b0b0);font:inherit;font-size:11px;line-height:22px;padding:0 8px;cursor:pointer;transition:background-color .15s ease-out,color .15s ease-out,transform .1s ease-out}
.p2h-mini:hover{background-color:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#eaeaea)}
.p2h-mini:active{transform:scale(.94)}
.p2h-mini--danger:hover{background-color:rgba(220,60,60,.16);color:#ff8f8f}
.p2h-row{display:flex;align-items:center;gap:8px;min-width:0}
.p2h-row--actions{flex-wrap:wrap;gap:6px;margin-top:8px}
.p2h-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}
.p2h-name--strong{font-weight:600;color:var(--dsw-alias-label-primary,#ececec)}
.p2h-meta{margin:6px 0 0;font-size:11px;color:var(--dsw-alias-label-tertiary,#909090);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.p2h-badge{flex:none;font-size:10.5px;line-height:18px;padding:0 8px;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-secondary,#b6b6b6);font-variant-numeric:tabular-nums;white-space:nowrap}
.p2h-badge--accent{background:var(--dsw-alias-accent-dim,rgba(59,130,246,.22));color:var(--dsw-alias-accent-text,#8ab4ff)}
.p2h-deck{margin-bottom:10px}
.p2h-deck--active{border-color:var(--dsw-alias-accent-dim,rgba(59,130,246,.45));box-shadow:0 0 0 1px var(--dsw-alias-accent-dim,rgba(59,130,246,.25))}
.p2h-chip{display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:8px;background:rgba(255,255,255,.03);margin-top:4px;min-width:0}
.p2h-chip .p2h-name{font-size:11.5px}
.p2h-note{margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(230,90,90,.14);color:#ffb4b4;font-size:12px;white-space:pre-wrap}
.p2h-ok{margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(70,180,110,.13);color:#9fe0b8;font-size:11.5px;white-space:pre-wrap;overflow:hidden;text-overflow:ellipsis}
.p2h-empty{margin:0;font-size:12px;color:var(--dsw-alias-label-tertiary,#909090)}
.p2h-frame{width:100%;height:300px;margin-top:10px;border:1px solid var(--dsw-alias-hairline,rgba(128,128,128,.25));border-radius:8px;background:#141414;box-sizing:border-box}
.p2h-frame--tall{height:430px}
.p2h-frame-wrap{position:relative;width:100%;height:430px;margin-top:10px;overflow:hidden;border:1px solid var(--dsw-alias-hairline,rgba(128,128,128,.25));border-radius:8px;background:#141414;box-sizing:border-box}
.p2h-frame-wrap iframe{position:absolute;top:0;left:0;border:0;background:#fff}
.p2h-toolbar{display:flex;align-items:center;gap:6px;margin-top:10px}
.p2h-spacer{flex:1 1 auto}
`;
			target.appendChild(style);
			styleInjected = true;
		}
		//#endregion

		//#region PptManagerTab
		/**
		 * Inline deck preview: the rendered slides are laid out on a fixed 1280px canvas,
		 * so a narrow sidebar iframe would crop them. Render the iframe at full 1280px and
		 * scale it down to the measured wrapper width (ResizeObserver), keeping the whole
		 * slide visible and interactive at any sidebar width.
		 */
		function PreviewFrame({ src }) {
			const wrapRef = useRef(null);
			const [scale, setScale] = useState(1);
			useEffect(() => {
				const el = wrapRef.current;
				if (!el) return;
				const update = () => {
					const w = el.clientWidth;
					if (w > 0) setScale(Math.min(1, w / 1280));
				};
				update();
				let ro = null;
				try {
					ro = new ResizeObserver(update);
					ro.observe(el);
				} catch {
					window.addEventListener("resize", update);
				}
				return () => {
					if (ro) ro.disconnect();
					else window.removeEventListener("resize", update);
				};
			}, []);
			return e("div", { ref: wrapRef, className: "p2h-frame-wrap" },
				e("iframe", {
					src,
					title: "当前 PPT 快速预览（点「打开预览」可批注）",
					style: {
						width: "1280px",
						height: `${Math.round(430 / Math.max(scale, 0.05))}px`,
						transform: `scale(${scale})`,
						transformOrigin: "0 0",
					},
				}),
			);
		}

		function PptManagerTab({ scope, ctx }) {
			const [data, setData] = useState(null);
			const [busy, setBusy] = useState("");
			const [error, setError] = useState("");
			const [notice, setNotice] = useState(null);
			const [previewOpen, setPreviewOpen] = useState(true);
			const [history, setHistory] = useState([]);
			const [confirming, setConfirming] = useState(null);
			const fileRef = useRef(null);
			const sessionId = scope?.sessionId ?? null;

			const refresh = async () => {
				const next = await apiJson(`${API}/state`);
				setData(next);
				return next;
			};

			useEffect(() => {
				let cancelled = false;
				refresh().catch((err) => !cancelled && setError(String(err.message || err)));
				return () => {
					cancelled = true;
				};
			}, []);

			const guard = (name, fn) => async (...args) => {
				if (busy) return;
				setBusy(name);
				setError("");
				try {
					await fn(...args);
				} catch (err) {
					setError(String((err && err.message) || err));
				} finally {
					setBusy("");
				}
			};

			/** Upload every picked file, then convert each into its own deck (sequential). */
			const pickAndImport = guard("import", async (fileList) => {
				const files = Array.from(fileList ?? []);
				if (files.length === 0) return;
				setNotice(files.length > 1 ? `正在导入 ${files.length} 个文件…` : null);
				for (const file of files) {
					if (file.size > 20 * 1024 * 1024) {
						setNotice(null);
						setError(`${file.name} 超过 20MB 上限，无法上传`);
						continue;
					}
					const buffer = await file.arrayBuffer();
					const uploaded = await apiJson(`${API}/upload`, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ name: file.name, dataBase64: bufferToBase64(buffer) }),
					});
					await apiJson(`${API}/import`, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ deck: uploaded.deck }),
					});
				}
				setNotice(null);
				setHistory([]);
				await refresh();
			});

			/** Preview a deck inline + in the web-review tab; push the current one onto history. */
			const previewDeck = guard("active", async (deckName, openTab) => {
				const current = data?.active;
				if (current && current !== deckName) setHistory((h) => [...h.slice(-9), current]);
				await apiJson(`${API}/setActive`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ deck: deckName }),
				});
				const next = await refresh();
				const deck = (next.decks ?? []).find((d) => d.name === deckName);
				if (openTab && deck?.previewUrl) openPreviewUrl(ctx, deck.previewUrl);
			});

			/** Back: pop the most recent previewed deck. */
			const goBack = guard("back", async () => {
				let previous = null;
				setHistory((h) => {
					if (h.length === 0) return h;
					previous = h[h.length - 1];
					return h.slice(0, -1);
				});
				// setState callback runs synchronously in React 18 — previous is set by now.
				const target = previous ?? null;
				if (!target) return;
				await apiJson(`${API}/setActive`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ deck: target }),
				});
				await refresh();
			});

			const exportDeck = guard("export", async (deckName) => {
				const result = await apiJson(`${API}/export`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ deck: deckName }),
				});
				setNotice({ kind: "export", text: `已导出 ${result.slideCount ?? "?"} 页 → ${result.relative}`, warnings: result.warnings });
				await refresh();
			});

			const reimportDeck = guard("import", async (deckName) => {
				await apiJson(`${API}/import`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ deck: deckName }),
				});
				setNotice(null);
				await refresh();
			});

			const removeDeck = guard("remove", async (deckName) => {
				// Inline two-step confirm (native window.confirm is unavailable in the
				// DSH web surface and silently returns false — the button would "do nothing").
				await apiJson(`${API}/remove`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ deck: deckName }),
				});
				setHistory((h) => h.filter((n) => n !== deckName));
				setConfirming(null);
				await refresh();
			});

			const removeExport = guard("remove", async (deckName, fileName) => {
				await apiJson(`${API}/remove`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ deck: deckName, file: fileName }),
				});
				setConfirming(null);
				await refresh();
			});

			/** Prefill the composer with an @-reference so the agent takes over. */
			const referenceInChat = (relativePath) => {
				try {
					const sessions = ctx && typeof ctx.get === "function" ? ctx.get("sessions") : undefined;
					const conversation = ctx && typeof ctx.get === "function" ? ctx.get("conversation") : undefined;
					const sessionCtx = sessions && sessionId ? sessions.scope(sessionId) : undefined;
					const input = sessionCtx && conversation ? conversation.input.for(sessionCtx) : undefined;
					if (!input) {
						setError("当前会话不可用，无法预填输入框");
						return;
					}
					input.setDraft(`@${relativePath} 请继续处理这份 PPT`);
					setError("");
				} catch (err) {
					setError(String((err && err.message) || err));
				}
			};

			const decks = data?.decks ?? [];
			const active = data?.active;
			const activeDeck = decks.find((d) => d.name === active) ?? null;
			const disabled = busy !== "";

			const deckCard = (deck) => {
				const isActive = deck.name === active;
				return e("div", { className: `p2h-card p2h-deck${isActive ? " p2h-deck--active" : ""}`, key: deck.name },
					e("div", { className: "p2h-row" },
						e("span", { className: "p2h-name p2h-name--strong", title: deck.name }, deck.name),
						isActive ? e("span", { className: "p2h-badge p2h-badge--accent" }, "当前") : null,
						deck.project ? e("span", { className: "p2h-badge", title: "幻灯片页数" }, `${deck.project.slideCount} 页`) : e("span", { className: "p2h-badge", title: "尚未转换" }, "未转换"),
						deck.source ? e("span", { className: "p2h-badge" }, formatBytes(deck.source.bytes)) : null,
					),
					deck.project?.importedAt
						? e("p", { className: "p2h-meta" }, `转换于 ${new Date(deck.project.importedAt).toLocaleString()}`)
						: e("p", { className: "p2h-meta" }, deck.source ? "有源文件，尚未转换" : "空文件夹"),
					e("div", { className: "p2h-row p2h-row--actions" },
						e("button", {
							className: "p2h-btn",
							"aria-disabled": disabled || !deck.project,
							onClick: disabled || !deck.project ? undefined : () => previewDeck(deck.name, true),
							title: "在 web-review 预览标签页中打开（支持框选元素批注），并设为当前预览",
						}, busy === "active" && !isActive ? "…" : "打开预览"),
						e("button", {
							className: "p2h-btn p2h-btn--ghost",
							"aria-disabled": disabled || !deck.project,
							onClick: disabled || !deck.project ? undefined : () => exportDeck(deck.name),
							title: "把该 deck 导出回 .pptx（写入本 deck 文件夹，绝不覆盖）",
						}, busy === "export" ? "导出中…" : "导出 PPTX"),
						deck.source && !isActive
							? e("button", {
									className: "p2h-mini",
									"aria-disabled": disabled,
									title: "切换为当前预览（不重新转换）",
									onClick: disabled ? undefined : () => previewDeck(deck.name, false),
								}, "设为当前")
							: null,
						deck.source
							? e("button", {
									className: "p2h-mini",
									"aria-disabled": disabled,
									title: "用源文件重新转换 html-slides",
									onClick: disabled ? undefined : () => reimportDeck(deck.name),
								}, busy === "import" ? "…" : "重新转换")
							: null,
						e("span", { className: "p2h-spacer" }),
						deck.source ? e("button", { className: "p2h-mini", title: "在对话中引用源文件", onClick: () => referenceInChat(deck.source.relative) }, "引用") : null,
						confirming === `deck:${deck.name}`
							? e("span", { className: "p2h-row", style: { gap: "4px" } },
									e("button", {
										className: "p2h-mini p2h-mini--danger",
										"aria-disabled": disabled,
										title: "确认删除整个 deck 文件夹（含源 PPT、html-slides 与导出件，不可恢复）",
										onClick: disabled ? undefined : () => removeDeck(deck.name),
									}, "确认删除"),
									e("button", { className: "p2h-mini", title: "取消", onClick: () => setConfirming(null) }, "取消"),
								)
							: e("button", {
									className: "p2h-mini p2h-mini--danger",
									title: "删除整个 deck 文件夹（需二次确认）",
									onClick: disabled ? undefined : () => setConfirming(`deck:${deck.name}`),
								}, "删除"),
					),
					deck.exports.length > 0
						? e("div", { style: { marginTop: "6px" } },
								deck.exports.map((exp) =>
									e("div", { className: "p2h-chip", key: exp.name },
										e("span", { className: "p2h-name", title: exp.relative }, exp.name),
										e("span", { className: "p2h-badge" }, formatBytes(exp.bytes)),
										e("button", { className: "p2h-mini", title: "在对话中引用这份产物", onClick: () => referenceInChat(exp.relative) }, "引用"),
										confirming === `export:${deck.name}:${exp.name}`
											? e("span", { className: "p2h-row", style: { gap: "4px" } },
													e("button", {
														className: "p2h-mini p2h-mini--danger",
														"aria-disabled": disabled,
														title: "确认删除此导出文件",
														onClick: disabled ? undefined : () => removeExport(deck.name, exp.name),
													}, "确认"),
													e("button", { className: "p2h-mini", title: "取消", onClick: () => setConfirming(null) }, "取消"),
												)
											: e("button", {
													className: "p2h-mini p2h-mini--danger",
													title: "删除此导出文件（需二次确认）",
													onClick: disabled ? undefined : () => setConfirming(`export:${deck.name}:${exp.name}`),
												}, "删除"),
									),
								),
							)
						: null,
					isActive && deck.project
						? e("div", null,
								e("div", { className: "p2h-toolbar" },
									e("button", { className: "p2h-mini", onClick: () => setPreviewOpen((v) => !v) }, previewOpen ? "▼ 收起预览" : "▶ 展开预览"),
									e("button", {
										className: "p2h-mini",
										"aria-disabled": disabled || history.length === 0,
										onClick: disabled || history.length === 0 ? undefined : goBack,
										title: "回退到上一个预览的 PPT",
									}, `← 回退${history.length > 0 ? ` (${history.length})` : ""}`),
									e("span", { className: "p2h-spacer" }),
									e("span", { className: "p2h-badge", title: "预览历史" }, history.join(" → ").slice(-60) || "无历史"),
								),
								previewOpen
									? e(PreviewFrame, {
											src: `${deck.previewUrl}${deck.previewUrl.includes("?") ? "&" : "?"}t=${Date.now()}`,
										})
									: null,
							)
						: null,
				);
			};

			return e("div", { className: "p2h-root" },
				// ——— 导入 ———
				e("div", { className: "p2h-sec p2h-sec--first" },
					e("p", { className: "p2h-label" }, "导入 PPT（可多选，每个 PPT 一个文件夹）"),
					e("div", {
						className: `p2h-drop${busy === "import" ? " p2h-drop--busy" : ""}`,
						title: "选择 .pptx 文件，自动上传到 .ppt/<同名文件夹>/ 并转换为网页幻灯片",
						role: "button",
						onClick: () => {
							if (busy) return;
							if (fileRef.current) {
								fileRef.current.value = "";
								fileRef.current.click();
							}
						},
					}, busy === "import" ? "正在转换…" : "点击选择 .pptx 文件"),
					e("input", {
						type: "file",
						accept: ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation",
						multiple: true,
						ref: fileRef,
						style: { display: "none" },
						onChange: (event) => {
							const files = event && event.target && event.target.files;
							pickAndImport(files);
						},
					}),
				),
				error ? e("div", { className: "p2h-note" }, error) : null,
				notice && typeof notice === "string" ? e("p", { className: "p2h-meta" }, notice) : null,

				// ——— 全部 PPT ———
				e("div", { className: "p2h-sec" },
					e("p", { className: "p2h-label" }, `全部 PPT（.ppt/ 共 ${decks.length} 个）`),
					decks.length > 0
						? decks.map((deck) => deckCard(deck))
						: e("p", { className: "p2h-empty" }, "还没有 PPT。导入 .pptx 后，每个文件会在 .ppt/ 下生成自己的文件夹（源文件 + html-slides + 导出件）。"),
				),

				notice && typeof notice === "object" && notice.kind === "export"
					? e("div", { className: "p2h-ok" },
							notice.text,
							notice.warnings && notice.warnings.length > 0 ? `\n警告：\n- ${notice.warnings.join("\n- ")}` : "",
						)
					: null,
			);
		}
		//#endregion

		//#region tab registration
		const TAB_ID = "p2h-bridge:manager"; // must be prefixed — never a built-in tab id

		function ManagerTabIcon() {
			return e("svg", {
				width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true",
			},
			e("rect", { x: 2, y: 2.5, width: 12, height: 8.5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.4 }),
			e("path", { d: "M5 13.5h6M8 11v2.5", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" }),
			e("path", { d: "M5.2 5.2h5.6M5.2 7.4h3.6", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" }));
		}

		function registerManagerTab(ctx, service) {
			const descriptor = {
				id: TAB_ID,
				title: () => "PPT",
				icon: e(ManagerTabIcon),
				order: 70,
				single: true,
				component: (props) => e(PptManagerTab, { ...(props || {}), ctx }),
			};
			return service.registerTab(descriptor);
		}
		//#endregion

		//#region apply
		function apply(ctx) {
			// Inject the .p2h-* stylesheet before the tab can render — without this the
			// manager renders as raw unstyled blocks (layout entirely collapsed).
			injectStyles(document);
			let tabDisposer = null;
			const watcher = watchBetterSidebar(
				ctx,
				(service) => {
					try {
						tabDisposer = registerManagerTab(ctx, service);
					} catch (error) {
						// duplicate id (hot reload) or API drift — conversation tools keep working regardless
						console.error("[p2h-bridge] registerTab failed:", error);
					}
				},
				() => {
					if (tabDisposer) {
						try {
							tabDisposer();
						} catch {
							/* already gone */
						}
						tabDisposer = null;
					}
				},
			);
			ctx.effect(() => watcher.dispose, "p2h-bridge: sidebar tab watcher");
		}
		//#endregion

		exports.PptManagerTab = PptManagerTab;
		exports.openPreviewUrl = openPreviewUrl;
		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	},
});
