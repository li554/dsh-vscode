import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
//#region src/providers/process.ts
var ProcessError = class extends Error {
	reason;
	constructor(message, reason) {
		super(message);
		this.reason = reason;
		this.name = "ProcessError";
	}
};
const DEFAULT_MAX_OUTPUT_BYTES = 2097152;
/** Spawn without a shell, with bounded output and cooperative cancellation. */
const runProcess = (command, args, options) => new Promise((resolve, reject) => {
	const label = options.label ?? "mnemon";
	const child = spawn(command, [...args], {
		stdio: [
			"ignore",
			"pipe",
			"pipe"
		],
		shell: false,
		windowsHide: true,
		...options.cwd === void 0 ? {} : { cwd: options.cwd },
		...options.env === void 0 ? {} : { env: options.env }
	});
	const maxOutputBytes = options.maxOutputBytes ?? 2097152;
	let stdout = "";
	let stderr = "";
	const stdoutDecoder = new StringDecoder("utf8");
	const stderrDecoder = new StringDecoder("utf8");
	let outputBytes = 0;
	let settled = false;
	let killTimer;
	const stop = () => {
		if (child.exitCode !== null || child.signalCode !== null) return;
		child.kill("SIGTERM");
		killTimer = setTimeout(() => {
			if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
		}, 1500);
	};
	const finish = (error, result) => {
		if (settled) return;
		settled = true;
		clearTimeout(timeout);
		if (killTimer !== void 0) clearTimeout(killTimer);
		options.signal?.removeEventListener("abort", abort);
		if (error === null) resolve(result);
		else reject(error);
	};
	const abort = () => {
		stop();
		finish(new ProcessError(`${label} command aborted: ${String(options.signal?.reason ?? "cancelled")}`, "aborted"));
	};
	const append = (target, chunk) => {
		outputBytes += chunk.byteLength;
		if (outputBytes > maxOutputBytes) {
			stop();
			finish(new ProcessError(`${label} output exceeded ${maxOutputBytes} bytes`, "output-limit"));
			return;
		}
		if (target === "stdout") stdout += stdoutDecoder.write(chunk);
		else stderr += stderrDecoder.write(chunk);
	};
	child.stdout.on("data", (chunk) => {
		append("stdout", chunk);
	});
	child.stderr.on("data", (chunk) => {
		append("stderr", chunk);
	});
	child.on("error", (error) => {
		finish(new ProcessError(`failed to launch ${label} (${JSON.stringify(command)}): ${error.message}`, "launch"));
	});
	child.on("close", (exitCode) => {
		stdout += stdoutDecoder.end();
		stderr += stderrDecoder.end();
		finish(null, {
			stdout,
			stderr,
			exitCode
		});
	});
	const timeout = setTimeout(() => {
		stop();
		finish(new ProcessError(`${label} did not respond within ${options.timeoutMs}ms`, "timeout"));
	}, options.timeoutMs);
	if (options.signal?.aborted === true) abort();
	else options.signal?.addEventListener("abort", abort, { once: true });
});
//#endregion
//#region src/providers/adapter.ts
const NORMALIZED_RELEVANCE_SCORE = Object.freeze({ kind: "normalized-relevance" });
//#endregion
export { runProcess as i, DEFAULT_MAX_OUTPUT_BYTES as n, ProcessError as r, NORMALIZED_RELEVANCE_SCORE as t };
