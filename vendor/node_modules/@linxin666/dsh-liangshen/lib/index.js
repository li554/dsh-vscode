import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Service } from "@deepseek-ai/cordis";
import z from "schemastery";
import { homedir } from "node:os";
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-settings@0.1.1-rc.2_@deepseek-ai+cordis@4.0.1_@deepseek-ai+dsh-brand@0_02aaf429ec98c58247037e2222c17a8f/node_modules/@deepseek-ai/dsh-settings/lib/index.js
/**
* Structural secret redaction for settings values. `role('secret')` fields are
* removed from a value before it crosses a wire boundary; a sidecar records
* each schema-declared secret position and whether it currently holds a value,
* so a configuration surface can render a write-only input without ever
* receiving the secret itself.
* @module @deepseek-ai/dsh-settings/redact
*/
/** Whether a value is a plain data object the walker may recurse into. */
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function walk(node, value, path, secrets) {
	if (node === void 0) return value;
	if (node.meta?.role === "secret") {
		secrets.push({
			path,
			set: value !== void 0
		});
		return;
	}
	switch (node.type) {
		case "object": {
			const properties = node.dict ?? {};
			const source = isRecord(value) ? value : void 0;
			const rebuilt = {};
			if (source !== void 0) for (const [key, entry] of Object.entries(source)) {
				if (key in properties) continue;
				rebuilt[key] = entry;
			}
			for (const [key, child] of Object.entries(properties)) {
				const stripped = walk(child, source?.[key], [...path, key], secrets);
				if (stripped !== void 0) rebuilt[key] = stripped;
			}
			return source === void 0 && Object.keys(rebuilt).length === 0 ? value : rebuilt;
		}
		case "dict": {
			if (!isRecord(value)) return value;
			const rebuilt = {};
			for (const [key, entry] of Object.entries(value)) {
				const stripped = walk(node.inner, entry, [...path, key], secrets);
				if (stripped !== void 0) rebuilt[key] = stripped;
			}
			return rebuilt;
		}
		case "array":
			if (!Array.isArray(value)) return value;
			return value.map((entry, index) => walk(node.inner, entry, [...path, String(index)], secrets));
		default: return value;
	}
}
/**
* Service Definition for the user-settings capability seam (`ctx.settings`). Providers store one raw document of
* per-namespace sections; plugins register a namespace schema and read the
* resolved value, which layers schema defaults, the registrant's composition
* `base`, and the user document section, in that order.
* @module @deepseek-ai/dsh-settings
*/
const NAMESPACE_PATTERN = /^[a-z][a-z0-9-]*$/;
/**
* Brand a raw string as a {@link SettingsNamespace}.
* @param value - candidate namespace; lowercase kebab-case, as in plugin short names.
* @returns the branded namespace.
*/
function settingsNamespace(value) {
	if (!NAMESPACE_PATTERN.test(value)) throw new TypeError(`settings namespace "${value}" must match ${String(NAMESPACE_PATTERN)}`);
	return value;
}
/**
* Deep equality over JSON-compatible data (objects, arrays, primitives) — the
* Service Definition's single change-detection predicate, exported so the invariant
* companion checks exactly the implementation's relation.
* @param a - one JSON-compatible value.
* @param b - the other JSON-compatible value.
* @returns whether the two values are structurally equal.
*/
function deepEqualJson(a, b) {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((entry, index) => deepEqualJson(entry, b[index]));
	}
	const left = a;
	const right = b;
	const keys = Object.keys(left);
	if (keys.length !== Object.keys(right).length) return false;
	return keys.every((key) => key in right && deepEqualJson(left[key], right[key]));
}
/** Whether a value is a plain data object (not an array, null, or class instance). */
function isPlainObject(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}
/** Apply one path op to a detached section, returning the next section. */
function applyPathOp(section, op) {
	const [head, ...rest] = op.path;
	if (head === void 0) {
		if (op.op === "unset") return {};
		if (!isPlainObject(op.value)) throw new TypeError("settings mutate: setting the section root requires a plain object");
		return { ...op.value };
	}
	if (rest.length === 0) {
		if (op.op === "set") return {
			...section,
			[head]: op.value
		};
		const { [head]: _removed, ...kept } = section;
		return kept;
	}
	const child = section[head];
	if (!isPlainObject(child)) {
		if (op.op === "unset") return section;
		return {
			...section,
			[head]: applyPathOp({}, {
				...op,
				path: rest
			})
		};
	}
	return {
		...section,
		[head]: applyPathOp(child, {
			...op,
			path: rest
		})
	};
}
/**
* Layer `over` onto `under`: plain objects merge recursively, every other
* value (arrays included) replaces the lower layer wholesale. `over` never
* carries `undefined` entries — sections come from parsed documents and write
* snapshots pass {@link cloneJsonShaped}, which strips them so a sparse patch
* cannot erase lower keys.
*/
function mergeLayers(under, over) {
	if (over === void 0) return under;
	if (!isPlainObject(under) || !isPlainObject(over)) return over;
	const merged = { ...under };
	for (const [key, value] of Object.entries(over)) merged[key] = key in merged ? mergeLayers(merged[key], value) : value;
	return merged;
}
/** Recursively freeze one resolved value so handed-out snapshots stay immutable. */
function deepFreeze(value) {
	if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
	for (const entry of Object.values(value)) deepFreeze(entry);
	return Object.freeze(value);
}
Service.init;
/**
* Value mirror of the `FiberState` members {@link isUnloading} compares
* against: a const enum has no runtime object to import, and the value is
* needed at runtime (same rationale as the CLI boot driver's mirror).
*/
const FIBER_DISPOSED = 4;
const FIBER_UNLOADING = 5;
/** Whether the consumer's own fiber is tearing down (not just losing the settings service). */
function isUnloading(ctx) {
	const state = ctx.fiber.state;
	return state === FIBER_UNLOADING || state === FIBER_DISPOSED;
}
/**
* Install the canonical optional-settings consumer wiring: while a settings
* service exists, register `ns` with the consumer's composition entry as the
* `base` layer and point the source thunk at the resolved scope; when the
* service goes away (disposal, provider reload), fall back to the entry so
* the consumer keeps working exactly as composed. The registration rides the
* scoped fiber, so no settings service ever mounted means none of this runs.
* @param ctx - consumer plugin context owning the wiring.
* @param ns - the consumer-owned settings namespace.
* @param schema - schema resolving the namespace (typically the plugin Config).
* @param entry - the consumer's composition entry config, used as `base`.
* @param hooks - source sink and change notification.
*/
function installSettingsSection(ctx, ns, schema, entry, hooks) {
	ctx.inject(["settings"], (sctx) => {
		const scope = sctx.settings.register(ns, schema, {
			base: entry,
			...hooks.validate === void 0 ? {} : { validate: hooks.validate }
		});
		hooks.setSource(() => scope.get());
		sctx.effect(() => () => {
			if (isUnloading(ctx)) return;
			hooks.setSource(() => entry);
			hooks.onChange();
		});
		hooks.onChange();
		scope.watch(() => {
			if (isUnloading(ctx)) return;
			hooks.onChange();
		});
	});
}
//#endregion
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
/** Resolve the DSH home directory from the live environment. */
function dshHome() {
	return resolveDshHome();
}
//#endregion
//#region src/schema.ts
/**
* Structural validation for a bundled `agent.cordis.yml`.
*
* Deliberately dependency-free: it parses only the flat row metadata the sync
* and the dsh agent-presets loader rely on. Every top-level row is written as
* `- id: <id>` at column zero, with the `name`/`group`/`disabled` keys at two
* spaces of indentation. Nested `config:` and `isolate:` bodies are opaque to
* this validator — the dsh loader checks their semantics.
*
* Returns the list of problems found; an empty array means the document is
* structurally valid.
*/
/** A top-level row opener: `- id: <id>` (id may be blank for diagnostics). */
const ROW_RE = /^-\s+id:\s*(.*)$/;
/** Any top-level list item, for ids missing from a row opener. */
const ITEM_RE = /^-\s/;
/** A two-space-indented flat metadata key: `  name: <value>`. */
const META_RE = /^ {2}([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/;
/** The only `name` forms the dsh agent-presets loader mounts from a row. */
const NAME_PREFIX_RE = /^(\.\/|@|cordis:)/;
/** Strip one pair of surrounding single or double quotes from a scalar. */
function unquote(value) {
	if (value.length >= 2) {
		const first = value[0];
		if ((first === "'" || first === "\"") && value.endsWith(first)) return value.slice(1, -1);
	}
	return value;
}
/**
* Validate the structural contract of an `agent.cordis.yml` document.
* @param text - the raw YAML document text.
* @returns a list of human-readable problems; empty means valid.
*/
function validateAgentCordis(text) {
	const errors = [];
	const normalized = text.replace(/\r\n/g, "\n");
	if (normalized.trim() === "") return ["document is empty"];
	const seenIds = /* @__PURE__ */ new Set();
	const current = {
		id: null,
		name: null,
		group: null
	};
	const closeRow = () => {
		if (current.id === null) return;
		if (current.name === null) errors.push(`row "${current.id}": missing "name" key`);
		else if (!NAME_PREFIX_RE.test(current.name)) errors.push(`row "${current.id}": name "${current.name}" must start with "./", "@" or "cordis:"`);
		if (current.group === "true" && current.name !== "cordis:group") errors.push(`row "${current.id}": "group: true" requires name "cordis:group"`);
		current.name = null;
		current.group = null;
		current.id = null;
	};
	const lines = normalized.split("\n");
	for (let index = 0; index < lines.length; index += 1) {
		const lineNo = index + 1;
		const line = lines[index];
		const trimmed = line.trim();
		if (trimmed === "" || trimmed.startsWith("#")) continue;
		const row = ROW_RE.exec(line);
		if (row !== null) {
			closeRow();
			const id = row[1].trim();
			if (id === "") {
				errors.push(`line ${lineNo}: empty row id`);
				current.id = null;
			} else {
				if (seenIds.has(id)) errors.push(`line ${lineNo}: duplicate row id "${id}"`);
				seenIds.add(id);
				current.id = id;
			}
			current.name = null;
			current.group = null;
			continue;
		}
		if (current.id === null) {
			if (ITEM_RE.test(line)) errors.push(`line ${lineNo}: list item does not declare an "id:"`);
			else if (/^\S/.test(line)) errors.push(`line ${lineNo}: content outside a "- id:" row`);
			continue;
		}
		const meta = META_RE.exec(line);
		if (meta !== null) {
			const value = unquote(meta[2].trim());
			if (meta[1] === "name") current.name = value;
			else if (meta[1] === "group") current.group = value;
			continue;
		}
		if (/^ {2}/.test(line)) continue;
		errors.push(`line ${lineNo}: unexpected content in row "${current.id}"`);
	}
	closeRow();
	return errors;
}
//#endregion
//#region src/sync.ts
/**
* Sync every preset directory under `sourceRoot` into `targetRoot` — the
* dsh agent-presets discovery root (harness-home `.agent-presets`).
*
* A preset is a directory holding `agent.cordis.yml`; the directory name is
* the preset id. Copy is per-directory and idempotent: a preset whose target
* tree is byte-identical to the source tree is skipped, otherwise the source
* tree is copied and any target files the source does not contain are removed.
* Directories the plugin does not own (other presets the user authored) are
* never touched.
*
* After a preset is synced its `agent.cordis.yml` is validated against the
* structural preset schema; a validation failure is reported through the
* run's `failed` entries instead of being a warn-only side effect, so callers
* can observe (and surface) a broken preset rather than silently shipping it.
*/
/**
* Clock/coarse-grain tolerance for the mtime fast path. When a source and a
* target file share a size and a near-identical mtime we still fall through to
* a byte comparison; a mtime gap beyond this simply proves the pair cannot be
* byte-identical, so we skip the read.
*/
const MTIME_TOLERANCE_MS = 1e3;
function filesUnder(root) {
	const out = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir)) {
			const path = join(dir, entry);
			if (statSync(path).isDirectory()) walk(path);
			else out.push(path);
		}
	};
	walk(root);
	return out;
}
/**
* File identity is bytes. Size and mtime are only a fast negative check: a
* size mismatch or a mtime gap beyond the tolerance proves the pair cannot be
* byte-identical without reading both, but an equal size and close mtime still
* fall through to a byte comparison so content differences are never missed.
*/
function sameFile(a, b) {
	const sourceStat = statSync(a);
	const targetStat = statSync(b);
	if (sourceStat.size !== targetStat.size) return false;
	if (Math.abs(sourceStat.mtimeMs - targetStat.mtimeMs) > MTIME_TOLERANCE_MS) return false;
	return readFileSync(a).equals(readFileSync(b));
}
/**
* Remove files not in `keep` (relative paths), then remove only the
* directories those removals left empty — still strictly inside `root`, so
* sibling presets are never touched.
*/
function pruneExtras(root, keep) {
	const parents = /* @__PURE__ */ new Set();
	for (const file of filesUnder(root)) if (!keep.has(relative(root, file))) {
		parents.add(dirname(file));
		rmSync(file, { force: true });
	}
	for (const start of parents) {
		let dir = start;
		while (dir !== void 0 && relative(root, dir) !== "") if (existsSync(dir) && readdirSync(dir).length === 0) {
			rmSync(dir, {
				recursive: true,
				force: true
			});
			dir = dirname(dir);
		} else dir = void 0;
	}
}
/** Validate the synced preset's `agent.cordis.yml` artifact on disk. */
function validatePresetAgentFile(presetDir) {
	const agent = join(presetDir, "agent.cordis.yml");
	if (!existsSync(agent)) return ["agent.cordis.yml is missing from the preset tree"];
	return validateAgentCordis(readFileSync(agent, "utf8"));
}
/**
* Copy the whole tree under `sourceDir` into `targetDir`, creating the target
* directory as needed. Intentionally not `fs.cpSync` (recursive): on Node 22
* for Windows, `fs.cpSync` with `recursive: true` crashes the process with a
* fatal error (STATUS_STACK_BUFFER_OVERRUN / 0xC0000409, no JS exception is
* thrown) whenever the source path contains non-ASCII characters such as a
* CJK home directory (nodejs/node#54476, regression from nodejs/node#53614).
* Since `engines` supports Node ^22.19.0, this must work on Node 22, so the
* copy is done with the same per-entry primitives the rest of the module
* already uses. Source mtimes are preserved to keep the `preserveTimestamps`
* contract of the previous `cpSync` call.
*/
function copyTreeSync(sourceDir, targetDir) {
	mkdirSync(targetDir, { recursive: true });
	for (const entry of readdirSync(sourceDir)) {
		const source = join(sourceDir, entry);
		const target = join(targetDir, entry);
		const stat = statSync(source);
		if (stat.isDirectory()) copyTreeSync(source, target);
		else {
			copyFileSync(source, target);
			utimesSync(target, stat.atime, stat.mtime);
		}
	}
}
/** Copy `sourceRoot/<id>` into `targetRoot/<id>`, idempotently. */
function syncOnePreset(sourceDir, targetDir) {
	const sourceFiles = filesUnder(sourceDir);
	const sourceSet = new Set(sourceFiles.map((file) => relative(sourceDir, file)));
	if (existsSync(targetDir) && !statSync(targetDir).isDirectory()) rmSync(targetDir, {
		recursive: true,
		force: true
	});
	if (!existsSync(targetDir)) {
		copyTreeSync(sourceDir, targetDir);
		pruneExtras(targetDir, sourceSet);
		return "synced";
	}
	let dirty = false;
	for (const file of sourceFiles) {
		const dest = join(targetDir, relative(sourceDir, file));
		if (!existsSync(dest) || !sameFile(file, dest)) {
			dirty = true;
			break;
		}
	}
	if (!dirty) {
		for (const file of filesUnder(targetDir)) if (!sourceSet.has(relative(targetDir, file))) {
			dirty = true;
			break;
		}
	}
	if (!dirty) return "current";
	pruneExtras(targetDir, sourceSet);
	copyTreeSync(sourceDir, targetDir);
	pruneExtras(targetDir, sourceSet);
	return "synced";
}
/**
* Sync every preset under `sourceRoot` into `targetRoot`, then remove
* target directories named in `retire` that the bundle no longer ships —
* preset ids the plugin once owned and later dropped. Only those exact ids
* are removed; every other target directory is left untouched.
*
* Each synced (or already-current) preset is validated against the structural
* `agent.cordis.yml` schema; a validation failure lands in `failed` so the
* caller can surface a broken preset as a first-class result instead of a
* warn-only log line.
* @param sourceRoot - plugin-owned preset tree (bundled in the package).
* @param targetRoot - dsh agent-presets discovery root (e.g. <home>/.dsh/.agent-presets).
* @param retire - previously bundled preset ids to remove when absent from the source.
*/
function syncPresetTrees(sourceRoot, targetRoot, retire = []) {
	const result = {
		synced: [],
		current: [],
		failed: [],
		retired: []
	};
	mkdirSync(targetRoot, { recursive: true });
	if (existsSync(sourceRoot)) for (const entry of readdirSync(sourceRoot)) {
		const source = join(sourceRoot, entry);
		if (!statSync(source).isDirectory()) continue;
		const id = basename(source);
		const targetDir = join(targetRoot, id);
		let outcome;
		try {
			outcome = syncOnePreset(source, targetDir);
		} catch (error) {
			result.failed.push({
				id,
				error: error instanceof Error ? error.message : String(error)
			});
			continue;
		}
		try {
			const problems = validatePresetAgentFile(targetDir);
			if (problems.length > 0) result.failed.push({
				id,
				error: `agent.cordis.yml failed validation: ${problems.join("; ")}`
			});
			else if (outcome === "synced") result.synced.push(id);
			else result.current.push(id);
		} catch (error) {
			result.failed.push({
				id,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
	for (const id of retire) {
		if (existsSync(join(sourceRoot, id))) continue;
		const stale = join(targetRoot, id);
		if (existsSync(stale) && statSync(stale).isDirectory()) {
			rmSync(stale, {
				recursive: true,
				force: true
			});
			result.retired.push(id);
		}
	}
	return result;
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
* dsh-liangshen — LiangShen (梁神) agent preset plugin.
*
* Host half only: on startup it syncs the bundled `presets/` tree into the
* harness-home agent-presets root (`~/.dsh/.agent-presets`), making the
* LiangShen preset selectable for new sessions without copying files by hand.
* The capability announcement is a system-prompt section that ships OFF by
* default (`announceToAgent: false`) and can be enabled in the web settings
* surface (plugin config) or the profile patch. No browser half, no routes,
* no agent tools — the preset itself provides the tools.
*
* The preset is the "anchored-standard" idea shipped as a named mode: the
* first model request sees only the builtin Minimal preset's exact two tools
* (persistent `bash` plus `str_replace_editor`), and after the anchor the
* wire switches to PTC Mode. Derived from
* https://github.com/xiaobright/dsh-anchored-standard (MIT).
*/
/** Stable cordis plugin name. */
const name = "liangshen";
/** Settings namespace of the plugin (the web settings surface edits it). */
const LIANGSHEN_SETTINGS_NAMESPACE = settingsNamespace("dsh-liangshen");
/** Prompt assembly must exist before the announcement section can register. */
const inject = ["systemPrompt"];
const Config = z.object({
	enabled: z.boolean().default(true),
	announceToAgent: z.boolean().default(false)
});
/** Schema default, re-read for hand-built test contexts. */
const DEFAULT_ANNOUNCE = false;
/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 150;
/** Model-facing announcement: plugin presence, principle, and limits. */
const LIANGSHEN_GUIDANCE = "本机已安装 dsh-liangshen 插件（梁神模式 agent preset）：新建会话的预设选择器中可选「梁神模式」。原理：两阶段锚定——首轮模型请求仅暴露官方 Minimal 精确双工具（持久 bash 与 str_replace_editor，文件工具继承宿主沙箱），只保留一行 persona，清空运行时上下文并只放行白名单消息（用户直接消息与 /goal 自动轮次），锚定 Minimal 推理轨迹；晋升受首块锚定门控（首块包含 we 且无 let me，四步兜底），无工具首轮会在响应后自动晋升，晋升后 wire 切换为 PTC Mode（单一 run_code）并在 persona 追加所选工作区路径，workspace 指令与 skill 目录在晋升后再延迟一步注入。preset 文件由插件维护于 ~/.dsh/.agent-presets，升级插件时自动更新；默认预设由用户自行选择。用户提到「梁神模式 / 锚定模式 / anchored standard」时即指本插件，请据此协作。";
/** Absolute path of the bundled preset tree inside this package. */
function bundledPresetsRoot() {
	return fileURLToPath(new URL("../presets/", import.meta.url));
}
/**
* Mount the plugin: sync bundled presets into the harness-home agent-presets
* root, register the settings namespace (enabled / announceToAgent, live),
* and announce through a system-prompt section when announceToAgent is on
* (off by default).
* @param ctx - host plugin context carrying systemPrompt.
* @param config - resolved plugin config (schema defaults applied by the loader).
*/
const apply = mountOnce("@linxin666/dsh-liangshen", applyImpl);
function applyImpl(ctx, config) {
	let current = () => config ?? {};
	const resolve = () => ({
		announceToAgent: current().announceToAgent ?? DEFAULT_ANNOUNCE,
		enabled: current().enabled ?? true
	});
	const sync = () => {
		const targetRoot = join(dshHome(), ".agent-presets");
		try {
			mkdirSync(targetRoot, { recursive: true });
			const result = syncPresetTrees(bundledPresetsRoot(), targetRoot, ["liangshen-exact"]);
			for (const { id, error } of result.failed) ctx.logger?.warn?.(`dsh-liangshen: preset ${id} sync failed: ${error}`);
			if (result.synced.length > 0) ctx.logger?.info?.(`dsh-liangshen: presets synced into ${targetRoot}: ${result.synced.join(", ")}`);
			if (result.retired.length > 0) ctx.logger?.info?.(`dsh-liangshen: retired stale presets from ${targetRoot}: ${result.retired.join(", ")}`);
		} catch (error) {
			ctx.logger?.warn?.(`dsh-liangshen: preset sync failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	};
	let disposeSection;
	const refresh = () => {
		disposeSection?.();
		disposeSection = void 0;
		if (!resolve().enabled) return;
		sync();
		if (resolve().announceToAgent) disposeSection = ctx.systemPrompt.section({
			name: "plugin:dsh-liangshen",
			order: SECTION_ORDER,
			text: LIANGSHEN_GUIDANCE
		});
	};
	installSettingsSection(ctx, LIANGSHEN_SETTINGS_NAMESPACE, Config, config ?? {}, {
		setSource: (source) => {
			current = source;
			refresh();
		},
		onChange: refresh
	});
	refresh();
	ctx.effect(() => () => {
		disposeSection?.();
		disposeSection = void 0;
	}, "dsh-liangshen: announcement");
}
//#endregion
export { Config, LIANGSHEN_GUIDANCE, LIANGSHEN_SETTINGS_NAMESPACE, apply, bundledPresetsRoot, dshHome, inject, name };
