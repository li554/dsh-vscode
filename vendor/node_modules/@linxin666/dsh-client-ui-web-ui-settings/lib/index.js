import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import z from "schemastery";
import { timingSafeEqual } from "node:crypto";
import { SettingsConflictError, settingsNamespace } from "@deepseek-ai/dsh-settings";
//#region src/dsh-home.ts
/**
* DSH_HOME resolution shared by the plugin family's Host halves: the
* environment override wins, the platform home fallback follows. Mirrors
* what dsh-pet and dsh-liangshen each used to implement locally.
*/
/** Expand a leading ~ (or ~user) in a path, platform-style. */
function expandHome(path, home = homedir()) {
	if (path === "~") return home;
	if (path.startsWith("~/") || path.startsWith("~\\")) return join(home, path.slice(2));
	return path;
}
/**
* Resolve the DSH home directory.
* @param env - process environment to read DSH_HOME from.
* @param home - platform home directory fallback (test seam).
* @returns the absolute DSH home path.
*/
function resolveDshHome(env = process.env, home = homedir()) {
	const raw = env.DSH_HOME;
	if (raw !== void 0 && raw.trim() !== "") {
		const expanded = expandHome(raw.trim(), home);
		return isAbsolute(expanded) ? expanded : join(process.cwd(), expanded);
	}
	return join(home, ".dsh");
}
//#endregion
//#region src/allowlist.ts
/**
* rc.6 compatibility allowlist for the settings bridge.
*
* rc.6 host-apiproxy never reads settings.yaml for a namespace allowlist: its
* WEB_SETTINGS_NAMESPACES set is hard-coded. Users configure
* web_settings_namespaces expecting the configuration page to honor it, so
* this package reads that key itself (host side) and maps the entries — which
* users spell as package names like dsh-client-ui-task-board — onto the real
* settings namespaces the plugins register (task-board and friends). When the
* key is absent, a built-in family fallback list keeps every family plugin's
* configuration form visible out of the box. The final allowlist is always
* intersected with the namespaces actually registered in the host settings
* seam, so an unknown entry can never surface a form or accept a write.
*/
/** Settings namespaces the dsh-web-ui family plugins register. */
const FAMILY_NAMESPACES = [
	"dsh-ssh",
	"task-board",
	"remote-web-ui",
	"pet",
	"aionui-panel",
	"describe-image",
	"skin-background",
	"community-plugins",
	"desktop-launcher"
];
/**
* Package names and plugin ids to their settings namespace. A null value
* means the package owns no settings namespace (its configuration lives
* elsewhere, e.g. localStorage), so the entry is intentionally ignored.
*/
const NAMESPACE_ALIASES = {
	"dsh-ssh": "dsh-ssh",
	ssh: "dsh-ssh",
	"dsh-client-ui-task-board": "task-board",
	"dsh-task-board": "task-board",
	"task-board": "task-board",
	"dsh-remote-web-ui": "remote-web-ui",
	"remote-web-ui": "remote-web-ui",
	"dsh-pet": "pet",
	pet: "pet",
	"dsh-skins": "skin-background",
	"dsh-client-ui-skin-center": "skin-background",
	"skin-center": "skin-background",
	"skin-background": "skin-background",
	"describe-image": "describe-image",
	"dsh-tool-describe-image": "describe-image",
	"community-plugins": "community-plugins",
	"dsh-community-plugins": "community-plugins",
	"dsh-client-ui-community-plugins": "community-plugins",
	"aionui-panel": "aionui-panel",
	"dsh-aionui-panel": "aionui-panel",
	"dsh-client-ui-aionui-panel": "aionui-panel",
	"desktop-launcher": "desktop-launcher",
	"dsh-desktop-launcher": "desktop-launcher",
	"dsh-git-graph": null,
	"dsh-client-ui-git-graph": null,
	"dsh-web-ui": null,
	"dsh-web-ui-all": null,
	"dsh-client-ui-web-ui-settings": null
};
/**
* Resolve one user-configured allowlist entry to a settings namespace.
* @param entry - raw entry from the user's allowlist.
* @returns the settings namespace, or undefined when the entry names nothing
*   configurable (unknown name, or a package without a settings namespace).
*/
function resolveNamespaceEntry(entry) {
	const key = entry.trim();
	if (key === "") return void 0;
	if (Object.hasOwn(NAMESPACE_ALIASES, key)) return NAMESPACE_ALIASES[key] ?? void 0;
	if (FAMILY_NAMESPACES.includes(key)) return key;
}
/**
* Compose the effective bridge allowlist.
* @param userEntries - normalized web_settings_namespaces entries; the empty
*   list selects the built-in family fallback list.
* @param registered - namespaces currently registered in the host settings
*   seam (the only namespaces a form or write can target).
* @returns the allowlist: resolved entries intersected with the registered
*   set, sorted for a stable wire view.
*/
function composeAllowlist(userEntries, registered) {
	const requested = userEntries.length === 0 ? FAMILY_NAMESPACES : userEntries;
	const resolved = /* @__PURE__ */ new Set();
	for (const entry of requested) {
		const ns = resolveNamespaceEntry(entry);
		if (ns !== void 0) resolved.add(ns);
	}
	const registeredSet = new Set(registered);
	return [...resolved].filter((ns) => registeredSet.has(ns)).sort();
}
/** Strip one YAML scalar's quoting (single or double quotes). */
function stripQuotes(value) {
	const trimmed = value.trim();
	if (trimmed.length >= 2 && (trimmed[0] === "'" || trimmed[0] === "\"") && trimmed[trimmed.length - 1] === trimmed[0]) return trimmed.slice(1, -1).trim();
	return trimmed;
}
/** Trim one YAML list or map item down to its entry name. */
function entryOfItem(item) {
	let value = item.trim();
	if (value.startsWith("- ")) value = value.slice(2).trim();
	if (value === "") return void 0;
	const colon = value.indexOf(":");
	if (colon >= 0) value = value.slice(0, colon).trim();
	const name = stripQuotes(value);
	return name === "" ? void 0 : name;
}
/**
* Extract the web_settings_namespaces entries from raw settings.yaml text.
* Accepts a block list, a block map, and an inline flow list — the shapes
* users have actually tried. Returns the empty list when the key is absent
* or unparseable.
* @param text - raw settings.yaml content (the empty string is fine).
* @returns the configured entries in document order.
*/
function extractWebSettingsNamespaces(text) {
	if (text.trim() === "") return [];
	const inline = /(?:^|\n)\s*web_settings_namespaces\s*:\s*\[([^\]]*)\]/m.exec(text);
	if (inline !== null) {
		const entries = [];
		for (const part of inline[1].split(",")) {
			const name = stripQuotes(part);
			if (name !== "") entries.push(name);
		}
		return entries;
	}
	const lines = text.split(/\r?\n/);
	const start = lines.findIndex((line) => /^\s*web_settings_namespaces\s*:\s*(?:#.*)?$/.test(line.trim()));
	if (start < 0) return [];
	const entries = [];
	for (const line of lines.slice(start + 1)) {
		const trimmed = line.trim();
		if (trimmed === "") break;
		if (trimmed.startsWith("#")) continue;
		if (!/^\s/.test(line) && !trimmed.startsWith("-")) break;
		const name = entryOfItem(trimmed);
		if (name !== void 0) entries.push(name);
	}
	return entries;
}
//#endregion
//#region src/http.ts
/** Default body cap for readJsonBody: 64 KiB. */
const DEFAULT_JSON_BODY_MAX_BYTES = 64 * 1024;
/** Family-default JSON response headers; callers may append or override. */
const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"referrer-policy": "no-referrer"
};
/**
* Lenient bounded body reader: parse a request body as JSON, or null on an
* empty body, invalid JSON, or a body past maxBytes (default 64 KiB).
* Overflow destroys the request instead of draining the remainder (no drain
* call, matching the current repo-wide behavior); callers must not keep
* reading the request afterwards. With objectOnly, non-JSON-object payloads
* also yield null.
*/
async function readJsonBody(req, opts = {}) {
	const maxBytes = opts.maxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES;
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > maxBytes) {
			req.destroy();
			return null;
		}
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (text === "") return null;
	try {
		const parsed = JSON.parse(text);
		if (opts.objectOnly && !isJsonObject(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}
/** Whether a value is a JSON object: typeof object, not null, not an array. */
function isJsonObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Write one JSON response. Default headers are the family defaults
* (content-type and referrer-policy); caller headers are appended or
* override them.
*/
function writeJson(res, status, body, headers = {}) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		...JSON_HEADERS,
		...headers
	});
	res.end(payload);
}
//#endregion
//#region src/bridge.ts
/**
* Host-side settings bridge for the Web UI plugin group.
*
* Serves the dsh-web-ui family settings namespaces over a same-origin HTTP
* pair because rc.6 host-apiproxy refuses every third-party namespace at the
* RPC boundary. Access is loopback-only by default; deployments may opt in an
* authenticated local reverse proxy. The handlers ride the host settings
* seam (ctx.settings), which keeps the official schema validation, revision
* fencing, persistence, and event emission for free; the bridge only adds the
* allowlist gate the apiproxy normally provides. Error codes mirror the
* official RPC codes so the client controller treats refusals exactly like an
* apiproxy answer.
*/
/** Header an authenticated same-host reverse proxy replaces before forwarding. */
const WEB_UI_SETTINGS_PROXY_TOKEN_HEADER = "x-dsh-web-ui-settings-proxy-token";
/** Whether a socket address is a literal loopback peer. */
function isLoopbackAddress(address) {
	return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
/** Whether a normalized hostname is a literal loopback authority. */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Parse one bare Host authority. */
function parseAuthority(authority) {
	if (authority.trim() !== authority) return void 0;
	const authorityMatch = authority.startsWith("[") ? /^\[[^\]]+\](?::([0-9]+))?$/.exec(authority) : /^[^:@/?#\s]+(?::([0-9]+))?$/.exec(authority);
	if (authorityMatch === null) return void 0;
	try {
		const url = new URL("http://" + authority);
		if (url.username !== "" || url.password !== "" || url.pathname !== "/" || url.search !== "" || url.hash !== "") return void 0;
		const rawPort = authorityMatch[1];
		if (rawPort !== void 0 && (String(Number(rawPort)) !== rawPort || Number(rawPort) > 65535)) return void 0;
		return {
			canonical: url.hostname.toLowerCase() + (rawPort === void 0 ? "" : ":" + rawPort),
			url
		};
	} catch {
		return;
	}
}
/** Resolve and validate the opt-in proxy policy once, when routes mount. */
function resolveBridgeAccess(access) {
	const trustedProxyHosts = /* @__PURE__ */ new Set();
	for (const entry of access?.trustedProxyHosts ?? []) {
		const parsed = parseAuthority(entry);
		if (parsed === void 0 || parsed.canonical !== entry.toLowerCase()) throw new Error("web-ui-settings: trustedProxyHosts entry " + JSON.stringify(entry) + " is not a canonical host[:port] authority");
		trustedProxyHosts.add(parsed.canonical);
	}
	const proxyToken = access?.proxyToken;
	if (trustedProxyHosts.size > 0 && (proxyToken === void 0 || proxyToken === "")) throw new Error("web-ui-settings: authenticated proxy hosts require a non-empty proxy token");
	return {
		trustedProxyHosts,
		...proxyToken === void 0 ? {} : { proxyToken }
	};
}
/** Compare the proxy token without content-dependent early exit. */
function matchesProxyToken(candidate, expected) {
	if (typeof candidate !== "string" || expected === void 0 || candidate === "" || expected === "") return false;
	const candidateBytes = Buffer.from(candidate);
	const expectedBytes = Buffer.from(expected);
	return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
}
/** Browser same-origin markers shared by direct loopback and proxy requests. */
function isSameOriginRequest(request, hostUrl) {
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
/** Hot-path trust decision over an already validated policy. */
function isTrustedBridgeRequestResolved(request, access) {
	const address = request.socket.remoteAddress;
	if (!isLoopbackAddress(address)) return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	const parsedHost = parseAuthority(host);
	if (parsedHost === void 0 || parsedHost.canonical !== host.toLowerCase() || !isSameOriginRequest(request, parsedHost.url)) return false;
	if (isLoopbackHostname(parsedHost.url.hostname)) return true;
	if (!access.trustedProxyHosts.has(parsedHost.canonical)) return false;
	return matchesProxyToken(request.headers[WEB_UI_SETTINGS_PROXY_TOKEN_HEADER], access.proxyToken);
}
/** Project one settings descriptor onto the bridge wire view. */
function toView(descriptor) {
	return {
		ns: String(descriptor.ns),
		schema: descriptor.schema,
		value: descriptor.value,
		...descriptor.base === void 0 ? {} : { base: descriptor.base },
		...descriptor.user === void 0 ? {} : { user: descriptor.user },
		...descriptor.secrets === void 0 ? {} : { secrets: descriptor.secrets.map((secret) => ({
			path: [...secret.path],
			set: secret.set
		})) },
		revision: descriptor.revision
	};
}
/** Map a seam failure onto the official-shaped refusal envelope. */
function failureOf(error) {
	if (error instanceof SettingsConflictError) return {
		ok: false,
		code: "settings-conflict",
		message: error.message
	};
	const message = error instanceof Error ? error.message : String(error);
	if (/is not registered/.test(message)) return {
		ok: false,
		code: "settings-rejected",
		message
	};
	return {
		ok: false,
		code: "settings-rejected",
		message
	};
}
/**
* Build the bridge handlers. The allowlist is re-read on every call so edits
* to settings.yaml take effect without a host restart.
* @param deps - the settings seam and the settings.yaml reader.
* @returns the handlers.
*/
function makeBridgeHandlers(deps) {
	const allowlisted = (descriptors) => {
		const registered = descriptors.map((descriptor) => String(descriptor.ns));
		return composeAllowlist(extractWebSettingsNamespaces(deps.readSettingsYaml()), registered);
	};
	return {
		async describe() {
			const descriptors = deps.settings.describe({ redactSecrets: true });
			return {
				ok: true,
				value: {
					namespaces: allowlisted(descriptors).map((ns) => descriptors.find((descriptor) => String(descriptor.ns) === ns)).filter((descriptor) => descriptor !== void 0).map(toView),
					writable: deps.settings.writable !== false
				}
			};
		},
		async mutate(request) {
			const body = request;
			if (body === null || typeof body !== "object" || typeof body.ns !== "string" || !Array.isArray(body.ops)) return {
				ok: false,
				code: "settings-rejected",
				message: "malformed bridge settings request"
			};
			const { ns } = body;
			if (!allowlisted(deps.settings.describe({ redactSecrets: true })).includes(ns)) return {
				ok: false,
				code: "settings-not-exposed",
				message: "settings namespace \"" + ns + "\" is not exposed to configuration clients"
			};
			const expectedRevision = typeof body.expectedRevision === "number" ? body.expectedRevision : void 0;
			try {
				await deps.settings.mutate(settingsNamespace(ns), body.ops, expectedRevision);
			} catch (error) {
				return failureOf(error);
			}
			const descriptor = deps.settings.describe({ redactSecrets: true }).find((candidate) => String(candidate.ns) === ns);
			if (descriptor === void 0) return {
				ok: false,
				code: "internal",
				message: "settings namespace \"" + ns + "\" was disposed after the mutate"
			};
			return {
				ok: true,
				value: toView(descriptor)
			};
		}
	};
}
/**
* Build the loopback-default bridge routes, optionally admitting one
* authenticated same-host reverse proxy.
* @param deps - handler dependencies.
* @param access - opt-in authenticated proxy policy.
* @returns the exact-path route registrations.
*/
function makeBridgeRoutes(deps, access) {
	const handlers = makeBridgeHandlers(deps);
	const resolvedAccess = resolveBridgeAccess(access);
	const guard = (req, res) => {
		if (!isTrustedBridgeRequestResolved(req, resolvedAccess)) {
			writeJson(res, 403, { error: "forbidden" });
			return false;
		}
		if (req.method !== "POST") {
			writeJson(res, 405, { error: "method not allowed: " + (req.method ?? "") });
			return false;
		}
		return true;
	};
	return [{
		kind: "exact",
		path: "/api/dsh-web-ui-settings/describe",
		handler: async (req, res) => {
			if (!guard(req, res)) return;
			writeJson(res, 200, await handlers.describe());
		}
	}, {
		kind: "exact",
		path: "/api/dsh-web-ui-settings/mutate",
		handler: async (req, res) => {
			if (!guard(req, res)) return;
			const body = await readJsonBody(req);
			if (body === null) {
				writeJson(res, 400, {
					ok: false,
					code: "settings-rejected",
					message: "unreadable JSON body"
				});
				return;
			}
			writeJson(res, 200, await handlers.mutate(body));
		}
	}];
}
//#endregion
//#region src/mount-once.ts
/**
* Host single-instance guard shared by the plugin family. The family bundle
* (dsh-web-ui-all / dsh-skins) namespaces every child row id (web-ui-*), so
* the loader accepts a standalone install of the same package side by side;
* without this guard the second instance would still re-register the same
* webserver routes, tools, settings namespaces, and system-prompt sections
* and fail the boot. mountOnce makes the second host apply a no-op for the
* lifetime of the first instance (the browser half is already deduped by
* package name in the client module host).
*
* The registry rides a global symbol so two module instances of the same
* package (npm copy vs repository link) still share one verdict. cordis
* `ctx.effect` runs its callback immediately and treats the callback's
* return value as the fiber disposer, so the unmarker is returned, not run.
*/
const MOUNTED = Symbol.for("dsh-web-ui.mounted-plugins");
function mountedSet() {
	const registry = globalThis;
	return registry[MOUNTED] ??= /* @__PURE__ */ new Set();
}
/**
* Wrap a cordis plugin apply so the package runs at most once per process.
* The first mount registers normally and unmarks when its fiber disposes;
* any later mount of the same package name is a no-op.
* @param packageName - npm package identity shared by every install source.
* @param fn - the original plugin apply.
* @returns an apply of the same shape.
*/
function mountOnce(packageName, fn) {
	return ((...args) => {
		const mounted = mountedSet();
		if (mounted.has(packageName)) return;
		mounted.add(packageName);
		args[0]?.effect?.(() => () => {
			mounted.delete(packageName);
		});
		return fn(...args);
	});
}
//#endregion
//#region src/index.ts
/**
* Host half of the dsh-web-ui-settings group. Mounts the rc.6 compatibility
* settings bridge: a loopback-default HTTP pair that serves the family
* plugins' settings namespaces through the host settings seam, gated by the
* user's web_settings_namespaces allowlist from settings.yaml (with the
* built-in family fallback list). An explicit authenticated-proxy config may
* admit exact same-origin Hosts without changing the default. The browser
* half uses it only when the official settings scope reports the namespace
* unavailable, so hosts whose apiproxy already exposes the namespaces never
* touch the bridge.
*/
/** Default environment variable holding the reverse-proxy shared token. */
const DEFAULT_PROXY_TOKEN_ENV = "DSH_WEB_UI_SETTINGS_PROXY_TOKEN";
const Config = z.object({
	trustedProxyHosts: z.array(String).default([]),
	proxyTokenEnv: z.string().min(1).default(DEFAULT_PROXY_TOKEN_ENV)
});
/** Resolve the opt-in proxy token without putting its value in plugin config. */
function resolveProxyAccess(config, env = process.env) {
	const trustedProxyHosts = config?.trustedProxyHosts ?? [];
	if (trustedProxyHosts.length === 0) return { trustedProxyHosts };
	const proxyTokenEnv = config?.proxyTokenEnv ?? "DSH_WEB_UI_SETTINGS_PROXY_TOKEN";
	if (proxyTokenEnv.trim() === "") throw new Error("web-ui-settings: proxyTokenEnv must not be empty");
	const proxyToken = env[proxyTokenEnv];
	if (proxyToken === void 0 || proxyToken === "") throw new Error("web-ui-settings: trustedProxyHosts requires a non-empty " + proxyTokenEnv + " environment variable");
	return {
		trustedProxyHosts,
		proxyToken
	};
}
/** Required services before the bridge routes can mount. */
const inject = ["webServer"];
/**
* Mount the settings bridge when a settings seam exists (the seam is what the
* bridge serves, so without one there is nothing to expose).
* @param ctx - host plugin context.
* @param config - loopback-default bridge and authenticated-proxy config.
*/
/**
* Resolve the settings YAML fallback path when the host settings seam does
* not report a documentPath: $DSH_HOME/settings.yaml (defaulting to
* ~/.dsh/settings.yaml). Test seam: env and home are injectable.
*/
function settingsYamlFallbackPath(env = process.env, home = homedir()) {
	return join(resolveDshHome(env, home), "settings.yaml");
}
const apply = mountOnce("@linxin666/dsh-client-ui-web-ui-settings", applyImpl);
function applyImpl(ctx, config) {
	const access = resolveProxyAccess(config);
	ctx.inject(["settings"], (sctx) => {
		const settingsYamlPath = sctx.settings.documentPath ?? settingsYamlFallbackPath();
		sctx.effect(() => {
			const disposers = makeBridgeRoutes({
				settings: sctx.settings,
				readSettingsYaml: () => {
					try {
						return readFileSync(settingsYamlPath, "utf8");
					} catch {
						return "";
					}
				}
			}, access).map((route) => sctx.webServer.register(route));
			return () => {
				for (const dispose of disposers) dispose();
			};
		}, "web-ui-settings: settings bridge");
	});
}
//#endregion
export { Config, DEFAULT_PROXY_TOKEN_ENV, apply, inject, resolveProxyAccess, settingsYamlFallbackPath };
