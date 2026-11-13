import { RUNTIME_ARCHIVE_DIRECTORY, RUNTIME_BRANCH_NAME_MAX, RUNTIME_BRANCH_NAME_PATTERN, RUNTIME_DIRECTORY, RUNTIME_ENTRY_DELIMITER, RUNTIME_ENTRY_MAX_BYTES, RUNTIME_LOCK_FILE, RUNTIME_LOCK_STALE_MS, RUNTIME_MEMORIES_FILE, RUNTIME_MEMORY_LIMITS, RUNTIME_MEMORY_LIMIT_MAX_BYTES, RUNTIME_MEMORY_VERSION, RUNTIME_PINNED_PROJECTION_LIMIT, RUNTIME_PROJECTION_FILES, RuntimeMemoriesSummary, RuntimeMemoryAction, RuntimeMemoryCompactedEntry, RuntimeMemoryEntry, RuntimeMemoryEntryOrigin, RuntimeMemoryImportance, RuntimeMemoryLimits, RuntimeMemoryMaintenancePlan, RuntimeMemoryMutation, RuntimeMemoryMutationResult, RuntimeMemorySnapshot, RuntimeMemoryTarget, RuntimeMemoryTargetView, RuntimeMemoryUsage, assertRuntimePinnedBudget, parseRuntimeBranches, runtimeBytes, runtimePinnedProjection, runtimeProjection, summarizeRuntimeMemories } from "./contracts.js";
import * as projectionSDK from "dsh-mnemon/extension-sdk";
import z from "@deepseek-ai/schemastery";
import { MemorySourceDefinition } from "dsh-mnemon/contracts";
import { Context } from "@deepseek-ai/cordis";
//#region src/config.d.ts
interface Config {
  dataDir?: string;
  userDataDir?: string;
  memoryLimitBytes?: number;
  userLimitBytes?: number;
}
declare const Config: z<Config>;
//#endregion
//#region src/source.d.ts
declare function createRuntimeMemorySource(config?: Config): MemorySourceDefinition;
declare const RUNTIME_MEMORY_SOURCE: projectionSDK.MemorySourceDefinition;
//#endregion
//#region src/index.d.ts
declare const name = "dsh-mnemon-source-runtime";
declare const inject: string[];
declare const memoryPlugin: import("dsh-mnemon/extension-sdk").MemoryPluginDescriptor;
declare function apply(ctx: Context, config?: Config): void;
//#endregion
export { Config, type RUNTIME_ARCHIVE_DIRECTORY, type RUNTIME_BRANCH_NAME_MAX, type RUNTIME_BRANCH_NAME_PATTERN, type RUNTIME_DIRECTORY, type RUNTIME_ENTRY_DELIMITER, type RUNTIME_ENTRY_MAX_BYTES, type RUNTIME_LOCK_FILE, type RUNTIME_LOCK_STALE_MS, type RUNTIME_MEMORIES_FILE, type RUNTIME_MEMORY_LIMITS, type RUNTIME_MEMORY_LIMIT_MAX_BYTES, RUNTIME_MEMORY_SOURCE, type RUNTIME_MEMORY_VERSION, type RUNTIME_PINNED_PROJECTION_LIMIT, type RUNTIME_PROJECTION_FILES, type RuntimeMemoriesSummary, type RuntimeMemoryAction, type RuntimeMemoryCompactedEntry, type RuntimeMemoryEntry, type RuntimeMemoryEntryOrigin, type RuntimeMemoryImportance, type RuntimeMemoryLimits, type RuntimeMemoryMaintenancePlan, type RuntimeMemoryMutation, type RuntimeMemoryMutationResult, type RuntimeMemorySnapshot, type RuntimeMemoryTarget, type RuntimeMemoryTargetView, type RuntimeMemoryUsage, apply, type assertRuntimePinnedBudget, createRuntimeMemorySource, inject, memoryPlugin, name, type parseRuntimeBranches, type runtimeBytes, type runtimePinnedProjection, type runtimeProjection, type summarizeRuntimeMemories };