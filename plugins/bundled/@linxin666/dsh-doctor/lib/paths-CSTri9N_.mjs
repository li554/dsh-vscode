#!/usr/bin/env node
import { t as __exportAll } from "./rolldown-runtime-DCOJ8rT5.mjs";
import { createHash } from "node:crypto";
import { isAbsolute, join, resolve } from "node:path";
import { homedir } from "node:os";
//#region src/core/profile.ts
const PROFILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
function assertSafeProfileName(name) {
	if (!PROFILE_NAME.test(name) || name === "." || name === ".." || name === "node_modules") throw new Error(`doctor: unsafe profile name ${JSON.stringify(name)}`);
	return name;
}
function resolveDshHome(env = process.env, home = homedir(), cwd = process.cwd()) {
	const raw = env.DSH_HOME?.trim();
	if (!raw) return join(home, ".dsh");
	const expanded = raw === "~" ? home : raw.startsWith("~/") || raw.startsWith("~\\") ? join(home, raw.slice(2)) : raw;
	return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}
function profileIdentity(dshHome, name, dshExecutable, role = "protected") {
	assertSafeProfileName(name);
	const canonicalHome = resolve(dshHome);
	const canonicalDsh = resolve(dshExecutable);
	return {
		id: role === "rescue" ? "system-rescue" : createHash("sha256").update([
			canonicalHome,
			name,
			canonicalDsh
		].join("\0")).digest("hex"),
		dshHome: canonicalHome,
		name,
		dshExecutable: canonicalDsh,
		role
	};
}
//#endregion
//#region src/core/paths.ts
/**
* Engine path helpers layered over profile.ts.
*
* profile.ts owns the canonical profile-name rule and the harness-home
* resolution. This module adds the engine-specific roots (quarantine,
* staging, capsule), profile-relative path safety, and profile discovery.
*/
var paths_exports = /* @__PURE__ */ __exportAll({
	PathError: () => PathError,
	TXN_SEGMENT_RE: () => TXN_SEGMENT_RE,
	doctorRoot: () => doctorRoot,
	journalPath: () => journalPath,
	locksDir: () => locksDir,
	profilesDir: () => profilesDir,
	profilesNodeModulesDir: () => profilesNodeModulesDir,
	quarantineDir: () => quarantineDir,
	resolveProfileDir: () => resolveProfileDir,
	safeRelativePath: () => safeRelativePath,
	snapshotsDir: () => snapshotsDir,
	stagingDir: () => stagingDir,
	validateSegment: () => validateSegment,
	workDir: () => workDir
});
/** Error for unsafe relative paths and engine segments. */
var PathError = class extends Error {
	value;
	constructor(value, reason) {
		super("invalid path " + JSON.stringify(value) + ": " + reason);
		this.name = "PathError";
		this.value = value;
	}
};
/** The profiles directory under a harness home. */
function profilesDir(home) {
	return join(home, "profiles");
}
/** Resolve one profile directory (validates the name). */
function resolveProfileDir(home, name) {
	return join(profilesDir(home), assertSafeProfileName(name));
}
/** The DSH-managed flat module fallback directory (symlink closure). */
function profilesNodeModulesDir(home) {
	return join(profilesDir(home), "node_modules");
}
/** Resolve the capsule root under a harness home. */
function doctorRoot(home) {
	return join(home, ".dsh-doctor");
}
/** Resolve the quarantine root under a harness home. */
function quarantineDir(home) {
	return join(doctorRoot(home), "quarantine");
}
/** Resolve the staging root (same filesystem as profiles, rename(2)-safe). */
function stagingDir(home) {
	return join(profilesDir(home), ".doctor-staging");
}
/** Resolve the capsule work root under a harness home. */
function workDir(home) {
	return join(doctorRoot(home), "work");
}
/** Resolve the capsule lock root under a harness home. */
function locksDir(home) {
	return join(doctorRoot(home), "locks");
}
/** Resolve the capsule snapshots root under a harness home. */
function snapshotsDir(home) {
	return join(doctorRoot(home), "snapshots");
}
/** Resolve the capsule journal file under a harness home. */
function journalPath(home) {
	return join(doctorRoot(home), "journal.jsonl");
}
/**
* Validate a profile-relative file path: no absolute paths, no backslashes,
* no '..' segments. Returns the normalized relative path.
*/
function safeRelativePath(value, label = "path") {
	if (typeof value !== "string" || value === "") throw new PathError(value, label + " is empty");
	if (value.startsWith("/") || value.startsWith(String.fromCharCode(92))) throw new PathError(value, label + " must be relative");
	if (value.includes(String.fromCharCode(92))) throw new PathError(value, label + " must not contain backslashes");
	const parts = value.split("/");
	for (const part of parts) if (part === "..") throw new PathError(value, label + " must not contain .. segments");
	return parts.filter((part) => part !== "" && part !== ".").join("/");
}
/** Directory segment every snapshot/transaction id must satisfy. */
const TXN_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
/** Validate an engine-generated directory segment (txn id, snapshot id). */
function validateSegment(value, label) {
	if (!TXN_SEGMENT_RE.test(value)) throw new PathError(value, label + " must be a safe segment");
	return value;
}
//#endregion
export { profilesDir as a, resolveProfileDir as c, stagingDir as d, validateSegment as f, resolveDshHome as h, paths_exports as i, safeRelativePath as l, profileIdentity as m, journalPath as n, profilesNodeModulesDir as o, workDir as p, locksDir as r, quarantineDir as s, doctorRoot as t, snapshotsDir as u };

//# sourceMappingURL=paths-CSTri9N_.mjs.map