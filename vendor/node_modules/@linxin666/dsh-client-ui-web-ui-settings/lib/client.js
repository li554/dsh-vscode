window.__ModuleLoader__.load({
	id: "@linxin666/dsh-client-ui-web-ui-settings",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_cordis = require("@deepseek-ai/cordis");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/protocol.ts
		/**
		* Settings-bridge protocol shared by the host and client halves of
		* dsh-web-ui-settings.
		*
		* DSH 0.1.0-rc.6 host-apiproxy serves only its hard-coded settings allowlist
		* (WEB_SETTINGS_NAMESPACES plus product namespaces), so every third-party
		* namespace answers "settings-not-exposed" and the family plugin cards can
		* only explain the gap. This bridge re-serves the dsh-web-ui family
		* namespaces through the host settings seam over a same-origin, loopback-only
		* HTTP pair, gated by the user's web_settings_namespaces allowlist from
		* settings.yaml with a built-in family fallback list. On hosts whose
		* apiproxy already exposes the namespaces, the official settings scope stays
		* the primary transport and this bridge never activates.
		*/
		/** Bridge route prefix (same-origin, loopback-only). */
		const WEB_UI_SETTINGS_BRIDGE_PREFIX = "/api/dsh-web-ui-settings";
		//#endregion
		//#region src/client/compat-settings-scope.ts
		/**
		* rc.6-compatible settings scope for the Web UI plugin group.
		*
		* The official settings scope answers "unavailable" for every third-party
		* namespace on rc.6 hosts (the apiproxy allowlist is hard-coded), which turns
		* every family plugin card into a read-only explanation. This binder wraps
		* the official scope: when it reports the namespace ready, the wrapper is a
		* pass-through; when it reports unavailable, a same-origin
		* bridge controller takes over and serves the same SettingsScope contract
		* from this package's host-side bridge routes (/api/dsh-web-ui-settings).
		* The Host keeps the bridge loopback-only by default and may explicitly admit
		* an authenticated same-host reverse proxy. Family plugins opt in through
		* ctx.get('webUiSettings') without a hard service dependency, so a deployment
		* without this package keeps the previous behavior.
		*/
		/** True when the value is a well-formed bridge RPC result (the inner result payload the route answers). */
		function isBridgeResult(value) {
			if (typeof value !== "object" || value === null) return false;
			const record = value;
			if (typeof record.ok !== "boolean") return false;
			if (record.ok) return typeof record.value === "object" && record.value !== null;
			return typeof record.code === "string" && typeof record.message === "string";
		}
		/**
		* Build the fetch-backed settings face for the bridge routes. Network and
		* HTTP failures collapse into an ok:false envelope so the controller keeps
		* its unavailable state instead of throwing into plugin activation.
		* @param fetchFn - the same-origin fetch implementation.
		* @returns the settings face.
		*/
		function createBridgeApi(fetchFn) {
			const post = async (path, body) => {
				try {
					const response = await fetchFn(WEB_UI_SETTINGS_BRIDGE_PREFIX + path, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(body)
					});
					if (!response.ok) return { result: {
						ok: false,
						code: "internal",
						message: "bridge HTTP " + response.status
					} };
					const parsed = await response.json();
					if (!isBridgeResult(parsed)) return { result: {
						ok: false,
						code: "internal",
						message: "bridge malformed response"
					} };
					return { result: parsed };
				} catch {
					return { result: {
						ok: false,
						code: "internal",
						message: "settings bridge unreachable"
					} };
				}
			};
			return { settings: {
				describe: async (payload) => post("/describe", payload),
				mutate: async (payload) => post("/mutate", payload)
			} };
		}
		/**
		* Judge each requested field against a redacted namespace view. A secret
		* field is redacted from the user layer, so it is judged by the view's
		* secret-set marker; every other field is judged by user-layer
		* presence/value. Shared by the bridge controller and the official batch
		* path (both answer the same redacted view shape).
		*/
		function judgeLandedFields(fields, view) {
			const secretSet = /* @__PURE__ */ new Map();
			for (const secret of view.secrets ?? []) secretSet.set(secret.path.join("."), secret.set);
			const user = view.user;
			return fields.map(({ field, op, value }) => {
				const secretFlag = secretSet.get(field);
				if (secretFlag !== void 0) return {
					field,
					landed: secretFlag
				};
				if (op === "set") return {
					field,
					landed: user !== void 0 && Object.hasOwn(user, field) && user[field] === value
				};
				return {
					field,
					landed: user === void 0 || !Object.hasOwn(user, field)
				};
			});
		}
		/**
		* A minimal SettingsScopeController over the bridge face. Mirrors the
		* official controller's ordering (serialized queue, revision-fenced writes,
		* recovery read after a refusal) but trusts the Host-seam value without
		* re-running the wire-schema validation: the seam already validated it, and
		* the family cards bind without a narrowing decoder.
		*/
		var BridgeScopeController = class {
			api;
			spec;
			store;
			tail = Promise.resolve();
			disposed = false;
			constructor(api, spec) {
				this.api = api;
				this.spec = spec;
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({
					status: "loading",
					value: void 0,
					base: void 0,
					user: void 0,
					revision: void 0,
					writable: false,
					mode: "host"
				});
			}
			getSnapshot() {
				return this.store.getSnapshot();
			}
			subscribe(listener) {
				return this.store.subscribe(listener);
			}
			/** Queue a Host refresh through the bridge. */
			load() {
				return this.enqueue(() => this.read());
			}
			set(field, value) {
				return this.enqueue(() => this.write({
					op: "set",
					path: [field],
					value
				}));
			}
			unset(field) {
				return this.enqueue(() => this.write({
					op: "unset",
					path: [field]
				}));
			}
			/**
			* Write every staged op in one bridge /mutate so the Host validate hook
			* judges the whole batch (baseURL+model together) instead of each field in
			* isolation. Reports per-field success from the returned view.
			* @param fields - the operations to apply, in order.
			* @returns the batch outcome and per-field landed flags.
			*/
			mutate(fields) {
				return this.enqueue(() => this.writeBatch(fields));
			}
			/** Stop queued operations and wait for the current bridge call to settle. */
			async dispose() {
				this.disposed = true;
				await this.tail;
			}
			enqueue(operation) {
				if (this.disposed) return Promise.resolve(void 0);
				const task = this.tail.then(async () => {
					if (this.disposed) return void 0;
					return operation();
				});
				this.tail = task.catch(() => {});
				return task;
			}
			async read() {
				let response;
				try {
					response = await this.api.settings.describe({});
				} catch {
					if (!this.disposed) this.store.update((draft) => {
						draft.status = "unavailable";
					});
					return;
				}
				if (!response.result.ok || this.disposed) {
					if (!this.disposed) this.store.update((draft) => {
						draft.status = "unavailable";
					});
					return;
				}
				const { namespaces, writable } = response.result.value;
				const view = namespaces.find((candidate) => candidate.ns === this.spec.namespace);
				if (view === void 0) {
					this.store.update((draft) => {
						draft.status = "unavailable";
						draft.writable = writable;
					});
					return;
				}
				this.accept(view.value, view, writable);
			}
			async write(op) {
				const revision = this.getSnapshot().revision;
				let response;
				try {
					response = await this.api.settings.mutate({
						ns: this.spec.namespace,
						ops: [op],
						...revision === void 0 ? {} : { expectedRevision: revision }
					});
				} catch {
					await this.read();
					return;
				}
				if (!response.result.ok || this.disposed) {
					await this.read();
					return;
				}
				this.accept(response.result.value.value, response.result.value, void 0);
			}
			async writeBatch(fields) {
				const revision = this.getSnapshot().revision;
				const ops = fields.map(({ field, op, value }) => op === "set" ? {
					op,
					path: [field],
					value
				} : {
					op,
					path: [field]
				});
				let response;
				try {
					response = await this.api.settings.mutate({
						ns: this.spec.namespace,
						ops,
						...revision === void 0 ? {} : { expectedRevision: revision }
					});
				} catch {
					await this.read();
					return {
						ok: false,
						fields: [],
						code: "internal",
						message: "settings bridge unreachable"
					};
				}
				if (!response.result.ok || this.disposed) {
					const refusal = response.result.ok === false ? response.result : {
						code: "internal",
						message: "settings bridge unreachable"
					};
					await this.read();
					return {
						ok: false,
						fields: [],
						code: refusal.code,
						message: refusal.message
					};
				}
				this.accept(response.result.value.value, response.result.value, void 0);
				return {
					ok: true,
					fields: this.landedFields(fields, response.result.value)
				};
			}
			/** Judge each requested field against the read-back view. */
			landedFields(fields, view) {
				return judgeLandedFields(fields, view);
			}
			/** Publish one accepted Host view (value narrowed by the optional decoder). */
			accept(section, view, writable) {
				const decoded = this.spec.decode === void 0 ? section : this.spec.decode(section);
				this.store.update((draft) => {
					draft.revision = view.revision;
					draft.base = view.base;
					draft.user = view.user;
					if (writable !== void 0) draft.writable = writable;
					if (decoded === void 0) return;
					draft.status = "ready";
					draft.value = decoded;
				});
			}
		};
		/**
		* Wrap the official settings scope with the bridge fallback. The official
		* scope stays authoritative whenever it serves the namespace; the bridge
		* controller answers only its unavailable state on a loopback connection.
		* @param options - the official scope, the namespace, and the loopback fetch.
		* @returns the compatibility scope implementing the SettingsScope contract.
		*/
		function createCompatScope(options) {
			const { namespace, primary } = options;
			const fallback = options.fetchFn === void 0 ? void 0 : new BridgeScopeController(createBridgeApi(options.fetchFn), { namespace });
			const reloadPrimary = async () => {
				await primary.load?.();
			};
			const officialBatch = options.official === void 0 ? void 0 : async (fields) => {
				const official = options.official;
				const revision = primary.getSnapshot().revision;
				const ops = fields.map(({ field, op, value }) => op === "set" ? {
					op,
					path: [field],
					value
				} : {
					op,
					path: [field]
				});
				let response;
				try {
					response = await official.mutate({
						ns: namespace,
						ops,
						...revision === void 0 ? {} : { expectedRevision: revision }
					});
				} catch {
					await reloadPrimary();
					return {
						ok: false,
						fields: [],
						code: "internal",
						message: "settings transport unreachable"
					};
				}
				const result = response.result;
				if (!result.ok) {
					await reloadPrimary();
					return {
						ok: false,
						fields: [],
						code: result.error.code,
						message: result.error.message
					};
				}
				await reloadPrimary();
				return {
					ok: true,
					fields: judgeLandedFields(fields, result.value)
				};
			};
			const store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(project());
			let fallbackStarted = false;
			const publish = () => {
				store.set(project());
			};
			const startFallback = () => {
				if (fallback === void 0 || fallbackStarted) return;
				fallbackStarted = true;
				fallback.load();
			};
			function project() {
				const primarySnapshot = primary.getSnapshot();
				if (primarySnapshot.status === "ready" || fallback === void 0) return primarySnapshot;
				if (primarySnapshot.status === "loading") return primarySnapshot;
				const bridgeSnapshot = fallback.getSnapshot();
				if (bridgeSnapshot.status === "ready") return bridgeSnapshot;
				if (bridgeSnapshot.status === "loading") return {
					...primarySnapshot,
					status: "loading"
				};
				return primarySnapshot;
			}
			const unsubscribes = [];
			unsubscribes.push(primary.subscribe(() => {
				publish();
				if (primary.getSnapshot().status === "unavailable") startFallback();
			}));
			if (fallback !== void 0) unsubscribes.push(fallback.subscribe(publish));
			if (primary.getSnapshot().status === "unavailable") startFallback();
			return {
				dispose: () => {
					for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
					fallback?.dispose();
				},
				getSnapshot: () => store.getSnapshot(),
				subscribe: (listener) => store.subscribe(listener),
				set: (field, value) => active().set(field, value),
				unset: (field) => active().unset(field),
				load: async () => {
					fallbackStarted = true;
					await fallback?.load();
				},
				get mutate() {
					const backend = active();
					if (fallback !== void 0 && backend === fallback && typeof fallback.mutate === "function") return fallback.mutate.bind(fallback);
					if (backend === primary && primary.getSnapshot().status === "ready" && officialBatch !== void 0) return officialBatch;
				}
			};
			function active() {
				return primary.getSnapshot().status === "ready" ? primary : fallback ?? primary;
			}
		}
		/**
		* The rc.6 compatibility binder, provided as the webUiSettings service. Its
		* bind() rides the official binder first and hands the bridge controller in
		* only when the official scope settles as unavailable, so official behavior
		* stays untouched wherever it works and the Host remains the authority for
		* loopback or explicitly configured authenticated-proxy access.
		*/
		var WebUiSettingsBinder = class extends _deepseek_ai_cordis.Service {
			constructor(ctx) {
				super(ctx, "webUiSettings");
			}
			bind(spec) {
				const ctx = this.ctx;
				const official = ctx.get("settingsScope");
				if (!isBinderFace(official)) throw new Error("webUiSettings: the official settingsScope binder is unavailable");
				const primary = official.bind(spec);
				const connection = ctx.get("connection");
				const officialFace = isOfficialConnectionFace(connection) && connection.isLoopback !== false ? connection.api.settings : void 0;
				const scope = createCompatScope({
					namespace: spec.namespace,
					primary,
					fetchFn: (input, init) => fetch(input, init),
					...officialFace === void 0 ? {} : { official: officialFace }
				});
				ctx.effect(() => {
					const remoteValue = ctx.get("remote");
					const remote = isRemoteFace(remoteValue) ? remoteValue : void 0;
					const disposers = [];
					if (remote !== void 0) disposers.push(remote.$on("settings/document-updated", (namespace) => {
						if (namespace !== void 0 && namespace !== spec.namespace) return;
						scope.load();
					}));
					disposers.push(ctx.on("connection/reset", () => {
						scope.load();
					}));
					return () => {
						for (const dispose of disposers) dispose();
						scope.dispose();
					};
				}, "web-ui-settings: compat scope invalidation");
				return scope;
			}
		};
		/** True when the value exposes the official settings binder's bind() seam. */
		function isBinderFace(value) {
			return typeof value === "object" && value !== null && typeof value.bind === "function";
		}
		/** True when the value is the client connection handle with a settings wire face. */
		function isOfficialConnectionFace(value) {
			if (typeof value !== "object" || value === null) return false;
			const api = value.api;
			if (typeof api !== "object" || api === null) return false;
			const settings = api.settings;
			return typeof settings === "object" && settings !== null && typeof settings.mutate === "function";
		}
		/** True when the value exposes the settings invalidation face the wrapper listens to. */
		function isRemoteFace(value) {
			return typeof value === "object" && value !== null && typeof value.$on === "function";
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-web-ui-settings/src/client/web-ui-settings.module.css.mjs
		const css = ".-\\35 WdAW_section{flex-direction:column;display:flex}.-\\35 WdAW_heading{color:var(--dsw-alias-label-primary);margin:0 0 4px;font-size:17px;font-weight:600;line-height:1.4}.-\\35 WdAW_lede{color:var(--dsw-alias-label-tertiary);margin:0 0 12px;font-size:13px;line-height:1.5}.-\\35 WdAW_sectionList{margin:0;padding:0;list-style:none}.-\\35 WdAW_subcards{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}[class*=_navList]:has(>[class*=_navCell]:nth-child(8)):not(:has(>[class*=_navCell]:nth-child(9)))>[class*=_navCell]:nth-child(5)>[class*=_navIcon],[class*=_navList]:has(>[class*=_navCell]:nth-child(8)):not(:has(>[class*=_navCell]:nth-child(9)))>[class*=_navCell]:nth-child(6)>[class*=_navIcon],[class*=_navList]:has(>[class*=_navCell]:nth-child(8)):not(:has(>[class*=_navCell]:nth-child(9)))>[class*=_navCell]:nth-child(7)>[class*=_navIcon],[class*=_navList]:has(>[class*=_navCell]:nth-child(8)):not(:has(>[class*=_navCell]:nth-child(9)))>[class*=_navCell]:nth-child(8)>[class*=_navIcon]{display:none}[class*=_navList]:has(>[class*=_navCell]:nth-child(8)):not(:has(>[class*=_navCell]:nth-child(9)))>[class*=_navCell]:nth-child(5):before{content:\"\";background:currentColor;flex:none;width:16px;height:16px;-webkit-mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z'/%3E%3C/svg%3E\") 50%/contain no-repeat;mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z'/%3E%3C/svg%3E\") 50%/contain no-repeat}[class*=_navList]:has(>[class*=_navCell]:nth-child(8)):not(:has(>[class*=_navCell]:nth-child(9)))>[class*=_navCell]:nth-child(6):before{content:\"\";background:currentColor;flex:none;width:16px;height:16px;-webkit-mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'/%3E%3C/svg%3E\") 50%/contain no-repeat;mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'/%3E%3C/svg%3E\") 50%/contain no-repeat}[class*=_navList]:has(>[class*=_navCell]:nth-child(8)):not(:has(>[class*=_navCell]:nth-child(9)))>[class*=_navCell]:nth-child(7):before{content:\"\";background:currentColor;flex:none;width:16px;height:16px;-webkit-mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cellipse cx='8' cy='11' rx='4.2' ry='2.8'/%3E%3Ccircle cx='2.8' cy='6.2' r='1.9'/%3E%3Ccircle cx='8' cy='4.6' r='1.9'/%3E%3Ccircle cx='13.2' cy='6.2' r='1.9'/%3E%3C/svg%3E\") 50%/contain no-repeat;mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cellipse cx='8' cy='11' rx='4.2' ry='2.8'/%3E%3Ccircle cx='2.8' cy='6.2' r='1.9'/%3E%3Ccircle cx='8' cy='4.6' r='1.9'/%3E%3Ccircle cx='13.2' cy='6.2' r='1.9'/%3E%3C/svg%3E\") 50%/contain no-repeat}[class*=_navList]:has(>[class*=_navCell]:nth-child(8)):not(:has(>[class*=_navCell]:nth-child(9)))>[class*=_navCell]:nth-child(8):before{content:\"\";background:currentColor;flex:none;width:16px;height:16px;-webkit-mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='5.5' cy='5.5' r='3'/%3E%3Ccircle cx='11' cy='5.5' r='3'/%3E%3Cpath d='M2.5 13.5c0-3 2-4.2 3-4.2H11c1.5 0 3 1.2 3 4.2z'/%3E%3C/svg%3E\") 50%/contain no-repeat;mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='5.5' cy='5.5' r='3'/%3E%3Ccircle cx='11' cy='5.5' r='3'/%3E%3Cpath d='M2.5 13.5c0-3 2-4.2 3-4.2H11c1.5 0 3 1.2 3 4.2z'/%3E%3C/svg%3E\") 50%/contain no-repeat}";
		const tagId = "@linxin666/dsh-client-ui-web-ui-settings/web-ui-settings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-web-ui-settings";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var web_ui_settings_module_css_default = {
			"heading": "-5WdAW_heading",
			"lede": "-5WdAW_lede",
			"section": "-5WdAW_section",
			"sectionList": "-5WdAW_sectionList",
			"subcards": "-5WdAW_subcards"
		};
		//#endregion
		//#region src/client/WebUIPluginsCard.tsx
		/** Render the family plugin cards directly under a static heading. */
		function WebUIPluginsSection(props) {
			const { t, renderSlot } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: web_ui_settings_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: web_ui_settings_module_css_default.heading,
						title: t("title"),
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: web_ui_settings_module_css_default.lede,
						title: t("description"),
						children: t("description")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: web_ui_settings_module_css_default.subcards,
						children: renderSlot("web-ui.plugin.item", {})
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* The `web-ui-plugins` locale dictionaries for the group card.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"title": "Web UI 插件",
			"description": "统一管理 dsh-web-ui 全家桶插件的启用与配置。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"title": "Web UI Plugins",
			"description": "Enable and configure the dsh-web-ui family plugins from one place."
		};
		//#endregion
		//#region src/client/index.ts
		/** Required services. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsScope",
			"remote"
		];
		/**
		* Register the Web UI plugin group as a first-level settings section: its own
		* nav item hosts the family plugin cards in the section body.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				try {
					return ctx.locale.register("web-ui-plugins", {
						zh,
						en
					});
				} catch {
					return () => {};
				}
			}, "web-ui-settings: dictionaries");
			new WebUiSettingsBinder(ctx);
			ctx.slots.inject("settings.section", () => {
				try {
					return ctx.slots.register({
						name: "settings.section",
						id: "web-ui-plugins",
						order: 110,
						label: () => ctx.locale.bind("web-ui-plugins")("title"),
						locale: "web-ui-plugins",
						children: { "web-ui.plugin.item": {
							kind: "list",
							scope: "root"
						} }
					}, WebUIPluginsSection);
				} catch {
					return () => {};
				}
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map