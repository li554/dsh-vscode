import { t as descriptor } from "./descriptor-1h1ZrvkP.js";
import { CATEGORIES, MEMORY_SPACE_PROVIDER_API_VERSION, defineMemorySpaceProvider, defineMemorySpaceProviderDefinition } from "dsh-mnemon-source-memory-spaces/provider-sdk";
import { randomUUID } from "node:crypto";
//#region src/driver.ts
function object(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function string(value) {
	return typeof value === "string" ? value : void 0;
}
function number(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/** The categories Mnemon writes; anything else is stored, and read back, as general. */
const CATEGORY_NAMES = new Set(CATEGORIES);
function categoryOf(value) {
	const category = string(value)?.trim().toLowerCase();
	return category !== void 0 && CATEGORY_NAMES.has(category) ? category : "general";
}
const MEMORY_FOLDERS = {
	preference: "preferences",
	insight: "experiences",
	decision: "experiences",
	context: "events",
	fact: "entities",
	general: "entities"
};
/**
* The slug's share of a file name, which Linux caps at 255 bytes: the stamp, the longest
* category, the UUID and the separators take 66, so 48 characters of four bytes would not fit.
*/
const SLUG_BYTES = 180;
function memoryUri(root, category, content) {
	const folder = Object.hasOwn(MEMORY_FOLDERS, category) ? MEMORY_FOLDERS[category] : "entities";
	const firstLine = content.split("\n").find((line) => line.trim().length > 0) ?? "memory";
	const characters = Array.from(firstLine.replace(/^#+\s*/u, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/gu, "")).slice(0, 48);
	while (Buffer.byteLength(characters.join("").toLowerCase()) > SLUG_BYTES) characters.pop();
	const slug = characters.join("").toLowerCase() || "memory";
	return `${root}/${folder}/${(/* @__PURE__ */ new Date()).toISOString().replace(/[-:T]/gu, "").slice(0, 14)}-${slug}_${category}-${randomUUID()}.md`;
}
function safeUser(user) {
	return /^[a-zA-Z0-9_.@-]+$/u.test(user) && user !== "." && user !== ".." && (user.match(/@/gu)?.length ?? 0) <= 1;
}
function discoveryUser(connection) {
	const user = String(connection.discoveryUser ?? "").trim();
	if (user === "") return void 0;
	if (!safeUser(user) || !safeUser(String(connection.account ?? "").trim())) throw new Error("OpenViking user-key discovery requires an explicit account and a safe discovery user");
	if (String(connection.apiKey ?? "").trim() === "") throw new Error("OpenViking user-key discovery requires a user API key");
	return user;
}
function isMemoryFile(uri, root) {
	if (!uri.startsWith(`${root}/`) || !uri.endsWith(".md") || /[%?#\\\u0000-\u001f\u007f]/u.test(uri)) return false;
	return uri.slice(root.length + 1).split("/").every((part) => part !== "" && !part.startsWith(".") && part.trim() === part);
}
function queueFailed(value) {
	return Object.values(object(value) ?? {}).some((entry) => {
		const queue = object(entry);
		return (number(queue?.error_count) ?? 0) > 0 || Array.isArray(queue?.errors) && queue.errors.length > 0;
	});
}
/** What a folder holds, for files written before the category was in the name or by OpenViking itself. */
const FOLDER_CATEGORIES = {
	preferences: "preference",
	experiences: "insight",
	events: "context",
	entities: "fact"
};
/** The category in the file name Mnemon wrote, else one the server reports, else the folder's. */
function categoryFromUri(uri, reported) {
	const named = /_([a-z]+)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.md$/u.exec(uri)?.[1];
	if (named !== void 0 && CATEGORY_NAMES.has(named)) return named;
	const stated = string(reported);
	if (stated !== void 0 && CATEGORY_NAMES.has(stated)) return stated;
	const marker = "/memories/";
	const folder = (uri.includes(marker) ? uri.slice(uri.indexOf(marker) + 10) : "").split("/")[0] ?? "";
	return Object.hasOwn(FOLDER_CATEGORIES, folder) ? FOLDER_CATEGORIES[folder] : "general";
}
/** Whether the server turned the request down as sent, so it wrote nothing: not a timeout or a server fault. */
function refused(error) {
	const status = error?.status;
	return typeof status === "number" && status >= 400 && status < 500 && status !== 408 && status !== 409;
}
var OpenVikingProvider = class {
	memorySpaces;
	id = "openviking";
	scoreSemantics = Object.freeze({ kind: "provider-native" });
	requestFetch;
	requestTimeoutMs;
	constructor(memorySpaces, options = {}) {
		this.memorySpaces = memorySpaces;
		this.requestFetch = options.fetch ?? globalThis.fetch;
		this.requestTimeoutMs = options.requestTimeoutMs ?? 15e3;
	}
	async discover(connection, signal) {
		signal?.throwIfAborted();
		let account = String(connection.account ?? "").trim();
		const selectedUser = discoveryUser(connection);
		if (selectedUser !== void 0) {
			const targetUri = await this.validateUserNamespace(connection, selectedUser, signal);
			return [{
				externalId: `${account}:${selectedUser}`,
				name: selectedUser,
				description: `OpenViking memory namespace for ${selectedUser}`,
				connection: {
					targetUri,
					user: selectedUser,
					actorPeerId: "dsh"
				}
			}];
		}
		if (account === "") {
			const accounts = await this.requestConnection(connection, "/api/v1/admin/accounts", {}, { signal });
			const ids = (Array.isArray(accounts) ? accounts : []).flatMap((value) => {
				const id = string(object(value)?.account_id) ?? string(object(value)?.id);
				return id === void 0 ? [] : [id];
			});
			if (ids.length > 1) throw new Error("OpenViking exposes multiple accounts; configure the account to select one discovery scope");
			account = ids[0] ?? "default";
		}
		const users = await this.requestConnection({
			...connection,
			account
		}, `/api/v1/admin/accounts/${encodeURIComponent(account)}/users?limit=100`, {}, { signal });
		return (Array.isArray(users) ? users : []).flatMap((value) => {
			const item = object(value);
			const user = string(item?.user_id) ?? string(item?.id) ?? string(item?.name);
			if (user === void 0 || !safeUser(user)) return [];
			return [{
				externalId: `${account}:${user}`,
				name: string(item?.display_name) ?? string(item?.name) ?? user,
				description: string(item?.description) ?? string(item?.role) ?? `OpenViking memory namespace for ${user}`,
				connection: {
					targetUri: `viking://user/${user}/memories`,
					user,
					actorPeerId: "dsh"
				}
			}];
		});
	}
	async status(body, signal) {
		try {
			const connection = this.connection(body);
			const selectedUser = discoveryUser(connection);
			if (selectedUser === void 0) await this.request(body, "/health", {}, {
				signal,
				timeoutMs: 5e3
			});
			else {
				await this.memoryRoot(body, signal);
				await this.validateUserNamespace(connection, selectedUser, signal);
			}
			return { healthy: true };
		} catch (error) {
			return {
				healthy: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	async search(body, request, signal) {
		const keyword = request.mode === "keyword";
		signal?.throwIfAborted();
		if (keyword && request.query.trim() === "") return { results: [] };
		const limit = keyword ? Math.min(50, Math.max(1, Math.floor(number(request.limit) ?? 10))) : request.limit;
		const memoryRoot = await this.memoryRoot(body, signal);
		const root = object(await this.request(body, keyword ? "/api/v1/search/grep" : "/api/v1/search/find", {
			method: "POST",
			body: JSON.stringify(keyword ? {
				uri: memoryRoot,
				pattern: request.query.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
				case_insensitive: true,
				node_limit: limit
			} : {
				query: request.query,
				target_uri: memoryRoot,
				context_type: ["memory"],
				limit: request.limit
			})
		}, { signal }));
		if (keyword && !Array.isArray(root?.matches)) throw new Error("OpenViking keyword search did not return matches");
		const values = keyword ? root?.matches : root?.memories;
		const entries = Array.isArray(values) ? values : [];
		const seen = /* @__PURE__ */ new Set();
		const matches = entries.flatMap((value) => {
			const item = object(value);
			const uri = string(item?.uri);
			if (uri === void 0 || !isMemoryFile(uri, memoryRoot)) return [];
			if (keyword && seen.has(uri)) return [];
			seen.add(uri);
			const score = keyword ? void 0 : number(item?.score);
			return [{
				id: uri,
				externalUri: uri,
				content: string(item?.overview) ?? string(item?.abstract) ?? uri,
				category: categoryFromUri(uri, item?.category),
				source: "external",
				...score === void 0 ? {} : { score }
			}];
		}).slice(0, limit);
		const { read, skipped } = await this.readAll(body, matches, signal);
		return {
			results: read,
			...skipped === 0 ? {} : { hint: `${skipped} OpenViking ${skipped === 1 ? "result" : "results"} could not be read and ${skipped === 1 ? "was" : "were"} left out; the server can list a file it no longer holds.` }
		};
	}
	async graph(body, signal) {
		return {
			nodes: (await this.list(body, { limit: 200 }, signal)).map((item) => ({
				...item,
				color: "#5568d9"
			})),
			edges: [],
			generatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	}
	async list(body, request, signal) {
		const memoryRoot = await this.memoryRoot(body, signal);
		const query = new URLSearchParams({
			uri: memoryRoot,
			recursive: "true",
			output: "original"
		});
		const result = await this.request(body, `/api/v1/fs/ls?${query}`, {}, { signal });
		const entries = Array.isArray(result) ? result : [];
		const limit = Math.min(Math.max(request.limit ?? 200, 1), 1e3);
		const files = entries.flatMap((value) => {
			const item = object(value);
			const uri = string(item?.uri);
			return item === void 0 || uri === void 0 || item.isDir === true || !isMemoryFile(uri, memoryRoot) ? [] : [{
				item,
				uri
			}];
		}).slice(0, limit);
		const { read } = await this.readAll(body, files.map(({ item, uri }) => ({
			id: uri,
			item
		})), signal);
		return read.map(({ item, id, content }) => {
			const createdAt = string(item.modTime);
			return {
				id,
				externalUri: id,
				content,
				category: categoryFromUri(id),
				source: "external",
				...createdAt === void 0 ? {} : { createdAt }
			};
		});
	}
	/**
	* Each listed memory with its full content, leaving out one the server cannot read: its index
	* can still list a file it no longer holds. When none can be read, the first failure is the
	* answer, so a server that cannot be reached is never shown as an empty space, and a cancelled
	* turn stops at once.
	*/
	async readAll(body, items, signal) {
		const settled = await Promise.allSettled(items.map(async (item) => ({
			...item,
			content: await this.readContent(body, item.id, signal)
		})));
		signal?.throwIfAborted();
		const read = settled.flatMap((outcome) => outcome.status === "fulfilled" ? [outcome.value] : []);
		const failed = settled.find((outcome) => outcome.status === "rejected");
		if (read.length === 0 && failed !== void 0) throw failed.reason;
		return {
			read,
			skipped: settled.length - read.length
		};
	}
	async remember(body, request, signal) {
		const root = await this.memoryRoot(body, signal);
		const category = categoryOf(request.category);
		const uri = memoryUri(root, category, request.content);
		const tags = ["source=mnemon", `category=${category}`];
		const importance = number(request.importance);
		if (importance !== void 0) tags.push(`importance=${importance}`);
		const writtenBytes = Buffer.byteLength(request.content, "utf8");
		let written;
		try {
			written = object(await this.request(body, "/api/v1/content/write", {
				method: "POST",
				body: JSON.stringify({
					uri,
					content: request.content,
					mode: "create",
					wait: true
				})
			}, { signal }));
		} catch (error) {
			if (refused(error)) throw new Error(`OpenViking refused the write at ${uri}; nothing was stored. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
			throw new Error(`OpenViking write was not verified at ${uri}; remote content may remain. Inspect this URI before retrying. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
		}
		try {
			if (written?.uri !== uri || written.content_updated !== true || (number(written.written_bytes) ?? -1) < writtenBytes || written.mode !== "create" || written.context_type !== "memory" || written.vector_status !== "complete" || !["complete", "skipped"].includes(String(written.semantic_status)) || queueFailed(written.queue_status)) throw new Error("content API did not confirm this exact memory and completed indexing");
			if (await this.readContent(body, uri, signal) !== request.content) throw new Error("stored content does not match the requested text");
			signal?.throwIfAborted();
		} catch (error) {
			throw new Error(`OpenViking write was not verified at ${uri}; remote content may remain. Inspect this URI before retrying. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
		}
		return {
			action: "stored",
			provider: "openviking",
			id: uri,
			uri,
			externalUri: uri,
			summary: `OpenViking stored the memory at ${uri} (category ${category}).`,
			writtenBytes,
			vectorStatus: "complete",
			tagsApplied: await this.tag(body, uri, tags, signal)
		};
	}
	/**
	* Label a verified memory. Tags only describe it - its category is in the URI too - so a server
	* without the endpoint, one that refuses or does not confirm the call, or one that is slow to
	* answer leaves an exact memory that is just untagged. The wait is short, as for `/health`:
	* the receipt is already true.
	*/
	async tag(body, uri, tags, signal) {
		try {
			return object(await this.request(body, "/api/v1/content/set_tags", {
				method: "POST",
				body: JSON.stringify({
					uri,
					tags,
					mode: "replace"
				})
			}, {
				signal,
				timeoutMs: Math.min(this.requestTimeoutMs, 5e3)
			}))?.tags_updated === true;
		} catch {
			return false;
		}
	}
	async forget(body, id, signal) {
		const root = await this.memoryRoot(body, signal);
		const uri = id.trim();
		if (!isMemoryFile(uri, root)) throw new Error("OpenViking forget requires an exact non-generated .md memory URI inside this Memory Space");
		const query = new URLSearchParams({
			uri,
			recursive: "false"
		});
		const result = object(await this.request(body, `/api/v1/fs?${query}`, { method: "DELETE" }, { signal })) ?? {};
		if (result.uri !== uri) throw new Error("OpenViking did not confirm deletion of the requested memory URI");
		return {
			action: "deleted",
			provider: this.id,
			id: uri,
			uri,
			...number(result.estimated_deleted_count) === void 0 ? {} : { estimatedDeletedCount: number(result.estimated_deleted_count) }
		};
	}
	connection(body) {
		if ((body.provider.typeId ?? body.provider.id) !== this.id) throw new Error(`OpenViking cannot serve provider ${body.provider.id}`);
		const connection = this.memorySpaces.providerConnection(body.id, body.provider.id);
		return {
			endpoint: String(connection.endpoint ?? ""),
			targetUri: String(connection.targetUri ?? ""),
			apiKey: String(connection.apiKey ?? ""),
			account: String(connection.account ?? ""),
			user: String(connection.user ?? ""),
			actorPeerId: String(connection.actorPeerId ?? ""),
			discoveryUser: String(connection.discoveryUser ?? "")
		};
	}
	async validateUserNamespace(connection, user, signal) {
		const root = `viking://user/${user}/memories`;
		const query = new URLSearchParams({
			uri: root,
			recursive: "false",
			output: "original"
		});
		const result = await this.requestConnection(connection, `/api/v1/fs/ls?${query}`, {}, { signal });
		if (!Array.isArray(result) || result.some((item) => !string(object(item)?.uri)?.startsWith(`${root}/`))) throw new Error("OpenViking could not validate the selected memory namespace");
		return root;
	}
	async memoryRoot(body, signal) {
		signal?.throwIfAborted();
		const connection = this.connection(body);
		const root = connection.targetUri.replace(/\/+$/u, "");
		const match = /^viking:\/\/user(?:\/([^/]+))?\/memories$/u.exec(root);
		if (match === null || match[1] !== void 0 && !safeUser(match[1])) throw new Error("OpenViking memory URI must be a safe viking://user/<user>/memories root");
		const selectedUser = discoveryUser(connection);
		if (selectedUser !== void 0) {
			if (match[1] !== void 0 && match[1] !== selectedUser || connection.user?.trim() && connection.user.trim() !== selectedUser) throw new Error("OpenViking memory owner must match the configured discovery user");
			return `viking://user/${selectedUser}/memories`;
		}
		if (match[1] !== void 0) return root;
		const user = connection.user?.trim() || string(object(await this.request(body, "/api/v1/system/status", {}, { signal }))?.user) || "";
		if (!safeUser(user)) throw new Error("OpenViking could not resolve the memory owner; configure an explicit user memory URI");
		return `viking://user/${user}/memories`;
	}
	async readContent(body, uri, signal) {
		const result = await this.request(body, `/api/v1/content/read?${new URLSearchParams({ uri })}`, {}, { signal });
		if (typeof result !== "string") throw new Error("OpenViking content read did not return text");
		return result;
	}
	async request(body, path, init = {}, options = {}) {
		const connection = this.connection(body);
		return this.requestConnection(connection, path, init, options);
	}
	async requestConnection(connection, path, init = {}, options = {}) {
		options.signal?.throwIfAborted();
		const keyBound = discoveryUser(connection) !== void 0;
		const controller = new AbortController();
		const relay = () => controller.abort(options.signal?.reason);
		options.signal?.addEventListener("abort", relay, { once: true });
		const timer = setTimeout(() => controller.abort(/* @__PURE__ */ new Error("OpenViking request timed out")), options.timeoutMs ?? this.requestTimeoutMs);
		try {
			const response = await this.requestFetch(`${connection.endpoint}${path}`, {
				...init,
				headers: {
					"Content-Type": "application/json",
					...connection.apiKey === void 0 || connection.apiKey === "" ? {} : { Authorization: `Bearer ${connection.apiKey}` },
					...keyBound || connection.account === void 0 || connection.account === "" ? {} : { "X-OpenViking-Account": String(connection.account) },
					...keyBound || connection.user === void 0 || connection.user === "" ? {} : { "X-OpenViking-User": String(connection.user) },
					...connection.actorPeerId === void 0 || connection.actorPeerId === "" ? {} : { "X-OpenViking-Actor-Peer": String(connection.actorPeerId) },
					...init.headers
				},
				signal: controller.signal
			});
			const envelope = await response.json().catch(() => ({}));
			if (!response.ok || envelope.status === "error") {
				const trace = envelope.error?.trace_id ?? envelope.trace_id;
				throw Object.assign(/* @__PURE__ */ new Error(`${envelope.error?.message ?? `OpenViking HTTP ${response.status}`}${trace === void 0 ? "" : ` (trace ${trace})`}`), { status: response.status });
			}
			return envelope.result ?? envelope;
		} catch (error) {
			if (controller.signal.aborted && options.signal?.aborted !== true) throw new Error(`OpenViking request timed out after ${options.timeoutMs ?? this.requestTimeoutMs}ms`);
			throw error;
		} finally {
			clearTimeout(timer);
			options.signal?.removeEventListener("abort", relay);
		}
	}
};
//#endregion
//#region src/index.ts
const definition = defineMemorySpaceProviderDefinition({
	manifest: {
		apiVersion: MEMORY_SPACE_PROVIDER_API_VERSION,
		kind: "provider",
		typeId: descriptor.id,
		packageName: "dsh-mnemon-provider-openviking",
		version: "0.5.10",
		label: descriptor.label,
		icon: descriptor.icon,
		summary: descriptor.summary,
		...descriptor.summaryI18nKey === void 0 ? {} : { summaryI18nKey: descriptor.summaryI18nKey },
		origin: descriptor.origin,
		locality: descriptor.kind,
		workspaceBinding: descriptor.workspaceBinding,
		capabilities: descriptor.capabilities,
		fields: descriptor.fields,
		secrets: descriptor.fields.filter((field) => field.input === "secret").map((field) => field.key),
		scoreSemantics: "provider-native"
	},
	create: (context) => new OpenVikingProvider(context.memorySpaces ?? context.memoryBodies, { requestTimeoutMs: context.config.timeoutMs })
});
var src_default = defineMemorySpaceProvider({
	id: descriptor.id,
	apply(ctx, host) {
		host.install(ctx, definition);
	}
});
//#endregion
export { OpenVikingProvider, src_default as default, definition, descriptor };
