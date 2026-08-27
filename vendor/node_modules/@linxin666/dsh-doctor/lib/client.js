window.__ModuleLoader__.load({
	id: "@linxin666/dsh-doctor",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region src/client/doctor-api.ts
		/** Default fetch seam over the page global. */
		const defaultFetch = async (url, init) => {
			return await globalThis.fetch(url, init ?? {});
		};
		/** Extract a record from an unknown JSON body. */
		function asRecord(value) {
			if (typeof value === "object" && value !== null && !Array.isArray(value)) return value;
		}
		/** Known incident kinds. */
		const INCIDENT_KINDS = /* @__PURE__ */ new Set([
			"boot-failure",
			"process-crash",
			"heartbeat-timeout",
			"http-failure",
			"client-failure",
			"dependency-failure",
			"configuration-failure"
		]);
		/** Known incident phases. */
		const INCIDENT_PHASES = /* @__PURE__ */ new Set([
			"opened",
			"collecting",
			"rescue-starting",
			"rescue-active",
			"diagnosing",
			"plan-ready",
			"repairing",
			"candidate-testing",
			"awaiting-confirmation",
			"promoting",
			"recovered",
			"rolled-back",
			"unresolved"
		]);
		/** Known profile phases. */
		const PROFILE_PHASES = /* @__PURE__ */ new Set([
			"idle",
			"starting",
			"healthy",
			"degraded",
			"stopping",
			"exited",
			"suspected",
			"failed",
			"quarantined"
		]);
		/** Known system phases. */
		const SYSTEM_PHASES = /* @__PURE__ */ new Set([
			"disabled",
			"provisioning",
			"armed",
			"degraded",
			"updating",
			"rolling-back",
			"uninstalling",
			"broken"
		]);
		/** Lenient validation of one incident row; invalid rows are dropped. */
		function parseIncident(value) {
			const record = asRecord(value);
			if (record === void 0) return void 0;
			const id = record["id"];
			const summary = record["summary"];
			const kind = record["kind"];
			const phase = record["phase"];
			if (typeof id !== "string" || id === "" || typeof summary !== "string") return void 0;
			if (typeof kind !== "string" || !INCIDENT_KINDS.has(kind)) return void 0;
			if (typeof phase !== "string" || !INCIDENT_PHASES.has(phase)) return void 0;
			const profileId = record["profileId"];
			const openedAt = record["openedAt"];
			const updatedAt = record["updatedAt"];
			const repairable = record["repairable"];
			const candidateId = record["candidateId"];
			return {
				id,
				summary,
				kind,
				phase,
				profileId: typeof profileId === "string" ? profileId : void 0,
				openedAt: typeof openedAt === "string" ? openedAt : void 0,
				updatedAt: typeof updatedAt === "string" ? updatedAt : void 0,
				repairable: typeof repairable === "boolean" ? repairable : void 0,
				candidateId: typeof candidateId === "string" ? candidateId : void 0
			};
		}
		/** Lenient validation of one profile row; invalid rows are dropped. */
		function parseProfile(value) {
			const record = asRecord(value);
			if (record === void 0) return void 0;
			const identity = asRecord(record["identity"]);
			const phase = record["phase"];
			if (phase !== void 0 && (typeof phase !== "string" || !PROFILE_PHASES.has(phase))) return void 0;
			return {
				identity: identity === void 0 ? void 0 : {
					id: typeof identity["id"] === "string" ? identity["id"] : void 0,
					name: typeof identity["name"] === "string" ? identity["name"] : void 0
				},
				phase,
				pid: typeof record["pid"] === "number" ? record["pid"] : void 0,
				runId: typeof record["runId"] === "string" ? record["runId"] : void 0,
				startedAt: typeof record["startedAt"] === "string" ? record["startedAt"] : void 0,
				lastHealthyAt: typeof record["lastHealthyAt"] === "string" ? record["lastHealthyAt"] : void 0,
				restartCount: typeof record["restartCount"] === "number" ? record["restartCount"] : void 0,
				managed: typeof record["managed"] === "boolean" ? record["managed"] : void 0
			};
		}
		/** Lenient validation of the snapshot object. */
		function parseSnapshot(value) {
			const record = asRecord(value);
			if (record === void 0) return void 0;
			const phase = record["phase"];
			const profilesValue = record["profiles"];
			const incidentsValue = record["incidents"];
			const profiles = Array.isArray(profilesValue) ? profilesValue.map(parseProfile).filter((entry) => entry !== void 0) : void 0;
			const incidents = Array.isArray(incidentsValue) ? incidentsValue.map(parseIncident).filter((entry) => entry !== void 0) : void 0;
			return {
				protocol: typeof record["protocol"] === "number" ? record["protocol"] : void 0,
				phase: phase !== void 0 && (typeof phase !== "string" || !SYSTEM_PHASES.has(phase)) ? void 0 : phase,
				version: typeof record["version"] === "string" ? record["version"] : void 0,
				capsuleVersion: typeof record["capsuleVersion"] === "string" ? record["capsuleVersion"] : void 0,
				profiles,
				incidents,
				updatedAt: typeof record["updatedAt"] === "string" ? record["updatedAt"] : void 0,
				degradedReason: typeof record["degradedReason"] === "string" ? record["degradedReason"] : void 0,
				policy: (() => {
					const policy = asRecord(record["policy"]);
					return policy === void 0 ? void 0 : {
						fullProtection: typeof policy["fullProtection"] === "boolean" ? policy["fullProtection"] : void 0,
						autoRepair: typeof policy["autoRepair"] === "boolean" ? policy["autoRepair"] : void 0
					};
				})()
			};
		}
		/**
		* Validate a SupervisorResponse body. Returns undefined on malformed input;
		* the response keeps its business ok flag so callers can distinguish a
		* supervisor refusal from a transport failure.
		*/
		function parseSupervisorResponse(value) {
			const record = asRecord(value);
			if (record === void 0) return void 0;
			const ok = record["ok"];
			if (typeof ok !== "boolean") return void 0;
			const snapshot = parseSnapshot(record["snapshot"]);
			const error = asRecord(record["error"]);
			const message = error?.["message"];
			const hostVersion = record["hostVersion"];
			return {
				ok,
				snapshot: snapshot === void 0 ? void 0 : snapshot,
				error: error === void 0 ? void 0 : {
					code: typeof error["code"] === "string" ? error["code"] : void 0,
					message: typeof message === "string" ? message : void 0
				},
				hostVersion: typeof hostVersion === "string" ? hostVersion : void 0
			};
		}
		/**
		* Loopback API client. Pass a fetch seam in tests; the browser default calls
		* the page's global fetch with the DOCTOR_API_BASE prefix.
		*/
		var DoctorApi = class {
			fetch;
			base;
			constructor(deps) {
				this.fetch = deps?.fetch ?? defaultFetch;
				this.base = deps?.base ?? "";
			}
			/** GET /api/doctor/status (supervisor snapshot). */
			async status() {
				return await this.request("status", void 0);
			}
			/** POST /api/doctor/action: run a supervisor action by name. */
			async action(name, selection) {
				const body = { action: name };
				if (selection?.profileId !== void 0) body["profileId"] = selection.profileId;
				if (selection?.incidentId !== void 0) body["incidentId"] = selection.incidentId;
				return await this.post("action", body);
			}
			/** POST /api/doctor/client-failure: report a browser-side failure. */
			async reportClientFailure(input) {
				const body = { message: input.message.slice(0, 4096) };
				if (input.stack !== void 0) body["stack"] = input.stack.slice(0, 16384);
				if (input.phase !== void 0) body["phase"] = input.phase.slice(0, 128);
				if (input.runId !== void 0) body["runId"] = input.runId;
				return await this.post("client-failure", body);
			}
			async post(endpoint, body) {
				return await this.request(endpoint, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				});
			}
			async request(endpoint, init) {
				let response;
				try {
					response = await this.fetch(this.base + "/" + endpoint, init);
				} catch (error) {
					return {
						ok: false,
						kind: "network",
						message: safeError(error)
					};
				}
				if (response.status === 403 || response.status === 401 || response.status === 405) return {
					ok: false,
					kind: "loopback",
					status: response.status,
					message: "request refused"
				};
				if (response.status === 404) return {
					ok: false,
					kind: "not-available",
					status: response.status
				};
				if (response.status === 503) return {
					ok: false,
					...await serviceError(response)
				};
				if (!response.ok) return {
					ok: false,
					kind: "http",
					status: response.status,
					message: await bodyError(response)
				};
				let body;
				try {
					body = await response.json();
				} catch {
					return {
						ok: false,
						kind: "not-available",
						status: response.status
					};
				}
				const parsed = parseSupervisorResponse(body);
				if (parsed === void 0) return {
					ok: false,
					kind: "malformed",
					status: response.status
				};
				if (!parsed.ok) {
					const message = parsed.error?.message;
					return {
						ok: false,
						kind: "supervisor",
						status: response.status,
						message: message ?? "supervisor refused"
					};
				}
				return {
					ok: true,
					value: parsed
				};
			}
		};
		/**
		* Classify a 503 service-deployment error. The host half answers 503 with
		* SUPERVISOR_UNPROVISIONED (state missing) or SUPERVISOR_DOWN (state present
		* but the daemon is not answering); anything else degrades to the http kind.
		*/
		async function serviceError(response) {
			try {
				const error = asRecord(asRecord(await response.json())?.["error"]);
				const code = typeof error?.["code"] === "string" ? error["code"] : void 0;
				const message = typeof error?.["message"] === "string" ? error["message"] : void 0;
				return {
					kind: code === "SUPERVISOR_UNPROVISIONED" ? "unprovisioned" : code === "SUPERVISOR_DOWN" ? "supervisor-down" : "http",
					status: response.status,
					message,
					code
				};
			} catch {
				return {
					kind: "http",
					status: response.status
				};
			}
		}
		/** Read an error message from a failed response (never throws). */
		async function bodyError(response) {
			try {
				const record = asRecord(await response.json());
				const message = asRecord(record?.["error"])?.["message"] ?? record?.["error"];
				if (typeof message === "string" && message !== "") return message;
				return "HTTP " + String(response.status);
			} catch {
				return "HTTP " + String(response.status);
			}
		}
		/** Safe one-line error description. */
		function safeError(error) {
			if (error instanceof Error) return error.message || error.name;
			return String(error);
		}
		//#endregion
		//#region src/client/plugin-failures.ts
		/** Failed-plugin ids that were listed but never materialized. */
		function detectFailedPluginIds(modules) {
			if (modules === void 0 || modules === null) return [];
			try {
				const rows = modules.manifest?.plugins;
				if (rows === void 0 || rows.length === 0) return [];
				const cache = modules.loadCache;
				const has = (id) => {
					if (cache === void 0 || typeof cache.has !== "function") return false;
					try {
						return cache.has(id) === true;
					} catch {
						return false;
					}
				};
				const failed = [];
				const seen = /* @__PURE__ */ new Set();
				for (const row of rows) {
					if (typeof row?.id !== "string" || row.id === "") continue;
					if (seen.has(row.id)) continue;
					seen.add(row.id);
					if (!has(row.id)) failed.push(row.id);
				}
				return failed;
			} catch {
				return [];
			}
		}
		//#endregion
		//#region src/client/doctor-controller.ts
		/**
		* Browser-half state controller for the dsh-doctor recovery console.
		*
		* Owns one immutable snapshot (a small external store for useSyncExternalStore),
		* the refresh/action/report verbs over the loopback API, the passive probe
		* merge, and the poll loop. Resilience contract: every public method resolves
		* or no-ops, never throws; the host being absent, a fetch failure or a broken
		* response only degrades the snapshot.
		* @module @linxin666/dsh-doctor/client
		*/
		/** Initial (pre-connect) snapshot. */
		function initialDoctorView() {
			return {
				phase: "idle",
				host: "unknown",
				snapshot: void 0,
				profiles: [],
				incidents: [],
				probe: [],
				pluginFailures: [],
				bootSignals: [],
				lastCheckedAt: void 0,
				lastError: void 0,
				lastErrorCode: void 0,
				hostVersion: void 0,
				actionRunning: false,
				action: void 0
			};
		}
		/** Minimal external store: immutable snapshots, never-throwing notify. */
		var DoctorStore = class {
			view = initialDoctorView();
			listeners = /* @__PURE__ */ new Set();
			getSnapshot() {
				return this.view;
			}
			subscribe(listener) {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
			set(patch) {
				this.view = {
					...this.view,
					...patch
				};
				for (const listener of [...this.listeners]) try {
					listener();
				} catch {}
			}
		};
		/** The default timer pair over the page globals (guarded for non-browser use). */
		const defaultTimers = {
			set: (callback, ms) => setTimeout(callback, ms),
			clear: (handle) => {
				clearTimeout(handle);
			}
		};
		/** One-line summary of an API failure (never throws). */
		function describeApiFailure(failure) {
			if (failure.kind !== "unprovisioned" && failure.kind !== "supervisor-down" && failure.message !== void 0 && failure.message !== "") return failure.message;
			switch (failure.kind) {
				case "network": return "network error";
				case "loopback": return "loopback only";
				case "not-available": return "endpoint unavailable";
				case "malformed": return "malformed response";
				case "http": return "HTTP " + String(failure.status ?? "");
				case "supervisor": return "supervisor refused";
				case "unprovisioned": return "supervisor service not provisioned";
				case "supervisor-down": return "supervisor service not answering";
			}
		}
		/**
		* Owns the console snapshot and its refresh loop. Construct with a PassiveProbe
		* whose notify callback routes to syncProbe; start() kicks the poll loop and
		* the visibility guard; dispose() stops everything.
		*/
		var DoctorController = class {
			/** Read-only external store face. */
			store;
			/** Bound subscribe for useSyncExternalStore. */
			subscribe;
			/** Bound snapshot for useSyncExternalStore. */
			getSnapshot;
			api;
			passive;
			intervalMs;
			now;
			timers;
			modules;
			harness;
			pluginRepair;
			failureGraceMs;
			/** Plugin ids seen missing so far; a steady config lets failures be confirmed across a poll. */
			pendingPluginFailures = /* @__PURE__ */ new Map();
			/** Plugin ids already recorded as startup failures. */
			recordedPluginFailures = /* @__PURE__ */ new Set();
			timer;
			visibilityListener;
			disposed = false;
			constructor(options) {
				this.store = new DoctorStore();
				this.subscribe = (listener) => this.store.subscribe(listener);
				this.getSnapshot = () => this.store.getSnapshot();
				this.api = options.api ?? new DoctorApi();
				this.passive = options.passive;
				this.intervalMs = options.intervalMs ?? 15e3;
				this.now = options.now ?? (() => Date.now());
				this.timers = options.timers ?? defaultTimers;
				this.modules = options.modules;
				this.harness = options.harness;
				this.pluginRepair = options.pluginRepair;
				this.failureGraceMs = options.failureGraceMs ?? 8e3;
			}
			/** Merge the passive probe's current ring into the snapshot. */
			syncProbe() {
				try {
					this.store.set({ probe: this.passive.snapshot() });
				} catch {}
			}
			/**
			* Reconcile the boot graph against the module registry and record plugins
			* that were enabled but never started. A plugin must stay missing across the
			* grace window before it is recorded, so entries that materialize slightly
			* after this console's own apply are never misreported.
			*/
			scanPluginFailures() {
				try {
					const missing = detectFailedPluginIds(this.modules);
					if (missing.length === 0) {
						this.pendingPluginFailures.clear();
						return;
					}
					const nowMs = this.now();
					const missingSet = new Set(missing);
					for (const id of missing) {
						if (this.recordedPluginFailures.has(id) || this.pendingPluginFailures.has(id)) continue;
						this.pendingPluginFailures.set(id, nowMs);
					}
					for (const [id, seenAt] of [...this.pendingPluginFailures]) if (missingSet.has(id)) {
						if (nowMs - seenAt < this.failureGraceMs) continue;
						this.recordedPluginFailures.add(id);
						this.pendingPluginFailures.delete(id);
						this.passive.recordPluginStartupFailure(id);
					} else this.pendingPluginFailures.delete(id);
					this.syncProbe();
				} catch {}
			}
			/** Record a plugin startup failure observed by an external signal (loader event). */
			notePluginStartupFailure(pluginId) {
				try {
					const id = typeof pluginId === "string" ? pluginId.trim() : "";
					if (id === "") return;
					if (this.recordedPluginFailures.has(id)) return;
					this.recordedPluginFailures.add(id);
					this.passive.recordPluginStartupFailure(id);
					this.syncProbe();
				} catch {}
			}
			/** Resolve the current session the console would send into. */
			harnessTarget() {
				try {
					return this.harness?.current();
				} catch {
					return;
				}
			}
			/** Refresh the plugin-manager failure ring (best effort). */
			async refreshPluginFailures() {
				if (this.disposed) return;
				try {
					const items = await this.pluginRepair?.failures();
					if (this.disposed) return;
					this.store.set({ pluginFailures: items ?? [] });
				} catch {}
			}
			/**
			* Disable one failed plugin for the next host restart through the
			* plugin-manager port.
			*/
			async disablePlugin(pluginId) {
				const id = typeof pluginId === "string" ? pluginId.trim() : "";
				if (id === "") {
					this.store.set({ action: {
						ok: false,
						message: "empty plugin id"
					} });
					return {
						ok: false,
						message: "empty plugin id"
					};
				}
				const port = this.pluginRepair;
				if (port === void 0) {
					this.store.set({ action: {
						ok: false,
						message: "plugin manager unavailable"
					} });
					return {
						ok: false,
						message: "plugin manager unavailable"
					};
				}
				if (this.disposed) return {
					ok: false,
					message: "disposed"
				};
				this.store.set({
					actionRunning: true,
					action: void 0
				});
				let outcome;
				let result;
				try {
					const disabled = await port.disable(id);
					result = disabled.ok ? { ok: true } : {
						ok: false,
						message: disabled.message
					};
					outcome = disabled.ok ? {
						ok: true,
						kind: "disabled",
						id
					} : {
						ok: false,
						message: disabled.message
					};
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					result = {
						ok: false,
						message
					};
					outcome = {
						ok: false,
						message
					};
				}
				if (this.disposed) return result;
				this.store.set({
					actionRunning: false,
					action: outcome
				});
				return result;
			}
			/**
			* Queue the composed prompt into the current session; the outcome lands in
			* the snapshot's action line ('sent' on success).
			*/
			async sendToHarness(text) {
				const trimmed = typeof text === "string" ? text.trim() : "";
				if (trimmed === "") {
					this.store.set({ action: {
						ok: false,
						message: "empty prompt"
					} });
					return {
						ok: false,
						message: "empty prompt"
					};
				}
				const port = this.harness;
				const target = port?.current();
				if (port === void 0 || target === void 0) {
					const message = "no current session";
					this.store.set({ action: {
						ok: false,
						message
					} });
					return {
						ok: false,
						message
					};
				}
				if (this.disposed) return {
					ok: false,
					message: "disposed"
				};
				this.store.set({
					actionRunning: true,
					action: void 0
				});
				let outcome;
				let result;
				try {
					const sent = await port.send(target, trimmed);
					result = sent.ok ? { ok: true } : {
						ok: false,
						message: sent.message
					};
					outcome = sent.ok ? {
						ok: true,
						kind: "sent"
					} : {
						ok: false,
						message: sent.message
					};
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					result = {
						ok: false,
						message
					};
					outcome = {
						ok: false,
						message
					};
				}
				if (this.disposed) return result;
				this.store.set({
					actionRunning: false,
					action: outcome
				});
				return result;
			}
			/** One refresh cycle: the supervisor snapshot over the loopback API. */
			async refresh() {
				this.scanPluginFailures();
				this.refreshPluginFailures();
				if (this.disposed) return;
				const previous = this.store.getSnapshot();
				if (previous.host === "unknown") this.store.set({ phase: "loading" });
				let result;
				try {
					result = await this.api.status();
				} catch {
					result = {
						ok: false,
						kind: "network"
					};
				}
				if (this.disposed) return;
				if (result.ok) {
					const snapshot = result.value.snapshot;
					this.store.set({
						phase: "ready",
						host: "available",
						snapshot,
						profiles: snapshot?.profiles ?? previous.profiles,
						incidents: snapshot?.incidents ?? previous.incidents,
						lastCheckedAt: this.now(),
						lastError: void 0,
						lastErrorCode: void 0,
						hostVersion: result.value.hostVersion
					});
				} else this.store.set({
					phase: "ready",
					host: "unavailable",
					lastError: describeApiFailure(result),
					lastErrorCode: result.code,
					hostVersion: void 0
				});
			}
			/** Run the diagnose action and merge the resulting snapshot. */
			async runDiagnose() {
				await this.invokeAction("diagnose");
			}
			/** One-click lifecycle install/repair: deploy the service and refresh the capsule. */
			async runProvision() {
				await this.invokeAction("provision");
			}
			/** Remove the user-level supervisor service (state data is kept). */
			async runUninstall() {
				await this.invokeAction("uninstall");
			}
			/** Run the repair action against the first repairable incident. */
			async runRepair() {
				const incident = this.firstRepairableIncident();
				if (incident === void 0) {
					this.store.set({ action: {
						ok: false,
						message: "no repairable incident"
					} });
					return;
				}
				await this.invokeAction("repair", {
					incidentId: incident.id,
					profileId: incident.profileId
				});
			}
			/** Confirm the first isolated candidate waiting for promotion. */
			async runConfirm() {
				const incident = this.store.getSnapshot().incidents.find((item) => item.phase === "awaiting-confirmation" && item.candidateId !== void 0);
				if (incident === void 0) {
					this.store.set({ action: {
						ok: false,
						message: "no candidate awaiting confirmation"
					} });
					return;
				}
				await this.invokeAction("confirm", {
					incidentId: incident.id,
					profileId: incident.profileId
				});
			}
			/** Report the newest passive incident to the supervisor (best effort). */
			async reportProbe() {
				const incident = this.store.getSnapshot().probe[this.store.getSnapshot().probe.length - 1];
				if (incident === void 0) {
					this.store.set({ action: {
						ok: false,
						message: "probe list empty"
					} });
					return;
				}
				if (this.disposed) return;
				this.store.set({
					actionRunning: true,
					action: void 0
				});
				let outcome;
				try {
					const result = await this.api.reportClientFailure({
						message: incident.message,
						stack: incident.detail,
						phase: "recovery-console:" + incident.kind
					});
					outcome = result.ok ? {
						ok: true,
						kind: "reported"
					} : {
						ok: false,
						message: describeApiFailure(result)
					};
				} catch {
					outcome = {
						ok: false,
						message: "report failed"
					};
				}
				if (this.disposed) return;
				this.store.set({
					actionRunning: false,
					action: outcome
				});
			}
			/** Clear the passive probe ring (local only). */
			clearProbe() {
				try {
					this.passive.clear();
					this.store.set({ probe: [] });
				} catch {}
			}
			/** Report a React boundary catch into the probe list. */
			recordBoundary(error) {
				try {
					const text = error instanceof Error ? error.message || error.name : String(error);
					this.passive.record("react-boundary", text, error instanceof Error ? error.message ?? "" : void 0);
					this.syncProbe();
				} catch {}
			}
			/** Record a boot/reconnect signal and trigger a refresh. */
			noteConnectionReset() {
				try {
					const at = this.now();
					this.passive.record("connection-reset", "connection/reset event observed");
					this.syncProbe();
					const ring = [...this.store.getSnapshot().bootSignals, {
						kind: "connection-reset",
						at
					}];
					this.store.set({ bootSignals: ring.slice(-8) });
					this.refresh();
				} catch {}
			}
			/** First incident that is repairable and not already settled. */
			firstRepairableIncident() {
				return this.store.getSnapshot().incidents.find((incident) => incident.repairable === true && incident.phase !== "recovered" && incident.phase !== "rolled-back" && incident.phase !== "unresolved");
			}
			async invokeAction(name, selection) {
				if (this.disposed) return;
				if (this.store.getSnapshot().actionRunning) return;
				this.store.set({
					actionRunning: true,
					action: void 0
				});
				let outcome;
				try {
					const result = await this.api.action(name, selection);
					if (result.ok) {
						const snapshot = result.value.snapshot;
						this.store.set({
							snapshot,
							profiles: snapshot?.profiles ?? this.store.getSnapshot().profiles,
							incidents: snapshot?.incidents ?? this.store.getSnapshot().incidents,
							lastCheckedAt: this.now(),
							hostVersion: result.value.hostVersion,
							...result.value.hostVersion !== void 0 ? { lastErrorCode: void 0 } : {}
						});
						outcome = {
							ok: true,
							kind: "completed"
						};
					} else outcome = {
						ok: false,
						message: describeApiFailure(result)
					};
				} catch {
					outcome = {
						ok: false,
						message: "action failed"
					};
				}
				if (this.disposed) return;
				this.store.set({
					actionRunning: false,
					action: outcome
				});
			}
			/**
			* Start the poll loop plus the visibility guard. Polling pauses while the
			* tab is hidden. Returns the disposer.
			*/
			start() {
				this.refresh();
				const tick = () => {
					this.refresh();
				};
				this.timer = this.timers.set(tick, this.intervalMs);
				let visibilityListener;
				try {
					if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
						const onVisibility = () => {
							try {
								if (document.visibilityState === "visible") {
									this.refresh();
									if (this.timer === void 0) this.timer = this.timers.set(tick, this.intervalMs);
								} else if (this.timer !== void 0) {
									this.timers.clear(this.timer);
									this.timer = void 0;
								}
							} catch {}
						};
						document.addEventListener("visibilitychange", onVisibility);
						visibilityListener = onVisibility;
					}
				} catch {}
				this.visibilityListener = visibilityListener;
				return () => this.dispose();
			}
			/** Stop the poll loop; the passive probe keeps its ring but listeners stay. */
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				if (this.timer !== void 0) {
					try {
						this.timers.clear(this.timer);
					} catch {}
					this.timer = void 0;
				}
				if (this.visibilityListener !== void 0) {
					try {
						if (typeof document !== "undefined" && typeof document.removeEventListener === "function") document.removeEventListener("visibilitychange", this.visibilityListener);
					} catch {}
					this.visibilityListener = void 0;
				}
			}
		};
		//#endregion
		//#region src/client/harness-send.ts
		/**
		* Build the real port over ctx.sessions. Returns undefined when no sessions
		* service is provided (the console then degrades the send affordance).
		* @param sessions - the raw ctx.sessions value (unknown by design: the port
		*   is optional and must never make apply fail).
		*/
		function createHarnessPort(sessions) {
			if (sessions === void 0 || sessions === null) return void 0;
			const s = sessions;
			return {
				current: () => {
					try {
						const list = s.list?.getSnapshot?.();
						const id = list?.current;
						if (id === void 0) return void 0;
						return {
							id,
							label: (list?.byId?.[id])?.displayTitle ?? id
						};
					} catch {
						return;
					}
				},
				send: async (target, text) => {
					try {
						const binding = s.binding(target.id);
						if (binding === void 0) return {
							ok: false,
							message: "target session is not available"
						};
						const result = await binding.session.prompt([{
							type: "text",
							text
						}], "queue");
						if (result.ok) return { ok: true };
						return {
							ok: false,
							message: result.error.code + ": " + result.error.message
						};
					} catch (error) {
						return {
							ok: false,
							message: error instanceof Error ? error.message : String(error)
						};
					}
				}
			};
		}
		/** Compose the troubleshooting prompt text (never throws). */
		function composeHarnessPrompt(failure, env, lines) {
			try {
				const parts = [lines.title];
				parts.push("");
				parts.push("## " + lines.summary);
				parts.push(failure.summary !== "" ? failure.summary : "-");
				if (failure.kind !== void 0 && failure.kind !== "") parts.push(lines.kind + ": " + failure.kind);
				if (failure.stack !== void 0 && failure.stack.trim() !== "") {
					parts.push("");
					parts.push("## " + lines.stack);
					parts.push(failure.stack);
				}
				const envFacts = [];
				if (env.webVersion !== void 0 && env.webVersion !== "") envFacts.push("Doctor Web " + env.webVersion);
				if (env.supervisorVersion !== void 0 && env.supervisorVersion !== "") envFacts.push("Supervisor " + env.supervisorVersion);
				if (failure.at !== void 0 && Number.isFinite(failure.at)) envFacts.push(new Date(failure.at).toISOString());
				if (envFacts.length > 0) {
					parts.push("");
					parts.push("## " + lines.environment);
					parts.push(envFacts.join(" / "));
				}
				return parts.join("\n");
			} catch {
				return lines.title;
			}
		}
		//#endregion
		//#region src/client/plugin-repair.ts
		/**
		* Build the port over the raw `ctx.get('pluginManager')` value. Returns
		* undefined when the service is absent.
		* @param pluginManager - the raw service value (unknown by design).
		*/
		function createPluginRepairPort(pluginManager) {
			if (pluginManager === void 0 || pluginManager === null) return void 0;
			const service = pluginManager;
			if (typeof service.failures !== "function" || typeof service.setEnabled !== "function") return void 0;
			return {
				failures: async () => {
					try {
						const items = (await service.failures?.())?.items ?? [];
						const out = [];
						for (const item of items) {
							const pluginId = typeof item?.pluginId === "string" ? item.pluginId : "";
							if (pluginId === "") continue;
							out.push({
								pluginId,
								message: typeof item.message === "string" ? item.message : "",
								stack: typeof item.stack === "string" ? item.stack : void 0
							});
						}
						return out;
					} catch {
						return [];
					}
				},
				disable: async (pluginId) => {
					try {
						await service.setEnabled?.(pluginId, false);
						return { ok: true };
					} catch (error) {
						return {
							ok: false,
							message: error instanceof Error ? error.message : String(error)
						};
					}
				}
			};
		}
		//#endregion
		//#region src/client/doctor-passive.ts
		/** Max detail length kept per incident. */
		const MAX_DETAIL_CHARS = 800;
		/** Max message length kept per incident. */
		const MAX_MESSAGE_CHARS = 300;
		/** Skip an exact repeat of the last incident within this window (ms). */
		const DEDUPE_WINDOW_MS = 2e3;
		/** Cap a string, appending an ellipsis when truncated. */
		function capText(text, limit) {
			if (text.length <= limit) return text;
			return text.slice(0, limit) + "...";
		}
		/** Produce a safe, plain-text description of an unknown error value. */
		function safeDescribe(value) {
			if (value === void 0) return "undefined";
			if (value === null) return "null";
			if (typeof value === "string") return capText(value, MAX_DETAIL_CHARS);
			if (typeof value !== "object") return String(value);
			if (value instanceof Error) {
				const name = value.name || "Error";
				const message = capText(value.message ?? "", MAX_MESSAGE_CHARS);
				const stack = typeof value.stack === "string" ? capText(value.stack, MAX_DETAIL_CHARS) : "";
				return name + ": " + message + (stack !== "" ? "\n" + stack : "");
			}
			try {
				const seen = /* @__PURE__ */ new Set();
				return capText(JSON.stringify(value, (_key, inner) => {
					if (typeof inner === "object" && inner !== null) {
						if (seen.has(inner)) return "[circular]";
						seen.add(inner);
						if (Array.isArray(inner) && inner.length > 20) return inner.slice(0, 20).concat("[...]");
					}
					return inner;
				}) ?? String(value), MAX_DETAIL_CHARS);
			} catch {
				return capText(String(value), MAX_DETAIL_CHARS);
			}
		}
		/** Normalize one window error event into incident fields (never throws). */
		function normalizeWindowError(event) {
			if (typeof event === "object" && event !== null && "message" in event) {
				const like = event;
				const message = safeDescribe(like.message ?? like.error ?? "unknown window error");
				const source = typeof like.filename === "string" && like.filename !== "" ? like.filename : void 0;
				const line = typeof like.lineno === "number" && Number.isFinite(like.lineno) ? Math.trunc(like.lineno) : void 0;
				const column = typeof like.colno === "number" && Number.isFinite(like.colno) ? Math.trunc(like.colno) : void 0;
				const detail = like.error === void 0 ? void 0 : safeDescribe(like.error);
				return {
					message: capText(message, MAX_MESSAGE_CHARS),
					source,
					line,
					column,
					detail
				};
			}
			return { message: capText(safeDescribe(event), MAX_MESSAGE_CHARS) };
		}
		/** Normalize one unhandledrejection event into incident fields (never throws). */
		function normalizeRejection(event) {
			if (typeof event === "object" && event !== null && "reason" in event) {
				const reason = event.reason;
				return {
					message: capText(safeDescribe(reason), MAX_MESSAGE_CHARS),
					detail: reason instanceof Error ? safeDescribe(reason) : void 0
				};
			}
			return { message: capText(safeDescribe(event), MAX_MESSAGE_CHARS) };
		}
		/**
		* Bounded, non-throwing capture of window failure events plus the app-level
		* signal sink. Start once per page; stop on plugin teardown.
		*/
		var PassiveProbe = class {
			notify;
			max;
			now;
			incidents = [];
			sequence = 0;
			started = false;
			onError = (event) => {
				try {
					this.push("window-error", normalizeWindowError(event));
				} catch {}
			};
			onRejection = (event) => {
				try {
					this.push("unhandled-rejection", normalizeRejection(event));
				} catch {}
			};
			constructor(options) {
				this.notify = options.notify;
				this.max = options.max ?? 50;
				this.now = options.now ?? (() => Date.now());
			}
			/** Install window listeners (no-op outside a browser window). */
			start() {
				if (this.started) return;
				try {
					if (typeof window === "undefined") return;
					window.addEventListener("error", this.onError);
					window.addEventListener("unhandledrejection", this.onRejection);
					this.started = true;
				} catch {
					this.started = false;
				}
			}
			/** Remove window listeners and stop capturing raw window events. */
			stop() {
				if (!this.started) return;
				try {
					if (typeof window !== "undefined") {
						window.removeEventListener("error", this.onError);
						window.removeEventListener("unhandledrejection", this.onRejection);
					}
				} catch {}
				this.started = false;
			}
			/** Current snapshot (copy; never throws). */
			snapshot() {
				return [...this.incidents];
			}
			/** Clear the ring and notify an empty batch. */
			clear() {
				this.incidents.length = 0;
				try {
					this.notify([]);
				} catch {}
			}
			/** Record an app-level signal (boundary catch or connection rebuild). */
			record(kind, message, detail) {
				try {
					this.push(kind, {
						message,
						detail
					});
				} catch {}
			}
			/** Record a Web UI plugin that was listed in the boot graph but never started. */
			recordPluginStartupFailure(pluginId, detail) {
				try {
					const id = typeof pluginId === "string" ? pluginId.trim() : "";
					if (id === "") return;
					this.push("plugin-startup-failure", {
						message: "plugin failed to start: " + id,
						detail
					});
				} catch {}
			}
			push(kind, fields) {
				const at = this.now();
				const last = this.incidents[this.incidents.length - 1];
				if (last !== void 0 && last.kind === kind && last.message === fields.message && last.source === fields.source && last.line === fields.line && at - last.at <= DEDUPE_WINDOW_MS && at >= last.at) return;
				const incident = {
					id: "probe-" + String(++this.sequence),
					kind,
					message: fields.message,
					source: fields.source,
					line: fields.line,
					column: fields.column,
					detail: fields.detail,
					at
				};
				this.incidents.push(incident);
				if (this.incidents.length > this.max) this.incidents.splice(0, this.incidents.length - this.max);
				try {
					this.notify([incident]);
				} catch {}
			}
		};
		//#endregion
		//#region \0dsh-css:packages/dsh-doctor/src/client/settings-card.module.css.mjs
		const css$1 = ".VadyJG_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.VadyJG_card:hover{border-color:var(--dsw-alias-label-dimmed)}.VadyJG_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.VadyJG_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.VadyJG_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.VadyJG_headerStatic{border-radius:12px;align-items:center;gap:12px;width:100%;padding:14px 16px;display:flex}.VadyJG_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.VadyJG_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.VadyJG_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.VadyJG_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.VadyJG_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.VadyJG_chevronOpen{transform:rotate(180deg)}.VadyJG_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.VadyJG_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}.VadyJG_notExposed{color:var(--dsw-alias-state-warn-primary);margin:12px 0 0;font-size:12px;line-height:1.5}.VadyJG_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.VadyJG_failed{min-width:0;color:var(--dsw-alias-label-error);text-overflow:ellipsis;white-space:nowrap;flex:1;margin:0;font-size:12px;line-height:1.5;overflow:hidden}.VadyJG_discard,.VadyJG_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.VadyJG_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.VadyJG_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.VadyJG_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.VadyJG_discard:disabled,.VadyJG_save:disabled{opacity:.4;cursor:default}.VadyJG_discard:focus-visible,.VadyJG_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.VadyJG_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.VadyJG_field+.VadyJG_field{border-top:1px solid var(--dsw-alias-border-l2)}.VadyJG_head{align-items:center;gap:8px;display:flex}.VadyJG_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.VadyJG_badges{align-items:center;gap:8px;display:inline-flex}.VadyJG_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.VadyJG_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.VadyJG_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.VadyJG_reset:disabled{cursor:default}.VadyJG_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.VadyJG_input,.VadyJG_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.VadyJG_input:focus-visible,.VadyJG_select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.VadyJG_input:disabled,.VadyJG_select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.VadyJG_inputInvalid{border:1px solid var(--dsw-alias-label-error);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.VadyJG_inputInvalid:focus-visible{outline:2px solid var(--dsw-alias-label-error);outline-offset:1px;border-color:var(--dsw-alias-label-error)}.VadyJG_selectWrap{position:relative}.VadyJG_selectButton{appearance:none;text-align:left;cursor:pointer;justify-content:space-between;align-items:center;gap:8px;width:100%;display:flex}.VadyJG_selectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.VadyJG_selectChevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.VadyJG_selectChevronOpen{transform:rotate(180deg)}.VadyJG_selectPopup{z-index:40;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);max-height:240px;box-shadow:0 8px 24px var(--dsw-alias-bg-mask-2);opacity:0;border-radius:8px;flex-direction:column;padding:4px;transition:opacity .1s,transform .1s;display:flex;position:absolute;top:calc(100% + 4px);left:0;right:0;overflow-y:auto;transform:translateY(-4px)}.VadyJG_selectPopupOpen{opacity:1;transform:none}.VadyJG_selectPopupClose{opacity:0;pointer-events:none;transform:translateY(-4px)}.VadyJG_selectOption{color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;text-overflow:ellipsis;border-radius:6px;flex-shrink:0;padding:6px 10px;font-size:13px;line-height:1.5;overflow:hidden}.VadyJG_selectOption:hover,.VadyJG_selectOptionActive{background:var(--dsw-alias-interactive-bg-hover)}.VadyJG_selectOptionSelected{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 10%, transparent);font-weight:500}.VadyJG_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.VadyJG_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}@media (prefers-reduced-motion:reduce){.VadyJG_card,.VadyJG_header,.VadyJG_chevron,.VadyJG_chevronOpen,.VadyJG_discard,.VadyJG_save,.VadyJG_selectChevron,.VadyJG_selectChevronOpen,.VadyJG_selectPopup{transition:none}}";
		const tagId$1 = "@linxin666/dsh-doctor/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-doctor";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"badge": "VadyJG_badge",
			"badges": "VadyJG_badges",
			"body": "VadyJG_body",
			"card": "VadyJG_card",
			"cardOpen": "VadyJG_cardOpen",
			"chevron": "VadyJG_chevron",
			"chevronOpen": "VadyJG_chevronOpen",
			"description": "VadyJG_description",
			"discard": "VadyJG_discard",
			"failed": "VadyJG_failed",
			"field": "VadyJG_field",
			"footer": "VadyJG_footer",
			"head": "VadyJG_head",
			"headText": "VadyJG_headText",
			"header": "VadyJG_header",
			"headerStatic": "VadyJG_headerStatic",
			"hint": "VadyJG_hint",
			"input": "VadyJG_input",
			"inputInvalid": "VadyJG_inputInvalid",
			"invalid": "VadyJG_invalid",
			"label": "VadyJG_label",
			"name": "VadyJG_name",
			"notExposed": "VadyJG_notExposed",
			"pending": "VadyJG_pending",
			"readOnly": "VadyJG_readOnly",
			"reset": "VadyJG_reset",
			"save": "VadyJG_save",
			"select": "VadyJG_select",
			"selectButton": "VadyJG_selectButton",
			"selectChevron": "VadyJG_selectChevron",
			"selectChevronOpen": "VadyJG_selectChevronOpen",
			"selectLabel": "VadyJG_selectLabel",
			"selectOption": "VadyJG_selectOption",
			"selectOptionActive": "VadyJG_selectOptionActive",
			"selectOptionSelected": "VadyJG_selectOptionSelected",
			"selectPopup": "VadyJG_selectPopup",
			"selectPopupClose": "VadyJG_selectPopupClose",
			"selectPopupOpen": "VadyJG_selectPopupOpen",
			"selectWrap": "VadyJG_selectWrap"
		};
		//#endregion
		//#region src/client/PluginSettingsCard.tsx
		/**
		* Family-shared chrome for plugin settings cards: a disclosure header naming
		* the plugin and what its settings govern, the controls inside, and the save
		* that writes them. Renders nothing while the namespace is unavailable — a
		* deployment that does not compose the owning plugin should show no trace of
		* it. Inlined into each consumer's client bundle; mirrors the official
		* ui-plugin-config PluginCard in a self-contained slice.
		*/
		/**
		* Render one plugin settings card.
		* @param props - the plugin's copy keys, its form state, and its controls.
		* @returns the card, or nothing while the namespace is still loading.
		*/
		function PluginSettingsCard(props) {
			const [open, setOpen] = (0, react.useState)(props.defaultOpen ?? true);
			const { state, alwaysOpen } = props;
			if (!state.available) return null;
			const title = props.t(props.titleKey);
			const description = props.t(props.descriptionKey);
			const blocked = !state.dirty || state.invalid || state.saving;
			const expanded = alwaysOpen === true || open;
			const cardClass = expanded ? `${settings_card_module_css_default.cardOpen} ${settings_card_module_css_default.card}` : settings_card_module_css_default.card;
			const header = alwaysOpen === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.headerStatic,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: settings_card_module_css_default.headText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.name,
						title,
						children: title
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.description,
						title: description,
						children: description
					})]
				}), state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: settings_card_module_css_default.pending,
					title: props.t("settings.unsaved"),
					children: props.t("settings.unsaved")
				}) : null]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: settings_card_module_css_default.header,
				"aria-expanded": open,
				"aria-label": `${props.t(open ? "settings.collapse" : "settings.expand")}: ${title}`,
				onClick: () => {
					setOpen(!open);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: settings_card_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.name,
							title,
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.description,
							title: description,
							children: description
						})]
					}),
					state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.pending,
						title: props.t("settings.unsaved"),
						children: props.t("settings.unsaved")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.chevron} ${settings_card_module_css_default.chevronOpen}` : settings_card_module_css_default.chevron,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})
				]
			});
			if (!state.exposed) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.body,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.notExposed,
						role: "status",
						children: props.t("settings.notExposed")
					})
				}) : null]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_card_module_css_default.readOnly,
							role: "status",
							children: props.t("settings.readOnly")
						}) : null,
						props.children,
						props.hideFooter === true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.footer,
							children: [
								state.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: settings_card_module_css_default.failed,
									role: "status",
									children: [props.t("settings.saveFailed"), state.failedReason ? " - " + state.failedReason : ""]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.discard,
									disabled: !state.dirty || state.saving,
									onClick: props.onDiscard,
									children: props.t("settings.discard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.save,
									disabled: blocked,
									onClick: props.onSave,
									children: props.t(!state.saving ? "settings.save" : "settings.saving")
								})
							]
						})
					]
				}) : null]
			});
		}
		const NON_SKIN_BODY_MARKERS = /* @__PURE__ */ new Set(["dshSkinCenter", "dshSidebarCollapsed"]);
		function isSkinActive() {
			return Object.keys(document.body.dataset).some((key) => key.startsWith("dsh") && !NON_SKIN_BODY_MARKERS.has(key));
		}
		const SELECT_CLOSE_MS = 100;
		/**
		* The shared dual-mode select control. While an appearance skin is active it
		* renders the legacy native `<select>` untouched, so element-level skin
		* selectors keep working; under the default appearance it renders a
		* self-drawn `role="listbox"` popup whose open/close is transition-animated.
		* Staged cards reach it through BooleanField/ChoiceField; immediate-apply
		* editors (the side-card prefs) bind it directly through onEdit.
		* 双模式下拉框：皮肤激活时用原生 select，默认外观用自绘动画弹层。
		*/
		function SelectField(props) {
			const { id, options, value } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const [closing, setClosing] = (0, react.useState)(false);
			const [phase, setPhase] = (0, react.useState)("initial");
			const [activeIndex, setActiveIndex] = (0, react.useState)(0);
			const closeTimer = (0, react.useRef)(void 0);
			const wrapRef = (0, react.useRef)(null);
			const popupRef = (0, react.useRef)(null);
			const currentIndex = () => {
				const index = options.findIndex((option) => option.value === value);
				return index >= 0 ? index : 0;
			};
			const close = (0, react.useCallback)(() => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setClosing(true);
				closeTimer.current = setTimeout(() => {
					setClosing(false);
					setOpen(false);
				}, SELECT_CLOSE_MS);
			}, []);
			const openPopup = () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setActiveIndex(currentIndex());
				setPhase("initial");
				setClosing(false);
				setOpen(true);
			};
			const commit = (index) => {
				const option = options[index];
				if (option) props.onEdit(option.value);
				close();
			};
			const onTriggerClick = () => {
				if (props.disabled) return;
				if (open && !closing) close();
				else openPopup();
			};
			const onKeyDown = (event) => {
				if (props.disabled) return;
				const count = options.length;
				switch (event.key) {
					case "ArrowDown":
					case "ArrowUp":
					case "Enter":
					case " ":
						event.preventDefault();
						if (!open) openPopup();
						else if (!closing) if (event.key === "ArrowDown") setActiveIndex((index) => (index + 1) % count);
						else if (event.key === "ArrowUp") setActiveIndex((index) => (index - 1 + count) % count);
						else commit(activeIndex);
						break;
					case "Escape":
						if (open) {
							event.preventDefault();
							event.stopPropagation();
							close();
						}
						break;
					case "Tab":
						if (open) close();
						break;
				}
			};
			(0, react.useEffect)(() => () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
			}, []);
			(0, react.useLayoutEffect)(() => {
				if (open && !closing && phase === "initial") {
					popupRef.current?.offsetHeight;
					setPhase("open");
				}
			}, [
				open,
				closing,
				phase
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onPointerDown = (event) => {
					const target = event.target;
					if (target instanceof Node && !wrapRef.current?.contains(target)) close();
				};
				document.addEventListener("pointerdown", onPointerDown);
				return () => document.removeEventListener("pointerdown", onPointerDown);
			}, [open, close]);
			(0, react.useEffect)(() => {
				if (props.disabled && open) close();
			}, [
				props.disabled,
				open,
				close
			]);
			if (isSkinActive()) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
				id,
				className: settings_card_module_css_default.select,
				value,
				disabled: props.disabled,
				onChange: (event) => {
					props.onEdit(event.target.value);
				},
				children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: option.value,
					children: option.label
				}, option.value))
			});
			const label = options.find((option) => option.value === value)?.label ?? "";
			const popupClass = closing ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupClose}` : phase === "open" ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupOpen}` : settings_card_module_css_default.selectPopup;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.selectWrap,
				ref: wrapRef,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					id,
					className: `${settings_card_module_css_default.select} ${settings_card_module_css_default.selectButton}`,
					disabled: props.disabled,
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					"aria-activedescendant": open ? `${id}-o${activeIndex}` : void 0,
					"aria-invalid": props.invalid || void 0,
					onClick: onTriggerClick,
					onKeyDown,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.selectLabel,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.selectChevron} ${settings_card_module_css_default.selectChevronOpen}` : settings_card_module_css_default.selectChevron,
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: popupClass,
					role: "listbox",
					ref: popupRef,
					children: options.map((option, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						id: `${id}-o${index}`,
						role: "option",
						"aria-selected": option.value === value,
						className: `${settings_card_module_css_default.selectOption}${option.value === value ? ` ${settings_card_module_css_default.selectOptionSelected}` : ""}${index === activeIndex && !closing ? ` ${settings_card_module_css_default.selectOptionActive}` : ""}`,
						onClick: () => {
							commit(index);
						},
						children: option.label
					}, option.value))
				}) : null]
			});
		}
		/** A staged boolean field: 继承 / 开 / 关. */
		function BooleanField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: settings_card_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
						id: props.id,
						options: [
							{
								value: "",
								label: props.inheritLabel
							},
							{
								value: "true",
								label: props.onLabel
							},
							{
								value: "false",
								label: props.offLabel
							}
						],
						value: props.text,
						disabled: props.disabled,
						invalid: props.invalid,
						onEdit: props.onEdit
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: props.hint
					})
				]
			});
		}
		//#endregion
		//#region src/client/settings-form.ts
		/** A boolean field, edited through true/false draft text. */
		function booleanField(field) {
			return {
				field,
				format: (value) => typeof value === "boolean" ? String(value) : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					if (trimmed === "true") return {
						kind: "set",
						value: true
					};
					if (trimmed === "false") return {
						kind: "set",
						value: false
					};
				}
			};
		}
		/**
		* Stages one card's edits over one settings namespace and writes them on save.
		*
		* The Host is the only authority on whether a value was accepted — its
		* validators own the constraints no schema can express — so the outcome is
		* read back from the section rather than predicted here. A save that did not
		* land keeps its drafts, so the user can correct them instead of retyping.
		*/
		var CardForm = class {
			scope;
			specs;
			staged = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			/** The scope subscription installed in the constructor; released by dispose(). */
			disposeScope;
			disposed = false;
			saving = false;
			failed = false;
			failedReason;
			/** @param scope - the bound settings scope for this card's namespace. */
			constructor(scope, specs) {
				this.scope = scope;
				this.specs = new Map(specs.map((spec) => [spec.field, spec]));
				this.disposeScope = scope.subscribe(() => {
					this.publish();
				});
			}
			/**
			* Release the scope subscription and every bound store listener. The card
			* must call this on teardown; later calls are no-ops.
			*/
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				this.disposeScope();
				this.listeners.clear();
			}
			/** Publish a projection of this form, rebuilt whenever the scope or a draft changes. */
			bind(project) {
				const store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(project());
				this.listeners.add(() => {
					store.set(project());
				});
				return store;
			}
			/** Read the card-level state: what the Host serves, and what a save would do. */
			shell() {
				const snapshot = this.scope.getSnapshot();
				const plan = this.plan();
				return {
					available: snapshot.status !== "loading",
					exposed: snapshot.status === "ready",
					writable: snapshot.writable,
					dirty: plan.length > 0,
					invalid: plan.some((item) => item.run === void 0),
					saving: this.saving,
					failed: this.failed,
					...this.failedReason === void 0 ? {} : { failedReason: this.failedReason }
				};
			}
			/** Read one field's state from the effective section and its staged draft. */
			field(field) {
				const spec = this.specOf(field);
				const staged = this.staged.get(field);
				if (staged === void 0) return {
					text: spec.format(this.sectionValue(field)),
					overridden: this.stored(field),
					invalid: false
				};
				const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
				return {
					text: staged.text,
					overridden: write?.kind === "set",
					invalid: write === void 0
				};
			}
			/** The actions the card's slot registration injects. */
			actions() {
				return {
					edit: (field, text) => {
						this.stage(field, {
							text,
							clear: false
						});
					},
					resetField: (field) => {
						this.stage(field, {
							text: this.specOf(field).format(this.baseValue(field)),
							clear: true
						});
					},
					save: () => {
						this.save();
					},
					discard: () => {
						if (this.staged.size === 0 && !this.failed) return;
						this.staged.clear();
						this.failed = false;
						this.failedReason = void 0;
						this.publish();
					}
				};
			}
			/**
			* Write every staged edit, then re-seed from what the Host accepted.
			*
			* When the scope carries the optional batch surface (the dsh-web-ui
			* bridge scope), every planned write rides one mutation so cross-field
			* validate hooks (baseURL+model) judge the batch as a unit instead of
			* deadlocking on per-field writes. Otherwise the per-field loop runs.
			* A field lands only when the Host reports it held the staged value; a
			* landed field's draft is dropped, a failed one stays staged for the user.
			* @returns settlement after every write and the read-back.
			*/
			async save() {
				const plan = this.plan();
				const valid = plan.filter((item) => item.run !== void 0);
				if (plan.length === 0 || this.saving || valid.length !== plan.length) return;
				const plannedWrites = valid.map((item) => item.op);
				const pending = /* @__PURE__ */ new Map();
				for (const item of plan) pending.set(item.field, this.staged.get(item.field));
				this.saving = true;
				this.failed = false;
				this.failedReason = void 0;
				this.publish();
				const landed = /* @__PURE__ */ new Set();
				const batch = this.batchedScope();
				if (batch !== void 0) {
					const result = await batch.mutate(plannedWrites);
					if (result.ok) {
						for (const field of result.fields) if (field.landed) landed.add(field.field);
					} else this.failedReason = result.message;
				} else for (const item of valid) if (await item.run()) landed.add(item.field);
				for (const [field, before] of pending) if (landed.has(field) && this.staged.get(field) === before) this.staged.delete(field);
				this.saving = false;
				this.failed = landed.size !== pending.size;
				this.publish();
			}
			/** The scope's batch surface when it supports one; undefined conservatively otherwise. */
			batchedScope() {
				const candidate = this.scope;
				return typeof candidate?.mutate === "function" ? candidate : void 0;
			}
			/**
			* Every staged edit a save would write. An entry whose draft is not a value
			* its field accepts carries no write: the form is still dirty, and the save
			* refuses rather than dropping the edit. A staged edit that matches the
			* effective section is not a write at all.
			* @returns the planned writes, in the order the fields were staged.
			*/
			plan() {
				const plan = [];
				for (const [field, staged] of this.staged) {
					const spec = this.specOf(field);
					if (staged.clear) {
						if (this.stored(field)) plan.push({
							field,
							op: {
								field,
								op: "unset"
							},
							run: () => this.clear(field)
						});
						continue;
					}
					if (staged.text === spec.format(this.sectionValue(field))) continue;
					const write = spec.parse(staged.text);
					if (write === void 0) plan.push({
						field,
						op: {
							field,
							op: "unset"
						},
						run: void 0
					});
					else if (write.kind === "clear") plan.push({
						field,
						op: {
							field,
							op: "unset"
						},
						run: () => this.clear(field)
					});
					else plan.push({
						field,
						op: {
							field,
							op: "set",
							value: write.value
						},
						run: () => this.store(field, write.value)
					});
				}
				return plan;
			}
			async clear(field) {
				await this.scope.unset(field);
				return !this.stored(field);
			}
			async store(field, value) {
				await this.scope.set(field, value);
				if (this.specOf(field).secret) return true;
				return this.userLayer()?.[field] === value;
			}
			stage(field, edit) {
				this.staged.set(field, edit);
				this.failed = false;
				this.failedReason = void 0;
				this.publish();
			}
			specOf(field) {
				const spec = this.specs.get(field);
				if (spec === void 0) throw new Error(`settings card has no field ${field}`);
				return spec;
			}
			snapshotOf() {
				return this.scope.getSnapshot();
			}
			sectionValue(field) {
				return this.snapshotOf().value?.[field];
			}
			baseValue(field) {
				return this.snapshotOf().base?.[field];
			}
			userLayer() {
				return this.snapshotOf().user;
			}
			stored(field) {
				const user = this.userLayer();
				return user !== void 0 && Object.hasOwn(user, field);
			}
			publish() {
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region src/client/clipboard.ts
		/**
		* Clipboard write shared by the recovery console surfaces (the send-to-Harness
		* dialog copy button and the failed-plugin row copy). Never rejects and never
		* throws: an unavailable clipboard degrades to a false result instead of
		* breaking the console.
		* @module @linxin666/dsh-doctor/client
		*/
		/** Copy text to the clipboard; resolves to whether it landed. */
		function copyText(value) {
			try {
				if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") return navigator.clipboard.writeText(value).then(() => true, () => false);
				if (typeof document !== "undefined") {
					const area = document.createElement("textarea");
					area.value = value;
					document.body.appendChild(area);
					area.select();
					let ok = false;
					try {
						ok = document.execCommand("copy") === true;
					} catch {
						ok = false;
					}
					document.body.removeChild(area);
					return Promise.resolve(ok);
				}
				return Promise.resolve(false);
			} catch {
				return Promise.resolve(false);
			}
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-doctor/src/client/doctor.module.css.mjs
		const css = ".SaqOXq_section{color:var(--dsw-alias-label-primary,#1f2328);flex-direction:column;gap:12px;padding:4px 0;font-size:13px;display:flex}.SaqOXq_header{flex-direction:column;gap:4px;margin:0;display:flex}.SaqOXq_title{color:var(--dsw-alias-label-primary,#1f2328);margin:0;font-size:16px;font-weight:600}.SaqOXq_subtitle{color:var(--dsw-alias-label-secondary,#57606a);margin:0;font-size:12px}.SaqOXq_enableRow{border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-2,#f6f8fa);border-radius:8px;flex-wrap:wrap;align-items:center;gap:12px;padding:10px 12px;display:flex}.SaqOXq_enableCopy{flex-direction:column;gap:2px;min-width:0;display:flex}.SaqOXq_enableLabel{color:var(--dsw-alias-label-primary,#1f2328);font-weight:600}.SaqOXq_enableHint{color:var(--dsw-alias-label-dimmed,#8c959f);font-size:12px}.SaqOXq_switchButton{border:1px solid var(--dsw-alias-border-l1,#d0d7de);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2328);cursor:pointer;font:inherit;border-radius:999px;align-items:center;gap:8px;margin-left:auto;padding:4px 8px;display:inline-flex}.SaqOXq_switchButton:disabled{opacity:.6;cursor:not-allowed}.SaqOXq_switchTrack{background:var(--dsw-alias-border-l2,#d0d7de);border-radius:999px;align-items:center;width:28px;height:16px;transition:background .12s;display:inline-flex}.SaqOXq_switchTrack[data-checked=on]{background:var(--dsw-alias-state-success-primary,#2da44e)}.SaqOXq_switchThumb{background:var(--dsw-alias-bg-base,#fff);border-radius:999px;width:12px;height:12px;margin:0 2px;transition:transform .12s}.SaqOXq_switchTrack[data-checked=on] .SaqOXq_switchThumb{transform:translate(12px)}.SaqOXq_switchText{color:var(--dsw-alias-label-secondary,#57606a);font-size:12px}.SaqOXq_dynamic{flex-direction:column;gap:12px;display:flex}.SaqOXq_card{border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-1,#fff);border-radius:8px;padding:10px 12px}.SaqOXq_cardTitle{color:var(--dsw-alias-label-primary,#1f2328);margin:0 0 6px;font-size:13px;font-weight:600}.SaqOXq_stateLine{align-items:center;gap:8px;display:flex}.SaqOXq_stateText{font-weight:600}.SaqOXq_verdict{color:var(--dsw-alias-label-tertiary,#8c959f);margin-left:auto;font-size:12px}.SaqOXq_dot{background:var(--dsw-alias-label-tertiary,#8c959f);border-radius:999px;flex:none;width:8px;height:8px;display:inline-block}.SaqOXq_dot[data-state=ok],.SaqOXq_dot[data-state=healthy]{background:var(--dsw-alias-state-success-primary,#2da44e)}.SaqOXq_dot[data-state=warn],.SaqOXq_dot[data-state=degraded]{background:var(--dsw-alias-state-warn-primary,#bf8700)}.SaqOXq_dot[data-state=fail],.SaqOXq_dot[data-state=down]{background:var(--dsw-alias-state-error-primary,#cf222e)}.SaqOXq_dot[data-state=unknown]{background:var(--dsw-alias-label-tertiary,#8c959f)}.SaqOXq_meta{color:var(--dsw-alias-label-dimmed,#8c959f);margin:4px 0 0;font-size:12px}.SaqOXq_hint{color:var(--dsw-alias-label-secondary,#57606a);margin:4px 0 0;font-size:12px}.SaqOXq_errorLine{color:var(--dsw-alias-label-error,#cf222e);margin:4px 0 0;font-size:12px}.SaqOXq_checkList,.SaqOXq_incidentList{flex-direction:column;gap:4px;margin:8px 0 0;padding:0;list-style:none;display:flex}.SaqOXq_checkRow,.SaqOXq_incidentRow{align-items:baseline;gap:8px;font-size:12px;display:flex}.SaqOXq_checkName{color:var(--dsw-alias-label-primary,#1f2328)}.SaqOXq_checkDetail,.SaqOXq_incidentDetail{color:var(--dsw-alias-label-tertiary,#8c959f);overflow-wrap:anywhere}.SaqOXq_incidentTitle{color:var(--dsw-alias-label-primary,#1f2328)}.SaqOXq_empty{color:var(--dsw-alias-label-dimmed,#8c959f);margin:4px 0 0;font-size:12px}.SaqOXq_profileBlock{margin-top:8px}.SaqOXq_blockLabel{color:var(--dsw-alias-label-secondary,#57606a);margin:0 0 4px;font-size:12px;font-weight:600;display:block}.SaqOXq_actionRow{flex-wrap:wrap;gap:8px;display:flex}.SaqOXq_button{border:1px solid var(--dsw-alias-border-l1,#d0d7de);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2328);font:inherit;cursor:pointer;border-radius:6px;padding:4px 12px}.SaqOXq_button[data-variant=primary]{border-color:var(--dsw-alias-state-business-primary,#0969da);color:var(--dsw-alias-label-on-primary,#fff);background:var(--dsw-alias-state-business-primary,#0969da)}.SaqOXq_button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#0969da14)}.SaqOXq_button:disabled{opacity:.55;cursor:not-allowed}.SaqOXq_boundary{border:1px dashed var(--dsw-alias-state-warn-primary,#bf8700);border-radius:8px;flex-direction:column;align-items:flex-start;gap:8px;padding:12px;display:flex}.SaqOXq_boundaryText{color:var(--dsw-alias-label-primary,#1f2328);margin:0;font-size:12px}.SaqOXq_dialogBackdrop{z-index:1000;background:#0006;justify-content:center;align-items:center;padding:16px;display:flex;position:fixed;inset:0}.SaqOXq_dialog{border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-1,#fff);width:min(720px,100%);max-height:90vh;color:var(--dsw-alias-label-primary,#1f2328);border-radius:10px;flex-direction:column;gap:10px;padding:16px;display:flex;overflow:auto}.SaqOXq_dialogTitle{margin:0;font-size:15px;font-weight:600}.SaqOXq_dialogLabel{color:var(--dsw-alias-label-secondary,#57606a);font-size:12px;font-weight:600}.SaqOXq_dialogTextarea{border:1px solid var(--dsw-alias-border-l1,#d0d7de);background:var(--dsw-alias-bg-base,#fff);width:100%;min-height:180px;color:var(--dsw-alias-label-primary,#1f2328);resize:vertical;box-sizing:border-box;border-radius:6px;padding:8px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.SaqOXq_dialogTarget{color:var(--dsw-alias-label-secondary,#57606a);gap:8px;font-size:12px;display:flex}.SaqOXq_dialogTargetValue{overflow-wrap:anywhere;color:var(--dsw-alias-label-primary,#1f2328)}.SaqOXq_rowActions{gap:6px;margin-left:auto;display:inline-flex}.SaqOXq_miniButton{border:1px solid var(--dsw-alias-border-l1,#d0d7de);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#57606a);font:inherit;cursor:pointer;border-radius:5px;padding:1px 8px;font-size:11px}.SaqOXq_miniButton:disabled{opacity:.55;cursor:not-allowed}";
		const tagId = "@linxin666/dsh-doctor/doctor.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-doctor";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var doctor_module_css_default = {
			"actionRow": "SaqOXq_actionRow",
			"blockLabel": "SaqOXq_blockLabel",
			"boundary": "SaqOXq_boundary",
			"boundaryText": "SaqOXq_boundaryText",
			"button": "SaqOXq_button",
			"card": "SaqOXq_card",
			"cardTitle": "SaqOXq_cardTitle",
			"checkDetail": "SaqOXq_checkDetail",
			"checkList": "SaqOXq_checkList",
			"checkName": "SaqOXq_checkName",
			"checkRow": "SaqOXq_checkRow",
			"dialog": "SaqOXq_dialog",
			"dialogBackdrop": "SaqOXq_dialogBackdrop",
			"dialogLabel": "SaqOXq_dialogLabel",
			"dialogTarget": "SaqOXq_dialogTarget",
			"dialogTargetValue": "SaqOXq_dialogTargetValue",
			"dialogTextarea": "SaqOXq_dialogTextarea",
			"dialogTitle": "SaqOXq_dialogTitle",
			"dot": "SaqOXq_dot",
			"dynamic": "SaqOXq_dynamic",
			"empty": "SaqOXq_empty",
			"enableCopy": "SaqOXq_enableCopy",
			"enableHint": "SaqOXq_enableHint",
			"enableLabel": "SaqOXq_enableLabel",
			"enableRow": "SaqOXq_enableRow",
			"errorLine": "SaqOXq_errorLine",
			"header": "SaqOXq_header",
			"hint": "SaqOXq_hint",
			"incidentDetail": "SaqOXq_incidentDetail",
			"incidentList": "SaqOXq_incidentList",
			"incidentRow": "SaqOXq_incidentRow",
			"incidentTitle": "SaqOXq_incidentTitle",
			"meta": "SaqOXq_meta",
			"miniButton": "SaqOXq_miniButton",
			"profileBlock": "SaqOXq_profileBlock",
			"rowActions": "SaqOXq_rowActions",
			"section": "SaqOXq_section",
			"stateLine": "SaqOXq_stateLine",
			"stateText": "SaqOXq_stateText",
			"subtitle": "SaqOXq_subtitle",
			"switchButton": "SaqOXq_switchButton",
			"switchText": "SaqOXq_switchText",
			"switchThumb": "SaqOXq_switchThumb",
			"switchTrack": "SaqOXq_switchTrack",
			"title": "SaqOXq_title",
			"verdict": "SaqOXq_verdict"
		};
		//#endregion
		//#region src/client/HarnessSendDialog.tsx
		/**
		* Send-to-Harness dialog for the dsh-doctor recovery console.
		*
		* Shows the composed troubleshooting prompt (failure summary plus error stack)
		* in an editable textarea, offers copy-to-clipboard, and queues the prompt
		* into the CURRENT DSH session when one is open. The dialog never touches the
		* supervisor state; a missing current session simply disables sending and
		* explains why.
		* @module @linxin666/dsh-doctor/client
		*/
		/**
		* Render the dialog; returns null when closed. Text is local state seeded on
		* open, so edits survive re-renders but never leak into later openings.
		*/
		function HarnessSendDialog(props) {
			const { t, open } = props;
			const [text, setText] = (0, react.useState)(props.initialText);
			const [copied, setCopied] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (open) {
					setText(props.initialText);
					setCopied(false);
				}
			}, [open]);
			if (!open) return null;
			const copy = () => {
				copyText(text).then((ok) => {
					setCopied(ok);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: doctor_module_css_default.dialogBackdrop,
				role: "presentation",
				onClick: props.onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: doctor_module_css_default.dialog,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("harness.title"),
					onClick: (event) => {
						event.stopPropagation();
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: doctor_module_css_default.dialogTitle,
							children: t("harness.title")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: doctor_module_css_default.hint,
							children: t("harness.subtitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: doctor_module_css_default.dialogLabel,
							htmlFor: "harness-prompt-text",
							children: t("harness.prompt")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							id: "harness-prompt-text",
							className: doctor_module_css_default.dialogTextarea,
							value: text,
							onChange: (event) => {
								setText(event.target.value);
							},
							spellCheck: false
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: doctor_module_css_default.dialogTarget,
							"data-dsh-part": "harness-target",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("harness.target") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: doctor_module_css_default.dialogTargetValue,
								children: props.target !== void 0 ? props.target.label : t("harness.noTarget")
							})]
						}),
						props.error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: doctor_module_css_default.errorLine,
							role: "status",
							children: props.error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: doctor_module_css_default.actionRow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: doctor_module_css_default.button,
									disabled: props.busy,
									onClick: copy,
									children: copied ? t("harness.copied") : t("harness.copy")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: doctor_module_css_default.button,
									"data-variant": "primary",
									disabled: props.busy || !props.canSend || text.trim() === "",
									onClick: () => {
										props.onSend(text);
									},
									children: props.busy ? t("harness.sending") : t("harness.send")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: doctor_module_css_default.button,
									disabled: props.busy,
									onClick: props.onClose,
									children: t("harness.cancel")
								})
							]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/DoctorRecoveryConsole.tsx
		/**
		* First-level settings section for dsh-doctor: the recovery console.
		*
		* Renders the supervisor snapshot (system phase, protected profiles,
		* incidents), the browser probe list and the diagnostic actions inside a
		* settings.section slot entry. All dynamic content sits behind a React error
		* boundary so a crash in one subview degrades to a recoverable fallback
		* instead of taking the settings surface down; the boundary reports into the
		* probe list.
		*
		* Semantic attrs: the root carries data-dsh-plugin="doctor"; parts carry bare
		* data-dsh-part values scoped by that plugin attribute.
		* @module @linxin666/dsh-doctor/client
		*/
		/** Fallback settings state when the handle is absent. */
		const UNAVAILABLE_SETTINGS = {
			status: "unavailable",
			enabled: void 0,
			writable: false
		};
		/** Singleton unavailable handle: getState returns a cached snapshot so the
		* useSyncExternalStore snapshot identity never changes. */
		const UNAVAILABLE_ADAPTER = {
			getState: () => UNAVAILABLE_SETTINGS,
			listen: () => () => {},
			setEnabled: async () => ({
				ok: false,
				error: "settings unavailable"
			})
		};
		/** Always-available settings adapter so the hook order never changes. */
		function stableSettingsAdapter(settings) {
			return settings ?? UNAVAILABLE_ADAPTER;
		}
		/** The recovery console: a first-level settings section, or the card body when embedded. */
		function DoctorRecoveryConsole(props) {
			const { t, controller } = props;
			const embedded = props.embedded === true;
			const view = (0, react.useSyncExternalStore)(controller.subscribe, controller.getSnapshot);
			const adapter = (0, react.useMemo)(() => stableSettingsAdapter(props.settings), [props.settings]);
			const settingsState = (0, react.useSyncExternalStore)(adapter.listen, adapter.getState);
			const [saving, setSaving] = (0, react.useState)(false);
			const [saveError, setSaveError] = (0, react.useState)(void 0);
			const [harnessOpen, setHarnessOpen] = (0, react.useState)(false);
			const [harnessBusy, setHarnessBusy] = (0, react.useState)(false);
			const [harnessError, setHarnessError] = (0, react.useState)(void 0);
			const toggleLock = (0, react.useRef)(false);
			const harnessFailure = newestFailure(t, view);
			const harnessInitialText = harnessFailure === void 0 ? "" : composeHarnessPrompt(harnessFailure, {
				webVersion: view.hostVersion,
				supervisorVersion: view.snapshot?.version
			}, {
				title: t("harness.prompt.title"),
				summary: t("harness.prompt.summary"),
				kind: t("harness.prompt.kind"),
				stack: t("harness.prompt.stack"),
				environment: t("harness.prompt.environment")
			});
			const harnessTarget = controller.harnessTarget();
			const hasFailures = view.probe.length > 0 || view.incidents.length > 0;
			const openHarness = () => {
				setHarnessError(void 0);
				setHarnessOpen(true);
			};
			const sendHarness = async (text) => {
				setHarnessBusy(true);
				setHarnessError(void 0);
				try {
					const result = await controller.sendToHarness(text);
					if (result.ok) setHarnessOpen(false);
					else setHarnessError(result.message);
				} catch (error) {
					setHarnessError(error instanceof Error ? error.message : String(error));
				} finally {
					setHarnessBusy(false);
				}
			};
			const toggleEnabled = async () => {
				if (settingsState.status !== "ready" || !settingsState.writable || toggleLock.current) return;
				const next = settingsState.enabled !== true;
				toggleLock.current = true;
				setSaving(true);
				setSaveError(void 0);
				try {
					const result = await adapter.setEnabled(next);
					if (!result.ok) setSaveError(result.error);
				} catch (error) {
					setSaveError(error instanceof Error ? error.message : String(error));
				} finally {
					setSaving(false);
					toggleLock.current = false;
					controller.refresh();
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				"data-dsh-plugin": "doctor",
				className: doctor_module_css_default.section,
				"aria-label": t("settings.title"),
				children: [
					embedded === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: doctor_module_css_default.header,
						"data-dsh-part": "header",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: doctor_module_css_default.title,
							children: t("settings.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: doctor_module_css_default.subtitle,
							children: t("settings.subtitle")
						})]
					}) : null,
					embedded === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: doctor_module_css_default.enableRow,
						"data-dsh-part": "enable",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: doctor_module_css_default.enableCopy,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.enableLabel,
									children: t("enable.label")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.enableHint,
									children: enableHint(t, settingsState)
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "switch",
								"data-testid": "doctor-enable-switch",
								"aria-checked": settingsState.enabled === true,
								"aria-label": t("enable.label"),
								disabled: settingsState.status !== "ready" || !settingsState.writable || saving,
								className: doctor_module_css_default.switchButton,
								onClick: () => {
									toggleEnabled();
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.switchTrack,
									"data-checked": settingsState.enabled === true ? "on" : "off",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: doctor_module_css_default.switchThumb })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.switchText,
									children: saving ? t("enable.saving") : settingsState.enabled === true ? t("enable.on") : t("enable.off")
								})]
							}),
							saveError !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: doctor_module_css_default.errorLine,
								role: "status",
								children: t("enable.saveFailed", { reason: saveError })
							})
						]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DoctorErrorBoundary, {
						t,
						onReport: (error) => {
							controller.recordBoundary(error);
						},
						onRecover: () => {
							controller.refresh();
						},
						children: () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: doctor_module_css_default.dynamic,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusCard, {
									t,
									view,
									settings: settingsState
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LifecycleCard, {
									t,
									view,
									onEnsure: () => {
										controller.runProvision();
									},
									onUninstall: () => {
										controller.runUninstall();
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IncidentsCard, {
									t,
									view
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProbeCard, {
									t,
									view,
									controller
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionsCard, {
									t,
									view,
									onDiagnose: () => {
										controller.runDiagnose();
									},
									onRepair: () => {
										controller.runRepair();
									},
									onConfirm: () => {
										controller.runConfirm();
									},
									onReport: () => {
										controller.reportProbe();
									},
									onSendToHarness: openHarness,
									onRefresh: () => {
										controller.refresh();
									},
									onClear: () => {
										controller.clearProbe();
									},
									hasFailures
								})
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(HarnessSendDialog, {
						t,
						open: harnessOpen,
						initialText: harnessInitialText,
						target: harnessTarget,
						canSend: hasFailures && harnessTarget !== void 0,
						busy: harnessBusy,
						error: harnessError,
						onClose: () => {
							if (!harnessBusy) setHarnessOpen(false);
						},
						onSend: (text) => {
							sendHarness(text);
						}
					})
				]
			});
		}
		/** Newest recorded failure for the send-to-Harness prompt (probe first, then supervisor incidents). */
		function newestFailure(t, view) {
			const probe = view.probe[view.probe.length - 1];
			if (probe !== void 0) try {
				return {
					summary: probe.message,
					kind: t(probeKindKey(probe.kind)),
					stack: probe.detail,
					at: probe.at
				};
			} catch {
				return {
					summary: probe.message,
					stack: probe.detail,
					at: probe.at
				};
			}
			const incident = view.incidents[view.incidents.length - 1];
			if (incident === void 0) return void 0;
			const evidence = (incident.evidence ?? []).filter((line) => typeof line === "string" && line.trim() !== "");
			return {
				summary: incident.summary,
				kind: kindLabel(t, incident.kind),
				stack: evidence.join("\n"),
				at: incident.updatedAt === void 0 ? void 0 : parseTime(incident.updatedAt)
			};
		}
		/** Enable-switch helper copy. */
		function enableHint(t, state) {
			if (state.status !== "ready") return t("enable.unavailable");
			if (state.enabled === true) return t("enable.on");
			return t("enable.off");
		}
		/** Combined status card: host verdict, system phase, profiles. */
		function StatusCard({ t, view, settings }) {
			const phase = view.snapshot?.phase;
			const state = view.host === "unavailable" ? "down" : view.phase === "loading" || view.host === "unknown" ? "unknown" : phaseState(phase);
			const stateText = view.host === "unavailable" ? t("host.unavailable") : view.host === "available" ? t("host.available") : t("status.unknown");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: doctor_module_css_default.card,
				"data-dsh-part": "status",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: doctor_module_css_default.cardTitle,
						children: t("status.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: doctor_module_css_default.stateLine,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: doctor_module_css_default.dot,
								"data-state": state
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: doctor_module_css_default.stateText,
								children: stateText
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: doctor_module_css_default.verdict,
								children: phase === void 0 ? t("status.unknown") : phaseLabel(t, "phase." + phase)
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.meta,
						children: view.lastCheckedAt === void 0 ? t("status.neverChecked") : t("status.lastChecked", { time: formatTime(view.lastCheckedAt) })
					}),
					settings.status === "ready" && settings.enabled !== true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.hint,
						children: t("host.disabledHint")
					}),
					view.lastError !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.errorLine,
						role: "status",
						children: view.lastError
					}),
					view.host === "unavailable" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.hint,
						children: offlineHint(t, view.lastErrorCode)
					}),
					view.snapshot?.degradedReason !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.hint,
						children: view.snapshot.degradedReason
					}),
					view.snapshot?.version !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.meta,
						children: view.hostVersion !== void 0 ? t("lifecycle.version", {
							supervisor: view.snapshot.version,
							web: view.hostVersion
						}) : t("snapshot.version", { version: view.snapshot.version })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProfilesList, {
						t,
						view
					})
				]
			});
		}
		/** Lifecycle card: one-click service install/repair/upgrade and uninstall. */
		function LifecycleCard({ t, view, onEnsure, onUninstall }) {
			const busy = view.actionRunning;
			const offline = view.host === "unavailable";
			const version = view.snapshot?.version;
			const mismatch = !offline && version !== void 0 && view.hostVersion !== void 0 && version !== view.hostVersion;
			const ensureLabel = offline && view.lastErrorCode === "SUPERVISOR_UNPROVISIONED" ? t("lifecycle.install") : offline ? t("lifecycle.repair") : mismatch ? t("lifecycle.upgrade") : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: doctor_module_css_default.card,
				"data-dsh-part": "lifecycle",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: doctor_module_css_default.cardTitle,
						children: t("lifecycle.title")
					}),
					offline && view.lastErrorCode === "SUPERVISOR_UNPROVISIONED" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.hint,
						children: t("lifecycle.neverInstalled")
					}),
					offline && view.lastErrorCode === "SUPERVISOR_DOWN" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.hint,
						children: t("lifecycle.serviceDown")
					}),
					mismatch && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.hint,
						children: t("lifecycle.versionMismatch", {
							supervisor: version ?? "",
							web: view.hostVersion ?? ""
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: doctor_module_css_default.actionRow,
						children: [ensureLabel !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: doctor_module_css_default.button,
							"data-variant": "primary",
							"data-testid": "doctor-ensure-button",
							disabled: busy,
							onClick: onEnsure,
							children: busy ? t("lifecycle.running") : ensureLabel
						}), !offline && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: doctor_module_css_default.button,
							"data-testid": "doctor-uninstall-button",
							disabled: busy,
							onClick: onUninstall,
							children: t("lifecycle.uninstall")
						})]
					}),
					!offline && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.meta,
						children: t("lifecycle.uninstallHint")
					})
				]
			});
		}
		/** Offline copy keyed by the host failure code. */
		function offlineHint(t, code) {
			if (code === "SUPERVISOR_UNPROVISIONED") return t("api.unprovisioned");
			if (code === "SUPERVISOR_DOWN") return t("api.supervisorDown");
			return t("host.unavailableHint");
		}
		/** Protected profile rows. */
		function ProfilesList({ t, view }) {
			if (view.profiles.length === 0 && view.host === "available") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: doctor_module_css_default.empty,
				children: t("profiles.empty")
			});
			if (view.profiles.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: doctor_module_css_default.profileBlock,
				"data-dsh-part": "profiles",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: doctor_module_css_default.blockLabel,
					children: t("profiles.title")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: doctor_module_css_default.checkList,
					children: view.profiles.map((profile, index) => {
						const name = profile.identity?.name ?? profile.identity?.id ?? "#" + String(index);
						const phase = profile.phase;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: doctor_module_css_default.checkRow,
							"data-phase": phase ?? "unknown",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.dot,
									"data-state": phaseState(phase)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.checkName,
									children: name
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.incidentDetail,
									children: phase === void 0 ? t("status.unknown") : phaseLabel(t, "phase." + phase)
								}),
								profile.pid !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.incidentDetail,
									children: t("profile.pid", { pid: profile.pid })
								}),
								profile.restartCount !== void 0 && profile.restartCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.incidentDetail,
									children: t("profile.restarts", { count: profile.restartCount })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.incidentDetail,
									children: profile.managed === true ? t("profile.managed") : profile.managed === false ? t("profile.unmanaged") : ""
								})
							]
						}, profile.identity?.id ?? "p" + String(index));
					})
				})]
			});
		}
		/** Incident rows. */
		function IncidentsCard({ t, view }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: doctor_module_css_default.card,
				"data-dsh-part": "incidents",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					className: doctor_module_css_default.cardTitle,
					children: t("incidents.title")
				}), view.incidents.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: doctor_module_css_default.empty,
					children: t("incidents.empty")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: doctor_module_css_default.incidentList,
					children: view.incidents.map((incident, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: doctor_module_css_default.incidentRow,
						"data-severity": incidentSeverity(incident.phase),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: doctor_module_css_default.dot,
								"data-state": incidentSeverity(incident.phase)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: doctor_module_css_default.incidentTitle,
								children: kindLabel(t, incident.kind)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: doctor_module_css_default.incidentDetail,
								children: incident.summary
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: doctor_module_css_default.incidentDetail,
								children: phaseLabel(t, "phase." + incident.phase)
							}),
							incident.updatedAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: doctor_module_css_default.incidentDetail,
								children: formatTime(parseTime(incident.updatedAt))
							})
						]
					}, incident.id + "-" + String(index)))
				})]
			});
		}
		/** Browser probe card (passive incidents). */
		function ProbeCard({ t, view, controller }) {
			const [copiedId, setCopiedId] = (0, react.useState)(void 0);
			const copyFailure = (incident) => {
				const stack = failureStackFor(incident, view);
				copyText(t(probeKindKey(incident.kind)) + ": " + incident.message + (stack !== "" ? "\n\n" + stack : "")).then((ok) => {
					if (ok) setCopiedId(incident.id);
				});
			};
			const disablePlugin = (incident) => {
				controller.disablePlugin(pluginIdOf(incident.message));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: doctor_module_css_default.card,
				"data-dsh-part": "probe",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: doctor_module_css_default.cardTitle,
						children: t("probe.title")
					}),
					view.probe.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.empty,
						children: t("probe.empty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: doctor_module_css_default.incidentList,
						children: view.probe.map((incident, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: doctor_module_css_default.incidentRow,
							"data-kind": incident.kind,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.dot,
									"data-state": incident.kind === "unhandled-rejection" ? "warn" : "fail"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.incidentTitle,
									children: t(probeKindKey(incident.kind))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: doctor_module_css_default.incidentDetail,
									children: probeIncidentText(t, incident)
								}),
								incident.kind === "plugin-startup-failure" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: doctor_module_css_default.rowActions,
									"data-dsh-part": "plugin-row-actions",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: doctor_module_css_default.miniButton,
										"data-testid": "doctor-copy-" + String(index),
										disabled: controller.getSnapshot().actionRunning,
										onClick: () => {
											copyFailure(incident);
										},
										children: copiedId === incident.id ? t("actions.copied") : t("actions.copyError")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: doctor_module_css_default.miniButton,
										"data-testid": "doctor-disable-" + String(index),
										disabled: controller.getSnapshot().actionRunning,
										onClick: () => {
											disablePlugin(incident);
										},
										children: t("actions.disable")
									})]
								})
							]
						}, incident.id + "-" + String(index)))
					}),
					view.bootSignals.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: doctor_module_css_default.meta,
						children: [
							t("kind.connection-reset"),
							" x ",
							String(view.bootSignals.length)
						]
					})
				]
			});
		}
		/** The plugin id recorded in a startup-failure probe message. */
		function pluginIdOf(message) {
			return message.startsWith("plugin failed to start: ") ? message.slice(24) : message;
		}
		/** Best available stack for one probe failure: probe detail, then the plugin-manager ring. */
		function failureStackFor(incident, view) {
			if (incident.kind !== "plugin-startup-failure") return incident.detail ?? "";
			if (incident.detail !== void 0 && incident.detail !== "") return incident.detail;
			const id = pluginIdOf(incident.message);
			return view.pluginFailures.find((item) => item.pluginId === id)?.stack ?? "";
		}
		/** Actions card. */
		function ActionsCard({ t, view, onDiagnose, onRepair, onConfirm, onReport, onSendToHarness, onRefresh, onClear, hasFailures }) {
			const busy = view.actionRunning;
			const offline = view.host === "unavailable";
			const awaitingConfirm = view.incidents.some((incident) => incident.phase === "awaiting-confirmation" && incident.candidateId !== void 0);
			const repairId = view.incidents.some((incident) => incident.repairable === true && incident.phase !== "awaiting-confirmation" && incident.phase !== "recovered" && incident.phase !== "rolled-back" && incident.phase !== "unresolved");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: doctor_module_css_default.card,
				"data-dsh-part": "actions",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: doctor_module_css_default.cardTitle,
						children: t("actions.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: doctor_module_css_default.actionRow,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: doctor_module_css_default.button,
								"data-variant": "primary",
								disabled: busy || offline,
								onClick: onDiagnose,
								children: busy ? t("actions.running") : t("actions.diagnose")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: doctor_module_css_default.button,
								disabled: busy || offline || !repairId,
								onClick: onRepair,
								children: t("actions.repair")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: doctor_module_css_default.button,
								"data-variant": "primary",
								disabled: busy || offline || !awaitingConfirm,
								onClick: onConfirm,
								children: t("actions.confirm")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: doctor_module_css_default.button,
								disabled: busy || offline || view.probe.length === 0,
								onClick: onReport,
								children: t("actions.report")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: doctor_module_css_default.button,
								"data-variant": "primary",
								disabled: busy || !hasFailures,
								onClick: onSendToHarness,
								children: t("actions.sendToHarness")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: doctor_module_css_default.button,
								disabled: busy || offline,
								onClick: onRefresh,
								children: t("actions.refresh")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: doctor_module_css_default.button,
								disabled: view.probe.length === 0,
								onClick: onClear,
								children: t("actions.clearProbe")
							})
						]
					}),
					view.action !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionOutcome, {
						t,
						outcome: view.action
					})
				]
			});
		}
		/** Action result line. */
		function ActionOutcome({ t, outcome }) {
			if (outcome.ok) {
				const label = outcome.kind === "reported" ? t("actions.reported") : outcome.kind === "sent" ? t("actions.sent") : outcome.kind === "disabled" ? t("actions.disabled", { id: outcome.id ?? "" }) : t("actions.completed");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: doctor_module_css_default.meta,
					role: "status",
					children: label
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: doctor_module_css_default.errorLine,
				role: "status",
				children: outcome.message ?? t("api.supervisor", { reason: "" })
			});
		}
		/**
		* Error boundary for the dynamic console area. Reports into the probe list and
		* renders a recoverable fallback; retry resets the boundary and refreshes.
		*/
		var DoctorErrorBoundary = class extends react.Component {
			state = { failed: false };
			static getDerivedStateFromError() {
				return { failed: true };
			}
			componentDidCatch(error) {
				try {
					this.props.onReport(error);
				} catch {}
			}
			reset = () => {
				try {
					this.setState({ failed: false });
					this.props.onRecover();
				} catch {}
			};
			render() {
				if (!this.state.failed) return this.props.children();
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: doctor_module_css_default.boundary,
					"data-dsh-part": "boundary",
					role: "alert",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: doctor_module_css_default.boundaryText,
						children: this.props.t("boundary.fallback")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: doctor_module_css_default.button,
						onClick: this.reset,
						children: this.props.t("boundary.retry")
					})]
				});
			}
		};
		/** Locale key of a passive kind. */
		function probeKindKey(kind) {
			switch (kind) {
				case "window-error": return "kind.window-error";
				case "unhandled-rejection": return "kind.unhandled-rejection";
				case "react-boundary": return "kind.react-boundary";
				case "connection-reset": return "kind.connection-reset";
				case "plugin-startup-failure": return "kind.plugin-startup-failure";
			}
		}
		/** Incident kind label with raw fallback. */
		function kindLabel(t, kind) {
			const key = "incident.kind." + kind;
			if (incidentKindKeys.includes(key)) return t(key);
			return kind;
		}
		const incidentKindKeys = [
			"incident.kind.boot-failure",
			"incident.kind.process-crash",
			"incident.kind.heartbeat-timeout",
			"incident.kind.http-failure",
			"incident.kind.client-failure",
			"incident.kind.dependency-failure",
			"incident.kind.configuration-failure"
		];
		/** Phase label with raw fallback. */
		function phaseLabel(t, key) {
			const candidate = key;
			if (phaseKeys.includes(candidate)) return t(candidate);
			return key.replace(/^phase\./, "");
		}
		const phaseKeys = [
			"phase.disabled",
			"phase.provisioning",
			"phase.armed",
			"phase.degraded",
			"phase.updating",
			"phase.rolling-back",
			"phase.uninstalling",
			"phase.broken",
			"phase.idle",
			"phase.starting",
			"phase.healthy",
			"phase.stopping",
			"phase.exited",
			"phase.suspected",
			"phase.failed",
			"phase.quarantined"
		];
		/** Combined detail text of one passive incident. */
		function probeIncidentText(t, incident) {
			const parts = [incident.message];
			if (incident.line !== void 0 && incident.column !== void 0) parts.push(t("incident.detail", { summary: "line " + String(incident.line) + ", column " + String(incident.column) }));
			else if (incident.source !== void 0) parts.push(t("incident.detail", { summary: "source " + incident.source }));
			if (incident.detail !== void 0 && incident.detail !== "") parts.push(incident.detail);
			return parts.join(" — ");
		}
		/** data-state of a phase. */
		function phaseState(phase) {
			switch (phase) {
				case "healthy":
				case "armed":
				case "recovered": return "ok";
				case "degraded":
				case "starting":
				case "suspected":
				case "awaiting-confirmation":
				case "repairing": return "warn";
				case "failed":
				case "broken":
				case "quarantined":
				case "unresolved": return "fail";
				default: return "unknown";
			}
		}
		/** Incident severity derived from its phase. */
		function incidentSeverity(phase) {
			if (phase === "recovered" || phase === "rolled-back") return "ok";
			if (phase === "awaiting-confirmation" || phase === "repairing" || phase === "candidate-testing") return "warn";
			return "fail";
		}
		/** Parse an ISO timestamp; never throws. */
		function parseTime(value) {
			const at = Date.parse(value);
			return Number.isFinite(at) ? at : 0;
		}
		/** Locale-neutral time rendering. */
		function formatTime(at) {
			if (at <= 0) return "-";
			try {
				return new Date(at).toLocaleTimeString();
			} catch {
				return String(at);
			}
		}
		//#endregion
		//#region src/client/DoctorSettingsCard.tsx
		/** Bridges the `doctor` scope onto the card staged form. */
		var DoctorSettingsCardController = class {
			form;
			store;
			/** @param scope - the bound settings scope for the `doctor` namespace. */
			constructor(scope) {
				this.form = new CardForm(scope, [
					booleanField("enabled"),
					booleanField("fullProtection"),
					booleanField("autoRepair")
				]);
				this.store = this.form.bind(() => this.projection());
			}
			projection() {
				return {
					...this.form.shell(),
					enabled: this.form.field("enabled"),
					fullProtection: this.form.field("fullProtection"),
					autoRepair: this.form.field("autoRepair")
				};
			}
			/** Build the form face the card slot registration injects. */
			inject() {
				return {
					hooks: { doctorSettingsCard: this.store },
					...this.form.actions()
				};
			}
		};
		/**
		* Render the doctor card.
		* @param props - locale copy, the card snapshot, form actions, and the console controller.
		* @returns the card.
		*/
		function DoctorSettingsCard(props) {
			const { t } = props;
			const state = props.useDoctorSettingsCard((snapshot) => snapshot);
			const fieldProps = {
				overriddenLabel: t("settings.overridden"),
				resetLabel: t("settings.reset"),
				invalidLabel: t("settings.invalidNumber"),
				disabled: !state.writable
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PluginSettingsCard, {
				t,
				titleKey: "settings.title",
				descriptionKey: "settings.description",
				defaultOpen: false,
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-doctor-enabled",
						label: t("settings.enabled"),
						hint: t("settings.enabledHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.enabled,
						onEdit: (text) => {
							props.edit("enabled", text);
						},
						onReset: () => {
							props.resetField("enabled");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-doctor-full-protection",
						label: t("settings.fullProtection"),
						hint: t("settings.fullProtectionHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.fullProtection,
						onEdit: (text) => {
							props.edit("fullProtection", text);
						},
						onReset: () => {
							props.resetField("fullProtection");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-doctor-auto-repair",
						label: t("settings.autoRepair"),
						hint: t("settings.autoRepairHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.autoRepair,
						onEdit: (text) => {
							props.edit("autoRepair", text);
						},
						onReset: () => {
							props.resetField("autoRepair");
						}
					}),
					props.controller === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: t("settings.controllerUnavailable")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DoctorRecoveryConsole, {
						t,
						controller: props.controller,
						settings: null,
						embedded: true
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Locale dictionaries for the dsh-doctor recovery console. The zh dictionary is
		* the key source; the en dictionary mirrors the exact key set.
		* @module @linxin666/dsh-doctor/client
		*/
		/** Simplified Chinese copy (the key-set source of truth). */
		const STATIC_ZH = {
			"settings.title": "Doctor 恢复控制台",
			"settings.subtitle": "监控受保护档案、重建信号与浏览器故障，并运行诊断与修复动作。",
			"settings.description": "故障检测、隔离修复与事务式回滚的救助模式。",
			"settings.enabled": "启用救助模式",
			"settings.enabledHint": "开启后自动核对并部署 Supervisor 与救援胶囊；关闭时暂停自动干预但不卸载。",
			"settings.fullProtection": "完整保护",
			"settings.fullProtectionHint": "托管模式发送心跳、记录故障并执行熔断；关闭后保留只观察、不自动干预。",
			"settings.autoRepair": "自动修复",
			"settings.autoRepairHint": "开启后在隔离门禁通过时自动提升；关闭时保留候选并等待明确确认。",
			"settings.controllerUnavailable": "恢复控制台当前不可用。",
			"settings.overridden": "已覆盖",
			"settings.reset": "恢复默认",
			"settings.notExposed": "当前 DSH 版本未向设置页暴露本插件的配置命名空间，表单不可用。可编辑 $DSH_HOME/settings.yaml 直接配置后重启。",
			"settings.readOnly": "当前部署的设置只读。",
			"settings.inherit": "继承",
			"settings.on": "开",
			"settings.off": "关",
			"settings.expand": "展开设置",
			"settings.collapse": "收起设置",
			"settings.save": "保存",
			"settings.saving": "保存中…",
			"settings.discard": "放弃",
			"settings.unsaved": "未保存",
			"settings.saveFailed": "部署未接受这些值，已保留供你修改。",
			"settings.invalidNumber": "请输入数字，留空则使用默认值。",
			"status.title": "宿主状态",
			"status.checking": "检查中…",
			"status.unknown": "未知",
			"host.available": "Doctor 在线",
			"host.unavailable": "Doctor 离线",
			"status.lastChecked": "上次检查 {time}",
			"status.neverChecked": "尚未检查",
			"host.unavailableHint": "未检测到 /api/doctor 宿主端点：宿主半区未启用、未挂载，或返回了非 JSON 响应。",
			"host.disabledHint": "Doctor 已停用：打开上方开关后，宿主半区才会挂载诊断端点。",
			"snapshot.version": "快照版本 {version}",
			"snapshot.updated": "更新于 {time}",
			"profiles.title": "受保护档案",
			"profiles.empty": "无受保护档案。",
			"profile.restarts": "重启 {count} 次",
			"profile.managed": "托管",
			"profile.unmanaged": "未托管",
			"profile.pid": "PID {pid}",
			"profile.lastHealthy": "上次健康 {time}",
			"incidents.title": "事件",
			"incidents.empty": "暂无事件。",
			"probe.title": "浏览器探针",
			"probe.empty": "未捕获到窗口错误或未处理的 Promise 拒绝。",
			"actions.title": "动作",
			"actions.diagnose": "诊断",
			"actions.repair": "修复",
			"actions.confirm": "确认提升",
			"actions.report": "上报到 Doctor",
			"actions.refresh": "刷新",
			"actions.clearProbe": "清除探针",
			"actions.running": "执行中…",
			"actions.reported": "已上报浏览器侧事件。",
			"actions.completed": "动作已完成，快照已更新。",
			"actions.reportEmpty": "没有可上报的探针事件。",
			"actions.sendToHarness": "发送给 Harness",
			"actions.sent": "已发送到当前 DSH 会话。",
			"actions.copyError": "复制错误",
			"actions.copied": "已复制",
			"actions.disable": "禁用并重启",
			"actions.disabled": "已禁用 {id}；重启 dsh web 后生效。",
			"harness.title": "发送给 Harness",
			"harness.subtitle": "把最近一次故障的摘要与错误堆栈连同排障提示词发给当前 DSH 会话。",
			"harness.prompt": "排障提示词",
			"harness.prompt.title": "请排查以下 DSH Web 故障，给出根因与修复步骤：",
			"harness.prompt.summary": "故障摘要",
			"harness.prompt.kind": "故障类型",
			"harness.prompt.stack": "错误堆栈",
			"harness.prompt.environment": "环境",
			"harness.target": "目标会话",
			"harness.noTarget": "当前没有打开的会话，请先新建或打开一个会话。",
			"harness.send": "发送",
			"harness.sending": "发送中…",
			"harness.copy": "复制",
			"harness.copied": "已复制",
			"harness.cancel": "取消",
			"harness.noFailure": "暂无已记录的启动或运行故障。",
			"lifecycle.title": "服务与胶囊",
			"lifecycle.install": "一键安装",
			"lifecycle.repair": "修复并重启服务",
			"lifecycle.upgrade": "重启并升级服务",
			"lifecycle.uninstall": "卸载救助服务",
			"lifecycle.uninstallHint": "移除本机用户级 Supervisor 服务；安装状态数据保留，可随时重新安装。",
			"lifecycle.running": "安装/修复中…",
			"lifecycle.neverInstalled": "Supervisor 服务尚未安装：一键安装将注册用户级服务、启动守护进程并配置救援胶囊。",
			"lifecycle.serviceDown": "Supervisor 服务已安装但未应答：一键修复会重新部署服务并刷新救援胶囊。",
			"lifecycle.version": "Supervisor {supervisor} / Web {web}",
			"lifecycle.versionMismatch": "Supervisor {supervisor} 与 Web 端 {web} 版本不一致：升级重启后生效。",
			"api.network": "网络错误：{reason}",
			"api.loopback": "仅限本机浏览器访问。",
			"api.notAvailable": "宿主端点不可用（未启用或未挂载宿主半区）。",
			"api.malformed": "宿主响应格式异常。",
			"api.http": "宿主错误：{reason}",
			"api.supervisor": "Supervisor 错误：{reason}",
			"api.unprovisioned": "Supervisor 服务未安装。",
			"api.supervisorDown": "Supervisor 服务未应答。",
			"enable.label": "启用 Doctor",
			"enable.on": "已启用：宿主半区挂载诊断端点并发送心跳。",
			"enable.off": "已停用：控制台只读显示，宿主端点处于离线。",
			"enable.unavailable": "设置命名空间不可用（宿主未注册 doctor 设置）。",
			"enable.saving": "保存中…",
			"enable.saveFailed": "保存失败：{reason}",
			"kind.window-error": "窗口错误",
			"kind.unhandled-rejection": "未处理的 Promise 拒绝",
			"kind.react-boundary": "React 渲染异常",
			"kind.connection-reset": "连接重建",
			"kind.plugin-startup-failure": "插件启动失败",
			"phase.disabled": "已停用",
			"phase.provisioning": "初始化中",
			"phase.armed": "已就绪",
			"phase.degraded": "部分异常",
			"phase.updating": "更新中",
			"phase.rolling-back": "回滚中",
			"phase.uninstalling": "卸载中",
			"phase.broken": "已损坏",
			"phase.idle": "空闲",
			"phase.starting": "启动中",
			"phase.healthy": "健康",
			"phase.stopping": "停止中",
			"phase.exited": "已退出",
			"phase.suspected": "疑似异常",
			"phase.failed": "失败",
			"phase.quarantined": "已隔离",
			"incident.kind.boot-failure": "启动失败",
			"incident.kind.process-crash": "进程崩溃",
			"incident.kind.heartbeat-timeout": "心跳超时",
			"incident.kind.http-failure": "HTTP 故障",
			"incident.kind.client-failure": "浏览器侧故障",
			"incident.kind.dependency-failure": "依赖故障",
			"incident.kind.configuration-failure": "配置故障",
			"incident.detail": "{summary}",
			"boundary.fallback": "恢复控制台的动态区域渲染失败，已记录一条事件；可重试以恢复显示。",
			"boundary.retry": "重试"
		};
		/** English copy mirroring the zh key set exactly. */
		const STATIC_EN = {
			"settings.title": "Doctor recovery console",
			"settings.subtitle": "Monitors protected profiles, rebuild signals and browser failures, and runs diagnostic actions.",
			"settings.description": "Rescue mode with failure detection, isolated repair and transactional rollback.",
			"settings.enabled": "Enable rescue mode",
			"settings.enabledHint": "Reconciles the Supervisor and rescue capsule automatically; disabling pauses intervention without uninstalling.",
			"settings.fullProtection": "Full protection",
			"settings.fullProtectionHint": "Managed mode sends heartbeats, records incidents and enforces circuit breaking; off remains observation-only.",
			"settings.autoRepair": "Auto repair",
			"settings.autoRepairHint": "Promotes after isolated gates when on; off keeps the candidate staged until explicit confirmation.",
			"settings.controllerUnavailable": "The recovery console is currently unavailable.",
			"settings.overridden": "Overridden",
			"settings.reset": "Reset to default",
			"settings.notExposed": "This DSH version does not expose this plugin's settings namespace to the configuration page, so the form is unavailable. Edit $DSH_HOME/settings.yaml directly and restart.",
			"settings.readOnly": "This deployment stores settings read-only.",
			"settings.inherit": "Inherit",
			"settings.on": "On",
			"settings.off": "Off",
			"settings.expand": "Show settings",
			"settings.collapse": "Hide settings",
			"settings.save": "Save",
			"settings.saving": "Saving…",
			"settings.discard": "Discard",
			"settings.unsaved": "Unsaved",
			"settings.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
			"settings.invalidNumber": "Enter a number, or leave blank to use the default.",
			"status.title": "Host status",
			"status.checking": "Checking...",
			"status.unknown": "Unknown",
			"host.available": "Doctor online",
			"host.unavailable": "Doctor offline",
			"status.lastChecked": "Last checked {time}",
			"status.neverChecked": "Never checked",
			"host.unavailableHint": "No /api/doctor host endpoint detected: the host half is disabled, unmounted, or answered with a non-JSON response.",
			"host.disabledHint": "Doctor is disabled: the host half mounts its endpoints only after the switch above is on.",
			"snapshot.version": "Snapshot {version}",
			"snapshot.updated": "Updated {time}",
			"profiles.title": "Protected profiles",
			"profiles.empty": "No protected profiles.",
			"profile.restarts": "restarted {count} times",
			"profile.managed": "managed",
			"profile.unmanaged": "unmanaged",
			"profile.pid": "PID {pid}",
			"profile.lastHealthy": "last healthy {time}",
			"incidents.title": "Incidents",
			"incidents.empty": "No incidents.",
			"probe.title": "Browser probe",
			"probe.empty": "No window errors or unhandled promise rejections captured.",
			"actions.title": "Actions",
			"actions.diagnose": "Diagnose",
			"actions.repair": "Repair",
			"actions.confirm": "Confirm promotion",
			"actions.report": "Report to Doctor",
			"actions.refresh": "Refresh",
			"actions.clearProbe": "Clear probe",
			"actions.running": "Running...",
			"actions.reported": "Browser incident reported.",
			"actions.completed": "Action completed; snapshot refreshed.",
			"actions.reportEmpty": "Nothing to report from the probe list.",
			"actions.sendToHarness": "Send to Harness",
			"actions.sent": "Sent to the current DSH session.",
			"actions.copyError": "Copy error",
			"actions.copied": "Copied",
			"actions.disable": "Disable and restart",
			"actions.disabled": "Disabled {id}; takes effect after restarting dsh web.",
			"harness.title": "Send to Harness",
			"harness.subtitle": "Sends the latest failure summary and error stack along with a troubleshooting prompt to the current DSH session.",
			"harness.prompt": "Troubleshooting prompt",
			"harness.prompt.title": "Please diagnose the following DSH Web failure and provide root cause and fix steps:",
			"harness.prompt.summary": "Failure summary",
			"harness.prompt.kind": "Failure kind",
			"harness.prompt.stack": "Error stack",
			"harness.prompt.environment": "Environment",
			"harness.target": "Target session",
			"harness.noTarget": "No session is currently open; create or open one first.",
			"harness.send": "Send",
			"harness.sending": "Sending...",
			"harness.copy": "Copy",
			"harness.copied": "Copied",
			"harness.cancel": "Cancel",
			"harness.noFailure": "No recorded startup or runtime failure yet.",
			"lifecycle.title": "Service and capsule",
			"lifecycle.install": "Install now",
			"lifecycle.repair": "Repair and restart",
			"lifecycle.upgrade": "Restart and upgrade",
			"lifecycle.uninstall": "Uninstall rescue service",
			"lifecycle.uninstallHint": "Removes the user-level supervisor service on this machine; state data is kept and reinstall is always possible.",
			"lifecycle.running": "Installing/repairing...",
			"lifecycle.neverInstalled": "The supervisor service is not installed: install registers the user-level service, starts the daemon and provisions the rescue capsule.",
			"lifecycle.serviceDown": "The supervisor service is installed but not answering: repair redeploys the service and refreshes the capsule.",
			"lifecycle.version": "Supervisor {supervisor} / Web {web}",
			"lifecycle.versionMismatch": "Supervisor {supervisor} and Web {web} versions differ: upgrade and restart takes effect.",
			"api.network": "Network error: {reason}",
			"api.loopback": "Only reachable from a local browser.",
			"api.notAvailable": "Host endpoint unavailable (host half disabled or unmounted).",
			"api.malformed": "Host response is malformed.",
			"api.http": "Host error: {reason}",
			"api.supervisor": "Supervisor error: {reason}",
			"api.unprovisioned": "The supervisor service is not installed.",
			"api.supervisorDown": "The supervisor service is not answering.",
			"enable.label": "Enable Doctor",
			"enable.on": "Enabled: the host half mounts diagnostic endpoints and sends heartbeats.",
			"enable.off": "Disabled: the console is read-only and host endpoints are offline.",
			"enable.unavailable": "Settings namespace unavailable (host did not register the doctor settings).",
			"enable.saving": "Saving...",
			"enable.saveFailed": "Save failed: {reason}",
			"kind.window-error": "Window error",
			"kind.unhandled-rejection": "Unhandled promise rejection",
			"kind.react-boundary": "React render error",
			"kind.connection-reset": "Connection rebuilt",
			"kind.plugin-startup-failure": "Plugin startup failure",
			"phase.disabled": "Disabled",
			"phase.provisioning": "Provisioning",
			"phase.armed": "Armed",
			"phase.degraded": "Degraded",
			"phase.updating": "Updating",
			"phase.rolling-back": "Rolling back",
			"phase.uninstalling": "Uninstalling",
			"phase.broken": "Broken",
			"phase.idle": "Idle",
			"phase.starting": "Starting",
			"phase.healthy": "Healthy",
			"phase.stopping": "Stopping",
			"phase.exited": "Exited",
			"phase.suspected": "Suspected",
			"phase.failed": "Failed",
			"phase.quarantined": "Quarantined",
			"incident.kind.boot-failure": "Boot failure",
			"incident.kind.process-crash": "Process crash",
			"incident.kind.heartbeat-timeout": "Heartbeat timeout",
			"incident.kind.http-failure": "HTTP failure",
			"incident.kind.client-failure": "Browser failure",
			"incident.kind.dependency-failure": "Dependency failure",
			"incident.kind.configuration-failure": "Configuration failure",
			"incident.detail": "{summary}",
			"boundary.fallback": "The dynamic area of the recovery console failed to render; one incident was recorded. Retry to restore the display.",
			"boundary.retry": "Retry"
		};
		/** Simplified Chinese dictionary. */
		const zh = STATIC_ZH;
		/** English dictionary. */
		const en = STATIC_EN;
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace owned by this plugin. */
		const NS = "doctor";
		/** Semantic plugin short name used on the console root container. */
		const PLUGIN_SHORT_NAME = "doctor";
		/** Services required by the browser half. */
		const inject = [
			"slots",
			"locale",
			"settingsScope"
		];
		/** Apply-guard: a duplicated client injection must not mount a second card. */
		let claimed = false;
		/** Apply the browser half; never throws. */
		function apply(ctx) {
			if (claimed) return;
			claimed = true;
			safe(() => {
				ctx.effect(() => {
					try {
						return ctx.locale.register(NS, {
							zh,
							en
						});
					} catch {
						return () => {};
					}
				}, "doctor: dictionaries");
			});
			let controller;
			safe(() => {
				const passive = new PassiveProbe({ notify: () => {
					controller?.syncProbe();
				} });
				const modules = ctx.get("modules");
				const harness = createHarnessPort(ctx.get("sessions"));
				const pluginRepair = createPluginRepairPort(ctx.get("pluginManager"));
				controller = new DoctorController({
					api: new DoctorApi(),
					passive,
					modules,
					harness,
					pluginRepair
				});
				passive.start();
				ctx.effect(() => {
					controller?.start();
					return () => {
						controller?.dispose();
					};
				}, "doctor: poll loop");
				ctx.effect(() => ctx.on("connection/reset", () => {
					controller?.noteConnectionReset();
				}), "doctor: connection signals");
				const events = ctx;
				ctx.effect(() => events.on("loader/partial-dispose", (_loader, options, failed) => {
					try {
						if (failed !== true) return;
						const row = options ?? {};
						const id = typeof row.id === "string" ? row.id : typeof row.name === "string" ? row.name : void 0;
						if (id !== void 0 && id !== "") controller?.notePluginStartupFailure(id);
					} catch {}
				}), "doctor: plugin failure events");
			});
			let cardController;
			safe(() => {
				cardController = new DoctorSettingsCardController((ctx.get("webUiSettings") ?? ctx.settingsScope).bind({ namespace: NS }));
			});
			ctx.slots.inject("web-ui.plugin.item", () => {
				const dispose = controller === void 0 || cardController === void 0 ? void 0 : safeRegister(ctx, controller, cardController);
				return () => {
					dispose?.();
				};
			});
		}
		/** Register the card; returns the disposer or undefined on failure. */
		function safeRegister(ctx, controller, cardController) {
			try {
				return ctx.slots.register({
					name: "web-ui.plugin.item",
					id: NS,
					order: 140,
					label: () => {
						try {
							return ctx.locale.bind(NS)("settings.title");
						} catch {
							return "Doctor";
						}
					},
					locale: NS,
					inject: () => ({
						...cardController.inject(),
						controller
					})
				}, DoctorSettingsCard);
			} catch {
				return;
			}
		}
		/** Run one guarded step; never rethrows. */
		function safe(step) {
			try {
				step();
			} catch {}
		}
		//#endregion
		exports.NS = NS;
		exports.PLUGIN_SHORT_NAME = PLUGIN_SHORT_NAME;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map