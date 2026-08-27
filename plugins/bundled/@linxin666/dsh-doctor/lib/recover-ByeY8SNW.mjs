#!/usr/bin/env node
import { t as __exportAll } from "./rolldown-runtime-DCOJ8rT5.mjs";
import { a as profilesDir, c as resolveProfileDir, d as stagingDir, f as validateSegment, l as safeRelativePath, n as journalPath, o as profilesNodeModulesDir, p as workDir, r as locksDir, s as quarantineDir, t as doctorRoot, u as snapshotsDir } from "./paths-CSTri9N_.mjs";
import { createRequire } from "node:module";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
//#region src/core/store.ts
let atomicWriteSequence = 0;
async function readJson(path, fallback) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return fallback;
		throw error;
	}
}
async function writeJsonAtomic(path, value, mode = 384) {
	await mkdir(dirname(path), {
		recursive: true,
		mode: 448
	});
	const temporary = `${path}.tmp-${process.pid}-${Date.now()}-${atomicWriteSequence += 1}`;
	try {
		await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode });
		await rename(temporary, path);
	} catch (error) {
		await rm(temporary, { force: true }).catch(() => void 0);
		throw error;
	}
}
/** Atomically replace a JSON document through an injected filesystem. */
async function writeJsonAtomicFs(fs, path, value) {
	await fs.mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.tmp-${process.pid}-${Date.now()}-${atomicWriteSequence += 1}`;
	try {
		await fs.writeText(temporary, `${JSON.stringify(value, null, 2)}\n`);
		await fs.rename(temporary, path);
	} catch (error) {
		await fs.remove(temporary).catch(() => void 0);
		throw error;
	}
}
async function appendJsonLine(path, value) {
	await mkdir(dirname(path), {
		recursive: true,
		mode: 448
	});
	const { appendFile } = await import("node:fs/promises");
	await appendFile(path, `${JSON.stringify(value)}\n`, { mode: 384 });
}
//#endregion
//#region src/core/yaml.ts
/**
* YAML engine wrapper for the DSH patch-list dialect.
*
* The DSH entry-list dialect is YAML with a custom '!!js' scalar type whose
* scalars round-trip as unevaluated expression nodes. This module provides a
* load/stringify pair with that exact dialect so parsing, fingerprints, and
* plan rewrites never drift from what the DSH loader accepts.
*
* js-yaml is resolved lazily through an injectable loader so tests and other
* embedding environments can supply any module with a compatible interface.
*/
var YamlEngineError = class extends Error {
	path;
	constructor(message, path = "<text>") {
		super(message);
		this.name = "YamlEngineError";
		this.path = path;
	}
};
const DEFAULT_LOADER = (id) => {
	return createRequire(import.meta.url)(id);
};
/** Build a YamlEngine over a js-yaml-compatible module. */
function createYamlEngine(loader = DEFAULT_LOADER, source = "js-yaml") {
	let module;
	const getModule = () => {
		if (module !== void 0) return module;
		try {
			module = loader("js-yaml");
		} catch (error) {
			throw new YamlEngineError("cannot load js-yaml: " + String(error));
		}
		return module;
	};
	return {
		source,
		parse(text) {
			const yaml = getModule();
			try {
				return yaml.load(text, { schema: entryListSchemaOf(yaml) });
			} catch (error) {
				throw new YamlEngineError("failed to parse YAML: " + String(error));
			}
		},
		stringify(value) {
			const yaml = getModule();
			try {
				return yaml.dump(value, {
					schema: entryListSchemaOf(yaml),
					sortKeys: true,
					noRefs: true,
					lineWidth: -1
				});
			} catch (error) {
				throw new YamlEngineError("failed to dump YAML: " + String(error));
			}
		}
	};
}
/** The JsExpr tag singleton per loaded module. */
let jsExprTagOf;
function entryListSchemaOf(yaml) {
	if (jsExprTagOf === void 0) jsExprTagOf = /* @__PURE__ */ new WeakMap();
	const cached = jsExprTagOf.get(yaml);
	if (cached !== void 0) return cached;
	const yamlAny = yaml;
	const typeCtor = yamlAny.Type;
	const jsExpr = new typeCtor("tag:yaml.org,2002:js", {
		kind: "scalar",
		resolve: (data) => typeof data === "string",
		construct: (data) => ({ __jsExpr: data }),
		represent: (node) => node.__jsExpr
	});
	const schema = yamlAny.JSON_SCHEMA.extend?.(jsExpr);
	if (schema === void 0) throw new YamlEngineError("js-yaml JSON_SCHEMA.extend is unavailable");
	jsExprTagOf.set(yaml, schema);
	return schema;
}
/** Parse a patch-list document (top-level YAML array of patch entries). */
function parseEntryList(text, engine, label) {
	let parsed;
	try {
		parsed = engine.parse(text);
	} catch (error) {
		throw new YamlEngineError("failed to parse " + label + ": " + String(error));
	}
	if (parsed === null) return [];
	if (!Array.isArray(parsed)) throw new YamlEngineError(label + " must be a top-level YAML array", label);
	return parsed;
}
//#endregion
//#region src/core/hash.ts
/**
* Content hashing and canonical serialization.
*
* Determinism contract: fingerprints are computed over canonical JSON (object
* keys sorted recursively), never over file text formatting or wall-clock
* data, so two captures of the same logical state yield identical hashes.
*/
/** SHA-256 hex digest of a string or byte buffer. */
function sha256Hex(data) {
	const hash = createHash("sha256");
	if (typeof data === "string") hash.update(data, "utf8");
	else hash.update(data);
	return hash.digest("hex");
}
/** Fixed-length prefix of the SHA-256 digest (default 8 hex chars). */
function sha256Short(data, length = 8) {
	return sha256Hex(data).slice(0, length);
}
/**
* Canonical JSON: object keys sorted recursively, arrays in order, JSON-safe
* primitives only. Values that are not JSON-representable (functions,
* undefined, symbols) are omitted from objects and replaced by null in arrays.
*/
function canonicalJson(value) {
	if (value === null) return "null";
	switch (typeof value) {
		case "string": return JSON.stringify(value);
		case "number":
		case "boolean": return JSON.stringify(value);
		case "undefined":
		case "function":
		case "symbol":
		case "bigint": return "null";
		case "object": {
			if (Array.isArray(value)) return "[" + value.map((item) => canonicalJson(item)).join(",") + "]";
			const record = value;
			const keys = Object.keys(record).sort();
			const parts = [];
			for (const key of keys) {
				const item = record[key];
				if (item === void 0 || typeof item === "function" || typeof item === "symbol") continue;
				parts.push(JSON.stringify(key) + ":" + canonicalJson(item));
			}
			return "{" + parts.join(",") + "}";
		}
		default: return "null";
	}
}
//#endregion
//#region src/core/lock.ts
/**
* Advisory lock manager for repair operations.
*
* Locks are directories under the capsule locks root with a token.json
* inside; directory creation is atomic, so concurrent acquirers cannot both
* win. Stale detection uses the token's heartbeat plus a pid-alive probe;
* stealing renames the whole lock dir aside and retries once.
*/
var LockError = class extends Error {
	code;
	scope;
	key;
	constructor(code, scope, key, detail) {
		super("lock " + scope + ":" + key + ": " + detail);
		this.name = "LockError";
		this.code = code;
		this.scope = scope;
		this.key = key;
	}
};
const DEFAULT_STALE_MS = 15e3;
const DEFAULT_TIMEOUT_MS = 3e4;
const lockKey = (scope, profile) => scope === "global" ? "global" : "profile/" + profile;
/** Create a lock manager rooted under the capsule locks dir. */
function createLockManager(deps) {
	const fs = deps.fs;
	const root = locksDir(deps.home);
	const pid = deps.pid ?? 0;
	const host = deps.host ?? "local";
	const now = deps.clock;
	const iso = deps.iso;
	const pidAlive = deps.pidAlive ?? (() => false);
	const sleep = deps.sleep ?? (async (ms) => {
		await new Promise((resolve) => setTimeout(resolve, ms));
	});
	const acquire = async (scope, profile, options) => {
		const key = lockKey(scope, profile);
		const path = join(root, key.replace(/\//g, "__"));
		const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
		const heartbeatMs = options.heartbeatMs ?? Math.max(1, Math.floor(staleMs / 3));
		const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		const deadline = now() + timeoutMs;
		for (;;) {
			let exists;
			try {
				exists = await fs.exists(path);
			} catch (error) {
				throw new LockError("LOCK_ERROR", scope, key, String(error));
			}
			if (!exists) try {
				const claimed = await claim(scope, key, path, options.intent, heartbeatMs);
				if (claimed !== void 0) return claimed;
			} catch (error) {
				throw new LockError("LOCK_ERROR", scope, key, String(error));
			}
			else {
				const observed = await readTokenForLock(scope, key, path, "reading owner token");
				if (isTokenStale(observed, staleMs)) {
					const confirmed = await readTokenForLock(scope, key, path, "revalidating stale owner");
					if (!isSameStaleLease(observed, confirmed, staleMs)) {
						if (now() >= deadline) {
							if (confirmed !== void 0) throw new LockError("LOCK_HELD", scope, key, "held by pid " + confirmed.pid + " (intent " + confirmed.intent + ")");
							throw new LockError("LOCK_STALE", scope, key, "lock ownership changed while checking staleness");
						}
						await sleep(100);
						continue;
					}
					const stealTo = path + ".stale-" + String(now());
					try {
						await fs.rename(path, stealTo);
					} catch (error) {
						const released = isMissingError(error) || await fs.exists(path).then((exists) => !exists, () => false);
						if (isExistsError(error) || released) continue;
						else throw new LockError("LOCK_STALE", scope, key, "stale lock could not be displaced: " + String(error));
					}
					let displaced;
					try {
						displaced = await readTokenForLock(scope, key, stealTo, "verifying displaced owner");
					} catch (error) {
						if (!await fs.exists(path).catch(() => true)) {
							try {
								await fs.rename(stealTo, path);
							} catch (restoreError) {
								throw new LockError("LOCK_STALE", scope, key, "displaced owner could not be verified or restored: " + String(error) + " / " + String(restoreError));
							}
							throw new LockError("LOCK_STALE", scope, key, "displaced owner could not be verified; original lock restored: " + String(error));
						}
						throw new LockError("LOCK_STALE", scope, key, "displaced owner could not be verified after the canonical path was reclaimed: " + String(error));
					}
					if (!isSameStaleLease(confirmed, displaced, staleMs)) {
						if (!await fs.exists(path).catch(() => true)) try {
							await fs.rename(stealTo, path);
						} catch (error) {
							throw new LockError("LOCK_STALE", scope, key, "lock refreshed during takeover and could not be restored: " + String(error));
						}
						else throw new LockError("LOCK_STALE", scope, key, "lock refreshed during takeover after the canonical path was reclaimed");
						await sleep(100);
						continue;
					}
					if (displaced?.released === true) await fs.remove(stealTo, { recursive: true }).catch(() => void 0);
					try {
						const claimed = await claim(scope, key, path, options.intent, heartbeatMs);
						if (claimed !== void 0) {
							await fs.remove(stealTo, { recursive: true }).catch(() => void 0);
							return claimed;
						}
					} catch (error) {
						throw new LockError("LOCK_STALE", scope, key, "stale lock was displaced but replacement failed: " + String(error));
					}
				}
			}
			if (now() >= deadline) {
				const state = await readTokenForLock(scope, key, path, "reading owner at timeout");
				if (state !== void 0) throw new LockError("LOCK_HELD", scope, key, "held by pid " + state.pid + " (intent " + state.intent + ")");
				throw new LockError("LOCK_STALE", scope, key, "lock present without a readable token");
			}
			await sleep(100);
		}
	};
	const buildToken = (intent) => ({
		pid,
		host,
		intent,
		startedAt: iso(),
		heartbeatAt: now(),
		nonce: Math.random().toString(36).slice(2, 10)
	});
	const claim = async (scope, key, path, intent, heartbeatMs) => {
		const token = buildToken(intent);
		const temporary = path + ".claim-" + String(pid) + "-" + token.nonce;
		let temporaryCreated = false;
		try {
			await fs.mkdir(root, { recursive: true });
			await fs.mkdir(temporary);
			temporaryCreated = true;
			await fs.writeText(join(temporary, "token.json"), JSON.stringify(token, void 0, 2) + String.fromCharCode(10));
			await fs.rename(temporary, path);
			temporaryCreated = false;
			return makeHandle(scope, key, path, token.nonce, heartbeatMs);
		} catch (error) {
			if (temporaryCreated) await fs.remove(temporary, { recursive: true }).catch(() => void 0);
			const targetExists = await fs.exists(path).catch(() => false);
			if (isExistsError(error) || targetExists) return void 0;
			throw error;
		}
	};
	const isTokenStale = (token, staleMs) => {
		if (token === void 0) return true;
		if (token.released === true) return true;
		if (!pidAlive(token.pid)) return true;
		return now() - token.heartbeatAt > staleMs;
	};
	const isSameStaleLease = (observed, confirmed, staleMs) => {
		if (observed === void 0) return confirmed === void 0;
		return confirmed !== void 0 && confirmed.nonce === observed.nonce && isTokenStale(confirmed, staleMs);
	};
	let touchSequence = 0;
	const makeHandle = (scope, key, path, nonce, heartbeatMs) => {
		let released = false;
		let operationQueue = Promise.resolve();
		let heartbeatStopped = heartbeatMs <= 0;
		let heartbeatTimer;
		let leaseFailure;
		const ownedToken = async () => {
			if (released) throw new LockError("LOCK_LOST", scope, key, "lock handle has already been released");
			if (leaseFailure !== void 0) throw leaseFailure;
			let token;
			try {
				token = await readTokenOrNull(path);
			} catch (error) {
				throw new LockError("LOCK_ERROR", scope, key, "lock ownership could not be verified: " + String(error));
			}
			if (token === void 0) throw new LockError("LOCK_LOST", scope, key, "lock dir or token vanished");
			if (token.nonce !== nonce) throw new LockError("LOCK_LOST", scope, key, "lock ownership moved to a different nonce");
			if (token.released === true) throw new LockError("LOCK_LOST", scope, key, "lock lease has already been released");
			return token;
		};
		const runExclusive = async (operation) => {
			const previous = operationQueue;
			let unlock;
			operationQueue = new Promise((resolve) => {
				unlock = resolve;
			});
			await previous;
			try {
				return await operation();
			} finally {
				unlock();
			}
		};
		const publishOwnedToken = async (token, kind) => {
			const temporary = join(path, "token." + nonce + "." + kind + "-" + String(touchSequence += 1));
			try {
				await fs.writeText(temporary, JSON.stringify(token, void 0, 2) + String.fromCharCode(10));
				await ownedToken();
				await fs.rename(temporary, join(path, "token.json"));
			} catch (error) {
				let current;
				try {
					current = await readTokenOrNull(path);
				} catch (readError) {
					throw new LockError("LOCK_ERROR", scope, key, "lock ownership could not be verified after publishing " + kind + ": " + String(readError));
				}
				if (current === void 0 || current.nonce !== nonce || current.released === true) throw new LockError("LOCK_LOST", scope, key, "lock ownership changed while publishing " + kind);
				throw error;
			} finally {
				await fs.remove(temporary).catch(() => void 0);
			}
		};
		const touchOwnedLease = async (at) => {
			try {
				const token = await ownedToken();
				await publishOwnedToken({
					...token,
					heartbeatAt: at
				}, "touch");
			} catch (error) {
				if (error instanceof LockError) throw error;
				throw new LockError("LOCK_ERROR", scope, key, "heartbeat failed: " + String(error));
			}
		};
		const stopHeartbeat = () => {
			heartbeatStopped = true;
			if (heartbeatTimer !== void 0) {
				clearTimeout(heartbeatTimer);
				heartbeatTimer = void 0;
			}
		};
		const scheduleHeartbeat = () => {
			if (heartbeatStopped || released) return;
			heartbeatTimer = setTimeout(async () => {
				heartbeatTimer = void 0;
				try {
					await runExclusive(async () => {
						if (heartbeatStopped || released) return;
						await touchOwnedLease(now());
					});
				} catch (error) {
					leaseFailure = error instanceof LockError ? error : new LockError("LOCK_ERROR", scope, key, "heartbeat failed: " + String(error));
					heartbeatStopped = true;
				} finally {
					scheduleHeartbeat();
				}
			}, heartbeatMs);
			heartbeatTimer.unref?.();
		};
		const handle = {
			scope,
			key,
			path,
			async touch(at) {
				await runExclusive(async () => {
					await touchOwnedLease(at);
				});
			},
			async release() {
				stopHeartbeat();
				await runExclusive(async () => {
					if (released) return;
					const token = await ownedToken();
					await publishOwnedToken({
						...token,
						heartbeatAt: now(),
						released: true
					}, "release");
					released = true;
				});
			}
		};
		scheduleHeartbeat();
		return handle;
	};
	const status = async (scope, profile) => {
		const key = lockKey(scope, profile);
		const path = join(root, key.replace(/\//g, "__"));
		const token = await readTokenForLock(scope, key, path, "reading lock status");
		if (token === void 0 || token.released === true) return {
			scope,
			key,
			path,
			held: false
		};
		return {
			scope,
			key,
			path,
			held: true,
			token
		};
	};
	const release = async (handle) => {
		await handle.release();
	};
	async function readTokenOrNull(path) {
		try {
			const text = await fs.readText(join(path, "token.json"));
			return JSON.parse(text);
		} catch (error) {
			if (isMissingError(error)) return void 0;
			throw error;
		}
	}
	async function readTokenForLock(scope, key, path, action) {
		try {
			return await readTokenOrNull(path);
		} catch (error) {
			throw new LockError("LOCK_ERROR", scope, key, action + " failed: " + String(error));
		}
	}
	return {
		acquire,
		status,
		release
	};
}
function isExistsError(error) {
	return error.code === "EEXIST" || error instanceof Error && /exists/i.test(error.message);
}
function isMissingError(error) {
	return error.code === "ENOENT";
}
//#endregion
//#region src/core/journal.ts
/** Create a journal rooted at a directory (journal.jsonl). */
function createJournal(deps) {
	return {
		path: deps.file,
		async append(entry) {
			const current = await readFileOrEmpty(deps.fs, deps.file);
			let seq = 1;
			if (current.trim() !== "") {
				const lastLine = current.trim().split(String.fromCharCode(10)).pop();
				if (lastLine !== void 0) try {
					seq = JSON.parse(lastLine).seq + 1;
				} catch (error) {
					seq = countLines(current) + 1;
				}
			}
			const full = {
				...entry,
				seq,
				at: deps.now()
			};
			const line = JSON.stringify(full) + String.fromCharCode(10);
			await deps.fs.writeText(deps.file, current + line);
			return full;
		},
		async replay() {
			const text = await readFileOrEmpty(deps.fs, deps.file);
			if (text === "") return {
				entries: [],
				corrupted: 0
			};
			const entries = [];
			let corrupted = 0;
			for (const line of text.split(String.fromCharCode(10))) {
				if (line.trim() === "") continue;
				try {
					const parsed = JSON.parse(line);
					if (typeof parsed.seq === "number" && typeof parsed.op === "string") entries.push(parsed);
					else corrupted += 1;
				} catch (error) {
					corrupted += 1;
				}
			}
			return {
				entries: entries.sort((a, b) => a.seq - b.seq),
				corrupted
			};
		}
	};
}
function countLines(text) {
	return text.split(String.fromCharCode(10)).filter((l) => l.trim() !== "").length;
}
async function readFileOrEmpty(fs, file) {
	try {
		return await fs.readText(file);
	} catch (error) {
		if (error.code === "ENOENT") return "";
		throw error;
	}
}
//#endregion
//#region src/core/snapshot.ts
/**
* Snapshot capture, verification, and restore.
*
* A snapshot stores the deterministic state of one profile: manifest files
* (never node_modules), redacted copies of every text file, dump fingerprints,
* and an opaque engine-state payload. All writes go through the injected
* FsLike so tests run against the in-memory tree and partial-write failures
* are observable.
*/
/** Recursively list files under dir, sorted by path, skipping exclude dirs. */
async function listProfileFiles(fs, dir, excludeDirs) {
	const found = [];
	const walk = async (current, rel) => {
		let entries;
		try {
			entries = await fs.readdir(current);
		} catch {
			return;
		}
		for (const entry of entries) {
			if (excludeDirs.includes(entry.name) && entry.kind === "dir") continue;
			if (entry.kind !== "file") continue;
			found.push({
				path: join(current, entry.name),
				rel: rel === "" ? entry.name : rel + "/" + entry.name
			});
		}
		for (const entry of entries) {
			if (excludeDirs.includes(entry.name) && entry.kind === "dir") continue;
			if (entry.kind !== "dir") continue;
			await walk(join(current, entry.name), rel === "" ? entry.name : rel + "/" + entry.name);
		}
	};
	await walk(dir, "");
	return found.sort((a, b) => a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);
}
/** Capture one profile snapshot and write the manifest. */
async function captureSnapshot(deps) {
	const exclude = deps.excludeDirs ?? [
		"node_modules",
		".git",
		".pnpm"
	];
	const maxBytes = deps.maxFileBytes ?? 1024 * 1024;
	const files = await listProfileFiles(deps.fs, deps.profileDir, exclude);
	const entries = [];
	for (const file of files) {
		const safeRel = safeRelativePath(file.rel);
		const stat = await deps.fs.stat(file.path);
		if (stat.kind === "file" && stat.size > maxBytes) {
			entries.push({
				path: safeRel,
				size: stat.size,
				omitted: true
			});
			continue;
		}
		const data = await deps.fs.readBytes(file.path);
		const bytes = data.byteLength;
		const binary = isBinary(data);
		if (bytes > maxBytes) {
			entries.push({
				path: safeRel,
				hash: sha256Hex(data),
				size: bytes,
				kind: binary ? "binary" : "text",
				omitted: true
			});
			continue;
		}
		const hash = sha256Hex(data);
		await deps.fs.mkdir(join(deps.snapshotDir, "files"), { recursive: true });
		await deps.fs.mkdir(join(deps.snapshotDir, "redacted"), { recursive: true });
		await mkdirFor(deps.fs, join(deps.snapshotDir, "redacted", safeRel));
		const entry = {
			path: safeRel,
			hash,
			size: bytes,
			kind: binary ? "binary" : "text"
		};
		if (!binary) {
			const text = new TextDecoder("utf-8").decode(data);
			const redacted = deps.redactTexts(text);
			await deps.fs.writeText(join(deps.snapshotDir, "redacted", safeRel), redacted.text);
			entry.redactedHash = redacted.fingerprint;
		}
		await mkdirFor(deps.fs, join(deps.snapshotDir, "files", safeRel));
		await deps.fs.writeBytes(join(deps.snapshotDir, "files", safeRel), data);
		entries.push(entry);
	}
	const manifestCore = {
		schemaVersion: 1,
		profile: deps.profile,
		files: entries
	};
	const tsCompact = deps.now().replace(/[^0-9]/g, "").slice(0, 14);
	const manifest = {
		schemaVersion: 1,
		snapshotId: deps.profile + "." + tsCompact + "-" + sha256Short(JSON.stringify(manifestCore), 8),
		createdAt: deps.now(),
		sourceHome: deps.home,
		profile: deps.profile,
		dshVersion: deps.dshVersion,
		files: entries,
		dumps: deps.dumps ?? [],
		state: deps.state
	};
	await deps.fs.writeText(join(deps.snapshotDir, "manifest.json"), JSON.stringify(manifest, void 0, 2) + "\n");
	return manifest;
}
async function mkdirFor(fs, file) {
	const index = file.lastIndexOf("/");
	const parent = index <= 0 ? "/" : file.slice(0, index);
	await fs.mkdir(parent, { recursive: true });
}
function isBinary(data) {
	const sample = data.subarray(0, 4096);
	for (let index = 0; index < sample.length; index += 1) if (sample[index] === 0) return true;
	return false;
}
//#endregion
//#region src/core/spec.ts
/** Whether a spec is already pinned to a single exact artifact. */
function isPinned(spec) {
	return spec.kind === "exact" || spec.kind === "file" || spec.kind === "tarball" || spec.kind === "workspace" || isCommitPinnedGit(spec);
}
/** Whether a git spec names a commit-ish ref (7+ hex digits). */
function isCommitPinnedGit(spec) {
	if (spec.kind !== "git" && spec.kind !== "github") return false;
	if (spec.ref === void 0) return false;
	return /^[0-9a-fA-F]{7,40}$/.test(spec.ref);
}
/** Whether a spec points at a local filesystem path (link/file). */
function isLocalSpec(spec) {
	return spec.kind === "link" || spec.kind === "file" || spec.kind === "workspace";
}
//#endregion
//#region src/core/patch.ts
/** Parse a patch-list document (top-level YAML array of patch entries). */
function parsePatchList(text, engine, label) {
	let entries;
	try {
		entries = parseEntryList(text, engine, label);
	} catch (error) {
		return {
			entries: [],
			error: error.message,
			warnings: []
		};
	}
	const warnings = [];
	const patches = [];
	for (let index = 0; index < entries.length; index += 1) {
		const entry = entries[index];
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return {
			entries: [],
			error: label + " entry " + (index + 1) + " must be a mapping (a loader patch entry)",
			warnings
		};
		patches.push(entry);
	}
	const structural = validatePatchEntries(patches);
	return {
		entries: patches,
		warnings: [...warnings, ...structural]
	};
}
/**
* Structural validation of patch entries (no composition context needed).
* Returns non-fatal warnings: no-op entries, bad insert members, non-string
* identifiers.
*/
function validatePatchEntries(entries, label = "patch list") {
	const warnings = [];
	for (let index = 0; index < entries.length; index += 1) {
		const entry = entries[index];
		const where = label + " entry " + (index + 1);
		const hasId = typeof entry.id === "string";
		const hasInsert = entry.insert !== void 0;
		const hasOverride = !hasInsert && hasId && Object.keys(entry).some((key) => key !== "id" && key !== "name" && key !== "insert");
		if (!hasId && !hasInsert && !hasOverride) warnings.push(where + " is a no-op (no id, no insert, no overrides)");
		if (entry.id !== void 0 && typeof entry.id !== "string") warnings.push(where + ": id must be a string");
		if (entry.name !== void 0 && typeof entry.name !== "string") warnings.push(where + ": name must be a string");
		if (hasInsert) {
			if (!Array.isArray(entry.insert)) {
				warnings.push(where + ": insert must be an array of entry rows");
				continue;
			}
			for (let inner = 0; inner < entry.insert.length; inner += 1) {
				const row = entry.insert[inner];
				if (typeof row !== "object" || row === null || Array.isArray(row)) warnings.push(where + ": insert member " + (inner + 1) + " must be a mapping");
			}
		}
	}
	return warnings;
}
/**
* Collect every row id in a composed tree, including nested group children.
*/
function collectIds(rows) {
	const ids = [];
	const walk = (entries) => {
		for (const entry of entries) {
			if (typeof entry.id === "string") ids.push(entry.id);
			if (entry.group !== void 0 && Array.isArray(entry.config)) walk(entry.config);
		}
	};
	walk(rows);
	return ids;
}
/** Duplicate row ids in a composed tree: id -> occurrence count. */
function duplicateIds(rows) {
	const counts = /* @__PURE__ */ new Map();
	for (const id of collectIds(rows)) counts.set(id, (counts.get(id) ?? 0) + 1);
	const result = [];
	for (const [id, count] of counts) if (count > 1) result.push({
		id,
		count
	});
	return result.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
/** Every plugin name referenced by the rows (excluding disabled rows). */
function rowNames(rows) {
	const counts = /* @__PURE__ */ new Map();
	const walk = (entries) => {
		for (const entry of entries) {
			if (typeof entry.name === "string" && entry.disabled !== true) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
			if (entry.group !== void 0 && Array.isArray(entry.config)) walk(entry.config);
		}
	};
	walk(rows);
	const result = [];
	for (const [name, count] of counts) result.push({
		name,
		count
	});
	return result.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}
/** Find the settings row (id 'settings') and report its configured path. */
function findSettingsRow(rows) {
	const walk = (entries) => {
		for (const entry of entries) {
			if (entry.id === "settings" && entry.config !== void 0 && typeof entry.config === "object" && !Array.isArray(entry.config)) return entry;
			if (entry.group !== void 0 && Array.isArray(entry.config)) {
				const nested = walk(entry.config);
				if (nested !== void 0) return nested;
			}
		}
	};
	const row = walk(rows);
	if (row === void 0 || row.config === void 0 || typeof row.config !== "object" || Array.isArray(row.config)) return void 0;
	const config = row.config;
	if (typeof config.path !== "string") return void 0;
	const value = config.path;
	return {
		path: value,
		absolute: value.startsWith("/") || /^[A-Za-z]:\//.test(value)
	};
}
//#endregion
//#region src/core/diagnose.ts
/**
* Deterministic diagnosis over parsed profile state.
*
* Pure over its inputs: no process spawning, no network, no writes. Callers
* assemble the inputs (manifest, patch reports, inventory, fallback scan,
* env scan, toolchain) and receive a sorted Diagnostic list.
*/
/** Order for severity buckets; stable sort by this then code then path. */
const SEVERITY_ORDER$1 = {
	critical: 0,
	error: 1,
	warn: 2,
	info: 3
};
/** Diagnose one profile from pre-fetched state. */
function diagnoseProfile(input) {
	const diagnostics = [];
	const diag = (code, severity, path, detail, remediation, gate, evidence) => {
		diagnostics.push({
			code,
			severity,
			path,
			detail,
			remediation,
			gate,
			evidence
		});
	};
	if (!input.manifest.hasDshProfile) diag("D-010", "warn", "package.json", "manifest has no dsh.profile.bundles; the profile boots the default bundle set", "add dsh.profile.bundles to the manifest");
	for (const bundle of input.manifest.bundles) {
		if (!input.bundleResolvable(bundle)) {
			diag("D-020", "error", "package.json", "profile bundle " + JSON.stringify(bundle) + " is not resolvable from the dsh installation or the profile dir", "remove the bundle row or provision " + bundle + " as an exact version", "dump-default");
			continue;
		}
		if (input.bundleDeclaresPatch(bundle) === false) diag("D-030", "error", "package.json", "profile bundle " + JSON.stringify(bundle) + " declares no dsh.bundle in its package.json", "remove the bundle row or upgrade the package", "dump-default");
	}
	const patchReports = [{
		label: "profile patch",
		report: input.profilePatch,
		code: "D-040"
	}, {
		label: "home patch",
		report: input.homePatch,
		code: "D-050"
	}];
	for (const item of patchReports) if (item.report?.error !== void 0) diag(item.code, "critical", join(input.dir, "cordis.patch.yml"), item.label + " is unparseable: " + item.report.error, "quarantine the broken file and write an empty patch list", "dump-default");
	if (input.rows !== void 0) {
		for (const named of rowNames(input.rows)) {
			const name = named.name;
			if (classifyRowName(name) !== void 0 && !input.bundleResolvable(name)) diag("D-021", "warn", "cordis.patch.yml", "row plugin " + JSON.stringify(name) + " may not resolve (not in the installation closure or profile node_modules)", "ensure the plugin is an installed dependency");
		}
		for (const dup of duplicateIds(input.rows)) diag("D-230", "error", "cordis.patch.yml", "duplicate entry id " + JSON.stringify(dup.id) + " (count " + dup.count + ") in the composed tree", "disable the later row by id");
		const settings = findSettingsRow(input.rows);
		if (settings !== void 0 && settings.absolute) {
			if (!settings.path.startsWith(input.home + "/")) diag("D-080", "warn", "cordis.patch.yml", "settings row path is absolute and outside the current home: " + settings.path, "rewrite the path to a dshHomePath expression");
		}
	}
	if (input.inventory !== void 0) diagnoseInventory(input.inventory, diag);
	if (input.toolchain !== void 0) diagnoseToolchain(input.toolchain, diag);
	return sortDiagnostics(diagnostics);
}
function classifyRowName(name) {
	if (name.startsWith("@deepseek-ai/")) return name;
	if (name.startsWith("@")) return name;
	if (name.includes("/")) return name;
}
function diagnoseInventory(inventory, diag) {
	for (const row of inventory.rows) {
		const spec = row.spec;
		if (isLocalSpec(spec) && spec.target !== void 0 && spec.target.startsWith("/")) {}
		if (spec.kind === "github" || spec.kind === "git") {
			if (!isPinned(spec)) diag("D-100", "warn", "package.json", "git dependency " + row.name + " is not commit-pinned (" + row.declared + "); the lockfile pins the resolved commit but a fresh install resolves the branch again", "record the lockfile commit and repin the spec");
		}
		if (row.mismatch) diag("D-120", "error", "pnpm-lock.yaml", "lockfile disagrees with pinned spec " + row.name + " (declared " + spec.version + ", locked " + row.locked + ")", "regenerate the lockfile with the pinned pnpm");
		if (!row.installed && row.name.startsWith("@linxin666/")) diag("D-130", "warn", "node_modules", "plugin " + row.name + " is declared but not installed", "run a frozen-lockfile install in the profile dir");
	}
	if (inventory.lockfile === "missing" && inventory.rows.length > 0) diag("D-110", "warn", "pnpm-lock.yaml", "dependencies are declared but no lockfile exists; installs are not frozen", "generate the lockfile (pnpm install --lockfile-only)");
	if (inventory.lockfile === "broken") diag("D-115", "error", "pnpm-lock.yaml", "lockfile is unparseable", "regenerate or restore the lockfile from a snapshot");
	if (inventory.lockfile === "ok" && inventory.lockfileVersion !== void 0 && !/^9\b/.test(inventory.lockfileVersion)) diag("D-214", "info", "pnpm-lock.yaml", "lockfileVersion " + inventory.lockfileVersion + " is not v9; the engine targets pnpm v9 layout", "pin a matching pnpm");
	const ws = inventory.workspace;
	if (ws !== void 0 && ws.nodeLinker !== void 0 && ws.nodeLinker !== "hoisted") diag("D-140", "warn", "pnpm-workspace.yaml", "nodeLinker is " + ws.nodeLinker + "; DSH profiles use hoisted linking", "restore the workspace setting");
	if (ws !== void 0 && ws.minimumReleaseAgeExclude.length > 0) diag("D-150", "info", "pnpm-workspace.yaml", "minimumReleaseAgeExclude is present; release-age filtering needs registry metadata and can break offline installs", "strip for offline provision");
	if (inventory.nodeModules === "unreadable") diag("D-132", "warn", "node_modules", "node_modules is present but unreadable", "reprovision the profile");
}
function diagnoseToolchain(toolchain, diag) {
	const minor = parseNodeVersion(toolchain.node);
	if (minor !== void 0 && minor < 2219) diag("D-210", "error", "<toolchain>", "node " + toolchain.node + " is below the 22.19 floor the DSH runtime needs", "use node 22.19 or newer");
	else if (minor === void 0) diag("D-210", "warn", "<toolchain>", "cannot parse node version " + toolchain.node, "report the exact node -v output");
}
function parseNodeVersion(value) {
	const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value.trim());
	if (match === null) return void 0;
	return Number(match[1]) * 100 + Number(match[2]);
}
/** Sort diagnostics deterministically: severity, code, path. */
function sortDiagnostics(diagnostics) {
	return [...diagnostics].sort((a, b) => {
		const bySeverity = SEVERITY_ORDER$1[a.severity] - SEVERITY_ORDER$1[b.severity];
		if (bySeverity !== 0) return bySeverity;
		if (a.code !== b.code) return a.code < b.code ? -1 : 1;
		if (a.path !== b.path) return a.path < b.path ? -1 : 1;
		if (a.detail !== b.detail) return a.detail < b.detail ? -1 : 1;
		return 0;
	});
}
/** Scan the DSH-managed fallback directory for link anomalies. */
async function diagnoseFallback(fs, home) {
	const fallback = profilesNodeModulesDir(home);
	if (!await fs.exists(fallback)) return [];
	const diagnostics = [];
	const top = await fs.readdir(fallback);
	for (const entry of top) {
		const path = join(fallback, entry.name);
		if (entry.kind === "link") {
			const read = await fs.readlink(path);
			let alive = true;
			try {
				await fs.stat(path);
			} catch (error) {
				alive = false;
			}
			if (!alive) diagnostics.push({
				code: "D-170",
				severity: "info",
				path,
				detail: "fallback link " + entry.name + " is dangling (target " + read + " missing)",
				evidence: "dangling"
			});
			continue;
		}
		if (entry.kind === "dir" && !entry.name.startsWith("@")) {
			diagnostics.push({
				code: "D-180",
				severity: "error",
				path,
				detail: "fallback " + entry.name + " is a real directory where dsh maintains a symlink; the next boot fails",
				remediation: "move it aside and let dsh re-heal the fallback"
			});
			continue;
		}
		if (entry.kind === "dir" && entry.name.startsWith("@")) for (const scoped of await fs.readdir(path)) {
			if (scoped.kind !== "link") continue;
			const scopedPath = join(path, scoped.name);
			let alive = true;
			try {
				await fs.stat(scopedPath);
			} catch (error) {
				alive = false;
			}
			if (!alive) diagnostics.push({
				code: "D-170",
				severity: "info",
				path: scopedPath,
				detail: "fallback link " + entry.name + "/" + scoped.name + " is dangling",
				evidence: "dangling"
			});
		}
	}
	return sortDiagnostics(diagnostics);
}
//#endregion
//#region src/core/manifest.ts
/**
* Profile manifest reading and validation. This layer only reads and
* validates; mutation is expressed by PlanActions and executed elsewhere.
*/
var ManifestError = class extends Error {
	path;
	constructor(message, path) {
		super(message);
		this.name = "ManifestError";
		this.path = path;
	}
};
/** Parse and validate a profile manifest text. */
function parseProfileManifest(text, path) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		return {
			facts: emptyFacts(),
			error: "profile manifest " + path + " is not valid JSON: " + String(error)
		};
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {
		facts: emptyFacts(),
		error: "profile manifest " + path + " must hold a JSON object"
	};
	const raw = parsed;
	const dshSection = isObject(raw.dsh) ? raw.dsh : void 0;
	const profileSection = dshSection !== void 0 && isObject(dshSection.profile) ? dshSection.profile : void 0;
	let bundles = [];
	if (profileSection !== void 0 && profileSection.bundles !== void 0) {
		if (!Array.isArray(profileSection.bundles) || profileSection.bundles.some((item) => typeof item !== "string")) return {
			facts: emptyFacts(),
			error: "profile manifest " + path + ": dsh.profile.bundles must be an array of strings"
		};
		bundles = [...profileSection.bundles];
	}
	let dependencies = {};
	if (raw.dependencies !== void 0) {
		if (!isObject(raw.dependencies)) return {
			facts: emptyFacts(),
			error: "profile manifest " + path + ": dependencies must be an object"
		};
		const rawDeps = raw.dependencies;
		for (const key of Object.keys(rawDeps)) if (typeof rawDeps[key] !== "string") return {
			facts: emptyFacts(),
			error: "profile manifest " + path + ": dependency " + key + " must be a string specifier"
		};
		dependencies = Object.fromEntries(Object.entries(rawDeps).map(([key, value]) => [key, value]));
	}
	return { facts: {
		raw,
		private: raw.private === true ? true : void 0,
		bundles,
		hasDshProfile: profileSection !== void 0,
		dependencies
	} };
}
function emptyFacts() {
	return {
		raw: {},
		bundles: [],
		hasDshProfile: false,
		dependencies: {}
	};
}
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Read and parse the manifest of one profile directory. */
async function readProfileManifest(fs, dir) {
	const path = join(dir, "package.json");
	let text;
	try {
		text = await fs.readText(path);
	} catch (error) {
		if (error.code === "ENOENT") return {
			facts: emptyFacts(),
			text: "",
			error: "profile manifest missing at " + path
		};
		throw error;
	}
	const parsed = parseProfileManifest(text, path);
	return {
		facts: parsed.facts,
		text,
		error: parsed.error
	};
}
/** Serialize a manifest back in the DSH-writer format (2-space + newline). */
function writeProfileManifestJson(manifest) {
	return JSON.stringify(manifest, void 0, 2) + "\n";
}
/**
* Apply structured edits to a manifest JSON text without touching other
* fields. Paths are dotted (dsh.profile.bundles). Returns the new text and
* whether anything changed.
*/
function editManifestJson(text, edits) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new ManifestError("cannot edit unparsable manifest: " + String(error), "<manifest>");
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new ManifestError("manifest is not a JSON object", "<manifest>");
	const root = parsed;
	let changed = false;
	for (const key of Object.keys(edits.set ?? {})) {
		const segments = key.split(".");
		const value = (edits.set ?? {})[key];
		const target = resolvePathIn(root, segments, true);
		if (target === void 0) throw new ManifestError("cannot resolve edit path " + key, "<manifest>");
		if (JSON.stringify(target[segments[segments.length - 1]]) !== JSON.stringify(value)) {
			target[segments[segments.length - 1]] = value;
			changed = true;
		}
	}
	for (const key of edits.remove ?? []) {
		const segments = key.split(".");
		const target = resolvePathIn(root, segments, false);
		if (target === void 0) continue;
		if (segments[segments.length - 1] in target) {
			delete target[segments[segments.length - 1]];
			changed = true;
		}
	}
	return {
		text: changed ? writeProfileManifestJson(root) : text,
		changed
	};
}
function resolvePathIn(root, segments, create) {
	let current = root;
	const last = segments[segments.length - 1];
	for (let index = 0; index < segments.length - 1; index += 1) {
		const segment = segments[index];
		let next = current[segment];
		if (typeof next !== "object" || next === null || Array.isArray(next)) {
			if (!create) return void 0;
			next = {};
			current[segment] = next;
		}
		current = next;
	}
	if (last === "") return void 0;
	return current;
}
//#endregion
//#region src/core/plan.ts
/**
* Deterministic repair planning.
*
* The planner maps diagnostics to a stable, ordered action list. It is pure
* over its inputs and never touches the filesystem: file contents needed for
* rewrites are supplied by the caller, and the plan hash lets callers detect
* plan identity without inspecting actions.
*/
const SEVERITY_ORDER = {
	critical: 0,
	error: 1,
	warn: 2,
	info: 3
};
/** Build the repair plan for a diagnostic list. Same inputs always produce the same actions. */
function planRepair(input) {
	const actions = [];
	for (const diag of sortInput(input.diagnostics)) {
		const fixes = fixFor(diag, input);
		for (const fix of fixes) actions.push(fix);
	}
	const sorted = actions.sort(byActionOrder);
	return {
		actions: sorted,
		hash: planHash(sorted)
	};
}
/** Deterministic hash of an action list. */
function planHash(actions) {
	return sha256Short(canonicalJson(actions), 12);
}
function sortInput(diagnostics) {
	return [...diagnostics].sort((a, b) => {
		const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
		if (bySeverity !== 0) return bySeverity;
		if (a.code !== b.code) return a.code < b.code ? -1 : 1;
		if (a.path !== b.path) return a.path < b.path ? -1 : 1;
		return 0;
	});
}
function byActionOrder(a, b) {
	if (a.target !== b.target) return a.target < b.target ? -1 : 1;
	if (a.op !== b.op) return a.op < b.op ? -1 : 1;
	return 0;
}
function fixFor(diag, input) {
	switch (diag.code) {
		case "D-040":
		case "D-050": {
			const path = input.patchPathByCode[diag.code] ?? diag.path;
			if ((input.files[path] ?? "") === "") return [];
			return [{
				op: "move-path",
				target: path,
				to: path + ".doctor-broken",
				sourceCode: [diag.code]
			}, {
				op: "write-file",
				target: path,
				content: "# dsh-doctor: quarantined a broken patch (see " + path + ".doctor-broken)\n[]\n",
				sourceCode: [diag.code]
			}];
		}
		case "D-020":
		case "D-030": {
			const manifestPath = diag.path;
			const text = input.files[manifestPath];
			if (text === void 0) return [];
			const bundleName = extractBundleName(diag.detail);
			if (bundleName === void 0) return [];
			const removed = removeBundle(text, bundleName);
			if (removed === void 0) return [];
			return [{
				op: "write-file",
				target: manifestPath,
				content: removed,
				sourceCode: [diag.code]
			}];
		}
		case "D-080": {
			const patchPath = diag.path;
			const text = input.files[patchPath];
			if (text === void 0) return [];
			const rewritten = rewriteSettingsPath(text, diag.evidence, input.profile);
			if (rewritten === void 0) return [];
			return [{
				op: "write-file",
				target: patchPath,
				content: rewritten,
				sourceCode: [diag.code]
			}];
		}
		default: return [];
	}
}
function extractBundleName(detail) {
	const match = /profile bundle ("(?:[^"]*)")/.exec(detail);
	if (match === null) return void 0;
	try {
		return JSON.parse(match[1]);
	} catch (error) {
		return;
	}
}
function removeBundle(text, bundleName) {
	let manifest;
	try {
		manifest = JSON.parse(text);
	} catch (error) {
		return;
	}
	if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) return void 0;
	const dsh = manifest.dsh;
	if (typeof dsh !== "object" || dsh === null) return void 0;
	const profile = dsh.profile;
	if (typeof profile !== "object" || profile === null) return void 0;
	const bundles = profile.bundles;
	if (!Array.isArray(bundles) || !bundles.includes(bundleName)) return void 0;
	const next = bundles.filter((item) => item !== bundleName);
	try {
		const edited = editManifestJson(text, { set: { "dsh.profile.bundles": next } });
		return edited.changed ? edited.text : void 0;
	} catch (error) {
		return;
	}
}
function rewriteSettingsPath(text, oldPath, profile) {
	if (oldPath === void 0) return void 0;
	const newExpr = "!!js dshHomePath('profiles/" + profile + "/settings.yaml')";
	const escaped = escapeRegExp(oldPath);
	const pattern = new RegExp("(path\\s*:\\s*)(\"?" + escaped + "\\1?)");
	const replaced = text.replace(pattern, "$1" + newExpr);
	return replaced === text ? void 0 : replaced;
}
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//#endregion
//#region src/core/fs.ts
/** Error carrying a stable filesystem error code (ENOENT, EEXIST, ...). */
var FsError = class extends Error {
	code;
	path;
	constructor(code, path, detail) {
		super("[fs] " + code + ": " + path + (detail === void 0 ? "" : " (" + detail + ")"));
		this.name = "FsError";
		this.code = code;
		this.path = path;
	}
};
function classify(stat) {
	if (stat.isFile()) return "file";
	if (stat.isDirectory()) return "dir";
	if (stat.isSymbolicLink()) return "link";
	return "other";
}
function codeOf(error) {
	return error?.code;
}
/** Real filesystem backed by node:fs/promises. */
const nodeFs = {
	async readText(path) {
		return await (await import("node:fs/promises")).readFile(path, "utf8");
	},
	async readBytes(path) {
		const fsp = await import("node:fs/promises");
		return new Uint8Array(await fsp.readFile(path));
	},
	async writeText(path, text) {
		await (await import("node:fs/promises")).writeFile(path, text, "utf8");
	},
	async writeBytes(path, data) {
		const fsp = await import("node:fs/promises");
		const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
		await fsp.writeFile(path, buf);
	},
	async exists(path) {
		const fsp = await import("node:fs/promises");
		try {
			await fsp.lstat(path);
			return true;
		} catch (error) {
			if (codeOf(error) === "ENOENT") return false;
			throw error;
		}
	},
	async stat(path) {
		const fsp = await import("node:fs/promises");
		try {
			const s = await fsp.stat(path);
			return {
				kind: classify(s),
				size: s.size,
				mtimeMs: s.mtimeMs,
				dev: s.dev,
				ino: s.ino
			};
		} catch (error) {
			const code = codeOf(error);
			if (code !== void 0) throw new FsError(code, path);
			throw error;
		}
	},
	async lstat(path) {
		const fsp = await import("node:fs/promises");
		try {
			const s = await fsp.lstat(path);
			return {
				kind: classify(s),
				size: s.size,
				mtimeMs: s.mtimeMs,
				dev: s.dev,
				ino: s.ino
			};
		} catch (error) {
			const code = codeOf(error);
			if (code !== void 0) throw new FsError(code, path);
			throw error;
		}
	},
	async readlink(path) {
		return await (await import("node:fs/promises")).readlink(path);
	},
	async symlink(target, path) {
		await (await import("node:fs/promises")).symlink(target, path);
	},
	async mkdir(path, opts) {
		await (await import("node:fs/promises")).mkdir(path, opts);
	},
	async readdir(path) {
		return (await (await import("node:fs/promises")).readdir(path, { withFileTypes: true })).map((entry) => ({
			name: entry.name,
			kind: classify(entry)
		})).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
	},
	async rename(from, to) {
		await (await import("node:fs/promises")).rename(from, to);
	},
	async unlink(path) {
		await (await import("node:fs/promises")).unlink(path);
	},
	async remove(path, opts) {
		await (await import("node:fs/promises")).rm(path, {
			recursive: opts?.recursive ?? false,
			force: false
		});
	}
};
function parentDir(path) {
	const idx = path.lastIndexOf("/");
	return idx <= 0 ? "/" : path.slice(0, idx);
}
/** Recursively copy a directory tree without following symlinks. */
async function copyTree(fs, from, to) {
	const stat = await fs.lstat(from);
	if (stat.kind === "file") {
		await fs.mkdir(parentDir(to), { recursive: true });
		await fs.writeBytes(to, await fs.readBytes(from));
		return;
	}
	if (stat.kind === "link") {
		await fs.mkdir(parentDir(to), { recursive: true });
		const target = await fs.readlink(from);
		try {
			await fs.symlink(target, to);
		} catch (error) {
			if (!(error instanceof FsError && error.code === "EEXIST")) throw error;
			await fs.unlink(to);
			await fs.symlink(target, to);
		}
		return;
	}
	await fs.mkdir(to, { recursive: true });
	for (const child of await fs.readdir(from)) await copyTree(fs, from + "/" + child.name, to + "/" + child.name);
}
/**
* Move a path across possibly different devices: rename first, then
* copy+remove when the rename fails with EXDEV (works with both FsError and
* raw node errors).
*/
async function movePath(fs, from, to) {
	try {
		await fs.rename(from, to);
		return { copied: false };
	} catch (error) {
		if ((error instanceof FsError ? error.code : codeOf(error)) === "EXDEV") {
			await copyTree(fs, from, to);
			await fs.remove(from, { recursive: true });
			return { copied: true };
		}
		throw error;
	}
}
//#endregion
//#region src/core/transaction.ts
/** Create a candidate transaction for one profile. */
function createCandidateTransaction(deps) {
	const fs = deps.fs;
	const home = deps.home;
	const profile = deps.profile;
	validateSegment(profile, "profile");
	const txnId = deps.initialRecord?.txnId ?? (deps.txnId === void 0 ? makeTxnId(profile, deps.now()) : deps.txnId(profile));
	validateSegment(txnId, "txn id");
	const livePath = home + "/profiles/" + profile;
	const stagingBase = stagingDir(home);
	const stagingPath = stagingBase + "/" + profile + "/" + txnId;
	const quarantineBase = quarantineDir(home);
	const quarantinePath = quarantineBase + "/" + profile + "/" + txnId + "/original";
	if (deps.initialRecord !== void 0 && (deps.initialRecord.profile !== profile || deps.initialRecord.livePath !== livePath || deps.initialRecord.stagingPath !== stagingPath || deps.initialRecord.quarantinePath !== quarantinePath)) throw new Error("txn " + txnId + ": restored transaction paths do not match profile " + profile);
	let phase = deps.initialRecord?.phase ?? "created";
	const steps = deps.initialRecord?.steps ?? [];
	const record = deps.initialRecord ?? {
		txnId,
		profile,
		phase,
		livePath,
		stagingPath,
		quarantinePath,
		steps
	};
	const setPhase = (next) => {
		phase = next;
		record.phase = next;
	};
	const journal = async (op, detail) => {
		if (deps.journal !== void 0) await deps.journal.append({
			op: "txn:" + txnId + ":" + op,
			ok: true,
			detail
		});
	};
	const sameDeviceGuard = async () => {
		if (deps.sameDevice === void 0) return;
		if (!await deps.sameDevice(stagingBase, home + "/profiles")) throw new Error("txn " + txnId + ": staging and profiles are on different devices; refuse rename-based promote");
	};
	const rollbackPromoted = async () => {
		await deps.beforeCompensation?.();
		const discarded = livePath + ".doctor-discarded-" + txnId;
		if (!await fs.exists(quarantinePath)) throw txnError(txnId, phase, "quarantine path missing at " + quarantinePath + "; live profile left untouched");
		if (await fs.exists(discarded)) throw txnError(txnId, phase, "discarded path already exists at " + discarded + "; live profile left untouched");
		await movePath(fs, livePath, discarded);
		try {
			await movePath(fs, quarantinePath, livePath);
		} catch (error) {
			try {
				await deps.beforeCompensation?.();
				await movePath(fs, discarded, livePath);
			} catch (restoreError) {
				setPhase("failed");
				record.error = "rollback failed and restoring the live profile failed: " + String(error) + " / " + String(restoreError);
				throw txnError(txnId, phase, record.error);
			}
			record.error = String(error);
			await journal("rollback-failed", { error: String(error) }).catch(() => void 0);
			throw txnError(txnId, phase, "rollback failed: " + String(error));
		}
		setPhase("rolled-back");
		delete record.error;
		steps.push({
			step: "rollback-restore",
			from: quarantinePath,
			to: livePath
		});
		await fs.remove(discarded, { recursive: true }).catch(() => void 0);
		await journal("rollback-restore");
	};
	return {
		txnId,
		record,
		phase: () => phase,
		async stage() {
			if (phase !== "created") throw txnError(txnId, phase, "stage requires state created");
			if (!await fs.exists(livePath)) throw txnError(txnId, phase, "live profile missing at " + livePath);
			await fs.mkdir(stagingPath, { recursive: true });
			await copyTree(fs, livePath, stagingPath);
			setPhase("staged");
			steps.push({
				step: "stage-copy",
				from: livePath,
				to: stagingPath
			});
			await journal("stage", {
				from: livePath,
				to: stagingPath
			});
		},
		async promote() {
			if (phase !== "staged") throw txnError(txnId, phase, "promote requires state staged");
			await sameDeviceGuard();
			if (await fs.exists(quarantinePath)) throw txnError(txnId, phase, "quarantine path already exists: " + quarantinePath);
			await fs.mkdir(quarantineBase + "/" + profile + "/" + txnId, { recursive: true });
			if (deps.beforePromote === void 0) throw txnError(txnId, phase, "promote requires a durable recovery-intent writer");
			await deps.beforePromote(record);
			let originalQuarantined = false;
			let candidateActivated = false;
			try {
				const first = await movePath(fs, livePath, quarantinePath);
				originalQuarantined = true;
				steps.push({
					step: "promote-quarantine",
					from: livePath,
					to: quarantinePath,
					copied: first.copied
				});
				await journal("promote-quarantine", {
					from: livePath,
					to: quarantinePath,
					copied: first.copied
				});
				const second = await movePath(fs, stagingPath, livePath);
				candidateActivated = true;
				steps.push({
					step: "promote-activate",
					from: stagingPath,
					to: livePath,
					copied: second.copied
				});
				setPhase("promoted");
				await journal("promote-activate", {
					from: stagingPath,
					to: livePath,
					copied: second.copied
				});
			} catch (error) {
				if (!originalQuarantined) {
					record.error = String(error);
					await journal("promote-failed", { error: record.error }).catch(() => void 0);
					throw txnError(txnId, phase, "promote failed before quarantining live: " + record.error);
				}
				let rollbackError;
				try {
					if (candidateActivated) await rollbackPromoted();
					else if (originalQuarantined) {
						await deps.beforeCompensation?.();
						await movePath(fs, quarantinePath, livePath);
						steps.push({
							step: "promote-rollback",
							from: quarantinePath,
							to: livePath
						});
						await fs.remove(stagingPath, { recursive: true });
						setPhase("rolled-back");
					}
				} catch (caught) {
					rollbackError = caught;
				}
				const phaseAfterRollback = record.phase;
				if (phaseAfterRollback !== "rolled-back") {
					if (phaseAfterRollback !== "promoted" && phaseAfterRollback !== "failed") setPhase("failed");
					record.error = "promote failed and rollback failed: " + String(error) + " / " + String(rollbackError);
					throw txnError(txnId, phase, record.error);
				}
				record.error = String(error) + (rollbackError === void 0 ? "" : "; rollback warning: " + String(rollbackError));
				await journal("promote-failed", { error: record.error }).catch(() => void 0);
				throw txnError(txnId, phase, "promote failed: " + record.error);
			}
		},
		async rollback() {
			if (phase === "staged") {
				await fs.remove(stagingPath, { recursive: true });
				setPhase("aborted");
				await journal("rollback-staging-discard");
				return;
			}
			if (phase !== "promoted") throw txnError(txnId, phase, "rollback requires state staged or promoted");
			await rollbackPromoted();
		},
		async abort() {
			if (phase === "created") return;
			if (phase === "promoted") {
				await rollbackPromoted();
				return;
			}
			if (phase === "rolled-back" || phase === "aborted") return;
			await fs.remove(stagingBase + "/" + profile, { recursive: true });
			setPhase("aborted");
			await journal("abort-staging-discard");
		},
		async commit() {
			if (phase !== "promoted") throw txnError(txnId, phase, "commit requires state promoted");
			await journal("commit", { quarantinePath });
			setPhase("committed");
		}
	};
}
function makeTxnId(profile, now) {
	const compact = now.replace(/[^0-9]/g, "").slice(0, 14);
	return profile + "-" + compact;
}
function txnError(txnId, phase, detail) {
	const error = /* @__PURE__ */ new Error("txn " + txnId + " (" + phase + "): " + detail);
	error.code = "TXN_STATE";
	error.phase = phase;
	return error;
}
//#endregion
//#region src/core/redact.ts
/**
* Deterministic secret redaction.
*
* Redaction happens at capture time, before any capsule write. Values are
* replaced by a marker that embeds a short digest of the original value, so
* two snapshots carrying the same secret produce the same redacted text and
* the same fingerprint without ever exposing the secret itself.
*/
/** Marker format: [REDACTION:<rule id>:<sha256-8>]. */
function marker(rule, value) {
	return "[REDACTION:" + rule + ":" + sha256Short(value) + "]";
}
/**
* Default rule set. Covers DSH profile secret placement: settings documents,
* credentials files, .env entries, MCP header values, provider keys, and the
* dump-config output (which prints home patch configs verbatim, including
* 'Authorization: Token ...' headers).
*/
function defaultRules() {
	return [
		{
			id: "key:api-key",
			kind: "key",
			re: /^(?:api[-_ ]?key|api[-_ ]?secret|api[-_ ]?token)$/i
		},
		{
			id: "key:access",
			kind: "key",
			re: /^(?:access[-_ ]?key|access[-_ ]?token|access[-_ ]?secret)$/i
		},
		{
			id: "key:token",
			kind: "key",
			re: /^(?:token|auth[-_ ]?token|session[-_ ]?key|session[-_ ]?token|webhook[-_ ]?secret|mcp[-_ ]?token|chatgpt[-_ ]?token|secret[-_ ]?key|secret)$/i
		},
		{
			id: "key:auth",
			kind: "key",
			re: /^(?:authorization|auth|authenticator|bearer(?:[-_ ]?token)?|credential|credentials|password|passwd|private[-_ ]?key|client[-_ ]?secret)$/i
		},
		{
			id: "pattern:authorization",
			kind: "pattern",
			re: /Authorization\s*:\s*(?:Bearer|Token)\s+\S+/gi
		},
		{
			id: "pattern:bearer-token",
			kind: "pattern",
			re: /(?:Bearer|Token)\s+(?:m0-)?[A-Za-z0-9_-]{16,}/g
		},
		{
			id: "pattern:sk-key",
			kind: "pattern",
			re: /sk-[A-Za-z0-9]{16,}/g
		},
		{
			id: "pattern:mcp-key",
			kind: "pattern",
			re: /m0-[A-Za-z0-9]{16,}/g
		},
		{
			id: "pattern:aws-key",
			kind: "pattern",
			re: /AKIA[0-9A-Z]{16}/g
		},
		{
			id: "pattern:private-key",
			kind: "pattern",
			re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi
		},
		{
			id: "pattern:basic-auth",
			kind: "pattern",
			re: /basic\s+[A-Za-z0-9+/=]{12,}/gi
		}
	];
}
/** Whether a key name matches any key rule. */
function matchesKeyRules(name, rules) {
	for (const rule of rules) {
		if (rule.kind !== "key") continue;
		if (rule.re.test(name)) return rule.id;
	}
}
function redactString(value, rules, hits) {
	let result = value;
	for (const rule of rules) {
		if (rule.kind !== "pattern") continue;
		rule.re.lastIndex = 0;
		let changed = false;
		result = result.replace(rule.re, (full) => {
			changed = true;
			return marker(rule.id, full);
		});
		if (changed) bump(hits, rule.id);
	}
	return result;
}
function bump(hits, rule) {
	const existing = hits.find((hit) => hit.rule === rule);
	if (existing !== void 0) existing.count += 1;
	else hits.push({
		rule,
		count: 1
	});
}
/**
* Text redaction used for settings, patch, and dump documents: key-value
* lines redact by key; then whole-text value patterns run over the joined
* document so multi-line matches (private key blocks) are covered too.
*/
function redactText(text, rules = defaultRules()) {
	const hits = [];
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	const out = [];
	for (const line of lines) {
		const match = /^(\s*)([A-Za-z0-9_. -]+?)\s*:\s*(.*)$/.exec(line);
		if (match !== null) {
			const indent = match[1];
			const key = match[2].trim();
			const rest = match[3];
			const ruleId = matchesKeyRules(key, rules);
			if (ruleId !== void 0 && rest !== "") {
				bump(hits, ruleId);
				out.push(indent + match[2] + ": " + marker(ruleId, rest.trim()));
				continue;
			}
		}
		out.push(redactString(line, rules, hits));
	}
	const result = redactString(out.join("\n"), rules, hits);
	return {
		text: result,
		fingerprint: fingerprintText(result),
		hits: hits.sort(byRuleId)
	};
}
function byRuleId(a, b) {
	return a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0;
}
/** Fingerprint of an already-redacted text (no re-redaction). */
function fingerprintText(text) {
	return sha256Short(text.replace(/\r\n/g, "\n") + "\n");
}
//#endregion
//#region src/core/gates.ts
const SERVER_URL_RE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)/;
const FATAL_PATTERNS = [/fatal load failure/i, /did not activate/i];
/** Parse the printed server URL from gate-2 stdout. */
function parseServerUrl(stdout) {
	const match = SERVER_URL_RE.exec(stdout);
	if (match === null) return void 0;
	return "http://127.0.0.1:" + match[1];
}
/** Merge an environment for an isolated gate run. */
function gateEnvironment(base, isolatedHome) {
	return {
		...base,
		DSH_HOME: isolatedHome,
		DSH_TELEMETRY_DISABLED: "1"
	};
}
/** Run gate 1: bundle-layer dump under a broken-user-layer escape hatch. */
async function runDumpDefaultGate(deps, options, env) {
	const started = deps.clock();
	const result = await runToExit(deps.client, {
		cmd: [
			options.dshPath,
			"--profile",
			options.profile,
			"--dump-default-config"
		],
		cwd: options.isolatedHome,
		env: gateEnvironment(env, options.isolatedHome),
		timeoutMs: options.timeoutMs ?? 3e4
	});
	const report = baseReport(started, deps.clock(), result);
	report.gate = "dump-default";
	report.profile = options.profile;
	if (result.exitCode !== 0) {
		report.ok = false;
		report.error = "dump-default exited with code " + String(result.exitCode) + (result.timedOut ? " (timed out)" : "");
		report.stderrSample = tail(result.stderr, 800);
		return report;
	}
	let parsed;
	try {
		parsed = deps.engine.parse(result.stdout);
	} catch (error) {
		report.ok = false;
		report.error = "dump output is not valid YAML: " + String(error);
		report.stderrSample = tail(result.stderr, 800);
		return report;
	}
	if (!Array.isArray(parsed)) {
		report.ok = false;
		report.error = "dump output must be an entry array";
		report.stderrSample = tail(result.stderr, 800);
		return report;
	}
	report.fingerprint = deps.redactText(result.stdout).fingerprint;
	report.ok = true;
	return report;
}
/** Run gate 2: isolated boot with HTTP probe and graceful termination. */
async function runStartGate(deps, options, env) {
	const started = deps.clock();
	const spawned = deps.client.spawn([
		options.dshPath,
		"--profile",
		options.profile,
		"--no-open",
		"--port",
		"0"
	], {
		cwd: options.isolatedHome,
		env: gateEnvironment(env, options.isolatedHome)
	});
	let stdout = "";
	let stderr = "";
	let url;
	let settle = () => {};
	const waitExit = new Promise((resolve) => {
		settle = resolve;
	});
	spawned.onStdout((chunk) => {
		stdout += chunk;
		if (url === void 0) url = parseServerUrl(stdout);
		if (url !== void 0 && resolveReady !== void 0) resolveReady(url);
	});
	spawned.onStderr((chunk) => {
		stderr += chunk;
	});
	spawned.onExit((code, signal) => {
		settle({
			exitCode: code,
			signal,
			timedOut: false,
			durationMs: deps.clock() - started,
			stdout,
			stderr
		});
	});
	const timeoutMs = options.timeoutMs ?? 45e3;
	let resolveReady;
	const ready = new Promise((resolve) => {
		resolveReady = resolve;
	});
	const timeout = new Promise((resolve) => {
		setTimeout(() => resolve(true), timeoutMs);
	});
	const outcome = await Promise.race([
		ready.then((url) => ({
			kind: "ready",
			url
		})),
		waitExit.then(() => ({ kind: "exited" })),
		timeout.then(() => ({ kind: "timeout" }))
	]);
	if (outcome.kind !== "ready") {
		spawned.kill("SIGKILL");
		const result = await waitExit;
		const report = baseReport(started, deps.clock(), result);
		report.gate = "start";
		report.profile = options.profile;
		report.timedOut = outcome.kind === "timeout";
		report.ok = false;
		report.error = outcome.kind === "timeout" ? "boot did not become ready within " + timeoutMs + "ms" : "boot exited before announcing a server URL";
		report.stderrSample = tail(stderr, 800);
		return report;
	}
	url = outcome.url;
	const probeStatus = options.probeStatus ?? 200;
	const probeMarker = options.probeMarker ?? "__DSH_BOOT__";
	let httpStatus = 0;
	let body = "";
	if (url !== void 0) try {
		const response = await deps.http.get(url + (options.probePath ?? "/"), { timeoutMs: 5e3 });
		httpStatus = response.status;
		body = response.body;
	} catch (error) {
		httpStatus = 0;
	}
	const markerHits = countOccurrences(body, probeMarker);
	spawned.kill("SIGTERM");
	const grace = options.stopGraceMs ?? 7e3;
	const afterKill = await Promise.race([waitExit, new Promise((resolve) => {
		setTimeout(() => resolve(graceResult(deps.clock() - started, stdout, stderr)), grace);
	})]);
	const report = baseReport(started, deps.clock(), afterKill);
	report.gate = "start";
	report.profile = options.profile;
	report.url = url;
	report.httpStatus = httpStatus;
	report.markerHits = markerHits;
	report.stderrSample = tail(stderr, 800);
	if (url === void 0) {
		report.ok = false;
		report.error = "no server URL printed by the boot";
		return report;
	}
	if (httpStatus !== probeStatus) {
		report.ok = false;
		report.error = "probe GET / returned HTTP " + httpStatus + " (expected " + probeStatus + ")";
		return report;
	}
	if (markerHits < 1) {
		report.ok = false;
		report.error = "probe body lacks the boot marker " + JSON.stringify(probeMarker);
		return report;
	}
	if (afterKill.exitCode !== 0) {
		report.ok = false;
		report.error = "boot exited with code " + String(afterKill.exitCode) + " after SIGTERM (graceful 0 expected)";
		return report;
	}
	const fatal = FATAL_PATTERNS.find((pattern) => pattern.test(stderr));
	if (fatal !== void 0) {
		report.ok = false;
		report.error = "fatal boot failure detected in stderr: " + String(fatal);
		return report;
	}
	report.ok = true;
	return report;
}
function graceResult(durationMs, stdout, stderr) {
	return {
		exitCode: null,
		signal: "SIGKILL",
		timedOut: true,
		durationMs,
		stdout,
		stderr
	};
}
function baseReport(started, now, result) {
	return {
		gate: "dump-default",
		profile: "",
		ok: false,
		exitCode: result.exitCode,
		signal: result.signal,
		timedOut: result.timedOut,
		durationMs: result.durationMs || now - started
	};
}
/** Run a process to exit with output capture and timeout. */
async function runToExit(client, spec) {
	const startedAt = Date.now();
	const spawned = client.spawn(spec.cmd, {
		cwd: spec.cwd,
		env: spec.env
	});
	let stdout = "";
	let stderr = "";
	let settle = () => {};
	const done = new Promise((resolve) => {
		settle = resolve;
	});
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		spawned.kill("SIGKILL");
	}, spec.timeoutMs);
	spawned.onStdout((chunk) => {
		stdout += chunk;
	});
	spawned.onStderr((chunk) => {
		stderr += chunk;
	});
	spawned.onExit((code, signal) => {
		clearTimeout(timer);
		settle({
			exitCode: code,
			signal,
			timedOut,
			durationMs: Date.now() - startedAt,
			stdout,
			stderr
		});
	});
	return done;
}
function countOccurrences(text, needle) {
	if (needle === "") return 0;
	let count = 0;
	let index = 0;
	for (;;) {
		index = text.indexOf(needle, index);
		if (index === -1) return count;
		count += 1;
		index += needle.length;
	}
}
function tail(text, max) {
	return text.length <= max ? text : text.slice(text.length - max);
}
//#endregion
//#region src/core/recover.ts
/**
* Recovery orchestration: snapshot, diagnose, plan, stage, verify, promote.
*
* This module wires the deterministic engine pieces into one fail-closed
* transaction. It never edits a live profile directly: every mutation lands
* in a staged candidate, the candidate passes isolated health gates, and
* only then is promoted with the original quarantined. Any gate failure
* aborts or rolls back the transaction and leaves a journal trail.
*
* Everything external (fs, yaml engine, process client, http client, clocks)
* is injected so the flow is hermetic in tests.
*/
var recover_exports = /* @__PURE__ */ __exportAll({
	confirmRepair: () => confirmRepair,
	diagnoseAndPlan: () => diagnoseAndPlan,
	discoverRollbackProfile: () => discoverRollbackProfile,
	realGateDeps: () => realGateDeps,
	repairProfile: () => repairProfile,
	rollbackTransaction: () => rollbackTransaction,
	snapshotProfile: () => snapshotProfile
});
const nodeRequire = createRequire(import.meta.url);
/** Build real process/http gate dependencies for a repair run. */
function realGateDeps(options = {}) {
	return {
		client: { spawn(command, opts) {
			const child = spawnNode(command, opts);
			return {
				onStdout(cb) {
					child.stdout?.on("data", (chunk) => cb(String(chunk)));
				},
				onStderr(cb) {
					child.stderr?.on("data", (chunk) => cb(String(chunk)));
				},
				onExit(cb) {
					child.once("close", (code, signal) => cb(code, signal));
				},
				kill(signal) {
					child.kill(signal);
				}
			};
		} },
		http: { async get(url, opts) {
			const response = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs) });
			return {
				status: response.status,
				body: await response.text()
			};
		} },
		engine: options.engine ?? createYamlEngine(),
		redactText: (text) => redactText(text),
		clock: options.clock ?? Date.now
	};
}
function spawnNode(command, opts) {
	return nodeRequire("node:child_process").spawn(command[0], command.slice(1), {
		cwd: opts.cwd,
		env: opts.env
	});
}
/** Snapshot one profile (read-only aside from the snapshot store). */
async function snapshotProfile(request) {
	const fs = request.fs ?? nodeFs;
	const now = request.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
	const dir = resolveProfileDir(request.home, request.profile);
	const snapshotDir = snapshotsDir(request.home) + "/" + makeId(request.profile, now());
	await fs.mkdir(snapshotDir, { recursive: true });
	return {
		ok: true,
		phase: "diagnosed",
		diagnostics: [],
		actions: [],
		manualActions: [],
		snapshotId: (await captureSnapshot({
			fs,
			home: request.home,
			profile: request.profile,
			profileDir: dir,
			snapshotDir,
			now,
			redactTexts: (text) => redactText(text)
		})).snapshotId
	};
}
/** Diagnose and plan one profile without mutating it. */
async function diagnoseAndPlan(request) {
	return await diagnoseAndPlanInner(request, request.fs ?? nodeFs, request.gate?.engine ?? createYamlEngine());
}
async function diagnoseAndPlanInner(request, fs, engine) {
	const home = request.home;
	const profile = request.profile;
	const dir = resolveProfileDir(home, profile);
	const profilePatchPath = dir + "/cordis.patch.yml";
	const homePatchPath = home + "/cordis.patch.yml";
	const manifest = await readProfileManifest(fs, dir).catch(() => null);
	const manifestFacts = manifest?.facts ?? {
		hasDshProfile: false,
		bundles: []
	};
	const manifestText = manifest?.text ?? "";
	const profilePatch = parsePatchListSafe(await patchText(fs, profilePatchPath), engine, "profile patch");
	const homePatch = parsePatchListSafe(await patchText(fs, homePatchPath), engine, "home patch");
	const fallbacks = await diagnoseFallback(fs, home);
	const moduleNames = await collectModuleNames(fs, profilesDir(home) + "/node_modules");
	const profileModules = await collectModuleNames(fs, dir + "/node_modules");
	const bundleResolvable = (name) => name.startsWith("@deepseek-ai/") || profileModules.has(name) || moduleNames.has(name);
	const diagnostics = [...diagnoseProfile({
		home,
		profile,
		dir,
		fs,
		manifest: manifestFacts,
		manifestText,
		bundleResolvable,
		bundleDeclaresPatch: () => void 0,
		profilePatch,
		homePatch,
		env: { DSH_HOME: home }
	}), ...fallbacks];
	const files = {};
	const addFile = async (path) => {
		if (files[path] !== void 0) return;
		files[path] = await patchText(fs, path);
	};
	for (const diag of diagnostics) await addFile(diag.path);
	await addFile(profilePatchPath);
	await addFile(homePatchPath);
	const plan = planRepair({
		profile,
		diagnostics,
		files,
		patchPathByCode: {
			"D-040": profilePatchPath,
			"D-050": homePatchPath
		}
	});
	const manualActions = plan.actions.filter((action) => !isInsideProfile(action.target, dir));
	const autoActions = plan.actions.filter((action) => isInsideProfile(action.target, dir));
	const critical = diagnostics.filter((d) => d.severity === "critical" || d.severity === "error");
	const actionable = critical.length > 0 || autoActions.length > 0 || manualActions.length > 0;
	return {
		ok: critical.length === 0 || autoActions.length > 0,
		phase: actionable ? "planned" : "noop",
		diagnostics,
		actions: autoActions,
		manualActions,
		message: critical.length === 0 ? "profile is healthy or advisory only" : void 0
	};
}
async function collectModuleNames(fs, root) {
	const names = /* @__PURE__ */ new Set();
	let entries;
	try {
		entries = await fs.readdir(root);
	} catch {
		return names;
	}
	for (const entry of entries) if (entry.name.startsWith("@") && entry.kind === "dir") {
		let scoped;
		try {
			scoped = await fs.readdir(root + "/" + entry.name);
		} catch {
			continue;
		}
		for (const child of scoped) names.add(entry.name + "/" + child.name);
	} else names.add(entry.name);
	return names;
}
async function patchText(fs, path) {
	try {
		return await fs.readText(path);
	} catch {
		return "";
	}
}
function parsePatchListSafe(text, engine, label) {
	if (text.trim() === "") return {
		entries: [],
		warnings: [],
		error: void 0
	};
	try {
		return parsePatchList(text, engine, label);
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}
function isInsideProfile(target, profileDir) {
	return target === profileDir || target.startsWith(profileDir + "/");
}
function makeId(profile, now) {
	return profile + "-" + now.replace(/[^0-9]/g, "").slice(0, 14);
}
/** Run the full repair transaction (stage, apply, gates, promote, verify, commit). */
async function repairProfile(request, gateOptions = {}) {
	if (request.allowLive !== true) return {
		ok: false,
		phase: "blocked",
		diagnostics: [],
		actions: [],
		manualActions: [],
		message: "repair blocked: allowLive is not set (a running instance may own the profile)"
	};
	const fs = request.fs ?? nodeFs;
	const now = request.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
	const clock = request.clock ?? Date.now;
	const engine = createYamlEngine();
	const gates = request.gate ?? realGateDeps({
		clock,
		engine
	});
	const home = request.home;
	const dir = resolveProfileDir(home, request.profile);
	if (!await fs.exists(dir)) return {
		ok: false,
		phase: "failed",
		diagnostics: [],
		actions: [],
		manualActions: [],
		message: "profile dir missing: " + dir
	};
	const journal = createJournal({
		fs,
		file: journalPath(home),
		now
	});
	const locks = createLockManager({
		fs,
		home,
		pid: request.pid ?? process.pid,
		host: "local",
		clock,
		iso: now,
		pidAlive: request.pidAlive ?? ((pid) => pid !== 0)
	});
	const globalLock = await locks.acquire("global", void 0, { intent: "repair " + request.profile });
	let profileLock;
	try {
		profileLock = await locks.acquire("profile", request.profile, { intent: "repair" });
		const diagnosis = await diagnoseAndPlan(request);
		const snapshotResult = await snapshotProfile(request);
		const txn = createCandidateTransaction({
			fs,
			home,
			profile: request.profile,
			now,
			journal,
			beforePromote: async (record) => {
				await globalLock.touch(clock());
				if (profileLock === void 0) throw new LockError("LOCK_LOST", "profile", "profile/" + request.profile, "profile lock is no longer held");
				await profileLock.touch(clock());
				await writeTransactionRecord(fs, home, record);
			},
			beforeCompensation: async () => {
				await globalLock.touch(clock());
				if (profileLock === void 0) throw new LockError("LOCK_LOST", "profile", "profile/" + request.profile, "profile lock is no longer held");
				await profileLock.touch(clock());
			}
		});
		if (diagnosis.actions.length === 0 && diagnosis.manualActions.length > 0) {
			await journal.append({
				op: "repair:manual-required",
				ok: false,
				detail: {
					profile: request.profile,
					manual: diagnosis.manualActions
				}
			});
			await profileLock.release();
			profileLock = void 0;
			return {
				ok: false,
				phase: "planned",
				diagnostics: diagnosis.diagnostics,
				actions: [],
				manualActions: diagnosis.manualActions,
				snapshotId: snapshotResult.snapshotId,
				message: "manual confirmation required for home-level repairs"
			};
		}
		if (diagnosis.actions.length === 0 && diagnosis.manualActions.length === 0) {
			await journal.append({
				op: "repair:noop",
				ok: true,
				detail: { profile: request.profile }
			});
			await profileLock.release();
			profileLock = void 0;
			return {
				...diagnosis,
				ok: true,
				phase: "noop",
				snapshotId: snapshotResult.snapshotId,
				txnId: txn.txnId
			};
		}
		await txn.stage();
		await journal.append({
			op: "repair:stage",
			ok: true,
			detail: { txn: txn.txnId }
		});
		for (const action of diagnosis.actions) {
			const rel = action.target.slice(dir.length + 1);
			const stagedTarget = txn.record.stagingPath + "/" + rel;
			if (action.op === "move-path") {
				await fs.rename(stagedTarget, stagedTarget + ".doctor-broken");
				await journal.append({
					op: "repair:apply-move",
					ok: true,
					detail: {
						txn: txn.txnId,
						target: action.target
					}
				});
			} else if (action.op === "write-file" && action.content !== void 0) {
				await fs.writeText(stagedTarget, action.content);
				await journal.append({
					op: "repair:apply-write",
					ok: true,
					detail: {
						txn: txn.txnId,
						target: action.target
					}
				});
			}
		}
		const isolated = workDir(home) + "/" + txn.txnId;
		await fs.mkdir(isolated, { recursive: true });
		const isolatedProfileDir = isolated + "/profiles/" + request.profile;
		await fs.mkdir(isolatedProfileDir, { recursive: true });
		await copyProfileFiles(fs, txn.record.stagingPath, isolatedProfileDir);
		const env = gateEnvironmentOf(request, gateOptions, isolated);
		const dump = await runDumpDefaultGateSafe(gates, request.dshPath, isolated, request.profile, env, gateOptions.timeoutMs);
		const start = dump.ok ? await runStartGateSafe(gates, request.dshPath, isolated, request.profile, env, gateOptions.timeoutMs) : void 0;
		const gateReports = [dump, ...start !== void 0 ? [start] : []];
		if (!dump.ok || start === void 0 || !start.ok) {
			await txn.abort();
			await journal.append({
				op: "repair:gates-failed",
				ok: false,
				detail: {
					txn: txn.txnId,
					report: gateReports
				}
			});
			return {
				ok: false,
				phase: "aborted",
				diagnostics: diagnosis.diagnostics,
				actions: diagnosis.actions,
				manualActions: diagnosis.manualActions,
				snapshotId: snapshotResult.snapshotId,
				gates: gateReports,
				txnId: txn.txnId,
				message: "candidate failed the isolated health gates"
			};
		}
		await writeTransactionRecord(fs, home, txn.record);
		if (request.autoPromote === false) {
			await journal.append({
				op: "repair:awaiting-confirm",
				ok: true,
				detail: { txn: txn.txnId }
			});
			return {
				ok: true,
				phase: "staged",
				diagnostics: diagnosis.diagnostics,
				actions: diagnosis.actions,
				manualActions: diagnosis.manualActions,
				snapshotId: snapshotResult.snapshotId,
				gates: gateReports,
				txnId: txn.txnId,
				message: "candidate passed isolated gates and awaits confirmation"
			};
		}
		await globalLock.touch(clock());
		await profileLock.touch(clock());
		try {
			await txn.promote();
			await writeTransactionRecord(fs, home, txn.record);
			await globalLock.touch(clock());
			await profileLock.touch(clock());
			await journal.append({
				op: "repair:promote",
				ok: true,
				detail: { txn: txn.txnId }
			});
			const liveEnv = gateEnvironmentOf(request, gateOptions, home);
			const liveDump = await runDumpDefaultGateSafe(gates, request.dshPath, home, request.profile, liveEnv, gateOptions.timeoutMs);
			await globalLock.touch(clock());
			await profileLock.touch(clock());
			if (!liveDump.ok) {
				await rollbackPromotedFailure(fs, home, journal, txn, "live verification failed");
				await journal.append({
					op: "repair:live-verify-failed",
					ok: false,
					detail: { txn: txn.txnId }
				});
				return {
					ok: false,
					phase: "rolled-back",
					diagnostics: diagnosis.diagnostics,
					actions: diagnosis.actions,
					manualActions: diagnosis.manualActions,
					snapshotId: snapshotResult.snapshotId,
					gates: gateReports,
					txnId: txn.txnId,
					message: "live verification failed after promote; rolled back"
				};
			}
			await journal.append({
				op: "repair:commit",
				ok: true,
				detail: { txn: txn.txnId }
			});
			await txn.commit();
			return {
				ok: true,
				phase: "promoted",
				diagnostics: diagnosis.diagnostics,
				actions: diagnosis.actions,
				manualActions: diagnosis.manualActions,
				snapshotId: snapshotResult.snapshotId,
				gates: gateReports,
				txnId: txn.txnId
			};
		} catch (error) {
			if (error instanceof LockError) throw error;
			if (txn.phase() === "promoted") {
				await globalLock.touch(clock());
				await profileLock.touch(clock());
				try {
					await rollbackPromotedFailure(fs, home, journal, txn, error instanceof Error ? error.message : String(error));
				} catch (rollbackError) {
					throw new Error("post-promote failure: " + String(error) + "; automatic rollback failed: " + String(rollbackError));
				}
			}
			throw error;
		}
	} catch (error) {
		await journal.append({
			op: "repair:error",
			ok: false,
			detail: { error: error instanceof Error ? error.message : String(error) }
		}).catch(() => void 0);
		return {
			ok: false,
			phase: "failed",
			diagnostics: [],
			actions: [],
			manualActions: [],
			message: error instanceof Error ? error.message : String(error)
		};
	} finally {
		await profileLock?.release().catch(() => void 0);
		await globalLock.release().catch(() => void 0);
	}
}
async function rollbackPromotedFailure(fs, home, journal, txn, cause) {
	let rollbackWarning;
	try {
		await txn.rollback();
	} catch (error) {
		rollbackWarning = error instanceof Error ? error.message : String(error);
	}
	if (txn.phase() !== "rolled-back") throw new Error(rollbackWarning ?? "transaction remained in phase " + txn.phase());
	await writeTransactionRecord(fs, home, txn.record);
	await journal.append({
		op: "repair:post-promote-rollback",
		ok: false,
		detail: {
			txn: txn.txnId,
			cause,
			...rollbackWarning === void 0 ? {} : { rollbackWarning }
		}
	}).catch(() => void 0);
}
/** Promote a durable staged candidate after explicit confirmation. */
async function confirmRepair(request, txnId, gateOptions = {}) {
	if (request.allowLive !== true) return rollbackFailure(txnId, "confirm blocked: profile may still be running");
	const fs = request.fs ?? nodeFs;
	const now = request.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
	const clock = request.clock ?? Date.now;
	const gates = request.gate ?? realGateDeps({
		clock,
		engine: createYamlEngine()
	});
	const home = request.home;
	const journal = createJournal({
		fs,
		file: journalPath(home),
		now
	});
	const locks = createLockManager({
		fs,
		home,
		pid: request.pid ?? process.pid,
		host: "local",
		clock,
		iso: now,
		pidAlive: request.pidAlive ?? ((pid) => pid !== 0)
	});
	let globalLock;
	let profileLock;
	try {
		validateSegment(txnId, "transaction id");
		globalLock = await locks.acquire("global", void 0, { intent: "confirm " + request.profile + "/" + txnId });
		profileLock = await locks.acquire("profile", request.profile, { intent: "confirm " + txnId });
		const { record, stagingPath } = validateRollbackRecord(JSON.parse(await fs.readText(transactionRecordPath(home, txnId))), home, request.profile, txnId);
		if (record.phase === "committed") return {
			ok: true,
			phase: "promoted",
			diagnostics: [],
			actions: [],
			manualActions: [],
			txnId,
			message: "candidate is already promoted"
		};
		if (record.phase !== "staged") throw new Error("transaction " + txnId + " is " + record.phase + "; confirm requires staged");
		if (!await fs.exists(stagingPath)) throw new Error("staged candidate is missing at " + stagingPath);
		const isolated = workDir(home) + "/confirm-" + txnId;
		await fs.remove(isolated, { recursive: true }).catch(() => void 0);
		const isolatedProfileDir = isolated + "/profiles/" + request.profile;
		await fs.mkdir(isolatedProfileDir, { recursive: true });
		await copyProfileFiles(fs, stagingPath, isolatedProfileDir);
		const env = gateEnvironmentOf(request, gateOptions, isolated);
		const dump = await runDumpDefaultGateSafe(gates, request.dshPath, isolated, request.profile, env, gateOptions.timeoutMs);
		const start = dump.ok ? await runStartGateSafe(gates, request.dshPath, isolated, request.profile, env, gateOptions.timeoutMs) : void 0;
		const gateReports = [dump, ...start === void 0 ? [] : [start]];
		if (!dump.ok || start === void 0 || !start.ok) return {
			ok: false,
			phase: "staged",
			diagnostics: [],
			actions: [],
			manualActions: [],
			txnId,
			gates: gateReports,
			message: "candidate failed confirmation health gates and remains staged"
		};
		const txn = createCandidateTransaction({
			fs,
			home,
			profile: request.profile,
			now,
			journal,
			initialRecord: record,
			beforePromote: async (current) => {
				await globalLock.touch(clock());
				await profileLock.touch(clock());
				await writeTransactionRecord(fs, home, current);
			},
			beforeCompensation: async () => {
				await globalLock.touch(clock());
				await profileLock.touch(clock());
			}
		});
		await txn.promote();
		await writeTransactionRecord(fs, home, txn.record);
		const liveDump = await runDumpDefaultGateSafe(gates, request.dshPath, home, request.profile, gateEnvironmentOf(request, gateOptions, home), gateOptions.timeoutMs);
		await globalLock.touch(clock());
		await profileLock.touch(clock());
		if (!liveDump.ok) {
			await rollbackPromotedFailure(fs, home, journal, txn, "confirmation live verification failed");
			return {
				ok: false,
				phase: "rolled-back",
				diagnostics: [],
				actions: [],
				manualActions: [],
				txnId,
				gates: gateReports,
				message: "live verification failed after confirmation; rolled back"
			};
		}
		await txn.commit();
		await writeTransactionRecord(fs, home, txn.record);
		await journal.append({
			op: "repair:confirm",
			ok: true,
			detail: { txn: txnId }
		});
		return {
			ok: true,
			phase: "promoted",
			diagnostics: [],
			actions: [],
			manualActions: [],
			txnId,
			gates: gateReports
		};
	} catch (error) {
		await journal.append({
			op: "repair:confirm-error",
			ok: false,
			detail: {
				txn: txnId,
				error: String(error)
			}
		}).catch(() => void 0);
		return rollbackFailure(txnId, error instanceof Error ? error.message : String(error));
	} finally {
		await profileLock?.release().catch(() => void 0);
		await globalLock?.release().catch(() => void 0);
	}
}
/** Restore a promoted transaction by moving the quarantine back. */
async function rollbackTransaction(request, txnId) {
	const fs = request.fs ?? nodeFs;
	const home = request.home;
	const now = request.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
	const clock = request.clock ?? Date.now;
	let profile;
	try {
		validateSegment(txnId, "transaction id");
		profile = validateSegment(request.profile, "profile");
		resolveProfileDir(home, profile);
	} catch (error) {
		return rollbackFailure(txnId, "invalid rollback request: " + String(error));
	}
	const recordPath = transactionRecordPath(home, txnId);
	const journal = createJournal({
		fs,
		file: journalPath(home),
		now
	});
	const locks = createLockManager({
		fs,
		home,
		pid: request.pid ?? process.pid,
		host: "local",
		clock,
		iso: now,
		pidAlive: request.pidAlive ?? ((pid) => pid !== 0)
	});
	let globalLock;
	let profileLock;
	try {
		globalLock = await locks.acquire("global", void 0, { intent: "rollback " + profile + "/" + txnId });
		profileLock = await locks.acquire("profile", profile, { intent: "rollback " + txnId });
		let parsed;
		try {
			parsed = JSON.parse(await fs.readText(recordPath));
		} catch (error) {
			throw new Error("no readable transaction record for " + txnId + ": " + String(error));
		}
		const { record, livePath, quarantinePath, stagingPath } = validateRollbackRecord(parsed, home, profile, txnId);
		await globalLock.touch(clock());
		await profileLock.touch(clock());
		const discardedPath = livePath + ".doctor-discarded-" + txnId;
		if (record.phase === "rolled-back") {
			await fs.remove(discardedPath, { recursive: true }).catch(() => void 0);
			await fs.remove(stagingPath, { recursive: true }).catch(() => void 0);
			return {
				ok: true,
				phase: "rolled-back",
				diagnostics: [],
				actions: [],
				manualActions: [],
				txnId,
				message: "transaction " + txnId + " is already rolled back"
			};
		}
		if (record.phase !== "staged" && record.phase !== "promoted" && record.phase !== "committed") throw new Error("transaction " + txnId + " is " + record.phase + "; only staged, promoted or committed transactions roll back");
		let quarantineExists = await fs.exists(quarantinePath);
		let liveExists = await fs.exists(livePath);
		const stagingExists = await fs.exists(stagingPath);
		const discardedExists = await fs.exists(discardedPath);
		if (record.phase === "staged" && !quarantineExists) {
			if (!liveExists) throw new Error("staged transaction " + txnId + " has no recoverable live or quarantine profile");
			await writeTransactionRecord(fs, home, makeRolledBackRecord(record, quarantinePath, livePath));
			await globalLock.touch(clock());
			await profileLock.touch(clock());
			await fs.remove(discardedPath, { recursive: true }).catch(() => void 0);
			await fs.remove(stagingPath, { recursive: true }).catch(() => void 0);
			return {
				ok: true,
				phase: "rolled-back",
				diagnostics: [],
				actions: [],
				manualActions: [],
				txnId,
				message: stagingExists && !discardedExists ? "cancelled durable promotion intent before live mutation" : "finalized restored interrupted promotion"
			};
		}
		if (record.phase === "staged" && quarantineExists && !liveExists) {
			if (discardedExists) {
				await movePath(fs, quarantinePath, livePath);
				await writeTransactionRecord(fs, home, makeRolledBackRecord(record, quarantinePath, livePath));
				await globalLock.touch(clock());
				await profileLock.touch(clock());
				await fs.remove(discardedPath, { recursive: true }).catch(() => void 0);
				await fs.remove(stagingPath, { recursive: true }).catch(() => void 0);
				return {
					ok: true,
					phase: "rolled-back",
					diagnostics: [],
					actions: [],
					manualActions: [],
					txnId,
					message: "resumed interrupted in-process rollback"
				};
			}
			if (!stagingExists) throw new Error("staged transaction " + txnId + " has an ambiguous interrupted-promote layout; live profile left untouched");
			await movePath(fs, quarantinePath, livePath);
			const rolledBackRecord = makeRolledBackRecord(record, quarantinePath, livePath);
			try {
				await globalLock.touch(clock());
				await profileLock.touch(clock());
				await writeTransactionRecord(fs, home, rolledBackRecord);
			} catch (error) {
				throw new Error("restored interrupted promotion but could not persist rolled-back state: " + String(error));
			}
			await fs.remove(stagingPath, { recursive: true }).catch(() => void 0);
			return {
				ok: true,
				phase: "rolled-back",
				diagnostics: [],
				actions: [],
				manualActions: [],
				txnId,
				message: "restored promotion interrupted before candidate activation"
			};
		}
		if (record.phase === "staged" && quarantineExists && liveExists && stagingExists) throw new Error("staged transaction " + txnId + " has both live and staged candidates after quarantine; live profile left untouched");
		quarantineExists = await fs.exists(quarantinePath);
		liveExists = await fs.exists(livePath);
		if (!quarantineExists && liveExists && discardedExists) {
			await writeTransactionRecord(fs, home, makeRolledBackRecord(record, quarantinePath, livePath));
			await globalLock.touch(clock());
			await profileLock.touch(clock());
			await fs.remove(discardedPath, { recursive: true }).catch(() => void 0);
			await journal.append({
				op: "repair:rollback-finalize",
				ok: true,
				detail: { txn: txnId }
			}).catch(() => void 0);
			return {
				ok: true,
				phase: "rolled-back",
				diagnostics: [],
				actions: [],
				manualActions: [],
				txnId,
				message: "finalized interrupted rollback at " + livePath
			};
		}
		if (!quarantineExists) throw new Error("quarantine path missing at " + quarantinePath + "; live profile left untouched");
		let discarded;
		if (liveExists) {
			discarded = discardedPath;
			if (discardedExists) throw new Error("discarded path already exists at " + discardedPath + "; live profile left untouched");
			await movePath(fs, livePath, discarded);
		} else if (discardedExists) discarded = discardedPath;
		try {
			await movePath(fs, quarantinePath, livePath);
		} catch (error) {
			if (discarded !== void 0) try {
				await movePath(fs, discarded, livePath);
			} catch (restoreError) {
				throw new Error("quarantine restore failed: " + String(error) + "; restoring the live profile also failed: " + String(restoreError));
			}
			throw error;
		}
		await globalLock.touch(clock());
		await profileLock.touch(clock());
		const rolledBackRecord = makeRolledBackRecord(record, quarantinePath, livePath);
		try {
			await writeTransactionRecord(fs, home, rolledBackRecord);
		} catch (error) {
			await globalLock.touch(clock());
			await profileLock.touch(clock());
			try {
				await movePath(fs, livePath, quarantinePath);
				if (discarded !== void 0) await movePath(fs, discarded, livePath);
			} catch (restoreError) {
				throw new Error("transaction record persistence failed: " + String(error) + "; restoring the promoted layout also failed: " + String(restoreError));
			}
			throw new Error("transaction record persistence failed; rollback file moves were reverted: " + String(error));
		}
		await globalLock.touch(clock());
		await profileLock.touch(clock());
		if (discarded !== void 0) await fs.remove(discarded, { recursive: true }).catch(() => void 0);
		await journal.append({
			op: "repair:rollback",
			ok: true,
			detail: { txn: txnId }
		});
		return {
			ok: true,
			phase: "rolled-back",
			diagnostics: [],
			actions: [],
			manualActions: [],
			txnId,
			message: "restored quarantine to " + livePath
		};
	} catch (error) {
		await journal.append({
			op: "repair:rollback-error",
			ok: false,
			detail: { error: String(error) }
		}).catch(() => void 0);
		return rollbackFailure(txnId, error instanceof Error ? error.message : String(error));
	} finally {
		await profileLock?.release().catch(() => void 0);
		await globalLock?.release().catch(() => void 0);
	}
}
function makeRolledBackRecord(record, quarantinePath, livePath) {
	const rolledBackRecord = {
		...record,
		phase: "rolled-back",
		steps: [...record.steps, {
			step: "rollback-restore",
			from: quarantinePath,
			to: livePath
		}]
	};
	delete rolledBackRecord.error;
	return rolledBackRecord;
}
async function writeTransactionRecord(fs, home, record) {
	validateSegment(record.txnId, "transaction id");
	await writeJsonAtomicFs(fs, transactionRecordPath(home, record.txnId), record);
}
function transactionRecordPath(home, txnId) {
	return join(doctorRoot(home), "transactions", txnId + ".json");
}
/** Read and validate the profile identity needed by `rollback <txnId>`. */
async function discoverRollbackProfile(home, txnId, fs = nodeFs) {
	validateSegment(txnId, "transaction id");
	let parsed;
	try {
		parsed = JSON.parse(await fs.readText(transactionRecordPath(home, txnId)));
	} catch (error) {
		throw new Error("no readable transaction record for " + txnId + ": " + String(error));
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("transaction " + txnId + " has a malformed record");
	const record = parsed;
	if (record.txnId !== txnId) throw new Error("transaction record id mismatch: expected " + txnId + ", got " + String(record.txnId));
	if (typeof record.profile !== "string") throw new Error("transaction " + txnId + " has no valid profile");
	const profile = validateSegment(record.profile, "transaction profile");
	resolveProfileDir(home, profile);
	return profile;
}
function validateRollbackRecord(value, home, profile, txnId) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("transaction " + txnId + " has a malformed record; live profile left untouched");
	const record = value;
	if (record.txnId !== txnId) throw new Error("transaction record id mismatch: expected " + txnId + ", got " + String(record.txnId));
	if (typeof record.profile !== "string") throw new Error("transaction " + txnId + " has no valid profile; live profile left untouched");
	validateSegment(record.profile, "transaction profile");
	resolveProfileDir(home, record.profile);
	if (record.profile !== profile) throw new Error("transaction " + txnId + " belongs to profile " + record.profile + ", not " + profile);
	if (typeof record.phase !== "string" || typeof record.livePath !== "string" || typeof record.quarantinePath !== "string" || typeof record.stagingPath !== "string" || !Array.isArray(record.steps)) throw new Error("transaction " + txnId + " has a malformed record; live profile left untouched");
	const livePath = resolveProfileDir(home, profile);
	const stagingPath = join(profilesDir(home), ".doctor-staging", profile, txnId);
	const quarantinePath = join(quarantineDir(home), profile, txnId, "original");
	if (!samePath(record.livePath, livePath)) throw new Error("transaction " + txnId + " live path does not match profile " + profile + "; live profile left untouched");
	if (!samePath(record.quarantinePath, quarantinePath)) throw new Error("transaction " + txnId + " quarantine path does not match profile " + profile + "; live profile left untouched");
	if (!samePath(record.stagingPath, stagingPath)) throw new Error("transaction " + txnId + " staging path does not match profile " + profile + "; live profile left untouched");
	return {
		record,
		livePath,
		quarantinePath,
		stagingPath
	};
}
function samePath(left, right) {
	return resolve(left) === resolve(right);
}
function rollbackFailure(txnId, message) {
	return {
		ok: false,
		phase: "failed",
		diagnostics: [],
		actions: [],
		manualActions: [],
		txnId,
		message
	};
}
async function copyProfileFiles(fs, fromDir, toDir) {
	await fs.mkdir(toDir, { recursive: true });
	const files = await listProfileFiles(fs, fromDir, [
		"node_modules",
		".git",
		".pnpm"
	]);
	for (const file of files) {
		const target = toDir + "/" + file.rel;
		await fs.mkdir(target.slice(0, target.lastIndexOf("/")), { recursive: true });
		const data = await fs.readText(file.path).catch(() => "");
		await fs.writeText(target, data);
	}
}
function gateEnvironmentOf(_request, options, isolatedHome) {
	return {
		...options.env ?? processEnviron(),
		DSH_HOME: isolatedHome,
		DSH_TELEMETRY_DISABLED: "1"
	};
}
function processEnviron() {
	return typeof process !== "undefined" && typeof process.env === "object" ? { ...process.env } : {};
}
async function runDumpDefaultGateSafe(gates, dshPath, isolatedHome, profile, env, timeoutMs) {
	return await runDumpDefaultGate(gates, {
		dshPath,
		isolatedHome,
		profile,
		env,
		timeoutMs
	}, env);
}
async function runStartGateSafe(gates, dshPath, isolatedHome, profile, env, timeoutMs) {
	return await runStartGate(gates, {
		dshPath,
		isolatedHome,
		profile,
		env,
		timeoutMs
	}, env);
}
//#endregion
export { rollbackTransaction as a, readJson as c, repairProfile as i, writeJsonAtomic as l, discoverRollbackProfile as n, snapshotProfile as o, recover_exports as r, appendJsonLine as s, diagnoseAndPlan as t };

//# sourceMappingURL=recover-ByeY8SNW.mjs.map