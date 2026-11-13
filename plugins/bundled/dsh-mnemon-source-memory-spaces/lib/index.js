import { findMnemonCommand, isMnemonExecutable, resolveMnemonInvocation } from "./native-cli.js";
import { CATEGORIES, EDGE_TYPES, EMBEDDING_CREDENTIAL_REFERENCE, EMBEDDING_ENVIRONMENT_NAME, INTENTS, MEMORY_PLACEMENT_CAPABILITIES, MEMORY_PROVIDER_REGISTRY_FILE, MEMORY_SPACES_DIRECTORY, MEMORY_SPACE_DATABASE_FILE, MEMORY_SPACE_DESCRIPTION_MAX_LENGTH, MEMORY_SPACE_ID_PATTERN, MEMORY_SPACE_REGISTRY_FILE, MNEMON_ACTIVE_STORE_FILE, MNEMON_EMBEDDING_PROTOCOLS, NATIVE_PROVIDER_ID, SOURCES, isNativeProvider, normalizeEntityKey } from "./contracts.js";
import { a as MemoryProviderCatalog, i as EMPTY_MEMORY_PROVIDER_CATALOG, n as PrivateMemorySpaceProviderHost, r as MemoryProviderAdapterRegistry, t as createMemorySpaceProviderPlugin } from "./plugin-m1PeU1IE.js";
import { i as runProcess, r as ProcessError } from "./adapter-D-BnWkko.js";
import { r as defineMemorySpaceProvider } from "./definitions-DfmOqJjR.js";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import z from "@deepseek-ai/schemastery";
import { createMemoryMutationReceipt, defineMemoryPlugin, defineMemorySource, installMemory, memoryConfigurationDigest, memoryInputInteger, memoryInputRecord, memoryInputStringArray, memoryInputText, truncateMemoryText, withMemoryStorageLock } from "dsh-mnemon/extension-sdk";
import { createHash, randomUUID } from "node:crypto";
import { COMPOSABLE_MEMORY_API_VERSION } from "dsh-mnemon/contracts";
//#region src/view-model.ts
const MODEL_MEMORY_BODY_LIMIT = 16;
function boundedToolText(value, maximum) {
	return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}
/** Strip control-plane paths, provider settings, and statistics from model output. */
function modelSpaceCatalog(catalog) {
	const items = catalog.items.slice(0, MODEL_MEMORY_BODY_LIMIT);
	return {
		items: items.map((body) => ({
			id: body.id,
			name: boundedToolText(body.name, 120),
			description: boundedToolText(body.description, 500),
			active: body.active,
			providerEnabled: body.providerEnabled !== false,
			status: body.providerEnabled === false ? "provider-disabled" : body.statusLoading === true ? "not-probed" : body.healthy ? "healthy" : "unhealthy",
			...body.error === void 0 ? {} : { error: boundedToolText(body.error, 500) },
			provider: {
				id: body.provider.id,
				label: boundedToolText(body.provider.label, 120),
				capabilities: structuredClone(body.provider.capabilities)
			}
		})),
		persistenceStrategy: catalog.persistenceStrategy,
		total: catalog.total,
		activeCount: catalog.activeCount,
		omittedCount: Math.max(0, catalog.items.length - items.length)
	};
}
/** Keep health diagnostics useful without exposing complete control-plane state. */
function modelStatus(status) {
	const active = status.memoryBodies.filter((body) => body.active && body.providerEnabled !== false);
	const unhealthy = active.filter((body) => !body.healthy);
	const summed = active.filter((body) => body.healthy && body.stats !== void 0);
	const relevantProviders = status.providerServices?.filter((provider) => provider.enabled || provider.configured || provider.memoryBodyCount > 0 || provider.status === "unhealthy") ?? [];
	const providers = relevantProviders.slice(0, 16);
	const providerReady = status.commandFound === true || (status.providerServices ?? []).some((provider) => provider.enabled && provider.configured);
	const notice = status.memoryBodies.length > 0 ? void 0 : providerReady ? "No Memory Space exists yet, so durable memory has nowhere to go and a full MEMORY.md archives to a local file. Create and activate a Memory Space to keep durable memory." : "No Memory Space exists, and none can be created until a memory Provider is ready, so durable memory has nowhere to go and a full MEMORY.md archives to a local file. Install the Mnemon CLI for Mnemon Native, or connect another Provider on the dsh-mnemon page under Plugins, then create and activate a Memory Space.";
	return {
		healthy: status.healthy && unhealthy.length === 0,
		...notice === void 0 ? {} : { notice },
		...status.error === void 0 ? {} : { error: boundedToolText(status.error, 1e3) },
		...status.version === void 0 ? {} : { version: boundedToolText(status.version, 120) },
		commandFound: status.commandFound,
		writeEnabled: status.writeEnabled,
		memorySpaces: {
			total: status.memoryBodies.length,
			active: active.length,
			healthy: active.length - unhealthy.length,
			unhealthy: unhealthy.length,
			providerDisabled: status.memoryBodies.filter((body) => body.providerEnabled === false).length
		},
		providers: providers.map((provider) => ({
			providerId: provider.providerId,
			label: boundedToolText(provider.label, 120),
			enabled: provider.enabled,
			configured: provider.configured,
			status: provider.status,
			memoryBodyCount: provider.memoryBodyCount,
			activeMemoryBodyCount: provider.activeMemoryBodyCount,
			...provider.error === void 0 ? {} : { error: boundedToolText(provider.error, 500) }
		})),
		omittedProviderCount: Math.max(0, relevantProviders.length - providers.length),
		...status.stats === void 0 ? {} : { aggregate: {
			scope: "Sums over the active, healthy Memory Spaces whose Provider reports statistics (spaces); the others add nothing. totalInsights counts live memories, and deletedInsights the forgotten ones a Provider keeps, as Mnemon Native does.",
			spaces: summed.length,
			totalInsights: status.stats.totalInsights,
			deletedInsights: status.stats.deletedInsights,
			edgeCount: status.stats.edgeCount,
			oplogCount: status.stats.oplogCount,
			dbSizeBytes: status.stats.dbSizeBytes
		} }
	};
}
/** Preserve valid JSON when the Route's evidence budget is smaller than a directory. */
function modelJson(value, maximum) {
	const bounded = structuredClone(value);
	let result = JSON.stringify(bounded);
	while (result.length > maximum) {
		if (bounded.items !== void 0 && bounded.items.length > 0) {
			bounded.items.pop();
			bounded.omittedCount = (bounded.omittedCount ?? 0) + 1;
		} else if (bounded.providers !== void 0 && bounded.providers.length > 0) {
			bounded.providers.pop();
			bounded.omittedProviderCount = (bounded.omittedProviderCount ?? 0) + 1;
		} else return JSON.stringify({ unavailable: "Inspection summary exceeds the Route budget; narrow the query." });
		result = JSON.stringify(bounded);
	}
	return result;
}
//#endregion
//#region src/memory-spaces.ts
const NATIVE_REGISTRY_VERSION = 1;
const PROVIDER_REGISTRY_VERSION = 4;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{0,127}$/u;
const DISCONNECTS_VERSION = 1;
/** Settings whose value can name a namespace: a bank, workspace, user, tag, URI or folder. */
const IDENTITY_INPUTS = /* @__PURE__ */ new Set([
	"text",
	"url",
	"path"
]);
function storedProviderId(value) {
	return typeof value === "string" && PROVIDER_ID_PATTERN.test(value);
}
/** Disconnected namespaces as a file holds them: sound entries only, newest last. */
function storedDisconnects(value) {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
		const fields = item;
		const externalId = typeof fields.externalId === "string" && fields.externalId.trim() !== "" && fields.externalId.trim().length <= 2e3 ? fields.externalId.trim() : void 0;
		const connection = storedProviderConnection(fields.connection);
		const entry = {
			...externalId === void 0 ? {} : { externalId },
			...Object.keys(connection).length === 0 ? {} : { connection }
		};
		return Object.keys(entry).length === 0 ? [] : [entry];
	}).slice(-1e3);
}
/** JSON with every object's keys in order, so two equal connections compare equal. */
function canonicalJson(value) {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (value !== null && typeof value === "object") {
		const fields = value;
		return `{${Object.keys(fields).filter((key) => fields[key] !== void 0).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(fields[key])}`).join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}
function storedProviderConnection(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
	return Object.fromEntries(Object.entries(value).filter((entry) => {
		const [key, item] = entry;
		return /^[a-z][a-zA-Z0-9_-]{0,127}$/u.test(key) && (typeof item === "boolean" || typeof item === "number" && Number.isFinite(item) || typeof item === "string" && item.length <= 8e3);
	}));
}
function requiredText(value, label, max) {
	const normalized = value.trim();
	if (normalized === "") throw new Error(`${label} is required`);
	if (normalized.length > max) throw new Error(`${label} is too long (max ${max} characters)`);
	return normalized;
}
function optionalText$1(value, label, max) {
	const normalized = value?.trim() ?? "";
	if (normalized.length > max) throw new Error(`${label} is too long (max ${max} characters)`);
	return normalized;
}
const PROVIDER_METADATA_KEYS = [
	"name",
	"title",
	"displayName",
	"workspace",
	"bankId",
	"project",
	"containerTag",
	"userId",
	"user",
	"workingDirectory",
	"targetUri"
];
function compactProviderMetadataValue(value) {
	if (typeof value !== "string") return void 0;
	const normalized = value.trim();
	if (normalized === "" || normalized === "*") return void 0;
	return (normalized.split(/[/:\\]+/u).filter(Boolean).at(-1) ?? normalized).trim() || void 0;
}
/**
* Normalize uneven provider discovery metadata at the projection boundary.
* Adapters map the richest native fields they know; the registry then tries
* the nearest namespace setting before falling back to a stable provider
* identity. This keeps every discovered namespace usable without teaching the
* Web UI each provider's response shape.
*/
function providerProjectionMetadata(providerCatalog, providerId, candidate) {
	const descriptor = providerCatalog.descriptor(providerId);
	const externalId = requiredText(candidate.externalId, "provider externalId", 2e3);
	const mappedName = String(candidate.name ?? "").trim();
	const nearestName = PROVIDER_METADATA_KEYS.map((key) => compactProviderMetadataValue(candidate.connection[key])).find((value) => value !== void 0);
	const fallbackId = compactProviderMetadataValue(externalId) ?? externalId;
	const name = (mappedName || nearestName || `${descriptor.label} ${fallbackId}`).slice(0, 100);
	const description = (String(candidate.description ?? "").trim() || `${descriptor.label} memory namespace mapped from ${externalId}.`).slice(0, MEMORY_SPACE_DESCRIPTION_MAX_LENGTH);
	return {
		name: requiredText(name, "name", 100),
		description: optionalText$1(description, "description", MEMORY_SPACE_DESCRIPTION_MAX_LENGTH)
	};
}
function providerDisplayLocation(descriptor, connection) {
	const populated = (field) => field.input !== "secret" && String(connection[field.key] ?? "").trim() !== "";
	const field = descriptor.fields.find((candidate) => candidate.role === "global-location" && populated(candidate)) ?? descriptor.fields.find((candidate) => (candidate.input === "url" || candidate.input === "path") && populated(candidate)) ?? descriptor.fields.find(populated);
	return field === void 0 ? "" : String(connection[field.key]);
}
function legacyOpenVikingConnection(connection) {
	return Object.fromEntries(Object.entries(connection).filter((entry) => typeof entry[1] === "string"));
}
function normalizePlacementDecision(value, providerId, providerCatalog = EMPTY_MEMORY_PROVIDER_CATALOG) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const placement = value;
	if (placement.mode !== "automatic" || placement.providerId !== providerId) return void 0;
	if (placement.decidedBy !== "rules" && placement.decidedBy !== "llm") return void 0;
	if (placement.confidence !== "high" && placement.confidence !== "medium" && placement.confidence !== "low") return void 0;
	if (typeof placement.reason !== "string" || placement.reason.trim() === "" || placement.reason.length > 1e3) return void 0;
	if (!Array.isArray(placement.candidateProviderIds) || !placement.candidateProviderIds.every((id) => providerCatalog.has(id)) || !placement.candidateProviderIds.includes(providerId)) return void 0;
	if (!Array.isArray(placement.appliedRules) || !placement.appliedRules.every((rule) => typeof rule === "string" && rule.length <= 500)) return void 0;
	if (typeof placement.decidedAt !== "string" || placement.decidedAt.trim() === "") return void 0;
	if (placement.runId !== void 0 && typeof placement.runId !== "string") return void 0;
	if (placement.subagentProvider !== void 0 && typeof placement.subagentProvider !== "string") return void 0;
	return {
		mode: "automatic",
		providerId,
		decidedBy: placement.decidedBy,
		reason: placement.reason.trim(),
		confidence: placement.confidence,
		candidateProviderIds: [...new Set(placement.candidateProviderIds)],
		appliedRules: [...placement.appliedRules],
		decidedAt: placement.decidedAt,
		...placement.runId === void 0 ? {} : { runId: placement.runId },
		...placement.subagentProvider === void 0 ? {} : { subagentProvider: placement.subagentProvider }
	};
}
function validateMemorySpaceId(value) {
	const normalized = value.trim();
	if (!MEMORY_SPACE_ID_PATTERN.test(normalized)) throw new Error("memoryBodyId must match [a-zA-Z0-9][a-zA-Z0-9_-]*");
	return normalized;
}
/**
* Persistent metadata layered over Mnemon's native named stores.
*
* Native metadata lives beside Store directories so existing Mnemon Packs stay
* compatible. External connection metadata lives under state and is never
* included in Memory Space Packs.
*/
var MemorySpaceRegistry = class MemorySpaceRegistry {
	runner;
	persistent;
	now;
	providerCatalog;
	directory;
	registryPath;
	providerRegistryPath;
	/** The namespaces a person disconnected, which asking a Provider again leaves out (#373). */
	disconnectsPath;
	refreshing = false;
	state;
	constructor(runner, persistent = true, now = () => /* @__PURE__ */ new Date(), providerCatalog = EMPTY_MEMORY_PROVIDER_CATALOG, sharedState) {
		this.runner = runner;
		this.persistent = persistent;
		this.now = now;
		this.providerCatalog = providerCatalog;
		this.state = sharedState ?? {
			spaces: [],
			services: {},
			serviceEnabled: {},
			disconnected: {}
		};
		this.directory = join(runner.effectiveDataDir(), MEMORY_SPACES_DIRECTORY);
		this.registryPath = join(this.directory, MEMORY_SPACE_REGISTRY_FILE);
		this.providerRegistryPath = join(runner.effectiveDataDir(), "state", MEMORY_PROVIDER_REGISTRY_FILE);
		this.disconnectsPath = join(runner.effectiveDataDir(), "state", "memory-provider-disconnects.json");
		if (sharedState === void 0) this.reload();
	}
	get spaces() {
		return this.state.spaces;
	}
	set spaces(value) {
		this.state.spaces = value;
	}
	get services() {
		return this.state.services;
	}
	set services(value) {
		this.state.services = value;
	}
	get serviceEnabled() {
		return this.state.serviceEnabled;
	}
	set serviceEnabled(value) {
		this.state.serviceEnabled = value;
	}
	get disconnected() {
		return this.state.disconnected;
	}
	set disconnected(value) {
		this.state.disconnected = value;
	}
	/** One generation-local descriptor view over the same persistent authority. */
	withProviderCatalog(providerCatalog) {
		return new MemorySpaceRegistry(this.runner, this.persistent, this.now, providerCatalog, this.state);
	}
	isNative(providerId) {
		return this.providerTypeId(providerId) === NATIVE_PROVIDER_ID;
	}
	providerTypeId(providerId) {
		const descriptor = this.providerCatalog.descriptor(providerId);
		return descriptor.typeId ?? descriptor.id;
	}
	list() {
		this.refreshIfChanged();
		this.reconcileDiscoveredStores();
		return this.spaces.filter((body) => this.providerCatalog.has(body.providerId)).map((body) => this.view(body));
	}
	active() {
		return this.list().filter((body) => body.active && (this.isNative(body.provider.id) || Object.hasOwn(this.services, body.provider.id) && this.serviceEnabled[body.provider.id] === true));
	}
	get(id) {
		const normalized = validateMemorySpaceId(id);
		const body = this.list().find((entry) => entry.id === normalized);
		if (body === void 0) throw new Error(`unknown memory space: ${normalized}`);
		return body;
	}
	providerConnection(id, expectedProviderId) {
		this.refreshIfChanged();
		const normalized = validateMemorySpaceId(id);
		const body = this.spaces.find((entry) => entry.id === normalized);
		if (body === void 0 || this.isNative(body.providerId)) throw new Error(`memory space has no external provider connection: ${normalized}`);
		if (expectedProviderId !== void 0 && body.providerId !== expectedProviderId) throw new Error(`memory space ${normalized} uses ${body.providerId}, not ${expectedProviderId}`);
		return this.connectionFor(body);
	}
	/** Used only after a public operation has refreshed the registry authority. */
	connectionFor(body) {
		const legacy = this.providerTypeId(body.providerId) === "openviking" && body.openViking !== void 0 ? legacyOpenVikingConnection(body.openViking) : void 0;
		return this.providerCatalog.normalize(body.providerId, {
			...this.services[body.providerId] ?? {},
			...legacy ?? {},
			...body.connection ?? {}
		});
	}
	providerServiceConfigured(providerId) {
		this.refreshIfChanged();
		return this.isNative(providerId) ? this.runner.commandFound : Object.hasOwn(this.services, providerId);
	}
	providerServiceEnabled(providerId) {
		return this.isNative(providerId) ? this.runner.commandFound : this.providerServiceConfigured(providerId) && this.serviceEnabled[providerId] === true;
	}
	/**
	* The provider used when none is named: Mnemon Native while its CLI is
	* available, which keeps the long-standing default, otherwise the first
	* other provider, in catalog order, that can take writes now.
	*/
	defaultProviderId() {
		const ready = this.providerCatalog.providers.filter((provider) => this.providerServiceEnabled(provider.id));
		return (ready.find((provider) => this.isNative(provider.id)) ?? ready[0])?.id;
	}
	providerServices(options = {}) {
		this.refreshIfChanged();
		const providers = this.providerCatalog.providers.filter((provider) => !isNativeProvider(provider));
		const items = providers.map((provider) => {
			const connection = this.services[provider.id];
			const publicConnection = this.providerCatalog.publicScoped(provider.id, "service", connection ?? {});
			return {
				providerId: provider.id,
				enabled: Object.hasOwn(this.services, provider.id) && this.serviceEnabled[provider.id] === true,
				configured: connection !== void 0,
				...publicConnection,
				...options.includeSecrets === true && connection !== void 0 ? { secretValues: Object.fromEntries(publicConnection.configuredSecrets.map((key) => [key, connection[key]])) } : {}
			};
		});
		return {
			providers: [...providers],
			items,
			generatedAt: this.now().toISOString()
		};
	}
	updateProviderService(providerId, settings, clearSecrets = [], enabled = true) {
		this.refreshIfChanged();
		if (this.isNative(providerId)) throw new Error("Mnemon Native service settings are managed by the native configuration");
		const previous = this.services[providerId] ?? {};
		this.services[providerId] = this.providerCatalog.normalizeService(providerId, settings, previous, clearSecrets);
		this.serviceEnabled[providerId] = enabled;
		if (!enabled) this.spaces = this.spaces.filter((body) => body.providerId !== providerId);
		this.save();
		return this.providerServices().items.find((item) => item.providerId === providerId);
	}
	resolveProviderService(providerId, settings, clearSecrets = []) {
		this.refreshIfChanged();
		if (this.isNative(providerId)) throw new Error("Mnemon Native service settings are managed by the native configuration");
		return this.providerCatalog.normalizeService(providerId, settings, this.services[providerId] ?? {}, clearSecrets);
	}
	/** Atomically replace one provider's local projections after authoritative discovery. */
	syncProviderService(providerId, service, discovered) {
		this.refreshIfChanged();
		if (this.isNative(providerId)) throw new Error("Mnemon Native Stores are discovered from disk");
		let normalizedService = this.providerCatalog.normalizeService(providerId, service);
		const seen = /* @__PURE__ */ new Set();
		const existing = this.spaces.filter((body) => body.providerId === providerId);
		const existingByExternalId = /* @__PURE__ */ new Map();
		for (const body of existing) if (!existingByExternalId.has(body.externalId)) existingByExternalId.set(body.externalId, body);
		const reservedIds = new Set(this.spaces.filter((body) => body.providerId !== providerId).map((body) => body.id));
		const timestamp = this.now().toISOString();
		const projections = discovered.map((candidate) => {
			const externalId = requiredText(candidate.externalId, "provider externalId", 2e3);
			if (seen.has(externalId)) throw new Error(`${this.providerCatalog.descriptor(providerId).label} returned a duplicate memory namespace: ${externalId}`);
			seen.add(externalId);
			const connection = this.providerCatalog.normalizeMemory(providerId, candidate.connection);
			this.providerCatalog.normalize(providerId, {
				...normalizedService,
				...connection
			});
			const previous = existingByExternalId.get(externalId);
			let id = previous?.id ?? validateMemorySpaceId(`${providerId}-${createHash("sha256").update(externalId).digest("hex").slice(0, 24)}`);
			let suffix = 1;
			while (reservedIds.has(id)) {
				id = validateMemorySpaceId(`${providerId}-${createHash("sha256").update(`${externalId}:${suffix}`).digest("hex").slice(0, 24)}`);
				suffix += 1;
			}
			reservedIds.add(id);
			const metadata = providerProjectionMetadata(this.providerCatalog, providerId, candidate);
			const metadataSource = previous?.metadataSource ?? (previous === void 0 ? "provider" : "manual");
			const preserveLocalMetadata = previous !== void 0 && metadataSource !== "provider";
			return {
				id,
				externalId,
				name: preserveLocalMetadata ? previous.name : metadata.name,
				description: preserveLocalMetadata ? previous.description : metadata.description,
				metadataSource,
				active: previous?.active ?? true,
				providerId,
				connection,
				createdAt: previous?.createdAt ?? timestamp,
				updatedAt: this.nextTimestamp(previous?.updatedAt, timestamp)
			};
		});
		for (const field of this.providerCatalog.serviceFields(providerId)) {
			if (field.discoveryDefaultFrom === void 0 || String(normalizedService[field.key] ?? "").trim() !== "") continue;
			const discoveredValue = projections[0]?.connection?.[field.discoveryDefaultFrom];
			if (discoveredValue !== void 0 && String(discoveredValue).trim() !== "") normalizedService = this.providerCatalog.normalizeService(providerId, {
				...normalizedService,
				[field.key]: discoveredValue
			});
		}
		this.services[providerId] = normalizedService;
		this.serviceEnabled[providerId] = true;
		this.spaces = [...this.spaces.filter((body) => body.providerId !== providerId), ...projections];
		this.save();
		this.forgetDisconnected(providerId, this.reportedNamespaces(providerId, normalizedService, discovered));
		return this.providerServices().items.find((item) => item.providerId === providerId);
	}
	/**
	* Mount the namespaces a Provider reports that this directory has never held, as asking a
	* Provider again finds them (#373). A space already mounted is left exactly as it is, and so is
	* a namespace a person disconnected. A new space starts inactive: recall reads it only once a
	* person turns it on. A space counts as a reported namespace when it has its externalId, or the
	* settings that name it (see `holds`): a space made by hand for the same bank, or one whose
	* externalId the Provider now writes differently. A Provider switched off, or saved with other
	* settings since `service` was read, gets nothing: that save decides. Nothing is written when
	* nothing is new.
	*/
	mountDiscovered(providerId, service, discovered) {
		this.refreshIfChanged();
		if (this.isNative(providerId)) throw new Error("Mnemon Native Stores are discovered from disk");
		const current = this.services[providerId];
		if (current === void 0 || !this.providerServiceEnabled(providerId) || canonicalJson(current) !== canonicalJson(this.providerCatalog.normalizeService(providerId, service))) return {
			added: [],
			disconnected: 0
		};
		const held = this.spaces.filter((body) => body.providerId === providerId).map((body) => ({
			...body.externalId === void 0 ? {} : { externalId: body.externalId },
			...body.connection === void 0 ? {} : { connection: body.connection }
		}));
		const disconnected = this.disconnected[providerId] ?? [];
		const reservedIds = new Set(this.spaces.map((body) => body.id));
		const timestamp = this.now().toISOString();
		const added = [];
		let stillDisconnected = 0;
		for (const reported of this.reportedNamespaces(providerId, current, discovered)) {
			if (held.some((body) => this.holds(providerId, current, body, reported)) || added.some((body) => body.externalId === reported.externalId)) continue;
			if (disconnected.some((entry) => this.holds(providerId, current, entry, reported))) {
				stillDisconnected += 1;
				continue;
			}
			const { externalId, connection, candidate } = reported;
			let id = validateMemorySpaceId(`${providerId}-${createHash("sha256").update(externalId).digest("hex").slice(0, 24)}`);
			let suffix = 1;
			while (reservedIds.has(id)) {
				id = validateMemorySpaceId(`${providerId}-${createHash("sha256").update(`${externalId}:${suffix}`).digest("hex").slice(0, 24)}`);
				suffix += 1;
			}
			const metadata = providerProjectionMetadata(this.providerCatalog, providerId, candidate);
			added.push({
				id,
				externalId,
				name: metadata.name,
				description: metadata.description,
				metadataSource: "provider",
				active: false,
				providerId,
				connection,
				createdAt: timestamp,
				updatedAt: timestamp
			});
			reservedIds.add(id);
		}
		if (added.length > 0) {
			this.spaces = [...this.spaces, ...added];
			this.save();
		}
		return {
			added: added.map((body) => this.view(body)),
			disconnected: stillDisconnected
		};
	}
	/** The namespaces in one Provider answer this directory could hold; the others are left out. */
	reportedNamespaces(providerId, service, discovered) {
		const reported = discovered.flatMap((candidate) => {
			try {
				const externalId = requiredText(candidate.externalId, "provider externalId", 2e3);
				const connection = this.providerCatalog.normalizeMemory(providerId, candidate.connection);
				this.providerCatalog.normalize(providerId, {
					...service,
					...connection
				});
				const identity = this.namespaceIdentity(providerId, connection);
				const whole = identity === void 0 ? this.wholeConnection(providerId, service, connection) : void 0;
				return [{
					candidate,
					externalId,
					connection,
					...identity === void 0 ? {} : { identity },
					...whole === void 0 ? {} : { whole },
					distinct: false
				}];
			} catch {
				return [];
			}
		});
		const signature = (namespace) => namespace.identity !== void 0 ? `identity:${canonicalJson(namespace.identity)}` : namespace.whole === void 0 ? void 0 : `connection:${namespace.whole}`;
		const counts = /* @__PURE__ */ new Map();
		for (const namespace of reported) {
			const key = signature(namespace);
			if (key !== void 0) counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		for (const namespace of reported) {
			const key = signature(namespace);
			namespace.distinct = key !== void 0 && counts.get(key) === 1;
		}
		return reported;
	}
	/**
	* What names a namespace in a space's own settings: each text, address or path set for it. A
	* wildcard (`*`) names nothing, and neither does a choice, a switch, a number such as a recall
	* budget or a trust floor, or a secret.
	*/
	namespaceIdentity(providerId, connection) {
		if (connection === void 0) return void 0;
		const identity = {};
		for (const field of this.providerCatalog.memoryFields(providerId)) {
			if (!IDENTITY_INPUTS.has(field.input)) continue;
			const value = connection[field.key];
			if (typeof value !== "string") continue;
			const text = value.trim();
			if (text === "" || text === "*") continue;
			identity[field.key] = text;
		}
		return Object.keys(identity).length === 0 ? void 0 : identity;
	}
	/** A whole connection, defaults filled in; one whose own part is empty compares by externalId alone. */
	wholeConnection(providerId, service, memory) {
		if (memory === void 0 || Object.keys(memory).length === 0) return void 0;
		try {
			return canonicalJson(this.providerCatalog.normalize(providerId, {
				...service,
				...memory
			}));
		} catch {
			return;
		}
	}
	/**
	* Whether `held`, a mounted space or a namespace a person disconnected, already reads the
	* namespace a Provider reported: the same externalId, or every setting that names the namespace,
	* whatever else differs; a `*` held reads every value. A hand-made Hindsight space for bank
	* `team` with another recall budget reads bank `team`; a Honcho space for one peer of workspace
	* `w1` reads workspace `w1`. Asking again only adds what nothing here reads yet.
	*/
	holds(providerId, service, held, reported) {
		if (held.externalId !== void 0 && held.externalId === reported.externalId) return true;
		if (!reported.distinct || held.connection === void 0) return false;
		if (reported.identity !== void 0) {
			const connection = held.connection;
			return Object.entries(reported.identity).every(([key, value]) => {
				const setting = connection[key];
				return typeof setting === "string" && (setting.trim() === value || setting.trim() === "*");
			});
		}
		return reported.whole !== void 0 && this.wholeConnection(providerId, service, held.connection) === reported.whole;
	}
	/** Remember a namespace a person disconnected, so asking its Provider again leaves it out. */
	rememberDisconnected(providerId, body) {
		const connection = body.connection === void 0 ? {} : this.providerCatalog.publicScoped(providerId, "memory", body.connection).settings;
		const entry = {
			...body.externalId === void 0 ? {} : { externalId: body.externalId },
			...Object.keys(connection).length === 0 ? {} : { connection }
		};
		if (Object.keys(entry).length === 0) return;
		const key = canonicalJson(entry);
		this.disconnected[providerId] = [...(this.disconnected[providerId] ?? []).filter((item) => canonicalJson(item) !== key), entry].slice(-1e3);
		this.saveDisconnects();
	}
	/** Forget the disconnected namespaces a save of the Provider's settings mounted again. */
	forgetDisconnected(providerId, reported) {
		const remembered = this.disconnected[providerId];
		if (remembered === void 0) return;
		const service = this.services[providerId] ?? {};
		const remaining = remembered.filter((entry) => !reported.some((namespace) => this.holds(providerId, service, entry, namespace)));
		if (remaining.length === remembered.length) return;
		if (remaining.length === 0) delete this.disconnected[providerId];
		else this.disconnected[providerId] = remaining;
		this.saveDisconnects();
	}
	placementCandidates(request) {
		return this.providerCatalog.providers.map((descriptor) => {
			const providerTypeId = descriptor.typeId ?? descriptor.id;
			const requestConnection = request.providerConnections?.[descriptor.id] ?? (providerTypeId === "openviking" && request.connection === void 0 && request.openViking !== void 0 ? request.openViking : request.connection);
			let configured = providerTypeId === "mnemon-native" ? this.runner.commandFound : false;
			if (providerTypeId !== "mnemon-native" && (requestConnection !== void 0 || this.providerServiceConfigured(descriptor.id))) try {
				const split = this.providerCatalog.split(descriptor.id, requestConnection);
				this.providerCatalog.normalize(descriptor.id, {
					...this.services[descriptor.id] ?? {},
					...split.service,
					...split.memory
				});
				configured = Object.keys(split.service).length > 0 || this.providerServiceEnabled(descriptor.id);
			} catch {
				configured = false;
			}
			return {
				id: descriptor.id,
				label: descriptor.label,
				kind: descriptor.kind,
				configured,
				summary: descriptor.summary,
				capabilities: descriptor.capabilities
			};
		});
	}
	async create(request, signal, placement) {
		const name = requiredText(request.name, "name", 100);
		const description = requiredText(request.description, "description", MEMORY_SPACE_DESCRIPTION_MAX_LENGTH);
		if (request.placement !== void 0 && placement === void 0) throw new Error("automatic provider placement must be resolved before creating a Memory Space");
		if (placement !== void 0 && request.providerId !== void 0 && request.providerId !== placement.providerId) throw new Error("resolved provider placement conflicts with providerId");
		const providerId = placement?.providerId ?? request.providerId ?? this.defaultProviderId();
		if (providerId === void 0) throw new Error("No memory provider is ready: install the Mnemon CLI to use Mnemon Native, or connect another provider on the dsh-mnemon page under Plugins");
		if (!this.providerCatalog.has(providerId)) throw new Error(`unsupported memory provider: ${String(providerId)}`);
		const normalizedPlacement = placement === void 0 ? void 0 : normalizePlacementDecision(placement, providerId, this.providerCatalog);
		if (placement !== void 0 && normalizedPlacement === void 0) throw new Error("resolved provider placement is invalid");
		const reservedIds = new Set(this.list().map((body) => body.id));
		const nativeStoreIds = this.nativeStoreIds();
		const nativeProvider = this.isNative(providerId);
		let id = nativeProvider && nativeStoreIds.length === 0 && !reservedIds.has("default") ? "default" : validateMemorySpaceId(nativeProvider ? randomUUID() : `${providerId}-${randomUUID()}`);
		while (reservedIds.has(id) || nativeStoreIds.includes(id)) id = validateMemorySpaceId(randomUUID());
		const connectionInput = request.providerConnections?.[providerId] ?? (this.providerTypeId(providerId) === "openviking" && request.connection === void 0 && request.openViking !== void 0 ? request.openViking : request.connection);
		let connection;
		if (!nativeProvider) {
			const split = this.providerCatalog.split(providerId, connectionInput);
			if (Object.keys(split.service).length > 0) {
				this.services[providerId] = this.providerCatalog.normalizeService(providerId, split.service, this.services[providerId] ?? {});
				this.serviceEnabled[providerId] = true;
			}
			if (!this.providerServiceEnabled(providerId)) throw new Error(`${this.providerCatalog.descriptor(providerId).label} service is not enabled; enable it on the dsh-mnemon page under Plugins first`);
			connection = this.providerCatalog.normalizeMemory(providerId, split.memory);
			this.providerCatalog.normalize(providerId, {
				...this.services[providerId],
				...connection
			});
		}
		if (nativeProvider) await this.runner.runText([
			"store",
			"create",
			id
		], {
			...signal === void 0 ? {} : { signal },
			store: id
		});
		const timestamp = this.now().toISOString();
		const body = {
			id,
			name,
			description,
			active: request.active ?? false,
			providerId,
			...nativeProvider ? {} : { metadataSource: "manual" },
			...normalizedPlacement === void 0 ? {} : { placement: normalizedPlacement },
			...connection === void 0 ? {} : { connection },
			createdAt: timestamp,
			updatedAt: timestamp
		};
		this.spaces.push(body);
		this.save();
		return this.view(body);
	}
	update(id, request) {
		this.refreshIfChanged();
		const normalized = validateMemorySpaceId(id);
		const index = this.spaces.findIndex((body) => body.id === normalized);
		if (index < 0) throw new Error(`unknown memory space: ${normalized}`);
		const current = this.spaces[index];
		if (request.openViking !== void 0 && this.providerTypeId(current.providerId) !== "openviking") throw new Error("OpenViking connection settings only apply to OpenViking memory spaces");
		const nativeProvider = this.isNative(current.providerId);
		if ((request.connection !== void 0 || request.clearSecrets !== void 0) && nativeProvider) throw new Error("Mnemon Native memory spaces do not have provider connection settings");
		const legacyPatch = request.openViking === void 0 ? void 0 : {
			...request.openViking,
			...request.openViking.clearApiKey === true ? { apiKey: "" } : {}
		};
		const previousConnection = nativeProvider ? {} : current.connection ?? {};
		const connectionPatch = request.connection ?? legacyPatch;
		let connection;
		if (!nativeProvider) {
			const split = this.providerCatalog.split(current.providerId, connectionPatch);
			const clearSecrets = [...request.clearSecrets ?? [], ...request.openViking?.clearApiKey === true ? ["apiKey"] : []];
			if (Object.keys(split.service).length > 0 || clearSecrets.length > 0) {
				this.services[current.providerId] = this.providerCatalog.normalizeService(current.providerId, split.service, this.services[current.providerId] ?? {}, clearSecrets);
				this.serviceEnabled[current.providerId] = true;
			}
			if (!this.providerServiceEnabled(current.providerId)) throw new Error(`${this.providerCatalog.descriptor(current.providerId).label} service is not enabled; enable it on the dsh-mnemon page under Plugins first`);
			connection = this.providerCatalog.normalizeMemory(current.providerId, split.memory, previousConnection);
			this.providerCatalog.normalize(current.providerId, {
				...this.services[current.providerId],
				...connection
			});
		}
		const { openViking: _legacyOpenViking, ...currentBody } = current;
		const body = {
			...currentBody,
			...request.name === void 0 ? {} : { name: requiredText(request.name, "name", 100) },
			...request.description === void 0 ? {} : { description: optionalText$1(request.description, "description", MEMORY_SPACE_DESCRIPTION_MAX_LENGTH) },
			...request.active === void 0 ? {} : { active: request.active },
			...nativeProvider || request.name === void 0 && request.description === void 0 ? {} : { metadataSource: "manual" },
			...connection === void 0 ? {} : { connection },
			updatedAt: this.nextTimestamp(current.updatedAt)
		};
		this.spaces[index] = body;
		this.save();
		return this.view(body);
	}
	/** Validate every model-authored update before committing the batch. */
	updateMetadata(updates) {
		this.refreshIfChanged();
		if (updates.length === 0 || updates.length > 20) throw new Error("metadata maintenance requires 1 through 20 Memory Spaces");
		const seen = /* @__PURE__ */ new Set();
		const replacements = updates.map((update) => {
			const id = validateMemorySpaceId(update.memoryBodyId);
			if (seen.has(id)) throw new Error(`duplicate metadata update: ${id}`);
			seen.add(id);
			const index = this.spaces.findIndex((body) => body.id === id);
			if (index < 0) throw new Error(`unknown memory space: ${id}`);
			return {
				index,
				body: {
					...this.spaces[index],
					name: requiredText(update.title, "title", 48),
					description: requiredText(update.description, "description", 200),
					metadataSource: "ai",
					updatedAt: this.nextTimestamp(this.spaces[index].updatedAt)
				}
			};
		});
		for (const replacement of replacements) this.spaces[replacement.index] = replacement.body;
		this.save();
		return replacements.map((replacement) => this.view(replacement.body));
	}
	async remove(id, signal) {
		const body = this.get(id);
		if (!this.isNative(body.provider.id)) {
			const stored = this.spaces.find((entry) => entry.id === body.id);
			this.spaces = this.spaces.filter((entry) => entry.id !== body.id);
			this.save();
			if (stored !== void 0) this.rememberDisconnected(body.provider.id, stored);
			return body;
		}
		const nativeStoreIds = this.nativeStoreIds();
		if (nativeStoreIds.includes(body.id) && nativeStoreIds.length === 1) throw new Error(`cannot delete the last Mnemon Store "${body.id}"; disable it for DSH or create another Memory Space first`);
		const persistedStore = this.runner.persistedStore();
		const commands = [];
		let commandStore = persistedStore;
		if (persistedStore === body.id) {
			const nativeIds = new Set(nativeStoreIds);
			const replacement = this.list().filter((candidate) => candidate.id !== body.id && nativeIds.has(candidate.id)).sort((left, right) => Number(right.active) - Number(left.active) || left.id.localeCompare(right.id))[0]?.id ?? nativeStoreIds.filter((candidate) => candidate !== body.id).sort()[0];
			if (replacement === void 0) throw new Error(`cannot switch away from Mnemon Store "${body.id}" before deleting it`);
			commandStore = replacement;
			commands.push({
				args: [
					"store",
					"set",
					replacement
				],
				options: {
					...signal === void 0 ? {} : { signal },
					store: replacement
				}
			});
		}
		commands.push({
			args: [
				"store",
				"remove",
				body.id
			],
			options: {
				...signal === void 0 ? {} : { signal },
				store: commandStore
			}
		});
		await this.runner.runTextBatch(commands);
		this.spaces = this.spaces.filter((entry) => entry.id !== body.id);
		this.save();
		return body;
	}
	setActive(id, active) {
		return this.update(id, { active });
	}
	/** Advance the safe catalog checkpoint after provider-backed content changes. */
	touch(id) {
		const normalized = validateMemorySpaceId(id);
		const index = this.spaces.findIndex((body) => body.id === normalized);
		if (index < 0) throw new Error(`unknown memory space: ${normalized}`);
		const body = {
			...this.spaces[index],
			updatedAt: this.nextTimestamp(this.spaces[index].updatedAt)
		};
		this.spaces[index] = body;
		this.save();
		return this.view(body);
	}
	/** Refresh metadata after an atomic Pack import replaced the data component. */
	reload() {
		this.refreshing = true;
		try {
			this.spaces = [];
			this.services = {};
			this.serviceEnabled = {};
			this.disconnected = {};
			this.loadAndReconcile();
			this.state.diskRevision = this.diskRevision();
		} finally {
			this.refreshing = false;
		}
	}
	diskRevision() {
		if (!this.persistent) return "ephemeral";
		return [
			this.registryPath,
			this.providerRegistryPath,
			this.disconnectsPath
		].map((path) => {
			try {
				const stat = statSync(path, { bigint: true });
				return `${stat.ino}:${stat.mtimeNs}:${stat.size}`;
			} catch (error) {
				if (error.code === "ENOENT") return "missing";
				throw error;
			}
		}).join("/");
	}
	/** Separate generations and legacy facades observe the same durable authority. */
	refreshIfChanged() {
		if (!this.refreshing && this.persistent && this.state.diskRevision !== this.diskRevision()) this.reload();
	}
	loadAndReconcile() {
		let migratedSyntheticDefault = false;
		let migratedProviderRegistry = false;
		if (this.persistent && existsSync(this.registryPath)) try {
			const parsed = JSON.parse(readFileSync(this.registryPath, "utf8"));
			if ((parsed.version === NATIVE_REGISTRY_VERSION || parsed.version === 2) && Array.isArray(parsed.bodies)) {
				migratedProviderRegistry = parsed.version === 2;
				this.spaces = parsed.bodies.filter((body) => MEMORY_SPACE_ID_PATTERN.test(body.id)).map((body) => {
					const syntheticDefault = body.id === "default" && body.name === "默认记忆体" && body.description === "从现有 Mnemon Store 自动接入。";
					migratedSyntheticDefault ||= syntheticDefault;
					const providerId = "providerId" in body && storedProviderId(body.providerId) ? body.providerId : NATIVE_PROVIDER_ID;
					if (!this.providerCatalog.has(providerId)) return {
						id: body.id,
						name: requiredText(body.name || body.id, "name", 100),
						description: optionalText$1(body.description, "description", MEMORY_SPACE_DESCRIPTION_MAX_LENGTH),
						active: body.active === true,
						providerId,
						connection: storedProviderConnection("connection" in body ? body.connection : void 0),
						createdAt: body.createdAt,
						updatedAt: body.updatedAt
					};
					const placement = "placement" in body ? normalizePlacementDecision(body.placement, providerId, this.providerCatalog) : void 0;
					const rawConnection = "connection" in body && body.connection != null ? body.connection : this.providerTypeId(providerId) === "openviking" && "openViking" in body && body.openViking != null ? body.openViking : void 0;
					const split = this.isNative(providerId) ? void 0 : this.providerCatalog.split(providerId, rawConnection);
					if (split !== void 0 && this.services[providerId] === void 0) {
						this.services[providerId] = this.providerCatalog.normalizeService(providerId, split.service);
						this.serviceEnabled[providerId] = true;
					}
					const connection = split === void 0 ? void 0 : this.providerCatalog.normalizeMemory(providerId, split.memory);
					if (connection !== void 0) this.providerCatalog.normalize(providerId, {
						...this.services[providerId],
						...connection
					});
					return {
						id: body.id,
						name: requiredText(syntheticDefault ? body.id : body.name || body.id, "name", 100),
						description: optionalText$1(syntheticDefault ? "Existing Mnemon Store discovered on disk." : body.description, "description", MEMORY_SPACE_DESCRIPTION_MAX_LENGTH),
						active: body.active === true,
						providerId,
						...placement === void 0 ? {} : { placement },
						...connection === void 0 ? {} : { connection },
						createdAt: body.createdAt,
						updatedAt: body.updatedAt
					};
				});
			}
		} catch {
			this.spaces = [];
		}
		if (this.persistent && existsSync(this.providerRegistryPath)) try {
			const parsed = JSON.parse(readFileSync(this.providerRegistryPath, "utf8"));
			if ((parsed.version === 3 || parsed.version === PROVIDER_REGISTRY_VERSION) && typeof parsed.services === "object" && parsed.services !== null) for (const [providerId, settings] of Object.entries(parsed.services)) {
				if (!storedProviderId(providerId) || typeof settings !== "object" || settings === null) continue;
				if (this.providerCatalog.has(providerId) && this.isNative(providerId)) continue;
				this.services[providerId] = this.providerCatalog.has(providerId) ? this.providerCatalog.normalizeService(providerId, settings) : storedProviderConnection(settings);
				this.serviceEnabled[providerId] = parsed.enabled === void 0 ? true : parsed.enabled[providerId] === true;
			}
			if ((parsed.version === 1 || parsed.version === 2 || parsed.version === 3 || parsed.version === PROVIDER_REGISTRY_VERSION) && Array.isArray(parsed.bodies)) {
				migratedProviderRegistry ||= parsed.version !== PROVIDER_REGISTRY_VERSION;
				const existingIds = new Set(this.spaces.map((body) => body.id));
				this.spaces.push(...parsed.bodies.filter((body) => storedProviderId(body.providerId) && (!this.providerCatalog.has(body.providerId) || !this.isNative(body.providerId)) && MEMORY_SPACE_ID_PATTERN.test(body.id) && !existingIds.has(body.id)).map((body) => {
					const providerId = body.providerId;
					if (!this.providerCatalog.has(providerId)) return {
						id: body.id,
						name: requiredText(body.name || body.id, "name", 100),
						description: optionalText$1(body.description, "description", MEMORY_SPACE_DESCRIPTION_MAX_LENGTH),
						active: body.active === true,
						providerId,
						...typeof body.externalId !== "string" || body.externalId.trim() === "" ? {} : { externalId: body.externalId.trim() },
						...body.metadataSource === "provider" || body.metadataSource === "manual" || body.metadataSource === "ai" ? { metadataSource: body.metadataSource } : {},
						connection: storedProviderConnection(body.connection ?? body.openViking),
						createdAt: body.createdAt,
						updatedAt: body.updatedAt
					};
					const placement = normalizePlacementDecision(body.placement, providerId, this.providerCatalog);
					const rawConnection = body.connection ?? (this.providerTypeId(providerId) === "openviking" && body.openViking !== void 0 ? body.openViking : void 0);
					const split = parsed.version === 3 || parsed.version === PROVIDER_REGISTRY_VERSION ? {
						service: {},
						memory: rawConnection ?? {}
					} : this.providerCatalog.split(providerId, rawConnection);
					if (parsed.version !== 3 && parsed.version !== PROVIDER_REGISTRY_VERSION && this.services[providerId] === void 0) {
						this.services[providerId] = this.providerCatalog.normalizeService(providerId, split.service);
						this.serviceEnabled[providerId] = true;
					}
					const connection = this.providerCatalog.normalizeMemory(providerId, split.memory);
					this.providerCatalog.normalize(providerId, {
						...this.services[providerId],
						...connection
					});
					return {
						id: body.id,
						name: requiredText(body.name || body.id, "name", 100),
						description: optionalText$1(body.description, "description", MEMORY_SPACE_DESCRIPTION_MAX_LENGTH),
						active: body.active === true,
						providerId,
						...typeof body.externalId !== "string" || body.externalId.trim() === "" ? {} : { externalId: body.externalId.trim() },
						...body.metadataSource === "provider" || body.metadataSource === "manual" || body.metadataSource === "ai" ? { metadataSource: body.metadataSource } : {},
						...placement === void 0 ? {} : { placement },
						connection,
						createdAt: body.createdAt,
						updatedAt: body.updatedAt
					};
				}));
			}
		} catch {}
		if (this.persistent && existsSync(this.disconnectsPath)) try {
			const parsed = JSON.parse(readFileSync(this.disconnectsPath, "utf8"));
			if (parsed.version === DISCONNECTS_VERSION && typeof parsed.providers === "object" && parsed.providers !== null) for (const [providerId, entries] of Object.entries(parsed.providers)) {
				const remembered = storedDisconnects(entries);
				if (storedProviderId(providerId) && remembered.length > 0) this.disconnected[providerId] = remembered;
			}
		} catch {}
		const retainedBodies = this.spaces.filter((body) => !this.providerCatalog.has(body.providerId) || this.isNative(body.providerId) || this.providerServiceEnabled(body.providerId));
		if (retainedBodies.length !== this.spaces.length) {
			this.spaces = retainedBodies;
			migratedProviderRegistry = true;
		}
		this.reconcileDiscoveredStores();
		if (migratedSyntheticDefault || migratedProviderRegistry) this.save();
	}
	reconcileDiscoveredStores() {
		if (!this.persistent || !existsSync(this.directory)) return;
		const timestamp = this.now().toISOString();
		const legacyActive = this.runner.effectiveStore();
		let changed = false;
		const knownIds = new Set(this.spaces.map((body) => body.id));
		for (const entry of readdirSync(this.directory, { withFileTypes: true })) {
			if (!entry.isDirectory() || !MEMORY_SPACE_ID_PATTERN.test(entry.name) || !existsSync(join(this.directory, entry.name, "mnemon.db"))) continue;
			if (knownIds.has(entry.name)) continue;
			this.spaces.push({
				id: entry.name,
				name: entry.name,
				description: "Existing Mnemon Store discovered on disk.",
				active: this.spaces.length === 0 || entry.name === legacyActive,
				providerId: NATIVE_PROVIDER_ID,
				createdAt: timestamp,
				updatedAt: timestamp
			});
			knownIds.add(entry.name);
			changed = true;
		}
		if (changed) this.save();
	}
	nativeStoreIds() {
		if (!existsSync(this.directory)) return [];
		return readdirSync(this.directory, { withFileTypes: true }).filter((entry) => entry.isDirectory() && MEMORY_SPACE_ID_PATTERN.test(entry.name)).map((entry) => entry.name).sort();
	}
	nextTimestamp(previous, candidate = this.now().toISOString()) {
		if (previous === void 0) return candidate;
		const previousTime = Date.parse(previous);
		const candidateTime = Date.parse(candidate);
		if (!Number.isFinite(previousTime) || !Number.isFinite(candidateTime) || candidateTime > previousTime) return candidate;
		return new Date(previousTime + 1).toISOString();
	}
	view(body) {
		const descriptor = this.providerCatalog.descriptor(body.providerId);
		const nativeProvider = this.isNative(body.providerId);
		const connection = nativeProvider ? {} : this.connectionFor(body);
		const effectivePublicConnection = this.providerCatalog.public(body.providerId, connection);
		const publicConnection = nativeProvider ? effectivePublicConnection : this.providerCatalog.publicScoped(body.providerId, "memory", body.connection ?? {});
		const location = nativeProvider ? join(this.directory, body.id, MEMORY_SPACE_DATABASE_FILE) : providerDisplayLocation(descriptor, connection);
		const provider = {
			id: descriptor.id,
			...descriptor.typeId === void 0 || descriptor.typeId === descriptor.id ? {} : { typeId: descriptor.typeId },
			label: descriptor.label,
			...descriptor.icon === void 0 ? {} : { icon: descriptor.icon },
			origin: descriptor.origin,
			kind: descriptor.kind,
			location,
			...typeof connection.targetUri === "string" && connection.targetUri !== "" ? { targetUri: connection.targetUri } : {},
			...typeof connection.account === "string" && connection.account !== "" ? { account: connection.account } : {},
			...typeof connection.user === "string" && connection.user !== "" ? { user: connection.user } : {},
			...typeof connection.actorPeerId === "string" && connection.actorPeerId !== "" ? { actorPeerId: connection.actorPeerId } : {},
			apiKeyConfigured: effectivePublicConnection.configuredSecrets.includes("apiKey"),
			...publicConnection,
			capabilities: descriptor.capabilities
		};
		const { providerId: _providerId, externalId: _externalId, metadataSource: _metadataSource, connection: _connection, openViking: _openViking, ...metadata } = body;
		return {
			...metadata,
			dbPath: nativeProvider ? provider.location : "",
			provider
		};
	}
	save() {
		if (!this.persistent) return;
		mkdirSync(this.directory, {
			recursive: true,
			mode: 448
		});
		const nativeBodies = this.spaces.filter((body) => body.providerId === "mnemon-native" || this.providerCatalog.has(body.providerId) && this.isNative(body.providerId)).map(({ providerId: _providerId, connection: _connection, openViking: _openViking, ...body }) => body);
		this.writeRegistry(this.registryPath, {
			version: NATIVE_REGISTRY_VERSION,
			bodies: nativeBodies
		});
		const providerBodies = this.spaces.filter((body) => body.providerId !== "mnemon-native" && (!this.providerCatalog.has(body.providerId) || !this.isNative(body.providerId)));
		if (providerBodies.length === 0 && Object.keys(this.services).length === 0) {
			rmSync(this.providerRegistryPath, { force: true });
			this.state.diskRevision = this.diskRevision();
			return;
		}
		mkdirSync(join(this.runner.effectiveDataDir(), "state"), {
			recursive: true,
			mode: 448
		});
		this.writeRegistry(this.providerRegistryPath, {
			version: PROVIDER_REGISTRY_VERSION,
			services: this.services,
			enabled: this.serviceEnabled,
			bodies: providerBodies
		});
		this.state.diskRevision = this.diskRevision();
	}
	saveDisconnects() {
		if (!this.persistent) return;
		const providers = Object.fromEntries(Object.entries(this.disconnected).filter(([, entries]) => entries !== void 0 && entries.length > 0));
		if (Object.keys(providers).length === 0) rmSync(this.disconnectsPath, { force: true });
		else {
			mkdirSync(dirname(this.disconnectsPath), {
				recursive: true,
				mode: 448
			});
			this.writeRegistry(this.disconnectsPath, {
				version: DISCONNECTS_VERSION,
				providers
			});
		}
		this.state.diskRevision = this.diskRevision();
	}
	writeRegistry(path, file) {
		const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
		writeFileSync(temporary, `${JSON.stringify(file, null, 2)}\n`, {
			encoding: "utf8",
			mode: 384
		});
		renameSync(temporary, path);
	}
};
//#endregion
//#region src/embedding-credentials.ts
/** The Host never exports this value to the browser or serializes it into configuration. */
async function embeddingApiKey(config, read, environment = process.env) {
	if (config.apiKeyEnv) {
		const key = environment[config.apiKeyEnv]?.trim();
		if (!key) throw new Error("Embedding API key environment variable is unset or empty: " + config.apiKeyEnv);
		return checkedKey(key);
	}
	if (!config.apiKeyRef) return config.apiKey;
	if (!EMBEDDING_CREDENTIAL_REFERENCE.test(config.apiKeyRef)) throw new Error("Invalid embedding credential reference");
	if (read === void 0) throw new Error("Embedding credential storage is unavailable; use apiKeyEnv or enable the DSH credentials service");
	let record;
	try {
		record = await read(config.apiKeyRef);
	} catch {
		throw new Error("Cannot read the saved embedding credential; check the DSH credentials service");
	}
	const grant = record;
	if (grant?.kind !== "grant" || grant.payload?.version !== 1 || typeof grant.payload.apiKey !== "string") throw new Error("Saved embedding credential is missing or invalid; save a new key");
	if (grant.payload.endpoint !== config.endpoint) throw new Error("Saved embedding credential belongs to another endpoint; save a new key for this endpoint");
	return checkedKey(grant.payload.apiKey);
}
function checkedKey(key) {
	if (!key || key.length > 2048 || /[\u0000-\u001f\u007f]/u.test(key)) throw new Error("Embedding API key must contain 1..2048 characters without control characters");
	return key;
}
//#endregion
//#region src/runner.ts
var MnemonCliError = class extends Error {
	reason;
	constructor(message, reason) {
		super(message);
		this.reason = reason;
		this.name = "MnemonCliError";
	}
};
const EMBEDDING_ENVIRONMENT_KEYS = /* @__PURE__ */ new Set([
	"MNEMON_EMBED_ENDPOINT",
	"MNEMON_EMBED_MODEL",
	"MNEMON_EMBED_API_KEY",
	"MNEMON_EMBED_PROTOCOL"
]);
/**
* Explain a CLI call that produced no result. Only a failed launch means the
* executable is missing or unusable, so only that case carries the install
* hint; a timeout, a cancellation or an oversized output names its own cause.
*/
function processFailureMessage(error, args) {
	const detail = error instanceof Error ? error.message : String(error);
	const reason = error instanceof ProcessError ? error.reason : "launch";
	const command = args.find((arg) => !arg.startsWith("-"));
	if (reason === "output-limit") return `mnemon ${command ?? "command"} stopped: ${detail.replace(/^mnemon /u, "")}`;
	if (reason === "timeout" && command !== void 0) return detail.replace(/^mnemon /u, `mnemon ${command} `);
	if (reason !== "launch") return detail;
	return `${detail}. ${process.platform === "win32" ? "Install Mnemon with npm install -g @mnemon-dev/mnemon or pnpm add -g @mnemon-dev/mnemon, or use the official Windows release. Ensure DSH can see PATH or PNPM_HOME, or set MNEMON_CLI_PATH or mnemon.cliPath to its absolute path." : "Install Mnemon and ensure \"mnemon\" is on PATH, or set MNEMON_CLI_PATH or mnemon.cliPath."}`;
}
/** Preserve the Host environment while making saved embedding overrides authoritative. */
async function processEnvironment(config, read) {
	if (!config.embedding.enabled) return void 0;
	return {
		...Object.fromEntries(Object.entries(process.env).filter(([key]) => !EMBEDDING_ENVIRONMENT_KEYS.has(key.toUpperCase()))),
		MNEMON_EMBED_ENDPOINT: config.embedding.endpoint,
		MNEMON_EMBED_MODEL: config.embedding.model,
		MNEMON_EMBED_API_KEY: await embeddingApiKey(config.embedding, read),
		...config.embedding.protocol === "auto" ? {} : { MNEMON_EMBED_PROTOCOL: config.embedding.protocol }
	};
}
function createRunner(config, processRunner = runProcess, readCredential) {
	const currentCommand = () => findMnemonCommand(config) ?? config.cliPath ?? "mnemon";
	const globalArgs = (store) => {
		const args = ["--data-dir", effectiveDataDir()];
		if (store !== void 0) args.push("--store", store);
		else if (config.store !== void 0) args.push("--store", config.store);
		return args;
	};
	const effectiveDataDir = () => config.dataDir;
	const persistedStore = () => {
		const active = join(effectiveDataDir(), MNEMON_ACTIVE_STORE_FILE);
		if (existsSync(active)) try {
			const value = readFileSync(active, "utf8").trim();
			if (MEMORY_SPACE_ID_PATTERN.test(value)) return value;
		} catch {}
		return "default";
	};
	const launch = async (args, options = {}) => {
		if (options.signal?.aborted === true) throw new MnemonCliError(`mnemon command aborted: ${String(options.signal.reason ?? "cancelled")}`, "aborted");
		if (options.database !== void 0 && !existsSync(options.database)) throw new MnemonCliError(`mnemon ${args.find((arg) => !arg.startsWith("-")) ?? "command"}: no database at ${options.database}`, "no-database");
		const argv = options.globalFlags === false ? [...args] : [...globalArgs(options.store), ...args];
		const environment = await processEnvironment(config, readCredential);
		const safeError = (message) => environment?.MNEMON_EMBED_API_KEY ? message.replaceAll(environment.MNEMON_EMBED_API_KEY, "[redacted]") : message;
		const processOptions = {
			timeoutMs: options.timeoutMs ?? config.timeoutMs,
			...environment === void 0 ? {} : { env: environment },
			...options.signal === void 0 ? {} : { signal: options.signal },
			...options.maxOutputBytes === void 0 ? {} : { maxOutputBytes: options.maxOutputBytes }
		};
		let result;
		try {
			const invocation = resolveMnemonInvocation(currentCommand(), argv, environment);
			result = await processRunner(invocation.command, invocation.args, {
				...processOptions,
				...invocation.env === void 0 ? {} : { env: invocation.env }
			});
		} catch (error) {
			throw new MnemonCliError(safeError(processFailureMessage(error, args)), error instanceof ProcessError ? error.reason : "launch");
		}
		if (result.exitCode !== 0) {
			const detail = safeError(result.stderr.trim() || result.stdout.trim() || "no output");
			throw new MnemonCliError(`mnemon ${args.join(" ")} exited ${String(result.exitCode)}: ${detail}`);
		}
		return result.stdout;
	};
	const execute = (args, options = {}) => {
		return withMemoryStorageLock(effectiveDataDir(), () => launch(args, options));
	};
	return {
		get command() {
			return currentCommand();
		},
		get commandFound() {
			const found = findMnemonCommand(config);
			return found !== void 0 && isMnemonExecutable(found);
		},
		async runJson(args, options) {
			const stdout = await execute(args, options);
			try {
				return JSON.parse(stdout);
			} catch {
				throw new MnemonCliError(`mnemon ${args.join(" ")} returned invalid JSON`);
			}
		},
		runText: execute,
		runTextBatch(commands) {
			return withMemoryStorageLock(effectiveDataDir(), async () => {
				const outputs = [];
				for (const command of commands) outputs.push(await launch(command.args, command.options));
				return outputs;
			});
		},
		effectiveDataDir() {
			return effectiveDataDir();
		},
		persistedStore() {
			return persistedStore();
		},
		effectiveStore() {
			if (config.store !== void 0) return config.store;
			const fromEnvironment = process.env.MNEMON_STORE?.trim();
			if (fromEnvironment !== void 0 && fromEnvironment !== "") return fromEnvironment;
			return persistedStore();
		}
	};
}
//#endregion
//#region src/provider-placement.ts
const CAPABILITY_LABELS = {
	graph: "typed graph",
	entities: "entity index",
	related: "related-memory traversal",
	"exact-write": "exact writes",
	link: "explicit links",
	forget: "safe forget"
};
const CAPABILITIES = new Set(Object.keys(CAPABILITY_LABELS));
const PREFERENCES = /* @__PURE__ */ new Set([
	"balanced",
	"local-first",
	"shared-first"
]);
function supports(candidate, capability) {
	if (capability === "exact-write") return candidate.capabilities.writeMode === "exact";
	return candidate.capabilities[capability];
}
function boundedPrompt(value) {
	const normalized = value?.trim() ?? "";
	if (normalized.length > 4e3) throw new Error("provider placement prompt is too long (max 4000 characters)");
	return normalized;
}
function uniqueProviderIds(ids) {
	if (ids === void 0) return void 0;
	return [...new Set(ids)];
}
function prepareMemoryPlacement(request, candidates) {
	if (request.mode !== "automatic") throw new Error(`unsupported provider placement mode: ${String(request.mode)}`);
	const prompt = boundedPrompt(request.prompt);
	const rules = request.rules ?? {};
	const allowed = uniqueProviderIds(rules.allowedProviderIds);
	const required = [...new Set(rules.requiredCapabilities ?? [])];
	const candidateIds = new Set(candidates.map((candidate) => candidate.id));
	for (const providerId of allowed ?? []) if (!candidateIds.has(providerId)) throw new Error(`unsupported memory provider in placement rules: ${String(providerId)}`);
	if (rules.dataBoundary !== void 0 && rules.dataBoundary !== "allow-remote" && rules.dataBoundary !== "local-only") throw new Error(`unsupported data boundary: ${String(rules.dataBoundary)}`);
	for (const capability of required) if (!CAPABILITIES.has(capability)) throw new Error(`unsupported required memory capability: ${String(capability)}`);
	if (rules.preference !== void 0 && !PREFERENCES.has(rules.preference)) throw new Error(`unsupported provider placement preference: ${String(rules.preference)}`);
	const appliedRules = [];
	let eligible = candidates.filter((candidate) => candidate.configured);
	if (allowed !== void 0) {
		if (allowed.length === 0) throw new Error("automatic provider placement requires at least one allowed provider");
		eligible = eligible.filter((candidate) => allowed.includes(candidate.id));
		appliedRules.push(`allowed:${allowed.join(",")}`);
	}
	if (rules.dataBoundary === "local-only") {
		eligible = eligible.filter((candidate) => candidate.kind === "local");
		appliedRules.push("data-boundary:local-only");
	}
	for (const capability of required) {
		eligible = eligible.filter((candidate) => supports(candidate, capability));
		appliedRules.push(`requires:${capability}`);
	}
	const preference = rules.preference ?? "balanced";
	appliedRules.push(`preference:${preference}`);
	if (eligible.length === 0) {
		const requirements = required.map((value) => CAPABILITY_LABELS[value]).join(", ");
		throw new Error(`no configured memory provider satisfies the placement rules${requirements === "" ? "" : ` (${requirements})`}`);
	}
	const selectorBrief = [
		`Soft preference: ${preference}.`,
		"Eligible providers after host-enforced rules:",
		...eligible.map((candidate) => {
			const capabilities = [
				...Object.entries(candidate.capabilities).filter(([key, value]) => typeof value === "boolean" && value).map(([key]) => key),
				`writeMode=${candidate.capabilities.writeMode}`,
				`deletionMode=${candidate.capabilities.deletionMode}`
			];
			return `- ${candidate.id} (${candidate.label}, ${candidate.kind}): ${candidate.summary} Capabilities: ${capabilities.join(", ")}.`;
		})
	].join("\n");
	return {
		prompt,
		candidates: eligible,
		appliedRules,
		selectorBrief
	};
}
function rulesOnlyPlacement(prepared, now = () => /* @__PURE__ */ new Date()) {
	const candidate = prepared.candidates.length === 1 ? prepared.candidates[0] : void 0;
	if (candidate === void 0) return void 0;
	return {
		mode: "automatic",
		providerId: candidate.id,
		decidedBy: "rules",
		reason: `Only ${candidate.label} satisfies the configured placement rules.`,
		confidence: "high",
		candidateProviderIds: [candidate.id],
		appliedRules: prepared.appliedRules,
		decidedAt: now().toISOString()
	};
}
function finalizeLlmPlacement(prepared, selection, delegation, now = () => /* @__PURE__ */ new Date()) {
	const providerId = selection.providerId.trim();
	if (!prepared.candidates.some((candidate) => candidate.id === providerId)) throw new Error(`memory placement model selected an ineligible provider: ${selection.providerId}`);
	const reason = selection.reason.trim();
	if (reason === "") throw new Error("memory placement model returned no reason");
	if (reason.length > 1e3) throw new Error("memory placement reason is too long (max 1000 characters)");
	const confidence = selection.confidence.trim();
	if (confidence !== "high" && confidence !== "medium" && confidence !== "low") throw new Error(`memory placement model returned invalid confidence: ${selection.confidence}`);
	return {
		mode: "automatic",
		providerId,
		decidedBy: "llm",
		reason,
		confidence,
		candidateProviderIds: prepared.candidates.map((candidate) => candidate.id),
		appliedRules: prepared.appliedRules,
		decidedAt: now().toISOString(),
		runId: delegation.runId,
		subagentProvider: delegation.provider
	};
}
//#endregion
//#region src/search-tokens.ts
/** Memory Spaces lexical fallback; no Core dependency. */
/** Small deterministic tokenizer shared by local Document and Native recovery. */
function lexicalSearchTokens(value, maximum = 64) {
	const normalized = value.normalize("NFKC").toLocaleLowerCase();
	const tokens = [];
	for (const segment of normalized.split(/(\p{Script=Han}+)/gu)) {
		if (/^\p{Script=Han}+$/u.test(segment)) {
			const characters = [...segment];
			if (characters.length <= 2) tokens.push(segment);
			else for (let index = 0; index < characters.length - 1; index += 1) tokens.push(`${characters[index]}${characters[index + 1]}`);
			continue;
		}
		tokens.push(...(segment.match(/[\p{L}\p{N}_-]+/gu) ?? []).filter((token) => token.length >= 2));
	}
	return [...new Set(tokens)].slice(0, maximum);
}
function lexicalTokenMatchCount(value, tokens) {
	const available = new Set(lexicalSearchTokens(value, 512));
	return tokens.filter((token) => available.has(token)).length;
}
/** Require broader coverage only after a query is focused enough to support it. */
function lexicalRequiredMatchCount(tokens) {
	if (tokens.length === 0) return 0;
	if (tokens.length < 4) return 1;
	return Math.max(2, Math.ceil(tokens.length / 4));
}
//#endregion
//#region src/entity-index.ts
/**
* The most memories one space's derived index asks list() for. Mnemon Native
* lists a whole store; a Provider that stops earlier reports what it listed.
*/
const ENTITY_INDEX_LIST_LIMIT = 1e5;
/** The rail lists at most this many entities; the rest stay reachable by name. */
const ENTITY_RAIL_LIMIT = 5e3;
function buildSpaceEntityIndex(memories, memoryCount, complete) {
	const kept = [];
	const byKey = /* @__PURE__ */ new Map();
	const spellings = /* @__PURE__ */ new Map();
	for (const memory of memories) {
		const seen = /* @__PURE__ */ new Set();
		let position;
		for (const raw of memory.entities ?? []) {
			if (typeof raw !== "string") continue;
			const key = normalizeEntityKey(raw);
			if (key === "" || seen.has(key)) continue;
			seen.add(key);
			if (position === void 0) {
				position = kept.length;
				kept.push(memory);
			}
			const positions = byKey.get(key);
			if (positions === void 0) byKey.set(key, [position]);
			else positions.push(position);
			const name = raw.normalize("NFKC").trim();
			const names = spellings.get(key);
			if (names === void 0) spellings.set(key, /* @__PURE__ */ new Map([[name, 1]]));
			else names.set(name, (names.get(name) ?? 0) + 1);
		}
	}
	return {
		memories: kept,
		byKey,
		spellings,
		memoryCount,
		complete
	};
}
/** The spelling most memories use; the first one seen wins a tie. */
function preferredSpelling(names) {
	let preferred = "";
	let most = 0;
	for (const [name, count] of names) if (count > most) {
		preferred = name;
		most = count;
	}
	return preferred;
}
/** Merge per-space indexes into one entity list, most frequent first. */
function mergeEntityCounts(indexes) {
	const counts = /* @__PURE__ */ new Map();
	const spellings = /* @__PURE__ */ new Map();
	for (const index of indexes) for (const [key, positions] of index.byKey) {
		counts.set(key, (counts.get(key) ?? 0) + positions.length);
		let totals = spellings.get(key);
		if (totals === void 0) spellings.set(key, totals = /* @__PURE__ */ new Map());
		for (const [name, count] of index.spellings.get(key) ?? []) totals.set(name, (totals.get(name) ?? 0) + count);
	}
	const names = /* @__PURE__ */ new Map();
	for (const [key, totals] of spellings) names.set(key, preferredSpelling(totals));
	return {
		items: [...counts].map(([key, count]) => ({
			entity: names.get(key),
			count
		})).sort((left, right) => right.count - left.count || left.entity.localeCompare(right.entity)),
		names
	};
}
/** Importance first, then the newest; the order Mnemon Native lists a store in. */
function compareEntityMemories(left, right) {
	return (right.importance ?? 0) - (left.importance ?? 0) || (right.createdAt ?? "").localeCompare(left.createdAt ?? "") || (left.memoryBodyName ?? "").localeCompare(right.memoryBodyName ?? "") || left.id.localeCompare(right.id);
}
/** Every memory across the indexes that carries the entity key. */
function memoriesWithEntity(indexes, key) {
	const memories = [];
	for (const index of indexes) for (const position of index.byKey.get(key) ?? []) memories.push(index.memories[position]);
	return memories.sort(compareEntityMemories);
}
//#endregion
//#region src/recall-quality/policies.ts
function expandedLimit(context) {
	return Math.min(50, Math.max(context.requestedLimit, Math.ceil(context.requestedLimit * context.config.candidateMultiplier)));
}
function scoreDecision(candidate, context, lowScoreAction, nonPositiveAction) {
	const score = candidate.insight.score;
	if (score === void 0) return {
		action: "keep",
		tier: "unknown",
		reason: "unscored"
	};
	if (!Number.isFinite(score)) return {
		action: "drop",
		tier: "unknown",
		reason: "invalid-score"
	};
	if (candidate.scoreSemantics?.kind === "provider-native") return {
		action: "keep",
		tier: "ranked",
		reason: "native-score"
	};
	if (candidate.scoreSemantics?.kind !== "normalized-relevance") return {
		action: "keep",
		tier: "unknown",
		reason: "unscaled-score"
	};
	if (score <= 0) return {
		action: nonPositiveAction,
		tier: "low",
		reason: "non-positive-score",
		normalizedScore: 0
	};
	if (score > 1) return {
		action: "keep",
		tier: "ranked",
		reason: "out-of-range-score"
	};
	if (score < context.config.lowScoreThreshold) return {
		action: lowScoreAction,
		tier: "low",
		reason: "low-score",
		normalizedScore: score
	};
	if (score < context.config.highScoreThreshold) return {
		action: "keep",
		tier: "medium",
		reason: "medium-score",
		normalizedScore: score
	};
	return {
		action: "keep",
		tier: "high",
		reason: "high-score",
		normalizedScore: score
	};
}
function primarySelection(candidates, context) {
	return candidates.filter((candidate) => candidate.decision.action === "keep").slice(0, context.requestedLimit);
}
const STRICT_RECALL_QUALITY_POLICY = {
	id: "strict-v1",
	candidateLimit: expandedLimit,
	evaluate: (candidate, context) => scoreDecision(candidate, context, "drop", "drop"),
	select(candidates, context) {
		const kept = candidates.filter((candidate) => candidate.decision.action === "keep");
		let medium = 0;
		let ranked = 0;
		const scored = kept.filter(({ decision }) => decision.tier === "medium" ? medium++ < context.config.maxMediumResults : decision.tier === "ranked" && ranked++ < context.config.maxRankedResults);
		return [
			...kept.filter((candidate) => candidate.decision.tier === "high"),
			...scored,
			...kept.filter((candidate) => candidate.decision.tier === "unknown").slice(0, context.config.maxUnknownResults)
		].slice(0, context.requestedLimit);
	}
};
const BUILTIN_RECALL_QUALITY_POLICIES = [
	STRICT_RECALL_QUALITY_POLICY,
	{
		id: "balanced-v1",
		candidateLimit: expandedLimit,
		evaluate: (candidate, context) => scoreDecision(candidate, context, "keep", "drop"),
		select(candidates, context) {
			const kept = candidates.filter((candidate) => candidate.decision.action === "keep");
			return [...kept.filter((candidate) => candidate.decision.tier !== "low"), ...kept.filter((candidate) => candidate.decision.tier === "low")].slice(0, context.requestedLimit);
		}
	},
	{
		id: "exhaustive-v1",
		candidateLimit: expandedLimit,
		evaluate: (candidate, context) => scoreDecision(candidate, context, "keep", "keep"),
		select: primarySelection
	}
];
//#endregion
//#region src/recall-quality/engine.ts
const ACTIONS = /* @__PURE__ */ new Set(["keep", "drop"]);
const TIERS = /* @__PURE__ */ new Set([
	"high",
	"medium",
	"ranked",
	"low",
	"unknown"
]);
const REASONS = /* @__PURE__ */ new Set([
	"high-score",
	"medium-score",
	"low-score",
	"non-positive-score",
	"invalid-score",
	"native-score",
	"out-of-range-score",
	"unscaled-score",
	"unscored"
]);
function assertDecision(decision) {
	if (typeof decision !== "object" || decision === null || !ACTIONS.has(decision.action) || !TIERS.has(decision.tier) || !REASONS.has(decision.reason)) throw new Error("recall quality policy returned an invalid decision");
	if (decision.normalizedScore !== void 0 && (!Number.isFinite(decision.normalizedScore) || decision.normalizedScore < 0 || decision.normalizedScore > 1)) throw new Error("recall quality policy returned an invalid normalized score");
}
function runPolicy(policy, candidates, context) {
	const evaluated = candidates.map((candidate) => {
		const decision = policy.evaluate(candidate, context);
		assertDecision(decision);
		return {
			candidate,
			decision
		};
	});
	const eligible = new Set(evaluated.filter((candidate) => candidate.decision.action === "keep"));
	const selected = policy.select(evaluated, context);
	if (!Array.isArray(selected) || selected.length > context.requestedLimit) throw new Error("recall quality policy returned too many results");
	const seen = /* @__PURE__ */ new Set();
	for (const candidate of selected) {
		if (!eligible.has(candidate) || seen.has(candidate)) throw new Error("recall quality policy selected an ineligible or duplicate result");
		seen.add(candidate);
	}
	return {
		evaluated,
		selected
	};
}
function prepareRecallQualityPolicy(policy, context, fallback = STRICT_RECALL_QUALITY_POLICY) {
	try {
		const candidateLimit = policy.candidateLimit(context);
		if (!Number.isInteger(candidateLimit) || candidateLimit < context.requestedLimit || candidateLimit > 50) throw new Error("invalid candidate limit");
		return {
			policy,
			candidateLimit
		};
	} catch {
		if (policy === fallback) throw new Error(`recall quality policy ${policy.id} returned an invalid candidate limit`);
		return {
			policy: fallback,
			candidateLimit: fallback.candidateLimit(context),
			fallbackFrom: policy.id
		};
	}
}
function applyRecallQualityPolicy(prepared, candidates, context, fallback = STRICT_RECALL_QUALITY_POLICY) {
	try {
		return {
			policyId: prepared.policy.id,
			...runPolicy(prepared.policy, candidates, context),
			...prepared.fallbackFrom === void 0 ? {} : { fallbackFrom: prepared.fallbackFrom }
		};
	} catch {
		if (prepared.policy === fallback) throw new Error(`recall quality policy ${prepared.policy.id} failed`);
		return {
			policyId: fallback.id,
			fallbackFrom: prepared.policy.id,
			...runPolicy(fallback, candidates, context)
		};
	}
}
//#endregion
//#region src/recall-quality/registry.ts
var RecallQualityPolicyRegistry = class {
	policies = /* @__PURE__ */ new Map();
	constructor(policies = BUILTIN_RECALL_QUALITY_POLICIES) {
		for (const policy of policies) this.register(policy);
	}
	register(policy) {
		const id = policy.id.trim();
		if (!/^[a-z][a-z0-9-]{0,63}$/u.test(id)) throw new Error("recall quality policy id must match [a-z][a-z0-9-]{0,63}");
		if (this.policies.has(id)) throw new Error(`recall quality policy is already registered: ${id}`);
		this.policies.set(id, policy);
		return () => {
			if (this.policies.get(id) === policy) this.policies.delete(id);
		};
	}
	resolve(id) {
		const policy = this.policies.get(id);
		if (policy === void 0) throw new Error(`unknown recall quality policy: ${id}`);
		return policy;
	}
	ids() {
		return [...this.policies.keys()];
	}
};
const recallQualityPolicies = new RecallQualityPolicyRegistry();
//#endregion
//#region src/service.ts
/**
* Providers whose native search is a single bounded request while their browse
* projection fans out to multiple resources or collections. Prefer search for
* metadata sampling so AI maintenance never pays for a detailed projection.
*/
const METADATA_SEARCH_FIRST_PROVIDERS = /* @__PURE__ */ new Set([
	"openviking",
	"supermemory",
	"byterover"
]);
function record(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function text(value) {
	return typeof value === "string" ? value : void 0;
}
function number(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/**
* How long a selection reuses the Provider health its index was checked with.
* The rail always checks again; a write through this Source drops both at once.
*/
const ENTITY_SELECTION_STATUS_REUSE_MS = 1e4;
/** How long an index that statistics cannot check is reused; a write through this Source still drops it. */
const ENTITY_INDEX_UNCHECKED_REUSE_MS = 1e4;
/** How long one Provider may take to list its namespaces when they are asked for again. */
const MEMORY_SPACES_REDISCOVERY_PROVIDER_TIMEOUT_MS = 3e4;
/**
* Rediscovery per data directory, shared by every generation in this process: the pass now
* running, which a second request joins, and the last one, which the Memory Spaces page shows.
*/
const rediscoveries = /* @__PURE__ */ new Map();
/** Settle with `work`, or reject once `signal` aborts, whichever comes first. */
function untilAborted(work, signal) {
	if (signal.aborted) {
		work.catch(() => {});
		return Promise.reject(signal.reason);
	}
	return new Promise((resolve, reject) => {
		const abort = () => reject(signal.reason);
		signal.addEventListener("abort", abort, { once: true });
		work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
	});
}
function entityName(entity) {
	const name = entity.trim();
	if (name.length > 200) throw new Error("entity is too long (max 200 characters)");
	return name;
}
function memoryKey(memoryBodyId, id) {
	return `${memoryBodyId}\u0000${id}`;
}
/**
* What must stay the same for a space's entity index to stay valid: its
* Provider statistics (Mnemon counts every write in its operation log) and the
* Source's own record of the space. Without statistics it cannot be checked.
*/
function entityIndexFingerprint(body, status) {
	const stats = status.stats;
	if (stats === void 0) return void 0;
	return JSON.stringify([
		body.provider.id,
		body.updatedAt,
		stats.totalInsights,
		stats.deletedInsights,
		stats.edgeCount,
		stats.oplogCount,
		stats.dbSizeBytes
	]);
}
function readSource(body, mode, status, itemCount, options = {}) {
	return {
		memoryBodyId: body.id,
		memoryBodyName: body.name,
		providerId: body.provider.id,
		providerLabel: body.provider.label,
		mode,
		status,
		itemCount,
		...options
	};
}
const MAX_EXACT_SEARCH_ANCHORS = 8;
const EXACT_SEARCH_ANCHOR = /(?<!\d)\d{4}-\d{1,2}-\d{1,2}(?!\d)|(?<![A-Za-z0-9])[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)+(?![A-Za-z0-9])|(?<!\d)\d+(?:[.,]\d+)?\s*(?:[%％]|percent(?:age)?)(?![A-Za-z])|百分之\s*\d+(?:[.,]\d+)?|(?<!\d)\d{1,2}:\d{2}(?!\d)|(?<![A-Za-z0-9])v?\d+\.\d+(?:\.\d+)*(?![A-Za-z0-9])|(?<![\d.])\d+(?![\d.%％:-])/giu;
function normalizedExactText(value) {
	return value.normalize("NFKC").toLocaleLowerCase().replace(/百分之\s*(\d+(?:[.,]\d+)?)/gu, "$1%").replace(/(\d+(?:[.,]\d+)?)\s*percent(?:age)?/giu, "$1%").replace(/\s+/gu, "");
}
/**
* Extract only high-information lexical values that a semantic paraphrase
* should not be allowed to erase. This is a deterministic fallback inside an
* already-authorized search, not another Recall trigger or model decision.
*/
function exactSearchAnchorPlan(query) {
	const anchors = [...new Set([...query.matchAll(EXACT_SEARCH_ANCHOR)].map((match) => normalizedExactText(match[0])))].slice(0, MAX_EXACT_SEARCH_ANCHORS);
	if (anchors.length < 2) return void 0;
	return {
		kind: "exact",
		terms: anchors,
		query: anchors.join(" "),
		requiredMatches: Math.min(4, anchors.length)
	};
}
function lexicalSearchRecoveryPlan(query) {
	const tokens = lexicalSearchTokens(query, 32);
	if (tokens.length < 4) return void 0;
	return {
		kind: "lexical",
		terms: tokens,
		query,
		requiredMatches: lexicalRequiredMatchCount(tokens)
	};
}
function recoveryMatchCount(content, plan) {
	if (plan.kind === "lexical") return lexicalTokenMatchCount(content, plan.terms);
	const normalized = normalizedExactText(content);
	return plan.terms.filter((anchor) => normalized.includes(anchor)).length;
}
function mergeRecoveryResults(original, recovered, plan, limit) {
	const admitted = recovered.map((insight) => ({
		insight,
		matches: recoveryMatchCount(insight.content, plan)
	})).filter((candidate) => candidate.matches >= plan.requiredMatches).sort((left, right) => right.matches - left.matches || (right.insight.score ?? 0) - (left.insight.score ?? 0)).map((candidate) => candidate.insight);
	const seen = /* @__PURE__ */ new Set();
	return [...admitted, ...original].filter((insight) => {
		if (seen.has(insight.id)) return false;
		seen.add(insight.id);
		return true;
	}).slice(0, limit);
}
/** Put query-covering evidence first before the smaller model envelope runs. */
function prioritizeRecoveryEvidence(selected, plan) {
	return selected.map((entry, index) => ({
		entry,
		index,
		matches: recoveryMatchCount(entry.candidate.insight.content, plan)
	})).sort((left, right) => {
		const leftAdmitted = left.matches >= plan.requiredMatches;
		const rightAdmitted = right.matches >= plan.requiredMatches;
		if (leftAdmitted !== rightAdmitted) return rightAdmitted ? 1 : -1;
		if (leftAdmitted && left.matches !== right.matches) return right.matches - left.matches;
		return left.index - right.index;
	}).map((candidate) => candidate.entry);
}
function insightColor(category) {
	if (category === "preference") return "#9b59b6";
	if (category === "decision") return "#e74c3c";
	if (category === "fact") return "#3498db";
	if (category === "insight") return "#2ecc71";
	if (category === "context") return "#f39c12";
	return "#6574d9";
}
function required(value, label, max) {
	const normalized = value.trim();
	if (normalized === "") throw new Error(`${label} is required`);
	if (normalized.length > max) throw new Error(`${label} is too long (max ${max} characters)`);
	return normalized;
}
function allowed(value, values, label) {
	if (value !== void 0 && !values.includes(value)) throw new Error(`${label} must be one of: ${values.join(", ")}`);
	return value;
}
function commaList(values, label, limit) {
	if (values === void 0) return void 0;
	const normalized = values.map((value) => value.trim()).filter((value) => value !== "");
	if (normalized.length > limit) throw new Error(`${label} accepts at most ${limit} values`);
	if (normalized.some((value) => value.includes(","))) throw new Error(`${label} values cannot contain commas`);
	return normalized.length === 0 ? void 0 : normalized.join(",");
}
const COMMITTED_MUTATION_STATES = /* @__PURE__ */ new Set([
	"added",
	"committed",
	"completed",
	"created",
	"deleted",
	"forgotten",
	"imported",
	"invalidated",
	"linked",
	"merged",
	"removed",
	"replaced",
	"stored",
	"succeeded",
	"success",
	"updated"
]);
const PENDING_MUTATION_STATES = /* @__PURE__ */ new Set([
	"accepted",
	"pending",
	"processing",
	"queued",
	"running"
]);
const FAILED_MUTATION_STATES = /* @__PURE__ */ new Set([
	"canceled",
	"cancelled",
	"error",
	"failed"
]);
const COMMITTED_MUTATION_COUNTS = [
	"created",
	"deleted",
	"edges_inserted",
	"imported",
	"removed",
	"stored",
	"updated"
];
/** Source-private translation of Provider receipts; Core does not interpret Provider payloads. */
function mutationResultCompletion(result) {
	if (typeof result !== "object" || result === null || Array.isArray(result)) return "unknown";
	const value = result;
	const states = [
		value.action,
		value.status,
		value.state
	].filter((entry) => typeof entry === "string").map((entry) => entry.trim().toLocaleLowerCase());
	const changed = COMMITTED_MUTATION_COUNTS.some((key) => typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] > 0);
	const errors = Array.isArray(value.errors) ? value.errors.length > 0 : typeof value.errors === "number" && value.errors > 0;
	if (states.includes("partial") || errors && changed) return "partial";
	if (value.success === false || value.ok === false || errors || states.some((state) => FAILED_MUTATION_STATES.has(state))) return "failed";
	if (states.includes("candidate")) return "candidate";
	if (states.some((state) => PENDING_MUTATION_STATES.has(state))) return "accepted";
	if (value.committed === false || value.durable === false || states.includes("skipped")) return "unknown";
	if (value.committed === true || value.durable === true || states.some((state) => COMMITTED_MUTATION_STATES.has(state)) || changed) return "committed";
	return "unknown";
}
function mutationResultCommitted(result) {
	return mutationResultCompletion(result) === "committed";
}
/** One `mnemon embed --status` answer, strictly validated. */
function embeddingCounts(value, requireModelProbe = false) {
	const output = record(value);
	const available = requireModelProbe ? output?.embedding_available : output?.embedding_available ?? output?.ollama_available;
	const model = text(output?.model)?.trim();
	const protocol = text(output?.protocol)?.trim();
	const totalInsights = number(output?.total_insights);
	const embedded = number(output?.embedded);
	const coverage = text(output?.coverage)?.trim();
	if (typeof available !== "boolean" || model === void 0 || model === "" || model.length > 200 || /[\u0000-\u001f\u007f]/u.test(model) || !Number.isInteger(totalInsights) || totalInsights < 0 || !Number.isInteger(embedded) || embedded < 0 || embedded > totalInsights || coverage === void 0 || !/^(?:100|\d{1,2})%$/u.test(coverage)) throw new Error("mnemon embed --status returned an invalid response");
	return {
		available,
		model,
		totalInsights,
		embedded,
		coverage,
		...protocol !== void 0 && protocol.length <= 32 && !/[\u0000-\u001f\u007f]/u.test(protocol) ? { protocol } : {}
	};
}
/** How long one fill of a space's vectors may run, and the longest step of it that holds the storage lock (#392). */
const EMBED_FILL_BUDGET_MS = 6e4;
const EMBED_FILL_STEP_MS = 1e4;
/** A whole percent, as Mnemon writes it, that reads 100% only when every memory has its vector. */
function coveragePercent(embedded, total) {
	return total === 0 ? "0%" : `${Math.floor(embedded * 100 / total)}%`;
}
/** Mnemon's reason for a failed call, without the usage it prints after its `Error:` line. */
function cliReason(error) {
	const detail = error instanceof Error ? error.message : String(error);
	return /\bError: ([^\n]+)/u.exec(detail)?.[1]?.trim() ?? detail.split("\n")[0].trim();
}
/** Whether a CLI call failed for this cause. */
function cliFailure(error, reason) {
	return error instanceof MnemonCliError && error.reason === reason;
}
var MemorySpacesService = class {
	runner;
	config;
	recallQualityPolicyRegistry;
	providerCatalog;
	memorySpaces;
	providers;
	recallQualityPolicy;
	spacesInFlight;
	/** One entity index per active entity space, valid while its fingerprint holds. */
	entityIndexCache = /* @__PURE__ */ new Map();
	/** settledAt stays undefined while the read runs, which every caller shares. */
	entityStatusCache = /* @__PURE__ */ new Map();
	/** The related read each page view is waiting for; a newer selection cancels the older one. */
	entityRelatedViews = /* @__PURE__ */ new Map();
	providersDisposed = false;
	/** The CLI version a full status last read, and the binary it read it from. */
	cliVersion;
	/** The CLI binary as the file system has it; another value after an update replaces it. */
	cliBinary() {
		try {
			const stat = statSync(this.runner.command);
			return `${this.runner.command}\0${stat.mtimeMs}\0${stat.size}`;
		} catch {
			return;
		}
	}
	providerTypeId(providerId) {
		const catalog = this.providerCatalog;
		if (!catalog.has(providerId)) return providerId;
		const descriptor = catalog.descriptor(providerId);
		return descriptor.typeId ?? descriptor.id;
	}
	isNativeProviderId(providerId) {
		return this.providerTypeId(providerId) === NATIVE_PROVIDER_ID;
	}
	isNativeSpace(body) {
		return isNativeProvider(body.provider);
	}
	constructor(runner, config, memorySpaces, recallQualityPolicyRegistry = recallQualityPolicies, providerAdapterRegistry = new MemoryProviderAdapterRegistry(), providerCatalog = EMPTY_MEMORY_PROVIDER_CATALOG) {
		this.runner = runner;
		this.config = config;
		this.recallQualityPolicyRegistry = recallQualityPolicyRegistry;
		this.providerCatalog = providerCatalog;
		this.memorySpaces = memorySpaces === void 0 ? new MemorySpaceRegistry(runner, true, () => /* @__PURE__ */ new Date(), providerCatalog) : providerCatalog === EMPTY_MEMORY_PROVIDER_CATALOG ? memorySpaces : memorySpaces.withProviderCatalog(providerCatalog);
		this.recallQualityPolicy = recallQualityPolicyRegistry.resolve(config.recallQuality.policy);
		this.providers = providerAdapterRegistry.create({
			memorySpaces: this.memorySpaces,
			memoryBodies: this.memorySpaces,
			config: this.config,
			nativeRunner: this.runner
		});
	}
	/** Release clients owned by one composable Memory Spaces generation. */
	async dispose() {
		if (this.providersDisposed) return;
		this.providersDisposed = true;
		const failures = [];
		for (const provider of [...this.providers.values()].reverse()) try {
			await provider.dispose?.();
		} catch (error) {
			failures.push(error);
		}
		this.providers.clear();
		if (failures.length > 0) throw new AggregateError(failures, "Memory Space Provider disposal failed");
	}
	async spaces(signal) {
		if (signal !== void 0) return this.collectSpaces(signal);
		if (this.spacesInFlight !== void 0) return this.spacesInFlight;
		const pending = this.collectSpaces();
		this.spacesInFlight = pending;
		try {
			return await pending;
		} finally {
			if (this.spacesInFlight === pending) this.spacesInFlight = void 0;
		}
	}
	/** Coalesce simultaneous Status/Memory-page probes without caching mutations. */
	async collectSpaces(signal) {
		const directory = this.spaceDirectory();
		const items = await Promise.all(directory.items.map(async (body) => {
			let status;
			if (!(body.providerEnabled !== false)) status = {
				healthy: false,
				error: `${body.provider.label} is disabled on the dsh-mnemon page under Plugins`
			};
			else try {
				status = await this.providerFor(body).status(body, signal);
			} catch (error) {
				status = {
					healthy: false,
					error: error instanceof Error ? error.message : String(error)
				};
			}
			const { statusLoading: _statusLoading, ...metadata } = body;
			return {
				...metadata,
				...status
			};
		}));
		return {
			...directory,
			items,
			activeCount: items.filter((body) => body.active && body.providerEnabled !== false).length,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	}
	/** Return the control-plane directory without waiting for provider I/O. */
	spaceDirectory() {
		const mnemonDefaultStore = this.runner.persistedStore();
		const all = this.memorySpaces.list();
		const enabled = new Set(this.memorySpaces.providerServices().items.filter((service) => service.enabled).map((service) => service.providerId));
		const items = all.map((body) => {
			const nativeProvider = this.isNativeSpace(body);
			const providerEnabled = nativeProvider || enabled.has(body.provider.id);
			return {
				...body,
				providerEnabled,
				mnemonDefault: nativeProvider && body.id === mnemonDefaultStore,
				healthy: false,
				statusLoading: true
			};
		});
		return {
			items,
			providers: this.providerCatalog.providers.map((provider) => ({
				...provider,
				serviceConfigured: isNativeProvider(provider) ? this.runner.commandFound : enabled.has(provider.id)
			})),
			persistenceStrategy: {
				mode: this.config.persistenceStrategy.mode,
				providerId: this.persistenceProviderId() ?? this.config.persistenceStrategy.providerId,
				prompt: this.config.persistenceStrategy.prompt,
				rules: { ...this.config.persistenceStrategy.rules }
			},
			total: items.length,
			activeCount: items.filter((body) => body.active && body.providerEnabled !== false).length,
			directory: this.memorySpaces.directory,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			rediscovery: this.rediscoveryState()
		};
	}
	rediscoveryState() {
		const entry = rediscoveries.get(this.memorySpaces.providerRegistryPath);
		return {
			running: entry?.running !== void 0,
			...entry?.last === void 0 ? {} : { last: entry.last }
		};
	}
	/** Stable, secret-free checkpoint for the projected Memory Space authority. */
	memoryRevision() {
		return this.memoryState().revision;
	}
	/** One local metadata observation supplies membership and its revision. */
	memoryState() {
		const all = this.memorySpaces.list();
		const serviceItems = this.memorySpaces.providerServices().items;
		const enabled = new Set(serviceItems.filter((service) => service.enabled).map((service) => service.providerId));
		const commandFound = this.runner.commandFound;
		const active = all.filter((body) => body.active && (this.isNativeSpace(body) ? commandFound : enabled.has(body.provider.id))).sort((left, right) => left.id.localeCompare(right.id));
		const spaces = [...all].sort((left, right) => left.id.localeCompare(right.id)).map((body) => ({
			id: body.id,
			name: body.name,
			description: body.description,
			active: body.active,
			providerId: body.provider.id,
			updatedAt: body.updatedAt,
			capabilities: body.provider.capabilities
		}));
		const services = serviceItems.map((service) => ({
			providerId: service.providerId,
			enabled: service.enabled,
			configured: service.configured
		})).sort((left, right) => left.providerId.localeCompare(right.providerId));
		const revision = createHash("sha256").update(JSON.stringify({
			bodies: spaces,
			services,
			...commandFound ? {} : { nativeUnavailable: true }
		})).digest("hex");
		return {
			all,
			active,
			providerReady: this.memorySpaces.defaultProviderId() !== void 0,
			revision
		};
	}
	/** Return a usable system snapshot without waiting for any Provider I/O. */
	statusSummary() {
		const catalog = this.spaceDirectory();
		const version = this.cliVersion !== void 0 && this.cliBinary() === this.cliVersion.binary ? this.cliVersion.version : void 0;
		const dshActiveStores = catalog.items.filter((body) => body.active && body.providerEnabled !== false).map((body) => body.id);
		const providerServices = this.memorySpaces.providerServices().items.map((service) => {
			const descriptor = this.providerCatalog.descriptor(service.providerId);
			const spaces = catalog.items.filter((body) => body.provider.id === service.providerId);
			const activeSpaces = spaces.filter((body) => body.active && body.providerEnabled !== false);
			return {
				providerId: service.providerId,
				label: descriptor.label,
				...descriptor.icon === void 0 ? {} : { icon: descriptor.icon },
				enabled: service.enabled,
				configured: service.configured,
				status: !service.enabled ? "disabled" : "idle",
				memoryBodyCount: spaces.length,
				activeMemoryBodyCount: activeSpaces.length
			};
		});
		return {
			healthy: true,
			cliPath: this.runner.command,
			commandFound: this.runner.commandFound,
			dataDir: this.runner.effectiveDataDir(),
			store: dshActiveStores.join(", ") || "none",
			mnemonDefaultStore: this.runner.persistedStore(),
			dshActiveStores,
			writeEnabled: this.config.writeEnabled,
			timeoutMs: this.config.timeoutMs,
			defaultRecallLimit: this.config.defaultRecallLimit,
			recallQuality: this.config.recallQuality,
			embeddingManaged: this.config.embedding.enabled,
			memoryBodyDirectory: catalog.directory,
			memoryBodies: catalog.items,
			providerServices,
			...version === void 0 ? {} : { version }
		};
	}
	/**
	* Probe Mnemon's embedding runtime, and count the vectors of every Mnemon Native space:
	* `mnemon embed --status` counts only one Store, so a full count for it could read as the
	* health of every space while another one lacked vectors (#392).
	*/
	async embeddingStatus(signal) {
		const version = (await this.runner.runText(["--version"], {
			globalFlags: false,
			...signal === void 0 ? {} : { signal }
		})).trim();
		const parts = /^(?:mnemon version\s+)?v?(\d+)\.(\d+)\.(\d+)(?:\+[0-9A-Za-z.-]+)?$/u.exec(version)?.slice(1).map(Number);
		if (parts === void 0 || !parts.every(Number.isSafeInteger) || !(parts[0] > 0 || parts[1] > 2 || parts[1] === 2 && parts[2] >= 13)) throw new Error("Embedding model checks require Mnemon CLI 0.2.13 or newer. Update the configured CLI and test again.");
		const native = this.memorySpaces.list().filter((body) => this.isNativeSpace(body) && existsSync(body.dbPath));
		let runtime;
		const spaces = [];
		for (const body of native) {
			const space = {
				memoryBodyId: body.id,
				name: body.name,
				active: body.active
			};
			try {
				const counts = embeddingCounts(await this.runner.runJson(["embed", "--status"], {
					store: body.id,
					database: body.dbPath,
					...signal === void 0 ? {} : { signal }
				}), true);
				runtime ??= counts;
				spaces.push({
					...space,
					totalInsights: counts.totalInsights,
					embedded: counts.embedded,
					coverage: coveragePercent(counts.embedded, counts.totalInsights)
				});
			} catch (error) {
				if (signal?.aborted === true) throw error;
				if (cliFailure(error, "no-database")) continue;
				spaces.push({
					...space,
					totalInsights: 0,
					embedded: 0,
					coverage: "0%",
					error: cliReason(error)
				});
			}
		}
		runtime ??= await this.embeddingRuntime(signal);
		const counted = spaces.filter((space) => space.error === void 0);
		const totalInsights = counted.reduce((sum, space) => sum + space.totalInsights, 0);
		const embedded = counted.reduce((sum, space) => sum + space.embedded, 0);
		return {
			...runtime,
			totalInsights,
			embedded,
			coverage: coveragePercent(embedded, totalInsights),
			spaces
		};
	}
	/** Mnemon's embedding runtime, asked in a scratch data directory: no space could be counted, and Mnemon creates the Store it opens. */
	async embeddingRuntime(signal) {
		const directory = mkdtempSync(join(tmpdir(), "dsh-mnemon-embedding-"));
		try {
			return embeddingCounts(await this.runner.runJson([
				"--data-dir",
				directory,
				"embed",
				"--status"
			], {
				globalFlags: false,
				...signal === void 0 ? {} : { signal }
			}), true);
		} catch (error) {
			throw new Error(cliReason(error), { cause: error });
		} finally {
			rmSync(directory, {
				recursive: true,
				force: true
			});
		}
	}
	/**
	* Fill in the vectors a Mnemon Native space lacks, through the Host's own data directory and
	* embedding settings, which a terminal `mnemon embed --all` may not share (#392). Mnemon fills at
	* most 100 a call and keeps the vectors it wrote when a call is stopped, so the fill goes in steps
	* no longer than one CLI call, letting other memory work take the storage lock between them,
	* until none is missing, a step writes none, or a minute is up.
	*/
	async embedMissing(memoryBodyId, signal) {
		this.assertWritable();
		const body = this.memorySpaces.get(validateMemorySpaceId(memoryBodyId));
		if (!this.isNativeSpace(body)) throw new Error(`${body.provider.label} keeps no Mnemon vectors to fill in`);
		const options = {
			store: body.id,
			database: body.dbPath,
			...signal === void 0 ? {} : { signal }
		};
		const failed = (error) => new Error(cliFailure(error, "no-database") ? `Memory Space ${body.name} has no database` : cliReason(error), { cause: error });
		const count = async () => {
			try {
				return embeddingCounts(await this.runner.runJson(["embed", "--status"], options));
			} catch (error) {
				throw failed(error);
			}
		};
		const step = Math.min(this.config.timeoutMs, EMBED_FILL_STEP_MS);
		const deadline = Date.now() + EMBED_FILL_BUDGET_MS;
		const first = await count();
		let last = first;
		let stopped;
		while (last.embedded < last.totalInsights) {
			if (Date.now() + step > deadline) {
				stopped = "time";
				break;
			}
			try {
				await this.runner.runText(["embed", "--all"], {
					...options,
					timeoutMs: step
				});
			} catch (error) {
				if (!cliFailure(error, "timeout")) throw failed(error);
			}
			const next = await count();
			const progressed = next.embedded > last.embedded;
			last = next;
			if (!progressed) {
				stopped = "refused";
				break;
			}
		}
		const remaining = last.totalInsights - last.embedded;
		return {
			memoryBodyId: body.id,
			filled: Math.max(0, last.embedded - first.embedded),
			remaining,
			model: last.model,
			...remaining > 0 && stopped !== void 0 ? { stopped } : {}
		};
	}
	async status(signal) {
		const nativeInUse = this.runner.commandFound || this.memorySpaces.list().some((body) => this.isNativeSpace(body));
		let versionError;
		const [catalog, rawVersion] = await Promise.all([this.spaces(signal), nativeInUse ? this.runner.runText(["--version"], signal === void 0 ? { globalFlags: false } : {
			signal,
			globalFlags: false
		}).catch((error) => {
			versionError = error;
		}) : Promise.resolve(void 0)]);
		const active = catalog.items.filter((body) => body.active && body.providerEnabled !== false);
		const dshActiveStores = active.map((body) => body.id);
		const providerServices = this.memorySpaces.providerServices().items.map((service) => {
			const descriptor = this.providerCatalog.descriptor(service.providerId);
			const spaces = catalog.items.filter((body) => body.provider.id === service.providerId);
			const activeSpaces = spaces.filter((body) => body.active && body.providerEnabled !== false);
			const failed = activeSpaces.filter((body) => !body.healthy);
			const status = !service.enabled ? "disabled" : activeSpaces.length === 0 ? "idle" : failed.length === 0 ? "healthy" : "unhealthy";
			return {
				providerId: service.providerId,
				label: descriptor.label,
				...descriptor.icon === void 0 ? {} : { icon: descriptor.icon },
				enabled: service.enabled,
				configured: service.configured,
				status,
				memoryBodyCount: spaces.length,
				activeMemoryBodyCount: activeSpaces.length,
				...failed.length === 0 ? {} : { error: failed.map((body) => `${body.name}: ${body.error ?? "unavailable"}`).join("; ") }
			};
		});
		const base = {
			cliPath: this.runner.command,
			commandFound: this.runner.commandFound,
			dataDir: this.runner.effectiveDataDir(),
			store: dshActiveStores.join(", ") || "none",
			mnemonDefaultStore: this.runner.persistedStore(),
			dshActiveStores,
			writeEnabled: this.config.writeEnabled,
			timeoutMs: this.config.timeoutMs,
			defaultRecallLimit: this.config.defaultRecallLimit,
			recallQuality: this.config.recallQuality,
			embeddingManaged: this.config.embedding.enabled,
			memoryBodyDirectory: catalog.directory,
			memoryBodies: catalog.items,
			providerServices
		};
		const version = rawVersion === void 0 ? void 0 : rawVersion.trim().replace(/^mnemon version\s+/i, "");
		const binary = version === void 0 ? void 0 : this.cliBinary();
		this.cliVersion = version === void 0 || binary === void 0 ? void 0 : {
			binary,
			version
		};
		try {
			const healthySpaces = active.filter((body) => body.healthy && body.stats !== void 0);
			const topEntities = /* @__PURE__ */ new Map();
			const byCategory = {};
			for (const body of healthySpaces) {
				for (const [category, count] of Object.entries(body.stats.byCategory)) byCategory[category] = (byCategory[category] ?? 0) + count;
				for (const entity of body.stats.topEntities) topEntities.set(entity.entity, (topEntities.get(entity.entity) ?? 0) + entity.count);
			}
			const stats = {
				totalInsights: healthySpaces.reduce((total, body) => total + body.stats.totalInsights, 0),
				deletedInsights: healthySpaces.reduce((total, body) => total + body.stats.deletedInsights, 0),
				edgeCount: healthySpaces.reduce((total, body) => total + body.stats.edgeCount, 0),
				oplogCount: healthySpaces.reduce((total, body) => total + body.stats.oplogCount, 0),
				dbSizeBytes: healthySpaces.reduce((total, body) => total + body.stats.dbSizeBytes, 0),
				byCategory,
				topEntities: [...topEntities].map(([entity, count]) => ({
					entity,
					count
				})).sort((left, right) => right.count - left.count),
				...active.length === 1 ? { dbPath: active[0].dbPath } : {}
			};
			const errors = [...versionError === void 0 ? [] : [versionError instanceof Error ? versionError.message : String(versionError)], ...active.filter((body) => !body.healthy).map((body) => `${body.name}: ${body.error ?? "unavailable"}`)];
			return {
				healthy: true,
				...base,
				...version === void 0 ? {} : { version },
				stats,
				...errors.length === 0 ? {} : { error: errors.join("; ") }
			};
		} catch (error) {
			return {
				healthy: true,
				...base,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	async reconnectSpace(id, signal) {
		const body = this.memorySpaces.list().find((candidate) => candidate.id === id);
		if (body === void 0) throw new Error(`unknown memory space: ${id}`);
		if (!this.isNativeSpace(body)) {
			if (!this.memorySpaces.providerServiceEnabled(body.provider.id)) throw new Error(`${body.provider.label} is disabled on the dsh-mnemon page under Plugins`);
		}
		const provider = this.providerFor(body);
		provider.invalidateStatus?.(body.id);
		this.invalidateEntityIndex(body.id);
		const status = await provider.status(body, signal);
		return {
			...body,
			providerEnabled: true,
			mnemonDefault: this.isNativeSpace(body) && body.id === this.runner.persistedStore(),
			...status
		};
	}
	/** exclude: memoryKey()s to leave out before the quality policy selects. */
	async search(request, signal, options = {}) {
		const query = required(request.query, "query", 2e3);
		const limit = memoryInputInteger(request.limit, this.config.defaultRecallLimit, 1, 50);
		const qualityContext = {
			requestedLimit: limit,
			config: this.config.recallQuality
		};
		const preparedPolicy = prepareRecallQualityPolicy(this.recallQualityPolicy, qualityContext);
		const mode = allowed(request.mode, [
			"smart",
			"keyword",
			"basic"
		], "mode") ?? "smart";
		const category = allowed(request.category, CATEGORIES, "category");
		const source = allowed(request.source, SOURCES, "source");
		const intent = allowed(request.intent, INTENTS, "intent");
		const spaces = this.readSpaces(request.memoryBodyIds);
		const normalizedRequest = {
			query,
			mode,
			limit: preparedPolicy.candidateLimit,
			...category === void 0 ? {} : { category },
			...source === void 0 ? {} : { source },
			...intent === void 0 ? {} : { intent },
			...request.inspect === true ? { inspect: true } : {}
		};
		let batches = await Promise.all(spaces.map(async (body) => {
			if (!body.provider.capabilities.search) return {
				body,
				result: {
					results: [],
					hint: "search is not supported"
				},
				source: readSource(body, "unsupported", "unsupported", 0, { hint: "This provider does not expose search." })
			};
			try {
				const result = await this.providerFor(body).search(body, normalizedRequest, signal);
				return {
					body,
					result,
					source: readSource(body, "search", result.results.length === 0 ? "empty" : "ready", result.results.length, result.hint === void 0 ? {} : { hint: result.hint })
				};
			} catch (error) {
				const hint = error instanceof Error ? error.message : String(error);
				return {
					body,
					result: {
						results: [],
						hint: `unavailable: ${hint}`
					},
					source: readSource(body, "search", "unavailable", 0, { hint })
				};
			}
		}));
		const recoveryPlan = mode === "smart" && category === void 0 && source === void 0 && intent === void 0 ? exactSearchAnchorPlan(query) ?? lexicalSearchRecoveryPlan(query) : void 0;
		const evaluate = (selectedBatches) => {
			const candidates = [];
			const hints = [];
			for (const [bodyOrder, { body, result }] of selectedBatches.entries()) {
				const scoreSemantics = this.providerFor(body).scoreSemantics;
				const entries = options.exclude === void 0 ? result.results : result.results.filter((entry) => !options.exclude.has(memoryKey(body.id, entry.id)));
				candidates.push(...entries.map((entry, index) => ({
					insight: this.annotate(entry, body),
					memoryBodyId: body.id,
					providerId: body.provider.id,
					providerRank: index + 1,
					bodyOrder,
					...scoreSemantics === void 0 ? {} : { scoreSemantics }
				})));
				if (result.hint !== void 0) hints.push(`${body.name}: ${result.hint}`);
			}
			const heterogeneous = new Set(spaces.map((body) => body.provider.id)).size > 1;
			if (heterogeneous) for (const candidate of candidates) candidate.insight.federatedScore = 1 / (60 + candidate.providerRank);
			const useProviderOrder = heterogeneous || candidates.some((candidate) => candidate.scoreSemantics?.kind === "provider-native");
			candidates.sort((left, right) => useProviderOrder ? left.providerRank - right.providerRank || left.bodyOrder - right.bodyOrder : (right.insight.score ?? 0) - (left.insight.score ?? 0));
			return {
				hints,
				quality: applyRecallQualityPolicy(preparedPolicy, candidates, qualityContext)
			};
		};
		let evaluation = evaluate(batches);
		const hasRecoveryEvidence = recoveryPlan !== void 0 && evaluation.quality.selected.some((candidate) => recoveryMatchCount(candidate.candidate.insight.content, recoveryPlan) >= recoveryPlan.requiredMatches);
		if (recoveryPlan !== void 0 && !hasRecoveryEvidence) {
			batches = await Promise.all(batches.map(async (batch) => {
				if (!this.isNativeSpace(batch.body) || batch.source.status === "unsupported" || batch.source.status === "unavailable") return batch;
				try {
					const recovered = await this.providerFor(batch.body).search(batch.body, {
						query: recoveryPlan.query,
						mode: "keyword",
						limit: Math.min(limit, preparedPolicy.candidateLimit),
						...request.inspect === true ? { inspect: true } : {}
					}, signal);
					const admitted = recovered.results.some((insight) => recoveryMatchCount(insight.content, recoveryPlan) >= recoveryPlan.requiredMatches);
					const results = mergeRecoveryResults(batch.result.results, recovered.results, recoveryPlan, preparedPolicy.candidateLimit);
					return {
						...batch,
						result: {
							results,
							...admitted || batch.result.hint === void 0 ? {} : { hint: batch.result.hint }
						}
					};
				} catch {
					return batch;
				}
			}));
			evaluation = evaluate(batches);
		}
		const { hints, quality } = evaluation;
		const selected = recoveryPlan === void 0 ? quality.selected : prioritizeRecoveryEvidence(quality.selected, recoveryPlan);
		const qualityStats = /* @__PURE__ */ new Map();
		for (const { body } of batches) qualityStats.set(body.id, {
			policyId: quality.policyId,
			...quality.fallbackFrom === void 0 ? {} : { fallbackFrom: quality.fallbackFrom },
			fetched: 0,
			retained: 0,
			selected: 0,
			droppedLowScore: 0,
			droppedNonPositiveScore: 0,
			droppedInvalidScore: 0,
			unscored: 0,
			unscaled: 0
		});
		for (const { candidate, decision } of quality.evaluated) {
			const stats = qualityStats.get(candidate.memoryBodyId);
			if (stats === void 0) continue;
			stats.fetched += 1;
			if (decision.action === "keep") stats.retained += 1;
			if (decision.action === "drop") {
				if (decision.reason === "low-score") stats.droppedLowScore += 1;
				if (decision.reason === "non-positive-score") stats.droppedNonPositiveScore += 1;
				if (decision.reason === "invalid-score") stats.droppedInvalidScore += 1;
			}
			if (decision.reason === "unscored") stats.unscored += 1;
			if (decision.reason === "unscaled-score") stats.unscaled += 1;
			if (decision.tier === "ranked") stats.ranked = (stats.ranked ?? 0) + 1;
			if (decision.reason === "out-of-range-score") stats.outOfRange = (stats.outOfRange ?? 0) + 1;
		}
		for (const { candidate } of quality.selected) {
			const stats = qualityStats.get(candidate.memoryBodyId);
			if (stats !== void 0) stats.selected += 1;
		}
		return {
			query,
			mode,
			results: selected.map(({ candidate, decision }) => ({
				...candidate.insight,
				relevanceTier: decision.tier,
				...decision.normalizedScore === void 0 ? {} : { normalizedScore: decision.normalizedScore }
			})),
			sources: batches.map((batch) => {
				const stats = qualityStats.get(batch.body.id);
				if (batch.source.status === "unavailable" || batch.source.status === "unsupported") return {
					...batch.source,
					quality: stats
				};
				return {
					...batch.source,
					status: stats.retained === 0 ? "empty" : "ready",
					itemCount: stats.retained,
					quality: stats
				};
			}),
			...hints.length === 0 ? {} : { hint: hints.join("\n") }
		};
	}
	/**
	* Read a deliberately small metadata sample through the cheapest useful path
	* exposed by the owning Provider. This avoids federated ranking, graph
	* expansion, and large browse projections before an LLM metadata pass.
	*/
	async metadataSample(memoryBodyId, signal) {
		const body = this.readSpaces([memoryBodyId])[0];
		const provider = this.providerFor(body);
		const limit = 6;
		let method;
		let items;
		if (this.isNativeSpace(body)) {
			method = "native-basic";
			items = provider.metadataSample === void 0 ? await provider.list(body, { limit }, signal) : await provider.metadataSample(body, limit, signal);
		} else if (METADATA_SEARCH_FIRST_PROVIDERS.has(body.provider.typeId ?? body.provider.id) || !body.provider.capabilities.browse) {
			method = "search";
			const query = (body.description.trim() || body.name.trim()).slice(0, 400);
			items = (await provider.search(body, {
				query,
				mode: "basic",
				limit
			}, signal)).results;
		} else {
			method = "browse";
			items = await provider.list(body, { limit }, signal);
		}
		return {
			memoryBodyId: body.id,
			name: body.name,
			description: body.description,
			providerId: body.provider.id,
			providerLabel: body.provider.label,
			method,
			evidence: items.slice(0, limit).map((item) => ({
				content: item.content.length > 720 ? `${item.content.slice(0, 719)}…` : item.content,
				...item.category === void 0 ? {} : { category: item.category },
				...item.entities === void 0 ? {} : { entities: item.entities.slice(0, 8) }
			}))
		};
	}
	async graph(signal, memoryBodyIds) {
		const spaces = this.readSpaces(memoryBodyIds);
		const nodes = [];
		const edges = [];
		const sources = [];
		const snapshots = await Promise.all(spaces.map(async (body) => {
			const mode = body.provider.capabilities.graph ? "graph" : body.provider.capabilities.browse ? "projection" : body.provider.capabilities.search ? "query-only" : "unsupported";
			if (mode === "query-only") return {
				body,
				source: readSource(body, mode, "query-required", 0, {
					edgeCount: 0,
					hint: "Use Recall to query this provider."
				})
			};
			if (mode === "unsupported") return {
				body,
				source: readSource(body, mode, "unsupported", 0, {
					edgeCount: 0,
					hint: "This provider exposes neither graph nor browse projection."
				})
			};
			try {
				const snapshot = await this.providerFor(body).graph(body, signal);
				return {
					body,
					snapshot,
					source: readSource(body, mode, snapshot.nodes.length === 0 ? "empty" : "ready", snapshot.nodes.length, { edgeCount: snapshot.edges.length })
				};
			} catch (error) {
				return {
					body,
					source: readSource(body, mode, "unavailable", 0, {
						edgeCount: 0,
						hint: error instanceof Error ? error.message : String(error)
					})
				};
			}
		}));
		for (const item of snapshots) {
			sources.push(item.source);
			if (item.snapshot === void 0) continue;
			const { body, snapshot } = item;
			const graphId = (id) => `${body.id}:${id}`;
			nodes.push(...snapshot.nodes.map((node) => ({
				...this.annotate(node, body),
				color: node.color,
				graphId: graphId(node.id)
			})));
			edges.push(...snapshot.edges.map((edge) => ({
				...edge,
				sourceId: graphId(edge.sourceId),
				targetId: graphId(edge.targetId)
			})));
		}
		return {
			nodes,
			edges,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			memoryBodies: spaces.map(({ id, name, active }) => ({
				id,
				name,
				active
			})),
			sources
		};
	}
	async list(request = {}, signal) {
		const rawQuery = request.query?.trim() ?? "";
		const query = rawQuery.toLocaleLowerCase();
		if (rawQuery.length > 500) throw new Error("query is too long (max 500 characters)");
		const category = allowed(request.category, CATEGORIES, "category");
		const limit = memoryInputInteger(request.limit, 200, 1, 1e3);
		const spaces = this.readSpaces(request.memoryBodyIds);
		const batches = await Promise.all(spaces.map(async (body) => {
			const mode = body.provider.capabilities.browse ? "enumerable" : body.provider.capabilities.search ? "query-only" : "unsupported";
			if (mode === "query-only" && rawQuery === "") return {
				body,
				items: [],
				source: readSource(body, mode, "query-required", 0, { hint: "Enter a query to inspect this provider." })
			};
			if (mode === "unsupported") return {
				body,
				items: [],
				source: readSource(body, mode, "unsupported", 0, { hint: "This provider does not expose content browsing." })
			};
			try {
				const provider = this.providerFor(body);
				const items = (mode === "query-only" ? (await provider.search(body, {
					query: rawQuery,
					limit
				}, signal)).results : await provider.list(body, {
					...request,
					limit
				}, signal)).filter((item) => (category === void 0 || item.category === category) && (query === "" || item.content.toLocaleLowerCase().includes(query) || item.id.toLocaleLowerCase().includes(query)));
				return {
					body,
					items,
					source: readSource(body, mode, items.length === 0 ? "empty" : "ready", items.length)
				};
			} catch (error) {
				return {
					body,
					items: [],
					source: readSource(body, mode, "unavailable", 0, { hint: error instanceof Error ? error.message : String(error) })
				};
			}
		}));
		const items = batches.flatMap(({ body, items: bodyItems }) => bodyItems.map((item) => ({
			...this.annotate(item, body),
			color: insightColor(item.category)
		})));
		return {
			items: items.slice(0, limit),
			total: items.length,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			sources: batches.map((batch) => batch.source)
		};
	}
	/**
	* The entities of the active spaces, each counted once per memory that
	* carries it. With an entity, also the first page of those memories.
	*/
	async entities(entity, limit, signal) {
		const selected = entity === void 0 ? "" : entityName(entity);
		const read = await this.readEntityIndexes(signal, 0);
		const { items } = mergeEntityCounts(read.indexes);
		const view = {
			items: items.slice(0, ENTITY_RAIL_LIMIT),
			insights: [],
			sources: read.sources,
			total: items.length,
			complete: read.complete
		};
		if (selected === "") return view;
		const page = this.entityPage(read, selected, 0, memoryInputInteger(limit, 20, 1, 50));
		return {
			...view,
			selected: page.entity,
			insights: page.items
		};
	}
	/** One page of the memories that carry an entity, by importance and then recency. */
	async entityMemories(entity, offset, limit, signal) {
		const selected = entityName(entity);
		if (selected === "") throw new Error("entity is required");
		const read = await this.readEntityIndexes(signal, ENTITY_SELECTION_STATUS_REUSE_MS);
		return this.entityPage(read, selected, memoryInputInteger(offset, 0, 0, 1e6), memoryInputInteger(limit, 50, 1, 200));
	}
	/**
	* What recall relates to an entity, without the memories that carry it.
	* Those are left out before the quality policy selects, so they cannot use up
	* its places and leave the related list empty.
	*/
	async entityRelated(entity, limit, signal, view) {
		const selected = entityName(entity);
		if (selected === "") throw new Error("entity is required");
		const superseding = view === void 0 ? void 0 : new AbortController();
		if (view !== void 0) {
			this.entityRelatedViews.get(view)?.abort(/* @__PURE__ */ new Error("superseded by a newer entity selection"));
			this.entityRelatedViews.set(view, superseding);
		}
		const combined = superseding === void 0 ? signal : signal === void 0 ? superseding.signal : AbortSignal.any([signal, superseding.signal]);
		try {
			const read = await this.readEntityIndexes(combined, ENTITY_SELECTION_STATUS_REUSE_MS);
			const key = normalizeEntityKey(selected);
			const carrying = /* @__PURE__ */ new Set();
			for (const [bodyId, index] of read.byBody) for (const position of index.byKey.get(key) ?? []) carrying.add(memoryKey(bodyId, index.memories[position].id));
			const display = mergeEntityCounts(read.indexes).names.get(key) ?? selected;
			const readableIds = read.readable.map((body) => body.id);
			if (readableIds.length === 0) return {
				entity: display,
				items: [],
				sources: []
			};
			const result = await this.search({
				query: selected,
				intent: "ENTITY",
				limit: memoryInputInteger(limit, 20, 1, 50),
				memoryBodyIds: readableIds,
				inspect: true
			}, combined, { exclude: carrying });
			combined?.throwIfAborted();
			return {
				entity: display,
				items: result.results,
				sources: result.sources
			};
		} finally {
			if (view !== void 0 && this.entityRelatedViews.get(view) === superseding) this.entityRelatedViews.delete(view);
		}
	}
	entityPage(read, selected, offset, limit) {
		const key = normalizeEntityKey(selected);
		const memories = memoriesWithEntity(read.indexes, key);
		return {
			entity: mergeEntityCounts(read.indexes).names.get(key) ?? selected,
			total: memories.length,
			offset,
			items: memories.slice(offset, offset + limit),
			complete: read.complete,
			sources: read.sources
		};
	}
	/**
	* One entity index per active space that has an entity index, read
	* concurrently. A space keeps its index while its Provider statistics and
	* metadata stay the same; a write through this Source drops it.
	*/
	async readEntityIndexes(signal, statusMaxAgeMs) {
		signal?.throwIfAborted();
		const active = this.memorySpaces.active();
		const capable = new Set(active.filter((body) => body.provider.capabilities.entities).map((body) => body.id));
		for (const id of this.entityIndexCache.keys()) if (!capable.has(id)) this.entityIndexCache.delete(id);
		const reads = await Promise.all(active.map(async (body) => {
			if (!body.provider.capabilities.entities) return {
				body,
				recall: false,
				source: readSource(body, "unsupported", "unsupported", 0, { hint: "This provider does not expose an entity index." })
			};
			const status = await this.entitySpaceStatus(body, statusMaxAgeMs);
			if (!status.healthy) return {
				body,
				recall: false,
				source: readSource(body, "entities", "unavailable", 0, { hint: status.error ?? "Provider unavailable." })
			};
			const recall = body.provider.capabilities.search;
			if (this.providerFor(body).entityIndex === void 0 && !body.provider.capabilities.browse) return {
				body,
				recall,
				source: readSource(body, "query-only", "query-required", 0, { hint: "This provider can only be queried; its memories appear among related memories." })
			};
			try {
				const index = await this.entityIndexFor(body, status);
				const options = {
					memoryCount: index.memoryCount,
					complete: index.complete,
					...index.complete ? {} : { hint: "The Provider indexed only part of this space." }
				};
				return {
					body,
					index,
					recall,
					source: readSource(body, "entities", index.byKey.size === 0 ? "empty" : "ready", index.byKey.size, options)
				};
			} catch (error) {
				return {
					body,
					recall: false,
					source: readSource(body, "entities", "unavailable", 0, { hint: error instanceof Error ? error.message : String(error) })
				};
			}
		}));
		signal?.throwIfAborted();
		const byBody = /* @__PURE__ */ new Map();
		for (const read of reads) if (read.index !== void 0) byBody.set(read.body.id, read.index);
		const indexes = [...byBody.values()];
		return {
			byBody,
			indexes,
			readable: reads.filter((read) => read.recall).map((read) => read.body),
			sources: reads.map((read) => read.source),
			complete: indexes.every((index) => index.complete)
		};
	}
	/** Provider health for the entity reads: a read in flight is shared, a finished one reused for less than maxAgeMs. */
	entitySpaceStatus(body, maxAgeMs) {
		const recent = this.entityStatusCache.get(body.id);
		if (recent !== void 0 && (recent.settledAt === void 0 || Date.now() - recent.settledAt < maxAgeMs)) return recent.status;
		const entry = {
			settledAt: void 0,
			status: Promise.resolve(void 0)
		};
		entry.status = this.providerFor(body).status(body).catch((error) => ({
			healthy: false,
			error: error instanceof Error ? error.message : String(error)
		})).then((status) => {
			entry.settledAt = Date.now();
			return status;
		});
		this.entityStatusCache.set(body.id, entry);
		return entry.status;
	}
	entityIndexFor(body, status) {
		const fingerprint = entityIndexFingerprint(body, status);
		const cached = this.entityIndexCache.get(body.id);
		if (cached !== void 0 && cached.fingerprint === fingerprint) {
			if (fingerprint !== void 0 || cached.settledAt === void 0 || Date.now() - cached.settledAt < ENTITY_INDEX_UNCHECKED_REUSE_MS) return cached.index;
		}
		const entry = {
			fingerprint,
			settledAt: void 0,
			index: Promise.resolve(void 0)
		};
		entry.index = this.buildEntityIndex(body).then((index) => {
			entry.settledAt = Date.now();
			return index;
		}, (error) => {
			if (this.entityIndexCache.get(body.id) === entry) this.entityIndexCache.delete(body.id);
			throw error;
		});
		this.entityIndexCache.set(body.id, entry);
		return entry.index;
	}
	async buildEntityIndex(body) {
		const provider = this.providerFor(body);
		if (provider.entityIndex !== void 0) {
			const owned = await provider.entityIndex(body);
			return buildSpaceEntityIndex(owned.memories.map((memory) => this.entityMemory(memory, body)), owned.memories.length, owned.complete);
		}
		const listed = await provider.list(body, { limit: ENTITY_INDEX_LIST_LIMIT });
		return buildSpaceEntityIndex(listed.map((memory) => this.entityMemory(memory, body)), listed.length, listed.length < ENTITY_INDEX_LIST_LIMIT);
	}
	/** A listed memory, not a query result: no relevance fields. */
	entityMemory(memory, body) {
		const { score: _score, normalizedScore: _normalized, relevanceTier: _tier, federatedScore: _federated, confidence: _confidence, intent: _intent, matchedVia: _matchedVia, depth: _depth, edgeType: _edgeType, ...listed } = memory;
		return this.annotate(listed, body);
	}
	invalidateEntityIndex(memoryBodyId) {
		this.entityIndexCache.delete(memoryBodyId);
		this.entityStatusCache.delete(memoryBodyId);
	}
	async remember(request, signal) {
		this.assertWritable();
		const prepared = this.prepareRemember(request);
		const result = await this.providerFor(prepared.body).remember(prepared.body, prepared.request, signal);
		this.activateAfterWrite(prepared.body, mutationResultCommitted(result));
		return this.annotateResult(result, prepared.body);
	}
	/**
	* Persist a host-authorized set of exact memories without involving a model
	* in the data plane. Mnemon Native requests share one import per destination;
	* other Providers retain their adapter-defined write semantics.
	*/
	async rememberMany(requests, signal) {
		this.assertWritable();
		const destinations = /* @__PURE__ */ new Map();
		const prepared = requests.map((request) => this.prepareRemember(request, destinations));
		const results = new Array(prepared.length);
		const groups = /* @__PURE__ */ new Map();
		for (const [index, entry] of prepared.entries()) {
			const group = groups.get(entry.body.id);
			if (group === void 0) groups.set(entry.body.id, [{
				...entry,
				index
			}]);
			else group.push({
				...entry,
				index
			});
		}
		for (const group of groups.values()) {
			const body = group[0].body;
			const provider = this.providerFor(body);
			let providerChanged = false;
			const batchWriter = provider.rememberMany;
			const batch = batchWriter === void 0 ? [] : group.filter((entry) => !this.isNativeSpace(body) || entry.request.content.length <= 8e3);
			if (batchWriter !== void 0 && batch.length > 0) {
				const written = await batchWriter.call(provider, body, batch.map((entry) => entry.request), signal);
				if (written.length !== batch.length) throw new Error(`batch remember did not return one receipt per request for Memory Space ${body.id}`);
				for (const [offset, result] of written.entries()) {
					const entry = batch[offset];
					results[entry.index] = this.annotateResult(result, body);
					providerChanged ||= mutationResultCommitted(result);
				}
			}
			const batched = new Set(batch);
			for (const entry of group) {
				if (batched.has(entry)) continue;
				const result = await provider.remember(body, entry.request, signal);
				results[entry.index] = this.annotateResult(result, body);
				providerChanged ||= mutationResultCommitted(result);
			}
			this.activateAfterWrite(body, providerChanged);
		}
		return results;
	}
	/**
	* The memories held under an exact id among the given spaces that can be
	* read now, asked of the Providers that can look ids up.
	*/
	async locate(id, memoryBodyIds, signal) {
		const exact = required(id, "id", 2e3);
		const readable = new Map(this.memorySpaces.active().filter((body) => this.isNativeSpace(body) || this.memorySpaces.providerServiceEnabled(body.provider.id)).map((body) => [body.id, body]));
		const found = [];
		for (const memoryBodyId of new Set(memoryBodyIds)) {
			const body = readable.get(memoryBodyId);
			if (body === void 0) continue;
			const provider = this.providerFor(body);
			if (provider.get === void 0) continue;
			const insight = await provider.get(body, exact, signal);
			if (insight !== void 0 && insight.id === exact) found.push(this.annotate(insight, body));
		}
		return found;
	}
	async related(id, depth = 2, edge, signal, memoryBodyId) {
		const body = this.readSpace(memoryBodyId);
		const selectedEdge = allowed(edge, EDGE_TYPES, "edge");
		const provider = this.providerFor(body);
		if (provider.related === void 0 || !body.provider.capabilities.related) throw new Error(`${body.provider.label} does not support related-memory traversal`);
		return (await provider.related(body, required(id, "id", 2e3), memoryInputInteger(depth, 2, 1, 5), selectedEdge, signal)).map((entry) => this.annotate(entry, body));
	}
	async link(sourceId, targetId, type = "semantic", weight = .5, reason, signal, memoryBodyId) {
		this.assertWritable();
		const body = this.writeSpace(memoryBodyId);
		if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error("weight must be within 0..1");
		const selectedType = allowed(type, EDGE_TYPES, "type") ?? "semantic";
		const provider = this.providerFor(body);
		if (provider.link === void 0 || !body.provider.capabilities.link) throw new Error(`${body.provider.label} does not support explicit memory links`);
		const result = await provider.link(body, required(sourceId, "sourceId", 2e3), required(targetId, "targetId", 2e3), selectedType, weight, reason === void 0 || reason.trim() === "" ? void 0 : required(reason, "reason", 1e3), signal);
		this.activateAfterWrite(body, mutationResultCommitted(result));
		return this.annotateResult(result, body);
	}
	async forget(id, signal, memoryBodyId) {
		this.assertWritable();
		const body = this.writeSpace(memoryBodyId);
		const provider = this.providerFor(body);
		if (provider.forget === void 0 || !body.provider.capabilities.forget) throw new Error(`${body.provider.label} does not expose safe forget semantics in this integration`);
		const result = await provider.forget(body, required(id, "id", 2e3), signal);
		this.activateAfterWrite(body, mutationResultCommitted(result));
		return this.annotateResult(result, body);
	}
	prepareSpacePlacement(request) {
		if (request.placement === void 0) throw new Error("automatic provider placement request is required");
		if (request.providerId !== void 0) throw new Error("automatic provider placement cannot include a fixed providerId");
		return prepareMemoryPlacement(request.placement, this.memorySpaces.placementCandidates(request));
	}
	async createSpace(request, signal, placement) {
		this.assertWritable();
		return await this.memorySpaces.create(request, signal, placement);
	}
	/**
	* Create a Memory Space from the configured distillation policy. The model
	* may choose only among candidates already filtered by the host; manual mode
	* ignores model preference and always uses the configured fixed provider.
	*/
	async createSpaceForPersistence(body, selection, signal, delegation = {
		runId: "memory-write",
		provider: "task-agent"
	}) {
		const strategy = this.config.persistenceStrategy;
		if (strategy.mode === "manual") {
			const providerId = this.persistenceProviderId();
			const connection = providerId === void 0 ? void 0 : strategy.providerConnections[providerId];
			return this.createSpace({
				...body,
				...providerId === void 0 ? {} : { providerId },
				...providerId === void 0 || this.isNativeProviderId(providerId) || connection === void 0 ? {} : { connection }
			}, signal);
		}
		const request = {
			...body,
			placement: {
				mode: "automatic",
				...strategy.prompt === "" ? {} : { prompt: strategy.prompt },
				rules: { ...strategy.rules }
			},
			...Object.keys(strategy.providerConnections).length === 0 ? {} : { providerConnections: strategy.providerConnections }
		};
		const prepared = this.prepareSpacePlacement(request);
		const decision = rulesOnlyPlacement(prepared) ?? finalizeLlmPlacement(prepared, selection ?? {
			providerId: "",
			reason: "",
			confidence: ""
		}, delegation);
		return this.createSpace(request, signal, decision);
	}
	/** A chosen provider stays fixed; the built-in default follows whichever provider is ready. */
	persistenceProviderId() {
		const strategy = this.config.persistenceStrategy;
		return strategy.providerDefaulted === true ? this.memorySpaces.defaultProviderId() : strategy.providerId;
	}
	async updateProviderService(providerId, settings, clearSecrets = [], enabled = true, signal) {
		this.assertWritable();
		if (this.isNativeProviderId(providerId)) throw new Error("Mnemon Native service settings are managed by the native configuration");
		if (!enabled) return this.memorySpaces.updateProviderService(providerId, settings, clearSecrets, false);
		const connection = this.memorySpaces.resolveProviderService(providerId, settings, clearSecrets);
		const provider = this.providers.get(providerId);
		if (provider?.discover === void 0) throw new Error(`${this.providerCatalog.descriptor(providerId).label} does not support Memory Space discovery`);
		const discovered = await provider.discover(connection, signal);
		return this.memorySpaces.syncProviderService(providerId, connection, discovered);
	}
	/**
	* Ask every enabled Provider service again for its namespaces, as saving its settings does, and
	* mount the ones this directory has never held, inactive (#373). Nothing mounted changes and a
	* namespace a person disconnected stays disconnected. Providers are asked side by side, each
	* for at most 30 seconds; one that cannot answer keeps its spaces and says why. A pass already
	* running for this directory, at start-up or from the page, is joined rather than run twice; a
	* request that joined one its starter then stopped asks again, unless it was stopped itself.
	*/
	async rediscoverProviders(trigger, signal, providerTimeoutMs = MEMORY_SPACES_REDISCOVERY_PROVIDER_TIMEOUT_MS) {
		this.assertWritable();
		const key = this.memorySpaces.providerRegistryPath;
		const entry = rediscoveries.get(key) ?? {};
		rediscoveries.set(key, entry);
		const joined = entry.running;
		if (joined !== void 0) try {
			return await (signal === void 0 ? joined : untilAborted(joined, signal));
		} catch {
			signal?.throwIfAborted();
			const next = entry.running;
			if (next !== void 0 && next !== joined) return await (signal === void 0 ? next : untilAborted(next, signal));
		}
		const running = this.runRediscovery(trigger, signal, providerTimeoutMs);
		entry.running = running;
		try {
			const outcome = await running;
			entry.last = outcome;
			return outcome;
		} finally {
			if (entry.running === running) delete entry.running;
		}
	}
	async runRediscovery(trigger, signal, providerTimeoutMs) {
		const services = this.memorySpaces.providerServices().items.filter((item) => item.enabled && !this.isNativeProviderId(item.providerId));
		const results = await Promise.all(services.map(async (item) => {
			const provider = this.providers.get(item.providerId);
			if (provider?.discover === void 0) return void 0;
			const label = this.providerCatalog.descriptor(item.providerId).label;
			const timeout = AbortSignal.timeout(providerTimeoutMs);
			const bounded = signal === void 0 ? timeout : AbortSignal.any([signal, timeout]);
			try {
				const connection = this.memorySpaces.resolveProviderService(item.providerId, {});
				const discovered = await untilAborted(provider.discover(connection, bounded), bounded);
				signal?.throwIfAborted();
				const mounted = this.memorySpaces.mountDiscovered(item.providerId, connection, discovered);
				return {
					providerId: item.providerId,
					label,
					found: discovered.length,
					added: mounted.added.map((body) => ({
						id: body.id,
						name: body.name
					})),
					disconnected: mounted.disconnected
				};
			} catch (error) {
				signal?.throwIfAborted();
				const failure = {
					providerId: item.providerId,
					label,
					found: 0,
					added: [],
					disconnected: 0
				};
				if (timeout.aborted) {
					const limit = providerTimeoutMs < 1e3 ? `${providerTimeoutMs} ms` : `${Math.round(providerTimeoutMs / 1e3)} seconds`;
					return {
						...failure,
						timedOut: true,
						error: `did not answer within ${limit}`
					};
				}
				return {
					...failure,
					error: error instanceof Error ? error.message : String(error)
				};
			}
		}));
		return {
			at: (/* @__PURE__ */ new Date()).toISOString(),
			trigger,
			results: results.filter((result) => result !== void 0)
		};
	}
	updateSpace(id, request) {
		this.assertWritable();
		return this.memorySpaces.update(id, request);
	}
	updateSpaceMetadata(updates) {
		this.assertWritable();
		return this.memorySpaces.updateMetadata(updates);
	}
	async deleteSpace(id, signal) {
		this.assertWritable();
		return await this.memorySpaces.remove(id, signal);
	}
	async mergeSpaces(targetSpaceId, sourceSpaceIds, deactivateSources = true, signal) {
		this.assertWritable();
		const target = this.memorySpaces.get(targetSpaceId);
		if (!this.isNativeSpace(target)) throw new Error("memory-space merge currently requires a Mnemon Native target");
		const sourceIds = [...new Set(sourceSpaceIds.map((id) => id.trim()).filter((id) => id !== ""))];
		if (sourceIds.length === 0) throw new Error("sourceMemoryBodyIds requires at least one memory space");
		if (sourceIds.includes(target.id)) throw new Error("target memory space cannot also be a merge source");
		const sources = sourceIds.map((id) => this.memorySpaces.get(id));
		if (sources.some((source) => !this.isNativeSpace(source))) throw new Error("memory-space merge currently supports Mnemon Native sources only");
		const insights = [];
		const edges = [];
		for (const source of sources) {
			const offset = insights.length;
			const sourceInsights = await this.providerFor(source).list(source, { limit: 1e5 }, signal);
			const indexById = new Map(sourceInsights.map((insight, index) => [insight.id, offset + index]));
			for (const insight of sourceInsights) insights.push({
				content: insight.content,
				...insight.category === void 0 ? {} : { category: insight.category },
				...insight.importance === void 0 ? {} : { importance: insight.importance },
				...insight.tags === void 0 ? {} : { tags: insight.tags },
				...insight.entities === void 0 ? {} : { entities: insight.entities },
				...insight.source === void 0 ? {} : { source: insight.source },
				...insight.createdAt === void 0 ? {} : { created_at: insight.createdAt }
			});
			const graph = await this.providerFor(source).graph(source, signal);
			for (const edge of graph.edges) {
				const sourceIndex = indexById.get(edge.sourceId);
				const targetIndex = indexById.get(edge.targetId);
				if (sourceIndex === void 0 || targetIndex === void 0 || edge.type === void 0) continue;
				edges.push({
					source_index: sourceIndex,
					target_index: targetIndex,
					edge_type: edge.type,
					weight: .5,
					reason: edge.label
				});
			}
		}
		if (insights.length === 0) {
			if (deactivateSources) for (const source of sources) {
				if (!source.active) continue;
				this.memorySpaces.setActive(source.id, false);
			}
			return {
				action: "merged",
				imported: 0,
				updated: 0,
				skipped: 0,
				edges_inserted: 0,
				targetMemoryBodyId: target.id
			};
		}
		const temporary = mkdtempSync(join(tmpdir(), "dsh-mnemon-merge-"));
		const draftPath = join(temporary, "memory-draft.json");
		try {
			writeFileSync(draftPath, JSON.stringify({
				schema_version: "1",
				source: "dsh-mnemon-merge",
				insights,
				edges
			}), {
				encoding: "utf8",
				mode: 384
			});
			const result = await this.runner.runJson(["import", draftPath], {
				...signal === void 0 ? {} : { signal },
				store: target.id
			});
			const summary = record(result);
			const counts = [
				summary?.imported,
				summary?.updated,
				summary?.skipped
			];
			const complete = mutationResultCommitted(result) && summary?.errors === 0 && counts.every((value) => typeof value === "number" && Number.isInteger(value) && value >= 0) && counts.reduce((sum, value) => sum + Number(value), 0) === insights.length;
			this.activateAfterWrite(target, complete);
			if (deactivateSources && complete) for (const source of sources) {
				if (!source.active) continue;
				this.memorySpaces.setActive(source.id, false);
			}
			const completion = mutationResultCompletion(result);
			return this.annotateResult({
				...summary,
				status: complete ? "committed" : completion === "committed" ? "partial" : completion
			}, target);
		} finally {
			rmSync(temporary, {
				recursive: true,
				force: true
			});
		}
	}
	providerFor(body) {
		const provider = this.providers.get(body.provider.id);
		if (provider === void 0) throw new Error(`unsupported memory provider: ${body.provider.id}`);
		return provider;
	}
	readSpaces(ids) {
		if (ids === void 0 || ids.length === 0) return this.memorySpaces.active();
		const requested = [...new Set(ids.map((id) => id.trim()).filter((id) => id !== ""))];
		const available = /* @__PURE__ */ new Map();
		for (const body of this.memorySpaces.list()) if (!available.has(body.id)) available.set(body.id, body);
		return requested.map((id) => {
			const normalized = validateMemorySpaceId(id);
			const body = available.get(normalized);
			if (body === void 0) throw new Error(`unknown memory space: ${normalized}`);
			if (!body.active) throw new Error(`memory space is not active for reading: ${id}`);
			if (!this.isNativeSpace(body) && !this.memorySpaces.providerServiceEnabled(body.provider.id)) throw new Error(`${body.provider.label} is disabled on the dsh-mnemon page under Plugins`);
			return body;
		});
	}
	readSpace(id) {
		if (id !== void 0 && id.trim() !== "") {
			const body = this.memorySpaces.get(id);
			if (!body.active) throw new Error(`memory space is not active for reading: ${body.id}`);
			if (!this.isNativeSpace(body) && !this.memorySpaces.providerServiceEnabled(body.provider.id)) throw new Error(`${body.provider.label} is disabled on the dsh-mnemon page under Plugins`);
			return body;
		}
		const active = this.memorySpaces.active();
		if (active.length !== 1) throw new Error("memoryBodyId is required when the number of active memory spaces is not exactly one");
		return active[0];
	}
	writeSpace(id) {
		if (id !== void 0 && id.trim() !== "") {
			const body = this.memorySpaces.get(id);
			if (!this.isNativeSpace(body) && !this.memorySpaces.providerServiceEnabled(body.provider.id)) throw new Error(`${body.provider.label} is disabled on the dsh-mnemon page under Plugins`);
			return body;
		}
		const active = this.memorySpaces.active();
		if (active.length !== 1) throw new Error("memoryBodyId is required when the number of active memory spaces is not exactly one");
		return active[0];
	}
	prepareRemember(request, destinations) {
		const key = request.memoryBodyId?.trim() ?? "";
		const body = destinations?.get(key) ?? this.writeSpace(request.memoryBodyId);
		destinations?.set(key, body);
		const content = required(request.content, "content", 8192);
		const importance = request.importance === void 0 ? void 0 : memoryInputInteger(request.importance, 3, 1, 5);
		const category = allowed(request.category, CATEGORIES, "category") ?? "general";
		const source = allowed(request.source, SOURCES, "source") ?? "user";
		const tags = commaList(request.tags, "tags", 20)?.split(",");
		const entities = commaList(request.entities, "entities", 50)?.split(",");
		return {
			body,
			request: {
				content,
				...importance === void 0 ? {} : { importance },
				category,
				source,
				memoryBodyId: body.id,
				...tags === void 0 ? {} : { tags },
				...entities === void 0 ? {} : { entities }
			}
		};
	}
	annotate(insight, body) {
		return {
			...insight,
			memoryBodyId: body.id,
			memoryBodyName: body.name,
			memoryProviderId: body.provider.id,
			memoryProviderLabel: body.provider.label,
			memoryCapabilities: body.provider.capabilities
		};
	}
	annotateResult(result, body) {
		const value = record(result);
		return value === void 0 ? result : {
			...value,
			memoryBodyId: body.id,
			memoryBodyName: body.name,
			memoryProviderId: body.provider.id,
			memoryProviderLabel: body.provider.label
		};
	}
	activateAfterWrite(body, providerChanged) {
		this.invalidateEntityIndex(body.id);
		if (!providerChanged) return;
		if (!body.active) this.memorySpaces.setActive(body.id, true);
		else this.memorySpaces.touch(body.id);
	}
	assertWritable() {
		if (!this.config.writeEnabled) throw new Error("dsh-mnemon is configured read-only (writeEnabled: false)");
	}
};
//#endregion
//#region src/config.ts
const MemorySpacesConfig = z.object({
	dataDir: z.string(),
	cliPath: z.string(),
	store: z.string(),
	timeoutMs: z.number().step(1).min(1).max(6e5),
	defaultRecallLimit: z.number().step(1).min(1).max(50),
	writeEnabled: z.boolean(),
	embedding: z.any(),
	recallQuality: z.any(),
	persistenceStrategy: z.any()
});
function optionalText(value) {
	return value?.trim() || void 0;
}
const MEMORY_PROVIDER_ID = /^[a-z][a-z0-9-]{0,127}$/u;
const MEMORY_PLACEMENT_CAPABILITY_SET = new Set(MEMORY_PLACEMENT_CAPABILITIES);
const MEMORY_PLACEMENT_PREFERENCE_SET = /* @__PURE__ */ new Set([
	"balanced",
	"local-first",
	"shared-first"
]);
function resolvePersistenceStrategy(value) {
	const mode = value?.mode ?? "manual";
	if (mode !== "manual" && mode !== "automatic") throw new Error(`dsh-mnemon: unsupported persistence strategy mode: ${String(mode)}`);
	const providerId = value?.providerId ?? "mnemon-native";
	if (!MEMORY_PROVIDER_ID.test(providerId)) throw new Error(`dsh-mnemon: invalid persistence strategy provider: ${String(providerId)}`);
	const prompt = value?.prompt?.trim() ?? "";
	if (prompt.length > 4e3) throw new Error("dsh-mnemon: persistence strategy prompt is too long (max 4000 characters)");
	const configuredProviderIds = value?.rules?.allowedProviderIds;
	const allowedProviderIds = [...new Set(configuredProviderIds === void 0 || configuredProviderIds.length === 0 && mode === "manual" ? [NATIVE_PROVIDER_ID] : configuredProviderIds)];
	if (allowedProviderIds.length === 0) throw new Error("dsh-mnemon: persistence strategy requires at least one allowed provider");
	for (const id of allowedProviderIds) if (!MEMORY_PROVIDER_ID.test(id)) throw new Error(`dsh-mnemon: invalid persistence strategy provider: ${String(id)}`);
	const dataBoundary = value?.rules?.dataBoundary ?? "allow-remote";
	if (dataBoundary !== "allow-remote" && dataBoundary !== "local-only") throw new Error(`dsh-mnemon: unsupported persistence data boundary: ${String(dataBoundary)}`);
	const requiredCapabilities = [...new Set(value?.rules?.requiredCapabilities ?? [])];
	for (const capability of requiredCapabilities) if (!MEMORY_PLACEMENT_CAPABILITY_SET.has(capability)) throw new Error(`dsh-mnemon: unsupported persistence capability: ${String(capability)}`);
	const preference = value?.rules?.preference ?? "balanced";
	if (!MEMORY_PLACEMENT_PREFERENCE_SET.has(preference)) throw new Error(`dsh-mnemon: unsupported persistence preference: ${String(preference)}`);
	const providerConnections = Object.fromEntries(Object.entries(value?.providerConnections ?? {}).flatMap(([id, connection]) => {
		if (!MEMORY_PROVIDER_ID.test(id) || connection === void 0) return [];
		return [[id, Object.fromEntries(Object.entries(connection).filter((entry) => [
			"string",
			"number",
			"boolean"
		].includes(typeof entry[1])))]];
	}));
	return {
		mode,
		providerId,
		...value?.providerId === void 0 ? { providerDefaulted: true } : {},
		prompt,
		rules: {
			allowedProviderIds,
			dataBoundary,
			requiredCapabilities,
			preference
		},
		providerConnections
	};
}
function resolveEmbedding(value) {
	const endpoint = optionalText(value?.endpoint) ?? "http://localhost:11434";
	if (endpoint.length > 2048) throw new Error("dsh-mnemon: embedding endpoint is too long");
	let parsed;
	try {
		parsed = new URL(endpoint);
	} catch {
		throw new Error("dsh-mnemon: embedding endpoint must be an absolute HTTP or HTTPS URL");
	}
	if (!["http:", "https:"].includes(parsed.protocol) || parsed.username !== "" || parsed.password !== "" || endpoint.includes("?") || endpoint.includes("#")) throw new Error("dsh-mnemon: embedding endpoint must be an absolute HTTP or HTTPS URL without credentials, query, or fragment");
	const normalizedEndpoint = endpoint.replace(/\/+$/u, "");
	const model = optionalText(value?.model) ?? "nomic-embed-text";
	if (model.length > 200 || /[\u0000-\u001f\u007f]/u.test(model)) throw new Error("dsh-mnemon: embedding model must contain 1..200 characters without control characters");
	const apiKey = optionalText(value?.apiKey) ?? "";
	if (apiKey.length > 2048 || /[\u0000-\u001f\u007f]/u.test(apiKey)) throw new Error("dsh-mnemon: embedding API key must contain 0..2048 characters without control characters");
	const apiKeyEnv = optionalText(value?.apiKeyEnv);
	const apiKeyRef = optionalText(value?.apiKeyRef);
	if (value?.apiKeyEnv !== void 0 && (typeof value.apiKeyEnv !== "string" || apiKeyEnv !== void 0 && !EMBEDDING_ENVIRONMENT_NAME.test(apiKeyEnv))) throw new Error("dsh-mnemon: embedding apiKeyEnv must name a Host environment variable");
	if (value?.apiKeyRef !== void 0 && (typeof value.apiKeyRef !== "string" || apiKeyRef !== void 0 && !EMBEDDING_CREDENTIAL_REFERENCE.test(apiKeyRef))) throw new Error("dsh-mnemon: embedding apiKeyRef must reference a Mnemon embedding credential");
	const protocol = value?.protocol ?? "auto";
	if (!MNEMON_EMBEDDING_PROTOCOLS.includes(protocol)) throw new Error(`dsh-mnemon: unsupported embedding protocol: ${String(protocol)}`);
	return {
		enabled: value?.enabled === true,
		endpoint: normalizedEndpoint,
		model,
		apiKey,
		protocol,
		...apiKeyEnv === void 0 ? {} : { apiKeyEnv },
		...apiKeyRef === void 0 ? {} : { apiKeyRef }
	};
}
function resolveRecallQuality(value) {
	const policy = optionalText(value?.policy) ?? "strict-v1";
	if (!/^[a-z][a-z0-9-]{0,63}$/u.test(policy)) throw new Error("dsh-mnemon: recall quality policy id must match [a-z][a-z0-9-]{0,63}");
	const lowScoreThreshold = value?.lowScoreThreshold ?? .25;
	const highScoreThreshold = value?.highScoreThreshold ?? .6;
	const candidateMultiplier = value?.candidateMultiplier ?? 3;
	const maxMediumResults = value?.maxMediumResults ?? 4;
	const maxRankedResults = value?.maxRankedResults ?? 4;
	const maxUnknownResults = value?.maxUnknownResults ?? 2;
	if (!Number.isFinite(lowScoreThreshold) || lowScoreThreshold < 0 || lowScoreThreshold > 1) throw new Error("dsh-mnemon: recall low score threshold must be within 0..1");
	if (!Number.isFinite(highScoreThreshold) || highScoreThreshold < 0 || highScoreThreshold > 1) throw new Error("dsh-mnemon: recall high score threshold must be within 0..1");
	if (lowScoreThreshold >= highScoreThreshold) throw new Error("dsh-mnemon: recall low score threshold must be less than the high score threshold");
	if (!Number.isInteger(candidateMultiplier) || candidateMultiplier < 1 || candidateMultiplier > 5) throw new Error("dsh-mnemon: recall candidate multiplier must be an integer within 1..5");
	if (!Number.isInteger(maxMediumResults) || maxMediumResults < 0 || maxMediumResults > 50) throw new Error("dsh-mnemon: recall max medium results must be an integer within 0..50");
	if (!Number.isInteger(maxRankedResults) || maxRankedResults < 0 || maxRankedResults > 50) throw new Error("dsh-mnemon: recall max ranked results must be an integer within 0..50");
	if (!Number.isInteger(maxUnknownResults) || maxUnknownResults < 0 || maxUnknownResults > 50) throw new Error("dsh-mnemon: recall max unknown results must be an integer within 0..50");
	return {
		policy,
		lowScoreThreshold,
		highScoreThreshold,
		candidateMultiplier,
		maxMediumResults,
		maxRankedResults,
		maxUnknownResults
	};
}
/** Capture only this Source's settings, with an instance-local default authority. */
function resolveMemorySpacesConfig(value = {}, sourceInstanceKey = "standalone") {
	const config = MemorySpacesConfig(value);
	const requested = optionalText(config.dataDir);
	const dataDir = requested === void 0 ? join(homedir(), ".mnemon", "sources", encodeURIComponent(sourceInstanceKey)) : requested === "~" ? homedir() : requested.startsWith("~/") ? join(homedir(), requested.slice(2)) : requested;
	if (!isAbsolute(dataDir)) throw new Error("Memory Spaces dataDir must be absolute or start with ~/");
	const store = optionalText(config.store);
	if (store !== void 0 && !MEMORY_SPACE_ID_PATTERN.test(store)) throw new Error("Memory Spaces store has an invalid identifier");
	const cliPath = optionalText(config.cliPath);
	return {
		storageScope: "custom",
		dataDir,
		...cliPath === void 0 ? {} : { cliPath },
		...store === void 0 ? {} : { store },
		timeoutMs: config.timeoutMs ?? 1e4,
		defaultRecallLimit: config.defaultRecallLimit ?? 10,
		writeEnabled: config.writeEnabled ?? true,
		embedding: resolveEmbedding(config.embedding),
		recallQuality: resolveRecallQuality(config.recallQuality),
		persistenceStrategy: resolvePersistenceStrategy(config.persistenceStrategy)
	};
}
//#endregion
//#region src/source.ts
const CATEGORY_SET = new Set(CATEGORIES);
const SOURCE_SET = new Set(SOURCES);
const INTENT_SET = new Set(INTENTS);
const EDGE_SET = new Set(EDGE_TYPES);
function grantIds(grant) {
	return memoryInputStringArray(memoryInputRecord(grant.value, "Memory Spaces ReadGrant").memoryBodyIds, "memoryBodyIds", 1e4) ?? [];
}
function scalarRecord(value, label) {
	if (value === void 0) return void 0;
	const input = memoryInputRecord(value, label);
	const result = {};
	for (const [key, item] of Object.entries(input)) {
		if (!/^[a-z][a-zA-Z0-9_-]{0,127}$/u.test(key)) throw new Error(`${label} contains an invalid field: ${key}`);
		if (typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") throw new Error(`${label}.${key} must be a string, number, or boolean`);
		result[key] = item;
	}
	return result;
}
function providerConnections(value) {
	if (value === void 0) return void 0;
	const input = memoryInputRecord(value, "providerConnections");
	return Object.fromEntries(Object.entries(input).map(([providerId, connection]) => [memoryInputText(providerId, "providerId", 128), scalarRecord(connection, `providerConnections.${providerId}`)]));
}
function createSpaceRequest(value) {
	const input = memoryInputRecord(value, "Memory Space body-create request");
	const providerId = memoryInputText(input.providerId, "providerId", 128, false);
	const connection = scalarRecord(input.connection, "connection");
	const connections = providerConnections(input.providerConnections);
	const placementValue = input.placement === void 0 ? void 0 : memoryInputRecord(input.placement, "placement");
	const rulesValue = placementValue?.rules === void 0 ? void 0 : memoryInputRecord(placementValue.rules, "placement.rules");
	const allowedProviderIds = rulesValue === void 0 ? void 0 : memoryInputStringArray(rulesValue.allowedProviderIds, "placement.rules.allowedProviderIds", 100);
	const requiredCapabilities = rulesValue === void 0 ? void 0 : memoryInputStringArray(rulesValue.requiredCapabilities, "placement.rules.requiredCapabilities", 20);
	const placement = placementValue === void 0 ? void 0 : {
		mode: memoryInputText(placementValue.mode, "placement.mode", 20),
		...memoryInputText(placementValue.prompt, "placement.prompt", 4e3, false) === void 0 ? {} : { prompt: memoryInputText(placementValue.prompt, "placement.prompt", 4e3, false) },
		...rulesValue === void 0 ? {} : { rules: {
			...allowedProviderIds === void 0 ? {} : { allowedProviderIds },
			...memoryInputText(rulesValue.dataBoundary, "placement.rules.dataBoundary", 30, false) === void 0 ? {} : { dataBoundary: memoryInputText(rulesValue.dataBoundary, "placement.rules.dataBoundary", 30, false) },
			...requiredCapabilities === void 0 ? {} : { requiredCapabilities },
			...memoryInputText(rulesValue.preference, "placement.rules.preference", 30, false) === void 0 ? {} : { preference: memoryInputText(rulesValue.preference, "placement.rules.preference", 30, false) }
		} }
	};
	return {
		name: memoryInputText(input.name, "name", 100),
		description: memoryInputText(input.description, "description", MEMORY_SPACE_DESCRIPTION_MAX_LENGTH),
		...typeof input.active !== "boolean" ? {} : { active: input.active },
		...providerId === void 0 ? {} : { providerId },
		...connection === void 0 ? {} : { connection },
		...connections === void 0 ? {} : { providerConnections: connections },
		...placement === void 0 ? {} : { placement }
	};
}
function updateSpaceRequest(value) {
	const input = memoryInputRecord(value, "Memory Space body-update request");
	const connection = scalarRecord(input.connection, "connection");
	return {
		memoryBodyId: memoryInputText(input.memoryBodyId, "memoryBodyId", 300),
		request: {
			...memoryInputText(input.name, "name", 100, false) === void 0 ? {} : { name: memoryInputText(input.name, "name", 100, false) },
			...memoryInputText(input.description, "description", 1e3, false) === void 0 ? {} : { description: memoryInputText(input.description, "description", MEMORY_SPACE_DESCRIPTION_MAX_LENGTH, false) },
			...typeof input.active !== "boolean" ? {} : { active: input.active },
			...connection === void 0 ? {} : { connection },
			...memoryInputStringArray(input.clearSecrets, "clearSecrets", 100) === void 0 ? {} : { clearSecrets: memoryInputStringArray(input.clearSecrets, "clearSecrets", 100) }
		}
	};
}
function placementDecision(value) {
	if (value === void 0) return void 0;
	const input = memoryInputRecord(value, "Memory Space placement decision");
	return {
		mode: memoryInputText(input.mode, "placement decision mode", 20),
		providerId: memoryInputText(input.providerId, "placement decision providerId", 128),
		decidedBy: memoryInputText(input.decidedBy, "placement decision decidedBy", 20),
		reason: memoryInputText(input.reason, "placement decision reason", 1e3),
		confidence: memoryInputText(input.confidence, "placement decision confidence", 20),
		candidateProviderIds: memoryInputStringArray(input.candidateProviderIds, "placement decision candidateProviderIds", 100),
		appliedRules: memoryInputStringArray(input.appliedRules, "placement decision appliedRules", 100),
		decidedAt: memoryInputText(input.decidedAt, "placement decision decidedAt", 100),
		...memoryInputText(input.runId, "placement decision runId", 500, false) === void 0 ? {} : { runId: memoryInputText(input.runId, "placement decision runId", 500, false) },
		...memoryInputText(input.subagentProvider, "placement decision subagentProvider", 500, false) === void 0 ? {} : { subagentProvider: memoryInputText(input.subagentProvider, "placement decision subagentProvider", 500, false) }
	};
}
/**
* Why this turn's View cannot forget from a Memory Space it does not read (#390). The View is
* pinned for the turn, so switching a space on reaches a forget from the next turn only, and
* whether a space is on stays the user's choice.
*/
function outsideView(service, memoryBodyId) {
	const catalog = service.spaceDirectory();
	const body = catalog.items.find((candidate) => candidate.id === memoryBodyId);
	if (body === void 0) return `Memory Space ${JSON.stringify(memoryBodyId)} does not exist`;
	const space = `Memory Space ${JSON.stringify(memoryBodyId)} (${body.name})`;
	if (!body.active) return `${space} is switched off, so this turn's View does not read it and cannot forget from it. Whether it is on is the user's choice, on the Memory Spaces page; once it is on, a forget there works from the next turn`;
	if (body.providerEnabled === false) return `${space} uses ${body.provider.label}, which is turned off on the dsh-mnemon page under Plugins`;
	const provider = catalog.providers.find((candidate) => candidate.id === body.provider.id);
	if (provider?.serviceConfigured === false) return `${space} uses ${body.provider.label}, which is not available here${isNativeProvider(provider) ? ": the Mnemon CLI is not installed" : ""}`;
	return `${space} was switched on after this turn began, so this turn's View does not read it yet; a forget there works from the next turn`;
}
/** The switched-off spaces a forget cannot reach this turn, named only when there are some (#390). */
function switchedOffSpaces(service) {
	const off = service.spaceDirectory().items.filter((body) => !body.active);
	if (off.length === 0) return "";
	return `. Switched-off spaces (${off.slice(0, 5).map((body) => JSON.stringify(body.name)).join(", ")}${off.length > 5 ? ` and ${off.length - 5} more` : ""}) are outside this View; one the user switches on is read from the next turn`;
}
function managementResult(service, value) {
	return {
		revision: service.memoryRevision(),
		value
	};
}
async function manageMemorySpaces(service, request) {
	const input = request.input === null ? {} : memoryInputRecord(request.input, `Memory Spaces management ${request.operation}`);
	if (request.mode === "read") switch (request.operation) {
		case "embedding-status": return managementResult(service, await service.embeddingStatus(request.signal));
		case "status-summary": return managementResult(service, service.statusSummary());
		case "status": return managementResult(service, await service.status(request.signal));
		case "body-directory": return managementResult(service, service.spaceDirectory());
		case "bodies": return managementResult(service, await service.spaces(request.signal));
		case "provider-services": return managementResult(service, service.memorySpaces.providerServices());
		case "graph": return managementResult(service, await service.graph(request.signal, memoryInputStringArray(input.memoryBodyIds, "memoryBodyIds", 1e4)));
		case "list": return managementResult(service, await service.list({
			...memoryInputText(input.query, "query", 2e3, false) === void 0 ? {} : { query: memoryInputText(input.query, "query", 2e3, false) },
			...memoryInputText(input.category, "category", 30, false) === void 0 ? {} : { category: memoryInputText(input.category, "category", 30, false) },
			...input.limit === void 0 ? {} : { limit: memoryInputInteger(input.limit, 100, 1, 1e4) },
			...memoryInputStringArray(input.memoryBodyIds, "memoryBodyIds", 1e4) === void 0 ? {} : { memoryBodyIds: memoryInputStringArray(input.memoryBodyIds, "memoryBodyIds", 1e4) }
		}, request.signal));
		case "entities": return managementResult(service, await service.entities(memoryInputText(input.entity, "entity", 500, false), input.limit === void 0 ? void 0 : memoryInputInteger(input.limit, 100, 1, 1e4), request.signal));
		case "entity-memories": return managementResult(service, await service.entityMemories(memoryInputText(input.entity, "entity", 500), input.offset === void 0 ? void 0 : memoryInputInteger(input.offset, 0, 0, 1e6), input.limit === void 0 ? void 0 : memoryInputInteger(input.limit, 50, 1, 200), request.signal));
		case "entity-related": return managementResult(service, await service.entityRelated(memoryInputText(input.entity, "entity", 500), input.limit === void 0 ? void 0 : memoryInputInteger(input.limit, 20, 1, 50), request.signal, memoryInputText(input.view, "view", 200, false)));
		case "search": return managementResult(service, await service.search({
			query: memoryInputText(input.query, "query", 2e3),
			...memoryInputText(input.mode, "mode", 20, false) === void 0 ? {} : { mode: memoryInputText(input.mode, "mode", 20, false) },
			...input.limit === void 0 ? {} : { limit: memoryInputInteger(input.limit, 10, 1, 1e3) },
			...memoryInputText(input.category, "category", 30, false) === void 0 ? {} : { category: memoryInputText(input.category, "category", 30, false) },
			...memoryInputText(input.source, "source", 30, false) === void 0 ? {} : { source: memoryInputText(input.source, "source", 30, false) },
			...memoryInputText(input.intent, "intent", 30, false) === void 0 ? {} : { intent: memoryInputText(input.intent, "intent", 30, false) },
			...memoryInputStringArray(input.memoryBodyIds, "memoryBodyIds", 1e4) === void 0 ? {} : { memoryBodyIds: memoryInputStringArray(input.memoryBodyIds, "memoryBodyIds", 1e4) },
			...input.inspect === true ? { inspect: true } : {}
		}, request.signal));
		case "related": return managementResult(service, await service.related(memoryInputText(input.id, "id", 2e3), memoryInputInteger(input.depth, 2, 1, 5), memoryInputText(input.edge, "edge", 30, false), request.signal, memoryInputText(input.memoryBodyId, "memoryBodyId", 300, false)));
		case "body-reconnect": return managementResult(service, await service.reconnectSpace(memoryInputText(input.memoryBodyId, "memoryBodyId", 300), request.signal));
		case "prepare-body-placement": return managementResult(service, service.prepareSpacePlacement(createSpaceRequest(request.input)));
		case "finalize-placement": {
			const prepared = memoryInputRecord(input.prepared, "prepared placement");
			if (!Array.isArray(prepared.candidates) || prepared.candidates.length === 0) throw new Error("placement candidates are required");
			const selection = input.selection === void 0 ? void 0 : memoryInputRecord(input.selection, "placement selection");
			return managementResult(service, selection === void 0 ? rulesOnlyPlacement(prepared) ?? null : finalizeLlmPlacement(prepared, {
				providerId: memoryInputText(selection.providerId, "providerId", 128),
				reason: memoryInputText(selection.reason, "reason", 4e3),
				confidence: memoryInputText(selection.confidence, "confidence", 40)
			}, {
				runId: memoryInputText(input.runId, "runId", 300),
				provider: memoryInputText(input.provider, "provider", 300)
			}));
		}
		case "metadata-sample": return managementResult(service, await service.metadataSample(memoryInputText(input.memoryBodyId, "memoryBodyId", 300), request.signal));
		default: throw new Error(`unsupported Memory Spaces management read operation: ${request.operation}`);
	}
	if (!request.confirmed) throw new Error("Memory Spaces management mutation requires explicit confirmation");
	switch (request.operation) {
		case "embedding-fill": return managementResult(service, await service.embedMissing(memoryInputText(input.memoryBodyId, "memoryBodyId", 300), request.signal));
		case "provider-service-update": {
			const providerId = memoryInputText(input.providerId, "providerId", 128);
			await service.updateProviderService(providerId, scalarRecord(input.settings, "settings") ?? {}, memoryInputStringArray(input.clearSecrets, "clearSecrets", 100) ?? [], input.enabled === void 0 ? true : input.enabled === true, request.signal);
			return managementResult(service, service.memorySpaces.providerServices().items.find((item) => item.providerId === providerId));
		}
		case "remember": return managementResult(service, await service.remember({
			content: memoryInputText(input.content, "content", 1e5),
			...memoryInputText(input.category, "category", 30, false) === void 0 ? {} : { category: memoryInputText(input.category, "category", 30, false) },
			...typeof input.importance !== "number" ? {} : { importance: input.importance },
			...memoryInputStringArray(input.tags, "tags", 100) === void 0 ? {} : { tags: memoryInputStringArray(input.tags, "tags", 100) },
			...memoryInputStringArray(input.entities, "entities", 100) === void 0 ? {} : { entities: memoryInputStringArray(input.entities, "entities", 100) },
			...memoryInputText(input.source, "source", 30, false) === void 0 ? {} : { source: memoryInputText(input.source, "source", 30, false) },
			...memoryInputText(input.memoryBodyId, "memoryBodyId", 300, false) === void 0 ? {} : { memoryBodyId: memoryInputText(input.memoryBodyId, "memoryBodyId", 300, false) }
		}, request.signal));
		case "link": return managementResult(service, await service.link(memoryInputText(input.sourceId, "sourceId", 2e3), memoryInputText(input.targetId, "targetId", 2e3), memoryInputText(input.type, "type", 30, false) ?? "semantic", typeof input.weight === "number" ? input.weight : .5, memoryInputText(input.reason, "reason", 1e3, false), request.signal, memoryInputText(input.memoryBodyId, "memoryBodyId", 300, false)));
		case "forget": return managementResult(service, await service.forget(memoryInputText(input.id, "id", 2e3), request.signal, memoryInputText(input.memoryBodyId, "memoryBodyId", 300, false)));
		case "body-create": {
			const bodyInput = input.request ?? request.input;
			return managementResult(service, await service.createSpace(createSpaceRequest(bodyInput), request.signal, placementDecision(input.placementDecision)));
		}
		case "body-update": {
			const parsed = updateSpaceRequest(request.input);
			return managementResult(service, service.updateSpace(parsed.memoryBodyId, parsed.request));
		}
		case "remember-many":
			if (!Array.isArray(input.requests) || input.requests.length > 1e3) throw new Error("remember-many requires at most 1000 requests");
			return managementResult(service, await service.rememberMany(input.requests.map((value) => memoryInputRecord(value, "remember request")), request.signal));
		case "body-create-for-persistence": {
			const selection = input.selection === void 0 ? void 0 : memoryInputRecord(input.selection, "placement selection");
			return managementResult(service, await service.createSpaceForPersistence(createSpaceRequest(input.request ?? request.input), selection === void 0 ? void 0 : {
				providerId: memoryInputText(selection.providerId, "providerId", 128),
				reason: memoryInputText(selection.reason, "reason", 4e3),
				confidence: memoryInputText(selection.confidence, "confidence", 40)
			}, request.signal));
		}
		case "body-metadata-update": {
			if (!Array.isArray(input.updates) || input.updates.length > 20) throw new Error("metadata update requires at most 20 entries");
			const updates = input.updates.map((value) => {
				const update = memoryInputRecord(value, "metadata update");
				return {
					memoryBodyId: memoryInputText(update.memoryBodyId, "memoryBodyId", 300),
					title: memoryInputText(update.title, "title", 48),
					description: memoryInputText(update.description, "description", 200)
				};
			});
			return managementResult(service, service.updateSpaceMetadata(updates));
		}
		case "body-merge": return managementResult(service, await service.mergeSpaces(memoryInputText(input.targetMemoryBodyId, "targetMemoryBodyId", 300), memoryInputStringArray(input.sourceMemoryBodyIds, "sourceMemoryBodyIds", 1e3) ?? [], input.deactivateSources !== false, request.signal));
		case "reload":
			service.memorySpaces.reload();
			return managementResult(service, { reloaded: true });
		case "provider-rediscover": return managementResult(service, await service.rediscoverProviders(input.trigger === "startup" ? "startup" : "manual", request.signal));
		case "body-delete": return managementResult(service, await service.deleteSpace(memoryInputText(input.memoryBodyId, "memoryBodyId", 300), request.signal));
		default: throw new Error(`unsupported Memory Spaces management mutation operation: ${request.operation}`);
	}
}
function createMemorySpacesSource(providerSnapshot, config = {}, readCredential) {
	const capturedConfig = structuredClone(config);
	return defineMemorySource({
		manifest: {
			apiVersion: COMPOSABLE_MEMORY_API_VERSION,
			kind: "source",
			typeId: "memory-spaces",
			packageName: "dsh-mnemon-source-memory-spaces",
			role: "durable-evidence",
			capabilities: [
				"status",
				"project",
				"recall",
				"related",
				"write",
				"link",
				"forget"
			],
			consistency: "namespace-pinned-live-read",
			routes: [
				{
					id: "inspect",
					description: "Inspect bounded Memory Space health or routing metadata without exposing storage paths or credentials.",
					capability: "status",
					inputSchema: {
						type: "object",
						required: ["section"],
						additionalProperties: false,
						properties: { section: {
							type: "string",
							enum: ["directory", "health"]
						} }
					},
					maxCalls: 4,
					maxResults: 1,
					maxCharacters: 12e3
				},
				{
					id: "recall",
					description: "Recall evidence only from Memory Spaces pinned into this View.",
					capability: "recall",
					inputSchema: {
						type: "object",
						required: ["query"],
						additionalProperties: false,
						properties: {
							query: { type: "string" },
							mode: {
								type: "string",
								enum: [
									"smart",
									"keyword",
									"basic"
								]
							},
							limit: { type: "integer" },
							category: { type: "string" },
							source: { type: "string" },
							intent: { type: "string" },
							memoryBodyIds: { type: "array" }
						}
					},
					maxCalls: 4,
					maxResults: 20,
					maxCharacters: 16e3
				},
				{
					id: "related",
					description: "Traverse related memories only from evidence already admitted by this View.",
					capability: "related",
					inputSchema: {
						type: "object",
						required: ["id"],
						additionalProperties: false,
						properties: {
							id: { type: "string" },
							depth: { type: "integer" },
							edge: { type: "string" },
							memoryBodyId: { type: "string" }
						}
					},
					maxCalls: 4,
					maxResults: 20,
					maxCharacters: 16e3
				}
			],
			actions: [
				{
					id: "manage-spaces",
					description: "Create a Memory Space under the configured persistence policy, or update/merge spaces in this View scope.",
					capability: "write",
					inputSchema: {
						type: "object",
						required: ["operation"],
						additionalProperties: false,
						properties: {
							operation: {
								type: "string",
								enum: [
									"create",
									"update",
									"merge"
								]
							},
							request: { type: "object" },
							selection: { type: "object" },
							memoryBodyId: { type: "string" },
							name: { type: "string" },
							description: { type: "string" },
							active: { type: "boolean" },
							targetMemoryBodyId: { type: "string" },
							sourceMemoryBodyIds: { type: "array" },
							deactivateSources: { type: "boolean" }
						}
					}
				},
				{
					id: "remember",
					description: "Record memory using an authorized Space and its Provider; the receipt distinguishes accepted extraction from commitment.",
					capability: "write",
					inputSchema: {
						type: "object",
						required: ["content"],
						additionalProperties: false,
						properties: {
							content: { type: "string" },
							category: { type: "string" },
							importance: { type: "number" },
							tags: { type: "array" },
							entities: { type: "array" },
							source: { type: "string" },
							memoryBodyId: { type: "string" }
						}
					}
				},
				{
					id: "link",
					description: "Link two evidence items admitted by this View and owned by the same Memory Space.",
					capability: "link",
					inputSchema: {
						type: "object",
						required: ["sourceId", "targetId"],
						additionalProperties: false,
						properties: {
							sourceId: { type: "string" },
							targetId: { type: "string" },
							memoryBodyId: { type: "string" },
							type: { type: "string" },
							weight: { type: "number" },
							reason: { type: "string" }
						}
					}
				},
				{
					id: "forget",
					description: "Forget one returned evidence item using its Provider deletion mode (soft or hard); not a guarantee of universal erasure.",
					capability: "forget",
					inputSchema: {
						type: "object",
						required: ["id"],
						additionalProperties: false,
						properties: {
							id: { type: "string" },
							memoryBodyId: { type: "string" }
						}
					}
				}
			],
			management: {
				label: "Memory Spaces",
				description: "Durable evidence across local and remote Provider-backed namespaces."
			}
		},
		create(context) {
			const resolved = resolveMemorySpacesConfig({
				...context.configuration,
				...capturedConfig
			}, context.sourceInstanceKey);
			const service = new MemorySpacesService(createRunner(resolved, void 0, readCredential), resolved, void 0, void 0, providerSnapshot.adapterRegistry(), new MemoryProviderCatalog(providerSnapshot.descriptors()));
			const canRemember = providerSnapshot.entries.some((entry) => entry.definition.manifest.capabilities.remember);
			const prepared = /* @__PURE__ */ new WeakMap();
			const sourceState = (scope) => {
				const value = service.memoryState();
				prepared.set(scope, value);
				return value;
			};
			const admittedByView = /* @__PURE__ */ new Map();
			const createdByView = /* @__PURE__ */ new Map();
			const writeBodies = (viewId, grant) => {
				if (grant.sourceInstanceKey !== context.sourceInstanceKey || grant.schema !== "dsh-mnemon.memory-spaces/v1") throw new Error("Memory Spaces write scope grant does not belong to this Source");
				const known = memoryInputStringArray(memoryInputRecord(grant.value, "Memory Spaces scope").knownMemoryBodyIds, "knownMemoryBodyIds", 1e4) ?? grantIds(grant);
				return [.../* @__PURE__ */ new Set([...known, ...createdByView.get(viewId) ?? []])];
			};
			const admit = (viewId, entries) => {
				const current = admittedByView.get(viewId) ?? /* @__PURE__ */ new Map();
				for (const entry of entries) if (entry.memoryBodyId !== void 0) current.set(entry.memoryBodyId + "/" + entry.id, entry.memoryBodyId);
				admittedByView.delete(viewId);
				admittedByView.set(viewId, current);
				while (admittedByView.size > 128) admittedByView.delete(admittedByView.keys().next().value);
			};
			/**
			* The Memory Space an exact id belongs to, for an action or traversal that
			* names a memory by id. Evidence this View returned decides first, as
			* before. Otherwise the Providers that can look an id up are asked among
			* the spaces in `scope`, and a found memory is admitted to this View. An
			* Agent can so forget what it just wrote, and a delegated worker can act on
			* an id from its parent's turn (#337). A Provider that cannot look ids up
			* keeps to evidence: its own call may reach beyond the space named.
			*/
			const ownerOf = async (viewId, id, requestedSpace, scope, signal) => {
				const entries = admittedByView.get(viewId);
				if (requestedSpace !== void 0) {
					if (entries?.has(requestedSpace + "/" + id) === true) return requestedSpace;
				} else {
					const owners = [...entries?.entries() ?? []].filter(([reference]) => reference.endsWith("/" + id)).map(([, owner]) => owner);
					if (owners.length > 0) return owners.length === 1 ? owners[0] : void 0;
				}
				const candidates = requestedSpace === void 0 ? scope : scope.includes(requestedSpace) ? [requestedSpace] : [];
				if (candidates.length === 0) return void 0;
				const found = await service.locate(id, candidates, signal);
				const owners = [...new Set(found.flatMap((item) => item.memoryBodyId === void 0 ? [] : [item.memoryBodyId]))];
				if (owners.length !== 1) return void 0;
				admit(viewId, [{
					id,
					memoryBodyId: owners[0]
				}]);
				return owners[0];
			};
			const evidence = (request, items, unavailable) => {
				const catalog = request.route.sourceRouteId === "inspect";
				let remaining = request.route.maxCharacters ?? 16e3;
				let truncated = false;
				const visible = items.slice(0, request.route.maxResults ?? 20).flatMap((item) => {
					if (remaining <= 0 || catalog && item.content.length > remaining) {
						truncated = true;
						return [];
					}
					const content = catalog ? item.content : truncateMemoryText(item.content, remaining);
					remaining -= content.length;
					const clipped = content !== item.content;
					truncated ||= clipped;
					return [{
						item,
						content,
						clipped
					}];
				});
				truncated ||= visible.length < items.length;
				if (!catalog) admit(request.view.id, visible.map(({ item }) => item));
				return {
					id: `evidence:${randomUUID()}`,
					viewId: request.view.id,
					routeId: request.route.id,
					sourceInstanceKey: context.sourceInstanceKey,
					observedAt: (/* @__PURE__ */ new Date()).toISOString(),
					items: visible.map(({ item, content, clipped }) => ({
						id: item.id,
						text: content,
						...(item.normalizedScore ?? item.score) === void 0 ? {} : { score: item.normalizedScore ?? item.score },
						...item.createdAt === void 0 ? {} : { revision: item.createdAt },
						provenance: {
							...item.memoryBodyId === void 0 ? {} : { memoryBodyId: item.memoryBodyId },
							...item.memoryBodyName === void 0 ? {} : { memoryBodyName: item.memoryBodyName },
							...item.memoryProviderId === void 0 ? {} : { memoryProviderId: item.memoryProviderId },
							...item.memoryProviderLabel === void 0 ? {} : { memoryProviderLabel: item.memoryProviderLabel },
							...item.memoryCapabilities === void 0 ? {} : { memoryCapabilities: { ...item.memoryCapabilities } },
							...item.relevanceTier === void 0 ? {} : { relevanceTier: item.relevanceTier },
							...item.category === void 0 ? {} : { category: item.category },
							...item.importance === void 0 ? {} : { importance: item.importance },
							...item.createdAt === void 0 ? {} : { createdAt: item.createdAt },
							...item.tags === void 0 ? {} : { tags: item.tags },
							...item.entities === void 0 ? {} : { entities: item.entities },
							...item.source === void 0 ? {} : { source: item.source },
							...item.depth === void 0 ? {} : { depth: item.depth },
							...item.edgeType === void 0 ? {} : { edgeType: item.edgeType },
							...item.externalUri === void 0 ? {} : { externalUri: item.externalUri }
						}
					})),
					truncated,
					...unavailable === void 0 ? {} : { unavailable },
					...catalog && visible.length === 0 ? { unavailable: "Inspection cannot fit the View budget as valid catalog JSON." } : {}
				};
			};
			return {
				facts(request) {
					const { active, providerReady, revision } = sourceState(request.scope);
					const routeIds = [
						"inspect",
						...active.some((body) => body.provider.capabilities.search) ? ["recall"] : [],
						...active.some((body) => body.provider.capabilities.related) ? ["related"] : []
					];
					const actionIds = service.config.writeEnabled ? [
						...providerReady ? ["manage-spaces"] : [],
						...canRemember && providerReady ? ["remember"] : [],
						...active.some((body) => body.provider.capabilities.link) ? ["link"] : [],
						...active.some((body) => body.provider.capabilities.forget) ? ["forget"] : []
					] : [];
					const capabilities = ["status", "project"];
					if (routeIds.includes("recall")) capabilities.push("recall");
					if (routeIds.includes("related")) capabilities.push("related");
					if (actionIds.includes("manage-spaces") || actionIds.includes("remember")) capabilities.push("write");
					if (actionIds.includes("link")) capabilities.push("link");
					if (actionIds.includes("forget")) capabilities.push("forget");
					return {
						sourceInstanceKey: context.sourceInstanceKey,
						sourceTypeId: "memory-spaces",
						role: "durable-evidence",
						availability: active.length === 0 ? "degraded" : "ready",
						revision,
						capabilities: [...capabilities],
						routeIds,
						actionIds,
						hints: {
							activeCount: active.length,
							providerCount: new Set(active.map((body) => body.provider.id)).size,
							archivableCount: active.filter((body) => body.provider.capabilities.remember && body.provider.capabilities.forget && body.provider.capabilities.writeMode === "exact").length
						}
					};
				},
				project(request) {
					const { all, active, revision } = prepared.get(request.scope) ?? sourceState(request.scope);
					prepared.delete(request.scope);
					if (revision !== request.expectedRevision) throw new Error("Memory Spaces projection revision changed during composition");
					const cover = `${active.length} active of ${all.length} configured Memory Space${all.length === 1 ? "" : "s"} available through scoped recall.`;
					return {
						fragments: request.includeProjection ? [{
							id: `${context.sourceInstanceKey}/projection`,
							sourceInstanceKey: context.sourceInstanceKey,
							mode: request.mode,
							text: truncateMemoryText(cover, request.maxCharacters),
							revision,
							provenance: { sourceTypeId: "memory-spaces" }
						}] : [],
						readGrant: {
							id: `${context.sourceInstanceKey}/grant/${revision}`,
							sourceInstanceKey: context.sourceInstanceKey,
							schema: "dsh-mnemon.memory-spaces/v1",
							value: {
								memoryBodyIds: active.map((body) => body.id),
								knownMemoryBodyIds: all.map((body) => body.id)
							},
							revision,
							consistency: "namespace-pinned-live-read"
						},
						presentation: {
							visibleItems: active.length,
							totalItems: all.length,
							items: active.slice(0, 24).map((body) => ({
								id: body.id,
								title: truncateMemoryText(body.name, 160),
								...body.description.trim() === "" ? {} : { excerpt: truncateMemoryText(body.description, 600) }
							}))
						}
					};
				},
				async query(request) {
					const allowedBodies = grantIds(request.grant);
					const input = memoryInputRecord(request.input, `Memory Spaces ${request.route.sourceRouteId}`);
					if (request.route.sourceRouteId === "inspect") {
						const known = memoryInputStringArray(memoryInputRecord(request.grant.value, "Memory Spaces scope").knownMemoryBodyIds, "knownMemoryBodyIds", 1e4) ?? allowedBodies;
						let value;
						if (input.section === "directory") {
							const catalog = service.spaceDirectory();
							const owned = createdByView.get(request.view.id);
							value = modelSpaceCatalog({
								...catalog,
								items: catalog.items.filter((body) => known.includes(body.id) || owned?.has(body.id))
							});
						} else if (input.section === "health") value = modelStatus(await service.status(request.signal));
						else throw new Error("unknown Memory Spaces inspection section");
						return evidence(request, [{
							id: "memory-spaces:" + String(input.section),
							content: modelJson(value, request.route.maxCharacters ?? 12e3)
						}]);
					}
					if (request.route.sourceRouteId === "recall") {
						const category = memoryInputText(input.category, "category", 30, false);
						const source = memoryInputText(input.source, "source", 30, false);
						const intent = memoryInputText(input.intent, "intent", 30, false);
						if (category !== void 0 && !CATEGORY_SET.has(category)) throw new Error(`unsupported category: ${category}`);
						if (source !== void 0 && !SOURCE_SET.has(source)) throw new Error(`unsupported source: ${source}`);
						if (intent !== void 0 && !INTENT_SET.has(intent)) throw new Error(`unsupported intent: ${intent}`);
						const requestedSpaces = memoryInputStringArray(input.memoryBodyIds, "memoryBodyIds", 1e4) ?? allowedBodies;
						if (requestedSpaces.some((id) => !allowedBodies.includes(id))) throw new Error("Recall requested a Memory Space outside this View ReadGrant");
						const mode = memoryInputText(input.mode, "mode", 20, false);
						const result = await service.search({
							query: memoryInputText(input.query, "query", 2e3),
							...mode === void 0 ? {} : { mode },
							limit: Math.min(request.route.maxResults ?? 20, memoryInputInteger(input.limit, 10, 1, 20)),
							memoryBodyIds: requestedSpaces,
							...category === void 0 ? {} : { category },
							...source === void 0 ? {} : { source },
							...intent === void 0 ? {} : { intent }
						}, request.signal);
						return evidence(request, result.results, result.results.length === 0 ? result.hint : void 0);
					}
					if (request.route.sourceRouteId === "related") {
						const id = memoryInputText(input.id, "id", 2e3);
						const requestedSpace = memoryInputText(input.memoryBodyId, "memoryBodyId", 300, false);
						const owner = await ownerOf(request.view.id, id, requestedSpace, allowedBodies, request.signal);
						if (owner === void 0) throw new Error("related-memory traversal requires evidence already admitted by this View, or an id found in a Memory Space it can read");
						if (!allowedBodies.includes(owner)) throw new Error("related-memory owner is outside this View ReadGrant");
						const edge = memoryInputText(input.edge, "edge", 30, false);
						if (edge !== void 0 && !EDGE_SET.has(edge)) throw new Error(`unsupported edge: ${edge}`);
						const results = await service.related(id, memoryInputInteger(input.depth, 2, 1, 5), edge, request.signal, owner);
						return evidence(request, results);
					}
					throw new Error(`unsupported Memory Spaces Route: ${request.route.sourceRouteId}`);
				},
				async mutate(request) {
					const input = memoryInputRecord(request.input, `Memory Spaces ${request.offer.sourceActionId}`);
					if (!service.config.writeEnabled) throw new Error("Memory Spaces is configured read-only");
					const grant = request.grant;
					if (grant === void 0) throw new Error("Memory Spaces action has no View ReadGrant");
					const allowedBodies = grantIds(grant);
					const created = createdByView.get(request.view.id) ?? /* @__PURE__ */ new Set();
					const writableBodies = writeBodies(request.view.id, grant);
					const admittedOwner = (id) => ownerOf(request.view.id, id, memoryInputText(input.memoryBodyId, "memoryBodyId", 300, false), allowedBodies, request.signal);
					let result;
					let bodyId;
					if (request.offer.sourceActionId === "manage-spaces") {
						if (input.operation === "create") {
							const selection = input.selection === void 0 ? void 0 : memoryInputRecord(input.selection, "placement selection");
							const body = await service.createSpaceForPersistence(createSpaceRequest(input.request), selection === void 0 ? void 0 : {
								providerId: memoryInputText(selection.providerId, "providerId", 128),
								reason: memoryInputText(selection.reason, "reason", 4e3),
								confidence: memoryInputText(selection.confidence, "confidence", 40)
							}, request.signal);
							created.add(body.id);
							createdByView.set(request.view.id, created);
							while (createdByView.size > 128) createdByView.delete(createdByView.keys().next().value);
							bodyId = body.id;
							result = {
								action: "created",
								memoryBodyId: body.id,
								name: body.name,
								description: body.description
							};
						} else if (input.operation === "update") {
							bodyId = memoryInputText(input.memoryBodyId, "memoryBodyId", 300);
							if (!writableBodies.includes(bodyId)) throw new Error("Memory Space update is outside this View scope");
							const body = service.updateSpace(bodyId, {
								...input.name === void 0 ? {} : { name: memoryInputText(input.name, "name", 100) },
								...input.description === void 0 ? {} : { description: memoryInputText(input.description, "description", MEMORY_SPACE_DESCRIPTION_MAX_LENGTH) },
								...typeof input.active === "boolean" ? { active: input.active } : {}
							});
							result = {
								action: "updated",
								memoryBodyId: body.id,
								name: body.name,
								description: body.description,
								active: body.active
							};
						} else if (input.operation === "merge") {
							const target = memoryInputText(input.targetMemoryBodyId, "targetMemoryBodyId", 300);
							const sources = memoryInputStringArray(input.sourceMemoryBodyIds, "sourceMemoryBodyIds", 20) ?? [];
							if ([target, ...sources].some((id) => !writableBodies.includes(id))) throw new Error("Memory Space merge is outside this View scope");
							bodyId = target;
							result = await service.mergeSpaces(target, sources, input.deactivateSources !== false, request.signal);
						} else throw new Error("unsupported Memory Space management action");
					} else if (request.offer.sourceActionId === "remember") {
						bodyId = memoryInputText(input.memoryBodyId, "memoryBodyId", 300, false);
						if (bodyId === void 0) {
							const defaults = [.../* @__PURE__ */ new Set([...allowedBodies, ...created])];
							if (defaults.length !== 1) throw new Error("remember requires an explicit Memory Space in this View scope");
							bodyId = defaults[0];
						}
						if (!writableBodies.includes(bodyId)) throw new Error("remember destination is outside this View scope");
						const category = memoryInputText(input.category, "category", 30, false);
						const source = memoryInputText(input.source, "source", 30, false);
						if (category !== void 0 && !CATEGORY_SET.has(category)) throw new Error(`unsupported category: ${category}`);
						if (source !== void 0 && !SOURCE_SET.has(source)) throw new Error(`unsupported source: ${source}`);
						result = await service.remember({
							content: memoryInputText(input.content, "content", 1e5),
							...category === void 0 ? {} : { category },
							...source === void 0 ? {} : { source },
							...typeof input.importance !== "number" ? {} : { importance: input.importance },
							...input.tags === void 0 ? {} : { tags: memoryInputStringArray(input.tags, "tags") ?? [] },
							...input.entities === void 0 ? {} : { entities: memoryInputStringArray(input.entities, "entities") ?? [] },
							...bodyId === void 0 ? {} : { memoryBodyId: bodyId }
						}, request.signal);
					} else if (request.offer.sourceActionId === "link") {
						const sourceId = memoryInputText(input.sourceId, "sourceId", 2e3);
						const targetId = memoryInputText(input.targetId, "targetId", 2e3);
						const sourceSpace = await admittedOwner(sourceId);
						const targetSpace = await admittedOwner(targetId);
						if (sourceSpace === void 0 || targetSpace === void 0 || sourceSpace !== targetSpace || !allowedBodies.includes(sourceSpace)) throw new Error("link requires two evidence items admitted by this View from the same Memory Space, or two ids found in one Memory Space it can read");
						bodyId = sourceSpace;
						const edge = memoryInputText(input.type, "type", 30, false);
						if (edge !== void 0 && !EDGE_SET.has(edge)) throw new Error(`unsupported edge: ${edge}`);
						const weight = typeof input.weight === "number" ? input.weight : .5;
						result = await service.link(sourceId, targetId, edge, weight, memoryInputText(input.reason, "reason", 1e3, false), request.signal, bodyId);
					} else if (request.offer.sourceActionId === "forget") {
						const id = memoryInputText(input.id, "id", 2e3);
						const named = memoryInputText(input.memoryBodyId, "memoryBodyId", 300, false);
						if (named !== void 0 && !allowedBodies.includes(named)) throw new Error(outsideView(service, named));
						bodyId = await admittedOwner(id);
						if (bodyId === void 0 || !allowedBodies.includes(bodyId)) throw new Error(`forget requires evidence already admitted by this View, or an id found in one Memory Space it can read; name the space (memoryBodyId) when several hold it${switchedOffSpaces(service)}`);
						result = await service.forget(id, request.signal, bodyId);
					} else throw new Error(`unsupported Memory Spaces action: ${request.offer.sourceActionId}`);
					return createMemoryMutationReceipt(request.view.id, request.offer.id, context.sourceInstanceKey, service.memoryRevision(), {
						memoryBodyId: bodyId ?? null,
						result
					}, mutationResultCompletion(result));
				},
				manage(request) {
					if (request.mode === "read" && request.operation === "body-directory" && request.input !== null) {
						const input = memoryInputRecord(request.input, "Memory Spaces body-directory");
						if (input.writeScope !== void 0) {
							if (!service.config.writeEnabled) throw new Error("Memory Spaces is configured read-only");
							const scope = memoryInputRecord(input.writeScope, "Memory Spaces write scope");
							const viewId = memoryInputText(scope.viewId, "write scope viewId", 300);
							const grant = memoryInputRecord(scope.grant ?? null, "Memory Spaces write scope grant");
							return managementResult(service, {
								...service.spaceDirectory(),
								writeScope: {
									viewId,
									sourceInstanceKey: context.sourceInstanceKey,
									memoryBodyIds: writeBodies(viewId, grant)
								}
							});
						}
					}
					return manageMemorySpaces(service, request);
				},
				async dispose() {
					admittedByView.clear();
					createdByView.clear();
					await service.dispose();
				}
			};
		}
	});
}
//#endregion
//#region src/index.ts
const name = "dsh-mnemon-source-memory-spaces";
const inject = ["mnemonMemory"];
const memoryPlugin = defineMemoryPlugin({
	packageName: name,
	label: {
		en: "Memory Spaces",
		"zh-CN": "记忆空间"
	},
	description: {
		en: "Provider-backed durable evidence recalled on demand across tasks and sessions.",
		"zh-CN": "由 Provider 支撑的持久证据，按需跨任务与会话召回。"
	},
	roles: ["source"],
	provides: [{ id: "source" }, { id: "source.durable-evidence" }]
});
const MemorySpaceProviderDeclarationSchema = z.object({
	use: z.string().required(),
	instanceId: z.string(),
	config: z.any()
});
const Config = z.intersect([MemorySpacesConfig, z.object({ providers: z.array(z.union([z.string(), MemorySpaceProviderDeclarationSchema])).default([]) })]);
function sourceInstanceId(ctx, explicit) {
	const configured = explicit?.trim();
	if (configured !== void 0 && configured !== "") return configured;
	const located = ctx.get("loader", false)?.locate(ctx.fiber)?.trim();
	if (located !== void 0 && located !== "") return located;
	throw new Error("Memory Spaces requires a stable Loader Entry id; pass instanceId for a direct mount");
}
function importedProviderModule(loader, value, specifier) {
	const unwrapped = loader.unwrapExports(value);
	if (typeof unwrapped !== "object" || unwrapped === null) throw new Error(`Memory Space Provider module ${specifier} did not export a typed child module`);
	return defineMemorySpaceProvider(unwrapped);
}
/** Resolve only the explicitly listed children; no dependency scanning occurs. */
async function resolveMemorySpaceProviderEntries(ctx, declarations) {
	if (declarations.length === 0) throw new Error("Memory Spaces requires at least one explicit Provider child");
	const loader = ctx.get("loader", false);
	const entries = [];
	const instanceIds = /* @__PURE__ */ new Set();
	for (const declaration of declarations) {
		const use = (typeof declaration === "string" ? declaration : declaration.use).trim();
		if (use === "") throw new Error("Memory Space Provider declaration use is required");
		if (loader === void 0) throw new Error("cannot resolve installed Memory Space Provider module without the DSH Loader: " + use);
		const module = importedProviderModule(loader, await loader.import(use), use);
		const entry = {
			instanceId: typeof declaration === "string" ? module.id : declaration.instanceId?.trim() || module.id,
			module,
			config: typeof declaration === "string" ? void 0 : declaration.config
		};
		if (instanceIds.has(entry.instanceId)) throw new Error(`duplicate Memory Space Provider child: ${entry.instanceId}`);
		instanceIds.add(entry.instanceId);
		entries.push(entry);
	}
	return entries;
}
/** Compose an explicit Provider child list into one effective Source. */
async function installMemorySpaces(ctx, entries, options = {}) {
	if (entries.length === 0) throw new Error("Memory Spaces requires at least one explicit Provider child");
	const entryId = sourceInstanceId(ctx, options.instanceId);
	resolveMemorySpacesConfig(options.config, entryId);
	const privateHost = new PrivateMemorySpaceProviderHost(entryId);
	const children = [];
	try {
		for (const entry of entries) children.push(ctx.plugin(createMemorySpaceProviderPlugin(entry, privateHost), entry.config));
		await Promise.all(children.map((child) => child.await()));
		for (const entry of entries) if (!privateHost.has(entry.instanceId)) throw new Error(`Memory Space Provider child did not install a definition: ${entry.instanceId}`);
		const snapshot = privateHost.snapshot();
		installMemory(ctx, {
			plugin: memoryPlugin,
			sources: [createMemorySpacesSource(snapshot, options.config, async (reference) => {
				const credentials = ctx.get("credentials", false);
				if (credentials === void 0) throw new Error("DSH credentials service is unavailable");
				return credentials.readRecord(reference);
			})]
		}, {
			instanceId: entryId,
			effectiveDigest: "providers:" + memoryConfigurationDigest({
				providers: snapshot.digest,
				config: options.config ?? {}
			}).slice(7)
		});
	} catch (error) {
		await Promise.allSettled(children.reverse().map((child) => child.dispose()));
		throw error;
	}
}
/**
* dshmarket's client-only mount of a Memory Spaces package installed on its own
* in a profile, `include:dsh-market:mkt-client-<package>`: it is meant to run no
* host code, and the Starter's own Entry composes the Source with its Providers (#359).
*/
function isMarketClientShim(ctx) {
	const loader = ctx.get("loader", false);
	return /(?:^|:)mkt-client-[^:]*$/u.test(loader?.locate(ctx.fiber)?.trim() ?? "");
}
async function apply(ctx, config = { providers: [] }) {
	if (isMarketClientShim(ctx)) return;
	const { providers, ...sourceConfig } = config;
	await installMemorySpaces(ctx, await resolveMemorySpaceProviderEntries(ctx, providers), { config: sourceConfig });
}
//#endregion
export { Config, MemorySpaceProviderDeclarationSchema, apply, inject, installMemorySpaces, memoryPlugin, name, resolveEmbedding, resolveMemorySpaceProviderEntries, resolvePersistenceStrategy, resolveRecallQuality };
