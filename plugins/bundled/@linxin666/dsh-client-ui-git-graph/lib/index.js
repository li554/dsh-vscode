import { realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
//#region src/host/git-runner.ts
/** Collected-output cap for one git command. */
const OUTPUT_CAP_BYTES = 1 << 20;
/**
* Production runner over the subprocess service: one managed child per
* command, bounded collect on both streams. A caller-owned AbortSignal reaches
* the subprocess tree and remains authoritative even in degrade mode. Degrade
* mode keeps the SCM tab showing the friendly "not a git repository" state
* instead of a bare 400 when git is missing or the subprocess service fails.
* @param ctx - context carrying the subprocess service.
* @param options - per-package behavior knobs.
* @returns the runner.
*/
function subprocessRunner$1(ctx, options = {}) {
	const spawnArgv = options.spawnArgv ?? ((argv) => ["git", ...argv]);
	const degrade = options.failureMode === "degrade";
	const errorTag = options.errorTag ?? "git";
	const failure = (prefix, error) => ({
		exitCode: 127,
		stdout: "",
		stderr: prefix + (error instanceof Error ? error.message : String(error))
	});
	return { async run(argv, cwd, signal) {
		signal?.throwIfAborted();
		const spec = {
			argv: spawnArgv(argv),
			cwd,
			stdio: {
				stdin: "ignore",
				stdout: { maxBytes: OUTPUT_CAP_BYTES },
				stderr: { maxBytes: OUTPUT_CAP_BYTES }
			},
			graceMs: 1e4,
			signal
		};
		if (degrade) {
			let handle;
			try {
				handle = ctx.subprocess.spawn(spec);
			} catch (error) {
				signal?.throwIfAborted();
				console.error("[" + errorTag + "] git spawn failed:", error);
				return failure("git: spawn failed: ", error);
			}
			try {
				const outcome = await handle.done;
				signal?.throwIfAborted();
				const stdout = handle.collected.stdout?.readFrom(0).text ?? "";
				const stderr = handle.collected.stderr?.readFrom(0).text ?? "";
				return {
					exitCode: outcome.exitCode,
					stdout,
					stderr
				};
			} catch (error) {
				signal?.throwIfAborted();
				console.error("[" + errorTag + "] git run failed:", error);
				return failure("git: run failed: ", error);
			}
		}
		const handle = ctx.subprocess.spawn(spec);
		const outcome = await handle.done;
		signal?.throwIfAborted();
		const stdout = handle.collected.stdout?.readFrom(0).text ?? "";
		const stderr = handle.collected.stderr?.readFrom(0).text ?? "";
		return {
			exitCode: outcome.exitCode,
			stdout,
			stderr
		};
	} };
}
//#endregion
//#region src/core/git-command.ts
/** `git rev-parse --show-toplevel` — canonical repository root. */
const topLevelArgv = () => ["rev-parse", "--show-toplevel"];
/** `git rev-parse --abbrev-ref HEAD` — current branch ('HEAD' when detached). */
const headBranchArgv = () => [
	"rev-parse",
	"--abbrev-ref",
	"HEAD"
];
/** `git rev-parse --short HEAD` — short head id. */
const headShortArgv = () => [
	"rev-parse",
	"--short",
	"HEAD"
];
/** `git for-each-ref refs/heads --format=%(refname:short)%00%(HEAD)%00%(objectname)` — local branches. */
const forEachRefArgv = () => [
	"for-each-ref",
	"refs/heads",
	"--format=%(refname:short)%00%(HEAD)%00%(objectname)"
];
/** `git status --porcelain` — worktree dirtiness and conflicts. */
const statusPorcelainArgv = () => ["status", "--porcelain"];
/** `git diff --name-only --diff-filter=U` — unmerged (conflict) files. */
const unmergedArgv = () => [
	"diff",
	"--name-only",
	"--diff-filter=U"
];
/** `git worktree list --porcelain` — all worktrees and their checked-out branches. */
const worktreeListArgv = () => [
	"worktree",
	"list",
	"--porcelain"
];
/** `git rev-parse --verify --quiet refs/heads/<branch>` — branch existence probe. */
const verifyRefArgv = (branch) => [
	"rev-parse",
	"--verify",
	"--quiet",
	`refs/heads/${branch}`
];
/** `git check-ref-format --branch <name>` — the authoritative branch-name gate. */
const checkRefFormatArgv = (name) => [
	"check-ref-format",
	"--branch",
	name
];
/** `git switch --no-guess -- <branch>` — workspace-level branch switch (ZCode semantics). */
const switchArgv = (branch) => [
	"switch",
	"--no-guess",
	"--",
	branch
];
/** `git switch --no-guess -c <name>` — create from current HEAD and switch. */
const createBranchArgv = (name) => [
	"switch",
	"--no-guess",
	"-c",
	name
];
/** Graph log: `git log --branches --tags --remotes --topo-order --parents --format=... --max-count <n>`. */
const graphLogArgv = (limit) => [
	"log",
	"--branches",
	"--tags",
	"--remotes",
	"--topo-order",
	"--parents",
	"--format=%H%x00%P%x00%an%x00%at%x00%D%x00%s%x1e",
	"--max-count",
	String(limit)
];
/** Git markers whose presence means an operation is in progress. */
const OPERATION_MARKERS = [
	"MERGE_HEAD",
	"CHERRY_PICK_HEAD",
	"REVERT_HEAD",
	"BISECT_LOG",
	"rebase-merge",
	"rebase-apply",
	"sequencer"
];
/**
* git rev-parse --git-path <marker> - resolve ONE operation marker to its
* on-disk path. Kept as the per-marker probe for the service's fallback
* when the single combined spawn fails (a hung or non-zero combined call
* must not silently hide an in-progress operation).
*/
const gitPathArgv = (marker) => [
	"rev-parse",
	"--git-path",
	marker
];
/**
* git rev-parse --git-path <marker>... - resolve every operation-marker path
* in ONE spawn (one --git-path option per marker; the option form is
* repeatable, unlike positional paths). On Windows, where each git.exe cold
* start costs about 0.7s, this replaces the previous 7 sequential marker
* probes with a single process.
*/
const operationMarkersArgv = () => ["rev-parse", ...OPERATION_MARKERS.flatMap((marker) => ["--git-path", marker])];
const OVERWRITE_PATTERNS = [
	{
		code: "tracked-changes-would-be-overwritten",
		header: /Your local changes to the following files would be overwritten by checkout/
	},
	{
		code: "untracked-changes-would-be-overwritten",
		header: /The following untracked working tree files would be overwritten by checkout/
	},
	{
		code: "tracked-changes-would-be-overwritten",
		header: /Your local changes to the following files would be overwritten by merge/
	}
];
/**
* Extract the blocked-file list following an overwrite header: git indents
* paths with a tab (quoted when they contain spaces); the trailing hint
* lines ("Please commit your changes...") end the list.
* @param stderr - the full git stderr.
* @param header - the matched header regex.
* @returns up to two file paths plus the count of remaining files.
*/
function extractBlockedPaths(stderr, header) {
	const start = stderr.indexOf("\n", stderr.search(header));
	if (start === -1) return {
		paths: [],
		moreFiles: 0
	};
	const paths = [];
	for (const line of stderr.slice(start + 1).split("\n")) {
		const trimmed = line.trim();
		if (trimmed === "" || !line.startsWith("	")) break;
		const quoted = /^"(.+)"$/.exec(trimmed);
		const path = quoted === null ? trimmed.replace(/\\(.)/g, "$1") : (quoted[1] ?? "").replace(/\\(.)/g, "$1");
		paths.push(path);
	}
	return {
		paths: paths.slice(0, 2),
		moreFiles: Math.max(0, paths.length - 2)
	};
}
/**
* Classify a failed switch's stderr onto the stable error vocabulary.
* @param stderr - git stderr from the failed switch/create.
* @returns the classified error; `internal` when nothing matches.
*/
function classifySwitchFailure(stderr) {
	const head = stderr.trim().split("\n")[0] ?? stderr;
	for (const pattern of OVERWRITE_PATTERNS) if (pattern.header.test(stderr)) {
		const { paths, moreFiles } = extractBlockedPaths(stderr, pattern.header);
		return {
			code: pattern.code,
			message: head,
			paths,
			moreFiles
		};
	}
	if (/did not match any file\(s\) known to git|invalid reference|not a valid branch/.test(stderr)) return {
		code: "target-branch-not-found",
		message: head
	};
	if (/already used by worktree|is already checked out at/.test(stderr)) return {
		code: "branch-in-other-worktree",
		message: head
	};
	if (/local changes to the following files would be overwritten/.test(stderr)) return {
		code: "tracked-changes-would-be-overwritten",
		message: head
	};
	return {
		code: "internal",
		message: head || "git switch failed"
	};
}
/**
* Pure mirror of `git check-ref-format --branch` short-name rules, for
* instant client-side feedback; the host's check-ref-format call stays the
* authoritative gate. Returns the reason when the name is invalid.
* @param name - proposed branch name (short form, no refs/ prefix).
* @returns null when valid, else a short reason.
*/
function validateBranchName(name) {
	if (name === "") return "empty";
	if (name === "@") return "at-sign";
	if (name.startsWith("-")) return "leading-dash";
	if (name.endsWith(".")) return "trailing-dot";
	if (name.endsWith(".lock")) return "lock-suffix";
	if (name.includes("..")) return "double-dot";
	if (name.includes("@{")) return "at-brace";
	if (name.includes("//")) return "double-slash";
	if (name.includes(" ")) return "space";
	if (name.includes("~") || name.includes("^") || name.includes(":")) return "forbidden-char";
	if (name.includes("?") || name.includes("*") || name.includes("[") || name.includes("\\")) return "forbidden-char";
	for (const ch of name) {
		const code = ch.codePointAt(0);
		if (code !== void 0 && (code < 32 || code === 127)) return "control-char";
	}
	for (const component of name.split("/")) {
		if (component === "") return "empty-component";
		if (component.startsWith(".")) return "dot-component";
		if (component.endsWith(".lock")) return "lock-suffix";
	}
	if (name.length > 1e3) return "too-long";
	return null;
}
//#endregion
//#region src/core/types.ts
/** Parse output of `git for-each-ref refs/heads --format=...`. */
function parseBranches(stdout) {
	const rows = [];
	for (const line of stdout.split("\n")) {
		if (line === "") continue;
		const [name, head, oid] = line.split("\0");
		if (name === void 0 || head === void 0 || oid === void 0) continue;
		rows.push({
			name,
			current: head === "*"
		});
	}
	rows.sort((a, b) => a.name.localeCompare(b.name));
	return rows;
}
/** Parse `git worktree list --porcelain` into the branch refs checked out (porcelain prints `branch refs/heads/<name>`). */
function parseWorktreeBranches(stdout) {
	const branches = [];
	for (const line of stdout.split("\n")) {
		if (!line.startsWith("branch refs/heads/")) continue;
		const name = line.slice(18).trim();
		if (name !== "" && !branches.includes(name)) branches.push(name);
	}
	return branches;
}
/** Parse the porcelain status into counts. */
function parsePorcelain(stdout) {
	let dirtyFiles = 0;
	let untrackedFiles = 0;
	let conflicts = 0;
	const unmerged = /* @__PURE__ */ new Set([
		"DD",
		"AU",
		"UD",
		"UA",
		"DU",
		"AA",
		"UU"
	]);
	for (const line of stdout.split("\n")) {
		if (line === "") continue;
		const xy = line.slice(0, 2);
		if (unmerged.has(xy)) conflicts += 1;
		else if (xy.startsWith("??")) untrackedFiles += 1;
		else dirtyFiles += 1;
	}
	return {
		dirtyFiles,
		untrackedFiles,
		conflicts
	};
}
/**
* Parse the graph format rows (`%H %P %an %at %D %s` split by \x1e). `git
* log` (tformat) appends a newline after the record separator, so every
* record except the first carries a leading `\n` — strip it or the oid gets
* corrupted and a trailing `\n` would parse as a phantom commit.
*/
function parseGraph(stdout) {
	const commits = [];
	for (const raw of stdout.split("")) {
		const entry = raw.replace(/^\n/, "");
		if (entry === "") continue;
		const [oid, parentsRaw, author, authorTimeRaw, decoration, subject] = entry.split("\0");
		if (oid === void 0 || oid === "") continue;
		commits.push({
			oid,
			parents: parentsRaw === void 0 || parentsRaw === "" ? [] : parentsRaw.split(" "),
			subject: subject ?? "",
			author: author ?? "",
			authorTime: Number(authorTimeRaw ?? "0"),
			refs: parseDecoration(decoration ?? "")
		});
	}
	return commits;
}
/** Decoration → ref names: split entries, drop the `HEAD -> ` handoff prefix, drop a bare detached-`HEAD` entry, drop `tag: `. */
function parseDecoration(decoration) {
	if (decoration === "") return [];
	return decoration.split(", ").map((part) => {
		if (part === "HEAD") return "";
		return part.replace(/^HEAD -> /, "").replace(/^tag: /, "").trim();
	}).filter((name) => name !== "");
}
/**
* Runtime narrowing for the wire types served to the browser. Zod is not a
* dependency of this package, so each guard is a hand-written structural
* check over the same shape the host service produces. The routes boundary
* runs these before sending a view so a malformed service output can never
* leak to the client as a typed envelope value.
* @module dsh-git-graph/core/types
*/
/** Narrow an unknown value onto {@link RepoStatus}. */
function isRepoStatus(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.root === "string" && typeof record.branch === "string" && typeof record.head === "string" && typeof record.dirtyFiles === "number" && typeof record.untrackedFiles === "number" && typeof record.conflicts === "number" && typeof record.operationInProgress === "boolean";
}
/** Narrow an unknown value onto {@link BranchRow}. */
function isBranchRow(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.name === "string" && typeof record.current === "boolean";
}
/** Narrow an unknown value onto {@link BranchesView}. */
function isBranchesView(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.root === "string" && typeof record.branch === "string" && Array.isArray(record.branches) && record.branches.every(isBranchRow) && typeof record.dirtyFiles === "number" && typeof record.untrackedFiles === "number" && typeof record.conflicts === "number" && typeof record.operationInProgress === "boolean";
}
/** Narrow an unknown value onto {@link GraphCommit}. */
function isGraphCommit(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.oid === "string" && Array.isArray(record.parents) && record.parents.every((parent) => typeof parent === "string") && typeof record.subject === "string" && typeof record.author === "string" && typeof record.authorTime === "number" && Array.isArray(record.refs) && record.refs.every((ref) => typeof ref === "string");
}
/** Narrow an unknown value onto {@link GraphView}. */
function isGraphView(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.root === "string" && typeof record.branch === "string" && Array.isArray(record.commits) && record.commits.every(isGraphCommit) && typeof record.hasMore === "boolean";
}
/** The set of stable {@link GitErrorCode} members the client maps onto copy. */
const GIT_ERROR_CODES = /* @__PURE__ */ new Set([
	"conflicts-present",
	"operation-in-progress",
	"branch-in-other-worktree",
	"tracked-changes-would-be-overwritten",
	"untracked-changes-would-be-overwritten",
	"target-branch-not-found",
	"invalid-branch-name",
	"branch-already-exists",
	"workspace-unknown",
	"internal"
]);
/** Narrow an unknown value onto {@link GitErrorCode}. */
function isGitErrorCode(value) {
	return typeof value === "string" && GIT_ERROR_CODES.has(value);
}
/** Narrow an unknown value onto {@link GitError}. */
function isGitError(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	if (!isGitErrorCode(record.code)) return false;
	if (typeof record.message !== "string") return false;
	if (record.paths !== void 0 && (!Array.isArray(record.paths) || !record.paths.every((path) => typeof path === "string"))) return false;
	if (record.moreFiles !== void 0 && typeof record.moreFiles !== "number") return false;
	return true;
}
//#endregion
//#region src/host/git-service.ts
/**
* Host git service: workspace-scoped git operations through a runner seam
* (production: the subprocess service; tests: a plain child_process runner).
* Guards mirror ZCode's branchSwitcher semantics — unresolved conflicts,
* in-progress operations, and branches checked out in another worktree are
* rejected with stable codes before any mutation.
* @module dsh-git-graph/host/git-service
*/
/**
* Build the argv for one git invocation, with the win32 binary variant.
* Windows ships git as git.exe (git for Windows); a .cmd/.bat shim in PATH
* would otherwise be the resolution target and Node's spawn cannot launch
* a .cmd file directly (the dsh-subprocess seam applies no shell). Naming
* git.exe bypasses any shim and always hits the native executable. cmd.exe
* routing is deliberately NOT used: several git args carry %-format specs
* (for-each-ref/log --format) that cmd would expand and corrupt.
* @param platform - the process platform (process.platform in production; a test seam).
* @param argv - the git subcommand args.
* @returns the full spawn argv, starting with the platform git binary.
*/
function gitSpawnArgv(platform, argv) {
	return platform === "win32" ? ["git.exe", ...argv] : ["git", ...argv];
}
/**
* Production runner over `ctx.subprocess`: shared plumbing with the win32
* git.exe argv variant.
* @param ctx - context carrying the subprocess service.
* @returns the runner.
*/
function subprocessRunner(ctx) {
	return subprocessRunner$1(ctx, { spawnArgv: (argv) => gitSpawnArgv(process.platform, argv) });
}
/** HEAD is the symbolic value `git rev-parse --abbrev-ref HEAD` prints when detached. */
const DETACHED = "HEAD";
/** Rejection for a path outside the workspace registry. */
const WORKSPACE_UNKNOWN = {
	code: "workspace-unknown",
	message: "path is not a registered workspace"
};
/**
* Workspace-scoped git operations. Every public method first passes the
* workspace gate, then resolves the repository root from the requested path
* and rejects non-repositories with `null` (or a rejection for mutations).
*/
var GitService = class {
	runner;
	gate;
	/**
	* @param runner - the spawn seam.
	* @param gate - workspace-membership gate (host: canonical path ∈ registered workspace paths).
	*/
	constructor(runner, gate) {
		this.runner = runner;
		this.gate = gate;
	}
	/** Status work currently running for each requested workspace path. */
	statusFlights = /* @__PURE__ */ new Map();
	/**
	* The plumbing every read view shares: gate, repo root, current branch, and
	* the porcelain counts + operation marker. Null when the path is not a
	* usable repository (the workspace-gate semantics both views keep).
	*/
	async snapshot(path, signal) {
		const gated = await this.gate(path);
		if (!gated.ok) return null;
		const root = await this.repoRoot(gated.canonical, signal);
		if (root === null) return null;
		const [branchResult, porcelain] = await Promise.all([this.runner.run(headBranchArgv(), root, signal), this.runner.run(statusPorcelainArgv(), root, signal)]);
		const branch = branchResult.stdout.trim();
		return {
			root,
			branch: branch === DETACHED ? "" : branch,
			counts: parsePorcelain(porcelain.stdout),
			operationInProgress: await this.operationInProgress(root, signal)
		};
	}
	/**
	* The repository snapshot the branch chip renders; null when not a repository.
	* Concurrent reads for the same requested workspace share one underlying
	* status task until it settles, preventing timed-out polls from accumulating.
	*/
	status(path, signal) {
		const existing = this.statusFlights.get(path);
		if (existing !== void 0) return existing;
		const flight = this.statusFromPath(path, signal);
		this.statusFlights.set(path, flight);
		const clear = () => {
			if (this.statusFlights.get(path) === flight) this.statusFlights.delete(path);
		};
		flight.then(clear, clear);
		return flight;
	}
	async statusFromPath(path, signal) {
		const gated = await this.gate(path);
		if (!gated.ok) return null;
		return this.statusFromGatedPath(gated.canonical, signal);
	}
	async statusFromGatedPath(path, signal) {
		const snap = await this.snapshotFromGatedPath(path, signal);
		if (snap === null) return null;
		const headResult = await this.runner.run(headShortArgv(), snap.root, signal);
		return {
			root: snap.root,
			branch: snap.branch,
			head: headResult.stdout.trim(),
			dirtyFiles: snap.counts.dirtyFiles,
			untrackedFiles: snap.counts.untrackedFiles,
			conflicts: snap.counts.conflicts,
			operationInProgress: snap.operationInProgress
		};
	}
	async snapshotFromGatedPath(path, signal) {
		const root = await this.repoRoot(path, signal);
		if (root === null) return null;
		const [branchResult, porcelain] = await Promise.all([this.runner.run(headBranchArgv(), root, signal), this.runner.run(statusPorcelainArgv(), root, signal)]);
		const branch = branchResult.stdout.trim();
		return {
			root,
			branch: branch === DETACHED ? "" : branch,
			counts: parsePorcelain(porcelain.stdout),
			operationInProgress: await this.operationInProgress(root, signal)
		};
	}
	/** Local branch list with the current branch marked (git for-each-ref refs/heads). */
	async branches(path) {
		const snap = await this.snapshot(path);
		if (snap === null) return null;
		const refs = await this.runner.run(forEachRefArgv(), snap.root);
		return {
			root: snap.root,
			branch: snap.branch,
			branches: parseBranches(refs.stdout),
			dirtyFiles: snap.counts.dirtyFiles,
			untrackedFiles: snap.counts.untrackedFiles,
			conflicts: snap.counts.conflicts,
			operationInProgress: snap.operationInProgress
		};
	}
	/**
	* Switch the workspace's checked-out branch: real `git switch --no-guess`
	* on disk, affecting every session in the workspace (never a per-session
	* override). Guards run before the mutation; switch failures classify onto
	* the stable error codes.
	* @param path - workspace root.
	* @param branch - existing local branch name.
	*/
	async switchBranch(path, branch) {
		const gated = await this.gate(path);
		if (!gated.ok) return {
			ok: false,
			error: WORKSPACE_UNKNOWN
		};
		const root = await this.repoRoot(gated.canonical);
		if (root === null) return {
			ok: false,
			error: {
				code: "internal",
				message: "not a git repository"
			}
		};
		const formatted = await this.runner.run(checkRefFormatArgv(branch), root);
		if (formatted.exitCode !== 0) return {
			ok: false,
			error: {
				code: "invalid-branch-name",
				message: formatted.stderr.trim() || "invalid branch name"
			}
		};
		if ((await this.runner.run(verifyRefArgv(branch), root)).exitCode !== 0) return {
			ok: false,
			error: {
				code: "target-branch-not-found",
				message: `branch "${branch}" does not exist locally`
			}
		};
		if ((await this.runner.run(headBranchArgv(), root)).stdout.trim() === branch) return {
			ok: true,
			branch
		};
		const blocked = await this.guardBlock(root, branch);
		if (blocked !== null) return {
			ok: false,
			error: blocked
		};
		const switched = await this.runner.run(switchArgv(branch), root);
		if (switched.exitCode === 0) return {
			ok: true,
			branch
		};
		return {
			ok: false,
			error: classifySwitchFailure(switched.stderr)
		};
	}
	/**
	* Create a branch from the current HEAD and switch to it
	* (`git switch --no-guess -c <name>`). The authoritative name gate is
	* `git check-ref-format --branch`; duplicates are rejected up front.
	* @param path - workspace root.
	* @param name - proposed branch name.
	*/
	async createBranch(path, name) {
		const mirrorReason = validateBranchName(name);
		if (mirrorReason !== null) return {
			ok: false,
			error: {
				code: "invalid-branch-name",
				message: `invalid branch name: ${mirrorReason}`
			}
		};
		const gated = await this.gate(path);
		if (!gated.ok) return {
			ok: false,
			error: WORKSPACE_UNKNOWN
		};
		const root = await this.repoRoot(gated.canonical);
		if (root === null) return {
			ok: false,
			error: {
				code: "internal",
				message: "not a git repository"
			}
		};
		const formatted = await this.runner.run(checkRefFormatArgv(name), root);
		if (formatted.exitCode !== 0) return {
			ok: false,
			error: {
				code: "invalid-branch-name",
				message: formatted.stderr.trim() || "invalid branch name"
			}
		};
		if ((await this.runner.run(verifyRefArgv(name), root)).exitCode === 0) return {
			ok: false,
			error: {
				code: "branch-already-exists",
				message: `branch "${name}" already exists`
			}
		};
		const blocked = await this.guardBlock(root, void 0);
		if (blocked !== null) return {
			ok: false,
			error: blocked
		};
		const created = await this.runner.run(createBranchArgv(name), root);
		if (created.exitCode === 0) return {
			ok: true,
			branch: name
		};
		return {
			ok: false,
			error: classifySwitchFailure(created.stderr)
		};
	}
	/** Topo-ordered commit graph across branches/tags/remotes (read-only). */
	async graph(path, limit = 200) {
		const gated = await this.gate(path);
		if (!gated.ok) return null;
		const root = await this.repoRoot(gated.canonical);
		if (root === null) return null;
		const [logResult, branchResult] = await Promise.all([this.runner.run(graphLogArgv(limit + 1), root), this.runner.run(headBranchArgv(), root)]);
		const commits = parseGraph(logResult.stdout);
		const hasMore = commits.length > limit;
		const branch = branchResult.stdout.trim();
		return {
			root,
			branch: branch === DETACHED ? "" : branch,
			commits: hasMore ? commits.slice(0, limit) : commits,
			hasMore
		};
	}
	/** Repository root of a canonical path, or null when not inside a git repository. */
	async repoRoot(path, signal) {
		const result = await this.runner.run(topLevelArgv(), path, signal);
		if (result.exitCode !== 0) return null;
		const root = result.stdout.trim();
		return root === "" ? null : root;
	}
	/** Whether any git operation marker is present in the repository. */
	async operationInProgress(root, signal) {
		const resolved = await this.runner.run(operationMarkersArgv(), root, signal);
		if (resolved.exitCode === 0) return resolved.stdout.split("\n").map((line) => line.trim()).filter((line) => line !== "").some((markerPath) => existsSync(resolve(root, markerPath)));
		let inProgress = false;
		for (const marker of OPERATION_MARKERS) {
			const markerPath = (await this.runner.run(gitPathArgv(marker), root, signal)).stdout.trim();
			if (markerPath !== "" && existsSync(resolve(root, markerPath))) inProgress = true;
		}
		return inProgress;
	}
	/**
	* The pre-switch guards (ZCode branchSwitcher semantics): unresolved
	* conflicts, in-progress operations, and a target already checked out in
	* another worktree.
	* @param root - repository root.
	* @param target - target branch; undefined for create (worktree check skipped).
	* @returns the rejection, or null when the switch may proceed.
	*/
	async guardBlock(root, target) {
		const [conflicts, inProgress, worktrees] = await Promise.all([
			this.runner.run(unmergedArgv(), root),
			this.operationInProgress(root),
			target === void 0 ? Promise.resolve(null) : this.runner.run(worktreeListArgv(), root)
		]);
		const conflictCount = conflicts.stdout.split("\n").filter((line) => line !== "").length;
		if (conflictCount > 0) return {
			code: "conflicts-present",
			message: `repository has ${conflictCount} unresolved conflict(s)`
		};
		if (inProgress) return {
			code: "operation-in-progress",
			message: "a git operation is in progress"
		};
		if (target !== void 0 && worktrees !== null && parseWorktreeBranches(worktrees.stdout).includes(target)) return {
			code: "branch-in-other-worktree",
			message: `branch "${target}" is checked out in another worktree`
		};
		return null;
	}
};
//#endregion
//#region src/host/poll-guard.ts
const DEFAULT_TIMERS = {
	set: (fn, ms) => setTimeout(fn, ms),
	clear: (handle) => {
		clearTimeout(handle);
	}
};
/**
* Owns one bounded poll loop.
*
* Guarantees: at most one task runs at a time (a scheduled tick whose turn
* arrives while a run is in flight is dropped); consecutive failures double
* the delay up to maxBackoffMs and reset on the first success; the loop
* stops forever at deadlineMs and cancels its timer.
*/
var PollGuard = class {
	options;
	handle;
	running = false;
	startedAt = 0;
	stopped = false;
	failures = 0;
	/** @param options - loop bounds; interval/deadline/backoff/onRun are required, the rest optional. */
	constructor(options) {
		this.options = {
			timers: DEFAULT_TIMERS,
			onDeadline: () => {},
			onSettled: () => {},
			...options
		};
	}
	/** Start the loop. Safe to call once; later calls are ignored. */
	start() {
		if (this.startedAt !== 0) return;
		this.startedAt = Date.now();
		this.schedule(this.options.intervalMs);
	}
	/** Stop the loop permanently and drop any pending tick. */
	stop() {
		this.stopped = true;
		this.options.timers.clear(this.handle);
		this.handle = void 0;
	}
	schedule(delayMs) {
		if (this.stopped) return;
		this.handle = this.options.timers.set(() => {
			this.tick();
		}, delayMs);
	}
	delay() {
		const backoff = this.options.intervalMs * 2 ** Math.min(this.failures, 8);
		return Math.min(backoff, this.options.maxBackoffMs);
	}
	async tick() {
		if (this.stopped) return;
		if (this.running) return;
		if (Date.now() - this.startedAt >= this.options.deadlineMs) {
			this.stopped = true;
			this.options.onDeadline();
			return;
		}
		this.running = true;
		try {
			await this.options.onRun();
			this.failures = 0;
		} catch {
			this.failures += 1;
		} finally {
			this.running = false;
			this.options.onSettled(this.failures);
			this.schedule(this.delay());
		}
	}
};
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
//#region src/host/access.ts
/**
* Whether this request may enter any /git route (JSON operations or SSE).
* @param ctx - host context; may expose remoteWebUiPairing.
* @param request - the incoming HTTP request.
* @returns true for loopback, or a live paired-device cookie.
*/
function isGitAllowed(ctx, request) {
	if (isLoopbackRequest(request)) return true;
	const bag = ctx;
	const fromGet = typeof bag.get === "function" ? bag.get("remoteWebUiPairing", false) : void 0;
	return (isPairingAccess(fromGet) ? fromGet : bag.remoteWebUiPairing)?.isPairedDevice(request) === true;
}
function isPairingAccess(value) {
	return value !== void 0 && value !== null && typeof value.isPairedDevice === "function";
}
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
//#region src/host/routes.ts
const OK = (value) => ({
	ok: true,
	value
});
const FAIL = (error) => ({
	ok: false,
	error
});
/** Git operation error for structurally invalid requests (never a workspace fault). */
const BAD_REQUEST = {
	code: "internal",
	message: "malformed request"
};
/**
* Poll interval for external git-state changes while subscribers are
* connected. Kept deliberately long (30s): each tick spawns several git
* processes per subscriber, and on Windows a cold git.exe costs ~0.7s per
* spawn — a short interval turns the poll itself into a self-exciting
* storm. Window focus and the client's own refresh calls cover the
* interactive freshness path.
*/
const POLL_INTERVAL_MS = 3e4;
/** SSE keep-alive comment interval (proxies drop idle connections). */
const HEARTBEAT_INTERVAL_MS = 15e3;
/**
* Route-layer deadline for one git status request. On expiry the controller
* aborts the read path so the subprocess can terminate; the JSON handler keeps
* the stable envelope and the SSE poll loop can clear its overlap guard.
*/
const STATUS_TIMEOUT_MS = 15e3;
const STATUS_TIMEOUT_MESSAGE = "git status timed out";
/**
* PollGuard lifetime bound. The SSE loop must live exactly as long as the
* subscriber set (start on first join, stop on empty), so there is no natural
* server-side expiry: the deadline is set to a sentinel that never fires and
* the loop is terminated by {@link PollGuard.stop} when the last subscriber
* closes. The per-subscriber 15s {@link STATUS_TIMEOUT_MS} deadline is a run
* bound, unrelated to this loop-lifetime value.
*/
const POLL_LIFETIME_MS = Number.MAX_SAFE_INTEGER;
/** Git operation error for a structurally invalid service view (never a workspace fault). */
const MALFORMED_VIEW = {
	code: "internal",
	message: "malformed git response"
};
/** Extract the required string field from a JSON object payload. */
function pathOf(payload) {
	if (typeof payload !== "object" || payload === null) return null;
	const path = payload.path;
	return typeof path === "string" && path !== "" ? path : null;
}
/**
* Send a service view under the ok envelope, rejecting structurally invalid
* values (a malformed RepoStatus / BranchesView / GraphView would otherwise
* leak to the browser as a typed-but-wrong payload).
* @param res - the server response.
* @param value - the view the service produced.
* @param guard - the runtime narrowing for the view.
*/
function okView(res, value, guard) {
	if (value !== null && !guard(value)) {
		writeJson(res, 200, FAIL(MALFORMED_VIEW));
		return;
	}
	writeJson(res, 200, OK(value));
}
/**
* Register the /git routes (prefix for the JSON operations, exact for the
* SSE stream — longest-prefix-wins keeps them disjoint).
* @param ctx - context carrying the webServer service.
* @param service - the workspace-gated git service.
* @returns the route disposers.
*/
function registerGitRoutes(ctx, service) {
	const subscribers = /* @__PURE__ */ new Set();
	let guard;
	let heartbeatTimer;
	const removeSubscriber = (subscriber) => {
		subscriber.statusAbort?.abort(/* @__PURE__ */ new Error("git status subscriber closed"));
		subscriber.statusAbort = void 0;
		subscribers.delete(subscriber);
		if (subscribers.size === 0) {
			guard?.stop();
			guard = void 0;
			if (heartbeatTimer !== void 0) clearInterval(heartbeatTimer);
			heartbeatTimer = void 0;
		}
	};
	const push = (subscriber, payload) => {
		subscriber.res.write(`event: change\ndata: ${JSON.stringify(payload)}\n\n`);
	};
	const statusWithDeadline = async (path, controller = new AbortController()) => {
		let timeout;
		const deadline = new Promise((_, reject) => {
			timeout = setTimeout(() => {
				const error = /* @__PURE__ */ new Error(STATUS_TIMEOUT_MESSAGE);
				controller.abort(error);
				reject(error);
			}, STATUS_TIMEOUT_MS);
		});
		try {
			return await Promise.race([service.status(path, controller.signal), deadline]);
		} finally {
			if (timeout !== void 0) clearTimeout(timeout);
		}
	};
	const runPoll = async () => {
		await Promise.all([...subscribers].map(async (subscriber) => {
			const controller = new AbortController();
			subscriber.statusAbort = controller;
			try {
				const status = await statusWithDeadline(subscriber.path, controller);
				const key = status === null ? "no-repo" : `${status.root}|${status.branch}|${status.head}`;
				if (key === subscriber.last) return;
				subscriber.last = key;
				push(subscriber, {
					path: subscriber.path,
					status
				});
			} catch (error) {
				if (subscribers.has(subscriber)) ctx.logger.warn(`dsh-git-graph: status poll failed for ${subscriber.path}: ${String(error)}`);
			} finally {
				if (subscriber.statusAbort === controller) subscriber.statusAbort = void 0;
			}
		}));
	};
	const handler = async (req, res) => {
		if (!isGitAllowed(ctx, req)) {
			writeJson(res, 403, { error: "forbidden: loopback-only" });
			return;
		}
		if (req.method !== "POST") {
			res.writeHead(405);
			res.end();
			return;
		}
		if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
			res.writeHead(415);
			res.end();
			return;
		}
		const pathname = new URL(req.url ?? "/", "http://x").pathname;
		const payload = await readJsonBody(req, { maxBytes: 1024 * 1024 });
		const path = pathOf(payload);
		if (path === null) {
			writeJson(res, 200, FAIL(BAD_REQUEST));
			return;
		}
		switch (pathname) {
			case "/git/status":
				try {
					okView(res, await statusWithDeadline(path), isRepoStatus);
				} catch (error) {
					ctx.logger.warn(`dsh-git-graph: status request failed for ${path}: ${String(error)}`);
					writeJson(res, 200, FAIL({
						code: "internal",
						message: STATUS_TIMEOUT_MESSAGE
					}));
				}
				return;
			case "/git/branches":
				okView(res, await service.branches(path), isBranchesView);
				return;
			case "/git/graph": {
				const rawLimit = typeof payload === "object" && payload !== null ? payload.limit : void 0;
				const limit = typeof rawLimit === "number" && rawLimit > 0 ? Math.min(rawLimit, 1e3) : void 0;
				okView(res, await service.graph(path, limit), isGraphView);
				return;
			}
			case "/git/switch": {
				const branch = typeof payload === "object" && payload !== null ? payload.branch : void 0;
				if (typeof branch !== "string" || branch === "") {
					writeJson(res, 200, FAIL(BAD_REQUEST));
					return;
				}
				const result = await service.switchBranch(path, branch);
				writeJson(res, 200, result.ok ? OK({ branch: result.branch }) : FAIL(isGitError(result.error) ? result.error : MALFORMED_VIEW));
				return;
			}
			case "/git/create-branch": {
				const name = typeof payload === "object" && payload !== null ? payload.name : void 0;
				if (typeof name !== "string" || name === "") {
					writeJson(res, 200, FAIL(BAD_REQUEST));
					return;
				}
				const result = await service.createBranch(path, name);
				writeJson(res, 200, result.ok ? OK({ branch: result.branch }) : FAIL(isGitError(result.error) ? result.error : MALFORMED_VIEW));
				return;
			}
			default:
				res.writeHead(404);
				res.end();
		}
	};
	const sse = (req, res) => {
		if (!isGitAllowed(ctx, req)) {
			writeJson(res, 403, { error: "forbidden: loopback-only" });
			return;
		}
		const path = new URL(req.url ?? "/", "http://x").searchParams.get("path");
		if (path === null || path === "") {
			res.writeHead(400);
			res.end();
			return;
		}
		res.writeHead(200, {
			"content-type": "text/event-stream; charset=utf-8",
			"cache-control": "no-cache",
			connection: "keep-alive"
		});
		res.write("retry: 2000\n\n");
		const subscriber = {
			path,
			last: "",
			res
		};
		subscribers.add(subscriber);
		res.on("error", () => {
			removeSubscriber(subscriber);
		});
		if (guard === void 0) guard = new PollGuard({
			intervalMs: POLL_INTERVAL_MS,
			deadlineMs: POLL_LIFETIME_MS,
			maxBackoffMs: POLL_INTERVAL_MS,
			onRun: runPoll
		});
		guard.start();
		if (heartbeatTimer === void 0) heartbeatTimer = setInterval(() => {
			for (const current of subscribers) current.res.write(": ping\n\n");
		}, HEARTBEAT_INTERVAL_MS);
		req.on("close", () => {
			removeSubscriber(subscriber);
		});
	};
	const disposers = [ctx.webServer.register({
		kind: "prefix",
		path: "/git",
		handler
	}), ctx.webServer.register({
		kind: "exact",
		path: "/git/events",
		handler: sse
	})];
	return () => {
		for (const dispose of disposers) dispose();
		guard?.stop();
		if (heartbeatTimer !== void 0) clearInterval(heartbeatTimer);
		for (const subscriber of subscribers) {
			subscriber.statusAbort?.abort(/* @__PURE__ */ new Error("git status routes disposed"));
			subscriber.res.end();
		}
		subscribers.clear();
	};
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
* @linxin666/dsh-client-ui-git-graph — host half: the workspace-gated git
* service and its /git/* HTTP routes (JSON operations + SSE change stream)
* on the shared webserver. The browser half (exports "./client") is served
* by client-modules from the same package's dsh.client declaration.
*
* The host half owns no model-visible surface: git switch/create are UI-
* triggered host operations on the workspace disk tree, never tool calls.
* @module @linxin666/dsh-client-ui-git-graph
*/
/** Required services: the route registry, the managed subprocess seam, and the workspace registry. */
const inject = [
	"webServer",
	"subprocess",
	"workspaceRegistry"
];
/**
* The workspace-membership gate: canonicalize the requested path and require
* it to equal a registered workspace path. This is the security boundary of
* the /git routes — the browser may only run git on workspace roots, never
* arbitrary host directories.
*/
function createWorkspaceGate(ctx) {
	return async (path) => {
		let canonical;
		try {
			canonical = await realpath(path);
		} catch {
			return {
				ok: false,
				error: {
					code: "workspace-unknown",
					message: "path does not resolve on disk"
				}
			};
		}
		if (ctx.workspaceRegistry.list().some((workspace) => workspace.path === canonical)) return {
			ok: true,
			canonical
		};
		return {
			ok: false,
			error: {
				code: "workspace-unknown",
				message: "path is not a registered workspace"
			}
		};
	};
}
/**
* Mount the git service and its routes.
* @param ctx - context carrying webServer, subprocess, and workspaceRegistry.
*/
const apply = mountOnce("@linxin666/dsh-client-ui-git-graph", applyImpl);
function applyImpl(ctx) {
	const service = new GitService(subprocessRunner(ctx), createWorkspaceGate(ctx));
	ctx.effect(() => registerGitRoutes(ctx, service), "dsh-git-graph: /git routes");
}
//#endregion
export { apply, inject };
