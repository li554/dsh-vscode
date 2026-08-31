/**
 * p2h-bridge — client half: the composer-dock「导入 PPT」capsule (design doc §4.1-①).
 *
 * Shape follows the git-graph client bundle (window.__ModuleLoader__.load + factory(require)),
 * hand-written — no build step. The dock seat carries `session` and `input` (composer facade);
 * the capsule uploads the picked .pptx to the host (/p2h-bridge/api/upload, same origin with
 * the webview) and prefills the draft with "@<relative-path>" via input.setDraft — the same
 * surface web-review's annotation submit uses (conversation.input...setDraft).
 *
 * Scope (MVP): import entry only. Export/preview flows live in conversation + the official
 * deliverables row (slides_export presentResult kind:'edit' + locations).
 */
window.__ModuleLoader__.load({
	id: "@dsh-vscode/p2h-bridge",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		const e = react.createElement;

		//#region p2h-import-capsule
		const BUTTON_STYLE = {
			display: "inline-flex",
			alignItems: "center",
			gap: "4px",
			border: "1px solid var(--vscode-activityBar-border, rgba(128,128,128,.35))",
			borderRadius: "999px",
			background: "transparent",
			color: "var(--vscode-foreground, #ccc)",
			font: "inherit",
			fontSize: "12px",
			lineHeight: "18px",
			padding: "2px 10px",
			cursor: "pointer",
			userSelect: "none",
			whiteSpace: "nowrap",
		};
		const BUTTON_BUSY_STYLE = { ...BUTTON_STYLE, opacity: 0.6, cursor: "default" };
		const NOTE_STYLE = {
			fontSize: "11px",
			lineHeight: "15px",
			color: "var(--vscode-errorForeground, #f66)",
			maxWidth: "220px",
			whiteSpace: "normal",
		};

		function bufferToBase64(buffer) {
			const bytes = new Uint8Array(buffer);
			let binary = "";
			const CHUNK = 0x8000;
			for (let i = 0; i < bytes.length; i += CHUNK) {
				binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
			}
			return btoa(binary);
		}

		async function uploadPptx(file) {
			const dataBase64 = bufferToBase64(await file.arrayBuffer());
			const response = await fetch("/p2h-bridge/api/upload", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: file.name, dataBase64 }),
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error ?? `upload failed (HTTP ${response.status})`);
			}
			return payload;
		}

		/**
		 * Dock seat component. Props include the session and the composer input facade
		 * (same seat contract git-graph's BranchChip detects via "session" in props && "input" in props).
		 */
		function ImportCapsule(props) {
			const input = props && props.input;
			const [busy, setBusy] = react.useState(false);
			const [note, setNote] = react.useState("");
			const fileRef = react.useRef(null);

			if (!input) {
				return null; // seat without a composer facade — nothing sensible to do
			}

			const pickFile = () => {
				if (busy) return;
				if (fileRef.current) {
					fileRef.current.value = "";
					fileRef.current.click();
				}
			};

			const onFile = async (event) => {
				const file = event && event.target && event.target.files && event.target.files[0];
				if (!file) return;
				if (!/\.pptx$/i.test(file.name)) {
					setNote("只能导入 .pptx 文件");
					return;
				}
				setBusy(true);
				setNote("");
				try {
					const result = await uploadPptx(file);
					// Prefill the composer: the @-reference names the workspace-relative landing path;
					// the model answers with slides_import + hands back the web-review preview URL.
					input.setDraft(`@${result.relativePath} 请把这份 PPT 转成可编辑的网页幻灯片`);
				} catch (error) {
					setNote(String((error && error.message) || error));
				} finally {
					setBusy(false);
				}
			};

			return e(
				"div",
				{ style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
				e(
					"button",
					{
						type: "button",
						style: busy ? BUTTON_BUSY_STYLE : BUTTON_STYLE,
						title: "上传 .pptx 到工作区并在输入框引用（进入 PPT↔HTML 审阅流程）",
						onClick: pickFile,
					},
					busy ? "上传中…" : "导入 PPT",
				),
				e("input", {
					type: "file",
					accept: ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation",
					ref: fileRef,
					style: { display: "none" },
					onChange: onFile,
				}),
				note ? e("span", { style: NOTE_STYLE }, note) : null,
			);
		}
		//#endregion

		//#region apply
		const inject = ["slots"];
		function apply(ctx) {
			ctx.inject(["slots"], (scope) => {
				scope.slots.inject("conversation.input.dock", () => {
					return scope.slots.register(
						{
							name: "conversation.input.dock",
							id: "p2h-import-capsule",
							order: 120,
						},
						ImportCapsule,
					);
				});
			});
		}
		//#endregion

		exports.ImportCapsule = ImportCapsule;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
