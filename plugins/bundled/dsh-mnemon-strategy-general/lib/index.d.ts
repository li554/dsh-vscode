import * as projectionSDK from "dsh-mnemon/extension-sdk";
import { MemoryStrategyDefinition } from "dsh-mnemon/contracts";
import { Context } from "@deepseek-ai/cordis";
//#region src/strategy.d.ts
declare const GENERAL_STRATEGY_TYPE_ID = "general";
interface GeneralStrategyConfig {
  /** Sources projected into every turn; unset keeps working-context Sources resident. */
  residentSourceKeys?: string[];
  /** Operator guidance appended to the memory protocol. */
  instruction?: string;
}
/** Role-agnostic composition: every available Source, one shared budget, and the model decides. */
declare function createGeneralStrategy(config?: GeneralStrategyConfig): MemoryStrategyDefinition;
declare const GENERAL_VIEW_STRATEGY: projectionSDK.MemoryStrategyDefinition;
//#endregion
//#region src/index.d.ts
type Config = GeneralStrategyConfig;
declare const name = "dsh-mnemon-strategy-general";
declare const inject: string[];
declare const memoryPlugin: import("dsh-mnemon/extension-sdk").MemoryPluginDescriptor;
declare const memoryStrategyConfiguration: import("dsh-mnemon/extension-sdk").MemoryStrategyConfiguration;
declare function apply(ctx: Context, config?: Config): void;
//#endregion
export { Config, GENERAL_STRATEGY_TYPE_ID, GENERAL_VIEW_STRATEGY, apply, createGeneralStrategy, inject, memoryPlugin, memoryStrategyConfiguration, name };