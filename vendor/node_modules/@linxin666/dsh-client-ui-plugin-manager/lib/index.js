import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join, posix, win32 } from "node:path";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import { homedir } from "node:os";
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
//#region src/core/patch-diff.ts
/**
* Diff two layer snapshots by id. Only entries whose membership state moved
* are reported; unchanged entries are skipped.
* @param before - snapshot taken before the operation.
* @param after - snapshot taken after the operation.
* @returns one change per moved id, sorted by id.
*/
function diffLayer(before, after) {
	const ids = /* @__PURE__ */ new Set();
	for (const id of before.rows.keys()) ids.add(id);
	for (const id of after.rows.keys()) ids.add(id);
	for (const bundle of before.bundles) ids.add(bundle);
	for (const bundle of after.bundles) ids.add(bundle);
	const stateOf = (snapshot, id) => {
		const row = snapshot.rows.get(id);
		if (row !== void 0) return row ? "enabled" : "disabled";
		if (snapshot.bundles.includes(id)) return "enabled";
		return "uninstalled";
	};
	const changes = [];
	for (const id of ids) {
		const from = stateOf(before, id);
		const to = stateOf(after, id);
		if (from !== to) changes.push({
			id,
			from,
			to
		});
	}
	return changes.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
/**
* Drop the normal install outcome — entries that merely appear (a new plugin
* mounting is the point of an install, not a conflict) — and keep every
* change to an entry that existed before.
* @param changes - the raw layer diff.
* @returns the conflict-worthy changes.
*/
function significantChanges(changes) {
	return changes.filter((change) => !(change.from === "uninstalled" && change.to === "enabled"));
}
/**
* The ids of `claimed` already held by another entry. Bundle rows with the
* same insert id double-mount at the next boot (duplicate entry id), so an
* install claiming a taken id is a boot-blocking conflict.
* @param claimed - the new plugin's claimed entry ids.
* @param taken - every id already claimed by other plugins and patch rows.
* @returns the overlapping ids, in claim order.
*/
function overlappingIds(claimed, taken) {
	return claimed.filter((id) => taken.has(id));
}
//#endregion
//#region src/host/rows.ts
/**
* Profile patch-row editing for the gateway host half. The npm web loader
* honors `disabled` on rows and applies the profile patch as the user layer,
* so next-start enablement is a bare `{ id, name, disabled }` override row —
* the same id-targeted, later-wins semantics the official desktop writer
* uses. Editing goes through the `yaml` document round-trip, which preserves
* comments and unrelated rows byte-for-byte in spirit; the !!js expression
* tag keeps loader expressions literal so profiles carrying them stay
* parseable.
* @module @linxin666/dsh-client-ui-plugin-manager/host
*/
/**
* Persist one patch file conservatively: a timestamped-free single backup,
* then a tmp write and an atomic-ish rename over the target.
* @param patchPath - absolute cordis.patch.yml path.
* @param text - the new file text.
*/
async function writePatchAtomic(patchPath, text) {
	await copyFile(patchPath, `${patchPath}.bak-plugin-manager`).catch(() => {});
	await writeFile(`${patchPath}.tmp`, text, { mode: 384 });
	await rename(`${patchPath}.tmp`, patchPath);
}
/** YAML `!!js` expression tag: expressions stay literal until the Loader evaluates them. */
const JS_EXPRESSION_TAG = {
	tag: "tag:yaml.org,2002:js",
	resolve: (value) => value
};
/**
* Parse a patch file, failing loud on invalid YAML and non-array roots.
* @param text - file content.
* @param filename - absolute cordis.patch.yml path (diagnostics only).
* @returns the parsed document and root sequence.
*/
function parsePatch(text, filename) {
	const document = parseDocument(text, {
		customTags: [JS_EXPRESSION_TAG],
		prettyErrors: true,
		uniqueKeys: true
	});
	if (document.errors.length > 0) {
		const firstError = document.errors[0];
		throw new Error(`plugin-manager: cannot parse ${filename}: ${firstError?.message ?? "invalid YAML"}`);
	}
	const root = document.contents;
	if (!isSeq(root)) throw new Error(`plugin-manager: ${filename} must contain a top-level YAML array`);
	return {
		document,
		root
	};
}
/** Whether a root item is a plain map row (not an insert-list wrapper). */
function isBareRow(item) {
	return isMap(item) && !item.has("insert");
}
/** The string id of a bare row, when it carries one. */
function bareRowId(item) {
	if (!isBareRow(item)) return void 0;
	const id = item.get("id", true);
	return isScalar(id) && typeof id.value === "string" ? id.value : void 0;
}
/** The string name of a bare row, when it carries one. */
function bareRowName(item) {
	if (!isBareRow(item)) return void 0;
	const name = item.get("name", true);
	return isScalar(name) && typeof name.value === "string" ? name.value : void 0;
}
/**
* The next-start enablement a bare row declares: a row is enabled unless it
* carries an explicit `disabled: true` (mirrors the official reader). Non-row
* items (insert wrappers, config rows) count as enabled.
* @param item - one top-level patch item.
* @returns whether the item leaves its entry enabled.
*/
function bareRowEnabled(item) {
	if (!isBareRow(item)) return true;
	const disabled = item.get("disabled", true);
	return !(isScalar(disabled) && disabled.value === true);
}
/**
* Find the bare override row for one id.
* @param root - the top-level sequence.
* @param id - the entry id to match.
* @returns the row and its index, or undefined.
*/
function findBareRow(root, id) {
	const index = root.items.findIndex((item) => isBareRow(item) && bareRowId(item) === id);
	if (index === -1) return void 0;
	const row = root.items[index];
	return isMap(row) ? {
		row,
		index
	} : void 0;
}
/**
* The ids an installed package's own bundle patch claims, read from its
* cordis.patch.yml (each insert entry carries an id). An empty result means
* the package is a plain plugin whose row id is its package name.
* @param patchText - the package's own bundle patch text (`[]` for none).
* @returns the claimed insert ids, in order.
*/
function claimedIdsOf(patchText) {
	const ids = [];
	for (const row of insertRowsOf(patchText)) if (row.id !== void 0) ids.push(row.id);
	return ids;
}
/**
* The insert entries of an installed package's own bundle patch, with both
* the claimed id and the entry's own name. The name matters twice: the
* loader imports the plugin by it (an unresolvable name is a boot failure),
* and a bare override row whose name mismatches it is skipped by the include
* patch semantics, so enablement rows must carry this exact name.
* @param patchText - the package's own bundle patch text (`[]` for none).
* @returns the insert rows, in order.
*/
function insertRowsOf(patchText) {
	if (patchText.trim() === "" || patchText.trim() === "[]") return [];
	try {
		const { root } = parsePatch(patchText, "bundle patch");
		const rows = [];
		for (const item of root.items) {
			if (!isMap(item)) continue;
			const insert = item.get("insert", true);
			if (!isSeq(insert)) continue;
			for (const entry of insert.items) {
				if (!isMap(entry)) continue;
				const id = entry.get("id", true);
				const name = entry.get("name", true);
				rows.push({
					id: isScalar(id) && typeof id.value === "string" ? id.value : void 0,
					name: isScalar(name) && typeof name.value === "string" ? name.value : void 0
				});
			}
		}
		return rows;
	} catch {
		return [];
	}
}
/**
* The inner entry of an insert-format item whose id matches, when one exists
* (the official desktop writer manages rows in this shape).
* @param root - the top-level sequence.
* @param id - the entry id to match.
* @returns the inner row, or undefined.
*/
function findInsertRow(root, id) {
	for (const item of root.items) {
		if (!isMap(item)) continue;
		const insert = item.get("insert", true);
		if (!isSeq(insert)) continue;
		for (const entry of insert.items) {
			if (!isMap(entry)) continue;
			const entryId = entry.get("id", true);
			if (isScalar(entryId) && entryId.value === id) return entry;
		}
	}
}
/**
* Persist the next-start enablement of one entry. Bare override rows are this
* package's own shape: enabling removes the override, disabling creates or
* updates `{ id, name, disabled: true }`. When a newer desktop tool already
* manages the entry as an insert-format row, the inner row's `disabled` flag
* is edited instead (the official writer's shape). The returned text
* preserves every other row and comment.
* @param text - current patch file text.
* @param filename - absolute path (diagnostics only).
* @param id - the entry id to override.
* @param name - the display name recorded on the row.
* @param enabled - desired next-start enablement.
* @returns the new file text.
*/
function setRowEnabled(text, filename, id, name, enabled) {
	const { document, root } = parsePatch(text, filename);
	const insertRow = findInsertRow(root, id);
	if (insertRow !== void 0) {
		insertRow.set("disabled", document.createNode(!enabled));
		return document.toString({ lineWidth: 0 }) + "\n";
	}
	const found = findBareRow(root, id);
	if (enabled) {
		if (found === void 0) return text;
		root.items.splice(found.index, 1);
	} else if (found !== void 0) found.row.set("disabled", document.createNode(true));
	else root.items.push(document.createNode({
		id,
		name,
		disabled: true
	}));
	return document.toString({ lineWidth: 0 }) + "\n";
}
//#endregion
//#region src/host/bundle-guard.ts
/**
* Post-mutation duplicate-mount guard for the gateway host half. The official
* CLI's bundle reconciliation appends EVERY dependency that declares
* `dsh.bundle` to the profile manifest's `dsh.profile.bundles` — including
* packages the composition already mounts through a patch row (the family
* aggregate mounts dsh-better-sidebar as the insert row
* `{ id: 'better-sidebar', name: 'dsh-better-sidebar' }` while the package
* also sits in the profile's dependencies). The bundles layer then mounts the
* package a second time and the next boot dies on duplicate routes
* (`webserver: duplicate prefix route "/sidebar/api"`). This module decides,
* from the before-state composition, which newly added bundles entries are
* such duplicate mounts; the gateway strips exactly those entries back out.
* @module @linxin666/dsh-client-ui-plugin-manager/host
*/
/**
* The bundles entries a mutation newly added: present after, absent before.
* Entries the user already had are never the guard's business.
* @param before - bundles list before the mutation.
* @param after - bundles list after the mutation.
* @returns the newly added entries, in after-state order.
*/
function newlyAddedBundles(before, after) {
	return after.filter((name) => !before.includes(name));
}
/**
* Record one candidate row: an enabled row mounts its named package; a row
* the profile layer disables (bare `disabled: true` override matching the
* row id) mounts nothing, so it never justifies stripping a bundles entry.
*/
function collectRow(mounted, rowEnabled, row) {
	if (row.name === void 0 || row.name === "") return;
	if (row.id !== void 0 && rowEnabled.get(row.id) === false) return;
	mounted.add(row.name);
}
/**
* The package names the before-state composition already mounts through patch
* rows: the profile patch's own rows (bare and insert-format) plus every
* before-state dependency's own bundle patch insert entries (the aggregate's
* rows section lives there, not in the profile layer). A tolerant read: a
* broken patch file yields no names rather than failing the mutation.
* @param facts - resolved profile locations.
* @param before - the before-state capture.
* @returns the set of row-mounted package names.
*/
async function rowMountedPackageNames(facts, before) {
	const mounted = /* @__PURE__ */ new Set();
	try {
		const { root } = parsePatch(before.patchText, facts.patchPath);
		for (const item of root.items) {
			if (!isMap(item)) continue;
			const name = bareRowName(item);
			if (name !== void 0 && bareRowEnabled(item)) mounted.add(name);
		}
	} catch {}
	for (const row of insertRowsOf(before.patchText)) collectRow(mounted, before.rowEnabled, row);
	for (const dependency of before.dependencies) {
		const patchPath = join(facts.profileDir, "node_modules", ...dependency.split("/"), "cordis.patch.yml");
		let text;
		try {
			text = await readFile(patchPath, "utf8");
		} catch {
			continue;
		}
		for (const row of insertRowsOf(text)) collectRow(mounted, before.rowEnabled, row);
	}
	return mounted;
}
/**
* The newly added bundles entries that duplicate an existing row mount and
* must be stripped to keep the next boot alive.
* @param facts - resolved profile locations.
* @param before - the before-state capture.
* @param beforeBundles - the bundles list before the mutation.
* @param afterBundles - the bundles list after the mutation.
* @returns the entries to remove from `dsh.profile.bundles`.
*/
async function duplicateMountBundles(facts, before, beforeBundles, afterBundles) {
	const added = newlyAddedBundles(beforeBundles, afterBundles);
	if (added.length === 0) return [];
	const mounted = await rowMountedPackageNames(facts, before);
	return added.filter((name) => mounted.has(name));
}
//#endregion
//#region src/host/dsh-home.ts
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
//#region src/host/profile.ts
/**
* Profile resolution and manifest reads for the gateway host half. The npm
* web runtime has no plugin-installer service, so this package resolves the
* boot profile from the host process's own argv (the launcher fact) and reads
* the profile's package.json and cordis.patch.yml directly — reads only; every
* write goes through the official CLI or the patch-row editor.
* @module @linxin666/dsh-client-ui-plugin-manager/host
*/
/**
* Strip a leading UTF-8 byte order mark (U+FEFF), which commonly appears in
* files edited or created on Windows (PowerShell / Notepad).
*/
function stripBom(text) {
	return text.charCodeAt(0) === 65279 ? text.slice(1) : text;
}
/** Read the packaged desktop app's persisted active profile, when present. */
function desktopSelectedProfile(env = process.env) {
	const explicit = env.DSH_DESKTOP_DEFAULT_PROFILE?.trim();
	if (explicit) return explicit;
	const appRoots = [
		env.APPDATA && join(env.APPDATA, "DSH Desktop"),
		env.XDG_CONFIG_HOME && join(env.XDG_CONFIG_HOME, "DSH Desktop"),
		env.HOME && join(env.HOME, "Library", "Application Support", "DSH Desktop"),
		env.HOME && join(env.HOME, ".config", "DSH Desktop")
	].filter((value) => typeof value === "string");
	for (const root of appRoots) try {
		const parsed = JSON.parse(stripBom(readFileSync(join(root, "profile-selection", "state.json"), "utf8")));
		if (typeof parsed.active === "string" && parsed.active.trim() !== "") return parsed.active.trim();
	} catch {}
}
/**
* Resolve the boot profile name from the host argv: an explicit `--profile`
* flag wins, then the DSH_PROFILE environment override, then the `web`
* subcommand alias. The launcher hands the app its own args verbatim, so the
* web app's argv is the reliable source on every CLI-launched host.
* @param argv - process argv (test seam).
* @param env - process environment (test seam).
* @returns the resolved profile facts.
*/
function resolveProfile(argv = process.argv, env = process.env) {
	const flagIndex = argv.indexOf("--profile");
	let name;
	let desktop = false;
	if (flagIndex !== -1 && argv[flagIndex + 1] !== void 0 && argv[flagIndex + 1] !== "") name = argv[flagIndex + 1];
	else if (env.DSH_PROFILE !== void 0 && env.DSH_PROFILE.trim() !== "") {
		name = env.DSH_PROFILE.trim();
		desktop = argv.length <= 1 && desktopSelectedProfile(env) === name;
	} else if (argv.includes("web")) name = "web";
	else {
		name = desktopSelectedProfile(env);
		desktop = name !== void 0;
	}
	if (name === void 0) throw new Error("plugin-manager: cannot determine the boot profile; pass --profile <name> or set DSH_PROFILE");
	if (name.includes("/") || name.includes("\\") || name.includes("..")) throw new Error(`plugin-manager: invalid profile name ${JSON.stringify(name)}`);
	const profileDir = join(resolveDshHome(env), "profiles", name);
	return {
		profileName: name,
		profileDir,
		patchPath: join(profileDir, "cordis.patch.yml"),
		packageJsonPath: join(profileDir, "package.json"),
		desktop
	};
}
/**
* Read the profile manifest; a missing or malformed file fails loud.
* @param packageJsonPath - absolute path of the profile's package.json.
* @returns the parsed bundles and dependencies.
*/
async function readProfileManifest(packageJsonPath) {
	const text = await readFile(packageJsonPath, "utf8");
	const parsed = JSON.parse(stripBom(text));
	const bundles = Array.isArray(parsed.dsh?.profile?.bundles) ? parsed.dsh.profile.bundles.filter((item) => typeof item === "string") : [];
	const rawDeps = parsed.dependencies;
	const dependencies = {};
	if (typeof rawDeps === "object" && rawDeps !== null) {
		for (const [name, spec] of Object.entries(rawDeps)) if (typeof spec === "string") dependencies[name] = spec;
	}
	return {
		bundles,
		dependencies
	};
}
/**
* Remove selected entries from the profile manifest's `dsh.profile.bundles`,
* conservatively: a single backup copy, then a tmp write and an atomic-ish
* rename over the target — the same discipline as the patch-row editor. Every
* other key (dependencies included) round-trips untouched; entries not in
* `names` keep their order. A missing bundles array is a no-op write.
* @param packageJsonPath - absolute path of the profile's package.json.
* @param names - bundle entries to strip (package names).
*/
async function stripProfileBundles(packageJsonPath, names) {
	const text = await readFile(packageJsonPath, "utf8");
	const parsed = JSON.parse(stripBom(text));
	const profile = parsed.dsh?.profile;
	if (profile === void 0 || !Array.isArray(profile.bundles)) return;
	profile.bundles = profile.bundles.filter((entry) => !(typeof entry === "string" && names.includes(entry)));
	await copyFile(packageJsonPath, `${packageJsonPath}.bak-plugin-manager`).catch(() => {});
	await writeFile(`${packageJsonPath}.tmp`, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 384 });
	await rename(`${packageJsonPath}.tmp`, packageJsonPath);
}
/**
* Read the profile patch text; a missing file is an empty layer.
* @param patchPath - absolute path of cordis.patch.yml.
* @returns the file text, or `[]` when absent.
*/
async function readPatchText(patchPath) {
	try {
		return stripBom(await readFile(patchPath, "utf8"));
	} catch (error) {
		if (error?.code === "ENOENT") return "[]\n";
		throw error;
	}
}
/** Whether a profile directory exists (the gateway needs an initialized profile). */
function profileExists(profileDir) {
	return existsSync(join(profileDir, "package.json"));
}
//#endregion
//#region src/host/state.ts
/**
* Gateway listing: the installed-plugin inventory read from the profile's
* package.json, its node_modules manifests, and the patch rows' enablement.
* The npm web runtime has no installer inventory service, so this module is
* the read side of the gateway (the write side is the official CLI).
* @module @linxin666/dsh-client-ui-plugin-manager/host
*/
/** The node_modules path of one (possibly scoped) package name. */
function modulePathOf(profileDir, name) {
	return join(profileDir, "node_modules", ...name.split("/"));
}
/** Whether an install spec names a git/file/link source rather than a registry package. */
function sourceKindOf(spec) {
	return /^(link:|file:|git:|github:|git\+|https?:\/\/github\.com)/.test(spec) ? "git" : "npm";
}
/**
* The entry ids one installed dependency claims: the insert ids of its own
* bundle patch, falling back to the package name. Shared by the listing read
* side and the set-enabled write side so both agree on the id space — writing
* package-name rows while reading bundle-patch ids made the switches inert.
* @param facts - resolved profile locations.
* @param name - dependency name (possibly scoped).
* @returns the claimed entry ids, never empty.
*/
async function claimedEntryIdsOf(facts, name) {
	const patchPath = join(modulePathOf(facts.profileDir, name), "cordis.patch.yml");
	try {
		const ids = claimedIdsOf(stripBom(await readFile(patchPath, "utf8")));
		if (ids.length > 0) return ids;
	} catch {}
	return [name];
}
/**
* The insert rows one installed dependency claims, id plus the entry's own
* name (falling back to the package name for plain plugins). The set-enabled
* write side needs the entry's own name: the include patch semantics skip a
* bare override row whose name mismatches the inserted entry's name.
* @param facts - resolved profile locations.
* @param name - dependency name (possibly scoped).
* @returns the claimed rows, never empty.
*/
async function claimedEntryRowsOf(facts, name) {
	const patchPath = join(modulePathOf(facts.profileDir, name), "cordis.patch.yml");
	try {
		const claimed = insertRowsOf(stripBom(await readFile(patchPath, "utf8"))).filter((row) => row.id !== void 0);
		if (claimed.length > 0) return claimed.map((row) => ({
			id: row.id,
			name: row.name ?? name
		}));
	} catch {}
	return [{
		id: name,
		name
	}];
}
/**
* Build one installed-plugin row from the profile facts: version from the
* installed manifest, enablement from the entry ids its own bundle patch
* claims (plain plugins use the package name as the row id).
* @param facts - resolved profile locations.
* @param name - dependency name (possibly scoped).
* @param spec - the install spec recorded in the profile dependencies.
* @param rowEnabled - row enablement by id.
* @returns the wire-shaped plugin row.
*/
async function buildPluginRow(facts, name, spec, rowEnabled) {
	const moduleDir = modulePathOf(facts.profileDir, name);
	let version = "unknown";
	try {
		const text = await readFile(join(moduleDir, "package.json"), "utf8");
		const parsed = JSON.parse(stripBom(text));
		if (typeof parsed.version === "string") version = parsed.version;
	} catch {
		version = "unknown";
	}
	let bundlePatch = "[]";
	const bundlePatchPath = join(moduleDir, "cordis.patch.yml");
	if (existsSync(bundlePatchPath)) try {
		bundlePatch = stripBom(await readFile(bundlePatchPath, "utf8"));
	} catch {
		bundlePatch = "[]";
	}
	const claimed = claimedIdsOf(bundlePatch);
	const enabled = (claimed.length > 0 ? claimed : [name]).every((id) => rowEnabled.get(id) ?? true);
	return {
		id: name,
		name,
		version,
		source: {
			kind: sourceKindOf(spec),
			spec
		},
		installedAt: "",
		enabled
	};
}
/**
* Build the gateway listing and the layer snapshot.
* @param facts - resolved profile locations.
* @param patchText - current profile patch text.
* @returns plugin rows (wire shape of the official list) and the layer state.
*/
async function snapshotGateway(facts, patchText) {
	const manifest = await readProfileManifest(facts.packageJsonPath);
	const parsed = parsePatch(patchText, facts.patchPath);
	const rowEnabled = /* @__PURE__ */ new Map();
	for (const item of parsed.root.items) {
		const id = bareRowId(item);
		if (id !== void 0) rowEnabled.set(id, bareRowEnabled(item));
	}
	const plugins = [];
	for (const name of Object.keys(manifest.dependencies).sort()) plugins.push(await buildPluginRow(facts, name, manifest.dependencies[name], rowEnabled));
	return {
		plugins,
		layer: {
			rows: rowEnabled,
			bundles: manifest.bundles
		}
	};
}
//#endregion
//#region src/host/gateway.ts
/**
* The CLI gateway: installs and removals executed by spawning the official
* `dsh plugin --profile <name> add|remove` CLI — the single writer for the
* profile — with a bounded job table the HTTP layer polls. Every run captures
* a layer snapshot before and after so the caller can render exactly what the
* CLI changed (the conflict ledger). The npm web runtime has no installer
* service, so this gateway is its write path; on runtimes with official
* channels the browser half never calls it.
* @module @linxin666/dsh-client-ui-plugin-manager/host
*/
/** Hard deadline for one CLI add (git clones can take minutes). */
const ADD_TIMEOUT_MS = 6 * 6e4;
/** Hard deadline for one CLI remove. */
const REMOVE_TIMEOUT_MS = 2 * 6e4;
/** Ring cap on finished jobs: the newest 100 settled jobs stay queryable; the oldest finished job is evicted beyond the cap so the job table cannot grow without bound. In-progress jobs are never evicted. */
const MAX_FINISHED_JOBS = 100;
/**
* Shell command-chaining metacharacters that must never reach a spawned CLI
* argument. The gateway spawns shell-free, but the official CLI forwards to
* pnpm with a cmd.exe shell on Windows, so a spec carrying these can still be
* re-parsed one layer down (a failed install reported as success, or worse).
*/
const UNSAFE_SPEC_CHARS = /[&|<>"'`%!\n\r\0]/;
/**
* Validate an install spec or package id against shell metacharacters.
* @param spec - the user-supplied spec or id.
* @returns the rejection message, or undefined when the spec is safe.
*/
function unsafeSpecReason(spec) {
	return UNSAFE_SPEC_CHARS.test(spec) ? "plugin-manager: spec 含有危险的 shell 元字符或控制字符，已拒绝" : void 0;
}
/** The binary search roots for the dsh CLI. */
function findDshBinary(env = process.env, platform = process.platform, exists = existsSync, hostEntryPath = process.argv[1]) {
	const candidates = [];
	const separator = platform === "win32" ? ";" : ":";
	const pathApi = platform === "win32" ? win32 : posix;
	for (const dir of (env.PATH ?? "").split(separator)) {
		if (dir === "") continue;
		if (platform === "win32") candidates.push(`${dir}\\dsh.cmd`, `${dir}\\dsh.exe`);
		else candidates.push(`${dir}/dsh`);
	}
	if (hostEntryPath !== void 0 && hostEntryPath !== "") {
		let current = pathApi.dirname(hostEntryPath);
		for (let depth = 0; depth < 10; depth += 1) {
			const binDir = pathApi.join(current, "node_modules", ".bin");
			if (platform === "win32") candidates.push(pathApi.join(binDir, "dsh.cmd"), pathApi.join(binDir, "dsh.exe"));
			else candidates.push(pathApi.join(binDir, "dsh"));
			const parent = pathApi.dirname(current);
			if (parent === current) break;
			current = parent;
		}
	}
	if (platform === "darwin") candidates.push("/opt/homebrew/bin/dsh", "/usr/local/bin/dsh");
	for (const candidate of candidates) if (exists(candidate)) return candidate;
	return null;
}
/** Append bounded CLI output (stdout + stderr interleaved is not preserved; tail wins). */
function capture(chunk, buffer) {
	buffer.value = (buffer.value + chunk.toString()).slice(-32e3);
}
/**
* The spawn command for the dsh CLI on this platform. Windows runs the
* npm-generated dsh.cmd wrapper by resolving its node binary and bin.js script
* and spawning them directly: going through cmd.exe splits unquoted paths with
* spaces (`'D:\Program' is not recognized`).
* @param binary - the dsh CLI path found by {@link findDshBinary}.
* @param platform - process platform (test seam).
* @param localNodeExists - existence probe (test seam).
* @param binJsExists - existence probe for the resolved bin script (test seam).
* @returns the executable and the argument prefix to run the dsh bin script.
*/
function dshSpawnCommand(binary, platform = process.platform, localNodeExists = existsSync, binJsExists = existsSync) {
	if (platform !== "win32") return {
		command: binary,
		argsPrefix: []
	};
	const dir = win32.dirname(binary);
	const localNode = win32.join(dir, "node.exe");
	const binJs = [win32.join(dir, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"), win32.join(dir, "..", "@deepseek-ai", "dsh", "lib", "bin.js")].find((candidate) => binJsExists(candidate));
	if (binJs === void 0) return {
		command: binary,
		argsPrefix: []
	};
	return {
		command: localNodeExists(localNode) ? localNode : process.execPath,
		argsPrefix: [binJs]
	};
}
/** Build the exact cmd.exe command line required to execute a trusted .cmd shim. */
function windowsCmdShimArgs(binary, args) {
	const unsafe = /[&|<>"'`%!\n\r\0]/;
	if (/["%\n\r\0]/.test(binary) || args.some((arg) => unsafe.test(arg))) throw new Error("plugin-manager: unsafe Windows command argument");
	return [
		"/d",
		"/s",
		"/c",
		`""${binary}" ${args.map((arg) => `"${arg}"`).join(" ")}"`
	];
}
/** Spawn the dsh CLI with piped stdio and no shell parsing (see {@link dshSpawnCommand}). */
function spawnDsh(binary, args, env) {
	const { command, argsPrefix } = dshSpawnCommand(binary);
	if (process.platform === "win32" && command.toLowerCase().endsWith(".cmd")) return spawn("cmd.exe", windowsCmdShimArgs(command, args), {
		env,
		windowsVerbatimArguments: true,
		stdio: [
			"ignore",
			"pipe",
			"pipe"
		]
	});
	return spawn(command, [...argsPrefix, ...args], {
		env: command === process.execPath ? {
			...env,
			ELECTRON_RUN_AS_NODE: "1"
		} : env,
		stdio: [
			"ignore",
			"pipe",
			"pipe"
		]
	});
}
/**
* Entry-id line of the official installer channels in the boot dump. A plain
* substring probe false-positives on any unrelated entry whose id, name, or
* config mentions the mark, so only a real `id:` row counts.
*/
const OFFICIAL_INSTALLER_PATTERN = /^\s*-?\s*id:\s*['"]?plugin-(?:installer|control)['"]?\s*$/m;
/**
* Detect whether the official installer channels exist on this runtime by
* dumping the boot composition once: the npm-published web never contains
* `plugin-installer` entries, DSHCode and the checkout web do. The browser
* half reads the verdict from the `/mode` route so its channel probe never
* has to hit the missing official route (which 405s into the console).
* @param binary - dsh CLI path.
* @param profileName - boot profile name.
* @param env - process environment.
* @param spawnImpl - spawn seam (test seam).
* @returns true when the dump names the official installer channels.
*/
async function detectOfficialChannels(binary, profileName, env = process.env, spawnImpl = spawnDsh) {
	const output = { value: "" };
	const child = spawnImpl(binary, [
		"--profile",
		profileName,
		"--dump-config"
	], env);
	child.stdout?.on("data", (chunk) => {
		output.value = (output.value + chunk.toString()).slice(-32e3);
	});
	child.stderr?.on("data", (chunk) => {
		output.value = (output.value + chunk.toString()).slice(-32e3);
	});
	if (await new Promise((resolve) => {
		child.on("close", resolve);
	}) !== 0) return false;
	return OFFICIAL_INSTALLER_PATTERN.test(output.value);
}
/** The gateway: serializes CLI operations through one job table and one mutation queue. */
var CliGateway = class {
	facts;
	env;
	deps;
	jobs = /* @__PURE__ */ new Map();
	/** Settlement order of finished jobs: the eviction ring keeps the newest {@link MAX_FINISHED_JOBS}. */
	finishedOrder = [];
	counter = 0;
	/** Mutation queue: two CLI runs must never interleave their before/after captures. */
	queue = Promise.resolve();
	/**
	* @param facts - resolved profile locations.
	* @param env - process environment.
	* @param deps - spawn/binary seams (tests only; production uses the real CLI).
	*/
	constructor(facts, env = process.env, deps = {}) {
		this.facts = facts;
		this.env = env;
		this.deps = deps;
	}
	/**
	* Run one profile mutation after every mutation already queued. The returned
	* promise keeps the task's own result or rejection, while the queue tail is
	* always recovered so one failed write cannot block later work. Routes that
	* edit profile files directly must use this seam so they cannot overlap the
	* CLI install/remove writer.
	*/
	withMutationLock(task) {
		const result = this.queue.then(task);
		this.queue = result.then(() => void 0, () => void 0);
		return result;
	}
	/** Chain one fire-and-forget CLI mutation onto the shared queue. */
	enqueue(task) {
		this.withMutationLock(task).catch(() => {});
	}
	/** Register a settled job and evict the oldest finished one beyond the ring cap. */
	retainFinished(jobId) {
		this.finishedOrder.push(jobId);
		while (this.finishedOrder.length > MAX_FINISHED_JOBS) {
			const evicted = this.finishedOrder.shift();
			if (evicted !== void 0) this.jobs.delete(evicted);
		}
	}
	/** The dsh CLI path, through the test seam when present. */
	binary() {
		return this.deps.findBinary !== void 0 ? this.deps.findBinary(this.env) : findDshBinary(this.env);
	}
	/** Spawn the CLI, through the test seam when present. */
	spawnCli(binary, args) {
		return (this.deps.spawnImpl ?? spawnDsh)(binary, args, this.env);
	}
	/** Start an install; the caller polls {@link status}. */
	install(spec) {
		const job = {
			id: `job-${++this.counter}`,
			action: "install",
			spec,
			phase: "running"
		};
		this.jobs.set(job.id, job);
		const unsafe = unsafeSpecReason(spec);
		if (unsafe !== void 0) {
			job.phase = "error";
			job.error = unsafe;
			this.retainFinished(job.id);
			return { jobId: job.id };
		}
		this.enqueue(() => this.run(job, [
			"plugin",
			"--profile",
			this.facts.profileName,
			"add",
			spec
		], ADD_TIMEOUT_MS));
		return { jobId: job.id };
	}
	/** Start an in-place npm update; the caller polls {@link status}. */
	update(id, version) {
		const spec = `${id}@${version}`;
		const job = {
			id: `job-${++this.counter}`,
			action: "update",
			spec,
			targetId: id,
			targetVersion: version,
			phase: "running"
		};
		this.jobs.set(job.id, job);
		const unsafe = unsafeSpecReason(spec);
		if (unsafe !== void 0) {
			job.phase = "error";
			job.error = unsafe;
			this.retainFinished(job.id);
			return { jobId: job.id };
		}
		this.enqueue(() => this.run(job, [
			"plugin",
			"--profile",
			this.facts.profileName,
			"add",
			spec
		], ADD_TIMEOUT_MS));
		return { jobId: job.id };
	}
	/** Start a removal; the caller polls {@link status}. */
	remove(id) {
		const job = {
			id: `job-${++this.counter}`,
			action: "remove",
			spec: id,
			phase: "running"
		};
		this.jobs.set(job.id, job);
		const unsafe = unsafeSpecReason(id);
		if (unsafe !== void 0) {
			job.phase = "error";
			job.error = unsafe;
			this.retainFinished(job.id);
			return { jobId: job.id };
		}
		this.enqueue(() => this.run(job, [
			"plugin",
			"--profile",
			this.facts.profileName,
			"remove",
			id
		], REMOVE_TIMEOUT_MS));
		return { jobId: job.id };
	}
	/**
	* Read one job's current state (a shallow copy). Finished jobs beyond the
	* ring cap are evicted and read as not-found, the same as an id that never
	* existed.
	*/
	status(jobId) {
		const job = this.jobs.get(jobId);
		if (job === void 0) return void 0;
		return {
			...job,
			conflicts: job.conflicts === void 0 ? void 0 : [...job.conflicts],
			notices: job.notices === void 0 ? void 0 : [...job.notices]
		};
	}
	/** Capture the layer snapshot and the dependency names (tolerant parse). */
	async capture() {
		const rows = /* @__PURE__ */ new Map();
		let patchText = "[]\n";
		try {
			patchText = await readFile(this.facts.patchPath, "utf8");
		} catch {
			patchText = "[]\n";
		}
		try {
			const { root } = parsePatch(patchText, this.facts.patchPath);
			for (const item of root.items) {
				const id = bareRowId(item);
				if (id !== void 0) rows.set(id, bareRowEnabled(item));
			}
		} catch {}
		let bundles = [];
		let dependencies = [];
		try {
			const manifest = await readProfileManifest(this.facts.packageJsonPath);
			bundles = manifest.bundles;
			dependencies = Object.keys(manifest.dependencies);
		} catch {
			bundles = [];
			dependencies = [];
		}
		return {
			layer: {
				rows,
				bundles
			},
			patchText,
			dependencies
		};
	}
	/** The plugin row a finished operation produced (installed or removed). */
	async rowFor(action, spec, before, after) {
		let targetName;
		if (action === "install") targetName = after.dependencies.find((name) => !before.dependencies.includes(name));
		else targetName = before.dependencies.find((name) => !after.dependencies.includes(name)) ?? spec;
		if (targetName === void 0) return void 0;
		const specValue = await readProfileManifest(this.facts.packageJsonPath).then((manifest) => manifest.dependencies[targetName] ?? spec).catch(() => spec);
		return buildPluginRow(this.facts, targetName, specValue, after.layer.rows);
	}
	/** Run one CLI operation to settlement; an unexpected failure settles the job as error. */
	async run(job, args, timeoutMs) {
		try {
			await this.runInner(job, args, timeoutMs);
		} catch (error) {
			job.phase = "error";
			job.error = `plugin-manager: unexpected gateway failure: ${error instanceof Error ? error.message : String(error)}`;
		}
		this.retainFinished(job.id);
	}
	/** The mutation body of {@link run}. */
	async runInner(job, args, timeoutMs) {
		const binary = this.binary();
		if (binary === null) {
			job.phase = "error";
			job.error = "plugin-manager: dsh CLI not found on PATH";
			return;
		}
		const before = await this.capture();
		const output = { value: "" };
		const child = this.spawnCli(binary, args);
		child.stdout?.on("data", (chunk) => {
			capture(chunk, output);
		});
		child.stderr?.on("data", (chunk) => {
			capture(chunk, output);
		});
		const timer = setTimeout(() => {
			child.kill();
		}, timeoutMs);
		const code = await new Promise((resolve) => {
			child.on("close", resolve);
		});
		clearTimeout(timer);
		if (code !== 0) {
			job.phase = "error";
			const tail = output.value.trim();
			job.error = tail === "" ? `plugin-manager: dsh plugin ${job.action} exited with code ${String(code)}` : tail;
			return;
		}
		let after = await this.capture();
		const stripped = await this.stripDuplicateMounts(job, before, after);
		if (stripped === void 0) return;
		if (stripped.length > 0) {
			job.notices = stripped.map((name) => ({
				id: name,
				name,
				from: "enabled",
				to: "uninstalled"
			}));
			after = await this.capture();
		}
		const conflicts = significantChanges(diffLayer(before.layer, after.layer));
		if (job.action === "install") {
			const name = this.newDependency(before, after);
			if (name === void 0) {
				job.phase = "error";
				job.error = "plugin-manager: dsh plugin add 报告成功，但 profile 未新增任何依赖（安装未生效）";
				return;
			}
			const duplicate = await this.detectDuplicateClaims(before, after);
			if (duplicate !== void 0) {
				await this.rollbackInstall(job, name, `与现有插件的入口 id 冲突（${duplicate.ids.join(", ")}）`, conflicts);
				return;
			}
			const missing = await this.unresolvableInsertNames(name);
			if (missing.length > 0) {
				await this.rollbackInstall(job, name, `入口引用了不可解析的包（${missing.join(", ")}）`, conflicts);
				return;
			}
			await this.verifyBoot(job, before, after, conflicts);
			if (job.phase === "error") return;
		} else if (job.action === "update") {
			const targetId = job.targetId;
			const targetVersion = job.targetVersion;
			if (targetId === void 0 || targetVersion === void 0 || !after.dependencies.includes(targetId)) {
				job.phase = "error";
				job.error = "plugin-manager: dsh plugin add 报告成功，但目标插件未保留在 profile 中（更新未生效）";
				return;
			}
			const manifest = await readProfileManifest(this.facts.packageJsonPath);
			const updated = await buildPluginRow(this.facts, targetId, manifest.dependencies[targetId] ?? job.spec, after.layer.rows);
			if (updated.version !== targetVersion) {
				job.phase = "error";
				job.error = `plugin-manager: dsh plugin add 报告成功，但 ${targetId} 仍为 ${updated.version}，预期 ${targetVersion}（更新未生效）`;
				return;
			}
			job.plugin = updated;
			await this.verifyBoot(job, before, after, conflicts);
			if (job.phase === "error") return;
		} else if (before.dependencies.find((candidate) => !after.dependencies.includes(candidate)) === void 0) {
			job.phase = "error";
			job.error = "plugin-manager: dsh plugin remove 报告成功，但依赖仍在 profile 中（卸载未生效）";
			return;
		}
		job.conflicts = conflicts.map((change) => ({
			id: change.id,
			name: change.id,
			from: change.from,
			to: change.to
		}));
		if (job.action !== "update") job.plugin = await this.rowFor(job.action, job.spec, before, after);
		job.phase = "done";
	}
	/**
	* Post-mutation duplicate-mount safeguard (B9): remove the bundles entries
	* the CLI's reconciliation newly added for packages the before-state
	* composition already mounted through a patch row. The write goes through
	* the manifest's safe path (backup + tmp + atomic rename); entries the
	* user had before and entries with no row mount are never touched. A
	* failure of the guard itself settles the job as an error — a boot-breaking
	* bundles state is never left silently.
	* @param job - the settling job (error target on guard failure).
	* @param before - state captured before the CLI run.
	* @param after - state captured after the CLI run.
	* @returns the stripped entries, or undefined when the job failed.
	*/
	async stripDuplicateMounts(job, before, after) {
		try {
			const strip = await duplicateMountBundles(this.facts, {
				patchText: before.patchText,
				dependencies: before.dependencies,
				rowEnabled: before.layer.rows
			}, before.layer.bundles, after.layer.bundles);
			if (strip.length === 0) return [];
			await stripProfileBundles(this.facts.packageJsonPath, strip);
			return strip;
		} catch (error) {
			job.phase = "error";
			job.error = `plugin-manager: 重复挂载保护写回失败：${error instanceof Error ? error.message : String(error)}（profile 的 dsh.profile.bundles 可能仍处于重复挂载状态，下次启动前请手动检查 ${this.facts.packageJsonPath}）`;
			return;
		}
	}
	/**
	* Roll back a freshly installed dependency through the official remove
	* path (which also drops its bundle), then settle the job as an error.
	* This is the owner-aware conflict resolution: the existing plugin keeps
	* its entry ids and enablement untouched.
	*/
	async rollbackInstall(job, name, reason, conflicts) {
		let rolledBack = false;
		let tail = "";
		const binary = this.binary();
		if (binary !== null) {
			const output = { value: "" };
			const child = this.spawnCli(binary, [
				"plugin",
				"--profile",
				this.facts.profileName,
				"remove",
				name
			]);
			child.stdout?.on("data", (chunk) => {
				capture(chunk, output);
			});
			child.stderr?.on("data", (chunk) => {
				capture(chunk, output);
			});
			const timer = setTimeout(() => {
				child.kill();
			}, REMOVE_TIMEOUT_MS);
			const code = await new Promise((resolve) => {
				child.on("close", resolve);
			});
			clearTimeout(timer);
			rolledBack = code === 0;
			tail = output.value.trim();
		}
		job.phase = "error";
		job.error = rolledBack ? `plugin-manager: ${reason}，已自动回滚 ${name}` : `plugin-manager: ${reason}；自动回滚失败，请手动执行 dsh plugin --profile ${this.facts.profileName} remove ${name}${tail === "" ? "" : `：\n${tail}`}`;
		conflicts.push({
			id: name,
			from: "enabled",
			to: "uninstalled"
		});
		job.conflicts = conflicts.map((change) => ({
			id: change.id,
			name: change.id,
			from: change.from,
			to: change.to
		}));
	}
	/**
	* Insert-entry package names of one installed dependency that resolve
	* nowhere: not the dependency itself, not another profile dependency, not
	* an official @deepseek-ai/* package, and absent from every node_modules
	* the loader could import them from. Import-time failures beyond this
	* static check still surface only at the first real boot.
	*/
	async unresolvableInsertNames(name) {
		const moduleDir = join(this.facts.profileDir, "node_modules", ...name.split("/"));
		let text;
		try {
			text = await readFile(join(moduleDir, "cordis.patch.yml"), "utf8");
		} catch {
			return [];
		}
		const missing = [];
		for (const row of insertRowsOf(text)) {
			const target = row.name;
			if (target === void 0 || target === "") continue;
			if (target === name) continue;
			if (target.startsWith("@deepseek-ai/")) continue;
			if (existsSync(join(this.facts.profileDir, "node_modules", ...target.split("/")))) continue;
			if (existsSync(join(moduleDir, "node_modules", ...target.split("/")))) continue;
			missing.push(target);
		}
		return missing;
	}
	/** The new dependency of an install, when one exists. */
	newDependency(before, after) {
		return after.dependencies.find((name) => !before.dependencies.includes(name));
	}
	/** The claimed entry ids of one installed dependency (its own bundle patch, or its name). */
	claimedEntriesOf(name) {
		return claimedEntryIdsOf(this.facts, name);
	}
	/** Whether the new install claims an entry id another plugin already holds. */
	async detectDuplicateClaims(before, after) {
		const name = this.newDependency(before, after);
		if (name === void 0) return void 0;
		const claimed = await this.claimedEntriesOf(name);
		const taken = new Set(after.layer.rows.keys());
		for (const dep of after.dependencies) {
			if (dep === name) continue;
			for (const id of await this.claimedEntriesOf(dep)) taken.add(id);
		}
		const overlap = overlappingIds(claimed, taken);
		if (overlap.length === 0) return void 0;
		return {
			name,
			ids: overlap
		};
	}
	/**
	* Boot preflight after an install: compose the profile with the CLI's
	* `--dump-config` (resolves every entry without binding the port). A failure
	* that implicates the new plugin disables it so the next start cannot fail;
	* an unrelated failure is reported without touching anything.
	*/
	async verifyBoot(job, before, after, conflicts) {
		const binary = this.binary();
		if (binary === null) return;
		const name = this.newDependency(before, after);
		const verifyOutput = { value: "" };
		const child = this.spawnCli(binary, [
			"--profile",
			this.facts.profileName,
			"--dump-config"
		]);
		child.stdout?.on("data", (chunk) => {
			capture(chunk, verifyOutput);
		});
		child.stderr?.on("data", (chunk) => {
			capture(chunk, verifyOutput);
		});
		const timer = setTimeout(() => {
			child.kill();
		}, 9e4);
		const code = await new Promise((resolve) => {
			child.on("close", resolve);
		});
		clearTimeout(timer);
		if (code === 0) return;
		const tail = verifyOutput.value.trim();
		if (name === void 0) {
			job.phase = "error";
			job.error = tail === "" ? "plugin-manager: boot preflight failed" : tail;
			return;
		}
		const claimed = await this.claimedEntriesOf(name);
		if (tail.includes(name) || claimed.some((id) => tail.includes(id))) await this.rollbackInstall(job, name, `启动预检失败${tail === "" ? "" : `：\n${tail}`}`, conflicts);
		else {
			job.phase = "error";
			job.error = tail === "" ? "plugin-manager: 启动预检失败（与本次安装无关）" : `plugin-manager: 启动预检失败（与本次安装无关）：\n${tail}`;
		}
	}
};
//#endregion
//#region src/host/http.ts
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
//#region src/host/loopback.ts
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
//#region src/core/version.ts
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
/**
* Parse a DSH host or package version string.
* @param value - e.g. `0.1.0-rc.8`, `v1.2.3`.
* @returns the parsed version, or undefined when malformed.
*/
function parseDshVersion(value) {
	const match = VERSION_PATTERN.exec(value.trim());
	if (match === null) return void 0;
	const prereleaseParts = match[4] === void 0 ? [] : match[4].split(".");
	if (prereleaseParts.some((part) => part === "")) return void 0;
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease: prereleaseParts.map((part) => /^\d+$/.test(part) ? Number(part) : part)
	};
}
/**
* Compare two version strings by semver order (a release is newer than any
* prerelease of the same tuple).
* @returns -1 / 0 / 1, or undefined when either side is malformed.
*/
function compareVersions(left, right) {
	const a = parseDshVersion(left);
	const b = parseDshVersion(right);
	if (a === void 0 || b === void 0) return void 0;
	for (const key of [
		"major",
		"minor",
		"patch"
	]) if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
	return comparePrerelease(a.prerelease, b.prerelease);
}
/**
* Semver prerelease ordering: numeric identifiers compare numerically,
* numeric identifiers rank below alphanumeric ones, alphanumeric identifiers
* compare lexically, and a longer list wins when the shared prefix is equal.
*/
function comparePrerelease(left, right) {
	if (left.length === 0 && right.length === 0) return 0;
	if (left.length === 0) return 1;
	if (right.length === 0) return -1;
	const length = Math.max(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		const a = left[index];
		const b = right[index];
		if (a === void 0) return -1;
		if (b === void 0) return 1;
		if (typeof a === "number" && typeof b === "number") {
			if (a !== b) return a < b ? -1 : 1;
		} else if (typeof a === "number") return -1;
		else if (typeof b === "number") return 1;
		else if (a !== b) return a < b ? -1 : 1;
	}
	return 0;
}
const MINIMUM_RANGE_PATTERN = /^>=\s*(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
/**
* Whether a host version satisfies a declared `>=X.Y.Z[-prerelease]` minimum.
* @param host - the running DSH host version.
* @param minimum - the declared minimum; any form other than `>=<semver>`
* (plain semver, `^`, `~`, multi-comparator ranges, empty) returns undefined.
* @returns true / false, or undefined when the host version is malformed or
* the minimum uses an unsupported form — callers treat undefined as
* "cannot verify" and fail closed for declared requirements.
*/
function meetsMinimumDsh(host, minimum) {
	const match = MINIMUM_RANGE_PATTERN.exec(minimum.trim());
	if (match === null) return void 0;
	const compared = compareVersions(host, match[1]);
	if (compared === void 0) return void 0;
	return compared >= 0;
}
/**
* Read the declared DSH minimum from a published registry manifest:
* `dsh.engines.dsh` first, top-level `engines.dsh` as the fallback.
* Defensive against malformed or untrusted metadata: anything that is not a
* non-empty string reads as absent.
* @param manifest - the decoded registry version manifest.
* @returns the declared minimum, or undefined when not declared.
*/
function dshRequirementOf(manifest) {
	const dshEngines = manifest.dsh?.engines;
	const engines = manifest.engines?.dsh;
	const value = dshEngines?.dsh ?? engines;
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
//#endregion
//#region src/host/routes.ts
/** Route prefix the browser half mirrors. */
const GATEWAY_PREFIX = "/api/plugin-manager";
/** Registry timeout for one update check. */
const REGISTRY_TIMEOUT_MS = 3e4;
/** Deadline for one dsh --version probe. */
const VERSION_TIMEOUT_MS = 1e4;
/** Grace period after SIGTERM before a stuck probe child is SIGKILLed. */
const VERSION_ESCALATION_TIMEOUT_MS = 5e3;
/** Successful probe freshness window before the host version is re-read. */
const VERSION_PROBE_TTL_MS = 5 * 6e4;
/** Minimum gap between failed version probes (avoids a spawn per request). */
const VERSION_PROBE_COOLDOWN_MS = 6e4;
/** Error text for a caught request or lifecycle failure. */
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}
/** Append bounded probe output. */
function captureProbe(chunk, buffer) {
	buffer.value = (buffer.value + chunk.toString()).slice(-4096);
}
/**
* Default registry manifest probe for npm packages: `/<name>/latest` returns
* the full latest-version manifest, so the `dsh` / `engines` compat metadata
* rides the same request as the version (no packument needed).
*/
async function fetchRegistryManifest(name) {
	const encoded = name.startsWith("@") ? name.replace("/", "%2F") : name;
	const response = await fetch(`https://registry.npmjs.org/${encoded}/latest`, { signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS) });
	if (!response.ok) return void 0;
	const body = await response.json();
	if (typeof body.version !== "string") return void 0;
	return {
		version: body.version,
		dsh: body.dsh,
		engines: body.engines
	};
}
/**
* Read the running DSH host version through `dsh --version` (the CLI is the
* gateway's write path already; this package has no in-process source).
* Returns undefined when the binary is unavailable or the output is not a
* plain semver; callers treat an unknown host version as a fail-closed
* verdict for declared requirements (issue #754).
*/
async function probeDshVersion(cliAvailable) {
	if (!cliAvailable()) return void 0;
	const binary = findDshBinary();
	if (binary === null) return void 0;
	const output = { value: "" };
	const child = spawnDsh(binary, ["--version"], process.env);
	child.stdout?.on("data", (chunk) => {
		captureProbe(chunk, output);
	});
	child.stderr?.on("data", (chunk) => {
		captureProbe(chunk, output);
	});
	let escalated;
	const timer = setTimeout(() => {
		child.kill();
		escalated = setTimeout(() => {
			child.kill("SIGKILL");
		}, VERSION_ESCALATION_TIMEOUT_MS);
	}, VERSION_TIMEOUT_MS);
	if (await new Promise((resolve) => {
		let settled = false;
		const finish = (value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (escalated !== void 0) clearTimeout(escalated);
			resolve(value);
		};
		child.once("error", () => finish(null));
		child.once("close", finish);
	}) !== 0) return void 0;
	const version = output.value.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
	return parseDshVersion(version) === void 0 ? void 0 : version;
}
/** Whether a dependency spec is a direct npm-registry selector, not an alias or external source. */
function isDirectRegistrySpec(spec) {
	return !/^(?:link:|file:|git:|github:|git\+|https?:\/\/|npm:|workspace:|catalog:)/.test(spec);
}
/**
* Build the gateway routes.
* @param deps - profile facts, the CLI gateway, and seams.
* @returns the web-server routes to register.
*/
function makeGatewayRoutes(deps) {
	const { facts, gateway } = deps;
	const fetchManifest = deps.fetchManifest ?? fetchRegistryManifest;
	/**
	* Cached `dsh --version`: successful verdicts refresh after a TTL (the CLI
	* update path is the gateway itself, so a stale success is wrong long-term),
	* failed probes are retried after a cooldown instead of being cached forever,
	* and concurrent requests share one in-flight probe.
	*/
	let dshVersion;
	let dshVersionAt = 0;
	let dshVersionPending;
	const resolveDshVersion = () => {
		if (deps.dshVersion !== void 0) return deps.dshVersion();
		const now = Date.now();
		if (dshVersion !== void 0 && now - dshVersionAt < VERSION_PROBE_TTL_MS) return Promise.resolve(dshVersion);
		if (dshVersionAt !== 0 && now - dshVersionAt < VERSION_PROBE_COOLDOWN_MS) return Promise.resolve(void 0);
		if (dshVersionPending === void 0) {
			dshVersionAt = now;
			dshVersionPending = probeDshVersion(deps.cliAvailable).catch(() => void 0).then((version) => {
				dshVersionPending = void 0;
				if (version !== void 0) {
					dshVersion = version;
					dshVersionAt = now;
				}
				return version;
			});
		}
		return dshVersionPending;
	};
	/**
	* Compat verdict for one declared requirement. Unverified (unknown host,
	* malformed host output, unsupported range) is incompatible so an update
	* can never run against a runtime we cannot prove compatible (issue #754);
	* only absent metadata keeps the update fail-open.
	*/
	const compatibleVerdict = async (requiresDsh) => {
		const hostVersion = await resolveDshVersion();
		if (hostVersion === void 0) return { compatible: false };
		return {
			hostVersion,
			compatible: meetsMinimumDsh(hostVersion, requiresDsh) === true
		};
	};
	/** Wrap a handler with the loopback fence and JSON error reporting. */
	const guard = (handler) => async (req, res) => {
		if (!isLoopbackRequest(req)) {
			writeJson(res, 403, {
				ok: false,
				error: "forbidden: loopback-only"
			});
			return;
		}
		try {
			await handler(req, res);
		} catch (error) {
			writeJson(res, 500, { error: messageOf(error) });
		}
	};
	const listHandler = async (_req, res) => {
		const patchText = await readPatchText(facts.patchPath);
		writeJson(res, 200, { plugins: (await snapshotGateway(facts, patchText)).plugins });
	};
	const installHandler = async (req, res) => {
		const spec = (await readJsonBody(req, {
			maxBytes: 64 * 1024,
			objectOnly: true
		}) ?? {})["spec"];
		if (typeof spec !== "string" || spec.trim() === "") {
			writeJson(res, 400, { error: "plugin-manager: install needs a spec" });
			return;
		}
		const unsafeSpec = unsafeSpecReason(spec.trim());
		if (unsafeSpec !== void 0) {
			writeJson(res, 400, { error: unsafeSpec });
			return;
		}
		if (!deps.cliAvailable()) {
			writeJson(res, 500, { error: "plugin-manager: dsh CLI not found on PATH" });
			return;
		}
		writeJson(res, 200, gateway.install(spec.trim()));
	};
	const updateHandler = async (req, res) => {
		const id = (await readJsonBody(req, {
			maxBytes: 64 * 1024,
			objectOnly: true
		}) ?? {})["id"];
		if (typeof id !== "string" || id.trim() === "") {
			writeJson(res, 400, { error: "plugin-manager: update needs an id" });
			return;
		}
		const target = id.trim();
		const unsafe = unsafeSpecReason(target);
		if (unsafe !== void 0) {
			writeJson(res, 400, { error: unsafe });
			return;
		}
		if (!deps.cliAvailable()) {
			writeJson(res, 500, { error: "plugin-manager: dsh CLI not found on PATH" });
			return;
		}
		const outcome = await gateway.withMutationLock(async () => {
			const patchText = await readPatchText(facts.patchPath);
			const row = (await snapshotGateway(facts, patchText)).plugins.find((plugin) => plugin.id === target);
			if (row === void 0) return {
				status: 404,
				error: `plugin-manager: plugin ${target} is not installed`
			};
			if (row.source.kind !== "npm" || !isDirectRegistrySpec(row.source.spec)) return {
				status: 400,
				error: `plugin-manager: ${target} is not a direct npm registry plugin`
			};
			const manifest = await fetchManifest(target).catch(() => void 0);
			if (manifest === void 0) return {
				status: 502,
				error: `plugin-manager: cannot resolve the latest version for ${target}`
			};
			const latest = manifest.version;
			if (latest === "") return {
				status: 502,
				error: `plugin-manager: cannot resolve the latest version for ${target}`
			};
			const unsafeLatest = unsafeSpecReason(`${target}@${latest}`);
			if (unsafeLatest !== void 0) return {
				status: 502,
				error: unsafeLatest
			};
			if (row.version === latest) return {
				status: 409,
				error: `plugin-manager: ${target} is already at ${latest}`
			};
			const requiresDsh = dshRequirementOf(manifest);
			if (requiresDsh !== void 0) {
				const { hostVersion, compatible } = await compatibleVerdict(requiresDsh);
				if (!compatible) return {
					status: 412,
					error: hostVersion === void 0 ? `plugin-manager: cannot verify the DSH version for ${target} (dsh --version failed); upgrade DSH before updating` : `plugin-manager: ${target} requires DSH ${requiresDsh} (current DSH ${hostVersion}); upgrade DSH before updating`
				};
			}
			return {
				status: 200,
				job: gateway.update(target, latest)
			};
		});
		if ("error" in outcome) {
			writeJson(res, outcome.status, { error: outcome.error });
			return;
		}
		writeJson(res, outcome.status, outcome.job);
	};
	const removeHandler = async (req, res) => {
		const id = (await readJsonBody(req, {
			maxBytes: 64 * 1024,
			objectOnly: true
		}) ?? {})["id"];
		if (typeof id !== "string" || id.trim() === "") {
			writeJson(res, 400, { error: "plugin-manager: remove needs an id" });
			return;
		}
		const unsafeId = unsafeSpecReason(id.trim());
		if (unsafeId !== void 0) {
			writeJson(res, 400, { error: unsafeId });
			return;
		}
		if (!deps.cliAvailable()) {
			writeJson(res, 500, { error: "plugin-manager: dsh CLI not found on PATH" });
			return;
		}
		writeJson(res, 200, gateway.remove(id.trim()));
	};
	const statusHandler = async (req, res) => {
		const jobId = new URL(req.url ?? "/", "http://localhost").searchParams.get("job");
		if (jobId === null) {
			writeJson(res, 400, { error: "plugin-manager: status needs a job id" });
			return;
		}
		const job = gateway.status(jobId);
		if (job === void 0) {
			writeJson(res, 404, { error: "plugin-manager: unknown job" });
			return;
		}
		writeJson(res, 200, { job });
	};
	const setEnabledHandler = async (req, res) => {
		const body = await readJsonBody(req, {
			maxBytes: 64 * 1024,
			objectOnly: true
		}) ?? {};
		const id = body["id"];
		const enabled = body["enabled"];
		if (typeof id !== "string" || id.trim() === "" || typeof enabled !== "boolean") {
			writeJson(res, 400, { error: "plugin-manager: set-enabled needs an id and a boolean enabled" });
			return;
		}
		const target = id.trim();
		const unsafeTarget = unsafeSpecReason(target);
		if (unsafeTarget !== void 0) {
			writeJson(res, 400, { error: unsafeTarget });
			return;
		}
		const outcome = await gateway.withMutationLock(async () => {
			const patchText = await readPatchText(facts.patchPath);
			if ((await readProfileManifest(facts.packageJsonPath)).dependencies[target] === void 0) return { error: `plugin-manager: plugin ${target} is not installed` };
			const entries = await claimedEntryRowsOf(facts, target);
			let next = patchText;
			for (const entry of entries) next = setRowEnabled(next, facts.patchPath, entry.id, entry.name, enabled);
			if (next !== patchText) await writePatchAtomic(facts.patchPath, next);
			const plugin = (await snapshotGateway(facts, next)).plugins.find((item) => item.id === target);
			return plugin === void 0 ? { error: `plugin-manager: plugin ${target} is not installed` } : { plugin };
		});
		if ("error" in outcome) {
			writeJson(res, 404, { error: outcome.error });
			return;
		}
		writeJson(res, 200, { plugin: outcome.plugin });
	};
	const failuresHandler = async (_req, res) => {
		writeJson(res, 200, {
			items: [],
			pluginRoot: facts.profileDir,
			safeMode: false
		});
	};
	let modePromise;
	const probeOfficialChannels = () => {
		const binary = findDshBinary();
		if (binary === null) return Promise.resolve(false);
		return detectOfficialChannels(binary, facts.profileName);
	};
	const modeHandler = async (_req, res) => {
		if (modePromise === void 0) if (facts.desktop) modePromise = Promise.resolve({ official: null });
		else modePromise = (deps.officialChannels ?? probeOfficialChannels)().then((official) => ({ official })).catch(() => ({ official: false }));
		writeJson(res, 200, await modePromise);
	};
	const checkUpdatesHandler = async (_req, res) => {
		const patchText = await readPatchText(facts.patchPath);
		const snapshot = await snapshotGateway(facts, patchText);
		const updates = [];
		for (const plugin of snapshot.plugins) {
			if (plugin.source.kind !== "npm" || !isDirectRegistrySpec(plugin.source.spec)) continue;
			const manifest = await fetchManifest(plugin.id).catch(() => void 0);
			if (manifest === void 0 || manifest.version === plugin.version) continue;
			const update = {
				id: plugin.id,
				current: plugin.version,
				latest: manifest.version
			};
			const requiresDsh = dshRequirementOf(manifest);
			if (requiresDsh !== void 0) {
				update.requiresDsh = requiresDsh;
				update.compatible = (await compatibleVerdict(requiresDsh)).compatible;
			}
			updates.push(update);
		}
		writeJson(res, 200, { updates });
	};
	return [
		{
			kind: "exact",
			path: `${GATEWAY_PREFIX}/list`,
			handler: guard(listHandler)
		},
		{
			kind: "exact",
			path: `${GATEWAY_PREFIX}/install`,
			handler: guard(installHandler)
		},
		{
			kind: "exact",
			path: `${GATEWAY_PREFIX}/update`,
			handler: guard(updateHandler)
		},
		{
			kind: "exact",
			path: `${GATEWAY_PREFIX}/remove`,
			handler: guard(removeHandler)
		},
		{
			kind: "exact",
			path: `${GATEWAY_PREFIX}/status`,
			handler: guard(statusHandler)
		},
		{
			kind: "exact",
			path: `${GATEWAY_PREFIX}/set-enabled`,
			handler: guard(setEnabledHandler)
		},
		{
			kind: "exact",
			path: `${GATEWAY_PREFIX}/failures`,
			handler: guard(failuresHandler)
		},
		{
			kind: "exact",
			path: `${GATEWAY_PREFIX}/mode`,
			handler: guard(modeHandler)
		},
		{
			kind: "exact",
			path: `${GATEWAY_PREFIX}/check-updates`,
			handler: guard(checkUpdatesHandler)
		}
	];
}
//#endregion
//#region src/index.ts
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
const name = "ui-plugin-manager";
/** Services the gateway needs — the web server seam. */
const inject = ["webServer"];
/** Apply the host half (once per process). */
const apply = mountOnce("@linxin666/dsh-client-ui-plugin-manager", applyImpl);
function applyImpl(ctx) {
	let facts;
	try {
		facts = resolveProfile();
	} catch (error) {
		console.error("[plugin-manager]", error instanceof Error ? error.message : String(error));
		return;
	}
	if (!profileExists(facts.profileDir)) return;
	const gateway = new CliGateway(facts);
	const cliAvailable = () => findDshBinary() !== null;
	ctx.effect(() => {
		const disposers = makeGatewayRoutes({
			facts,
			gateway,
			cliAvailable
		}).map((route) => ctx.webServer.register(route));
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "plugin-manager: gateway routes");
}
//#endregion
export { apply, inject, name };
