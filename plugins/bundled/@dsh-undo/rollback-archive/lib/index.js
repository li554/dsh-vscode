import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Service } from "@deepseek-ai/cordis";
import s from "@deepseek-ai/schemastery";
import { foldSessionTitle } from "@deepseek-ai/dsh-session-title";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region lib/types/index.js
/**
* Session archive capability (standalone plugin): the one owner of archive
* listing, read-only viewing, and tombstone hiding. Restoration and permanent
* deletion are intentionally absent — dsh publishes no unarchive or
* delete/removeImage API, so this plugin degrades those original-spec
* operations to a plugin-owned tombstone list.
* @module @dsh-undo/rollback-archive
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Host Provider for the global archive set and the plugin-owned tombstone list. */
let DefaultSessionArchiveService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _tombstone_decorators;
	let _untombstone_decorators;
	let _restore_decorators;
	let _delete_decorators;
	let _deleteAll_decorators;
	let _list_decorators;
	let _read_decorators;
	return class DefaultSessionArchiveService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_tombstone_decorators = [Remote("tombstone")];
			_untombstone_decorators = [Remote("untombstone")];
			_restore_decorators = [Remote("restore")];
			_delete_decorators = [Remote("delete")];
			_deleteAll_decorators = [Remote("deleteAll")];
			_list_decorators = [Remote("list")];
			_read_decorators = [Remote("read")];
			__esDecorate(this, null, _tombstone_decorators, {
				kind: "method",
				name: "tombstone",
				static: false,
				private: false,
				access: {
					has: (obj) => "tombstone" in obj,
					get: (obj) => obj.tombstone
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _untombstone_decorators, {
				kind: "method",
				name: "untombstone",
				static: false,
				private: false,
				access: {
					has: (obj) => "untombstone" in obj,
					get: (obj) => obj.untombstone
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _restore_decorators, {
				kind: "method",
				name: "restore",
				static: false,
				private: false,
				access: {
					has: (obj) => "restore" in obj,
					get: (obj) => obj.restore
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _delete_decorators, {
				kind: "method",
				name: "delete",
				static: false,
				private: false,
				access: {
					has: (obj) => "delete" in obj,
					get: (obj) => obj.delete
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deleteAll_decorators, {
				kind: "method",
				name: "deleteAll",
				static: false,
				private: false,
				access: {
					has: (obj) => "deleteAll" in obj,
					get: (obj) => obj.deleteAll
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _read_decorators, {
				kind: "method",
				name: "read",
				static: false,
				private: false,
				access: {
					has: (obj) => "read" in obj,
					get: (obj) => obj.read
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = [
			"agents",
			"sessionPersistence",
			"sessions",
			"sessionFork",
			"workspaceRegistry"
		];
		static Config = s.object({ root: s.string().min(1).required() });
		archiveTimes = (__runInitializers(this, _instanceExtraInitializers), /* @__PURE__ */ new Map());
		archiveTimesPath;
		tombstones = /* @__PURE__ */ new Set();
		tombstonesPath;
		constructor(ctx, config) {
			super(ctx, "sessionArchive");
			this.archiveTimesPath = join(resolve(config.root), "archive-times.json");
			this.tombstonesPath = join(resolve(config.root), "tombstones.json");
		}
		/** Load archive timestamps and tombstones before serving the archive collection. */
		async [Service.init]() {
			await mkdir(dirname(this.archiveTimesPath), { recursive: true });
			await this.loadDocument(this.archiveTimesPath, (parsed) => {
				if (!isArchiveTimesFile(parsed)) throw new Error("rollback archive: archive timestamp file is invalid");
				for (const [id, archivedAt] of Object.entries(parsed.archivedAt)) this.archiveTimes.set(id, archivedAt);
			});
			await this.loadDocument(this.tombstonesPath, (parsed) => {
				if (!isTombstonesFile(parsed)) throw new Error("rollback archive: tombstone file is invalid");
				for (const id of parsed.sessionIds) this.tombstones.add(id);
			});
		}
		/** Add one Session to the Host archive set. */
		async archive(sessionId) {
			if (this.ctx.workspaceRegistry.archivedSessionIds.includes(sessionId)) return;
			const prior = this.archiveTimes.get(sessionId);
			await this.setArchiveTime(sessionId, Date.now());
			try {
				await this.ctx.workspaceRegistry.archiveSession(sessionId);
			} catch (error) {
				try {
					await this.setArchiveTime(sessionId, prior);
				} catch (rollbackError) {
					throw new AggregateError([error, rollbackError], `rollback archive could not restore timestamp for "${sessionId}" after archiving failed`);
				}
				throw error;
			}
		}
		/** Hide one archived Session from the archive task list without touching its log. */
		async tombstone(sessionId) {
			if (!this.ctx.workspaceRegistry.archivedSessionIds.includes(sessionId)) return this.failure("not-archived", `session "${sessionId}" is not archived`);
			if (!this.tombstones.has(sessionId)) {
				this.tombstones.add(sessionId);
				await this.writeTombstones();
			}
			return this.success({ changed: true });
		}
		/** Reveal one tombstoned Session in the archive task list again. */
		async untombstone(sessionId) {
			if (this.tombstones.delete(sessionId)) await this.writeTombstones();
			return this.success({ changed: true });
		}
		/** Restore one archived conversation as a new visible Session without touching its log.
		* @param request - Archived Session to restore.
		* @returns The replacement Session or a business refusal.
		*/
		async restore(request) {
			if (!this.ctx.workspaceRegistry.archivedSessionIds.includes(request.sessionId)) return this.failure("not-archived", `session "${request.sessionId}" is not archived`);
			try {
				const restored = await this.ctx.sessionFork.fork({
					sourceSessionId: request.sessionId,
					cut: { kind: "completed-turn" }
				});
				return this.success({
					changed: true,
					sessionId: restored.handle.agent.id
				});
			} catch (error) {
				return this.failure("session-live", `session "${request.sessionId}" could not be restored: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		/** Permanently delete an archived Session's log files and hide it from the task list.
		* @param request - Archived Session to erase.
		* @returns Permanent-deletion mutation result.
		*/
		async delete(request) {
			if (!this.ctx.workspaceRegistry.archivedSessionIds.includes(request.sessionId)) return this.failure("not-archived", `session "${request.sessionId}" is not archived`);
			const agent = this.ctx.agents.get(request.sessionId);
			let status = agent?.status ?? "idle";
			if (status !== "idle") {
				agent?.cancel({ kind: "user" });
				const deadline = Date.now() + 2e3;
				while (status !== "idle" && Date.now() < deadline) {
					await new Promise((resolve) => {
						setTimeout(resolve, 50);
					});
					status = this.ctx.agents.get(request.sessionId)?.status ?? "idle";
				}
				if (status !== "idle") return this.failure("session-live", `session "${request.sessionId}" is still running and cannot be permanently deleted`);
			}
			const header = (await this.headers()).get(request.sessionId);
			const location = header === void 0 ? void 0 : this.ctx.sessionPersistence.locate(header);
			if (location === void 0) return this.failure("backend-unsupported", "this session backend does not expose a deletable artifact");
			try {
				await rm(dirname(location.path), {
					recursive: true,
					force: true
				});
			} catch (error) {
				return this.failure("backend-unsupported", `session "${request.sessionId}" log deletion failed: ${error instanceof Error ? error.message : String(error)}`);
			}
			await this.setArchiveTime(request.sessionId, void 0);
			await this.tombstone(request.sessionId);
			return this.success({ changed: true });
		}
		/** Permanently delete every non-tombstoned archived Session.
		* @returns Per-Session outcomes; individual refusals do not stop the sweep.
		*/
		async deleteAll() {
			const deleted = [];
			const failed = [];
			for (const sessionId of this.ctx.workspaceRegistry.archivedSessionIds) {
				if (this.tombstones.has(sessionId)) continue;
				const result = await this.delete({ sessionId });
				if (result.ok) deleted.push(sessionId);
				else failed.push({
					sessionId,
					message: result.error.message
				});
			}
			return {
				deleted,
				failed
			};
		}
		/** Whether one Session is currently hidden from the archive task list. */
		isTombstoned(sessionId) {
			return this.tombstones.has(sessionId);
		}
		/** List the Host archive set with persisted metadata for the archive task UI.
		* @returns Archive metadata for every currently archived, non-tombstoned Session.
		*/
		async list() {
			const headers = await this.headers();
			const items = [];
			for (const sessionId of this.ctx.workspaceRegistry.archivedSessionIds) {
				if (this.tombstones.has(sessionId)) continue;
				const header = headers.get(sessionId);
				if (header === void 0) continue;
				const title = titleOf(await this.events(sessionId));
				items.push({
					sessionId,
					...title === void 0 ? {} : { title },
					archivedAt: this.archiveTimes.get(sessionId) ?? header.createdAt,
					createdAt: header.createdAt,
					...header.cwd === void 0 ? {} : { cwd: header.cwd }
				});
			}
			return { items };
		}
		/** Read one archived Session without making it visible to ordinary navigation.
		* @param request - Archived Session to read.
		* @returns Text transcript and metadata without navigation changes.
		*/
		async read(request) {
			if (!this.ctx.workspaceRegistry.archivedSessionIds.includes(request.sessionId)) return this.failure("not-archived", `session "${request.sessionId}" is not archived`);
			const events = await this.events(request.sessionId);
			const title = titleOf(events);
			return this.success({
				sessionId: request.sessionId,
				...title === void 0 ? {} : { title },
				messages: transcript(events)
			});
		}
		/** Combine persisted and live headers; live identities win over a stale durable listing. */
		async headers() {
			const headers = new Map((await this.ctx.sessionPersistence.list()).map((header) => [header.id, header]));
			for (const session of this.ctx.sessions.list()) headers.set(session.id, session.header);
			return headers;
		}
		/** Read the authoritative event list regardless of whether the Session is currently loaded. */
		async events(sessionId) {
			return this.ctx.sessions.get(sessionId)?.events ?? (await this.ctx.sessionPersistence.inspect(sessionId)).events;
		}
		/** Change one timestamp and persist the complete plugin-owned document. */
		async setArchiveTime(sessionId, archivedAt) {
			const prior = this.archiveTimes.get(sessionId);
			if (archivedAt === void 0) this.archiveTimes.delete(sessionId);
			else this.archiveTimes.set(sessionId, archivedAt);
			try {
				await this.writeDocument(this.archiveTimesPath, {
					version: 1,
					archivedAt: Object.fromEntries(this.archiveTimes)
				});
			} catch (error) {
				if (prior === void 0) this.archiveTimes.delete(sessionId);
				else this.archiveTimes.set(sessionId, prior);
				throw error;
			}
		}
		/** Persist the complete tombstone document. */
		async writeTombstones() {
			await this.writeDocument(this.tombstonesPath, {
				version: 1,
				sessionIds: [...this.tombstones]
			});
		}
		/** Load one optional plugin-owned document. */
		async loadDocument(path, accept) {
			try {
				accept(JSON.parse(await readFile(path, "utf8")));
			} catch (error) {
				if (!isENOENT(error)) throw error;
			}
		}
		/** Atomically replace one plugin-owned JSON document. */
		async writeDocument(path, value) {
			await mkdir(dirname(path), { recursive: true });
			const temporary = `${path}.${randomBytes(6).toString("hex")}.tmp`;
			await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
			try {
				await renameWithRetry(temporary, path);
			} catch (error) {
				await rm(temporary, { force: true });
				throw error;
			}
		}
		/** Make one immutable success result. */
		success(value) {
			return {
				ok: true,
				value
			};
		}
		/** Make one expected archive-task refusal. */
		failure(code, message) {
			return {
				ok: false,
				error: {
					code,
					message
				}
			};
		}
	};
})();
/** Find a persisted title without consulting live title-service state. */
function titleOf(events) {
	return foldSessionTitle(events)?.title;
}
/** Retry `rename` on transient Windows locks (Defender, file indexers). */
async function renameWithRetry(from, to, retries = 5) {
	for (let attempt = 0;; attempt++) try {
		await rename(from, to);
		return;
	} catch (error) {
		const code = error.code;
		if (attempt < retries && (code === "EPERM" || code === "EBUSY" || code === "EACCES")) {
			await new Promise((resolve) => {
				setTimeout(resolve, 100 * (attempt + 1));
			});
			continue;
		}
		throw error;
	}
}
/** Preserve ordinary text exchange for the archive viewer; tool payloads remain outside this presentation. */
function transcript(events) {
	const messages = [];
	for (const event of events) switch (event.type) {
		case "user/message": {
			const text = textContent(event.data.content);
			if (text.length > 0) messages.push({
				role: "user",
				text
			});
			break;
		}
		case "assistant/message": {
			const text = textContent(event.data.message.content);
			if (text.length > 0) messages.push({
				role: "assistant",
				text
			});
			break;
		}
	}
	return messages;
}
/** Join direct text content without exposing attachments or tool-result payloads in the archive viewer. */
function textContent(content) {
	return content.filter((block) => block.type === "text").map((block) => block.text).join("");
}
/** Validate the small plugin-owned timestamp document before mutating archive membership. */
function isArchiveTimesFile(value) {
	if (value === null || typeof value !== "object") return false;
	const candidate = value;
	if (candidate.version !== 1 || candidate.archivedAt === null || typeof candidate.archivedAt !== "object") return false;
	return Object.values(candidate.archivedAt).every((timestamp) => typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp >= 0);
}
/** Validate the small plugin-owned tombstone document. */
function isTombstonesFile(value) {
	if (value === null || typeof value !== "object") return false;
	const candidate = value;
	if (candidate.version !== 1 || !Array.isArray(candidate.sessionIds)) return false;
	return candidate.sessionIds.every((id) => typeof id === "string" && id.length > 0);
}
/** Identify an absent optional metadata document without swallowing other I/O failures. */
function isENOENT(error) {
	return error?.code === "ENOENT";
}
//#endregion
export { DefaultSessionArchiveService, DefaultSessionArchiveService as default };
