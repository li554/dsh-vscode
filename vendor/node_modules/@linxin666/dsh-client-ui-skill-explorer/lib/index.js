import { homedir } from "node:os";
import { dirname, join, sep } from "node:path";
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
//#region src/loopback.ts
/** IPv4 127/8 predicate (four decimal octets, first == 127). */
function isIPv4Loopback(v4) {
	const parts = v4.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
function isLoopbackAddress(address) {
	if (address === void 0) return false;
	const normalized = address.toLowerCase();
	if (normalized === "::1") return true;
	if (normalized.startsWith("::ffff:")) return isIPv4Loopback(normalized.slice(7));
	return isIPv4Loopback(normalized);
}
/** Whether a normalized URL hostname names the loopback authority (localhost, [::1], 127/8). */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	return isIPv4Loopback(hostname);
}
/**
* Request-level trust fence: a loopback socket address AND a loopback Host
* header, plus browser same-origin markers. The socket address is
* authoritative; X-Forwarded-For is never trusted.
*/
function isLoopbackRequest(request) {
	if (!isLoopbackAddress(request.socket.remoteAddress)) return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL("http://" + host);
	} catch {
		return false;
	}
	if (!isLoopbackHostname(hostUrl.hostname)) return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region src/access.ts
/**
* Whether this request may enter any /api/dsh-skill-explorer route.
* @param ctx - host context; may expose remoteWebUiPairing.
* @param request - the incoming HTTP request.
* @returns true for loopback, or a live paired-device cookie.
*/
function isSkillExplorerAllowed(ctx, request) {
	if (isLoopbackRequest(request)) return true;
	const bag = ctx;
	const fromGet = typeof bag.get === "function" ? bag.get("remoteWebUiPairing", false) : void 0;
	return (isPairingAccess(fromGet) ? fromGet : bag.remoteWebUiPairing)?.isPairedDevice(request) === true;
}
function isPairingAccess(value) {
	return value !== void 0 && value !== null && typeof value.isPairedDevice === "function";
}
//#endregion
//#region src/frontmatter.ts
/**
* SKILL.md frontmatter lightweight parsing and rewriting (zero dependency).
*
* Ported from the local plugin family's shared implementation; the official
* dsh-skill-filesystem provider parses frontmatter with its own stack, so
* this module keeps a stable export surface for unit tests to lock behavior.
*/
/** Parse a YAML boolean (true/false/yes/no/on/off/1/0, case-insensitive); undefined when not boolean. */
function parseYamlBool(value) {
	const text = String(value).toLowerCase();
	if ([
		"true",
		"yes",
		"on",
		"1"
	].includes(text)) return true;
	if ([
		"false",
		"no",
		"off",
		"0"
	].includes(text)) return false;
}
/** Strip single or double quotes around a scalar value. */
function unquote(value) {
	if (value.length >= 2 && (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
	return value;
}
/**
* Parse scalar fields from the leading frontmatter block (lightweight, zero
* dependency). Supports name/description/whenToUse (including | / > block
* scalars), the input nested block (hint / recordInput) and the
* disable-model-invocation / user-invocable booleans.
* @param content - raw SKILL.md content.
* @returns parsed fields (empty object when no frontmatter).
*/
function parseFrontmatter(content) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
	if (match === null) return {};
	const out = {};
	const lines = match[1].split(/\r?\n/);
	for (let i = 0; i < lines.length; i += 1) {
		const kv = /^([a-zA-Z][\w-]*):\s*(.*)$/.exec(lines[i]);
		if (kv === null) continue;
		const key = kv[1];
		const rest = kv[2].trim();
		if (key === "input" && rest === "") {
			const nested = {};
			for (let j = i + 1; j < lines.length; j += 1) {
				const line = lines[j];
				const sub = /^\s+([a-zA-Z][\w-]*):\s*(.*)$/.exec(line);
				if (sub === null) {
					if (line.trim() === "") continue;
					break;
				}
				const subKey = sub[1];
				const subValue = sub[2].trim();
				if (subKey === "hint") nested.hint = unquote(subValue);
				else if (subKey === "recordInput") nested.recordInput = parseYamlBool(subValue);
			}
			if (nested.hint !== void 0) out.hint = nested.hint;
			if (nested.recordInput !== void 0) out.recordInput = nested.recordInput;
			continue;
		}
		if (rest === "") continue;
		if (/^[|>][-+]?$/.test(rest)) {
			const collected = [];
			for (let j = i + 1; j < lines.length; j += 1) {
				const line = lines[j];
				if (line === "" || /^\s/.test(line)) collected.push(line.trim());
				else break;
			}
			const text = collected.join(" ").trim();
			if (key === "name") out.name = text || void 0;
			else if (key === "description") out.description = text || void 0;
			else if (key === "whenToUse") out.whenToUse = text || void 0;
			continue;
		}
		if (key === "name") out.name = unquote(rest);
		else if (key === "description") out.description = unquote(rest);
		else if (key === "whenToUse") out.whenToUse = unquote(rest);
		else if (key === "disable-model-invocation") out.disableModelInvocation = parseYamlBool(rest);
		else if (key === "user-invocable") out.userInvocable = parseYamlBool(rest);
		else if (key === "recordInput") out.recordInput = parseYamlBool(rest);
	}
	return out;
}
/**
* Rewrite one boolean frontmatter field (appends when absent), atomically.
* Preserves every other line and the body verbatim.
* @param file - absolute SKILL.md path.
* @param field - frontmatter field name (e.g. disable-model-invocation).
* @param value - target boolean value.
* @returns the parsed frontmatter of the rewritten content.
*/
function setFrontmatterField(file, field, value) {
	const content = readFileSync(file, "utf8");
	const match = /^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/.exec(content);
	if (match === null) throw new Error(`setFrontmatterField: ${file} has no frontmatter`);
	const blockLines = match[1].split(/\r?\n/);
	const linePattern = new RegExp(`^${field}:`);
	let replaced = false;
	const next = blockLines.map((line) => {
		if (linePattern.test(line)) {
			replaced = true;
			return `${field}: ${value}`;
		}
		return line;
	});
	if (!replaced) next.push(`${field}: ${value}`);
	const rewritten = `---\n${next.join("\n")}\n---${match[2]}`;
	const tmp = `${file}.${Date.now().toString(36)}.${randomBytes(6).toString("hex")}.tmp`;
	try {
		writeFileSync(tmp, rewritten, {
			encoding: "utf8",
			flag: "wx"
		});
		renameSync(tmp, file);
	} catch (error) {
		try {
			unlinkSync(tmp);
		} catch {}
		throw error;
	}
	return parseFrontmatter(rewritten);
}
//#endregion
//#region src/collect.ts
/**
* Skill collection: filesystem scanning (primary) plus registry supplement.
*
* The web profile mounts the skill-filesystem provider only at the agent
* preset scope layer, so the host plane cannot read project/user skills from
* ctx.skills — the list route scans the official root conventions itself and
* merges registry entries (bundled / runtime) by name.
*/
/** Source levels produced by filesystem scanning (registry sources map to the same set). */
const SOURCE_GROUPS = [
	{
		key: "bundled",
		title: "System bundled",
		hint: "Skills shipped with DSH and its plugins"
	},
	{
		key: "project-dsh",
		title: "Project skills (.dsh/skills)",
		hint: "Current project only"
	},
	{
		key: "project-agents",
		title: "Project skills (.agents/skills)",
		hint: "Current project only"
	},
	{
		key: "custom",
		title: "Custom directories",
		hint: "customSkillDirs config"
	},
	{
		key: "user-dsh",
		title: "User skills (~/.dsh/skills)",
		hint: "All projects on this machine"
	},
	{
		key: "user-agents",
		title: "User skills (~/.agents/skills)",
		hint: "All projects on this machine"
	},
	{
		key: "runtime",
		title: "Runtime registered",
		hint: "Registered in plugin code"
	}
];
/** Registry source -> display level mapping (unlisted sources fall into "other"). */
const REGISTRY_SOURCE_LEVEL = new Map(SOURCE_GROUPS.map((group) => [group.key, group.key]));
/**
* Filesystem precedence across roots, matching the official rank order
* (project wins over custom wins over user). Parallel scans finish in
* arbitrary order, so the winner must be decided by priority comparison,
* never by whichever readdir happened to resolve last.
*/
const LEVEL_PRIORITY = /* @__PURE__ */ new Map([
	["project-dsh", 0],
	["project-agents", 1],
	["custom", 2],
	["user-dsh", 3],
	["user-agents", 4]
]);
/** Find the nearest ancestor directory containing .git (cwd itself when none). */
function findProjectRoot(cwd) {
	let current = cwd;
	for (;;) {
		if (existsSync(join(current, ".git"))) return current;
		const parent = dirname(current);
		if (parent === current) return cwd;
		current = parent;
	}
}
/**
* Scan one skill root (one level: <name>/SKILL.md or <name>.md).
* Async IO via fs/promises so multiple roots can be scanned in parallel.
*/
async function scanSkillRoot(root, level, into) {
	if (!existsSync(root)) return;
	let entries;
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const name = entry.name;
		let file;
		let linked = false;
		if (entry.isDirectory()) file = join(root, name, "SKILL.md");
		else if (entry.isFile() && name.endsWith(".md")) file = join(root, name);
		else if (entry.isSymbolicLink()) {
			linked = true;
			let linkedFile;
			try {
				const target = await stat(join(root, name));
				if (target.isDirectory()) linkedFile = join(root, name, "SKILL.md");
				else if (target.isFile() && name.endsWith(".md")) linkedFile = join(root, name);
				else continue;
			} catch {
				continue;
			}
			file = linkedFile;
		} else continue;
		if (!existsSync(file)) continue;
		let content;
		try {
			content = await readFile(file, "utf8");
		} catch {
			continue;
		}
		const parsed = parseFrontmatter(content);
		const skillName = parsed.name ?? name.replace(/\.md$/, "");
		if (!/^[a-z0-9][a-z0-9-]*$/.test(skillName)) continue;
		const priority = LEVEL_PRIORITY.get(level) ?? 99;
		const existing = into.get(skillName);
		if (existing !== void 0 && (LEVEL_PRIORITY.get(existing.level) ?? 99) <= priority) continue;
		into.set(skillName, {
			name: skillName,
			description: parsed.description ?? "(no description)",
			whenToUse: parsed.whenToUse,
			provider: "filesystem",
			level,
			path: file,
			linked,
			modelInvocable: parsed.disableModelInvocation !== true,
			userInvocable: parsed.userInvocable !== false
		});
	}
}
/** Serialize one registry entry into the panel payload (keeps the source for grouping). */
function serializeRegistry(skill) {
	return {
		name: skill.name,
		description: skill.description,
		whenToUse: skill.whenToUse,
		provider: skill.provider,
		level: REGISTRY_SOURCE_LEVEL.get(skill.source) ?? `other:${skill.source}`,
		path: void 0,
		modelInvocable: skill.invocation?.modelInvocable ?? false,
		userInvocable: skill.invocation?.userInvocable ?? false
	};
}
/** Group by level, ordered by SOURCE_GROUPS then leftovers, sorted by name inside each group. */
function buildPayload(skills, complete, cwd, projectRoots) {
	const byLevel = /* @__PURE__ */ new Map();
	for (const skill of skills) {
		const list = byLevel.get(skill.level) ?? [];
		list.push(skill);
		byLevel.set(skill.level, list);
	}
	const known = new Set(SOURCE_GROUPS.map((group) => group.key));
	const groups = SOURCE_GROUPS.map((group) => ({
		key: group.key,
		title: group.title,
		hint: group.hint,
		skills: (byLevel.get(group.key) ?? []).sort((a, b) => a.name.localeCompare(b.name))
	})).filter((group) => group.skills.length > 0);
	const leftovers = [...byLevel.entries()].filter(([key]) => !known.has(key)).map(([key, list]) => ({
		key,
		title: key.startsWith("other:") ? `Other (${key.slice(6)})` : `Other (${key})`,
		hint: "",
		skills: list.sort((a, b) => a.name.localeCompare(b.name))
	}));
	return {
		cwd,
		projectRoots,
		complete,
		groups: [...groups, ...leftovers]
	};
}
/**
* Collect grouped skills: filesystem scanning (primary) + registry supplement.
* Filesystem entries win on name conflicts; the registry fills whenToUse and
* invocation flags, and contributes bundled/runtime entries of its own.
* @param options - collection options.
* @returns skills and whether the registry snapshot was complete.
*/
async function collectSkills(options) {
	const { cwd, customSkillDirs, dshHome, agentsHome, registry } = options;
	const byName = /* @__PURE__ */ new Map();
	const roots = new Set(options.projectRoots !== void 0 && options.projectRoots.length > 0 ? options.projectRoots : [findProjectRoot(cwd)]);
	const scanTasks = [];
	for (const root of roots) {
		scanTasks.push(scanSkillRoot(join(root, ".dsh", "skills"), "project-dsh", byName));
		scanTasks.push(scanSkillRoot(join(root, ".agents", "skills"), "project-agents", byName));
	}
	for (const dir of customSkillDirs ?? []) scanTasks.push(scanSkillRoot(dir, "custom", byName));
	scanTasks.push(scanSkillRoot(join(dshHome, "skills"), "user-dsh", byName));
	scanTasks.push(scanSkillRoot(join(agentsHome, "skills"), "user-agents", byName));
	await Promise.all(scanTasks);
	let complete = true;
	try {
		const snapshot = await registry.snapshot({ cwd });
		complete = snapshot.complete;
		for (const skill of snapshot.skills) {
			const existing = byName.get(skill.name);
			const serialized = serializeRegistry(skill);
			if (existing === void 0) byName.set(skill.name, serialized);
			else {
				if (serialized.whenToUse !== void 0) existing.whenToUse = serialized.whenToUse;
				if (serialized.provider !== void 0) existing.provider = serialized.provider;
				existing.modelInvocable = serialized.modelInvocable;
				existing.userInvocable = serialized.userInvocable;
			}
		}
	} catch {
		complete = false;
	}
	return {
		skills: [...byName.values()],
		complete
	};
}
/** Single-quote a YAML scalar (doubling embedded quotes); keeps the frontmatter parseable for values containing colons. */
function yamlQuote(value) {
	return `'${value.replace(/'/g, "''")}'`;
}
/** Build the new skill file content (create route). */
function buildSkillContent(name, description, whenToUse, content, disabled) {
	const lines = [
		"---",
		`name: ${name}`,
		`description: ${yamlQuote(description.replace(/[\r\n]/gu, " "))}`
	];
	if (typeof whenToUse === "string" && whenToUse.trim() !== "") lines.push(`whenToUse: ${yamlQuote(whenToUse.replace(/[\r\n]/gu, " "))}`);
	if (disabled === true) lines.push("disable-model-invocation: true");
	lines.push("---", "", content.trim(), "");
	return lines.join("\n");
}
/** Create a skill file (mkdir -p + write). Returns the absolute target path. */
async function writeSkillFile(baseDir, name, description, whenToUse, content) {
	const targetDir = join(baseDir, name);
	const target = join(targetDir, "SKILL.md");
	if (existsSync(target)) throw new Error(`skill ${name} already exists at ${target}`);
	await mkdir(targetDir, { recursive: true });
	await writeFile(target, buildSkillContent(name, description.trim(), whenToUse, content, false), "utf8");
	return target;
}
/** Move a skill file into its .trash sibling directory (recoverable delete). */
async function trashSkillFile(path) {
	const trashDir = join(dirname(path), ".trash");
	await mkdir(trashDir, { recursive: true });
	const trashTarget = join(trashDir, `${Date.now()}-SKILL.md`);
	await rename(path, trashTarget);
	return trashTarget;
}
/** User skill root convention. */
function userSkillRoot(dshHome) {
	return join(dshHome, "skills");
}
/** Project skill root convention (project root + .dsh/skills). */
function projectSkillRoot(projectRoot) {
	return `${projectRoot}${sep}.dsh${sep}skills`;
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
//#region src/routes.ts
/** Route paths (client bundle mirrors these literals; tests assert both sides). */
const ROUTES = {
	list: "/api/dsh-skill-explorer/list",
	setEnabled: "/api/dsh-skill-explorer/set-enabled",
	create: "/api/dsh-skill-explorer/create",
	delete: "/api/dsh-skill-explorer/delete",
	health: "/api/dsh-skill-explorer/health"
};
/** URL query helper (first value, decoded). */
function queryParam(url, name) {
	const value = url.searchParams.get(name);
	return value === null ? void 0 : value;
}
/** Skill name pattern shared by the routes (kebab-case). */
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
/** Default process cwd fallback (overridable in tests). */
const DEFAULT_CWD = () => process.cwd();
/**
* Build every /api/dsh-skill-explorer route (exact paths).
* @param ctx - host context; may expose remoteWebUiPairing.
* @param deps - dshHome/agentsHome/registry/sessions.
* @returns the route list for ctx.webServer.register.
*/
function makeRoutes(ctx, deps) {
	const { dshHome, agentsHome, customSkillDirs, registry, activeSessionCwds, logger } = deps;
	/** Guard helper: fence + method check. */
	const guard = (req, res, method) => {
		if (!isSkillExplorerAllowed(ctx, req)) {
			writeJson(res, 403, { error: "forbidden: loopback-only" });
			return false;
		}
		if (req.method !== method) {
			writeJson(res, 405, { error: `method not allowed: ${req.method}` });
			return false;
		}
		return true;
	};
	/** Active session project roots (degraded to [] when sessions throw). */
	const sessionProjectRoots = () => {
		try {
			return activeSessionCwds().map((sessionCwd) => findProjectRoot(sessionCwd));
		} catch {
			return [];
		}
	};
	/** Collect options shared by list/set-enabled/delete/health handlers. */
	const collectOptions = (cwd) => ({
		cwd,
		projectRoots: sessionProjectRoots(),
		customSkillDirs,
		dshHome,
		agentsHome,
		registry
	});
	/** Find a skill by name from a fresh collection pass (trusts scanned paths only). */
	const findSkill = async (name, cwd) => {
		const { skills } = await collectSkills(collectOptions(cwd));
		return skills.find((candidate) => candidate.name === name);
	};
	/** Resolve the exact editable file shown by the client, rejecting stale same-name fallbacks. */
	const resolveMutationSkill = async (name, expectedPath, cwd, res) => {
		const skill = await findSkill(name, cwd);
		if (skill?.path === void 0) {
			writeJson(res, 404, { error: `skill ${name} has no editable file` });
			return;
		}
		if (skill.path !== expectedPath) {
			writeJson(res, 409, { error: `skill ${name} changed since the panel loaded; refresh and retry` });
			return;
		}
		return skill;
	};
	return [
		{
			kind: "exact",
			path: ROUTES.list,
			handler: async (req, res) => {
				if (!guard(req, res, "GET")) return;
				try {
					const cwd = queryParam(new URL(req.url ?? "/", "http://x"), "cwd") ?? DEFAULT_CWD();
					const projectRoots = sessionProjectRoots();
					const { skills, complete } = await collectSkills(collectOptions(cwd));
					writeJson(res, 200, buildPayload(skills, complete, cwd, [...new Set(projectRoots)]));
				} catch (error) {
					logger.warn(error);
					writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
				}
			}
		},
		{
			kind: "exact",
			path: ROUTES.setEnabled,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				try {
					const body = await readJsonBody(req, {
						maxBytes: 128 * 1024,
						objectOnly: true
					});
					if (body === null) {
						writeJson(res, 400, { error: "invalid JSON body" });
						return;
					}
					const { name, path, enabled } = body;
					if (typeof name !== "string" || !NAME_PATTERN.test(name) || typeof path !== "string" || path.trim() === "" || typeof enabled !== "boolean") {
						writeJson(res, 400, { error: "expected { name, path, enabled }" });
						return;
					}
					const skill = await resolveMutationSkill(name, path, DEFAULT_CWD(), res);
					if (skill === void 0) return;
					const frontmatter = setFrontmatterField(skill.path, "disable-model-invocation", enabled ? false : true);
					writeJson(res, 200, {
						name,
						enabled: frontmatter.disableModelInvocation !== true,
						modelInvocable: frontmatter.disableModelInvocation !== true,
						path: skill.path
					});
				} catch (error) {
					logger.warn(error);
					writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
				}
			}
		},
		{
			kind: "exact",
			path: ROUTES.create,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				try {
					const body = await readJsonBody(req, {
						maxBytes: 128 * 1024,
						objectOnly: true
					});
					if (body === null) {
						writeJson(res, 400, { error: "invalid JSON body" });
						return;
					}
					const { root, name, description, whenToUse, content, cwd } = body;
					if (root !== "user" && root !== "project") {
						writeJson(res, 400, { error: "root must be user (~/.dsh/skills) or project (project .dsh/skills)" });
						return;
					}
					if (typeof cwd !== "string" || cwd.trim() === "") {
						writeJson(res, 400, { error: "cwd is required (the workspace shown by the panel)" });
						return;
					}
					if (typeof name !== "string" || !NAME_PATTERN.test(name)) {
						writeJson(res, 400, { error: "name must be kebab-case (lowercase letters/digits first)" });
						return;
					}
					if (typeof description !== "string" || description.trim() === "") {
						writeJson(res, 400, { error: "description is required" });
						return;
					}
					if (typeof content !== "string" || content.trim() === "") {
						writeJson(res, 400, { error: "content is required" });
						return;
					}
					if (Buffer.byteLength(content, "utf8") > 64 * 1024) {
						writeJson(res, 400, { error: "content exceeds 64KB limit" });
						return;
					}
					writeJson(res, 200, {
						ok: true,
						name,
						path: await writeSkillFile(root === "user" ? userSkillRoot(dshHome) : projectSkillRoot(findProjectRoot(cwd)), name, description, typeof whenToUse === "string" ? whenToUse : void 0, content)
					});
				} catch (error) {
					if (error instanceof Error && /already exists/.test(error.message)) {
						writeJson(res, 409, { error: error.message });
						return;
					}
					logger.warn(error);
					writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
				}
			}
		},
		{
			kind: "exact",
			path: ROUTES.delete,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				try {
					const body = await readJsonBody(req, {
						maxBytes: 128 * 1024,
						objectOnly: true
					});
					if (body === null) {
						writeJson(res, 400, { error: "invalid JSON body" });
						return;
					}
					const { name, path } = body;
					if (typeof name !== "string" || !NAME_PATTERN.test(name) || typeof path !== "string" || path.trim() === "") {
						writeJson(res, 400, { error: "expected { name, path }" });
						return;
					}
					const skill = await resolveMutationSkill(name, path, DEFAULT_CWD(), res);
					if (skill === void 0) return;
					if (skill.linked === true) {
						writeJson(res, 400, { error: `skill ${name} is a linked skill and cannot be deleted` });
						return;
					}
					writeJson(res, 200, {
						ok: true,
						name,
						moved: await trashSkillFile(skill.path)
					});
				} catch (error) {
					logger.warn(error);
					writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
				}
			}
		},
		{
			kind: "exact",
			path: ROUTES.health,
			handler: async (req, res) => {
				if (!guard(req, res, "GET")) return;
				try {
					const { skills } = await collectSkills(collectOptions(DEFAULT_CWD()));
					writeJson(res, 200, {
						ok: true,
						plugin: "skill-explorer",
						skills: skills.length
					});
				} catch (error) {
					logger.warn(error);
					writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
				}
			}
		}
	];
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
* skill-explorer — host half. Serves the skill center data source: the
* /api/dsh-skill-explorer route family (list grouped by source, set enabled,
* create, delete, health) over the shared trust fence (loopback by default;
* a live paired-device cookie is an extra allow path). The browser half
* (./client) renders the skill center panel.
*
* Ported from the local dsh-skill-explorer plugin; everything rides official
* NPM SDK packages — no dsh source changes.
*/
/** Stable cordis plugin name. */
const name = "skill-explorer";
/** Services required before the skill center routes can mount. */
const inject = [
	"webServer",
	"skills",
	"sessions"
];
/**
* Mount the skill center routes (trust fence looks up remoteWebUiPairing on ctx).
* @param ctx - host plugin context carrying webServer/skills/sessions.
* @param config - resolved plugin config.
*/
function applyImpl(ctx, config) {
	if (config?.enabled === false) return;
	const skillCtx = ctx;
	const dshHome = config?.dshHome ?? process.env.DSH_HOME ?? homedir() + sep + ".dsh";
	const agentsHome = config?.agentsHome ?? process.env.DSH_AGENTS_HOME ?? homedir() + sep + ".agents";
	const customSkillDirs = Array.isArray(config?.customSkillDirs) ? config.customSkillDirs : [];
	/** Active session workspace cwds (degraded to [] when the registry is unavailable). */
	const activeSessionCwds = () => {
		try {
			const sessions = skillCtx.sessions;
			if (typeof sessions?.list !== "function") return [];
			return sessions.list().map((session) => session.header?.cwd).filter((cwd) => typeof cwd === "string" && cwd !== "");
		} catch {
			return [];
		}
	};
	const routes = makeRoutes(ctx, {
		dshHome,
		agentsHome,
		customSkillDirs,
		registry: skillCtx.skills,
		activeSessionCwds,
		logger: { warn: (error) => ctx.logger.warn(error) }
	});
	ctx.effect(() => {
		const disposers = routes.map((route) => ctx.webServer.register(route));
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "skill-explorer: routes");
}
/**
* Single-instance guard shared by the plugin family: the aggregate bundle
* (dsh-web-ui-all) and a standalone install of this package can coexist in
* one profile, so the second host apply must be a no-op instead of
* re-registering the same routes and failing the boot.
*/
const apply = mountOnce("@linxin666/dsh-client-ui-skill-explorer", applyImpl);
//#endregion
export { ROUTES, apply, inject, name };
