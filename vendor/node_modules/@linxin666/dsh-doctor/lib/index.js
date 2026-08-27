import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "schemastery";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
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
//#region src/host/profile.ts
function currentProfile(argv = process.argv, env = process.env) {
	const flag = argv.indexOf("--profile");
	const name = flag >= 0 && argv[flag + 1] ? argv[flag + 1] : argv.includes("web") ? "web" : env.DSH_PROFILE?.trim() || "web";
	const dshHome = resolveDshHome(env);
	const dshExecutable = env.DSH_DOCTOR_REAL_DSH?.trim() || process.argv[1] || "dsh";
	return {
		name,
		id: profileIdentity(dshHome, name, dshExecutable).id,
		dshHome,
		dshExecutable
	};
}
//#endregion
//#region src/core/protocol.ts
const DEFAULT_DOCTOR_POLICY = {
	fullProtection: true,
	autoRepair: false
};
//#endregion
//#region src/agent/ipc.ts
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
//#region src/host/client.ts
var SupervisorClient = class {
	paths;
	endpoint;
	explicitToken;
	constructor(paths, endpoint = process.env.DSH_DOCTOR_ENDPOINT || paths.socket, explicitToken = process.env.DSH_DOCTOR_TOKEN) {
		this.paths = paths;
		this.endpoint = endpoint;
		this.explicitToken = explicitToken;
	}
	async token() {
		return this.explicitToken || (await readFile(this.paths.token, "utf8")).trim();
	}
	async call(request) {
		return callSupervisor(this.endpoint, await this.token(), request);
	}
	async status() {
		return this.call({
			protocol: 1,
			type: "status"
		});
	}
};
//#endregion
//#region src/host/heartbeat.ts
function startHeartbeat(options) {
	const send = () => {
		options.client.call({
			protocol: 1,
			type: "heartbeat",
			profileId: options.profileId,
			runId: options.runId,
			pid: options.pid ?? process.pid,
			phase: options.phase?.() ?? "ready",
			at: (/* @__PURE__ */ new Date()).toISOString(),
			webUrl: options.webUrl?.()
		}).catch(() => void 0);
	};
	send();
	const timer = setInterval(send, options.intervalMs ?? 5e3);
	timer.unref?.();
	return () => clearInterval(timer);
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
function makeDoctorRoutes(client, profileId, options) {
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
			writeJson(res, 500, {
				ok: false,
				error: {
					code: "DOCTOR_ROUTE_FAILED",
					message: error instanceof Error ? error.message : String(error)
				}
			}, { "cache-control": "no-store" });
		}
	};
	return [
		{
			kind: "exact",
			path: "/api/doctor/status",
			handler: guard(async (_req, res) => {
				try {
					writeJson(res, 200, {
						...await client.status(),
						hostVersion: options.hostVersion
					}, { "cache-control": "no-store" });
				} catch (error) {
					writeJson(res, 503, {
						ok: false,
						error: {
							code: (options.provisioned === void 0 ? true : await options.provisioned().catch(() => false)) ? "SUPERVISOR_DOWN" : "SUPERVISOR_UNPROVISIONED",
							message: error instanceof Error ? error.message : String(error)
						}
					}, { "cache-control": "no-store" });
				}
			})
		},
		{
			kind: "exact",
			path: "/api/doctor/action",
			handler: guard(async (req, res) => {
				const value = await readJsonBody(req, {
					maxBytes: 64 * 1024,
					objectOnly: true
				}) ?? {};
				const allowed = [
					"provision",
					"exercise",
					"diagnose",
					"repair",
					"confirm",
					"rollback",
					"pause",
					"resume",
					"uninstall"
				];
				const action = value.action;
				if (typeof action !== "string" || !allowed.includes(action)) {
					writeJson(res, 400, {
						ok: false,
						error: {
							code: "INVALID_ACTION",
							message: "Unsupported action"
						}
					}, { "cache-control": "no-store" });
					return;
				}
				if (action === "provision" || action === "uninstall") {
					const report = action === "provision" ? await options.lifecycle.ensure() : await options.lifecycle.uninstall();
					if (!report.ok) {
						writeJson(res, 500, {
							ok: false,
							error: {
								code: report.code,
								message: report.message
							}
						}, { "cache-control": "no-store" });
						return;
					}
					let snapshot;
					try {
						snapshot = (await client.status()).snapshot;
					} catch {}
					writeJson(res, 200, {
						ok: true,
						snapshot,
						hostVersion: options.hostVersion
					}, { "cache-control": "no-store" });
					return;
				}
				const request = {
					protocol: 1,
					type: "action",
					action,
					profileId: typeof value.profileId === "string" ? value.profileId : profileId,
					incidentId: typeof value.incidentId === "string" ? value.incidentId : void 0
				};
				writeJson(res, 200, {
					...await client.call(request),
					hostVersion: options.hostVersion
				}, { "cache-control": "no-store" });
			})
		},
		{
			kind: "exact",
			path: "/api/doctor/client-failure",
			handler: guard(async (req, res) => {
				const value = await readJsonBody(req, {
					maxBytes: 64 * 1024,
					objectOnly: true
				}) ?? {};
				if (typeof value.message !== "string" || value.message.trim() === "") {
					writeJson(res, 400, {
						ok: false,
						error: {
							code: "INVALID_FAILURE",
							message: "message is required"
						}
					}, { "cache-control": "no-store" });
					return;
				}
				writeJson(res, 200, await client.call({
					protocol: 1,
					type: "client-failure",
					profileId,
					runId: typeof value.runId === "string" ? value.runId : process.env.DSH_DOCTOR_RUN_ID,
					at: (/* @__PURE__ */ new Date()).toISOString(),
					message: value.message.slice(0, 4096),
					stack: typeof value.stack === "string" ? value.stack.slice(0, 16384) : void 0,
					phase: typeof value.phase === "string" ? value.phase.slice(0, 128) : void 0
				}), { "cache-control": "no-store" });
			})
		}
	];
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
//#endregion
//#region src/host/ensure.ts
const DEPLOY_TIMEOUT_MS = 9e4;
const PROVISION_TIMEOUT_MS = 10 * 6e4;
/** Default spawn: buffer stdout/stderr, kill on timeout, never reject. */
function defaultSpawn(command, args, opts) {
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn(command, args, {
				env: opts.env ?? process.env,
				stdio: [
					"ignore",
					"pipe",
					"pipe"
				]
			});
		} catch (error) {
			resolve({
				code: -1,
				stdout: "",
				stderr: String(error)
			});
			return;
		}
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString("utf8");
		});
		const timer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs);
		child.once("error", (error) => {
			clearTimeout(timer);
			resolve({
				code: -1,
				stdout,
				stderr: String(error)
			});
		});
		child.once("close", (code) => {
			clearTimeout(timer);
			resolve({
				code: code ?? -1,
				stdout,
				stderr
			});
		});
	});
}
/** True when the supervisor state directory holds the IPC token. */
async function defaultProvisioned(paths) {
	try {
		await access(paths.token);
		return true;
	} catch {
		return false;
	}
}
/**
* True when the capsule is absent, pinned to another doctor version, or its
* mirrored credentials no longer match the current source files (the user
* changed providers or keys since the last provision).
*/
async function defaultCapsuleStale(paths, currentVersion, source) {
	try {
		const raw = await readFile(join(paths.capsule, "current", "manifest.json"), "utf8");
		const manifest = JSON.parse(raw);
		if (manifest.doctorVersion !== currentVersion) return true;
		if ((Array.isArray(manifest.credentialsMirror) ? manifest.credentialsMirror : []).length === 0) return false;
		if (source === void 0) return true;
		const current = await credentialsFingerprint(source.home, source.profile);
		return manifest.credentialsFingerprint !== current;
	} catch {
		return true;
	}
}
/** Run one lifecycle verb; concurrent calls of the same verb share the run. */
function createDoctorLifecycle(deps) {
	let ensuring;
	let uninstalling;
	return {
		ensure() {
			ensuring ??= ensureDoctor(deps).finally(() => {
				ensuring = void 0;
			});
			return ensuring;
		},
		uninstall() {
			uninstalling ??= uninstallDoctor(deps).finally(() => {
				uninstalling = void 0;
			});
			return uninstalling;
		}
	};
}
/** Redeploy the service, wait for the supervisor, then refresh a stale capsule. */
async function ensureDoctor(deps) {
	const steps = [];
	const spawnImpl = deps.spawn ?? defaultSpawn;
	const first = await spawnImpl(process.execPath, [deps.cliPath, "service-install"], { timeoutMs: DEPLOY_TIMEOUT_MS });
	if (first.code !== 0) return {
		ok: false,
		code: "SERVICE_INSTALL_FAILED",
		message: first.stderr.trim() || first.stdout.trim() || "service install exited " + String(first.code),
		steps
	};
	steps.push("service");
	const awaited = await waitForSupervisor(deps);
	if (!awaited.ok) return {
		ok: false,
		code: "SUPERVISOR_UNAVAILABLE",
		message: awaited.message ?? "supervisor did not answer",
		steps
	};
	if (await (deps.capsuleStale ?? defaultCapsuleStale.bind(void 0, deps.paths))(deps.version, deps.source)) {
		const second = await spawnImpl(process.execPath, [deps.cliPath, "provision"], { timeoutMs: PROVISION_TIMEOUT_MS });
		if (second.code !== 0) return {
			ok: false,
			code: "PROVISION_FAILED",
			message: second.stderr.trim() || second.stdout.trim() || "provision exited " + String(second.code),
			steps
		};
		steps.push("capsule");
		const refreshed = await waitForSupervisor(deps);
		if (!refreshed.ok) return {
			ok: false,
			code: "SUPERVISOR_UNAVAILABLE",
			message: refreshed.message ?? "supervisor did not answer after capsule refresh",
			steps
		};
	}
	return {
		ok: true,
		code: "OK",
		steps
	};
}
/** Mark the supervisor state, then remove the user-level service. */
async function uninstallDoctor(deps) {
	const steps = [];
	try {
		await deps.markUninstall?.();
	} catch {}
	const result = await (deps.spawn ?? defaultSpawn)(process.execPath, [deps.cliPath, "service-uninstall"], { timeoutMs: DEPLOY_TIMEOUT_MS });
	if (result.code !== 0) return {
		ok: false,
		code: "SERVICE_UNINSTALL_FAILED",
		message: result.stderr.trim() || result.stdout.trim() || "service uninstall exited " + String(result.code),
		steps
	};
	steps.push("service");
	if ((await removeCapsuleCredentialFiles(deps.paths).catch(() => ({ removed: 0 }))).removed > 0) steps.push("credentials");
	return {
		ok: true,
		code: "OK",
		steps
	};
}
/** Poll the supervisor until it answers or the attempts run out. */
async function waitForSupervisor(deps) {
	const attempts = deps.pollAttempts ?? 20;
	const delay = deps.pollDelayMs ?? 1e3;
	const provisioned = deps.provisioned ?? defaultProvisioned.bind(void 0, deps.paths);
	let last = "";
	for (let attempt = 0; attempt < attempts; attempt++) {
		try {
			const response = await deps.status();
			if (response.ok) return { ok: true };
			last = response.error?.message ?? "supervisor refused";
		} catch (error) {
			last = error instanceof Error ? error.message : String(error);
		}
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
	if (!await provisioned().catch(() => false)) return {
		ok: false,
		message: "supervisor is not provisioned"
	};
	return {
		ok: false,
		message: last || "supervisor did not answer"
	};
}
//#endregion
//#region src/core/store.ts
let atomicWriteSequence = 0;
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
//#endregion
//#region src/host/auto-ensure.ts
/** Reconcile one user-level Doctor deployment without blocking host startup. */
function createAutoEnsure(deps) {
	const markerPath = join(deps.stateDir, "deployed.json");
	const lockPath = join(deps.stateDir, "reconcile.lock");
	const now = deps.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
	let epoch = 0;
	let pending;
	let snapshot = { phase: "idle" };
	const readMarker = async () => {
		try {
			return JSON.parse(await readFile(markerPath, "utf8"));
		} catch {
			return;
		}
	};
	const writeMarker = async (value) => {
		await writeJsonAtomic(markerPath, value);
	};
	const desired = (marker) => marker === void 0 || marker.uninstalled !== true && (marker.ok !== true || marker.version !== deps.version || marker.cliPath !== deps.cliPath || marker.profileId !== deps.profileId);
	const record = async (report) => {
		const at = now();
		const error = report.ok ? void 0 : report.message ?? report.code;
		await writeMarker({
			version: deps.version,
			cliPath: deps.cliPath,
			profileId: deps.profileId,
			ok: report.ok,
			at,
			...error === void 0 ? {} : { error }
		});
		snapshot = report.ok ? {
			phase: "ready",
			lastAt: at
		} : {
			phase: "failed",
			lastAt: at,
			lastError: error
		};
	};
	const acquireLock = async () => {
		try {
			await mkdir(lockPath);
			await writeFile(join(lockPath, "owner.json"), JSON.stringify({
				pid: process.pid,
				at: now()
			}), { mode: 384 });
			return true;
		} catch {
			try {
				if (Date.now() - (await stat(lockPath)).mtimeMs <= 15 * 6e4) return false;
				await rm(lockPath, {
					recursive: true,
					force: true
				});
				await mkdir(lockPath);
				await writeFile(join(lockPath, "owner.json"), JSON.stringify({
					pid: process.pid,
					at: now()
				}), { mode: 384 });
				return true;
			} catch {
				return false;
			}
		}
	};
	const reconcile = async (force, runEpoch) => {
		if (!deps.enabled() || runEpoch !== epoch) {
			snapshot = {
				...snapshot,
				phase: "suppressed"
			};
			return;
		}
		snapshot = {
			phase: "checking",
			lastAt: now()
		};
		const marker = await readMarker();
		if (marker?.uninstalled === true && !force) {
			snapshot = {
				phase: "suppressed",
				lastAt: marker.at
			};
			return;
		}
		let needsEnsure = force || desired(marker);
		if (!needsEnsure) try {
			const response = await deps.status();
			needsEnsure = !response.ok || response.snapshot?.version !== deps.version || response.snapshot?.policy === void 0;
		} catch {
			needsEnsure = true;
		}
		if (!needsEnsure) {
			snapshot = {
				phase: "ready",
				lastAt: now()
			};
			return;
		}
		await mkdir(deps.stateDir, {
			recursive: true,
			mode: 448
		});
		if (!await acquireLock()) {
			snapshot = {
				phase: "checking",
				lastAt: now()
			};
			return;
		}
		try {
			if (!deps.enabled() || runEpoch !== epoch) {
				snapshot = {
					phase: "suppressed",
					lastAt: now()
				};
				return;
			}
			snapshot = {
				phase: "installing",
				lastAt: now()
			};
			const report = await deps.lifecycle.ensure();
			if (!deps.enabled() || runEpoch !== epoch) {
				snapshot = {
					phase: "suppressed",
					lastAt: now()
				};
				return;
			}
			await record(report);
		} finally {
			await rm(lockPath, {
				recursive: true,
				force: true
			});
		}
	};
	return {
		kick(force = false) {
			pending ??= reconcile(force, epoch).catch((error) => {
				snapshot = {
					phase: "failed",
					lastAt: now(),
					lastError: error instanceof Error ? error.message : String(error)
				};
			}).finally(() => {
				pending = void 0;
			});
			return pending;
		},
		suppress() {
			epoch += 1;
			snapshot = {
				...snapshot,
				phase: "suppressed",
				lastAt: now()
			};
		},
		async markUninstalled() {
			epoch += 1;
			const at = now();
			await writeMarker({
				version: deps.version,
				cliPath: deps.cliPath,
				profileId: deps.profileId,
				ok: false,
				at,
				uninstalled: true
			});
			snapshot = {
				phase: "suppressed",
				lastAt: at
			};
		},
		record,
		state() {
			return { ...snapshot };
		}
	};
}
function serializeDoctorLifecycle(lifecycle) {
	let tail = Promise.resolve();
	const run = (task) => {
		const current = tail.catch(() => void 0).then(task);
		tail = current;
		return current;
	};
	return {
		ensure: () => run(() => lifecycle.ensure()),
		uninstall: () => run(() => lifecycle.uninstall())
	};
}
function lifecycleWithUninstallMarker(lifecycle, marker) {
	return {
		async ensure() {
			const report = await lifecycle.ensure();
			await marker.record(report);
			return report;
		},
		async uninstall() {
			const report = await lifecycle.uninstall();
			if (report.ok) await marker.markUninstalled();
			return report;
		}
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
const name = "doctor";
const inject = ["webServer"];
const Config = z.object({
	enabled: z.boolean().default(true),
	fullProtection: z.boolean().default(true),
	autoRepair: z.boolean().default(false),
	heartbeatIntervalMs: z.number().min(1e3).default(5e3)
});
const DOCTOR_SETTINGS_NAMESPACE = settingsNamespace("doctor");
function effectiveConfig(config) {
	return {
		enabled: config?.enabled ?? true,
		fullProtection: config?.fullProtection ?? DEFAULT_DOCTOR_POLICY.fullProtection,
		autoRepair: config?.autoRepair ?? DEFAULT_DOCTOR_POLICY.autoRepair,
		heartbeatIntervalMs: config?.heartbeatIntervalMs ?? 5e3
	};
}
const apply = mountOnce("@linxin666/dsh-doctor", (ctx, config) => {
	let current = () => config ?? {};
	let disposeRuntime;
	let wasEnabled = false;
	const profile = currentProfile();
	const paths = doctorPaths();
	const client = new SupervisorClient(paths);
	const hostVersion = currentPackageVersion();
	const cliPath = fileURLToPath(new URL("./cli.mjs", import.meta.url));
	const baseLifecycle = serializeDoctorLifecycle(createDoctorLifecycle({
		paths,
		cliPath,
		version: hostVersion,
		status: () => client.status(),
		markUninstall: () => client.call({
			protocol: 1,
			type: "action",
			action: "uninstall",
			profileId: profile.id
		}),
		source: {
			home: profile.dshHome,
			profile: profile.name
		}
	}));
	let lifecycle = baseLifecycle;
	const autoEnsure = createAutoEnsure({
		stateDir: paths.state,
		version: hostVersion,
		cliPath,
		profileId: profile.id,
		lifecycle: baseLifecycle,
		status: () => client.status(),
		enabled: () => effectiveConfig(current()).enabled
	});
	lifecycle = lifecycleWithUninstallMarker(baseLifecycle, autoEnsure);
	const syncPolicy = async (policy) => {
		await writeJsonAtomic(join(paths.state, "policy.json"), policy);
		await client.call({
			protocol: 1,
			type: "policy",
			policy
		}).catch(() => void 0);
	};
	const sync = () => {
		disposeRuntime?.();
		disposeRuntime = void 0;
		const value = effectiveConfig(current());
		const policy = {
			fullProtection: value.fullProtection,
			autoRepair: value.autoRepair
		};
		syncPolicy(policy).catch((error) => console.warn("[dsh-doctor] policy sync failed:", error));
		if (!value.enabled) {
			autoEnsure.suppress();
			client.call({
				protocol: 1,
				type: "action",
				action: "pause",
				profileId: profile.id
			}).catch(() => void 0);
			wasEnabled = false;
			return;
		}
		const routeDisposers = makeDoctorRoutes(client, profile.id, {
			hostVersion,
			lifecycle,
			provisioned: () => defaultProvisioned(paths)
		}).map((route) => ctx.webServer.register(route));
		const disposeHeartbeat = value.fullProtection ? startHeartbeat({
			client,
			profileId: profile.id,
			runId: process.env.DSH_DOCTOR_RUN_ID || "unmanaged-" + process.pid,
			intervalMs: value.heartbeatIntervalMs,
			webUrl: () => `http://127.0.0.1:${ctx.webServer.port}`
		}) : () => void 0;
		disposeRuntime = () => {
			disposeHeartbeat();
			for (const dispose of routeDisposers) dispose();
		};
		if (!wasEnabled) client.call({
			protocol: 1,
			type: "action",
			action: "resume",
			profileId: profile.id
		}).catch(() => void 0);
		wasEnabled = true;
		autoEnsure.kick();
	};
	installSettingsSection(ctx, DOCTOR_SETTINGS_NAMESPACE, Config, config ?? {}, {
		setSource: (source) => {
			current = source;
			sync();
		},
		onChange: sync
	});
	ctx.effect(() => {
		sync();
		return () => {
			autoEnsure.suppress();
			disposeRuntime?.();
		};
	}, "doctor: runtime");
});
//#endregion
export { Config, DOCTOR_SETTINGS_NAMESPACE, apply, effectiveConfig, inject, name };
