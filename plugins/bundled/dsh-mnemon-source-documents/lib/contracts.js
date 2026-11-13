//#region src/contracts.ts
const DOCUMENTS_VERSION = 1;
const DOCUMENTS_ACTIVE_LIMIT_BYTES = 10485760;
/** The Documents Source's directory under a storage root; each document sits in `<status>/<filename>` below it. */
const DOCUMENTS_DIRECTORY = "documents";
/** The metadata of every document, the source of truth for which files belong to the Source. */
const DOCUMENTS_INDEX_FILE = "index.json";
/** Created exclusively while the index or a document is read or written; whoever copies them takes it too. */
const DOCUMENTS_LOCK_FILE = ".index.lock";
/** A lock file older than this was left by a process that stopped, and may be taken over. */
const DOCUMENTS_LOCK_STALE_MS = 3e4;
/** The file name a document may have: one path segment, so it never leaves its status directory. */
const DOCUMENT_FILENAME_PATTERN = /^[a-zA-Z0-9._-]+\.md$/u;
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Read an index as a copy of it carries it, such as a Mnemon Pack or a sync branch: every record
* complete, each id unique and each file name safe, or the whole index is refused. A record's path
* is where its status puts it, whatever the copy says. Unknown fields are dropped, and so are
* list items that are not strings. Reading the index does not judge a record's content hash: a
* store that needs repair still has to be copied as one.
*/
function parseDocumentIndex(value) {
	const index = isObject(value) ? value : void 0;
	if (index?.version !== 1 || !Array.isArray(index.documents)) throw new Error("Documents index.json is invalid");
	const ids = /* @__PURE__ */ new Set();
	return {
		version: 1,
		documents: index.documents.map((raw) => {
			const item = isObject(raw) ? raw : void 0;
			if (typeof item?.id !== "string" || item.id.trim() === "" || ids.has(item.id)) throw new Error("Documents index contains an invalid or duplicate id");
			if (typeof item.title !== "string" || typeof item.description !== "string" || item.status !== "active" && item.status !== "archived") throw new Error("Documents index contains an invalid record");
			if (typeof item.filename !== "string" || !DOCUMENT_FILENAME_PATTERN.test(item.filename)) throw new Error("Documents index contains an unsafe filename");
			if (typeof item.createdAt !== "string" || typeof item.updatedAt !== "string" || typeof item.lastAccessedAt !== "string" || !Number.isSafeInteger(item.revision) || typeof item.contentHash !== "string" || !Number.isSafeInteger(item.sizeBytes)) throw new Error("Documents index contains invalid metadata");
			if (!Array.isArray(item.sourcePaths) || !Array.isArray(item.sessionIds) || !Array.isArray(item.memoryBodyIds)) throw new Error("Documents index contains invalid lists");
			ids.add(item.id);
			return {
				id: item.id,
				title: item.title,
				description: item.description,
				status: item.status,
				filename: item.filename,
				relativePath: `${DOCUMENTS_DIRECTORY}/${item.status}/${item.filename}`,
				sourcePaths: item.sourcePaths.filter((entry) => typeof entry === "string"),
				sessionIds: item.sessionIds.filter((entry) => typeof entry === "string"),
				createdAt: item.createdAt,
				updatedAt: item.updatedAt,
				lastAccessedAt: item.lastAccessedAt,
				revision: Number(item.revision),
				contentHash: item.contentHash,
				sizeBytes: Number(item.sizeBytes),
				...typeof item.archivedAt === "string" ? { archivedAt: item.archivedAt } : {},
				...typeof item.archiveSummary === "string" ? { archiveSummary: item.archiveSummary } : {},
				memoryBodyIds: item.memoryBodyIds.filter((entry) => typeof entry === "string")
			};
		})
	};
}
/**
* Count the records of a parsed index.json for a read-only inventory. It never throws: an index
* without a record list is not `valid`, and a malformed record is counted or skipped, never refused.
*/
function summarizeDocumentIndex(value) {
	const documents = isObject(value) && Array.isArray(value.documents) ? value.documents.filter(isObject) : [];
	return {
		valid: isObject(value) && Array.isArray(value.documents),
		documents: documents.length,
		active: documents.filter((document) => document.status === "active").length,
		archived: documents.filter((document) => document.status === "archived").length
	};
}
//#endregion
export { DOCUMENTS_ACTIVE_LIMIT_BYTES, DOCUMENTS_DIRECTORY, DOCUMENTS_INDEX_FILE, DOCUMENTS_LOCK_FILE, DOCUMENTS_LOCK_STALE_MS, DOCUMENTS_VERSION, DOCUMENT_FILENAME_PATTERN, parseDocumentIndex, summarizeDocumentIndex };
