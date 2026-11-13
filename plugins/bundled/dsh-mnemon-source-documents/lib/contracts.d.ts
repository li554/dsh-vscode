//#region src/contracts.d.ts
type DocumentStatus = 'active' | 'archived';
interface DocumentRecord {
  id: string;
  title: string;
  description: string;
  status: DocumentStatus;
  filename: string;
  relativePath: string;
  sourcePaths: string[];
  sessionIds: string[];
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  revision: number;
  contentHash: string;
  sizeBytes: number;
  archivedAt?: string;
  archiveSummary?: string;
  memoryBodyIds: string[];
}
interface DocumentView extends DocumentRecord {
  content: string;
  /** Digest of the exact managed file read; deletion also fences external edits. */
  fileRevision?: string;
}
interface DocumentSnapshot {
  workspaceRoot: string;
  directory: string;
  indexPath: string;
  generatedAt: string;
  revision: string;
  limitBytes: number;
  activeBytes: number;
  activeCount: number;
  archivedCount: number;
  total: number;
  documents: Array<DocumentRecord & {
    healthy: boolean;
    excerpt: string;
  }>;
}
interface DocumentSearchResult {
  query: string;
  includeArchived: boolean;
  total: number;
  generatedAt: string;
  results: Array<DocumentView & {
    score: number;
    excerpt: string;
  }>;
}
type DocumentMutation = {
  action: 'create';
  title: string;
  description?: string;
  content: string;
  sourcePaths?: string[];
  sessionIds?: string[];
} | {
  action: 'update';
  id: string;
  title?: string;
  description?: string;
  content?: string;
  sourcePaths?: string[];
  sessionIds?: string[];
} | {
  action: 'delete';
  id: string;
  fileRevision?: string;
};
interface DocumentMutationResult {
  success: true;
  action: 'created' | 'updated' | 'archived' | 'deleted';
  document: DocumentView;
  snapshot: DocumentSnapshot;
  maintenance?: {
    runId: string;
    provider: string;
    summary: string;
    memoryBodyIds: string[];
    archivedDocumentIds: string[];
  };
}
interface DocumentCapacityPlan {
  projected: number;
  limit: number;
  fits: boolean;
  candidates: DocumentRecord[];
}
declare const DOCUMENTS_VERSION = 1;
declare const DOCUMENTS_ACTIVE_LIMIT_BYTES: number;
/** The Documents Source's directory under a storage root; each document sits in `<status>/<filename>` below it. */
declare const DOCUMENTS_DIRECTORY = "documents";
/** The metadata of every document, the source of truth for which files belong to the Source. */
declare const DOCUMENTS_INDEX_FILE = "index.json";
/** Created exclusively while the index or a document is read or written; whoever copies them takes it too. */
declare const DOCUMENTS_LOCK_FILE = ".index.lock";
/** A lock file older than this was left by a process that stopped, and may be taken over. */
declare const DOCUMENTS_LOCK_STALE_MS = 30000;
/** The file name a document may have: one path segment, so it never leaves its status directory. */
declare const DOCUMENT_FILENAME_PATTERN: RegExp;
interface DocumentIndex {
  version: typeof DOCUMENTS_VERSION;
  documents: DocumentRecord[];
}
/**
 * Read an index as a copy of it carries it, such as a Mnemon Pack or a sync branch: every record
 * complete, each id unique and each file name safe, or the whole index is refused. A record's path
 * is where its status puts it, whatever the copy says. Unknown fields are dropped, and so are
 * list items that are not strings. Reading the index does not judge a record's content hash: a
 * store that needs repair still has to be copied as one.
 */
declare function parseDocumentIndex(value: unknown): DocumentIndex;
/** What a stored index.json holds, counted without judging each record. */
interface DocumentIndexSummary {
  /** Whether the index has a record list at all. Without one, every count is 0. */
  valid: boolean;
  /** Every record that is an object, whatever its status. */
  documents: number;
  active: number;
  archived: number;
}
/**
 * Count the records of a parsed index.json for a read-only inventory. It never throws: an index
 * without a record list is not `valid`, and a malformed record is counted or skipped, never refused.
 */
declare function summarizeDocumentIndex(value: unknown): DocumentIndexSummary;
//#endregion
export { DOCUMENTS_ACTIVE_LIMIT_BYTES, DOCUMENTS_DIRECTORY, DOCUMENTS_INDEX_FILE, DOCUMENTS_LOCK_FILE, DOCUMENTS_LOCK_STALE_MS, DOCUMENTS_VERSION, DOCUMENT_FILENAME_PATTERN, DocumentCapacityPlan, DocumentIndex, DocumentIndexSummary, DocumentMutation, DocumentMutationResult, DocumentRecord, DocumentSearchResult, DocumentSnapshot, DocumentStatus, DocumentView, parseDocumentIndex, summarizeDocumentIndex };