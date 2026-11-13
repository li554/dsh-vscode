import { a as SKILL_ROOT_KINDS, c as compareAutomaticSkillRuns, i as EVOLUTION_SIGNALS, l as skillCaseSignature, n as AUTO_ADOPTION_STAGES, o as SKILL_ROOT_RANK, r as DEFAULT_SKILLS_POLICY, t as AUTO_ADOPTION_REASONS } from "./contracts-CgBkFgJP.js";
import { defineMemoryPlugin, defineMemorySource, installMemory, memoryConfigurationDigest, memoryInputRecord, memoryInputStringArray, memoryInputText, withMemoryStorageLock } from "dsh-mnemon/extension-sdk";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { COMPOSABLE_MEMORY_API_VERSION } from "dsh-mnemon/contracts";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
import { fileURLToPath } from "node:url";
import { gunzipSync, inflateRawSync } from "node:zlib";
//#region src/auto-adoption-budget.ts
function quotaSettings(limit, timeZone) {
	if (!Number.isInteger(limit) || limit < 0 || limit > 100) throw new Error("Automatic adoption daily limit must be 0..100");
	const zone = timeZone === "local" ? Intl.DateTimeFormat().resolvedOptions().timeZone : timeZone;
	if (!zone || zone.length > 100) throw new Error("Automatic adoption time zone must be an IANA time zone or local");
	try {
		new Intl.DateTimeFormat("en", { timeZone: zone }).format(0);
	} catch {
		throw new Error("Automatic adoption time zone must be an IANA time zone or local");
	}
	return {
		limit,
		timeZone: zone
	};
}
function dateIn(at, timeZone) {
	const parts = new Intl.DateTimeFormat("en", {
		timeZone,
		calendar: "iso8601",
		numberingSystem: "latn",
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).formatToParts(new Date(at));
	return [
		"year",
		"month",
		"day"
	].map((type) => parts.find((part) => part.type === type).value).join("-");
}
function quota(entries, now, limit, timeZone) {
	const settings = quotaSettings(limit, timeZone);
	const date = dateIn(now, settings.timeZone);
	return {
		...settings,
		date,
		used: entries.filter((entry) => dateIn(entry.at, settings.timeZone) === date).length
	};
}
function inQuotaDay(entry, value) {
	return dateIn(entry.at, value.timeZone) === value.date;
}
/** Three days cover a calendar day even after changing between extreme IANA offsets. */
function retainedBudget(entries, now) {
	return entries.filter((entry) => Date.parse(entry.at) >= now.getTime() - 2592e5);
}
function readBudget(value) {
	if (value === void 0) return void 0;
	const file = value;
	if (file?.version !== 1 || !Array.isArray(file.entries) || file.entries.some((entry) => entry === null || typeof entry !== "object" || typeof entry.id !== "string" || typeof entry.suggestionId !== "string" || typeof entry.identity !== "string" || typeof entry.at !== "string" || !Number.isFinite(Date.parse(entry.at)))) throw new Error("Automatic adoption budget is unreadable; manual review remains available");
	return file.entries;
}
//#endregion
//#region src/triage.ts
/** Only admitted evidence counts. Signals and model-supplied reuse labels do not. */
function triageSuggestion(suggestion, trajectories) {
	const windows = /* @__PURE__ */ new Set();
	const sessions = /* @__PURE__ */ new Set();
	const steps = /* @__PURE__ */ new Set();
	const known = new Map(trajectories.map((trajectory) => [trajectory.id, trajectory]));
	for (const reference of suggestion.evidence) {
		const trajectory = known.get(reference.trajectoryId);
		if (trajectory === void 0) continue;
		const valid = reference.steps.filter((step) => Number.isInteger(step) && step > 0);
		if (valid.length === 0) continue;
		windows.add(trajectory.id);
		sessions.add(trajectory.sessionId);
		for (const step of valid) steps.add(`${trajectory.id}:${step}`);
	}
	const confidence = Number.isFinite(suggestion.confidence) ? Math.max(0, Math.min(1, suggestion.confidence)) : 0;
	return {
		version: 1,
		classification: windows.size >= 3 && steps.size >= 20 && confidence >= .8 ? "durable" : windows.size === 1 && steps.size < 20 ? "one-off" : "uncertain",
		windows: windows.size,
		sessions: sessions.size,
		steps: steps.size,
		confidence
	};
}
//#endregion
//#region src/fence.ts
/** The same fence rules as `dsh-skill-filesystem`: `---` on the first line and on a later line of its own. */
function splitFrontmatter(raw) {
	const firstLineEnd = raw.indexOf("\n");
	if (firstLineEnd < 0 || raw.slice(0, firstLineEnd).replace(/\r$/u, "") !== "---") return void 0;
	const start = firstLineEnd + 1;
	let lineStart = start;
	while (lineStart <= raw.length) {
		const next = raw.indexOf("\n", lineStart);
		const lineEnd = next < 0 ? raw.length : next;
		if (raw.slice(lineStart, lineEnd).replace(/\r$/u, "") === "---") return {
			frontmatter: raw.slice(start, lineStart),
			body: raw.slice(next < 0 ? raw.length : next + 1),
			frontmatterStart: start,
			frontmatterEnd: lineStart
		};
		if (next < 0) return void 0;
		lineStart = next + 1;
	}
}
//#endregion
//#region src/frontmatter.ts
/** DSH's skill name rule, shared by the registry and the filesystem provider. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MAX_SKILL_BYTES = 65536;
function isSkillName(value) {
	return value.length <= 64 && SKILL_NAME.test(value);
}
function frontmatterBoolean(data, key) {
	if (!Object.hasOwn(data, key)) return void 0;
	const value = data[key];
	if (typeof value === "boolean") return value;
	if (value === 1 || value === "1") return true;
	if (value === 0 || value === "0") return false;
	if (typeof value === "string") switch (value.toLowerCase()) {
		case "true":
		case "yes":
		case "on": return true;
		case "false":
		case "no":
		case "off": return false;
	}
	throw new Error(`frontmatter field "${key}" must be a boolean`);
}
/**
* Parse a skill the way DSH does, so the page never lists a file DSH would
* skip as if it were loaded: the reason is returned instead.
*/
function parseSkill(raw) {
	let split;
	let data;
	try {
		split = splitFrontmatter(raw);
		if (split === void 0) return { problem: "missing YAML frontmatter" };
		data = parse(split.frontmatter);
	} catch (error) {
		return { problem: "invalid YAML frontmatter: " + (error instanceof Error ? error.message : String(error)) };
	}
	if (typeof data !== "object" || data === null || Array.isArray(data)) return { problem: "missing YAML frontmatter" };
	const fields = data;
	const name = typeof fields.name === "string" && fields.name.length > 0 ? fields.name : void 0;
	const description = typeof fields.description === "string" && fields.description.length > 0 ? fields.description : void 0;
	if (name === void 0 || description === void 0) return { problem: "frontmatter requires name and description" };
	if (!SKILL_NAME.test(name)) return { problem: `invalid skill name "${name}"` };
	for (const [legacy, canonical] of [
		["disableModelInvocation", "disable-model-invocation"],
		["modelInvocable", "disable-model-invocation"],
		["userInvocable", "user-invocable"]
	]) if (Object.hasOwn(fields, legacy)) return { problem: `frontmatter field "${legacy}" is unsupported; use "${canonical}"` };
	let invocation;
	try {
		invocation = {
			modelInvocable: frontmatterBoolean(fields, "disable-model-invocation") !== true,
			userInvocable: frontmatterBoolean(fields, "user-invocable") !== false
		};
	} catch (error) {
		return { problem: "invalid invocation frontmatter: " + (error instanceof Error ? error.message : String(error)) };
	}
	return { skill: {
		name,
		description,
		invocation,
		...typeof fields.whenToUse === "string" && fields.whenToUse.length > 0 ? { whenToUse: fields.whenToUse } : {},
		frontmatter: split.frontmatter,
		body: split.body
	} };
}
const KEY_LINE = (key) => {
	if (!/^[A-Za-z0-9-]+$/u.test(key)) throw new Error("unsupported frontmatter key: " + key);
	return new RegExp(`^${key}\\s*:.*(?:\\r?\\n|$)`, "mu");
};
/**
* Set or remove one top-level scalar key in the frontmatter and keep every
* other byte of the file. Removing restores DSH's default for that key.
*/
function setFrontmatterKey(raw, key, value) {
	const split = splitFrontmatter(raw);
	if (split === void 0) throw new Error("the skill has no YAML frontmatter");
	const before = raw.slice(0, split.frontmatterStart);
	const after = raw.slice(split.frontmatterEnd);
	let block = split.frontmatter;
	const pattern = KEY_LINE(key);
	const eol = block.includes("\r\n") ? "\r\n" : "\n";
	if (value === void 0) block = block.replace(pattern, "");
	else if (pattern.test(block)) block = block.replace(pattern, (match) => `${key}: ${value}${match.endsWith("\n") ? match.endsWith("\r\n") ? "\r\n" : "\n" : ""}`);
	else block = `${block}${block === "" || block.endsWith("\n") ? "" : eol}${key}: ${value}${eol}`;
	return before + block + after;
}
/** Write DSH's two invocation switches, leaving each key out when it holds DSH's default. */
function withInvocation(raw, invocation) {
	return setFrontmatterKey(setFrontmatterKey(raw, "disable-model-invocation", invocation.modelInvocable ? void 0 : "true"), "user-invocable", invocation.userInvocable ? void 0 : "false");
}
/** Validate content about to be written as one skill named `name`. */
function validateSkillContent(content, name) {
	if (Buffer.byteLength(content, "utf8") > 65536) throw new Error(`SKILL.md is too large (max ${MAX_SKILL_BYTES} bytes)`);
	const parsed = parseSkill(content);
	if ("problem" in parsed) throw new Error("SKILL.md would not load in DSH: " + parsed.problem);
	if (parsed.skill.name !== name) throw new Error(`SKILL.md names "${parsed.skill.name}", not "${name}"`);
	return parsed.skill;
}
/** A starting SKILL.md for a new skill, in DSH's format. */
function skillTemplate(name, description, body = "") {
	const quoted = JSON.stringify(description.replace(/\s+/gu, " ").trim());
	const rest = body.trim() === "" ? `# ${name}\n\n## Steps\n1. The first thing to do, with the exact command or tool.\n\n## Pitfalls\n- What tends to go wrong, and how to avoid it.\n\n## Verification\n- How to confirm the result is right.\n` : body.trimStart();
	return `---\nname: ${name}\ndescription: ${quoted}\n---\n\n${rest}${rest.endsWith("\n") ? "" : "\n"}`;
}
//#endregion
//#region src/catalog.ts
const MAX_FILE_BYTES$1 = 1048576;
const MAX_RESOURCES = 40;
function expandHome(path) {
	return path === "~" ? homedir() : path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}
function configuredHome(explicit, variable, fallback) {
	const value = explicit?.trim() || process.env[variable]?.trim() || fallback;
	return resolve(expandHome(value));
}
/** The nearest ancestor holding `.git`, as DSH finds a project; the workspace itself otherwise. */
function projectRoot(workspace) {
	let current = resolve(workspace);
	while (true) {
		if (existsSync(join(current, ".git"))) return current;
		const parent = dirname(current);
		if (parent === current) return resolve(workspace);
		current = parent;
	}
}
function skillRoots(options) {
	const dshHome = configuredHome(options.dshHome, "DSH_HOME", join(homedir(), ".dsh"));
	const agentsHome = configuredHome(options.agentsHome, "DSH_AGENTS_HOME", join(homedir(), ".agents"));
	const workspace = options.workspace?.trim();
	const project = workspace === void 0 || workspace === "" ? void 0 : projectRoot(workspace);
	const roots = [
		...project === void 0 ? [] : [{
			kind: "project-dsh",
			path: join(project, ".dsh", "skills")
		}, {
			kind: "project-agents",
			path: join(project, ".agents", "skills")
		}],
		{
			kind: "user-dsh",
			path: join(dshHome, "skills")
		},
		{
			kind: "user-agents",
			path: join(agentsHome, "skills")
		}
	];
	return {
		...project === void 0 ? {} : { projectRoot: project },
		roots
	};
}
function sha256(content) {
	return createHash("sha256").update(content).digest("hex");
}
/** Detect links at the skill root, bundle directory or document.
* Do not resolve OS aliases (for example macOS /tmp) or compare path casing. */
function linkedSkill(rootPath, path) {
	return [
		rootPath,
		dirname(path),
		path
	].some((candidate) => lstatSync(candidate).isSymbolicLink());
}
function requireWritableRoot(path) {
	try {
		if (lstatSync(path).isSymbolicLink()) throw new Error("Linked skill roots are read-only; select a local skill root.");
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
}
function requireWritableSkill(skill, allowLinkedUpdates = false) {
	if (!linkedSkill(skill.rootPath, skill.path)) return skill.path;
	if (!allowLinkedUpdates) throw new Error("Linked skills are read-only; edit the original skill in its source repository or use a local copy.");
	return realpathSync(skill.path);
}
function entryKind(root, entry) {
	if (entry.isDirectory()) return "directory";
	if (entry.isFile()) return "file";
	if (!entry.isSymbolicLink()) return void 0;
	try {
		const info = statSync(join(root, entry.name));
		return info.isDirectory() ? "directory" : info.isFile() ? "file" : void 0;
	} catch {
		return;
	}
}
function resources(directory) {
	const found = [];
	const visit = (path, depth) => {
		let entries;
		try {
			entries = readdirSync(path, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			if (found.length >= MAX_RESOURCES || entry.name.startsWith(".")) continue;
			const full = join(path, entry.name);
			if (entry.isDirectory()) {
				if (depth < 2) visit(full, depth + 1);
			} else if (relative(directory, full) !== "SKILL.md") found.push(relative(directory, full));
		}
	};
	visit(directory, 0);
	return found;
}
/** Discover every skill in the four roots with `dsh-skill-filesystem`'s rules. */
function readCatalog(options) {
	const { projectRoot: project, roots } = skillRoots(options);
	const listedRoots = [];
	const skills = [];
	const problems = [];
	for (const root of roots) {
		const exists = existsSync(root.path);
		const listed = {
			kind: root.kind,
			path: root.path,
			exists
		};
		listedRoots.push(listed);
		if (!exists) continue;
		let entries;
		try {
			entries = readdirSync(root.path, { withFileTypes: true });
			if (lstatSync(root.path).isSymbolicLink()) listed.readOnly = true;
		} catch (error) {
			problems.push({
				root: root.kind,
				path: root.path,
				reason: error instanceof Error ? error.message : String(error)
			});
			continue;
		}
		const seen = /* @__PURE__ */ new Set();
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			if (root.kind === "user-dsh" && entry.name === ".system") continue;
			const kind = entryKind(root.path, entry);
			const layout = kind === "directory" ? "bundle" : kind === "file" && entry.name.endsWith(".md") ? "flat" : void 0;
			if (layout === void 0) continue;
			const path = layout === "bundle" ? join(root.path, entry.name, "SKILL.md") : join(root.path, entry.name);
			let raw;
			let modifiedAt;
			let readOnly;
			try {
				const info = statSync(path);
				if (!info.isFile()) continue;
				if (info.size > MAX_FILE_BYTES$1) {
					problems.push({
						root: root.kind,
						path,
						reason: "file is larger than 1 MiB"
					});
					continue;
				}
				raw = readFileSync(path);
				modifiedAt = info.mtime.toISOString();
				readOnly = linkedSkill(root.path, path);
			} catch {
				continue;
			}
			const parsed = parseSkill(raw.toString("utf8"));
			if ("problem" in parsed) {
				problems.push({
					root: root.kind,
					path,
					reason: parsed.problem
				});
				continue;
			}
			if (seen.has(parsed.skill.name)) {
				problems.push({
					root: root.kind,
					path,
					reason: `another file in this root already names "${parsed.skill.name}"`
				});
				continue;
			}
			seen.add(parsed.skill.name);
			skills.push({
				key: `${root.kind}:${parsed.skill.name}`,
				name: parsed.skill.name,
				description: parsed.skill.description,
				...parsed.skill.whenToUse === void 0 ? {} : { whenToUse: parsed.skill.whenToUse },
				root: root.kind,
				rootPath: root.path,
				path,
				layout,
				...readOnly ? {
					linked: true,
					...options.allowLinkedUpdates === true ? {} : { readOnly: true }
				} : {},
				invocation: parsed.skill.invocation,
				hash: sha256(raw),
				bytes: raw.byteLength,
				modifiedAt,
				...layout === "bundle" ? { resources: resources(dirname(path)) } : {}
			});
		}
	}
	const winners = /* @__PURE__ */ new Map();
	for (const skill of skills) {
		const current = winners.get(skill.name);
		if (current === void 0 || SKILL_ROOT_RANK[skill.root] < SKILL_ROOT_RANK[current.root]) winners.set(skill.name, skill);
	}
	for (const skill of skills) {
		const winner = winners.get(skill.name);
		if (winner !== skill) skill.shadowedBy = winner.key;
	}
	skills.sort((a, b) => a.name.localeCompare(b.name) || SKILL_ROOT_KINDS.indexOf(a.root) - SKILL_ROOT_KINDS.indexOf(b.root));
	return {
		...project === void 0 ? {} : { projectRoot: project },
		roots: listedRoots,
		skills,
		problems
	};
}
/** A cheap fingerprint of the roots: names, sizes and times, no content. */
function catalogFingerprint(options) {
	const hash = createHash("sha256");
	hash.update(`linked-updates:${options.allowLinkedUpdates === true}\0`);
	for (const root of skillRoots(options).roots) {
		hash.update(`${root.kind}\0${root.path}\0`);
		let entries;
		try {
			entries = readdirSync(root.path, { withFileTypes: true });
			hash.update(`${lstatSync(root.path).isSymbolicLink()}\0`);
		} catch {
			hash.update("missing\0");
			continue;
		}
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			const candidate = entry.name.endsWith(".md") ? join(root.path, entry.name) : join(root.path, entry.name, "SKILL.md");
			try {
				const info = statSync(candidate);
				hash.update(`${entry.name}\0${info.size}\0${info.mtimeMs}\0${linkedSkill(root.path, candidate)}\0`);
			} catch {
				hash.update(`${entry.name}\0-\0`);
			}
		}
	}
	return hash.digest("hex").slice(0, 24);
}
function findSkill(catalog, key) {
	const skill = catalog.skills.find((candidate) => candidate.key === key);
	if (skill === void 0) throw new Error("skill is not in this catalog: " + key);
	return skill;
}
/** The skill DSH loads for a name, if any root holds one. */
function activeSkill(catalog, name) {
	return catalog.skills.find((skill) => skill.name === name && skill.shadowedBy === void 0);
}
function readSkillDocument(summary) {
	const content = readFileSync(summary.path, "utf8");
	const split = splitFrontmatter(content);
	return {
		...summary,
		hash: sha256(content),
		bytes: Buffer.byteLength(content, "utf8"),
		content,
		frontmatter: split?.frontmatter ?? "",
		body: split?.body ?? content
	};
}
function rootPath(catalog, kind) {
	const root = catalog.roots.find((candidate) => candidate.kind === kind);
	if (root === void 0) throw new Error(kind.startsWith("project") ? "project skill roots need a selected workspace" : "unknown skill root: " + kind);
	return root.path;
}
//#endregion
//#region src/identity.ts
function skillOrigin(catalog, skill) {
	return {
		path: skill.path,
		...skill.root.startsWith("project-") ? { workspace: catalog.projectRoot } : {}
	};
}
function validOrigin(key, origin) {
	return origin !== null && typeof origin === "object" && typeof origin.path === "string" && isAbsolute(origin.path) && (key.startsWith("project-") ? typeof origin.workspace === "string" && isAbsolute(origin.workspace) : origin.workspace === void 0);
}
/** Old reviews kept their cwd in the cited trajectory, even before origins existed. */
function legacySuggestionWorkspace(ledger, suggestion) {
	if (!suggestion.skillKey?.startsWith("project-")) return void 0;
	const cited = new Set(suggestion.evidence.map((reference) => reference.trajectoryId));
	const trajectories = ledger.trajectories.filter((trajectory) => cited.has(trajectory.id) && (suggestion.reviewId === void 0 || trajectory.reviewId === suggestion.reviewId));
	if (suggestion.reviewId === void 0 && trajectories.length !== cited.size) return void 0;
	if (trajectories.length === 0 || trajectories.some((trajectory) => typeof trajectory.workspace !== "string" || !isAbsolute(trajectory.workspace))) return void 0;
	const roots = new Set(trajectories.map((trajectory) => projectRoot(trajectory.workspace)));
	return roots.size === 1 ? [...roots][0] : void 0;
}
/** A name alone, or identical contents in another project, is not an identity. */
function sameSuggestionSkill(ledger, suggestion, catalog, skill) {
	if (suggestion.skillKey !== skill.key) return false;
	if (suggestion.origin !== void 0) return validOrigin(skill.key, suggestion.origin) && resolve(suggestion.origin.path) === resolve(skill.path) && (!skill.root.startsWith("project-") || resolve(suggestion.origin.workspace) === catalog.projectRoot);
	return !skill.root.startsWith("project-") || legacySuggestionWorkspace(ledger, suggestion) === catalog.projectRoot;
}
function emptyLedger() {
	return {
		version: 1,
		generation: 0,
		suggestions: [],
		drafts: [],
		reviews: [],
		versions: [],
		trajectories: [],
		installs: []
	};
}
function emptyEvals() {
	return {
		version: 1,
		cases: [],
		runs: []
	};
}
function object$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function array(value) {
	return Array.isArray(value) ? value : [];
}
/** An opaque, filesystem-safe directory name for one skill key. */
function keyDirectory(skillKey) {
	return createHash("sha256").update(skillKey).digest("hex").slice(0, 16);
}
/** A dangling symlink still occupies its name and must never be overwritten. */
function entryExists(path) {
	try {
		lstatSync(path);
		return true;
	} catch (error) {
		if (["ENOENT", "ENOTDIR"].includes(error.code ?? "")) return false;
		throw error;
	}
}
/** Bytes an entry occupies on disk; an unreadable entry reports 0. */
function trashSize(path) {
	try {
		const info = lstatSync(path);
		if (info.isSymbolicLink()) return 0;
		if (!info.isDirectory()) return info.size;
		return readdirSync(path).reduce((total, name) => total + trashSize(join(path, name)), 0);
	} catch {
		return 0;
	}
}
/** The removal time encoded in an entry id, for entries that predate sidecars. */
function trashStamp(id) {
	const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-/u.exec(id);
	return match === null ? void 0 : `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
}
/** References are navigation links, not evidence: keep the records when a suggestion is deleted. */
function pruneSuggestionLinks(ledger) {
	const ids = new Set(ledger.suggestions.map((suggestion) => suggestion.id));
	for (const review of ledger.reviews) {
		if (review.suggestionIds === void 0) continue;
		const kept = review.suggestionIds.filter((id) => ids.has(id));
		if (kept.length !== review.suggestionIds.length) review.suggestions = Math.min(review.suggestions, kept.length);
		if (kept.length === 0) delete review.suggestionIds;
		else review.suggestionIds = kept;
	}
	for (const trajectory of ledger.trajectories) trajectory.suggestionIds = trajectory.suggestionIds.filter((id) => ids.has(id));
	return ledger;
}
/**
* The Skills Source's own files under `<dataDir>/skills`. Every file is
* replaced atomically; callers serialize writes with the storage lock.
*/
var SkillsStore = class {
	directory;
	constructor(directory) {
		this.directory = directory;
	}
	path(name) {
		return join(this.directory, name);
	}
	/** A directory beside the data, for staging a download before it is moved into place. */
	stagingDirectory() {
		return this.path("staging");
	}
	readJson(name) {
		const path = this.path(name);
		if (!existsSync(path)) return void 0;
		try {
			return JSON.parse(readFileSync(path, "utf8"));
		} catch (error) {
			throw new Error(`Skills Source file is unreadable: ${path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	writeAtomic(path, content) {
		mkdirSync(join(path, ".."), {
			recursive: true,
			mode: 448
		});
		const temporary = `${path}.${process.pid}-${randomUUID()}.tmp`;
		try {
			writeFileSync(temporary, content, { mode: 384 });
			renameSync(temporary, path);
		} finally {
			rmSync(temporary, { force: true });
		}
	}
	writeJson(name, value) {
		this.writeAtomic(this.path(name), `${JSON.stringify(value, null, 2)}\n`);
	}
	/** Name, size and time of each file the revision depends on. */
	fingerprint() {
		return [
			"ledger.json",
			"evals.json",
			"auto-adoption-budget.json"
		].map((name) => {
			try {
				const info = statSync(this.path(name));
				return `${name}:${info.size}:${info.mtimeMs}`;
			} catch {
				return `${name}:-`;
			}
		}).join("|");
	}
	autoAdoptionBudget() {
		return readBudget(this.readJson("auto-adoption-budget.json"));
	}
	saveAutoAdoptionBudget(entries) {
		this.writeJson("auto-adoption-budget.json", {
			version: 1,
			entries
		});
	}
	ledger() {
		const value = object$1(this.readJson("ledger.json"));
		if (value === void 0) return emptyLedger();
		return pruneSuggestionLinks({
			version: 1,
			generation: typeof value.generation === "number" ? value.generation : 0,
			suggestions: array(value.suggestions),
			drafts: array(value.drafts),
			reviews: array(value.reviews),
			versions: array(value.versions),
			trajectories: array(value.trajectories),
			installs: array(value.installs)
		});
	}
	/**
	* What the user picked for draft and backtest runs, kept out of `fingerprint()`
	* on purpose: changing a picker must not invalidate an open page's revision.
	*/
	preferences() {
		const stored = object$1(this.readJson("preferences.json")) ?? {};
		const route = (value) => {
			const picked = object$1(value);
			const provider = typeof picked?.provider === "string" ? picked.provider : void 0;
			const model = typeof picked?.model === "string" ? picked.model : void 0;
			return provider !== void 0 && model !== void 0 ? {
				provider,
				model
			} : void 0;
		};
		const routes = (value) => {
			const result = {};
			const map = object$1(value);
			if (map !== void 0) for (const [key, item] of Object.entries(map)) {
				const picked = route(item);
				if (picked !== void 0) result[key] = picked;
			}
			return result;
		};
		const draft = route(stored.draftModel);
		const run = route(stored.runModel);
		return {
			version: 1,
			...draft === void 0 ? {} : { draftModel: draft },
			...run === void 0 ? {} : { runModel: run },
			suggestionModels: routes(stored.suggestionModels),
			skillRunModels: routes(stored.skillRunModels)
		};
	}
	savePreferences(preferences) {
		this.writeJson("preferences.json", preferences);
	}
	saveLedger(ledger) {
		pruneSuggestionLinks(ledger);
		ledger.generation += 1;
		ledger.reviews = ledger.reviews.slice(0, 200);
		const kept = /* @__PURE__ */ new Set();
		ledger.drafts = ledger.drafts.filter((draft) => {
			if (draft.status === "ready") return true;
			kept.add(draft.id);
			return kept.size <= 60;
		});
		this.writeJson("ledger.json", ledger);
	}
	evals() {
		const value = object$1(this.readJson("evals.json"));
		return value === void 0 ? emptyEvals() : {
			version: 1,
			cases: array(value.cases),
			runs: array(value.runs)
		};
	}
	saveEvals(evals) {
		const counts = /* @__PURE__ */ new Map();
		evals.runs = evals.runs.filter((run) => {
			const count = (counts.get(run.skillName) ?? 0) + 1;
			counts.set(run.skillName, count);
			return run.status === "running" || count <= 20;
		});
		this.writeJson("evals.json", evals);
	}
	trajectory(id) {
		if (!/^[a-z0-9-]{1,80}$/u.test(id)) throw new Error("invalid trajectory id");
		const value = object$1(this.readJson(join("trajectories", `${id}.json`)));
		if (value === void 0) throw new Error("trajectory not found: " + id);
		const trajectory = value;
		const ids = new Set(this.ledger().suggestions.map((suggestion) => suggestion.id));
		trajectory.suggestionIds = trajectory.suggestionIds.filter((id) => ids.has(id));
		for (const annotation of trajectory.annotations) {
			if (annotation.suggestionIds === void 0) continue;
			const kept = annotation.suggestionIds.filter((id) => ids.has(id));
			if (kept.length === 0) delete annotation.suggestionIds;
			else annotation.suggestionIds = kept;
		}
		return trajectory;
	}
	saveTrajectory(trajectory) {
		this.writeJson(join("trajectories", `${trajectory.id}.json`), trajectory);
	}
	deleteTrajectory(id) {
		if (!/^[a-z0-9-]{1,80}$/u.test(id)) throw new Error("invalid trajectory id");
		rmSync(this.path(join("trajectories", `${id}.json`)), { force: true });
	}
	versionContent(version) {
		return readFileSync(this.path(join("versions", keyDirectory(version.skillKey), `${version.id}.md`)), "utf8");
	}
	saveVersionContent(version, content) {
		this.writeAtomic(this.path(join("versions", keyDirectory(version.skillKey), `${version.id}.md`)), content);
	}
	deleteVersionContent(version) {
		rmSync(this.path(join("versions", keyDirectory(version.skillKey), `${version.id}.md`)), { force: true });
	}
	registries() {
		return array(object$1(this.readJson(join("market", "registries.json")))?.registries);
	}
	saveRegistries(registries) {
		this.writeJson(join("market", "registries.json"), {
			version: 1,
			registries
		});
	}
	registryCache(id) {
		if (!/^[a-z0-9][a-z0-9-]{0,62}$/u.test(id)) return void 0;
		return object$1(this.readJson(join("market", "cache", `${id}.json`)));
	}
	saveRegistryCache(id, cache) {
		if (!/^[a-z0-9][a-z0-9-]{0,62}$/u.test(id)) throw new Error("invalid registry id");
		this.writeJson(join("market", "cache", `${id}.json`), cache);
	}
	deleteRegistryCache(id) {
		if (/^[a-z0-9][a-z0-9-]{0,62}$/u.test(id)) rmSync(this.path(join("market", "cache", `${id}.json`)), { force: true });
	}
	/**
	* Move a bundle or a flat file out of DSH's reach, never deleting it, and
	* record where it came from so the page can offer to put it back.
	*/
	trash(path, name, source = {}) {
		const file = basename(path).endsWith(".md") && !existsSync(join(path, "SKILL.md"));
		const trashedAt = /* @__PURE__ */ new Date();
		let id;
		let target;
		do {
			id = `${trashedAt.toISOString().replace(/[:.]/gu, "-")}-${name}${file ? ".md" : ""}`;
			target = this.path(join("trash", id));
			if (!entryExists(target)) break;
			trashedAt.setTime(trashedAt.getTime() + 1);
		} while (true);
		mkdirSync(join(target, ".."), {
			recursive: true,
			mode: 448
		});
		try {
			renameSync(path, target);
		} catch (error) {
			if (error.code !== "EXDEV") throw error;
			cpSync(path, target, {
				recursive: true,
				errorOnExist: true
			});
			rmSync(path, {
				recursive: true,
				force: true
			});
		}
		try {
			this.writeJson(join("trash", `${id}.json`), {
				version: 1,
				name,
				kind: file ? "file" : "bundle",
				trashedAt: trashedAt.toISOString(),
				...source
			});
		} catch {}
		return target;
	}
	/** Every entry waiting in the Trash, newest first; entries removed before records existed still list. */
	trashEntries() {
		let names;
		try {
			names = readdirSync(this.path("trash"));
		} catch {
			return [];
		}
		const entries = [];
		for (const id of names) {
			if (id.endsWith(".json")) continue;
			let record;
			try {
				record = object$1(this.readJson(join("trash", `${id}.json`)));
			} catch {}
			const stored = record === void 0 ? void 0 : record;
			const name = typeof stored?.name === "string" ? stored.name : /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-(.+)$/u.exec(id)?.[1]?.replace(/\.md$/u, "") ?? id;
			entries.push({
				id,
				name,
				kind: stored?.kind === "file" || stored?.kind === "bundle" ? stored.kind : id.endsWith(".md") ? "file" : "bundle",
				trashedAt: typeof stored?.trashedAt === "string" ? stored.trashedAt : trashStamp(id) ?? (/* @__PURE__ */ new Date(0)).toISOString(),
				bytes: trashSize(this.path(join("trash", id))),
				...stored?.root === void 0 ? {} : { root: stored.root },
				...typeof stored?.key === "string" ? { key: stored.key } : {},
				...typeof stored?.originalPath === "string" ? { originalPath: stored.originalPath } : {},
				...typeof stored?.workspace === "string" ? { workspace: stored.workspace } : {}
			});
		}
		return entries.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt) || b.id.localeCompare(a.id));
	}
	/** The entry with this id, or a refusal: the caller names what it wants back or gone. */
	trashEntry(id) {
		const entry = this.trashEntries().find((candidate) => candidate.id === id);
		if (entry === void 0) throw new Error("trash entry not found: " + id);
		return entry;
	}
	/** Stage a complete restore beside the target before removing the recoverable entry. */
	restoreTrash(entry, to, content) {
		const from = this.path(join("trash", entry.id));
		if (entryExists(to)) throw new Error(`${entry.name} already exists there; rename or remove it first`);
		mkdirSync(dirname(to), {
			recursive: true,
			mode: 448
		});
		const staging = join(dirname(to), `.mnemon-restore-${randomUUID()}`);
		try {
			if (lstatSync(from).isSymbolicLink()) symlinkSync(readlinkSync(from), staging, entry.kind === "bundle" ? "dir" : "file");
			else cpSync(from, staging, {
				recursive: true,
				force: false,
				errorOnExist: true,
				verbatimSymlinks: true
			});
			if (content !== void 0) {
				const document = entry.kind === "file" ? staging : join(staging, "SKILL.md");
				if (lstatSync(staging).isSymbolicLink() || lstatSync(document).isSymbolicLink()) throw new Error("a linked skill cannot be renamed during restore");
				writeFileSync(document, content);
			}
			if (entryExists(to)) throw new Error(`${entry.name} already exists there; rename or remove it first`);
			renameSync(staging, to);
			rmSync(from, {
				recursive: true,
				force: true
			});
			rmSync(this.path(join("trash", `${entry.id}.json`)), { force: true });
		} finally {
			rmSync(staging, {
				recursive: true,
				force: true
			});
		}
		return to;
	}
	trashContent(entry) {
		return readFileSync(this.path(join("trash", entry.id, ...entry.kind === "file" ? [] : ["SKILL.md"])), "utf8");
	}
	/** Delete an entry for good. */
	purgeTrash(entry) {
		rmSync(this.path(join("trash", entry.id)), {
			recursive: true,
			force: true
		});
		rmSync(this.path(join("trash", `${entry.id}.json`)), { force: true });
	}
};
//#endregion
//#region src/policy.ts
const DISMISSED_COOLDOWN_MS = 864e5;
/** Statuses in which a suggestion still holds its skill+action. */
const OPEN_STATUSES = /* @__PURE__ */ new Set([
	"pending",
	"drafting",
	"review"
]);
/** Character bigrams, so similarity works for Chinese as well as English. */
function bigrams(value) {
	const text = value.toLowerCase().replace(/\s+/gu, " ").trim();
	const grams = /* @__PURE__ */ new Map();
	const characters = [...text];
	for (let index = 0; index < characters.length - 1; index++) {
		const gram = characters[index] + characters[index + 1];
		grams.set(gram, (grams.get(gram) ?? 0) + 1);
	}
	return grams;
}
/** Dice coefficient over character bigrams. */
function similarity(left, right) {
	const a = bigrams(left);
	const b = bigrams(right);
	let total = 0;
	let shared = 0;
	for (const count of a.values()) total += count;
	for (const count of b.values()) total += count;
	if (total === 0) return left.trim() === right.trim() ? 1 : 0;
	for (const [gram, count] of a) shared += Math.min(count, b.get(gram) ?? 0);
	return 2 * shared / total;
}
/** A reviewer's free-form name, made into DSH's kebab-case when it can be. */
function normalizeSkillName(value) {
	const name = value.trim().toLowerCase().replace(/[\s_]+/gu, "-").replace(/[^a-z0-9-]/gu, "").replace(/-+/gu, "-").replace(/^-|-$/gu, "");
	return isSkillName(name) ? name : void 0;
}
function signals(values) {
	return [...new Set(values.filter((value) => EVOLUTION_SIGNALS.includes(value)))];
}
function clip$1(value, maximum) {
	const text = value.trim();
	return text.length <= maximum ? text : text.slice(0, maximum - 1) + "…";
}
/**
* `drafting` was set before this process started, so no live writer owns it any
* more. A draft write is cancelled only by the Host going away, and the catch
* that would put the suggestion back never runs then, so the row would sit in
* "drafting" forever and refuse both a retry and a delete.
*/
const PROCESS_STARTED_AT = Date.now() - Math.round(process.uptime() * 1e3);
const ORPHAN_DRAFT_ERROR = "the host restarted while this draft was being written";
function orphanedDraft(suggestion) {
	const at = Date.parse(suggestion.updatedAt);
	return !Number.isFinite(at) || at < PROCESS_STARTED_AT;
}
/**
* Move pending suggestions past their expiry to `expired`, and suggestions whose
* draft was abandoned by a dead process back to `pending`; true when anything changed.
*/
function expireSuggestions(ledger, now) {
	let changed = false;
	for (const suggestion of ledger.suggestions) {
		const lastAuto = suggestion.autoAdoption?.at(-1);
		if (lastAuto !== void 0 && [
			"queued",
			"drafting",
			"backtesting",
			"rewriting"
		].includes(lastAuto.stage) && (!Number.isFinite(Date.parse(lastAuto.at)) || Date.parse(lastAuto.at) < PROCESS_STARTED_AT)) {
			const event = {
				at: now.toISOString(),
				stage: "paused",
				attempt: lastAuto.attempt,
				reason: "interrupted"
			};
			suggestion.autoAdoption = [...suggestion.autoAdoption, event].slice(-16);
			const review = ledger.reviews.find((entry) => entry.id === suggestion.reviewId);
			if (review !== void 0) review.autoAdoptions = [...review.autoAdoptions ?? [], {
				...event,
				suggestionId: suggestion.id,
				skillName: suggestion.skillName
			}].slice(-160);
			changed = true;
		}
		if (suggestion.status === "pending" && Date.parse(suggestion.expiresAt) < now.getTime()) {
			suggestion.status = "expired";
			suggestion.updatedAt = now.toISOString();
			changed = true;
		} else if (suggestion.status === "drafting" && orphanedDraft(suggestion)) {
			suggestion.status = "pending";
			suggestion.updatedAt = now.toISOString();
			suggestion.lastError = ORPHAN_DRAFT_ERROR;
			changed = true;
		}
	}
	return changed;
}
function summaryOf(trajectory) {
	const { steps: _steps, annotations: _annotations, reviewSummary: _summary, ...summary } = trajectory;
	return summary;
}
/** Keep the newest trajectories; pinned ones and those a suggestion or case cites stay longest. */
function boundedTrajectories(ledger, evals) {
	if (ledger.trajectories.length <= 100) return [];
	const cited = /* @__PURE__ */ new Set([...ledger.suggestions.filter((suggestion) => OPEN_STATUSES.has(suggestion.status)).flatMap((suggestion) => suggestion.evidence.map((reference) => reference.trajectoryId)), ...evals.cases.flatMap((entry) => entry.origin.trajectoryId === void 0 ? [] : [entry.origin.trajectoryId])]);
	const order = [...ledger.trajectories].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
	const removed = [...order.filter((entry) => !entry.pinned && !cited.has(entry.id) && entry.outcome !== "suggested"), ...order.filter((entry) => !entry.pinned && !cited.has(entry.id) && entry.outcome === "suggested")].slice(0, ledger.trajectories.length - 100).map((entry) => entry.id);
	ledger.trajectories = ledger.trajectories.filter((entry) => !removed.includes(entry.id));
	return removed;
}
/** Similar cases already in a skill's set, by title and prompt. */
function similarCase(cases, skillName, title, prompt) {
	const candidate = `${title}\n${prompt}`;
	return cases.find((entry) => entry.skillName === skillName && similarity(`${entry.title}\n${entry.prompt}`, candidate) >= .8);
}
/** The admission rules a review asked for, each kept within its range or left at its default. */
function policyFrom(value) {
	const pick = (key, minimum, maximum) => {
		const candidate = value?.[key];
		return typeof candidate === "number" && Number.isFinite(candidate) && candidate >= minimum && candidate <= maximum ? candidate : DEFAULT_SKILLS_POLICY[key];
	};
	const allowed = (key) => {
		const candidate = value?.[key];
		if (candidate !== void 0 && typeof candidate !== "boolean") throw new Error(`skills policy ${key} must be a boolean`);
		return candidate ?? true;
	};
	return {
		allowCreate: allowed("allowCreate"),
		allowUpdate: allowed("allowUpdate"),
		minConfidence: pick("minConfidence", 0, 1),
		expiryDays: Math.round(pick("expiryDays", 1, 90)),
		maxPendingPerSession: Math.round(pick("maxPendingPerSession", 1, 20))
	};
}
/**
* Record one review: the trajectory it read, the log entry, and whatever of
* its suggestions and cases pass the admission rules. Mutates the files in
* the context; returns the trajectory to persist and what happened.
*/
function admitReview(context, input) {
	const { ledger, evals, policy, catalog, now } = context;
	const at = now.toISOString();
	const reviewId = context.id();
	const trajectoryId = context.id();
	const stepIndexes = new Set(input.trajectory.steps.map((step) => step.index));
	const steps = (values) => [...new Set(values.filter((value) => Number.isInteger(value) && stepIndexes.has(value)))].sort((a, b) => a - b);
	const skipped = [];
	const allowed = (action) => (action === "create" ? policy.allowCreate : policy.allowUpdate) !== false;
	const createdSuggestionIds = [];
	let inserted = 0;
	let updated = 0;
	let casesAdded = 0;
	expireSuggestions(ledger, now);
	const batch = /* @__PURE__ */ new Map();
	for (const raw of input.suggestions) {
		const name = normalizeSkillName(raw.skillName);
		if (name === void 0) {
			skipped.push({
				skillName: raw.skillName,
				action: raw.action,
				reason: "invalid_name"
			});
			continue;
		}
		if (raw.action !== "create" && raw.action !== "update") {
			skipped.push({
				skillName: name,
				action: String(raw.action),
				reason: "invalid_action"
			});
			continue;
		}
		if (raw.summary.trim() === "" || !Number.isFinite(raw.confidence)) {
			skipped.push({
				skillName: name,
				action: raw.action,
				reason: "missing_or_invalid_fields"
			});
			continue;
		}
		if (steps(raw.steps).length === 0) {
			skipped.push({
				skillName: name,
				action: raw.action,
				reason: "no_evidence"
			});
			continue;
		}
		const existing = activeSkill(catalog, name);
		const action = existing !== void 0 ? "update" : "create";
		if (existing?.readOnly) {
			skipped.push({
				skillName: name,
				action,
				reason: "linked_skill"
			});
			continue;
		}
		if (!allowed(action)) {
			skipped.push({
				skillName: name,
				action,
				reason: "suggestion_type_disabled"
			});
			continue;
		}
		if (raw.action === "update" && existing === void 0) {
			skipped.push({
				skillName: name,
				action: raw.action,
				reason: "unknown_skill"
			});
			continue;
		}
		const key = `${name}::${action}`;
		const previous = batch.get(key);
		if (previous === void 0 || raw.confidence >= previous.confidence) batch.set(key, {
			...raw,
			skillName: name,
			action
		});
	}
	const touched = [];
	for (const proposal of batch.values()) {
		const confidence = Math.min(1, Math.max(0, proposal.confidence));
		const evidence = {
			trajectoryId,
			steps: steps(proposal.steps)
		};
		if (confidence < policy.minConfidence) {
			skipped.push({
				skillName: proposal.skillName,
				action: proposal.action,
				reason: "low_confidence"
			});
			continue;
		}
		const skill = activeSkill(catalog, proposal.skillName);
		const sameSkill = (suggestion) => suggestion.skillName === proposal.skillName && suggestion.action === proposal.action && (skill === void 0 || sameSuggestionSkill(ledger, suggestion, catalog, skill));
		if (ledger.suggestions.find((suggestion) => sameSkill(suggestion) && suggestion.status === "dismissed" && suggestion.sourceSessionId === input.review.sessionId && now.getTime() - Date.parse(suggestion.updatedAt) < DISMISSED_COOLDOWN_MS) !== void 0) {
			skipped.push({
				skillName: proposal.skillName,
				action: proposal.action,
				reason: "recently_dismissed"
			});
			continue;
		}
		const open = ledger.suggestions.find((suggestion) => sameSkill(suggestion) && OPEN_STATUSES.has(suggestion.status));
		if (open !== void 0) {
			open.evidence = [...open.evidence, evidence].slice(-12);
			open.signals = signals([...open.signals, ...proposal.signals]);
			if (open.status === "pending" && confidence >= open.confidence) {
				open.summary = clip$1(proposal.summary, 600);
				if (proposal.rationale !== void 0 && proposal.rationale.trim() !== "") open.rationale = clip$1(proposal.rationale, 2e3);
				open.confidence = confidence;
				open.reviewId = reviewId;
				if (skill !== void 0) {
					open.skillKey = skill.key;
					open.skillFileHash = skill.hash;
					open.origin = skillOrigin(catalog, skill);
				}
				updated++;
			} else skipped.push({
				skillName: proposal.skillName,
				action: proposal.action,
				reason: open.status === "pending" ? "duplicate_lower_confidence" : "in_progress"
			});
			open.updatedAt = at;
			touched.push(open);
			continue;
		}
		const suggestion = {
			id: context.id(),
			skillName: proposal.skillName,
			action: proposal.action,
			...proposal.action === "create" && proposal.targetRoot !== void 0 ? { targetRoot: proposal.targetRoot } : {},
			summary: clip$1(proposal.summary, 600),
			...proposal.rationale === void 0 || proposal.rationale.trim() === "" ? {} : { rationale: clip$1(proposal.rationale, 2e3) },
			confidence,
			signals: signals(proposal.signals),
			evidence: [evidence],
			...skill === void 0 ? {} : {
				skillKey: skill.key,
				skillFileHash: skill.hash,
				origin: skillOrigin(catalog, skill)
			},
			sourceSessionId: input.review.sessionId,
			...input.review.sessionTitle === void 0 ? {} : { sourceSessionTitle: input.review.sessionTitle },
			reviewId,
			status: "pending",
			createdAt: at,
			updatedAt: at,
			expiresAt: new Date(now.getTime() + policy.expiryDays * 24 * 60 * 60 * 1e3).toISOString()
		};
		ledger.suggestions.unshift(suggestion);
		createdSuggestionIds.push(suggestion.id);
		touched.push(suggestion);
		inserted++;
	}
	const pending = ledger.suggestions.filter((suggestion) => suggestion.status === "pending" && suggestion.sourceSessionId === input.review.sessionId);
	if (pending.length > policy.maxPendingPerSession) {
		const excess = [...pending].sort((a, b) => a.confidence - b.confidence || Date.parse(a.createdAt) - Date.parse(b.createdAt)).slice(0, pending.length - policy.maxPendingPerSession);
		for (const suggestion of excess) {
			suggestion.status = "expired";
			suggestion.updatedAt = at;
		}
	}
	const caseIds = [];
	for (const raw of input.cases) {
		const name = normalizeSkillName(raw.skillName);
		const title = clip$1(raw.title, 120);
		const prompt = clip$1(raw.prompt, 4e3);
		const checks = raw.checks.filter((check) => check.text.trim() !== "").slice(0, 8).map((check) => ({
			id: context.id(),
			text: clip$1(check.text, 300),
			must: check.must === true
		}));
		const cited = steps(raw.steps);
		if (name === void 0 || title === "" || prompt === "" || checks.length === 0) {
			skipped.push({
				skillName: raw.skillName,
				reason: "invalid_case"
			});
			continue;
		}
		if (!allowed(activeSkill(catalog, name) === void 0 ? "create" : "update")) {
			skipped.push({
				skillName: name,
				reason: "suggestion_type_disabled"
			});
			continue;
		}
		if (similarCase(evals.cases, name, title, prompt) !== void 0) {
			skipped.push({
				skillName: name,
				reason: "similar_case"
			});
			continue;
		}
		if (evals.cases.filter((entry) => entry.skillName === name).length >= 40) {
			skipped.push({
				skillName: name,
				reason: "case_limit"
			});
			continue;
		}
		if (!checks.some((check) => check.must)) checks[0].must = true;
		const suggestion = touched.find((entry) => entry.skillName === name);
		const entry = {
			id: context.id(),
			skillName: name,
			title,
			prompt,
			checks,
			origin: {
				kind: "review",
				trajectoryId,
				steps: cited,
				...suggestion === void 0 ? {} : { suggestionId: suggestion.id }
			},
			enabled: true,
			createdAt: at,
			updatedAt: at
		};
		evals.cases.unshift(entry);
		caseIds.push(entry.id);
		casesAdded++;
	}
	const annotations = input.annotations.filter((annotation) => stepIndexes.has(annotation.step) && EVOLUTION_SIGNALS.includes(annotation.signal)).slice(0, 60).map((annotation) => {
		const linked = touched.filter((suggestion) => suggestion.evidence.some((reference) => reference.trajectoryId === trajectoryId && reference.steps.includes(annotation.step))).map((suggestion) => suggestion.id);
		return {
			step: annotation.step,
			signal: annotation.signal,
			note: clip$1(annotation.note, 400),
			...linked.length === 0 ? {} : { suggestionIds: linked }
		};
	});
	const outcome = input.review.outcome === "error" ? "error" : touched.length > 0 || casesAdded > 0 ? "suggested" : "nothing";
	const trajectory = {
		...input.trajectory,
		id: trajectoryId,
		annotations,
		annotationCount: annotations.length,
		signals: signals(annotations.map((annotation) => annotation.signal)),
		suggestionIds: touched.map((suggestion) => suggestion.id),
		caseIds,
		reviewId,
		outcome,
		pinned: false,
		createdAt: at,
		...input.review.summary === void 0 ? {} : { reviewSummary: clip$1(input.review.summary, 600) }
	};
	ledger.trajectories.unshift(summaryOf(trajectory));
	for (const suggestion of touched) suggestion.triage = triageSuggestion(suggestion, ledger.trajectories);
	const log = {
		...input.review,
		id: reviewId,
		outcome,
		suggestions: inserted + updated,
		cases: casesAdded,
		trajectoryId,
		...touched.length === 0 ? {} : { suggestionIds: touched.map((suggestion) => suggestion.id) }
	};
	ledger.reviews.unshift(log);
	const removedTrajectories = boundedTrajectories(ledger, evals);
	return {
		result: {
			reviewId,
			trajectoryId,
			suggestionIds: touched.map((suggestion) => suggestion.id),
			createdSuggestionIds,
			inserted,
			updated,
			casesAdded,
			skipped
		},
		trajectory,
		removedTrajectories
	};
}
function trajectorySummary(trajectory) {
	return summaryOf(trajectory);
}
//#endregion
//#region src/archive.ts
/** A path inside the skill folder, or undefined when it would leave it. */
function insidePath(raw) {
	const path = raw.replace(/\\/gu, "/").replace(/^(?:\.\/)+/u, "");
	if (path === "" || path.startsWith("/") || /^[A-Za-z]:/u.test(path)) return void 0;
	if (path.split("/").some((part) => part === ".." || part === "." || part === "")) return void 0;
	return path;
}
/** Files an archiver adds that are not part of a skill. */
function isJunk(path) {
	return path.startsWith("__MACOSX/") || path.split("/").at(-1) === ".DS_Store";
}
var Collector = class {
	limits;
	files = [];
	total = 0;
	constructor(limits) {
		this.limits = limits;
	}
	add(rawPath, data) {
		const path = insidePath(rawPath);
		if (path === void 0) throw new Error(`the archive holds a path outside the skill: ${rawPath.slice(0, 200)}`);
		if (isJunk(path)) return;
		this.total += data.byteLength;
		if (this.files.length >= this.limits.files) throw new Error(`the archive has more than ${this.limits.files} files`);
		if (this.total > this.limits.bytes) throw new Error(`the archive unpacks to more than ${this.limits.bytes} bytes`);
		this.files.push({
			path,
			data
		});
	}
};
function text(buffer, start, length) {
	const field = buffer.subarray(start, start + length);
	const end = field.indexOf(0);
	return field.toString("utf8", 0, end === -1 ? field.length : end);
}
function octal(buffer, start, length) {
	if ((buffer[start] & 128) !== 0) throw new Error("the archive holds a file too large to install");
	const value = text(buffer, start, length).trim();
	if (value === "") return 0;
	if (!/^[0-7]+$/u.test(value)) throw new Error("the archive has a corrupt header");
	return Number.parseInt(value, 8);
}
/** The `path` of a PAX extended header, which overrides the next entry's name. */
function paxPath(body) {
	let offset = 0;
	while (offset < body.length) {
		const space = body.indexOf(32, offset);
		if (space === -1) break;
		const length = Number.parseInt(body.toString("ascii", offset, space), 10);
		if (!Number.isFinite(length) || length <= 0) break;
		const record = body.toString("utf8", space + 1, offset + length - 1);
		const equals = record.indexOf("=");
		if (equals !== -1 && record.slice(0, equals) === "path") return record.slice(equals + 1);
		offset += length;
	}
}
/** A POSIX tar stream (ustar, PAX or GNU long names) of regular files and folders. */
function readTar(buffer, limits) {
	const collector = new Collector(limits);
	let offset = 0;
	let longName;
	let extended;
	while (offset + 512 <= buffer.length) {
		const header = buffer.subarray(offset, offset + 512);
		if (header.every((byte) => byte === 0)) break;
		const size = octal(header, 124, 12);
		const type = String.fromCharCode(header[156]);
		const start = offset + 512;
		if (start + size > buffer.length) throw new Error("the archive is truncated");
		const body = buffer.subarray(start, start + size);
		offset = start + Math.ceil(size / 512) * 512;
		if (type === "x") {
			extended = paxPath(body);
			continue;
		}
		if (type === "g") continue;
		if (type === "L") {
			longName = text(body, 0, body.length);
			continue;
		}
		const prefix = header.toString("ascii", 257, 262) === "ustar" ? text(header, 345, 155) : "";
		const name = extended ?? longName ?? (prefix === "" ? text(header, 0, 100) : `${prefix}/${text(header, 0, 100)}`);
		extended = void 0;
		longName = void 0;
		if (type === "5") continue;
		if (type !== "0" && type !== "\0" && type !== "7") throw new Error(`the archive holds a link or special file: ${name.slice(0, 200)}`);
		collector.add(name, Buffer.from(body));
	}
	return collector.files;
}
const ZIP_LOCAL = 67324752;
const ZIP_CENTRAL = 33639248;
const ZIP_END = 101010256;
/** A zip archive of stored or deflated files; encrypted, zip64 and linked entries are refused. */
function readZip(buffer, limits) {
	let end = -1;
	for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 22 - 65535); index--) if (buffer.readUInt32LE(index) === ZIP_END) {
		end = index;
		break;
	}
	if (end === -1) throw new Error("the zip archive has no central directory");
	const count = buffer.readUInt16LE(end + 10);
	let pointer = buffer.readUInt32LE(end + 16);
	if (count === 65535 || pointer === 4294967295) throw new Error("zip64 archives are not supported");
	const collector = new Collector(limits);
	for (let index = 0; index < count; index++) {
		if (pointer + 46 > buffer.length || buffer.readUInt32LE(pointer) !== ZIP_CENTRAL) throw new Error("the zip archive is corrupt");
		const flags = buffer.readUInt16LE(pointer + 8);
		const method = buffer.readUInt16LE(pointer + 10);
		const compressed = buffer.readUInt32LE(pointer + 20);
		const size = buffer.readUInt32LE(pointer + 24);
		const nameLength = buffer.readUInt16LE(pointer + 28);
		const extraLength = buffer.readUInt16LE(pointer + 30);
		const commentLength = buffer.readUInt16LE(pointer + 32);
		const mode = buffer.readUInt32LE(pointer + 38) >>> 16;
		const local = buffer.readUInt32LE(pointer + 42);
		const name = buffer.toString("utf8", pointer + 46, pointer + 46 + nameLength);
		pointer += 46 + nameLength + extraLength + commentLength;
		if (name.endsWith("/")) continue;
		if ((flags & 1) !== 0) throw new Error("encrypted zip archives are not supported");
		if ((mode & 61440) === 40960) throw new Error(`the archive holds a link: ${name.slice(0, 200)}`);
		if (compressed === 4294967295 || size === 4294967295) throw new Error("zip64 archives are not supported");
		if (size > limits.bytes) throw new Error(`the archive unpacks to more than ${limits.bytes} bytes`);
		if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== ZIP_LOCAL) throw new Error("the zip archive is corrupt");
		const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
		if (start + compressed > buffer.length) throw new Error("the zip archive is truncated");
		const raw = buffer.subarray(start, start + compressed);
		const data = method === 0 ? Buffer.from(raw) : method === 8 ? inflateRawSync(raw, { maxOutputLength: limits.bytes }) : void 0;
		if (data === void 0) throw new Error(`the zip archive uses an unsupported compression method (${method})`);
		if (data.byteLength !== size) throw new Error("the zip archive is corrupt");
		collector.add(name, data);
	}
	return collector.files;
}
/**
* The files of a skill archive, a `.tar.gz` or a `.zip` told apart by their
* first bytes. Paths stay inside the skill folder; links, special files and
* oversized content are refused. A single folder wrapping a skill whose
* `SKILL.md` is not at the top is unwrapped.
*/
function readArchive(data, limits) {
	let files;
	if (data.length >= 2 && data[0] === 31 && data[1] === 139) {
		let tar;
		try {
			tar = gunzipSync(data, { maxOutputLength: limits.bytes + limits.files * 1024 + 4096 });
		} catch (error) {
			throw new Error(error instanceof RangeError || error.code === "ERR_BUFFER_TOO_LARGE" ? `the archive unpacks to more than ${limits.bytes} bytes` : "the archive is not a valid .tar.gz");
		}
		files = readTar(tar, limits);
	} else if (data.length >= 4 && data.readUInt32LE(0) === ZIP_LOCAL) files = readZip(data, limits);
	else throw new Error("a skill archive is a .tar.gz or a .zip");
	if (files.some((file) => file.path === "SKILL.md")) return files;
	const tops = new Set(files.map((file) => file.path.split("/")[0]));
	const [top] = tops;
	if (tops.size === 1 && top !== void 0 && files.some((file) => file.path === `${top}/SKILL.md`)) return files.map((file) => ({
		path: file.path.slice(top.length + 1),
		data: file.data
	}));
	throw new Error("the archive has no SKILL.md at its top level");
}
//#endregion
//#region src/source-kind.ts
/** A GitHub account: letters, digits and single hyphens, never a dot, so `example.com/skills` stays a website. */
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u;
const NAME = /^[A-Za-z0-9_.-]+$/u;
const REF$1 = /^[A-Za-z0-9_./-]{1,200}$/u;
function githubUrl(location) {
	const base = `https://github.com/${location.repo}`;
	if (location.ref === void 0 && location.path === "") return base;
	return `${base}/tree/${location.ref ?? "HEAD"}${location.path === "" ? "" : "/" + location.path}`;
}
/** Read a GitHub location back from what {@link githubUrl} stored, or from what a user pasted. */
function parseGithub(input) {
	const text = input.trim().replace(/\.git$/u, "").replace(/\/+$/u, "");
	const short = /^([^/\s]+)\/([^/\s]+)$/u.exec(text);
	if (short !== null && !/^https?:/iu.test(text)) return OWNER.test(short[1]) && NAME.test(short[2]) && !/\.json$/iu.test(short[2]) ? {
		repo: `${short[1]}/${short[2]}`,
		path: ""
	} : void 0;
	let url;
	try {
		url = new URL(text);
	} catch {
		return;
	}
	if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return void 0;
	const [owner, repo, mode, ref, ...rest] = url.pathname.split("/").filter(Boolean);
	if (owner === void 0 || repo === void 0 || !OWNER.test(owner) || !NAME.test(repo)) return void 0;
	if (mode === void 0) return {
		repo: `${owner}/${repo}`,
		path: ""
	};
	if (mode !== "tree" && mode !== "blob" || ref === void 0 || !REF$1.test(ref)) return {
		repo: `${owner}/${repo}`,
		path: ""
	};
	const parts = mode === "blob" ? rest.slice(0, -1) : rest;
	if (parts.some((part) => part === ".." || part === ".")) return void 0;
	return {
		repo: `${owner}/${repo}`,
		ref,
		path: parts.join("/")
	};
}
function isAbsolutePath(text) {
	return text.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(text) || text.startsWith("file://");
}
/**
* What a pasted string names, without fetching it: a GitHub repository
* (`owner/repo`, a github.com URL, or a skills.sh page of one), a JSON file
* by URL, a website that may publish an Agent Skills index, or an absolute
* path to a local catalog. Undefined when it is none of these.
*/
function detectSource(input) {
	const text = input.trim();
	if (text === "") return void 0;
	if (isAbsolutePath(text)) return /\.json$/iu.test(text) ? {
		kind: "catalog",
		location: text,
		label: text.split(/[\\/]/u).at(-1)
	} : void 0;
	const github = parseGithub(text);
	if (github !== void 0) return {
		kind: "github",
		location: githubUrl(github),
		label: github.path === "" ? github.repo : `${github.repo}/${github.path}`
	};
	let url;
	try {
		url = new URL(/^https?:\/\//iu.test(text) ? text : `https://${text}`);
	} catch {
		return;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return void 0;
	if (!url.hostname.includes(".")) return void 0;
	if (url.hostname === "skills.sh" || url.hostname === "www.skills.sh") {
		const [owner, repo] = url.pathname.split("/").filter(Boolean);
		if (owner !== void 0 && repo !== void 0 && OWNER.test(owner) && NAME.test(repo)) return {
			kind: "github",
			location: `https://github.com/${owner}/${repo}`,
			label: `${owner}/${repo}`
		};
		return;
	}
	const location = url.toString().replace(/\/$/u, "");
	if (/\.json$/iu.test(url.pathname)) return {
		kind: "json",
		location,
		label: url.pathname.split("/").at(-1)
	};
	return {
		kind: "well-known",
		location,
		label: url.host + url.pathname.replace(/\/$/u, "")
	};
}
//#endregion
//#region market/official.json
var official_default = {
	version: 1,
	id: "official",
	name: {
		"en": "Featured",
		"zh-CN": "精选"
	},
	description: {
		"en": "Open-source skills from their original repositories. Each installs from its upstream source; check its license there.",
		"zh-CN": "来自原始仓库的开源技能。每个技能都从上游源安装，许可证以上游为准。"
	},
	homepage: "https://github.com/omdsh-dev/dsh-mnemon/tree/main/plugins/dsh-mnemon-source-skills/market",
	categories: [
		{
			"id": "docs-writing",
			"label": {
				"en": "Writing",
				"zh-CN": "文档写作"
			}
		},
		{
			"id": "content-creation",
			"label": {
				"en": "Content",
				"zh-CN": "内容创作"
			}
		},
		{
			"id": "design-ui",
			"label": {
				"en": "Design",
				"zh-CN": "设计与界面"
			}
		},
		{
			"id": "development",
			"label": {
				"en": "Development",
				"zh-CN": "开发"
			}
		},
		{
			"id": "devops",
			"label": {
				"en": "Deploy",
				"zh-CN": "部署运维"
			}
		},
		{
			"id": "research-analysis",
			"label": {
				"en": "Research",
				"zh-CN": "研究分析"
			}
		},
		{
			"id": "productivity",
			"label": {
				"en": "Productivity",
				"zh-CN": "效率工具"
			}
		},
		{
			"id": "marketing",
			"label": {
				"en": "Marketing",
				"zh-CN": "市场营销"
			}
		}
	],
	skills: [
		{
			"name": "frontend-design",
			"title": {
				"en": "Frontend design",
				"zh-CN": "前端设计"
			},
			"description": {
				"en": "Gives new or reworked UI a deliberate visual direction: typography, color and layout choices instead of generic templates.",
				"zh-CN": "为新界面或改版确定有辨识度的视觉方向：排版、配色与布局取舍，避免千篇一律的模板感。"
			},
			"category": "design-ui",
			"author": "Anthropic",
			"license": "Apache-2.0",
			"homepage": "https://github.com/anthropics/skills/tree/main/skills/frontend-design",
			"source": {
				"type": "github",
				"repo": "anthropics/skills",
				"ref": "main",
				"path": "skills/frontend-design"
			},
			"tags": ["featured"]
		},
		{
			"name": "theme-factory",
			"title": {
				"en": "Theme factory",
				"zh-CN": "主题工厂"
			},
			"description": {
				"en": "Styles slides, docs, reports and landing pages with one of ten preset themes or a theme generated on the spot.",
				"zh-CN": "用 10 套预设或现场生成的配色与字体主题，统一幻灯片、文档、报告和落地页的风格。"
			},
			"category": "design-ui",
			"author": "Anthropic",
			"license": "Apache-2.0",
			"homepage": "https://github.com/anthropics/skills/tree/main/skills/theme-factory",
			"source": {
				"type": "github",
				"repo": "anthropics/skills",
				"ref": "main",
				"path": "skills/theme-factory"
			}
		},
		{
			"name": "brand-guidelines",
			"title": {
				"en": "Brand guidelines",
				"zh-CN": "品牌规范"
			},
			"description": {
				"en": "Applies a brand's colors and typography to an artifact; a template for writing your own brand skill.",
				"zh-CN": "把一套品牌的颜色与字体规范应用到产物上；可作为编写自家品牌技能的范例。"
			},
			"category": "design-ui",
			"author": "Anthropic",
			"license": "Apache-2.0",
			"homepage": "https://github.com/anthropics/skills/tree/main/skills/brand-guidelines",
			"source": {
				"type": "github",
				"repo": "anthropics/skills",
				"ref": "main",
				"path": "skills/brand-guidelines"
			}
		},
		{
			"name": "canvas-design",
			"title": {
				"en": "Canvas design",
				"zh-CN": "海报与视觉设计"
			},
			"description": {
				"en": "Creates posters and other visual pieces as PNG or PDF from a stated design philosophy.",
				"zh-CN": "先确立设计理念，再输出海报、插画等 PNG/PDF 视觉作品。"
			},
			"category": "design-ui",
			"author": "Anthropic",
			"license": "Apache-2.0",
			"homepage": "https://github.com/anthropics/skills/tree/main/skills/canvas-design",
			"source": {
				"type": "github",
				"repo": "anthropics/skills",
				"ref": "main",
				"path": "skills/canvas-design"
			}
		},
		{
			"name": "algorithmic-art",
			"title": {
				"en": "Algorithmic art",
				"zh-CN": "算法艺术"
			},
			"description": {
				"en": "Creates generative art with p5.js, seeded randomness and interactive parameters.",
				"zh-CN": "用 p5.js 和可复现的随机种子创作生成艺术，并提供可交互调整的参数。"
			},
			"category": "content-creation",
			"author": "Anthropic",
			"license": "Apache-2.0",
			"homepage": "https://github.com/anthropics/skills/tree/main/skills/algorithmic-art",
			"source": {
				"type": "github",
				"repo": "anthropics/skills",
				"ref": "main",
				"path": "skills/algorithmic-art"
			}
		},
		{
			"name": "slack-gif-creator",
			"title": {
				"en": "Slack GIF creator",
				"zh-CN": "Slack 动图"
			},
			"description": {
				"en": "Makes animated GIFs that fit Slack's size limits, with validation tools.",
				"zh-CN": "按 Slack 的尺寸与体积限制制作动图，并自带校验工具。"
			},
			"category": "content-creation",
			"author": "Anthropic",
			"license": "Apache-2.0",
			"homepage": "https://github.com/anthropics/skills/tree/main/skills/slack-gif-creator",
			"source": {
				"type": "github",
				"repo": "anthropics/skills",
				"ref": "main",
				"path": "skills/slack-gif-creator"
			}
		},
		{
			"name": "internal-comms",
			"title": {
				"en": "Internal comms",
				"zh-CN": "内部沟通"
			},
			"description": {
				"en": "Writes status reports, announcements, FAQs, incident write-ups and other internal communications in familiar formats.",
				"zh-CN": "按团队常用格式撰写周报、通告、FAQ、事故复盘等内部沟通文稿。"
			},
			"category": "docs-writing",
			"author": "Anthropic",
			"license": "Apache-2.0",
			"homepage": "https://github.com/anthropics/skills/tree/main/skills/internal-comms",
			"source": {
				"type": "github",
				"repo": "anthropics/skills",
				"ref": "main",
				"path": "skills/internal-comms"
			}
		},
		{
			"name": "skill-creator",
			"title": {
				"en": "Skill creator",
				"zh-CN": "技能创作"
			},
			"description": {
				"en": "Creates, edits and evaluates skills, and tunes their descriptions so they trigger when they should.",
				"zh-CN": "从零编写、修改和评测技能，并优化技能描述以便被正确触发。"
			},
			"category": "development",
			"author": "Anthropic",
			"license": "Apache-2.0",
			"homepage": "https://github.com/anthropics/skills/tree/main/skills/skill-creator",
			"source": {
				"type": "github",
				"repo": "anthropics/skills",
				"ref": "main",
				"path": "skills/skill-creator"
			},
			"tags": ["featured"]
		},
		{
			"name": "mcp-builder",
			"title": {
				"en": "MCP builder",
				"zh-CN": "MCP 服务开发"
			},
			"description": {
				"en": "Designs and builds high-quality MCP servers that give models well-shaped tools for external services.",
				"zh-CN": "设计并实现高质量的 MCP 服务器，让模型通过精心设计的工具访问外部服务。"
			},
			"category": "development",
			"author": "Anthropic",
			"license": "Apache-2.0",
			"homepage": "https://github.com/anthropics/skills/tree/main/skills/mcp-builder",
			"source": {
				"type": "github",
				"repo": "anthropics/skills",
				"ref": "main",
				"path": "skills/mcp-builder"
			}
		},
		{
			"name": "webapp-testing",
			"title": {
				"en": "Web app testing",
				"zh-CN": "Web 应用测试"
			},
			"description": {
				"en": "Drives local web apps with Playwright to verify behavior, debug the UI, capture screenshots and read browser logs.",
				"zh-CN": "用 Playwright 驱动本地 Web 应用：验证功能、排查界面问题、截图与读取浏览器日志。"
			},
			"category": "development",
			"author": "Anthropic",
			"license": "Apache-2.0",
			"homepage": "https://github.com/anthropics/skills/tree/main/skills/webapp-testing",
			"source": {
				"type": "github",
				"repo": "anthropics/skills",
				"ref": "main",
				"path": "skills/webapp-testing"
			}
		},
		{
			"name": "web-artifacts-builder",
			"title": {
				"en": "Web artifacts builder",
				"zh-CN": "复杂网页产物"
			},
			"description": {
				"en": "Builds multi-component, stateful HTML artifacts with React, Tailwind CSS and shadcn/ui.",
				"zh-CN": "用 React、Tailwind 与 shadcn/ui 构建多组件、带状态的复杂 HTML 产物。"
			},
			"category": "development",
			"author": "Anthropic",
			"license": "Apache-2.0",
			"homepage": "https://github.com/anthropics/skills/tree/main/skills/web-artifacts-builder",
			"source": {
				"type": "github",
				"repo": "anthropics/skills",
				"ref": "main",
				"path": "skills/web-artifacts-builder"
			}
		},
		{
			"name": "changelog-generator",
			"title": {
				"en": "Changelog generator",
				"zh-CN": "更新日志生成"
			},
			"description": {
				"en": "Turns git history into a categorized, user-facing changelog.",
				"zh-CN": "分析 git 提交并归类，把技术提交改写成面向用户的更新日志。"
			},
			"category": "docs-writing",
			"author": "Composio community",
			"homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/changelog-generator",
			"source": {
				"type": "github",
				"repo": "ComposioHQ/awesome-claude-skills",
				"ref": "master",
				"path": "changelog-generator"
			}
		},
		{
			"name": "content-research-writer",
			"title": {
				"en": "Content research writer",
				"zh-CN": "研究型写作"
			},
			"description": {
				"en": "Researches while you write: adds citations, sharpens hooks and outlines, and reviews each section.",
				"zh-CN": "边研究边写作：补充引用、打磨开头与大纲，并逐节给出反馈。"
			},
			"category": "docs-writing",
			"author": "Composio community",
			"homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/content-research-writer",
			"source": {
				"type": "github",
				"repo": "ComposioHQ/awesome-claude-skills",
				"ref": "master",
				"path": "content-research-writer"
			}
		},
		{
			"name": "competitive-ads-extractor",
			"title": {
				"en": "Competitive ads extractor",
				"zh-CN": "竞品广告分析"
			},
			"description": {
				"en": "Collects competitors' ads from ad libraries and analyzes which messages and creative approaches work.",
				"zh-CN": "从各广告库提取竞品广告，分析其中有效的信息点与创意手法。"
			},
			"category": "research-analysis",
			"author": "Composio community",
			"homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/competitive-ads-extractor",
			"source": {
				"type": "github",
				"repo": "ComposioHQ/awesome-claude-skills",
				"ref": "master",
				"path": "competitive-ads-extractor"
			}
		},
		{
			"name": "lead-research-assistant",
			"title": {
				"en": "Lead research assistant",
				"zh-CN": "潜在客户研究"
			},
			"description": {
				"en": "Finds companies that fit your business and suggests concrete ways to reach them.",
				"zh-CN": "分析你的业务，寻找匹配的目标公司并给出可执行的联系策略。"
			},
			"category": "research-analysis",
			"author": "Composio community",
			"homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/lead-research-assistant",
			"source": {
				"type": "github",
				"repo": "ComposioHQ/awesome-claude-skills",
				"ref": "master",
				"path": "lead-research-assistant"
			}
		},
		{
			"name": "meeting-insights-analyzer",
			"title": {
				"en": "Meeting insights analyzer",
				"zh-CN": "会议洞察"
			},
			"description": {
				"en": "Analyzes meeting transcripts for communication patterns and gives concrete feedback.",
				"zh-CN": "分析会议记录，找出沟通模式与可改进之处，给出具体反馈。"
			},
			"category": "research-analysis",
			"author": "Composio community",
			"homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/meeting-insights-analyzer",
			"source": {
				"type": "github",
				"repo": "ComposioHQ/awesome-claude-skills",
				"ref": "master",
				"path": "meeting-insights-analyzer"
			}
		},
		{
			"name": "domain-name-brainstormer",
			"title": {
				"en": "Domain name brainstormer",
				"zh-CN": "域名构思"
			},
			"description": {
				"en": "Brainstorms domain names for a project and checks availability across TLDs.",
				"zh-CN": "为项目构思域名，并检查多个后缀的可用性。"
			},
			"category": "productivity",
			"author": "Composio community",
			"homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/domain-name-brainstormer",
			"source": {
				"type": "github",
				"repo": "ComposioHQ/awesome-claude-skills",
				"ref": "master",
				"path": "domain-name-brainstormer"
			}
		},
		{
			"name": "file-organizer",
			"title": {
				"en": "File organizer",
				"zh-CN": "文件整理"
			},
			"description": {
				"en": "Organizes files and folders by content: finds duplicates, proposes a better structure and cleans up.",
				"zh-CN": "理解文件内容后整理目录：找出重复文件、提出更好的结构并自动清理。"
			},
			"category": "productivity",
			"author": "Composio community",
			"homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/file-organizer",
			"source": {
				"type": "github",
				"repo": "ComposioHQ/awesome-claude-skills",
				"ref": "master",
				"path": "file-organizer"
			}
		},
		{
			"name": "invoice-organizer",
			"title": {
				"en": "Invoice organizer",
				"zh-CN": "发票整理"
			},
			"description": {
				"en": "Reads messy invoices and receipts, extracts key fields, renames and files them for tax time.",
				"zh-CN": "读取杂乱的发票与收据，提取关键信息、统一命名并分类归档，方便报税。"
			},
			"category": "productivity",
			"author": "Composio community",
			"homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/invoice-organizer",
			"source": {
				"type": "github",
				"repo": "ComposioHQ/awesome-claude-skills",
				"ref": "master",
				"path": "invoice-organizer"
			}
		},
		{
			"name": "image-enhancer",
			"title": {
				"en": "Image enhancer",
				"zh-CN": "图片增强"
			},
			"description": {
				"en": "Sharpens screenshots and other images for presentations and documentation.",
				"zh-CN": "提升截图等图片的清晰度与锐度，用于演示和文档。"
			},
			"category": "productivity",
			"author": "Composio community",
			"homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/image-enhancer",
			"source": {
				"type": "github",
				"repo": "ComposioHQ/awesome-claude-skills",
				"ref": "master",
				"path": "image-enhancer"
			}
		},
		{
			"name": "tailored-resume-generator",
			"title": {
				"en": "Tailored resume generator",
				"zh-CN": "定制简历"
			},
			"description": {
				"en": "Tailors a resume to a job description, highlighting the experience and skills that match.",
				"zh-CN": "根据职位描述突出相关经历与技能，生成有针对性的简历。"
			},
			"category": "productivity",
			"author": "Composio community",
			"homepage": "https://github.com/ComposioHQ/awesome-claude-skills/tree/master/tailored-resume-generator",
			"source": {
				"type": "github",
				"repo": "ComposioHQ/awesome-claude-skills",
				"ref": "master",
				"path": "tailored-resume-generator"
			}
		},
		{
			"name": "baoyu-slide-deck",
			"title": {
				"en": "Slide deck",
				"zh-CN": "幻灯片生成"
			},
			"description": {
				"en": "Turns content into a styled outline, then generates each slide as an image.",
				"zh-CN": "从内容生成带风格说明的大纲，再逐页生成幻灯片图片。"
			},
			"category": "content-creation",
			"author": "Jim Liu (宝玉)",
			"license": "MIT",
			"homepage": "https://github.com/JimLiu/baoyu-skills/tree/main/skills/baoyu-slide-deck",
			"source": {
				"type": "github",
				"repo": "JimLiu/baoyu-skills",
				"ref": "main",
				"path": "skills/baoyu-slide-deck"
			},
			"tags": ["featured"]
		},
		{
			"name": "baoyu-xhs-images",
			"title": {
				"en": "Social image cards",
				"zh-CN": "小红书图文"
			},
			"description": {
				"en": "Breaks content into 1–10 illustrated info cards with many styles, layouts and palettes, sized for social platforms.",
				"zh-CN": "把内容拆成 1–10 张卡通风格的信息卡片，多种风格、版式与配色可选，适合小红书等平台。"
			},
			"category": "content-creation",
			"author": "Jim Liu (宝玉)",
			"license": "MIT",
			"homepage": "https://github.com/JimLiu/baoyu-skills/tree/main/skills/baoyu-xhs-images",
			"source": {
				"type": "github",
				"repo": "JimLiu/baoyu-skills",
				"ref": "main",
				"path": "skills/baoyu-xhs-images"
			}
		},
		{
			"name": "baoyu-article-illustrator",
			"title": {
				"en": "Article illustrator",
				"zh-CN": "文章配图"
			},
			"description": {
				"en": "Finds where an article needs visuals and generates illustrations by type, style and palette.",
				"zh-CN": "分析文章结构，找出需要配图的位置，按类型、风格、配色三个维度生成插图。"
			},
			"category": "content-creation",
			"author": "Jim Liu (宝玉)",
			"license": "MIT",
			"homepage": "https://github.com/JimLiu/baoyu-skills/tree/main/skills/baoyu-article-illustrator",
			"source": {
				"type": "github",
				"repo": "JimLiu/baoyu-skills",
				"ref": "main",
				"path": "skills/baoyu-article-illustrator"
			}
		},
		{
			"name": "baoyu-cover-image",
			"title": {
				"en": "Cover image",
				"zh-CN": "文章封面"
			},
			"description": {
				"en": "Generates article covers with a choice of palette, rendering style, text and mood, in several aspect ratios.",
				"zh-CN": "为文章生成封面图，可选配色、渲染风格、文字与氛围，支持多种画幅。"
			},
			"category": "content-creation",
			"author": "Jim Liu (宝玉)",
			"license": "MIT",
			"homepage": "https://github.com/JimLiu/baoyu-skills/tree/main/skills/baoyu-cover-image",
			"source": {
				"type": "github",
				"repo": "JimLiu/baoyu-skills",
				"ref": "main",
				"path": "skills/baoyu-cover-image"
			}
		},
		{
			"name": "baoyu-infographic",
			"title": {
				"en": "Infographic",
				"zh-CN": "信息图"
			},
			"description": {
				"en": "Recommends a layout and style for your content and generates a publication-ready infographic.",
				"zh-CN": "分析内容并推荐版式与风格组合，生成可发布的信息图。"
			},
			"category": "content-creation",
			"author": "Jim Liu (宝玉)",
			"license": "MIT",
			"homepage": "https://github.com/JimLiu/baoyu-skills/tree/main/skills/baoyu-infographic",
			"source": {
				"type": "github",
				"repo": "JimLiu/baoyu-skills",
				"ref": "main",
				"path": "skills/baoyu-infographic"
			}
		},
		{
			"name": "baoyu-translate",
			"title": {
				"en": "Article translation",
				"zh-CN": "文章翻译"
			},
			"description": {
				"en": "Translates and polishes articles between Chinese and English, keeping formatting and terminology consistent.",
				"zh-CN": "中英文章翻译与精翻，保留格式与术语一致性。"
			},
			"category": "docs-writing",
			"author": "Jim Liu (宝玉)",
			"license": "MIT",
			"homepage": "https://github.com/JimLiu/baoyu-skills/tree/main/skills/baoyu-translate",
			"source": {
				"type": "github",
				"repo": "JimLiu/baoyu-skills",
				"ref": "main",
				"path": "skills/baoyu-translate"
			}
		},
		{
			"name": "vercel-deploy",
			"title": {
				"en": "Vercel deploy",
				"zh-CN": "Vercel 部署"
			},
			"description": {
				"en": "Deploys apps and sites to Vercel and returns the link.",
				"zh-CN": "把应用和网站部署到 Vercel，并返回访问链接。"
			},
			"category": "devops",
			"author": "OpenAI",
			"license": "MIT",
			"homepage": "https://github.com/openai/skills/tree/main/skills/.curated/vercel-deploy",
			"source": {
				"type": "github",
				"repo": "openai/skills",
				"ref": "main",
				"path": "skills/.curated/vercel-deploy"
			}
		},
		{
			"name": "netlify-deploy",
			"title": {
				"en": "Netlify deploy",
				"zh-CN": "Netlify 部署"
			},
			"description": {
				"en": "Deploys, hosts or links sites with the Netlify CLI, preview deploys included.",
				"zh-CN": "用 Netlify CLI 部署、托管或关联站点，包括预览部署。"
			},
			"category": "devops",
			"author": "OpenAI",
			"license": "Apache-2.0",
			"homepage": "https://github.com/openai/skills/tree/main/skills/.curated/netlify-deploy",
			"source": {
				"type": "github",
				"repo": "openai/skills",
				"ref": "main",
				"path": "skills/.curated/netlify-deploy"
			}
		},
		{
			"name": "cloudflare-deploy",
			"title": {
				"en": "Cloudflare deploy",
				"zh-CN": "Cloudflare 部署"
			},
			"description": {
				"en": "Deploys apps and infrastructure on Cloudflare Workers, Pages and related services.",
				"zh-CN": "用 Workers、Pages 等 Cloudflare 服务部署应用与基础设施。"
			},
			"category": "devops",
			"author": "OpenAI",
			"license": "Apache-2.0",
			"homepage": "https://github.com/openai/skills/tree/main/skills/.curated/cloudflare-deploy",
			"source": {
				"type": "github",
				"repo": "openai/skills",
				"ref": "main",
				"path": "skills/.curated/cloudflare-deploy"
			}
		},
		{
			"name": "render-deploy",
			"title": {
				"en": "Render deploy",
				"zh-CN": "Render 部署"
			},
			"description": {
				"en": "Analyzes a codebase, writes a render.yaml Blueprint and deploys it to Render.",
				"zh-CN": "分析代码库生成 render.yaml 蓝图，把应用部署到 Render。"
			},
			"category": "devops",
			"author": "OpenAI",
			"license": "Apache-2.0",
			"homepage": "https://github.com/openai/skills/tree/main/skills/.curated/render-deploy",
			"source": {
				"type": "github",
				"repo": "openai/skills",
				"ref": "main",
				"path": "skills/.curated/render-deploy"
			}
		},
		{
			"name": "gh-fix-ci",
			"title": {
				"en": "Fix CI",
				"zh-CN": "修复 CI"
			},
			"description": {
				"en": "Inspects failing GitHub Actions checks and logs with gh, explains the failure and drafts a fix.",
				"zh-CN": "用 gh 查看失败的 GitHub Actions 检查与日志，总结原因并起草修复。"
			},
			"category": "development",
			"author": "OpenAI",
			"license": "Apache-2.0",
			"homepage": "https://github.com/openai/skills/tree/main/skills/.curated/gh-fix-ci",
			"source": {
				"type": "github",
				"repo": "openai/skills",
				"ref": "main",
				"path": "skills/.curated/gh-fix-ci"
			}
		},
		{
			"name": "gh-address-comments",
			"title": {
				"en": "Address PR comments",
				"zh-CN": "处理 PR 评论"
			},
			"description": {
				"en": "Works through the review comments on the current branch's pull request.",
				"zh-CN": "逐条处理当前分支 PR 上的评审意见。"
			},
			"category": "development",
			"author": "OpenAI",
			"license": "Apache-2.0",
			"homepage": "https://github.com/openai/skills/tree/main/skills/.curated/gh-address-comments",
			"source": {
				"type": "github",
				"repo": "openai/skills",
				"ref": "main",
				"path": "skills/.curated/gh-address-comments"
			}
		},
		{
			"name": "playwright",
			"title": {
				"en": "Playwright",
				"zh-CN": "浏览器自动化"
			},
			"description": {
				"en": "Automates a real browser from the terminal: navigation, forms, screenshots, extraction and flow debugging.",
				"zh-CN": "在终端里自动操作真实浏览器：导航、填表、截图、抓取数据与调试流程。"
			},
			"category": "development",
			"author": "OpenAI",
			"license": "Apache-2.0",
			"homepage": "https://github.com/openai/skills/tree/main/skills/.curated/playwright",
			"source": {
				"type": "github",
				"repo": "openai/skills",
				"ref": "main",
				"path": "skills/.curated/playwright"
			}
		},
		{
			"name": "security-best-practices",
			"title": {
				"en": "Security best practices",
				"zh-CN": "安全最佳实践"
			},
			"description": {
				"en": "Reviews code against language- and framework-specific security practices and suggests fixes.",
				"zh-CN": "按语言和框架审查代码的安全实践并给出改进建议。"
			},
			"category": "development",
			"author": "OpenAI",
			"license": "Apache-2.0",
			"homepage": "https://github.com/openai/skills/tree/main/skills/.curated/security-best-practices",
			"source": {
				"type": "github",
				"repo": "openai/skills",
				"ref": "main",
				"path": "skills/.curated/security-best-practices"
			}
		},
		{
			"name": "jupyter-notebook",
			"title": {
				"en": "Jupyter notebook",
				"zh-CN": "Jupyter 笔记本"
			},
			"description": {
				"en": "Creates and edits Jupyter notebooks for experiments, explorations and tutorials.",
				"zh-CN": "为实验、探索或教程创建和编辑 Jupyter 笔记本。"
			},
			"category": "research-analysis",
			"author": "OpenAI",
			"license": "Apache-2.0",
			"homepage": "https://github.com/openai/skills/tree/main/skills/.curated/jupyter-notebook",
			"source": {
				"type": "github",
				"repo": "openai/skills",
				"ref": "main",
				"path": "skills/.curated/jupyter-notebook"
			}
		},
		{
			"name": "copywriting",
			"title": {
				"en": "Copywriting",
				"zh-CN": "营销文案"
			},
			"description": {
				"en": "Writes or rewrites marketing copy for home, landing, pricing and feature pages.",
				"zh-CN": "撰写或改写首页、落地页、定价页等营销文案。"
			},
			"category": "marketing",
			"author": "Corey Haines",
			"license": "MIT",
			"homepage": "https://github.com/coreyhaines31/marketingskills/tree/main/skills/copywriting",
			"source": {
				"type": "github",
				"repo": "coreyhaines31/marketingskills",
				"ref": "main",
				"path": "skills/copywriting"
			}
		},
		{
			"name": "seo-audit",
			"title": {
				"en": "SEO audit",
				"zh-CN": "SEO 审查"
			},
			"description": {
				"en": "Audits a site for technical SEO and ranking issues and lists fixes.",
				"zh-CN": "审查网站的技术 SEO 与排名问题，给出改进清单。"
			},
			"category": "marketing",
			"author": "Corey Haines",
			"license": "MIT",
			"homepage": "https://github.com/coreyhaines31/marketingskills/tree/main/skills/seo-audit",
			"source": {
				"type": "github",
				"repo": "coreyhaines31/marketingskills",
				"ref": "main",
				"path": "skills/seo-audit"
			}
		},
		{
			"name": "launch",
			"title": {
				"en": "Launch",
				"zh-CN": "产品发布"
			},
			"description": {
				"en": "Plans product launches, feature announcements and release timing.",
				"zh-CN": "规划产品发布、功能公告与上线节奏。"
			},
			"category": "marketing",
			"author": "Corey Haines",
			"license": "MIT",
			"homepage": "https://github.com/coreyhaines31/marketingskills/tree/main/skills/launch",
			"source": {
				"type": "github",
				"repo": "coreyhaines31/marketingskills",
				"ref": "main",
				"path": "skills/launch"
			}
		}
	]
};
//#endregion
//#region src/market.ts
const OFFICIAL_REGISTRY_ID = "official";
/** The official registry's newest copy; the package carries a snapshot for offline use. */
const OFFICIAL_REGISTRY_URL = "https://raw.githubusercontent.com/omdsh-dev/dsh-mnemon/main/plugins/dsh-mnemon-source-skills/market/official.json";
/** The open skills index searched as the user types. */
const SKILLS_SH_ID = "skills-sh";
const SKILLS_SH_URL = "https://skills.sh";
const MAX_REGISTRY_BYTES = 2097152;
const MAX_ENTRIES = 1e3;
const MAX_FILES = 300;
const MAX_FILE_BYTES = 4194304;
const MAX_SKILL_BYTES_TOTAL = 12582912;
/** A repository lists at most this many skills, each read once for its name and description. */
const MAX_REPOSITORY_SKILLS = 300;
const SEARCH_LIMIT = 30;
const TIMEOUT_MS = 2e4;
/** A repository's file tree is reused this long, between a preview and its install. */
const TREE_TTL_MS = 6e5;
const defaultFetcher = (url, init) => fetch(url, init);
function object(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function localizedText(value, maximum) {
	if (typeof value === "string") return value.trim() === "" ? void 0 : value.trim().slice(0, maximum);
	const fields = object(value);
	if (fields === void 0) return void 0;
	const en = typeof fields.en === "string" ? fields.en.trim().slice(0, maximum) : void 0;
	const zh = typeof fields["zh-CN"] === "string" ? fields["zh-CN"].trim().slice(0, maximum) : typeof fields.zh === "string" ? fields.zh.trim().slice(0, maximum) : void 0;
	if (!en && !zh) return void 0;
	return {
		...en ? { en } : {},
		...zh ? { "zh-CN": zh } : {}
	};
}
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const REF = /^[A-Za-z0-9_./-]{1,200}$/u;
function safeRelative(path) {
	const normalized = path.replace(/\\/gu, "/").replace(/^\/+|\/+$/gu, "");
	if (normalized.split("/").some((part) => part === ".." || part === "")) return normalized === "" ? "" : void 0;
	return normalized;
}
function source(value) {
	const fields = object(value);
	if (fields === void 0) return void 0;
	if (fields.type === "github" && typeof fields.repo === "string" && REPO.test(fields.repo) && typeof fields.path === "string") {
		const path = safeRelative(fields.path);
		const ref = typeof fields.ref === "string" && REF.test(fields.ref) ? fields.ref : void 0;
		return path === void 0 ? void 0 : {
			type: "github",
			repo: fields.repo,
			path,
			...ref === void 0 ? {} : { ref }
		};
	}
	if (fields.type === "url" && typeof fields.url === "string" && /^https?:\/\//u.test(fields.url)) return {
		type: "url",
		url: fields.url
	};
	if (fields.type === "path" && typeof fields.path === "string" && fields.path.trim() !== "") return {
		type: "path",
		path: fields.path.trim()
	};
}
/** Validate a registry file; entries that cannot be installed are left out, not fatal. */
function parseRegistry(value) {
	const fields = object(value);
	if (fields === void 0 || fields.version !== 1 || !Array.isArray(fields.skills)) throw new Error("a skill registry is a JSON object with \"version\": 1 and a \"skills\" array");
	const seen = /* @__PURE__ */ new Set();
	const skills = [];
	let skipped = 0;
	for (const raw of fields.skills.slice(0, MAX_ENTRIES)) {
		const entry = object(raw);
		const name = typeof entry?.name === "string" ? entry.name.trim() : "";
		const description = localizedText(entry?.description, 600);
		const from = source(entry?.source);
		if (entry === void 0 || !isSkillName(name) || description === void 0 || from === void 0 || seen.has(name)) {
			skipped++;
			continue;
		}
		seen.add(name);
		const title = localizedText(entry.title, 120);
		const text = (key, maximum) => typeof entry[key] === "string" && entry[key].trim() !== "" ? { [key]: entry[key].trim().slice(0, maximum) } : {};
		skills.push({
			name,
			description,
			source: from,
			...title === void 0 ? {} : { title },
			...text("category", 60),
			...text("author", 120),
			...text("license", 60),
			...text("version", 40),
			...typeof entry.homepage === "string" && /^https?:\/\//u.test(entry.homepage) ? { homepage: entry.homepage } : {},
			...Array.isArray(entry.tags) ? { tags: entry.tags.filter((tag) => typeof tag === "string").slice(0, 8).map((tag) => tag.slice(0, 40)) } : {}
		});
	}
	const name = localizedText(fields.name, 120) ?? "Skills";
	const description = localizedText(fields.description, 600);
	const categories = Array.isArray(fields.categories) ? fields.categories.flatMap((item) => {
		const category = object(item);
		const label = localizedText(category?.label, 60);
		return typeof category?.id === "string" && label !== void 0 ? [{
			id: category.id.slice(0, 60),
			label
		}] : [];
	}) : [];
	return {
		registry: {
			version: 1,
			name,
			skills,
			...typeof fields.id === "string" && /^[a-z0-9][a-z0-9-]{0,62}$/u.test(fields.id) ? { id: fields.id } : {},
			...description === void 0 ? {} : { description },
			...typeof fields.homepage === "string" && /^https?:\/\//u.test(fields.homepage) ? { homepage: fields.homepage } : {},
			...categories.length === 0 ? {} : { categories }
		},
		skipped
	};
}
/** The registry the package ships, so the market works offline and before any refresh. */
function bundledOfficialRegistry() {
	return parseRegistry(official_default).registry;
}
function signalWithTimeout(signal) {
	const timeout = AbortSignal.timeout(TIMEOUT_MS);
	return signal === void 0 ? timeout : AbortSignal.any([signal, timeout]);
}
function githubHeaders() {
	const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
	return {
		accept: "application/vnd.github+json",
		"user-agent": "dsh-mnemon",
		...token ? { authorization: `Bearer ${token}` } : {}
	};
}
async function request(fetcher, url, signal, headers) {
	try {
		return await fetcher(url, {
			signal: signalWithTimeout(signal),
			...headers === void 0 ? {} : { headers }
		});
	} catch (error) {
		if (signal?.aborted === true) throw error;
		throw new Error(`${new URL(url).host} could not be reached: ${error instanceof Error ? error.message : String(error)}`);
	}
}
async function fetchText(fetcher, url, signal, headers) {
	const response = await request(fetcher, url, signal, headers);
	if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`);
	const text = await response.text();
	if (Buffer.byteLength(text, "utf8") > MAX_REGISTRY_BYTES) throw new Error(`${url} is larger than ${MAX_REGISTRY_BYTES} bytes`);
	return text;
}
async function fetchBytes(fetcher, url, limit, signal) {
	const response = await request(fetcher, url, signal);
	if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`);
	const data = Buffer.from(await response.arrayBuffer());
	if (data.byteLength > limit) throw new Error(`${url} is larger than ${limit} bytes`);
	return data;
}
function parseJson(text, what) {
	try {
		return JSON.parse(text);
	} catch (error) {
		throw new Error(`${what} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
}
/** Read a JSON file from an http(s) URL or an absolute file path. */
async function loadJson(location, fetcher, signal) {
	let text;
	if (/^https?:\/\//u.test(location)) text = await fetchText(fetcher, location, signal);
	else {
		const path = location.startsWith("file://") ? fileURLToPath(location) : location;
		if (!isAbsolute(path)) throw new Error("a registry location is an http(s) URL or an absolute file path");
		if (statSync(path).size > MAX_REGISTRY_BYTES) throw new Error(`${path} is larger than ${MAX_REGISTRY_BYTES} bytes`);
		text = readFileSync(path, "utf8");
	}
	return parseJson(text, "the registry");
}
/** Read a registry from an http(s) URL or an absolute file path. */
async function loadRegistry(location, fetcher, signal) {
	return parseRegistry(await loadJson(location, fetcher, signal)).registry;
}
/** A stable id for a registry the user adds: its own id when it declares one, else a digest of where it lives. */
function registryId(location, declared, taken) {
	if (declared !== void 0 && declared !== "official" && declared !== "skills-sh" && !taken.has(declared)) return declared;
	return "registry-" + createHash("sha256").update(location).digest("hex").slice(0, 10);
}
function rawUrl(repo, ref, path) {
	return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(ref).replace(/%2F/gu, "/")}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
/** Trees per fetcher, so a preview and the install after it list a repository once. */
const trees = /* @__PURE__ */ new WeakMap();
/** A repository's whole file tree at a ref, from one GitHub API call. */
async function repositoryTree(fetcher, repo, ref, signal) {
	let cache = trees.get(fetcher);
	if (cache === void 0) trees.set(fetcher, cache = /* @__PURE__ */ new Map());
	const key = `${repo}@${ref}`;
	const cached = cache.get(key);
	if (cached !== void 0 && Date.now() - cached.at < TREE_TTL_MS) return cached;
	const response = await request(fetcher, `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, signal, githubHeaders());
	if (response.status === 403 || response.status === 429) throw new Error(`GitHub declined to list ${repo} for now (it allows 60 unauthenticated requests an hour); try again later, or set GITHUB_TOKEN`);
	if (response.status === 404) throw new Error(`GitHub has no repository ${repo} at ${ref}, or it is private`);
	if (!response.ok) throw new Error(`GitHub answered HTTP ${response.status} for ${repo}`);
	const fields = object(parseJson(await response.text(), `GitHub's tree of ${repo}`));
	if (!Array.isArray(fields?.tree)) throw new Error(`${repo} returned no file tree for ${ref}`);
	const tree = {
		tree: fields.tree.filter((entry) => typeof entry?.path === "string" && typeof entry.type === "string"),
		truncated: fields.truncated === true,
		at: Date.now()
	};
	if (cache.size >= 50) cache.delete(cache.keys().next().value);
	cache.set(key, tree);
	return tree;
}
async function githubTree(fetcher, repo, ref, prefix, signal) {
	const tree = await repositoryTree(fetcher, repo, ref, signal);
	const base = prefix === "" ? "" : prefix + "/";
	const files = tree.tree.filter((entry) => entry.type === "blob" && entry.path.startsWith(base));
	if (files.length === 0 && tree.truncated) throw new Error(`${repo} is too large to list; use a registry entry with a direct url`);
	return files;
}
/** Folders whose `SKILL.md` files are not skills to offer: dependencies, build output, test fixtures. */
const SKIPPED_FOLDERS = /* @__PURE__ */ new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	"fixtures",
	"__fixtures__",
	"test",
	"tests",
	"__tests__",
	"vendor"
]);
/** The `SKILL.md` files of a tree under a folder, nearest first. */
function skillDocuments(tree, prefix) {
	const base = prefix === "" ? "" : prefix + "/";
	return tree.filter((entry) => entry.type === "blob" && entry.path.startsWith(base) && (entry.path === base + "SKILL.md" || entry.path.endsWith("/SKILL.md"))).map((entry) => entry.path).filter((path) => {
		const parts = path.split("/");
		return parts.length <= 8 && !parts.slice(0, -1).some((part) => SKIPPED_FOLDERS.has(part));
	}).sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
}
function folderOf(path) {
	return path === "SKILL.md" ? "" : path.slice(0, -9);
}
/** The fields of a `SKILL.md` a market shows, or undefined when DSH could not load it under its name. */
function skillMeta(raw) {
	try {
		const split = splitFrontmatter(raw);
		const fields = object(split === void 0 ? void 0 : parse(split.frontmatter));
		const name = typeof fields?.name === "string" ? fields.name.trim() : "";
		const description = typeof fields?.description === "string" ? fields.description.trim() : "";
		if (!isSkillName(name) || description === "") return void 0;
		const license = typeof fields?.license === "string" && fields.license.trim() !== "" ? fields.license.trim().slice(0, 60) : void 0;
		return {
			name,
			description: description.slice(0, 1024),
			...license === void 0 ? {} : { license }
		};
	} catch {
		return;
	}
}
async function mapLimit(items, limit, run) {
	const results = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await run(items[index]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}
/**
* Every skill a GitHub repository (or one folder of it) holds: one API call
* for its tree, then each `SKILL.md` read raw for its name and description.
* A repository that is a plugin marketplace lends its name to the list.
*/
async function loadRepository(location, fetcher, signal) {
	const github = parseGithub(location);
	if (github === void 0) throw new Error("not a GitHub repository: " + location);
	const ref = github.ref ?? "HEAD";
	const tree = await repositoryTree(fetcher, github.repo, ref, signal);
	const documents = skillDocuments(tree.tree, github.path);
	if (documents.length === 0) throw new Error(tree.truncated ? `${github.repo} is too large to list whole; add the folder its skills are in` : `${github.repo} has no SKILL.md`);
	const read = await mapLimit(documents.slice(0, MAX_REPOSITORY_SKILLS), 8, async (path) => {
		try {
			return {
				path,
				meta: skillMeta(await fetchText(fetcher, rawUrl(github.repo, ref, path), signal))
			};
		} catch {
			return {
				path,
				meta: void 0
			};
		}
	});
	const owner = github.repo.split("/")[0];
	const seen = /* @__PURE__ */ new Set();
	const skills = [];
	for (const { path, meta } of read) {
		if (meta === void 0 || seen.has(meta.name)) continue;
		seen.add(meta.name);
		const folder = folderOf(path);
		skills.push({
			name: meta.name,
			description: meta.description.slice(0, 600),
			author: owner,
			source: {
				type: "github",
				repo: github.repo,
				path: folder,
				ref
			},
			homepage: githubUrl({
				repo: github.repo,
				ref,
				path: folder
			}),
			...meta.license === void 0 ? {} : { license: meta.license }
		});
	}
	if (skills.length === 0) throw new Error(`no SKILL.md in ${github.repo} would load in DSH`);
	let name = github.path === "" ? github.repo : `${github.repo}/${github.path}`;
	let description;
	if (github.path === "" && tree.tree.some((entry) => entry.path === ".claude-plugin/marketplace.json")) try {
		const marketplace = object(parseJson(await fetchText(fetcher, rawUrl(github.repo, ref, ".claude-plugin/marketplace.json"), signal), "the marketplace"));
		if (typeof marketplace?.name === "string" && marketplace.name.trim() !== "") name = `${marketplace.name.trim().slice(0, 80)} · ${github.repo}`;
		description = localizedText(marketplace?.description ?? object(marketplace?.metadata)?.description, 600);
	} catch {}
	return {
		version: 1,
		name,
		skills,
		homepage: githubUrl(github),
		...description === void 0 ? {} : { description }
	};
}
/**
* Where a site's Agent Skills index may live, nearest first: under the
* path given, then at the site's root, the current well-known name before
* the one it replaced. A URL that names an index is read as it is.
*/
function discoveryCandidates(location) {
	const url = new URL(location);
	if (url.pathname.endsWith("/index.json")) return [url.toString()];
	const scope = url.pathname.replace(/\/+$/u, "");
	const found = [];
	for (const folder of [".well-known/agent-skills", ".well-known/skills"]) {
		if (scope !== "") found.push(`${url.origin}${scope}/${folder}/index.json`);
		found.push(`${url.origin}/${folder}/index.json`);
	}
	return [...new Set(found)];
}
/**
* An Agent Skills discovery index: schema 0.2.0 (one artifact per skill,
* a `SKILL.md` or an archive, with its SHA-256 digest), or the earlier form
* that lists each skill's files. Entries that break the rules are dropped.
*/
function parseDiscovery(value, indexUrl) {
	const fields = object(value);
	if (fields === void 0 || !Array.isArray(fields.skills)) throw new Error("an Agent Skills index is a JSON object with a \"skills\" array");
	const schema = fields.$schema;
	if (schema !== void 0 && schema !== "https://schemas.agentskills.io/discovery/0.2.0/schema.json") throw new Error(`unsupported Agent Skills index schema: ${String(schema).slice(0, 120)}`);
	const index = new URL(indexUrl);
	const site = index.pathname.replace(/\/\.well-known\/(?:agent-skills|skills)\/index\.json$/u, "").replace(/\/+$/u, "");
	const owner = index.host.replace(/^www\./u, "");
	const seen = /* @__PURE__ */ new Set();
	const skills = [];
	for (const raw of fields.skills.slice(0, MAX_ENTRIES)) {
		const entry = object(raw);
		const name = typeof entry?.name === "string" ? entry.name : "";
		const description = typeof entry?.description === "string" ? entry.description.trim() : "";
		if (entry === void 0 || !isSkillName(name) || description === "" || seen.has(name)) continue;
		let from;
		if (schema !== void 0) {
			const format = entry.type === "skill-md" || entry.type === "archive" ? entry.type : void 0;
			const digest = typeof entry.digest === "string" && /^sha256:[0-9a-f]{64}$/u.test(entry.digest) ? entry.digest : void 0;
			let url;
			try {
				url = typeof entry.url === "string" ? new URL(entry.url, index) : void 0;
			} catch {
				url = void 0;
			}
			if (format !== void 0 && digest !== void 0 && url !== void 0 && /^https?:$/u.test(url.protocol)) from = {
				type: "artifact",
				url: url.toString(),
				format,
				digest
			};
		} else if (Array.isArray(entry.files)) {
			const files = entry.files.filter((file) => typeof file === "string").map((file) => safeRelative(file)).filter((file) => file !== void 0 && file !== "");
			if (files.includes("SKILL.md") && files.length <= MAX_FILES) from = {
				type: "files",
				base: new URL(`${name}/`, index).toString(),
				files
			};
		}
		if (from === void 0) continue;
		seen.add(name);
		skills.push({
			name,
			description: description.slice(0, 600),
			source: from,
			author: owner
		});
	}
	return {
		version: 1,
		name: index.host + site,
		homepage: index.origin + (site === "" ? "/" : site),
		skills
	};
}
/** A site's Agent Skills index, from the first place it is published. */
async function loadDiscovery(location, fetcher, signal) {
	let found;
	let reached = false;
	for (const index of discoveryCandidates(location)) {
		let response;
		try {
			response = await request(fetcher, index, signal);
		} catch (error) {
			if (signal?.aborted === true) throw error;
			continue;
		}
		reached = true;
		if (!response.ok) continue;
		let value;
		try {
			value = JSON.parse(await response.text());
		} catch {
			continue;
		}
		found = {
			index,
			value
		};
		break;
	}
	if (found === void 0) throw new Error(reached ? `${new URL(location).host} publishes no Agent Skills index at /.well-known/agent-skills/index.json` : `${new URL(location).host} could not be reached`);
	return parseDiscovery(found.value, found.index);
}
/** Whether a JSON file is a discovery index rather than a catalog, read by its shape. */
function isDiscoveryIndex(value) {
	const fields = object(value);
	if (fields === void 0 || !Array.isArray(fields.skills)) return false;
	if (typeof fields.$schema === "string") return true;
	const first = object(fields.skills[0]);
	return fields.version === void 0 && first !== void 0 && Array.isArray(first.files);
}
/** Whether a JSON file is a Claude Code plugin marketplace. */
function isPluginMarketplace(value) {
	const fields = object(value);
	return fields !== void 0 && Array.isArray(fields.plugins) && typeof fields.name === "string";
}
/** The GitHub repository a raw or blob URL of a marketplace file lives in. */
function marketplaceRepository(url) {
	const parsed = new URL(url);
	const parts = parsed.pathname.split("/").filter(Boolean);
	if (parsed.hostname === "raw.githubusercontent.com" && parts.length >= 3) return githubUrl({
		repo: `${parts[0]}/${parts[1]}`,
		ref: parts[2],
		path: ""
	});
	const github = parseGithub(url);
	return github === void 0 ? void 0 : githubUrl({
		repo: github.repo,
		...github.ref === void 0 ? {} : { ref: github.ref },
		path: ""
	});
}
function checkBudget(files) {
	if (files.length > MAX_FILES) throw new Error(`the skill has more than ${MAX_FILES} files`);
	if (files.reduce((sum, file) => sum + file.bytes, 0) > MAX_SKILL_BYTES_TOTAL) throw new Error(`the skill is larger than ${MAX_SKILL_BYTES_TOTAL} bytes`);
	if (files.some((file) => file.bytes > MAX_FILE_BYTES)) throw new Error(`a file of the skill is larger than ${MAX_FILE_BYTES} bytes`);
}
function localRoot(entry, registryLocation) {
	if (isAbsolute(entry.source.path)) return entry.source.path;
	if (/^https?:\/\//u.test(registryLocation)) throw new Error("a relative path source needs a registry that is a local file");
	return resolve(dirname(registryLocation.startsWith("file://") ? fileURLToPath(registryLocation) : registryLocation), entry.source.path);
}
function listLocal(root) {
	const info = statSync(root);
	if (info.isFile()) return [{
		path: "SKILL.md",
		bytes: info.size
	}];
	const found = [];
	const visit = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.name.startsWith(".") && entry.name !== ".well-known") continue;
			const full = join(directory, entry.name);
			if (entry.isDirectory()) visit(full);
			else if (entry.isFile()) found.push({
				path: relative(root, full).split(sep).join("/"),
				bytes: statSync(full).size
			});
			if (found.length > MAX_FILES) throw new Error(`the skill has more than ${MAX_FILES} files`);
		}
	};
	visit(root);
	return found;
}
/** A discovery artifact's files, after its bytes match the digest its index published. */
async function artifactFiles(entry, fetcher, signal) {
	const data = await fetchBytes(fetcher, entry.source.url, MAX_SKILL_BYTES_TOTAL, signal);
	if ("sha256:" + createHash("sha256").update(data).digest("hex") !== entry.source.digest) throw new Error(`${entry.source.url} does not match the digest its index published`);
	if (entry.source.format === "skill-md") return [{
		path: "SKILL.md",
		data
	}];
	return readArchive(data, {
		files: MAX_FILES,
		bytes: MAX_SKILL_BYTES_TOTAL
	});
}
function unresolved() {
	throw new Error("an indexed skill is resolved to its repository or site before it is read");
}
/** The file list of a market entry, without downloading it when its source can say. */
async function listSkillFiles(entry, registryLocation, fetcher, signal) {
	switch (entry.source.type) {
		case "url": return [{
			path: "SKILL.md",
			bytes: 0
		}];
		case "path": return listLocal(localRoot(entry, registryLocation));
		case "files": return entry.source.files.map((path) => ({
			path,
			bytes: 0
		}));
		case "artifact": return (await artifactFiles(entry, fetcher, signal)).map((file) => ({
			path: file.path,
			bytes: file.data.byteLength
		}));
		case "indexed": return unresolved();
		case "github": {
			const { repo, path } = entry.source;
			const prefix = path === "" ? "" : path + "/";
			return (await githubTree(fetcher, repo, entry.source.ref ?? "main", path, signal)).map((file) => ({
				path: file.path.slice(prefix.length),
				bytes: file.size ?? 0
			}));
		}
	}
}
/** The SKILL.md of a market entry, for a preview before installing. */
async function fetchSkillDocument(entry, registryLocation, fetcher, signal) {
	switch (entry.source.type) {
		case "url": return fetchText(fetcher, entry.source.url, signal);
		case "path": {
			const root = localRoot(entry, registryLocation);
			return readFileSync(statSync(root).isFile() ? root : join(root, "SKILL.md"), "utf8");
		}
		case "files": return fetchText(fetcher, new URL("SKILL.md", entry.source.base).toString(), signal);
		case "artifact": return (await artifactFiles(entry, fetcher, signal)).find((file) => file.path === "SKILL.md").data.toString("utf8");
		case "indexed": return unresolved();
		case "github": return fetchText(fetcher, rawUrl(entry.source.repo, entry.source.ref ?? "main", entry.source.path === "" ? "SKILL.md" : `${entry.source.path}/SKILL.md`), signal);
	}
}
/** Download every file of a market entry, bounded, with paths kept inside the skill folder. */
async function fetchSkillFiles(entry, registryLocation, fetcher, signal) {
	if (entry.source.type === "url") return [{
		path: "SKILL.md",
		data: Buffer.from(await fetchSkillDocument(entry, registryLocation, fetcher, signal), "utf8")
	}];
	if (entry.source.type === "indexed") return unresolved();
	if (entry.source.type === "artifact") {
		const files = await artifactFiles(entry, fetcher, signal);
		checkBudget(files.map((file) => ({ bytes: file.data.byteLength })));
		return files;
	}
	const listed = await listSkillFiles(entry, registryLocation, fetcher, signal);
	checkBudget(listed);
	const files = [];
	for (const file of listed) {
		const path = safeRelative(file.path);
		if (path === void 0 || path === "") throw new Error("a file of the skill escapes its folder: " + file.path);
		let data;
		if (entry.source.type === "path") {
			const root = localRoot(entry, registryLocation);
			data = readFileSync(statSync(root).isFile() ? root : join(root, ...path.split("/")));
		} else if (entry.source.type === "files") data = await fetchBytes(fetcher, new URL(path, entry.source.base).toString(), MAX_FILE_BYTES, signal);
		else {
			const { repo, ref = "main" } = entry.source;
			const response = await request(fetcher, rawUrl(repo, ref, entry.source.path === "" ? path : `${entry.source.path}/${path}`), signal);
			if (!response.ok) throw new Error(`${repo}/${path} answered HTTP ${response.status}`);
			data = Buffer.from(await response.arrayBuffer());
		}
		if (data.byteLength > MAX_FILE_BYTES) throw new Error(`${path} is larger than ${MAX_FILE_BYTES} bytes`);
		files.push({
			path,
			data
		});
	}
	checkBudget(files.map((file) => ({ bytes: file.data.byteLength })));
	if (!files.some((file) => file.path === "SKILL.md")) throw new Error("the skill has no SKILL.md at its top level");
	return files;
}
const INDEX_ID = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?\/[A-Za-z0-9_.-]+$/u;
/** The parts of an index id: `owner/repo/skill`, or `site/skill` for a site's own index. */
function indexedParts(id) {
	if (!INDEX_ID.test(id)) return void 0;
	const at = id.lastIndexOf("/");
	return {
		origin: id.slice(0, at),
		skill: id.slice(at + 1)
	};
}
/** Search skills.sh, the index the open `skills` CLI searches, newest installs first. */
async function searchSkillsSh(query, fetcher, signal) {
	const response = await request(fetcher, `${SKILLS_SH_URL}/api/search?${new URLSearchParams({
		q: query,
		limit: String(SEARCH_LIMIT)
	}).toString()}`, signal);
	if (response.status === 429) throw new Error("skills.sh is busy; try again in a moment");
	if (!response.ok) throw new Error(`skills.sh answered HTTP ${response.status}`);
	const fields = object(parseJson(await response.text(), "the skills.sh answer"));
	const found = [];
	for (const raw of Array.isArray(fields?.skills) ? fields.skills.slice(0, SEARCH_LIMIT) : []) {
		const entry = object(raw);
		const id = typeof entry?.id === "string" ? entry.id : "";
		const parts = indexedParts(id);
		if (parts === void 0) continue;
		const declared = typeof entry?.name === "string" ? entry.name.trim() : "";
		const name = isSkillName(declared) ? declared : isSkillName(parts.skill) ? parts.skill : void 0;
		if (name === void 0) continue;
		found.push({
			id,
			origin: parts.origin,
			skill: parts.skill,
			name,
			installs: typeof entry?.installs === "number" && Number.isFinite(entry.installs) ? Math.max(0, Math.round(entry.installs)) : 0
		});
	}
	return found.sort((a, b) => b.installs - a.installs);
}
/** What security reviewers said about a skill on skills.sh; none when it was not reviewed yet. */
async function skillsShAudits(id, fetcher, signal) {
	try {
		const response = await request(fetcher, `${SKILLS_SH_URL}/api/v1/skills/audit/${id.split("/").map(encodeURIComponent).join("/")}`, signal);
		if (!response.ok) return [];
		const fields = object(JSON.parse(await response.text()));
		return (Array.isArray(fields?.audits) ? fields.audits : []).slice(0, 6).flatMap((raw) => {
			const audit = object(raw);
			const status = audit?.status === "pass" || audit?.status === "warn" || audit?.status === "fail" ? audit.status : void 0;
			const provider = typeof audit?.provider === "string" ? audit.provider.slice(0, 80) : void 0;
			if (status === void 0 || provider === void 0) return [];
			return [{
				provider,
				status,
				...typeof audit?.summary === "string" && audit.summary.trim() !== "" ? { summary: audit.summary.trim().slice(0, 600) } : {},
				...typeof audit?.riskLevel === "string" ? { risk: audit.riskLevel.slice(0, 40) } : {}
			}];
		});
	} catch {
		return [];
	}
}
/** The text files skills.sh keeps of a skill: enough to read it, not always every file to install. */
async function skillsShSnapshot(id, fetcher, signal) {
	if (indexedParts(id) === void 0) throw new Error("not a skills.sh id: " + id);
	const response = await request(fetcher, `${SKILLS_SH_URL}/api/download/${id.split("/").map(encodeURIComponent).join("/")}`, signal);
	if (!response.ok) throw new Error(`skills.sh has no copy of ${id} (HTTP ${response.status})`);
	const fields = object(parseJson(await response.text(), "the skills.sh copy"));
	const files = (Array.isArray(fields?.files) ? fields.files : []).flatMap((raw) => {
		const file = object(raw);
		const path = typeof file?.path === "string" ? safeRelative(file.path) : void 0;
		return path === void 0 || path === "" || typeof file?.contents !== "string" ? [] : [{
			path,
			data: Buffer.from(file.contents, "utf8")
		}];
	});
	checkBudget(files.map((file) => ({ bytes: file.data.byteLength })));
	if (!files.some((file) => file.path === "SKILL.md")) throw new Error(`skills.sh's copy of ${id} has no SKILL.md`);
	return files;
}
/**
* Where an indexed skill's files live: the folder of its `SKILL.md` in its
* GitHub repository, found in the repository's tree by folder name and then
* by the name in its frontmatter; or its entry in its site's own index.
*/
async function resolveIndexed(skill, fetcher, signal) {
	const github = parseGithub(skill.origin);
	if (github === void 0) {
		const entry = (await loadDiscovery(`https://${skill.origin}`, fetcher, signal)).skills.find((candidate) => candidate.name === skill.name || candidate.name === skill.skill);
		if (entry === void 0) throw new Error(`${skill.origin} no longer publishes ${skill.name}`);
		return entry;
	}
	const ref = "HEAD";
	const documents = skillDocuments((await repositoryTree(fetcher, github.repo, ref, signal)).tree, "");
	const named = (path) => folderOf(path).split("/").at(-1);
	let path = documents.find((candidate) => named(candidate) === skill.skill) ?? documents.find((candidate) => named(candidate) === skill.name);
	if (path === void 0) {
		for (const candidate of documents.slice(0, 40)) if ((await fetchText(fetcher, rawUrl(github.repo, ref, candidate), signal).then(skillMeta, () => void 0))?.name === skill.name) {
			path = candidate;
			break;
		}
	}
	if (path === void 0) throw new Error(`${github.repo} no longer has a skill named ${skill.name}`);
	const folder = folderOf(path);
	return {
		name: skill.name,
		description: "",
		author: github.repo.split("/")[0],
		source: {
			type: "github",
			repo: github.repo,
			path: folder,
			ref
		},
		homepage: githubUrl({
			repo: github.repo,
			ref,
			path: folder
		})
	};
}
//#endregion
//#region src/service.ts
/** A run still `running` after this long outlived the Host that started it. */
const RUN_STALE_MS = 27e5;
function clip(value, maximum) {
	const text = value.trim();
	return text.length <= maximum ? text : text.slice(0, maximum - 1) + "…";
}
function writeFileAtomic(path, content) {
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.${process.pid}-${randomUUID()}.tmp`;
	try {
		writeFileSync(temporary, content);
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
}
/** Where a new skill goes when nothing says otherwise: the user's own DSH skills. */
const DEFAULT_ROOT = "user-dsh";
function staleRun(run, now) {
	return run.status === "running" && now - Date.parse(run.startedAt) > RUN_STALE_MS ? {
		...run,
		status: "interrupted"
	} : run;
}
/** A case that could not run says nothing about the skill, so only graded cases count. */
function runScore(results) {
	const graded = results.filter((result) => result.verdict !== "error");
	const errors = results.length - graded.length;
	if (graded.length === 0) return { errors };
	return {
		passRate: graded.filter((result) => result.verdict === "pass").length / graded.length,
		score: graded.reduce((sum, result) => sum + result.score, 0) / graded.length,
		errors
	};
}
/**
* Everything the Skills Source does, over its store and the DSH skill roots.
* Reads take no lock; every write runs under the storage lock and leaves the
* files consistent if it fails half way.
*/
var SkillsService = class {
	dataDir;
	roots;
	clock;
	fetcher;
	store;
	constructor(dataDir, roots = {}, clock = () => /* @__PURE__ */ new Date(), fetcher = defaultFetcher) {
		this.dataDir = dataDir;
		this.roots = roots;
		this.clock = clock;
		this.fetcher = fetcher;
		this.store = new SkillsStore(join(dataDir, "skills"));
	}
	options(workspace) {
		return {
			...this.roots,
			...workspace === void 0 ? {} : { workspace }
		};
	}
	write(operation) {
		return withMemoryStorageLock(this.store.directory, operation);
	}
	revision(workspace) {
		return "skills:" + sha256(`${this.store.fingerprint()}#${catalogFingerprint(this.options(workspace))}`).slice(0, 32);
	}
	catalog(workspace) {
		return readCatalog(this.options(workspace));
	}
	original(key, origin, legacyWorkspace) {
		if (key === void 0 || origin !== void 0 && !validOrigin(key, origin) || key.startsWith("project-") && origin === void 0 && legacyWorkspace === void 0) return { resolution: "origin-unavailable" };
		const catalog = this.catalog(origin?.workspace ?? legacyWorkspace);
		const skill = catalog.skills.find((candidate) => candidate.key === key && (origin === void 0 || resolve(candidate.path) === resolve(origin.path)));
		return skill === void 0 ? { resolution: "missing" } : {
			resolution: "available",
			skill,
			origin: skillOrigin(catalog, skill)
		};
	}
	suggestionOriginal(ledger, suggestion) {
		return this.original(suggestion.skillKey, suggestion.origin, suggestion.origin === void 0 ? legacySuggestionWorkspace(ledger, suggestion) : void 0);
	}
	draftOriginal(ledger, draft) {
		if (draft.origin !== void 0) return this.original(draft.baseKey, draft.origin);
		const suggestion = ledger.suggestions.find((candidate) => candidate.id === draft.suggestionId && candidate.skillKey === draft.baseKey);
		return suggestion === void 0 ? this.original(draft.baseKey, void 0) : this.suggestionOriginal(ledger, suggestion);
	}
	requireOriginal(original) {
		if (original.skill !== void 0) return original.skill;
		throw new Error(original.resolution === "origin-unavailable" ? "The original workspace was not recorded reliably. Open the skill in its original workspace and generate a new draft; the existing draft and evidence are kept." : "The original skill file was deleted, moved, or cannot be read. Restore it or open the skill at its new location and generate a new draft.");
	}
	catalogView(workspace) {
		const catalog = this.catalog(workspace);
		const ledger = this.store.ledger();
		const evals = this.store.evals();
		expireSuggestions(ledger, this.clock());
		const stats = {};
		for (const skill of catalog.skills) {
			if (stats[skill.name] !== void 0) continue;
			const loaded = activeSkill(catalog, skill.name);
			const last = evals.runs.find((run) => run.skillName === skill.name && run.status === "completed" && run.target.kind === "current" && run.target.hash === loaded?.hash);
			stats[skill.name] = {
				open: ledger.suggestions.filter((suggestion) => suggestion.skillName === skill.name && OPEN_STATUSES.has(suggestion.status)).length,
				cases: evals.cases.filter((entry) => entry.skillName === skill.name && entry.enabled).length,
				...last?.passRate === void 0 ? {} : { lastPassRate: last.passRate },
				...last?.score === void 0 ? {} : { lastScore: last.score },
				...last?.finishedAt === void 0 ? {} : { lastRunAt: last.finishedAt }
			};
		}
		return {
			...catalog,
			stats
		};
	}
	overview(workspace) {
		const now = this.clock();
		const ledger = this.store.ledger();
		const evals = this.store.evals();
		expireSuggestions(ledger, now);
		const catalog = this.catalog(workspace);
		const attention = [...ledger.suggestions.filter((suggestion) => suggestion.status === "pending").map((suggestion) => ({
			kind: "suggestion",
			id: suggestion.id,
			skillName: suggestion.skillName,
			title: suggestion.summary,
			at: suggestion.updatedAt
		})), ...ledger.drafts.filter((draft) => draft.status === "ready").map((draft) => ({
			kind: "draft",
			id: draft.id,
			skillName: draft.skillName,
			title: draft.notes || draft.skillName,
			at: draft.updatedAt
		}))];
		const finished = evals.runs.filter((run) => run.status === "completed" && run.target.kind === "current" && run.score !== void 0);
		for (const name of new Set(finished.map((run) => run.skillName))) {
			const [latest, previous] = finished.filter((run) => run.skillName === name);
			if (latest !== void 0 && previous !== void 0 && latest.score < previous.score - .05) attention.push({
				kind: "regression",
				id: latest.id,
				skillName: name,
				title: `${Math.round(previous.score * 100)} → ${Math.round(latest.score * 100)}`,
				at: latest.finishedAt ?? latest.startedAt
			});
		}
		attention.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
		return {
			counts: {
				skills: new Set(catalog.skills.map((skill) => skill.name)).size,
				pending: ledger.suggestions.filter((suggestion) => suggestion.status === "pending").length,
				drafting: ledger.suggestions.filter((suggestion) => suggestion.status === "drafting").length,
				drafts: ledger.drafts.filter((draft) => draft.status === "ready").length,
				trajectories: ledger.trajectories.length,
				cases: evals.cases.filter((entry) => entry.enabled).length,
				runsRunning: evals.runs.filter((run) => staleRun(run, now.getTime()).status === "running").length,
				trash: this.store.trashEntries().length
			},
			...ledger.reviews[0] === void 0 ? {} : { lastReviewAt: ledger.reviews[0].at },
			attention: attention.slice(0, 20),
			reviews: ledger.reviews.slice(0, 20)
		};
	}
	skill(workspace, key) {
		return {
			...readSkillDocument(findSkill(this.catalog(workspace), key)),
			versions: this.versions(key)
		};
	}
	versions(key) {
		return this.store.ledger().versions.filter((version) => version.skillKey === key);
	}
	version(key, id) {
		const version = this.versions(key).find((candidate) => candidate.id === id);
		if (version === void 0) throw new Error("version not found: " + id);
		return {
			version,
			content: this.store.versionContent(version)
		};
	}
	suggestions(statuses) {
		const ledger = this.store.ledger();
		expireSuggestions(ledger, this.clock());
		return ledger.suggestions.filter((suggestion) => statuses === void 0 || statuses.length === 0 || statuses.includes(suggestion.status)).map((suggestion) => ({
			...suggestion,
			triage: triageSuggestion(suggestion, ledger.trajectories)
		}));
	}
	suggestion(workspace, id) {
		const ledger = this.store.ledger();
		expireSuggestions(ledger, this.clock());
		const suggestion = ledger.suggestions.find((candidate) => candidate.id === id);
		if (suggestion === void 0) throw new Error("suggestion not found: " + id);
		const original = suggestion.action === "update" ? this.suggestionOriginal(ledger, suggestion) : void 0;
		const catalog = this.catalog(workspace);
		const skill = original === void 0 ? activeSkill(catalog, suggestion.skillName) : original.skill;
		const draft = suggestion.draftId === void 0 ? void 0 : ledger.drafts.find((candidate) => candidate.id === suggestion.draftId);
		const cited = new Set(suggestion.evidence.map((reference) => reference.trajectoryId));
		return {
			suggestion: {
				...suggestion,
				triage: triageSuggestion(suggestion, ledger.trajectories)
			},
			hashCurrent: suggestion.action === "create" ? skill === void 0 : skill !== void 0 && skill.hash === suggestion.skillFileHash,
			...original === void 0 ? {} : { resolution: original.resolution },
			...skill === void 0 ? {} : {
				skill: readSkillDocument(skill),
				skillInCatalog: catalog.skills.some((candidate) => candidate.key === skill.key && candidate.path === skill.path)
			},
			...draft === void 0 ? {} : { draft },
			trajectories: ledger.trajectories.filter((entry) => cited.has(entry.id))
		};
	}
	trajectories(filter = {}) {
		return this.store.ledger().trajectories.filter((entry) => (filter.skill === void 0 || entry.stats.skills.includes(filter.skill) || this.citesSkill(entry, filter.skill)) && (filter.signal === void 0 || entry.signals.includes(filter.signal)) && (filter.sessionId === void 0 || entry.sessionId === filter.sessionId));
	}
	citesSkill(entry, skill) {
		const ledger = this.store.ledger();
		return entry.suggestionIds.some((id) => ledger.suggestions.find((suggestion) => suggestion.id === id)?.skillName === skill);
	}
	trajectory(id) {
		return this.store.trajectory(id);
	}
	cases(skillName) {
		const cases = this.store.evals().cases;
		return skillName === void 0 ? cases : cases.filter((entry) => entry.skillName === skillName);
	}
	runs(skillName) {
		const now = this.clock().getTime();
		return this.store.evals().runs.filter((run) => skillName === void 0 || run.skillName === skillName).map((run) => staleRun(run, now));
	}
	run(id) {
		const run = this.store.evals().runs.find((candidate) => candidate.id === id);
		if (run === void 0) throw new Error("run not found: " + id);
		return staleRun(run, this.clock().getTime());
	}
	drafts(filter = {}) {
		const ledger = this.store.ledger();
		return ledger.drafts.filter((draft) => (filter.suggestionId === void 0 || draft.suggestionId === filter.suggestionId) && (filter.skill === void 0 || draft.skillName === filter.skill) && (filter.path === void 0 || this.draftOriginal(ledger, draft).skill?.path === filter.path));
	}
	draft(workspace, id) {
		const ledger = this.store.ledger();
		const draft = ledger.drafts.find((candidate) => candidate.id === id);
		if (draft === void 0) throw new Error("draft not found: " + id);
		const original = draft.action === "update" ? this.draftOriginal(ledger, draft) : void 0;
		const base = original?.skill;
		const conflict = draft.action === "update" ? base !== void 0 && base.hash !== draft.baseHash ? "base-changed" : void 0 : activeSkill(this.catalog(workspace), draft.skillName) !== void 0 ? "target-exists" : void 0;
		const now = this.clock().getTime();
		return {
			draft,
			...conflict === void 0 ? {} : { conflict },
			...original === void 0 ? {} : { resolution: original.resolution },
			...base === void 0 ? {} : { base: readSkillDocument(base) },
			runs: draft.runIds.flatMap((id) => {
				const run = this.store.evals().runs.find((candidate) => candidate.id === id);
				return run === void 0 ? [] : [staleRun(run, now)];
			})
		};
	}
	reviews(filter = {}) {
		const reviews = this.store.ledger().reviews;
		return (filter.sessionId === void 0 ? reviews : reviews.filter((review) => review.sessionId === filter.sessionId)).slice(0, Math.max(1, Math.min(200, filter.limit ?? 50)));
	}
	/** What a draft or a case derivation needs, gathered once. */
	evidencePack(workspace, input) {
		const ledger = this.store.ledger();
		const evals = this.store.evals();
		const catalog = this.catalog(workspace);
		const prior = input.draftId === void 0 ? void 0 : ledger.drafts.find((candidate) => candidate.id === input.draftId);
		if (input.draftId !== void 0 && prior === void 0) throw new Error("draft not found: " + input.draftId);
		if (prior !== void 0 && input.suggestionId !== void 0 && prior.suggestionId !== input.suggestionId) throw new Error("draft is for another suggestion");
		const suggestion = input.suggestionId === void 0 ? void 0 : ledger.suggestions.find((candidate) => candidate.id === input.suggestionId);
		if (input.suggestionId !== void 0 && suggestion === void 0) throw new Error("suggestion not found: " + input.suggestionId);
		const skillName = prior?.skillName ?? suggestion?.skillName ?? input.skill;
		if (skillName === void 0 || !isSkillName(skillName)) throw new Error("a skill name or a suggestion is required");
		const loaded = prior?.action === "update" ? this.requireOriginal(this.draftOriginal(ledger, prior)) : suggestion?.action === "update" ? this.requireOriginal(this.suggestionOriginal(ledger, suggestion)) : activeSkill(catalog, skillName);
		const action = loaded === void 0 ? "create" : "update";
		const references = suggestion?.evidence ?? ledger.trajectories.filter((entry) => entry.stats.skills.includes(skillName) || entry.suggestionIds.some((id) => ledger.suggestions.find((candidate) => candidate.id === id)?.skillName === skillName)).slice(0, 3).map((entry) => ({
			trajectoryId: entry.id,
			steps: []
		}));
		const excerpts = [];
		for (const reference of references.slice(-4)) {
			let trajectory;
			try {
				trajectory = this.store.trajectory(reference.trajectoryId);
			} catch {
				continue;
			}
			const wanted = new Set(reference.steps);
			const keep = wanted.size === 0 ? trajectory.steps : trajectory.steps.filter((step) => [...wanted].some((index) => Math.abs(index - step.index) <= 1));
			excerpts.push({
				trajectoryId: trajectory.id,
				...trajectory.sessionTitle === void 0 ? {} : { sessionTitle: trajectory.sessionTitle },
				steps: keep.slice(0, 60),
				annotations: trajectory.annotations.filter((annotation) => keep.some((step) => step.index === annotation.step))
			});
		}
		const cases = evals.cases.filter((entry) => entry.skillName === skillName && entry.enabled);
		const lastRun = loaded === void 0 ? void 0 : evals.runs.find((run) => run.skillName === skillName && run.status === "completed" && run.target.kind === "current" && run.target.hash === loaded.hash);
		return {
			skillName,
			action,
			...suggestion === void 0 ? {} : { suggestion },
			...loaded === void 0 ? {} : { skill: readSkillDocument(loaded) },
			excerpts,
			cases,
			...lastRun === void 0 ? {} : { lastRun },
			catalog: catalog.skills.filter((skill) => skill.shadowedBy === void 0).slice(0, 80).map((skill) => ({
				name: skill.name,
				description: clip(skill.description, 200),
				root: skill.root
			})),
			drafts: ledger.drafts.filter((draft) => draft.skillName === skillName && (loaded === void 0 ? draft.action === "create" : this.draftOriginal(ledger, draft).skill?.path === loaded.path)).slice(0, 3)
		};
	}
	/** Bump the ledger generation, so the revision moves with every write. */
	touch() {
		this.store.saveLedger(this.store.ledger());
	}
	recordVersion(ledger, skillKey, content, reason, previous, links = {}) {
		const now = this.clock();
		const existing = ledger.versions.filter((version) => version.skillKey === skillKey);
		const make = (body, why, extra, offset) => {
			const hash = sha256(body);
			const version = {
				id: `${(now.getTime() + offset).toString(36)}-${hash.slice(0, 8)}`,
				skillKey,
				hash,
				bytes: Buffer.byteLength(body, "utf8"),
				reason: why,
				createdAt: new Date(now.getTime() + offset).toISOString(),
				...extra
			};
			this.store.saveVersionContent(version, body);
			ledger.versions.unshift(version);
			return version;
		};
		if (existing.length === 0 && previous !== void 0 && sha256(previous) !== sha256(content)) make(previous, "original", {}, 0);
		const version = make(content, reason, links, 1);
		const forSkill = ledger.versions.filter((candidate) => candidate.skillKey === skillKey);
		if (forSkill.length > 30) {
			const removable = forSkill.filter((candidate) => candidate.reason !== "original").slice(29);
			for (const old of removable) this.store.deleteVersionContent(old);
			ledger.versions = ledger.versions.filter((candidate) => !removable.includes(candidate));
		}
		return version;
	}
	requireHash(skill, expectedHash) {
		const current = readFileSync(skill.path, "utf8");
		if (expectedHash === void 0 || sha256(current) !== expectedHash) throw new Error(`${skill.name} changed since it was read; reload it and try again`);
		return current;
	}
	createSkill(workspace, input) {
		return this.write(() => {
			if (!isSkillName(input.name)) throw new Error("a skill name uses lowercase letters, digits and single hyphens (max 64)");
			const catalog = this.catalog(workspace);
			const root = input.root ?? DEFAULT_ROOT;
			if (!SKILL_ROOT_KINDS.includes(root)) throw new Error("unknown skill root: " + root);
			requireWritableRoot(rootPath(catalog, root));
			const directory = join(rootPath(catalog, root), input.name);
			if (catalog.skills.some((skill) => skill.root === root && skill.name === input.name) || existsSync(directory) || existsSync(directory + ".md")) throw new Error(`${input.name} already exists in this root`);
			const content = input.content?.trim() ? input.content : skillTemplate(input.name, input.description);
			validateSkillContent(content, input.name);
			writeFileAtomic(join(directory, "SKILL.md"), content);
			const ledger = this.store.ledger();
			this.recordVersion(ledger, `${root}:${input.name}`, content, "create", void 0);
			this.store.saveLedger(ledger);
			return findSkill(this.catalog(workspace), `${root}:${input.name}`);
		});
	}
	saveSkill(workspace, input) {
		return this.write(() => {
			const skill = findSkill(this.catalog(workspace), input.key);
			const path = requireWritableSkill(skill, this.roots.allowLinkedUpdates);
			const previous = this.requireHash({
				...skill,
				path
			}, input.expectedHash);
			validateSkillContent(input.content, skill.name);
			writeFileAtomic(path, input.content);
			const ledger = this.store.ledger();
			this.recordVersion(ledger, skill.key, input.content, "edit", previous);
			this.store.saveLedger(ledger);
			return findSkill(this.catalog(workspace), skill.key);
		});
	}
	setInvocation(workspace, input) {
		return this.write(() => {
			const skill = findSkill(this.catalog(workspace), input.key);
			const path = requireWritableSkill(skill, this.roots.allowLinkedUpdates);
			const previous = this.requireHash({
				...skill,
				path
			}, input.expectedHash);
			const content = withInvocation(previous, {
				modelInvocable: input.modelInvocable,
				userInvocable: input.userInvocable
			});
			validateSkillContent(content, skill.name);
			writeFileAtomic(path, content);
			const ledger = this.store.ledger();
			this.recordVersion(ledger, skill.key, content, "invocation", previous);
			this.store.saveLedger(ledger);
			return findSkill(this.catalog(workspace), skill.key);
		});
	}
	deleteSkill(workspace, input) {
		return this.write(() => {
			const skill = findSkill(this.catalog(workspace), input.key);
			const previous = this.requireHash(skill, input.expectedHash);
			const ledger = this.store.ledger();
			if (ledger.versions.every((version) => version.skillKey !== skill.key)) this.recordVersion(ledger, skill.key, previous, "original", void 0);
			const path = skill.layout === "bundle" ? dirname(skill.path) : skill.path;
			const trashedTo = this.store.trash(path, skill.name, this.trashOrigin(skill, this.catalog(workspace)));
			const now = this.clock().toISOString();
			for (const suggestion of ledger.suggestions) if (suggestion.skillKey === skill.key && suggestion.action === "update" && OPEN_STATUSES.has(suggestion.status)) {
				suggestion.status = "invalidated";
				suggestion.updatedAt = now;
			}
			this.store.saveLedger(ledger);
			return { trashedTo };
		});
	}
	/** Skills removed and waiting in the Trash, newest first. */
	trashItems() {
		return this.store.trashEntries();
	}
	trashOrigin(skill, catalog) {
		return {
			root: skill.root,
			key: skill.key,
			originalPath: skill.layout === "bundle" ? dirname(skill.path) : skill.path,
			...skill.root.startsWith("project-") && catalog.projectRoot !== void 0 ? { workspace: catalog.projectRoot } : {}
		};
	}
	trashTarget(workspace, input) {
		const entry = this.store.trashEntry(input.id);
		const name = input.name ?? entry.name;
		if (!isSkillName(name)) throw new Error("a skill name uses lowercase letters, digits and single hyphens (max 64)");
		const selected = this.catalog(workspace);
		const root = input.root ?? entry.root;
		if (root !== void 0 && !SKILL_ROOT_KINDS.includes(root)) throw new Error("unknown skill root: " + root);
		if (root === void 0 || input.root === void 0 && root.startsWith("project-") && entry.workspace === void 0) return {
			entry,
			name,
			roots: selected.roots.map((item) => item.kind),
			destination: void 0
		};
		const catalog = input.root === void 0 && entry.workspace !== void 0 ? this.catalog(entry.workspace) : selected;
		const directory = rootPath(catalog, root);
		let path = join(directory, entry.kind === "file" ? `${name}.md` : name);
		if (input.root === void 0 && name === entry.name && entry.originalPath !== void 0) {
			if (!isAbsolute(entry.originalPath) || resolve(dirname(entry.originalPath)) !== resolve(directory)) throw new Error("the original skill root has changed; choose a restore location");
			path = entry.originalPath;
		}
		const conflict = catalog.skills.find((skill) => skill.root === root && skill.name === name);
		const occupied = [
			path,
			join(directory, name),
			join(directory, `${name}.md`)
		].filter(entryExists);
		const conflictPath = conflict === void 0 ? void 0 : conflict.layout === "bundle" ? dirname(conflict.path) : conflict.path;
		if (occupied.some((candidate) => candidate !== conflictPath)) throw new Error("the restore location already holds another file; choose a different name");
		return {
			entry,
			name,
			roots: selected.roots.map((item) => item.kind),
			destination: {
				root,
				path,
				catalog,
				conflict,
				conflictPath
			}
		};
	}
	previewTrashRestore(workspace, input) {
		const target = this.trashTarget(workspace, input);
		return {
			name: target.name,
			roots: target.roots,
			needsRoot: target.destination === void 0,
			...target.destination === void 0 ? {} : { path: target.destination.path },
			...target.destination?.conflict === void 0 ? {} : { conflict: { hash: target.destination.conflict.hash } }
		};
	}
	/** Restore to the recorded origin, or an explicitly selected root; replacement preserves its predecessor. */
	restoreTrash(workspace, input) {
		return this.write(() => {
			const { entry, name, destination } = this.trashTarget(workspace, input);
			if (destination === void 0) throw new Error("choose a root for this Trash entry; its original location is unknown");
			const { root, path, catalog, conflict, conflictPath } = destination;
			if (conflict !== void 0 && (input.replace !== true || input.expectedHash !== conflict.hash)) throw new Error(`${name} already exists in ${root}; rename it or confirm replacement of the current version`);
			let content;
			if (name !== entry.name) {
				content = setFrontmatterKey(this.store.trashContent(entry), "name", name);
				validateSkillContent(content, name);
			}
			let displaced;
			try {
				if (conflict !== void 0) displaced = this.store.trash(conflictPath, conflict.name, this.trashOrigin(conflict, catalog));
				this.store.restoreTrash(entry, path, content);
			} catch (error) {
				if (displaced !== void 0 && !existsSync(conflictPath)) try {
					renameSync(displaced, conflictPath);
				} catch {}
				throw error;
			}
			const key = `${root}:${name}`;
			const ledger = this.store.ledger();
			try {
				content ??= readFileSync(entry.kind === "file" ? path : join(path, "SKILL.md"), "utf8");
			} catch {}
			if (content !== void 0) this.recordVersion(ledger, key, content, "restore", void 0);
			this.store.saveLedger(ledger);
			return {
				key,
				path
			};
		});
	}
	/** Delete a Trash entry for good. */
	purgeTrash(input) {
		return this.write(() => {
			const entry = this.store.trashEntry(input.id);
			this.store.purgeTrash(entry);
			this.store.saveLedger(this.store.ledger());
			return { purged: entry.id };
		});
	}
	/** Delete everything waiting in the Trash for good, and say how much went. */
	emptyTrash() {
		return this.write(() => {
			const entries = this.store.trashEntries();
			for (const entry of entries) this.store.purgeTrash(entry);
			if (entries.length > 0) this.store.saveLedger(this.store.ledger());
			return { purged: entries.length };
		});
	}
	/** The model the user picked for drafts and backtests, if any. */
	draftPreferences() {
		const stored = this.store.preferences();
		return {
			...stored.draftModel === void 0 ? {} : { model: stored.draftModel },
			...stored.runModel === void 0 ? {} : { runModel: stored.runModel },
			suggestionModels: stored.suggestionModels,
			skillRunModels: stored.skillRunModels
		};
	}
	/**
	* Record one picker change. `suggestionId` targets a single suggestion,
	* `skillName` with `slot: 'run'` a single skill, and a null model clears the
	* entry so the page falls back to following the task Agent again.
	*/
	setDraftPreference(input) {
		return this.write(() => {
			const preferences = this.store.preferences();
			if (input.slot === "run") {
				if (input.skillName !== void 0) {
					if (input.model === null) delete preferences.skillRunModels[input.skillName];
					else preferences.skillRunModels[input.skillName] = input.model;
				} else if (input.model === null) delete preferences.runModel;
				else preferences.runModel = input.model;
			} else if (input.suggestionId !== void 0) {
				if (input.model === null) delete preferences.suggestionModels[input.suggestionId];
				else preferences.suggestionModels[input.suggestionId] = input.model;
			} else if (input.model === null) delete preferences.draftModel;
			else preferences.draftModel = input.model;
			this.store.savePreferences(preferences);
			return this.draftPreferences();
		});
	}
	restoreVersion(workspace, input) {
		return this.write(() => {
			const skill = findSkill(this.catalog(workspace), input.key);
			const path = requireWritableSkill(skill, this.roots.allowLinkedUpdates);
			const previous = this.requireHash({
				...skill,
				path
			}, input.expectedHash);
			const ledger = this.store.ledger();
			const version = ledger.versions.find((candidate) => candidate.skillKey === skill.key && candidate.id === input.versionId);
			if (version === void 0) throw new Error("version not found: " + input.versionId);
			const content = this.store.versionContent(version);
			validateSkillContent(content, skill.name);
			writeFileAtomic(path, content);
			this.recordVersion(ledger, skill.key, content, "restore", previous, { note: version.id });
			this.store.saveLedger(ledger);
			return findSkill(this.catalog(workspace), skill.key);
		});
	}
	withSuggestion(id, change) {
		return this.write(() => {
			const ledger = this.store.ledger();
			expireSuggestions(ledger, this.clock());
			const suggestion = ledger.suggestions.find((candidate) => candidate.id === id);
			if (suggestion === void 0) throw new Error("suggestion not found: " + id);
			const value = change(suggestion, ledger);
			suggestion.updatedAt = this.clock().toISOString();
			this.store.saveLedger(ledger);
			return value;
		});
	}
	dismissSuggestion(id) {
		return this.withSuggestion(id, (suggestion, ledger) => {
			if (!OPEN_STATUSES.has(suggestion.status)) throw new Error("this suggestion is already " + suggestion.status);
			if (suggestion.status === "drafting") throw new Error("a draft is being written for this suggestion; wait for it to finish");
			suggestion.status = "dismissed";
			for (const draft of ledger.drafts) if (draft.suggestionId === id && draft.status === "ready") {
				draft.status = "discarded";
				draft.updatedAt = suggestion.updatedAt;
			}
			return suggestion;
		});
	}
	/** Remove a suggestion for good, together with any draft it produced and its model pick. */
	deleteSuggestion(id) {
		return this.write(() => {
			const ledger = this.store.ledger();
			expireSuggestions(ledger, this.clock());
			const index = ledger.suggestions.findIndex((candidate) => candidate.id === id);
			if (index < 0) throw new Error("suggestion not found: " + id);
			if (ledger.suggestions[index].status === "drafting") throw new Error("a draft is being written for this suggestion; wait for it to finish");
			ledger.suggestions.splice(index, 1);
			ledger.drafts = ledger.drafts.filter((draft) => draft.suggestionId !== id);
			const preferences = this.store.preferences();
			if (preferences.suggestionModels[id] !== void 0) {
				delete preferences.suggestionModels[id];
				this.store.savePreferences(preferences);
			}
			this.store.saveLedger(ledger);
			return { deleted: id };
		});
	}
	/** The Host marks a suggestion `drafting` before a task Agent writes, and back to `pending` if it fails. */
	suggestionStatus(input) {
		return this.withSuggestion(input.id, (suggestion, ledger) => {
			input.signal?.throwIfAborted();
			this.requireExpectedDraft(ledger, suggestion, input.expectedDraft);
			if (input.status === "drafting") {
				if (suggestion.status !== "pending" && suggestion.status !== "review") throw new Error("this suggestion is " + suggestion.status + "; only an open suggestion can be drafted");
				suggestion.status = "drafting";
				delete suggestion.lastError;
			} else {
				if (suggestion.status !== "drafting") return suggestion;
				suggestion.status = suggestion.draftId === void 0 ? "pending" : "review";
				if (input.error !== void 0) suggestion.lastError = clip(input.error, 500);
			}
			return suggestion;
		});
	}
	requireExpectedDraft(ledger, suggestion, expected) {
		if (expected === void 0) return;
		const current = ledger.drafts.find((draft) => draft.id === suggestion?.draftId);
		if (!(expected === null ? suggestion !== void 0 && suggestion.draftId === void 0 : current?.id === expected.id && current.status === "ready" && sha256(current.content) === expected.hash)) throw new Error("The suggestion or draft changed while this draft was being generated; leave it for manual review");
	}
	recordAutoAdoption(id, input) {
		return this.withSuggestion(id, (suggestion, ledger) => {
			const event = {
				...input,
				...input.detail === void 0 ? {} : { detail: clip(input.detail, 500) },
				at: this.clock().toISOString()
			};
			suggestion.autoAdoption = [...suggestion.autoAdoption ?? [], event].slice(-16);
			const review = ledger.reviews.find((entry) => entry.id === suggestion.reviewId);
			if (review !== void 0) review.autoAdoptions = [...review.autoAdoptions ?? [], {
				...event,
				suggestionId: id,
				skillName: suggestion.skillName
			}].slice(-160);
			return suggestion;
		});
	}
	automaticIdentity(workspace, suggestion) {
		const target = suggestion.action === "update" ? this.requireOriginal(this.suggestionOriginal(this.store.ledger(), suggestion)).path : join(rootPath(this.catalog(workspace), suggestion.targetRoot ?? DEFAULT_ROOT), suggestion.skillName, "SKILL.md");
		return sha256(resolve(target));
	}
	budgetEntries(ledger) {
		const stored = this.store.autoAdoptionBudget();
		if (stored !== void 0) return retainedBudget(stored, this.clock());
		const entries = /* @__PURE__ */ new Map();
		for (const suggestion of ledger.suggestions) {
			const at = suggestion.autoAdoption?.find((event) => event.stage === "queued" || event.stage === "drafting" || event.stage === "adopted")?.at;
			if (at !== void 0) {
				let identity = "legacy:" + sha256(suggestion.skillName);
				try {
					identity = this.automaticIdentity(legacySuggestionWorkspace(ledger, suggestion), suggestion);
				} catch {}
				entries.set(suggestion.id, {
					id: randomUUID(),
					suggestionId: suggestion.id,
					identity,
					at
				});
			}
		}
		for (const review of ledger.reviews) for (const event of review.autoAdoptions ?? []) if (!entries.has(event.suggestionId) && [
			"queued",
			"drafting",
			"adopted"
		].includes(event.stage)) entries.set(event.suggestionId, {
			id: randomUUID(),
			suggestionId: event.suggestionId,
			identity: "legacy:" + sha256(event.skillName),
			at: event.at
		});
		return retainedBudget([...entries.values()], this.clock());
	}
	reserveBudget(ledger, suggestion, identity, limit, timeZone) {
		const entries = this.budgetEntries(ledger);
		const value = quota(entries, this.clock(), limit, timeZone);
		if (entries.some((entry) => inQuotaDay(entry, value) && (entry.suggestionId === suggestion.id || entry.identity === identity || entry.identity === "legacy:" + sha256(suggestion.skillName)))) {
			this.store.saveAutoAdoptionBudget(entries);
			return {
				...value,
				allowed: false,
				reason: "duplicate-skill"
			};
		}
		if (value.used >= value.limit) {
			this.store.saveAutoAdoptionBudget(entries);
			return {
				...value,
				allowed: false,
				reason: "daily-limit"
			};
		}
		const entry = {
			id: randomUUID(),
			suggestionId: suggestion.id,
			identity,
			at: this.clock().toISOString()
		};
		this.store.saveAutoAdoptionBudget([...entries, entry]);
		return {
			...value,
			used: value.used + 1,
			allowed: true,
			reservationId: entry.id
		};
	}
	reserveAutomatic(workspace, id, limit, timeZone) {
		return this.write(() => {
			const ledger = this.store.ledger();
			expireSuggestions(ledger, this.clock());
			const suggestion = ledger.suggestions.find((candidate) => candidate.id === id);
			if (suggestion?.status !== "pending" || suggestion.draftId !== void 0) throw new Error("Suggestion changed; automatic adoption requires manual review");
			return this.reserveBudget(ledger, suggestion, this.automaticIdentity(workspace, suggestion), limit, timeZone);
		});
	}
	pinTrajectory(id, pinned) {
		return this.write(() => {
			const ledger = this.store.ledger();
			const entry = ledger.trajectories.find((candidate) => candidate.id === id);
			if (entry === void 0) throw new Error("trajectory not found: " + id);
			entry.pinned = pinned;
			const trajectory = this.store.trajectory(id);
			this.store.saveTrajectory({
				...trajectory,
				pinned
			});
			this.store.saveLedger(ledger);
			return entry;
		});
	}
	deleteTrajectory(id) {
		return this.write(() => {
			const ledger = this.store.ledger();
			if (ledger.suggestions.filter((suggestion) => OPEN_STATUSES.has(suggestion.status) && suggestion.evidence.some((reference) => reference.trajectoryId === id)).length > 0) throw new Error("an open suggestion cites this trajectory; dismiss or finish it first");
			ledger.trajectories = ledger.trajectories.filter((candidate) => candidate.id !== id);
			this.store.deleteTrajectory(id);
			this.store.saveLedger(ledger);
			return { deleted: id };
		});
	}
	normalizeCase(input, existing, origin) {
		if (input.requiresVision !== void 0 && typeof input.requiresVision !== "boolean") throw new Error("requiresVision must be a boolean");
		if (!isSkillName(input.skillName)) throw new Error("a case belongs to a skill with a valid name");
		const title = clip(input.title, 120);
		const prompt = clip(input.prompt, 4e3);
		if (title === "" || prompt === "") throw new Error("a case needs a title and a task");
		const checks = input.checks.map((check) => ({
			id: check.id?.trim() || randomUUID(),
			text: clip(check.text, 300),
			must: check.must === true
		})).filter((check) => check.text !== "").slice(0, 8);
		if (checks.length === 0) throw new Error("a case needs at least one check");
		if (!checks.some((check) => check.must)) checks[0].must = true;
		const now = this.clock().toISOString();
		return {
			id: existing?.id ?? randomUUID(),
			skillName: input.skillName,
			title,
			prompt,
			...input.context === void 0 || input.context.trim() === "" ? {} : { context: clip(input.context, 4e3) },
			...(input.requiresVision ?? existing?.requiresVision) === true ? { requiresVision: true } : {},
			checks,
			origin: existing?.origin ?? origin,
			enabled: input.enabled ?? existing?.enabled ?? true,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now
		};
	}
	saveCase(input) {
		return this.write(() => {
			const evals = this.store.evals();
			const existing = input.id === void 0 ? void 0 : evals.cases.find((candidate) => candidate.id === input.id);
			if (input.id !== void 0 && existing === void 0) throw new Error("case not found: " + input.id);
			if (existing === void 0 && evals.cases.filter((entry) => entry.skillName === input.skillName).length >= 40) throw new Error(`a skill keeps at most 40 cases`);
			const entry = this.normalizeCase(input, existing, { kind: "manual" });
			evals.cases = existing === void 0 ? [entry, ...evals.cases] : evals.cases.map((candidate) => candidate.id === entry.id ? entry : candidate);
			this.store.saveEvals(evals);
			this.touch();
			return entry;
		});
	}
	deleteCase(id) {
		return this.write(() => {
			const evals = this.store.evals();
			if (!evals.cases.some((entry) => entry.id === id)) throw new Error("case not found: " + id);
			evals.cases = evals.cases.filter((entry) => entry.id !== id);
			this.store.saveEvals(evals);
			this.touch();
			return { deleted: id };
		});
	}
	/** Cases a task Agent derived from a trajectory; similar ones are skipped, not duplicated. */
	addCases(input) {
		return this.write(() => {
			const evals = this.store.evals();
			const added = [];
			let skipped = 0;
			for (const raw of input.cases) {
				const entry = this.normalizeCase({
					...raw,
					skillName: input.skillName
				}, void 0, {
					kind: "trajectory",
					...input.trajectoryId === void 0 ? {} : { trajectoryId: input.trajectoryId },
					...input.steps === void 0 ? {} : { steps: input.steps }
				});
				if (similarCase(evals.cases, entry.skillName, entry.title, entry.prompt) !== void 0 || evals.cases.filter((candidate) => candidate.skillName === entry.skillName).length >= 40) {
					skipped++;
					continue;
				}
				evals.cases.unshift(entry);
				added.push(entry);
			}
			this.store.saveEvals(evals);
			if (input.trajectoryId !== void 0 && added.length > 0) {
				const ledger = this.store.ledger();
				const summary = ledger.trajectories.find((candidate) => candidate.id === input.trajectoryId);
				if (summary !== void 0) {
					summary.caseIds = [...summary.caseIds, ...added.map((entry) => entry.id)];
					try {
						const trajectory = this.store.trajectory(input.trajectoryId);
						this.store.saveTrajectory({
							...trajectory,
							caseIds: summary.caseIds
						});
					} catch {}
				}
				this.store.saveLedger(ledger);
			} else this.touch();
			return {
				added,
				skipped
			};
		});
	}
	recordDraft(workspace, input) {
		return this.write(() => {
			input.signal?.throwIfAborted();
			validateSkillContent(input.content, input.skillName);
			const ledger = this.store.ledger();
			const catalog = this.catalog(workspace);
			const now = this.clock().toISOString();
			const prior = input.draftId === void 0 ? void 0 : ledger.drafts.find((candidate) => candidate.id === input.draftId);
			if (input.draftId !== void 0 && prior === void 0) throw new Error("draft not found: " + input.draftId);
			if (prior !== void 0 && (prior.skillName !== input.skillName || prior.suggestionId !== input.suggestionId)) throw new Error("draft is for another skill or suggestion");
			const suggestion = input.suggestionId === void 0 ? void 0 : ledger.suggestions.find((candidate) => candidate.id === input.suggestionId);
			if (input.suggestionId !== void 0 && suggestion === void 0) throw new Error("suggestion not found: " + input.suggestionId);
			if (suggestion !== void 0 && suggestion.skillName !== input.skillName) throw new Error("suggestion is for another skill");
			this.requireExpectedDraft(ledger, suggestion, input.expectedDraft);
			const original = prior?.action === "update" ? this.draftOriginal(ledger, prior) : suggestion?.action === "update" ? this.suggestionOriginal(ledger, suggestion) : void 0;
			const loaded = original === void 0 ? activeSkill(catalog, input.skillName) : this.requireOriginal(original);
			if (loaded !== void 0) requireWritableSkill(loaded, this.roots.allowLinkedUpdates);
			if (input.expectedBaseHash !== void 0 && (loaded?.hash ?? null) !== input.expectedBaseHash) throw new Error("The skill changed while this draft was being generated; regenerate it from the current file");
			const origin = loaded === void 0 ? void 0 : original?.origin ?? skillOrigin(catalog, loaded);
			for (const draft of ledger.drafts) if (draft.status === "ready" && draft.skillName === input.skillName && draft.suggestionId === input.suggestionId && (loaded === void 0 ? draft.action === "create" : this.draftOriginal(ledger, draft).skill?.path === loaded.path)) {
				draft.status = "discarded";
				draft.updatedAt = now;
			}
			const draft = {
				id: randomUUID(),
				...input.suggestionId === void 0 ? {} : { suggestionId: input.suggestionId },
				skillName: input.skillName,
				action: loaded === void 0 ? "create" : "update",
				...loaded === void 0 ? { targetRoot: input.targetRoot ?? suggestion?.targetRoot ?? DEFAULT_ROOT } : {
					baseKey: loaded.key,
					baseHash: loaded.hash,
					origin
				},
				content: input.content,
				notes: clip(input.notes, 2e3),
				changes: input.changes.map((change) => clip(change, 300)).filter(Boolean).slice(0, 12),
				guidance: input.guidance.map((text) => clip(text, 2e3)).filter(Boolean).slice(-8),
				status: "ready",
				runIds: [],
				createdAt: now,
				updatedAt: now
			};
			ledger.drafts.unshift(draft);
			if (suggestion !== void 0) {
				suggestion.status = "review";
				suggestion.draftId = draft.id;
				suggestion.updatedAt = now;
				delete suggestion.lastError;
			}
			this.store.saveLedger(ledger);
			return draft;
		});
	}
	updateDraft(input) {
		return this.write(() => {
			const ledger = this.store.ledger();
			const draft = ledger.drafts.find((candidate) => candidate.id === input.id);
			if (draft === void 0 || draft.status !== "ready") throw new Error("only a draft waiting for review can be edited");
			validateSkillContent(input.content, draft.skillName);
			draft.content = input.content;
			draft.updatedAt = this.clock().toISOString();
			this.store.saveLedger(ledger);
			return draft;
		});
	}
	/** Adopt a draft; a new skill goes to `root` when given, else where the draft was meant to go. */
	adoptDraft(workspace, id, input = {}) {
		return this.write(() => {
			const ledger = this.store.ledger();
			const draft = ledger.drafts.find((candidate) => candidate.id === id);
			if (draft === void 0 || draft.status !== "ready") throw new Error("only a draft waiting for review can be adopted");
			let automaticResult;
			if (input.automatic !== void 0) {
				const proof = input.automatic;
				const suggestion = ledger.suggestions.find((entry) => entry.id === draft.suggestionId);
				const evals = this.store.evals();
				const cases = evals.cases.filter((entry) => entry.skillName === draft.skillName && entry.enabled);
				const casesHash = sha256(skillCaseSignature(cases));
				const before = evals.runs.find((run) => run.id === proof.baselineRunId);
				const after = evals.runs.find((run) => run.id === proof.draftRunId);
				automaticResult = compareAutomaticSkillRuns(cases, before, after, casesHash);
				if (suggestion?.status !== "review" || suggestion.draftId !== draft.id || Date.parse(suggestion.expiresAt) <= this.clock().getTime() || proof.draftHash !== sha256(draft.content) || casesHash !== proof.casesHash || before?.skillName !== draft.skillName || after?.skillName !== draft.skillName || !(Date.parse(before.startedAt) >= Date.parse(draft.createdAt)) || !(Date.parse(after.startedAt) >= Date.parse(draft.createdAt)) || after.target.kind !== "draft" || after.target.draftId !== draft.id || after.target.hash !== proof.draftHash || (draft.action === "update" ? before.target.kind !== "current" || before.target.hash !== draft.baseHash : before.target.kind !== "none") || automaticResult.outcome !== "not-worse") throw new Error("The draft, cases, or complete matching backtest results changed; automatic adoption requires manual review");
			}
			if (input.automatic !== void 0) {
				const suggestion = ledger.suggestions.find((entry) => entry.id === draft.suggestionId);
				const identity = this.automaticIdentity(workspace, {
					...suggestion,
					targetRoot: input.root ?? draft.targetRoot ?? DEFAULT_ROOT
				});
				if (input.automatic.reservationId !== void 0) {
					const entry = this.budgetEntries(ledger).find((candidate) => candidate.id === input.automatic.reservationId);
					if (entry?.suggestionId !== suggestion.id || entry.identity !== identity) throw new Error("Automatic adoption reservation changed; manual review required");
				} else {
					const entries = this.budgetEntries(ledger);
					const value = quota(entries, this.clock(), 2, "local");
					const migrated = entries.find((entry) => entry.suggestionId === suggestion.id && inQuotaDay(entry, value));
					const reserved = migrated !== void 0 && value.used <= value.limit ? { allowed: true } : this.reserveBudget(ledger, suggestion, identity, 2, "local");
					if (migrated !== void 0 && reserved.allowed) this.store.saveAutoAdoptionBudget(entries);
					if (!reserved.allowed) throw new Error("Automatic adoption daily budget requires manual review");
				}
			}
			input.signal?.throwIfAborted();
			validateSkillContent(draft.content, draft.skillName);
			const catalog = this.catalog(workspace);
			let key;
			let previous;
			let updated;
			if (draft.action === "update") {
				const original = this.draftOriginal(ledger, draft);
				const base = this.requireOriginal(original);
				const path = requireWritableSkill(base, this.roots.allowLinkedUpdates);
				previous = this.requireHash({
					...base,
					path
				}, draft.baseHash);
				writeFileAtomic(path, draft.content);
				key = base.key;
				updated = findSkill(this.catalog(original.origin?.workspace), key);
			} else {
				const root = input.root ?? draft.targetRoot ?? DEFAULT_ROOT;
				if (activeSkill(catalog, draft.skillName) !== void 0) throw new Error(`${draft.skillName} exists now; draft it again as an update`);
				const target = rootPath(catalog, root);
				requireWritableRoot(target);
				if (root.startsWith("project-")) try {
					if (catalog.projectRoot === void 0 || !statSync(catalog.projectRoot).isDirectory()) throw new Error("not a directory");
				} catch {
					throw new Error("The selected workspace project is unavailable; select an existing workspace or explicitly choose a user skill root.");
				}
				const directory = join(target, draft.skillName);
				if (existsSync(directory) || existsSync(directory + ".md")) throw new Error(`${draft.skillName} already exists in this root`);
				writeFileAtomic(join(directory, "SKILL.md"), draft.content);
				key = `${root}:${draft.skillName}`;
			}
			const now = this.clock().toISOString();
			const version = this.recordVersion(ledger, key, draft.content, "evolution", previous, {
				draftId: draft.id,
				...draft.suggestionId === void 0 ? {} : { suggestionId: draft.suggestionId }
			});
			draft.status = "adopted";
			draft.updatedAt = now;
			const suggestion = draft.suggestionId === void 0 ? void 0 : ledger.suggestions.find((candidate) => candidate.id === draft.suggestionId);
			if (suggestion !== void 0) {
				suggestion.status = "adopted";
				suggestion.updatedAt = now;
				if (input.automatic !== void 0 && automaticResult !== void 0) {
					const event = {
						at: now,
						stage: "adopted",
						attempt: input.automatic.attempt,
						...automaticResult.baselineScore === void 0 ? {} : { baselineScore: automaticResult.baselineScore },
						...automaticResult.draftScore === void 0 ? {} : { draftScore: automaticResult.draftScore }
					};
					suggestion.autoAdoption = [...suggestion.autoAdoption ?? [], event].slice(-16);
					const review = ledger.reviews.find((entry) => entry.id === suggestion.reviewId);
					if (review !== void 0) review.autoAdoptions = [...review.autoAdoptions ?? [], {
						...event,
						suggestionId: suggestion.id,
						skillName: suggestion.skillName
					}].slice(-160);
				}
			}
			this.store.saveLedger(ledger);
			return {
				skill: updated ?? findSkill(this.catalog(workspace), key),
				version
			};
		});
	}
	discardDraft(id) {
		return this.write(() => {
			const ledger = this.store.ledger();
			const draft = ledger.drafts.find((candidate) => candidate.id === id);
			if (draft === void 0 || draft.status !== "ready") throw new Error("only a draft waiting for review can be discarded");
			const now = this.clock().toISOString();
			draft.status = "discarded";
			draft.updatedAt = now;
			const suggestion = draft.suggestionId === void 0 ? void 0 : ledger.suggestions.find((candidate) => candidate.id === draft.suggestionId);
			if (suggestion !== void 0 && suggestion.status === "review") {
				suggestion.status = "pending";
				delete suggestion.draftId;
				suggestion.updatedAt = now;
			}
			this.store.saveLedger(ledger);
			return draft;
		});
	}
	/** Remove a draft for good; its suggestion goes back to `pending` so it can be drafted again. */
	deleteDraft(id) {
		return this.write(() => {
			const ledger = this.store.ledger();
			const index = ledger.drafts.findIndex((candidate) => candidate.id === id);
			if (index < 0) throw new Error("draft not found: " + id);
			const draft = ledger.drafts[index];
			ledger.drafts.splice(index, 1);
			if (draft.suggestionId !== void 0) {
				const suggestion = ledger.suggestions.find((candidate) => candidate.id === draft.suggestionId);
				if (suggestion?.draftId === draft.id) {
					delete suggestion.draftId;
					if (suggestion.status === "review") suggestion.status = "pending";
					suggestion.updatedAt = this.clock().toISOString();
				}
			}
			this.store.saveLedger(ledger);
			return { deleted: id };
		});
	}
	/**
	* Put suggestions whose draft write died with the previous Host back to
	* `pending`, so the page stops showing them as "drafting" forever.
	*/
	reclaimOrphanDrafts() {
		return this.write(() => {
			const ledger = this.store.ledger();
			const before = ledger.suggestions.filter((suggestion) => suggestion.status === "drafting").length;
			if (!expireSuggestions(ledger, this.clock())) return { reclaimed: 0 };
			this.store.saveLedger(ledger);
			const after = ledger.suggestions.filter((suggestion) => suggestion.status === "drafting").length;
			return { reclaimed: Math.max(0, before - after) };
		});
	}
	/** Persist terminal state so expired tasks cannot later revive themselves. */
	reclaimStaleRuns() {
		return this.write(() => {
			const evals = this.store.evals();
			const now = this.clock();
			let reclaimed = 0;
			for (const run of evals.runs) {
				if (run.status !== "running" || Number.isFinite(Date.parse(run.startedAt)) && now.getTime() - Date.parse(run.startedAt) <= RUN_STALE_MS) continue;
				run.status = "interrupted";
				run.finishedAt = now.toISOString();
				run.error = "Backtest exceeded its 45 minute deadline; run it again.";
				reclaimed++;
			}
			if (reclaimed > 0) {
				this.store.saveEvals(evals);
				this.touch();
			}
			return { reclaimed };
		});
	}
	/** The content a run tests, resolved from its target. */
	targetContent(workspace, skillName, target) {
		if (target.kind === "none") return { target: { kind: "none" } };
		if (target.kind === "draft") {
			const draft = this.store.ledger().drafts.find((candidate) => candidate.id === target.draftId);
			if (draft === void 0 || draft.skillName !== skillName) throw new Error("draft not found for this skill");
			return {
				content: draft.content,
				target: {
					kind: "draft",
					draftId: draft.id,
					hash: sha256(draft.content)
				}
			};
		}
		if (target.kind === "version") {
			const version = this.store.ledger().versions.find((candidate) => candidate.id === target.versionId);
			if (version === void 0) throw new Error("version not found: " + target.versionId);
			return {
				content: this.store.versionContent(version),
				target: {
					kind: "version",
					versionId: version.id,
					skillKey: version.skillKey,
					hash: version.hash
				}
			};
		}
		const draft = target.draftId === void 0 ? void 0 : this.store.ledger().drafts.find((candidate) => candidate.id === target.draftId && candidate.skillName === skillName);
		if (target.draftId !== void 0 && draft === void 0) throw new Error("draft not found for this skill");
		const loaded = draft === void 0 ? activeSkill(this.catalog(workspace), skillName) : this.requireOriginal(this.draftOriginal(this.store.ledger(), draft));
		if (loaded === void 0) throw new Error(`${skillName} has no file to test; test a draft or no skill`);
		const document = readSkillDocument(loaded);
		return {
			content: document.content,
			target: {
				kind: "current",
				skillKey: loaded.key,
				hash: document.hash,
				...draft === void 0 ? {} : { draftId: draft.id }
			}
		};
	}
	startRun(input) {
		return this.write(() => {
			input.signal?.throwIfAborted();
			const evals = this.store.evals();
			const cases = input.caseIds.map((id) => evals.cases.find((entry) => entry.id === id && entry.skillName === input.skillName));
			if (cases.length === 0 || cases.some((entry) => entry === void 0)) throw new Error("a run needs at least one case of this skill");
			const casesHash = sha256(skillCaseSignature(cases));
			if (input.expectedCasesHash !== void 0 && input.expectedCasesHash !== casesHash) throw new Error("Eval cases changed before this backtest started");
			const run = {
				id: randomUUID(),
				skillName: input.skillName,
				target: input.target,
				status: "running",
				progress: {
					done: 0,
					total: cases.length
				},
				caseIds: input.caseIds,
				casesHash,
				...input.model === void 0 ? {} : { model: input.model },
				results: [],
				startedAt: this.clock().toISOString()
			};
			evals.runs.unshift(run);
			this.store.saveEvals(evals);
			if (input.target.draftId !== void 0) {
				const ledger = this.store.ledger();
				const draft = ledger.drafts.find((candidate) => candidate.id === input.target.draftId);
				if (draft !== void 0) draft.runIds = [...draft.runIds, run.id].slice(-12);
				this.store.saveLedger(ledger);
			} else this.touch();
			return run;
		});
	}
	/** Attach a baseline run to the draft it is compared with. */
	linkRun(draftId, runId) {
		return this.write(() => {
			const ledger = this.store.ledger();
			const draft = ledger.drafts.find((candidate) => candidate.id === draftId);
			if (draft === void 0) throw new Error("draft not found: " + draftId);
			if (!draft.runIds.includes(runId)) draft.runIds = [...draft.runIds, runId].slice(-12);
			this.store.saveLedger(ledger);
		});
	}
	progressRun(input) {
		return this.write(() => {
			input.signal?.throwIfAborted();
			const evals = this.store.evals();
			const run = evals.runs.find((candidate) => candidate.id === input.id);
			if (run === void 0 || run.status !== "running") throw new Error("run is not running: " + input.id);
			const result = {
				...input.result,
				steps: input.result.steps.map((step) => clip(step, 400)).slice(0, 20),
				answer: clip(input.result.answer, 2e3),
				checks: input.result.checks.map((check) => ({
					...check,
					note: clip(check.note, 300)
				})),
				...input.result.summary === void 0 ? {} : { summary: clip(input.result.summary, 500) },
				...input.result.error === void 0 ? {} : { error: clip(input.result.error, 500) }
			};
			run.results = [...run.results.filter((existing) => existing.caseId !== result.caseId), result];
			run.progress = {
				done: run.results.length,
				total: run.progress.total
			};
			this.store.saveEvals(evals);
			this.touch();
			return run;
		});
	}
	finishRun(input) {
		return this.write(() => {
			input.signal?.throwIfAborted();
			const evals = this.store.evals();
			const run = evals.runs.find((candidate) => candidate.id === input.id);
			if (run === void 0) throw new Error("run not found: " + input.id);
			if (run.status !== "running") return run;
			run.status = input.status;
			run.finishedAt = this.clock().toISOString();
			if (input.error !== void 0) run.error = clip(input.error, 500);
			if (run.results.length > 0) {
				const { passRate, score, errors } = runScore(run.results);
				delete run.passRate;
				delete run.score;
				Object.assign(run, passRate === void 0 ? {} : { passRate }, score === void 0 ? {} : { score }, errors > 0 ? { errors } : {});
			}
			this.store.saveEvals(evals);
			this.touch();
			return run;
		});
	}
	recordReview(workspace, input) {
		return this.write(() => {
			const ledger = this.store.ledger();
			const evals = this.store.evals();
			const { result, trajectory, removedTrajectories } = admitReview({
				ledger,
				evals,
				policy: policyFrom(input.policy),
				catalog: this.catalog(workspace),
				now: this.clock(),
				id: randomUUID
			}, input);
			this.store.saveTrajectory(trajectory);
			for (const id of removedTrajectories) this.store.deleteTrajectory(id);
			this.store.saveEvals(evals);
			this.store.saveLedger(ledger);
			return result;
		});
	}
	trajectorySummary(trajectory) {
		return trajectorySummary(trajectory);
	}
	/** The sources this Source knows: the built-in catalog and search index first, then the ones added. */
	registryRecords() {
		const stored = this.store.registries();
		const enabled = (id) => stored.find((record) => record.id === id)?.enabled ?? true;
		return [
			{
				id: OFFICIAL_REGISTRY_ID,
				kind: "catalog",
				location: OFFICIAL_REGISTRY_URL,
				builtin: true,
				enabled: enabled(OFFICIAL_REGISTRY_ID)
			},
			{
				id: SKILLS_SH_ID,
				kind: "search",
				location: SKILLS_SH_URL,
				builtin: true,
				enabled: enabled(SKILLS_SH_ID)
			},
			...stored.filter((record) => record.id !== "official" && record.id !== "skills-sh").map((record) => ({
				...record,
				kind: record.kind ?? "catalog",
				builtin: false
			}))
		];
	}
	/** The newest copy of a registry: its cache, or the packaged snapshot for the official one. */
	registryFile(record) {
		const cache = this.store.registryCache(record.id);
		if (cache?.registry !== void 0) return cache;
		if (record.id === "official") return {
			registry: bundledOfficialRegistry(),
			...cache?.error === void 0 ? {} : { error: cache.error }
		};
		return cache ?? {};
	}
	/** A listed source's skills as it publishes them now. */
	loadSource(kind, location, signal) {
		switch (kind) {
			case "catalog": return loadRegistry(location, this.fetcher, signal);
			case "well-known": return loadDiscovery(location, this.fetcher, signal);
			case "github": return loadRepository(location, this.fetcher, signal);
			case "search": return Promise.reject(/* @__PURE__ */ new Error("a search source is searched, not listed"));
		}
	}
	/** The state of a market skill against what is loaded now and where it was installed from. */
	installState(catalog, installs, registry, name, version, sameOrigin) {
		const skill = activeSkill(catalog, name);
		if (skill === void 0) return { state: "available" };
		const install = installs.find((candidate) => candidate.skillKey === skill.key);
		const fromHere = install !== void 0 && install.name === name && (install.registryId === registry || sameOrigin?.(install) === true);
		return {
			state: !fromHere ? "conflict" : skill.hash !== install.hash ? "modified" : version !== void 0 && install.version !== void 0 && version !== install.version ? "update" : "installed",
			skillKey: skill.key,
			...fromHere && install.version !== void 0 ? { installedVersion: install.version } : {}
		};
	}
	marketView(workspace) {
		const now = this.clock().getTime();
		const catalog = this.catalog(workspace);
		const installs = this.store.ledger().installs;
		const registries = [];
		const items = [];
		const categories = /* @__PURE__ */ new Map();
		const stale = [];
		for (const record of this.registryRecords()) {
			const file = record.kind === "search" ? {} : this.registryFile(record);
			registries.push({
				id: record.id,
				kind: record.kind,
				location: record.location,
				builtin: record.builtin,
				enabled: record.enabled,
				entries: file.registry?.skills.length ?? 0,
				...file.registry?.name === void 0 ? {} : { name: file.registry.name },
				...file.registry?.description === void 0 ? {} : { description: file.registry.description },
				...file.registry?.homepage === void 0 ? {} : { homepage: file.registry.homepage },
				...file.fetchedAt === void 0 ? {} : { fetchedAt: file.fetchedAt },
				...file.error === void 0 || record.builtin && file.fetchedAt === void 0 ? {} : { error: file.error }
			});
			if (!record.enabled || record.kind === "search") continue;
			if (file.fetchedAt === void 0 || now - Date.parse(file.fetchedAt) > 216e5) stale.push(record.id);
			for (const category of file.registry?.categories ?? []) if (!categories.has(category.id)) categories.set(category.id, category);
			for (const entry of file.registry?.skills ?? []) items.push({
				...entry,
				registryId: record.id,
				...this.installState(catalog, installs, record.id, entry.name, entry.version)
			});
		}
		return {
			registries,
			categories: [...categories.values()],
			items,
			stale
		};
	}
	/**
	* Search the search sources. Each result says whether it is installed; one
	* installed from a catalog out of the same repository counts as installed.
	*/
	async searchMarket(workspace, query, signal) {
		const text = query.trim().slice(0, 200);
		const index = this.registryRecords().find((record) => record.id === SKILLS_SH_ID);
		if (text.length < 2 || !index.enabled) return {
			query: text,
			items: []
		};
		let found;
		try {
			found = await searchSkillsSh(text, this.fetcher, signal);
		} catch (error) {
			if (signal?.aborted === true) throw error;
			return {
				query: text,
				items: [],
				error: error instanceof Error ? error.message : String(error)
			};
		}
		const catalog = this.catalog(workspace);
		const installs = this.store.ledger().installs;
		return {
			query: text,
			items: found.map((skill) => ({
				name: skill.name,
				description: "",
				source: {
					type: "indexed",
					id: skill.id
				},
				origin: skill.origin,
				installs: skill.installs,
				author: skill.origin.split("/")[0],
				registryId: SKILLS_SH_ID,
				...this.installState(catalog, installs, SKILLS_SH_ID, skill.name, void 0, (install) => install.source.type === "github" && install.source.repo === skill.origin)
			}))
		};
	}
	entry(registry, name) {
		const record = this.registryRecords().find((candidate) => candidate.id === registry);
		if (record === void 0) throw new Error("unknown skill registry: " + registry);
		const entry = this.registryFile(record).registry?.skills.find((candidate) => candidate.name === name);
		if (entry === void 0) throw new Error(`${name} is not in registry ${registry}; refresh the market and try again`);
		return {
			record,
			entry
		};
	}
	/** Where a skill the search index found lives: its repository folder, or its site's index entry. */
	indexedEntry(id, signal) {
		const parts = indexedParts(id);
		if (parts === void 0) throw new Error("not a skill id of skills.sh: " + id);
		return resolveIndexed({
			origin: parts.origin,
			skill: parts.skill,
			name: parts.skill
		}, this.fetcher, signal);
	}
	async marketPreview(registry, name, signal) {
		if (registry === "skills-sh") {
			const audits = skillsShAudits(name, this.fetcher, signal);
			try {
				const entry = await this.indexedEntry(name, signal);
				const [content, files] = await Promise.all([fetchSkillDocument(entry, "", this.fetcher, signal), listSkillFiles(entry, "", this.fetcher, signal)]);
				return {
					registryId: registry,
					name,
					content,
					files: files.slice(0, 200),
					totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
					audits: await audits,
					...entry.homepage === void 0 ? {} : { homepage: entry.homepage }
				};
			} catch (error) {
				if (signal?.aborted === true) throw error;
				const snapshot = await skillsShSnapshot(name, this.fetcher, signal).catch(() => {
					throw error;
				});
				return {
					registryId: registry,
					name,
					content: snapshot.find((file) => file.path === "SKILL.md").data.toString("utf8"),
					files: snapshot.map((file) => ({
						path: file.path,
						bytes: file.data.byteLength
					})).slice(0, 200),
					totalBytes: snapshot.reduce((sum, file) => sum + file.data.byteLength, 0),
					audits: await audits,
					partial: true,
					homepage: `${SKILLS_SH_URL}/${name}`
				};
			}
		}
		const { record, entry } = this.entry(registry, name);
		const [content, files] = await Promise.all([fetchSkillDocument(entry, record.location, this.fetcher, signal), listSkillFiles(entry, record.location, this.fetcher, signal)]);
		return {
			registryId: registry,
			name,
			content,
			files: files.slice(0, 200),
			totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
			...entry.homepage === void 0 ? {} : { homepage: entry.homepage }
		};
	}
	/** Fetch the named sources (all enabled ones by default) and keep what each answered. */
	async refreshMarket(ids, signal) {
		const records = this.registryRecords().filter((record) => record.enabled && record.kind !== "search" && (ids === void 0 || ids.includes(record.id)));
		const results = await Promise.all(records.map(async (record) => {
			try {
				return {
					record,
					registry: await this.loadSource(record.kind, record.location, signal)
				};
			} catch (error) {
				return {
					record,
					error: error instanceof Error ? error.message : String(error)
				};
			}
		}));
		await this.write(() => {
			const at = this.clock().toISOString();
			for (const result of results) {
				const previous = this.store.registryCache(result.record.id);
				this.store.saveRegistryCache(result.record.id, result.registry !== void 0 ? {
					fetchedAt: at,
					registry: result.registry
				} : {
					...previous?.registry === void 0 ? {} : { registry: previous.registry },
					...previous?.fetchedAt === void 0 ? {} : { fetchedAt: previous.fetchedAt },
					error: result.error
				});
			}
			this.touch();
		});
		return this.marketView(void 0).registries;
	}
	/**
	* Add a source from what the user pasted: a GitHub repository, a site
	* publishing an Agent Skills index, or a JSON file by URL or path — a
	* catalog, a discovery index, or a plugin marketplace on GitHub.
	*/
	async addRegistry(input, signal) {
		const detected = detectSource(input);
		if (detected === void 0) throw new Error("add a GitHub repository (owner/repo), a website, or a JSON file by URL or absolute path");
		const taken = () => this.registryRecords().some((record) => record.location === detected.location);
		if (taken()) throw new Error("this source is already added");
		let kind;
		let location = detected.location;
		let registry;
		if (detected.kind === "json" || detected.kind === "catalog") {
			const value = await loadJson(location, this.fetcher, signal);
			if (isPluginMarketplace(value)) {
				const repository = /^https?:\/\//u.test(location) ? marketplaceRepository(location) : void 0;
				if (repository === void 0) throw new Error("a plugin marketplace is read from its GitHub repository; add the repository instead");
				kind = "github";
				location = repository;
				if (this.registryRecords().some((record) => record.location === location)) throw new Error("this source is already added");
				registry = await loadRepository(location, this.fetcher, signal);
			} else if (isDiscoveryIndex(value)) {
				if (!/^https?:\/\//u.test(location)) throw new Error("an Agent Skills index is read from the site that publishes it");
				kind = "well-known";
				registry = parseDiscovery(value, location);
			} else {
				kind = "catalog";
				registry = parseRegistry(value).registry;
			}
		} else {
			kind = detected.kind;
			registry = await this.loadSource(kind, location, signal);
		}
		if (kind !== "catalog" && registry.skills.length === 0) throw new Error("this source publishes no skill DSH can load");
		const id = await this.write(() => {
			const stored = this.store.registries();
			const added = stored.filter((record) => record.id !== "official" && record.id !== "skills-sh");
			if (added.some((record) => record.location === location)) throw new Error("this source is already added");
			const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 56);
			const declared = kind === "catalog" ? registry.id : kind === "github" ? slug(parseGithub(location).repo) : slug(new URL(location).host);
			const id = registryId(location, declared === "" ? void 0 : declared, new Set(added.map((record) => record.id)));
			this.store.saveRegistries([
				...stored.filter((record) => record.id === "official" || record.id === "skills-sh"),
				...added,
				{
					id,
					kind,
					location,
					enabled: true,
					builtin: false
				}
			]);
			this.store.saveRegistryCache(id, {
				fetchedAt: this.clock().toISOString(),
				registry
			});
			this.touch();
			return id;
		});
		return this.marketView(void 0).registries.find((record) => record.id === id);
	}
	removeRegistry(id) {
		return this.write(() => {
			if (id === "official" || id === "skills-sh") throw new Error("a built-in source can be switched off, not removed");
			const records = this.store.registries();
			if (!records.some((record) => record.id === id)) throw new Error("unknown skill registry: " + id);
			this.store.saveRegistries(records.filter((record) => record.id !== id));
			this.store.deleteRegistryCache(id);
			this.touch();
			return { removed: id };
		});
	}
	toggleRegistry(id, enabled) {
		return this.write(() => {
			const records = this.registryRecords();
			if (records.find((candidate) => candidate.id === id) === void 0) throw new Error("unknown skill registry: " + id);
			this.store.saveRegistries(records.map((candidate) => candidate.id === id ? {
				...candidate,
				enabled
			} : candidate));
			this.touch();
			return this.marketView(void 0).registries.find((candidate) => candidate.id === id);
		});
	}
	/**
	* Install a market skill, or update one installed from the same entry. The
	* files are fetched before the lock, staged, checked against DSH's rules,
	* then moved into place; a replaced folder goes to the trash first. A
	* skill the search index found installs from its repository or site, under
	* the name its own `SKILL.md` gives.
	*/
	async installMarket(workspace, input, signal) {
		const indexed = input.registryId === SKILLS_SH_ID;
		const { record, entry } = indexed ? {
			record: this.registryRecords().find((candidate) => candidate.id === SKILLS_SH_ID),
			entry: await this.indexedEntry(input.name, signal)
		} : this.entry(input.registryId, input.name);
		const files = await fetchSkillFiles(entry, record.location, this.fetcher, signal);
		const document = files.find((file) => file.path === "SKILL.md").data.toString("utf8");
		const name = indexed ? skillMeta(document)?.name ?? entry.name : entry.name;
		validateSkillContent(document, name);
		return this.write(() => {
			const catalog = this.catalog(workspace);
			const ledger = this.store.ledger();
			const existing = activeSkill(catalog, name);
			const install = existing === void 0 ? void 0 : ledger.installs.find((candidate) => candidate.skillKey === existing.key);
			if (existing !== void 0 && (install === void 0 || install.registryId !== record.id || install.name !== name)) throw new Error(`a skill named ${name} already exists in ${existing.root}; it did not come from this market entry`);
			if (existing !== void 0 && existing.hash !== install.hash && input.overwrite !== true) throw new Error(`${name} was edited after it was installed; confirm to replace your changes`);
			const root = existing?.root ?? input.root ?? DEFAULT_ROOT;
			const target = existing === void 0 ? join(rootPath(catalog, root), name) : existing.layout === "bundle" ? dirname(existing.path) : existing.path;
			if (existing === void 0 && (existsSync(target) || existsSync(target + ".md"))) throw new Error(`${name} already exists in this root`);
			const staged = stageFiles(this.store.stagingDirectory(), files);
			const previous = existing === void 0 ? void 0 : readFileSync(existing.path, "utf8");
			let trashed;
			try {
				if (existing !== void 0) trashed = this.store.trash(target, name, this.trashOrigin(existing, catalog));
				moveInto(staged, existing?.layout === "flat" ? join(dirname(target), name) : target);
			} catch (error) {
				rmSync(staged, {
					recursive: true,
					force: true
				});
				if (trashed !== void 0 && !existsSync(target)) try {
					renameSync(trashed, target);
				} catch {}
				throw error;
			}
			const key = `${root}:${name}`;
			const now = this.clock().toISOString();
			const hash = sha256(document);
			ledger.installs = [{
				skillKey: key,
				registryId: record.id,
				name,
				...entry.version === void 0 ? {} : { version: entry.version },
				source: entry.source,
				hash,
				files: files.length,
				installedAt: now
			}, ...ledger.installs.filter((candidate) => candidate.skillKey !== key)];
			this.recordVersion(ledger, key, document, "install", previous, { note: `${record.id}/${indexed ? input.name : name}` });
			this.store.saveLedger(ledger);
			return {
				skill: findSkill(this.catalog(workspace), key),
				updated: existing !== void 0
			};
		});
	}
	installs() {
		return this.store.ledger().installs;
	}
};
/** Write downloaded files into a fresh staging folder, never outside it. */
function stageFiles(stagingRoot, files) {
	const directory = join(stagingRoot, randomUUID());
	for (const file of files) {
		const path = join(directory, ...file.path.split("/"));
		if (!path.startsWith(directory)) throw new Error("a file of the skill escapes its folder: " + file.path);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, file.data);
	}
	return directory;
}
/** Move a staged folder into place, copying when it lives on another volume. */
function moveInto(staged, target) {
	mkdirSync(dirname(target), { recursive: true });
	try {
		renameSync(staged, target);
	} catch (error) {
		if (error.code !== "EXDEV") throw error;
		cpSync(staged, target, {
			recursive: true,
			errorOnExist: true
		});
		rmSync(staged, {
			recursive: true,
			force: true
		});
	}
}
//#endregion
//#region src/source.ts
const SKILLS_SOURCE_TYPE_ID = "skills";
const SKILLS_SOURCE_ROLE = "procedural";
const CAPABILITIES = [
	"status",
	"read",
	"write"
];
function workspace(scope) {
	const value = scope.workspaceId?.trim();
	return value === void 0 || value === "" ? void 0 : value;
}
function optionalText(value, label, maximum) {
	return value === void 0 || value === null ? void 0 : memoryInputText(value, label, maximum, false);
}
function bool(value, label) {
	if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
	return value;
}
function integers(value, label, maximum = 200) {
	if (value === void 0) return [];
	if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== "number" || !Number.isInteger(item))) throw new Error(`${label} must be an integer array`);
	return value;
}
function rootKind(value) {
	if (value === void 0 || value === null) return void 0;
	if (typeof value !== "string" || !SKILL_ROOT_KINDS.includes(value)) throw new Error("root must be one of " + SKILL_ROOT_KINDS.join(", "));
	return value;
}
/** A picked model, or null to clear the pick and follow the task Agent again. */
function draftModelInput(value) {
	if (value === void 0 || value === null) return null;
	if (typeof value !== "object" || Array.isArray(value)) throw new Error("model must be an object or null");
	const picked = value;
	return {
		provider: memoryInputText(picked.provider, "model.provider", 100),
		model: memoryInputText(picked.model, "model.model", 200)
	};
}
function backtestModel(value) {
	if (value === void 0) return {};
	const model = draftModelInput(value);
	if (model === null) throw new Error("a backtest model must name its provider and model");
	const input = memoryInputRecord(value, "model");
	return { model: {
		...model,
		...typeof input.reasoningEffort === "string" ? { reasoningEffort: memoryInputText(input.reasoningEffort, "reasoningEffort", 100) } : {}
	} };
}
function draftExpectation(value) {
	if (value === void 0) return {};
	if (value === null) return { expectedDraft: null };
	const expected = memoryInputRecord(value, "expectedDraft");
	return { expectedDraft: {
		id: memoryInputText(expected.id, "expectedDraft.id", 100),
		hash: memoryInputText(expected.hash, "expectedDraft.hash", 100)
	} };
}
function automaticAdoption(value) {
	if (value === void 0) return {};
	const input = memoryInputRecord(value, "automatic");
	if (!Number.isInteger(input.attempt) || Number(input.attempt) < 1 || Number(input.attempt) > 3) throw new Error("automatic adoption attempt must be 1..3");
	return { automatic: {
		...input.reservationId === void 0 ? {} : { reservationId: memoryInputText(input.reservationId, "reservationId", 100) },
		attempt: Number(input.attempt),
		draftHash: memoryInputText(input.draftHash, "draftHash", 100),
		baselineRunId: memoryInputText(input.baselineRunId, "baselineRunId", 100),
		draftRunId: memoryInputText(input.draftRunId, "draftRunId", 100),
		casesHash: memoryInputText(input.casesHash, "casesHash", 100)
	} };
}
function autoAdoptionEvent(value) {
	if (!AUTO_ADOPTION_STAGES.includes(value.stage)) throw new Error("unknown automatic adoption stage");
	if (value.reason !== void 0 && !AUTO_ADOPTION_REASONS.includes(value.reason)) throw new Error("unknown automatic adoption reason");
	if (!Number.isInteger(value.attempt) || Number(value.attempt) < 0 || Number(value.attempt) > 3) throw new Error("automatic adoption attempt must be 0..3");
	const score = (key) => {
		if (value[key] === void 0) return {};
		if (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1) throw new Error("invalid automatic adoption score");
		return { [key]: value[key] };
	};
	return {
		stage: value.stage,
		attempt: Number(value.attempt),
		...value.reason === void 0 ? {} : { reason: value.reason },
		...typeof value.detail === "string" ? { detail: value.detail } : {},
		...score("baselineScore"),
		...score("draftScore")
	};
}
function caseInput(value, skillName) {
	const input = memoryInputRecord(value, "case");
	const checks = input.checks;
	if (!Array.isArray(checks) || checks.length > 8) throw new Error("checks must be an array of at most 8");
	return {
		...typeof input.id === "string" && input.id.trim() !== "" ? { id: input.id.trim() } : {},
		skillName: skillName ?? memoryInputText(input.skillName, "skillName", 64),
		title: memoryInputText(input.title, "title", 200),
		prompt: memoryInputText(input.prompt, "prompt", 8e3),
		...optionalText(input.context, "context", 8e3) === void 0 ? {} : { context: optionalText(input.context, "context", 8e3) },
		checks: checks.map((item) => {
			const check = memoryInputRecord(item, "check");
			return {
				...typeof check.id === "string" ? { id: check.id } : {},
				text: memoryInputText(check.text, "check", 600),
				must: check.must === true
			};
		}),
		...typeof input.enabled === "boolean" ? { enabled: input.enabled } : {},
		...input.requiresVision === void 0 ? {} : { requiresVision: bool(input.requiresVision, "requiresVision") }
	};
}
function runTarget(value) {
	const input = memoryInputRecord(value, "target");
	const kind = input.kind;
	if (kind !== "current" && kind !== "draft" && kind !== "version" && kind !== "none") throw new Error("target kind must be current, draft, version or none");
	return {
		kind,
		...typeof input.hash === "string" ? { hash: input.hash } : {},
		...typeof input.skillKey === "string" ? { skillKey: input.skillKey } : {},
		...typeof input.draftId === "string" ? { draftId: input.draftId } : {},
		...typeof input.versionId === "string" ? { versionId: input.versionId } : {}
	};
}
function caseResult(value) {
	const input = memoryInputRecord(value, "result");
	const verdict = input.verdict;
	if (verdict !== "pass" && verdict !== "fail" && verdict !== "error") throw new Error("verdict must be pass, fail or error");
	const unmeasuredReason = input.unmeasuredReason;
	if (unmeasuredReason !== void 0 && (unmeasuredReason !== "requires-vision" || verdict !== "error")) throw new Error("unmeasuredReason requires requires-vision and an ungraded error verdict");
	const score = typeof input.score === "number" && Number.isFinite(input.score) ? Math.min(1, Math.max(0, input.score)) : 0;
	const checks = Array.isArray(input.checks) ? input.checks.slice(0, 8).map((item) => {
		const check = memoryInputRecord(item, "check result");
		return {
			checkId: memoryInputText(check.checkId, "checkId", 100),
			pass: check.pass === true,
			note: typeof check.note === "string" ? check.note : ""
		};
	}) : [];
	return {
		caseId: memoryInputText(input.caseId, "caseId", 100),
		title: memoryInputText(input.title, "title", 200),
		verdict,
		score,
		checks,
		steps: memoryInputStringArray(input.steps, "steps", 40) ?? [],
		answer: typeof input.answer === "string" ? input.answer : "",
		...typeof input.summary === "string" ? { summary: input.summary } : {},
		...typeof input.error === "string" ? { error: input.error } : {},
		...unmeasuredReason === void 0 ? {} : { unmeasuredReason },
		...typeof input.fullyGraded === "boolean" ? { fullyGraded: input.fullyGraded } : {}
	};
}
function signal(value) {
	if (typeof value !== "string" || !EVOLUTION_SIGNALS.includes(value)) throw new Error("unknown evolution signal: " + String(value));
	return value;
}
function step(value) {
	const input = memoryInputRecord(value, "step");
	const kind = input.kind;
	if (kind !== "user" && kind !== "assistant" && kind !== "tool" && kind !== "skill") throw new Error("step kind is invalid");
	const tool = input.tool === void 0 ? void 0 : memoryInputRecord(input.tool, "step tool");
	const skill = input.skill === void 0 ? void 0 : memoryInputRecord(input.skill, "step skill");
	return {
		index: Number(input.index),
		turn: Number(input.turn),
		kind,
		text: typeof input.text === "string" ? input.text.slice(0, 2e3) : "",
		...tool === void 0 ? {} : { tool: {
			name: memoryInputText(tool.name, "tool name", 200),
			ok: tool.ok === true,
			...typeof tool.input === "string" ? { input: tool.input.slice(0, 1e3) } : {},
			...typeof tool.error === "string" ? { error: tool.error.slice(0, 1e3) } : {}
		} },
		...skill === void 0 ? {} : { skill: {
			name: memoryInputText(skill.name, "skill name", 64),
			by: skill.by === "user" ? "user" : "model"
		} },
		...typeof input.at === "string" ? { at: input.at } : {}
	};
}
/** The admission rules the Host sends; each is checked again by the policy. */
function policyInput(value) {
	const input = memoryInputRecord(value, "policy");
	const number = (key) => typeof input[key] === "number" && Number.isFinite(input[key]) ? { [key]: input[key] } : {};
	const allowed = (key) => {
		if (input[key] === void 0) return {};
		if (typeof input[key] !== "boolean") throw new Error(`skills policy ${key} must be a boolean`);
		return { [key]: input[key] };
	};
	return {
		...allowed("allowCreate"),
		...allowed("allowUpdate"),
		...number("minConfidence"),
		...number("expiryDays"),
		...number("maxPendingPerSession")
	};
}
/** The Host's record of one review; bounded here as well as there. */
function reviewRecord(value) {
	const input = memoryInputRecord(value, "review record");
	const review = memoryInputRecord(input.review ?? null, "review");
	const trajectory = memoryInputRecord(input.trajectory ?? null, "trajectory");
	const stats = memoryInputRecord(trajectory.stats ?? null, "trajectory stats");
	const outcome = review.outcome;
	if (outcome !== "suggested" && outcome !== "nothing" && outcome !== "error") throw new Error("review outcome is invalid");
	const steps = trajectory.steps;
	if (!Array.isArray(steps) || steps.length > 400) throw new Error("trajectory steps must be an array of at most 400");
	const list = (field, label, maximum) => {
		if (field === void 0) return [];
		if (!Array.isArray(field) || field.length > maximum) throw new Error(`${label} must be an array of at most ${maximum}`);
		return field;
	};
	const score = review.score === void 0 ? void 0 : memoryInputRecord(review.score, "score");
	return {
		review: {
			at: memoryInputText(review.at, "at", 64),
			sessionId: memoryInputText(review.sessionId, "sessionId", 300),
			...optionalText(review.sessionTitle, "sessionTitle", 300) === void 0 ? {} : { sessionTitle: optionalText(review.sessionTitle, "sessionTitle", 300) },
			trigger: review.trigger === "manual" ? "manual" : "automatic",
			...score === void 0 ? {} : { score },
			durationMs: typeof review.durationMs === "number" ? review.durationMs : 0,
			outcome,
			...optionalText(review.summary, "summary", 2e3) === void 0 ? {} : { summary: optionalText(review.summary, "summary", 2e3) },
			...optionalText(review.error, "error", 2e3) === void 0 ? {} : { error: optionalText(review.error, "error", 2e3) },
			...Number.isInteger(review.turn) && Number(review.turn) >= 0 ? { turn: Number(review.turn) } : {}
		},
		...input.policy === void 0 ? {} : { policy: policyInput(input.policy) },
		trajectory: {
			sessionId: memoryInputText(trajectory.sessionId, "sessionId", 300),
			...optionalText(trajectory.sessionTitle, "sessionTitle", 300) === void 0 ? {} : { sessionTitle: optionalText(trajectory.sessionTitle, "sessionTitle", 300) },
			...optionalText(trajectory.workspace, "workspace", 2e3) === void 0 ? {} : { workspace: optionalText(trajectory.workspace, "workspace", 2e3) },
			startedAt: memoryInputText(trajectory.startedAt, "startedAt", 64),
			endedAt: memoryInputText(trajectory.endedAt, "endedAt", 64),
			stats: {
				turns: Number(stats.turns) || 0,
				userCharacters: Number(stats.userCharacters) || 0,
				toolCalls: Number(stats.toolCalls) || 0,
				toolFailures: Number(stats.toolFailures) || 0,
				uniqueTools: Number(stats.uniqueTools) || 0,
				skills: memoryInputStringArray(stats.skills, "skills", 50) ?? []
			},
			...trajectory.score === void 0 ? {} : { score: memoryInputRecord(trajectory.score, "score") },
			steps: steps.map(step),
			annotations: []
		},
		annotations: list(input.annotations, "annotations", 200).map((item) => {
			const annotation = memoryInputRecord(item, "annotation");
			return {
				step: Number(annotation.step),
				signal: signal(annotation.signal),
				note: typeof annotation.note === "string" ? annotation.note : ""
			};
		}),
		suggestions: list(input.suggestions, "suggestions", 10).map((item) => {
			const suggestion = memoryInputRecord(item, "suggestion");
			return {
				skillName: memoryInputText(suggestion.skillName, "skillName", 120),
				action: suggestion.action === "update" ? "update" : "create",
				...rootKind(suggestion.targetRoot) === void 0 ? {} : { targetRoot: rootKind(suggestion.targetRoot) },
				summary: memoryInputText(suggestion.summary, "summary", 2e3),
				...optionalText(suggestion.rationale, "rationale", 4e3) === void 0 ? {} : { rationale: optionalText(suggestion.rationale, "rationale", 4e3) },
				confidence: Number(suggestion.confidence),
				signals: (memoryInputStringArray(suggestion.signals, "signals", 10) ?? []).filter((value) => EVOLUTION_SIGNALS.includes(value)),
				steps: integers(suggestion.steps, "steps")
			};
		}),
		cases: list(input.cases, "cases", 10).map((item) => {
			const entry = memoryInputRecord(item, "case");
			const checks = list(entry.checks, "checks", 8);
			return {
				skillName: memoryInputText(entry.skillName, "skillName", 120),
				title: memoryInputText(entry.title, "title", 400),
				prompt: memoryInputText(entry.prompt, "prompt", 8e3),
				checks: checks.map((check) => {
					const value = memoryInputRecord(check, "check");
					return {
						text: typeof value.text === "string" ? value.text : "",
						must: value.must === true
					};
				}),
				steps: integers(entry.steps, "steps")
			};
		})
	};
}
function skillsDataDir(config, instanceKey) {
	const dataDir = config.dataDir ?? join(homedir(), ".mnemon", "sources", encodeURIComponent(instanceKey));
	if (!isAbsolute(dataDir)) throw new Error("Skills Source dataDir must be absolute");
	return dataDir;
}
function createSkillsMemorySource(config = {}) {
	const configured = Object.freeze({ ...config });
	return defineMemorySource({
		manifest: {
			apiVersion: COMPOSABLE_MEMORY_API_VERSION,
			kind: "source",
			typeId: SKILLS_SOURCE_TYPE_ID,
			packageName: "dsh-mnemon-source-skills",
			role: SKILLS_SOURCE_ROLE,
			capabilities: [...CAPABILITIES],
			consistency: "namespace-pinned-live-read",
			management: {
				label: "Skills",
				description: "DSH skills with their versions, evolution suggestions, evidence trajectories and eval sets."
			}
		},
		create(context) {
			const effective = {
				...context.configuration,
				...configured
			};
			if (effective.allowLinkedUpdates !== void 0 && typeof effective.allowLinkedUpdates !== "boolean") throw new Error("Skills Source allowLinkedUpdates must be a boolean");
			const service = new SkillsService(skillsDataDir(effective, context.sourceInstanceKey), {
				...effective.dshHome === void 0 ? {} : { dshHome: effective.dshHome },
				...effective.agentsHome === void 0 ? {} : { agentsHome: effective.agentsHome },
				allowLinkedUpdates: effective.allowLinkedUpdates === true
			});
			service.reclaimOrphanDrafts().catch(() => void 0);
			const recovery = service.reclaimStaleRuns();
			const reaper = setInterval(() => {
				service.reclaimStaleRuns().catch(() => void 0);
			}, 6e4);
			reaper.unref?.();
			const facts = (scope, management) => management ? {
				sourceInstanceKey: context.sourceInstanceKey,
				sourceTypeId: SKILLS_SOURCE_TYPE_ID,
				role: SKILLS_SOURCE_ROLE,
				availability: "ready",
				revision: service.revision(workspace(scope)),
				capabilities: [...CAPABILITIES],
				routeIds: [],
				actionIds: []
			} : {
				sourceInstanceKey: context.sourceInstanceKey,
				sourceTypeId: SKILLS_SOURCE_TYPE_ID,
				role: SKILLS_SOURCE_ROLE,
				availability: "unavailable",
				revision: "management-only",
				capabilities: ["status"],
				routeIds: [],
				actionIds: [],
				hints: { reason: "management-only" }
			};
			return {
				dispose() {
					clearInterval(reaper);
				},
				facts(request) {
					return facts(request.scope, request.scenario.startsWith("management."));
				},
				project() {
					return { fragments: [] };
				},
				async manage(request) {
					await recovery;
					const root = workspace(request.scope);
					const input = request.input ?? {};
					const fields = typeof input === "object" && input !== null && !Array.isArray(input) ? input : {};
					const revision = () => service.revision(root);
					if (request.mode === "read") {
						const value = () => {
							switch (request.operation) {
								case "revision": return { revision: revision() };
								case "overview": return service.overview(root);
								case "catalog": return service.catalogView(root);
								case "skill": return service.skill(root, memoryInputText(fields.key, "key", 200));
								case "versions": return service.versions(memoryInputText(fields.key, "key", 200));
								case "version": return service.version(memoryInputText(fields.key, "key", 200), memoryInputText(fields.id, "id", 100));
								case "suggestions": return service.suggestions(memoryInputStringArray(fields.status, "status", 10));
								case "suggestion": return service.suggestion(root, memoryInputText(fields.id, "id", 100));
								case "trajectories": return service.trajectories({
									...optionalText(fields.skill, "skill", 64) === void 0 ? {} : { skill: optionalText(fields.skill, "skill", 64) },
									...optionalText(fields.signal, "signal", 40) === void 0 ? {} : { signal: optionalText(fields.signal, "signal", 40) },
									...optionalText(fields.sessionId, "sessionId", 300) === void 0 ? {} : { sessionId: optionalText(fields.sessionId, "sessionId", 300) }
								});
								case "trajectory": return service.trajectory(memoryInputText(fields.id, "id", 100));
								case "cases": return service.cases(optionalText(fields.skill, "skill", 64));
								case "runs": return service.runs(optionalText(fields.skill, "skill", 64));
								case "run": return service.run(memoryInputText(fields.id, "id", 100));
								case "drafts": return service.drafts({
									...optionalText(fields.suggestionId, "suggestionId", 100) === void 0 ? {} : { suggestionId: optionalText(fields.suggestionId, "suggestionId", 100) },
									...optionalText(fields.skill, "skill", 64) === void 0 ? {} : { skill: optionalText(fields.skill, "skill", 64) },
									...optionalText(fields.path, "path", 4096) === void 0 ? {} : { path: optionalText(fields.path, "path", 4096) }
								});
								case "draft": return service.draft(root, memoryInputText(fields.id, "id", 100));
								case "draft-preferences": return service.draftPreferences();
								case "reviews": return service.reviews({
									...typeof fields.sessionId === "string" ? { sessionId: fields.sessionId } : {},
									...typeof fields.limit === "number" ? { limit: fields.limit } : {}
								});
								case "evidence-pack": return service.evidencePack(root, {
									...optionalText(fields.suggestionId, "suggestionId", 100) === void 0 ? {} : { suggestionId: optionalText(fields.suggestionId, "suggestionId", 100) },
									...optionalText(fields.draftId, "draftId", 100) === void 0 ? {} : { draftId: optionalText(fields.draftId, "draftId", 100) },
									...optionalText(fields.skill, "skill", 64) === void 0 ? {} : { skill: optionalText(fields.skill, "skill", 64) }
								});
								case "target-content": return service.targetContent(root, memoryInputText(fields.skillName, "skillName", 64), runTarget(fields.target));
								case "market": return service.marketView(root);
								case "market-preview": return service.marketPreview(memoryInputText(fields.registryId, "registryId", 80), memoryInputText(fields.name, "name", 300), request.signal);
								case "market-search": return service.searchMarket(root, memoryInputText(fields.query, "query", 200), request.signal);
								case "installs": return service.installs();
								case "trash":
								case "trash-list": return service.trashItems();
								case "trash-restore-preview": return service.previewTrashRestore(root, {
									id: memoryInputText(fields.id, "id", 300),
									...rootKind(fields.root) === void 0 ? {} : { root: rootKind(fields.root) },
									...optionalText(fields.name, "name", 64) === void 0 ? {} : { name: optionalText(fields.name, "name", 64) }
								});
								default: throw new Error("unsupported Skills read operation: " + request.operation);
							}
						};
						const result = await value();
						return {
							revision: revision(),
							value: JSON.parse(JSON.stringify(result ?? null))
						};
					}
					if (!request.confirmed) throw new Error("Skills management mutation requires explicit confirmation");
					if (request.expectedRevision !== void 0 && request.expectedRevision !== revision()) throw new Error("Skills Source changed since it was read; reload and try again");
					let value;
					switch (request.operation) {
						case "skill-create":
							value = await service.createSkill(root, {
								name: memoryInputText(fields.name, "name", 64),
								description: memoryInputText(fields.description, "description", 1e3),
								...rootKind(fields.root) === void 0 ? {} : { root: rootKind(fields.root) },
								...typeof fields.content === "string" && fields.content.trim() !== "" ? { content: fields.content } : {}
							});
							break;
						case "skill-save":
							value = await service.saveSkill(root, {
								key: memoryInputText(fields.key, "key", 200),
								content: typeof fields.content === "string" ? fields.content : "",
								expectedHash: memoryInputText(fields.expectedHash, "expectedHash", 100)
							});
							break;
						case "skill-invocation":
							value = await service.setInvocation(root, {
								key: memoryInputText(fields.key, "key", 200),
								modelInvocable: bool(fields.modelInvocable, "modelInvocable"),
								userInvocable: bool(fields.userInvocable, "userInvocable"),
								expectedHash: memoryInputText(fields.expectedHash, "expectedHash", 100)
							});
							break;
						case "skill-delete":
							value = await service.deleteSkill(root, {
								key: memoryInputText(fields.key, "key", 200),
								expectedHash: memoryInputText(fields.expectedHash, "expectedHash", 100)
							});
							break;
						case "trash-restore":
							value = await service.restoreTrash(root, {
								id: memoryInputText(fields.id, "id", 300),
								...rootKind(fields.root) === void 0 ? {} : { root: rootKind(fields.root) },
								...optionalText(fields.name, "name", 64) === void 0 ? {} : { name: optionalText(fields.name, "name", 64) },
								...fields.replace === true ? { replace: true } : {},
								...optionalText(fields.expectedHash, "expectedHash", 100) === void 0 ? {} : { expectedHash: optionalText(fields.expectedHash, "expectedHash", 100) }
							});
							break;
						case "trash-purge":
							value = await service.purgeTrash({ id: memoryInputText(fields.id, "id", 300) });
							break;
						case "trash-empty":
							value = await service.emptyTrash();
							break;
						case "version-restore":
							value = await service.restoreVersion(root, {
								key: memoryInputText(fields.key, "key", 200),
								versionId: memoryInputText(fields.versionId, "versionId", 100),
								expectedHash: memoryInputText(fields.expectedHash, "expectedHash", 100)
							});
							break;
						case "suggestion-dismiss":
							value = await service.dismissSuggestion(memoryInputText(fields.id, "id", 100));
							break;
						case "suggestion-delete":
							value = await service.deleteSuggestion(memoryInputText(fields.id, "id", 100));
							break;
						case "suggestion-status": {
							const status = fields.status;
							if (status !== "drafting" && status !== "pending") throw new Error("status must be drafting or pending");
							value = await service.suggestionStatus({
								...request.signal === void 0 ? {} : { signal: request.signal },
								id: memoryInputText(fields.id, "id", 100),
								status,
								...draftExpectation(fields.expectedDraft),
								...typeof fields.error === "string" ? { error: fields.error } : {}
							});
							break;
						}
						case "auto-adoption-reserve":
							value = await service.reserveAutomatic(root, memoryInputText(fields.id, "id", 100), typeof fields.limit === "number" ? fields.limit : NaN, memoryInputText(fields.timeZone, "timeZone", 100));
							break;
						case "auto-adoption-record":
							value = await service.recordAutoAdoption(memoryInputText(fields.id, "id", 100), autoAdoptionEvent(fields));
							break;
						case "trajectory-pin":
							value = await service.pinTrajectory(memoryInputText(fields.id, "id", 100), bool(fields.pinned, "pinned"));
							break;
						case "trajectory-delete":
							value = await service.deleteTrajectory(memoryInputText(fields.id, "id", 100));
							break;
						case "case-save":
							value = await service.saveCase(caseInput(fields.case ?? fields));
							break;
						case "case-delete":
							value = await service.deleteCase(memoryInputText(fields.id, "id", 100));
							break;
						case "cases-add": {
							const skillName = memoryInputText(fields.skillName, "skillName", 64);
							if (!Array.isArray(fields.cases) || fields.cases.length > 10) throw new Error("cases must be an array of at most 10");
							value = await service.addCases({
								skillName,
								cases: fields.cases.map((entry) => caseInput(entry, skillName)),
								...optionalText(fields.trajectoryId, "trajectoryId", 100) === void 0 ? {} : { trajectoryId: optionalText(fields.trajectoryId, "trajectoryId", 100) },
								...fields.steps === void 0 ? {} : { steps: integers(fields.steps, "steps") }
							});
							break;
						}
						case "draft-record":
							value = await service.recordDraft(root, {
								...request.signal === void 0 ? {} : { signal: request.signal },
								...draftExpectation(fields.expectedDraft),
								...fields.expectedBaseHash === void 0 ? {} : { expectedBaseHash: fields.expectedBaseHash === null ? null : memoryInputText(fields.expectedBaseHash, "expectedBaseHash", 100) },
								...optionalText(fields.suggestionId, "suggestionId", 100) === void 0 ? {} : { suggestionId: optionalText(fields.suggestionId, "suggestionId", 100) },
								...optionalText(fields.draftId, "draftId", 100) === void 0 ? {} : { draftId: optionalText(fields.draftId, "draftId", 100) },
								skillName: memoryInputText(fields.skillName, "skillName", 64),
								content: typeof fields.content === "string" ? fields.content : "",
								notes: typeof fields.notes === "string" ? fields.notes : "",
								changes: memoryInputStringArray(fields.changes, "changes", 20) ?? [],
								guidance: memoryInputStringArray(fields.guidance, "guidance", 20) ?? [],
								...rootKind(fields.targetRoot) === void 0 ? {} : { targetRoot: rootKind(fields.targetRoot) }
							});
							break;
						case "draft-update":
							value = await service.updateDraft({
								id: memoryInputText(fields.id, "id", 100),
								content: typeof fields.content === "string" ? fields.content : ""
							});
							break;
						case "draft-adopt":
							value = await service.adoptDraft(root, memoryInputText(fields.id, "id", 100), {
								...request.signal === void 0 ? {} : { signal: request.signal },
								...automaticAdoption(fields.automatic),
								...rootKind(fields.root) === void 0 ? {} : { root: rootKind(fields.root) }
							});
							break;
						case "draft-discard":
							value = await service.discardDraft(memoryInputText(fields.id, "id", 100));
							break;
						case "draft-delete":
							value = await service.deleteDraft(memoryInputText(fields.id, "id", 100));
							break;
						case "draft-preference": {
							const slot = optionalText(fields.slot, "slot", 10);
							if (slot !== void 0 && slot !== "draft" && slot !== "run") throw new Error("slot must be draft or run");
							const suggestionId = optionalText(fields.suggestionId, "suggestionId", 100);
							if (suggestionId !== void 0 && slot === "run") throw new Error("a suggestion pick cannot be a backtest pick");
							value = await service.setDraftPreference({
								...slot === void 0 ? {} : { slot },
								...suggestionId === void 0 ? {} : { suggestionId },
								...optionalText(fields.skillName, "skillName", 64) === void 0 ? {} : { skillName: optionalText(fields.skillName, "skillName", 64) },
								model: draftModelInput(fields.model)
							});
							break;
						}
						case "run-start":
							value = await service.startRun({
								...request.signal === void 0 ? {} : { signal: request.signal },
								skillName: memoryInputText(fields.skillName, "skillName", 64),
								target: runTarget(fields.target),
								caseIds: memoryInputStringArray(fields.caseIds, "caseIds", 40) ?? [],
								...fields.expectedCasesHash === void 0 ? {} : { expectedCasesHash: memoryInputText(fields.expectedCasesHash, "expectedCasesHash", 100) },
								...backtestModel(fields.model)
							});
							break;
						case "run-link":
							value = await service.linkRun(memoryInputText(fields.draftId, "draftId", 100), memoryInputText(fields.runId, "runId", 100));
							break;
						case "run-progress":
							value = await service.progressRun({
								...request.signal === void 0 ? {} : { signal: request.signal },
								id: memoryInputText(fields.id, "id", 100),
								result: caseResult(fields.result)
							});
							break;
						case "run-cancel":
							value = await service.finishRun({
								...request.signal === void 0 ? {} : { signal: request.signal },
								id: memoryInputText(fields.id, "id", 100),
								status: "interrupted",
								error: "Backtest cancelled by the user."
							});
							break;
						case "run-finish": {
							const status = fields.status === "completed" ? "completed" : fields.status === "interrupted" ? "interrupted" : "failed";
							value = await service.finishRun({
								...request.signal === void 0 ? {} : { signal: request.signal },
								id: memoryInputText(fields.id, "id", 100),
								status,
								...typeof fields.error === "string" ? { error: fields.error } : {}
							});
							break;
						}
						case "review-record":
							value = await service.recordReview(root, reviewRecord(fields));
							break;
						case "market-refresh":
							value = await service.refreshMarket(memoryInputStringArray(fields.ids, "ids", 50), request.signal);
							break;
						case "market-install":
							value = await service.installMarket(root, {
								registryId: memoryInputText(fields.registryId, "registryId", 80),
								name: memoryInputText(fields.name, "name", 300),
								...rootKind(fields.root) === void 0 ? {} : { root: rootKind(fields.root) },
								...fields.overwrite === true ? { overwrite: true } : {}
							}, request.signal);
							break;
						case "registry-add":
							value = await service.addRegistry(memoryInputText(fields.location, "location", 2e3), request.signal);
							break;
						case "registry-remove":
							value = await service.removeRegistry(memoryInputText(fields.id, "id", 80));
							break;
						case "registry-toggle":
							value = await service.toggleRegistry(memoryInputText(fields.id, "id", 80), bool(fields.enabled, "enabled"));
							break;
						default: throw new Error("unsupported Skills mutation: " + request.operation);
					}
					return {
						revision: revision(),
						value: JSON.parse(JSON.stringify(value ?? null))
					};
				}
			};
		}
	});
}
const SKILLS_MEMORY_SOURCE = createSkillsMemorySource();
//#endregion
//#region src/index.ts
const name = "dsh-mnemon-source-skills";
const inject = ["mnemonMemory"];
const memoryPlugin = defineMemoryPlugin({
	packageName: name,
	label: {
		en: "Skills",
		"zh-CN": "技能管理"
	},
	description: {
		en: "Manage DSH skills, and let them improve from your conversations.",
		"zh-CN": "管理 DSH 技能，并让它们从对话中持续改进。"
	},
	roles: ["source"],
	provides: [{ id: "source.procedural" }]
});
function apply(ctx, config = {}) {
	installMemory(ctx, {
		plugin: memoryPlugin,
		sources: [createSkillsMemorySource(config)]
	}, { effectiveDigest: memoryConfigurationDigest(config) });
}
//#endregion
export { SKILLS_MEMORY_SOURCE, SKILLS_SOURCE_ROLE, SKILLS_SOURCE_TYPE_ID, apply, createSkillsMemorySource, inject, memoryPlugin, name };
