import { createHash, randomBytes, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Service } from "@deepseek-ai/cordis";
import s from "@deepseek-ai/schemastery";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { spawn } from "node:child_process";
import { z } from "zod";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
//#region lib/types/shadow-git.js
/** Private shadow-Git snapshots for one supported workspace. */
/** Paths above this many keep the command line inside the Windows limit; larger change sets fall back to a full checkout. */
const MAX_RESTORE_PATHS = 400;
const MAX_DIFF_PREVIEW_CHARS = 12e3;
/** Execute Git with the journal-owned directory and index, never the user's index. */ async function git(workspace, shadowGit, args, options = {}) {
	return await new Promise((resolveResult, reject) => {
		const child = spawn("git", [...args], {
			cwd: workspace,
			windowsHide: true,
			env: options.shadow === false ? process.env : {
				...process.env,
				GIT_DIR: shadowGit,
				GIT_WORK_TREE: workspace,
				GIT_INDEX_FILE: `${shadowGit}/index`
			},
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		const stdout = [];
		const stderr = [];
		child.stdout.on("data", (chunk) => {
			stdout.push(chunk);
		});
		child.stderr.on("data", (chunk) => {
			stderr.push(chunk);
		});
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (code === 0) {
				resolveResult(Buffer.concat(stdout).toString("utf8"));
				return;
			}
			reject(/* @__PURE__ */ new Error(`conversation-undo: git ${args.join(" ")} failed (${signal ?? code}): ${Buffer.concat(stderr).toString("utf8").trim()}`));
		});
	});
}
/** Ensure a candidate path stays below the workspace root. */
function workspacePath(workspace, path) {
	const root = resolve(workspace);
	const target = resolve(root, path);
	if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error(`conversation-undo: Git returned a path outside the workspace: ${path}`);
	return target;
}
/** Reject non-worktree paths before an operation can restore files.
* @param workspace - Candidate worktree root.
* @returns Resolution only for a supported non-bare, submodule-free worktree.
*/
async function assertSupportedWorkspace(workspace) {
	if (await new Promise((resolveResult, reject) => {
		const child = spawn("git", [
			"rev-parse",
			"--is-inside-work-tree",
			"--is-bare-repository"
		], {
			cwd: workspace,
			windowsHide: true,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		const out = [];
		child.stdout.on("data", (chunk) => {
			out.push(chunk);
		});
		child.once("error", reject);
		child.once("exit", (code) => code === 0 ? resolveResult(Buffer.concat(out).toString("utf8").trim()) : reject(/* @__PURE__ */ new Error(`conversation-undo: '${workspace}' is not a Git worktree`)));
	}) !== "true\nfalse") throw new Error(`conversation-undo: '${workspace}' is not a normal Git worktree`);
	if ((await git(workspace, "", ["ls-files", "--stage"], { shadow: false })).split("\n").some((entry) => entry.startsWith("160000 "))) throw new Error(`conversation-undo: '${workspace}' contains submodules`);
}
/** Per-journal Git repository holding trees without touching user refs, commits, or index. */
var ShadowGit = class {
	workspace;
	shadowGit;
	constructor(workspace, shadowGit) {
		this.workspace = workspace;
		this.shadowGit = shadowGit;
	}
	async capture() {
		await this.ensure();
		await git(this.workspace, this.shadowGit, [
			"add",
			"--all",
			"--",
			"."
		]);
		const tree = (await git(this.workspace, this.shadowGit, ["write-tree"])).trim();
		if (!/^[0-9a-f]{40,64}$/.test(tree)) throw new Error("conversation-undo: Git returned an invalid tree id");
		return tree;
	}
	/** Restore an exact tree, deleting only paths captured in `from` but absent from `target`.
	* @param target - Private tree to materialize.
	* @param from - Prior private tree defining removable captured paths.
	*/
	async restore(target, from) {
		await this.ensure();
		const tokens = (await git(this.workspace, this.shadowGit, [
			"diff-tree",
			"-r",
			"-z",
			"--no-renames",
			"--no-commit-id",
			"--name-status",
			String(from),
			String(target)
		])).split("\0");
		const deletions = [];
		const updates = [];
		for (let i = 0; i + 1 < tokens.length; i += 2) {
			const status = tokens[i];
			const path = tokens[i + 1];
			if (status === void 0 || path === void 0 || path === "") continue;
			if (status === "D") deletions.push(path);
			else updates.push(path);
		}
		for (const path of deletions) await this.removeCapturedPath(path);
		await git(this.workspace, this.shadowGit, ["read-tree", String(target)]);
		if (updates.length === 0) return;
		await git(this.workspace, this.shadowGit, updates.length > MAX_RESTORE_PATHS ? [
			"checkout-index",
			"--all",
			"--force"
		] : [
			"checkout-index",
			"--force",
			"--",
			...updates
		]);
	}
	/** List Git-supported paths changed between two private trees without touching the workspace. */
	async changes(from, target) {
		await this.ensure();
		const tokens = (await git(this.workspace, this.shadowGit, [
			"diff-tree",
			"-r",
			"-z",
			"--no-renames",
			"--no-commit-id",
			"--name-status",
			String(from),
			String(target)
		])).split("\0");
		const changes = [];
		for (let index = 0; index + 1 < tokens.length; index += 2) {
			const code = tokens[index];
			const path = tokens[index + 1];
			if (code === void 0 || path === void 0 || path === "") continue;
			const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
			const [beforeBytes, afterBytes] = await Promise.all([status === "added" ? Promise.resolve(0) : this.blobSize(from, path), status === "deleted" ? Promise.resolve(0) : this.blobSize(target, path)]);
			changes.push({
				path,
				status,
				addedBytes: Math.max(0, afterBytes - beforeBytes),
				deletedBytes: Math.max(0, beforeBytes - afterBytes)
			});
		}
		return changes;
	}
	/** Return a bounded unified patch for one captured path without touching the workspace. */
	async diffPreview(from, target, path) {
		await this.ensure();
		const patch = await git(this.workspace, this.shadowGit, [
			"-c",
			"core.quotePath=false",
			"diff",
			"--no-ext-diff",
			"--no-color",
			"--unified=3",
			String(from),
			String(target),
			"--",
			path
		]);
		if (patch === "") return void 0;
		return patch.length <= MAX_DIFF_PREVIEW_CHARS ? patch : `${patch.slice(0, MAX_DIFF_PREVIEW_CHARS)}\n… 此文件的 diff 预览已截断。`;
	}
	/** Check whether the worktree exactly matches one private tree, without capturing it.
	* @param tree - Private tree to compare the worktree against.
	* @returns Whether every tracked path matches and no untracked path exists.
	*/
	async verifyMatches(tree) {
		await this.ensure();
		try {
			await git(this.workspace, this.shadowGit, [
				"diff",
				"--quiet",
				String(tree)
			]);
		} catch {
			return false;
		}
		return (await git(this.workspace, this.shadowGit, [
			"ls-files",
			"-o",
			"--exclude-standard"
		])).length === 0;
	}
	/** Refresh the index stat cache so a later {@link verifyMatches} skips the full-worktree stat pass. */
	async refreshStats() {
		await this.ensure();
		await git(this.workspace, this.shadowGit, ["update-index", "--refresh"]);
	}
	async ensure() {
		await mkdir(dirname(this.shadowGit), { recursive: true });
		try {
			await stat(`${this.shadowGit}/config`);
		} catch {
			await mkdir(this.shadowGit, { recursive: true });
			await git(this.workspace, this.shadowGit, [
				"init",
				"--bare",
				this.shadowGit
			], { shadow: false });
			await git(this.workspace, this.shadowGit, [
				"config",
				"core.bare",
				"false"
			]);
			await git(this.workspace, this.shadowGit, [
				"config",
				"core.autocrlf",
				"false"
			]);
			await git(this.workspace, this.shadowGit, [
				"config",
				"core.untrackedCache",
				"true"
			]);
			await git(this.workspace, this.shadowGit, [
				"config",
				"core.splitIndex",
				"true"
			]);
		}
	}
	/** Read one private-tree blob's byte size without materialising it in the worktree. */
	async blobSize(tree, path) {
		const value = (await git(this.workspace, this.shadowGit, [
			"cat-file",
			"-s",
			`${String(tree)}:${path}`
		])).trim();
		const size = Number(value);
		if (!Number.isSafeInteger(size) || size < 0) throw new Error(`conversation-undo: Git returned an invalid blob size for ${path}`);
		return size;
	}
	async removeCapturedPath(path) {
		const target = workspacePath(this.workspace, path);
		try {
			const info = await lstat(target);
			if (info.isDirectory() && !info.isSymbolicLink()) await rm(target, {
				recursive: true,
				force: true
			});
			else await rm(target, { force: true });
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
};
/** Atomically replace a JSON record in the plugin-owned data directory.
* @param path - Plugin-owned JSON target path.
* @param value - JSON-serializable record to replace atomically.
*/
async function writeJson(path, value) {
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
/** Read one optional JSON record from the plugin-owned data directory.
* @param path - Plugin-owned JSON record path.
* @param schema - Durable-boundary validator.
* @returns Parsed record, or `undefined` when absent.
*/
async function readJson(path, schema) {
	try {
		return schema.parse(JSON.parse(await readFile(path, "utf8")));
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
}
/** Encode one opaque id as one portable data-directory component.
* @param value - Opaque identifier.
* @returns Portable data-directory component.
*/
function dataComponent(value) {
	return encodeURIComponent(value);
}
//#endregion
//#region lib/types/spec.js
/** Durable JSON validation for the conversation-undo data directory. */
const id = z.string().min(1);
const sessionId = id.transform((value) => value);
const messageId = id.transform((value) => value);
const tree = z.string().regex(/^[0-9a-f]{40,64}$/).transform((value) => value);
const logicalConversationId = id.transform((value) => value);
/** Runtime schema for one app-owned snapshot journal manifest. */
const conversationUndoJournalSchema = z.object({
	schemaVersion: z.literal(1),
	logicalConversationId,
	generation: z.number().int().nonnegative(),
	predecessorGeneration: z.number().int().nonnegative().optional(),
	shadowLayout: z.literal("lineage").optional(),
	sourceSessionId: sessionId,
	sourceTombstonePending: z.boolean().optional(),
	sourceTombstoned: z.boolean().optional(),
	revokeExpired: z.boolean().optional(),
	rollbackSessionId: sessionId.optional(),
	revokeSessionId: sessionId.optional(),
	messageId,
	prompt: z.string(),
	workspace: z.string().min(1),
	beforeTree: tree,
	afterTree: tree.optional(),
	completedAt: z.number().finite().nonnegative().optional(),
	redoTree: tree.optional(),
	rollbackTree: tree.optional(),
	retainedGeneration: z.number().int().nonnegative().optional(),
	replayPromptOnRevoke: z.boolean().optional(),
	turn: z.number().int().nonnegative(),
	phase: z.enum([
		"armed",
		"ready",
		"quiescing",
		"restoring",
		"complete",
		"revoking",
		"cleanup-pending",
		"recovery-required"
	])
});
//#endregion
//#region lib/types/update.js
/** Self-update orchestration for the plugin workspace (pull, install, rebuild). */
/** Wall-clock ceilings per step; a hung step aborts the update instead of blocking the host. */
const REV_TIMEOUT_MS = 3e4;
const PULL_TIMEOUT_MS = 12e4;
const INSTALL_TIMEOUT_MS = 3e5;
const BUILD_TIMEOUT_MS = 6e5;
/** Locate the plugin workspace root: this module sits at
* `<root>/packages/rollback-undo/<src|lib>/update.<ts|js>`, three levels below
* the root under both the source and built layouts.
* @returns Absolute path of the installable plugin workspace.
* @throws When the expected marker file is absent (unexpected install layout).
*/
function pluginWorkspaceRoot() {
	const candidate = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
	if (!existsSync(resolve(candidate, "pnpm-workspace.yaml"))) throw new Error(`无法定位插件工作区根目录(期望 ${candidate} 含 pnpm-workspace.yaml)。`);
	return candidate;
}
/** Run one update step through the shell (pnpm resolves to pnpm.cmd on Windows).
* @param cwd - Directory the command runs in.
* @param command - Executable name without shell metacharacters.
* @param args - Argument list without shell metacharacters.
* @param timeoutMs - Kill the child after this long.
* @returns The command's stdout.
*/
function run(cwd, command, args, timeoutMs) {
	return new Promise((resolveResult, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			shell: true,
			windowsHide: true,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		const stdout = [];
		const stderr = [];
		const timer = setTimeout(() => {
			child.kill();
		}, timeoutMs);
		child.stdout.on("data", (chunk) => {
			stdout.push(chunk);
		});
		child.stderr.on("data", (chunk) => {
			stderr.push(chunk);
		});
		child.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once("exit", (code, signal) => {
			clearTimeout(timer);
			if (code === 0) {
				resolveResult(Buffer.concat(stdout).toString("utf8"));
				return;
			}
			reject(/* @__PURE__ */ new Error(`${command} ${args.join(" ")} 失败(${signal ?? code}):${Buffer.concat(stderr).toString("utf8").trim()}`));
		});
	});
}
/** Fast-forward the workspace and report whether HEAD moved.
* @param root - Plugin workspace root (a git checkout).
* @returns HEAD ids before and after the pull.
* @throws With git's stderr when the pull is rejected or the directory is not a checkout.
*/
async function pullFastForward(root) {
	const before = (await run(root, "git", ["rev-parse", "HEAD"], REV_TIMEOUT_MS)).trim();
	await run(root, "git", ["pull", "--ff-only"], PULL_TIMEOUT_MS);
	const after = (await run(root, "git", ["rev-parse", "HEAD"], REV_TIMEOUT_MS)).trim();
	return {
		before,
		after,
		changed: after !== before
	};
}
/** Pull, install, and rebuild the plugin workspace in one transaction-shaped pass.
* @param root - Plugin workspace root (a git checkout).
* @returns User-facing summary text (already up to date, or updated and rebuilt).
* @throws With a user-facing message at the first failing step.
*/
async function performPluginUpdate(root) {
	let outcome;
	try {
		outcome = await pullFastForward(root);
	} catch (error) {
		throw new Error(`更新失败:拉取最新代码未成功(${root})。${error instanceof Error ? error.message : String(error)}`);
	}
	const range = `${outcome.before.slice(0, 7)}→${outcome.after.slice(0, 7)}`;
	if (!outcome.changed) return `已是最新版本(${outcome.after.slice(0, 7)}),无需更新。`;
	try {
		await run(root, "pnpm", ["install"], INSTALL_TIMEOUT_MS);
	} catch (error) {
		throw new Error(`已拉取 ${range},但依赖安装失败,请手动执行 pnpm install。${error instanceof Error ? error.message : String(error)}`);
	}
	try {
		await run(root, "pnpm", ["run", "build"], BUILD_TIMEOUT_MS);
	} catch (error) {
		throw new Error(`已拉取 ${range},但构建失败,请手动执行 pnpm run build。${error instanceof Error ? error.message : String(error)}`);
	}
	return `已更新 ${range} 并重新构建。请重启 dsh 使新版本生效。`;
}
//#endregion
//#region lib/types/index.js
/**
* One-generation user-message rollback with a private Git snapshot journal
* (standalone plugin edition). The original dsh-internal seam version relied
* on unpublished core APIs – agent termination, archive restoration, and
* permanent deletion. This standalone build uses only published dsh APIs:
* cancellation plus quiescence waiting replaces forced termination, tombstone
* hiding replaces permanent deletion, and unarchive-based undo restoration is
* dropped entirely.
* @module @dsh-undo/rollback-undo
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
/** Return direct text-only user content; every other submission is ineligible. */
function topLevelText(message) {
	if (message.source.kind !== "user" || "delivery" in message.source && message.source.delivery === "steer" || !message.content.every((block) => block.type === "text")) return void 0;
	return message.content.map((block) => block.text).join("");
}
/** Extract shell-like commands from the dsh tool-call records for one turn. */
function commandsForTurn(events, turn) {
	const commands = [];
	for (const event of events) {
		if (event.type !== "tool/call" || !isToolCallForTurn(event.data, turn)) continue;
		const command = commandFromArguments(event.data.arguments);
		const path = pathFromArguments(event.data.arguments);
		commands.push({
			tool: event.data.name,
			...command === void 0 ? {} : { command },
			...path === void 0 ? {} : { path }
		});
	}
	return commands;
}
/** Narrow a serializable tool-call record without relying on a particular tool package. */
function isToolCallForTurn(value, turn) {
	if (value === null || typeof value !== "object") return false;
	const candidate = value;
	return candidate.turn === turn && typeof candidate.name === "string" && typeof candidate.arguments === "string";
}
/** Prefer executable fields over opaque tool JSON, redacting recognisable API-key strings. */
function commandFromArguments(argumentsText) {
	try {
		const value = JSON.parse(argumentsText);
		if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
		const candidate = value;
		const command = [
			candidate.cmd,
			candidate.command,
			candidate.script
		].find((item) => typeof item === "string");
		if (typeof command !== "string" || command.trim() === "") return void 0;
		return redactSecrets(command);
	} catch {
		return;
	}
}
/** Extract a single user-visible workspace path from common read/write tool arguments. */
function pathFromArguments(argumentsText) {
	try {
		const value = JSON.parse(argumentsText);
		if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
		const candidate = value;
		const path = [
			candidate.path,
			candidate.filePath,
			candidate.file_path,
			candidate.file,
			candidate.filename,
			candidate.target
		].find((item) => typeof item === "string");
		return typeof path === "string" && path.trim() !== "" ? path : void 0;
	} catch {
		return;
	}
}
/** Keep inspection output read-only without exposing recognisable API keys from commands or diffs. */
function redactSecrets(value) {
	return value.replace(/\bsk-[a-z0-9_-]{8,}\b/giu, "[已隐藏 API 密钥]");
}
/** Seed a new logical lineage from its first physical Session identity. */
function initialLogicalConversationId(sessionId) {
	return sessionId;
}
/** Copy one journal with the given optional transaction fields removed.
* @param journal - Journal to copy.
* @param fields - Optional fields to omit from the copy.
* @returns A journal without the requested fields.
*/
function withoutJournalFields(journal, fields) {
	const cleared = { ...journal };
	for (const field of fields) delete cleared[field];
	return cleared;
}
/** Select how revoke reconstructs the source transcript.
* Interrupted turns are cut before their user message so the same prompt can
* be submitted as fresh work; completed turns remain an immutable prefix.
*/
function revokeForkCut(journal) {
	return journal.replayPromptOnRevoke === true ? {
		kind: "before-user-message",
		messageId: journal.messageId
	} : { kind: "completed-turn" };
}
/** Recreate interrupted user input with a new identity for one fresh turn. */
function replayPromptMessage(journal) {
	if (journal.replayPromptOnRevoke !== true) return void 0;
	return createUserMessage({
		content: [{
			type: "text",
			text: journal.prompt
		}],
		source: { kind: "user" }
	});
}
/** Count newer layers that must be removed while retaining the selected node.
* Layers are newest-first, so the selected index is exactly the rollback count.
*/
function rollbackCountToRetainLayer(layers, messageId) {
	const index = layers.findIndex((layer) => layer.messageId === messageId);
	return index < 0 ? void 0 : index;
}
/** Find the completed-turn fork boundary that retains one selected prompt. */
function retainedLayerForkCut(events, messageId) {
	const message = events.find((event) => event.type === "user/message" && event.data !== null && typeof event.data === "object" && event.data.id === messageId);
	return message === void 0 ? void 0 : {
		kind: "completed-turn",
		atSeq: message.seq
	};
}
/** Resolve the exact workspace state a completed rollback published. */
function rollbackTargetTree(journal) {
	return journal.rollbackTree ?? journal.beforeTree;
}
/** Host owner of an append-only rollback lineage and its private snapshots. */
let ConversationUndoService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _current_decorators;
	let _admissionFailure_decorators;
	let _rollbackChild_decorators;
	let _revokePair_decorators;
	let _layers_decorators;
	let _inspectLayer_decorators;
	let _undoThrough_decorators;
	let _revoke_decorators;
	let _archiveAction_decorators;
	let _undoLatest_decorators;
	return class ConversationUndoService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_current_decorators = [Remote("current")];
			_admissionFailure_decorators = [Remote("admissionFailure")];
			_rollbackChild_decorators = [Remote("rollbackChild")];
			_revokePair_decorators = [Remote("revokePair")];
			_layers_decorators = [Remote("layers")];
			_inspectLayer_decorators = [Remote("inspectLayer")];
			_undoThrough_decorators = [Remote("undoThrough")];
			_revoke_decorators = [Remote("revoke")];
			_archiveAction_decorators = [Remote("archiveAction")];
			_undoLatest_decorators = [Remote("undoLatest")];
			__esDecorate(this, null, _current_decorators, {
				kind: "method",
				name: "current",
				static: false,
				private: false,
				access: {
					has: (obj) => "current" in obj,
					get: (obj) => obj.current
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _admissionFailure_decorators, {
				kind: "method",
				name: "admissionFailure",
				static: false,
				private: false,
				access: {
					has: (obj) => "admissionFailure" in obj,
					get: (obj) => obj.admissionFailure
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _rollbackChild_decorators, {
				kind: "method",
				name: "rollbackChild",
				static: false,
				private: false,
				access: {
					has: (obj) => "rollbackChild" in obj,
					get: (obj) => obj.rollbackChild
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _revokePair_decorators, {
				kind: "method",
				name: "revokePair",
				static: false,
				private: false,
				access: {
					has: (obj) => "revokePair" in obj,
					get: (obj) => obj.revokePair
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _layers_decorators, {
				kind: "method",
				name: "layers",
				static: false,
				private: false,
				access: {
					has: (obj) => "layers" in obj,
					get: (obj) => obj.layers
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _inspectLayer_decorators, {
				kind: "method",
				name: "inspectLayer",
				static: false,
				private: false,
				access: {
					has: (obj) => "inspectLayer" in obj,
					get: (obj) => obj.inspectLayer
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _undoThrough_decorators, {
				kind: "method",
				name: "undoThrough",
				static: false,
				private: false,
				access: {
					has: (obj) => "undoThrough" in obj,
					get: (obj) => obj.undoThrough
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _revoke_decorators, {
				kind: "method",
				name: "revoke",
				static: false,
				private: false,
				access: {
					has: (obj) => "revoke" in obj,
					get: (obj) => obj.revoke
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _archiveAction_decorators, {
				kind: "method",
				name: "archiveAction",
				static: false,
				private: false,
				access: {
					has: (obj) => "archiveAction" in obj,
					get: (obj) => obj.archiveAction
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _undoLatest_decorators, {
				kind: "method",
				name: "undoLatest",
				static: false,
				private: false,
				access: {
					has: (obj) => "undoLatest" in obj,
					get: (obj) => obj.undoLatest
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
		config = __runInitializers(this, _instanceExtraInitializers);
		static inject = [
			"agents",
			"sessions",
			"sessionArchive",
			"sessionFork",
			"sessionPersistence",
			"workspaceRegistry",
			"commands"
		];
		static Config = s.object({ root: s.string().min(1).required() });
		operationTails = /* @__PURE__ */ new Map();
		rollbackSessions = /* @__PURE__ */ new Set();
		rollbackWorkspaces = /* @__PURE__ */ new Set();
		admissionFailures = /* @__PURE__ */ new Map();
		statWarmers = /* @__PURE__ */ new Map();
		prearms = /* @__PURE__ */ new Map();
		workspaceChecks = /* @__PURE__ */ new Map();
		/** @param ctx - Host context with top-level agents and archive/fork capabilities. @param config - journal directory. */
		constructor(ctx, config) {
			super(ctx, "conversationUndo");
			this.config = config;
		}
		/** Create the journal root, recover durable work, and install admission listeners. */
		async [Service.init]() {
			await mkdir(this.config.root, { recursive: true });
			await this.recoverJournals();
			this.ctx.on("agent/pre-step", async (payload, next) => {
				const message = payload.messages.find((candidate) => topLevelText(candidate) !== void 0);
				if (message !== void 0 && !await this.arm(payload.agent, message, payload.turn)) return { kind: "reject" };
				return await next();
			});
			this.ctx.on("agent/turn-stopping", async ({ agent, turn }) => {
				await this.markReady(agent, turn);
			});
			this.ctx.commands.register({
				name: "undo",
				description: "回滚最近一条已完成消息:恢复文件和对话到该消息之前",
				handler: (invocation) => this.rollbackCommand(invocation)
			});
			this.ctx.commands.register({
				name: "update",
				description: "更新 dsh-undo-plugin:拉取最新代码并重新构建(重启 dsh 后生效)",
				handler: (invocation) => this.updateCommand(invocation)
			});
		}
		/** Execute `/update`: pull, install, and rebuild this plugin's own workspace.
		* @param invocation - command invocation; no arguments are accepted.
		* @returns A human-facing summary or failure.
		*/
		async updateCommand(invocation) {
			if (invocation.rawInput.trim().length > 0) return {
				kind: "error",
				text: "更新 dsh-undo-plugin:拉取最新代码并重新构建(重启 dsh 后生效)"
			};
			try {
				return {
					kind: "success",
					text: await performPluginUpdate(pluginWorkspaceRoot())
				};
			} catch (error) {
				return {
					kind: "error",
					text: error instanceof Error ? error.message : String(error)
				};
			}
		}
		/** Execute `/undo` for the receiving agent's latest completed message.
		* @param invocation - command invocation naming the receiving agent.
		* @returns A human-facing success or refusal.
		*/
		async rollbackCommand(invocation) {
			if (invocation.rawInput.trim().length > 0) return {
				kind: "error",
				text: "回滚最近一条已完成消息:恢复文件和对话到该消息之前"
			};
			const workspace = invocation.agent.session.header.cwd;
			if (workspace === void 0) return {
				kind: "error",
				text: `会话 ${invocation.agent.id} 没有工作区,无法建立回滚点。请先进入一个有 Git 工作区的会话。`
			};
			const journal = await this.readActiveJournal(invocation.agent.id);
			if (journal === void 0 || journal.phase !== "armed" && journal.phase !== "ready") return {
				kind: "error",
				text: `会话 ${invocation.agent.id} 没有可回滚的消息。请在该会话发送一条纯文本消息并等待回答完成(工作区:${workspace})。`
			};
			const result = await this.undoLatest({
				sessionId: invocation.agent.id,
				userMessageId: journal.messageId
			});
			if (!result.ok) return {
				kind: "error",
				text: result.error.message
			};
			return {
				kind: "success",
				text: `已回滚。新会话:${result.value.sessionId}`
			};
		}
		/** Read the latest rollback point directly owned by one physical Session.
		* @param request - Physical Session to inspect.
		* @returns Its latest Host-approved rollback point, when available.
		*/
		async current(request) {
			const journal = await this.readActiveJournal(request.sessionId);
			if (journal?.phase === "recovery-required") return this.failure("recovery-required", "此前的回滚需要 Host 恢复；请勿在此工作区继续操作。");
			if (journal?.phase !== "armed" && journal?.phase !== "ready") return this.success({ sessionId: request.sessionId });
			return this.success(this.viewFor(journal));
		}
		/** Read and clear the last refused-admission failure for one physical Session.
		* @param request - Physical Session that refused a prompt.
		* @returns The redacted failure once; an absent cache entry means no refusal.
		*/
		async admissionFailure(request) {
			const value = this.admissionFailures.get(request.sessionId);
			this.admissionFailures.delete(request.sessionId);
			return value;
		}
		/** Resolve the child Session a completed rollback published for a source Session.
		* @param request - Physical source Session.
		* @returns The published rollback child, when the source journal completed.
		*/
		async rollbackChild(request) {
			const journal = await this.findLatestJournal((journal) => journal.sourceSessionId === request.sessionId && journal.phase === "complete" && journal.rollbackSessionId !== void 0);
			if (journal === void 0 || journal.rollbackSessionId === void 0) return void 0;
			return { rollbackSessionId: journal.rollbackSessionId };
		}
		/** Read the completed rollback pair one child Session may still revoke.
		* @param request - Physical rollback child Session to inspect.
		* @returns The archived source and rolled-back prompt while the pair is retained.
		*/
		async revokePair(request) {
			const journal = await this.findCurrentRevokePair(request.sessionId);
			if (journal?.phase !== "complete") return void 0;
			return {
				sourceSessionId: journal.sourceSessionId,
				prompt: journal.prompt
			};
		}
		/** Read the timeline points reachable by repeatedly rolling back the current last message. */
		async layers(request) {
			return await this.layersFor(request.sessionId);
		}
		/** Read the files and executable tool commands produced by one timeline point. */
		async inspectLayer(request) {
			const journal = await this.journalForLayer(request.sessionId, request.userMessageId);
			if (journal === void 0) return {
				files: [],
				commands: []
			};
			const afterTree = journal.afterTree;
			return {
				files: afterTree === void 0 ? [] : await (async () => {
					const shadow = new ShadowGit(journal.workspace, this.shadowDirectory(journal));
					const changes = await shadow.changes(journal.beforeTree, afterTree);
					return await Promise.all(changes.map(async (change) => {
						const diff = redactSecrets(await shadow.diffPreview(journal.beforeTree, afterTree, change.path) ?? "");
						return {
							...change,
							...diff === "" ? {} : { diff }
						};
					}));
				})(),
				commands: commandsForTurn(this.ctx.sessions.get(journal.sourceSessionId)?.events ?? (await this.ctx.sessionPersistence.inspect(journal.sourceSessionId)).events, journal.turn),
				...journal.completedAt === void 0 ? {} : { completedAt: journal.completedAt }
			};
		}
		/** Remove only layers newer than the selected node, retaining that node as the resulting tip. */
		async undoThrough(request) {
			const rollbackCount = rollbackCountToRetainLayer(await this.layersFor(request.sessionId), request.userMessageId);
			if (rollbackCount === void 0) return this.failure("no-undo", "所选回滚点已失效，请重新打开回滚选择器。");
			if (rollbackCount === 0) return this.success({ sessionId: request.sessionId });
			if (rollbackCount === 1) {
				const active = await this.readActiveJournal(request.sessionId);
				return active === void 0 ? this.failure("no-undo", "回滚链已变化，请重新打开回滚选择器。") : await this.undoLatest({
					sessionId: request.sessionId,
					userMessageId: active.messageId
				});
			}
			return await this.undoToRetainedLayer(request);
		}
		/** Jump to a retained historical layer using one fork and one Git restore. */
		undoToRetainedLayer(request) {
			if (this.rollbackSessions.has(request.sessionId)) return Promise.resolve(this.failure("rollback-in-progress", "该会话正在回滚。"));
			this.rollbackSessions.add(request.sessionId);
			return this.enqueue(request.sessionId, async () => {
				const plan = await this.retainedLayerPlan(request.sessionId, request.userMessageId);
				if (plan === void 0) return this.failure("no-undo", "回滚链已变化，请重新打开回滚选择器。");
				let journal = plan.active;
				const workspace = journal.workspace;
				if (journal.phase !== "armed" && journal.phase !== "ready") return this.failure("undo-not-ready", "该消息尚未完成，暂时不能回滚。");
				if (this.rollbackWorkspaces.has(workspace)) return this.failure("rollback-in-progress", "该工作区正在回滚。");
				this.rollbackWorkspaces.add(workspace);
				const recoverable = {
					...journal,
					phase: "ready"
				};
				try {
					await this.writeJournal({
						...journal,
						phase: "quiescing"
					});
					const source = this.ctx.agents.get(journal.sourceSessionId);
					const retainedAgentOptions = source?.options;
					if (source !== void 0 && (source.status !== "idle" || this.hasRunningDescendant(source))) try {
						await this.quiesce(source);
					} catch (error) {
						await this.writeJournal(recoverable);
						return this.failure("session-busy", error instanceof Error ? error.message : String(error));
					}
					const quiescingJournal = await this.findJournalByGeneration(journal.logicalConversationId, journal.generation);
					if (quiescingJournal === void 0 || quiescingJournal.phase !== "quiescing") return this.failure("undo-not-ready", "会话尚未静止，暂时不能回滚。");
					journal = quiescingJournal;
					try {
						await this.assertWorkspace(workspace);
					} catch (error) {
						await this.writeJournal(recoverable);
						return this.failure("workspace-unsupported", error instanceof Error ? error.message : String(error));
					}
					const forkCut = retainedLayerForkCut(await this.eventsForSession(journal.sourceSessionId), plan.retained.messageId);
					if (forkCut === void 0) {
						await this.writeJournal(recoverable);
						return this.failure("no-undo", "所选回滚点不在当前会话分支中，请重新打开回滚选择器。");
					}
					const shadow = new ShadowGit(workspace, this.shadowDirectory(journal));
					const redoTree = await shadow.capture();
					let child;
					try {
						const rollbackSessionId = `conversation-undo-${randomUUID()}`;
						const restoring = {
							...journal,
							rollbackSessionId,
							redoTree,
							rollbackTree: plan.retainedTree,
							retainedGeneration: plan.retained.generation,
							phase: "restoring"
						};
						await this.writeJournal(restoring);
						const forkTask = this.ctx.sessionFork.fork({
							sourceSessionId: journal.sourceSessionId,
							childSessionId: rollbackSessionId,
							cut: forkCut,
							...retainedAgentOptions === void 0 ? {} : { retainedAgentOptions }
						});
						const restoreTask = shadow.restore(plan.retainedTree, redoTree);
						try {
							child = (await forkTask).handle;
							await restoreTask;
						} catch (error) {
							if (child === void 0) {
								await restoreTask.catch(() => {});
								try {
									await shadow.restore(redoTree, plan.retainedTree);
								} catch (compensateError) {
									throw new AggregateError([error, compensateError], "rollback undo could not recover the failed direct rollback");
								}
							}
							throw error;
						}
						try {
							await this.ctx.sessionArchive.archive(journal.sourceSessionId);
						} catch (error) {
							try {
								await shadow.restore(redoTree, plan.retainedTree);
							} catch (restoreError) {
								throw new AggregateError([error, restoreError], "rollback undo could not recover the failed direct archive step");
							}
							throw error;
						}
						await this.publishRetainedLayerToChild(restoring, child.agent.id);
						await this.writeJournal({
							...restoring,
							phase: "complete"
						});
						const shadowDir = this.shadowDirectory(journal);
						const warmer = shadow.refreshStats().catch(() => {}).finally(() => {
							this.statWarmers.delete(shadowDir);
						});
						this.statWarmers.set(shadowDir, warmer);
						const childJournal = {
							workspace: journal.workspace,
							logicalConversationId: journal.logicalConversationId,
							generation: journal.generation + 1,
							shadowLayout: "lineage"
						};
						const childShadowDir = this.shadowDirectory(childJournal);
						const prearm = new ShadowGit(workspace, childShadowDir).capture().then(() => void 0).catch(() => {}).finally(() => {
							this.prearms.delete(childShadowDir);
						});
						this.prearms.set(childShadowDir, prearm);
						return this.success({ sessionId: child.agent.id });
					} catch (error) {
						const recoveries = [error];
						if (child !== void 0) try {
							await child.dispose();
						} catch (disposeError) {
							recoveries.push(disposeError);
						}
						try {
							await this.writeJournal(recoverable);
						} catch (journalError) {
							recoveries.push(journalError);
						}
						throw recoveries.length === 1 ? error : new AggregateError(recoveries, "rollback undo could not recover the failed direct rollback");
					}
				} finally {
					this.rollbackWorkspaces.delete(workspace);
				}
			}).finally(() => {
				this.rollbackSessions.delete(request.sessionId);
			});
		}
		/** Restore the archived source's full conversation and its redo tree, then archive the child.
		* @param request - Physical rollback child Session holding the completed pair.
		* @returns The restored replacement Session or a business refusal.
		*/
		revoke(request) {
			if (this.rollbackSessions.has(request.sessionId)) return Promise.resolve(this.failure("rollback-in-progress", "该会话正在撤回回滚。"));
			this.rollbackSessions.add(request.sessionId);
			return this.enqueue(request.sessionId, async () => {
				const journal = await this.findCurrentRevokePair(request.sessionId);
				if (journal === void 0 || journal.phase !== "complete" || journal.redoTree === void 0) return this.failure("no-undo", "此会话没有可撤回的回滚。");
				const workspace = journal.workspace;
				if (this.rollbackWorkspaces.has(workspace)) return this.failure("rollback-in-progress", "该工作区正在回滚。");
				this.rollbackWorkspaces.add(workspace);
				const recoverable = journal;
				try {
					const child = this.ctx.agents.get(request.sessionId);
					const retainedAgentOptions = child?.options;
					if (child !== void 0 && (child.status !== "idle" || this.hasRunningDescendant(child))) try {
						await this.quiesce(child);
					} catch (error) {
						return this.failure("session-busy", error instanceof Error ? error.message : String(error));
					}
					try {
						await this.assertWorkspace(workspace);
					} catch (error) {
						return this.failure("workspace-unsupported", error instanceof Error ? error.message : String(error));
					}
					const shadow = new ShadowGit(workspace, this.shadowDirectory(journal));
					await this.statWarmers.get(this.shadowDirectory(journal));
					const rollbackTree = rollbackTargetTree(journal);
					if (!await shadow.verifyMatches(rollbackTree)) return this.failure("workspace-diverged", "回滚后工作区文件已被修改，无法安全撤回回滚。");
					const redoTree = journal.redoTree;
					const revokeSessionId = `conversation-undo-${randomUUID()}`;
					await this.writeJournal({
						...journal,
						revokeSessionId,
						phase: "revoking"
					});
					let restored;
					try {
						const forkTask = this.ctx.sessionFork.fork({
							sourceSessionId: journal.sourceSessionId,
							childSessionId: revokeSessionId,
							cut: revokeForkCut(journal),
							...retainedAgentOptions === void 0 ? {} : { retainedAgentOptions }
						});
						const restoreTask = shadow.restore(redoTree, rollbackTree);
						try {
							restored = (await forkTask).handle;
							await restoreTask;
						} catch (error) {
							if (restored === void 0) {
								await restoreTask.catch(() => {});
								try {
									await shadow.restore(rollbackTree, redoTree);
								} catch (compensateError) {
									throw new AggregateError([error, compensateError], "rollback revoke could not recover the failed fork");
								}
							}
							throw error;
						}
						try {
							await this.ctx.sessionArchive.archive(request.sessionId);
						} catch (error) {
							try {
								await shadow.restore(rollbackTree, redoTree);
							} catch (restoreError) {
								throw new AggregateError([error, restoreError], "rollback revoke could not recover the failed archive step");
							}
							throw error;
						}
						if (journal.replayPromptOnRevoke === true) await this.publishPredecessorToChild(journal, restored.agent.id);
						else await this.writeJournal({
							...withoutJournalFields(journal, [
								"rollbackSessionId",
								"redoTree",
								"rollbackTree",
								"revokeSessionId",
								"replayPromptOnRevoke",
								"retainedGeneration"
							]),
							sourceSessionId: restored.agent.id,
							phase: "ready"
						});
						const shadowDir = this.shadowDirectory(journal);
						const warmer = shadow.refreshStats().catch(() => {}).finally(() => {
							this.statWarmers.delete(shadowDir);
						});
						this.statWarmers.set(shadowDir, warmer);
						const replay = replayPromptMessage(journal);
						if (replay !== void 0) restored.agent.followup(replay);
						return this.success({ sessionId: restored.agent.id });
					} catch (error) {
						const recoveries = [error];
						if (restored !== void 0) try {
							await restored.dispose();
						} catch (disposeError) {
							recoveries.push(disposeError);
						}
						try {
							await this.writeJournal(recoverable);
						} catch (journalError) {
							recoveries.push(journalError);
						}
						throw recoveries.length === 1 ? error : new AggregateError(recoveries, "rollback revoke could not recover the failed revoke");
					}
				} finally {
					this.rollbackWorkspaces.delete(workspace);
				}
			}).finally(() => {
				this.rollbackSessions.delete(request.sessionId);
			});
		}
		/** Select the recovery state the Archive Tasks page may surface for one archived Session.
		* @param request - Archived physical Session to inspect.
		* @returns The journal-derived archive-page action.
		*/
		async archiveAction(request) {
			const journal = await this.findLatestJournal((journal) => journal.sourceSessionId === request.sessionId);
			if (journal?.phase === "cleanup-pending" || journal?.phase === "quiescing" || journal?.phase === "restoring") return { action: "cleanup-pending" };
			if (journal?.phase === "recovery-required") return { action: "recovery-required" };
			return { action: "archived" };
		}
		/** Fork before the selected message, restore its before-tree, and archive the source.
		* @param request - Source Session and latest approved message to roll back.
		* @returns Replacement Session or a business refusal.
		*/
		undoLatest(request) {
			if (this.rollbackSessions.has(request.sessionId)) return Promise.resolve(this.failure("rollback-in-progress", "该会话正在回滚。"));
			this.rollbackSessions.add(request.sessionId);
			return this.enqueue(request.sessionId, async () => {
				let journal = await this.readActiveJournal(request.sessionId);
				if (journal === void 0 || journal.sourceSessionId !== request.sessionId) return this.failure("no-undo", "此对话没有可回滚的消息。");
				if (journal.messageId !== request.userMessageId) return this.failure("not-latest-message", "只能回滚最近一条已完成消息。");
				if (journal.phase !== "armed" && journal.phase !== "ready") return this.failure("undo-not-ready", "该消息尚未完成，暂时不能回滚。");
				const workspace = journal.workspace;
				if (this.rollbackWorkspaces.has(workspace)) return this.failure("rollback-in-progress", "该工作区正在回滚。");
				this.rollbackWorkspaces.add(workspace);
				const replayPromptOnRevoke = journal.phase === "armed";
				const recoverable = {
					...journal,
					phase: "ready"
				};
				try {
					await this.writeJournal({
						...journal,
						phase: "quiescing"
					});
					const source = this.ctx.agents.get(journal.sourceSessionId);
					const retainedAgentOptions = source?.options;
					if (source !== void 0 && (source.status !== "idle" || this.hasRunningDescendant(source))) try {
						await this.quiesce(source);
					} catch (error) {
						await this.writeJournal(recoverable);
						return this.failure("session-busy", error instanceof Error ? error.message : String(error));
					}
					journal = await this.findJournalByGeneration(journal.logicalConversationId, journal.generation);
					if (journal === void 0 || journal.phase !== "quiescing") return this.failure("undo-not-ready", "会话尚未静止，暂时不能回滚。");
					try {
						await this.assertWorkspace(journal.workspace);
					} catch (error) {
						await this.writeJournal(recoverable);
						return this.failure("workspace-unsupported", error instanceof Error ? error.message : String(error));
					}
					const shadow = new ShadowGit(journal.workspace, this.shadowDirectory(journal));
					const redoTree = await shadow.capture();
					let child;
					try {
						const rollbackSessionId = `conversation-undo-${randomUUID()}`;
						const restoring = {
							...journal,
							rollbackSessionId,
							redoTree,
							...replayPromptOnRevoke ? { replayPromptOnRevoke: true } : {},
							phase: "restoring"
						};
						await this.writeJournal(restoring);
						const forkTask = this.ctx.sessionFork.fork({
							sourceSessionId: journal.sourceSessionId,
							childSessionId: rollbackSessionId,
							cut: {
								kind: "before-user-message",
								messageId: journal.messageId
							},
							...retainedAgentOptions === void 0 ? {} : { retainedAgentOptions }
						});
						const restoreTask = shadow.restore(journal.beforeTree, redoTree);
						try {
							child = (await forkTask).handle;
							await restoreTask;
						} catch (error) {
							if (child === void 0) {
								await restoreTask.catch(() => {});
								try {
									await shadow.restore(redoTree, journal.beforeTree);
								} catch (compensateError) {
									throw new AggregateError([error, compensateError], "rollback undo could not recover the failed fork");
								}
							}
							throw error;
						}
						try {
							await this.ctx.sessionArchive.archive(journal.sourceSessionId);
						} catch (error) {
							try {
								await shadow.restore(redoTree, journal.beforeTree);
							} catch (restoreError) {
								throw new AggregateError([error, restoreError], "rollback undo could not recover the failed archive step");
							}
							throw error;
						}
						await this.publishPredecessorToChild(journal, child.agent.id);
						await this.writeJournal({
							...restoring,
							phase: "complete"
						});
						const shadowDir = this.shadowDirectory(journal);
						const warmer = shadow.refreshStats().catch(() => {}).finally(() => {
							this.statWarmers.delete(shadowDir);
						});
						this.statWarmers.set(shadowDir, warmer);
						const childJournal = {
							workspace: journal.workspace,
							logicalConversationId: journal.logicalConversationId,
							generation: journal.generation + 1,
							shadowLayout: "lineage"
						};
						const childShadowDir = this.shadowDirectory(childJournal);
						const prearm = new ShadowGit(workspace, childShadowDir).capture().then(() => void 0).catch(() => {}).finally(() => {
							this.prearms.delete(childShadowDir);
						});
						this.prearms.set(childShadowDir, prearm);
						return this.success({ sessionId: child.agent.id });
					} catch (error) {
						const recoveries = [error];
						if (child !== void 0) try {
							await child.dispose();
						} catch (disposeError) {
							recoveries.push(disposeError);
						}
						try {
							await this.writeJournal(recoverable);
						} catch (journalError) {
							recoveries.push(journalError);
						}
						throw recoveries.length === 1 ? error : new AggregateError(recoveries, "rollback undo could not recover the failed rollback");
					}
				} finally {
					this.rollbackWorkspaces.delete(workspace);
				}
			}).finally(() => {
				this.rollbackSessions.delete(request.sessionId);
			});
		}
		/** Capture an eligible prompt's before-tree before delegating model admission. */
		async arm(agent, message, turn) {
			if (agent.session.header.origin === "subagent") return true;
			const prompt = topLevelText(message);
			const workspace = agent.session.header.cwd;
			if (prompt === void 0 || workspace === void 0) return true;
			if (this.rollbackWorkspaces.has(workspace)) {
				this.recordAdmissionFailure(agent.id, prompt, "回滚正在进行，请稍后再试。");
				return false;
			}
			return await this.enqueue(agent.id, async () => {
				try {
					if (this.rollbackWorkspaces.has(workspace)) {
						this.recordAdmissionFailure(agent.id, prompt, "回滚正在进行，请稍后再试。");
						return false;
					}
					await this.assertWorkspace(workspace);
					const journals = await this.readJournals();
					const active = this.selectLatest(journals.filter((journal) => journal.sourceSessionId === agent.id && (journal.phase === "armed" || journal.phase === "ready")));
					const inherited = active ?? this.selectLatest(journals.filter((journal) => journal.rollbackSessionId === agent.id && journal.phase === "complete"));
					const predecessorGeneration = active?.generation ?? inherited?.predecessorGeneration;
					const draft = {
						schemaVersion: 1,
						logicalConversationId: inherited?.logicalConversationId ?? initialLogicalConversationId(agent.id),
						generation: this.nextGeneration(journals, inherited?.logicalConversationId ?? initialLogicalConversationId(agent.id)),
						...predecessorGeneration === void 0 ? {} : { predecessorGeneration },
						shadowLayout: "lineage",
						sourceSessionId: agent.id,
						messageId: message.id,
						prompt,
						workspace,
						beforeTree: "",
						turn,
						phase: "armed"
					};
					await this.prearms.get(this.shadowDirectory(draft));
					const beforeTree = await new ShadowGit(workspace, this.shadowDirectory(draft)).capture();
					await this.writeJournal({
						...draft,
						beforeTree
					});
					this.expireRevokePairsForBranch(draft.logicalConversationId);
					return true;
				} catch (error) {
					this.ctx.logger.warn(`rollback undo: refusing prompt because its before-tree snapshot failed: ${String(error)}`);
					this.recordAdmissionFailure(agent.id, prompt, "本地快照失败（snapshot-failed）。");
					return false;
				}
			});
		}
		/** Cache one refused admission for the browser composer to poll once. */
		recordAdmissionFailure(sessionId, prompt, detail) {
			this.admissionFailures.set(sessionId, {
				prompt,
				detail
			});
			this.ctx.emit("undo/admission-failed", {
				sessionId,
				prompt,
				detail
			});
		}
		/** Mark an admitted prompt ready after its turn closes. */
		async markReady(agent, turn) {
			const journal = await this.readActiveJournal(agent.id);
			if (journal?.phase !== "armed" || journal.turn !== turn) return;
			try {
				const afterTree = await new ShadowGit(journal.workspace, this.shadowDirectory(journal)).capture();
				await this.writeJournal({
					...journal,
					afterTree,
					completedAt: Date.now(),
					phase: "ready"
				});
			} catch (error) {
				this.ctx.logger.warn(`rollback undo: step-change snapshot unavailable: ${String(error)}`);
				await this.writeJournal({
					...journal,
					completedAt: Date.now(),
					phase: "ready"
				});
			}
		}
		/** Expire old revoke actions after a new branch prompt without deleting archived Sessions. */
		async expireRevokePairsForBranch(logicalConversationId) {
			const revocable = (await this.readJournals()).filter((journal) => journal.logicalConversationId === logicalConversationId && journal.phase === "complete" && journal.revokeExpired !== true);
			await Promise.all(revocable.map((journal) => this.writeJournal({
				...journal,
				revokeExpired: true
			})));
		}
		/** Recover or surface every durable operation interrupted before Host shutdown. */
		async recoverJournals() {
			for (const journal of await this.readJournals()) {
				if (journal.sourceTombstoned === true) continue;
				if (journal.sourceTombstonePending === true) {
					await this.recoverDeferredCleanup(journal);
					continue;
				}
				switch (journal.phase) {
					case "cleanup-pending":
						await this.recoverDeferredCleanup(journal);
						break;
					case "quiescing":
						await this.writeJournal({
							...journal,
							phase: "ready"
						});
						this.ctx.logger.warn(`rollback undo: reset interrupted pre-publication rollback for "${journal.sourceSessionId}"`);
						break;
					case "restoring":
						await this.recoverRestoring(journal);
						break;
					case "revoking": await this.recoverRevoking(journal);
				}
			}
		}
		/** Retry one deferred tombstone without preventing unrelated Host startup. */
		async recoverDeferredCleanup(journal) {
			try {
				if (await this.sessionExists(journal.sourceSessionId)) {
					const result = await this.ctx.sessionArchive.tombstone(journal.sourceSessionId);
					if (!result.ok) throw new Error(result.error.message);
				}
				const siblings = (await this.readJournals()).filter((candidate) => candidate.logicalConversationId === journal.logicalConversationId && candidate.sourceSessionId === journal.sourceSessionId);
				await Promise.all(siblings.map((candidate) => this.writeJournal({
					...candidate,
					sourceTombstoned: true
				})));
			} catch (error) {
				this.ctx.logger.warn(`rollback undo: startup tombstone for "${journal.sourceSessionId}" is still deferred: ${String(error)}`);
			}
		}
		/** Complete only an independently verified restoring transaction; otherwise preserve an explicit recovery state. */
		async recoverRestoring(journal) {
			if (journal.rollbackSessionId === void 0 || journal.redoTree === void 0) {
				await this.requireRecovery(journal, "manifest has no rollback Session or redo tree");
				return;
			}
			try {
				await this.assertWorkspace(journal.workspace);
				const shadow = new ShadowGit(journal.workspace, this.shadowDirectory(journal));
				const sourceArchived = this.ctx.workspaceRegistry.archivedSessionIds.includes(journal.sourceSessionId);
				const rollbackArchived = this.ctx.workspaceRegistry.archivedSessionIds.includes(journal.rollbackSessionId ?? "");
				const rollbackExists = await this.sessionExists(journal.rollbackSessionId ?? "");
				if (sourceArchived && !rollbackArchived && rollbackExists && await shadow.verifyMatches(rollbackTargetTree(journal))) {
					await this.publishRetainedLayerToChild(journal, journal.rollbackSessionId);
					await this.writeJournal({
						...journal,
						phase: "complete"
					});
					return;
				}
				if (!sourceArchived && await shadow.verifyMatches(journal.redoTree ?? journal.beforeTree)) {
					if (rollbackExists) await this.hideUnpublishedChild(journal.rollbackSessionId ?? "");
					await this.writeJournal({
						...journal,
						phase: "ready"
					});
					return;
				}
				await this.requireRecovery(journal, "archive membership or private Shadow Git tree does not describe a safe publication state");
			} catch (error) {
				await this.requireRecovery(journal, error instanceof Error ? error.message : String(error));
			}
		}
		/** Determine whether a rollback child is present in either live or durable session ownership. */
		async sessionExists(sessionId) {
			return this.ctx.sessions.get(sessionId) !== void 0 || (await this.ctx.sessionPersistence.list()).some((header) => header.id === sessionId);
		}
		/** Hide an unpublished rollback child; without a termination API it stays on disk but out of every UI. */
		async hideUnpublishedChild(sessionId) {
			const agent = this.ctx.agents.get(sessionId);
			if (agent !== void 0) {
				if (agent.status !== "idle") {
					agent.cancel({ kind: "user" });
					await this.waitForAgentIdle(agent, Date.now() + 2e3);
				}
				if (agent.status !== "idle") throw new Error(`rollback child "${sessionId}" did not quiesce and cannot be hidden`);
			}
			await this.ctx.sessionArchive.archive(sessionId);
		}
		/** Complete only an independently verified revoke transaction; otherwise preserve an explicit recovery state. */
		async recoverRevoking(journal) {
			if (journal.rollbackSessionId === void 0 || journal.revokeSessionId === void 0 || journal.redoTree === void 0) {
				await this.requireRecovery(journal, "revoke manifest is missing its child Session, restored Session, or redo tree");
				return;
			}
			const revokeSessionId = journal.revokeSessionId;
			try {
				await this.assertWorkspace(journal.workspace);
				const shadow = new ShadowGit(journal.workspace, this.shadowDirectory(journal));
				const revokeExists = await this.sessionExists(revokeSessionId);
				const childArchived = this.ctx.workspaceRegistry.archivedSessionIds.includes(journal.rollbackSessionId);
				const revokeArchived = this.ctx.workspaceRegistry.archivedSessionIds.includes(revokeSessionId);
				if (childArchived && !revokeArchived && revokeExists && await shadow.verifyMatches(journal.redoTree)) {
					await this.writeJournal({
						...withoutJournalFields(journal, [
							"rollbackSessionId",
							"redoTree",
							"rollbackTree",
							"revokeSessionId",
							"replayPromptOnRevoke",
							"retainedGeneration"
						]),
						sourceSessionId: revokeSessionId,
						phase: "ready"
					});
					return;
				}
				if (!childArchived && await shadow.verifyMatches(rollbackTargetTree(journal))) {
					if (revokeExists) await this.hideUnpublishedChild(revokeSessionId);
					await this.writeJournal({
						...withoutJournalFields(journal, ["revokeSessionId"]),
						phase: "complete"
					});
					return;
				}
				await this.requireRecovery(journal, "archive membership or private Shadow Git tree does not describe a safe revoke state");
			} catch (error) {
				await this.requireRecovery(journal, error instanceof Error ? error.message : String(error));
			}
		}
		/** Preserve a recovery-required manifest instead of claiming an ambiguous transaction succeeded. */
		async requireRecovery(journal, detail) {
			await this.writeJournal({
				...journal,
				phase: "recovery-required"
			});
			this.ctx.logger.error(`rollback undo: rollback for "${journal.sourceSessionId}" requires recovery: ${detail}`);
		}
		/** Detect live child work that makes a file restoration unsafe. */
		hasRunningDescendant(root) {
			return this.ownedAgentTree(root).some((agent) => agent !== root && agent.status !== "idle");
		}
		/** Request cooperative stop and force-stop registered work before touching tracked files. */
		async quiesce(source) {
			const agents = this.ownedAgentTree(source);
			for (const agent of agents) if (agent.status !== "idle") agent.cancel({ kind: "user" });
			await this.waitForQuiescence(agents);
			if (agents.some((agent) => agent.status !== "idle") || this.hasControlledActivity(agents)) await this.forceStopControlledActivity(agents);
			const deadline = Date.now() + 2e3;
			while ((agents.some((agent) => agent.status !== "idle") || this.hasControlledActivity(agents)) && Date.now() < deadline) await new Promise((resolve) => {
				setTimeout(resolve, 50);
			});
			const runningAgents = agents.filter((agent) => this.ctx.agents.get(agent.id) !== void 0 && agent.status !== "idle");
			if (runningAgents.length > 0 || this.hasControlledActivity(agents)) throw new Error(`会话仍有 ${String(runningAgents.length)} 个运行任务或受控进程，无法安全回滚。`);
		}
		/** Check whether registered job or terminal providers still own work for the Agent tree. */
		hasControlledActivity(agents) {
			const jobs = this.ctx.get("jobs");
			const terminals = this.ctx.get("terminals");
			return agents.some((agent) => (jobs?.list(agent).some((job) => job.status === "running" || job.status === "stopping") ?? false) || (terminals?.hasOwnerActivity(agent) ?? false));
		}
		/** Force-stop registered jobs and PTYs only after the cooperative grace period elapses. */
		async forceStopControlledActivity(agents) {
			const jobs = this.ctx.get("jobs");
			const terminals = this.ctx.get("terminals");
			const stops = [];
			for (const agent of agents) {
				if (jobs !== void 0) {
					for (const job of jobs.list(agent)) if (job.status === "running" || job.status === "stopping") jobs.kill(job.id, agent, "rollback quiescence");
				}
				if (terminals !== void 0) {
					for (const terminal of terminals.list(agent)) if (terminal.status.kind === "running") stops.push(terminals.kill(agent, terminal.sessionId, "rollback quiescence"));
				}
			}
			await Promise.all(stops);
		}
		/** Resolve the source and all transitive runtime-owned descendants. */
		ownedAgentTree(root) {
			const descendants = /* @__PURE__ */ new Set([root]);
			const agents = this.ctx.agents.list();
			let changed = true;
			while (changed) {
				changed = false;
				for (const candidate of agents) {
					if (descendants.has(candidate)) continue;
					if ([...descendants].some((parent) => this.ctx.agents.isOwnedBy(candidate.id, parent))) {
						descendants.add(candidate);
						changed = true;
					}
				}
			}
			return [...descendants];
		}
		/** Give Agents, registered jobs, and PTYs a short chance to stop cooperatively. */
		async waitForQuiescence(agents) {
			const deadline = Date.now() + 500;
			while ((agents.some((agent) => agent.status !== "idle") || this.hasControlledActivity(agents)) && Date.now() < deadline) await new Promise((resolve) => {
				setTimeout(resolve, 25);
			});
		}
		/** Poll one Agent until idle or the deadline passes. */
		async waitForAgentIdle(agent, deadline) {
			while (Date.now() < deadline) {
				await new Promise((resolve) => {
					setTimeout(resolve, 50);
				});
				if (agent.status === "idle") return;
			}
		}
		/** Assert workspace support once per workspace per Host run.
		* The worktree and submodule facts a passing check establishes cannot
		* regress while this Host owns the workspace, and the check's
		* `ls-files --stage` output scales with the whole tracked tree, so every
		* prompt admission re-running it dominates the arm cost. A failing check
		* is not cached.
		* @param workspace - Candidate worktree root.
		* @returns Resolution only for a supported non-bare, submodule-free worktree.
		*/
		assertWorkspace(workspace) {
			let check = this.workspaceChecks.get(workspace);
			if (check === void 0) {
				check = assertSupportedWorkspace(workspace);
				this.workspaceChecks.set(workspace, check);
				check.catch(() => {
					this.workspaceChecks.delete(workspace);
				});
			}
			return check;
		}
		/** Select the newest durable record by lineage generation. */
		selectLatest(journals) {
			return journals.reduce((latest, journal) => latest === void 0 || journal.generation > latest.generation ? journal : latest, void 0);
		}
		/** Allocate a never-reused record generation inside one logical lineage. */
		nextGeneration(journals, logicalConversationId) {
			return (this.selectLatest(journals.filter((journal) => journal.logicalConversationId === logicalConversationId))?.generation ?? -1) + 1;
		}
		/** Read the physical Session's currently actionable latest point. */
		async readActiveJournal(sourceSessionId) {
			return this.selectLatest((await this.readJournals()).filter((journal) => journal.sourceSessionId === sourceSessionId && (journal.phase === "armed" || journal.phase === "ready")));
		}
		/** Find the newest journal matching an arbitrary durable predicate. */
		async findLatestJournal(predicate) {
			return this.selectLatest((await this.readJournals()).filter(predicate));
		}
		/** Resolve one immutable point reference in a logical rollback path. */
		async findJournalByGeneration(logicalConversationId, generation) {
			return this.selectLatest((await this.readJournals()).filter((journal) => journal.logicalConversationId === logicalConversationId && journal.generation === generation));
		}
		/** Publish the retained layer for a direct jump, or the usual predecessor for one-edge rollback. */
		async publishRetainedLayerToChild(journal, childSessionId) {
			const generation = journal.retainedGeneration ?? journal.predecessorGeneration;
			if (generation === void 0) return;
			const retained = await this.findJournalByGeneration(journal.logicalConversationId, generation);
			if (retained === void 0) return;
			await this.publishJournalToChild(journal, retained, childSessionId);
		}
		/** Give a completed one-edge rollback child the point immediately before the removed message. */
		async publishPredecessorToChild(journal, childSessionId) {
			if (journal.predecessorGeneration === void 0) return;
			const predecessor = await this.findJournalByGeneration(journal.logicalConversationId, journal.predecessorGeneration);
			if (predecessor === void 0) return;
			await this.publishJournalToChild(journal, predecessor, childSessionId);
		}
		/** Copy exactly one ready historical point into a newly published child Session. */
		async publishJournalToChild(rollback, retained, childSessionId) {
			const existing = await this.readActiveJournal(childSessionId);
			if (existing?.messageId === retained.messageId && existing.logicalConversationId === rollback.logicalConversationId) return;
			const generations = await this.readJournals();
			const inherited = {
				...withoutJournalFields(retained, [
					"rollbackSessionId",
					"redoTree",
					"rollbackTree",
					"revokeSessionId",
					"replayPromptOnRevoke",
					"retainedGeneration"
				]),
				generation: this.nextGeneration(generations, rollback.logicalConversationId),
				shadowLayout: "lineage",
				sourceSessionId: childSessionId,
				phase: "ready"
			};
			await this.writeJournal(inherited);
		}
		/** Resolve one direct-jump plan and the exact retained workspace tree. */
		async retainedLayerPlan(sessionId, messageId) {
			const journals = await this.readJournals();
			let current = this.selectLatest(journals.filter((candidate) => candidate.sourceSessionId === sessionId && (candidate.phase === "armed" || candidate.phase === "ready")));
			if (current === void 0) return void 0;
			const active = current;
			const reachable = [];
			const visited = /* @__PURE__ */ new Set();
			while (current !== void 0 && !visited.has(current.generation)) {
				visited.add(current.generation);
				reachable.push(current);
				if (current.predecessorGeneration === void 0) break;
				const generation = current.predecessorGeneration;
				current = this.selectLatest(journals.filter((candidate) => candidate.logicalConversationId === active.logicalConversationId && candidate.generation === generation));
			}
			const index = reachable.findIndex((candidate) => candidate.messageId === messageId);
			if (index < 2) return void 0;
			const retained = reachable[index];
			const newer = reachable[index - 1];
			if (retained === void 0 || newer === void 0) return void 0;
			return {
				active,
				retained,
				retainedTree: newer.beforeTree
			};
		}
		/** Read events from a live Session when possible, otherwise its immutable persisted copy. */
		async eventsForSession(sessionId) {
			const live = this.ctx.sessions.get(sessionId);
			if (live !== void 0) return live.events;
			return (await this.ctx.sessionPersistence.inspect(sessionId)).events;
		}
		/** Enumerate the active point followed by each reachable predecessor. */
		async layersFor(sessionId) {
			const journals = await this.readJournals();
			let journal = this.selectLatest(journals.filter((candidate) => candidate.sourceSessionId === sessionId && (candidate.phase === "armed" || candidate.phase === "ready")));
			const layers = [];
			const visited = /* @__PURE__ */ new Set();
			while (journal !== void 0 && !visited.has(journal.generation)) {
				visited.add(journal.generation);
				layers.push({
					messageId: journal.messageId,
					prompt: journal.prompt
				});
				const predecessorGeneration = journal.predecessorGeneration;
				if (predecessorGeneration === void 0) break;
				const logicalConversationId = journal.logicalConversationId;
				journal = this.selectLatest(journals.filter((candidate) => candidate.logicalConversationId === logicalConversationId && candidate.generation === predecessorGeneration));
			}
			return layers;
		}
		/** Resolve the retained journal belonging to one selectable timeline point. */
		async journalForLayer(sessionId, messageId) {
			const journals = await this.readJournals();
			let journal = this.selectLatest(journals.filter((candidate) => candidate.sourceSessionId === sessionId && (candidate.phase === "armed" || candidate.phase === "ready")));
			const visited = /* @__PURE__ */ new Set();
			while (journal !== void 0 && !visited.has(journal.generation)) {
				visited.add(journal.generation);
				if (journal.messageId === messageId) return journal;
				const predecessorGeneration = journal.predecessorGeneration;
				if (predecessorGeneration === void 0) return void 0;
				const logicalConversationId = journal.logicalConversationId;
				journal = this.selectLatest(journals.filter((candidate) => candidate.logicalConversationId === logicalConversationId && candidate.generation === predecessorGeneration));
			}
		}
		/** Find the one topmost completed rollback that the current branch may revoke. */
		async findCurrentRevokePair(sessionId) {
			const journals = await this.readJournals();
			const direct = this.selectLatest(journals.filter((journal) => journal.rollbackSessionId === sessionId && journal.phase === "complete" && journal.revokeExpired !== true));
			if (direct !== void 0) return direct;
			const active = this.selectLatest(journals.filter((journal) => journal.sourceSessionId === sessionId && (journal.phase === "armed" || journal.phase === "ready")));
			if (active === void 0) return void 0;
			return this.selectLatest(journals.filter((journal) => journal.logicalConversationId === active.logicalConversationId && journal.phase === "complete" && journal.revokeExpired !== true));
		}
		/** Read every durable journal; an absent private directory is empty state. */
		async readJournals() {
			let workspaceDirectories;
			try {
				workspaceDirectories = await readdir(join(this.config.root, "undo"));
			} catch (error) {
				if (error.code === "ENOENT") return [];
				throw error;
			}
			const journals = [];
			for (const workspaceDirectory of workspaceDirectories) {
				let conversationDirectories;
				try {
					conversationDirectories = await readdir(join(this.config.root, "undo", workspaceDirectory));
				} catch (error) {
					if (error.code === "ENOENT") continue;
					throw error;
				}
				for (const conversationDirectory of conversationDirectories) {
					let generationDirectories;
					try {
						generationDirectories = await readdir(join(this.config.root, "undo", workspaceDirectory, conversationDirectory));
					} catch (error) {
						if (error.code === "ENOENT") continue;
						throw error;
					}
					for (const generationDirectory of generationDirectories) {
						const journal = await readJson(join(this.config.root, "undo", workspaceDirectory, conversationDirectory, generationDirectory, "manifest.json"), conversationUndoJournalSchema);
						if (journal !== void 0) journals.push(journal);
					}
				}
			}
			return journals;
		}
		/** Convert one journal into the message-action response. */
		viewFor(journal) {
			return {
				sessionId: journal.sourceSessionId,
				messageId: journal.messageId,
				prompt: journal.prompt
			};
		}
		/** Create a stable success response. */
		success(value) {
			return {
				ok: true,
				value
			};
		}
		/** Create a stable business refusal. */
		failure(code, message) {
			return {
				ok: false,
				error: {
					code,
					message
				}
			};
		}
		/** One private journal path, partitioned by workspace, lineage, and generation. */
		journalDirectory(journal) {
			return join(this.lineageDirectory(journal), String(journal.generation));
		}
		/** Private lineage directory shared by every durable point in a conversation. */
		lineageDirectory(journal) {
			return join(this.config.root, "undo", createHash("sha256").update(journal.workspace).digest("hex"), dataComponent(journal.logicalConversationId));
		}
		/** Private Shadow Git repository; new lineages share one object store across all points. */
		shadowDirectory(journal) {
			if (journal.shadowLayout === "lineage") return join(this.lineageDirectory(journal), "shadow-git");
			return join(this.journalDirectory(journal), "shadow-git");
		}
		/** Persist one journal phase transition. */
		async writeJournal(journal) {
			await writeJson(join(this.journalDirectory(journal), "manifest.json"), conversationUndoJournalSchema.parse(journal));
		}
		/** Serialize all journal mutations for one physical source Session. */
		enqueue(sessionId, operation) {
			const result = (this.operationTails.get(sessionId) ?? Promise.resolve()).then(operation, operation);
			const tail = result.then(() => void 0, () => void 0);
			this.operationTails.set(sessionId, tail);
			return result.finally(() => {
				if (this.operationTails.get(sessionId) === tail) this.operationTails.delete(sessionId);
			});
		}
	};
})();
//#endregion
export { ConversationUndoService, ConversationUndoService as default, replayPromptMessage, retainedLayerForkCut, revokeForkCut, rollbackCountToRetainLayer };
