import { DOCUMENTS_ACTIVE_LIMIT_BYTES, DOCUMENTS_DIRECTORY, DOCUMENTS_INDEX_FILE, DOCUMENTS_LOCK_FILE, DOCUMENTS_LOCK_STALE_MS, DOCUMENTS_VERSION, DOCUMENT_FILENAME_PATTERN, DocumentCapacityPlan, DocumentIndex, DocumentIndexSummary, DocumentMutation, DocumentMutationResult, DocumentRecord, DocumentSearchResult, DocumentSnapshot, DocumentStatus, DocumentView, parseDocumentIndex, summarizeDocumentIndex } from "./contracts.js";
import z from "@deepseek-ai/schemastery";
import { MemorySourceDefinition } from "dsh-mnemon/contracts";
import { Context } from "@deepseek-ai/cordis";
//#region src/config.d.ts
interface Config {
  dataDir?: string;
  limitBytes?: number;
}
declare const Config: z<Config>;
//#endregion
//#region src/source.d.ts
declare function createDocumentsMemorySource(config?: Config): MemorySourceDefinition;
declare const DOCUMENTS_MEMORY_SOURCE: MemorySourceDefinition;
//#endregion
//#region src/index.d.ts
declare const name = "dsh-mnemon-source-documents";
declare const inject: string[];
declare const memoryPlugin: import("dsh-mnemon/extension-sdk").MemoryPluginDescriptor;
declare function apply(ctx: Context, config?: Config): void;
//#endregion
export { Config, type DOCUMENTS_ACTIVE_LIMIT_BYTES, type DOCUMENTS_DIRECTORY, type DOCUMENTS_INDEX_FILE, type DOCUMENTS_LOCK_FILE, type DOCUMENTS_LOCK_STALE_MS, DOCUMENTS_MEMORY_SOURCE, type DOCUMENTS_VERSION, type DOCUMENT_FILENAME_PATTERN, type DocumentCapacityPlan, type DocumentIndex, type DocumentIndexSummary, type DocumentMutation, type DocumentMutationResult, type DocumentRecord, type DocumentSearchResult, type DocumentSnapshot, type DocumentStatus, type DocumentView, apply, createDocumentsMemorySource, inject, memoryPlugin, name, type parseDocumentIndex, type summarizeDocumentIndex };