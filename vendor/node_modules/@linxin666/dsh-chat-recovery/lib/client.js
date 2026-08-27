window.__ModuleLoader__.load({
	id: "@linxin666/dsh-chat-recovery",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/apply-guard.ts
		/** Claims the plugin apply slot. Returns true when this call won the slot. */
		function claimChatRecoveryApply() {
			if (globalThis.__dshChatRecoveryApplied === true) return false;
			globalThis.__dshChatRecoveryApplied = true;
			return true;
		}
		/** Releases the claim (fiber cleanup) so a hot-reloaded bundle can claim again. */
		function releaseChatRecoveryApply() {
			globalThis.__dshChatRecoveryApplied = void 0;
		}
		//#endregion
		//#region src/client/wiring.ts
		/**
		* Connect (or create) a blank session in the workspace the source session
		* belongs to. Used as the first-turn fallback when forking cannot cut history
		* before the message (no earlier turn/end exists).
		* @param workspaces - the workspaces service.
		* @param cwd - the source session's workspace directory.
		*/
		async function connectBlank(workspaces, cwd) {
			if (cwd === void 0 || cwd === "") throw new Error("source session has no workspace directory");
			let workspaceId = workspaces.list.getSnapshot().items.find((item) => item.path === cwd)?.workspaceId;
			if (workspaceId === void 0) workspaceId = (await workspaces.create({ path: cwd })).workspaceId;
			return workspaces.connectWorkspace(workspaceId);
		}
		/**
		* Fill the supervisor ports from the live services.
		* @param sessions - the sessions service.
		* @param workspaces - the workspaces service.
		*/
		function createRetryPorts(sessions, workspaces) {
			return {
				currentId: () => sessions.list.getSnapshot().current,
				snapshot: (id) => sessions.binding(id)?.session.getSnapshot(),
				cwdOf: (id) => sessions.list.getSnapshot().byId[id]?.cwd,
				fork: (opts) => sessions.fork(opts),
				connectBlank: (cwd) => connectBlank(workspaces, cwd),
				open: (id) => {
					sessions.open(id);
				},
				prompt: async (id, text) => {
					const binding = sessions.binding(id);
					if (binding === void 0) return {
						ok: false,
						code: "session-unavailable",
						message: "target session is not available"
					};
					const result = await binding.session.prompt([{
						type: "text",
						text
					}], "queue");
					if (result.ok) return { ok: true };
					return {
						ok: false,
						code: result.error.code,
						message: result.error.message
					};
				},
				schedule: (fn, ms) => {
					const timer = setTimeout(fn, ms);
					return () => {
						clearTimeout(timer);
					};
				}
			};
		}
		/**
		* Edit submission: fork a child from the history prefix before the edited
		* message (or connect a blank sibling for first-turn edits), open it, and
		* send the edited text. The original session is never touched: a fork or
		* resubmit failure leaves it exactly as it was.
		* @param sessions - the sessions service.
		* @param workspaces - the workspaces service.
		*/
		function createSubmitEdit(sessions, workspaces) {
			return async (input) => {
				const cwd = sessions.list.getSnapshot().byId[input.sessionId]?.cwd;
				const targetId = input.forkAtSeq === null ? await connectBlank(workspaces, cwd) : await sessions.fork({
					sessionId: input.sessionId,
					atSeq: input.forkAtSeq,
					increaseTitle: true
				});
				sessions.open(targetId);
				const binding = sessions.binding(targetId);
				if (binding === void 0) throw new Error("edited branch is not available");
				const result = await binding.session.prompt([{
					type: "text",
					text: input.editedText
				}], "queue");
				if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
			};
		}
		//#endregion
		//#region src/core/transcript.ts
		/**
		* Extract verbatim text from a user message. Returns null unless EVERY block
		* is a text block: image/attachment messages cannot be safely copied into a
		* re-submitted prompt and are therefore not editable.
		* @param content - the durable user message blocks.
		* @returns the joined text, or null when any block is non-text.
		*/
		function userText(content) {
			if (content.length === 0) return null;
			let text = "";
			for (const block of content) {
				if (block.type !== "text" || typeof block.text !== "string") return null;
				text += block.text;
			}
			return text;
		}
		/**
		* Resolve the edit target: the LAST user message, provided the session is not
		* running/removed and the message's turn has ended. Steering, context and
		* system nodes are never considered.
		* @param snapshot - the live conversation snapshot.
		* @returns the edit target, or null when nothing is editable right now.
		*/
		function lastCompletedUserTarget(snapshot) {
			if (snapshot.running || snapshot.removed) return null;
			let last = null;
			for (const node of snapshot.nodes) if (node.kind === "user") last = node;
			if (last === null) return null;
			let turn = -1;
			let turnEndSeq = -1;
			for (const [t, end] of snapshot.turnEnds) if (end > last.seq && (turn === -1 || t < turn)) {
				turn = t;
				turnEndSeq = end;
			}
			if (turn === -1) return null;
			const text = userText(last.content);
			if (text === null) return null;
			let forkAtSeq = null;
			for (const [, end] of snapshot.turnEnds) if (end < last.seq && (forkAtSeq === null || end > forkAtSeq)) forkAtSeq = end;
			return {
				text,
				seq: last.seq,
				turn,
				turnEndSeq,
				forkAtSeq
			};
		}
		/**
		* The seq of the event right before the given turn started: the latest
		* turn/end of any earlier turn, or 0 for the first turn.
		* @param snapshot - the live conversation snapshot.
		* @param turn - the turn number.
		* @returns the boundary seq (exclusive start of the turn).
		*/
		function turnStartSeq(snapshot, turn) {
			let start = 0;
			for (const [t, end] of snapshot.turnEnds) if (t < turn && end > start) start = end;
			return start;
		}
		/**
		* The last user message inside one turn (the turn opener).
		* @param snapshot - the live conversation snapshot.
		* @param turn - the turn number.
		* @returns the message node, or null when the turn has none in-window.
		*/
		function lastUserInTurn(snapshot, turn) {
			const end = snapshot.turnEnds.get(turn);
			if (end === void 0) return null;
			const start = turnStartSeq(snapshot, turn);
			let found = null;
			for (const node of snapshot.nodes) if (node.kind === "user" && node.seq > start && node.seq <= end) found = node;
			return found;
		}
		/**
		* Whether the turn ran any tool call or slash command. Re-running such a turn
		* would repeat side effects, so the retry policy treats tool-involved turns
		* as manual-only (never auto-retried).
		* @param snapshot - the live conversation snapshot.
		* @param turn - the turn number.
		*/
		function turnHasToolActivity(snapshot, turn) {
			const end = snapshot.turnEnds.get(turn) ?? Number.POSITIVE_INFINITY;
			const start = turnStartSeq(snapshot, turn);
			for (const node of snapshot.nodes) if ((node.kind === "tool-result" || node.kind === "command") && node.seq > start && node.seq <= end) return true;
			return snapshot.runningCalls.some((call) => call.turn === turn);
		}
		/** The interruption-frozen assistant partial of one turn, when present. */
		function interruptedAssistantInTurn(snapshot, turn) {
			for (const node of snapshot.nodes) if (node.kind === "assistant" && node.turn === turn && node.interrupted === true) return node;
			return null;
		}
		/** The durable terminal error node of one turn, when present. */
		function turnErrorInTurn(snapshot, turn) {
			for (const node of snapshot.nodes) if (node.kind === "turn-error" && node.turn === turn) return node;
			return null;
		}
		/** Whether the turn hit the per-request output-token cap. */
		function maxTokensInTurn(snapshot, turn) {
			return snapshot.nodes.some((node) => node.kind === "turn-max-tokens" && node.turn === turn);
		}
		/**
		* Whether the HOST already owns a pending retry for this turn (llm/retry
		* chain scheduled or started). While the host is retrying, the client
		* supervisor must stand down: acting would double the retry traffic.
		*/
		function hostRetryPending(snapshot, turn) {
			return snapshot.nodes.some((node) => node.kind === "model-retry" && node.turn === turn && (node.retryState === "scheduled" || node.retryState === "started"));
		}
		/** Whether the turn settled with a finalized (messageId-bearing) assistant message. */
		function assistantFinalizedInTurn(snapshot, turn) {
			return snapshot.nodes.some((node) => node.kind === "assistant" && node.turn === turn && node.interrupted !== true && node.messageId !== void 0);
		}
		/** Count of durable user messages in the window (duplicate-message guard). */
		function userNodeCount(snapshot) {
			let count = 0;
			for (const node of snapshot.nodes) if (node.kind === "user") count += 1;
			return count;
		}
		/**
		* User messages with seq at or below the given boundary (the history prefix a
		* fork keeps). Used to compute how many user messages a retry child is
		* EXPECTED to carry: prefix count plus the one replayed message.
		*/
		function userNodeCountBefore(snapshot, boundarySeq) {
			let count = 0;
			for (const node of snapshot.nodes) if (node.kind === "user" && node.seq <= boundarySeq) count += 1;
			return count;
		}
		/** The latest completed turn number, or null when none exists in-window. */
		function lastTurnOf(snapshot) {
			let max = -1;
			for (const turn of snapshot.turnEnds.keys()) if (turn > max) max = turn;
			return max === -1 ? null : max;
		}
		//#endregion
		//#region src/core/retry-policy.ts
		/** Exponential backoff delays for attempts 1..5 (1s, 2s, 4s, 8s, 16s). */
		const BACKOFF_DELAYS_MS = [
			1e3,
			2e3,
			4e3,
			8e3,
			16e3
		];
		/**
		* The terminal failure of the LAST completed turn, when one exists. Running
		* sessions never produce a failure: a turn that is still going is not failed.
		* @param snapshot - the live conversation snapshot.
		* @returns the failure descriptor, or null when the last turn did not fail.
		*/
		function failureOfLastTurn(snapshot) {
			if (snapshot.running) return null;
			let turn = -1;
			let end = 0;
			for (const [t, e] of snapshot.turnEnds) if (t > turn) {
				turn = t;
				end = e;
			}
			if (turn === -1) return null;
			const error = turnErrorInTurn(snapshot, turn);
			if (error !== null) return {
				kind: "turn-error",
				turn,
				turnEndSeq: end,
				message: error.message,
				code: error.code ?? null,
				hasTools: turnHasToolActivity(snapshot, turn)
			};
			if (maxTokensInTurn(snapshot, turn)) return {
				kind: "max-tokens",
				turn,
				turnEndSeq: end,
				message: null,
				code: "turn-max-tokens",
				hasTools: turnHasToolActivity(snapshot, turn)
			};
			if (interruptedAssistantInTurn(snapshot, turn) !== null) return {
				kind: "interrupted",
				turn,
				turnEndSeq: end,
				message: snapshot.lastAgentError,
				code: null,
				hasTools: turnHasToolActivity(snapshot, turn)
			};
			return null;
		}
		/**
		* Recoverable-error classification. Only model/API-level transient failures
		* count as auto-retryable: timeouts, network errors, server errors, rate
		* limits and empty responses. Auth failures, permission errors, invalid
		* arguments, quotas and cancellations are NEVER auto-retried.
		* @param code - machine-routing error code, when present.
		* @param message - human-readable failure text, when present.
		*/
		function isRetryableError(code, message) {
			const haystack = `${code ?? ""} ${message ?? ""}`;
			if (!RETRYABLE_PATTERN.test(haystack)) return false;
			if (NON_RETRYABLE_PATTERN.test(haystack)) return false;
			return true;
		}
		const RETRYABLE_PATTERN = /(timeout|timed[\s_-]?out|network|econn|eof|socket|fetch|connection|dns|enotfound|transport|rate[\s_-]?limit|429|5\d{2}|server|overloaded|unavailable|capacity|empty|no[\s_-]?response)/i;
		const NON_RETRYABLE_PATTERN = /(400|401|402|403|404|405|422|quota|auth|credential|api[\s_-]?key|permission|denied|forbidden|invalid|unsupported|not[\s_-]?found|cancel)/i;
		/**
		* Build the re-run plan for one failed turn: its original user text plus the
		* fork anchor that cuts history right before it, so a retry branch never
		* repeats the old message and the failed stream fragments never enter the
		* next model request.
		* @param snapshot - the live conversation snapshot.
		* @param turn - the failed turn number.
		* @returns the plan, or null when the turn has no safely-replayable user message.
		*/
		function planForTurn(snapshot, turn) {
			const message = lastUserInTurn(snapshot, turn);
			if (message === null) return null;
			const text = userText(message.content);
			if (text === null || text.trim() === "") return null;
			let start = 0;
			for (const [t, end] of snapshot.turnEnds) if (t < turn && end > start) start = end;
			return {
				text,
				forkAtSeq: start === 0 ? null : start,
				messageSeq: message.seq
			};
		}
		/**
		* Whether the failure qualifies for AUTOMATIC retry. Tool-involved turns are
		* manual-only (re-running them repeats side effects whose idempotency cannot
		* be confirmed); interrupted turns are auto only when the host reported a
		* crash (lastAgentError), never when the user stopped the turn on purpose;
		* output-token caps are never auto-retried.
		*/
		function isAutoRetryable(snapshot, failure) {
			if (failure.hasTools) return false;
			switch (failure.kind) {
				case "turn-error": return isRetryableError(failure.code, failure.message);
				case "interrupted": return snapshot.lastAgentError !== null;
				case "max-tokens": return false;
			}
		}
		/**
		* The full retry decision for the current state of a session. The host's own
		* pending llm/retry chain stands the supervisor down; everything else that is
		* failed but not auto-retryable lands on the manual path (transcript button).
		* @param snapshot - the live conversation snapshot.
		*/
		function verdictFor(snapshot) {
			if (snapshot.running || snapshot.removed) return { action: "none" };
			const failure = failureOfLastTurn(snapshot);
			if (failure === null) return { action: "none" };
			if (hostRetryPending(snapshot, failure.turn)) return { action: "none" };
			if (isAutoRetryable(snapshot, failure)) {
				const plan = planForTurn(snapshot, failure.turn);
				if (plan !== null) return {
					action: "auto",
					failure,
					plan
				};
			}
			return {
				action: "manual",
				failure
			};
		}
		//#endregion
		//#region src/core/retry-supervisor.ts
		const IDLE = {
			phase: "idle",
			kind: null,
			attempt: 0,
			maxAttempts: 5,
			delayMs: null,
			sourceId: null,
			targetId: null,
			reason: null
		};
		var RetrySupervisor = class {
			ports;
			options;
			state = { ...IDLE };
			listeners = /* @__PURE__ */ new Set();
			timer = null;
			plan = null;
			/** User messages counted on the session that owns the current backoff wait. */
			waitingUserBaseline = 0;
			/** Last completed turn/end on the session that owns the current backoff wait. */
			waitingEndBaseline = 0;
			/** User messages the retry child is EXPECTED to carry (prefix + the replayed one). */
			expectedUserCount = 0;
			/** Last turn/end seq seen when the cycle reached a terminal phase (reset guard). */
			settledEndSeq = 0;
			/** Last failure explicitly handled per session; the same turn must never auto-arm twice. */
			suppressedFailureEnds = /* @__PURE__ */ new Map();
			/** Monotonic owner for an in-flight fork/prompt continuation. */
			operationGeneration = 0;
			attemptInFlight = false;
			disposed = false;
			/** Last completed event inherited by the current retry child before its replayed turn. */
			attemptStartEndSeq = 0;
			/**
			* The retry child created by the current (or most recent) cycle. Later
			* attempts of the same cycle, and retries re-armed inside that child,
			* continue in this session instead of forking another one.
			*/
			cycleTargetId = null;
			constructor(ports, options = {}) {
				this.ports = ports;
				this.options = options;
			}
			getSnapshot = () => this.state;
			subscribe = (fn) => {
				this.listeners.add(fn);
				return () => {
					this.listeners.delete(fn);
				};
			};
			/**
			* The client wiring calls this on every sessions.list or session-snapshot
			* change. Idle: arm auto-retry when the current session's last turn failed
			* recoverably. Waiting: cancel when the user navigated away or took over.
			* Running: settle the child — success, next attempt, or final failure.
			*/
			review() {
				if (this.disposed) return;
				const current = this.ports.currentId();
				switch (this.state.phase) {
					case "idle": {
						if (current === void 0) return;
						const snapshot = this.ports.snapshot(current);
						if (snapshot === void 0) return;
						const verdict = verdictFor(snapshot);
						if (verdict.action === "auto" && this.options.autoRetry === true) {
							const suppressedEnd = this.suppressedFailureEnds.get(current) ?? -1;
							if (verdict.failure.turnEndSeq <= suppressedEnd) return;
							this.suppressedFailureEnds.delete(current);
							this.startAuto(current, verdict.plan);
						}
						return;
					}
					case "waiting": {
						const owner = this.state.targetId ?? this.state.sourceId;
						if (owner === null || current !== owner) {
							this.cancel();
							return;
						}
						const snapshot = this.ports.snapshot(owner);
						if (snapshot !== void 0 && (snapshot.running || userNodeCount(snapshot) > this.waitingUserBaseline)) this.cancel();
						return;
					}
					case "running": {
						const target = this.state.targetId;
						if (target === null || current !== target) {
							this.cancel();
							return;
						}
						const snapshot = this.ports.snapshot(target);
						if (snapshot === void 0 || snapshot.running) return;
						if (userNodeCount(snapshot) > this.expectedUserCount) {
							this.cancel();
							return;
						}
						if (latestTurnEnd(snapshot) <= this.attemptStartEndSeq) return;
						const verdict = verdictFor(snapshot);
						if (verdict.action === "none") {
							const turn = lastTurnOf(snapshot);
							if (turn !== null && assistantFinalizedInTurn(snapshot, turn)) {
								this.settledEndSeq = snapshot.turnEnds.get(turn) ?? this.settledEndSeq;
								this.finish("done");
							}
							return;
						}
						if (verdict.action === "auto") {
							if (this.state.kind === "manual") {
								this.settledEndSeq = verdict.failure.turnEndSeq;
								this.finish("failed", verdict.failure.message ?? "");
							} else if (this.state.attempt >= this.state.maxAttempts) {
								this.settledEndSeq = verdict.failure.turnEndSeq;
								this.finish("exhausted", verdict.failure.message ?? "");
							} else this.scheduleNext(userNodeCount(snapshot), latestTurnEnd(snapshot));
							return;
						}
						if (verdict.failure.kind === "interrupted" && verdict.failure.message === null) {
							this.cancel();
							return;
						}
						this.settledEndSeq = verdict.failure.turnEndSeq;
						this.finish("failed", verdict.failure.message ?? "");
						return;
					}
					case "cancelled": {
						if (current === void 0) return;
						const snapshot = this.ports.snapshot(current);
						if (snapshot === void 0) return;
						const target = this.state.targetId;
						if (target !== null && current === target) {
							if (snapshot.running || latestTurnEnd(snapshot) <= this.attemptStartEndSeq) return;
							this.suppressFailure(snapshot);
						}
						this.reset();
						return;
					}
					case "exhausted":
					case "failed":
					case "done": {
						if (current === void 0) return;
						const snapshot = this.ports.snapshot(current);
						if (snapshot === void 0) return;
						if (snapshot.running) {
							this.reset();
							return;
						}
						let latestEnd = 0;
						for (const end of snapshot.turnEnds.values()) if (end > latestEnd) latestEnd = end;
						if (latestEnd > this.settledEndSeq) this.reset();
						return;
					}
				}
			}
			/** Manual one-shot retry from the transcript button (never auto-repeats). */
			manualRetry(sourceId) {
				if (this.disposed) return;
				if (this.state.phase === "waiting" || this.state.phase === "running") return;
				const snapshot = this.ports.snapshot(sourceId);
				if (snapshot === void 0) return;
				const verdict = verdictFor(snapshot);
				if (verdict.action === "none") return;
				const plan = verdict.action === "auto" ? verdict.plan : planForTurn(snapshot, verdict.failure.turn);
				if (plan === null) return;
				this.invalidateAttempt();
				this.resolveCycleTarget(sourceId);
				this.plan = plan;
				this.waitingUserBaseline = userNodeCount(snapshot);
				this.waitingEndBaseline = latestTurnEnd(snapshot);
				this.publish({
					phase: "waiting",
					kind: "manual",
					attempt: 1,
					maxAttempts: 1,
					delayMs: 0,
					sourceId,
					targetId: null,
					reason: null
				});
				this.runAttempt();
			}
			/** User-initiated cancel: no further attempts, ever (until a new failure arms one). */
			cancel() {
				if (this.disposed) return;
				const needsQuarantine = this.state.phase === "running";
				this.invalidateAttempt();
				this.clearTimer();
				if (this.state.phase === "idle" || this.state.phase === "cancelled") return;
				const source = this.state.sourceId;
				if (source !== null) {
					const end = this.suppressFailure(this.ports.snapshot(source));
					if (end !== void 0) this.settledEndSeq = end;
				}
				const target = this.state.targetId;
				if (target !== null) this.suppressFailure(this.ports.snapshot(target));
				this.publish({
					phase: "cancelled",
					delayMs: null,
					targetId: needsQuarantine ? target : null,
					reason: null
				});
			}
			/** UI "retry now": skip the remaining backoff wait. */
			retryNow() {
				if (this.disposed || this.state.phase !== "waiting" || this.attemptInFlight) return;
				this.clearTimer();
				this.runAttempt();
			}
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				this.invalidateAttempt();
				this.clearTimer();
				this.listeners.clear();
			}
			/**
			* A new cycle reuses the previous cycle's retry child only when its source
			* IS that child (the user retried inside it); any other source means a
			* different failed turn and needs a fresh child.
			*/
			resolveCycleTarget(sourceId) {
				if (this.cycleTargetId !== null && sourceId !== this.cycleTargetId) this.cycleTargetId = null;
			}
			startAuto(sourceId, plan) {
				this.invalidateAttempt();
				this.resolveCycleTarget(sourceId);
				const snapshot = this.ports.snapshot(sourceId);
				this.plan = plan;
				this.waitingUserBaseline = snapshot === void 0 ? 0 : userNodeCount(snapshot);
				this.waitingEndBaseline = latestTurnEnd(snapshot);
				this.publish({
					phase: "waiting",
					kind: "auto",
					attempt: 0,
					maxAttempts: 5,
					delayMs: BACKOFF_DELAYS_MS[0],
					sourceId,
					targetId: null,
					reason: null
				});
				this.scheduleNext();
			}
			scheduleNext(waitingUserBaseline = this.waitingUserBaseline, waitingEndBaseline = this.waitingEndBaseline) {
				if (this.disposed) return;
				this.invalidateAttempt();
				this.clearTimer();
				const attempt = this.state.attempt + 1;
				const delay = this.state.kind === "manual" ? 0 : BACKOFF_DELAYS_MS[Math.min(attempt - 1, BACKOFF_DELAYS_MS.length - 1)];
				this.waitingUserBaseline = waitingUserBaseline;
				this.waitingEndBaseline = waitingEndBaseline;
				this.publish({
					phase: "waiting",
					attempt,
					delayMs: delay,
					targetId: this.state.targetId
				});
				const generation = this.operationGeneration;
				this.timer = this.ports.schedule(() => {
					if (this.disposed || generation !== this.operationGeneration) return;
					this.timer = null;
					this.runAttempt();
				}, delay);
			}
			async runAttempt() {
				if (this.disposed || this.state.phase !== "waiting" || this.attemptInFlight) return;
				const generation = ++this.operationGeneration;
				this.attemptInFlight = true;
				const sourceId = this.state.sourceId;
				const plan = this.plan;
				if (sourceId === null || plan === null) {
					this.reset();
					return;
				}
				if (!this.waitingOwnerIsValid()) {
					this.cancel();
					return;
				}
				const reused = this.cycleTargetId !== null;
				let targetId;
				try {
					if (reused) targetId = this.cycleTargetId;
					else {
						targetId = plan.forkAtSeq === null ? await this.ports.connectBlank(this.ports.cwdOf(sourceId)) : await this.ports.fork({
							sessionId: sourceId,
							atSeq: plan.forkAtSeq,
							increaseTitle: false
						});
						this.cycleTargetId = targetId;
					}
				} catch (error) {
					if (!this.ownsAttempt(generation)) return;
					this.finish("failed", messageOf(error));
					return;
				}
				if (!this.ownsAttempt(generation) || this.state.phase !== "waiting") return;
				if (!this.waitingOwnerIsValid()) {
					this.cancel();
					return;
				}
				const sourceSnapshot = this.ports.snapshot(sourceId);
				const childSnapshot = reused ? this.ports.snapshot(targetId) : void 0;
				const prePromptUserCount = reused ? childSnapshot === void 0 ? this.waitingUserBaseline : userNodeCount(childSnapshot) : plan.forkAtSeq === null ? 0 : sourceSnapshot === void 0 ? 0 : userNodeCountBefore(sourceSnapshot, plan.forkAtSeq);
				this.expectedUserCount = prePromptUserCount + 1;
				const observedStartEndSeq = latestTurnEnd(childSnapshot);
				this.attemptStartEndSeq = reused ? Math.max(this.waitingEndBaseline, observedStartEndSeq) : observedStartEndSeq || plan.forkAtSeq || 0;
				this.publish({
					phase: "running",
					targetId
				});
				if (!this.ownsRunningAttempt(generation, targetId)) return;
				this.ports.open(targetId);
				if (!this.ownsRunningAttempt(generation, targetId)) return;
				let outcome;
				try {
					outcome = await this.ports.prompt(targetId, plan.text);
				} catch (error) {
					if (!this.ownsAttempt(generation)) return;
					this.finish("failed", messageOf(error));
					return;
				}
				if (!this.ownsRunningAttempt(generation, targetId)) {
					if (this.ownsAttempt(generation)) this.attemptInFlight = false;
					return;
				}
				this.attemptInFlight = false;
				if (!outcome.ok) {
					const reason = `${outcome.code ?? "error"}: ${outcome.message ?? ""}`;
					const retryable = isRetryableError(outcome.code, outcome.message);
					if (this.state.kind === "auto" && retryable && this.state.attempt < this.state.maxAttempts) {
						const snapshot = this.ports.snapshot(targetId);
						if (snapshot !== void 0 && (snapshot.running || userNodeCount(snapshot) > prePromptUserCount)) {
							this.cancel();
							return;
						}
						this.scheduleNext(prePromptUserCount, this.attemptStartEndSeq);
					} else {
						const exhausted = this.state.kind === "auto" && retryable && this.state.attempt >= this.state.maxAttempts;
						this.finish(exhausted ? "exhausted" : "failed", reason);
					}
					return;
				}
			}
			finish(phase, reason = null) {
				this.invalidateAttempt();
				this.clearTimer();
				if (phase !== "done" && this.state.sourceId !== null) {
					const end = this.suppressFailure(this.ports.snapshot(this.state.sourceId));
					if (end !== void 0) this.settledEndSeq = end;
				}
				this.publish({
					phase,
					delayMs: null,
					targetId: null,
					...reason === null ? {} : { reason }
				});
				if (phase !== "done" && this.state.sourceId !== null) this.ports.open(this.state.sourceId);
			}
			reset() {
				this.invalidateAttempt();
				this.clearTimer();
				this.plan = null;
				this.waitingUserBaseline = 0;
				this.waitingEndBaseline = 0;
				this.expectedUserCount = 0;
				this.settledEndSeq = 0;
				this.attemptStartEndSeq = 0;
				this.publish({ ...IDLE });
			}
			/** Invalidate every late continuation owned by the previous attempt/cycle. */
			invalidateAttempt() {
				this.operationGeneration += 1;
				this.attemptInFlight = false;
			}
			ownsAttempt(generation) {
				return !this.disposed && generation === this.operationGeneration;
			}
			ownsRunningAttempt(generation, targetId) {
				return this.ownsAttempt(generation) && this.state.phase === "running" && this.state.targetId === targetId;
			}
			waitingOwnerIsValid() {
				const owner = this.state.targetId ?? this.state.sourceId;
				if (owner === null || this.ports.currentId() !== owner) return false;
				const snapshot = this.ports.snapshot(owner);
				return snapshot === void 0 || !snapshot.running && userNodeCount(snapshot) <= this.waitingUserBaseline;
			}
			/** Record one terminal failure so ordinary subscription churn cannot re-arm it. */
			suppressFailure(snapshot) {
				if (snapshot === void 0) return void 0;
				const failure = failureOfLastTurn(snapshot);
				if (failure === null) return void 0;
				const previous = this.suppressedFailureEnds.get(snapshot.sessionId) ?? -1;
				if (failure.turnEndSeq > previous) this.suppressedFailureEnds.set(snapshot.sessionId, failure.turnEndSeq);
				return failure.turnEndSeq;
			}
			clearTimer() {
				if (this.timer !== null) {
					this.timer();
					this.timer = null;
				}
			}
			publish(patch) {
				this.state = {
					...this.state,
					...patch
				};
				for (const fn of this.listeners) fn();
			}
		};
		function messageOf(error) {
			if (error instanceof Error) return error.message;
			return String(error);
		}
		/** Highest completed turn/end seq in one snapshot (0 for blank/unavailable). */
		function latestTurnEnd(snapshot) {
			if (snapshot === void 0) return 0;
			let latest = 0;
			for (const end of snapshot.turnEnds.values()) if (end > latest) latest = end;
			return latest;
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-chat-recovery/src/client/turn-actions.module.css.mjs
		const css$1 = "._yVzta_row{gap:6px;display:flex}._yVzta_button{appearance:none;border:1px solid var(--dsw-alias-border);color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:4px;padding:0 8px;font-size:11px;line-height:18px}._yVzta_button:hover{background:var(--dsw-alias-fill-secondary)}._yVzta_editor{flex-direction:column;gap:6px;max-width:720px;margin:6px 0;display:flex}._yVzta_textarea{resize:vertical;border:1px solid var(--dsw-alias-border);background:var(--dsw-alias-fill-primary);width:100%;min-height:72px;color:var(--dsw-alias-text-primary);font:inherit;border-radius:6px;padding:8px}._yVzta_actions{align-items:center;gap:8px;display:flex}._yVzta_save{appearance:none;background:var(--dsw-alias-accent);color:var(--dsw-alias-text-on-accent,#fff);font:inherit;cursor:pointer;border:none;border-radius:4px;padding:0 12px;line-height:22px}._yVzta_save:disabled{opacity:.5;cursor:default}._yVzta_hint{color:var(--dsw-alias-label-tertiary);font-size:11px}._yVzta_errorText{color:var(--dsw-alias-text-danger,#d33);font-size:12px}";
		const tagId$1 = "@linxin666/dsh-chat-recovery/turn-actions.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-chat-recovery";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var turn_actions_module_css_default = {
			"actions": "_yVzta_actions",
			"button": "_yVzta_button",
			"editor": "_yVzta_editor",
			"errorText": "_yVzta_errorText",
			"hint": "_yVzta_hint",
			"row": "_yVzta_row",
			"save": "_yVzta_save",
			"textarea": "_yVzta_textarea"
		};
		//#endregion
		//#region src/client/TurnActionsView.tsx
		/**
		* Turn-tail entry: the Edit affordance for the last completed user message
		* and the manual Retry affordance for a failed turn. Registered into the
		* conversation.chat.turnTail chain (rendered before each completed turn's
		* IconActions).
		*
		* The chain selector matches every completed turn (the owner share carries
		* only turn/seq/openFile — a pure selector cannot see the conversation
		* snapshot), so the component gates on the session snapshot itself and
		* returns null wherever nothing applies.
		*/
		const TurnActionsView = (0, react.memo)(function TurnActionsView(props) {
			const { useSession, t, supervisor, submitEdit, manualRetry } = props;
			const turn = props.turn.turn;
			const sessionId = props.sessionId;
			const [editing, setEditing] = (0, react.useState)(false);
			const [draft, setDraft] = (0, react.useState)("");
			const [saving, setSaving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const target = useSession((s) => lastCompletedUserTarget(s), (a, b) => a?.seq === b?.seq && a?.turn === b?.turn);
			const failure = useSession((s) => failureOfLastTurn(s), (a, b) => a?.turn === b?.turn && a?.kind === b?.kind && a?.message === b?.message && a?.code === b?.code);
			const running = useSession((s) => s.running);
			const retryState = (0, react.useSyncExternalStore)(supervisor.subscribe, supervisor.getSnapshot);
			const canEdit = target !== null && target.turn === turn && !running;
			const busy = retryState.phase === "waiting" || retryState.phase === "running";
			const canRetry = failure !== null && failure.turn === turn && !running && !busy;
			if (!editing && !canEdit && !canRetry) return null;
			const startEdit = () => {
				if (target === null) return;
				setDraft(target.text);
				setError(null);
				setEditing(true);
			};
			const save = async () => {
				if (target === null || saving || draft.trim() === "") return;
				setSaving(true);
				setError(null);
				try {
					await submitEdit({
						sessionId,
						forkAtSeq: target.forkAtSeq,
						editedText: draft
					});
				} catch (err) {
					setSaving(false);
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			if (editing) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: turn_actions_module_css_default.editor,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: turn_actions_module_css_default.textarea,
						value: draft,
						autoFocus: true,
						onChange: (event) => setDraft(event.target.value),
						onKeyDown: (event) => {
							if (event.key === "Escape") {
								event.preventDefault();
								setEditing(false);
								setError(null);
							} else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
								event.preventDefault();
								save();
							}
						},
						placeholder: t("edit.button")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: turn_actions_module_css_default.actions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: turn_actions_module_css_default.button,
							onClick: () => {
								setEditing(false);
								setError(null);
							},
							children: t("edit.cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: turn_actions_module_css_default.save,
							disabled: saving || draft.trim() === "",
							onClick: () => void save(),
							children: saving ? t("edit.saving") : t("edit.save")
						})]
					}),
					error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: turn_actions_module_css_default.errorText,
						children: t("edit.failed", { reason: error })
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: turn_actions_module_css_default.hint,
						children: t("edit.hint")
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: turn_actions_module_css_default.row,
				children: [canEdit ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: turn_actions_module_css_default.button,
					onClick: startEdit,
					children: t("edit.button")
				}) : null, canRetry ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: turn_actions_module_css_default.button,
					title: t("retry.forkHint"),
					onClick: () => manualRetry(sessionId),
					children: t("retry.button")
				}) : null]
			});
		});
		//#endregion
		//#region \0dsh-css:packages/dsh-chat-recovery/src/client/retry-dock.module.css.mjs
		const css = ".cdYrZq_dock{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:2px;padding:4px 0;font-size:12px;line-height:20px;display:flex}.cdYrZq_row{align-items:center;gap:8px;display:flex}.cdYrZq_hint{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}.cdYrZq_error{color:var(--dsw-alias-text-danger,#d33)}.cdYrZq_buttons{gap:6px;display:flex}.cdYrZq_button{appearance:none;border:1px solid var(--dsw-alias-border);color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:4px;padding:0 8px;line-height:18px}.cdYrZq_button:hover{background:var(--dsw-alias-fill-secondary)}";
		const tagId = "@linxin666/dsh-chat-recovery/retry-dock.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-chat-recovery";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var retry_dock_module_css_default = {
			"button": "cdYrZq_button",
			"buttons": "cdYrZq_buttons",
			"dock": "cdYrZq_dock",
			"error": "cdYrZq_error",
			"hint": "cdYrZq_hint",
			"row": "cdYrZq_row"
		};
		//#endregion
		//#region src/client/RetryDock.tsx
		/**
		* Composer dock entry: the retry status row (current attempt count, wait
		* state, final failure reason, cancel / retry-now controls). Registered into
		* conversation.input.dock — the full-width row above the composer card.
		*/
		const RetryDockView = (0, react.memo)(function RetryDockView(props) {
			const { session, t, supervisor, manualRetry } = props;
			const state = (0, react.useSyncExternalStore)(supervisor.subscribe, supervisor.getSnapshot);
			const sessionId = session.sessionId;
			if (!(state.phase === "waiting" && (state.targetId ?? state.sourceId) === sessionId || state.phase === "running" && state.targetId === sessionId || (state.phase === "failed" || state.phase === "exhausted") && state.sourceId === sessionId)) return null;
			const cancelButton = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: retry_dock_module_css_default.button,
				onClick: () => supervisor.cancel(),
				children: t("retry.cancel")
			});
			if (state.phase === "waiting") {
				const label = state.kind === "manual" ? t("retry.manualRunning") : t("retry.waiting", {
					attempt: String(state.attempt),
					max: String(state.maxAttempts),
					seconds: String(Math.max(1, Math.round((state.delayMs ?? 0) / 1e3)))
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: retry_dock_module_css_default.dock,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: retry_dock_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: retry_dock_module_css_default.buttons,
							children: [state.kind === "auto" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: retry_dock_module_css_default.button,
								onClick: () => supervisor.retryNow(),
								children: t("retry.retryNow")
							}) : null, cancelButton]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: retry_dock_module_css_default.hint,
						children: t("retry.forkHint")
					})]
				});
			}
			if (state.phase === "running") {
				const label = state.kind === "manual" ? t("retry.manualRunning") : t("retry.running", {
					attempt: String(state.attempt),
					max: String(state.maxAttempts)
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: retry_dock_module_css_default.dock,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: retry_dock_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: retry_dock_module_css_default.buttons,
							children: cancelButton
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: retry_dock_module_css_default.hint,
						children: t("retry.forkHint")
					})]
				});
			}
			const reason = state.reason ?? "";
			const label = state.phase === "exhausted" ? t("retry.exhausted", {
				max: String(state.maxAttempts),
				reason
			}) : t("retry.failed", { reason });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: retry_dock_module_css_default.dock,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: retry_dock_module_css_default.row,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: retry_dock_module_css_default.error,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: retry_dock_module_css_default.buttons,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: retry_dock_module_css_default.button,
							onClick: () => manualRetry(sessionId),
							children: t("retry.manualRetry")
						})
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: retry_dock_module_css_default.hint,
					children: t("retry.forkHint")
				})]
			});
		});
		//#endregion
		//#region src/client/locales.ts
		/**
		* chat-recovery UI copy. The zh dictionary is the key source; the en side
		* must carry the exact same key set (typed against it below).
		*/
		const zh = {
			"edit.button": "编辑",
			"edit.hint": "保存后从此消息之前的位置创建分支并重新生成，原会话历史保留。",
			"edit.cancel": "取消",
			"edit.save": "保存并重新生成",
			"edit.saving": "正在创建分支…",
			"edit.failed": "保存失败：{reason}",
			"retry.button": "重试",
			"retry.cancel": "取消重试",
			"retry.retryNow": "立即重试",
			"retry.waiting": "自动重试 {attempt}/{max}，约 {seconds}s 后",
			"retry.running": "自动重试 {attempt}/{max} 进行中…",
			"retry.manualRunning": "正在重试…",
			"retry.failed": "重试未通过：{reason}",
			"retry.exhausted": "已重试 {max} 次仍失败：{reason}",
			"retry.manualRetry": "手动重试",
			"retry.forkHint": "重试会从失败消息之前创建新的会话分支，后续尝试在该分支内重跑；原会话保持不变，失败的分支会保留在会话列表中。"
		};
		const en = {
			"edit.button": "Edit",
			"edit.hint": "Saving forks a new branch from before this message and regenerates; the original conversation is preserved.",
			"edit.cancel": "Cancel",
			"edit.save": "Save and regenerate",
			"edit.saving": "Creating branch…",
			"edit.failed": "Save failed: {reason}",
			"retry.button": "Retry",
			"retry.cancel": "Cancel retry",
			"retry.retryNow": "Retry now",
			"retry.waiting": "Auto-retry {attempt}/{max} in about {seconds}s",
			"retry.running": "Auto-retry {attempt}/{max} in progress…",
			"retry.manualRunning": "Retrying…",
			"retry.failed": "Retry failed: {reason}",
			"retry.exhausted": "Still failing after {max} retries: {reason}",
			"retry.manualRetry": "Retry manually",
			"retry.forkHint": "Retry forks a new session from before the failed message and keeps retrying inside it; the original stays untouched and failed forks remain in the session list."
		};
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace this plugin owns. */
		const NS = "chat-recovery";
		/** Services required by this plugin. */
		const inject = [
			"slots",
			"locale",
			"sessions",
			"workspaces"
		];
		/**
		* Register the chat-recovery surface and start the retry supervisor.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			if (!claimChatRecoveryApply()) return;
			ctx.effect(() => releaseChatRecoveryApply, "chat-recovery: apply claim");
			ctx.effect(() => {
				try {
					return ctx.locale.register(NS, {
						zh,
						en
					});
				} catch {
					return () => {};
				}
			}, "chat-recovery: dictionaries");
			const sessions = ctx.sessions;
			const workspaces = ctx.workspaces;
			const supervisor = new RetrySupervisor(createRetryPorts(sessions, workspaces));
			const submitEdit = createSubmitEdit(sessions, workspaces);
			const manualRetry = (sessionId) => {
				supervisor.manualRetry(sessionId);
			};
			let watchedId;
			let unsubscribeSession;
			const rewire = () => {
				const current = sessions.list.getSnapshot().current;
				if (current !== watchedId) {
					watchedId = current;
					unsubscribeSession?.();
					unsubscribeSession = void 0;
					if (current !== void 0) {
						const binding = sessions.binding(current);
						if (binding !== void 0) unsubscribeSession = binding.session.subscribe(() => supervisor.review());
					}
				}
				supervisor.review();
			};
			ctx.effect(() => sessions.list.subscribe(rewire), "chat-recovery: watch sessions");
			rewire();
			ctx.effect(() => () => supervisor.dispose(), "chat-recovery: dispose supervisor");
			ctx.slots.inject("conversation.chat.turnTail", () => {
				try {
					return ctx.slots.register({
						name: "conversation.chat.turnTail",
						select: (owner) => owner,
						locale: NS,
						inject: () => ({
							supervisor,
							submitEdit,
							manualRetry
						})
					}, TurnActionsView);
				} catch {
					return () => {};
				}
			});
			ctx.slots.inject("conversation.input.dock", () => {
				try {
					return ctx.slots.register({
						name: "conversation.input.dock",
						id: "chat-recovery",
						order: 500,
						locale: NS,
						inject: () => ({
							supervisor,
							manualRetry
						})
					}, RetryDockView);
				} catch {
					return () => {};
				}
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map