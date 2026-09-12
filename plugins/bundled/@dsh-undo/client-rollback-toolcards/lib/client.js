window.__ModuleLoader__.load({
	id: "@dsh-undo/client-rollback-toolcards",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0dsh-css:C:\Users\34293\Desktop\dsh-undo\packages\client-rollback-toolcards\src\client\toolcards.module.css.mjs
		const css = "[data-sample=bash]+div>div,[data-tool=bash] [data-terminal]{--dsw-alias-markdown-code-block:#0d1117;--dsw-alias-markdown-code-block-banner:#161b22;--dsw-alias-label-primary:#e6edf3;--dsw-alias-label-secondary:#9aa4b2;--dsw-alias-label-tertiary:#7d8590;--dsw-alias-label-caption:#6e7681;--dsw-alias-border-l1:#262d36;--dsw-alias-border-l2:#30363d;--dsw-alias-state-error-primary:#f8614d;color:#e6edf3;background:#0d1117;border-color:#262d36}[data-tool=pwsh] [data-terminal]{--dsw-alias-markdown-code-block:#012456;--dsw-alias-markdown-code-block-banner:#012456;--dsw-alias-label-primary:#eaf1ff;--dsw-alias-label-secondary:#b8c9ec;--dsw-alias-label-tertiary:#94a9d6;--dsw-alias-label-caption:#7e93c4;--dsw-alias-border-l1:#274a86;--dsw-alias-border-l2:#33598f;--dsw-alias-state-error-primary:#ff9d9d;color:#eaf1ff;background:#012456;border-color:#274a86}[data-tool=edit] [data-diff],[data-tool=write] [data-diff]{background:color-mix(in srgb, #2da44e 12%, var(--dsw-alias-markdown-code-block))}[data-tool=read] [data-read]{--dsw-alias-markdown-code-block-banner:color-mix(in srgb, #8957e5 14%, var(--dsw-alias-markdown-code-block));background:color-mix(in srgb, #8957e5 10%, var(--dsw-alias-markdown-code-block))}[data-tool=grep] [data-search],[data-tool=glob] [data-search]{--dsw-alias-markdown-code-block-banner:color-mix(in srgb, #4493f8 14%, var(--dsw-alias-markdown-code-block));background:color-mix(in srgb, #4493f8 10%, var(--dsw-alias-markdown-code-block))}[data-tool=web_search] [data-web],[data-tool=web_fetch] [data-web]{background:color-mix(in srgb, #12a5b0 10%, var(--dsw-alias-markdown-code-block))}[data-tool=run_code] .md-code-block{background:color-mix(in srgb, #d29922 10%, var(--dsw-alias-markdown-code-block))}";
		const tagId = "@dsh-undo/client-rollback-toolcards/toolcards.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-undo/client-rollback-toolcards";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region lib/types/client/index.js
		/** No services required: nothing but the load-time stylesheet injection. */
		const inject = [];
		/**
		* No runtime behavior beyond the stylesheet injected at module load.
		* @returns a no-op disposer (the loader owns the style tag's lifecycle).
		*/
		async function apply() {
			return () => {};
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map