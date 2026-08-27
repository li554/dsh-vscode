#!/usr/bin/env node
import { h as resolveDshHome, m as profileIdentity } from "./paths-CSTri9N_.mjs";
import { a as rollbackTransaction, c as readJson, i as repairProfile, l as writeJsonAtomic, n as discoverRollbackProfile, o as snapshotProfile, s as appendJsonLine, t as diagnoseAndPlan } from "./recover-ByeY8SNW.mjs";
import { chmod, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
const DEFAULT_DOCTOR_POLICY = {
	fullProtection: true,
	autoRepair: false
};
function isSupervisorRequest(value) {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value;
	return candidate.protocol === 1 && typeof candidate.type === "string";
}
//#endregion
//#region src/agent/ipc.ts
function createSupervisorToken() {
	return randomBytes(32).toString("hex");
}
function tokensEqual(actual, expected) {
	const a = Buffer.from(actual);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}
async function ensureToken(path) {
	try {
		return (await readFile(path, "utf8")).trim();
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		const token = createSupervisorToken();
		await mkdir(dirname(path), {
			recursive: true,
			mode: 448
		});
		await writeFile(path, token, {
			mode: 384,
			flag: "wx"
		});
		await chmod(path, 384).catch(() => {});
		return token;
	}
}
async function callSupervisor(endpoint, token, request, timeoutMs = 3e3) {
	const body = JSON.stringify({
		token,
		request
	});
	if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) return await (await fetch(endpoint, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body,
		signal: AbortSignal.timeout(timeoutMs)
	})).json();
	const { createConnection } = await import("node:net");
	return await new Promise((resolve, reject) => {
		const socket = createConnection(endpoint);
		let received = "";
		const timer = setTimeout(() => {
			socket.destroy(/* @__PURE__ */ new Error("doctor: supervisor timeout"));
		}, timeoutMs);
		socket.setEncoding("utf8");
		socket.on("connect", () => {
			socket.end(body + "\n");
		});
		socket.on("data", (chunk) => {
			received += chunk;
		});
		socket.on("end", () => {
			clearTimeout(timer);
			try {
				resolve(JSON.parse(received));
			} catch (error) {
				reject(error);
			}
		});
		socket.on("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
	});
}
//#endregion
//#region src/agent/launch.ts
/** Drop a leading program token (`dsh`, `dsh.cmd`, absolute executable path) so helpers work with or without it. */
function normalizeArgv(argv) {
	const first = argv[0];
	if (first !== void 0 && /^dsh(\.(cmd|exe|ps1|sh))?$/.test(first)) return argv.slice(1);
	if (first !== void 0 && first.includes("/") && first.includes("dsh")) return argv.slice(1);
	return argv;
}
function parseProfile(argv) {
	const args = normalizeArgv(argv);
	const index = args.indexOf("--profile");
	if (index >= 0) return args[index + 1];
	return args[0] === "web" ? "web" : void 0;
}
function classifyInvocation(argv) {
	const args = normalizeArgv(argv);
	if (args.includes("--version") || args.includes("-V") || args.includes("--help") || args.includes("-h")) return "utility";
	if (args[0] === "plugin") return "plugin";
	if (args.includes("--dump-config") || args.includes("--dump-default-config")) return "dump";
	return "profile";
}
function findRealDsh(env = process.env, self = process.argv[1]) {
	const explicit = env.DSH_DOCTOR_REAL_DSH?.trim();
	if (explicit) return realpathSync(explicit);
	const selfDir = self ? dirname(resolve(self)) : "";
	for (const directory of (env.PATH ?? "").split(delimiter)) {
		if (!directory || resolve(directory) === selfDir) continue;
		const candidate = resolve(directory, process.platform === "win32" ? "dsh.cmd" : "dsh");
		try {
			return realpathSync(candidate);
		} catch {}
	}
	throw new Error("doctor: cannot locate the real dsh executable; set DSH_DOCTOR_REAL_DSH");
}
async function managedLaunch(options) {
	const env = options.env ?? process.env;
	const realDsh = options.realDsh ?? findRealDsh(env);
	const kind = classifyInvocation(options.argv);
	const profileName = parseProfile(options.argv);
	const identity = profileName === void 0 ? void 0 : profileIdentity(resolveDshHome(env), profileName, realDsh);
	const runId = randomUUID();
	const child = spawn(realDsh, options.argv, {
		stdio: [
			"inherit",
			"inherit",
			"pipe"
		],
		env: {
			...env,
			DSH_DOCTOR_ENDPOINT: options.endpoint,
			DSH_DOCTOR_TOKEN: options.token,
			DSH_DOCTOR_RUN_ID: runId,
			...identity ? { DSH_DOCTOR_PROFILE_ID: identity.id } : {}
		}
	});
	let tail = "";
	child.stderr?.on("data", (chunk) => {
		process.stderr.write(chunk);
		tail = (tail + chunk.toString("utf8")).slice(-32e3);
	});
	if (kind === "profile" && identity) {
		const request = {
			protocol: 1,
			type: "launcher-start",
			profile: identity,
			runId,
			pid: child.pid ?? -1,
			argv: [...options.argv],
			at: (options.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))()
		};
		await callSupervisor(options.endpoint, options.token, request).catch(() => void 0);
	}
	let interrupted = false;
	const forward = (signal) => {
		interrupted = true;
		child.kill(signal);
	};
	process.once("SIGINT", forward);
	process.once("SIGTERM", forward);
	const result = await new Promise((resolve) => child.once("close", (code, signal) => resolve({
		code,
		signal
	})));
	process.removeListener("SIGINT", forward);
	process.removeListener("SIGTERM", forward);
	if (kind === "profile" && identity) await callSupervisor(options.endpoint, options.token, {
		protocol: 1,
		type: "launcher-exit",
		profileId: identity.id,
		runId,
		exitCode: result.code,
		signal: result.signal,
		intentional: interrupted,
		started: tail.includes("dsh web:"),
		at: (options.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))(),
		stderrTail: tail
	}).catch(() => void 0);
	if (result.signal === "SIGINT") return 130;
	if (result.signal === "SIGTERM") return 143;
	return result.code ?? 1;
}
//#endregion
//#region src/agent/paths.ts
function doctorPaths(env = process.env, home = homedir()) {
	const raw = env.DSH_DOCTOR_HOME?.trim();
	const root = resolve(raw && raw !== "" ? raw : join(home, ".dsh-doctor"));
	return {
		root,
		state: join(root, "state"),
		registry: join(root, "registry"),
		incidents: join(root, "incidents"),
		snapshots: join(root, "snapshots"),
		candidates: join(root, "candidates"),
		quarantine: join(root, "quarantine"),
		capsule: join(root, "capsule"),
		logs: join(root, "logs"),
		socket: process.platform === "win32" ? "\\.pipedsh-doctor" : join(root, "state", "supervisor.sock"),
		token: join(root, "state", "supervisor.token")
	};
}
//#endregion
//#region src/agent/capsule.ts
/**
* Known credential-bearing file names mirrored into the rescue profile so the
* isolated environment can actually run providers after a crash. Only the
* canonical names are mirrored; backup variants (name.bak-*) are never copied.
*/
const CREDENTIAL_BASENAMES = [
	"settings.yaml",
	".credentials.yaml",
	"credentials.yaml",
	"credentials.yml",
	".env"
];
/** Candidate mirror paths relative to the DSH home. */
function credentialRelPaths(sourceProfile) {
	const profileLevel = CREDENTIAL_BASENAMES.map((name) => join("profiles", sourceProfile, name));
	return [...CREDENTIAL_BASENAMES, ...profileLevel];
}
async function exists(path) {
	try {
		await readFile(path);
		return true;
	} catch {
		return false;
	}
}
/** Copy every existing credential-bearing file into the rescue home (0600). */
async function mirrorCredentialFiles(options) {
	const mirrored = [];
	for (const rel of credentialRelPaths(options.sourceProfile)) {
		const from = join(options.sourceHome, rel);
		if (!await exists(from)) continue;
		const to = join(options.targetHome, rel);
		await mkdir(resolve(to, ".."), {
			recursive: true,
			mode: 448
		});
		await cp(from, to);
		await chmod(to, 384);
		mirrored.push(rel);
	}
	return mirrored;
}
/** Sha256 fingerprint of the credential-bearing source files (sorted by path). */
async function credentialsFingerprint(sourceHome, sourceProfile) {
	const hash = createHash("sha256");
	for (const rel of credentialRelPaths(sourceProfile)) try {
		hash.update(rel);
		hash.update(Buffer.from([0]));
		hash.update(await readFile(join(sourceHome, rel)));
	} catch {}
	return hash.digest("hex");
}
/** Remove the mirrored credential files recorded in the capsule manifest (best effort). */
async function removeCapsuleCredentialFiles(paths) {
	let manifest;
	try {
		manifest = JSON.parse(await readFile(join(paths.capsule, "current", "manifest.json"), "utf8"));
	} catch {
		return { removed: 0 };
	}
	const rescueHome = manifest.rescueHome;
	if (typeof rescueHome !== "string" || rescueHome === "") return { removed: 0 };
	let removed = 0;
	for (const rel of manifest.credentialsMirror ?? []) try {
		await rm(join(rescueHome, rel), { force: true });
		removed += 1;
	} catch {}
	return { removed };
}
async function run(command, args, env, timeoutMs = 6 * 6e4) {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, {
			env,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		let stdout = "", stderr = "";
		child.stdout.on("data", (b) => {
			stdout += b;
		});
		child.stderr.on("data", (b) => {
			stderr += b;
		});
		const timer = setTimeout(() => child.kill(), timeoutMs);
		child.once("error", reject);
		child.once("close", (code) => {
			clearTimeout(timer);
			resolvePromise({
				code: code ?? 1,
				stdout,
				stderr
			});
		});
	});
}
async function provisionCapsule(options) {
	const current = join(options.paths.capsule, "current");
	const staging = join(options.paths.capsule, "staging-" + process.pid + "-" + Date.now());
	const previous = join(options.paths.capsule, "previous");
	await rm(staging, {
		recursive: true,
		force: true
	});
	await mkdir(staging, {
		recursive: true,
		mode: 448
	});
	const rescueHome = join(staging, "rescue-home");
	const env = {
		...process.env,
		DSH_HOME: rescueHome,
		DSH_TELEMETRY_DISABLED: "1"
	};
	const executor = options.run ?? run;
	const version = await executor(options.dshExecutable, ["--version"], env);
	if (version.code !== 0) throw new Error("doctor: cannot probe dsh: " + version.stderr);
	const doctorSpec = options.doctorPackageDir ? "link:" + resolve(options.doctorPackageDir) : options.doctorSpec;
	const install = await executor(options.dshExecutable, [
		"plugin",
		"--profile",
		"web",
		"add",
		doctorSpec
	], env);
	if (install.code !== 0) throw new Error("doctor: rescue Doctor install failed: " + install.stderr);
	const dump = await executor(options.dshExecutable, [
		"--profile",
		"web",
		"--dump-config"
	], env);
	if (dump.code !== 0 || !dump.stdout.includes("doctor")) throw new Error("doctor: rescue profile verification failed: " + dump.stderr);
	let credentialsMirror;
	let fingerprint;
	if (options.mirrorCredentials !== false && options.sourceHome !== void 0 && options.sourceHome !== "") {
		credentialsMirror = await mirrorCredentialFiles({
			sourceHome: options.sourceHome,
			sourceProfile: options.sourceProfile ?? "web",
			targetHome: rescueHome
		});
		if (credentialsMirror.length > 0) fingerprint = await credentialsFingerprint(options.sourceHome, options.sourceProfile ?? "web");
	}
	const now = (options.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))();
	const manifest = {
		schemaVersion: 1,
		createdAt: now,
		dshExecutable: resolve(options.dshExecutable),
		dshVersion: version.stdout.trim(),
		doctorPackage: doctorSpec,
		...options.doctorVersion !== void 0 ? { doctorVersion: options.doctorVersion } : {},
		...credentialsMirror !== void 0 && credentialsMirror.length > 0 ? {
			credentialsMirror,
			credentialsFingerprint: fingerprint,
			credentialsAt: now
		} : {},
		rescueHome,
		status: "verified"
	};
	await writeFile(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 384 });
	await rm(previous, {
		recursive: true,
		force: true
	});
	try {
		await cp(current, previous, { recursive: true });
	} catch {}
	await rm(current, {
		recursive: true,
		force: true
	});
	await cp(staging, current, { recursive: true });
	await rm(staging, {
		recursive: true,
		force: true
	});
	manifest.rescueHome = join(current, "rescue-home");
	await writeFile(join(current, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 384 });
	return manifest;
}
//#endregion
//#region src/agent/version.ts
/**
* Package version identity for the machine-side halves.
*
* The version always comes from the package.json next to the compiled module
* (one level above lib/ for built bundles and src/ for repo runs), so a
* published bump is picked up without touching hardcoded literals. The
* Supervisor reports this version and the CLI pins the rescue-capsule install
* spec to it; the Web console compares it with the host half's own version to
* detect a stale Supervisor after an update.
* @module @linxin666/dsh-doctor/agent
*/
/** Read the version of the package owning a module file. */
function packageVersionAt(moduleFilePath) {
	try {
		const raw = JSON.parse(readFileSync(join(dirname(moduleFilePath), "..", "package.json"), "utf8"));
		if (typeof raw.version === "string" && raw.version !== "") return raw.version;
	} catch {}
	return "0.0.0";
}
/** Version of the package the current module belongs to (bundled-aware). */
function currentPackageVersion() {
	return packageVersionAt(fileURLToPath(import.meta.url));
}
//#endregion
//#region src/agent/state.ts
function emptyState() {
	return {
		phase: "disabled",
		profiles: {},
		incidents: {},
		recentFailures: {},
		paused: false,
		policy: { ...DEFAULT_DOCTOR_POLICY }
	};
}
function snapshotOf(state, version, now = (/* @__PURE__ */ new Date()).toISOString()) {
	return {
		protocol: 1,
		phase: state.phase,
		version,
		capsuleVersion: state.capsuleVersion,
		degradedReason: state.degradedReason,
		policy: { ...state.policy ?? DEFAULT_DOCTOR_POLICY },
		profiles: Object.values(state.profiles),
		incidents: Object.values(state.incidents).sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
		updatedAt: now
	};
}
function upsertProfile(state, identity) {
	const current = state.profiles[identity.id] ?? {
		identity,
		phase: "idle",
		restartCount: 0,
		managed: true
	};
	current.identity = identity;
	state.profiles[identity.id] = current;
	return current;
}
function openIncident(state, profileId, kind, summary, evidence, now) {
	const active = Object.values(state.incidents).find((item) => item.profileId === profileId && ![
		"recovered",
		"rolled-back",
		"unresolved"
	].includes(item.phase));
	if (active) {
		active.updatedAt = now;
		const merged = evidence.length > 0 ? evidence : [summary];
		active.evidence = [.../* @__PURE__ */ new Set([...active.evidence, ...merged])];
		return active;
	}
	const incident = {
		id: randomUUID(),
		profileId,
		kind,
		phase: "opened",
		openedAt: now,
		updatedAt: now,
		summary,
		evidence: evidence.length > 0 ? evidence : [summary],
		repairable: true
	};
	state.incidents[incident.id] = incident;
	return incident;
}
function recordFailure(state, profileId, at, windowMs = 10 * 6e4) {
	const cutoff = Date.parse(at) - windowMs;
	const retained = (state.recentFailures[profileId] ?? []).filter((value) => Date.parse(value) >= cutoff);
	retained.push(at);
	state.recentFailures[profileId] = retained;
	return retained.length;
}
//#endregion
//#region src/agent/supervisor.ts
var DoctorSupervisor = class {
	paths;
	state = emptyState();
	token = "";
	server;
	sweep;
	version;
	now;
	heartbeatTimeoutMs;
	provisioner;
	provisioning = false;
	constructor(options = {}) {
		this.paths = options.paths ?? doctorPaths();
		this.version = options.version ?? currentPackageVersion();
		this.now = options.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
		this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 15e3;
		this.provisioner = options.provisioner;
	}
	async start() {
		await mkdir(this.paths.state, {
			recursive: true,
			mode: 448
		});
		this.token = await ensureToken(this.paths.token);
		this.state = await readJson(join(this.paths.state, "supervisor.json"), emptyState());
		this.state.policy = await readJson(join(this.paths.state, "policy.json"), this.state.policy ?? DEFAULT_DOCTOR_POLICY);
		this.state.phase = this.state.paused ? "disabled" : "armed";
		if (process.platform !== "win32") await rm(this.paths.socket, { force: true });
		this.server = createServer({ allowHalfOpen: true }, (socket) => {
			socket.setEncoding("utf8");
			let body = "";
			socket.on("data", (chunk) => {
				body += chunk;
				if (body.length > 256 * 1024) socket.destroy(/* @__PURE__ */ new Error("doctor: IPC body too large"));
			});
			const respond = (value) => {
				if (socket.destroyed || socket.writableEnded) return;
				socket.end(JSON.stringify(value));
			};
			socket.on("error", () => void 0);
			socket.on("end", () => {
				this.handleWire(body).then(respond, (error) => respond({
					ok: false,
					error: {
						code: "INTERNAL",
						message: String(error)
					}
				}));
			});
		});
		await new Promise((resolvePromise, reject) => {
			this.server.once("error", reject);
			this.server.listen(this.paths.socket, () => resolvePromise());
		});
		this.sweep = setInterval(() => {
			this.sweepHeartbeats();
		}, 5e3);
		this.sweep.unref?.();
		await this.persist();
	}
	async stop() {
		if (this.sweep) clearInterval(this.sweep);
		if (this.server) await new Promise((resolvePromise) => this.server.close(() => resolvePromise()));
		if (process.platform !== "win32") await rm(this.paths.socket, { force: true });
		await this.persist();
	}
	async handleWire(body) {
		let envelope;
		try {
			envelope = JSON.parse(body.trim());
		} catch {
			return {
				ok: false,
				error: {
					code: "INVALID_JSON",
					message: "Invalid request"
				}
			};
		}
		if (!tokensEqual(envelope.token ?? "", this.token)) return {
			ok: false,
			error: {
				code: "UNAUTHORIZED",
				message: "Invalid token"
			}
		};
		if (!isSupervisorRequest(envelope.request)) return {
			ok: false,
			error: {
				code: "INVALID_REQUEST",
				message: "Unsupported request"
			}
		};
		return this.handle(envelope.request);
	}
	async handle(request) {
		const at = this.now();
		if (request.type === "status") return {
			ok: true,
			snapshot: snapshotOf(this.state, this.version, at)
		};
		if (request.type === "policy") {
			this.state.policy = {
				fullProtection: request.policy.fullProtection,
				autoRepair: request.policy.autoRepair
			};
			for (const profile of Object.values(this.state.profiles)) profile.managed = request.policy.fullProtection;
		} else if (request.type === "launcher-start") {
			if (request.profile.role === "rescue") return {
				ok: true,
				snapshot: snapshotOf(this.state, this.version, at)
			};
			const profile = upsertProfile(this.state, request.profile);
			Object.assign(profile, {
				phase: "starting",
				pid: request.pid,
				runId: request.runId,
				command: request.argv,
				startedAt: request.at,
				managed: this.state.policy.fullProtection
			});
		} else if (request.type === "heartbeat") {
			const profile = this.state.profiles[request.profileId];
			if (profile) Object.assign(profile, {
				phase: request.phase === "ready" ? "healthy" : request.phase === "degraded" ? "degraded" : "starting",
				pid: request.pid,
				runId: request.runId,
				lastHealthyAt: request.at
			});
		} else if (request.type === "launcher-exit") {
			const profile = this.state.profiles[request.profileId];
			if (profile) {
				profile.pid = void 0;
				profile.phase = request.intentional || request.exitCode === 0 ? "exited" : "failed";
				if (this.state.policy.fullProtection && !this.state.paused && !request.intentional && request.exitCode !== 0) {
					const failures = recordFailure(this.state, request.profileId, request.at);
					profile.restartCount = failures;
					if (failures >= 2) profile.phase = "quarantined";
					openIncident(this.state, request.profileId, request.started ? "process-crash" : "boot-failure", request.started ? "DSH process crashed after startup" : "DSH profile failed during startup", [request.stderrTail ?? ""].filter(Boolean), request.at);
				}
			}
		} else if (request.type === "client-failure") {
			if (this.state.policy.fullProtection && !this.state.paused) openIncident(this.state, request.profileId, "client-failure", request.message, [request.stack ?? "", request.phase ?? ""].filter(Boolean), request.at);
		} else if (request.type === "action") {
			if (request.action === "pause") {
				this.state.paused = true;
				this.state.phase = "disabled";
			} else if (request.action === "resume") {
				this.state.paused = false;
				this.state.phase = "armed";
			} else if (request.action === "provision") await this.startProvision();
			else if (request.action === "uninstall") {
				this.state.phase = "uninstalling";
				this.state.degradedReason = void 0;
				await this.cleanupCapsuleCredentials();
			} else if (request.incidentId) {
				const incident = this.state.incidents[request.incidentId];
				if (incident) {
					incident.phase = request.action === "rollback" ? "rolled-back" : request.action === "confirm" || request.action === "repair" ? "repairing" : request.action === "diagnose" ? "diagnosing" : incident.phase;
					if (request.action === "diagnose" || request.action === "repair" || request.action === "confirm" || request.action === "rollback") await this.runRecovery(request.action, request.incidentId, at);
				}
			}
		}
		await appendJsonLine(join(this.paths.logs, "journal.jsonl"), {
			at,
			request: request.type
		});
		await this.persist();
		return {
			ok: true,
			snapshot: snapshotOf(this.state, this.version, at)
		};
	}
	/**
	* Run the deterministic recovery workflow for one incident; records the outcome on the incident.
	*/
	async runRecovery(action, incidentId, at) {
		const incident = this.state.incidents[incidentId];
		const profile = this.state.profiles[incident?.profileId ?? ""];
		if (incident === void 0 || profile === void 0) return;
		try {
			const request = {
				home: profile.identity.dshHome,
				profile: profile.identity.name,
				dshPath: profile.identity.dshExecutable
			};
			const { confirmRepair, diagnoseAndPlan, repairProfile, rollbackTransaction } = await import("./recover-ByeY8SNW.mjs").then((n) => n.r);
			let outcome;
			if (action === "diagnose") outcome = await diagnoseAndPlan(request);
			else if (action === "rollback") {
				const { readdir, readFile } = await import("node:fs/promises");
				const { doctorRoot } = await import("./paths-CSTri9N_.mjs").then((n) => n.i);
				const dir = doctorRoot(request.home) + "/transactions";
				let latest;
				try {
					latest = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort().reverse()[0];
				} catch {
					latest = void 0;
				}
				outcome = latest === void 0 ? void 0 : await rollbackTransaction(request, latest.slice(0, -5));
			} else {
				const running = profile.pid !== void 0 && profile.pid > 0;
				if (action === "confirm") outcome = incident.candidateId === void 0 ? void 0 : await confirmRepair({
					...request,
					allowLive: !running
				}, incident.candidateId);
				else outcome = await repairProfile({
					...request,
					allowLive: !running,
					autoPromote: this.state.policy.autoRepair
				});
			}
			if (outcome === void 0) return;
			incident.updatedAt = at;
			incident.evidence = [.../* @__PURE__ */ new Set([...incident.evidence, "recovery: " + outcome.phase + (outcome.message !== void 0 ? " - " + outcome.message : "")])];
			if (outcome.phase === "staged") {
				incident.phase = "awaiting-confirmation";
				if (outcome.txnId !== void 0) incident.candidateId = outcome.txnId;
			} else if (outcome.ok) incident.phase = action === "rollback" ? "rolled-back" : "recovered";
			else if (outcome.phase === "failed" || outcome.phase === "blocked" || outcome.phase === "aborted") incident.phase = "unresolved";
		} catch (error) {
			incident.updatedAt = at;
			incident.evidence = [...incident.evidence, "recovery error: " + (error instanceof Error ? error.message : String(error))];
		}
	}
	/**
	* Enter the provisioning phase and refresh the rescue capsule in the
	* background. The IPC response returns immediately with the provisioning
	* snapshot; the outcome (armed or degraded) is persisted when the capsule
	* run settles. Concurrent provision requests are coalesced.
	*/
	async startProvision() {
		if (this.provisioning) return;
		this.provisioning = true;
		this.state.phase = "provisioning";
		await this.persist();
		this.finishProvision(this.runCapsuleProvision());
	}
	async finishProvision(pending) {
		try {
			await pending;
			this.state.phase = this.state.paused ? "disabled" : "armed";
			this.state.degradedReason = void 0;
			this.state.capsuleVersion = this.version;
		} catch (error) {
			this.state.phase = "degraded";
			this.state.degradedReason = "capsule provision failed: " + (error instanceof Error ? error.message : String(error));
		} finally {
			this.provisioning = false;
			await this.persist();
		}
	}
	async runCapsuleProvision() {
		if (this.provisioner !== void 0) {
			await this.provisioner(this.paths);
			return;
		}
		const explicit = process.env.DSH_DOCTOR_REAL_DSH?.trim();
		const first = Object.values(this.state.profiles).find((profile) => profile.identity.role !== "rescue");
		const dshExecutable = explicit && explicit !== "" ? explicit : first?.identity.dshExecutable ?? this.locateDsh();
		const spec = process.env.DSH_DOCTOR_PACKAGE?.trim() || "@linxin666/dsh-doctor@" + this.version;
		const sourceHome = first?.identity.dshHome ?? resolveDshHome();
		const sourceProfile = first?.identity.name ?? "web";
		await provisionCapsule({
			paths: this.paths,
			dshExecutable,
			doctorSpec: spec,
			doctorPackageDir: process.env.DSH_DOCTOR_PACKAGE_DIR?.trim(),
			doctorVersion: this.version,
			sourceHome,
			sourceProfile,
			mirrorCredentials: process.env.DSH_DOCTOR_CREDENTIALS !== "off"
		});
	}
	async cleanupCapsuleCredentials() {
		try {
			await removeCapsuleCredentialFiles(this.paths);
		} catch {}
	}
	locateDsh() {
		try {
			return findRealDsh();
		} catch {
			return "dsh";
		}
	}
	persistQueue = Promise.resolve();
	/** Serialized persist: concurrent handle/sweep writes queue instead of racing on the temp file. */
	persist() {
		const write = () => writeJsonAtomic(join(this.paths.state, "supervisor.json"), this.state);
		this.persistQueue = this.persistQueue.catch(() => void 0).then(write);
		return this.persistQueue;
	}
	async sweepHeartbeats() {
		const at = this.now();
		const now = Date.parse(at);
		if (this.state.paused || !this.state.policy.fullProtection) return;
		for (const profile of Object.values(this.state.profiles)) if (profile.phase === "healthy" && profile.lastHealthyAt && now - Date.parse(profile.lastHealthyAt) > this.heartbeatTimeoutMs) {
			profile.phase = "suspected";
			openIncident(this.state, profile.identity.id, "heartbeat-timeout", "Doctor heartbeat timed out", ["last heartbeat: " + profile.lastHealthyAt], at);
		}
		await this.persist();
	}
};
async function runSupervisor() {
	const supervisor = new DoctorSupervisor();
	await supervisor.start();
	const stop = () => {
		supervisor.stop().finally(() => process.exit(0));
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
}
//#endregion
//#region src/agent/service.ts
const quoteXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const quoteExec = (value) => JSON.stringify(value);
function servicePlan(spec, env = process.env) {
	const executable = resolve(spec.executable);
	const home = env.HOME?.trim() || homedir();
	if (spec.platform === "darwin") {
		const path = join(home, "Library", "LaunchAgents", `${spec.label}.plist`);
		const args = [executable, ...spec.args].map((value) => `<string>${quoteXml(value)}</string>`).join("");
		const content = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${quoteXml(spec.label)}</string><key>ProgramArguments</key><array>${args}</array><key>EnvironmentVariables</key><dict><key>DSH_DOCTOR_HOME</key><string>${quoteXml(spec.doctorHome)}</string></dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ProcessType</key><string>Background</string></dict></plist>
`;
		const user = `gui/${process.getuid?.() ?? 0}`;
		return {
			files: [{
				path,
				content,
				mode: 384
			}],
			install: [
				"launchctl",
				"bootstrap",
				user,
				path
			],
			uninstall: [
				"launchctl",
				"bootout",
				user,
				path
			],
			restart: [
				"launchctl",
				"kickstart",
				"-k",
				`${user}/${spec.label}`
			]
		};
	}
	if (spec.platform === "linux") {
		const path = join(env.XDG_CONFIG_HOME?.trim() || join(home, ".config"), "systemd", "user", `${spec.label}.service`);
		const content = `[Unit]\nDescription=DSH Doctor Supervisor\nAfter=default.target\n\n[Service]\nType=simple\nExecStart=${[executable, ...spec.args].map(quoteExec).join(" ")}\nEnvironment=DSH_DOCTOR_HOME=${quoteExec(spec.doctorHome)}\nRestart=on-failure\nRestartSec=2\nNoNewPrivileges=true\nPrivateTmp=true\n\n[Install]\nWantedBy=default.target\n`;
		const unit = basename(path);
		return {
			files: [{
				path,
				content,
				mode: 384
			}],
			install: [
				"systemctl",
				"--user",
				"enable",
				"--now",
				unit
			],
			uninstall: [
				"systemctl",
				"--user",
				"disable",
				"--now",
				unit
			],
			restart: [
				"systemctl",
				"--user",
				"restart",
				unit
			]
		};
	}
	if (spec.platform === "win32") {
		const path = join(env.LOCALAPPDATA || join(home, "AppData", "Local"), "DSH Doctor", "supervisor.cmd");
		const content = `@echo off\r\nset "DSH_DOCTOR_HOME=${spec.doctorHome}"\r\n"${executable}" ${spec.args.map(quoteExec).join(" ")}\r\n`;
		const task = "DSH Doctor Supervisor";
		return {
			files: [{
				path,
				content,
				mode: 384
			}],
			install: [
				"schtasks",
				"/Create",
				"/F",
				"/SC",
				"ONLOGON",
				"/TN",
				task,
				"/TR",
				path
			],
			uninstall: [
				"schtasks",
				"/Delete",
				"/F",
				"/TN",
				task
			],
			restart: [
				"schtasks",
				"/Run",
				"/TN",
				task
			]
		};
	}
	throw new Error(`doctor: unsupported service platform ${spec.platform}`);
}
async function writeServiceFiles(plan) {
	for (const file of plan.files) {
		await mkdir(dirname(file.path), { recursive: true });
		await writeFile(file.path, file.content, { mode: file.mode ?? 384 });
	}
}
async function removeServiceFiles(plan) {
	for (const file of plan.files) await rm(file.path, { force: true });
}
/**
* Idempotent service redeploy: drop any previous registration (a first
* install fails harmlessly), write the definition, bootstrap it, then restart
* it so the running process picks up the current package code.
*/
async function ensureServiceInstalled(plan, run = runCommand) {
	await run(plan.uninstall).catch(() => void 0);
	await writeServiceFiles(plan);
	await run(plan.install);
	await run(plan.restart).catch(() => void 0);
}
/** Unregister the service and remove its definition files (tolerates absence). */
async function removeService(plan, run = runCommand) {
	await run(plan.uninstall).catch(() => void 0);
	await removeServiceFiles(plan);
}
async function runCommand(command, timeoutMs = 3e4) {
	await new Promise((resolvePromise, reject) => {
		const child = spawn(command[0], command.slice(1), {
			stdio: "inherit",
			shell: process.platform === "win32"
		});
		const timer = setTimeout(() => child.kill(), timeoutMs);
		child.once("close", (code) => {
			clearTimeout(timer);
			code === 0 ? resolvePromise() : reject(/* @__PURE__ */ new Error(`doctor: command failed (${code ?? "signal"}): ${command.join(" ")}`));
		});
		child.once("error", reject);
	});
}
//#endregion
//#region src/cli.ts
async function main(argv = process.argv.slice(2)) {
	const paths = doctorPaths();
	const command = argv[0] ?? "help";
	if (command === "supervisor") {
		await runSupervisor();
		return 0;
	}
	if (command === "launch") {
		const token = (await readFile(paths.token, "utf8")).trim();
		return managedLaunch({
			argv: argv.slice(1),
			endpoint: paths.socket,
			token
		});
	}
	if (command === "status") {
		const token = (await readFile(paths.token, "utf8")).trim();
		console.log(JSON.stringify(await callSupervisor(paths.socket, token, {
			protocol: 1,
			type: "status"
		}), null, 2));
		return 0;
	}
	if (command === "provision") {
		const dsh = process.env.DSH_DOCTOR_REAL_DSH || "dsh";
		const version = currentPackageVersion();
		const profileName = argv[1] ?? "web";
		const mirrorCredentials = !argv.includes("--no-credentials") && process.env.DSH_DOCTOR_CREDENTIALS !== "off";
		const manifest = await provisionCapsule({
			paths,
			dshExecutable: dsh,
			doctorSpec: process.env.DSH_DOCTOR_PACKAGE || "@linxin666/dsh-doctor@" + version,
			doctorPackageDir: process.env.DSH_DOCTOR_PACKAGE_DIR,
			doctorVersion: version,
			sourceHome: resolveDshHome(),
			sourceProfile: profileName,
			mirrorCredentials
		});
		console.log(JSON.stringify(manifest, null, 2));
		return 0;
	}
	if (command === "diagnose" || command === "repair" || command === "snapshot" || command === "rollback") {
		const home = resolveDshHome();
		if (command === "rollback") {
			const txnId = argv[1];
			if (txnId === void 0) {
				console.error("usage: dsh-doctor rollback <txnId>");
				return 2;
			}
			let profile;
			try {
				profile = await discoverRollbackProfile(home, txnId);
			} catch (error) {
				console.log(JSON.stringify({
					ok: false,
					phase: "failed",
					diagnostics: [],
					actions: [],
					manualActions: [],
					txnId,
					message: error instanceof Error ? error.message : String(error)
				}, null, 2));
				return 2;
			}
			const outcome = await rollbackTransaction({
				home,
				profile
			}, txnId);
			console.log(JSON.stringify(outcome, null, 2));
			return outcome.ok ? 0 : 2;
		}
		const dshPath = process.env.DSH_DOCTOR_REAL_DSH || findRealDsh();
		const base = {
			home,
			profile: argv[1] ?? "web",
			dshPath,
			allowLive: command !== "repair" || argv.includes("--allow-live")
		};
		const outcome = command === "snapshot" ? await snapshotProfile(base) : command === "diagnose" ? await diagnoseAndPlan(base) : await repairProfile(base);
		console.log(JSON.stringify(outcome, null, 2));
		return outcome.ok ? 0 : 2;
	}
	if (command === "service-plan" || command === "service-install" || command === "service-uninstall") {
		const plan = servicePlan({
			platform: process.platform,
			label: "com.dsh.doctor",
			executable: process.execPath,
			args: [process.argv[1], "supervisor"],
			doctorHome: paths.root
		});
		if (command === "service-plan") console.log(JSON.stringify(plan, null, 2));
		else if (command === "service-install") await ensureServiceInstalled(plan);
		else await removeService(plan);
		return 0;
	}
	console.log("Usage: dsh-doctor <supervisor|launch|status|provision [profile] [--no-credentials]|diagnose|repair|snapshot|rollback|service-plan|service-install|service-uninstall> [args...]");
	return command === "help" || command === "--help" || command === "-h" ? 0 : 2;
}
if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) main().then((code) => {
	process.exitCode = code;
}, (error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
//#endregion
export { DoctorSupervisor, main };

//# sourceMappingURL=cli.mjs.map