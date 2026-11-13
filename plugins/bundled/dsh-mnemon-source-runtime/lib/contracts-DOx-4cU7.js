//#region src/defaults.ts
const DEFAULT_RUNTIME_MEMORY_LIMIT_BYTES = 10240;
const DEFAULT_RUNTIME_USER_LIMIT_BYTES = 4096;
const MAX_RUNTIME_MEMORY_LIMIT_BYTES = 1048576;
//#endregion
//#region src/contracts.ts
const RUNTIME_MEMORY_VERSION = 1;
const RUNTIME_ENTRY_DELIMITER = "\n§\n";
/** Per target, including labels and annotations. Fits both targets in the default light View. */
const RUNTIME_PINNED_PROJECTION_LIMIT = 1536;
function runtimePinnedProjection(entries, target) {
	const pinned = entries.filter((entry) => entry.target === target && entry.pinned === true);
	if (pinned.length === 0) return "";
	return `${target === "user" ? "USER.md" : "MEMORY.md"} pinned entries:\n` + pinned.map((entry) => `[pinned; importance=${entry.importance}]\n${entry.content}`).join(RUNTIME_ENTRY_DELIMITER) + "\n";
}
function assertRuntimePinnedBudget(entries) {
	for (const target of ["user", "memory"]) {
		const characters = runtimePinnedProjection(entries, target).length;
		if (characters > 1536) throw new Error(`Pinned ${target} projection requires ${characters} characters; limit ${RUNTIME_PINNED_PROJECTION_LIMIT}. Unpin or shorten entries before retrying; no data was changed.`);
	}
}
const RUNTIME_MEMORY_LIMITS = {
	memory: DEFAULT_RUNTIME_MEMORY_LIMIT_BYTES,
	user: DEFAULT_RUNTIME_USER_LIMIT_BYTES
};
/** The largest limit, in UTF-8 bytes, either target's file may be given. */
const RUNTIME_MEMORY_LIMIT_MAX_BYTES = MAX_RUNTIME_MEMORY_LIMIT_BYTES;
/** The longest git branch name a scope may hold. */
const RUNTIME_BRANCH_NAME_MAX = 128;
/** The characters a git branch name in a scope may use. */
const RUNTIME_BRANCH_NAME_PATTERN = /^[A-Za-z0-9._/-]+$/u;
/**
* Read a stored branch scope. Absent or malformed data reads as no scope, so an entry that
* a hand edit or another installation left malformed is projected on every branch instead
* of breaking the projection that reads it.
*/
function parseRuntimeBranches(value) {
	if (!Array.isArray(value)) return void 0;
	const branches = [];
	for (const item of value) {
		if (typeof item !== "string" || item === "" || item.length > 128 || !RUNTIME_BRANCH_NAME_PATTERN.test(item)) return void 0;
		branches.push(item);
	}
	return branches;
}
/** The Runtime Source's directory under a storage root. */
const RUNTIME_DIRECTORY = "runtime";
/** The entries themselves, the source of truth the projections are written from. */
const RUNTIME_MEMORIES_FILE = "memories.json";
/** Each target's projection: its entries' plain content, the file a person reads. */
const RUNTIME_PROJECTION_FILES = {
	user: "USER.md",
	memory: "MEMORY.md"
};
/** Created exclusively while the files above are read or written; whoever copies them takes it too. */
const RUNTIME_LOCK_FILE = ".memories.lock";
/** A lock file older than this was left by a process that stopped, and may be taken over. */
const RUNTIME_LOCK_STALE_MS = 3e4;
/** The local archive of entries that left MEMORY.md while no Memory Space could take them (#336). */
const RUNTIME_ARCHIVE_DIRECTORY = "archived";
/** The longest content one entry may hold, in UTF-8 bytes. */
const RUNTIME_ENTRY_MAX_BYTES = 8192;
let utf8;
function joinedContent(entries, target) {
	return entries.filter((entry) => entry.target === target).map((entry) => entry.content).join(RUNTIME_ENTRY_DELIMITER);
}
/** The UTF-8 bytes one target's entries take against its limit: their contents joined by the delimiter. */
function runtimeBytes(entries, target) {
	utf8 ??= new TextEncoder();
	return utf8.encode(joinedContent(entries, target)).byteLength;
}
/** One target's projection file, USER.md or MEMORY.md, exactly as the Runtime Source writes it. */
function runtimeProjection(entries, target) {
	const content = joinedContent(entries, target);
	return content === "" ? "" : `${content}\n`;
}
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Count the entries of a parsed memories.json for a read-only inventory. It never throws: a file
* without an entry list is not `valid`, and a malformed entry is counted or skipped, never refused.
*/
function summarizeRuntimeMemories(value) {
	const entries = isObject(value) && Array.isArray(value.entries) ? value.entries.filter(isObject) : [];
	return {
		valid: isObject(value) && Array.isArray(value.entries),
		entries: entries.length,
		user: entries.filter((entry) => entry.target === "user").length,
		memory: entries.filter((entry) => entry.target === "memory").length
	};
}
//#endregion
export { MAX_RUNTIME_MEMORY_LIMIT_BYTES as C, DEFAULT_RUNTIME_USER_LIMIT_BYTES as S, runtimeBytes as _, RUNTIME_ENTRY_DELIMITER as a, summarizeRuntimeMemories as b, RUNTIME_LOCK_STALE_MS as c, RUNTIME_MEMORY_LIMIT_MAX_BYTES as d, RUNTIME_MEMORY_VERSION as f, parseRuntimeBranches as g, assertRuntimePinnedBudget as h, RUNTIME_DIRECTORY as i, RUNTIME_MEMORIES_FILE as l, RUNTIME_PROJECTION_FILES as m, RUNTIME_BRANCH_NAME_MAX as n, RUNTIME_ENTRY_MAX_BYTES as o, RUNTIME_PINNED_PROJECTION_LIMIT as p, RUNTIME_BRANCH_NAME_PATTERN as r, RUNTIME_LOCK_FILE as s, RUNTIME_ARCHIVE_DIRECTORY as t, RUNTIME_MEMORY_LIMITS as u, runtimePinnedProjection as v, DEFAULT_RUNTIME_MEMORY_LIMIT_BYTES as x, runtimeProjection as y };
