import { randomUUID } from "node:crypto";
import { Service } from "@deepseek-ai/cordis";
import { interruptedTurnClosers } from "@deepseek-ai/dsh-session";
/**
 * LOCAL PATCH for DSH 0.1.5 (dsh-vscode).
 *
 * Upstream `@deepseek-ai/dsh-agent-presets` dropped its `resolveSessionPreset`
 * export after 0.1.1-rc.2 — 0.1.5 exports AgentPresets/mountPreset/scopedRows
 * and friends instead — so `import { resolveSessionPreset }` here threw
 * "does not provide an export named 'resolveSessionPreset'" and aborted the
 * ENTIRE host boot (cordis reports it as a failed loader entry, which names the
 * plugin but not the cause).
 *
 * The 0.1.1 implementation was eight lines over data 0.1.5 still produces: the
 * `agent-preset/selected` session event and `header.agentPreset` both survive
 * (dsh-agent-presets, dsh-session, dsh-session-format-*, dsh-subagent and
 * dsh-client-ui-agent-preset still read/write them). It is therefore inlined
 * verbatim rather than dropped, keeping the fork's preset resolution identical.
 *
 * @param {{header: {agentPreset?: string}, events: Array<{type?: string, data?: {agentPreset?: string}}>}} session
 * @returns {string | undefined} the preset id the session was composed from.
 */
function resolveSessionPreset(session) {
	for (let index = session.events.length - 1; index >= 0; index -= 1) {
		const event = session.events[index];
		if (event?.type === "agent-preset/selected") return event.data.agentPreset;
	}
	return session.header.agentPreset;
}
//#region lib/types/index.js
/**
* Session fork capability: construct an Agent from an exact, completed Session prefix (standalone rollback plugin fork).
* @module @dsh-undo/rollback-fork
*/
/** A request could not produce a valid child prefix. */
var SessionForkUnavailableError = class extends Error {
	/** Stable machine-readable refusal code. */
	code = "fork-unavailable";
	/** @param message - Stable human-readable refusal. */
	constructor(message) {
		super(message);
		this.name = "SessionForkUnavailableError";
	}
};
/** Service Definition for exact Session branches. */
var SessionForkService = class extends Service {
	constructor(ctx) {
		super(ctx, "sessionFork");
	}
};
/** A Host Provider that owns fork Agent creation, composition, and Workspace attachment. */
var DefaultSessionForkService = class extends SessionForkService {
	static inject = [
		"agents",
		"sessions",
		"sessionPersistence",
		"workspaceRegistry",
		"agentDefaultModel"
	];
	/** Resolve, cut, create, and attach one child transactionally. */
	async fork(request) {
		const source = await this.readSource(request.sourceSessionId);
		const seed = this.cut(source, request.cut);
		const workspace = await this.workspaceFor(source);
		const childSessionId = request.childSessionId ?? `session-${randomUUID()}`;
		const presetId = resolveSessionPreset({
			header: source.header,
			events: source.events
		});
		const composition = await this.compose(presetId);
		const handle = await this.ctx.agents.create({
			sessionId: childSessionId,
			seed,
			meta: {
				...source.header.cwd === void 0 ? {} : { cwd: source.header.cwd },
				parentSession: source.id,
				seedLength: seed.length,
				...composition.agentPreset === void 0 ? {} : { agentPreset: composition.agentPreset }
			},
			agentOptions: source.agent?.options ?? request.retainedAgentOptions ?? this.defaultOptions(),
			setup: composition.setup
		});
		try {
			if (workspace !== void 0) await workspace.attachSession(handle.agent.id);
		} catch (error) {
			try {
				await handle.dispose();
			} catch (disposeError) {
				throw new AggregateError([error, disposeError], `session fork "${source.id}" could not attach or dispose its child`);
			}
			throw error;
		}
		return {
			handle,
			seed
		};
	}
	/** Resolve a live Session first, then an immutable persisted inspection. */
	async readSource(id) {
		const live = this.ctx.sessions.get(id);
		if (live !== void 0) {
			const agent = this.ctx.agents.get(id);
			return {
				id: live.id,
				header: live.header,
				events: live.events,
				...agent === void 0 ? {} : { agent }
			};
		}
		const stored = await this.ctx.sessionPersistence.inspect(id);
		return {
			id: stored.meta.id,
			header: stored.meta,
			events: stored.events
		};
	}
	/** Select the exact balanced prefix requested by the caller. */
	cut(source, cut) {
		switch (cut.kind) {
			case "completed-turn": return this.completedTurnPrefix(source, cut.atSeq);
			case "before-user-message": return this.beforeUserMessagePrefix(source, cut.messageId);
			default: return assertNever(cut);
		}
	}
	/** Keep the requested completed turn, matching the former session.fork behavior. */
	completedTurnPrefix(source, atSeq) {
		const events = source.events;
		const lastSeq = events.at(-1)?.seq ?? -1;
		const boundary = atSeq === void 0 ? events.findLast((event) => event.type === "turn/end") : events.find((event) => event.type === "turn/end" && event.seq >= atSeq) ?? (atSeq > lastSeq ? events.findLast((event) => event.type === "turn/end") : void 0);
		if (boundary === void 0) throw new SessionForkUnavailableError(atSeq !== void 0 && atSeq <= lastSeq ? `session "${source.id}" has not completed the turn containing event ${String(atSeq)}` : `session "${source.id}" has no completed turn to fork from`);
		let cut = boundary.seq + 1;
		while (cut < events.length && events[cut]?.type !== "turn/start") cut += 1;
		return events.slice(0, cut);
	}
	/** Exclude the target prompt, preserving a completed prefix before ordinary or steering input. */
	beforeUserMessagePrefix(source, messageId) {
		const targetIndex = source.events.findIndex((event) => event.type === "user/message" && event.data.id === messageId && isRollbackUserMessage(event.data));
		if (targetIndex < 0) throw new SessionForkUnavailableError(`session "${source.id}" has no eligible user message "${messageId}"`);
		const target = source.events[targetIndex];
		let startIndex = -1;
		for (let index = targetIndex - 1; index >= 0; index -= 1) {
			if (source.events[index]?.type !== "turn/start") continue;
			startIndex = index;
			break;
		}
		if (startIndex < 0) throw new SessionForkUnavailableError(`user message "${messageId}" has no owning turn`);
		const start = source.events[startIndex];
		if (source.events.slice(targetIndex + 1).find((event) => event.type === "turn/end" && event.data.turn === start.data.turn) === void 0) throw new SessionForkUnavailableError(`user message "${messageId}" belongs to an unfinished turn`);
		if (target.seq <= start.seq) throw new SessionForkUnavailableError(`user message "${messageId}" has an invalid turn boundary`);
		const followsHumanPrompt = source.events.slice(startIndex, targetIndex).some((event) => event.type === "user/message" && isRollbackUserMessage(event.data));
		const prefix = isSteeringUserMessage(target.data) || followsHumanPrompt ? steeringPrefix(source.events, targetIndex) : source.events.slice(0, startIndex);
		if (!isCompletedPrefix(prefix)) throw new SessionForkUnavailableError(`user message "${messageId}" does not follow a complete Session prefix`);
		return prefix;
	}
	/** Resolve direct Workspace membership, then a subagent ancestor's membership. */
	async workspaceFor(source) {
		const workspaces = this.ctx.workspaceRegistry.list();
		const direct = workspaces.find((workspace) => workspace.sessionIds.includes(source.id));
		if (direct !== void 0 || source.header.origin !== "subagent") return direct;
		const lineage = await this.ctx.get("sessionQuery")?.traceSession(source.id);
		for (const ancestor of lineage?.ancestors ?? []) {
			const workspace = workspaces.find((candidate) => candidate.sessionIds.includes(ancestor.header.id));
			if (workspace !== void 0) return workspace;
		}
	}
	/** Resolve the source composition before the child Session header is snapshotted. */
	async compose(presetId) {
		const presets = this.ctx.get("agentPresets");
		if (presets === void 0) return { setup: () => Promise.resolve() };
		const preset = await presets.resolve(presetId);
		return {
			agentPreset: preset.id,
			setup: async (agentCtx) => {
				await presets.mount(agentCtx, preset.id);
			}
		};
	}
	/** Read the Host default only for a cold source that has no live Agent options. */
	defaultOptions() {
		return this.ctx.agentDefaultModel.currentSelection();
	}
};
/** True when a message is a direct, text-only human submission, including a steer. */
function isRollbackUserMessage(message) {
	return message.source.kind === "user" && message.content.every((block) => block.type === "text");
}
/** True when a human prompt was delivered into the currently running turn. */
function isSteeringUserMessage(message) {
	return message.source.kind === "user" && "delivery" in message.source && message.source.delivery === "steer";
}
/** Keep the completed step before a steer, then safely close its still-open Host turn. */
function steeringPrefix(events, targetIndex) {
	if (events[targetIndex]?.type !== "user/message") return [];
	let stepStart = -1;
	for (let index = targetIndex - 1; index >= 0; index -= 1) if (events[index]?.type === "step/start") {
		stepStart = index;
		break;
	}
	const retained = events.slice(0, stepStart >= 0 ? stepStart : targetIndex);
	return [...retained, ...interruptedTurnClosers(retained)];
}
/** The prefix must not retain an unfinished turn. */
function isCompletedPrefix(events) {
	let open;
	for (const event of events) if (event.type === "turn/start") {
		if (open !== void 0) return false;
		open = event.data.turn;
	} else if (event.type === "turn/end") {
		if (open !== event.data.turn) return false;
		open = void 0;
	}
	return open === void 0;
}
/** Require exhaustive handling when SessionForkCut gains a member. */
function assertNever(value) {
	throw new Error(`unhandled Session fork cut: ${JSON.stringify(value)}`);
}
//#endregion
export { DefaultSessionForkService, DefaultSessionForkService as default, SessionForkService, SessionForkUnavailableError };
