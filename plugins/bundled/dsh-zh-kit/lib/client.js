/**
 * dsh-zh-kit — browser half.
 *
 * Adapted from dsh-trajectory-zh (MIT, © jun7799) and fused into dsh-zh-kit.
 * Format: classic script registering a CJS-style factory with the shell module
 * loader (same contract as every `dsh.client` bundle). Zero imports: the
 * factory never calls `require`, so `dsh.client.inject` is empty.
 *
 * What it does: observes the DOM, replaces exact-match English labels of the
 * Trajectory view with Chinese, and attaches plain-language tooltips that
 * explain what each record kind / tab actually means. A small floating toggle
 * turns the projection on/off (persisted in localStorage). Everything is a
 * browser-side projection: nothing here enters any model request.
 */
window.__ModuleLoader__.load({
	id: "dsh-zh-kit",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		// ── dictionary: exact-match (trimmed) English label → { label, tip } ──
		var DICT = {
			// trajectory record kinds (KIND_LABEL)
			"SYSTEM": { label: "系统配置", tip: "系统提示词/工具目录的初始状态或中途变更。\n会话开头那条是初始状态；中途出现说明配置变了，可点开「变更对比」看差异。" },
			"USER": { label: "用户输入", tip: "你亲手输入的消息。只有这一种是你打的字。" },
			"CONTEXT": { label: "上下文注入", tip: "不是你打的字：系统以「用户角色」塞给模型的材料。\n常见来源：工作区指令(CLAUDE.md)、技能目录、运行时快照、审批策略变更通知。\n点「来源」标签可看注入者是谁。" },
			"COMPACTED": { label: "已压缩", tip: "上下文快满时，旧历史被自动总结折叠成的「前情提要」。\n此后模型看到的是这份摘要，而非原文全文。" },
			"ASSISTANT": { label: "助手回复", tip: "模型的输出。时间条分两段：等待首字(TTFT)与逐字生成(解码)。" },
			"TOOL": { label: "工具调用", tip: "模型发起的一次工具执行。三件套：\n调用参数 = 让它干的活；执行结果 = 干完的返回；工具契约 = 它看到的使用说明。" },
			"SUBTOOL": { label: "子工具", tip: "父工具内部再触发的嵌套调用\n（如 workflow 里子 agent 的工具、子 agent 的子 agent）。" },

			// tool names shown on tool-call cards (independent text nodes; exact-match, harmless if absent)
			"read": { label: "读取", tip: "读取文件工具（read）。" },

			// detail-panel tabs
			"Summary": { label: "概览", tip: "状态、耗时、Token 用量与各分区缩略预览。" },
			"Payload": { label: "调用参数", tip: "模型调用工具时传入的完整 JSON 入参。\n核对「模型到底让工具干了什么」看这里。" },
			"Result": { label: "执行结果", tip: "工具执行完返回的完整输出。红显代表出错。" },
			"Schema": { label: "工具契约", tip: "调用那一刻模型实际看到的工具使用说明(schema)。\n注意是「当时」的版本，目录后来变了也能看到旧版。" },
			"Timing": { label: "耗时", tip: "本次操作的开始时间与耗时明细。" },
			"Preview": { label: "渲染预览", tip: "按 Markdown 渲染后的显示效果。" },
			"Raw": { label: "原始文本", tip: "未经渲染的原始 Markdown 源文本。" },
			"Source": { label: "来源", tip: "这条消息的来源元数据（谁注入的、什么形态）。" },
			"System Prompt": { label: "系统提示词", tip: "该请求的完整系统提示词。" },
			"Tools": { label: "工具目录", tip: "该请求的完整工具清单（每个工具的契约）。" },
			"Diff": { label: "变更对比", tip: "与上一次系统提示词/工具目录的差异对比。" },
			"Raw Output": { label: "原始输出", tip: "压缩请求的原始返回，未做整理。" },

			// overview fields
			"Status": { label: "状态" },
			"Duration": { label: "耗时" },
			"Tokens": { label: "Token 用量", tip: "input=读取 / output=生成 / think=推理 / cacheRead=缓存命中。" },
			"Hierarchy": { label: "层级", tip: "该记录隶属的父级：所属请求、父助手消息或父工具调用。" },

			// status values
			"Complete": { label: "已完成" },
			"Running": { label: "进行中" },
			"Error": { label: "出错" },
			"Failed": { label: "失败" },

			// token row labels (exact-match; harmless if absent)
			"Input": { label: "输入", tip: "本次请求读取的 token 数。" },
			"Output": { label: "输出", tip: "模型生成的 token 数。" },
			"Think": { label: "思考", tip: "推理(thinking)消耗的 token 数。" },
			"Cache Read": { label: "缓存命中", tip: "命中提供商缓存的输入 token——这部分计费便宜得多。" },
			"Cache Write": { label: "缓存写入", tip: "写入提供商缓存的输入 token，后续请求可复用。" },

			// empty / placeholder states
			"No payload captured": { label: "未捕获调用参数" },
			"No result captured": { label: "未捕获结果" },
			"(tool call only)": { label: "（仅工具调用）", tip: "这条助手消息没有正文，只包含工具调用。" },
			"No system prompt in this request": { label: "本次请求无系统提示词" },
			"Compacting context…": { label: "正在压缩上下文…" },
			"Context compacted": { label: "上下文已压缩" },
			"Compaction failed": { label: "压缩失败" },

			// toolbar / sections / misc
			"Trajectory": { label: "轨迹", tip: "按轮次组织的事件账本：模型每一步看到什么、做了什么、花了多少。" },
			"Between turns": { label: "轮次之间", tip: "独立于对话轮次运行的压缩请求，按时间顺序排在这里。" },
			"Request Timing": { label: "请求耗时" },
			"Assistant Message": { label: "助手消息" },
			"Tool Call": { label: "工具调用" },
			"Turns": { label: "轮次", tip: "从一条用户消息到最终答复的完整循环。可整轮折叠。" },
			"Calls": { label: "调用" },
			"Search": { label: "搜索" },
			"Actual Time": { label: "真实时间" },
			"Equal Width": { label: "等宽" },
			"Expand Turns": { label: "展开轮次" },
			"Collapse Turns": { label: "折叠轮次" },
			"Expand Calls": { label: "展开调用" },
			"Collapse Calls": { label: "折叠调用" }
		};

		var STORAGE_KEY = "dsh-zh-kit";
		var enabled = (function () {
			try { return localStorage.getItem(STORAGE_KEY) !== "0"; } catch (e) { return true; }
		})();

		var observer = null;
		var button = null;
		var styleEl = null;
		var rafPending = false;
		var booted = false;

		function isSkipped(parent) {
			if (!parent) return true;
			var tag = parent.nodeName;
			return tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT";
		}

		function translate(node) {
			var raw = node.nodeValue;
			if (!raw) return;
			var key = raw.trim();
			if (!key) return;
			var entry = DICT[key];
			if (!entry) return;
			var parent = node.parentElement;
			if (!parent || isSkipped(parent) || !parent.dataset) return;
			if (parent.getAttribute("data-zh-orig") !== null) return; // already translated
			parent.setAttribute("data-zh-orig", key);
			node.nodeValue = raw.replace(key, entry.label);
			if (entry.tip && !parent.title) {
				parent.title = entry.tip;
				parent.setAttribute("data-zh-tip", "1");
			}
		}

		function walk(root) {
			if (!root) return;
			var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
			var node;
			while ((node = walker.nextNode())) translate(node);
		}

		function schedule() {
			if (rafPending || !enabled) return;
			rafPending = true;
			requestAnimationFrame(function () {
				rafPending = false;
				walk(document.body);
			});
		}

		function restoreAll() {
			var els = document.querySelectorAll("[data-zh-orig]");
			for (var i = 0; i < els.length; i++) {
				var el = els[i];
				var orig = el.getAttribute("data-zh-orig");
				var entry = DICT[orig];
				el.removeAttribute("data-zh-orig");
				if (el.getAttribute("data-zh-tip") !== null) {
					el.removeAttribute("title");
					el.removeAttribute("data-zh-tip");
				}
				if (!entry) continue;
				var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
				var n;
				while ((n = walker.nextNode())) {
					if (n.nodeValue && n.nodeValue.indexOf(entry.label) !== -1) {
						n.nodeValue = n.nodeValue.replace(entry.label, orig);
						break;
					}
				}
			}
		}

		var BUTTON_CSS = [
			"#dsh-zh-kit-toggle{position:fixed;right:10px;bottom:130px;z-index:2147483000;",
			"appearance:none;border:1px solid rgba(128,128,128,.45);border-radius:999px;",
			"background:rgba(60,60,60,.55);color:#eee;padding:3px 10px;font:11px/1.6 system-ui,sans-serif;",
			"cursor:pointer;opacity:.5;transition:opacity .15s;backdrop-filter:blur(2px);}",
			"#dsh-zh-kit-toggle:hover{opacity:1;}",
			"#dsh-zh-kit-toggle[data-on=\"0\"]{background:rgba(120,120,120,.3);color:#bbb;}"
		].join("");

		function syncButton() {
			if (!button) return;
			button.setAttribute("data-on", enabled ? "1" : "0");
			button.textContent = enabled ? "轨迹中文化 · 开" : "轨迹中文化 · 关";
			button.title = "切换轨迹页标签的中文化（悬停各项可看人话解释）";
		}

		function boot() {
			if (booted) return;
			booted = true;
			styleEl = document.createElement("style");
			styleEl.id = "dsh-zh-kit-style";
			styleEl.textContent = BUTTON_CSS;
			document.head.appendChild(styleEl);

			button = document.createElement("button");
			button.id = "dsh-zh-kit-toggle";
			button.type = "button";
			button.addEventListener("click", function () {
				enabled = !enabled;
				try { localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0"); } catch (e) {}
				syncButton();
				if (enabled) schedule(); else restoreAll();
			});
			document.body.appendChild(button);
			syncButton();

			observer = new MutationObserver(function () { schedule(); });
			observer.observe(document.body, { childList: true, subtree: true });
			if (enabled) schedule();
		}

		function dispose() {
			if (observer) { observer.disconnect(); observer = null; }
			if (rafPending) { rafPending = false; }
			if (button && button.parentNode) button.parentNode.removeChild(button);
			button = null;
			if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
			styleEl = null;
			restoreAll();
			booted = false;
		}

		function apply(ctx) {
			try {
				if (document.readyState === "loading") {
					document.addEventListener("DOMContentLoaded", function () {
						try { boot(); } catch (e) {}
					}, { once: true });
				} else {
					boot();
				}
			} catch (e) {
				// never break the shell over a cosmetic projection
			}
			if (ctx && typeof ctx.effect === "function") {
				ctx.effect(function () { return dispose; }, "zh-kit");
			}
		}

		exports.apply = apply;
		return module.exports;
	}
});