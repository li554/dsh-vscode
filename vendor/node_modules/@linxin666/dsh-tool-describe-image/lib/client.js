window.__ModuleLoader__.load({
	id: "@linxin666/dsh-tool-describe-image",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region src/client/attach.ts
		/**
		* Browser half of the attach seam: the upload client for the host
		* /describe-image/attach route. The browser sends the picked image as base64
		* text; the host validates magic bytes, persists the bytes in the attachment
		* store, and returns both a durable `[image attachment ...]` note and
		* self-contained Markdown reference. Image bytes never enter the conversation
		* log — only durable reference text does.
		* @module @linxin666/dsh-tool-describe-image/client/attach
		*/
		/** The host attach endpoint, same-origin with the web shell. */
		const ATTACH_ENDPOINT = "/describe-image/attach";
		/**
		* Read a picked file as base64 text (no data-URL prefix).
		* @param file - the file the user picked.
		* @returns the base64 payload, or a structured rejection.
		*/
		function readFileAsBase64(file) {
			return new Promise((resolve) => {
				const reader = new FileReader();
				reader.onerror = () => resolve({
					ok: false,
					message: "read-failed"
				});
				reader.onload = () => {
					const result = typeof reader.result === "string" ? reader.result : "";
					const comma = result.indexOf(",");
					if (comma < 0) {
						resolve({
							ok: false,
							message: "read-failed"
						});
						return;
					}
					resolve({
						ok: true,
						base64: result.slice(comma + 1)
					});
				};
				reader.readAsDataURL(file);
			});
		}
		/**
		* Upload base64 image bytes to the host attach route.
		* @param base64 - the base64 image payload.
		* @param mediaType - the declared media type (verified against magic bytes on the host).
		* @param name - optional display name.
		* @returns durable note and Markdown reference text, or a structured rejection.
		*/
		async function uploadImageForDescribe(base64, mediaType, name) {
			let response;
			try {
				response = await fetch(ATTACH_ENDPOINT, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						data: base64,
						mediaType,
						...name === void 0 ? {} : { name }
					})
				});
			} catch {
				return {
					ok: false,
					message: "network-failed"
				};
			}
			let envelope;
			try {
				envelope = await response.json();
			} catch {
				return {
					ok: false,
					message: "bad-response"
				};
			}
			const record = envelope;
			if (typeof record !== "object" || record === null) return {
				ok: false,
				message: "bad-response"
			};
			if (record.ok === true && typeof record.value === "object" && record.value !== null) {
				const value = record.value;
				if (typeof value.note === "string" && value.note !== "") return {
					ok: true,
					note: value.note,
					markdown: typeof value.markdown === "string" ? value.markdown : value.note
				};
				return {
					ok: false,
					message: "bad-response"
				};
			}
			const message = record.error?.message;
			return {
				ok: false,
				message: typeof message === "string" && message !== "" ? message : "server-failed"
			};
		}
		//#endregion
		//#region src/client/send-hook.ts
		/**
		* Send interception: text-only models reject image blocks at submit, so a
		* send that carries draft images is rewritten into a plain-text prompt that
		* carries durable describe-image references instead. The images are uploaded
		* through the host attach route (so bytes stay out of the conversation log),
		* the draft images are released, and the model analyzes them through the
		* describe_image tool rather than receiving the bytes it cannot read.
		*
		* The hook wraps the conversation service's sendSession method in place. It
		* is structural (no dependency on the conversation package's internal
		* types) and idempotent (a module marker guards against double install).
		* @module @linxin666/dsh-tool-describe-image/client/send-hook
		*/
		/** Installed-marker key on the wrapped service instance. */
		const HOOK_MARKER = "__dshDescribeImageSendHooked";
		/**
		* Wrap the conversation service so image-bearing sends route through the
		* describe-image attach seam. No-op when the service surface is unavailable
		* (older shell) or already wrapped. When `isEnabled` is given it is read on
		* every send: a send that reports the interception disabled passes straight
		* through to the original `sendSession`, so other vision plugins keep the
		* raw image blocks (issue #301). When `acceptsImages` is given it is
		* consulted per image-bearing send: a session whose model accepts image
		* input passes straight through with the raw image blocks — rewriting them
		* into references would hide the images behind a redundant describe_image
		* call the model never needed. A checker failure answers false and the
		* legacy rewrite proceeds, so text-only models never lose the feature.
		* @param conversation - the `conversation` service instance.
		* @param isEnabled - live switch; consulted per send (default: always on).
		* @param acceptsImages - per-session capability predicate (default: always false).
		*/
		function installSendHook(conversation, isEnabled, acceptsImages) {
			const face = conversation;
			if (face === null || typeof face !== "object") return;
			if (typeof face.sendSession !== "function") return;
			if (typeof face.draftImages !== "function" || typeof face.releaseDraftImage !== "function") return;
			if (face[HOOK_MARKER] === true) return;
			const original = face.sendSession;
			face.sendSession = async (session, text, imageIds, mode, signal) => {
				if (isEnabled !== void 0 && !isEnabled()) return original.call(face, session, text, imageIds, mode, signal);
				if (imageIds.length === 0) return original.call(face, session, text, imageIds, mode, signal);
				if (acceptsImages !== void 0) {
					let native = false;
					try {
						native = await acceptsImages(session);
					} catch {
						native = false;
					}
					if (native) return original.call(face, session, text, imageIds, mode, signal);
				}
				const attachments = face.draftImages(imageIds);
				if (attachments.length !== imageIds.length) return original.call(face, session, text, imageIds, mode, signal);
				const refs = [];
				for (const attachment of attachments) {
					const read = await readFileAsBase64(attachment.file);
					if (!read.ok) break;
					const upload = await uploadImageForDescribe(read.base64, attachment.file.type, attachment.file.name);
					if (!upload.ok) break;
					refs.push(upload.markdown);
				}
				if (refs.length !== attachments.length) return original.call(face, session, text, imageIds, mode, signal);
				const fullText = [text.trim(), ...refs].filter((part) => part !== "").join("\n");
				const outcome = await original.call(face, session, fullText, [], mode, signal);
				if (outcome.kind === "success") for (const id of imageIds) face.releaseDraftImage(id);
				return outcome;
			};
			face[HOOK_MARKER] = true;
		}
		/** Default probe fetch timeout, in milliseconds; a stalled host must not stall a send. */
		const DEFAULT_CAPABILITY_TIMEOUT_MS = 1500;
		/** Read the session id off the structural session face the send hook wraps. */
		function sessionIdOf(session) {
			if (session === null || typeof session !== "object") return void 0;
			const id = session.sessionId;
			return typeof id === "string" && id !== "" ? id : void 0;
		}
		/**
		* Fetch one session's verdict from the host route. True only on an explicit
		* acceptsImages-true envelope; network failures, bad envelopes, and unknowns
		* all answer false (keep the legacy rewrite).
		* @param sessionId - the session whose model is probed.
		* @param timeoutMs - fetch timeout in milliseconds.
		* @returns whether the model accepts raw image blocks.
		*/
		async function fetchSessionAcceptsImages(sessionId, timeoutMs = DEFAULT_CAPABILITY_TIMEOUT_MS) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);
			try {
				const envelope = await (await fetch("/describe-image/capability?session=" + encodeURIComponent(sessionId), { signal: controller.signal })).json();
				if (envelope === null || typeof envelope !== "object" || envelope.ok !== true) return false;
				const value = envelope.value;
				return value !== null && typeof value === "object" && value.acceptsImages === true;
			} catch {
				return false;
			} finally {
				clearTimeout(timer);
			}
		}
		/**
		* Create the send-hook's capability checker: per-session cached, in-flight
		* deduped, fail-closed. Sessions without a readable id answer false.
		* @param options - cache and timeout tuning.
		* @returns an async predicate over the structural session face.
		*/
		function createImageCapabilityChecker(options = {}) {
			const ttl = options.ttlMs ?? 3e4;
			const timeout = options.timeoutMs ?? 1500;
			const cache = /* @__PURE__ */ new Map();
			const inflight = /* @__PURE__ */ new Map();
			return (session) => {
				const id = sessionIdOf(session);
				if (id === void 0) return Promise.resolve(false);
				const hit = cache.get(id);
				if (hit !== void 0 && Date.now() - hit.at < ttl) return Promise.resolve(hit.value);
				const pending = inflight.get(id);
				if (pending !== void 0) return pending;
				const task = fetchSessionAcceptsImages(id, timeout);
				inflight.set(id, task);
				return task.then((value) => {
					cache.set(id, {
						at: Date.now(),
						value
					});
					inflight.delete(id);
					return value;
				}, () => {
					inflight.delete(id);
					return false;
				});
			};
		}
		//#endregion
		//#region src/client/locales.ts
		/** `describe-image` client namespace dictionaries (composer attach button copy). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"attach.button.title": "插入图片引用（describe-image 图像理解）",
			"attach.button.aria": "插入图片引用，交给 describe_image 工具分析",
			"attach.uploading": "上传中…",
			"attach.success": "图片引用已插入输入框；发送后文本模型可通过 describe_image 分析这张图片。",
			"attach.error.read": "无法读取所选图片文件。",
			"attach.error.type": "不支持的图片类型，仅接受 PNG / JPEG / GIF / WebP。",
			"attach.error.size": "图片超过 10 MB 上限。",
			"attach.error.noSession": "当前没有可用会话，无法插入图片引用。",
			"attach.error.upload": "上传失败：{error}",
			"card.title": "图像理解",
			"card.description": "describe_image 工具所调用的视觉语言端点。",
			"settings.expand": "展开设置",
			"settings.collapse": "收起设置",
			"settings.notExposed": "当前部署未暴露此命名空间，无法在此编辑；请在挂载配置中填写端点。",
			"settings.unsaved": "有未保存的修改",
			"settings.readOnly": "当前部署的设置为只读。",
			"settings.saveFailed": "保存失败，请重试。",
			"settings.discard": "放弃修改",
			"settings.save": "保存",
			"settings.saving": "保存中…",
			"settings.overridden": "已覆盖",
			"settings.reset": "重置",
			"settings.inherit": "继承",
			"settings.on": "开",
			"settings.off": "关",
			"settings.invalidNumber": "需要有效的数字",
			"field.baseURL": "接口地址",
			"field.baseURL.hint": "接口根地址；chat-completions 追加 /chat/completions，responses 追加 /responses，anthropic-messages 追加 /v1/messages。",
			"field.model": "模型",
			"field.model.hint": "该端点提供的视觉模型 id。",
			"field.apiStyle": "接口协议",
			"field.apiStyle.hint": "chat-completions 走 /chat/completions，responses 走 /responses，anthropic-messages 走 /v1/messages（x-api-key 鉴权）。",
			"field.apiStyle.chatCompletions": "Chat Completions",
			"field.apiStyle.responses": "Responses",
			"field.apiStyle.anthropicMessages": "Anthropic Messages",
			"field.apiKey": "API Key",
			"field.apiKey.hint": "不写入设置文件。留空表示保持当前密钥。",
			"field.apiKeyEnv": "密钥环境变量",
			"field.apiKeyEnv.hint": "凭证服务解析该环境变量名；空字符串禁用。",
			"field.defaultPrompt": "默认指令",
			"field.defaultPrompt.hint": "调用未带 prompt 参数时的默认指令。",
			"field.maxBytes": "图片字节上限",
			"field.maxBytes.hint": "本地文件与下载一致的字节上限。",
			"field.maxOutputTokens": "输出 token 上限",
			"field.maxOutputTokens.hint": "发给端点的 max_tokens（responses 协议为 max_output_tokens）。",
			"field.timeoutMs": "超时（毫秒）",
			"field.timeoutMs.hint": "单次视觉请求超时。",
			"field.renderImagePreview": "会话内渲染图片预览",
			"field.renderImagePreview.hint": "开：会话里的图片引用原地显示为缩略图，点击查看大图；关：保持原始引用文本。仅影响本地显示，消息文本与模型识别不变。",
			"field.interceptImageSend": "发送时改写图片为 describe-image 引用",
			"field.interceptImageSend.hint": "开（默认）：发往纯文本模型的带图发送在提交时被改写为 describe-image 引用；支持图片输入的模型会被自动识别，原图直接交给模型本身。关：发送原样放行，图片与附件块交给会话（与其他视觉插件共用时需要关闭）。",
			"probe.fetchModels": "获取模型",
			"probe.connectivity": "测试连通性",
			"probe.running": "测试中…",
			"probe.hint": "请求当前填写的接口地址与密钥（未保存也可测）：列出成功即端点可达且鉴权通过，返回的模型填充下拉选择。",
			"probe.testHint": "用当前模型发一次最小补全请求（max_tokens 1），测模型本身的往返延迟，消耗极少 token。",
			"probe.fetched": "已获取 {count} 个模型",
			"probe.success": "成功：{ms} ms",
			"probe.error": "失败：{error}",
			"preview.expand": "点击查看大图",
			"preview.close": "关闭大图",
			"native.title": "原生图片请求",
			"native.loading": "读取中…",
			"native.enable": "启用",
			"native.disable": "停用",
			"native.busy": "写入中…",
			"native.enabled": "当前默认模型「{model}」已启用原生图片输入；发送的图片直接交给模型，describe_image 会从该模型的工具集中隐藏。",
			"native.disabled": "当前默认模型「{model}」未启用原生图片输入；发送的图片会被改写为 describe-image 引用。",
			"native.unknownModel": "当前没有可用的默认模型选择。",
			"native.unsupported": "当前宿主未挂载 llm-deepseek 设置命名空间，无法在此配置。",
			"native.failed": "写入失败：{error}"
		};
		/** The two dictionaries, keyed by language. */
		const dictionaries = {
			zh,
			en: {
				"attach.button.title": "Insert image reference (describe-image vision)",
				"attach.button.aria": "Insert an image reference for the describe_image tool",
				"attach.uploading": "Uploading…",
				"attach.success": "Image reference inserted; the text model can analyze this image via describe_image once you send the message.",
				"attach.error.read": "Could not read the selected image file.",
				"attach.error.type": "Unsupported image type; only PNG / JPEG / GIF / WebP are accepted.",
				"attach.error.size": "The image exceeds the 10 MB bound.",
				"attach.error.noSession": "No active session; cannot insert an image reference.",
				"attach.error.upload": "Upload failed: {error}",
				"card.title": "Image understanding",
				"card.description": "The vision-language endpoint the describe_image tool calls.",
				"settings.expand": "Expand settings",
				"settings.collapse": "Collapse settings",
				"settings.notExposed": "This deployment does not expose the namespace; configure the endpoint in the mount config instead.",
				"settings.unsaved": "Unsaved changes",
				"settings.readOnly": "Settings are read-only in this deployment.",
				"settings.saveFailed": "Save failed; try again.",
				"settings.discard": "Discard",
				"settings.save": "Save",
				"settings.saving": "Saving…",
				"settings.overridden": "Overridden",
				"settings.reset": "Reset",
				"settings.inherit": "Inherit",
				"settings.on": "On",
				"settings.off": "Off",
				"settings.invalidNumber": "A valid number is required",
				"field.baseURL": "Base URL",
				"field.baseURL.hint": "Endpoint root; /chat/completions, /responses, or /v1/messages is appended per the API style.",
				"field.model": "Model",
				"field.model.hint": "The vision model id this endpoint provides.",
				"field.apiStyle": "API style",
				"field.apiStyle.hint": "chat-completions posts to /chat/completions; responses posts to /responses; anthropic-messages posts to /v1/messages with x-api-key auth.",
				"field.apiStyle.chatCompletions": "Chat Completions",
				"field.apiStyle.responses": "Responses",
				"field.apiStyle.anthropicMessages": "Anthropic Messages",
				"field.apiKey": "API key",
				"field.apiKey.hint": "Never written to the settings file. Leave empty to keep the current key.",
				"field.apiKeyEnv": "Key environment variable",
				"field.apiKeyEnv.hint": "Resolved through the credential service; empty disables it.",
				"field.defaultPrompt": "Default instruction",
				"field.defaultPrompt.hint": "Used when a call omits its prompt parameter.",
				"field.maxBytes": "Max image bytes",
				"field.maxBytes.hint": "Byte bound for local files and downloads alike.",
				"field.maxOutputTokens": "Max output tokens",
				"field.maxOutputTokens.hint": "The max_tokens sent to the endpoint (max_output_tokens under the responses style).",
				"field.timeoutMs": "Timeout (ms)",
				"field.timeoutMs.hint": "Per-call vision request timeout.",
				"field.renderImagePreview": "Render image preview in chat",
				"field.renderImagePreview.hint": "On: image references in the conversation upgrade into inline thumbnails (click for full size). Off: the raw reference text stays. Display-only — the message text and model-side analysis are unchanged.",
				"field.interceptImageSend": "Rewrite image sends into describe-image references",
				"field.interceptImageSend.hint": "On (default): image-bearing sends to text-only models are rewritten into describe-image references at submit; models that accept image input are detected automatically and receive the raw images natively. Off: sends pass through untouched, handing the raw image blocks to other vision plugins.",
				"probe.fetchModels": "Fetch models",
				"probe.connectivity": "Test connectivity",
				"probe.running": "Testing…",
				"probe.hint": "Requests the endpoint and key currently filled in (works before saving): a model listing proves the endpoint is reachable and the key authenticates, and fills the model dropdown.",
				"probe.testHint": "Sends one minimal completion call (max_tokens 1) with the current model to measure that model's own round-trip latency; spends a single output token.",
				"probe.fetched": "Fetched {count} models",
				"probe.success": "OK: {ms} ms",
				"probe.error": "Failed: {error}",
				"preview.expand": "Click to view full size",
				"preview.close": "Close full image",
				"native.title": "Native image requests",
				"native.loading": "Loading…",
				"native.enable": "Enable",
				"native.disable": "Disable",
				"native.busy": "Saving…",
				"native.enabled": "Native image input is enabled for the default model \"{model}\"; sent images reach the model directly and describe_image is hidden from its toolset.",
				"native.disabled": "Native image input is disabled for the default model \"{model}\"; sent images are rewritten into describe-image references.",
				"native.unknownModel": "No default model selection is available.",
				"native.unsupported": "This host does not expose the llm-deepseek settings namespace; configuration is unavailable here.",
				"native.failed": "Write failed: {error}"
			}
		};
		/** Current UI language, mirrored from the shell (defaults to zh). */
		let currentLanguage = "zh";
		/** Switch the client copy language. */
		function setLanguage(language) {
			currentLanguage = language;
		}
		/** Format a `{name}` template with values. */
		function format(template, params) {
			return template.replace(/\{([a-zA-Z0-9]+)\}/g, (match, name) => name in params ? String(params[name]) : match);
		}
		/** Translate one key; falls back to the zh dictionary for unknown keys. */
		function t(key, params) {
			const template = (dictionaries[currentLanguage] ?? zh)[key] ?? zh[key];
			return params === void 0 ? template : format(template, params);
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-tool-describe-image/src/client/preview.module.css.mjs
		const css$2 = ".mOs4Ya_preview{margin:4px 0;display:block}.mOs4Ya_thumbButton{cursor:zoom-in;background:0 0;border:0;margin:0;padding:0;display:block}.mOs4Ya_thumbButton:focus-visible{outline-offset:2px;border-radius:8px;outline:2px solid highlight}.mOs4Ya_thumb{object-fit:contain;background:0 0;border:1px solid #7f7f7f59;border-radius:8px;max-width:320px;max-height:200px;display:block}.mOs4Ya_lightbox{z-index:9999;cursor:zoom-out;background:#000000b8;outline:none;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.mOs4Ya_lightbox img{object-fit:contain;border-radius:8px;max-width:92vw;max-height:92vh}";
		const tagId$2 = "@linxin666/dsh-tool-describe-image/preview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-tool-describe-image";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var preview_module_css_default = {
			"lightbox": "mOs4Ya_lightbox",
			"preview": "mOs4Ya_preview",
			"thumb": "mOs4Ya_thumb",
			"thumbButton": "mOs4Ya_thumbButton"
		};
		//#endregion
		//#region src/client/preview.ts
		/**
		* Conversation image preview enhancer. The web shell renders user messages
		* as plain text (no markdown pipeline), so the describe-image reference the
		* send hook splices (`![图片](/describe-image/raw/sha256:…)`) sits in the
		* transcript as raw text. This module watches the chat transcript — the
		* official `conversation.session` slot wrapper, which excludes the composer —
		* and upgrades each reference in place into an inline thumbnail (a real
		* button: Enter/Space opens a full-size overlay, focus returns on close).
		* The message text itself is never edited — the original markdown is
		* restored when the toggle turns off or the plugin unloads — so the session
		* log and the model side are untouched.
		*
		* Scanning is scoped and incremental: a lightweight observer on the document
		* only (re)discovers the transcript container, while the content observer on
		* the container processes just the nodes each mutation record carries — no
		* full-page walks during streaming or sidebar churn. If the raw route is
		* unreachable through the current origin (for example a proxy that does not
		* forward it), the thumbnail load fails, the failure is remembered for the
		* session, and the reference text is left alone from there on.
		* @module @linxin666/dsh-tool-describe-image/client/preview
		*/
		/** Matches one describe-image reference inside message text (global flag for repeated matches). */
		const REFERENCE_PATTERN = /!\[([^\]]*)]\((\/describe-image\/raw\/[^)\s]+)\)/g;
		/** The official slot wrapper owning the chat transcript; the composer lives outside it. */
		const CONVERSATION_ROOT_SELECTOR = "[data-slot=\"conversation.session\"]";
		/** Attribute marking an injected preview; its value is the original markdown source. */
		const PREVIEW_ATTR = "data-dsh-di-preview";
		/** Attribute marking the full-size overlay. */
		const LIGHTBOX_ATTR = "data-dsh-di-lightbox";
		/** Session-level bound on remembered unreachable raw paths. */
		const MAX_FAILED_PATHS = 200;
		/**
		* Locate every describe-image reference in one text chunk. Pure string math
		* (exported for tests); the DOM side walks text nodes and applies it.
		* @param text - raw message text.
		* @returns the references in source order.
		*/
		function findImageReferences(text) {
			const matches = [];
			REFERENCE_PATTERN.lastIndex = 0;
			for (let match = REFERENCE_PATTERN.exec(text); match !== null; match = REFERENCE_PATTERN.exec(text)) matches.push({
				alt: match[1] ?? "",
				path: match[2] ?? "",
				start: match.index,
				end: match.index + match[0].length
			});
			return matches;
		}
		/**
		* Install the enhancer. With `root` omitted the transcript container is
		* resolved through the official slot attribute and re-resolved whenever the
		* shell remounts it (session switch); a fixed `root` (tests) skips that
		* watch. Content passes are record-driven and idempotent — processed
		* references are elements, never text nodes, so a re-scan finds nothing new.
		* @param isEnabled - read per pass so settings edits apply without a reload.
		* @param root - fixed subtree to watch (defaults to the transcript container).
		* @returns the handle; {@link ConversationImagePreview.dispose} restores the DOM.
		*/
		function installConversationImagePreview(isEnabled, root) {
			/** Raw paths whose thumbnail load failed this session. */
			const failedPaths = /* @__PURE__ */ new Set();
			let lightboxCleanup;
			let contentObserver;
			let mountObserver;
			let observedRoot;
			let disposed = false;
			let scheduled = false;
			/** Whether the text node sits inside an editable surface, raw-text island, or our own UI. */
			const isExcluded = (node) => {
				const parent = node.parentElement;
				if (parent === null) return true;
				return parent.closest(`input, textarea, script, style, [contenteditable], [${PREVIEW_ATTR}]`) !== null;
			};
			/** Remember one unreachable raw path, evicting the oldest beyond the bound. */
			const rememberFailure = (path) => {
				if (failedPaths.size >= MAX_FAILED_PATHS) {
					const oldest = failedPaths.values().next();
					if (oldest.done !== true) failedPaths.delete(oldest.value);
				}
				failedPaths.add(path);
			};
			/** Restore one injected preview to its original markdown text. */
			const restorePreview = (preview) => {
				const source = preview.getAttribute(PREVIEW_ATTR);
				if (source === null) return;
				preview.replaceWith(document.createTextNode(source));
			};
			/** The subtree every scan and restore is confined to. */
			const scope = () => root ?? observedRoot;
			/** Restore every preview inside the scope (toggle off / dispose). */
			const restoreAll = () => {
				const within = scope();
				if (within === void 0) return;
				for (const preview of within.querySelectorAll(`[${PREVIEW_ATTR}]`)) restorePreview(preview);
			};
			/** Close the full-size overlay when one stands. */
			const closeLightbox = () => {
				lightboxCleanup?.();
				lightboxCleanup = void 0;
			};
			/** Open the full-size overlay; focus moves in and returns to the trigger on close. */
			const openLightbox = (src, alt, trigger) => {
				closeLightbox();
				const overlay = document.createElement("div");
				overlay.className = preview_module_css_default.lightbox ?? "";
				overlay.setAttribute(LIGHTBOX_ATTR, "");
				overlay.setAttribute("role", "dialog");
				overlay.setAttribute("aria-modal", "true");
				overlay.setAttribute("aria-label", t("preview.close"));
				overlay.tabIndex = -1;
				const image = document.createElement("img");
				image.src = src;
				image.alt = alt;
				overlay.append(image);
				overlay.addEventListener("click", closeLightbox);
				const onKeydown = (event) => {
					if (event.key === "Escape") closeLightbox();
				};
				overlay.addEventListener("keydown", onKeydown);
				lightboxCleanup = () => {
					overlay.remove();
					if (trigger.isConnected) trigger.focus({ preventScroll: true });
				};
				document.body.append(overlay);
				overlay.focus();
			};
			/** Build one inline, keyboard-operable thumbnail for one located reference. */
			const buildPreview = (match, source) => {
				const preview = document.createElement("span");
				preview.className = preview_module_css_default.preview ?? "";
				preview.setAttribute(PREVIEW_ATTR, source);
				const button = document.createElement("button");
				button.type = "button";
				button.className = preview_module_css_default.thumbButton ?? "";
				button.title = t("preview.expand");
				button.setAttribute("aria-label", t("preview.expand"));
				const image = document.createElement("img");
				image.className = preview_module_css_default.thumb ?? "";
				image.src = window.location.origin + match.path;
				image.alt = match.alt;
				image.addEventListener("error", () => {
					rememberFailure(match.path);
					restorePreview(preview);
				}, { once: true });
				button.addEventListener("click", () => openLightbox(image.src, match.alt, button));
				button.append(image);
				preview.append(button);
				return preview;
			};
			/** Upgrade every reference inside one text node, keeping the surrounding text. */
			const enhanceNode = (node) => {
				const matches = findImageReferences(node.data).filter((match) => !failedPaths.has(match.path));
				if (matches.length === 0) return;
				const text = node.data;
				const fragment = document.createDocumentFragment();
				let cursor = 0;
				for (const match of matches) {
					fragment.append(document.createTextNode(text.slice(cursor, match.start)));
					fragment.append(buildPreview(match, text.slice(match.start, match.end)));
					cursor = match.end;
				}
				fragment.append(document.createTextNode(text.slice(cursor)));
				node.replaceWith(fragment);
			};
			/** Upgrade the references inside one added or changed node (text node or subtree). */
			const scanNode = (node) => {
				if (node.nodeType === Node.TEXT_NODE) {
					const text = node;
					if (text.data.includes("/describe-image/raw/") && !isExcluded(text)) enhanceNode(text);
					return;
				}
				if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
				const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: (candidate) => {
					const text = candidate;
					if (!text.data.includes("/describe-image/raw/")) return NodeFilter.FILTER_REJECT;
					return isExcluded(text) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
				} });
				const targets = [];
				while (walker.nextNode()) targets.push(walker.currentNode);
				for (const target of targets) enhanceNode(target);
			};
			/** One full upgrade pass over the scope (initial attach, toggle on). */
			const enhanceAll = () => {
				const within = scope();
				if (within !== void 0) scanNode(within);
			};
			/** Content observer: process only the nodes each mutation record carries. */
			const onContentRecords = (records) => {
				if (disposed || !isEnabled()) return;
				for (const record of records) if (record.type === "characterData") scanNode(record.target);
				else for (const node of record.addedNodes) scanNode(node);
			};
			/** (Re)attach the content observer to the live transcript container. */
			const attach = () => {
				const next = root ?? document.querySelector(CONVERSATION_ROOT_SELECTOR) ?? void 0;
				if (next === observedRoot) return;
				contentObserver?.disconnect();
				observedRoot = next;
				if (observedRoot !== void 0) {
					contentObserver = new MutationObserver(onContentRecords);
					contentObserver.observe(observedRoot, {
						childList: true,
						subtree: true,
						characterData: true
					});
					if (isEnabled()) enhanceAll();
				}
			};
			/** Collapse a mutation burst into one container re-resolution per microtask. */
			const schedule = () => {
				if (scheduled || disposed) return;
				scheduled = true;
				queueMicrotask(() => {
					scheduled = false;
					if (!disposed) attach();
				});
			};
			/** Apply the current toggle state once. */
			const apply = () => {
				if (disposed) return;
				if (isEnabled()) {
					attach();
					enhanceAll();
				} else restoreAll();
			};
			if (root === void 0) {
				mountObserver = new MutationObserver(schedule);
				mountObserver.observe(document.body, {
					childList: true,
					subtree: true
				});
			}
			attach();
			return {
				refresh: apply,
				dispose: () => {
					disposed = true;
					mountObserver?.disconnect();
					contentObserver?.disconnect();
					restoreAll();
					closeLightbox();
				}
			};
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-tool-describe-image/src/client/settings-card.module.css.mjs
		const css$1 = ".rUBhvW_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.rUBhvW_card:hover{border-color:var(--dsw-alias-label-dimmed)}.rUBhvW_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.rUBhvW_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.rUBhvW_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.rUBhvW_headerStatic{border-radius:12px;align-items:center;gap:12px;width:100%;padding:14px 16px;display:flex}.rUBhvW_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.rUBhvW_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.rUBhvW_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.rUBhvW_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.rUBhvW_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.rUBhvW_chevronOpen{transform:rotate(180deg)}.rUBhvW_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.rUBhvW_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}.rUBhvW_notExposed{color:var(--dsw-alias-state-warn-primary);margin:12px 0 0;font-size:12px;line-height:1.5}.rUBhvW_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.rUBhvW_failed{min-width:0;color:var(--dsw-alias-label-error);text-overflow:ellipsis;white-space:nowrap;flex:1;margin:0;font-size:12px;line-height:1.5;overflow:hidden}.rUBhvW_discard,.rUBhvW_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.rUBhvW_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.rUBhvW_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.rUBhvW_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.rUBhvW_discard:disabled,.rUBhvW_save:disabled{opacity:.4;cursor:default}.rUBhvW_discard:focus-visible,.rUBhvW_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.rUBhvW_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.rUBhvW_field+.rUBhvW_field{border-top:1px solid var(--dsw-alias-border-l2)}.rUBhvW_head{align-items:center;gap:8px;display:flex}.rUBhvW_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.rUBhvW_badges{align-items:center;gap:8px;display:inline-flex}.rUBhvW_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.rUBhvW_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.rUBhvW_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.rUBhvW_reset:disabled{cursor:default}.rUBhvW_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.rUBhvW_input,.rUBhvW_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.rUBhvW_input:focus-visible,.rUBhvW_select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.rUBhvW_input:disabled,.rUBhvW_select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.rUBhvW_inputInvalid{border:1px solid var(--dsw-alias-label-error);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.rUBhvW_inputInvalid:focus-visible{outline:2px solid var(--dsw-alias-label-error);outline-offset:1px;border-color:var(--dsw-alias-label-error)}.rUBhvW_selectWrap{position:relative}.rUBhvW_selectButton{appearance:none;text-align:left;cursor:pointer;justify-content:space-between;align-items:center;gap:8px;width:100%;display:flex}.rUBhvW_selectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.rUBhvW_selectChevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.rUBhvW_selectChevronOpen{transform:rotate(180deg)}.rUBhvW_selectPopup{z-index:40;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);max-height:240px;box-shadow:0 8px 24px var(--dsw-alias-bg-mask-2);opacity:0;border-radius:8px;flex-direction:column;padding:4px;transition:opacity .1s,transform .1s;display:flex;position:absolute;top:calc(100% + 4px);left:0;right:0;overflow-y:auto;transform:translateY(-4px)}.rUBhvW_selectPopupOpen{opacity:1;transform:none}.rUBhvW_selectPopupClose{opacity:0;pointer-events:none;transform:translateY(-4px)}.rUBhvW_selectOption{color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;text-overflow:ellipsis;border-radius:6px;flex-shrink:0;padding:6px 10px;font-size:13px;line-height:1.5;overflow:hidden}.rUBhvW_selectOption:hover,.rUBhvW_selectOptionActive{background:var(--dsw-alias-interactive-bg-hover)}.rUBhvW_selectOptionSelected{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 10%, transparent);font-weight:500}.rUBhvW_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.rUBhvW_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}@media (prefers-reduced-motion:reduce){.rUBhvW_card,.rUBhvW_header,.rUBhvW_chevron,.rUBhvW_chevronOpen,.rUBhvW_discard,.rUBhvW_save,.rUBhvW_selectChevron,.rUBhvW_selectChevronOpen,.rUBhvW_selectPopup{transition:none}}";
		const tagId$1 = "@linxin666/dsh-tool-describe-image/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-tool-describe-image";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"badge": "rUBhvW_badge",
			"badges": "rUBhvW_badges",
			"body": "rUBhvW_body",
			"card": "rUBhvW_card",
			"cardOpen": "rUBhvW_cardOpen",
			"chevron": "rUBhvW_chevron",
			"chevronOpen": "rUBhvW_chevronOpen",
			"description": "rUBhvW_description",
			"discard": "rUBhvW_discard",
			"failed": "rUBhvW_failed",
			"field": "rUBhvW_field",
			"footer": "rUBhvW_footer",
			"head": "rUBhvW_head",
			"headText": "rUBhvW_headText",
			"header": "rUBhvW_header",
			"headerStatic": "rUBhvW_headerStatic",
			"hint": "rUBhvW_hint",
			"input": "rUBhvW_input",
			"inputInvalid": "rUBhvW_inputInvalid",
			"invalid": "rUBhvW_invalid",
			"label": "rUBhvW_label",
			"name": "rUBhvW_name",
			"notExposed": "rUBhvW_notExposed",
			"pending": "rUBhvW_pending",
			"readOnly": "rUBhvW_readOnly",
			"reset": "rUBhvW_reset",
			"save": "rUBhvW_save",
			"select": "rUBhvW_select",
			"selectButton": "rUBhvW_selectButton",
			"selectChevron": "rUBhvW_selectChevron",
			"selectChevronOpen": "rUBhvW_selectChevronOpen",
			"selectLabel": "rUBhvW_selectLabel",
			"selectOption": "rUBhvW_selectOption",
			"selectOptionActive": "rUBhvW_selectOptionActive",
			"selectOptionSelected": "rUBhvW_selectOptionSelected",
			"selectPopup": "rUBhvW_selectPopup",
			"selectPopupClose": "rUBhvW_selectPopupClose",
			"selectPopupOpen": "rUBhvW_selectPopupOpen",
			"selectWrap": "rUBhvW_selectWrap"
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
		/** A staged enumerated field rendered as a select. */
		function ChoiceField(props) {
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
						options: [{
							value: "",
							label: props.inheritLabel
						}, ...props.choices],
						value: props.text,
						disabled: props.disabled,
						invalid: props.invalid,
						onEdit: props.onEdit
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: props.invalid ? settings_card_module_css_default.invalid : settings_card_module_css_default.hint,
						children: props.invalid ? props.invalidLabel : props.hint
					})
				]
			});
		}
		//#endregion
		//#region src/client/settings-form.ts
		/** A whole- or decimal-number field. An empty draft clears the field; any other draft that is not a finite number within the constraints blocks the save. */
		function numberField(field, constraints = {}) {
			const { integer = false, min } = constraints;
			return {
				field,
				format: (value) => typeof value === "number" ? String(value) : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					const parsed = Number(trimmed);
					if (!Number.isFinite(parsed)) return void 0;
					if (integer && !Number.isInteger(parsed)) return void 0;
					if (min !== void 0 && parsed < min) return void 0;
					return {
						kind: "set",
						value: parsed
					};
				}
			};
		}
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
		/**
		* A free-text field the Host treats as a secret and redacts from the read-back
		* (role('secret') in the section schema). The card still edits it like text,
		* but a save never compares the redacted value back and relies on the scope
		* reporting the write landed.
		*/
		function secretField(field) {
			return {
				...textField(field),
				secret: true
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
		/** An enumerated string field; only the listed choices are accepted. An empty draft clears the field. */
		function choiceField(field, choices) {
			return {
				field,
				format: (value) => typeof value === "string" && choices.includes(value) ? value : "",
				parse: (text) => {
					if (text === "") return { kind: "clear" };
					return choices.includes(text) ? {
						kind: "set",
						value: text
					} : void 0;
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
		//#region src/client/model-probe.ts
		/**
		* Browser half of the model probe: the settings card's connectivity check.
		* Posts the card's unsaved connection drafts to the host /describe-image/models
		* route; the host resolves the key through the credential seam (the key never
		* crosses into the browser), lists the endpoint's models, and returns only the
		* id list — a success doubles as the connectivity and credential check.
		* @module @linxin666/dsh-tool-describe-image/client/model-probe
		*/
		/** The host model-probe endpoint, same-origin with the web shell. */
		const MODELS_ENDPOINT = "/describe-image/models";
		/** The host model-test endpoint: one minimal completion ping of the selected model. */
		const MODEL_TEST_ENDPOINT = "/describe-image/models/test";
		/**
		* Ask the host to list the configured endpoint's models. The drafts ride the
		* body so an unsaved endpoint can be verified before saving; the host owns
		* validation, key resolution, and the upstream call.
		* @param draft - the card's current connection drafts.
		* @returns the served model ids, or a structured rejection.
		*/
		async function fetchEndpointModels(draft) {
			let response;
			try {
				response = await fetch(MODELS_ENDPOINT, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(draft)
				});
			} catch {
				return {
					ok: false,
					message: "network-failed"
				};
			}
			let envelope;
			try {
				envelope = await response.json();
			} catch {
				return {
					ok: false,
					message: "bad-response"
				};
			}
			const record = envelope;
			if (typeof record !== "object" || record === null) return {
				ok: false,
				message: "bad-response"
			};
			if (record.ok === true && typeof record.value === "object" && record.value !== null) {
				const value = record.value;
				if (Array.isArray(value.models) && value.models.every((id) => typeof id === "string")) return {
					ok: true,
					models: value.models
				};
				return {
					ok: false,
					message: "bad-response"
				};
			}
			const message = record.error?.message;
			return {
				ok: false,
				message: typeof message === "string" && message !== "" ? message : "server-failed"
			};
		}
		/**
		* Ping the selected model through the host test route: one minimal
		* completion call (`max_tokens` 1) whose round-trip latency is the model's
		* own first-response time — not the models listing's. The host owns key
		* resolution and the upstream call; the browser receives only the latency.
		* @param draft - the card's connection drafts plus the selected model id.
		* @returns the round-trip milliseconds, or a structured rejection.
		*/
		async function testEndpointModel(draft) {
			let response;
			try {
				response = await fetch(MODEL_TEST_ENDPOINT, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(draft)
				});
			} catch {
				return {
					ok: false,
					message: "network-failed"
				};
			}
			let envelope;
			try {
				envelope = await response.json();
			} catch {
				return {
					ok: false,
					message: "bad-response"
				};
			}
			const record = envelope;
			if (typeof record !== "object" || record === null) return {
				ok: false,
				message: "bad-response"
			};
			if (record.ok === true && typeof record.value === "object" && record.value !== null) {
				const value = record.value;
				if (typeof value.latencyMs === "number" && Number.isFinite(value.latencyMs) && value.latencyMs >= 0) return {
					ok: true,
					latencyMs: value.latencyMs
				};
				return {
					ok: false,
					message: "bad-response"
				};
			}
			const message = record.error?.message;
			return {
				ok: false,
				message: typeof message === "string" && message !== "" ? message : "server-failed"
			};
		}
		//#endregion
		//#region src/client/native-images.ts
		/**
		* Browser half of the native-image configuration seam (rc.8 feature): reads
		* the current agent-default route's image-input state from the host route
		* and toggles the DeepSeek adapter catalog entry. Every failure answers a
		* conservative envelope — the section renders an unsupported hint instead of
		* throwing, and a failed toggle never pretends the state changed.
		* @module @linxin666/dsh-tool-describe-image/client/native-images
		*/
		/** The host native-image endpoint, same-origin with the web shell. */
		const NATIVE_IMAGES_ENDPOINT = "/describe-image/native-images";
		/** Default fetch timeouts: reads are quick, writes ride the settings seam. */
		const DEFAULT_NATIVE_STATE_TIMEOUT_MS = 4e3;
		const DEFAULT_NATIVE_TOGGLE_TIMEOUT_MS = 8e3;
		async function fetchWithTimeout(url, init, timeoutMs) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);
			try {
				return await fetch(url, {
					...init,
					signal: controller.signal
				});
			} finally {
				clearTimeout(timer);
			}
		}
		/** Read the current native-image state; null when the host route is unreachable. */
		async function fetchNativeImageState(timeoutMs = DEFAULT_NATIVE_STATE_TIMEOUT_MS) {
			try {
				const envelope = await (await fetchWithTimeout(NATIVE_IMAGES_ENDPOINT, {}, timeoutMs)).json();
				if (envelope === null || typeof envelope !== "object" || envelope.ok !== true) return null;
				return envelope.value;
			} catch {
				return null;
			}
		}
		/** Toggle native image input; the envelope carries the refreshed state or the refusal. */
		async function setNativeImageEnabled(enabled, timeoutMs = DEFAULT_NATIVE_TOGGLE_TIMEOUT_MS) {
			try {
				const envelope = await (await fetchWithTimeout(NATIVE_IMAGES_ENDPOINT, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ enabled })
				}, timeoutMs)).json();
				if (envelope === null || typeof envelope !== "object") return {
					ok: false,
					message: "bad envelope"
				};
				if (envelope.ok === true) return {
					ok: true,
					value: envelope.value
				};
				return {
					ok: false,
					message: typeof envelope.message === "string" ? envelope.message : "request rejected"
				};
			} catch {
				return {
					ok: false,
					message: "request failed"
				};
			}
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-tool-describe-image/src/client/probe.module.css.mjs
		const css = ".AI4OQW_probeInline{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.AI4OQW_probeInline:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.AI4OQW_probeInline:disabled{opacity:.4;cursor:default}.AI4OQW_probeInline:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.AI4OQW_probeRunning{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:1.5}.AI4OQW_probeError{color:var(--dsw-alias-label-error);overflow-wrap:anywhere;margin:0;font-size:12px;line-height:1.5}.AI4OQW_probeOk{color:var(--dsw-alias-brand-primary);margin:0;font-size:12px;line-height:1.5}";
		const tagId = "@linxin666/dsh-tool-describe-image/probe.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-tool-describe-image";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var probe_module_css_default = {
			"probeError": "AI4OQW_probeError",
			"probeInline": "AI4OQW_probeInline",
			"probeOk": "AI4OQW_probeOk",
			"probeRunning": "AI4OQW_probeRunning"
		};
		//#endregion
		//#region src/client/NativeImageSection.tsx
		/**
		* Native-image section of the describe-image card (rc.8 feature): reports
		* the current agent-default route's image-input state and toggles the
		* DeepSeek adapter catalog entry through the loopback host route. The
		* section is self-contained (its own fetch state) — it never rides the card
		* form, so a toggle settles immediately while the rest of the card keeps its
		* staged drafts. Unsupported hosts and failed writes render a hint; nothing
		* here throws.
		* @module @linxin666/dsh-tool-describe-image/client/NativeImageSection
		*/
		/**
		* Render the native-image request section.
		* @returns the section block.
		*/
		function NativeImageSection() {
			const [phase, setPhase] = (0, react.useState)("loading");
			const [state, setState] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			const refresh = (0, react.useCallback)(() => {
				setPhase("loading");
				setError(void 0);
				fetchNativeImageState().then((value) => {
					setState(value);
					setPhase(value === null ? "failed" : "ready");
				});
			}, []);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const toggle = (0, react.useCallback)(() => {
				if (busy || state === null) return;
				setBusy(true);
				setError(void 0);
				setNativeImageEnabled(!state.capability.acceptsImages).then((result) => {
					setBusy(false);
					if (result.ok && result.value !== void 0) {
						setState(result.value);
						setPhase("ready");
						return;
					}
					setError(result.message ?? "failed");
				});
			}, [busy, state]);
			const enabled = state?.capability.acceptsImages === true;
			const canToggle = phase === "ready" && state !== null && state.supported && state.model !== void 0 && !busy;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: "settings-describe-image-native-images",
							children: t("native.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							id: "settings-describe-image-native-images",
							className: probe_module_css_default.probeInline,
							disabled: !canToggle,
							onClick: toggle,
							children: busy ? t("native.busy") : enabled ? t("native.disable") : t("native.enable")
						})]
					}),
					phase === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: t("native.loading")
					}) : null,
					phase === "ready" && state !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: state.model === void 0 ? t("native.unknownModel") : state.supported ? enabled ? t("native.enabled", { model: state.model }) : t("native.disabled", { model: state.model }) : t("native.unsupported")
					}) : null,
					phase === "failed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: t("native.unsupported")
					}) : null,
					error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: probe_module_css_default.probeError,
						role: "status",
						children: t("native.failed", { error })
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/DescribeImageSettingsCard.tsx
		/** Bridges the `describe-image` scope onto the card's staged form. */
		var DescribeImageSettingsCardController = class {
			form;
			store;
			probeState = {
				status: "idle",
				models: []
			};
			disposed = false;
			/** @param scope - the bound settings scope for the `describe-image` namespace. */
			constructor(scope) {
				this.form = new CardForm(scope, [
					textField("baseURL"),
					textField("model"),
					choiceField("apiStyle", [
						"chat-completions",
						"responses",
						"anthropic-messages"
					]),
					secretField("apiKey"),
					textField("apiKeyEnv"),
					textField("defaultPrompt"),
					numberField("maxBytes"),
					numberField("maxOutputTokens"),
					numberField("timeoutMs"),
					booleanField("renderImagePreview"),
					booleanField("interceptImageSend")
				]);
				this.store = this.form.bind(() => this.projection());
			}
			/**
			* List the endpoint named by the card's current drafts. Drafts ride the
			* request so an unsaved endpoint can be verified before saving; the key
			* never crosses into the browser. A failed listing drops any stale list.
			*/
			fetchModels() {
				if (this.disposed || this.probeState.status === "running") return;
				const draft = {
					baseURL: this.form.field("baseURL").text,
					apiStyle: this.form.field("apiStyle").text,
					apiKey: this.form.field("apiKey").text
				};
				this.probeState = {
					...this.probeState,
					status: "running",
					pending: "fetch",
					error: void 0
				};
				this.publish();
				fetchEndpointModels(draft).then((result) => {
					if (this.disposed) return;
					this.probeState = result.ok ? {
						status: "idle",
						pending: "fetch",
						models: result.models
					} : {
						status: "idle",
						pending: "fetch",
						models: [],
						error: result.message
					};
					this.publish();
				});
			}
			/**
			* Ping the selected model once: one minimal completion call whose
			* round-trip latency is the model's own first-response time. Hidden until
			* the model field carries a value; the listing stays while it runs.
			*/
			testModel() {
				if (this.disposed || this.probeState.status === "running") return;
				const model = this.form.field("model").text;
				if (model.trim() === "") return;
				const draft = {
					baseURL: this.form.field("baseURL").text,
					apiStyle: this.form.field("apiStyle").text,
					apiKey: this.form.field("apiKey").text,
					model
				};
				this.probeState = {
					...this.probeState,
					status: "running",
					pending: "test",
					latencyMs: void 0,
					error: void 0
				};
				this.publish();
				testEndpointModel(draft).then((result) => {
					if (this.disposed) return;
					this.probeState = result.ok ? {
						...this.probeState,
						status: "idle",
						pending: "test",
						latencyMs: result.latencyMs
					} : {
						...this.probeState,
						status: "idle",
						pending: "test",
						error: result.message
					};
					this.publish();
				});
			}
			/** Re-emit the projection; a probe settling publishes outside scope changes. */
			publish() {
				this.store.set(this.projection());
			}
			projection() {
				return {
					...this.form.shell(),
					baseURL: this.form.field("baseURL"),
					model: this.form.field("model"),
					apiStyle: this.form.field("apiStyle"),
					apiKey: this.form.field("apiKey"),
					apiKeyEnv: this.form.field("apiKeyEnv"),
					defaultPrompt: this.form.field("defaultPrompt"),
					maxBytes: this.form.field("maxBytes"),
					maxOutputTokens: this.form.field("maxOutputTokens"),
					timeoutMs: this.form.field("timeoutMs"),
					renderImagePreview: this.form.field("renderImagePreview"),
					interceptImageSend: this.form.field("interceptImageSend"),
					probe: this.probeState
				};
			}
			/**
			* Build the face the card's slot registration injects.
			* @returns the card's snapshot and its form actions.
			*/
			inject() {
				return {
					hooks: { describeImageSettingsCard: this.store },
					...this.form.actions(),
					fetchModels: () => {
						this.fetchModels();
					},
					testModel: () => {
						this.testModel();
					}
				};
			}
			/**
			* Release the card's scope subscription and bound stores; the slot
			* disposer calls this on teardown. A request still in flight settles into
			* nothing once disposed.
			*/
			dispose() {
				this.disposed = true;
				this.form.dispose();
			}
		};
		/**
		* Render the describe-image card.
		* @param props - the card snapshot and its form actions.
		* @returns the card.
		*/
		function DescribeImageSettingsCard(props) {
			const state = props.useDescribeImageSettingsCard((snapshot) => snapshot);
			const disabled = !state.writable;
			const fieldProps = {
				overriddenLabel: t("settings.overridden"),
				resetLabel: t("settings.reset"),
				invalidLabel: t("settings.invalidNumber"),
				disabled
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PluginSettingsCard, {
				t,
				titleKey: "card.title",
				descriptionKey: "card.description",
				defaultOpen: false,
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-describe-image-baseurl",
						label: t("field.baseURL"),
						hint: t("field.baseURL.hint"),
						placeholder: "https://api.example.com/v1",
						...fieldProps,
						...state.baseURL,
						onEdit: (text) => {
							props.edit("baseURL", text);
						},
						onReset: () => {
							props.resetField("baseURL");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.field,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.head,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: settings_card_module_css_default.label,
									htmlFor: "settings-describe-image-model",
									children: t("field.model")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: settings_card_module_css_default.badges,
									children: [
										state.model.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: settings_card_module_css_default.badge,
											children: t("settings.overridden")
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: probe_module_css_default.probeInline,
											title: t("probe.hint"),
											disabled: disabled || state.probe.status === "running",
											onClick: props.fetchModels,
											children: t(state.probe.status === "running" && state.probe.pending === "fetch" ? "probe.running" : "probe.fetchModels")
										}),
										state.model.text.trim() !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: probe_module_css_default.probeInline,
											title: t("probe.testHint"),
											disabled: disabled || state.probe.status === "running",
											onClick: props.testModel,
											children: t(state.probe.status === "running" && state.probe.pending === "test" ? "probe.running" : "probe.connectivity")
										}) : null
									]
								})]
							}),
							state.probe.models.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								id: "settings-describe-image-model",
								className: settings_card_module_css_default.select,
								value: state.model.text,
								disabled,
								onChange: (event) => {
									props.edit("model", event.target.value);
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t("settings.inherit")
									}),
									state.model.text !== "" && !state.probe.models.includes(state.model.text) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: state.model.text,
										children: state.model.text
									}) : null,
									state.probe.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: model,
										children: model
									}, model))
								]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: "settings-describe-image-model",
								className: state.model.invalid ? settings_card_module_css_default.inputInvalid : settings_card_module_css_default.input,
								type: "text",
								...state.model.invalid ? { "aria-invalid": true } : {},
								value: state.model.text,
								placeholder: "",
								disabled,
								onChange: (event) => {
									props.edit("model", event.target.value);
								}
							}),
							state.probe.status === "running" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: probe_module_css_default.probeRunning,
								role: "status",
								children: t("probe.running")
							}) : null,
							state.probe.status === "idle" && state.probe.error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: probe_module_css_default.probeError,
								role: "status",
								children: t("probe.error", { error: state.probe.error })
							}) : null,
							state.probe.status === "idle" && state.probe.error === void 0 && state.probe.pending === "test" && state.probe.latencyMs !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: probe_module_css_default.probeOk,
								role: "status",
								children: t("probe.success", { ms: String(state.probe.latencyMs) })
							}) : null,
							state.probe.status === "idle" && state.probe.error === void 0 && state.probe.pending === "fetch" && state.probe.models.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: probe_module_css_default.probeOk,
								role: "status",
								children: t("probe.fetched", { count: String(state.probe.models.length) })
							}) : null,
							state.probe.status === "idle" && state.probe.error === void 0 && state.probe.models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: state.model.invalid ? settings_card_module_css_default.invalid : settings_card_module_css_default.hint,
								children: state.model.invalid ? t("settings.invalidNumber") : t("field.model.hint")
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
						id: "settings-describe-image-apistyle",
						label: t("field.apiStyle"),
						hint: t("field.apiStyle.hint"),
						inheritLabel: t("settings.inherit"),
						choices: [
							{
								value: "chat-completions",
								label: t("field.apiStyle.chatCompletions")
							},
							{
								value: "responses",
								label: t("field.apiStyle.responses")
							},
							{
								value: "anthropic-messages",
								label: t("field.apiStyle.anthropicMessages")
							}
						],
						...fieldProps,
						...state.apiStyle,
						onEdit: (text) => {
							props.edit("apiStyle", text);
						},
						onReset: () => {
							props.resetField("apiStyle");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-describe-image-apikey",
						label: t("field.apiKey"),
						hint: t("field.apiKey.hint"),
						...fieldProps,
						...state.apiKey,
						onEdit: (text) => {
							props.edit("apiKey", text);
						},
						onReset: () => {
							props.resetField("apiKey");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-describe-image-apikeyenv",
						label: t("field.apiKeyEnv"),
						hint: t("field.apiKeyEnv.hint"),
						...fieldProps,
						...state.apiKeyEnv,
						onEdit: (text) => {
							props.edit("apiKeyEnv", text);
						},
						onReset: () => {
							props.resetField("apiKeyEnv");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-describe-image-defaultprompt",
						label: t("field.defaultPrompt"),
						hint: t("field.defaultPrompt.hint"),
						...fieldProps,
						...state.defaultPrompt,
						onEdit: (text) => {
							props.edit("defaultPrompt", text);
						},
						onReset: () => {
							props.resetField("defaultPrompt");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-describe-image-maxbytes",
						label: t("field.maxBytes"),
						hint: t("field.maxBytes.hint"),
						numeric: true,
						...fieldProps,
						...state.maxBytes,
						onEdit: (text) => {
							props.edit("maxBytes", text);
						},
						onReset: () => {
							props.resetField("maxBytes");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-describe-image-maxoutputtokens",
						label: t("field.maxOutputTokens"),
						hint: t("field.maxOutputTokens.hint"),
						numeric: true,
						...fieldProps,
						...state.maxOutputTokens,
						onEdit: (text) => {
							props.edit("maxOutputTokens", text);
						},
						onReset: () => {
							props.resetField("maxOutputTokens");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
						id: "settings-describe-image-timeoutms",
						label: t("field.timeoutMs"),
						hint: t("field.timeoutMs.hint"),
						numeric: true,
						...fieldProps,
						...state.timeoutMs,
						onEdit: (text) => {
							props.edit("timeoutMs", text);
						},
						onReset: () => {
							props.resetField("timeoutMs");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-describe-image-render-preview",
						label: t("field.renderImagePreview"),
						hint: t("field.renderImagePreview.hint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.renderImagePreview,
						onEdit: (text) => {
							props.edit("renderImagePreview", text);
						},
						onReset: () => {
							props.resetField("renderImagePreview");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-describe-image-intercept-send",
						label: t("field.interceptImageSend"),
						hint: t("field.interceptImageSend.hint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.interceptImageSend,
						onEdit: (text) => {
							props.edit("interceptImageSend", text);
						},
						onReset: () => {
							props.resetField("interceptImageSend");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(NativeImageSection, {})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace of the browser half. */
		const NS = "describe-image";
		/** Required services: slots for the settings card, conversation for the send hook, settings scope and locale for the card copy. */
		const inject = [
			"slots",
			"conversation",
			"settingsScope",
			"locale"
		];
		/** Apply the browser half. */
		function apply(ctx) {
			ctx.effect(() => {
				try {
					return ctx.locale.register(NS, dictionaries);
				} catch {
					return () => {};
				}
			}, "dsh-tool-describe-image: dictionaries");
			ctx.effect(() => {
				const sync = () => {
					const lang = document.documentElement.lang;
					setLanguage(lang === "zh" || lang.startsWith("zh-") ? "zh" : "en");
				};
				sync();
				const observer = new MutationObserver(sync);
				observer.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ["lang"]
				});
				return () => observer.disconnect();
			}, "dsh-tool-describe-image: language mirror");
			ctx.inject(["slots", "conversation"], (scope) => {
				const conversation = scope.conversation;
				const slots = scope.slots;
				let settingsScopeRef;
				let unsubscribeSettings;
				installSendHook(conversation, () => settingsScopeRef?.getSnapshot().value?.interceptImageSend !== false, createImageCapabilityChecker());
				let previewRef;
				ctx.effect(() => {
					const handle = installConversationImagePreview(() => settingsScopeRef?.getSnapshot().value?.renderImagePreview !== false);
					previewRef = handle;
					return () => {
						previewRef = void 0;
						unsubscribeSettings?.();
						unsubscribeSettings = void 0;
						settingsScopeRef = void 0;
						handle.dispose();
					};
				}, "dsh-tool-describe-image: conversation image preview");
				ctx.inject(["settingsScope"], (settingsCtx) => {
					const settingsScope = (settingsCtx.get("webUiSettings") ?? settingsCtx.settingsScope).bind({ namespace: NS });
					unsubscribeSettings?.();
					settingsScopeRef = settingsScope;
					unsubscribeSettings = settingsScope.subscribe(() => previewRef?.refresh());
					const settingsCard = new DescribeImageSettingsCardController(settingsScope);
					slots.inject("web-ui.plugin.item", () => {
						try {
							const unregister = slots.register({
								name: "web-ui.plugin.item",
								id: "describe-image",
								order: 115,
								locale: NS,
								inject: () => settingsCard.inject()
							}, DescribeImageSettingsCard);
							return () => {
								settingsCard.dispose();
								unregister();
							};
						} catch {
							return () => {};
						}
					});
				});
			});
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map