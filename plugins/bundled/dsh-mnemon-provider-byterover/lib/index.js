import { t as descriptor } from "./descriptor-BCPFZAYz.js";
import { MEMORY_SPACE_PROVIDER_API_VERSION, NORMALIZED_RELEVANCE_SCORE, defineMemorySpaceProvider, defineMemorySpaceProviderDefinition, runProcess } from "dsh-mnemon-source-memory-spaces/provider-sdk";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { homedir } from "node:os";
//#region src/cli.ts
const INSTALL_GUIDANCE = "Install ByteRover with npm install -g byterover-cli or pnpm add -g byterover-cli. Ensure DSH can see PATH or PNPM_HOME, or set cliPath to its brv.cmd or executable.";
function isFile(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}
function globalBins(env) {
	const directory = (name) => {
		const value = Object.entries(env).find(([key]) => key.toUpperCase() === name)?.[1]?.trim().replace(/^"(.*)"$/, "$1");
		return value !== void 0 && isAbsolute(value) ? value : void 0;
	};
	const pnpm = directory("PNPM_HOME");
	const local = directory("LOCALAPPDATA") ?? join(homedir(), "AppData", "Local");
	const roaming = directory("APPDATA") ?? join(homedir(), "AppData", "Roaming");
	return [
		pnpm,
		pnpm === void 0 ? void 0 : join(pnpm, "bin"),
		directory("NVM_SYMLINK"),
		join(local, "pnpm"),
		join(local, "pnpm", "bin"),
		join(roaming, "npm")
	].filter((value) => value !== void 0);
}
/** npm/pnpm batch shims cannot run with shell:false; execute their verified JS entry. */
function resolveByteRoverInvocation(command, args, env, cwd = process.cwd()) {
	if (process.platform !== "win32") return {
		command,
		args: [...args],
		env
	};
	if (/^brv(?:\.cmd)?$/i.test(command)) {
		const path = Object.entries(env).find(([key]) => key.toUpperCase() === "PATH")?.[1] ?? "";
		let found;
		for (const directory of [...path.split(";"), ...globalBins(env)]) {
			if (directory === "") continue;
			const root = directory.replace(/^"(.*)"$/, "$1");
			for (const name of /\.cmd$/i.test(command) ? ["brv.cmd"] : ["brv.exe", "brv.cmd"]) {
				const candidate = resolve(cwd, root, name);
				if (isFile(candidate)) {
					found = candidate;
					break;
				}
			}
			if (found !== void 0) break;
		}
		if (found === void 0) throw new Error(`ByteRover brv was not found. ${INSTALL_GUIDANCE}`);
		command = found;
	}
	if (!/\.cmd$/i.test(command)) return {
		command,
		args: [...args],
		env
	};
	command = resolve(cwd, command);
	try {
		const shim = readFileSync(command, "utf8").replaceAll("\\", "/");
		const launchers = /* @__PURE__ */ new Set();
		for (const match of shim.matchAll(/"([^"\r\n]+)"/g)) {
			let target = match[1];
			if (!target.endsWith("/bin/run.js")) continue;
			if (/^%(?:dp0%|~dp0)\//i.test(target)) target = target.replace(/^%(?:dp0%|~dp0)\//i, "");
			else if (!isAbsolute(target)) continue;
			if (target.includes("%")) continue;
			const launcher = resolve(dirname(command), target);
			const pkg = JSON.parse(readFileSync(join(dirname(dirname(launcher)), "package.json"), "utf8"));
			const bin = pkg.bin?.brv;
			if (pkg.name === "byterover-cli" && typeof bin === "string" && bin.replace(/^\.\//, "") === "bin/run.js" && isFile(launcher)) launchers.add(realpathSync(launcher));
		}
		if (launchers.size === 1) {
			const inherited = Object.fromEntries(Object.entries(env).filter(([key]) => key.toUpperCase() !== "ELECTRON_RUN_AS_NODE"));
			return {
				command: process.execPath,
				args: [[...launchers][0], ...args],
				env: {
					...inherited,
					ELECTRON_RUN_AS_NODE: "1"
				}
			};
		}
	} catch {}
	throw new Error(`ByteRover cliPath is not a recognized npm/pnpm brv.cmd launcher. ${INSTALL_GUIDANCE}`);
}
//#endregion
//#region src/driver.ts
var ByteRoverProvider = class {
	memorySpaces;
	id = "byterover";
	scoreSemantics = NORMALIZED_RELEVANCE_SCORE;
	process;
	queryTimeoutMs;
	curateTimeoutMs;
	statusCache = /* @__PURE__ */ new Map();
	statusInFlight = /* @__PURE__ */ new Map();
	constructor(memorySpaces, options = {}) {
		this.memorySpaces = memorySpaces;
		this.process = options.process ?? runProcess;
		this.queryTimeoutMs = options.queryTimeoutMs ?? 1e4;
		this.curateTimeoutMs = options.curateTimeoutMs ?? 12e4;
	}
	async discover(connection) {
		const configured = String(connection.defaultDirectory ?? "").trim();
		const existingDirectory = this.memorySpaces.list().find((body) => (body.provider.typeId ?? body.provider.id) === this.id)?.provider.settings.workingDirectory;
		const directory = configured === "" ? String(existingDirectory ?? "").trim() || join(this.memorySpaces.runner.effectiveDataDir(), "state", "byterover", "default") : isAbsolute(configured) ? configured : resolve(this.memorySpaces.runner.effectiveDataDir(), configured);
		return [{
			externalId: directory,
			name: basename(directory) || "ByteRover",
			description: `ByteRover knowledge directory at ${directory}`,
			connection: { workingDirectory: directory }
		}];
	}
	async status(body, signal) {
		if (signal !== void 0) return this.checkStatus(body, signal);
		const cached = this.statusCache.get(body.id);
		if (cached !== void 0 && Date.now() - cached.checkedAt < 6e4) return cached.value;
		const running = this.statusInFlight.get(body.id);
		if (running !== void 0) return running;
		const pending = this.checkStatus(body);
		this.statusInFlight.set(body.id, pending);
		try {
			const value = await pending;
			this.statusCache.set(body.id, {
				checkedAt: Date.now(),
				value
			});
			return value;
		} finally {
			if (this.statusInFlight.get(body.id) === pending) this.statusInFlight.delete(body.id);
		}
	}
	invalidateStatus(memoryBodyId) {
		if (memoryBodyId === void 0) this.statusCache.clear();
		else this.statusCache.delete(memoryBodyId);
	}
	async checkStatus(body, signal) {
		try {
			await this.run(body, ["status"], 15e3, signal);
			return { healthy: true };
		} catch (error) {
			return {
				healthy: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	async search(body, request, signal) {
		const output = await this.run(body, [
			"query",
			"--",
			request.query.slice(0, 5e3)
		], this.queryTimeoutMs, signal);
		if (output.length < 20) return {
			results: [],
			hint: "ByteRover found no relevant memories."
		};
		const content = output.length > 8e3 ? `${output.slice(0, 8e3)}\n\n[... truncated]` : output;
		return { results: [{
			id: `byterover:${createHash("sha256").update(content).digest("hex").slice(0, 24)}`,
			content,
			category: "context",
			source: "external",
			score: 1
		}] };
	}
	async graph(body) {
		this.connection(body);
		return {
			nodes: [],
			edges: [],
			generatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	}
	async list(body, request, signal) {
		if (request.query === void 0 || request.query.trim() === "") {
			this.connection(body);
			return [];
		}
		return (await this.search(body, {
			query: request.query,
			...request.limit === void 0 ? {} : { limit: request.limit }
		}, signal)).results;
	}
	async remember(body, request, signal) {
		await this.run(body, [
			"curate",
			"--",
			request.content
		], this.curateTimeoutMs, signal);
		return {
			action: "stored",
			provider: this.id,
			summary: "ByteRover curated the memory into its knowledge tree."
		};
	}
	connection(body) {
		if ((body.provider.typeId ?? body.provider.id) !== this.id) throw new Error(`ByteRover cannot serve provider ${body.provider.id}`);
		return this.memorySpaces.providerConnection(body.id, body.provider.id);
	}
	async run(body, args, timeoutMs, signal) {
		const connection = this.connection(body);
		const command = String(connection.cliPath ?? "brv");
		const configuredDirectory = String(connection.workingDirectory ?? connection.defaultDirectory ?? "").trim();
		const defaultDirectory = join(this.memorySpaces.runner.effectiveDataDir(), "state", "byterover", "default");
		const cwd = configuredDirectory === "" ? defaultDirectory : isAbsolute(configuredDirectory) ? configuredDirectory : resolve(this.memorySpaces.runner.effectiveDataDir(), configuredDirectory);
		mkdirSync(cwd, {
			recursive: true,
			mode: 448
		});
		const apiKey = String(connection.apiKey ?? "").trim();
		const invocation = resolveByteRoverInvocation(command, args, {
			...process.env,
			...apiKey === "" ? {} : { BRV_API_KEY: apiKey }
		}, cwd);
		const result = await this.process(invocation.command, invocation.args, {
			timeoutMs,
			maxOutputBytes: 262144,
			...signal === void 0 ? {} : { signal },
			cwd,
			label: "ByteRover",
			env: invocation.env
		});
		const stdout = result.stdout.trim();
		const stderr = result.stderr.trim();
		if (result.exitCode !== 0) throw new Error(stderr || stdout || `ByteRover exited with code ${String(result.exitCode)}`);
		return stdout;
	}
};
//#endregion
//#region src/index.ts
const definition = defineMemorySpaceProviderDefinition({
	manifest: {
		apiVersion: MEMORY_SPACE_PROVIDER_API_VERSION,
		kind: "provider",
		typeId: descriptor.id,
		packageName: "dsh-mnemon-provider-byterover",
		version: "0.5.7",
		label: descriptor.label,
		icon: descriptor.icon,
		summary: descriptor.summary,
		...descriptor.summaryI18nKey === void 0 ? {} : { summaryI18nKey: descriptor.summaryI18nKey },
		origin: descriptor.origin,
		locality: descriptor.kind,
		workspaceBinding: descriptor.workspaceBinding,
		capabilities: descriptor.capabilities,
		fields: descriptor.fields,
		secrets: descriptor.fields.filter((field) => field.input === "secret").map((field) => field.key),
		scoreSemantics: "normalized-relevance"
	},
	create: (context) => new ByteRoverProvider(context.memorySpaces ?? context.memoryBodies, { queryTimeoutMs: context.config.timeoutMs })
});
var src_default = defineMemorySpaceProvider({
	id: descriptor.id,
	apply(ctx, host) {
		host.install(ctx, definition);
	}
});
//#endregion
export { ByteRoverProvider, src_default as default, definition, descriptor };
