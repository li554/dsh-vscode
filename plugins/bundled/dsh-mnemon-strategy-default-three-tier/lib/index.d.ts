import * as projectionSDK from "dsh-mnemon/extension-sdk";
import { Context } from "@deepseek-ai/cordis";
//#region src/strategy.d.ts
/** Pure View composition; no dependency on any Source implementation. */
declare const DEFAULT_THREE_TIER_VIEW_STRATEGY: {
  createTurn: (view: projectionSDK.ComposableMemoryView) => projectionSDK.MemoryStrategyTurn;
  manifest: {
    apiVersion: "dsh-mnemon/v1";
    kind: "strategy";
    typeId: string;
    packageName: string;
    deterministic: true;
    supportedSourceRoles: ("working-context" | "narrative" | "durable-evidence")[];
    maxSources: number;
    maxRoutes: number;
    maxActions: number;
    extensionSlots: string[];
    workflows: ("idle-review" | "runtime-capacity")[];
  };
  compose(request: projectionSDK.MemoryViewRequest, sources: readonly projectionSDK.MemoryAvailableSource[], contributions?: readonly projectionSDK.MemoryStrategyContribution[] | undefined): projectionSDK.MemoryViewSpec;
};
//#endregion
//#region src/index.d.ts
declare const name = "dsh-mnemon-strategy-default-three-tier";
declare const inject: string[];
declare const memoryPlugin: import("dsh-mnemon/extension-sdk").MemoryPluginDescriptor;
declare const memoryStrategyConfiguration: import("dsh-mnemon/extension-sdk").MemoryStrategyConfiguration;
declare function apply(ctx: Context): void;
//#endregion
export { DEFAULT_THREE_TIER_VIEW_STRATEGY, apply, inject, memoryPlugin, memoryStrategyConfiguration, name };