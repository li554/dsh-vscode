//#region src/contracts.ts
/**
* The Mnemon Native Provider's id. Its package names its descriptor and driver
* with it, the Starter installs it under it, and a stored space that names no
* Provider belongs to it.
*/
const NATIVE_PROVIDER_ID = "mnemon-native";
/** Whether a Provider is Mnemon Native: by its implementation type, else by its id. */
function isNativeProvider(provider) {
	return (provider.typeId ?? provider.id) === NATIVE_PROVIDER_ID;
}
/** What a persistence strategy's rules can require of a Provider; the Starter's settings schema takes the same list. */
const MEMORY_PLACEMENT_CAPABILITIES = [
	"graph",
	"entities",
	"related",
	"exact-write",
	"link",
	"forget"
];
const CATEGORIES = [
	"preference",
	"decision",
	"fact",
	"insight",
	"context",
	"general"
];
const SOURCES = [
	"user",
	"agent",
	"external"
];
const EDGE_TYPES = [
	"temporal",
	"semantic",
	"causal",
	"entity"
];
const INTENTS = [
	"WHY",
	"WHEN",
	"ENTITY",
	"GENERAL"
];
/**
* One spelling-insensitive key per entity. The Host's entity index and the Client's graph
* both count an entity's memories by it, so their numbers agree.
*/
function normalizeEntityKey(entity) {
	return entity.normalize("NFKC").trim().toLocaleLowerCase();
}
const DEFAULT_EMBEDDING_ENDPOINT = "http://localhost:11434";
const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";
const EMBEDDING_PROTOCOL_AUTO = "auto";
const EMBEDDING_PROTOCOL_OLLAMA = "ollama";
const EMBEDDING_PROTOCOL_OPENAI = "openai";
/** Default protocol defers to Mnemon's /v1 auto-detection. */
const DEFAULT_EMBEDDING_PROTOCOL = EMBEDDING_PROTOCOL_AUTO;
/** Wire protocols accepted by the embedding protocol override; single source for schema, resolver, and UI validation. */
const MNEMON_EMBEDDING_PROTOCOLS = [
	EMBEDDING_PROTOCOL_AUTO,
	EMBEDDING_PROTOCOL_OLLAMA,
	EMBEDDING_PROTOCOL_OPENAI
];
const EMBEDDING_CREDENTIAL_PREFIX = "dsh-mnemon/embedding-";
const EMBEDDING_CREDENTIAL_REFERENCE = /^dsh-mnemon\/embedding-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const EMBEDDING_ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/u;
/** The directory under a storage root that holds Mnemon's stores, one per Native space, and their registry. */
const MEMORY_SPACES_DIRECTORY = "data";
/** The registry of Native spaces. The published v1 name and its `bodies` key stay for existing stores and Packs. */
const MEMORY_SPACE_REGISTRY_FILE = ".dsh-memory-bodies.json";
/** A Native space's Mnemon store, in the directory its space id names. */
const MEMORY_SPACE_DATABASE_FILE = "mnemon.db";
/** A space id, which also names its store's directory. */
const MEMORY_SPACE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
/** The most characters a space's name holds. */
const MEMORY_SPACE_NAME_MAX_LENGTH = 100;
/** The most characters a space's routing description holds. */
const MEMORY_SPACE_DESCRIPTION_MAX_LENGTH = 1e3;
/** Mnemon's own record of its default store, one space id, at the storage root. */
const MNEMON_ACTIVE_STORE_FILE = "active";
/** Third-party Provider services and the spaces they serve, in the storage root's `state` directory. No Pack carries it. */
const MEMORY_PROVIDER_REGISTRY_FILE = "memory-providers.json";
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Read a registry as a copy of it carries it: each id unique and usable as a directory name,
* every name, description and time present, or the whole registry is refused. Only the fields of
* the entry above are kept, so a copy holds nothing else, and a registry written back from one
* no longer holds what else an entry recorded, such as a Native space's `placement` decision or
* `metadataSource`.
*/
function parseMemorySpaceRegistry(value) {
	const registry = isObject(value) ? value : void 0;
	if (registry?.version !== 1 || !Array.isArray(registry.bodies)) throw new Error("Memory Space registry is invalid");
	const ids = /* @__PURE__ */ new Set();
	return {
		version: 1,
		bodies: registry.bodies.map((raw) => {
			const body = isObject(raw) ? raw : void 0;
			if (typeof body?.id !== "string" || !MEMORY_SPACE_ID_PATTERN.test(body.id) || ids.has(body.id)) throw new Error("Memory Space registry contains an invalid or duplicate id");
			if (typeof body.name !== "string" || body.name.trim() === "" || body.name.length > 100 || typeof body.description !== "string" || body.description.length > 1e3) throw new Error("Memory Space registry contains invalid metadata");
			if (typeof body.createdAt !== "string" || typeof body.updatedAt !== "string") throw new Error("Memory Space registry contains invalid timestamps");
			ids.add(body.id);
			return {
				id: body.id,
				name: body.name,
				description: body.description,
				active: body.active === true,
				createdAt: body.createdAt,
				updatedAt: body.updatedAt
			};
		})
	};
}
/** Count the spaces of a parsed registry for a read-only inventory. It never throws. */
function summarizeMemorySpaceRegistry(value) {
	const registry = isObject(value) ? value : void 0;
	const listed = registry?.bodies;
	const spaces = Array.isArray(listed) ? listed.filter(isObject) : [];
	return {
		valid: registry?.version === 1 && Array.isArray(listed),
		spaces: spaces.length,
		active: spaces.filter((space) => space.active === true).length
	};
}
/** Count a parsed Provider registry for a read-only inventory. It never throws. */
function summarizeMemoryProviderRegistry(value) {
	const registry = isObject(value) ? value : void 0;
	const services = registry?.services;
	const listed = registry?.bodies;
	return {
		valid: registry !== void 0,
		services: isObject(services) ? Object.keys(services).length : 0,
		connections: Array.isArray(listed) ? listed.length : 0
	};
}
//#endregion
export { CATEGORIES, DEFAULT_EMBEDDING_ENDPOINT, DEFAULT_EMBEDDING_MODEL, DEFAULT_EMBEDDING_PROTOCOL, EDGE_TYPES, EMBEDDING_CREDENTIAL_PREFIX, EMBEDDING_CREDENTIAL_REFERENCE, EMBEDDING_ENVIRONMENT_NAME, EMBEDDING_PROTOCOL_AUTO, EMBEDDING_PROTOCOL_OLLAMA, EMBEDDING_PROTOCOL_OPENAI, INTENTS, MEMORY_PLACEMENT_CAPABILITIES, MEMORY_PROVIDER_REGISTRY_FILE, MEMORY_SPACES_DIRECTORY, MEMORY_SPACE_DATABASE_FILE, MEMORY_SPACE_DESCRIPTION_MAX_LENGTH, MEMORY_SPACE_ID_PATTERN, MEMORY_SPACE_NAME_MAX_LENGTH, MEMORY_SPACE_REGISTRY_FILE, MNEMON_ACTIVE_STORE_FILE, MNEMON_EMBEDDING_PROTOCOLS, NATIVE_PROVIDER_ID, SOURCES, isNativeProvider, normalizeEntityKey, parseMemorySpaceRegistry, summarizeMemoryProviderRegistry, summarizeMemorySpaceRegistry };
